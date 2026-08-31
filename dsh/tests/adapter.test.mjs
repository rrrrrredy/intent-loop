import assert from "node:assert/strict";
import { readdir, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { apply } from "../index.js";
import {
  IntentLoopSessionPool,
  TOOL_CATALOG,
  safeChildEnvironment
} from "../adapter.js";

function createHarnessContext() {
  const tools = new Map();
  const sections = new Map();
  const effects = [];
  const ctx = {
    tools: {
      register(definition) {
        if (tools.has(definition.name)) throw new Error(`duplicate tool ${definition.name}`);
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      }
    },
    systemPrompt: {
      getSectionOrder() {
        return 2400;
      },
      section(definition) {
        sections.set(definition.name, definition);
        return () => sections.delete(definition.name);
      }
    },
    effect(factory) {
      const disposer = factory();
      effects.push(disposer);
      return disposer;
    }
  };
  return {
    ctx,
    tools,
    sections,
    async dispose() {
      for (const disposer of effects.reverse()) await disposer?.();
      tools.clear();
      sections.clear();
    }
  };
}

function execution(sessionId, cwd) {
  return {
    agent: { session: { header: { id: sessionId, cwd } } },
    signal: AbortSignal.timeout(30_000)
  };
}

async function call(harness, name, args, exec) {
  const definition = harness.tools.get(name);
  assert.ok(definition, `${name} is registered`);
  return definition.execute(args, exec);
}

async function containsText(directory, text) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && await containsText(target, text)) return true;
    if (entry.isFile()) {
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(target));
      if (bytes.includes(Buffer.from(text))) return true;
    }
  }
  return false;
}

test("DeepSeek bundle registers the exact sanitized MCP catalog and compact guidance", async () => {
  const harness = createHarnessContext();
  apply(harness.ctx, { dataDir: path.join(os.tmpdir(), "intent-loop-unused-test-data") });
  try {
    assert.equal(harness.tools.size, 15);
    assert.deepEqual([...harness.tools.keys()].sort(), TOOL_CATALOG.tools.map((tool) => tool.name).sort());
    for (const definition of harness.tools.values()) {
      assert.equal("project_root" in definition.parameters.properties, false);
      assert.equal("host_session_id" in definition.parameters.properties, false);
      assert.equal(definition.parameters.additionalProperties, false);
    }
    const guidance = harness.sections.get("tool:intent-loop")?.text ?? "";
    assert.match(guidance, /stores structured task state locally/u);
    assert.match(guidance, /never performs the domain task/u);
    assert.match(guidance, /Stay silent/u);
  } finally {
    await harness.dispose();
  }
});

test("child environment keeps OS essentials and drops model credentials", () => {
  const env = safeChildEnvironment("C:\\temporary\\intent-loop", {
    PATH: "safe-path",
    SystemRoot: "C:\\Windows",
    DEEPSEEK_API_KEY: "must-not-pass",
    OPENAI_API_KEY: "must-not-pass",
    RANDOM_SECRET: "must-not-pass"
  });
  assert.equal(env.PATH, "safe-path");
  assert.equal(env.SystemRoot, "C:\\Windows");
  assert.equal(env.INTENT_LOOP_DATA_DIR, "C:\\temporary\\intent-loop");
  assert.equal("DEEPSEEK_API_KEY" in env, false);
  assert.equal("OPENAI_API_KEY" in env, false);
  assert.equal("RANDOM_SECRET" in env, false);
});

test("session pool evicts only an idle client and closes everything on unload", async () => {
  const closed = [];
  const pool = new IntentLoopSessionPool({
    maxSessions: 1,
    idleTimeoutMs: 60_000,
    connectTimeoutMs: 1_000,
    toolCallTimeoutMs: 1_000,
    dataDir: path.join(os.tmpdir(), "intent-loop-pool-test")
  }, async (_config, _signal) => {
    const id = closed.length + 1;
    return { close: async () => closed.push(id) };
  });
  await pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async () => "one");
  await pool.run("two", os.tmpdir(), AbortSignal.timeout(1_000), async () => "two");
  assert.equal(closed.length, 1);
  await pool.dispose();
  assert.equal(closed.length, 2);
});

test("session pool serializes concurrent creation and enforces its hard capacity", async () => {
  let created = 0;
  let releaseFirst;
  const firstCanFinish = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const pool = new IntentLoopSessionPool({
    maxSessions: 1,
    idleTimeoutMs: 60_000,
    connectTimeoutMs: 1_000,
    toolCallTimeoutMs: 1_000,
    dataDir: path.join(os.tmpdir(), "intent-loop-pool-concurrency-test")
  }, async () => {
    created += 1;
    return { close: async () => undefined };
  });

  const first = pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async () => {
    await firstCanFinish;
    return "one";
  });
  const sameSession = pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async () => "same");
  const overCapacity = pool.run("two", os.tmpdir(), AbortSignal.timeout(1_000), async () => "two");

  await assert.rejects(overCapacity, /1 active DeepSeek Harness sessions/u);
  releaseFirst();
  assert.deepEqual(await Promise.all([first, sameSession]), ["one", "same"]);
  assert.equal(created, 1);
  assert.equal(pool.holders.size, 1);
  await pool.dispose();
});

test("real adapter binds workspaces, isolates private sessions, and deletes cleanly", { timeout: 120_000 }, async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "intent-loop-dsh-adapter-"));
  const dataDir = path.join(scratch, "data");
  const projectA = path.join(scratch, "project-a");
  const projectB = path.join(scratch, "project-b");
  await Promise.all([mkdir(projectA), mkdir(projectB)]);
  const harness = createHarnessContext();
  apply(harness.ctx, {
    dataDir,
    maxSessions: 4,
    idleTimeoutMs: 60_000,
    connectTimeoutMs: 15_000,
    toolCallTimeoutMs: 30_000
  });
  const execA = execution("dsh-session-a", projectA);
  const execB = execution("dsh-session-b", projectB);
  const execPrivate = execution("dsh-session-private", projectA);
  const execIntruder = execution("dsh-session-intruder", projectA);
  let durableTaskId = "";
  let privateTaskId = "";
  try {
    const started = await call(harness, "intent_start_task", {
      mode: "on",
      project_root: projectB,
      host_session_id: "model-forged",
      initial_explicit: [{
        statement: "Keep the DeepSeek adapter inside the current task.",
        scope: "task",
        facets: ["hard_constraint"]
      }]
    }, execA);
    durableTaskId = String(started.result?.task_id ?? "");
    assert.match(durableTaskId, /^[0-9a-f-]{36}$/u);

    const snapshot = await call(harness, "intent_get_snapshot", {
      task_id: durableTaskId,
      project_root: projectB
    }, execA);
    assert.match(JSON.stringify(snapshot), /current task/u);

    await assert.rejects(
      call(harness, "intent_get_snapshot", { task_id: durableTaskId }, execB),
      /TASK_NOT_FOUND|PROJECT/u
    );

    const privateStart = await call(harness, "intent_start_task", {
      mode: "private",
      host_session_id: "model-forged",
      initial_explicit: ["Keep this private state in one Harness session."]
    }, execPrivate);
    privateTaskId = String(privateStart.result?.task_id ?? "");
    assert.match(privateTaskId, /^[0-9a-f-]{36}$/u);
    const privateSnapshot = await call(
      harness,
      "intent_get_snapshot",
      { task_id: privateTaskId },
      execPrivate
    );
    assert.match(JSON.stringify(privateSnapshot), /private state/u);
    await assert.rejects(
      call(harness, "intent_get_snapshot", { task_id: privateTaskId }, execIntruder),
      /PRIVATE|SESSION|TASK_NOT_FOUND/u
    );

    await call(harness, "intent_delete", {
      task_id: privateTaskId,
      target: "task",
      confirmation: `DELETE TASK ${privateTaskId}`
    }, execPrivate);
    await call(harness, "intent_delete", {
      task_id: durableTaskId,
      target: "task",
      confirmation: `DELETE TASK ${durableTaskId}`
    }, execA);
  } finally {
    await harness.dispose();
    if (durableTaskId) assert.equal(await containsText(dataDir, durableTaskId), false);
    if (privateTaskId) assert.equal(await containsText(dataDir, privateTaskId), false);
    const resolvedScratch = path.resolve(scratch);
    assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
    await rm(resolvedScratch, { recursive: true, force: true });
  }
});
