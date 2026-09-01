import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDirectory, "..");
const scratchRoot = await mkdtemp(path.join(os.tmpdir(), "intent-loop-distribution-"));
const packagedPlugin = path.join(scratchRoot, "plugin");
const projectRoot = path.join(scratchRoot, "project");
const dataRoot = path.join(scratchRoot, "data");

async function copyDistribution() {
  await mkdir(packagedPlugin, { recursive: true });
  await mkdir(projectRoot, { recursive: true });
  for (const entry of [
    ".codex-plugin",
    ".mcp.json",
    "hooks",
    "runtime",
    "skills",
    "LICENSE",
    "NOTICE",
    "THIRD_PARTY_NOTICES.md",
    "SBOM.cdx.json"
  ]) {
    await cp(path.join(pluginRoot, entry), path.join(packagedPlugin, entry), { recursive: true });
  }
}

async function scanForMarkers(directory, markers) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await scanForMarkers(target, markers);
    } else if (entry.isFile()) {
      const bytes = await readFile(target);
      for (const marker of markers) {
        assert.equal(bytes.includes(Buffer.from(marker)), false, marker + " remained in " + target);
      }
    }
  }
}

async function runHook(input) {
  const hookPath = path.join(packagedPlugin, "runtime", "hook.mjs");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [hookPath], {
      cwd: packagedPlugin,
      env: { INTENT_LOOP_DATA_DIR: dataRoot },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("bundled Hook timed out"));
    }, 10_000);
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error("bundled Hook exited " + code + ": " + Buffer.concat(stderr).toString("utf8")));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

await copyDistribution();
assert.equal(await readdir(packagedPlugin).then((entries) => entries.includes("node_modules")), false);
const packageManifest = JSON.parse(await readFile(path.join(pluginRoot, "package.json"), "utf8"));
const pluginManifest = JSON.parse(await readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
assert.equal(
  pluginManifest.version,
  packageManifest.version,
  "Codex plugin manifest version must match package.json so installed identity is truthful"
);
const sbom = JSON.parse(await readFile(path.join(packagedPlugin, "SBOM.cdx.json"), "utf8"));
assert.equal(sbom.bomFormat, "CycloneDX");
assert.equal(sbom.specVersion, "1.6");
assert.equal(sbom.metadata?.component?.version, packageManifest.version);
assert.match(sbom.serialNumber, /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
const expectedComponents = [
  "@modelcontextprotocol/core@2.0.0",
  "@modelcontextprotocol/server@2.0.0",
  "ajv-formats@3.0.1",
  "ajv@8.18.0",
  "content-type@1.0.5",
  "fast-deep-equal@3.1.3",
  "fast-uri@3.1.0",
  "json-schema-traverse@1.0.0",
  "zod@4.4.3"
];
assert.deepEqual(
  sbom.components.map((component) => `${component.name}@${component.version}`).sort(),
  expectedComponents.sort()
);
const notices = await readFile(path.join(packagedPlugin, "THIRD_PARTY_NOTICES.md"), "utf8");
for (const component of expectedComponents) {
  const versionSeparator = component.lastIndexOf("@");
  const noticeSignature = `${component.slice(0, versionSeparator)} ${component.slice(versionSeparator + 1)}`;
  assert.equal(notices.includes(noticeSignature), true, `missing notice for ${component}`);
}
const hookOutput = await runHook({
  hook_event_name: "SessionStart",
  session_id: "distribution-session",
  cwd: projectRoot
});
assert.equal(hookOutput.continue, true);
assert.equal(hookOutput.suppressOutput, true);
assert.match(String(hookOutput.hookSpecificOutput?.additionalContext ?? ""), /Intent Loop runtime/u);

const serverPath = path.join(packagedPlugin, "runtime", "server.mjs");
const client = new Client({ name: "intent-loop-distribution-test", version: packageManifest.version });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: packagedPlugin,
  env: { INTENT_LOOP_DATA_DIR: dataRoot }
});

const marker = "INTENT_LOOP_DISTRIBUTION_SECRET_7F3A91";
let taskId = "";
try {
  await client.connect(transport);
  assert.equal(
    client.getServerVersion()?.version,
    packageManifest.version,
    "MCP handshake version must match package.json so the running server identity is truthful"
  );
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 15);
  for (const tool of tools.tools) {
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean");
    assert.equal(typeof tool.annotations?.destructiveHint, "boolean");
    assert.equal(tool.annotations?.openWorldHint, false);
  }
  const resources = await client.listResources();
  assert.deepEqual(resources.resources.map((resource) => resource.uri), ["intent-loop://skill/intent"]);
  const skill = await client.readResource({ uri: "intent-loop://skill/intent" });
  assert.match(String(skill.contents[0]?.text ?? ""), /# Intent Loop/u);

  const start = await client.callTool({
    name: "intent_start_task",
    arguments: { project_root: projectRoot, request_id: randomUUID(), mode: "on" }
  });
  assert.equal(start.isError, undefined);
  const startEnvelope = start.structuredContent;
  taskId = String(startEnvelope?.result?.task_id ?? "");
  assert.match(taskId, /^[0-9a-f-]{36}$/u);

  const add = await client.callTool({
    name: "intent_add_explicit",
    arguments: {
      project_root: projectRoot,
      task_id: taskId,
      request_id: randomUUID(),
      statement: "Keep distribution self-contained; redact " + marker + ".",
      source_ref: {
        kind: "user_event",
        event_id: randomUUID(),
        sha256: createHash("sha256").update(marker).digest("hex")
      },
      scope: "task",
      facets: ["hard_constraint"],
      confirmation_reason: "direct_statement"
    }
  });
  assert.equal(add.isError, undefined);
  assert.equal(JSON.stringify(add.structuredContent).includes(marker), false);

  const snapshot = await client.callTool({
    name: "intent_get_snapshot",
    arguments: { project_root: projectRoot, task_id: taskId }
  });
  assert.equal(snapshot.isError, undefined);
  assert.match(JSON.stringify(snapshot.structuredContent), /\[REDACTED:/u);

  const deletion = await client.callTool({
    name: "intent_delete",
    arguments: {
      project_root: projectRoot,
      task_id: taskId,
      target: "task",
      confirmation: "DELETE TASK " + taskId
    }
  });
  assert.equal(deletion.isError, undefined);
  await scanForMarkers(dataRoot, [taskId, marker]);

  process.stdout.write(JSON.stringify({
    ok: true,
    self_contained: true,
    tool_count: tools.tools.length,
    resource_count: resources.resources.length,
    sbom_component_count: sbom.components.length,
    lifecycle: "start-add-read-delete",
    hook_fail_open: true,
    secret_redacted: true,
    deleted_markers_absent: true
  }) + "\n");
} finally {
  await client.close().catch(() => undefined);
  const resolvedScratch = path.resolve(scratchRoot);
  assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
  await rm(resolvedScratch, { recursive: true, force: true });
}
