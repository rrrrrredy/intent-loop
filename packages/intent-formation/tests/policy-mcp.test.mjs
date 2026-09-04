import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../server/policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("compact policy preserves the four intent-formation moves", () => {
  assert.match(POLICY, /explicit comparison\/options: give requested count, else 2-3 neutral choices/i);
  assert.match(POLICY, /do not ask, choose, use tools, or start work/i);
  assert.match(POLICY, /explicit sample\/example: give exact count, tiny inline from stated facts/i);
  assert.match(POLICY, /mark\/omit unknowns/i);
  assert.match(POLICY, /no inspection\/tools\/files/i);
  assert.match(POLICY, /both override gate/i);
  assert.match(POLICY, /'compare only'\/'do not choose' stays neutral/i);
  assert.match(POLICY, /before public\/lasting\/costly\/high-stakes\/hard-to-reverse output/i);
  assert.match(POLICY, /two stated goals yielding different versions need a lead question before drafting unless a lead was chosen/i);
  assert.match(POLICY, /do not self-balance\/blend/i);
  assert.match(POLICY, /public identity is lasting/i);
  assert.match(POLICY, /assurance vs risk prominence is a lead choice/i);
  assert.match(POLICY, /ignore wording\/details\/inputs/i);
  assert.match(POLICY, /if choices help, give 2-3 neutral branches/i);
  assert.match(POLICY, /end: 'You may mix them, reject all, or answer freely.'/i);
  assert.match(POLICY, /once resolved, deliver now with the chosen lead first, using requested placeholders/i);
  assert.match(POLICY, /no second question, nonessential input/i);
  assert.match(POLICY, /conflict: if requirements cannot coexist, name both; ask one question: which wins/i);
  assert.match(POLICY, /no work\/options\/input request/i);
  assert.match(POLICY, /missing required file\/data\/access: ask only for it/i);
  assert.doesNotMatch(POLICY, /feedback changes intent/i);
  assert.doesNotMatch(POLICY, /uncertain: show micro-variants/i);
  assert.doesNotMatch(POLICY, /Must\/fast\/all\/highly\/but\/also/i);
  assert.doesNotMatch(POLICY, /High-cost risk without known branches/i);
  assert.doesNotMatch(POLICY, /impossible all-constraints option/i);
  assert.ok(Buffer.byteLength(POLICY, "utf8") <= 1100);
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
