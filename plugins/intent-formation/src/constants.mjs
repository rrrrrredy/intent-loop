export const PRODUCT_VERSION = "0.3.0-beta.1";
export const SCHEMA_VERSION = 1;
export const EXPORT_FORMAT = "intent-formation-export";
export const EXPORT_VERSION = 1;

export const RECORD_ROLES = Object.freeze([
  "desired_outcome",
  "success_signal",
  "failure_signal",
  "hard_constraint",
  "soft_constraint",
  "tradeoff",
  "unknown",
  "result_feedback",
  "disagreement"
]);

export const EPISTEMIC_STATUSES = Object.freeze([
  "explicit",
  "inferred",
  "evidence",
  "unknown",
  "disputed"
]);

export const SOURCE_KINDS = Object.freeze([
  "user_turn",
  "agent_inference",
  "result",
  "external_evidence",
  "manual_import"
]);

export const SCOPES = Object.freeze(["task", "project", "long_term"]);
export const TASK_MODES = Object.freeze(["standard", "private", "off"]);
export const FEEDBACK_CLASSES = Object.freeze([
  "keep",
  "implementation_change",
  "intent_change",
  "uncertain"
]);

export const EVENT_TYPES = Object.freeze([
  "task_started",
  "task_mode_changed",
  "record_added",
  "record_invalidated"
]);
