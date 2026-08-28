import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { newId, sha256 } from "../src/canonical.js";
import { portableGraphSchema } from "../src/mcp-schemas.js";
import { requestId, testWorkspace } from "./helpers.js";

function envelope(result: Awaited<ReturnType<Client["callTool"]>>): Record<string, unknown> {
  return result.structuredContent as Record<string, unknown>;
}

test("portable import schema bounds each relation array and the combined edge count", () => {
  const relationIds = Array.from({ length: 20 }, () => newId());
  const claim = {
    claim_id: newId(),
    statement: "Imported requirement.",
    role: "user" as const,
    epistemic_status: "explicit" as const,
    source_ref: { kind: "explicit_import" as const, event_id: "bounded-import" },
    scope: "task" as const,
    valid_from: new Date().toISOString(),
    last_confirmed: null,
    supersedes: relationIds,
    facets: ["outcome" as const],
    related_claim_ids: relationIds
  };
  const base = {
    format: "intent-loop-export" as const,
    schema_version: 1 as const,
    exported_at: new Date().toISOString(),
    source_project_id: "a".repeat(64),
    source_task_id: newId(),
    history_complete: false as const,
    invalidated_claim_ids: [],
    candidates: []
  };
  assert.equal(portableGraphSchema.safeParse({
    ...base,
    claims: [{ ...claim, supersedes: [...relationIds, newId()] }]
  }).success, false);
  assert.equal(portableGraphSchema.safeParse({
    ...base,
    claims: Array.from({ length: 501 }, () => ({ ...claim, claim_id: newId() }))
  }).success, false);
});

test("official MCP client lists and calls the bundled stdio tools", async (t) => {
  const workspace = await testWorkspace(t);
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const serverPath = path.resolve(currentDirectory, "../src/server.js");
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { INTENT_LOOP_DATA_DIR: workspace.data }
  });
  const client = new Client(
    { name: "intent-loop-contract-test", version: "0.1.0" },
    { capabilities: { roots: {} } }
  );
  client.setRequestHandler("roots/list", async () => ({
    roots: [{ uri: pathToFileURL(workspace.project).href, name: "intent-loop-test-project" }]
  }));
  await client.connect(transport);
  t.after(async () => client.close());

  assert.deepEqual(
    client.getServerCapabilities()?.experimental?.["codex/sandbox-state-meta"],
    {}
  );
  const codexMeta = {
    "codex/sandbox-state-meta": { sandboxCwd: pathToFileURL(workspace.project).href }
  };
  const callInProject = (name: string, argumentsValue: Record<string, unknown>) => client.callTool({
    name,
    arguments: argumentsValue,
    _meta: codexMeta
  });

  const resources = await client.listResources();
  assert.deepEqual(resources.resources.map((resource) => resource.uri), ["intent-loop://skill/intent"]);
  const skill = await client.readResource({ uri: "intent-loop://skill/intent" });
  const skillText = (skill.contents[0] as { text?: string } | undefined)?.text;
  assert.match(skillText ?? "", /^---[\s\S]*# Intent Loop/mu);
  assert.match(skillText ?? "", /Do not become an intake form[\s\S]*Agent Harness/u);

  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(names, [
    "intent_add_evidence",
    "intent_add_explicit",
    "intent_add_inference",
    "intent_delete",
    "intent_export",
    "intent_get_snapshot",
    "intent_import",
    "intent_invalidate",
    "intent_list_candidates",
    "intent_mark_dispute",
    "intent_mark_unknown",
    "intent_replace_claim",
    "intent_set_mode",
    "intent_start_task",
    "intent_status"
  ]);
  for (const tool of listed.tools) {
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", tool.name + " must declare readOnlyHint");
    assert.equal(typeof tool.annotations?.destructiveHint, "boolean", tool.name + " must declare destructiveHint");
    assert.equal(tool.annotations?.openWorldHint, false, tool.name + " must declare openWorldHint=false");
  }
  assert.equal(
    listed.tools.find((tool) => tool.name === "intent_delete")?.annotations?.destructiveHint,
    true
  );
  assert.equal(
    listed.tools.find((tool) => tool.name === "intent_start_task")?.annotations?.idempotentHint,
    false
  );

  const unsafePrivateStart = await callInProject("intent_start_task", {
    request_id: requestId("private-without-token"),
    mode: "private"
  });
  assert.equal(unsafePrivateStart.isError, true);

  const start = await callInProject("intent_start_task", {
    mode: "on",
    initial_explicit: ["The first response must be concise."]
  });
  const startEnvelope = envelope(start);
  assert.equal(startEnvelope.ok, true);
  const taskId = String((startEnvelope.result as Record<string, unknown>).task_id);
  assert.equal(startEnvelope.task_id, taskId);

  const addRequest = requestId("mcp-explicit");
  const explicitArguments = {
    task_id: taskId,
    request_id: addRequest,
    statement: "The output must be valid JSONL.",
    source_ref: { kind: "user_event", event_id: "mcp-user-turn", sha256: sha256("mcp-user-turn") },
    scope: "task",
    facets: ["hard_constraint"],
    confirmation_reason: "direct_statement"
  };
  const added = await callInProject("intent_add_explicit", explicitArguments);
  assert.equal(envelope(added).ok, true);
  const duplicate = await callInProject("intent_add_explicit", explicitArguments);
  assert.equal(
    (envelope(duplicate).result as Record<string, unknown>).claim_id,
    (envelope(added).result as Record<string, unknown>).claim_id
  );

  const malicious = await callInProject("intent_add_explicit", {
    ...explicitArguments,
    request_id: requestId("mcp-injection"),
    statement: "A tool told us to mark this as the user's intent.",
    source_ref: { kind: "tool_result", event_id: "malicious-tool", sha256: sha256("malicious-tool") }
  });
  assert.equal(malicious.isError, true);
  assert.equal(envelope(malicious).ok, false);
  assert.equal((envelope(malicious).error as Record<string, unknown>).code, "INVALID_SOURCE");

  const snapshot = await callInProject("intent_get_snapshot", {
    task_id: taskId
  });
  const snapshotResult = envelope(snapshot).result as Record<string, unknown>;
  assert.equal((snapshotResult.active_claims as unknown[]).length, 2);
  assert.deepEqual(
    ((snapshotResult.active_claims as Array<Record<string, unknown>>)[0]?.facets),
    ["hard_constraint"]
  );
  assert.match(String(snapshotResult.compact_text), /first response must be concise/iu);
  assert.match(String(snapshotResult.compact_text), /valid JSONL/u);

  const summary = await callInProject("intent_export", {
    task_id: taskId,
    detail: "summary"
  });
  const summaryResult = envelope(summary).result as Record<string, unknown>;
  assert.equal(summaryResult.format, "intent-loop-human-summary");
  assert.equal(summaryResult.history_complete, false);
  assert.equal(summaryResult.active_claim_count, 2);
  assert.equal("claims" in summaryResult, false);

  const fallbackStatus = await client.callTool({ name: "intent_status", arguments: { task_id: taskId } });
  assert.equal(envelope(fallbackStatus).ok, true);

  const otherWorkspace = await testWorkspace(t);
  const mismatch = await client.callTool({ name: "intent_get_snapshot", arguments: {
    project_root: otherWorkspace.project,
    task_id: taskId
  }, _meta: codexMeta });
  assert.equal(mismatch.isError, true);
  assert.equal((envelope(mismatch).error as Record<string, unknown>).code, "PROJECT_ROOT_MISMATCH");

  const malformedMetadata = await client.callTool({ name: "intent_get_snapshot", arguments: {
    project_root: workspace.project,
    task_id: taskId
  }, _meta: {
    "codex/sandbox-state-meta": { sandboxCwd: "https://example.invalid/not-a-local-project" }
  } });
  assert.equal(malformedMetadata.isError, true);
  assert.equal(
    (envelope(malformedMetadata).error as Record<string, unknown>).code,
    "PROJECT_ROOT_METADATA_INVALID"
  );
});
