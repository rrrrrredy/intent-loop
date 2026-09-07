import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { EVENT_TYPES, SCHEMA_VERSION } from "./constants.mjs";

const eventTypes = new Set(EVENT_TYPES);
const activeLockTokens = new Set();
const transientLockCodes = new Set(["EACCES", "EBUSY", "ENOENT", "ENOTDIR", "EPERM"]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function restrictDirectory(target) {
  await chmod(target, 0o700);
}

async function restrictFile(target) {
  await chmod(target, 0o600);
}

function validIsoTimestamp(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function collectStrings(value, output) {
  if (typeof value === "string" && value.length > 0) {
    output.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
}

function collectErasureTokens(event, output) {
  const payload = event.payload ?? {};
  const record = payload.record ?? {};
  // Identity and user content can locate truncated copies; schema enum values cannot.
  collectStrings([
    event.event_id, event.task_id, record.record_id, record.statement,
    record.source_ref?.ref, record.source_ref?.excerpt, record.scope_ref,
    record.supersedes, record.invalidated_reason, payload.target_record_id,
    payload.reason, payload.label, payload.cwd_hash
  ], output);
}

function recoveryTaskId(rawLine) {
  for (const match of rawLine.matchAll(/"task_id"\s*:\s*("(?:[^"\\]|\\.)*")/gu)) {
    try {
      // Parse only a complete top-level prefix, never a string embedded in content.
      const prefix = JSON.parse(rawLine.slice(0, match.index) + '"task_id":' + match[1] + '}');
      if (typeof prefix.task_id === "string") return prefix.task_id;
    } catch { /* This occurrence does not establish top-level ownership. */ }
  }
  return null;
}

function rawLineContainsToken(rawLine, token) {
  const encoded = JSON.stringify(token);
  return rawLine.includes(encoded) || rawLine.endsWith(encoded.slice(0, -1));
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM" || error?.code === "EACCES";
  }
}

async function readLockOwner(lockPath) {
  return readLockMarker(path.join(lockPath, "owner.json"));
}

async function readLockMarker(markerPath) {
  try {
    const raw = await readFile(markerPath, "utf8");
    const owner = JSON.parse(raw);
    return owner &&
      typeof owner === "object" &&
      Number.isInteger(owner.pid) &&
      owner.pid > 0 &&
      typeof owner.token === "string" &&
      owner.token.length > 0
      ? owner
      : null;
  } catch (error) {
    if (error?.code === "ENOENT" || error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

function lockGeneration(info) {
  return {
    dev: info.dev,
    ino: info.ino,
    birthtimeNs: info.birthtimeNs
  };
}

function sameLockGeneration(left, right) {
  return Boolean(
    left && right &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

async function observeLockGeneration(lockPath) {
  let info;
  try {
    info = await lstat(lockPath, { bigint: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("intent state lock path must be a real directory");
  }
  return lockGeneration(info);
}

function lockOwnerIsActive(owner) {
  if (!owner) return false;
  return owner.pid === process.pid
    ? activeLockTokens.has(owner.token)
    : processIsAlive(owner.pid);
}

function sameLockOwner(left, right) {
  return (left?.pid ?? null) === (right?.pid ?? null) &&
    (left?.token ?? null) === (right?.token ?? null);
}

async function removeQuarantinedLockDirectory(lockPath) {
  const transientCodes = new Set(["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"]);
  let lastError = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await rm(lockPath, { recursive: true, force: true });
      return true;
    } catch (error) {
      lastError = error;
      if (!transientCodes.has(error?.code)) {
        throw error;
      }
      await delay(10 + attempt * 5);
    }
  }
  if (lastError && !transientCodes.has(lastError?.code)) {
    throw lastError;
  }
  return false;
}

async function renameObservedLock(source, target, expectedGeneration, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const currentGeneration = await observeLockGeneration(source);
    if (!sameLockGeneration(expectedGeneration, currentGeneration)) return false;
    try {
      await rename(source, target);
      return true;
    } catch (error) {
      if (error?.code === "EEXIST") return false;
      if (!transientLockCodes.has(error?.code)) throw error;
      if (Date.now() >= deadline) return false;
      await delay(10 + Math.floor(Math.random() * 15));
    }
  }
}

function scrubRecordReferences(event, taskId, recordId) {
  if (event.task_id !== taskId) {
    return event;
  }
  if (event.event_type === "record_added") {
    const record = event.payload.record;
    if (Array.isArray(record?.supersedes)) {
      record.supersedes = record.supersedes.filter((id) => id !== recordId);
    }
    if (record?.source_ref?.ref === recordId) {
      record.source_ref.ref = null;
    }
    if (record?.scope_ref === recordId) {
      record.scope_ref = null;
    }
  }
  return event;
}

function validateEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new TypeError("event must be an object");
  }
  if (event.schema_version !== SCHEMA_VERSION) {
    throw new TypeError("unsupported event schema_version");
  }
  if (typeof event.event_id !== "string" || event.event_id.length < 3) {
    throw new TypeError("event_id is required");
  }
  if (!eventTypes.has(event.event_type)) {
    throw new TypeError("unsupported event_type");
  }
  if (!validIsoTimestamp(event.occurred_at)) {
    throw new TypeError("occurred_at must be an ISO timestamp");
  }
  if (typeof event.task_id !== "string" || event.task_id.length < 1 || event.task_id.length > 200) {
    throw new TypeError("task_id is invalid");
  }
  if (!event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    throw new TypeError("payload must be an object");
  }
  return event;
}

function migrateEvent(raw) {
  if (raw?.schema_version === SCHEMA_VERSION) {
    return { event: validateEvent(raw), migrated: false };
  }

  if (raw?.schema_version === 0 && raw.type && raw.at && raw.task_id) {
    const event = {
      schema_version: SCHEMA_VERSION,
      event_id: raw.event_id || raw.id,
      event_type: raw.type,
      occurred_at: raw.at,
      task_id: raw.task_id,
      payload: raw.payload || {}
    };
    return { event: validateEvent(event), migrated: true };
  }

  throw new TypeError("event has no supported migration path");
}

function safeTimestamp(clock) {
  return clock().replace(/[:.]/g, "-");
}

export class EventStore {
  constructor(options) {
    if (!options?.dataDirectory) {
      throw new TypeError("dataDirectory is required");
    }
    this.dataDirectory = path.resolve(options.dataDirectory);
    this.filePath = path.join(this.dataDirectory, "intent-events-v1.jsonl");
    this.backupPath = this.filePath + ".bak";
    this.lockPath = this.filePath + ".lock";
    this.clock = options.clock || (() => new Date().toISOString());
    this.lockTimeoutMs = options.lockTimeoutMs ?? 5000;
    this.staleLockMs = options.staleLockMs ?? 30000;
    this.lockTestHooks = options.lockTestHooks || {};
  }

  async readAll() {
    return this.withLock(async () => this.readAndRepairUnlocked());
  }

  async append(events, options = {}) {
    const result = await this.appendIf(events, () => true, options);
    return { events: result.events, recovery: result.recovery };
  }

  async appendIf(events, predicate, options = {}) {
    const additions = Array.isArray(events) ? events : [events];
    additions.forEach(validateEvent);
    if (additions.length === 0) {
      const current = await this.readAll();
      return { ...current, appended: false };
    }

    await this.lockTestHooks.beforeAppendIfLock?.({
      events: additions.map((event) => structuredClone(event))
    });
    return this.withLock(async () => {
      const current = await this.readAndRepairUnlocked();
      const allowed = await predicate(
        current.events.map((event) => structuredClone(event))
      );
      if (!allowed) {
        return { ...current, appended: false };
      }
      const body = additions.map((event) => JSON.stringify(event)).join("\n") + "\n";
      const handle = await open(this.filePath, "a", 0o600);
      try {
        await handle.chmod(0o600);
        await handle.writeFile(body, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      const result = {
        events: current.events.concat(additions),
        recovery: current.recovery,
        appended: true
      };
      await options.afterCommit?.({
        previousEvents: current.events.map((event) => structuredClone(event)),
        events: result.events.map((event) => structuredClone(event)),
        recovery: current.recovery
      });
      return result;
    });
  }

  async replaceTask(taskId, replacementEvents = [], options = {}) {
    const result = await this.replaceTaskIf(taskId, replacementEvents, () => true, options);
    return result.removed;
  }

  async replaceTaskIf(
    taskId,
    replacementEvents = [],
    predicate = () => true,
    options = {}
  ) {
    replacementEvents.forEach((event) => {
      validateEvent(event);
      if (event.task_id !== taskId) {
        throw new TypeError("replacement events must belong to the selected task");
      }
    });
    if (typeof predicate !== "function") {
      throw new TypeError("replacement predicate must be a function");
    }
    await this.lockTestHooks.beforeReplaceTaskIfLock?.({ taskId });
    const result = await this.withLock(async () => {
      const current = await this.readAndRepairUnlocked();
      const allowed = await predicate(
        current.events.map((event) => structuredClone(event))
      );
      if (!allowed) {
        return { ...current, replaced: false, removed: 0 };
      }

      let removed = 0;
      const sensitiveTokens = new Set([taskId]);
      const events = (() => {
        const kept = [];
        for (const event of current.events) {
          if (event.task_id === taskId) {
            removed += 1;
            collectErasureTokens(event, sensitiveTokens);
          } else {
            kept.push(event);
          }
        }
        return kept.concat(replacementEvents);
      })();
      await this.scrubRecoveryArtifactsUnlocked({
        taskId,
        recordId: null,
        sensitiveTokens
      });
      await this.atomicWriteUnlocked(events);
      const result = {
        events,
        recovery: current.recovery,
        replaced: true,
        removed
      };
      await options.afterCommit?.({
        previousEvents: current.events.map((event) => structuredClone(event)),
        events: events.map((event) => structuredClone(event)),
        recovery: current.recovery,
        removed
      });
      return result;
    });
    if (result.replaced) {
      await this.lockTestHooks.afterReplaceTaskIfCommit?.({ taskId });
    }
    return result;
  }

  async transform(transformer, options = {}) {
    return this.withLock(async () => {
      const current = await this.readAndRepairUnlocked();
      const transformed = await transformer(current.events.map((event) => structuredClone(event)));
      if (!Array.isArray(transformed)) {
        throw new TypeError("store transformer must return an event array");
      }
      transformed.forEach(validateEvent);
      if (options.scrubRecovery) {
        await this.scrubRecoveryArtifactsUnlocked(options.scrubRecovery);
      }
      await this.atomicWriteUnlocked(transformed);
      const result = {
        events: transformed,
        recovery: current.recovery
      };
      await options.afterCommit?.({
        previousEvents: current.events.map((event) => structuredClone(event)),
        events: transformed.map((event) => structuredClone(event)),
        recovery: current.recovery
      });
      return result;
    });
  }

  async withLockedEvents(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("locked event callback must be a function");
    }
    return this.withLock(async () => {
      const current = await this.readAndRepairUnlocked();
      return callback({
        events: current.events.map((event) => structuredClone(event)),
        recovery: current.recovery
      });
    });
  }

  async purgeTask(taskId, options = {}) {
    let removed = 0;
    const sensitiveTokens = new Set([taskId]);
    await this.transform(
      (events) =>
        events.filter((event) => {
          const keep = event.task_id !== taskId;
          if (!keep) {
            removed += 1;
            collectErasureTokens(event, sensitiveTokens);
          }
          return keep;
        }),
      {
        scrubRecovery: {
          taskId,
          recordId: null,
          sensitiveTokens
        },
        afterCommit: options.afterCommit
      }
    );
    return removed;
  }

  async purgeRecord(taskId, recordId, options = {}) {
    let removed = 0;
    const sensitiveTokens = new Set([recordId]);
    await this.transform(
      (events) => {
        const kept = [];
        for (const event of events) {
          if (
            event.task_id === taskId &&
            ((event.event_type === "record_added" &&
              event.payload.record?.record_id === recordId) ||
              (event.event_type === "record_invalidated" &&
                event.payload.target_record_id === recordId))
          ) {
            removed += 1;
            collectErasureTokens(event, sensitiveTokens);
            continue;
          }

          kept.push(scrubRecordReferences(event, taskId, recordId));
        }
        return kept;
      },
      {
        scrubRecovery: {
          taskId,
          recordId,
          sensitiveTokens
        },
        afterCommit: options.afterCommit
      }
    );
    return removed;
  }

  async scrubRecoveryArtifactsUnlocked(scrub) {
    const baseName = path.basename(this.filePath);
    const names = await readdir(this.dataDirectory);
    const artifactNames = names.filter(
      (name) =>
        name === baseName + ".bak" ||
        name.startsWith(baseName + ".next.") ||
        name.startsWith(baseName + ".corrupt.")
    );

    for (const name of artifactNames) {
      const artifactPath = path.join(this.dataDirectory, name);
      const raw = await readFile(artifactPath, "utf8");
      const output = [];
      for (const rawLine of raw.split(/\r?\n/)) {
        if (!rawLine.trim()) {
          continue;
        }

        try {
          const parsed = JSON.parse(rawLine);
          if (typeof parsed?.task_id === "string" && parsed.task_id !== scrub.taskId) {
            output.push(rawLine);
            continue;
          }
          const { event } = migrateEvent(parsed);
          if (scrub.recordId === null && event?.task_id === scrub.taskId) {
            continue;
          }
          if (scrub.recordId !== null && event?.task_id === scrub.taskId) {
            const isTargetRecord =
              (event.event_type === "record_added" &&
                event.payload?.record?.record_id === scrub.recordId) ||
              (event.event_type === "record_invalidated" &&
                event.payload?.target_record_id === scrub.recordId);
            if (isTargetRecord) {
              continue;
            }
            scrubRecordReferences(event, scrub.taskId, scrub.recordId);
          }
          output.push(JSON.stringify(event));
        } catch {
          const owner = recoveryTaskId(rawLine);
          if (owner !== null && owner !== scrub.taskId) {
            output.push(rawLine);
            continue;
          }
          const containsSensitiveToken = [...scrub.sensitiveTokens].some(
            (token) => rawLineContainsToken(rawLine, token)
          );
          if (!containsSensitiveToken) {
            output.push(rawLine);
          }
        }
      }
      await writeFile(artifactPath, output.length === 0 ? "" : output.join("\n") + "\n", {
        encoding: "utf8",
        mode: 0o600
      });
      await restrictFile(artifactPath);
    }
  }

  async tryReclaimStaleLock(reclaimToken) {
    const initialGeneration = await observeLockGeneration(this.lockPath);
    if (!initialGeneration) return false;
    const owner = await readLockOwner(this.lockPath);
    if (lockOwnerIsActive(owner)) return false;

    if (!owner) {
      const details = await stat(this.lockPath).catch((error) => {
        if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
        throw error;
      });
      if (!details) return false;
      if (Date.now() - details.mtimeMs <= this.staleLockMs) return false;
    }

    const reclaimPath = path.join(this.lockPath, "reclaim.json");
    const reclaimOwner = {
      pid: process.pid,
      token: reclaimToken,
      acquired_at: this.clock()
    };
    let reclaimer = await readLockMarker(reclaimPath);
    let newlyClaimed = false;
    if (reclaimer && !sameLockOwner(reclaimer, reclaimOwner)) {
      if (lockOwnerIsActive(reclaimer)) return false;
      const confirmedGeneration = await observeLockGeneration(this.lockPath);
      const confirmedOwner = await readLockOwner(this.lockPath);
      const confirmedReclaimer = await readLockMarker(reclaimPath);
      if (
        !sameLockGeneration(initialGeneration, confirmedGeneration) ||
        !sameLockOwner(owner, confirmedOwner) ||
        !sameLockOwner(reclaimer, confirmedReclaimer) ||
        lockOwnerIsActive(confirmedOwner) ||
        lockOwnerIsActive(confirmedReclaimer)
      ) {
        return false;
      }
      const abandonedPath = this.lockPath + ".stale-abandoned-" + randomUUID();
      if (!(await renameObservedLock(
        this.lockPath,
        abandonedPath,
        initialGeneration,
        Math.min(this.lockTimeoutMs, 2000)
      ))) return false;
      const movedGeneration = await observeLockGeneration(abandonedPath);
      const movedOwner = await readLockOwner(abandonedPath);
      const movedReclaimer = await readLockMarker(path.join(abandonedPath, "reclaim.json"));
      if (
        !sameLockGeneration(initialGeneration, movedGeneration) ||
        !sameLockOwner(owner, movedOwner) ||
        !sameLockOwner(reclaimer, movedReclaimer)
      ) {
        throw new Error("intent state abandoned-reclaimer identity changed during reclamation");
      }
      await removeQuarantinedLockDirectory(abandonedPath);
      return true;
    }
    if (!reclaimer) {
      try {
        await writeFile(reclaimPath, JSON.stringify(reclaimOwner), {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600
        });
        newlyClaimed = true;
        reclaimer = reclaimOwner;
      } catch (error) {
        if (error?.code === "EEXIST" || transientLockCodes.has(error?.code)) return false;
        throw error;
      }
    }

    if (newlyClaimed) {
      await this.lockTestHooks.afterReclaimClaim?.({
        lockPath: this.lockPath,
        reclaimToken
      });
    }

    const confirmedGeneration = await observeLockGeneration(this.lockPath);
    if (!sameLockGeneration(initialGeneration, confirmedGeneration)) return false;
    const confirmedOwner = await readLockOwner(this.lockPath);
    const confirmedReclaimer = await readLockMarker(reclaimPath);
    if (
      !sameLockOwner(owner, confirmedOwner) ||
      lockOwnerIsActive(confirmedOwner) ||
      confirmedReclaimer?.pid !== process.pid ||
      confirmedReclaimer.token !== reclaimToken
    ) {
      return false;
    }

    const quarantinePath = this.lockPath + ".stale-" + randomUUID();
    if (!(await renameObservedLock(
      this.lockPath,
      quarantinePath,
      initialGeneration,
      Math.min(this.lockTimeoutMs, 2000)
    ))) return false;

    const movedGeneration = await observeLockGeneration(quarantinePath);
    const movedOwner = await readLockOwner(quarantinePath);
    const movedReclaimer = await readLockMarker(path.join(quarantinePath, "reclaim.json"));
    if (
      !sameLockGeneration(initialGeneration, movedGeneration) ||
      !sameLockOwner(owner, movedOwner) ||
      movedReclaimer?.pid !== process.pid ||
      movedReclaimer.token !== reclaimToken
    ) {
      throw new Error("intent state stale-lock identity changed during reclamation");
    }
    await removeQuarantinedLockDirectory(quarantinePath);
    return true;
  }

  async releaseOwnedLock(lockToken) {
    const initialGeneration = await observeLockGeneration(this.lockPath);
    if (!initialGeneration) return;
    const owner = await readLockOwner(this.lockPath);
    if (owner?.pid !== process.pid || owner.token !== lockToken) return;

    const releasePath = path.join(this.lockPath, "release.json");
    try {
      await writeFile(
        releasePath,
        JSON.stringify({ pid: process.pid, token: lockToken, acquired_at: this.clock() }),
        { encoding: "utf8", flag: "wx", mode: 0o600 }
      );
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const confirmedGeneration = await observeLockGeneration(this.lockPath);
    const confirmedOwner = await readLockOwner(this.lockPath);
    const confirmedRelease = await readLockMarker(releasePath);
    if (
      !sameLockGeneration(initialGeneration, confirmedGeneration) ||
      confirmedOwner?.pid !== process.pid ||
      confirmedOwner.token !== lockToken ||
      confirmedRelease?.pid !== process.pid ||
      confirmedRelease.token !== lockToken
    ) {
      return;
    }

    const releasedPath = this.lockPath + ".release-" + lockToken + "-" + randomUUID();
    if (!(await renameObservedLock(
      this.lockPath,
      releasedPath,
      initialGeneration,
      Math.min(this.lockTimeoutMs, 2000)
    ))) return;
    const movedGeneration = await observeLockGeneration(releasedPath);
    const movedOwner = await readLockOwner(releasedPath);
    const movedRelease = await readLockMarker(path.join(releasedPath, "release.json"));
    if (
      !sameLockGeneration(initialGeneration, movedGeneration) ||
      movedOwner?.pid !== process.pid ||
      movedOwner.token !== lockToken ||
      movedRelease?.pid !== process.pid ||
      movedRelease.token !== lockToken
    ) {
      throw new Error("intent state lock identity changed during release");
    }
    await removeQuarantinedLockDirectory(releasedPath);
  }

  async withLock(callback) {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    await restrictDirectory(this.dataDirectory);
    const absoluteDeadline = Date.now() + Math.max(this.lockTimeoutMs * 24, 120_000);
    let progressDeadline = Date.now() + this.lockTimeoutMs;
    let lastOwnerToken = null;
    let contentionAttempts = 0;
    const lockToken = randomUUID();
    const reclaimToken = randomUUID();
    let acquired = false;
    activeLockTokens.add(lockToken);
    activeLockTokens.add(reclaimToken);

    try {
      while (!acquired) {
        try {
          await mkdir(this.lockPath, { mode: 0o700 });
          await restrictDirectory(this.lockPath);
          const createdGeneration = await observeLockGeneration(this.lockPath);
          await writeFile(
            path.join(this.lockPath, "owner.json"),
            JSON.stringify({ pid: process.pid, token: lockToken, acquired_at: this.clock() }),
            { encoding: "utf8", flag: "wx", mode: 0o600 }
          );
          const publishedGeneration = await observeLockGeneration(this.lockPath);
          const publishedOwner = await readLockOwner(this.lockPath);
          const reclaimer = await readLockMarker(path.join(this.lockPath, "reclaim.json"));
          if (
            sameLockGeneration(createdGeneration, publishedGeneration) &&
            publishedOwner?.pid === process.pid &&
            publishedOwner.token === lockToken &&
            reclaimer === null
          ) {
            acquired = true;
            break;
          }
          await this.releaseOwnedLock(lockToken).catch(() => undefined);
        } catch (error) {
          if (error?.code !== "EEXIST") {
            if (!transientLockCodes.has(error?.code)) throw error;
          } else {
            const observedOwner = await readLockOwner(this.lockPath);
            if (observedOwner?.token && observedOwner.token !== lastOwnerToken) {
              lastOwnerToken = observedOwner.token;
              progressDeadline = Date.now() + this.lockTimeoutMs;
            }
            if (await this.tryReclaimStaleLock(reclaimToken)) {
              lastOwnerToken = null;
              progressDeadline = Date.now() + this.lockTimeoutMs;
              continue;
            }
          }
        }

        if (Date.now() >= progressDeadline || Date.now() >= absoluteDeadline) {
          throw new Error("timed out waiting for the intent state lock");
        }
        contentionAttempts += 1;
        const contentionDelay = Math.min(150, 15 + contentionAttempts * 4);
        await delay(contentionDelay + Math.floor(Math.random() * 25));
      }

      return await callback();
    } finally {
      try {
        if (acquired) await this.releaseOwnedLock(lockToken).catch(() => undefined);
      } finally {
        activeLockTokens.delete(lockToken);
        activeLockTokens.delete(reclaimToken);
      }
    }
  }

  async recoverBackupUnlocked() {
    const fileExists = await pathExists(this.filePath);
    const backupExists = await pathExists(this.backupPath);

    if (!fileExists && backupExists) {
      await rename(this.backupPath, this.filePath);
      await restrictFile(this.filePath);
      return "restored_backup";
    }
    if (fileExists && backupExists) {
      await rm(this.backupPath, { force: true });
    }
    return null;
  }

  async readAndRepairUnlocked() {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    await restrictDirectory(this.dataDirectory);
    const backupRecovery = await this.recoverBackupUnlocked();
    if (!(await pathExists(this.filePath))) {
      return {
        events: [],
        recovery: backupRecovery ? { action: backupRecovery } : null
      };
    }

    const raw = await readFile(this.filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const events = [];
    const invalidLines = [];
    let migratedCount = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) {
        continue;
      }
      try {
        const migrated = migrateEvent(JSON.parse(line));
        events.push(migrated.event);
        if (migrated.migrated) {
          migratedCount += 1;
        }
      } catch {
        invalidLines.push(index + 1);
      }
    }

    let recovery = backupRecovery ? { action: backupRecovery } : null;
    if (invalidLines.length > 0) {
      const corruptPath =
        this.filePath + ".corrupt." + safeTimestamp(this.clock) + "." + randomUUID() + ".jsonl";
      await writeFile(corruptPath, raw, { encoding: "utf8", mode: 0o600 });
      await restrictFile(corruptPath);
      await this.atomicWriteUnlocked(events);
      recovery = {
        action: "quarantined_corruption",
        corrupt_path: corruptPath,
        invalid_lines: invalidLines,
        recovered_events: events.length
      };
    } else if (migratedCount > 0) {
      await this.atomicWriteUnlocked(events);
      recovery = {
        action: "migrated",
        migrated_events: migratedCount
      };
    }

    return { events, recovery };
  }

  async atomicWriteUnlocked(events) {
    await mkdir(this.dataDirectory, { recursive: true, mode: 0o700 });
    await restrictDirectory(this.dataDirectory);
    const temporaryPath = this.filePath + ".next." + randomUUID();
    const body =
      events.length === 0 ? "" : events.map((event) => JSON.stringify(event)).join("\n") + "\n";

    const handle = await open(temporaryPath, "wx", 0o600);
    try {
      await handle.chmod(0o600);
      await handle.writeFile(body, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    const hadCurrent = await pathExists(this.filePath);
    try {
      if (await pathExists(this.backupPath)) {
        await rm(this.backupPath, { force: true });
      }
      if (hadCurrent) {
        await rename(this.filePath, this.backupPath);
        await this.lockTestHooks.afterAtomicBackup?.();
      }
      await rename(temporaryPath, this.filePath);
      await this.lockTestHooks.afterAtomicReplace?.();
      await restrictFile(this.filePath);
      if (hadCurrent) {
        await this.lockTestHooks.beforeAtomicBackupRemoval?.();
        await rm(this.backupPath, { force: true });
      }
    } catch (error) {
      if (!(await pathExists(this.filePath)) && (await pathExists(this.backupPath))) {
        await rename(this.backupPath, this.filePath);
      }
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

export function createEvent(input) {
  return validateEvent({
    schema_version: SCHEMA_VERSION,
    event_id: input.event_id,
    event_type: input.event_type,
    occurred_at: input.occurred_at,
    task_id: input.task_id,
    payload: input.payload
  });
}
