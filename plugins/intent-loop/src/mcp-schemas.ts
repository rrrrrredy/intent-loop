import { z } from "zod/v4";

export const modeSchema = z.enum(["on", "private", "off"]);
export const scopeSchema = z.enum(["task", "project", "long_term"]);
export const roleSchema = z.enum(["user", "agent", "evidence", "system"]);
export const statusSchema = z.enum(["explicit", "inferred", "evidence", "unknown", "disputed"]);
export const facetSchema = z.enum([
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

export const sourceRefSchema = z.object({
  kind: z.enum(["user_event", "agent_turn", "tool_result", "external_evidence", "explicit_import"]),
  event_id: z.string().min(1).max(200).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u).optional(),
  excerpt: z.string().max(2000).optional()
}).strict().refine((source) => source.event_id !== undefined || source.sha256 !== undefined, {
  message: "source_ref requires event_id or sha256"
});

const projectRoot = z.string().min(1).max(1000).describe("Canonical root of the current project, never a different project.");
const projectRootInput = projectRoot.optional().describe(
  "Optional on Codex, where the server binds the call to host-provided sandboxCwd metadata. Other MCP hosts must pass the current canonical project root unless they advertise exactly one local file root."
);
const taskId = z.string().uuid();
const requestId = z.string().regex(/^[A-Za-z0-9_.:@-]{1,200}$/u);
const statement = z.string().min(1).max(4000);
const facets = z.array(facetSchema).min(1).max(9);
const initialExplicitSchema = z.object({
  statement,
  scope: scopeSchema.default("task"),
  facets
}).strict();
const initialExplicitInputSchema = z.union([
  initialExplicitSchema,
  statement.describe("String shorthand; the server records it as a task-scoped hard constraint.")
]);

export const startSchema = z.object({
  project_root: projectRootInput,
  request_id: requestId.optional()
    .describe("Optional opaque idempotency key. If omitted, the server creates a non-secret random ID for this start."),
  task_id: taskId.optional().describe("Omit for a new task. Supply only an exact UUID returned by an earlier successful Intent Loop call."),
  label: z.string().max(500).optional(),
  host_session_id: z.string().min(1).max(300).optional(),
  mode: modeSchema.default("on"),
  initial_explicit: z.array(initialExplicitInputSchema).max(12).default([])
    .describe("Directly stated atomic user claims to create in this same start operation. Prefer {statement, scope, facets}; a plain string is accepted as a task hard constraint. No event IDs or hashes are needed.")
}).strict().superRefine((value, context) => {
  if (value.mode === "private" && value.host_session_id === undefined) {
    context.addIssue({
      code: "custom",
      path: ["host_session_id"],
      message: "private mode requires the hidden host_session_id for cross-process Hook suppression"
    });
  }
  if (value.mode === "off" && value.label !== undefined && value.label.trim() !== "") {
    context.addIssue({
      code: "custom",
      path: ["label"],
      message: "off mode does not persist a semantic label"
    });
  }
  if (value.mode === "off" && value.initial_explicit.length > 0) {
    context.addIssue({
      code: "custom",
      path: ["initial_explicit"],
      message: "off mode does not persist initial semantic claims"
    });
  }
});

export const snapshotSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  max_characters: z.number().int().min(500).max(8000).optional()
}).strict();

const claimBase = {
  project_root: projectRootInput,
  task_id: taskId,
  request_id: requestId,
  statement,
  source_ref: sourceRefSchema,
  scope: scopeSchema.default("task"),
  facets
};

export const explicitSchema = z.object({
  ...claimBase,
  confirmation_reason: z.enum(["direct_statement", "confirmed_candidate"])
}).strict();

export const inferenceSchema = z.object({
  ...claimBase,
  confidence: z.number().min(0).max(1),
  signal_key: z.string().min(1).max(200).optional()
}).strict();

export const evidenceSchema = z.object({
  ...claimBase,
  feedback_class: z.enum(["keep", "implementation_change", "intent_change", "uncertain"]).optional()
}).strict();

export const unknownSchema = z.object(claimBase).strict();

export const disputeSchema = z.object({
  ...claimBase,
  related_claim_ids: z.array(taskId).max(20).default([])
}).strict();

export const replaceSchema = z.object({
  ...claimBase,
  replacement_kind: z.enum(["explicit", "inferred", "evidence", "unknown", "disputed"]),
  supersedes: z.array(taskId).min(1).max(20),
  related_claim_ids: z.array(taskId).max(20).default([]),
  confidence: z.number().min(0).max(1).optional(),
  confirmation_reason: z.enum(["direct_statement", "confirmed_candidate"]).optional()
}).strict();

export const invalidateSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  request_id: requestId,
  claim_id: taskId,
  reason: z.string().min(1).max(1000),
  source_ref: sourceRefSchema
}).strict();

export const taskReadSchema = z.object({ project_root: projectRootInput, task_id: taskId }).strict();

export const exportSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  detail: z.enum(["portable", "summary"]).default("portable")
}).strict();

const claimSchema = z.object({
  claim_id: taskId,
  statement: z.string().min(1).max(500),
  role: roleSchema,
  epistemic_status: statusSchema,
  source_ref: sourceRefSchema,
  scope: scopeSchema,
  confidence: z.number().min(0).max(1).optional(),
  valid_from: z.string().datetime({ offset: false }),
  last_confirmed: z.string().datetime({ offset: false }).nullable(),
  supersedes: z.array(taskId).max(20),
  facets,
  related_claim_ids: z.array(taskId).max(20),
  review_after: z.string().datetime({ offset: false }).optional(),
  result_feedback_class: z.enum(["keep", "implementation_change", "intent_change", "uncertain"]).optional()
}).strict();

const candidateSchema = z.object({
  candidate_id: taskId,
  candidate_type: z.enum(["prompt_update", "result_feedback", "long_term_preference", "recovery_needed"]),
  source_ref: sourceRefSchema,
  created_at: z.string().datetime({ offset: false }),
  summary: z.string().max(500).optional(),
  task_ids: z.array(taskId).max(100).optional()
}).strict();

export const portableGraphSchema = z.object({
  format: z.literal("intent-loop-export"),
  schema_version: z.literal(1),
  exported_at: z.string().datetime({ offset: false }),
  source_project_id: z.string().regex(/^[a-f0-9]{64}$/u),
  source_task_id: taskId,
  history_complete: z.literal(false),
  claims: z.array(claimSchema).max(1_000),
  invalidated_claim_ids: z.array(taskId).max(1_000),
  candidates: z.array(candidateSchema).max(1_000)
}).strict().refine(
  (graph) => graph.claims.length + graph.invalidated_claim_ids.length + graph.candidates.length <= 2_000,
  { message: "portable graph exceeds the combined import limit" }
).refine(
  (graph) => graph.claims.reduce(
    (total, claim) => total + claim.supersedes.length + claim.related_claim_ids.length,
    graph.candidates.reduce((total, candidate) => total + (candidate.task_ids?.length ?? 0), 0)
  ) <= 20_000,
  { message: "portable graph exceeds the combined relation limit" }
);

export const importSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  request_id: requestId,
  graph: portableGraphSchema
}).strict();

export const deleteSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  target: z.enum(["task", "claim"]),
  claim_id: taskId.optional(),
  confirmation: z.string().min(1).max(200)
}).strict();

export const setModeSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId,
  request_id: requestId,
  mode: modeSchema
}).strict();

export const statusInputSchema = z.object({
  project_root: projectRootInput,
  task_id: taskId.optional()
}).strict();

export const envelopeSchema = z.object({
  ok: z.boolean(),
  schema_version: z.literal(1),
  operation: z.string(),
  project_id: z.string().nullable(),
  task_id: z.string().nullable(),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean()
  }).strict().optional()
}).strict();
