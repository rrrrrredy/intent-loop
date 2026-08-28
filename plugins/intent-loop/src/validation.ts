import { nowIso } from "./canonical.js";
import { IntentLoopError } from "./errors.js";
import { atomicStatement, findKnownCredentialKinds, minimalExcerpt, redactText } from "./redaction.js";
import { Claim, EpistemicStatus, IntentFacet, SourceKind, SourceRef, TaskState } from "./types.js";

const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const SHA256_RE = /^[a-f0-9]{64}$/u;
const SOURCE_EVENT_ID_RE = /^[A-Za-z0-9_.:@-]{1,200}$/u;

export function validateUuid(value: string, field: string): void {
  if (!UUID_RE.test(value)) {
    throw new IntentLoopError("INVALID_ID", `${field} must be a UUID`);
  }
}

export function validateRequestId(requestId: string): void {
  if (!/^[A-Za-z0-9_.:@-]{1,200}$/u.test(requestId)) {
    throw new IntentLoopError("INVALID_REQUEST_ID", "request_id must be 1-200 opaque characters");
  }
  if (findKnownCredentialKinds(requestId).length > 0) {
    throw new IntentLoopError("SENSITIVE_ID_REJECTED", "request_id must not contain a credential or access token");
  }
}

export function validSourceEventId(value: string): boolean {
  return SOURCE_EVENT_ID_RE.test(value) && findKnownCredentialKinds(value).length === 0;
}

export function normalizeSourceRef(source: SourceRef, allowedKinds?: SourceKind[]): SourceRef {
  if (allowedKinds !== undefined && !allowedKinds.includes(source.kind)) {
    throw new IntentLoopError("INVALID_SOURCE", `source kind ${source.kind} is not allowed for this operation`);
  }
  if (source.event_id === undefined && source.sha256 === undefined) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref requires event_id or sha256");
  }
  if (source.event_id !== undefined && !SOURCE_EVENT_ID_RE.test(source.event_id)) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref.event_id must be an opaque ID, not a path or free text");
  }
  if (source.event_id !== undefined && findKnownCredentialKinds(source.event_id).length > 0) {
    throw new IntentLoopError("SENSITIVE_ID_REJECTED", "source_ref.event_id must not contain a credential or access token");
  }
  if (source.sha256 !== undefined && !SHA256_RE.test(source.sha256)) {
    throw new IntentLoopError("INVALID_SOURCE", "source_ref.sha256 must be a lowercase SHA-256 value");
  }
  const normalized: SourceRef = { kind: source.kind };
  if (source.event_id !== undefined) normalized.event_id = source.event_id;
  if (source.sha256 !== undefined) normalized.sha256 = source.sha256;
  const excerpt = minimalExcerpt(source.excerpt);
  if (excerpt !== undefined) normalized.excerpt = excerpt;
  return normalized;
}

export function cloneClaim(claim: Claim): Claim {
  return JSON.parse(JSON.stringify(claim)) as Claim;
}

export function sanitizeLabel(label: string | undefined): string | null {
  if (label === undefined || label.trim() === "") return null;
  const redacted = redactText(label.trim()).text;
  if (redacted.length > 120 || /[\r\n]/u.test(redacted)) {
    throw new IntentLoopError("INVALID_LABEL", "task label must be one redacted line of at most 120 characters");
  }
  return redacted;
}

export function requireTaskStarted(state: TaskState): void {
  if (state.started_at === null) {
    throw new IntentLoopError("TASK_NOT_FOUND", "task is not associated with this project");
  }
}

export function normalizeFacets(facets: IntentFacet[], status: EpistemicStatus): IntentFacet[] {
  const unique = [...new Set(facets)];
  if (unique.length === 0) {
    throw new IntentLoopError("INVALID_FACETS", "at least one intent facet is required");
  }
  if (status === "unknown" && !unique.includes("unknown")) unique.push("unknown");
  if (status === "disputed" && !unique.includes("disagreement")) unique.push("disagreement");
  return unique;
}

export function normalizeImportedClaim(claim: Claim): Claim {
  validateUuid(claim.claim_id, "imported claim_id");
  const normalized = cloneClaim(claim);
  normalized.statement = atomicStatement(claim.statement).text;
  normalized.source_ref = normalizeSourceRef(claim.source_ref);
  normalized.supersedes = [...new Set(claim.supersedes)];
  normalized.related_claim_ids = [...new Set(claim.related_claim_ids)];
  normalized.facets = normalizeFacets(claim.facets, claim.epistemic_status);
  return normalized;
}

export function confirmationTimestamp(): string {
  return nowIso();
}
