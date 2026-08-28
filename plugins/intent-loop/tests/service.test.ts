import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { projectIdForRoot, sha256 } from "../src/canonical.js";
import { IntentLoopError } from "../src/errors.js";
import { IntentService } from "../src/service.js";
import { LedgerStore } from "../src/storage.js";
import { SourceRef } from "../src/types.js";
import { requestId, testWorkspace } from "./helpers.js";

function source(kind: SourceRef["kind"], label: string): SourceRef {
  return { kind, event_id: label, sha256: sha256(label) };
}

test("keeps explicit, inferred, evidence, unknown, and dispute states separate", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const started = await service.startTask({
    project_root: workspace.project,
    request_id: requestId("start"),
    host_session_id: "session-semantic"
  });
  const taskId = started.task_id;
  const explicit = await service.addExplicit({
    project_root: workspace.project,
    task_id: taskId,
    request_id: requestId("explicit"),
    statement: "The deliverable is a two-page decision memo.",
    source_ref: source("user_event", "turn-user-1"),
    scope: "task",
    facets: ["outcome"],
    confirmation_reason: "direct_statement"
  });
  const inferred = await service.addInference({
    project_root: workspace.project,
    task_id: taskId,
    request_id: requestId("inference"),
    statement: "The user may prefer a skeptical tone.",
    source_ref: source("agent_turn", "turn-agent-1"),
    scope: "task",
    confidence: 0.62,
    facets: ["soft_constraint"]
  });
  assert.equal("claim_id" in inferred, true);
  await service.addEvidence({
    project_root: workspace.project,
    task_id: taskId,
    request_id: requestId("evidence"),
    statement: "The first sample exceeded two pages.",
    source_ref: source("tool_result", "tool-result-1"),
    scope: "task",
    facets: ["failure_signal"],
    feedback_class: "implementation_change"
  });
  await service.markUnknown({
    project_root: workspace.project,
    task_id: taskId,
    request_id: requestId("unknown"),
    statement: "Whether an appendix is acceptable remains unknown.",
    source_ref: source("agent_turn", "turn-agent-2"),
    scope: "task",
    facets: ["unknown"]
  });
  await service.markDispute({
    project_root: workspace.project,
    task_id: taskId,
    request_id: requestId("dispute"),
    statement: "The user requested brevity while the agent recommends extra evidence.",
    source_ref: source("agent_turn", "turn-agent-3"),
    scope: "task",
    facets: ["disagreement"],
    related_claim_ids: [explicit.claim_id, "claim_id" in inferred ? inferred.claim_id : ""]
  });
  const snapshot = await service.getSnapshot({ project_root: workspace.project, task_id: taskId });
  assert.deepEqual(new Set(snapshot.active_claims.map((claim) => claim.epistemic_status)), new Set([
    "explicit", "inferred", "evidence", "unknown", "disputed"
  ]));
  assert.equal(snapshot.unknowns.length, 1);
  assert.equal(snapshot.disagreements.length, 1);
  assert.match(snapshot.compact_text, /Never treat inferred or evidence/u);
});

test("replacement preserves old provenance in export but removes it from current view", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  const oldClaim = await service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("old"),
    statement: "Use cards for the task list.",
    source_ref: source("user_event", "turn-old"),
    scope: "task",
    facets: ["soft_constraint"],
    confirmation_reason: "direct_statement"
  });
  const replacement = await service.replaceClaim({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("replace"),
    statement: "Use a dense keyboard-first table.",
    role: "user",
    epistemic_status: "explicit",
    source_ref: source("user_event", "turn-new"),
    scope: "task",
    facets: ["soft_constraint"],
    supersedes: [oldClaim.claim_id],
    last_confirmed: new Date().toISOString()
  });
  const current = await service.getSnapshot({ project_root: workspace.project, task_id: task.task_id });
  assert.deepEqual(current.active_claims.map((claim) => claim.claim_id), [replacement.claim_id]);
  const exported = await service.exportGraph({ project_root: workspace.project, task_id: task.task_id });
  assert.equal(exported.claims.length, 2);
  assert.equal(exported.claims.find((claim) => claim.claim_id === oldClaim.claim_id)?.statement, "Use cards for the task list.");
  assert.deepEqual(exported.claims.find((claim) => claim.claim_id === replacement.claim_id)?.supersedes, [oldClaim.claim_id]);
});

test("implementation feedback remains evidence and does not rewrite intent", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  const intent = await service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("intent"),
    statement: "Export valid CSV.",
    source_ref: source("user_event", "turn-csv"),
    scope: "task",
    facets: ["outcome"],
    confirmation_reason: "direct_statement"
  });
  const feedback = await service.addEvidence({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("feedback"),
    statement: "The generated CSV has malformed quoting.",
    source_ref: source("user_event", "turn-feedback"),
    scope: "task",
    facets: ["result_feedback"],
    feedback_class: "implementation_change"
  });
  const snapshot = await service.getSnapshot({ project_root: workspace.project, task_id: task.task_id });
  assert.equal(snapshot.active_claims.some((claim) => claim.claim_id === intent.claim_id), true);
  assert.equal(snapshot.active_claims.find((claim) => claim.claim_id === feedback.claim_id)?.result_feedback_class, "implementation_change");
  assert.deepEqual(feedback.supersedes, []);
});

test("private mode never creates a persistent ledger and off rejects semantic writes", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const service = new IntentService(store);
  const privateTask = await service.startTask({
    project_root: workspace.project,
    request_id: requestId("private-start"),
    host_session_id: "private-test-session",
    mode: "private"
  });
  await service.addExplicit({
    project_root: workspace.project,
    task_id: privateTask.task_id,
    request_id: requestId("private-claim"),
    statement: "This exists only in process memory.",
    source_ref: source("user_event", "private-turn"),
    scope: "task",
    facets: ["outcome"],
    confirmation_reason: "direct_statement"
  });
  assert.equal(await store.exists(projectIdForRoot(workspace.project)), false);

  const offProject = path.join(workspace.root, "off-project");
  await mkdir(offProject);
  const offTask = await service.startTask({
    project_root: offProject,
    request_id: requestId("off-start"),
    mode: "off"
  });
  await assert.rejects(service.addExplicit({
    project_root: offProject,
    task_id: offTask.task_id,
    request_id: requestId("off-claim"),
    statement: "Must not persist.",
    source_ref: source("user_event", "off-turn"),
    scope: "task",
    facets: ["outcome"],
    confirmation_reason: "direct_statement"
  }), (error: unknown) => error instanceof IntentLoopError && error.code === "MODE_OFF");
});

test("long-term inference stays a candidate until three tasks and direct confirmation", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  let thirdTask = "";
  let thirdCandidateTaskCount = 0;
  for (let index = 1; index <= 3; index += 1) {
    const task = await service.startTask({ project_root: workspace.project, request_id: requestId(`start-${index}`) });
    thirdTask = task.task_id;
    const candidate = await service.addInference({
      project_root: workspace.project,
      task_id: task.task_id,
      request_id: requestId(`signal-${index}`),
      statement: "The user may prefer dense keyboard-first tables.",
      source_ref: source("user_event", `signal-turn-${index}`),
      scope: "long_term",
      confidence: 0.7,
      facets: ["soft_constraint"],
      signal_key: "preference-dense-table"
    });
    if ("candidate_type" in candidate) thirdCandidateTaskCount = candidate.task_ids?.length ?? 0;
  }
  assert.equal(thirdCandidateTaskCount, 3);
  const before = await service.getSnapshot({ project_root: workspace.project, task_id: thirdTask });
  assert.equal(before.active_claims.length, 0);
  const confirmed = await service.addExplicit({
    project_root: workspace.project,
    task_id: thirdTask,
    request_id: requestId("confirm-long-term"),
    statement: "Across projects, I prefer dense keyboard-first tables.",
    source_ref: source("user_event", "confirm-turn"),
    scope: "long_term",
    facets: ["soft_constraint"],
    confirmation_reason: "confirmed_candidate"
  });
  assert.equal(confirmed.scope, "long_term");
  assert.equal(confirmed.epistemic_status, "explicit");
});

test("export and explicit import preserve provenance, dispute, and supersession graph", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const sourceTask = await service.startTask({ project_root: workspace.project, request_id: requestId("source-start") });
  const first = await service.addExplicit({
    project_root: workspace.project,
    task_id: sourceTask.task_id,
    request_id: requestId("first"),
    statement: "Prefer cards.",
    source_ref: source("user_event", "source-turn-1"),
    scope: "task",
    facets: ["soft_constraint"],
    confirmation_reason: "direct_statement"
  });
  const second = await service.replaceClaim({
    project_root: workspace.project,
    task_id: sourceTask.task_id,
    request_id: requestId("second"),
    statement: "Prefer a dense table.",
    role: "user",
    epistemic_status: "explicit",
    source_ref: source("user_event", "source-turn-2"),
    scope: "task",
    facets: ["soft_constraint"],
    supersedes: [first.claim_id],
    last_confirmed: new Date().toISOString()
  });
  await service.markDispute({
    project_root: workspace.project,
    task_id: sourceTask.task_id,
    request_id: requestId("dispute"),
    statement: "Dense layout may conflict with touch accessibility.",
    source_ref: source("agent_turn", "source-turn-3"),
    scope: "task",
    facets: ["disagreement"],
    related_claim_ids: [first.claim_id, second.claim_id]
  });
  const graph = await service.exportGraph({ project_root: workspace.project, task_id: sourceTask.task_id });
  assert.equal(graph.history_complete, false);

  const targetTask = await service.startTask({ project_root: workspace.project, request_id: requestId("target-start") });
  const imported = await service.importGraph({
    project_root: workspace.project,
    task_id: targetTask.task_id,
    request_id: requestId("import"),
    graph
  });
  assert.equal(imported.active_claims.some((claim) => claim.statement === second.statement), true);
  assert.equal(imported.active_claims.some((claim) => claim.claim_id === second.claim_id), false);
  assert.equal(imported.active_claims.some((claim) => claim.statement === first.statement), false);
  assert.equal(imported.disagreements.length, 1);
  const reexported = await service.exportGraph({ project_root: workspace.project, task_id: targetTask.task_id });
  assert.equal(reexported.claims.every((claim) => claim.source_ref.kind === "explicit_import"), true);
  assert.equal(reexported.claims.every((claim) => !graph.claims.some((sourceClaim) => sourceClaim.claim_id === claim.claim_id)), true);
  const importedFirst = reexported.claims.find((claim) => claim.statement === first.statement);
  const importedSecond = reexported.claims.find((claim) => claim.statement === second.statement);
  assert.ok(importedFirst !== undefined);
  assert.ok(importedSecond !== undefined);
  assert.deepEqual(importedSecond.supersedes, [importedFirst.claim_id]);
});

test("redacts secrets before disk and physical deletion removes claim and task bytes", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const service = new IntentService(store);
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  const marker = `delete-marker-${Date.now()}`;
  const claim = await service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("claim"),
    statement: `${marker} with sk-test-1234567890abcdef`,
    source_ref: source("user_event", "delete-turn"),
    scope: "task",
    facets: ["outcome"],
    confirmation_reason: "direct_statement"
  });
  const projectId = projectIdForRoot(workspace.project);
  const ledger = await store.ledgerPath(projectId);
  const before = await readFile(ledger, "utf8");
  assert.equal(before.includes("sk-test-1234567890abcdef"), false);
  assert.equal(before.includes(marker), true);

  await service.delete({
    project_root: workspace.project,
    task_id: task.task_id,
    target: "claim",
    claim_id: claim.claim_id,
    confirmation: `DELETE CLAIM ${claim.claim_id}`
  });
  const afterClaim = await readFile(ledger, "utf8");
  assert.equal(afterClaim.includes(claim.claim_id), false);
  assert.equal(afterClaim.includes(marker), false);
  const snapshot = await service.getSnapshot({ project_root: workspace.project, task_id: task.task_id });
  assert.equal(snapshot.active_claims.length, 0);

  await service.delete({
    project_root: workspace.project,
    task_id: task.task_id,
    target: "task",
    confirmation: `DELETE TASK ${task.task_id}`
  });
  const afterTask = await readFile(ledger, "utf8");
  assert.equal(afterTask.includes(task.task_id), false);
  await assert.rejects(
    service.getSnapshot({ project_root: workspace.project, task_id: task.task_id }),
    (error: unknown) => error instanceof IntentLoopError && error.code === "TASK_NOT_FOUND"
  );
});

test("same task UUID cannot be read through another project scope", async (t) => {
  const workspace = await testWorkspace(t);
  const otherProject = path.join(workspace.root, "other-project");
  await mkdir(otherProject);
  const service = new IntentService(new LedgerStore(workspace.data));
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  await assert.rejects(
    service.getSnapshot({ project_root: otherProject, task_id: task.task_id }),
    (error: unknown) => error instanceof IntentLoopError && error.code === "TASK_NOT_FOUND"
  );
});

test("delete requires the exact target confirmation", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  await assert.rejects(
    service.delete({
      project_root: workspace.project,
      task_id: task.task_id,
      target: "task",
      confirmation: "yes"
    }),
    (error: unknown) => error instanceof IntentLoopError && error.code === "CONFIRMATION_REQUIRED"
  );
});

test("start creates all direct initial claims in one deterministic ledger event", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const service = new IntentService(store);
  const request = requestId("atomic-start");
  const initial = Array.from({ length: 6 }, (_, index) => ({
    statement: `Direct requirement ${index + 1}.`,
    scope: "task" as const,
    facets: [index === 0 ? "outcome" as const : "hard_constraint" as const]
  }));
  const first = await service.startTask({
    project_root: workspace.project,
    request_id: request,
    initial_explicit: initial
  });
  assert.equal(first.active_claims.length, 6);
  const events = await store.readEvents(projectIdForRoot(workspace.project));
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event_type, "task_started");
  assert.equal((events[0]?.payload.initial_claims as unknown[]).length, 6);

  const retried = await service.startTask({
    project_root: workspace.project,
    request_id: request,
    initial_explicit: initial
  });
  assert.equal(retried.task_id, first.task_id);
  assert.deepEqual(
    retried.active_claims.map((claim) => claim.claim_id),
    first.active_claims.map((claim) => claim.claim_id)
  );
  assert.equal((await store.readEvents(projectIdForRoot(workspace.project))).length, 1);

  await assert.rejects(service.startTask({
    project_root: workspace.project,
    request_id: request,
    initial_explicit: [{ statement: "A different request body.", facets: ["outcome"] }]
  }), (error: unknown) => error instanceof IntentLoopError && error.code === "REQUEST_ID_REUSED");
});

test("off start rejects semantic input before any ledger is created", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const service = new IntentService(store);
  const marker = "Secret semantic label survives off mode.";
  await assert.rejects(service.startTask({
    project_root: workspace.project,
    request_id: requestId("off-label"),
    mode: "off",
    label: marker
  }), (error: unknown) => error instanceof IntentLoopError && error.code === "MODE_OFF_SEMANTIC_INPUT");
  assert.equal(await store.exists(projectIdForRoot(workspace.project)), false);
});

test("request IDs reject different normalized mutation parameters", async (t) => {
  const workspace = await testWorkspace(t);
  const service = new IntentService(new LedgerStore(workspace.data));
  const task = await service.startTask({ project_root: workspace.project, request_id: requestId("start") });
  const duplicateRequest = requestId("bound-claim");
  await service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: duplicateRequest,
    statement: "Keep response A.",
    source_ref: source("user_event", "bound-source"),
    scope: "task",
    facets: ["hard_constraint"],
    confirmation_reason: "direct_statement"
  });
  await assert.rejects(service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: duplicateRequest,
    statement: "Keep response B.",
    source_ref: source("user_event", "bound-source"),
    scope: "task",
    facets: ["hard_constraint"],
    confirmation_reason: "direct_statement"
  }), (error: unknown) => error instanceof IntentLoopError && error.code === "REQUEST_ID_REUSED");

  const modeRequest = requestId("bound-mode");
  await service.setMode({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: modeRequest,
    mode: "off"
  });
  await assert.rejects(service.setMode({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: modeRequest,
    mode: "on"
  }), (error: unknown) => error instanceof IntentLoopError && error.code === "REQUEST_ID_REUSED");
});

test("escaped JSON and spaced credentials never reach the ledger", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const service = new IntentService(store);
  const escapedSecret = "TOPSECRETVALUE987";
  const spacedSecret = "correct horse battery staple";
  const task = await service.startTask({
    project_root: workspace.project,
    request_id: requestId("redacted-start"),
    initial_explicit: [{
      statement: String.raw`{"password":"abc\\\"${escapedSecret}"}`,
      facets: ["hard_constraint"]
    }]
  });
  await service.addExplicit({
    project_root: workspace.project,
    task_id: task.task_id,
    request_id: requestId("redacted-add"),
    statement: `password: "${spacedSecret}", retain this suffix`,
    source_ref: source("user_event", "redacted-source"),
    scope: "task",
    facets: ["hard_constraint"],
    confirmation_reason: "direct_statement"
  });
  const ledger = await readFile(await store.ledgerPath(projectIdForRoot(workspace.project)), "utf8");
  assert.equal(ledger.includes(escapedSecret), false);
  assert.equal(ledger.includes(spacedSecret), false);
  assert.equal(ledger.includes("REDACTED:credential:"), false);
});
