import assert from "node:assert/strict";
import { readdir, mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { apply } from "../index.js";
import {
  IntentFormationSessionPool,
  SessionPolicyController,
  TOOL_CATALOG,
  resolveAdapterConfig,
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

test("DeepSeek bundle registers the exact host-bound MCP catalog and shared intent policy", async () => {
  const harness = createHarnessContext();
  apply(harness.ctx, { dataDir: path.join(os.tmpdir(), "intent-loop-unused-test-data") });
  try {
    assert.equal(harness.tools.size, 15);
    assert.deepEqual([...harness.tools.keys()].sort(), TOOL_CATALOG.tools.map((tool) => tool.name).sort());
    for (const definition of harness.tools.values()) {
      assert.equal("task_id" in definition.parameters.properties, false);
      assert.equal("cwd" in definition.parameters.properties, false);
      assert.equal(definition.parameters.additionalProperties, false);
    }
    const provider = harness.sections.get("tool:intent-formation")?.text;
    assert.equal(typeof provider, "function");
    const guidance = provider(execution("unseen-session", os.tmpdir()));
    assert.match(guidance, /Intent gate has priority/u);
    assert.match(guidance, /act; no second intent question/u);
    assert.match(guidance, /store only deliberate atomic records/u);
    assert.match(guidance, /Neither performs the domain task/u);
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
  assert.equal(env.INTENT_FORMATION_DATA_DIR, "C:\\temporary\\intent-loop");
  assert.equal("DEEPSEEK_API_KEY" in env, false);
  assert.equal("OPENAI_API_KEY" in env, false);
  assert.equal("RANDOM_SECRET" in env, false);
});

test("session pool evicts only an idle client and closes everything on unload", async () => {
  const closed = [];
  const pool = new IntentFormationSessionPool({
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
  const pool = new IntentFormationSessionPool({
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

test("session pool drains a failed shared client without closing an active sibling", async () => {
  let closeCount = 0;
  let siblingStarted;
  let releaseSibling;
  const siblingIsActive = new Promise((resolve) => {
    siblingStarted = resolve;
  });
  const siblingCanFinish = new Promise((resolve) => {
    releaseSibling = resolve;
  });
  const client = {
    closed: false,
    close: async () => {
      closeCount += 1;
      client.closed = true;
    }
  };
  const pool = new IntentFormationSessionPool({
    maxSessions: 1,
    idleTimeoutMs: 60_000,
    connectTimeoutMs: 1_000,
    toolCallTimeoutMs: 1_000,
    dataDir: path.join(os.tmpdir(), "intent-loop-pool-drain-test")
  }, async () => client);

  const sibling = pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async (shared) => {
    siblingStarted();
    await siblingCanFinish;
    if (shared.closed) throw new Error("sibling-client-was-closed");
    return "sibling-finished";
  });
  await siblingIsActive;

  const failing = pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async () => {
    throw new Error("first-call-transport-failure");
  });
  await assert.rejects(failing, /first-call-transport-failure/u);
  assert.equal(closeCount, 0);
  await assert.rejects(
    pool.run("one", os.tmpdir(), AbortSignal.timeout(1_000), async () => "too-early"),
    /session is draining/u
  );

  releaseSibling();
  assert.equal(await sibling, "sibling-finished");
  assert.equal(closeCount, 1);
  assert.equal(pool.holders.size, 0);
  await pool.dispose();
  assert.equal(closeCount, 1);
});

test("real adapter binds session state, keeps private text off disk, and forgets cleanly", { timeout: 120_000 }, async () => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "intent-formation-dsh-adapter-"));
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
    const started = await call(harness, "intent_start", {
      mode: "standard",
      task_id: "model-forged-task",
      cwd: projectB
    }, execA);
    durableTaskId = String(started.data?.task_id ?? "");
    assert.match(durableTaskId, /^dsh:[a-f0-9]{64}$/u);
    assert.notEqual(durableTaskId, "model-forged-task");

    const added = await call(harness, "intent_add_explicit", {
      task_id: "model-forged-task",
      statement: "Keep the DeepSeek adapter inside the current task.",
      role: "hard_constraint",
      scope: "task",
      source_ref: { ref: "current-user-turn" },
      user_confirmed: true
    }, execA);
    assert.match(added.receipt_id, /^IF-[A-F0-9]{8}$/u);

    const snapshot = await call(harness, "intent_show", {}, execA);
    assert.equal(snapshot.data.task_id, durableTaskId);
    assert.match(JSON.stringify(snapshot.data), /inside the current task/u);

    const guidanceProvider = harness.sections.get("tool:intent-formation")?.text;
    assert.match(guidanceProvider(execA), /Intent gate has priority/u);
    assert.match(guidanceProvider(execA), /act; no second intent question/u);
    const turnedOff = await call(harness, "intent_set_mode", { mode: "off" }, execA);
    assert.equal(turnedOff.data.mode, "off");
    assert.equal(guidanceProvider(execA), "");
    const coldController = new SessionPolicyController(resolveAdapterConfig({ dataDir }));
    assert.equal(coldController.textFor(execA, "policy"), "");
    const restored = await call(harness, "intent_set_mode", { mode: "standard" }, execA);
    assert.equal(restored.data.mode, "standard");
    assert.match(guidanceProvider(execA), /Intent gate has priority/u);
    assert.match(guidanceProvider(execA), /act; no second intent question/u);

    const otherSession = await call(harness, "intent_show", {
      task_id: durableTaskId
    }, execB);
    assert.equal(otherSession.data.exists, false);

    const privateStart = await call(harness, "intent_start", {
      mode: "private",
      task_id: "model-forged-private"
    }, execPrivate);
    privateTaskId = String(privateStart.data?.task_id ?? "");
    assert.match(privateTaskId, /^dsh:[a-f0-9]{64}$/u);

    await call(harness, "intent_add_explicit", {
      statement: "Keep this private state in one Harness session.",
      role: "hard_constraint",
      scope: "task",
      user_confirmed: true
    }, execPrivate);
    const privateSnapshot = await call(harness, "intent_show", {}, execPrivate);
    assert.match(JSON.stringify(privateSnapshot.data), /private state/u);
    const intruderSnapshot = await call(harness, "intent_show", {}, execIntruder);
    assert.equal(intruderSnapshot.data.exists, false);
    assert.equal(await containsText(dataDir, "Keep this private state in one Harness session."), false);

    const privateForgotten = await call(harness, "intent_forget", {}, execPrivate);
    const durableForgotten = await call(harness, "intent_forget", {}, execA);
    assert.equal(privateForgotten.data.exists_after, false);
    assert.equal(durableForgotten.data.exists_after, false);
    assert.equal(await containsText(dataDir, privateTaskId), false);
    assert.equal(await containsText(dataDir, durableTaskId), false);
  } finally {
    await harness.dispose();
    const resolvedScratch = path.resolve(scratch);
    assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
    await rm(resolvedScratch, { recursive: true, force: true });
  }
});
