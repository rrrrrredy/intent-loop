import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { POLICY } from "../src/policy.mjs";
import { IntentService } from "../src/service.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = path.join(repositoryRoot, "hooks", "intent-check.mjs");
const commandHookPath = path.join(repositoryRoot, "hooks", "intent-command.mjs");
const temporaryRoot = path.join(repositoryRoot, ".tmp", "hook-tests");

async function hookFixture(context) {
  await mkdir(temporaryRoot, { recursive: true });
  const dataDirectory = await mkdtemp(path.join(temporaryRoot, "case-"));
  context.after(() =>
    rm(dataDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  return dataDirectory;
}

function runHook(input, dataDirectory, executable = hookPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [executable], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        INTENT_FORMATION_DATA_DIR: dataDirectory
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test("ordinary UserPromptSubmit adds no command context or state work", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      prompt: "Translate this sentence into English"
    }),
    dataDirectory,
    commandHookPath
  );
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "");
  assert.deepEqual(await readdir(dataDirectory), []);
});

test("off mode overrides implicit intent intervention on every ordinary prompt", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  await service.startTask({ task_id: "session-off", mode: "off" });
  const privatePrompt = "Choose a costly architecture direction for me without asking";
  const result = await runHook(
    JSON.stringify({
      session_id: "session-off",
      hook_event_name: "UserPromptSubmit",
      prompt: privatePrompt
    }),
    dataDirectory,
    commandHookPath
  );
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  const additionalContext = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(additionalContext, /overrides any general Intent Formation policy/i);
  assert.match(additionalContext, /"source":"intent_formation_mode"/);
  assert.match(additionalContext, /"mode":"off"/);
  assert.doesNotMatch(additionalContext, /receipt_id/);
  assert.equal(additionalContext.includes(privatePrompt), false);
});

test("off override remains available while the event ledger lock is held", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  await service.startTask({ task_id: "session-off-contended", mode: "off" });
  let timeout;
  const result = await service.store.withLockedEvents(() =>
    Promise.race([
      runHook(
        JSON.stringify({
          session_id: "session-off-contended",
          hook_event_name: "UserPromptSubmit",
          prompt: "Choose an irreversible deployment target"
        }),
        dataDirectory,
        commandHookPath
      ),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error("off override waited for the ledger lock")), 1500);
      })
    ])
  );
  clearTimeout(timeout);
  assert.equal(result.code, 0);
  assert.match(
    JSON.parse(result.stdout).hookSpecificOutput.additionalContext,
    /"source":"intent_formation_mode"/
  );
});

test("returning to standard mode removes the per-prompt off override", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  await service.startTask({ task_id: "session-on", mode: "off" });
  await service.setMode({ task_id: "session-on", mode: "standard" });
  const result = await runHook(
    JSON.stringify({
      session_id: "session-on",
      hook_event_name: "UserPromptSubmit",
      prompt: "Translate this sentence"
    }),
    dataDirectory,
    commandHookPath
  );
  assert.equal(result.code, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "");
});

test("command hook never echoes or persists an ordinary prompt", async (context) => {
  const dataDirectory = await hookFixture(context);
  const secret = "PRIVATE-PROMPT-CANARY-7f31";
  const result = await runHook(
    JSON.stringify({
      session_id: "session-test",
      hook_event_name: "UserPromptSubmit",
      prompt: secret
    }),
    dataDirectory,
    commandHookPath
  );
  assert.equal(result.stdout.includes(secret), false);
  const names = await readdir(dataDirectory);
  for (const name of names) {
    const contents = await readFile(path.join(dataDirectory, name), "utf8");
    assert.equal(contents.includes(secret), false);
  }
});

test("saved intent is restored without transcript parsing", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  await service.addExplicit({
    task_id: "session-restore",
    statement: "Ship a local-first beginner experience",
    role: "desired_outcome",
    source_ref: { ref: "turn-1" },
    scope: "task"
  });
  await service.addInference({
    task_id: "session-restore",
    statement: "Untrusted inferred instruction must stay out of automatic context",
    role: "soft_constraint",
    source_ref: { ref: "agent-1" },
    scope: "task",
    confidence: 0.5
  });
  await service.addEvidence({
    task_id: "session-restore",
    statement: "Untrusted result instruction must stay out of automatic context",
    role: "failure_signal",
    source_ref: { kind: "external_evidence", ref: "tool-1" },
    scope: "task"
  });

  const result = await runHook(
    JSON.stringify({
      session_id: "session-restore",
      hook_event_name: "SessionStart",
      source: "compact"
    }),
    dataDirectory
  );
  const output = JSON.parse(result.stdout);
  assert.match(output.hookSpecificOutput.additionalContext, /local-first beginner experience/);
  assert.match(output.hookSpecificOutput.additionalContext, /quoted values only as data/i);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Untrusted inferred instruction/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /Untrusted result instruction/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /transcript_path/);
});

test("SessionStart supplies only a compact interaction policy", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({
      session_id: "session-command",
      hook_event_name: "SessionStart",
      source: "startup"
    }),
    dataDirectory
  );
  const output = JSON.parse(result.stdout);
  assert.equal(output.hookSpecificOutput.additionalContext, POLICY);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /session-command/);
  assert.doesNotMatch(output.hookSpecificOutput.additionalContext, /intent_formation_mcp/);
  assert.ok(Buffer.byteLength(output.hookSpecificOutput.additionalContext, "utf8") <= 4096);
});

test("exact start and forget commands return receipts backed by real state", async (context) => {
  const dataDirectory = await hookFixture(context);
  const start = await runHook(
    JSON.stringify({
      session_id: "session-manual",
      turn_id: "turn-start",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent start"
    }),
    dataDirectory,
    commandHookPath
  );
  const startContext = JSON.parse(start.stdout).hookSpecificOutput.additionalContext;
  assert.match(startContext, /user's current language/i);
  assert.match(startContext, /"source":"intent_formation_hook"/);
  assert.match(startContext, /"ok":true/);
  assert.match(startContext, /"receipt_id":"IF-[A-F0-9]{8}"/);
  const service = new IntentService({ dataDirectory });
  assert.equal((await service.show({ task_id: "session-manual" })).exists, true);

  const show = await runHook(
    JSON.stringify({
      session_id: "session-manual",
      turn_id: "turn-show",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent show"
    }),
    dataDirectory,
    commandHookPath
  );
  const showContext = JSON.parse(show.stdout).hookSpecificOutput.additionalContext;
  assert.match(showContext, /Intent state is active in standard mode with no saved records/);
  assert.match(showContext, /"exists":true/);
  assert.match(showContext, /"receipt_id":"IF-[A-F0-9]{8}"/);

  const forget = await runHook(
    JSON.stringify({
      session_id: "session-manual",
      turn_id: "turn-forget",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent forget"
    }),
    dataDirectory,
    commandHookPath
  );
  const forgetContext = JSON.parse(forget.stdout).hookSpecificOutput.additionalContext;
  assert.match(forgetContext, /"exists_after":false/);
  assert.match(forgetContext, /"receipt_id":"IF-[A-F0-9]{8}"/);
  assert.equal((await service.show({ task_id: "session-manual" })).exists, false);
});

test("show is byte-bounded and paginates active records without full-state spill", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  for (let index = 1; index <= 8; index += 1) {
    await service.addExplicit({
      task_id: "session-show-pages",
      statement: "记录" + index + "-" + "界".repeat(990),
      role: "desired_outcome",
      source_ref: { ref: "source-" + index + "-" + "r".repeat(240) },
      scope: "task"
    });
  }

  const first = await runHook(
    JSON.stringify({
      session_id: "session-show-pages",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent show"
    }),
    dataDirectory,
    commandHookPath
  );
  assert.ok(Buffer.byteLength(first.stdout, "utf8") <= 3000);
  const firstContext = JSON.parse(first.stdout).hookSpecificOutput.additionalContext;
  const firstPayload = JSON.parse(firstContext.split(" Verified local result: ").at(-1));
  assert.equal(firstPayload.ok, true);
  assert.equal(firstPayload.data.page, 1);
  assert.equal(firstPayload.data.total_active_records, 8);
  assert.equal(firstPayload.data.total_pages, 3);
  assert.equal(firstPayload.data.records.length, 3);
  assert.equal(firstPayload.data.has_more, true);
  assert.equal(firstContext.includes('"active_records":'), false);
  assert.match(firstPayload.data.records[0].statement, /^记录1-/u);
  assert.doesNotMatch(firstContext, /记录4-/u);

  const second = await runHook(
    JSON.stringify({
      session_id: "session-show-pages",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent show 2"
    }),
    dataDirectory,
    commandHookPath
  );
  assert.ok(Buffer.byteLength(second.stdout, "utf8") <= 3000);
  const secondContext = JSON.parse(second.stdout).hookSpecificOutput.additionalContext;
  const secondPayload = JSON.parse(secondContext.split(" Verified local result: ").at(-1));
  assert.equal(secondPayload.data.page, 2);
  assert.match(secondPayload.data.records[0].statement, /^记录4-/u);

  const invalid = await runHook(
    JSON.stringify({
      session_id: "session-show-pages",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent show 99"
    }),
    dataDirectory,
    commandHookPath
  );
  const invalidContext = JSON.parse(invalid.stdout).hookSpecificOutput.additionalContext;
  assert.match(invalidContext, /"ok":false/);
  assert.doesNotMatch(invalidContext, /receipt_id/u);
});

test("remember writes an explicit atomic record without relying on a model tool call", async (context) => {
  const dataDirectory = await hookFixture(context);
  const goal = "Publish only after every release gate passes";
  const remembered = await runHook(
    JSON.stringify({
      session_id: "session-remember",
      turn_id: "turn-remember-goal",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent remember " + goal
    }),
    dataDirectory,
    commandHookPath
  );
  const goalContext = JSON.parse(remembered.stdout).hookSpecificOutput.additionalContext;
  assert.match(goalContext, /"source":"intent_formation_hook"/);
  assert.match(goalContext, /"receipt_id":"IF-[A-F0-9]{8}"/);

  const constraint = "Keep every state file local";
  const constrained = await runHook(
    JSON.stringify({
      session_id: "session-remember",
      turn_id: "turn-remember-constraint",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent remember constraint: " + constraint
    }),
    dataDirectory,
    commandHookPath
  );
  assert.match(
    JSON.parse(constrained.stdout).hookSpecificOutput.additionalContext,
    /"receipt_id":"IF-[A-F0-9]{8}"/
  );

  const snapshot = await new IntentService({ dataDirectory }).show({
    task_id: "session-remember"
  });
  assert.deepEqual(
    snapshot.active_records.map(({ statement, role, epistemic_status, source_ref }) => ({
      statement,
      role,
      epistemic_status,
      source_kind: source_ref.kind
    })),
    [
      {
        statement: goal,
        role: "desired_outcome",
        epistemic_status: "explicit",
        source_kind: "user_turn"
      },
      {
        statement: constraint,
        role: "hard_constraint",
        epistemic_status: "explicit",
        source_kind: "user_turn"
      }
    ]
  );
});

test("an empty remember command makes no change and returns no receipt", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({
      session_id: "session-empty-remember",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent remember"
    }),
    dataDirectory,
    commandHookPath
  );
  const additionalContext = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(additionalContext, /user's current language/i);
  assert.match(additionalContext, /"changed":false/);
  assert.doesNotMatch(additionalContext, /receipt_id/);
  assert.deepEqual(await readdir(dataDirectory), []);
});

test("a remember role prefix without a statement makes no change", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({
      session_id: "session-empty-remember-role",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent remember constraint:"
    }),
    dataDirectory,
    commandHookPath
  );
  const additionalContext = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(additionalContext, /"changed":false/);
  assert.doesNotMatch(additionalContext, /receipt_id/);
  assert.deepEqual(await readdir(dataDirectory), []);
});

test("remember refuses a false private-mode receipt from a short-lived Hook", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  await service.startTask({ task_id: "session-private-remember", mode: "private" });
  const privateStatement = "PRIVATE-REMEMBER-CANARY-91d2";
  const result = await runHook(
    JSON.stringify({
      session_id: "session-private-remember",
      turn_id: "turn-private-remember",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent remember " + privateStatement
    }),
    dataDirectory,
    commandHookPath
  );
  const additionalContext = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(additionalContext, /short-lived Hook cannot retain process-memory state/i);
  assert.match(additionalContext, /"changed":false/);
  assert.doesNotMatch(additionalContext, /receipt_id/);
  const persisted = await readFile(path.join(dataDirectory, "intent-events-v1.jsonl"), "utf8");
  assert.equal(persisted.includes(privateStatement), false);
});

test("private feedback, correction, and show cannot claim access to another process's memory", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  const taskId = "session-private-live-memory";
  await service.startTask({ task_id: taskId, mode: "private" });
  const record = await service.addExplicit({
    task_id: taskId, statement: "PRIVATE-LIVE-MEMORY-CANARY", role: "desired_outcome", scope: "task"
  });
  for (const prompt of [
    "/intent show",
    "/intent correct " + record.record.record_id + " => PRIVATE-CORRECTION-CANARY",
    "/intent feedback keep: PRIVATE-FEEDBACK-CANARY"
  ]) {
    const result = await runHook(JSON.stringify({
      session_id: taskId, hook_event_name: "UserPromptSubmit", prompt
    }), dataDirectory, commandHookPath);
    const contextText = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
    assert.match(contextText, /"ok":false/);
    assert.match(contextText, /"changed":false/);
    assert.doesNotMatch(contextText, /receipt_id|no saved records/i);
  }
  assert.deepEqual((await service.show({ task_id: taskId })).records.map((r) => r.statement), [
    "PRIVATE-LIVE-MEMORY-CANARY"
  ]);
  assert.doesNotMatch(await readFile(path.join(dataDirectory, "intent-events-v1.jsonl"), "utf8"), /PRIVATE-.*-CANARY/);
});

test("no-argument controls preserve added authorization conditions and task qualifiers", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  const taskId = "session-conditional-control";
  await service.addExplicit({ task_id: taskId, statement: "Preserve this direction", role: "desired_outcome", scope: "task" });
  const before = await readFile(path.join(dataDirectory, "intent-events-v1.jsonl"), "utf8");
  for (const prompt of [
    "/intent forget after I approve; do not delete yet.",
    "/intent forget task-other",
    "/intent private after I approve",
    "/intent off after I approve",
    "/intent export after I approve"
  ]) {
    const result = await runHook(JSON.stringify({
      session_id: taskId, hook_event_name: "UserPromptSubmit", prompt
    }), dataDirectory, commandHookPath);
    const contextText = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
    assert.match(contextText, /"ok":false/);
    assert.match(contextText, /"changed":false/);
    assert.doesNotMatch(contextText, /receipt_id/);
    assert.equal(await readFile(path.join(dataDirectory, "intent-events-v1.jsonl"), "utf8"), before);
  }
  assert.equal((await service.show({ task_id: taskId })).mode, "standard");
  assert.equal(await service.fastTaskMode({ task_id: taskId }), null);
  await assert.rejects(readdir(path.join(dataDirectory, "exports")), /ENOENT/);
});

test("manual export writes a complete file without injecting records and forget purges it", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  const statement = "Release only after the evidence gate passes";
  await service.addExplicit({
    task_id: "session-export",
    statement,
    role: "desired_outcome",
    source_ref: { kind: "user_turn", ref: "turn-save" },
    scope: "task"
  });

  const exported = await runHook(
    JSON.stringify({
      session_id: "session-export",
      turn_id: "turn-export",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent export"
    }),
    dataDirectory,
    commandHookPath
  );
  const contextText = JSON.parse(exported.stdout).hookSpecificOutput.additionalContext;
  const result = JSON.parse(contextText.split(" Verified local result: ")[1]);
  assert.equal(result.ok, true);
  assert.equal(result.data.record_count, 1);
  assert.match(result.data.integrity.digest, /^[a-f0-9]{64}$/);
  assert.match(contextText, /complete SHA-256 content digest/);
  assert.match(contextText, /Do not omit the digest/);
  assert.ok(contextText.includes(result.data.export_id));
  assert.ok(contextText.includes(result.receipt_id));
  assert.equal(contextText.includes(statement), false);

  assert.equal(Object.hasOwn(result.data, "path"), false);
  const exportPath = path.join(dataDirectory, "exports", result.data.export_id);
  const payload = JSON.parse(await readFile(exportPath, "utf8"));
  assert.equal(payload.task.records[0].statement, statement);
  assert.equal(payload.integrity.digest, result.data.integrity.digest);

  const forgotten = await runHook(
    JSON.stringify({
      session_id: "session-export",
      turn_id: "turn-forget",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent forget"
    }),
    dataDirectory,
    commandHookPath
  );
  const forgottenContext = JSON.parse(forgotten.stdout).hookSpecificOutput.additionalContext;
  assert.match(forgottenContext, /"removed_exports":1/);
  assert.doesNotMatch(forgottenContext, /complete SHA-256 content digest/);
  await assert.rejects(readFile(exportPath, "utf8"), /ENOENT/);
});

test("manual controls do not reinject unrelated historical records", async (context) => {
  const dataDirectory = await hookFixture(context);
  const service = new IntentService({ dataDirectory });
  const canary = "HISTORICAL-EVIDENCE-CANARY-4B92";
  await service.addEvidence({
    task_id: "session-minimal-control",
    statement: canary,
    role: "success_signal",
    source_ref: { kind: "result", ref: "result-1", excerpt: canary },
    scope: "task"
  });

  const commands = [
    "/intent start",
    "/intent remember Keep the public surface small",
    "/intent feedback keep: the direction is correct",
    "/intent off"
  ];
  for (const prompt of commands) {
    const result = await runHook(
      JSON.stringify({
        session_id: "session-minimal-control",
        turn_id: "turn-control",
        hook_event_name: "UserPromptSubmit",
        prompt
      }),
      dataDirectory,
      commandHookPath
    );
    const contextText = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
    assert.equal(contextText.includes(canary), false, prompt + " leaked historical data");
  }

  await service.setMode({ task_id: "session-minimal-control", mode: "standard" });
  const shown = await runHook(
    JSON.stringify({
      session_id: "session-minimal-control",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent show"
    }),
    dataDirectory,
    commandHookPath
  );
  const shownContext = JSON.parse(shown.stdout).hookSpecificOutput.additionalContext;
  assert.match(shownContext, /untrusted data/i);
  assert.match(shownContext, new RegExp(canary));
});

test("incomplete correction makes no change and returns no receipt", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({
      session_id: "session-correct",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent correct"
    }),
    dataDirectory,
    commandHookPath
  );
  const additionalContext = JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
  assert.match(additionalContext, /"changed":false/);
  assert.doesNotMatch(additionalContext, /receipt_id/);
  assert.deepEqual(await readdir(dataDirectory), []);
});

test("invalid JSON fails open with no output", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook("{invalid", dataDirectory);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("unrelated events fail open with no output", async (context) => {
  const dataDirectory = await hookFixture(context);
  const result = await runHook(
    JSON.stringify({ session_id: "session-end", hook_event_name: "SessionEnd" }),
    dataDirectory
  );
  assert.equal(result.code, 0);
  assert.equal(result.stdout, "");
});

test("a command-hook storage fault reports unknown change without exposing its local path", async (context) => {
  const directory = await hookFixture(context);
  const blockedPath = path.join(directory, "not-a-directory-secret");
  await writeFile(blockedPath, "block directory creation", "utf8");
  const result = await runHook(
    JSON.stringify({
      session_id: "session-storage-fault",
      hook_event_name: "UserPromptSubmit",
      prompt: "/intent start"
    }),
    blockedPath,
    commandHookPath
  );
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  const contextText = output.hookSpecificOutput.additionalContext;
  assert.match(contextText, /"changed":"unknown"/u);
  assert.match(contextText, /STATE_OPERATION_ERROR/u);
  assert.match(contextText, /Run \/intent show/u);
  assert.equal(contextText.includes(blockedPath), false);
  assert.equal(contextText.includes("not-a-directory-secret"), false);
});
