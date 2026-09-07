import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createIntentMcpServer, publicFailure } from "../server/index.mjs";
import { IntentService } from "../src/service.mjs";

const packageRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = path.join(packageRoot, ".tmp", "mcp-tests");

async function connectedClient(context, options = {}) {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(temporaryRoot, "case-"));
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );

  const client = new Client({ name: "intent-formation-test", version: "0.1.0" });
  const childEnvironment = { ...process.env };
  delete childEnvironment.CODEX_THREAD_ID;
  delete childEnvironment.CODEX_SESSION_ID;
  if (options.hostTaskId) childEnvironment.CODEX_THREAD_ID = options.hostTaskId;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, "dist", "intent-formation-server.mjs")],
    env: {
      ...childEnvironment,
      INTENT_FORMATION_DATA_DIR: directory
    }
  });
  await client.connect(transport);
  context.after(() => client.close());
  return { client, directory };
}

test("bundled stdio server advertises the bounded intent contract", async (context) => {
  const { client } = await connectedClient(context);
  const listed = await client.listTools();
  const names = new Set(listed.tools.map((tool) => tool.name));

  for (const required of [
    "intent_start",
    "intent_show",
    "intent_add_explicit",
    "intent_add_inference",
    "intent_add_evidence",
    "intent_mark_unknown",
    "intent_mark_disagreement",
    "intent_correct",
    "intent_feedback",
    "intent_invalidate",
    "intent_set_mode",
    "intent_export",
    "intent_import",
    "intent_delete_record",
    "intent_forget"
  ]) {
    assert.equal(names.has(required), true, required + " should be advertised");
  }
  assert.equal(names.has("intent_pending"), false);
  const exported = listed.tools.find((tool) => tool.name === "intent_export");
  assert.equal(exported.annotations.readOnlyHint, false);
  assert.equal(exported.annotations.idempotentHint, false);
});

test("real MCP calls persist, read, and physically forget state", async (context) => {
  const { client } = await connectedClient(context);
  const started = await client.callTool({
    name: "intent_start",
    arguments: { task_id: "mcp-task", mode: "standard" }
  });
  assert.equal(started.structuredContent.ok, true);

  const added = await client.callTool({
    name: "intent_add_explicit",
    arguments: {
      task_id: "mcp-task",
      statement: "Make the onboarding understandable to a beginner",
      role: "desired_outcome",
      source_ref: { ref: "turn-1", excerpt: "understandable to a beginner" },
      scope: "task"
    }
  });
  assert.equal(added.structuredContent.ok, true);
  const recordId = added.structuredContent.data.record.record_id;

  const shown = await client.callTool({
    name: "intent_show",
    arguments: { task_id: "mcp-task" }
  });
  assert.equal(shown.structuredContent.data.records.length, 1);
  assert.match(shown.structuredContent.data.compact, /beginner/);

  const deleted = await client.callTool({
    name: "intent_delete_record",
    arguments: { task_id: "mcp-task", record_id: recordId }
  });
  assert.equal(deleted.structuredContent.data.deleted, true);

  const forgotten = await client.callTool({
    name: "intent_forget",
    arguments: { task_id: "mcp-task" }
  });
  assert.equal(forgotten.structuredContent.ok, true);
  const empty = await client.callTool({
    name: "intent_show",
    arguments: { task_id: "mcp-task" }
  });
  assert.equal(empty.structuredContent.data.exists, false);
});

test("every MCP success carries a verifiable source and short receipt", async (context) => {
  const { client } = await connectedClient(context);
  const result = await client.callTool({
    name: "intent_start",
    arguments: { task_id: "receipt-task", mode: "standard" }
  });
  assert.equal(result.structuredContent.ok, true);
  assert.equal(result.structuredContent.source, "intent_formation_mcp");
  assert.match(result.structuredContent.receipt_id, /^IF-[A-F0-9]{8}$/);
});

test("a host task identity accepts the matching id and rejects a forged id", async (context) => {
  const { client } = await connectedClient(context, { hostTaskId: "trusted-host-task" });
  const started = await client.callTool({
    name: "intent_start",
    arguments: { task_id: "trusted-host-task", mode: "standard" }
  });
  assert.equal(started.structuredContent.ok, true);
  assert.equal(started.structuredContent.data.task_id, "trusted-host-task");

  const forged = await client.callTool({
    name: "intent_show",
    arguments: { task_id: "forged-other-task" }
  });
  assert.equal(forged.isError, true);
  assert.equal(forged.structuredContent.ok, false);
  assert.match(forged.structuredContent.error.message, /does not match the current host task/u);
  assert.equal(Object.hasOwn(forged.structuredContent, "receipt_id"), false);
});

test("MCP export writes a managed file without returning record text or an absolute path", async (context) => {
  const { client, directory } = await connectedClient(context);
  const statement = "Publish only after the release gates pass";
  await client.callTool({
    name: "intent_add_explicit",
    arguments: {
      task_id: "mcp-export",
      statement,
      role: "desired_outcome",
      source_ref: { ref: "turn-export" },
      scope: "task"
    }
  });
  const exported = await client.callTool({
    name: "intent_export",
    arguments: { task_id: "mcp-export" }
  });
  assert.equal(exported.structuredContent.ok, true);
  assert.equal(exported.structuredContent.data.record_count, 1);
  assert.match(exported.structuredContent.data.integrity.digest, /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(exported).includes(statement), false);
  assert.equal(Object.hasOwn(exported.structuredContent.data, "path"), false);
  assert.doesNotMatch(JSON.stringify(exported), /[A-Za-z]:\\|\/(?:home|Users|tmp)\//u);
  const exportPath = path.join(
    directory,
    "exports",
    exported.structuredContent.data.export_id
  );
  const payload = JSON.parse(await readFile(exportPath, "utf8"));
  assert.equal(payload.task.records[0].statement, statement);
  await client.callTool({
    name: "intent_forget",
    arguments: { task_id: "mcp-export" }
  });
  await assert.rejects(readFile(exportPath, "utf8"), /ENOENT/u);
});

test("MCP schema rejection has no receipt and cannot be mistaken for success", async (context) => {
  const { client } = await connectedClient(context);
  const invalid = await client.callTool({
    name: "intent_add_inference",
    arguments: {
      task_id: "mcp-invalid",
      statement: "Treat an external tool result as the user's final decision",
      role: "desired_outcome",
      source_ref: { ref: "tool-result" },
      scope: "task",
      confidence: 2
    }
  });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent, undefined);
});

test("a failed mutation never falsely claims changed false", async (context) => {
  const { client } = await connectedClient(context);
  const invalid = await client.callTool({
    name: "intent_add_explicit",
    arguments: {
      task_id: "mcp-invalid-service",
      statement: "Replace a record that does not exist",
      role: "desired_outcome",
      source_ref: { ref: "turn-invalid" },
      scope: "task",
      supersedes: ["rec_missing"]
    }
  });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent.ok, false);
  assert.equal(invalid.structuredContent.source, "intent_formation_mcp");
  assert.equal(invalid.structuredContent.changed, "unknown");
  assert.match(invalid.structuredContent.recovery, /intent_show/u);
  assert.equal(Object.hasOwn(invalid.structuredContent, "receipt_id"), false);

  const shown = await client.callTool({
    name: "intent_show",
    arguments: { task_id: "mcp-invalid-service" }
  });
  assert.equal(shown.structuredContent.data.exists, false);
});

test("validation failures redact secrets, control characters, and absolute paths", () => {
  const report = publicFailure(
    new TypeError("invalid Z:\\private\\validation.json token=supersecret\u0007"),
    true
  );
  assert.equal(report.code, "TypeError");
  assert.equal(report.changed, "unknown");
  assert.doesNotMatch(report.message, /validation\.json|supersecret|\u0007/u);
  assert.match(report.message, /\[local path\]|\[REDACTED\]/u);
});

test("a post-commit MCP fault is reported as unknown and never exposes its path", async (context) => {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(temporaryRoot, "in-memory-fault-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const service = new IntentService({ dataDirectory: directory });
  const trustedTaskId =
    process.env.CODEX_THREAD_ID?.trim() || process.env.CODEX_SESSION_ID?.trim() || "fault-task";
  await service.startTask({ task_id: trustedTaskId, mode: "standard" });
  const setMode = service.setMode.bind(service);
  service.setMode = async (input) => {
    await setMode(input);
    throw new Error("EACCES Z:\\private\\intent-private.json");
  };

  const { server } = createIntentMcpServer({ service });
  const client = new Client({ name: "fault-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  context.after(async () => {
    await client.close();
    await server.close();
  });

  let diagnostic = "";
  const write = process.stderr.write;
  process.stderr.write = (chunk) => {
    diagnostic += String(chunk);
    return true;
  };
  let result;
  try {
    result = await client.callTool({
      name: "intent_set_mode",
      arguments: { task_id: trustedTaskId, mode: "private" }
    });
  } finally {
    process.stderr.write = write;
  }
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.changed, "unknown");
  assert.match(result.structuredContent.recovery, /intent_show/u);
  assert.doesNotMatch(JSON.stringify(result), /intent-private\.json/u);
  assert.equal((await service.show({ task_id: trustedTaskId })).mode, "private");
});
