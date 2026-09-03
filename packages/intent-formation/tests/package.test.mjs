import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../src/policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), "utf8");
}

async function filesUnder(root, current = "") {
  const directory = path.join(root, current);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, relative));
    else if (entry.isFile()) files.push(relative.replaceAll("\\", "/"));
  }
  return files.sort();
}

test("plugin manifest points to the packaged skill", async () => {
  const manifest = JSON.parse(await read(".codex-plugin/plugin.json"));
  assert.equal(manifest.name, "intent-formation");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.equal(manifest.interface.displayName, "Intent Formation");
  const packageManifest = JSON.parse(await read("package.json"));
  const companionManifest = JSON.parse(await read("companion/.codex-plugin/plugin.json"));
  const constants = await read("src/constants.mjs");
  assert.equal(manifest.version, packageManifest.version);
  assert.equal(companionManifest.version, packageManifest.version);
  assert.match(
    constants,
    new RegExp(`PRODUCT_VERSION = "${packageManifest.version.replaceAll(".", "\\.")}"`)
  );
  assert.equal(packageManifest.license, "Apache-2.0");
});

test("skill preserves the five-move experience boundary", async () => {
  const skill = await read("skills/intent-formation/SKILL.md");
  for (const required of [
    "continue without asking",
    "One question",
    "Concrete comparison",
    "Small sample",
    "implementation_change",
    "intent_change"
  ]) {
    assert.match(skill, new RegExp(required, "i"));
  }
  assert.match(skill, /Do not display a schema/i);
  assert.match(skill, /Never block a user prompt/i);
});

test("core package uses one selective UserPromptSubmit MCP hook", async () => {
  const manifest = JSON.parse(await read(".codex-plugin/plugin.json"));
  assert.equal(manifest.mcpServers, "./.mcp.json");
  const mcp = JSON.parse(await read(".mcp.json"));
  const server = mcp.mcpServers.intent_formation_policy;
  assert.equal(server.command, "node");
  assert.equal(server.args[0], "server/policy.mjs");
  assert.equal(server.cwd, ".");
  const hooks = JSON.parse(await read("hooks/hooks.json"));
  assert.deepEqual(Object.keys(hooks.hooks), ["UserPromptSubmit"]);
  const handler = hooks.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(handler.type, "mcp_tool");
  assert.equal(handler.server, "intent_formation_policy");
  assert.equal(handler.tool, "get_intent_policy");
  assert.deepEqual(handler.input, {});
  assert.equal(handler.timeout, 1);
  assert.equal(handler.additionalContextLimit, 0);
  assert.ok(Buffer.byteLength(POLICY, "utf8") <= 4096);
});

test("core avoids implicit Skill loading and keeps its policy state-free", async () => {
  const metadata = await read("skills/intent-formation/agents/openai.yaml");
  const policyServer = await read("server/policy.mjs");
  const policy = await read("src/policy.mjs");
  assert.match(metadata, /allow_implicit_invocation:\s*false/);
  assert.doesNotMatch(metadata, /dependencies:/);
  assert.doesNotMatch(policyServer, /writeFile|appendFile|transcript_path|params\?\.arguments\?\.prompt/);
  assert.match(policyServer, /import \{ POLICY \} from "\.\.\/src\/policy\.mjs"/);
  assert.match(policy, /tradeoff question/i);
  assert.match(policy, /explicit sample\/example/i);
  assert.match(policy, /both beat the gate/i);
  assert.match(POLICY, /missing success criterion materially changes the result/i);
  assert.match(POLICY, /do not choose' stays neutral after priorities/i);
  assert.match(POLICY, /branches: 2-3 plausible neutral/i);
  assert.match(POLICY, /you may mix them, reject all, or answer freely/i);
  assert.ok(POLICY.length <= 1050);
});

test("optional MCP companion resolves its own bundled server", async () => {
  const plugin = JSON.parse(await read("companion/.codex-plugin/plugin.json"));
  assert.equal(plugin.name, "intent-formation-state");
  assert.equal(plugin.mcpServers, "./.mcp.json");
  assert.equal(plugin.skills, "./skills/");
  const manifest = JSON.parse(await read("companion/.mcp.json"));
  const server = manifest.mcpServers.intent_formation;
  assert.equal(server.command, "node");
  assert.equal(server.args[0], "dist/intent-formation-server.mjs");
  assert.equal(server.cwd, ".");
  assert.doesNotMatch(JSON.stringify(server), /\$\{PLUGIN_(ROOT|DATA)\}/);
  const bundle = await read("companion/dist/intent-formation-server.mjs");
  assert.match(bundle, /intent_add_explicit/);
  assert.doesNotMatch(bundle.slice(0, 80), /#!.*\n#!/);

  const hooks = JSON.parse(await read("companion/hooks/hooks.json"));
  const resumeHandler = hooks.hooks.SessionStart[0].hooks[0];
  assert.match(resumeHandler.command, /dist\/intent-resume\.mjs/);
  const commandHandler = hooks.hooks.UserPromptSubmit[0].hooks[0];
  assert.equal(commandHandler.type, "command");
  assert.equal(commandHandler.timeout, 3);
  assert.equal(commandHandler.additionalContextLimit, 4000);
  assert.match(commandHandler.command, /dist\/intent-command\.mjs/);
  const commandSource = await read("hooks/intent-command.mjs");
  assert.match(commandSource, /MAX_COMMAND_OUTPUT_BYTES\s*=\s*3000/);
  const commandBundle = await read("companion/dist/intent-command.mjs");
  assert.match(commandBundle, /intent_formation_hook/);
  assert.match(commandBundle, /BOUNDED_OUTPUT_EXCEEDED/);
  assert.match(commandBundle, /CONCURRENT_STATE_RECREATED/);
  const resumeBundle = await read("companion/dist/intent-resume.mjs");
  assert.match(resumeBundle, /Saved user-origin intent data follows/);
  const stateSkill = await read("companion/skills/intent-state-control/SKILL.md");
  const stateMetadata = await read("companion/skills/intent-state-control/agents/openai.yaml");
  assert.match(stateSkill, /Read only `CODEX_THREAD_ID`/i);
  assert.match(stateSkill, /Do not list the environment, search files, read Memory/i);
  assert.match(stateSkill, /Do not execute `\/intent off` or `\/intent start off` through this fallback/i);
  assert.match(stateSkill, /Never claim that intervention is off without the trusted Hook receipt/i);
  assert.match(stateSkill, /two-step correction flow/i);
  assert.match(stateSkill, /call .*intent_show.* first/i);
  assert.match(stateSkill, /opaque export id/i);
  assert.match(stateSkill, /does not expose an absolute path/i);
  assert.match(stateSkill, /receipt_id/);
  assert.match(stateMetadata, /allow_implicit_invocation:\s*true/);
});

test("published schemas preserve provenance and portable integrity fields", async () => {
  const record = JSON.parse(await read("schemas/intent-record.schema.json"));
  const portable = JSON.parse(await read("schemas/intent-export.schema.json"));

  for (const field of [
    "statement",
    "role",
    "epistemic_status",
    "source_ref",
    "scope",
    "confidence",
    "valid_from",
    "last_confirmed",
    "supersedes",
    "status"
  ]) {
    assert.equal(record.required.includes(field), true);
  }
  assert.deepEqual(record.properties.status.enum, [
    "active",
    "superseded",
    "invalidated"
  ]);
  assert.equal(portable.properties.format.const, "intent-formation-export");
  assert.equal(portable.properties.integrity.properties.algorithm.const, "sha256");
  assert.equal(
    portable.properties.task.properties.records.items.$ref,
    "./intent-record.schema.json"
  );
});

test("removed selector prototypes cannot ship as accidental hook surfaces", async () => {
  for (const relativePath of [
    "hooks/intent-router.mjs",
    "hooks/intent-router-windows.exe",
    "hooks/IntentRouterWindows.cs",
    "hooks/intent-session.mjs",
    "dist/intent-policy-server.mjs"
  ]) {
    await assert.rejects(access(path.join(repositoryRoot, relativePath)));
  }
});

test("generated Codex distributions contain only the reviewed install surfaces", async () => {
  const workspaceRoot = path.resolve(repositoryRoot, "..", "..");
  const coreFiles = await filesUnder(path.join(workspaceRoot, "plugins", "intent-formation"));
  assert.deepEqual(coreFiles, [
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SBOM.cdx.json",
    "THIRD_PARTY_NOTICES.md",
    "assets/intent-formation.svg",
    "hooks/hooks.json",
    "server/policy.mjs",
    "skills/intent-formation/SKILL.md",
    "skills/intent-formation/agents/openai.yaml",
    "src/constants.mjs",
    "src/policy.mjs"
  ].sort());

  const stateFiles = await filesUnder(
    path.join(workspaceRoot, "plugins", "intent-formation-state")
  );
  assert.deepEqual(stateFiles, [
    ".codex-plugin/plugin.json",
    ".mcp.json",
    "LICENSE",
    "NOTICE",
    "README.md",
    "SBOM.cdx.json",
    "THIRD_PARTY_NOTICES.md",
    "dist/intent-command.mjs",
    "dist/intent-formation-server.mjs",
    "dist/intent-resume.mjs",
    "hooks/hooks.json",
    "skills/intent-state-control/SKILL.md",
    "skills/intent-state-control/agents/openai.yaml"
  ].sort());

  for (const distribution of ["intent-formation", "intent-formation-state"]) {
    const distributionRoot = path.join(workspaceRoot, "plugins", distribution);
    for (const relativePath of await filesUnder(distributionRoot)) {
      const contents = await readFile(path.join(distributionRoot, relativePath), "utf8");
      assert.doesNotMatch(contents, /\r/u, `${distribution}/${relativePath} must use LF`);
    }
  }
});
