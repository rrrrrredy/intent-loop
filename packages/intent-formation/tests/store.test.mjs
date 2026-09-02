import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { createEvent, EventStore } from "../src/store.mjs";

const temporaryRoot = path.join(process.cwd(), ".tmp", "state-tests");
const workerPath = fileURLToPath(new URL("fixtures/store-worker.mjs", import.meta.url));

async function temporaryDirectory(prefix) {
  await mkdir(temporaryRoot, { recursive: true });
  return mkdtemp(path.join(temporaryRoot, prefix + "-"));
}

function event(index, taskId = "task-concurrent") {
  return createEvent({
    event_id: "evt_" + index,
    event_type: "task_mode_changed",
    occurred_at: new Date(Date.UTC(2026, 8, 1, 0, 0, index)).toISOString(),
    task_id: taskId,
    payload: { mode: index % 2 === 0 ? "standard" : "off" }
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForPath(target, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      await access(target);
      return;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (Date.now() >= deadline) throw new Error("timed out waiting for " + target);
    await wait(10);
  }
}

function runWorker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [workerPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) resolve({ code, signal, stderr });
      else reject(new Error(`store worker failed (${code ?? signal}): ${stderr}`));
    });
  });
}

test("concurrent append operations retain every complete event", async (context) => {
  const directory = await temporaryDirectory("concurrency");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({ dataDirectory: directory });

  await Promise.all(Array.from({ length: 100 }, (_, index) => store.append(event(index))));
  const loaded = await store.readAll();

  assert.equal(loaded.events.length, 100);
  assert.equal(new Set(loaded.events.map((item) => item.event_id)).size, 100);
  const persisted = await readFile(store.filePath, "utf8");
  assert.equal(persisted.trim().split(/\r?\n/).length, 100);
});

test("one hundred independent processes retain every event and leave no lock artifacts", { timeout: 180_000 }, async (context) => {
  const directory = await temporaryDirectory("process-concurrency");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );

  await Promise.all(
    Array.from({ length: 100 }, (_, index) =>
      runWorker(["append", directory, String(index)])
    )
  );
  const store = new EventStore({ dataDirectory: directory });
  const loaded = await store.readAll();
  assert.equal(loaded.events.length, 100);
  assert.equal(new Set(loaded.events.map((item) => item.event_id)).size, 100);
  const leftovers = (await readdir(directory)).filter((name) =>
    name.startsWith(path.basename(store.lockPath))
  );
  assert.deepEqual(leftovers, []);
});

test("a stale observation cannot reclaim a replacement generation", { timeout: 30_000 }, async (context) => {
  const directory = await temporaryDirectory("generation-aba");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  let releaseReclaimer;
  let reachedReclaim;
  const reclaimerReached = new Promise((resolve) => (reachedReclaim = resolve));
  const reclaimerCanContinue = new Promise((resolve) => (releaseReclaimer = resolve));
  let firstEntered = false;
  const first = new EventStore({
    dataDirectory: directory,
    lockTimeoutMs: 15_000,
    staleLockMs: 0,
    lockTestHooks: {
      async afterReclaimClaim() {
        reachedReclaim();
        await reclaimerCanContinue;
      }
    }
  });
  await mkdir(first.lockPath, { recursive: true });
  await writeFile(
    path.join(first.lockPath, "owner.json"),
    JSON.stringify({ pid: 2147483647, token: "dead-generation", acquired_at: new Date().toISOString() }),
    "utf8"
  );

  const firstRun = first.withLock(async () => {
    firstEntered = true;
  });
  await reclaimerReached;

  const displaced = first.lockPath + ".simulated-old";
  await rename(first.lockPath, displaced);
  const holderEntered = path.join(directory, "holder-entered");
  const holderRelease = path.join(directory, "holder-release");
  const holder = runWorker(["hold", directory, holderEntered, holderRelease]);
  await waitForPath(holderEntered);

  releaseReclaimer();
  await wait(150);
  assert.equal(firstEntered, false, "the stale observer entered while the replacement owner was live");

  await writeFile(holderRelease, "release", "utf8");
  await holder;
  await firstRun;
  assert.equal(firstEntered, true);
  await rm(displaced, { recursive: true, force: true });
  const leftovers = (await readdir(directory)).filter((name) =>
    name.startsWith(path.basename(first.lockPath))
  );
  assert.deepEqual(leftovers, []);
});

test("a live lock owner is not displaced solely because the lock mtime is old", async (context) => {
  const directory = await temporaryDirectory("live-owner");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({
    dataDirectory: directory,
    staleLockMs: 10,
    lockTimeoutMs: 1000
  });
  let entered;
  const firstEntered = new Promise((resolve) => (entered = resolve));
  let active = 0;
  let maximumActive = 0;
  const criticalSection = async (holdMs) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (holdMs) entered();
    await wait(holdMs);
    active -= 1;
  };

  const first = store.withLock(() => criticalSection(100));
  await firstEntered;
  await wait(35);
  const second = store.withLock(() => criticalSection(0));
  await Promise.all([first, second]);

  assert.equal(maximumActive, 1);
});

test("an inactive owner token from the current process is reclaimed", async (context) => {
  const directory = await temporaryDirectory("same-process-orphan");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({ dataDirectory: directory, lockTimeoutMs: 500 });
  await mkdir(store.lockPath, { recursive: true });
  await writeFile(
    path.join(store.lockPath, "owner.json"),
    JSON.stringify({ pid: process.pid, token: "inactive-token", acquired_at: new Date().toISOString() }),
    "utf8"
  );

  const result = await store.withLock(async () => "reclaimed");
  assert.equal(result, "reclaimed");
});

test("a dead reclaimer cannot strand a stale lock", async (context) => {
  const directory = await temporaryDirectory("dead-reclaimer");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({ dataDirectory: directory, lockTimeoutMs: 1000, staleLockMs: 0 });
  await mkdir(store.lockPath, { recursive: true });
  await writeFile(
    path.join(store.lockPath, "owner.json"),
    JSON.stringify({ pid: 2147483647, token: "dead-owner", acquired_at: new Date().toISOString() }),
    "utf8"
  );
  await writeFile(
    path.join(store.lockPath, "reclaim.json"),
    JSON.stringify({ pid: 2147483646, token: "dead-reclaimer", acquired_at: new Date().toISOString() }),
    "utf8"
  );

  assert.equal(await store.withLock(async () => "recovered"), "recovered");
  const leftovers = (await readdir(directory)).filter((name) =>
    name.startsWith(path.basename(store.lockPath))
  );
  assert.deepEqual(leftovers, []);
});

test("legacy events migrate and malformed lines are quarantined", async (context) => {
  const directory = await temporaryDirectory("recovery");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({
    dataDirectory: directory,
    clock: () => "2026-09-01T01:02:03.000Z"
  });
  await mkdir(directory, { recursive: true });

  const legacy = {
    schema_version: 0,
    id: "evt_legacy",
    type: "task_started",
    at: "2026-09-01T00:00:00.000Z",
    task_id: "task-legacy",
    payload: { mode: "standard" }
  };
  await writeFile(store.filePath, JSON.stringify(legacy) + "\n{broken-json}\n", "utf8");

  const loaded = await store.readAll();
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.events[0].schema_version, 1);
  assert.equal(loaded.recovery.action, "quarantined_corruption");
  assert.deepEqual(loaded.recovery.invalid_lines, [2]);

  const names = await readdir(directory);
  assert.equal(names.some((name) => name.includes(".corrupt.")), true);
  const repaired = await readFile(store.filePath, "utf8");
  assert.doesNotMatch(repaired, /broken-json/);
  assert.match(repaired, /"schema_version":1/);
});

test("an interrupted replacement restores its backup", async (context) => {
  const directory = await temporaryDirectory("backup");
  context.after(() =>
    rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  );
  const store = new EventStore({ dataDirectory: directory });
  await store.append(event(1, "task-backup"));
  await rename(store.filePath, store.backupPath);

  const loaded = await store.readAll();
  assert.equal(loaded.events.length, 1);
  assert.equal(loaded.recovery.action, "restored_backup");
});
