/*! Intent Loop 0.1.0-beta.2 | Apache-2.0 | See ../LICENSE and ../THIRD_PARTY_NOTICES.md */

// src/hook.ts
import { pathToFileURL } from "node:url";

// src/errors.ts
var IntentLoopError = class extends Error {
  code;
  retryable;
  constructor(code, message, retryable = false) {
    super(message);
    this.name = "IntentLoopError";
    this.code = code;
    this.retryable = retryable;
  }
};

// src/redaction.ts
var RULES = [
  { kind: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/giu },
  { kind: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]{12,}={0,2}\b/giu },
  { kind: "openai-key", pattern: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{16,}\b/gu },
  { kind: "github-token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu },
  { kind: "aws-key", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu },
  { kind: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu },
  {
    kind: "credential",
    pattern: /["'](?:password|passwd|secret|api[_-]?key|access[_-]?token)["']\s*:\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s,;"']+)/giu
  },
  {
    kind: "credential",
    pattern: /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^\s,;"']+)/giu
  },
  { kind: "high-entropy-token", pattern: /\b(?=[A-Za-z0-9_\/-]{32,}\b)(?=[A-Za-z0-9_\/-]*[A-Za-z])(?=[A-Za-z0-9_\/-]*\d)[A-Za-z0-9_\/-]{32,}\b/gu }
];
var CREDENTIAL_KEY = /^(?:password|passwd|secret|api[_-]?key|access[_-]?token)$/iu;
function applyRules(input, rules = RULES) {
  let text = input;
  let count = 0;
  const kinds = /* @__PURE__ */ new Set();
  for (const rule of rules) {
    text = text.replace(rule.pattern, () => {
      count += 1;
      kinds.add(rule.kind);
      return `[REDACTED:${rule.kind}]`;
    });
  }
  return { text, count, kinds: [...kinds].sort() };
}
function redactJson(input) {
  const trimmed = input.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  let count = 0;
  const kinds = /* @__PURE__ */ new Set();
  const visit = (value) => {
    if (typeof value === "string") {
      const result = applyRules(value, RULES.filter((rule) => rule.kind !== "credential"));
      count += result.count;
      for (const kind of result.kinds) kinds.add(kind);
      return result.text;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value !== null && typeof value === "object") {
      const output = {};
      for (const [key, child] of Object.entries(value)) {
        if (CREDENTIAL_KEY.test(key)) {
          output[key] = "[REDACTED:credential]";
          count += 1;
          kinds.add("credential");
        } else {
          output[key] = visit(child);
        }
      }
      return output;
    }
    return value;
  };
  return { text: JSON.stringify(visit(parsed)), count, kinds: [...kinds].sort() };
}
function redactText(input) {
  return redactJson(input) ?? applyRules(input);
}
function atomicStatement(input, maxLength = 500) {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new IntentLoopError("INVALID_STATEMENT", "statement must be non-empty");
  }
  if (input.length > 4e3) {
    throw new IntentLoopError("RAW_PROMPT_REJECTED", "statement is too long for an atomic intent claim");
  }
  if (/[\r\n]/u.test(input)) {
    throw new IntentLoopError("RAW_PROMPT_REJECTED", "an atomic intent claim must be a single line");
  }
  const result = redactText(input.trim());
  if (result.text.length > maxLength) {
    throw new IntentLoopError("INVALID_STATEMENT", `statement exceeds ${maxLength} characters after redaction`);
  }
  return result;
}
function minimalExcerpt(input) {
  if (input === void 0 || input.trim().length === 0) {
    return void 0;
  }
  const redacted = redactText(input.trim()).text.replace(/\s+/gu, " ");
  return redacted.length <= 160 ? redacted : `${redacted.slice(0, 159)}\u2026`;
}
function findKnownCredentialKinds(input) {
  return redactText(input).kinds.filter((kind) => kind !== "high-entropy-token");
}

// src/canonical.ts
import { createHash, randomUUID } from "node:crypto";
import { realpathSync, statSync } from "node:fs";
import path from "node:path";
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key]);
    }
    return sorted;
  }
  return value;
}
function canonicalStringify(value) {
  return JSON.stringify(sortValue(value));
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
function newId() {
  return randomUUID();
}
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function canonicalProjectRoot(projectRoot) {
  if (!projectRoot.trim()) {
    throw new Error("project_root must not be empty");
  }
  if (!path.isAbsolute(projectRoot)) {
    throw new Error("project_root must be an absolute local path");
  }
  if (process.platform === "win32" && (/^[\\/]{2}/u.test(projectRoot) || /^[\\/]\?\?[\\/]/u.test(projectRoot))) {
    throw new Error("project_root must not use a Windows UNC or device namespace");
  }
  const resolved = realpathSync.native(projectRoot);
  if (!statSync(resolved).isDirectory()) {
    throw new Error("project_root must resolve to an existing local directory");
  }
  return process.platform === "win32" ? resolved.toLocaleLowerCase("en-US") : resolved;
}
function projectIdForRoot(projectRoot) {
  return sha256(`intent-loop-project-v1\0${canonicalProjectRoot(projectRoot)}`);
}
function hostSessionHash(sessionId) {
  return sha256(`intent-loop-session-v1\0${sessionId}`);
}

// src/validation.ts
var UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
var SHA256_RE = /^[a-f0-9]{64}$/u;
var SOURCE_EVENT_ID_RE = /^[A-Za-z0-9_.:@-]{1,200}$/u;
function validateUuid(value, field) {
  if (!UUID_RE.test(value)) {
    throw new IntentLoopError("INVALID_ID", `${field} must be a UUID`);
  }
}
function validateRequestId(requestId) {
  if (!/^[A-Za-z0-9_.:@-]{1,200}$/u.test(requestId)) {
    throw new IntentLoopError("INVALID_REQUEST_ID", "request_id must be 1-200 opaque characters");
  }
  if (findKnownCredentialKinds(requestId).length > 0) {
    throw new IntentLoopError("SENSITIVE_ID_REJECTED", "request_id must not contain a credential or access token");
  }
}
function validSourceEventId(value) {
  return SOURCE_EVENT_ID_RE.test(value) && findKnownCredentialKinds(value).length === 0;
}
function normalizeSourceRef(source, allowedKinds) {
  if (allowedKinds !== void 0 && !allowedKinds.includes(source.kind)) {
    throw new IntentLoopError("INVALID_SOURCE", `source kind ${source.kind} is not allowed for this operation`);
  }
  if (source.event_id === void 0 && source.sha256 === void 0) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref requires event_id or sha256");
  }
  if (source.event_id !== void 0 && !SOURCE_EVENT_ID_RE.test(source.event_id)) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref.event_id must be an opaque ID, not a path or free text");
  }
  if (source.event_id !== void 0 && findKnownCredentialKinds(source.event_id).length > 0) {
    throw new IntentLoopError("SENSITIVE_ID_REJECTED", "source_ref.event_id must not contain a credential or access token");
  }
  if (source.sha256 !== void 0 && !SHA256_RE.test(source.sha256)) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref.sha256 must be a lowercase SHA-256 value");
  }
  const normalized = { kind: source.kind };
  if (source.event_id !== void 0) normalized.event_id = source.event_id;
  if (source.sha256 !== void 0) normalized.sha256 = source.sha256;
  const excerpt = minimalExcerpt(source.excerpt);
  if (excerpt !== void 0) normalized.excerpt = excerpt;
  return normalized;
}
function cloneClaim(claim) {
  return JSON.parse(JSON.stringify(claim));
}
function sanitizeLabel(label) {
  if (label === void 0 || label.trim() === "") return null;
  const redacted = redactText(label.trim()).text;
  if (redacted.length > 120 || /[\r\n]/u.test(redacted)) {
    throw new IntentLoopError("INVALID_LABEL", "task label must be one redacted line of at most 120 characters");
  }
  return redacted;
}
function requireTaskStarted(state) {
  if (state.started_at === null) {
    throw new IntentLoopError("TASK_NOT_FOUND", "task is not associated with this project");
  }
}
function normalizeFacets(facets, status) {
  const unique = [...new Set(facets)];
  if (unique.length === 0) {
    throw new IntentLoopError("INVALID_FACETS", "at least one intent facet is required");
  }
  if (status === "unknown" && !unique.includes("unknown")) unique.push("unknown");
  if (status === "disputed" && !unique.includes("disagreement")) unique.push("disagreement");
  return unique;
}
function confirmationTimestamp() {
  return nowIso();
}

// src/projection.ts
var LONG_TERM_STALE_MS = 90 * 24 * 60 * 60 * 1e3;
function buildEmptyState(projectId, taskId) {
  return {
    project_id: projectId,
    task_id: taskId,
    mode: "on",
    label: null,
    host_session_hash: null,
    claims: [],
    invalidated_claim_ids: /* @__PURE__ */ new Set(),
    candidates: [],
    started_at: null,
    last_event_at: null
  };
}
function projectTask(events, projectId, taskId) {
  const state = buildEmptyState(projectId, taskId);
  const claims = /* @__PURE__ */ new Map();
  for (const event of events) {
    if (event.task_id !== taskId) continue;
    state.last_event_at = event.occurred_at;
    if (event.event_type === "task_started") {
      state.started_at = event.occurred_at;
      const mode = event.payload.mode;
      if (mode === "on" || mode === "private" || mode === "off") state.mode = mode;
      state.label = typeof event.payload.label === "string" ? event.payload.label : null;
      state.host_session_hash = typeof event.payload.host_session_hash === "string" ? event.payload.host_session_hash : null;
      if (Array.isArray(event.payload.initial_claims)) {
        for (const item of event.payload.initial_claims) {
          const claim = item;
          if (claim !== null && typeof claim === "object" && typeof claim.claim_id === "string") {
            claims.set(claim.claim_id, cloneClaim(claim));
          }
        }
      }
    } else if (event.event_type === "mode_set") {
      const mode = event.payload.mode;
      if (mode === "on" || mode === "private" || mode === "off") state.mode = mode;
      if ("host_session_hash" in event.payload) {
        state.host_session_hash = typeof event.payload.host_session_hash === "string" ? event.payload.host_session_hash : null;
      }
    } else if (event.event_type === "claim_added" || event.event_type === "claim_replaced") {
      const claim = event.payload.claim;
      if (claim !== void 0 && typeof claim.claim_id === "string") claims.set(claim.claim_id, cloneClaim(claim));
    } else if (event.event_type === "claim_invalidated") {
      const claimId = event.payload.claim_id;
      if (typeof claimId === "string") state.invalidated_claim_ids.add(claimId);
    } else if (event.event_type === "candidate_added" || event.event_type === "source_observed" || event.event_type === "result_signal_observed" || event.event_type === "compaction_observed") {
      const candidate = event.payload.candidate;
      if (candidate !== void 0 && typeof candidate.candidate_id === "string") {
        state.candidates.push(JSON.parse(JSON.stringify(candidate)));
      }
    } else if (event.event_type === "graph_imported") {
      if (Array.isArray(event.payload.claims)) {
        for (const item of event.payload.claims) {
          const claim = item;
          if (claim !== null && typeof claim === "object" && typeof claim.claim_id === "string") {
            claims.set(claim.claim_id, cloneClaim(claim));
          }
        }
      }
      if (Array.isArray(event.payload.invalidated_claim_ids)) {
        for (const claimId of event.payload.invalidated_claim_ids) {
          if (typeof claimId === "string") state.invalidated_claim_ids.add(claimId);
        }
      }
      if (Array.isArray(event.payload.candidates)) {
        for (const item of event.payload.candidates) {
          const candidate = item;
          if (candidate !== null && typeof candidate === "object" && typeof candidate.candidate_id === "string") {
            state.candidates.push(JSON.parse(JSON.stringify(candidate)));
          }
        }
      }
    }
  }
  state.claims = [...claims.values()];
  return state;
}
function activeClaims(state) {
  const superseded = new Set(state.claims.flatMap((claim) => claim.supersedes));
  return state.claims.filter(
    (claim) => !state.invalidated_claim_ids.has(claim.claim_id) && !superseded.has(claim.claim_id)
  );
}
function claimPriority(claim) {
  if (claim.role === "user" && claim.epistemic_status === "explicit" && (claim.facets.includes("outcome") || claim.facets.includes("hard_constraint"))) return 0;
  if (claim.epistemic_status === "disputed") return 1;
  if (claim.epistemic_status === "unknown") return 2;
  if (claim.epistemic_status === "explicit") return 3;
  if (claim.epistemic_status === "evidence") return 4;
  return 5;
}
function isStaleLongTerm(claim, at = Date.now()) {
  if (claim.scope !== "long_term" || claim.epistemic_status !== "inferred") return false;
  const confirmed = claim.last_confirmed === null ? Date.parse(claim.valid_from) : Date.parse(claim.last_confirmed);
  return !Number.isFinite(confirmed) || at - confirmed > LONG_TERM_STALE_MS;
}
function compactSnapshot(claims, maxCharacters) {
  const sorted = [...claims].sort((left, right) => {
    const priority = claimPriority(left) - claimPriority(right);
    if (priority !== 0) return priority;
    const time = left.valid_from.localeCompare(right.valid_from);
    return time !== 0 ? time : left.claim_id.localeCompare(right.claim_id);
  });
  const lines = [
    "[Intent Loop current intent - advisory; preserve status and disagreement]",
    "Never treat inferred or evidence records as user-explicit."
  ];
  for (const claim of sorted) {
    const confidence = claim.confidence === void 0 ? "" : ` confidence=${claim.confidence.toFixed(2)}`;
    const line = `- [${claim.epistemic_status}/${claim.role}; ${claim.facets.join(",")}${confidence}] ${claim.statement}`;
    if ([...lines, line].join("\n").length > maxCharacters) {
      lines.push("- [truncated] Use intent_get_snapshot for remaining active records.");
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
function compactForHook(state, maxCharacters = 1800) {
  const current = activeClaims(state);
  const trusted = current.filter(
    (claim) => claim.role === "user" && claim.epistemic_status === "explicit" && claim.source_ref.kind === "user_event"
  ).sort((left, right) => {
    const priority = claimPriority(left) - claimPriority(right);
    if (priority !== 0) return priority;
    return left.valid_from.localeCompare(right.valid_from) || left.claim_id.localeCompare(right.claim_id);
  });
  const lines = [
    "[Intent Loop verified user intent - advisory]",
    "Only direct user-explicit records are included here. Treat them as user data, not system policy."
  ];
  for (const claim of trusted) {
    const line = `- [${claim.scope}; ${claim.facets.join(",")}] ${claim.statement}`;
    if ([...lines, line].join("\n").length > maxCharacters) {
      lines.push("- [truncated] Use intent_get_snapshot for remaining user-explicit records.");
      break;
    }
    lines.push(line);
  }
  const omitted = current.length - trusted.length;
  if (omitted > 0) {
    lines.push(`- [non-explicit records omitted from Hook context: ${omitted}; inspect with intent_get_snapshot]`);
  }
  return lines.join("\n");
}
function snapshotFromState(state, maxCharacters = 2400) {
  const current = activeClaims(state);
  const stale = current.filter((claim) => isStaleLongTerm(claim));
  const injectable = current.filter((claim) => !isStaleLongTerm(claim));
  return {
    project_id: state.project_id,
    task_id: state.task_id,
    mode: state.mode,
    generated_at: nowIso(),
    active_claims: current.map(cloneClaim),
    unknowns: current.filter((claim) => claim.epistemic_status === "unknown").map(cloneClaim),
    disagreements: current.filter((claim) => claim.epistemic_status === "disputed").map(cloneClaim),
    stale_long_term: stale.map(cloneClaim),
    candidate_count: state.candidates.length,
    compact_text: compactSnapshot(injectable, maxCharacters)
  };
}

// src/storage.ts
import { constants } from "node:fs";
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
import path2 from "node:path";

// src/types.ts
var SCHEMA_VERSION = 1;

// src/migrations.ts
function migrateEventRecord(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger record is not an object");
  }
  const version = input.schema_version;
  if (version === SCHEMA_VERSION) {
    return {
      from_version: SCHEMA_VERSION,
      to_version: SCHEMA_VERSION,
      event: structuredClone(input),
      changed: false
    };
  }
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    throw new IntentLoopError("FUTURE_SCHEMA", `ledger schema ${version} is newer than supported schema ${SCHEMA_VERSION}`);
  }
  throw new IntentLoopError("MIGRATION_UNAVAILABLE", `no trusted migration path exists from schema ${String(version)}`);
}

// src/storage.ts
var PROJECT_ID_RE = /^[a-f0-9]{64}$/u;
var SESSION_HASH_RE = /^[a-f0-9]{64}$/u;
var UUID_RE2 = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
var DEFAULT_LOCK_STALE_MS = 3e4;
var DEFAULT_LOCK_WAIT_MS = 5e3;
var DEFAULT_LOCK_HEARTBEAT_MS = 1e4;
var TRANSIENT_LOCK_RACE_CODES = /* @__PURE__ */ new Set(["EBADF", "ENOENT", "ENOTDIR"]);
function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
function withoutHash(event) {
  const { event_hash: _eventHash, ...unsigned } = event;
  return unsigned;
}
function eventHash(event) {
  return sha256(canonicalStringify(event));
}
function assertEventShape(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger line must be a JSON object");
  }
  const event = value;
  if (event.schema_version !== SCHEMA_VERSION || typeof event.event_id !== "string" || typeof event.event_type !== "string" || typeof event.project_id !== "string" || typeof event.task_id !== "string" || typeof event.occurred_at !== "string" || typeof event.actor !== "string" || typeof event.request_id !== "string" || event.payload === null || typeof event.payload !== "object" || Array.isArray(event.payload) || event.prev_hash !== null && typeof event.prev_hash !== "string" || typeof event.event_hash !== "string") {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger event has an invalid schema");
  }
}
function isWithin(parent, child) {
  const relative = path2.relative(parent, child);
  return relative === "" || !relative.startsWith("..") && !path2.isAbsolute(relative);
}
function errorCode(error) {
  return error instanceof Error && "code" in error ? String(error.code) : "";
}
function lockDirectorySnapshot(info) {
  return {
    dev: info.dev,
    ino: info.ino,
    birthtime_ns: info.birthtimeNs,
    ctime_ns: info.ctimeNs,
    mtime_ns: info.mtimeNs,
    size: info.size
  };
}
function sameLockMarkerFile(left, right) {
  return sameLockGeneration(left, right) && left.ctime_ns === right.ctime_ns && left.mtime_ns === right.mtime_ns && left.size === right.size;
}
function sameLockGeneration(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.birthtime_ns === right.birthtime_ns;
}
async function syncFile(filePath) {
  const handle = await open(filePath, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncDirectory(directory) {
  try {
    const handle = await open(directory, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!(/* @__PURE__ */ new Set(["EINVAL", "EPERM", "EISDIR", "EBADF"])).has(errorCode(error))) throw error;
  }
}
async function restrictDirectory(directory) {
  try {
    await chmod(directory, 448);
  } catch (error) {
    if (!(/* @__PURE__ */ new Set(["EPERM", "ENOSYS", "EINVAL"])).has(errorCode(error))) throw error;
  }
}
function parseLockOwner(value) {
  try {
    const parsed = JSON.parse(value);
    if (Number.isInteger(parsed.pid) && Number(parsed.pid) > 0 && typeof parsed.token === "string" && UUID_RE2.test(parsed.token) && typeof parsed.acquired_at === "string") {
      return { pid: Number(parsed.pid), token: parsed.token, acquired_at: parsed.acquired_at };
    }
  } catch {
  }
  return null;
}
function processIsAlive(pid) {
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
var LedgerStore = class {
  dataRoot;
  initializedRoot = null;
  lockStaleMs;
  lockWaitMs;
  lockHeartbeatMs;
  constructor(dataRoot, options = {}) {
    if (!dataRoot.trim()) {
      throw new IntentLoopError("DATA_DIR_REQUIRED", "Intent Loop requires PLUGIN_DATA or INTENT_LOOP_DATA_DIR");
    }
    this.dataRoot = path2.resolve(dataRoot);
    this.lockStaleMs = options.lock_stale_ms ?? DEFAULT_LOCK_STALE_MS;
    this.lockWaitMs = options.lock_wait_ms ?? DEFAULT_LOCK_WAIT_MS;
    this.lockHeartbeatMs = options.lock_heartbeat_ms ?? DEFAULT_LOCK_HEARTBEAT_MS;
  }
  validateProjectId(projectId) {
    if (!PROJECT_ID_RE.test(projectId)) {
      throw new IntentLoopError("INVALID_PROJECT_ID", "project_id must be a lowercase SHA-256 value");
    }
  }
  validateSessionHash(sessionHash) {
    if (!SESSION_HASH_RE.test(sessionHash)) {
      throw new IntentLoopError("INVALID_SESSION_HASH", "host session hash must be a lowercase SHA-256 value");
    }
  }
  async root() {
    if (this.initializedRoot !== null) return this.initializedRoot;
    await mkdir(this.dataRoot, { recursive: true, mode: 448 });
    this.initializedRoot = await realpath(this.dataRoot);
    await restrictDirectory(this.initializedRoot);
    return this.initializedRoot;
  }
  async existingRoot() {
    if (this.initializedRoot !== null) return this.initializedRoot;
    try {
      this.initializedRoot = await realpath(this.dataRoot);
      return this.initializedRoot;
    } catch (error) {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    }
  }
  async projectsDirectory(create) {
    const root = create ? await this.root() : await this.existingRoot();
    if (root === null) return null;
    const candidate = path2.join(root, "projects");
    let actual;
    try {
      actual = await realpath(candidate);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      if (!create) return null;
      await mkdir(candidate, { mode: 448 }).catch((mkdirError) => {
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
  async projectDirectory(projectId) {
    this.validateProjectId(projectId);
    const projects = await this.projectsDirectory(true);
    if (projects === null) throw new IntentLoopError("DATA_DIR_REQUIRED", "projects directory is unavailable");
    const candidate = path2.join(projects, projectId);
    let actual;
    try {
      actual = await realpath(candidate);
    } catch (error) {
      if (errorCode(error) !== "ENOENT") throw error;
      await mkdir(candidate, { mode: 448 }).catch((mkdirError) => {
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
  async existingProjectDirectory(projectId) {
    this.validateProjectId(projectId);
    const projects = await this.projectsDirectory(false);
    if (projects === null) return null;
    const candidate = path2.join(projects, projectId);
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
  dataDirectoryPath(projectId) {
    this.validateProjectId(projectId);
    return path2.resolve(this.dataRoot, "projects", projectId);
  }
  async ledgerPath(projectId) {
    return path2.join(await this.projectDirectory(projectId), "ledger.jsonl");
  }
  async internalDirectory(projectDirectory, name, create) {
    const candidate = path2.join(projectDirectory, name);
    let info = await lstat(candidate).catch((error) => {
      if (errorCode(error) === "ENOENT") return null;
      throw error;
    });
    if (info === null) {
      if (!create) return null;
      await mkdir(candidate, { mode: 448 }).catch((error) => {
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
    const actual = await realpath(candidate).catch((error) => {
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
  async safeRegularFile(projectDirectory, filePath, allowMissing) {
    const info = await lstat(filePath).catch((error) => {
      if (allowMissing && errorCode(error) === "ENOENT") return null;
      throw error;
    });
    if (info === null) return false;
    if (info.isSymbolicLink()) {
      throw new IntentLoopError("PATH_ESCAPE", `${path2.basename(filePath)} must not be a symbolic link`);
    }
    if (!info.isFile() || info.nlink !== 1) {
      throw new IntentLoopError(
        "UNSAFE_DATA_FILE",
        `${path2.basename(filePath)} must be a regular file with exactly one filesystem link`
      );
    }
    const actual = await realpath(filePath).catch((error) => {
      if (allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (actual === null) return false;
    if (!isWithin(projectDirectory, actual)) {
      throw new IntentLoopError("PATH_ESCAPE", `${path2.basename(filePath)} resolves outside project storage`);
    }
    return true;
  }
  async readSafeFile(projectDirectory, filePath, allowMissing) {
    if (!await this.safeRegularFile(projectDirectory, filePath, allowMissing)) return "";
    const noFollow = typeof constants.O_NOFOLLOW === "number" ? constants.O_NOFOLLOW : 0;
    let handle;
    try {
      handle = await open(filePath, constants.O_RDONLY | noFollow);
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1) {
        throw new IntentLoopError(
          allowMissing ? "TRANSIENT_FILE_RACE" : "UNSAFE_DATA_FILE",
          `${path2.basename(filePath)} changed while it was being opened`,
          allowMissing
        );
      }
      return await handle.readFile({ encoding: "utf8" });
    } catch (error) {
      if (allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return "";
      throw error;
    } finally {
      if (handle !== void 0) {
        await handle.close().catch((error) => {
          if (!(allowMissing && TRANSIENT_LOCK_RACE_CODES.has(errorCode(error)))) throw error;
        });
      }
    }
  }
  async observeLockDirectory(lockDirectory) {
    const info = await lstat(lockDirectory, { bigint: true }).catch((error) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (info === null) return null;
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new IntentLoopError("PATH_ESCAPE", "ledger.lock must be a real directory");
    }
    return lockDirectorySnapshot(info);
  }
  async observeLockMarkerFile(markerPath) {
    const info = await lstat(markerPath, { bigint: true }).catch((error) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    if (info === null) return null;
    if (info.isSymbolicLink()) {
      throw new IntentLoopError("PATH_ESCAPE", `${path2.basename(markerPath)} must not be a symbolic link`);
    }
    if (!info.isFile() || info.nlink !== 1n) {
      throw new IntentLoopError(
        "UNSAFE_DATA_FILE",
        `${path2.basename(markerPath)} must be a regular file with exactly one filesystem link`
      );
    }
    return lockDirectorySnapshot(info);
  }
  async observeLockMarker(projectDirectory, filePath) {
    let handle;
    try {
      const initial = await lstat(filePath).catch((error) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      });
      if (initial === null) return { owner: null, state: "missing" };
      if (initial.isSymbolicLink()) {
        throw new IntentLoopError("PATH_ESCAPE", `${path2.basename(filePath)} must not be a symbolic link`);
      }
      if (!initial.isFile() || initial.nlink !== 1) {
        throw new IntentLoopError(
          "UNSAFE_DATA_FILE",
          `${path2.basename(filePath)} must be a regular file with exactly one filesystem link`
        );
      }
      const actual = await realpath(filePath);
      if (!isWithin(projectDirectory, actual)) {
        throw new IntentLoopError("PATH_ESCAPE", `${path2.basename(filePath)} resolves outside project storage`);
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
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error)) || error instanceof IntentLoopError && error.code === "TRANSIENT_FILE_RACE") {
        return { owner: null, state: "raced" };
      }
      throw error;
    } finally {
      if (handle !== void 0) {
        await handle.close().catch((error) => {
          if (!TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) throw error;
        });
      }
    }
  }
  async removeOwnedLockMarker(projectDirectory, markerPath, token) {
    const observation = await this.observeLockMarker(projectDirectory, markerPath);
    if (observation.state === "present" && observation.owner?.token === token) {
      await rm(markerPath, { force: true }).catch(() => void 0);
    }
  }
  async removeInvalidLockMarker(projectDirectory, lockDirectory, expectedGeneration, markerPath, requireStale) {
    const initialMarker = await this.observeLockMarkerFile(markerPath);
    if (initialMarker === null) return false;
    if (requireStale && Date.now() - Number(initialMarker.mtime_ns / 1000000n) <= this.lockStaleMs) {
      return false;
    }
    const observation = await this.observeLockMarker(projectDirectory, markerPath);
    const generation = await this.observeLockDirectory(lockDirectory);
    const confirmedMarker = await this.observeLockMarkerFile(markerPath);
    if (observation.state !== "invalid" || generation === null || !sameLockGeneration(expectedGeneration, generation) || confirmedMarker === null || !sameLockMarkerFile(initialMarker, confirmedMarker)) {
      return false;
    }
    await rm(markerPath, { force: true });
    return true;
  }
  async pauseForLockTransition() {
    await delay(40 + process.pid % 60);
  }
  async pauseForLockRetry() {
    await delay(10 + process.pid % 41);
  }
  async reclaimedLockDirectoryDisappeared(reclaimed) {
    const started = Date.now();
    while (true) {
      const info = await lstat(reclaimed).catch((error) => {
        if ((/* @__PURE__ */ new Set(["ENOENT", "ENOTDIR"])).has(errorCode(error))) return null;
        throw error;
      });
      if (info === null) return true;
      if (info.isSymbolicLink() || !info.isDirectory()) return false;
      if (Date.now() - started >= this.lockWaitMs) return false;
      await this.pauseForLockTransition();
    }
  }
  async removeInternalDirectory(projectDirectory, name) {
    const directory = await this.internalDirectory(projectDirectory, name, false);
    if (directory !== null) await rm(directory, { recursive: true, force: true });
  }
  async cleanupOrphanTempsUnlocked(projectDirectory) {
    const ledgerTemp = /^ledger-(?:append|repair|rewrite)-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.tmp$/iu;
    const renamedLock = /^ledger\.lock\.(?:stale-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}|release-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/iu;
    const projectEntries = await readdir(projectDirectory, { withFileTypes: true });
    let changed = false;
    for (const entry of projectEntries) {
      if (renamedLock.test(entry.name)) {
        const target2 = path2.join(projectDirectory, entry.name);
        const info2 = await lstat(target2).catch((error) => {
          if (errorCode(error) === "ENOENT") return null;
          throw error;
        });
        if (info2 === null) continue;
        if (info2.isSymbolicLink() || !info2.isDirectory()) {
          throw new IntentLoopError("PATH_ESCAPE", "orphan renamed lock path is not a real directory");
        }
        const actual = await realpath(target2).catch((error) => {
          if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
          throw error;
        });
        if (actual === null) continue;
        if (!isWithin(projectDirectory, actual)) {
          throw new IntentLoopError("PATH_ESCAPE", "orphan renamed lock resolves outside project storage");
        }
        await rm(target2, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
        changed = true;
        continue;
      }
      if (!ledgerTemp.test(entry.name)) continue;
      const target = path2.join(projectDirectory, entry.name);
      const info = await lstat(target).catch((error) => {
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
        const target = path2.join(privateDirectory, entry.name);
        const info = await lstat(target).catch((error) => {
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
  async tryReclaimStaleLock(projectDirectory, lockDirectory, reclaimToken) {
    if (await this.internalDirectory(projectDirectory, "ledger.lock", false) === null) return false;
    const initialGeneration = await this.observeLockDirectory(lockDirectory);
    if (initialGeneration === null) return false;
    const ownerPath = path2.join(lockDirectory, "owner.json");
    const releasePath = path2.join(lockDirectory, "release.json");
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
    const reclaimPath = path2.join(lockDirectory, "reclaim.json");
    const reclaimerObservation = await this.observeLockMarker(projectDirectory, reclaimPath);
    if (reclaimerObservation.state === "raced") {
      await this.pauseForLockTransition();
      return false;
    }
    const knownReclaimer = reclaimerObservation.owner;
    if (knownReclaimer !== null && (knownReclaimer.pid !== process.pid || knownReclaimer.token !== reclaimToken) && processIsAlive(knownReclaimer.pid)) {
      await this.pauseForLockTransition();
      return false;
    }
    const ownerStat = await stat(ownerPath).catch((error) => {
      if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return null;
      throw error;
    });
    const ownerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
    if (ownerObservation.state === "raced") {
      await this.pauseForLockTransition();
      return false;
    }
    const observedGeneration = await this.observeLockDirectory(lockDirectory);
    if (observedGeneration === null || !sameLockGeneration(initialGeneration, observedGeneration)) {
      await this.pauseForLockTransition();
      return false;
    }
    const observedAt = ownerStat?.mtimeMs ?? Number(observedGeneration.mtime_ns / 1000000n);
    if (Date.now() - observedAt <= this.lockStaleMs) return false;
    const observed = ownerObservation.owner;
    if (observed !== null && processIsAlive(observed.pid)) return false;
    const reclaimOwner = { pid: process.pid, token: reclaimToken, acquired_at: nowIso() };
    let ownsReclaim = false;
    if (knownReclaimer?.pid === process.pid && knownReclaimer.token === reclaimToken) {
      ownsReclaim = true;
    } else {
      try {
        await writeFile(reclaimPath, `${JSON.stringify(reclaimOwner)}
`, {
          encoding: "utf8",
          flag: "wx",
          mode: 384
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
          const reclaimStat = await stat(reclaimPath).catch((statError) => {
            if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(statError))) return null;
            throw statError;
          });
          if (reclaimStat === null || Date.now() - reclaimStat.mtimeMs <= this.lockStaleMs) return false;
          const cleanupGeneration = await this.observeLockDirectory(lockDirectory);
          if (cleanupGeneration !== null && sameLockGeneration(initialGeneration, cleanupGeneration)) {
            await this.removeOwnedLockMarker(projectDirectory, reclaimPath, existingReclaimer.token);
          }
          await this.pauseForLockTransition();
          return false;
        }
      }
    }
    const claimedGeneration = await this.observeLockDirectory(lockDirectory);
    if (claimedGeneration === null || !sameLockGeneration(initialGeneration, claimedGeneration)) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      await this.pauseForLockTransition();
      return false;
    }
    const confirmedOwnerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
    const confirmedReclaimerObservation = await this.observeLockMarker(projectDirectory, reclaimPath);
    if (confirmedOwnerObservation.state === "raced" || confirmedReclaimerObservation.state === "raced") {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      await this.pauseForLockTransition();
      return false;
    }
    const confirmedOwner = confirmedOwnerObservation.owner;
    const confirmedReclaimer = confirmedReclaimerObservation.owner;
    if ((observed?.token ?? null) !== (confirmedOwner?.token ?? null) || confirmedReclaimer?.pid !== process.pid || confirmedReclaimer.token !== reclaimToken || confirmedOwner !== null && processIsAlive(confirmedOwner.pid)) {
      if (ownsReclaim) {
        await this.removeOwnedLockMarker(projectDirectory, reclaimPath, reclaimToken);
      }
      return false;
    }
    const renameGeneration = await this.observeLockDirectory(lockDirectory);
    if (renameGeneration === null || !sameLockGeneration(initialGeneration, renameGeneration)) {
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
      if ((/* @__PURE__ */ new Set(["ENOENT", "EEXIST", "EPERM", "EACCES"])).has(errorCode(error))) return false;
      throw error;
    }
    const movedGeneration = await this.observeLockDirectory(reclaimed);
    const movedOwnerObservation = await this.observeLockMarker(
      projectDirectory,
      path2.join(reclaimed, "owner.json")
    );
    const movedReclaimerObservation = await this.observeLockMarker(
      projectDirectory,
      path2.join(reclaimed, "reclaim.json")
    );
    const movedOwner = movedOwnerObservation.owner;
    const movedReclaimer = movedReclaimerObservation.owner;
    const movedIdentityUnavailable = movedGeneration === null || !sameLockGeneration(initialGeneration, movedGeneration) || movedOwnerObservation.state === "raced" || movedReclaimerObservation.state === "raced" || observed !== null && movedOwner === null || movedReclaimer === null;
    if (movedIdentityUnavailable && await this.reclaimedLockDirectoryDisappeared(reclaimed)) {
      return true;
    }
    if (movedGeneration === null || !sameLockGeneration(initialGeneration, movedGeneration) || movedOwnerObservation.state === "raced" || movedReclaimerObservation.state === "raced") {
      throw new IntentLoopError("LOCK_COMPROMISED", "stale-lock identity raced during reclamation", true);
    }
    if ((observed?.token ?? null) !== (movedOwner?.token ?? null) || movedReclaimer?.pid !== process.pid || movedReclaimer.token !== reclaimToken) {
      throw new IntentLoopError("LOCK_COMPROMISED", "stale-lock identity changed during reclamation", true);
    }
    await rm(reclaimed, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
    return true;
  }
  async releaseOwnedLock(projectDirectory, lockDirectory, token) {
    const existing = await this.internalDirectory(projectDirectory, "ledger.lock", false);
    if (existing === null) return;
    const initialGeneration = await this.observeLockDirectory(lockDirectory);
    if (initialGeneration === null) return;
    const ownerPath = path2.join(lockDirectory, "owner.json");
    const releasePath = path2.join(lockDirectory, "release.json");
    const releaseOwner = { pid: process.pid, token, acquired_at: nowIso() };
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
        await writeFile(releasePath, `${JSON.stringify(releaseOwner)}
`, {
          encoding: "utf8",
          flag: "wx",
          mode: 384
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
        if (await this.removeInvalidLockMarker(
          projectDirectory,
          lockDirectory,
          initialGeneration,
          releasePath,
          false
        )) {
          continue;
        }
        return;
      }
      if (releaseObservation.owner?.token !== token) return;
      const releaseGeneration = await this.observeLockDirectory(lockDirectory);
      if (releaseGeneration === null || !sameLockGeneration(initialGeneration, releaseGeneration)) {
        return;
      }
      try {
        await rename(lockDirectory, released);
        break;
      } catch (error) {
        if (TRANSIENT_LOCK_RACE_CODES.has(errorCode(error))) return;
        if (!(/* @__PURE__ */ new Set(["EPERM", "EACCES"])).has(errorCode(error))) throw error;
        if (Date.now() - started > this.lockWaitMs) {
          throw new IntentLoopError("LOCK_RELEASE_TIMEOUT", "timed out releasing the project ledger lock", true);
        }
        await delay(25);
      }
    }
    await rm(released, { recursive: true, force: true, maxRetries: 200, retryDelay: 25 });
  }
  async withLock(projectId, action) {
    const projectDirectory = await this.projectDirectory(projectId);
    const lockDirectory = path2.join(projectDirectory, "ledger.lock");
    const ownerPath = path2.join(lockDirectory, "owner.json");
    const token = newId();
    const reclaimToken = newId();
    const absoluteStarted = Date.now();
    let lastProgressAt = absoluteStarted;
    let lastOwnerToken = null;
    const absoluteWaitMs = Math.max(this.lockWaitMs * 6, 3e4);
    while (true) {
      if (Date.now() - absoluteStarted > absoluteWaitMs) {
        throw new IntentLoopError("LOCK_TIMEOUT", "timed out waiting for the project ledger lock", true);
      }
      try {
        await mkdir(lockDirectory, { mode: 448 });
      } catch (error) {
        if (errorCode(error) !== "EEXIST") throw error;
        try {
          const ownerGeneration = await this.observeLockDirectory(lockDirectory);
          const ownerObservation = await this.observeLockMarker(projectDirectory, ownerPath);
          const confirmedOwnerGeneration = await this.observeLockDirectory(lockDirectory);
          if (ownerGeneration !== null && confirmedOwnerGeneration !== null && sameLockGeneration(ownerGeneration, confirmedOwnerGeneration) && ownerObservation.state === "present" && ownerObservation.owner?.pid === process.pid && ownerObservation.owner.token === token) {
            break;
          }
          if (ownerObservation.state === "raced") {
            lastProgressAt = Date.now();
          } else if (ownerObservation.owner !== null && ownerObservation.owner.token !== lastOwnerToken) {
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
          `${JSON.stringify({ pid: process.pid, token, acquired_at: nowIso() })}
`,
          { encoding: "utf8", flag: "wx", mode: 384 }
        );
      } catch (error) {
        if ((/* @__PURE__ */ new Set(["ENOENT", "ENOTDIR", "EEXIST"])).has(errorCode(error))) {
          lastProgressAt = Date.now();
          await this.pauseForLockRetry();
          continue;
        }
        throw error;
      }
      const publishedGeneration = await this.observeLockDirectory(lockDirectory);
      const publishedOwner = await this.observeLockMarker(projectDirectory, ownerPath);
      if (publishedGeneration !== null && sameLockGeneration(createdGeneration, publishedGeneration) && publishedOwner.state === "present" && publishedOwner.owner?.pid === process.pid && publishedOwner.owner.token === token) {
        break;
      }
      lastProgressAt = Date.now();
      await this.pauseForLockRetry();
    }
    const heartbeat = setInterval(() => {
      const now = /* @__PURE__ */ new Date();
      void Promise.all([utimes(lockDirectory, now, now), utimes(ownerPath, now, now)]).catch(() => void 0);
    }, this.lockHeartbeatMs);
    heartbeat.unref();
    try {
      await this.cleanupOrphanTempsUnlocked(projectDirectory);
      return await action(projectDirectory);
    } finally {
      clearInterval(heartbeat);
      await this.releaseOwnedLock(projectDirectory, lockDirectory, token).catch(() => void 0);
    }
  }
  parseLedgerContent(content, projectId) {
    if (content.length === 0) return [];
    if (!content.endsWith("\n")) {
      throw new IntentLoopError("CORRUPT_TRAILING_EVENT", "ledger has an incomplete trailing event", true);
    }
    const events = [];
    let expectedPrevious = null;
    const lines = content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === "" && index === lines.length - 1) continue;
      if (line === void 0 || line.trim() === "") {
        throw new IntentLoopError("CORRUPT_LEDGER", `ledger contains an empty middle line at ${index + 1}`);
      }
      let parsed;
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
  async quarantinePartial(projectDirectory, partial) {
    const quarantineDirectory = await this.internalDirectory(projectDirectory, "quarantine", true);
    if (quarantineDirectory === null) {
      throw new IntentLoopError("INVALID_DATA_DIR", "quarantine directory is unavailable");
    }
    const filePath = path2.join(quarantineDirectory, `partial-${Date.now()}-${newId()}.json`);
    const summary = {
      observed_at: nowIso(),
      byte_length: Buffer.byteLength(partial, "utf8"),
      sha256: sha256(partial)
    };
    await writeFile(filePath, `${canonicalStringify(summary)}
`, { encoding: "utf8", flag: "wx", mode: 384 });
    await syncFile(filePath);
  }
  async replaceLedger(projectDirectory, body, purpose) {
    const ledgerPath = path2.join(projectDirectory, "ledger.jsonl");
    await this.safeRegularFile(projectDirectory, ledgerPath, true);
    const temporary = path2.join(projectDirectory, `ledger-${purpose}-${newId()}.tmp`);
    try {
      await writeFile(temporary, body, { encoding: "utf8", flag: "wx", mode: 384 });
      await syncFile(temporary);
      await rename(temporary, ledgerPath);
      await syncDirectory(projectDirectory);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  async readUnlocked(projectId, projectDirectory, repairTrailing) {
    const ledgerPath = path2.join(projectDirectory, "ledger.jsonl");
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
  async readEvents(projectId) {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return [];
    return this.readUnlocked(projectId, projectDirectory, false);
  }
  async appendUnlocked(projectId, projectDirectory, events, input) {
    const unsigned = {
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
    const event = { ...unsigned, event_hash: eventHash(unsigned) };
    const body = `${[...events, event].map(canonicalStringify).join("\n")}
`;
    await this.replaceLedger(projectDirectory, body, "append");
    return event;
  }
  async transactAppend(projectId, decide, options = {}) {
    return this.withLock(projectId, async (projectDirectory) => {
      const events = await this.readUnlocked(projectId, projectDirectory, true);
      const input = await decide([...events]);
      const guardedTaskId = options.private_recovery?.task_id ?? input?.task_id;
      const controls = guardedTaskId === void 0 ? [] : (await this.privateControlsUnlocked(projectDirectory, projectId)).filter((control) => control.task_id === guardedTaskId);
      const recovery = options.private_recovery;
      if (recovery === void 0) {
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
        if (sessionOwner !== void 0 && sessionOwner.task_id !== recovery.task_id) {
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
  async appendEvent(projectId, input) {
    const result = await this.transactAppend(projectId, () => input);
    if (result.event === null) throw new IntentLoopError("APPEND_ABORTED", "ledger append was aborted");
    return result.event;
  }
  parsePrivateControl(body, projectId, expectedSessionHash) {
    try {
      const control = JSON.parse(body);
      if (control.schema_version === SCHEMA_VERSION && control.project_id === projectId && typeof control.host_session_hash === "string" && SESSION_HASH_RE.test(control.host_session_hash) && (expectedSessionHash === void 0 || control.host_session_hash === expectedSessionHash) && control.mode === "private" && typeof control.task_id === "string" && UUID_RE2.test(control.task_id) && typeof control.created_at === "string") return control;
    } catch {
    }
    throw new IntentLoopError("CORRUPT_PRIVATE_CONTROL", "private-session control is malformed", true);
  }
  async privateControlsUnlocked(projectDirectory, projectId) {
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return [];
    const entries = await readdir(directory, { withFileTypes: true });
    const controls = [];
    for (const entry of entries) {
      if (!entry.name.endsWith(".json")) continue;
      if (!entry.isFile() || entry.isSymbolicLink()) {
        throw new IntentLoopError("PATH_ESCAPE", "private-session controls must be regular files");
      }
      const sessionHash = entry.name.slice(0, -5);
      this.validateSessionHash(sessionHash);
      const filePath = path2.join(directory, entry.name);
      const body = await this.readSafeFile(projectDirectory, filePath, false);
      controls.push(this.parsePrivateControl(body, projectId, sessionHash));
    }
    return controls;
  }
  async clearPrivateSessionUnlocked(projectDirectory, projectId, sessionHash, expectedTaskId) {
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return;
    const target = path2.join(directory, `${sessionHash}.json`);
    const body = await this.readSafeFile(projectDirectory, target, true);
    if (body === "") return;
    const control = this.parsePrivateControl(body, projectId, sessionHash);
    if (control.task_id !== expectedTaskId) {
      throw new IntentLoopError("PRIVATE_SESSION_OWNED", "host session is owned by another private task");
    }
    await rm(target, { force: true });
    await syncDirectory(directory);
  }
  async clearPrivateSessionsForTaskUnlocked(projectDirectory, projectId, taskId) {
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
  async rewriteEvents(projectId, transform, forbiddenMarkers, options = {}) {
    return this.withLock(projectId, async (projectDirectory) => {
      const current = await this.readUnlocked(projectId, projectDirectory, true);
      const transformed = transform([...current]);
      let previous = null;
      const rechained = transformed.map((event) => {
        const unsigned = { ...withoutHash(event), prev_hash: previous };
        const next = { ...unsigned, event_hash: eventHash(unsigned) };
        previous = next.event_hash;
        return next;
      });
      const body = rechained.length === 0 ? "" : `${rechained.map(canonicalStringify).join("\n")}
`;
      const verifiedBeforeReplace = this.parseLedgerContent(body, projectId);
      if (verifiedBeforeReplace.length !== rechained.length) {
        throw new IntentLoopError("DELETE_VERIFICATION_FAILED", "temporary ledger event count did not verify");
      }
      const leaked = forbiddenMarkers.find((marker) => body.includes(marker));
      if (leaked !== void 0) {
        throw new IntentLoopError("DELETE_VERIFICATION_FAILED", "temporary ledger still contains a target identifier");
      }
      await this.replaceLedger(projectDirectory, body, "rewrite");
      if (options.remove_private_task_id !== void 0) {
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
  async assertMarkersAbsent(directory, markers) {
    if (markers.length === 0) return 0;
    let count = 0;
    const walk = async (current) => {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "ledger.lock" || entry.name.startsWith("ledger.lock.")) continue;
        const target = path2.join(current, entry.name);
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
  async activatePrivateSession(projectId, taskId, sessionHash, validate = () => void 0) {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    if (!UUID_RE2.test(taskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    return this.withLock(projectId, async (projectDirectory) => {
      const events = await this.readUnlocked(projectId, projectDirectory, true);
      validate([...events]);
      const existingControls = await this.privateControlsUnlocked(projectDirectory, projectId);
      const sessionOwner = existingControls.find((control2) => control2.host_session_hash === sessionHash);
      if (sessionOwner !== void 0 && sessionOwner.task_id !== taskId) {
        throw new IntentLoopError("PRIVATE_SESSION_OWNED", "host session is already bound to another private task");
      }
      if (existingControls.some((control2) => control2.task_id === taskId && control2.host_session_hash !== sessionHash)) {
        throw new IntentLoopError("PRIVATE_TASK_OWNED", "task is already bound to another private host session");
      }
      if (sessionOwner?.task_id === taskId) return events;
      const directory = await this.internalDirectory(projectDirectory, "private-sessions", true);
      if (directory === null) {
        throw new IntentLoopError("INVALID_DATA_DIR", "private-session directory is unavailable");
      }
      const target = path2.join(directory, `${sessionHash}.json`);
      const temporary = `${target}.${newId()}.tmp`;
      const control = {
        schema_version: SCHEMA_VERSION,
        project_id: projectId,
        task_id: taskId,
        host_session_hash: sessionHash,
        mode: "private",
        created_at: nowIso()
      };
      try {
        await writeFile(temporary, `${canonicalStringify(control)}
`, { encoding: "utf8", flag: "wx", mode: 384 });
        await syncFile(temporary);
        await rename(temporary, target);
        await syncDirectory(directory);
      } finally {
        await rm(temporary, { force: true });
      }
      return events;
    });
  }
  async privateSession(projectId, sessionHash) {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return null;
    const directory = await this.internalDirectory(projectDirectory, "private-sessions", false);
    if (directory === null) return null;
    const body = await this.readSafeFile(projectDirectory, path2.join(directory, `${sessionHash}.json`), true);
    return body === "" ? null : this.parsePrivateControl(body, projectId, sessionHash);
  }
  async privateSessionForTask(projectId, taskId) {
    this.validateProjectId(projectId);
    if (!UUID_RE2.test(taskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return null;
    const matches = (await this.privateControlsUnlocked(projectDirectory, projectId)).filter((control) => control.task_id === taskId);
    if (matches.length > 1) {
      throw new IntentLoopError("PRIVATE_CONTROL_CONFLICT", "task has more than one private-session control", true);
    }
    return matches[0] ?? null;
  }
  async clearPrivateSession(projectId, sessionHash, expectedTaskId) {
    this.validateProjectId(projectId);
    this.validateSessionHash(sessionHash);
    if (!UUID_RE2.test(expectedTaskId)) throw new IntentLoopError("INVALID_ID", "task_id must be a UUID");
    const existing = await this.existingProjectDirectory(projectId);
    if (existing === null) return;
    await this.withLock(projectId, async (projectDirectory) => {
      await this.clearPrivateSessionUnlocked(projectDirectory, projectId, sessionHash, expectedTaskId);
    });
  }
  async privateSessionCount(projectId) {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return 0;
    return (await this.privateControlsUnlocked(projectDirectory, projectId)).length;
  }
  async exists(projectId) {
    const projectDirectory = await this.existingProjectDirectory(projectId);
    if (projectDirectory === null) return false;
    return this.safeRegularFile(projectDirectory, path2.join(projectDirectory, "ledger.jsonl"), true);
  }
};
function dataRootFromEnvironment(environment = process.env, entryPoint = process.argv[1]) {
  const explicit = environment.INTENT_LOOP_DATA_DIR?.trim();
  if (explicit) return path2.resolve(explicit);
  const codexHome = environment.CODEX_HOME?.trim();
  if (codexHome) return path2.resolve(codexHome, "plugin-data", "intent-loop", "v1");
  const pluginData = environment.PLUGIN_DATA?.trim();
  if (pluginData) return path2.resolve(pluginData, "intent-loop", "v1");
  if (entryPoint !== void 0) {
    const resolvedEntry = path2.resolve(entryPoint);
    const marker = `${path2.sep}plugins${path2.sep}cache${path2.sep}`;
    const markerIndex = resolvedEntry.toLocaleLowerCase("en-US").indexOf(marker.toLocaleLowerCase("en-US"));
    if (markerIndex > 0) {
      const inferredCodexHome = resolvedEntry.slice(0, markerIndex);
      return path2.resolve(inferredCodexHome, "plugin-data", "intent-loop", "v1");
    }
  }
  throw new IntentLoopError(
    "DATA_DIR_REQUIRED",
    "No safe Codex plugin data root is available; set INTENT_LOOP_DATA_DIR only for an explicit development or test run"
  );
}

// src/service.ts
function findRequest(events, taskId, requestId) {
  return events.find((event) => event.task_id === taskId && event.request_id === requestId);
}
function mutationFingerprint(operation, normalizedInput) {
  return sha256(canonicalStringify({ operation, input: normalizedInput }));
}
function assertDuplicateMatches(event, expectedTypes, fingerprint) {
  if (!expectedTypes.includes(event.event_type) || event.payload.request_fingerprint !== fingerprint) {
    throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used with different operation parameters");
  }
}
function deterministicTaskId(projectId, requestId) {
  const digest = sha256(canonicalStringify({ namespace: "intent-loop-start", project_id: projectId, request_id: requestId }));
  const variant = (Number.parseInt(digest[16] ?? "0", 16) & 3 | 8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}
function makeInitialExplicitClaims(items, requestId) {
  const input = items ?? [];
  if (input.length > 12) {
    throw new IntentLoopError("INITIAL_CLAIM_LIMIT", "start accepts at most 12 directly stated initial claims");
  }
  const scopes = /* @__PURE__ */ new Set(["task", "project", "long_term"]);
  const facets = /* @__PURE__ */ new Set([
    "outcome",
    "success_signal",
    "failure_signal",
    "hard_constraint",
    "soft_constraint",
    "tradeoff",
    "unknown",
    "result_feedback",
    "disagreement"
  ]);
  const sourceEventId = `start:${sha256(requestId).slice(0, 32)}`;
  const occurredAt = nowIso();
  return input.map((item, index) => {
    const scope = item.scope ?? "task";
    if (!scopes.has(scope)) throw new IntentLoopError("INVALID_SCOPE", "initial claim scope is invalid");
    if (!Array.isArray(item.facets) || item.facets.some((facet) => !facets.has(facet))) {
      throw new IntentLoopError("INVALID_FACETS", "initial claim facets are invalid");
    }
    const statement = atomicStatement(item.statement).text;
    return {
      claim_id: newId(),
      statement,
      role: "user",
      epistemic_status: "explicit",
      source_ref: {
        kind: "user_event",
        event_id: sourceEventId,
        sha256: sha256(canonicalStringify({ request_id: requestId, index, statement }))
      },
      scope,
      valid_from: occurredAt,
      last_confirmed: occurredAt,
      supersedes: [],
      facets: normalizeFacets(item.facets, "explicit"),
      related_claim_ids: []
    };
  });
}
function memoryEvent(projectId, previous, input) {
  const unsigned = {
    schema_version: SCHEMA_VERSION,
    event_id: input.event_id ?? newId(),
    event_type: input.event_type,
    project_id: projectId,
    task_id: input.task_id,
    occurred_at: input.occurred_at ?? nowIso(),
    actor: input.actor,
    request_id: input.request_id,
    payload: input.payload,
    prev_hash: previous?.event_hash ?? null
  };
  return { ...unsigned, event_hash: eventHash(unsigned) };
}
function stripClaimReference(claim, targetId) {
  return {
    ...claim,
    supersedes: claim.supersedes.filter((id) => id !== targetId),
    related_claim_ids: claim.related_claim_ids.filter((id) => id !== targetId)
  };
}
function stripTaskReference(candidate, targetTaskId) {
  const copy = JSON.parse(JSON.stringify(candidate));
  if (copy.task_ids !== void 0) {
    copy.task_ids = copy.task_ids.filter((taskId) => taskId !== targetTaskId);
  }
  return copy;
}
function stripTaskReferencesFromEvent(event, targetTaskId) {
  if (event.event_type === "candidate_added" || event.event_type === "source_observed" || event.event_type === "result_signal_observed" || event.event_type === "compaction_observed") {
    const candidate = event.payload.candidate;
    return candidate === void 0 ? event : { ...event, payload: { ...event.payload, candidate: stripTaskReference(candidate, targetTaskId) } };
  }
  if (event.event_type === "graph_imported") {
    const candidates = Array.isArray(event.payload.candidates) ? event.payload.candidates.map((candidate) => stripTaskReference(candidate, targetTaskId)) : [];
    const importedFrom = event.payload.imported_from;
    let normalizedImport = importedFrom;
    if (importedFrom !== null && typeof importedFrom === "object" && !Array.isArray(importedFrom)) {
      const copy = { ...importedFrom };
      if (copy.task_id === targetTaskId) delete copy.task_id;
      if (copy.source_task_id === targetTaskId) delete copy.source_task_id;
      normalizedImport = copy;
    }
    return {
      ...event,
      payload: { ...event.payload, candidates, imported_from: normalizedImport }
    };
  }
  return event;
}
function removeClaimFromTaskEvents(events, taskId, claimId) {
  const rewritten = [];
  for (const event of events) {
    if (event.task_id !== taskId) {
      rewritten.push(event);
    } else if (event.event_type === "claim_added" || event.event_type === "claim_replaced") {
      const claim = event.payload.claim;
      if (claim?.claim_id !== claimId) {
        rewritten.push(claim === void 0 ? event : {
          ...event,
          payload: { ...event.payload, claim: stripClaimReference(claim, claimId) }
        });
      }
    } else if (event.event_type === "task_started") {
      const priorInitialClaims = Array.isArray(event.payload.initial_claims) ? event.payload.initial_claims : [];
      const initialClaims = priorInitialClaims.filter((claim) => claim.claim_id !== claimId).map((claim) => stripClaimReference(claim, claimId));
      const payload = { ...event.payload, initial_claims: initialClaims };
      if (priorInitialClaims.some((claim) => claim.claim_id === claimId)) {
        payload.request_fingerprint = mutationFingerprint("start_task", {
          task_id: event.task_id,
          mode: payload.mode,
          label: payload.label ?? null,
          host_session_hash: payload.host_session_hash ?? null,
          initial_explicit: initialClaims.map((claim) => ({
            statement: claim.statement,
            scope: claim.scope,
            facets: claim.facets
          }))
        });
      }
      rewritten.push({ ...event, payload });
    } else if (event.event_type === "claim_invalidated" && event.payload.claim_id === claimId) {
      continue;
    } else if (event.event_type === "graph_imported") {
      const priorClaims = Array.isArray(event.payload.claims) ? event.payload.claims : [];
      const claims = priorClaims.filter((claim) => claim.claim_id !== claimId).map((claim) => stripClaimReference(claim, claimId));
      const invalidated = Array.isArray(event.payload.invalidated_claim_ids) ? event.payload.invalidated_claim_ids.filter((id) => id !== claimId) : [];
      const payload = {
        ...event.payload,
        claims,
        invalidated_claim_ids: invalidated
      };
      if (priorClaims.some((claim) => claim.claim_id === claimId)) {
        payload.request_fingerprint = mutationFingerprint("import_graph_after_delete", {
          task_id: event.task_id,
          claims,
          invalidated_claim_ids: invalidated,
          candidates: Array.isArray(payload.candidates) ? payload.candidates : [],
          imported_from: payload.imported_from ?? null
        });
      }
      rewritten.push({ ...event, payload });
    } else {
      rewritten.push(event);
    }
  }
  return rewritten;
}
function rechainMemoryEvents(events) {
  let previous = null;
  return events.map((event) => {
    const { event_hash: _eventHash, ...rest } = event;
    const unsigned = { ...rest, prev_hash: previous };
    const next = { ...unsigned, event_hash: eventHash(unsigned) };
    previous = next.event_hash;
    return next;
  });
}
function eventsForTask(events, taskId) {
  return events.filter((event) => event.task_id === taskId);
}
function currentTaskForSession(events, projectId, sessionHash) {
  const taskIds = [...new Set(events.map((event) => event.task_id))];
  const matches = taskIds.map((taskId) => projectTask(eventsForTask(events, taskId), projectId, taskId)).filter((state) => state.started_at !== null && state.host_session_hash === sessionHash).sort(
    (left, right) => (right.last_event_at ?? "").localeCompare(left.last_event_at ?? "") || right.task_id.localeCompare(left.task_id)
  );
  return matches[0]?.task_id ?? null;
}
function durableTaskState(events, projectId, taskId) {
  const taskEvents = eventsForTask(events, taskId);
  const state = projectTask(taskEvents, projectId, taskId);
  if (state.started_at !== null && state.mode === "private") {
    throw new IntentLoopError(
      "CORRUPT_PRIVATE_STATE",
      "a private mode record was found in durable storage; semantic writes are blocked until the task is deleted"
    );
  }
  return { taskEvents, state };
}
function assertClaimRole(status, role, source) {
  const expected = {
    explicit: "user",
    inferred: "agent",
    evidence: "evidence",
    unknown: "agent",
    disputed: "system"
  };
  if (role !== expected[status]) {
    throw new IntentLoopError("INVALID_CLAIM_ROLE", `${status} claims require role=${expected[status]}`);
  }
  if (status === "explicit" && source.kind !== "user_event") {
    throw new IntentLoopError("EXPLICIT_SOURCE_REQUIRED", "new explicit claims require a direct user_event source");
  }
}
function isRfc3339Utc(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value) && Number.isFinite(Date.parse(value));
}
function assertImportedClaimShape(claim) {
  const expected = {
    explicit: "user",
    inferred: "agent",
    evidence: "evidence",
    unknown: "agent",
    disputed: "system"
  };
  if (claim.role !== expected[claim.epistemic_status]) {
    throw new IntentLoopError("INVALID_IMPORT", `imported ${claim.epistemic_status} claim has an invalid role`);
  }
  if (claim.epistemic_status === "inferred") {
    if (claim.confidence === void 0 || !Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      throw new IntentLoopError("INVALID_IMPORT", "imported inferred claim requires confidence from 0 to 1");
    }
  } else if (claim.confidence !== void 0) {
    throw new IntentLoopError("INVALID_IMPORT", "only imported inferred claims may include confidence");
  }
  if (!isRfc3339Utc(claim.valid_from)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported valid_from must be RFC3339 UTC");
  }
  if (claim.last_confirmed !== null && !isRfc3339Utc(claim.last_confirmed)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported last_confirmed must be RFC3339 UTC or null");
  }
  if (claim.review_after !== void 0 && !isRfc3339Utc(claim.review_after)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported review_after must be RFC3339 UTC");
  }
}
var IntentService = class {
  store;
  privateEvents = /* @__PURE__ */ new Map();
  constructor(store) {
    this.store = store;
  }
  key(projectId, taskId) {
    return `${projectId}:${taskId}`;
  }
  async projectEvents(projectId) {
    return this.store.readEvents(projectId);
  }
  async taskEvents(projectId, taskId) {
    const privateLedger = this.privateEvents.get(this.key(projectId, taskId));
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, taskId, privateLedger);
      return [...privateLedger];
    }
    const all = await this.projectEvents(projectId);
    const durable = durableTaskState(all, projectId, taskId);
    await this.assertNoPrivateControl(projectId, durable.state);
    return durable.taskEvents;
  }
  async assertPrivateControl(projectId, taskId, events) {
    const state = projectTask(events, projectId, taskId);
    if (state.host_session_hash === null) {
      throw new IntentLoopError("PRIVATE_CONTROL_MISSING", "private task is missing its Hook suppression token");
    }
    const control = await this.store.privateSession(projectId, state.host_session_hash);
    if (control?.task_id !== taskId) {
      throw new IntentLoopError("PRIVATE_CONTROL_MISSING", "private Hook suppression control is missing or mismatched");
    }
  }
  async assertNoPrivateControl(projectId, state) {
    if (state.host_session_hash === null) return;
    const control = await this.store.privateSession(projectId, state.host_session_hash);
    if (control?.task_id === state.task_id) {
      throw new IntentLoopError(
        "PRIVATE_SESSION_ACTIVE",
        "private semantic state is active or was lost with its process; explicitly re-enable durable mode or delete the task"
      );
    }
  }
  appendPrivate(projectId, taskId, event) {
    const privateLedger = this.privateEvents.get(this.key(projectId, taskId));
    if (privateLedger === void 0) {
      throw new IntentLoopError("PRIVATE_STATE_REQUIRED", "private append requires an active in-process private task");
    }
    const next = memoryEvent(projectId, privateLedger.at(-1), event);
    privateLedger.push(next);
    return next;
  }
  dropPrivateMemoryForSession(projectId, sessionHash) {
    for (const [key, events] of this.privateEvents) {
      if (!key.startsWith(`${projectId}:`)) continue;
      const taskId = key.slice(projectId.length + 1);
      const state = projectTask(events, projectId, taskId);
      if (state.host_session_hash === sessionHash) this.privateEvents.delete(key);
    }
  }
  async startTask(input) {
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const taskId = input.task_id ?? deterministicTaskId(projectId, input.request_id);
    validateUuid(taskId, "task_id");
    const mode = input.mode ?? "on";
    if (mode === "off" && input.label !== void 0 && input.label.trim() !== "") {
      throw new IntentLoopError("MODE_OFF_SEMANTIC_INPUT", "off mode does not persist a semantic label");
    }
    if (mode === "off" && (input.initial_explicit?.length ?? 0) > 0) {
      throw new IntentLoopError("MODE_OFF_SEMANTIC_INPUT", "off mode does not persist initial semantic claims");
    }
    const label = mode === "off" ? null : sanitizeLabel(input.label);
    const initialClaims = mode === "off" ? [] : makeInitialExplicitClaims(input.initial_explicit, input.request_id);
    const sessionHash = input.host_session_id === void 0 ? null : hostSessionHash(input.host_session_id);
    const requestFingerprint = mutationFingerprint("start_task", {
      task_id: taskId,
      mode,
      label,
      host_session_hash: sessionHash,
      initial_explicit: initialClaims.map((claim) => ({
        statement: claim.statement,
        scope: claim.scope,
        facets: claim.facets
      }))
    });
    const payload = {
      mode,
      label,
      host_session_hash: sessionHash,
      initial_claims: initialClaims,
      request_fingerprint: requestFingerprint
    };
    if (mode === "private") {
      if (sessionHash === null) {
        throw new IntentLoopError(
          "PRIVATE_SESSION_TOKEN_REQUIRED",
          "private mode requires the hidden host_session_id so separate Hook processes can be suppressed safely"
        );
      }
      const existingPrivate = this.privateEvents.get(this.key(projectId, taskId));
      if (existingPrivate !== void 0) {
        await this.assertPrivateControl(projectId, taskId, existingPrivate);
        const duplicate = findRequest(existingPrivate, taskId, input.request_id);
        if (duplicate !== void 0) {
          assertDuplicateMatches(duplicate, ["task_started", "mode_set"], requestFingerprint);
          return snapshotFromState(projectTask(existingPrivate, projectId, taskId));
        }
        if (initialClaims.length > 0) {
          throw new IntentLoopError("TASK_ALREADY_STARTED", "initial claims are accepted only when a task is first started");
        }
        return snapshotFromState(projectTask(existingPrivate, projectId, taskId));
      }
      const all = await this.store.activatePrivateSession(projectId, taskId, sessionHash, (events) => {
        durableTaskState(events, projectId, taskId);
        if (eventsForTask(events, taskId).length > 0 && initialClaims.length > 0) {
          throw new IntentLoopError("TASK_ALREADY_STARTED", "initial claims are accepted only when a task is first started");
        }
        const sessionOwner = currentTaskForSession(events, projectId, sessionHash);
        if (sessionOwner !== null && sessionOwner !== taskId) {
          throw new IntentLoopError("SESSION_ALREADY_ASSOCIATED", "host session is already associated with another task");
        }
      });
      const durable = eventsForTask(all, taskId);
      const privateLedger = durable.length === 0 ? [memoryEvent(projectId, void 0, {
        event_type: "task_started",
        task_id: taskId,
        actor: "user",
        request_id: input.request_id,
        payload
      })] : [...durable, memoryEvent(projectId, durable.at(-1), {
        event_type: "mode_set",
        task_id: taskId,
        actor: "user",
        request_id: input.request_id,
        payload: {
          mode: "private",
          host_session_hash: sessionHash,
          request_fingerprint: requestFingerprint
        }
      })];
      this.privateEvents.set(this.key(projectId, taskId), privateLedger);
      return snapshotFromState(projectTask(privateLedger, projectId, taskId));
    }
    const transaction = await this.store.transactAppend(projectId, (events) => {
      if (sessionHash !== null) {
        const sessionOwner = currentTaskForSession(events, projectId, sessionHash);
        if (sessionOwner !== null && sessionOwner !== taskId) {
          throw new IntentLoopError("SESSION_ALREADY_ASSOCIATED", "host session is already associated with another task");
        }
      }
      const { taskEvents, state } = durableTaskState(events, projectId, taskId);
      const duplicate = findRequest(taskEvents, taskId, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["task_started", "mode_set"], requestFingerprint);
        return null;
      }
      if (state.started_at !== null) {
        if (initialClaims.length > 0) {
          throw new IntentLoopError("TASK_ALREADY_STARTED", "initial claims are accepted only when a task is first started");
        }
        return {
          event_type: "mode_set",
          task_id: taskId,
          actor: "user",
          request_id: input.request_id,
          payload: {
            mode,
            ...sessionHash === null ? {} : { host_session_hash: sessionHash },
            request_fingerprint: requestFingerprint
          }
        };
      }
      return {
        event_type: "task_started",
        task_id: taskId,
        actor: "user",
        request_id: input.request_id,
        payload
      };
    }, sessionHash === null ? {} : {
      private_recovery: {
        task_id: taskId,
        session_hash: sessionHash,
        clear_after: true
      }
    });
    if (sessionHash !== null) {
      this.dropPrivateMemoryForSession(projectId, sessionHash);
    }
    return snapshotFromState(projectTask(eventsForTask(transaction.events, taskId), projectId, taskId));
  }
  async getSnapshot(input) {
    validateUuid(input.task_id, "task_id");
    const projectId = projectIdForRoot(input.project_root);
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    requireTaskStarted(state);
    if (state.mode === "off") {
      throw new IntentLoopError("MODE_OFF", "Intent Loop is off for this task; use intent_status or re-enable it");
    }
    return snapshotFromState(state, Math.max(500, Math.min(input.max_characters ?? 2400, 8e3)));
  }
  async status(input) {
    const projectId = projectIdForRoot(input.project_root);
    if (input.task_id === void 0) {
      const events = await this.projectEvents(projectId);
      const taskIds = [...new Set(events.map((event) => event.task_id))];
      return {
        project_id: projectId,
        task_count: taskIds.length,
        candidate_count: taskIds.reduce(
          (total, taskId) => total + durableTaskState(events, projectId, taskId).state.candidates.length,
          0
        ),
        data_directory: this.store.dataDirectoryPath(projectId),
        schema_version: SCHEMA_VERSION,
        private_tasks_in_process: [...this.privateEvents.keys()].filter((key) => key.startsWith(`${projectId}:`)).length,
        private_session_control_count: await this.store.privateSessionCount(projectId)
      };
    }
    validateUuid(input.task_id, "task_id");
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    if (state.started_at === null) {
      const control = await this.store.privateSessionForTask(projectId, input.task_id);
      if (control !== null) {
        return {
          project_id: projectId,
          task_id: input.task_id,
          mode: "private",
          active_claim_count: 0,
          candidate_count: 0,
          semantic_state_available: false,
          recovery_action: "Explicitly set mode to on/off to create an empty durable task, resume private, or delete the task.",
          data_directory: null,
          schema_version: SCHEMA_VERSION
        };
      }
    }
    requireTaskStarted(state);
    return {
      project_id: projectId,
      task_id: input.task_id,
      mode: state.mode,
      active_claim_count: activeClaims(state).length,
      candidate_count: state.candidates.length,
      data_directory: state.mode === "private" ? null : this.store.dataDirectoryPath(projectId),
      schema_version: SCHEMA_VERSION
    };
  }
  async addClaim(input, eventType = "claim_added") {
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const statement = atomicStatement(input.statement).text;
    const sourceRef = normalizeSourceRef(input.source_ref);
    assertClaimRole(input.epistemic_status, input.role, sourceRef);
    if (input.epistemic_status === "inferred") {
      if (input.confidence === void 0 || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
        throw new IntentLoopError("CONFIDENCE_REQUIRED", "inferred claims require confidence from 0 to 1");
      }
    } else if (input.confidence !== void 0) {
      throw new IntentLoopError("CONFIDENCE_NOT_ALLOWED", "confidence is only accepted for inferred claims");
    }
    const supersedes = [...new Set(input.supersedes ?? [])];
    const related = [...new Set(input.related_claim_ids ?? [])];
    for (const id of [...supersedes, ...related]) validateUuid(id, "related claim id");
    const claim = {
      claim_id: newId(),
      statement,
      role: input.role,
      epistemic_status: input.epistemic_status,
      source_ref: sourceRef,
      scope: input.scope,
      valid_from: nowIso(),
      last_confirmed: input.last_confirmed ?? null,
      supersedes,
      facets: normalizeFacets(input.facets, input.epistemic_status),
      related_claim_ids: related
    };
    if (input.confidence !== void 0) claim.confidence = input.confidence;
    if (input.result_feedback_class !== void 0) claim.result_feedback_class = input.result_feedback_class;
    if (input.scope === "long_term" && input.epistemic_status === "inferred") {
      claim.review_after = new Date(Date.now() + LONG_TERM_STALE_MS).toISOString();
    }
    const requestFingerprint = mutationFingerprint(eventType, {
      statement,
      role: input.role,
      epistemic_status: input.epistemic_status,
      source_ref: sourceRef,
      scope: input.scope,
      confidence: input.confidence ?? null,
      supersedes,
      facets: claim.facets,
      related_claim_ids: related,
      result_feedback_class: input.result_feedback_class ?? null,
      require_long_term_candidate: input.require_long_term_candidate ?? false
    });
    const validateCurrent = (events, state) => {
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      if (input.require_long_term_candidate === true) {
        const eligible = state.candidates.some(
          (candidate) => candidate.candidate_type === "long_term_preference" && (candidate.task_ids?.length ?? 0) >= 3
        );
        if (!eligible) {
          throw new IntentLoopError("LONG_TERM_CONFIRMATION_REQUIRED", "no three-task long-term candidate is eligible for confirmation");
        }
      }
      const current = new Map(activeClaims(state).map((item) => [item.claim_id, item]));
      for (const id of supersedes) {
        const target = current.get(id);
        if (target === void 0) {
          throw new IntentLoopError("CLAIM_NOT_ACTIVE", `superseded claim ${id} is not active in this task`);
        }
        if (target.role === "user" && target.epistemic_status === "explicit" && !(claim.role === "user" && claim.epistemic_status === "explicit" && claim.source_ref.kind === "user_event")) {
          throw new IntentLoopError(
            "EXPLICIT_REPLACEMENT_REQUIRES_USER",
            "a user-explicit claim can only be superseded by a new direct user-explicit claim"
          );
        }
      }
      for (const id of related) {
        if (!state.claims.some((item) => item.claim_id === id)) {
          throw new IntentLoopError("RELATED_CLAIM_NOT_FOUND", `related claim ${id} does not exist in this task`);
        }
      }
      void events;
    };
    const eventInput = {
      event_type: eventType,
      task_id: input.task_id,
      actor: input.role,
      request_id: input.request_id,
      payload: { claim, request_fingerprint: requestFingerprint }
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, [eventType], requestFingerprint);
        const existing = duplicate.payload.claim;
        if (existing !== void 0) return cloneClaim(existing);
        throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
      }
      const state = projectTask(privateLedger, projectId, input.task_id);
      validateCurrent(privateLedger, state);
      this.appendPrivate(projectId, input.task_id, eventInput);
      return cloneClaim(claim);
    }
    const transaction = await this.store.transactAppend(projectId, async (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      await this.assertNoPrivateControl(projectId, state);
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, [eventType], requestFingerprint);
        if (duplicate.payload.claim === void 0) {
          throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
        }
        return null;
      }
      validateCurrent(taskEvents, state);
      return eventInput;
    });
    const persisted = findRequest(eventsForTask(transaction.events, input.task_id), input.task_id, input.request_id);
    const result = persisted?.payload.claim;
    if (result === void 0) throw new IntentLoopError("APPEND_VERIFICATION_FAILED", "claim append did not verify");
    return cloneClaim(result);
  }
  async addExplicit(input) {
    const source = normalizeSourceRef(input.source_ref, ["user_event"]);
    return this.addClaim({
      ...input,
      source_ref: source,
      role: "user",
      epistemic_status: "explicit",
      last_confirmed: confirmationTimestamp(),
      require_long_term_candidate: input.scope === "long_term" && input.confirmation_reason === "confirmed_candidate"
    });
  }
  async addInference(input) {
    if (input.scope !== "long_term") {
      return this.addClaim({ ...input, role: "agent", epistemic_status: "inferred" });
    }
    const source = normalizeSourceRef(input.source_ref, ["user_event", "agent_turn"]);
    const statement = atomicStatement(input.statement).text;
    if (input.confidence === void 0 || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
      throw new IntentLoopError("CONFIDENCE_REQUIRED", "long-term signals require confidence from 0 to 1");
    }
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const signalKey = input.signal_key?.trim() || sha256(statement);
    if (!/^[A-Za-z0-9_.:@-]{1,200}$/u.test(signalKey) && !/^[a-f0-9]{64}$/u.test(signalKey)) {
      throw new IntentLoopError("INVALID_SIGNAL_KEY", "signal_key must be an opaque ID or SHA-256 value");
    }
    if (findKnownCredentialKinds(signalKey).length > 0) {
      throw new IntentLoopError("SENSITIVE_ID_REJECTED", "signal_key must not contain a credential or access token");
    }
    const requestFingerprint = mutationFingerprint("long_term_inference", {
      statement,
      source_ref: source,
      scope: input.scope,
      confidence: input.confidence,
      facets: normalizeFacets(input.facets, "inferred"),
      signal_key: signalKey
    });
    const makeCandidate = (all) => {
      const repeatedTasks = /* @__PURE__ */ new Set([input.task_id]);
      for (const event of all) {
        if (event.event_type === "candidate_added" && event.payload.signal_key === signalKey) repeatedTasks.add(event.task_id);
      }
      return {
        candidate_id: newId(),
        candidate_type: "long_term_preference",
        source_ref: source,
        created_at: nowIso(),
        summary: statement,
        task_ids: [...repeatedTasks].sort()
      };
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const state = projectTask(privateLedger, projectId, input.task_id);
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["candidate_added"], requestFingerprint);
        const prior = duplicate.payload.candidate;
        if (prior !== void 0) return JSON.parse(JSON.stringify(prior));
        throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
      }
      const candidate2 = makeCandidate(await this.projectEvents(projectId));
      this.appendPrivate(projectId, input.task_id, {
        event_type: "candidate_added",
        task_id: input.task_id,
        actor: "agent",
        request_id: input.request_id,
        payload: {
          candidate: candidate2,
          signal_key: signalKey,
          confidence: input.confidence,
          eligible_for_confirmation: (candidate2.task_ids?.length ?? 0) >= 3,
          request_fingerprint: requestFingerprint
        }
      });
      return candidate2;
    }
    const transaction = await this.store.transactAppend(projectId, async (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      await this.assertNoPrivateControl(projectId, state);
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["candidate_added"], requestFingerprint);
        if (duplicate.payload.candidate === void 0) {
          throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
        }
        return null;
      }
      const candidate2 = makeCandidate(all);
      return {
        event_type: "candidate_added",
        task_id: input.task_id,
        actor: "agent",
        request_id: input.request_id,
        payload: {
          candidate: candidate2,
          signal_key: signalKey,
          confidence: input.confidence,
          eligible_for_confirmation: (candidate2.task_ids?.length ?? 0) >= 3,
          request_fingerprint: requestFingerprint
        }
      };
    });
    const persisted = findRequest(eventsForTask(transaction.events, input.task_id), input.task_id, input.request_id);
    const candidate = persisted?.payload.candidate;
    if (candidate === void 0) throw new IntentLoopError("APPEND_VERIFICATION_FAILED", "candidate append did not verify");
    return JSON.parse(JSON.stringify(candidate));
  }
  async addEvidence(input) {
    const source = normalizeSourceRef(input.source_ref, ["tool_result", "external_evidence", "agent_turn", "user_event"]);
    return this.addClaim({
      ...input,
      source_ref: source,
      role: "evidence",
      epistemic_status: "evidence",
      ...input.feedback_class === void 0 ? {} : { result_feedback_class: input.feedback_class }
    });
  }
  async markUnknown(input) {
    return this.addClaim({ ...input, role: "agent", epistemic_status: "unknown" });
  }
  async markDispute(input) {
    const related = input.related_claim_ids ?? [];
    if (related.length < 2 && !input.statement.trim()) {
      throw new IntentLoopError("INVALID_DISPUTE", "a dispute requires two related claims or a free-standing statement");
    }
    return this.addClaim({ ...input, role: "system", epistemic_status: "disputed", related_claim_ids: related });
  }
  async replaceClaim(input) {
    if (input.supersedes.length === 0) {
      throw new IntentLoopError("REPLACEMENT_TARGET_REQUIRED", "replace requires at least one active claim ID");
    }
    return this.addClaim(input, "claim_replaced");
  }
  async invalidate(input) {
    validateUuid(input.task_id, "task_id");
    validateUuid(input.claim_id, "claim_id");
    validateRequestId(input.request_id);
    const reason = atomicStatement(input.reason, 240).text;
    const source = normalizeSourceRef(input.source_ref);
    const projectId = projectIdForRoot(input.project_root);
    const invalidatedAt = nowIso();
    const requestFingerprint = mutationFingerprint("invalidate_claim", {
      claim_id: input.claim_id,
      reason,
      source_ref: source
    });
    const eventInput = {
      event_type: "claim_invalidated",
      task_id: input.task_id,
      actor: source.kind === "user_event" ? "user" : "agent",
      request_id: input.request_id,
      payload: {
        claim_id: input.claim_id,
        invalidated_at: invalidatedAt,
        reason,
        source_ref: source,
        request_fingerprint: requestFingerprint
      }
    };
    const validateCurrent = (events, state) => {
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const target = activeClaims(state).find((claim) => claim.claim_id === input.claim_id);
      if (target === void 0) throw new IntentLoopError("CLAIM_NOT_ACTIVE", "claim is not active in this task");
      if (target.role === "user" && target.epistemic_status === "explicit" && source.kind !== "user_event") {
        throw new IntentLoopError(
          "EXPLICIT_INVALIDATION_REQUIRES_USER",
          "a user-explicit claim can only be invalidated by a direct user_event"
        );
      }
      void events;
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["claim_invalidated"], requestFingerprint);
        return {
          claim_id: String(duplicate.payload.claim_id),
          invalidated_at: String(duplicate.payload.invalidated_at),
          reason: String(duplicate.payload.reason)
        };
      }
      validateCurrent(privateLedger, projectTask(privateLedger, projectId, input.task_id));
      this.appendPrivate(projectId, input.task_id, eventInput);
      return { claim_id: input.claim_id, invalidated_at: invalidatedAt, reason };
    }
    const transaction = await this.store.transactAppend(projectId, async (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      await this.assertNoPrivateControl(projectId, state);
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["claim_invalidated"], requestFingerprint);
        return null;
      }
      validateCurrent(taskEvents, state);
      return eventInput;
    });
    const persisted = findRequest(eventsForTask(transaction.events, input.task_id), input.task_id, input.request_id);
    if (persisted?.event_type !== "claim_invalidated") {
      throw new IntentLoopError("APPEND_VERIFICATION_FAILED", "claim invalidation did not verify");
    }
    return {
      claim_id: String(persisted.payload.claim_id),
      invalidated_at: String(persisted.payload.invalidated_at),
      reason: String(persisted.payload.reason)
    };
  }
  async listCandidates(input) {
    const projectId = projectIdForRoot(input.project_root);
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    requireTaskStarted(state);
    if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "Intent Loop is off for this task");
    return state.candidates.map((candidate) => JSON.parse(JSON.stringify(candidate)));
  }
  async exportGraph(input) {
    const projectId = projectIdForRoot(input.project_root);
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    requireTaskStarted(state);
    if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "Intent Loop is off for this task");
    return {
      format: "intent-loop-export",
      schema_version: SCHEMA_VERSION,
      exported_at: nowIso(),
      source_project_id: projectId,
      source_task_id: input.task_id,
      history_complete: false,
      claims: state.claims.map(cloneClaim),
      invalidated_claim_ids: [...state.invalidated_claim_ids].sort(),
      candidates: state.candidates.map((candidate) => JSON.parse(JSON.stringify(candidate)))
    };
  }
  async exportSummary(input) {
    const snapshot = await this.getSnapshot({
      project_root: input.project_root,
      task_id: input.task_id,
      max_characters: 2400
    });
    return {
      format: "intent-loop-human-summary",
      schema_version: SCHEMA_VERSION,
      task_id: snapshot.task_id,
      generated_at: snapshot.generated_at,
      history_complete: false,
      active_claim_count: snapshot.active_claims.length,
      candidate_count: snapshot.candidate_count,
      unknown_count: snapshot.unknowns.length,
      disagreement_count: snapshot.disagreements.length,
      compact_text: snapshot.compact_text
    };
  }
  async importGraph(input) {
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    if (input.graph.format !== "intent-loop-export" || input.graph.schema_version !== SCHEMA_VERSION || input.graph.history_complete !== false) {
      throw new IntentLoopError("INVALID_IMPORT", "graph is not a supported incomplete Intent Loop export");
    }
    if (!Array.isArray(input.graph.claims) || !Array.isArray(input.graph.invalidated_claim_ids) || !Array.isArray(input.graph.candidates) || input.graph.claims.length > 1e3 || input.graph.invalidated_claim_ids.length > 1e3 || input.graph.candidates.length > 1e3 || input.graph.claims.length + input.graph.invalidated_claim_ids.length + input.graph.candidates.length > 2e3) {
      throw new IntentLoopError("INVALID_IMPORT", "graph exceeds the bounded import size");
    }
    if (!isRfc3339Utc(input.graph.exported_at)) {
      throw new IntentLoopError("INVALID_IMPORT", "graph exported_at must be RFC3339 UTC");
    }
    validateUuid(input.graph.source_task_id, "source_task_id");
    if (!/^[a-f0-9]{64}$/u.test(input.graph.source_project_id)) {
      throw new IntentLoopError("INVALID_IMPORT", "source_project_id must be a lowercase SHA-256 value");
    }
    const graphClaimIds = /* @__PURE__ */ new Set();
    for (const claim of input.graph.claims) {
      validateUuid(claim.claim_id, "imported claim_id");
      if (graphClaimIds.has(claim.claim_id)) throw new IntentLoopError("INVALID_IMPORT", "graph contains duplicate claim IDs");
      graphClaimIds.add(claim.claim_id);
      assertImportedClaimShape(claim);
    }
    for (const claim of input.graph.claims) {
      for (const reference of [...claim.supersedes, ...claim.related_claim_ids]) {
        if (!graphClaimIds.has(reference)) {
          throw new IntentLoopError("INVALID_IMPORT", `claim ${claim.claim_id} references a missing claim`);
        }
      }
      if (claim.supersedes.includes(claim.claim_id)) {
        throw new IntentLoopError("INVALID_IMPORT", "a claim cannot supersede itself");
      }
    }
    const claimById = new Map(input.graph.claims.map((claim) => [claim.claim_id, claim]));
    const visiting = /* @__PURE__ */ new Set();
    const visited = /* @__PURE__ */ new Set();
    const visitSupersession = (claimId) => {
      if (visiting.has(claimId)) throw new IntentLoopError("INVALID_IMPORT", "supersession graph contains a cycle");
      if (visited.has(claimId)) return;
      visiting.add(claimId);
      const claim = claimById.get(claimId);
      for (const targetId of claim?.supersedes ?? []) {
        const target = claimById.get(targetId);
        if (target !== void 0 && Date.parse(claim?.valid_from ?? "") < Date.parse(target.valid_from)) {
          throw new IntentLoopError("INVALID_IMPORT", "a replacement claim predates the claim it supersedes");
        }
        visitSupersession(targetId);
      }
      visiting.delete(claimId);
      visited.add(claimId);
    };
    for (const claimId of graphClaimIds) visitSupersession(claimId);
    for (const claimId of input.graph.invalidated_claim_ids) {
      validateUuid(claimId, "invalidated_claim_id");
      if (!graphClaimIds.has(claimId)) throw new IntentLoopError("INVALID_IMPORT", "invalidated claim is absent from graph claims");
    }
    const candidateIds = /* @__PURE__ */ new Set();
    for (const candidate of input.graph.candidates) {
      validateUuid(candidate.candidate_id, "candidate_id");
      if (candidateIds.has(candidate.candidate_id)) throw new IntentLoopError("INVALID_IMPORT", "graph contains duplicate candidate IDs");
      candidateIds.add(candidate.candidate_id);
      if (!isRfc3339Utc(candidate.created_at)) throw new IntentLoopError("INVALID_IMPORT", "candidate created_at must be RFC3339 UTC");
      for (const taskId of candidate.task_ids ?? []) validateUuid(taskId, "candidate task_id");
    }
    const requestFingerprint = mutationFingerprint("import_graph", {
      task_id: input.task_id,
      graph: input.graph
    });
    const claimIdMap = new Map(input.graph.claims.map((claim) => [claim.claim_id, newId()]));
    const candidateIdMap = new Map(input.graph.candidates.map((candidate) => [candidate.candidate_id, newId()]));
    const importedTaskIds = new Set(input.graph.candidates.flatMap((candidate) => candidate.task_ids ?? []));
    const importedTaskIdMap = new Map([...importedTaskIds].map((taskId) => [taskId, newId()]));
    const claims = input.graph.claims.map((claim) => {
      const normalized = cloneClaim(claim);
      normalized.claim_id = claimIdMap.get(claim.claim_id);
      normalized.statement = atomicStatement(claim.statement).text;
      normalized.source_ref = {
        kind: "explicit_import",
        sha256: sha256(canonicalStringify({ claim_id: claim.claim_id, source_ref: claim.source_ref }))
      };
      normalized.supersedes = [...new Set(claim.supersedes.map((claimId) => claimIdMap.get(claimId)))];
      normalized.related_claim_ids = [
        ...new Set(claim.related_claim_ids.map((claimId) => claimIdMap.get(claimId)))
      ];
      normalized.facets = normalizeFacets(claim.facets, claim.epistemic_status);
      return normalized;
    });
    const candidates = input.graph.candidates.map((candidate) => ({
      ...JSON.parse(JSON.stringify(candidate)),
      candidate_id: candidateIdMap.get(candidate.candidate_id),
      source_ref: {
        kind: "explicit_import",
        sha256: sha256(canonicalStringify({ candidate_id: candidate.candidate_id, source_ref: candidate.source_ref }))
      },
      ...candidate.task_ids === void 0 ? {} : { task_ids: candidate.task_ids.map((taskId) => importedTaskIdMap.get(taskId)) },
      ...candidate.summary === void 0 ? {} : { summary: atomicStatement(candidate.summary).text }
    }));
    const invalidatedClaimIds = [
      ...new Set(input.graph.invalidated_claim_ids.map((claimId) => claimIdMap.get(claimId)))
    ];
    const projectId = projectIdForRoot(input.project_root);
    const eventInput = {
      event_type: "graph_imported",
      task_id: input.task_id,
      actor: "user",
      request_id: input.request_id,
      payload: {
        claims,
        invalidated_claim_ids: invalidatedClaimIds,
        candidates,
        imported_from: {
          source_identity_sha256: sha256(canonicalStringify({
            project_id: input.graph.source_project_id,
            task_id: input.graph.source_task_id
          })),
          exported_at: input.graph.exported_at,
          history_complete: false
        },
        request_fingerprint: requestFingerprint
      }
    };
    const validateCurrent = (events, state) => {
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const existingIds = new Set(
        [...new Set(events.map((event) => event.task_id))].flatMap((taskId) => projectTask(eventsForTask(events, taskId), projectId, taskId).claims).map((claim) => claim.claim_id)
      );
      for (const claim of claims) {
        if (existingIds.has(claim.claim_id)) throw new IntentLoopError("IMPORT_COLLISION", `claim ${claim.claim_id} already exists`);
      }
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate === void 0) {
        validateCurrent(privateLedger, projectTask(privateLedger, projectId, input.task_id));
        this.appendPrivate(projectId, input.task_id, eventInput);
      } else {
        assertDuplicateMatches(duplicate, ["graph_imported"], requestFingerprint);
      }
    } else {
      await this.store.transactAppend(projectId, async (all) => {
        const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
        await this.assertNoPrivateControl(projectId, state);
        const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
        if (duplicate !== void 0) {
          assertDuplicateMatches(duplicate, ["graph_imported"], requestFingerprint);
          return null;
        }
        validateCurrent(all, state);
        return eventInput;
      });
    }
    return this.getSnapshot({ project_root: input.project_root, task_id: input.task_id });
  }
  async setMode(input) {
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const key = this.key(projectId, input.task_id);
    const requestFingerprint = mutationFingerprint("set_mode", {
      task_id: input.task_id,
      mode: input.mode
    });
    const privateLedger = this.privateEvents.get(key);
    const persistedControl = await this.store.privateSessionForTask(projectId, input.task_id);
    if (privateLedger !== void 0) {
      const privateState = projectTask(privateLedger, projectId, input.task_id);
      requireTaskStarted(privateState);
      if (input.mode === "private") {
        const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
        if (duplicate === void 0) {
          this.appendPrivate(projectId, input.task_id, {
            event_type: "mode_set",
            task_id: input.task_id,
            actor: "user",
            request_id: input.request_id,
            payload: { mode: "private", request_fingerprint: requestFingerprint }
          });
        } else {
          assertDuplicateMatches(duplicate, ["mode_set"], requestFingerprint);
        }
        return {
          mode: "private",
          persistence_note: "Semantic changes remain memory-only; a hashed control marker suppresses separate Hook processes."
        };
      }
      if (privateState.host_session_hash === null) {
        throw new IntentLoopError("PRIVATE_SESSION_TOKEN_REQUIRED", "private task is missing its Hook suppression token");
      }
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      let recoveredWithoutDurableState2 = false;
      await this.store.transactAppend(projectId, (all) => {
        const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
        const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
        if (duplicate !== void 0) {
          assertDuplicateMatches(duplicate, ["mode_set", "task_started"], requestFingerprint);
          if (duplicate.event_type === "task_started" && duplicate.payload.recovered_from_private !== true) {
            throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used by the original task start");
          }
          return null;
        }
        if (state.started_at !== null && state.host_session_hash !== null && state.host_session_hash !== privateState.host_session_hash) {
          throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "durable task is associated with another host session");
        }
        if (state.started_at === null) {
          recoveredWithoutDurableState2 = true;
          return {
            event_type: "task_started",
            task_id: input.task_id,
            actor: "user",
            request_id: input.request_id,
            payload: {
              mode: input.mode,
              label: null,
              host_session_hash: privateState.host_session_hash,
              initial_claims: [],
              recovered_from_private: true,
              request_fingerprint: requestFingerprint
            }
          };
        }
        return {
          event_type: "mode_set",
          task_id: input.task_id,
          actor: "user",
          request_id: input.request_id,
          payload: {
            mode: input.mode,
            host_session_hash: privateState.host_session_hash,
            request_fingerprint: requestFingerprint
          }
        };
      }, {
        private_recovery: {
          task_id: input.task_id,
          session_hash: privateState.host_session_hash,
          require_control: true,
          clear_after: true
        }
      });
      this.privateEvents.delete(key);
      return {
        mode: input.mode,
        persistence_note: input.mode === "off" ? "Private changes were discarded; durable semantic reads and writes are disabled." : recoveredWithoutDurableState2 ? "Private in-memory semantics were unavailable after restart; a new empty durable task was explicitly enabled." : "Private changes were discarded; the earlier durable task state is enabled again."
      };
    }
    if (input.mode === "private") {
      const initial = await this.projectEvents(projectId);
      const initialState = durableTaskState(initial, projectId, input.task_id).state;
      const sessionHash = persistedControl?.host_session_hash ?? initialState.host_session_hash;
      if (initialState.started_at === null && persistedControl === null) {
        throw new IntentLoopError("TASK_NOT_FOUND", "task is not associated with this project");
      }
      if (sessionHash === null) {
        throw new IntentLoopError(
          "PRIVATE_SESSION_TOKEN_REQUIRED",
          "this durable task has no host_session_id; start a private task with the hidden session token instead"
        );
      }
      if (initialState.started_at !== null && initialState.host_session_hash !== null && initialState.host_session_hash !== sessionHash) {
        throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "private control does not match the current host session");
      }
      const privateBase = eventsForTask(await this.store.activatePrivateSession(projectId, input.task_id, sessionHash, (all) => {
        const state = durableTaskState(all, projectId, input.task_id).state;
        if (state.started_at === null && persistedControl === null) requireTaskStarted(state);
      }), input.task_id);
      const privateEvents = privateBase.length === 0 ? [memoryEvent(projectId, void 0, {
        event_type: "task_started",
        task_id: input.task_id,
        actor: "user",
        request_id: input.request_id,
        payload: {
          mode: "private",
          label: null,
          host_session_hash: sessionHash,
          initial_claims: [],
          recovered_from_private: true,
          request_fingerprint: requestFingerprint
        }
      })] : [...privateBase, memoryEvent(projectId, privateBase.at(-1), {
        event_type: "mode_set",
        task_id: input.task_id,
        actor: "user",
        request_id: input.request_id,
        payload: {
          mode: "private",
          host_session_hash: sessionHash,
          request_fingerprint: requestFingerprint
        }
      })];
      this.privateEvents.set(key, privateEvents);
      return {
        mode: "private",
        persistence_note: privateBase.length === 0 ? "Prior private semantics were unavailable after restart; a new empty memory-only task is active." : "Semantic changes are memory-only; a hashed control marker suppresses separate Hook processes."
      };
    }
    const recoverySessionHash = persistedControl?.host_session_hash ?? null;
    let recoveredWithoutDurableState = false;
    await this.store.transactAppend(projectId, (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== void 0) {
        assertDuplicateMatches(duplicate, ["mode_set", "task_started"], requestFingerprint);
        if (duplicate.event_type === "task_started" && duplicate.payload.recovered_from_private !== true) {
          throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used by the original task start");
        }
        return null;
      }
      if (state.started_at === null) {
        if (recoverySessionHash === null) requireTaskStarted(state);
        recoveredWithoutDurableState = true;
        return {
          event_type: "task_started",
          task_id: input.task_id,
          actor: "user",
          request_id: input.request_id,
          payload: {
            mode: input.mode,
            label: null,
            host_session_hash: recoverySessionHash,
            initial_claims: [],
            recovered_from_private: true,
            request_fingerprint: requestFingerprint
          }
        };
      }
      if (recoverySessionHash !== null && state.host_session_hash !== null && state.host_session_hash !== recoverySessionHash) {
        throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "private control does not match the durable task session");
      }
      return {
        event_type: "mode_set",
        task_id: input.task_id,
        actor: "user",
        request_id: input.request_id,
        payload: {
          mode: input.mode,
          ...recoverySessionHash === null ? {} : { host_session_hash: recoverySessionHash },
          request_fingerprint: requestFingerprint
        }
      };
    }, recoverySessionHash === null ? {} : {
      private_recovery: {
        task_id: input.task_id,
        session_hash: recoverySessionHash,
        require_control: true,
        clear_after: true
      }
    });
    return {
      mode: input.mode,
      persistence_note: input.mode === "off" ? "Semantic reads and writes are disabled." : recoveredWithoutDurableState ? "Private in-memory semantics were unavailable after restart; a new empty durable task was explicitly enabled." : "Structured local persistence is enabled."
    };
  }
  async delete(input) {
    validateUuid(input.task_id, "task_id");
    const projectId = projectIdForRoot(input.project_root);
    const privateKey = this.key(projectId, input.task_id);
    if (input.target === "task") {
      const expected2 = `DELETE TASK ${input.task_id}`;
      if (input.confirmation !== expected2) {
        throw new IntentLoopError("CONFIRMATION_REQUIRED", `confirmation must equal ${expected2}`);
      }
      const result2 = await this.store.rewriteEvents(
        projectId,
        (all) => all.filter((event) => event.task_id !== input.task_id).map((event) => stripTaskReferencesFromEvent(event, input.task_id)),
        [input.task_id],
        { remove_private_task_id: input.task_id }
      );
      this.privateEvents.delete(privateKey);
      return { deleted: "task", task_id: input.task_id, persistent_files_scanned: result2.scanned_files };
    }
    if (input.claim_id === void 0) throw new IntentLoopError("CLAIM_ID_REQUIRED", "claim_id is required for record deletion");
    validateUuid(input.claim_id, "claim_id");
    const expected = `DELETE CLAIM ${input.claim_id}`;
    if (input.confirmation !== expected) {
      throw new IntentLoopError("CONFIRMATION_REQUIRED", `confirmation must equal ${expected}`);
    }
    const claimId = input.claim_id;
    const privateLedger = this.privateEvents.get(privateKey);
    const claimState = privateLedger === void 0 ? projectTask(eventsForTask(await this.projectEvents(projectId), input.task_id), projectId, input.task_id) : projectTask(privateLedger, projectId, input.task_id);
    requireTaskStarted(claimState);
    if (!claimState.claims.some((claim) => claim.claim_id === claimId)) {
      throw new IntentLoopError("CLAIM_NOT_FOUND", "claim does not exist in this task");
    }
    if (privateLedger !== void 0) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
    }
    const result = await this.store.rewriteEvents(
      projectId,
      (all) => removeClaimFromTaskEvents(all, input.task_id, claimId),
      [claimId]
    );
    if (privateLedger !== void 0) {
      this.privateEvents.set(
        privateKey,
        rechainMemoryEvents(removeClaimFromTaskEvents(privateLedger, input.task_id, claimId))
      );
    }
    return { deleted: "claim", claim_id: claimId, persistent_files_scanned: result.scanned_files };
  }
  async findTaskBySession(projectRoot, sessionId) {
    const projectId = projectIdForRoot(projectRoot);
    const target = hostSessionHash(sessionId);
    return currentTaskForSession(await this.projectEvents(projectId), projectId, target);
  }
  async recordHookObservation(input) {
    const projectId = projectIdForRoot(input.project_root);
    const sessionHash = hostSessionHash(input.session_id);
    const privateControl = await this.store.privateSession(projectId, sessionHash);
    if (privateControl !== null) return { recorded: false, task_id: privateControl.task_id };
    const initial = await this.projectEvents(projectId);
    const taskId = currentTaskForSession(initial, projectId, sessionHash);
    if (taskId === null) return { recorded: false, task_id: null };
    const trustedEventId = input.source_event_id !== void 0 && validSourceEventId(input.source_event_id) ? input.source_event_id : void 0;
    const redactedSourceText = input.source_text === void 0 ? void 0 : redactText(input.source_text).text;
    const requestIdentity = trustedEventId ?? redactedSourceText ?? "none";
    const requestId = `hook:${input.hook_event_name}:${sha256(requestIdentity).slice(0, 24)}`;
    const sourceHash = trustedEventId === void 0 ? sha256(redactedSourceText ?? `${input.hook_event_name}:none`) : sha256(trustedEventId);
    const sourceRef = { kind: input.source_kind, sha256: sourceHash };
    if (trustedEventId !== void 0) {
      sourceRef.event_id = trustedEventId;
    }
    const eventType = input.hook_event_name === "PostCompact" ? "compaction_observed" : input.candidate_type === "result_feedback" ? "result_signal_observed" : "source_observed";
    let recorded = false;
    let resolvedTaskId = taskId;
    await this.store.transactAppend(projectId, async (all) => {
      if (await this.store.privateSession(projectId, sessionHash) !== null) return null;
      resolvedTaskId = currentTaskForSession(all, projectId, sessionHash);
      if (resolvedTaskId === null) return null;
      if (await this.store.privateSessionForTask(projectId, resolvedTaskId) !== null) return null;
      const { taskEvents, state } = durableTaskState(all, projectId, resolvedTaskId);
      requireTaskStarted(state);
      if (state.mode !== "on") return null;
      const duplicate = findRequest(taskEvents, resolvedTaskId, requestId);
      if (duplicate !== void 0) {
        recorded = true;
        return null;
      }
      const candidate = {
        candidate_id: newId(),
        candidate_type: input.candidate_type ?? "prompt_update",
        source_ref: sourceRef,
        created_at: input.occurred_at ?? nowIso()
      };
      recorded = true;
      return {
        event_type: eventType,
        task_id: resolvedTaskId,
        actor: input.source_kind === "user_event" ? "user" : "agent",
        request_id: requestId,
        ...input.occurred_at === void 0 ? {} : { occurred_at: input.occurred_at },
        payload: { candidate, char_count: redactedSourceText?.length ?? 0 }
      };
    });
    return { recorded, task_id: resolvedTaskId };
  }
  async compactForSession(projectRoot, sessionId) {
    const projectId = projectIdForRoot(projectRoot);
    const control = await this.store.privateSession(projectId, hostSessionHash(sessionId));
    if (control !== null) {
      return `[Intent Loop private control active for task_id=${control.task_id}. Do not record or inject semantic state. Private content is process-only and may be unavailable after restart. Keep host_session_id=${JSON.stringify(sessionId)} internal; use it only if the user explicitly starts or re-enables Intent Loop.]`;
    }
    const taskId = await this.findTaskBySession(projectRoot, sessionId);
    if (taskId === null) return null;
    const taskControl = await this.store.privateSessionForTask(projectId, taskId);
    if (taskControl !== null) {
      return `[Intent Loop private control active for task_id=${taskControl.task_id}. Do not record or inject semantic state. Private content is process-only and may be unavailable after restart.]`;
    }
    const state = projectTask(await this.taskEvents(projectId, taskId), projectId, taskId);
    if (state.mode !== "on") return null;
    const identity = `[Intent Loop linked task_id=${taskId}. Keep this ID internal and use it for intent_* tools.]`;
    return activeClaims(state).length === 0 ? identity : `${identity}
${compactForHook(state, 1800)}`;
  }
  static canonicalGraph(graph) {
    return canonicalStringify(graph);
  }
};

// src/hook.ts
var FAIL_OPEN = { continue: true, suppressOutput: true };
function contextOutput(event, context) {
  if (context === null || context.trim() === "") return { ...FAIL_OPEN };
  return {
    ...FAIL_OPEN,
    hookSpecificOutput: { hookEventName: event, additionalContext: context }
  };
}
function associationContext(sessionId) {
  return `[Intent Loop runtime] If Intent Loop is invoked or a costly divergent ambiguity warrants it, pass host_session_id=${JSON.stringify(sessionId)} to intent_start_task. Do not expose this opaque token. Otherwise remain silent.`;
}
async function handleHook(input, environment = process.env, serviceOverride) {
  try {
    if (typeof input.hook_event_name !== "string" || typeof input.session_id !== "string" || typeof input.cwd !== "string") {
      return { ...FAIL_OPEN };
    }
    const service = serviceOverride ?? new IntentService(new LedgerStore(dataRootFromEnvironment(environment)));
    if (input.hook_event_name === "SessionStart") {
      const current = await service.compactForSession(input.cwd, input.session_id);
      return contextOutput("SessionStart", current ?? associationContext(input.session_id));
    }
    if (input.hook_event_name === "UserPromptSubmit") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "user_event",
        candidate_type: "prompt_update",
        ...input.turn_id === void 0 ? {} : { source_event_id: input.turn_id },
        ...input.prompt === void 0 ? {} : { source_text: input.prompt }
      });
      const current = await service.compactForSession(input.cwd, input.session_id);
      return contextOutput("UserPromptSubmit", current ?? associationContext(input.session_id));
    }
    if (input.hook_event_name === "PostCompact") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "agent_turn",
        candidate_type: "recovery_needed",
        ...input.turn_id === void 0 ? {} : { source_event_id: input.turn_id }
      });
      return { ...FAIL_OPEN };
    }
    if (input.hook_event_name === "Stop" || input.hook_event_name === "SessionEnd") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "agent_turn",
        candidate_type: "result_feedback",
        ...input.turn_id === void 0 ? {} : { source_event_id: input.turn_id },
        ...input.last_assistant_message === void 0 ? {} : { source_text: input.last_assistant_message }
      });
      return { ...FAIL_OPEN };
    }
    return { ...FAIL_OPEN };
  } catch {
    return { ...FAIL_OPEN };
  }
}
async function readStandardInput(maxBytes = 1048576) {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error("hook input exceeds size limit");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
function isMainModule() {
  const entry = process.argv[1];
  return entry !== void 0 && import.meta.url === pathToFileURL(entry).href;
}
if (isMainModule()) {
  const output = await readStandardInput().then((body) => handleHook(JSON.parse(body))).catch(() => ({ ...FAIL_OPEN }));
  process.stdout.write(`${JSON.stringify(output)}
`);
}
export {
  handleHook
};
