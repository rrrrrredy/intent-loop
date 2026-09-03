import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../server/policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("compact policy preserves the four intent-formation moves", () => {
  assert.match(POLICY, /explicit options\/comparison: give requested count or 2-3 neutral choices/i);
  assert.match(POLICY, /explicit sample\/example: give only that count, tiny inline/i);
  assert.match(POLICY, /no inspection\/tools\/commands\/files/i);
  assert.match(POLICY, /both beat the gate/i);
  assert.match(POLICY, /'compare only'\/'do not choose' stays neutral after priorities/i);
  assert.match(POLICY, /gate costly\/public\/hard-to-reverse work only if a missing success criterion materially changes the result/i);
  assert.match(POLICY, /ask one outcome\/tradeoff question before work/i);
  assert.match(POLICY, /audience\/artifact\/'start' is insufficient/i);
  assert.match(POLICY, /branches: 2-3 plausible neutral/i);
  assert.match(POLICY, /end exactly: 'You may mix them, reject all, or answer freely.'/i);
  assert.match(POLICY, /after a user choice, act/i);
  assert.match(POLICY, /no second intent question/i);
  assert.match(POLICY, /conflict: name stated requirements that cannot both hold; ask which wins before requesting input; no options\/work/i);
  assert.match(POLICY, /missing file\/data\/access: ask only for it; no format\/delivery choice/i);
  assert.match(POLICY, /implementation change, intent change, uncertain/i);
  assert.match(POLICY, /if uncertain, show concrete micro-variants\/differences/i);
  assert.doesNotMatch(POLICY, /Must\/fast\/all\/highly\/but\/also/i);
  assert.doesNotMatch(POLICY, /High-cost risk without known branches/i);
  assert.doesNotMatch(POLICY, /impossible all-constraints option/i);
  assert.ok(POLICY.length <= 1050);
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
