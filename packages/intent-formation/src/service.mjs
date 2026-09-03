import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { access, chmod, lstat, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import {
  EPISTEMIC_STATUSES,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  FEEDBACK_CLASSES,
  RECORD_ROLES,
  SCOPES,
  SOURCE_KINDS,
  TASK_MODES
} from "./constants.mjs";
import { boundedText, hashText, redactSecrets } from "./privacy.mjs";
import { createEvent, EventStore } from "./store.mjs";

const roles = new Set(RECORD_ROLES);
const epistemicStatuses = new Set(EPISTEMIC_STATUSES);
const sourceKinds = new Set(SOURCE_KINDS);
const scopes = new Set(SCOPES);
const taskModes = new Set(TASK_MODES);
const feedbackClasses = new Set(FEEDBACK_CLASSES);
const recordStatuses = new Set(["active", "superseded", "invalidated"]);
const MAX_IMPORT_BYTES = 1_000_000;
const MAX_IMPORT_RECORDS = 500;
const EXPORT_CLEANUP_ATTEMPTS = 8;
const RETRYABLE_REMOVE_CODES = new Set([
  "EACCES",
  "EBUSY",
  "EMFILE",
  "ENFILE",
  "ENOTEMPTY",
  "EPERM"
]);
const RECORD_EXPORT_KEYS = Object.freeze([
  "record_id", "statement", "redaction_count", "role", "epistemic_status",
  "source_ref", "scope", "scope_ref", "confidence", "valid_from",
  "last_confirmed", "supersedes", "user_confirmed", "confirmation_count",
  "feedback_class", "created_at", "status", "invalidated_reason"
]);
const OFF_MARKER_PREFIX = "off-";

function plainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(name + " must be an object");
  }
  return value;
}

function exactKeys(value, expected, name) {
  const actual = Object.keys(plainObject(value, name)).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new TypeError(name + " has missing or unsupported fields");
  }
}

function makeId(prefix) {
  return prefix + "_" + randomUUID().replaceAll("-", "");
}

function managedExportPrefix(taskId) {
  return "intent-" + hashText(taskId).slice(0, 24) + "-";
}

function offMarkerName(taskId) {
  return OFF_MARKER_PREFIX + hashText(taskId).slice(0, 32);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function removeFileVerified(filePath) {
  let lastError = null;
  for (let attempt = 0; attempt < EXPORT_CLEANUP_ATTEMPTS; attempt += 1) {
    try {
      await rm(filePath, { force: true });
      lastError = null;
    } catch (error) {
      if (error?.code === "ENOENT") return;
      lastError = error;
    }

    try {
      await access(filePath);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      if (!lastError) lastError = error;
    }

    if (lastError && !RETRYABLE_REMOVE_CODES.has(lastError.code)) {
      throw lastError;
    }
    if (attempt + 1 < EXPORT_CLEANUP_ATTEMPTS) {
      await wait(Math.min(25 * (2 ** attempt), 250));
    }
  }

  const error = new Error("could not verify removal of export artifact");
  error.code = lastError?.code || "EEXPORTCLEANUP";
  if (lastError) error.cause = lastError;
  throw error;
}

async function removeFilesVerified(filePaths) {
  const errors = [];
  for (const filePath of new Set(filePaths)) {
    try {
      await removeFileVerified(filePath);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new AggregateError(errors, "failed to remove export artifacts");
  }
}

function cleanTaskId(value) {
  const taskId = boundedText(value, "task_id", 200);
  if (/[\r\n]/.test(taskId)) {
    throw new TypeError("task_id must be a single line");
  }
  return taskId;
}

function cleanRecordId(value, name = "record_id") {
  const recordId = boundedText(value, name, 100);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/u.test(recordId)) {
    throw new TypeError(name + " contains unsupported characters");
  }
  return recordId;
}

function cleanOptionalText(value, name, maximum) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return boundedText(value, name, maximum);
}

function cleanTimestamp(value, name, fallback) {
  const timestamp = value ?? fallback;
  if (timestamp !== null && (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp)))) {
    throw new TypeError(name + " must be an ISO timestamp or null");
  }
  return timestamp;
}

function cleanSourceRef(sourceRef = {}, options = {}) {
  if (!sourceRef || typeof sourceRef !== "object" || Array.isArray(sourceRef)) {
    throw new TypeError("source_ref must be an object");
  }
  if (options.strict === true) {
    exactKeys(sourceRef, ["kind", "ref", "excerpt", "sha256"], "source_ref");
  }
  if (!sourceKinds.has(sourceRef.kind)) {
    throw new TypeError("source_ref.kind is unsupported");
  }

  const refValue = cleanOptionalText(sourceRef.ref, "source_ref.ref", 256);
  const excerptValue = cleanOptionalText(sourceRef.excerpt, "source_ref.excerpt", 160);
  const shaValue = cleanOptionalText(sourceRef.sha256, "source_ref.sha256", 64);
  if (shaValue && !/^[a-f0-9]{64}$/i.test(shaValue)) {
    throw new TypeError("source_ref.sha256 must be a SHA-256 hex digest");
  }

  return {
    kind: sourceRef.kind,
    ref: refValue ? redactSecrets(refValue).text : null,
    excerpt: excerptValue ? redactSecrets(excerptValue).text : null,
    sha256: shaValue ? shaValue.toLowerCase() : null
  };
}

function cleanRecord(input, context) {
  plainObject(input, "record");
  if (!roles.has(input.role)) {
    throw new TypeError("role is unsupported");
  }
  if (!epistemicStatuses.has(input.epistemic_status)) {
    throw new TypeError("epistemic_status is unsupported");
  }
  if (!scopes.has(input.scope)) {
    throw new TypeError("scope is unsupported");
  }
  if (input.role === "unknown" && input.epistemic_status !== "unknown") {
    throw new TypeError("unknown records must use epistemic_status unknown");
  }
  if (input.role === "disagreement" && input.epistemic_status !== "disputed") {
    throw new TypeError("disagreement records must use epistemic_status disputed");
  }
  if (input.epistemic_status === "explicit" && input.source_ref?.kind !== "user_turn") {
    throw new TypeError("explicit records require a user_turn source");
  }
  if (input.epistemic_status === "inferred" && input.source_ref?.kind !== "agent_inference") {
    throw new TypeError("inferred records require an agent_inference source");
  }
  if (
    input.epistemic_status === "evidence" &&
    !["result", "external_evidence"].includes(input.source_ref?.kind)
  ) {
    throw new TypeError("evidence records require a result or external_evidence source");
  }

  const confidence = input.confidence ?? null;
  if (input.epistemic_status === "inferred") {
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      throw new TypeError("inferred records require confidence from 0 to 1");
    }
  } else if (confidence !== null) {
    throw new TypeError("confidence is only valid for inferred records");
  }

  const confirmationCount = input.confirmation_count ?? 0;
  if (!Number.isInteger(confirmationCount) || confirmationCount < 0 || confirmationCount > 1000) {
    throw new TypeError("confirmation_count must be a non-negative integer");
  }
  if (input.user_confirmed !== undefined && typeof input.user_confirmed !== "boolean") {
    throw new TypeError("user_confirmed must be a boolean");
  }
  const userConfirmed = input.user_confirmed === true;
  if (
    input.scope === "long_term" &&
    !(
      (input.epistemic_status === "explicit" && userConfirmed) ||
      (confirmationCount >= 3 && userConfirmed)
    )
  ) {
    throw new TypeError(
      "long_term scope requires an explicit confirmed user rule or confirmation across at least three tasks"
    );
  }

  if (input.supersedes !== undefined && !Array.isArray(input.supersedes)) {
    throw new TypeError("supersedes must be an array");
  }
  const supersedes = Array.isArray(input.supersedes)
    ? [...new Set(input.supersedes.map((id, index) => cleanRecordId(id, `supersedes[${index}]`)))]
    : [];
  if (supersedes.length > 20) {
    throw new TypeError("supersedes must contain at most 20 valid record ids");
  }

  const statement = redactSecrets(boundedText(input.statement, "statement", 2000));
  const scopeRefValue = cleanOptionalText(input.scope_ref, "scope_ref", 256);
  const scopeRef = scopeRefValue ? redactSecrets(scopeRefValue) : { text: null, redactionCount: 0 };
  const feedbackClass = input.feedback_class ?? null;
  if (feedbackClass !== null && !feedbackClasses.has(feedbackClass)) {
    throw new TypeError("feedback_class is unsupported");
  }
  if (input.role === "result_feedback" && feedbackClass === null) {
    throw new TypeError("result_feedback records require feedback_class");
  }
  if (input.role !== "result_feedback" && feedbackClass !== null) {
    throw new TypeError("feedback_class is only valid for result_feedback records");
  }
  const importedRedactionCount = context.importedRedactionCount ?? 0;
  if (!Number.isInteger(importedRedactionCount) || importedRedactionCount < 0) {
    throw new TypeError("redaction_count must be a non-negative integer");
  }
  return {
    record_id: input.record_id === undefined
      ? context.idFactory("rec")
      : cleanRecordId(input.record_id),
    statement: statement.text,
    redaction_count: importedRedactionCount + statement.redactionCount + scopeRef.redactionCount,
    role: input.role,
    epistemic_status: input.epistemic_status,
    source_ref: cleanSourceRef(input.source_ref, { strict: context.strictSourceRef === true }),
    scope: input.scope,
    scope_ref: scopeRef.text,
    confidence,
    valid_from: cleanTimestamp(input.valid_from, "valid_from", context.now),
    last_confirmed: cleanTimestamp(input.last_confirmed, "last_confirmed", null),
    supersedes,
    user_confirmed: userConfirmed,
    confirmation_count: confirmationCount,
    feedback_class: feedbackClass,
    created_at: cleanTimestamp(input.created_at, "created_at", context.now)
  };
}

function scrubPrivateRecordReferences(event, taskId, recordId) {
  if (event.task_id !== taskId) {
    return event;
  }
  if (event.event_type === "record_added") {
    const record = event.payload.record;
    record.supersedes = (record.supersedes || []).filter((id) => id !== recordId);
    if (record.source_ref?.ref === recordId) {
      record.source_ref.ref = null;
    }
    if (record.scope_ref === recordId) {
      record.scope_ref = null;
    }
  }
  return event;
}

function deriveSnapshot(taskId, events, recovery) {
  let mode = "standard";
  let exists = false;
  let label = null;
  const records = new Map();
  const invalidations = new Map();

  for (const event of events.filter((item) => item.task_id === taskId)) {
    if (event.event_type === "task_started") {
      exists = true;
      mode = event.payload.mode || "standard";
      label = event.payload.label ?? label;
    } else if (event.event_type === "task_mode_changed") {
      exists = true;
      mode = event.payload.mode;
    } else if (event.event_type === "record_added") {
      exists = true;
      records.set(event.payload.record.record_id, structuredClone(event.payload.record));
    } else if (event.event_type === "record_invalidated") {
      invalidations.set(event.payload.target_record_id, event.payload.reason || null);
    }
  }

  const materialized = [...records.values()].map((record) => {
    if (invalidations.has(record.record_id)) {
      return {
        ...record,
        status: "invalidated",
        invalidated_reason: invalidations.get(record.record_id)
      };
    }
    return { ...record, status: "active", invalidated_reason: null };
  });
  const byId = new Map(materialized.map((record) => [record.record_id, record]));

  const effectivelySupersededIds = new Set(
    materialized
      .filter((record) => record.status !== "invalidated")
      .flatMap((record) => record.supersedes)
  );
  for (const targetId of effectivelySupersededIds) {
    const target = byId.get(targetId);
    if (target && target.status === "active") {
      target.status = "superseded";
    }
  }

  materialized.sort((left, right) => left.created_at.localeCompare(right.created_at));
  const activeRecords = materialized.filter((record) => record.status === "active");
  return {
    exists,
    task_id: taskId,
    mode,
    label,
    records: materialized,
    active_records: activeRecords,
    recovery: recovery || null
  };
}

function privateMarkerId(taskId, events) {
  let marker = null;
  for (const event of events) {
    if (
      event.task_id === taskId &&
      event.event_type === "task_started" &&
      event.payload.mode === "private"
    ) {
      marker = event.event_id;
    }
  }
  return marker;
}

function compactSnapshot(snapshot, maximum = 900, options = {}) {
  if (!snapshot.exists || snapshot.mode !== "standard" || snapshot.active_records.length === 0) {
    return "";
  }

  const labels = {
    desired_outcome: "Outcome",
    success_signal: "Success",
    failure_signal: "Failure",
    hard_constraint: "Hard constraint",
    soft_constraint: "Preference",
    tradeoff: "Tradeoff",
    unknown: "Unknown",
    result_feedback: "Feedback",
    disagreement: "Disagreement"
  };
  const statuses = {
    explicit: "user",
    inferred: "inference",
    evidence: "evidence",
    unknown: "unknown",
    disputed: "disputed"
  };
  const lines = [];
  const records = options.automaticContext
    ? snapshot.active_records.filter(
        (record) =>
          record.source_ref?.kind === "user_turn" &&
          ["explicit", "unknown", "disputed"].includes(record.epistemic_status)
      )
    : snapshot.active_records;
  for (const record of records) {
    let qualifier = statuses[record.epistemic_status];
    if (record.epistemic_status === "inferred") {
      qualifier += " " + record.confidence.toFixed(2);
    }
    const statement = options.automaticContext
      ? JSON.stringify(record.statement)
      : record.statement;
    lines.push(labels[record.role] + " [" + qualifier + "]: " + statement);
  }
  const text = lines.join("\n");
  return text.length <= maximum ? text : text.slice(0, maximum - 1) + "…";
}

function portableSnapshot(snapshot, exportedAt) {
  const body = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exported_at: exportedAt,
    task: {
      source_task_hash: hashText(snapshot.task_id),
      mode: snapshot.mode,
      label: snapshot.label,
      records: snapshot.records
    }
  };
  return {
    ...body,
    integrity: {
      algorithm: "sha256",
      digest: hashText(JSON.stringify(body))
    }
  };
}

function validatePortablePayload(payload, context) {
  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new TypeError("payload must be JSON-serializable");
  }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized, "utf8") > MAX_IMPORT_BYTES) {
    throw new RangeError("payload must be at most " + MAX_IMPORT_BYTES + " bytes");
  }

  exactKeys(payload, ["format", "version", "exported_at", "task", "integrity"], "payload");
  if (payload.format !== EXPORT_FORMAT || payload.version !== EXPORT_VERSION) {
    throw new TypeError("unsupported export format or version");
  }
  cleanTimestamp(payload.exported_at, "exported_at", null);

  exactKeys(payload.integrity, ["algorithm", "digest"], "payload.integrity");
  if (
    payload.integrity.algorithm !== "sha256" ||
    typeof payload.integrity.digest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(payload.integrity.digest)
  ) {
    throw new TypeError("export integrity metadata is invalid");
  }

  exactKeys(payload.task, ["source_task_hash", "mode", "label", "records"], "payload.task");
  if (
    typeof payload.task.source_task_hash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(payload.task.source_task_hash)
  ) {
    throw new TypeError("source_task_hash must be a lowercase SHA-256 digest");
  }
  if (!taskModes.has(payload.task.mode)) {
    throw new TypeError("export task mode is unsupported");
  }
  const labelValue = cleanOptionalText(payload.task.label, "payload.task.label", 120);
  const label = labelValue ? redactSecrets(labelValue).text : null;
  if (!Array.isArray(payload.task.records)) {
    throw new TypeError("payload.task.records must be an array");
  }
  if (payload.task.records.length > MAX_IMPORT_RECORDS) {
    throw new RangeError("payload.task.records must contain at most " + MAX_IMPORT_RECORDS + " records");
  }

  const body = {
    format: payload.format,
    version: payload.version,
    exported_at: payload.exported_at,
    task: payload.task
  };
  if (payload.integrity.digest !== hashText(JSON.stringify(body))) {
    throw new TypeError("export integrity check failed");
  }

  const records = payload.task.records.map((exportedRecord, index) => {
    exactKeys(exportedRecord, RECORD_EXPORT_KEYS, `payload.task.records[${index}]`);
    if (!recordStatuses.has(exportedRecord.status)) {
      throw new TypeError("imported record status is unsupported");
    }
    if (!Number.isInteger(exportedRecord.redaction_count) || exportedRecord.redaction_count < 0) {
      throw new TypeError("redaction_count must be a non-negative integer");
    }
    const reasonValue = cleanOptionalText(
      exportedRecord.invalidated_reason,
      "invalidated_reason",
      300
    );
    if (exportedRecord.status !== "invalidated" && reasonValue !== null) {
      throw new TypeError("invalidated_reason is only valid for invalidated records");
    }
    const invalidatedReason = reasonValue
      ? redactSecrets(reasonValue).text
      : exportedRecord.status === "invalidated"
        ? "invalidated before export"
        : null;
    const record = cleanRecord(exportedRecord, {
      now: exportedRecord.created_at,
      idFactory: context.idFactory,
      importedRedactionCount: exportedRecord.redaction_count,
      strictSourceRef: true
    });
    return {
      status: exportedRecord.status,
      invalidated_reason: invalidatedReason,
      record
    };
  });

  const importedIds = new Set();
  for (const { record } of records) {
    if (importedIds.has(record.record_id)) {
      throw new TypeError("duplicate imported record_id: " + record.record_id);
    }
    importedIds.add(record.record_id);
  }
  const supersededIds = new Set(
    records
      .filter((item) => item.status !== "invalidated")
      .flatMap(({ record }) => record.supersedes)
  );
  for (const item of records) {
    if (item.status === "superseded" && !supersededIds.has(item.record.record_id)) {
      throw new TypeError("superseded imported record has no superseding record");
    }
    if (item.status === "active" && supersededIds.has(item.record.record_id)) {
      throw new TypeError("active imported record is superseded by another imported record");
    }
  }

  return {
    mode: payload.task.mode,
    label,
    records
  };
}

function inferCodexHome(candidate) {
  if (!candidate || candidate.includes("${")) {
    return null;
  }

  let current = path.resolve(candidate);
  while (true) {
    const parent = path.dirname(current);
    if (
      path.basename(current).toLowerCase() === "cache" &&
      path.basename(parent).toLowerCase() === "plugins"
    ) {
      return path.dirname(parent);
    }
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveDataDirectory(
  environment = process.env,
  workingDirectory = process.cwd()
) {
  const explicit = environment.INTENT_FORMATION_DATA_DIR;
  if (explicit && !explicit.includes("${")) {
    return path.resolve(explicit);
  }

  const inferredCodexHome =
    inferCodexHome(environment.PLUGIN_ROOT) || inferCodexHome(workingDirectory);
  if (inferredCodexHome) {
    return path.join(inferredCodexHome, "plugin-data", "intent-formation");
  }

  const pluginData = environment.PLUGIN_DATA;
  if (pluginData && !pluginData.includes("${")) {
    return path.resolve(pluginData);
  }

  const codexHome = environment.CODEX_HOME;
  const configured = codexHome && !codexHome.includes("${")
    ? path.join(codexHome, "plugin-data", "intent-formation")
    : path.join(os.homedir(), ".codex", "plugin-data", "intent-formation");
  return path.resolve(configured);
}

export class IntentService {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date().toISOString());
    this.idFactory = options.idFactory || makeId;
    this.store =
      options.store ||
      new EventStore({
        dataDirectory: options.dataDirectory || resolveDataDirectory(options.environment)
      });
    this.exportDirectory = path.join(this.store.dataDirectory, "exports");
    this.modeMarkerDirectory = path.join(this.store.dataDirectory, "mode-markers");
    this.privateEvents = new Map();
    this.privateMarkers = new Map();
    this.taskMutationTails = new Map();
  }

  async serializeTaskMutation(taskId, operation) {
    const previous = this.taskMutationTails.get(taskId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    this.taskMutationTails.set(taskId, current);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.taskMutationTails.get(taskId) === current) {
        this.taskMutationTails.delete(taskId);
      }
    }
  }

  async purgeManagedExports(taskId) {
    let entries;
    try {
      entries = await readdir(this.exportDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return 0;
      throw error;
    }

    const prefix = managedExportPrefix(taskId);
    let removed = 0;
    for (const entry of entries) {
      if (
        entry.isFile() &&
        entry.name.startsWith(prefix) &&
        (entry.name.endsWith(".json") || entry.name.endsWith(".tmp"))
      ) {
        await removeFileVerified(path.join(this.exportDirectory, entry.name));
        removed += 1;
      }
    }
    return removed;
  }

  offMarkerPath(taskId) {
    return path.join(this.modeMarkerDirectory, offMarkerName(taskId));
  }

  async writeOffModeMarker(taskId) {
    await mkdir(this.modeMarkerDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.modeMarkerDirectory, 0o700);
    const markerPath = this.offMarkerPath(taskId);
    try {
      await mkdir(markerPath, { mode: 0o700 });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    const marker = await lstat(markerPath);
    if (marker.isSymbolicLink() || !marker.isDirectory()) {
      throw new Error("intent off marker path is not a real directory");
    }
    await chmod(markerPath, 0o700);
  }

  async clearOffModeMarker(taskId) {
    const markerPath = this.offMarkerPath(taskId);
    let marker;
    try {
      marker = await lstat(markerPath);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    if (marker.isSymbolicLink() || !marker.isDirectory()) {
      throw new Error("intent off marker path is not a real directory");
    }
    await rm(markerPath, { recursive: true, force: true });
    try {
      await lstat(markerPath);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    throw new Error("could not verify removal of intent off marker");
  }

  async syncOffModeMarker(taskId, mode) {
    if (mode === "off") {
      await this.writeOffModeMarker(taskId);
    } else {
      await this.clearOffModeMarker(taskId);
    }
  }

  async fastTaskMode(input) {
    const taskId = cleanTaskId(input.task_id);
    try {
      const marker = await lstat(this.offMarkerPath(taskId));
      return marker.isDirectory() && !marker.isSymbolicLink() ? "off" : null;
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
      throw error;
    }
  }

  event(taskId, eventType, payload, occurredAt = this.clock()) {
    return createEvent({
      event_id: this.idFactory("evt"),
      event_type: eventType,
      occurred_at: occurredAt,
      task_id: taskId,
      payload
    });
  }

  async persistentTaskEvents(taskId) {
    const loaded = await this.store.readAll();
    return {
      events: loaded.events.filter((event) => event.task_id === taskId),
      recovery: loaded.recovery
    };
  }

  async taskMode(taskId) {
    const persistent = await this.persistentTaskEvents(taskId);
    return deriveSnapshot(taskId, persistent.events, persistent.recovery).mode;
  }

  async allTaskEvents(taskId) {
    const persistent = await this.persistentTaskEvents(taskId);
    const persistentSnapshot = deriveSnapshot(taskId, persistent.events, persistent.recovery);
    const marker = privateMarkerId(taskId, persistent.events);
    const ownsPrivateSession =
      persistentSnapshot.mode === "private" && this.privateMarkers.get(taskId) === marker;
    if (!ownsPrivateSession) {
      this.privateEvents.delete(taskId);
      if (persistentSnapshot.mode !== "private") {
        this.privateMarkers.delete(taskId);
      }
    }
    const privateEvents =
      ownsPrivateSession ? this.privateEvents.get(taskId) || [] : [];
    return {
      events: persistent.events.concat(privateEvents),
      recovery: persistent.recovery
    };
  }

  async startTask(input) {
    const taskId = cleanTaskId(input.task_id);
    const mode = input.mode || "standard";
    if (!taskModes.has(mode)) {
      throw new TypeError("mode is unsupported");
    }
    return this.serializeTaskMutation(taskId, () =>
      this.startTaskLocked(input, taskId, mode)
    );
  }

  async startTaskLocked(input, taskId, mode) {
    const labelValue = cleanOptionalText(input.label, "label", 120);
    const label = labelValue ? redactSecrets(labelValue).text : null;
    const cwdHash = input.cwd ? hashText(boundedText(input.cwd, "cwd", 2000)) : null;
    const startEvent = this.event(taskId, "task_started", {
      mode,
      label,
      cwd_hash: cwdHash
    });
    const result = await this.store.replaceTaskIf(
      taskId,
      [startEvent],
      (events) => {
        const snapshot = deriveSnapshot(taskId, events, null);
        return input.reset === true || !snapshot.exists;
      },
      {
        afterCommit: async () => {
          await this.purgeManagedExports(taskId);
          await this.syncOffModeMarker(taskId, mode);
        }
      }
    );
    if (!result.replaced) {
      const currentSnapshot = deriveSnapshot(taskId, result.events, result.recovery);
      if (currentSnapshot.mode !== mode) {
        return this.setModeLocked({ task_id: taskId, mode }, taskId, mode);
      }
      const stable = await this.store.withLockedEvents(async (current) => {
        const snapshot = deriveSnapshot(taskId, current.events, current.recovery);
        if (!snapshot.exists || snapshot.mode !== mode) return false;
        if (mode === "private") await this.purgeManagedExports(taskId);
        await this.syncOffModeMarker(taskId, mode);
        return true;
      });
      if (!stable) {
        return this.setModeLocked({ task_id: taskId, mode }, taskId, mode);
      }
      return this.show({ task_id: taskId });
    }

    this.privateEvents.delete(taskId);
    this.privateMarkers.delete(taskId);
    if (mode === "private") {
      this.privateEvents.set(taskId, []);
      this.privateMarkers.set(taskId, startEvent.event_id);
    }
    return this.show({ task_id: taskId });
  }

  async setMode(input) {
    const taskId = cleanTaskId(input.task_id);
    const mode = input.mode;
    if (!taskModes.has(mode)) {
      throw new TypeError("mode is unsupported");
    }
    return this.serializeTaskMutation(taskId, () =>
      this.setModeLocked(input, taskId, mode)
    );
  }

  async setModeLocked(input, taskId, mode) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await this.show({ task_id: taskId });
      if (!current.exists) {
        return this.startTaskLocked({ task_id: taskId, mode }, taskId, mode);
      }

      if (current.mode === mode) {
        const stable = await this.store.withLockedEvents(async (loaded) => {
          const snapshot = deriveSnapshot(taskId, loaded.events, loaded.recovery);
          if (!snapshot.exists || snapshot.mode !== mode) return false;
          if (mode === "private") await this.purgeManagedExports(taskId);
          await this.syncOffModeMarker(taskId, mode);
          return true;
        });
        if (!stable) continue;
        return this.show({ task_id: taskId });
      }

      if (mode === "private" || current.mode === "private") {
        const replacementStart = this.event(taskId, "task_started", {
          mode,
          label: null,
          cwd_hash: null
        });
        const replaced = await this.store.replaceTaskIf(
          taskId,
          [replacementStart],
          (events) => {
            const snapshot = deriveSnapshot(taskId, events, null);
            return snapshot.exists && snapshot.mode === current.mode;
          },
          {
            afterCommit: async () => {
              await this.purgeManagedExports(taskId);
              await this.syncOffModeMarker(taskId, mode);
            }
          }
        );
        if (!replaced.replaced) continue;
        if (mode === "private") {
          this.privateEvents.set(taskId, []);
          this.privateMarkers.set(taskId, replacementStart.event_id);
        } else {
          this.privateEvents.delete(taskId);
          this.privateMarkers.delete(taskId);
        }
        return this.show({ task_id: taskId });
      }

      const changed = await this.store.appendIf(
        this.event(taskId, "task_mode_changed", { mode }),
        (events) => {
          const snapshot = deriveSnapshot(taskId, events, null);
          return snapshot.exists && snapshot.mode === current.mode && snapshot.mode !== "private";
        },
        {
          afterCommit: async () => this.syncOffModeMarker(taskId, mode)
        }
      );
      if (!changed.appended) continue;
      return this.show({ task_id: taskId });
    }
    throw new Error("intent mode changed repeatedly before the requested mode could be set");
  }

  async appendForMode(taskId, event, options = {}) {
    return this.appendManyForMode(taskId, [event], options);
  }

  async appendManyForMode(taskId, additions, options = {}) {
    return this.serializeTaskMutation(taskId, () =>
      this.appendManyForModeLocked(taskId, additions, options)
    );
  }

  async appendManyForModeLocked(taskId, additions, options = {}) {
    if (!Array.isArray(additions) || additions.length === 0) {
      throw new TypeError("at least one event is required");
    }
    const validateSnapshot = options.validateSnapshot;
    if (validateSnapshot !== undefined && typeof validateSnapshot !== "function") {
      throw new TypeError("validateSnapshot must be a function");
    }
    const result = await this.store.appendIf(additions, (events) => {
      const snapshot = deriveSnapshot(taskId, events, null);
      if (!snapshot.exists || snapshot.mode !== "standard") {
        return false;
      }
      validateSnapshot?.(snapshot);
      return true;
    });
    if (result.appended) {
      return;
    }
    const snapshot = deriveSnapshot(taskId, result.events, result.recovery);
    if (!snapshot.exists) {
      validateSnapshot?.(snapshot);
      throw new Error("intent task no longer exists");
    }
    if (snapshot.mode === "off") {
      throw new Error("intent tracking is off for this task");
    }
    if (snapshot.mode === "private") {
      const marker = privateMarkerId(taskId, result.events);
      const ownedMarker = this.privateMarkers.get(taskId);
      if (!marker || (ownedMarker !== undefined && ownedMarker !== marker)) {
        throw new Error("private intent session changed before the update completed");
      }
      if (ownedMarker === undefined) {
        this.privateMarkers.set(taskId, marker);
        this.privateEvents.set(taskId, []);
      }
      const events = this.privateEvents.get(taskId) || [];
      validateSnapshot?.(
        deriveSnapshot(taskId, result.events.concat(events), result.recovery)
      );
      events.push(...additions);
      this.privateEvents.set(taskId, events);
      return;
    }
    throw new Error("intent state changed before the update could be saved");
  }

  async ensureStarted(taskId) {
    const snapshot = await this.show({ task_id: taskId });
    if (!snapshot.exists) {
      await this.startTask({ task_id: taskId, mode: "standard" });
    }
  }

  async addRecord(input) {
    const taskId = cleanTaskId(input.task_id);
    const now = this.clock();
    const record = cleanRecord(input, {
      now,
      idFactory: this.idFactory
    });
    if (record.supersedes.includes(record.record_id)) {
      throw new TypeError("a record cannot supersede itself");
    }
    return this.serializeTaskMutation(taskId, () =>
      this.addRecordLocked(taskId, record)
    );
  }

  async addRecordLocked(taskId, record) {
    const validateSnapshot = (current) => {
      const knownIds = new Set(current.records.map((item) => item.record_id));
      const unknownTargets = record.supersedes.filter((id) => !knownIds.has(id));
      if (unknownTargets.length > 0) {
        throw new TypeError(
          "unknown superseded record ids: " + unknownTargets.join(", ")
        );
      }
    };

    const snapshot = await this.show({ task_id: taskId });
    if (snapshot.mode === "off") {
      throw new Error("intent tracking is off for this task");
    }
    if (!snapshot.exists) {
      validateSnapshot(snapshot);
      await this.startTaskLocked({ task_id: taskId, mode: "standard" }, taskId, "standard");
    }

    await this.appendManyForModeLocked(
      taskId,
      [this.event(taskId, "record_added", { record }, record.created_at)],
      { validateSnapshot }
    );
    return {
      record,
      snapshot: await this.show({ task_id: taskId })
    };
  }

  async addExplicit(input) {
    return this.addRecord({
      ...input,
      epistemic_status: "explicit",
      confidence: null,
      source_ref: { ...input.source_ref, kind: "user_turn" }
    });
  }

  async addInference(input) {
    return this.addRecord({
      ...input,
      epistemic_status: "inferred",
      source_ref: { ...input.source_ref, kind: "agent_inference" }
    });
  }

  async addEvidence(input) {
    const sourceKind = input.source_ref?.kind || "result";
    if (!["result", "external_evidence"].includes(sourceKind)) {
      throw new TypeError("evidence source must be result or external_evidence");
    }
    return this.addRecord({
      ...input,
      epistemic_status: "evidence",
      confidence: null,
      source_ref: { ...input.source_ref, kind: sourceKind }
    });
  }

  async markUnknown(input) {
    return this.addRecord({
      ...input,
      role: "unknown",
      epistemic_status: "unknown",
      confidence: null,
      source_ref: {
        ...input.source_ref,
        kind: input.source_ref?.kind || "user_turn"
      }
    });
  }

  async markDisagreement(input) {
    return this.addRecord({
      ...input,
      role: "disagreement",
      epistemic_status: "disputed",
      confidence: null,
      source_ref: {
        ...input.source_ref,
        kind: input.source_ref?.kind || "user_turn"
      }
    });
  }

  async addFeedback(input) {
    if (!feedbackClasses.has(input.feedback_class)) {
      throw new TypeError("feedback_class is unsupported");
    }
    if (input.feedback_class !== "intent_change" && (input.supersedes?.length || 0) > 0) {
      throw new TypeError("only intent_change feedback may supersede prior intent");
    }
    const result = await this.addRecord({
      ...input,
      role: "result_feedback",
      epistemic_status: "explicit",
      confidence: null,
      feedback_class: input.feedback_class,
      source_ref: { ...input.source_ref, kind: "user_turn" }
    });
    return result;
  }

  async invalidate(input) {
    const taskId = cleanTaskId(input.task_id);
    const recordId = boundedText(input.record_id, "record_id", 100);
    const reasonValue = cleanOptionalText(input.reason, "reason", 300);
    const reason = reasonValue ? redactSecrets(reasonValue).text : null;
    return this.serializeTaskMutation(taskId, async () => {
      await this.appendManyForModeLocked(
        taskId,
        [this.event(taskId, "record_invalidated", {
          target_record_id: recordId,
          reason
        })],
        {
          validateSnapshot(snapshot) {
            if (!snapshot.records.some((record) => record.record_id === recordId)) {
              throw new TypeError("record_id does not exist in this task");
            }
          }
        }
      );
      return this.show({ task_id: taskId });
    });
  }

  async show(input) {
    const taskId = cleanTaskId(input.task_id);
    const loaded = await this.allTaskEvents(taskId);
    const snapshot = deriveSnapshot(taskId, loaded.events, loaded.recovery);
    return {
      ...snapshot,
      compact: compactSnapshot(snapshot, input.maximum ?? 900),
      context_compact: compactSnapshot(snapshot, input.maximum ?? 900, {
        automaticContext: true
      })
    };
  }

  async deleteRecord(input) {
    const taskId = cleanTaskId(input.task_id);
    const recordId = boundedText(input.record_id, "record_id", 100);
    return this.serializeTaskMutation(taskId, () =>
      this.deleteRecordLocked(taskId, recordId)
    );
  }

  async deleteRecordLocked(taskId, recordId) {
    let removedPrivateEvents = 0;
    const privateEvents = this.privateEvents.get(taskId) || [];
    const keptPrivateEvents = [];
    for (const event of privateEvents) {
      if (
        (event.event_type === "record_added" &&
          event.payload.record?.record_id === recordId) ||
        (event.event_type === "record_invalidated" &&
          event.payload.target_record_id === recordId)
      ) {
        removedPrivateEvents += 1;
        continue;
      }
      keptPrivateEvents.push(scrubPrivateRecordReferences(event, taskId, recordId));
    }
    if (this.privateEvents.has(taskId)) {
      this.privateEvents.set(taskId, keptPrivateEvents);
    }

    let removedManagedExports = 0;
    const removedPersistentEvents = await this.store.purgeRecord(taskId, recordId, {
      afterCommit: async () => {
        removedManagedExports = await this.purgeManagedExports(taskId);
      }
    });
    const removed = removedPersistentEvents + removedPrivateEvents;
    return {
      deleted: removed > 0,
      removed_events: removed,
      removed_exports: removedManagedExports,
      snapshot: await this.show({ task_id: taskId })
    };
  }

  async deleteTask(input) {
    const taskId = cleanTaskId(input.task_id);
    return this.serializeTaskMutation(taskId, () => this.deleteTaskLocked(taskId));
  }

  async deleteTaskLocked(taskId) {
    const removedPrivateEvents = (this.privateEvents.get(taskId) || []).length;
    let removedManagedExports = 0;
    const removedPersistentEvents = await this.store.purgeTask(taskId, {
      afterCommit: async () => {
        removedManagedExports = await this.purgeManagedExports(taskId);
        await this.clearOffModeMarker(taskId);
      }
    });
    this.privateEvents.delete(taskId);
    this.privateMarkers.delete(taskId);
    const verification = await this.show({ task_id: taskId });
    return {
      deleted: removedPersistentEvents + removedPrivateEvents + removedManagedExports > 0,
      removed_events: removedPersistentEvents + removedPrivateEvents,
      removed_exports: removedManagedExports,
      exists_after: verification.exists
    };
  }

  async exportTask(input) {
    const snapshot = await this.show(input);
    if (!snapshot.exists) {
      throw new TypeError("task does not exist");
    }
    return portableSnapshot(snapshot, this.clock());
  }

  async exportTaskFile(input) {
    const taskId = cleanTaskId(input.task_id);
    return this.serializeTaskMutation(taskId, () =>
      this.exportTaskFileLocked(taskId)
    );
  }

  async exportTaskFileLocked(taskId) {
    return this.store.withLockedEvents(async (loaded) => {
      const snapshot = deriveSnapshot(taskId, loaded.events, loaded.recovery);
      if (!snapshot.exists) {
        throw new TypeError("task does not exist");
      }
      if (snapshot.mode === "private") {
        throw new Error("private intent state cannot be exported to disk");
      }

      const payload = portableSnapshot(snapshot, this.clock());
      const body = JSON.stringify(payload, null, 2) + "\n";
      const prefix = managedExportPrefix(taskId);
      const suffix = randomUUID().slice(0, 8);
      const filename = prefix + payload.integrity.digest.slice(0, 16) + "-" + suffix + ".json";
      const targetPath = path.join(this.exportDirectory, filename);
      const temporaryPath = targetPath + "." + randomUUID().slice(0, 8) + ".tmp";

      await mkdir(this.exportDirectory, { recursive: true, mode: 0o700 });
      await chmod(this.exportDirectory, 0o700);
      try {
        await writeFile(temporaryPath, body, {
          encoding: "utf8",
          flag: "wx",
          mode: 0o600
        });
        await rename(temporaryPath, targetPath);
        await chmod(targetPath, 0o600);
      } catch (error) {
        try {
          await removeFilesVerified([temporaryPath, targetPath]);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "export failed and cleanup could not be verified"
          );
        }
        throw error;
      }

      return {
        export_id: filename,
        path: targetPath,
        bytes: Buffer.byteLength(body),
        record_count: payload.task.records.length,
        format: payload.format,
        version: payload.version,
        integrity: payload.integrity
      };
    });
  }

  async importTask(input) {
    const taskId = cleanTaskId(input.task_id);
    if (input.user_confirmed !== true) {
      throw new TypeError("intent import requires explicit user confirmation");
    }
    const imported = validatePortablePayload(input.payload, { idFactory: this.idFactory });
    return this.serializeTaskMutation(taskId, () =>
      this.importTaskLocked(input, taskId, imported)
    );
  }

  async importTaskLocked(input, taskId, imported) {
    const existing = await this.show({ task_id: taskId });
    if (existing.exists && input.merge !== true) {
      throw new Error("target task already exists; set merge=true to combine explicitly");
    }
    if (existing.exists && existing.mode === "off") {
      throw new Error("cannot merge into an off task; explicitly change its mode first");
    }

    const validateImportAgainst = (snapshot) => {
      const knownIds = new Set(snapshot.records.map((record) => record.record_id));
      const importedIds = new Set();
      for (const { record } of imported.records) {
        if (knownIds.has(record.record_id) || importedIds.has(record.record_id)) {
          throw new TypeError("duplicate imported record_id: " + record.record_id);
        }
        importedIds.add(record.record_id);
      }
      for (const { record } of imported.records) {
        for (const targetId of record.supersedes) {
          if (!knownIds.has(targetId) && !importedIds.has(targetId)) {
            throw new TypeError("import references unknown superseded record: " + targetId);
          }
        }
      }
    };
    validateImportAgainst(existing);

    const importedEvents = [];
    for (const item of imported.records) {
      importedEvents.push(
        this.event(taskId, "record_added", { record: item.record }, item.record.created_at)
      );
      if (item.status === "invalidated") {
        importedEvents.push(
          this.event(taskId, "record_invalidated", {
            target_record_id: item.record.record_id,
            reason: item.invalidated_reason
          })
        );
      }
    }

    const createdTarget = !existing.exists;
    if (createdTarget) {
      const startEvent = this.event(taskId, "task_started", {
        mode: imported.mode,
        label: imported.label,
        cwd_hash: null
      });
      const replacementEvents = imported.mode === "private"
        ? [startEvent]
        : [startEvent, ...importedEvents];
      const created = await this.store.replaceTaskIf(
        taskId,
        replacementEvents,
        (events) => !deriveSnapshot(taskId, events, null).exists,
        {
          afterCommit: async () => {
            await this.purgeManagedExports(taskId);
            await this.syncOffModeMarker(taskId, imported.mode);
          }
        }
      );
      if (!created.replaced) {
        throw new Error("target task already exists; set merge=true to combine explicitly");
      }
      if (imported.mode === "private") {
        this.privateMarkers.set(taskId, startEvent.event_id);
        this.privateEvents.set(taskId, importedEvents);
      } else {
        this.privateMarkers.delete(taskId);
        this.privateEvents.delete(taskId);
      }
    } else {
      await this.appendManyForModeLocked(taskId, importedEvents, {
        validateSnapshot: validateImportAgainst
      });
    }

    return {
      imported_records: imported.records.length,
      snapshot: await this.show({ task_id: taskId })
    };
  }
}

export { compactSnapshot, deriveSnapshot };
