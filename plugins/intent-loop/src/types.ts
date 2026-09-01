export const SCHEMA_VERSION = 1 as const;
export const SERVER_VERSION = "0.2.0-beta.3";

export type IntentMode = "on" | "private" | "off";
export type ClaimRole = "user" | "agent" | "evidence" | "system";
export type EpistemicStatus = "explicit" | "inferred" | "evidence" | "unknown" | "disputed";
export type ClaimScope = "task" | "project" | "long_term";
export type SourceKind =
  | "user_event"
  | "agent_turn"
  | "tool_result"
  | "external_evidence"
  | "explicit_import";

export type IntentFacet =
  | "outcome"
  | "success_signal"
  | "failure_signal"
  | "hard_constraint"
  | "soft_constraint"
  | "tradeoff"
  | "unknown"
  | "result_feedback"
  | "disagreement";

export interface SourceRef {
  kind: SourceKind;
  event_id?: string;
  sha256?: string;
  excerpt?: string;
}

export interface Claim {
  claim_id: string;
  statement: string;
  role: ClaimRole;
  epistemic_status: EpistemicStatus;
  source_ref: SourceRef;
  scope: ClaimScope;
  confidence?: number;
  valid_from: string;
  last_confirmed: string | null;
  supersedes: string[];
  facets: IntentFacet[];
  related_claim_ids: string[];
  review_after?: string;
  result_feedback_class?: "keep" | "implementation_change" | "intent_change" | "uncertain";
}

export type LedgerEventType =
  | "task_started"
  | "mode_set"
  | "source_observed"
  | "candidate_added"
  | "claim_added"
  | "claim_replaced"
  | "claim_invalidated"
  | "graph_imported"
  | "compaction_observed"
  | "result_signal_observed";

export interface LedgerEvent {
  schema_version: typeof SCHEMA_VERSION;
  event_id: string;
  event_type: LedgerEventType;
  project_id: string;
  task_id: string;
  occurred_at: string;
  actor: ClaimRole;
  request_id: string;
  payload: Record<string, unknown>;
  prev_hash: string | null;
  event_hash: string;
}

export interface Candidate {
  candidate_id: string;
  candidate_type: "prompt_update" | "result_feedback" | "long_term_preference" | "recovery_needed";
  source_ref: SourceRef;
  created_at: string;
  summary?: string;
  task_ids?: string[];
}

export interface TaskState {
  project_id: string;
  task_id: string;
  mode: IntentMode;
  label: string | null;
  host_session_hash: string | null;
  claims: Claim[];
  invalidated_claim_ids: Set<string>;
  candidates: Candidate[];
  started_at: string | null;
  last_event_at: string | null;
}

export interface Snapshot {
  project_id: string;
  task_id: string;
  mode: IntentMode;
  generated_at: string;
  active_claims: Claim[];
  unknowns: Claim[];
  disagreements: Claim[];
  stale_long_term: Claim[];
  candidate_count: number;
  compact_text: string;
}

export interface PortableGraph {
  format: "intent-loop-export";
  schema_version: typeof SCHEMA_VERSION;
  exported_at: string;
  source_project_id: string;
  source_task_id: string;
  history_complete: false;
  claims: Claim[];
  invalidated_claim_ids: string[];
  candidates: Candidate[];
}

export interface ToolEnvelope<T = unknown> {
  ok: boolean;
  schema_version: typeof SCHEMA_VERSION;
  operation: string;
  project_id: string | null;
  task_id: string | null;
  result?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
