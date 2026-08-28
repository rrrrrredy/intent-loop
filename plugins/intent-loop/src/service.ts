import { atomicStatement, findKnownCredentialKinds, redactText } from "./redaction.js";
import { canonicalStringify, hostSessionHash, newId, nowIso, projectIdForRoot, sha256 } from "./canonical.js";
import { IntentLoopError } from "./errors.js";
import { activeClaims, compactForHook, LONG_TERM_STALE_MS, projectTask, snapshotFromState } from "./projection.js";
import { LedgerStore, NewEvent, eventHash } from "./storage.js";
import {
  Candidate,
  Claim,
  ClaimRole,
  ClaimScope,
  EpistemicStatus,
  IntentFacet,
  IntentMode,
  LedgerEvent,
  PortableGraph,
  SCHEMA_VERSION,
  Snapshot,
  SourceRef
} from "./types.js";
import {
  cloneClaim,
  confirmationTimestamp,
  normalizeFacets,
  normalizeSourceRef,
  requireTaskStarted,
  sanitizeLabel,
  validSourceEventId,
  validateRequestId,
  validateUuid
} from "./validation.js";

export interface AddClaimInput {
  project_root: string;
  task_id: string;
  request_id: string;
  statement: string;
  role: ClaimRole;
  epistemic_status: EpistemicStatus;
  source_ref: SourceRef;
  scope: ClaimScope;
  confidence?: number;
  facets: IntentFacet[];
  related_claim_ids?: string[];
  supersedes?: string[];
  last_confirmed?: string | null;
  result_feedback_class?: "keep" | "implementation_change" | "intent_change" | "uncertain";
  require_long_term_candidate?: boolean;
}

export interface StartTaskInput {
  project_root: string;
  request_id: string;
  task_id?: string;
  label?: string;
  host_session_id?: string;
  mode?: IntentMode;
  initial_explicit?: Array<{
    statement: string;
    scope?: ClaimScope;
    facets: IntentFacet[];
  }>;
}

export interface HookObservation {
  project_root: string;
  session_id: string;
  hook_event_name: string;
  source_event_id?: string;
  source_text?: string;
  source_kind: "user_event" | "agent_turn";
  candidate_type?: Candidate["candidate_type"];
  occurred_at?: string;
}

function findRequest(events: LedgerEvent[], taskId: string, requestId: string): LedgerEvent | undefined {
  return events.find((event) => event.task_id === taskId && event.request_id === requestId);
}

function mutationFingerprint(operation: string, normalizedInput: unknown): string {
  return sha256(canonicalStringify({ operation, input: normalizedInput }));
}

function assertDuplicateMatches(
  event: LedgerEvent,
  expectedTypes: LedgerEvent["event_type"][],
  fingerprint: string
): void {
  if (!expectedTypes.includes(event.event_type) || event.payload.request_fingerprint !== fingerprint) {
    throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used with different operation parameters");
  }
}

function deterministicTaskId(projectId: string, requestId: string): string {
  const digest = sha256(canonicalStringify({ namespace: "intent-loop-start", project_id: projectId, request_id: requestId }));
  const variant = ((Number.parseInt(digest[16] ?? "0", 16) & 0x3) | 0x8).toString(16);
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-${variant}${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function makeInitialExplicitClaims(
  items: StartTaskInput["initial_explicit"],
  requestId: string
): Claim[] {
  const input = items ?? [];
  if (input.length > 12) {
    throw new IntentLoopError("INITIAL_CLAIM_LIMIT", "start accepts at most 12 directly stated initial claims");
  }
  const scopes = new Set<ClaimScope>(["task", "project", "long_term"]);
  const facets = new Set<IntentFacet>([
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

function memoryEvent(projectId: string, previous: LedgerEvent | undefined, input: NewEvent): LedgerEvent {
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
    prev_hash: previous?.event_hash ?? null
  };
  return { ...unsigned, event_hash: eventHash(unsigned) };
}

function stripClaimReference(claim: Claim, targetId: string): Claim {
  return {
    ...claim,
    supersedes: claim.supersedes.filter((id) => id !== targetId),
    related_claim_ids: claim.related_claim_ids.filter((id) => id !== targetId)
  };
}

function stripTaskReference(candidate: Candidate, targetTaskId: string): Candidate {
  const copy = JSON.parse(JSON.stringify(candidate)) as Candidate;
  if (copy.task_ids !== undefined) {
    copy.task_ids = copy.task_ids.filter((taskId) => taskId !== targetTaskId);
  }
  return copy;
}

function stripTaskReferencesFromEvent(event: LedgerEvent, targetTaskId: string): LedgerEvent {
  if (
    event.event_type === "candidate_added" ||
    event.event_type === "source_observed" ||
    event.event_type === "result_signal_observed" ||
    event.event_type === "compaction_observed"
  ) {
    const candidate = event.payload.candidate as Candidate | undefined;
    return candidate === undefined
      ? event
      : { ...event, payload: { ...event.payload, candidate: stripTaskReference(candidate, targetTaskId) } };
  }
  if (event.event_type === "graph_imported") {
    const candidates = Array.isArray(event.payload.candidates)
      ? (event.payload.candidates as Candidate[]).map((candidate) => stripTaskReference(candidate, targetTaskId))
      : [];
    const importedFrom = event.payload.imported_from;
    let normalizedImport = importedFrom;
    if (importedFrom !== null && typeof importedFrom === "object" && !Array.isArray(importedFrom)) {
      const copy = { ...(importedFrom as Record<string, unknown>) };
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

function removeClaimFromTaskEvents(events: LedgerEvent[], taskId: string, claimId: string): LedgerEvent[] {
  const rewritten: LedgerEvent[] = [];
  for (const event of events) {
    if (event.task_id !== taskId) {
      rewritten.push(event);
    } else if (event.event_type === "claim_added" || event.event_type === "claim_replaced") {
      const claim = event.payload.claim as Claim | undefined;
      if (claim?.claim_id !== claimId) {
        rewritten.push(claim === undefined ? event : {
          ...event,
          payload: { ...event.payload, claim: stripClaimReference(claim, claimId) }
        });
      }
    } else if (event.event_type === "task_started") {
      const priorInitialClaims = Array.isArray(event.payload.initial_claims)
        ? event.payload.initial_claims as Claim[]
        : [];
      const initialClaims = priorInitialClaims
          .filter((claim) => claim.claim_id !== claimId)
          .map((claim) => stripClaimReference(claim, claimId));
      const payload: Record<string, unknown> = { ...event.payload, initial_claims: initialClaims };
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
      const priorClaims = Array.isArray(event.payload.claims)
        ? event.payload.claims as Claim[]
        : [];
      const claims = priorClaims
          .filter((claim) => claim.claim_id !== claimId)
          .map((claim) => stripClaimReference(claim, claimId));
      const invalidated = Array.isArray(event.payload.invalidated_claim_ids)
        ? event.payload.invalidated_claim_ids.filter((id) => id !== claimId)
        : [];
      const payload: Record<string, unknown> = {
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

function rechainMemoryEvents(events: LedgerEvent[]): LedgerEvent[] {
  let previous: string | null = null;
  return events.map((event) => {
    const { event_hash: _eventHash, ...rest } = event;
    const unsigned: Omit<LedgerEvent, "event_hash"> = { ...rest, prev_hash: previous };
    const next = { ...unsigned, event_hash: eventHash(unsigned) };
    previous = next.event_hash;
    return next;
  });
}

function eventsForTask(events: LedgerEvent[], taskId: string): LedgerEvent[] {
  return events.filter((event) => event.task_id === taskId);
}

function currentTaskForSession(events: LedgerEvent[], projectId: string, sessionHash: string): string | null {
  const taskIds = [...new Set(events.map((event) => event.task_id))];
  const matches = taskIds
    .map((taskId) => projectTask(eventsForTask(events, taskId), projectId, taskId))
    .filter((state) => state.started_at !== null && state.host_session_hash === sessionHash)
    .sort((left, right) =>
      (right.last_event_at ?? "").localeCompare(left.last_event_at ?? "") ||
      right.task_id.localeCompare(left.task_id)
    );
  return matches[0]?.task_id ?? null;
}

function durableTaskState(events: LedgerEvent[], projectId: string, taskId: string) {
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

function assertClaimRole(status: EpistemicStatus, role: ClaimRole, source: SourceRef): void {
  const expected: Record<EpistemicStatus, ClaimRole> = {
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

function isRfc3339Utc(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/u.test(value) && Number.isFinite(Date.parse(value));
}

function assertImportedClaimShape(claim: Claim): void {
  const expected: Record<EpistemicStatus, ClaimRole> = {
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
    if (claim.confidence === undefined || !Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      throw new IntentLoopError("INVALID_IMPORT", "imported inferred claim requires confidence from 0 to 1");
    }
  } else if (claim.confidence !== undefined) {
    throw new IntentLoopError("INVALID_IMPORT", "only imported inferred claims may include confidence");
  }
  if (!isRfc3339Utc(claim.valid_from)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported valid_from must be RFC3339 UTC");
  }
  if (claim.last_confirmed !== null && !isRfc3339Utc(claim.last_confirmed)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported last_confirmed must be RFC3339 UTC or null");
  }
  if (claim.review_after !== undefined && !isRfc3339Utc(claim.review_after)) {
    throw new IntentLoopError("INVALID_IMPORT", "imported review_after must be RFC3339 UTC");
  }
}

export class IntentService {
  readonly store: LedgerStore;
  private readonly privateEvents = new Map<string, LedgerEvent[]>();

  constructor(store: LedgerStore) {
    this.store = store;
  }

  private key(projectId: string, taskId: string): string {
    return `${projectId}:${taskId}`;
  }

  private async projectEvents(projectId: string): Promise<LedgerEvent[]> {
    return this.store.readEvents(projectId);
  }

  private async taskEvents(projectId: string, taskId: string): Promise<LedgerEvent[]> {
    const privateLedger = this.privateEvents.get(this.key(projectId, taskId));
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, taskId, privateLedger);
      return [...privateLedger];
    }
    const all = await this.projectEvents(projectId);
    const durable = durableTaskState(all, projectId, taskId);
    await this.assertNoPrivateControl(projectId, durable.state);
    return durable.taskEvents;
  }

  private async assertPrivateControl(projectId: string, taskId: string, events: LedgerEvent[]): Promise<void> {
    const state = projectTask(events, projectId, taskId);
    if (state.host_session_hash === null) {
      throw new IntentLoopError("PRIVATE_CONTROL_MISSING", "private task is missing its Hook suppression token");
    }
    const control = await this.store.privateSession(projectId, state.host_session_hash);
    if (control?.task_id !== taskId) {
      throw new IntentLoopError("PRIVATE_CONTROL_MISSING", "private Hook suppression control is missing or mismatched");
    }
  }

  private async assertNoPrivateControl(
    projectId: string,
    state: ReturnType<typeof projectTask>
  ): Promise<void> {
    if (state.host_session_hash === null) return;
    const control = await this.store.privateSession(projectId, state.host_session_hash);
    if (control?.task_id === state.task_id) {
      throw new IntentLoopError(
        "PRIVATE_SESSION_ACTIVE",
        "private semantic state is active or was lost with its process; explicitly re-enable durable mode or delete the task"
      );
    }
  }

  private appendPrivate(projectId: string, taskId: string, event: NewEvent): LedgerEvent {
    const privateLedger = this.privateEvents.get(this.key(projectId, taskId));
    if (privateLedger === undefined) {
      throw new IntentLoopError("PRIVATE_STATE_REQUIRED", "private append requires an active in-process private task");
    }
    const next = memoryEvent(projectId, privateLedger.at(-1), event);
    privateLedger.push(next);
    return next;
  }

  private dropPrivateMemoryForSession(projectId: string, sessionHash: string): void {
    for (const [key, events] of this.privateEvents) {
      if (!key.startsWith(`${projectId}:`)) continue;
      const taskId = key.slice(projectId.length + 1);
      const state = projectTask(events, projectId, taskId);
      if (state.host_session_hash === sessionHash) this.privateEvents.delete(key);
    }
  }

  async startTask(input: StartTaskInput): Promise<Snapshot> {
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const taskId = input.task_id ?? deterministicTaskId(projectId, input.request_id);
    validateUuid(taskId, "task_id");
    const mode = input.mode ?? "on";
    if (mode === "off" && input.label !== undefined && input.label.trim() !== "") {
      throw new IntentLoopError("MODE_OFF_SEMANTIC_INPUT", "off mode does not persist a semantic label");
    }
    if (mode === "off" && (input.initial_explicit?.length ?? 0) > 0) {
      throw new IntentLoopError("MODE_OFF_SEMANTIC_INPUT", "off mode does not persist initial semantic claims");
    }
    const label = mode === "off" ? null : sanitizeLabel(input.label);
    const initialClaims = mode === "off" ? [] : makeInitialExplicitClaims(input.initial_explicit, input.request_id);
    const sessionHash = input.host_session_id === undefined ? null : hostSessionHash(input.host_session_id);
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
      if (existingPrivate !== undefined) {
        await this.assertPrivateControl(projectId, taskId, existingPrivate);
        const duplicate = findRequest(existingPrivate, taskId, input.request_id);
        if (duplicate !== undefined) {
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
      const privateLedger = durable.length === 0
        ? [memoryEvent(projectId, undefined, {
          event_type: "task_started",
          task_id: taskId,
          actor: "user",
          request_id: input.request_id,
          payload
        })]
        : [...durable, memoryEvent(projectId, durable.at(-1), {
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
      if (duplicate !== undefined) {
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
            ...(sessionHash === null ? {} : { host_session_hash: sessionHash }),
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

  async getSnapshot(input: { project_root: string; task_id: string; max_characters?: number }): Promise<Snapshot> {
    validateUuid(input.task_id, "task_id");
    const projectId = projectIdForRoot(input.project_root);
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    requireTaskStarted(state);
    if (state.mode === "off") {
      throw new IntentLoopError("MODE_OFF", "Intent Loop is off for this task; use intent_status or re-enable it");
    }
    return snapshotFromState(state, Math.max(500, Math.min(input.max_characters ?? 2400, 8000)));
  }

  async status(input: { project_root: string; task_id?: string }): Promise<Record<string, unknown>> {
    const projectId = projectIdForRoot(input.project_root);
    if (input.task_id === undefined) {
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

  private async addClaim(input: AddClaimInput, eventType: "claim_added" | "claim_replaced" = "claim_added"): Promise<Claim> {
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    const projectId = projectIdForRoot(input.project_root);
    const statement = atomicStatement(input.statement).text;
    const sourceRef = normalizeSourceRef(input.source_ref);
    assertClaimRole(input.epistemic_status, input.role, sourceRef);
    if (input.epistemic_status === "inferred") {
      if (input.confidence === undefined || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
        throw new IntentLoopError("CONFIDENCE_REQUIRED", "inferred claims require confidence from 0 to 1");
      }
    } else if (input.confidence !== undefined) {
      throw new IntentLoopError("CONFIDENCE_NOT_ALLOWED", "confidence is only accepted for inferred claims");
    }

    const supersedes = [...new Set(input.supersedes ?? [])];
    const related = [...new Set(input.related_claim_ids ?? [])];
    for (const id of [...supersedes, ...related]) validateUuid(id, "related claim id");
    const claim: Claim = {
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
    if (input.confidence !== undefined) claim.confidence = input.confidence;
    if (input.result_feedback_class !== undefined) claim.result_feedback_class = input.result_feedback_class;
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

    const validateCurrent = (events: LedgerEvent[], state: ReturnType<typeof projectTask>): void => {
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
        if (target === undefined) {
          throw new IntentLoopError("CLAIM_NOT_ACTIVE", `superseded claim ${id} is not active in this task`);
        }
        if (
          target.role === "user" &&
          target.epistemic_status === "explicit" &&
          !(claim.role === "user" && claim.epistemic_status === "explicit" && claim.source_ref.kind === "user_event")
        ) {
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
    const eventInput: NewEvent = {
      event_type: eventType,
      task_id: input.task_id,
      actor: input.role,
      request_id: input.request_id,
      payload: { claim, request_fingerprint: requestFingerprint }
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== undefined) {
        assertDuplicateMatches(duplicate, [eventType], requestFingerprint);
        const existing = duplicate.payload.claim as Claim | undefined;
        if (existing !== undefined) return cloneClaim(existing);
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
      if (duplicate !== undefined) {
        assertDuplicateMatches(duplicate, [eventType], requestFingerprint);
        if (duplicate.payload.claim === undefined) {
          throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
        }
        return null;
      }
      validateCurrent(taskEvents, state);
      return eventInput;
    });
    const persisted = findRequest(eventsForTask(transaction.events, input.task_id), input.task_id, input.request_id);
    const result = persisted?.payload.claim as Claim | undefined;
    if (result === undefined) throw new IntentLoopError("APPEND_VERIFICATION_FAILED", "claim append did not verify");
    return cloneClaim(result);
  }

  async addExplicit(input: Omit<AddClaimInput, "role" | "epistemic_status" | "confidence"> & {
    confirmation_reason: "direct_statement" | "confirmed_candidate";
  }): Promise<Claim> {
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

  async addInference(input: Omit<AddClaimInput, "role" | "epistemic_status"> & { signal_key?: string }): Promise<Claim | Candidate> {
    if (input.scope !== "long_term") {
      return this.addClaim({ ...input, role: "agent", epistemic_status: "inferred" });
    }
    const source = normalizeSourceRef(input.source_ref, ["user_event", "agent_turn"]);
    const statement = atomicStatement(input.statement).text;
    if (input.confidence === undefined || !Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
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

    const makeCandidate = (all: LedgerEvent[]): Candidate => {
      const repeatedTasks = new Set<string>([input.task_id]);
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
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const state = projectTask(privateLedger, projectId, input.task_id);
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== undefined) {
        assertDuplicateMatches(duplicate, ["candidate_added"], requestFingerprint);
        const prior = duplicate.payload.candidate as Candidate | undefined;
        if (prior !== undefined) return JSON.parse(JSON.stringify(prior)) as Candidate;
        throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
      }
      const candidate = makeCandidate(await this.projectEvents(projectId));
      this.appendPrivate(projectId, input.task_id, {
        event_type: "candidate_added",
        task_id: input.task_id,
        actor: "agent",
        request_id: input.request_id,
        payload: {
          candidate,
          signal_key: signalKey,
          confidence: input.confidence,
          eligible_for_confirmation: (candidate.task_ids?.length ?? 0) >= 3,
          request_fingerprint: requestFingerprint
        }
      });
      return candidate;
    }

    const transaction = await this.store.transactAppend(projectId, async (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      await this.assertNoPrivateControl(projectId, state);
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== undefined) {
        assertDuplicateMatches(duplicate, ["candidate_added"], requestFingerprint);
        if (duplicate.payload.candidate === undefined) {
          throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used for another operation");
        }
        return null;
      }
      const candidate = makeCandidate(all);
      return {
        event_type: "candidate_added",
        task_id: input.task_id,
        actor: "agent",
        request_id: input.request_id,
        payload: {
          candidate,
          signal_key: signalKey,
          confidence: input.confidence,
          eligible_for_confirmation: (candidate.task_ids?.length ?? 0) >= 3,
          request_fingerprint: requestFingerprint
        }
      };
    });
    const persisted = findRequest(eventsForTask(transaction.events, input.task_id), input.task_id, input.request_id);
    const candidate = persisted?.payload.candidate as Candidate | undefined;
    if (candidate === undefined) throw new IntentLoopError("APPEND_VERIFICATION_FAILED", "candidate append did not verify");
    return JSON.parse(JSON.stringify(candidate)) as Candidate;
  }

  async addEvidence(input: Omit<AddClaimInput, "role" | "epistemic_status" | "confidence"> & {
    feedback_class?: "keep" | "implementation_change" | "intent_change" | "uncertain";
  }): Promise<Claim> {
    const source = normalizeSourceRef(input.source_ref, ["tool_result", "external_evidence", "agent_turn", "user_event"]);
    return this.addClaim({
      ...input,
      source_ref: source,
      role: "evidence",
      epistemic_status: "evidence",
      ...(input.feedback_class === undefined ? {} : { result_feedback_class: input.feedback_class })
    });
  }

  async markUnknown(input: Omit<AddClaimInput, "role" | "epistemic_status" | "confidence">): Promise<Claim> {
    return this.addClaim({ ...input, role: "agent", epistemic_status: "unknown" });
  }

  async markDispute(input: Omit<AddClaimInput, "role" | "epistemic_status" | "confidence">): Promise<Claim> {
    const related = input.related_claim_ids ?? [];
    if (related.length < 2 && !input.statement.trim()) {
      throw new IntentLoopError("INVALID_DISPUTE", "a dispute requires two related claims or a free-standing statement");
    }
    return this.addClaim({ ...input, role: "system", epistemic_status: "disputed", related_claim_ids: related });
  }

  async replaceClaim(input: Omit<AddClaimInput, "supersedes"> & { supersedes: string[] }): Promise<Claim> {
    if (input.supersedes.length === 0) {
      throw new IntentLoopError("REPLACEMENT_TARGET_REQUIRED", "replace requires at least one active claim ID");
    }
    return this.addClaim(input, "claim_replaced");
  }

  async invalidate(input: {
    project_root: string;
    task_id: string;
    claim_id: string;
    request_id: string;
    reason: string;
    source_ref: SourceRef;
  }): Promise<{ claim_id: string; invalidated_at: string; reason: string }> {
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
    const eventInput: NewEvent = {
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
    const validateCurrent = (events: LedgerEvent[], state: ReturnType<typeof projectTask>): void => {
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const target = activeClaims(state).find((claim) => claim.claim_id === input.claim_id);
      if (target === undefined) throw new IntentLoopError("CLAIM_NOT_ACTIVE", "claim is not active in this task");
      if (target.role === "user" && target.epistemic_status === "explicit" && source.kind !== "user_event") {
        throw new IntentLoopError(
          "EXPLICIT_INVALIDATION_REQUIRES_USER",
          "a user-explicit claim can only be invalidated by a direct user_event"
        );
      }
      void events;
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate !== undefined) {
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
      if (duplicate !== undefined) {
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

  async listCandidates(input: { project_root: string; task_id: string }): Promise<Candidate[]> {
    const projectId = projectIdForRoot(input.project_root);
    const state = projectTask(await this.taskEvents(projectId, input.task_id), projectId, input.task_id);
    requireTaskStarted(state);
    if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "Intent Loop is off for this task");
    return state.candidates.map((candidate) => JSON.parse(JSON.stringify(candidate)) as Candidate);
  }

  async exportGraph(input: { project_root: string; task_id: string }): Promise<PortableGraph> {
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
      candidates: state.candidates.map((candidate) => JSON.parse(JSON.stringify(candidate)) as Candidate)
    };
  }

  async exportSummary(input: { project_root: string; task_id: string }): Promise<Record<string, unknown>> {
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

  async importGraph(input: {
    project_root: string;
    task_id: string;
    request_id: string;
    graph: PortableGraph;
  }): Promise<Snapshot> {
    validateUuid(input.task_id, "task_id");
    validateRequestId(input.request_id);
    if (
      input.graph.format !== "intent-loop-export" ||
      input.graph.schema_version !== SCHEMA_VERSION ||
      input.graph.history_complete !== false
    ) {
      throw new IntentLoopError("INVALID_IMPORT", "graph is not a supported incomplete Intent Loop export");
    }
    if (
      !Array.isArray(input.graph.claims) ||
      !Array.isArray(input.graph.invalidated_claim_ids) ||
      !Array.isArray(input.graph.candidates) ||
      input.graph.claims.length > 1_000 ||
      input.graph.invalidated_claim_ids.length > 1_000 ||
      input.graph.candidates.length > 1_000 ||
      input.graph.claims.length + input.graph.invalidated_claim_ids.length + input.graph.candidates.length > 2_000
    ) {
      throw new IntentLoopError("INVALID_IMPORT", "graph exceeds the bounded import size");
    }
    if (!isRfc3339Utc(input.graph.exported_at)) {
      throw new IntentLoopError("INVALID_IMPORT", "graph exported_at must be RFC3339 UTC");
    }
    validateUuid(input.graph.source_task_id, "source_task_id");
    if (!/^[a-f0-9]{64}$/u.test(input.graph.source_project_id)) {
      throw new IntentLoopError("INVALID_IMPORT", "source_project_id must be a lowercase SHA-256 value");
    }
    const graphClaimIds = new Set<string>();
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
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visitSupersession = (claimId: string): void => {
      if (visiting.has(claimId)) throw new IntentLoopError("INVALID_IMPORT", "supersession graph contains a cycle");
      if (visited.has(claimId)) return;
      visiting.add(claimId);
      const claim = claimById.get(claimId);
      for (const targetId of claim?.supersedes ?? []) {
        const target = claimById.get(targetId);
        if (target !== undefined && Date.parse(claim?.valid_from ?? "") < Date.parse(target.valid_from)) {
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
    const candidateIds = new Set<string>();
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
      normalized.claim_id = claimIdMap.get(claim.claim_id) as string;
      normalized.statement = atomicStatement(claim.statement).text;
      normalized.source_ref = {
        kind: "explicit_import",
        sha256: sha256(canonicalStringify({ claim_id: claim.claim_id, source_ref: claim.source_ref }))
      };
      normalized.supersedes = [...new Set(claim.supersedes.map((claimId) => claimIdMap.get(claimId) as string))];
      normalized.related_claim_ids = [
        ...new Set(claim.related_claim_ids.map((claimId) => claimIdMap.get(claimId) as string))
      ];
      normalized.facets = normalizeFacets(claim.facets, claim.epistemic_status);
      return normalized;
    });
    const candidates = input.graph.candidates.map((candidate) => ({
      ...JSON.parse(JSON.stringify(candidate)) as Candidate,
      candidate_id: candidateIdMap.get(candidate.candidate_id) as string,
      source_ref: {
        kind: "explicit_import" as const,
        sha256: sha256(canonicalStringify({ candidate_id: candidate.candidate_id, source_ref: candidate.source_ref }))
      },
      ...(candidate.task_ids === undefined
        ? {}
        : { task_ids: candidate.task_ids.map((taskId) => importedTaskIdMap.get(taskId) as string) }),
      ...(candidate.summary === undefined ? {} : { summary: atomicStatement(candidate.summary).text })
    }));
    const invalidatedClaimIds = [
      ...new Set(input.graph.invalidated_claim_ids.map((claimId) => claimIdMap.get(claimId) as string))
    ];
    const projectId = projectIdForRoot(input.project_root);
    const eventInput: NewEvent = {
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
    const validateCurrent = (events: LedgerEvent[], state: ReturnType<typeof projectTask>): void => {
      requireTaskStarted(state);
      if (state.mode === "off") throw new IntentLoopError("MODE_OFF", "semantic writes are disabled while Intent Loop is off");
      const existingIds = new Set(
        [...new Set(events.map((event) => event.task_id))]
          .flatMap((taskId) => projectTask(eventsForTask(events, taskId), projectId, taskId).claims)
          .map((claim) => claim.claim_id)
      );
      for (const claim of claims) {
        if (existingIds.has(claim.claim_id)) throw new IntentLoopError("IMPORT_COLLISION", `claim ${claim.claim_id} already exists`);
      }
    };
    const privateLedger = this.privateEvents.get(this.key(projectId, input.task_id));
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
      const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
      if (duplicate === undefined) {
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
        if (duplicate !== undefined) {
          assertDuplicateMatches(duplicate, ["graph_imported"], requestFingerprint);
          return null;
        }
        validateCurrent(all, state);
        return eventInput;
      });
    }
    return this.getSnapshot({ project_root: input.project_root, task_id: input.task_id });
  }

  async setMode(input: {
    project_root: string;
    task_id: string;
    request_id: string;
    mode: IntentMode;
  }): Promise<{ mode: IntentMode; persistence_note: string }> {
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

    if (privateLedger !== undefined) {
      const privateState = projectTask(privateLedger, projectId, input.task_id);
      requireTaskStarted(privateState);
      if (input.mode === "private") {
        const duplicate = findRequest(privateLedger, input.task_id, input.request_id);
        if (duplicate === undefined) {
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
      let recoveredWithoutDurableState = false;
      await this.store.transactAppend(projectId, (all) => {
        const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
        const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
        if (duplicate !== undefined) {
          assertDuplicateMatches(duplicate, ["mode_set", "task_started"], requestFingerprint);
          if (duplicate.event_type === "task_started" && duplicate.payload.recovered_from_private !== true) {
            throw new IntentLoopError("REQUEST_ID_REUSED", "request_id was already used by the original task start");
          }
          return null;
        }
        if (
          state.started_at !== null &&
          state.host_session_hash !== null &&
          state.host_session_hash !== privateState.host_session_hash
        ) {
          throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "durable task is associated with another host session");
        }
        if (state.started_at === null) {
          recoveredWithoutDurableState = true;
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
        persistence_note: input.mode === "off"
          ? "Private changes were discarded; durable semantic reads and writes are disabled."
          : recoveredWithoutDurableState
            ? "Private in-memory semantics were unavailable after restart; a new empty durable task was explicitly enabled."
            : "Private changes were discarded; the earlier durable task state is enabled again."
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
      if (
        initialState.started_at !== null &&
        initialState.host_session_hash !== null &&
        initialState.host_session_hash !== sessionHash
      ) {
        throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "private control does not match the current host session");
      }
      const privateBase = eventsForTask(await this.store.activatePrivateSession(projectId, input.task_id, sessionHash, (all) => {
        const state = durableTaskState(all, projectId, input.task_id).state;
        if (state.started_at === null && persistedControl === null) requireTaskStarted(state);
      }), input.task_id);
      const privateEvents = privateBase.length === 0
        ? [memoryEvent(projectId, undefined, {
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
        })]
        : [...privateBase, memoryEvent(projectId, privateBase.at(-1), {
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
        persistence_note: privateBase.length === 0
          ? "Prior private semantics were unavailable after restart; a new empty memory-only task is active."
          : "Semantic changes are memory-only; a hashed control marker suppresses separate Hook processes."
      };
    }

    const recoverySessionHash = persistedControl?.host_session_hash ?? null;
    let recoveredWithoutDurableState = false;
    await this.store.transactAppend(projectId, (all) => {
      const { taskEvents, state } = durableTaskState(all, projectId, input.task_id);
      const duplicate = findRequest(taskEvents, input.task_id, input.request_id);
      if (duplicate !== undefined) {
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
      if (
        recoverySessionHash !== null &&
        state.host_session_hash !== null &&
        state.host_session_hash !== recoverySessionHash
      ) {
        throw new IntentLoopError("PRIVATE_CONTROL_MISMATCH", "private control does not match the durable task session");
      }
      return {
        event_type: "mode_set",
        task_id: input.task_id,
        actor: "user",
        request_id: input.request_id,
        payload: {
          mode: input.mode,
          ...(recoverySessionHash === null ? {} : { host_session_hash: recoverySessionHash }),
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
      persistence_note: input.mode === "off"
        ? "Semantic reads and writes are disabled."
        : recoveredWithoutDurableState
          ? "Private in-memory semantics were unavailable after restart; a new empty durable task was explicitly enabled."
          : "Structured local persistence is enabled."
    };
  }

  async delete(input: {
    project_root: string;
    task_id: string;
    target: "task" | "claim";
    claim_id?: string;
    confirmation: string;
  }): Promise<Record<string, unknown>> {
    validateUuid(input.task_id, "task_id");
    const projectId = projectIdForRoot(input.project_root);
    const privateKey = this.key(projectId, input.task_id);

    if (input.target === "task") {
      const expected = `DELETE TASK ${input.task_id}`;
      if (input.confirmation !== expected) {
        throw new IntentLoopError("CONFIRMATION_REQUIRED", `confirmation must equal ${expected}`);
      }
      const result = await this.store.rewriteEvents(
        projectId,
        (all) => all
          .filter((event) => event.task_id !== input.task_id)
          .map((event) => stripTaskReferencesFromEvent(event, input.task_id)),
        [input.task_id],
        { remove_private_task_id: input.task_id }
      );
      this.privateEvents.delete(privateKey);
      return { deleted: "task", task_id: input.task_id, persistent_files_scanned: result.scanned_files };
    }

    if (input.claim_id === undefined) throw new IntentLoopError("CLAIM_ID_REQUIRED", "claim_id is required for record deletion");
    validateUuid(input.claim_id, "claim_id");
    const expected = `DELETE CLAIM ${input.claim_id}`;
    if (input.confirmation !== expected) {
      throw new IntentLoopError("CONFIRMATION_REQUIRED", `confirmation must equal ${expected}`);
    }
    const claimId = input.claim_id;
    const privateLedger = this.privateEvents.get(privateKey);
    const claimState = privateLedger === undefined
      ? projectTask(eventsForTask(await this.projectEvents(projectId), input.task_id), projectId, input.task_id)
      : projectTask(privateLedger, projectId, input.task_id);
    requireTaskStarted(claimState);
    if (!claimState.claims.some((claim) => claim.claim_id === claimId)) {
      throw new IntentLoopError("CLAIM_NOT_FOUND", "claim does not exist in this task");
    }
    if (privateLedger !== undefined) {
      await this.assertPrivateControl(projectId, input.task_id, privateLedger);
    }
    const result = await this.store.rewriteEvents(
      projectId,
      (all) => removeClaimFromTaskEvents(all, input.task_id, claimId),
      [claimId]
    );
    if (privateLedger !== undefined) {
      this.privateEvents.set(
        privateKey,
        rechainMemoryEvents(removeClaimFromTaskEvents(privateLedger, input.task_id, claimId))
      );
    }
    return { deleted: "claim", claim_id: claimId, persistent_files_scanned: result.scanned_files };
  }

  async findTaskBySession(projectRoot: string, sessionId: string): Promise<string | null> {
    const projectId = projectIdForRoot(projectRoot);
    const target = hostSessionHash(sessionId);
    return currentTaskForSession(await this.projectEvents(projectId), projectId, target);
  }

  async recordHookObservation(input: HookObservation): Promise<{ recorded: boolean; task_id: string | null }> {
    const projectId = projectIdForRoot(input.project_root);
    const sessionHash = hostSessionHash(input.session_id);
    const privateControl = await this.store.privateSession(projectId, sessionHash);
    if (privateControl !== null) return { recorded: false, task_id: privateControl.task_id };
    const initial = await this.projectEvents(projectId);
    const taskId = currentTaskForSession(initial, projectId, sessionHash);
    if (taskId === null) return { recorded: false, task_id: null };

    const trustedEventId = input.source_event_id !== undefined && validSourceEventId(input.source_event_id)
      ? input.source_event_id
      : undefined;
    const redactedSourceText = input.source_text === undefined ? undefined : redactText(input.source_text).text;
    const requestIdentity = trustedEventId ?? redactedSourceText ?? "none";
    const requestId = `hook:${input.hook_event_name}:${sha256(requestIdentity).slice(0, 24)}`;
    const sourceHash = trustedEventId === undefined
      ? sha256(redactedSourceText ?? `${input.hook_event_name}:none`)
      : sha256(trustedEventId);
    const sourceRef: SourceRef = { kind: input.source_kind, sha256: sourceHash };
    if (trustedEventId !== undefined) {
      sourceRef.event_id = trustedEventId;
    }
    const eventType = input.hook_event_name === "PostCompact"
      ? "compaction_observed"
      : input.candidate_type === "result_feedback"
        ? "result_signal_observed"
        : "source_observed";
    let recorded = false;
    let resolvedTaskId: string | null = taskId;
    await this.store.transactAppend(projectId, async (all) => {
      if (await this.store.privateSession(projectId, sessionHash) !== null) return null;
      resolvedTaskId = currentTaskForSession(all, projectId, sessionHash);
      if (resolvedTaskId === null) return null;
      if (await this.store.privateSessionForTask(projectId, resolvedTaskId) !== null) return null;
      const { taskEvents, state } = durableTaskState(all, projectId, resolvedTaskId);
      requireTaskStarted(state);
      if (state.mode !== "on") return null;
      const duplicate = findRequest(taskEvents, resolvedTaskId, requestId);
      if (duplicate !== undefined) {
        recorded = true;
        return null;
      }
      const candidate: Candidate = {
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
        ...(input.occurred_at === undefined ? {} : { occurred_at: input.occurred_at }),
        payload: { candidate, char_count: redactedSourceText?.length ?? 0 }
      };
    });
    return { recorded, task_id: resolvedTaskId };
  }

  async compactForSession(projectRoot: string, sessionId: string): Promise<string | null> {
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
    return activeClaims(state).length === 0 ? identity : `${identity}\n${compactForHook(state, 1800)}`;
  }

  static canonicalGraph(graph: PortableGraph): string {
    return canonicalStringify(graph);
  }
}
