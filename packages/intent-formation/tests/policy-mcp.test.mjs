import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../server/policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("compact policy preserves the four intent-formation moves", () => {
  assert.match(POLICY, /newer turns control/i);
  assert.match(POLICY, /turn-scoped limits expire when later expanded/i);
  assert.match(POLICY, /requested comparisons\/options: give the requested count or 2-3 neutral branches/i);
  assert.match(POLICY, /each with one consequence/i);
  assert.match(POLICY, /fulfill without a prior question/i);
  assert.match(POLICY, /do not choose or implement/i);
  assert.match(POLICY, /requested sample\/example\/bounded draft: exact count\/size/i);
  assert.match(POLICY, /keep supplied quantities\/rules unchanged/i);
  assert.match(POLICY, /with "only these facts": no new adjective\/theme\/implication\/intensifier\/scope/i);
  assert.match(POLICY, /repeat supplied facts if needed/i);
  assert.match(POLICY, /keep unsolicited options\/samples inline/i);
  assert.match(POLICY, /requested research\/files may use tools/i);
  assert.match(POLICY, /'compare only' stays neutral/i);
  assert.match(POLICY, /ask once only if 2\+ plausible directions remain/i);
  assert.match(POLICY, /the answer changes the next action/i);
  assert.match(POLICY, /guessing risks costly rework, irreversibility, or external impact/i);
  assert.match(POLICY, /act if a shared step or cheap draft\/sample can reveal it/i);
  assert.match(POLICY, /importance\/publicity\/audience\/style alone do not trigger/i);
  assert.match(POLICY, /ask outcome\/tradeoff\/exposure, not adjacent tone\/input/i);
  assert.match(POLICY, /mixes, rejection, or freeform replies in the user's language/i);
  assert.match(POLICY, /resolved: deliver now, chosen priority first/i);
  assert.match(POLICY, /no second question or invented facts/i);
  assert.match(POLICY, /incompatible requirements: ask which wins, not for a mix/i);
  assert.match(POLICY, /missing file\/data\/access: ask only for it/i);
  assert.doesNotMatch(POLICY, /Must\/fast\/all\/highly\/but\/also/i);
  assert.doesNotMatch(POLICY, /High-cost risk without known branches/i);
  assert.doesNotMatch(POLICY, /impossible all-constraints option/i);
  assert.doesNotMatch(POLICY, /recipient\/context for copy|pace\/depth for teaching|voice family for brand/i);
  // Transport/scope guards, not an assertion of semantic efficacy. The added
  // post-v7 clauses still require installed-model regression and removal tests.
  assert.ok(Buffer.byteLength(POLICY, "utf8") <= 1500);
});

test("raw MCP server performs the handshake and returns hook output", async () => {
  const child = spawn(process.execPath, ["server/policy.mjs"], {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));

  const waitFor = (count) =>
    new Promise((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("MCP response timeout")), 2000);
      const poll = () => {
        if (stdout.split("\n").filter(Boolean).length >= count) {
          clearTimeout(deadline);
          resolve();
          return;
        }
        setTimeout(poll, 5);
      };
      poll();
    });

  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1" }
      }
    }) + "\n"
  );
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n"
  );
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n"
  );
  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_intent_policy", arguments: {} }
    }) + "\n"
  );

  try {
    await waitFor(3);
    const lines = stdout
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    assert.equal(lines[0].result.capabilities.tools instanceof Object, true);
    assert.equal(lines[1].result.tools[0].name, "get_intent_policy");
    assert.deepEqual(lines[1].result.tools[0].inputSchema.properties, {});
    const output = lines[2].result.structuredContent;
    assert.equal(output.continue, true);
    assert.equal(output.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(output.hookSpecificOutput.additionalContext, POLICY);
    assert.equal(stderr, "");
  } finally {
    child.stdin.end();
  }
});

test("policy transport has no raw-prompt input surface", async () => {
  const hooks = JSON.parse(
    await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(repositoryRoot, "hooks", "hooks.json"), "utf8")
    )
  );
  const handler = hooks.hooks.UserPromptSubmit[0].hooks[0];
  assert.deepEqual(handler.input, {});
  assert.equal(JSON.stringify(handler).includes("${prompt}"), false);
});
