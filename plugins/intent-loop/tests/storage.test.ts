import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { newId, projectIdForRoot } from "../src/canonical.js";
import { IntentLoopError } from "../src/errors.js";
import { dataRootFromEnvironment, LedgerStore } from "../src/storage.js";
import { testWorkspace } from "./helpers.js";

function event(taskId: string, index: number) {
  return {
    event_type: "task_started" as const,
    task_id: taskId,
    actor: "user" as const,
    request_id: `storage-${index}`,
    payload: { mode: "on", label: null, host_session_hash: null }
  };
}

test("appends and verifies a hash-chained ledger", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, 1));
  await store.appendEvent(projectId, { ...event(taskId, 2), event_type: "mode_set", payload: { mode: "off" } });
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 2);
  assert.equal(events[1]?.prev_hash, events[0]?.event_hash);
});

test("does not report a committed mutation as failed when lock cleanup reports an error", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  const internals = store as unknown as {
    releaseOwnedLock: (projectDirectory: string, lockDirectory: string, token: string) => Promise<void>;
  };
  const releaseOwnedLock = internals.releaseOwnedLock.bind(store);
  internals.releaseOwnedLock = async (projectDirectory, lockDirectory, token) => {
    await releaseOwnedLock(projectDirectory, lockDirectory, token);
    throw new IntentLoopError("LOCK_RELEASE_TIMEOUT", "simulated post-commit cleanup failure", true);
  };

  const appended = await store.appendEvent(projectId, event(taskId, 1));
  assert.equal(appended.request_id, "storage-1");
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.request_id, "storage-1");
});

test("read stays non-mutating and the next locked mutation atomically repairs a trailing partial", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, 1));
  const ledger = await store.ledgerPath(projectId);
  await appendFile(ledger, "{\"partial\":", "utf8");
  await assert.rejects(store.readEvents(projectId), (error: unknown) =>
    error instanceof IntentLoopError && error.code === "CORRUPT_TRAILING_EVENT");
  await store.appendEvent(projectId, event(taskId, 2));
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 2);
  const body = await readFile(ledger, "utf8");
  assert.equal(body.includes("partial"), false);
  const projectDirectory = await store.projectDirectory(projectId);
  const quarantineDirectory = path.join(projectDirectory, "quarantine");
  const names = await readdir(quarantineDirectory);
  assert.equal(names.length, 1);
  const quarantine = await readFile(path.join(quarantineDirectory, names[0] as string), "utf8");
  assert.equal(quarantine.includes("{\"partial\":"), false);
  const summary = JSON.parse(quarantine) as Record<string, unknown>;
  assert.equal(summary.byte_length, Buffer.byteLength("{\"partial\":", "utf8"));
  assert.match(String(summary.sha256), /^[a-f0-9]{64}$/u);
});

test("rejects a corrupt middle event instead of silently skipping it", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, 1));
  await store.appendEvent(projectId, { ...event(taskId, 2), event_type: "mode_set", payload: { mode: "off" } });
  const ledger = await store.ledgerPath(projectId);
  const lines = (await readFile(ledger, "utf8")).trimEnd().split("\n");
  const first = JSON.parse(lines[0] as string) as Record<string, unknown>;
  first.actor = "agent";
  lines[0] = JSON.stringify(first);
  await writeFile(ledger, `${lines.join("\n")}\n`, "utf8");
  await assert.rejects(store.readEvents(projectId), (error: unknown) => {
    assert.ok(error instanceof IntentLoopError);
    assert.equal(error.code, "CORRUPT_LEDGER");
    return true;
  });
});

test("serializes concurrent writers without lost events", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await Promise.all(Array.from({ length: 24 }, (_, index) => store.appendEvent(projectId, event(taskId, index))));
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 24);
  assert.equal(new Set(events.map((item) => item.request_id)).size, 24);
});

test("never steals a stale-looking lock owned by a live process", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data, { lock_stale_ms: 10, lock_wait_ms: 120, lock_heartbeat_ms: 5 });
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, 1));
  const projectDirectory = await store.projectDirectory(projectId);
  const lockDirectory = path.join(projectDirectory, "ledger.lock");
  await mkdir(lockDirectory);
  await writeFile(path.join(lockDirectory, "owner.json"), `${JSON.stringify({
    pid: process.pid,
    token: newId(),
    acquired_at: new Date(0).toISOString()
  })}\n`, "utf8");
  const old = new Date(Date.now() - 60_000);
  await utimes(lockDirectory, old, old);
  await assert.rejects(
    store.appendEvent(projectId, event(taskId, 2)),
    (error: unknown) => error instanceof IntentLoopError && error.code === "LOCK_TIMEOUT"
  );
  await rm(lockDirectory, { recursive: true, force: true });
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 1);
});

test("all real processes recover one dead stale lock without surfacing filesystem races", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, -1));
  const projectDirectory = await store.projectDirectory(projectId);
  const lockDirectory = path.join(projectDirectory, "ledger.lock");
  const ownerPath = path.join(lockDirectory, "owner.json");
  const exitingOwner = spawn(process.execPath, ["--eval", "process.stdin.resume()"], {
    stdio: ["pipe", "ignore", "ignore"]
  });
  const staleOwnerPid = exitingOwner.pid;
  assert.ok(staleOwnerPid !== undefined);
  const ownerExit = new Promise<void>((resolve, reject) => {
    exitingOwner.once("error", reject);
    exitingOwner.once("close", () => resolve());
  });
  await mkdir(lockDirectory);
  await writeFile(ownerPath, `${JSON.stringify({
    pid: staleOwnerPid,
    token: newId(),
    acquired_at: new Date(0).toISOString()
  })}\n`, "utf8");
  const old = new Date(Date.now() - 120_000);
  await utimes(ownerPath, old, old);
  await utimes(lockDirectory, old, old);

  const storageModule = pathToFileURL(path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/storage.js"
  )).href;
  const childSource = `
    import { LedgerStore } from ${JSON.stringify(storageModule)};
    const [dataRoot, projectId, taskId, index] = process.argv.slice(1);
    const store = new LedgerStore(dataRoot);
    await store.appendEvent(projectId, {
      event_type: "mode_set",
      task_id: taskId,
      actor: "user",
      request_id: "multiprocess-" + index,
      payload: { mode: "on", index: Number(index) }
    });
  `;
  const resultsPromise = Promise.all(Array.from({ length: 32 }, (_, index) => new Promise<{
    code: number | null;
    stderr: string;
  }>((resolve, reject) => {
    const child = spawn(process.execPath, [
      "--input-type=module",
      "--eval",
      childSource,
      workspace.data,
      projectId,
      taskId,
      String(index)
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stderr }));
  })));
  exitingOwner.stdin.end();
  await ownerExit;
  const results = await resultsPromise;
  const projectEntries = await readdir(projectDirectory);
  const residualLockEntries = projectEntries.filter((entry) => entry.startsWith("ledger.lock"));
  const lockEntries = await readdir(lockDirectory).catch(() => []);
  const remainingOwner = await readFile(ownerPath, "utf8").catch(() => "");
  const remainingReclaimer = await readFile(path.join(lockDirectory, "reclaim.json"), "utf8").catch(() => "");
  const failures = results.filter((result) => result.code !== 0);
  assert.equal(
    failures.length,
    0,
    JSON.stringify({ residualLockEntries, lockEntries, remainingOwner, remainingReclaimer }) + "\n" +
      (failures[0]?.stderr ?? "")
  );
  assert.deepEqual(residualLockEntries, []);
  const events = await store.readEvents(projectId);
  assert.equal(events.length, 33);
  assert.equal(new Set(events.map((item) => item.request_id)).size, 33);
});

test("the next locked mutation removes strictly named orphan release and stale lock directories", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  const projectId = projectIdForRoot(workspace.project);
  const taskId = newId();
  await store.appendEvent(projectId, event(taskId, 1));
  const projectDirectory = await store.projectDirectory(projectId);
  const releaseName = `ledger.lock.release-${newId()}-${newId()}`;
  const staleName = `ledger.lock.stale-${newId()}`;
  await mkdir(path.join(projectDirectory, releaseName));
  await mkdir(path.join(projectDirectory, staleName));

  await store.appendEvent(projectId, event(taskId, 2));

  const entries = await readdir(projectDirectory);
  assert.equal(entries.includes(releaseName), false);
  assert.equal(entries.includes(staleName), false);
  assert.equal((await store.readEvents(projectId)).length, 2);
});

test("rejects user-controlled storage path identifiers", async (t) => {
  const workspace = await testWorkspace(t);
  const store = new LedgerStore(workspace.data);
  await assert.rejects(store.projectDirectory("..\\escape"), /project_id must be/u);
});

test("uses the shared Codex-home runtime root when MCP lacks Hook-only PLUGIN_DATA", () => {
  const codexHome = path.resolve("test-codex-home");
  const resolved = dataRootFromEnvironment({
    CODEX_HOME: codexHome,
    PLUGIN_DATA: path.resolve("different-hook-root")
  });
  assert.equal(resolved, path.join(codexHome, "plugin-data", "intent-loop", "v1"));
});

test("infers the same Codex-home data root from an installed cache entry when child env is sanitized", () => {
  const codexHome = path.resolve("test-codex-home");
  const entry = path.resolve(
    codexHome,
    "plugins",
    "cache",
    "intent-loop",
    "intent-loop",
    "0.1.0-beta.1",
    "runtime",
    "server.mjs"
  );
  assert.equal(
    dataRootFromEnvironment({}, entry),
    path.join(codexHome, "plugin-data", "intent-loop", "v1")
  );
});
