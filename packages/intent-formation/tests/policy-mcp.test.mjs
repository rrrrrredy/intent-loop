import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../server/policy.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("compact policy preserves the four intent-formation moves", () => {
  assert.match(POLICY, /clear: act; no question/i);
  assert.match(POLICY, /costly\/public work guided only by subjective terms/i);
  assert.match(POLICY, /professional\/premium\/clean\/modern/i);
  assert.match(POLICY, /unless comparison\/sample requested/i);
  assert.match(POLICY, /before tools\/draft\/write output exactly one outcome\/tradeoff question/i);
  assert.match(POLICY, /2-3 neutral labels\+effects\+mix\/none\/free/i);
  assert.match(POLICY, /never omit option text/i);
  assert.match(POLICY, /give no unasked recommendation\/default\/choice/i);
  assert.match(POLICY, /invented time\/cost\/quality estimate, or deliverable/i);
  assert.match(POLICY, /user states outcome\/priority\/scope\/threshold: act; no second intent question/i);
  assert.match(POLICY, /lacks options: show 2-3 neutral options as above/i);
  assert.match(POLICY, /unprioritized conflict/i);
  assert.match(POLICY, /one tradeoff question/i);
  assert.match(POLICY, /no tools\/invented compromise/i);
  assert.match(POLICY, /must\/fast\/all\/highly\/but\/also set no priority/i);
  assert.match(POLICY, /high-cost risk, no branches: one free-form question/i);
  assert.match(POLICY, /invent none/i);
  assert.match(POLICY, /show 2-3 tiny samples now/i);
  assert.match(POLICY, /no setup/i);
  assert.match(POLICY, /implementation change, intent change, uncertain/i);
  assert.ok(POLICY.length < 900);
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
