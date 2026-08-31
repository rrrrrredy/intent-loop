import { constants, type BigIntStats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { canonicalStringify, newId, nowIso, sha256 } from "./canonical.js";
import { IntentLoopError } from "./errors.js";
import { migrateEventRecord } from "./migrations.js";
import { LedgerEvent, LedgerEventType, SCHEMA_VERSION } from "./types.js";

const PROJECT_ID_RE = /^[a-f0-9]{64}$/u;
const SESSION_HASH_RE = /^[a-f0-9]{64}$/u;
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const DEFAULT_LOCK_STALE_MS = 30_000;
const DEFAULT_LOCK_WAIT_MS = 5_000;
const DEFAULT_LOCK_HEARTBEAT_MS = 10_000;
const TRANSIENT_LOCK_RACE_CODES = new Set(["EBADF", "ENOENT", "ENOTDIR"]);

export interface NewEvent {
  event_type: LedgerEventType;
  task_id: string;
  actor: LedgerEvent["actor"];
  request_id: string;
  payload: Record<string, unknown>;
  event_id?: string;
  occurred_at?: string;
}

export interface LedgerStoreOptions {
  lock_stale_ms?: number;
  lock_wait_ms?: number;
  lock_heartbeat_ms?: number;
}

export interface AppendTransactionResult {
  events: LedgerEvent[];
  event: LedgerEvent | null;
}

interface LockOwner {
  pid: number;
  token: string;
  acquired_at: string;
}

type LockMarkerState = "present" | "missing" | "invalid" | "raced";

interface LockMarkerObservation {
  owner: LockOwner | null;
  state: LockMarkerState;
}

interface LockDirectorySnapshot {
  dev: bigint;
  ino: bigint;
  birthtime_ns: bigint;
  ctime_ns: bigint;
  mtime_ns: bigint;
  size: bigint;
}

export interface PrivateSessionControl {
  schema_version: typeof SCHEMA_VERSION;
  project_id: string;
  task_id: string;
  host_session_hash: string;
  mode: "private";
  created_at: string;
}

export interface TransactAppendOptions {
  private_recovery?: {
    task_id: string;
    session_hash: string;
    require_control?: boolean;
    clear_after?: boolean;
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function withoutHash(event: LedgerEvent): Omit<LedgerEvent, "event_hash"> {
  const { event_hash: _eventHash, ...unsigned } = event;
  return unsigned;
}

export function eventHash(event: Omit<LedgerEvent, "event_hash">): string {
  return sha256(canonicalStringify(event));
}

function assertEventShape(value: unknown): asserts value is LedgerEvent {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger line must be a JSON object");
  }
  const event = value as Partial<LedgerEvent>;
  if (
    event.schema_version !== SCHEMA_VERSION ||
    typeof event.event_id !== "string" ||
    typeof event.event_type !== "string" ||
    typeof event.project_id !== "string" ||
    typeof event.task_id !== "string" ||
    typeof event.occurred_at !== "string" ||
    typeof event.actor !== "string" ||
    typeof event.request_id !== "string" ||
    event.payload === null ||
    typeof event.payload !== "object" ||
    Array.isArray(event.payload) ||
    (event.prev_hash !== null && typeof event.prev_hash !== "string") ||
    typeof event.event_hash !== "string"
  ) {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger event has an invalid schema");
  }
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function errorCode(error: unknown): string {
  return error instanceof Error && "code" in error ? String(error.code) : "";
}

function lockDirectorySnapshot(info: BigIntStats): LockDirectorySnapshot {
  return {
    dev: info.dev,
    ino: info.ino,
    birthtime_ns: info.birthtimeNs,
    ctime_ns: info.ctimeNs,
    mtime_ns: info.mtimeNs,
    size: info.size
  };
}

function sameLockMarkerFile(left: LockDirectorySnapshot, right: LockDirectorySnapshot): boolean {
  return (
    sameLockGeneration(left, right) &&
    left.ctime_ns === right.ctime_ns &&
    left.mtime_ns === right.mtime_ns &&
    left.size === right.size
  );
}

function sameLockGeneration(left: LockDirectorySnapshot, right: LockDirectorySnapshot): boolean {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtime_ns === right.birthtime_ns
  );
}

async function syncFile(filePath: string): Promise<void> {
  const handle = await open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await open(directory, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!new Set(["EINVAL", "EPERM", "EISDIR", "EBADF"]).has(errorCode(error))) throw error;
  }
}

async function restrictDirectory(directory: string): Promise<void> {
  try {
    await chmod(directory, 0o700);
  } catch (error) {
    if (!new Set(["EPERM", "ENOSYS", "EINVAL"]).has(errorCode(error))) throw error;
  }
}

function parseLockOwner(value: string): LockOwner | null {
  try {
    const parsed = JSON.parse(value) as Partial<LockOwner>;
    if (
      Number.isInteger(parsed.pid) &&
      Number(parsed.pid) > 0 &&
      typeof parsed.token === "string" &&
      UUID_RE.test(parsed.token) &&
      typeof parsed.acquired_at === "string"
    ) {
      return { pid: Number(parsed.pid), token: parsed.token, acquired_at: parsed.acquired_at };
    }
  } catch {
    // A partially created owner record is reclaimed only after the stale threshold.
  }
  return null;
}

function processIsAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = errorCode(error);
    if (code === "ESRCH" || code === "EINVAL") return false;
    return true;
  }
}

export class LedgerStore {
  readonly dataRoot: string;
  private initializedRoot: string | null = null;
  private readonly lockStaleMs: number;
  private readonly lockWaitMs: number;
  private readonly lockHeartbeatMs: number;

  constructor(dataRoot: string, options: LedgerStoreOptions = {}) {
    if (!dataRoot.trim()) {
      throw new IntentLoopError("DATA_DIR_REQUIRED", "Intent Loop requires PLUGIN_DATA or INTENT_LOOP_DATA_DIR");
    }
    this.dataRoot = path.resolve(dataRoot);
    this.lockStaleMs = options.lock_stale_ms ?? DEFAULT_LOCK_STALE_MS;
    this.lockWaitMs = options.lock_wait_ms ?? DEFAULT_LOCK_WAIT_MS;
    this.lockHeartbeatMs = options.lock_heartbeat_ms ?? DEFAULT_LOCK_HEARTBEAT_MS;
  }

  private validateProjectId(projectId: string): void {
    if (!PROJECT_ID_RE.test(projectId)) {
      throw new IntentLoopError("INVALID_PROJECT_ID", "project_id must be a lowercase SHA-256 value");
    }
  }

  private validateSessionHash(sessionHash: string): void {
    if (!SESSION_HASH_RE.test(sessionHash)) {
      throw new IntentLoopError("INVALID_SESSION_HASH", "host session hash must be a lowercase SHA-256 value");
    }
  }

  private async root(): Promise<string> {
    if (this.initializedRoot !== null) return this.initializedRoot;
    await mkdir(this.dataRoot, { recursive: true, mode: 0o700 });
    this.initializedRoot = await realpath(this.dataRoot);
    await restrictDirectory(this.initializedRoot);
    return this.initializedRoot;
  }

  private async existingRoot(): Promise<string | null> {
    if (this.initializedRoot !== null) return this.initializedRoot;
    try {
      this.initializedRoot = await realpath(this.dataRoot);
      return this.initializedRoot;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    }
  }

  private async projectsDirectory(create: boolean): Promise<string | null> {
    const root = create ? await this.root() : await this.existingRoot();
    if (root === null) return null;
    const candidate = path.join(root, "projects");
    let actual: string;
    try {
      actual = await realpath(candidate);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      if (!create) return null;
      await mkdir(candidate, { mode: 0o700 }).catch((mkdirError: unknown) => {
        if (errorCode(mkdirError) !== "EEXIST") throw mkdirError;
      });
      actual = await realpath(candidate);
    }
    if (!isWithin(root, actual)) {
      throw new IntentLoopError("PATH_ESCAPE", "projects directory resolves outside the data root");
    }
    if (!(await stat(actual)).isDirectory()) {
      throw new IntentLoopError("INVALID_DATA_DIR", "projects path is not a directory");
    }
    if (create) await restrictDirectory(actual);
    return actual;
  }

  async projectDirectory(projectId: string): Promise<string> {
    this.validateProjectId(projectId);
    const projects = await this.projectsDirectory(true);
    if (projects === null) throw new IntentLoopError("DATA_DIR_REQUIRED", "projects directory is unavailable");
    const candidate = path.join(projects, projectId);
    let actual: string;
    try {
      actual = await realpath(candidate);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      await mkdir(candidate, { mode: 0o700 }).catch((mkdirError: unknown) => {
        if (errorCode(mkdirError) !== "EEXIST") throw mkdirError;
      });
      actual = await realpath(candidate);
    }
    if (!isWithin(projects, actual)) {
      throw new IntentLoopError("PATH_ESCAPE", "project storage resolves outside the projects directory");
    }
    if (!(await stat(actual)).isDirectory()) {
      throw new IntentLoopError("INVALID_DATA_DIR", "project storage path is not a directory");
    }
    await restrictDirectory(actual);
    return actual;
  }

  private async existingProjectDirectory(projectId: string): Promise<string | null> {
    this.validateProjectId(projectId);
    const projects = await this.projectsDirectory(false);
    if (projects === null) return null;
    const candidate = path.join(projects, projectId);
    try {
      const actual = await realpath(candidate);
      if (!isWithin(projects, actual)) {
        throw new IntentLoopError("PATH_ESCAPE", "project storage resolves outside the projects directory");
      }
      if (!(await stat(actual)).isDirectory()) {
        throw new IntentLoopError("INVALID_DATA_DIR", "project storage path is not a directory");
      }
      return actual;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    }
  }

  dataDirectoryPath(projectId: string): string {
    this.validateProjectId(projectId);
    return path.resolve(this.dataRoot, "projects", projectId);
  }

  async ledgerPath(projectId: string): Promise<string> {
    return path.join(await this.projectDirectory(projectId), "ledger.jsonl");
  }

  private async internalDirectory(
    projectDirectory: string,
    name: "ledger.lock" | "private-sessions" | "quarantine",
    create: boolean
  ): Promise<string | null> {
    const candidate = path.join(projectDirectory, name);
    let info = await lstat(candidate).catch((error: unknown) => {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    });
    if (info === null) {
      if (!create) return null;
      await mkdir(candidate, { mode: 0o700 }).catch((error: unknown) => {
        if (errorCode(error) !== "EEXIST") throw error;
      });
      info = await lstat(candidate);
    }
    if (info.isSymbolicLink()) {
      throw new IntentLoopError("PATH_ESCAPE", `${name} must not be a symbolic link or junction`);
    }
    if (!info.isDirectory()) {
      throw new IntentLoopError("INVALID_DATA_DIR", `${name} must be a directory`);
    }
    const actual = await realpath(candidate).catch((error: unknown) => {
      if (!create && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (actual === null) return null;
    if (!isWithin(projectDirectory, actual)) {
      throw new IntentLoopError("PATH_ESCAPE", `${name} resolves outside project storage`);
    }
    if (create) await restrictDirectory(actual);
    return actual;
  }

  private async safeRegularFile(
    projectDirectory: string,
    filePath: string,
    allowMissing: boolean
  ): Promise<boolean> {
    const info = await lstat(filePath).catch((error: unknown) => {
      if (allowMissing && errorCode(error) === "ENOENT") return null;
      throw error;
    });
    if (info === null) return false;
    if (info.isSymbolicLink()) {
      throw new IntentLoopError("PATH_ESCAPE", `${path.basename(filePath)} must not be a symbolic link`);
    }
    if (!info.isFile() || info.nlink !== 1) {
      throw new IntentLoopError(
        "UNSAFE_DATA_FILE",
        `${path.basename(filePath)} must be a regular file with exactly one filesystem link`
      );
    }
    const actual = await realpath(filePath).catch((error: unknown) => {
      if (allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (actual === null) return false;
    if (!isWithin(projectDirectory, actual)) {
      throw new IntentLoopError("PATH_ESCAPE", `${path.basename(filePath)} resolves outside project storage`);
    }
    return true;
  }

  private async readSafeFile(projectDirectory: string, filePath: string, allowMissing: boolean): Promise<string> {
    if (!(await this.safeRegularFile(projectDirectory, filePath, allowMissing))) return "";
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(filePath, constants.O_RDONLY | noFollow);
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1) {
        throw new IntentLoopError(
          allowMissing ? "TRANSIENT_FILE_RACE" : "UNSAFE_DATA_FILE",
          `${path.basename(filePath)} changed while it was being opened`,
          allowMissing
        );
      }
      return await handle.readFile({ encoding: "utf8" });
    } catch (error) {
      if (allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return "";
      throw error;
    } finally {
      if (handle !== undefined) {
        await handle.close().catch((error: unknown) => {
          if (!(allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error)))) throw error;
        });
      }
    }
  }

  private async observeLockDirectory(lockDirectory: string): Promise<LockDirectorySnapshot | null> {
    const info = await lstat(lockDirectory, { bigint: true }).catch((error: unknown) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (info === null) return null;
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new IntentLoopError("PATH_ESCAPE", "ledger.lock must be a real directory");
    }
    return lockDirectorySnapshot(info);
  }

  private async observeLockMarkerFile(markerPath: string): Promise<LockDirectorySnapshot | null> {
    const info = await lstat(markerPath, { bigint: true }).catch((error: unknown) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (info === null) return null;
    if (info.isSymbolicLink()) {
      throw new IntentLoopError("PATH_ESCAPE", `${path.basename(markerPath)} must not be a symbolic link`);
    }
    if (!info.isFile() || info.nlink !== 1n) {
      throw new IntentLoopError(
        "UNSAFE_DATA_FILE",
        `${path.basename(markerPath)} must be a regular file with exactly one filesystem link`
      );
    }
    return lockDirectorySnapshot(info);
  }

  private async observeLockMarker(
    projectDirectory: string,
    filePath: string
  ): Promise<LockMarkerObservation> {
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const initial = await lstat(filePath).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      });
      if (initial === null) return { owner: null, state: "missing" };
      if (initial.isSymbolicLink()) {
        throw new IntentLoopError("PATH_ESCAPE", `${path.basename(filePath)} must not be a symbolic link`);
      }
      if (!initial.isFile() || initial.nlink !== 1) {
        throw new IntentLoopError(
          "UNSAFE_DATA_FILE",
          `${path.basename(filePath)} must be a regular file with exactly one filesystem link`
        );
      }
      const actual = await realpath(filePath);
      if (!isWithin(projectDirectory, actual)) {
        throw new IntentLoopError("PATH_ESCAPE", `${path.basename(filePath)} resolves outside project storage`);
      }
      const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
      handle = await open(filePath, constants.O_RDONLY | noFollow);
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1) {
        return { owner: null, state: "raced" };
      }
      const owner = parseLockOwner(await handle.readFile({ encoding: "utf8" }));
      return { owner, state: owner === null ? "invalid" : "present" };
    } catch (error) {
      if (
        TRANSIENT_LOCK_RACE_CODES.has(errorCode(error)) ||
        (error instanceof IntentLoopError && error.code === "TRANSIENT_FILE_RACE")
      ) {
        return { owner: null, state: "raced" };
      }
      throw error;
    } finally {
      if (handle !== undefined) {
        await handle.close().catch((error: unknown) => {
          if (!TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) throw error;
        });
      }
    }
  }

  private async removeOwnedLockMarker(
    projectDirectory: string,
    markerPath: string,
    token: string
  ): Promise<void> {
    const observation = await this.observeLockMarker(projectDirectory, markerPath);
    if (observation.state === "present" && observation.owner?.token === token) {
      await rm(markerPath, { force: true }).catch(() => undefined);
    }
  }

  private async removeInvalidLockMarker(
    projectDirectory: string,
    lockDirectory: string,
    expectedGeneration: LockDirectorySnapshot,
    markerPath: string,
    requireStale: boolean
  ): Promise<boolean> {
    const initialMarker = await this.observeLockMarkerFile(markerPath);
    if (initialMarker === null) return false;
    if (
      requireStale &&
      Date.now() - Number(initialMarker.mtime_ns / 1_000_000n) <= this.lockStaleMs
    ) {
      return false;
    }
    const observation = await this.observeLockMarker(projectDirectory, markerPath);
    const generation = await this.observeLockDirectory(lockDirectory);
    const confirmedMarker = await this.observeLockMarkerFile(markerPath);
    if (
      observation.state !== "invalid" ||
      generation === null ||
      !sameLockGeneration(expectedGeneration, generation) ||
      confirmedMarker === null ||
      !sameLockMarkerFile(initialMarker, confirmedMarker)
    ) {
      return false;
    }
    await rm(markerPath, { force: true });
    return true;
  }

  private async pauseForLockTransition(): Promise<void> {
    await delay(40 + (process.pid % 60));
  }

  private async pauseForLockRetry(): Promise<void> {
    await delay(10 + (process.pid % 41));
  }

  private async reclaimedLockDirectoryDisappeared(reclaimed: string): Promise<boolean> {
    const started = Date.now();
    while (true) {
      const info = await lstat(reclaimed).catch((error: unknown) => {
        if (new Set(["ENOENT", "ENOTDIR"]).has(errorCode(error))) return null;
        throw error;
      });
      if (info === null) return true;
      if (info.isSymbolicLink() || !info.isDirectory()) return false;
      if (Date.now() - started >= this.lockWaitMs) return false;
      await this.pauseForLockTransition();
    }
  }

  private async removeInternalDirectory(
    projectDirectory: string,
    name: "private-sessions" | "quarantine"
  ): Promise<void> {
    const directory = await this.internalDirectory(projectDirectory, name, false);
    if (directory !== null) await rm(directory, { recursive: true, force: true });
  }

  private async cleanupOrphanTempsUnlocked(projectDirectory: string): Promise<void> {
    const ledgerTemp = /^ledger-(?:append|repair|rewrite)-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/iu;
    const renamedLock = /^ledger\.lock\.(?:stale-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|release-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/iu;
    const projectEntries = await readdir(projectDirectory, { withFileTypes: true });
    let changed = false;
    for (const entry of projectEntries) {
      if (renamedLock.test(entry.name)) {
        const target = path.join(projectDirectory, entry.name);
        const info = await lstat(target).catch((error: unknown) => {
          if (errorCode(error) === "ENOENT") return null;
          throw error;
        });
        if (info === null) continue;
        if (info.isSymbolicLink() || !info.isDirectory()) {
          throw new IntentLoopError("PATH_ESCAPE", "orphan renamed lock path is not a real directory");
        }
        const actual = await realpath(target).catch((error: unknown) => {
          if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
          throw error;
        });
        if (actual === null) continue;
        if (!isWithin(projectDirectory, actual)) {
          throw new IntentLoopError("PATH_ESCAPE", "orphan renamed lock resolves outside project storage");
        }
        await rm(target, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
        changed = true;
        continue;
      }
      if (!ledgerTemp.test(entry.name)) continue;
      const target = path.join(projectDirectory, entry.name);
      const info = await lstat(target).catch((error: unknown) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      });
      if (info === null) continue;
      if (info.isSymbolicLink() || !info.isFile()) {
        throw new IntentLoopError("PATH_ESCAPE", "orphan ledger temporary path is not a regular file");
      }
      await rm(target, { force: true });
      changed = true;
    }

    const privateDirectory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (privateDirectory !== null) {
      const privateTemp = /^[a-f0-9]{64}\.json\.[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/iu;
      const entries = await readdir(privateDirectory, { withFileTypes: true });
      for (const entry of entries) {
        if (!privateTemp.test(entry.name)) continue;
        const target = path.join(privateDirectory, entry.name);
        const info = await lstat(target).catch((error: unknown) => {
          if (errorCode(error) === "ENOENT") return null;
          throw error;
        });
        if (info === null) continue;
        if (info.isSymbolicLink() || !info.isFile()) {
          throw new IntentLoopError("PATH_ESCAPE", "orphan private-control temporary path is not a regular file");
        }
        await rm(target, { force: true });
        changed = true;
      }
      if (changed) await syncDirectory(privateDirectory);
    }
    if (changed) await syncDirectory(projectDirectory);
  }

  private async tryReclaimStaleLock(
    projectDirectory: string,
    lockDirectory: string,
    reclaimToken: string
  ): Promise<boolean> {
    if (await this.internalDirectory(projectDirectory, "ledger.lock", false) === null) return false;
    const initialGeneration = await this.observeLockDirectory(lockDirectory);
    if (initialGeneration === null) return false;
    const ownerPath = path.join(lockDirectory, "owner.json");
    const releasePath = path.join(lockDirectory, "release.json");
    const releaseObservation = await this.observeLockMarker(projectDirectory, releasePath);
    if (releaseObservation.state === "raced") {
      await this.pauseForLockTransition();
      return false;
    }
    const knownRelease = releaseObservation.owner;
    if (knownRelease !== null && processIsAlive(knownRelease.pid)) {
      await this.pauseForLockTransition();
      return false;
    }
    const reclaimPath = path.join(lockDirectory, "reclaim.json");
    const reclaimerObservation = await this.observeLockMarker(projectDirectory, reclaimPath);
    if (reclaimerObservation.state === "raced") {
      await this.pauseForLockTransition();
      return false;
    }
    const knownReclaimer = reclaimerObservation.owner;
    if (
      knownReclaimer !== null &&
      (knownReclaimer.pid !== process.pid || knownReclaimer.token !== reclaimToken) &&
      processIsAlive(knownReclaimer.pid)
    ) {
      await this.pauseForLockTransition();
      return false;
    }
    const ownerStat = await stat(ownerPath).catch((error: unknown) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    const ownerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
    if (ownerObservation.state === "raced") {
      await this.pauseForLockTransition();
      return false;
    }
    const observedGeneration = await this.observeLockDirectory(lockDirectory);
    if (
      observedGeneration === null ||
      !sameLockGeneration(initialGeneration, observedGeneration)
    ) {
      await this.pauseForLockTransition();
      return false;
    }
    const observedAt = ownerStat?.mtimeMs ?? Number(observedGeneration.mtime_ns / 1_000_000n);
    if (Date.now() - observedAt <= this.lockStaleMs) return false;
    const observed = ownerObservation.owner;
    if (observed !== null && processIsAlive(observed.pid)) return false;

    const reclaimOwner: LockOwner = { pid: process.pid, token: reclaimToken, acquired_at: nowIso() };
    let ownsReclaim = false;
    if (knownReclaimer?.pid === process.pid && knownReclaimer.token === reclaimToken) {
      ownsReclaim = true;
    } else {
      try {
        await writeFile(reclaimPath, `${JSON.stringify(reclaimOwner)}\n`, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600
        });
        ownsReclaim = true;
      } catch (error) {
        if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return false;
        if (errorCode(error) !== "EEXIST") throw error;
        const existingObservation = await this.observeLockMarker(projectDirectory, reclaimPath);
        if (existingObservation.state === "raced") {
          await this.pauseForLockTransition();
          return false;
        }
        const existingReclaimer = existingObservation.owner;
        if (existingReclaimer === null) {
          if (existingObservation.state === "invalid") {
            const removed = await this.removeInvalidLockMarker(
              projectDirectory,
              lockDirectory,
              initialGeneration,
              reclaimPath,
              true
            );
            if (removed) await this.pauseForLockTransition();
          }
          return false;
        }
        if (existingReclaimer.pid === process.pid && existingReclaimer.token === reclaimToken) {
          ownsReclaim = true;
        } else {
          if (processIsAlive(existingReclaimer.pid)) {
            await this.pauseForLockTransition();
            return false;
          }
          const reclaimStat = await stat(reclaimPath).catch((statError: unknown) => {
            if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(statError))) return null;
            throw statError;
          });
          if (reclaimStat === null || Date.now() - reclaimStat.mtimeMs <= this.lockStaleMs) return false;
          const cleanupGeneration = await this.observeLockDirectory(lockDirectory);
          if (
            cleanupGeneration !== null &&
            sameLockGeneration(initialGeneration, cleanupGeneration)
          ) {
            await this.removeOwnedLockMarker(projectDirectory, reclaimPath, existingReclaimer.token);
          }
          await this.pauseForLockTransition();
          return false;
        }
      }
    }

    const claimedGeneration = await this.observeLockDirectory(lockDirectory);
    if (
      claimedGeneration === null ||
      !sameLockGeneration(initialGeneration, claimedGeneration)
    ) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      await this.pauseForLockTransition();
      return false;
    }
    const confirmedOwnerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
    const confirmedReclaimerObservation = await this.observeLockMarker(projectDirectory, reclaimPath);
    if (
      confirmedOwnerObservation.state === "raced" ||
      confirmedReclaimerObservation.state === "raced"
    ) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      await this.pauseForLockTransition();
      return false;
    }
    const confirmedOwner = confirmedOwnerObservation.owner;
    const confirmedReclaimer = confirmedReclaimerObservation.owner;
    if (
      (observed?.token ?? null) !== (confirmedOwner?.token ?? null) ||
      confirmedReclaimer?.pid !== process.pid ||
      confirmedReclaimer.token !== reclaimToken ||
      (confirmedOwner !== null && processIsAlive(confirmedOwner.pid))
    ) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      return false;
    }
    const renameGeneration = await this.observeLockDirectory(lockDirectory);
    if (
      renameGeneration === null ||
      !sameLockGeneration(initialGeneration, renameGeneration)
    ) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      await this.pauseForLockTransition();
      return false;
    }
    const reclaimed = `${lockDirectory}.stale-${newId()}`;
    try {
      await rename(lockDirectory, reclaimed);
    } catch (error) {
      if (new Set(["ENOENT", "EEXIST", "EPERM", "EACCES"]).has(errorCode(error))) return false;
      throw error;
    }
    const movedGeneration = await this.observeLockDirectory(reclaimed);
    const movedOwnerObservation = await this.observeLockMarker(
      projectDirectory,
      path.join(reclaimed, "owner.json")
    );
    const movedReclaimerObservation = await this.observeLockMarker(
      projectDirectory,
      path.join(reclaimed, "reclaim.json")
    );
    const movedOwner = movedOwnerObservation.owner;
    const movedReclaimer = movedReclaimerObservation.owner;
    const movedIdentityUnavailable =
      movedGeneration === null ||
      !sameLockGeneration(initialGeneration, movedGeneration) ||
      movedOwnerObservation.state === "raced" ||
      movedReclaimerObservation.state === "raced" ||
      (observed !== null && movedOwner === null) ||
      movedReclaimer === null;
    if (
      movedIdentityUnavailable &&
      await this.reclaimedLockDirectoryDisappeared(reclaimed)
    ) {
      // Another writer can acquire the newly vacant canonical lock and remove
      // this uniquely named quarantine before these post-rename reads finish.
      // Its disappearance completes the reclaim; a stable identity mismatch
      // below remains a compromise signal.
      return true;
    }
    if (
      movedGeneration === null ||
      !sameLockGeneration(initialGeneration, movedGeneration) ||
      movedOwnerObservation.state === "raced" ||
      movedReclaimerObservation.state === "raced"
    ) {
      throw new IntentLoopError("LOCK_COMPROMISED", "stale-lock identity raced during reclamation", true);
    }
    if (
      (observed?.token ?? null) !== (movedOwner?.token ?? null) ||
      movedReclaimer?.pid !== process.pid ||
      movedReclaimer.token !== reclaimToken
    ) {
      throw new IntentLoopError("LOCK_COMPROMISED", "stale-lock identity changed during reclamation", true);
    }
    await rm(reclaimed, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
    return true;
  }

  private async releaseOwnedLock(projectDirectory: string, lockDirectory: string, token: string): Promise<void> {
    const existing = await this.internalDirectory(projectDirectory, "ledger.lock", false);
    if (existing === null) return;
    const initialGeneration = await this.observeLockDirectory(lockDirectory);
    if (initialGeneration === null) return;
    const ownerPath = path.join(lockDirectory, "owner.json");
    const releasePath = path.join(lockDirectory, "release.json");
    const releaseOwner: LockOwner = { pid: process.pid, token, acquired_at: nowIso() };
    const released = `${lockDirectory}.release-${token}-${newId()}`;
    const started = Date.now();
    while (true) {
      const currentObservation = await this.observeLockMarker(projectDirectory, ownerPath);
      if (currentObservation.state === "raced") {
        if (Date.now() - started > this.lockWaitMs) {
          throw new IntentLoopError("LOCK_RELEASE_TIMEOUT", "timed out observing the project ledger lock owner", true);
        }
        await delay(25);
        continue;
      }
      if (currentObservation.owner?.token !== token) return;
      try {
        await writeFile(releasePath, `${JSON.stringify(releaseOwner)}\n`, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600
        });
      } catch (error) {
        if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return;
        if (errorCode(error) !== "EEXIST") throw error;
      }
      const releaseObservation = await this.observeLockMarker(projectDirectory, releasePath);
      if (releaseObservation.state === "raced") {
        if (Date.now() - started > this.lockWaitMs) {
          throw new IntentLoopError("LOCK_RELEASE_TIMEOUT", "timed out observing the project ledger release marker", true);
        }
        await delay(25);
        continue;
      }
      if (releaseObservation.state === "invalid") {
        if (
          await this.removeInvalidLockMarker(
            projectDirectory,
            lockDirectory,
            initialGeneration,
            releasePath,
            false
          )
        ) {
          continue;
        }
        return;
      }
      if (releaseObservation.owner?.token !== token) return;
      const releaseGeneration = await this.observeLockDirectory(lockDirectory);
      if (
        releaseGeneration === null ||
        !sameLockGeneration(initialGeneration, releaseGeneration)
      ) {
        return;
      }
      try {
        await rename(lockDirectory, released);
        break;
      } catch (error) {
        if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return;
        if (!new Set(["EPERM", "EACCES"]).has(errorCode(error))) throw error;
        if (Date.now() - started > this.lockWaitMs) {
          throw new IntentLoopError("LOCK_RELEASE_TIMEOUT", "timed out releasing the project ledger lock", true);
        }
        await delay(25);
      }
    }
    await rm(released, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
  }

  private async withLock<T>(projectId: string, action: (projectDirectory: string) => Promise<T>): Promise<T> {
    const projectDirectory = await this.projectDirectory(projectId);
    const lockDirectory = path.join(projectDirectory, "ledger.lock");
    const ownerPath = path.join(lockDirectory, "owner.json");
    const token = newId();
    const reclaimToken = newId();
    const absoluteStarted = Date.now();
    let lastProgressAt = absoluteStarted;
    let lastOwnerToken: string | null = null;
    const absoluteWaitMs = Math.max(this.lockWaitMs * 6, 30_000);
    while (true) {
      if (Date.now() - absoluteStarted > absoluteWaitMs) {
        throw new IntentLoopError("LOCK_TIMEOUT", "timed out waiting for the project ledger lock", true);
      }
      try {
        await mkdir(lockDirectory, { mode: 0o700 });
      } catch (error) {
        if (errorCode(error) !== "EEXIST") throw error;
        try {
          const ownerGeneration = await this.observeLockDirectory(lockDirectory);
          const ownerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
          const confirmedOwnerGeneration = await this.observeLockDirectory(lockDirectory);
          if (
            ownerGeneration !== null &&
            confirmedOwnerGeneration !== null &&
            sameLockGeneration(ownerGeneration, confirmedOwnerGeneration) &&
            ownerObservation.state === "present" &&
            ownerObservation.owner?.pid === process.pid &&
            ownerObservation.owner.token === token
          ) {
            break;
          }
          if (ownerObservation.state === "raced") {
            lastProgressAt = Date.now();
          } else if (
            ownerObservation.owner !== null &&
            ownerObservation.owner.token !== lastOwnerToken
          ) {
            lastOwnerToken = ownerObservation.owner.token;
            lastProgressAt = Date.now();
          }
          await this.internalDirectory(projectDirectory, "ledger.lock", false);
          if (await this.tryReclaimStaleLock(projectDirectory, lockDirectory, reclaimToken)) {
            lastOwnerToken = null;
            lastProgressAt = Date.now();
            continue;
          }
        } catch (raceError) {
          if (!TRANSIENT_LOCK_RACE_CODES.has(errorCode(raceError))) throw raceError;
          lastProgressAt = Date.now();
          await this.pauseForLockRetry();
          continue;
        }
        const now = Date.now();
        if (now - lastProgressAt > this.lockWaitMs || now - absoluteStarted > absoluteWaitMs) {
          throw new IntentLoopError("LOCK_TIMEOUT", "timed out waiting for the project ledger lock", true);
        }
        await this.pauseForLockRetry();
        continue;
      }

      const createdGeneration = await this.observeLockDirectory(lockDirectory);
      if (createdGeneration === null) {
        lastProgressAt = Date.now();
        await this.pauseForLockRetry();
        continue;
      }
      try {
        await writeFile(
          ownerPath,
          `${JSON.stringify({ pid: process.pid, token, acquired_at: nowIso() } satisfies LockOwner)}\n`,
          { encoding: "utf8", flag: "wx", mode: 0o600 }
        );
      } catch (error) {
        if (new Set(["ENOENT", "ENOTDIR", "EEXIST"]).has(errorCode(error))) {
          lastProgressAt = Date.now();
          await this.pauseForLockRetry();
          continue;
        }
        // Never recursively remove the canonical path here. It may already be
        // a newer lock generation; an ownerless failed creation is recovered
        // only after the normal stale threshold.
        throw error;
      }
      const publishedGeneration = await this.observeLockDirectory(lockDirectory);
      const publishedOwner = await this.observeLockMarker(projectDirectory, ownerPath);
      if (
        publishedGeneration !== null &&
        sameLockGeneration(createdGeneration, publishedGeneration) &&
        publishedOwner.state === "present" &&
        publishedOwner.owner?.pid === process.pid &&
        publishedOwner.owner.token === token
      ) {
        break;
      }
      lastProgressAt = Date.now();
      await this.pauseForLockRetry();
    }

    const heartbeat = setInterval(() => {
      const now = new Date();
      void Promise.all([utimes(lockDirectory, now, now), utimes(ownerPath, now, now)])
        .catch(() => undefined);
    }, this.lockHeartbeatMs);
    heartbeat.unref();
    try {
      await this.cleanupOrphanTempsUnlocked(projectDirectory);
      return await action(projectDirectory);
    } finally {
      clearInterval(heartbeat);
      // Once action() resolves, its durable result must not be reported as a
      // failed mutation merely because lock cleanup raced. A caller retry with
      // a new request ID could otherwise duplicate an already committed action.
      await this.releaseOwnedLock(projectDirectory, lockDirectory, token).catch(() => undefined);
    }
  }

  private parseLedgerContent(content: string, projectId: string): LedgerEvent[] {
    if (content.length === 0) return [];
    if (!content.endsWith("\n")) {
      throw new IntentLoopError("CORRUPT_TRAILING_EVENT", "ledger has an incomplete trailing event", true);
    }
    const events: LedgerEvent[] = [];
    let expectedPrevious: string | null = null;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === "" && index === lines.length - 1) continue;
      if (line === undefined || line.trim() === "") {
        throw new IntentLoopError("CORRUPT_LEDGER", `ledger contains an empty middle line at ${index + 1}`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new IntentLoopError("CORRUPT_LEDGER", `ledger contains invalid JSON at line ${index + 1}`);
      }
      const migrated = migrateEventRecord(parsed).event;
      assertEventShape(migrated);
      if (migrated.project_id !== projectId) {
        throw new IntentLoopError("CORRUPT_LEDGER", `project mismatch at line ${index + 1}`);
      }
      if (migrated.prev_hash !== expectedPrevious) {
        throw new IntentLoopError("CORRUPT_LEDGER", `hash-chain predecessor mismatch at line ${index + 1}`);
      }
      if (eventHash(withoutHash(migrated)) !== migrated.event_hash) {
        throw new IntentLoopError("CORRUPT_LEDGER", `event hash mismatch at line ${index + 1}`);
      }
      expectedPrevious = migrated.event_hash;
      events.push(migrated);
    }
    return events;
  }

  private async quarantinePartial(projectDirectory: string, partial: string): Promise<void> {
    const quarantineDirectory = await this.internalDirectory(projectDirectory, "quarantine", true);
    if (quarantineDirectory === null) {
      throw new IntentLoopError("INVALID_DATA_DIR", "quarantine directory is unavailable");
    }
    const filePath = path.join(quarantineDirectory, `partial-${Date.now()}-${newId()}.json`);
    const summary = {
      observed_at: nowIso(),
      byte_length: Buffer.byteLength(partial, "utf8"),
      sha256: sha256(partial)
    };
    await writeFile(filePath, `${canonicalStringify(summary)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await syncFile(filePath);
  }

  private async replaceLedger(projectDirectory: string, body: string, purpose: string): Promise<void> {
    const ledgerPath = path.join(projectDirectory, "ledger.jsonl");
    await this.safeRegularFile(projectDirectory, ledgerPath, true);
    const temporary = path.join(projectDirectory, `ledger-${purpose}-${newId()}.tmp`);
    try {
      await writeFile(temporary, body, { encoding: "utf8", flag: "wx", mode: 0o600 });
      await syncFile(temporary);
      await rename(temporary, ledgerPath);
      await syncDirectory(projectDirectory);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  private async readUnlocked(projectId: string, projectDirectory: string, repairTrailing: boolean): Promise<LedgerEvent[]> {
    const ledgerPath = path.join(projectDirectory, "ledger.jsonl");
    const content = await this.readSafeFile(projectDirectory, ledgerPath, true);
    if (content.length === 0 || content.endsWith("\n")) return this.parseLedgerContent(content, projectId);
    if (!repairTrailing) {
      throw new IntentLoopError("CORRUPT_TRAILING_EVENT", "ledger has an incomplete trailing event", true);
    }
    const lastNewline = content.lastIndexOf("\n");
    const partial = content.slice(lastNewline + 1);
    const completeContent = lastNewline >= 0 ? content.slice(0, lastNewline + 1) : "";
    const verified = this.parseLedgerContent(completeContent, projectId);
    await this.quarantinePartial(projectDirectory, partial);
    await this.replaceLedger(projectDirectory, completeContent, "repair");
    return verified;
  }

  async readEvents(projectId: string): Promise<LedgerEvent[]> {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return [];
    return this.readUnlocked(projectId, projectDirectory, false);
  }

  private async appendUnlocked(
    projectId: string,
    projectDirectory: string,
    events: LedgerEvent[],
    input: NewEvent
  ): Promise<LedgerEvent> {
    const unsigned: Omit<LedgerEvent, "event_hash"> = {
      schema_version: SCHEMA_VERSION,
      event_id: input.event_id ?? newId(),
      event_type: input.event_type,
      project_id: projectId,
      task_id: input.task_id,
      occurred_at: input.occurred_at ?? nowIso(),
      actor: input.actor,
      request_id: input.request_id,
      payload: input.payload,
      prev_hash: events.at(-1)?.event_hash ?? null
    };
    const event: LedgerEvent = { ...unsigned, event_hash: eventHash(unsigned) };
    const body = `${[...events, event].map(canonicalStringify).join("\n")}\n`;
    await this.replaceLedger(projectDirectory, body, "append");
    return event;
  }

  async transactAppend(
    projectId: string,
    decide: (events: LedgerEvent[]) => NewEvent | null | Promise<NewEvent | null>,
    options: TransactAppendOptions = {}
  ): Promise<AppendTransactionResult> {
    return this.withLock(projectId, async (projectDirectory) => {
      const events = await this.readUnlocked(projectId, projectDirectory, true);
      const input = await decide([...events]);
      const guardedTaskId = options.private_recovery?.task_id ?? input?.task_id;
      const controls = guardedTaskId === undefined
        ? []
        : (await this.privateControlsUnlocked(projectDirectory, projectId))
          .filter((control) => control.task_id === guardedTaskId);
      const recovery = options.private_recovery;
      if (recovery === undefined) {
        if (controls.length > 0) {
          throw new IntentLoopError(
            "PRIVATE_SESSION_ACTIVE",
            "private semantic state is active or was lost with its process; explicitly re-enable durable mode or delete the task"
          );
        }
      } else {
        this.validateSessionHash(recovery.session_hash);
        if (recovery.task_id !== guardedTaskId) {
          throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "private recovery task does not match the mutation task");
        }
        const allControls = await this.privateControlsUnlocked(projectDirectory, projectId);
        const sessionOwner = allControls.find((control) => control.host_session_hash === recovery.session_hash);
        if (sessionOwner !== undefined && sessionOwner.task_id !== recovery.task_id) {
          throw new IntentLoopError("PRIVATE_SESSION_OWNED", "host session is already bound to another private task");
        }
        if (controls.some((control) => control.host_session_hash !== recovery.session_hash)) {
          throw new IntentLoopError("PRIVATE_TASK_OWNED", "task is already bound to another private host session");
        }
        if (recovery.require_control === true && sessionOwner?.task_id !== recovery.task_id) {
          throw new IntentLoopError("PRIVATE_CONTROL_MISSING", "private recovery control is missing or mismatched");
        }
      }
      const event = input === null ? null : await this.appendUnlocked(projectId, projectDirectory, events, input);
      const nextEvents = event === null ? events : [...events, event];
      if (recovery?.clear_after === true) {
        await this.clearPrivateSessionUnlocked(
          projectDirectory,
          projectId,
          recovery.session_hash,
          recovery.task_id
        );
      }
      return { events: nextEvents, event };
    });
  }

  async appendEvent(projectId: string, input: NewEvent): Promise<LedgerEvent> {
    const result = await this.transactAppend(projectId, () => input);
    if (result.event === null) throw new IntentLoopError("APPEND_ABORTED", "ledger append was aborted");
    return result.event;
  }

  private parsePrivateControl(body: string, projectId: string, expectedSessionHash?: string): PrivateSessionControl {
    try {
      const control = JSON.parse(body) as Partial<PrivateSessionControl>;
      if (
        control.schema_version === SCHEMA_VERSION &&
        control.project_id === projectId &&
        typeof control.host_session_hash === "string" &&
        SESSION_HASH_RE.test(control.host_session_hash) &&
        (expectedSessionHash === undefined || control.host_session_hash === expectedSessionHash) &&
        control.mode === "private" &&
        typeof control.task_id === "string" &&
        UUID_RE.test(control.task_id) &&
        typeof control.created_at === "string"
      ) return control as PrivateSessionControl;
    } catch {
      // Malformed controls fail closed below.
    }
    throw new IntentLoopError("CORRUPT_PRIVATE_CONTROL", "private-session control is malformed", true);
  }

  private async privateControlsUnlocked(
    projectDirectory: string,
    projectId: string
  ): Promise<PrivateSessionControl[]> {
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return [];
    const entries = await readdir(directory, { withFileTypes: true });
    const controls: PrivateSessionControl[] = [];
    for (const entry of entries) {
      if (!entry.name.endsWith(".json")) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new IntentLoopError("PATH_ESCAPE", "private-session controls must be regular files");
      }
      const sessionHash = entry.name.slice(0, -5);
      this.validateSessionHash(sessionHash);
      const filePath = path.join(directory, entry.name);
      const body = await this.readSafeFile(projectDirectory, filePath, false);
      controls.push(this.parsePrivateControl(body, projectId, sessionHash));
    }
    return controls;
  }

  private async clearPrivateSessionUnlocked(
    projectDirectory: string,
    projectId: string,
    sessionHash: string,
    expectedTaskId: string
  ): Promise<void> {
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return;
    const target = path.join(directory, `${sessionHash}.json`);
    const body = await this.readSafeFile(projectDirectory, target, true);
    if (body === "") return;
    const control = this.parsePrivateControl(body, projectId, sessionHash);
    if (control.task_id !== expectedTaskId) {
      throw new IntentLoopError("PRIVATE_SESSION_OWNED", "host session is owned by another private task");
    }
    await rm(target, { force: true });
    await syncDirectory(directory);
  }

  private async clearPrivateSessionsForTaskUnlocked(
    projectDirectory: string,
    projectId: string,
    taskId: string
  ): Promise<void> {
    const controls = await this.privateControlsUnlocked(projectDirectory, projectId);
    for (const control of controls) {
      if (control.task_id === taskId) {
        await this.clearPrivateSessionUnlocked(
          projectDirectory,
          projectId,
          control.host_session_hash,
          taskId
        );
      }
    }
  }

  async rewriteEvents(
    projectId: string,
    transform: (events: LedgerEvent[]) => LedgerEvent[],
    forbiddenMarkers: string[],
    options: { remove_private_task_id?: string } = {}
  ): Promise<{ remaining_events: number; scanned_files: number }> {
    return this.withLock(projectId, async (projectDirectory) => {
      const current = await this.readUnlocked(projectId, projectDirectory, true);
      const transformed = transform([...current]);
      let previous: string | null = null;
      const rechained = transformed.map((event) => {
        const unsigned: Omit<LedgerEvent, "event_hash"> = { ...withoutHash(event), prev_hash: previous };
        const next = { ...unsigned, event_hash: eventHash(unsigned) };
        previous = next.event_hash;
        return next;
      });
      const body = rechained.length === 0 ? "" : `${rechained.map(canonicalStringify).join("\n")}\n`;
      const verifiedBeforeReplace = this.parseLedgerContent(body, projectId);
      if (verifiedBeforeReplace.length !== rechained.length) {
        throw new IntentLoopError("DELETE_VERIFICATION_FAILED", "temporary ledger event count did not verify");
      }
      const leaked = forbiddenMarkers.find((marker) => body.includes(marker));
      if (leaked !== undefined) {
        throw new IntentLoopError("DELETE_VERIFICATION_FAILED", "temporary ledger still contains a target identifier");
      }
      await this.replaceLedger(projectDirectory, body, "rewrite");
      if (options.remove_private_task_id !== undefined) {
        await this.clearPrivateSessionsForTaskUnlocked(projectDirectory, projectId, options.remove_private_task_id);
      }
      await this.removeInternalDirectory(projectDirectory, "quarantine");
      const verified = await this.readUnlocked(projectId, projectDirectory, false);
      if (verified.length !== rechained.length) {
        throw new IntentLoopError("DELETE_VERIFICATION_FAILED", "rewritten ledger event count did not verify");
      }
      const scannedFiles = await this.assertMarkersAbsent(projectDirectory, forbiddenMarkers);
      return { remaining_events: verified.length, scanned_files: scannedFiles };
    });
  }

  private async assertMarkersAbsent(directory: string, markers: string[]): Promise<number> {
    if (markers.length === 0) return 0;
    let count = 0;
    const walk = async (current: string): Promise<void> => {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "ledger.lock" || entry.name.startsWith("ledger.lock.")) continue;
        const target = path.join(current, entry.name);
        const info = await lstat(target);
        if (info.isSymbolicLink()) {
          throw new IntentLoopError("PATH_ESCAPE", `${entry.name} must not be a symbolic link or junction`);
        }
        const actual = await realpath(target);
        if (!isWithin(directory, actual)) {
          throw new IntentLoopError("PATH_ESCAPE", `${entry.name} resolves outside project storage`);
        }
        if (info.isDirectory()) {
          await walk(target);
        } else if (info.isFile()) {
          if (info.nlink !== 1) {
            throw new IntentLoopError("UNSAFE_DATA_FILE", `${entry.name} has more than one filesystem link`);
          }
          count += 1;
          const text = (await readFile(target)).toString("utf8");
          if (markers.some((marker) => text.includes(marker))) {
            throw new IntentLoopError("DELETE_VERIFICATION_FAILED", `persistent target identifier remained in ${entry.name}`);
          }
        }
      }
    };
    await walk(directory);
    return count;
  }

  async activatePrivateSession(
    projectId: string,
    taskId: string,
    sessionHash: string,
    validate: (events: LedgerEvent[]) => void = () => undefined
  ): Promise<LedgerEvent[]> {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    if (!UUID_RE.test(taskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    return this.withLock(projectId, async (projectDirectory) => {
      const events = await this.readUnlocked(projectId, projectDirectory, true);
      validate([...events]);
      const existingControls = await this.privateControlsUnlocked(projectDirectory, projectId);
      const sessionOwner = existingControls.find((control) => control.host_session_hash === sessionHash);
      if (sessionOwner !== undefined && sessionOwner.task_id !== taskId) {
        throw new IntentLoopError("PRIVATE_SESSION_OWNED", "host session is already bound to another private task");
      }
      if (existingControls.some((control) => control.task_id === taskId && control.host_session_hash !== sessionHash)) {
        throw new IntentLoopError("PRIVATE_TASK_OWNED", "task is already bound to another private host session");
      }
      if (sessionOwner?.task_id === taskId) return events;
      const directory = await this.internalDirectory(projectDirectory, "private-sessions", true);
      if (directory === null) {
        throw new IntentLoopError("INVALID_DATA_DIR", "private-session directory is unavailable");
      }
      const target = path.join(directory, `${sessionHash}.json`);
      const temporary = `${target}.${newId()}.tmp`;
      const control: PrivateSessionControl = {
        schema_version: SCHEMA_VERSION,
        project_id: projectId,
        task_id: taskId,
        host_session_hash: sessionHash,
        mode: "private",
        created_at: nowIso()
      };
      try {
        await writeFile(temporary, `${canonicalStringify(control)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
        await syncFile(temporary);
        await rename(temporary, target);
        await syncDirectory(directory);
      } finally {
        await rm(temporary, { force: true });
      }
      return events;
    });
  }

  async privateSession(projectId: string, sessionHash: string): Promise<PrivateSessionControl | null> {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return null;
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return null;
    const body = await this.readSafeFile(projectDirectory, path.join(directory, `${sessionHash}.json`), true);
    return body === "" ? null : this.parsePrivateControl(body, projectId, sessionHash);
  }

  async privateSessionForTask(projectId: string, taskId: string): Promise<PrivateSessionControl | null> {
    this.validateProjectId(projectId);
    if (!UUID_RE.test(taskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return null;
    const matches = (await this.privateControlsUnlocked(projectDirectory, projectId))
      .filter((control) => control.task_id === taskId);
    if (matches.length > 1) {
      throw new IntentLoopError("PRIVATE_CONTROL_CONFLICT", "task has more than one private-session control", true);
    }
    return matches[0] ?? null;
  }

  async clearPrivateSession(projectId: string, sessionHash: string, expectedTaskId: string): Promise<void> {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    if (!UUID_RE.test(expectedTaskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    const existing = await this.existingProjectDirectory(projectId);
    if (existing === null) return;
    await this.withLock(projectId, async (projectDirectory) => {
      await this.clearPrivateSessionUnlocked(projectDirectory, projectId, sessionHash, expectedTaskId);
    });
  }

  async privateSessionCount(projectId: string): Promise<number> {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return 0;
    return (await this.privateControlsUnlocked(projectDirectory, projectId)).length;
  }

  async exists(projectId: string): Promise<boolean> {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return false;
    return this.safeRegularFile(projectDirectory, path.join(projectDirectory, "ledger.jsonl"), true);
  }
}

export function dataRootFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  entryPoint: string | undefined = process.argv[1]
): string {
  const explicit = environment.INTENT_LOOP_DATA_DIR?.trim();
  if (explicit) return path.resolve(explicit);
  const codexHome = environment.CODEX_HOME?.trim();
  if (codexHome) return path.resolve(codexHome, "plugin-data", "intent-loop", "v1");
  const pluginData = environment.PLUGIN_DATA?.trim();
  if (pluginData) return path.resolve(pluginData, "intent-loop", "v1");
  if (entryPoint !== undefined) {
    const resolvedEntry = path.resolve(entryPoint);
    const marker = `${path.sep}plugins${path.sep}cache${path.sep}`;
    const markerIndex = resolvedEntry.toLocaleLowerCase("en-US").indexOf(marker.toLocaleLowerCase("en-US"));
    if (markerIndex > 0) {
      const inferredCodexHome = resolvedEntry.slice(0, markerIndex);
      return path.resolve(inferredCodexHome, "plugin-data", "intent-loop", "v1");
    }
  }
  throw new IntentLoopError(
    "DATA_DIR_REQUIRED",
    "No safe Codex plugin data root is available; set INTENT_LOOP_DATA_DIR only for an explicit development or test run"
  );
}
