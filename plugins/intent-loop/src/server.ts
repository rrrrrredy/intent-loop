import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod/v4";

import { asIntentLoopError, IntentLoopError } from "./errors.js";
import {
  deleteSchema,
  disputeSchema,
  envelopeSchema,
  evidenceSchema,
  exportSchema,
  explicitSchema,
  importSchema,
  inferenceSchema,
  invalidateSchema,
  replaceSchema,
  setModeSchema,
  snapshotSchema,
  startSchema,
  statusInputSchema,
  taskReadSchema,
  unknownSchema
} from "./mcp-schemas.js";
import { IntentService } from "./service.js";
import { dataRootFromEnvironment, LedgerStore } from "./storage.js";
import { newId, projectIdForRoot } from "./canonical.js";
import { ClaimRole, EpistemicStatus, PortableGraph, SERVER_VERSION, SourceRef, ToolEnvelope } from "./types.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

type RequestContext = {
  mcpReq: {
    _meta?: Record<string, unknown>;
  };
};

const SANDBOX_STATE_META_KEY = "codex/sandbox-state-meta";

function projectRootFromContext(context: RequestContext): string | undefined {
  const metadata = context.mcpReq._meta;
  if (metadata === undefined || !Object.prototype.hasOwnProperty.call(metadata, SANDBOX_STATE_META_KEY)) {
    return undefined;
  }
  const sandboxState = metadata[SANDBOX_STATE_META_KEY];
  if (sandboxState === null || typeof sandboxState !== "object" || Array.isArray(sandboxState)) {
    throw new IntentLoopError(
      "PROJECT_ROOT_METADATA_INVALID",
      "host sandbox working-directory metadata is malformed"
    );
  }
  const sandboxCwd = (sandboxState as Record<string, unknown>).sandboxCwd;
  if (typeof sandboxCwd !== "string" || sandboxCwd.length === 0) {
    throw new IntentLoopError(
      "PROJECT_ROOT_METADATA_INVALID",
      "host sandbox working-directory metadata is malformed"
    );
  }
  try {
    const cwdUrl = new URL(sandboxCwd);
    if (cwdUrl.protocol !== "file:") {
      throw new IntentLoopError(
        "PROJECT_ROOT_METADATA_INVALID",
        "host sandbox working directory must be a local file URL"
      );
    }
    return fileURLToPath(cwdUrl);
  } catch {
    throw new IntentLoopError(
      "PROJECT_ROOT_METADATA_INVALID",
      "host sandbox working-directory metadata is malformed"
    );
  }
}

function sourceFrom(value: z.infer<typeof explicitSchema>["source_ref"]): SourceRef {
  const source: SourceRef = { kind: value.kind };
  if (value.event_id !== undefined) source.event_id = value.event_id;
  if (value.sha256 !== undefined) source.sha256 = value.sha256;
  if (value.excerpt !== undefined) source.excerpt = value.excerpt;
  return source;
}

function resultFromEnvelope(envelope: ToolEnvelope, isError = false): ToolResult {
  const result: ToolResult = {
    content: [{ type: "text", text: JSON.stringify(envelope) }],
    structuredContent: envelope as unknown as Record<string, unknown>
  };
  if (isError) result.isError = true;
  return result;
}

async function execute<T>(
  operation: string,
  projectRoot: string | undefined,
  taskId: string | undefined,
  action: () => Promise<T>
): Promise<ToolResult> {
  let projectId: string | null = null;
  try {
    if (projectRoot !== undefined) projectId = projectIdForRoot(projectRoot);
    const value = await action();
    const resultTaskId = typeof value === "object" && value !== null && "task_id" in value &&
      typeof (value as { task_id?: unknown }).task_id === "string"
      ? (value as { task_id: string }).task_id
      : null;
    return resultFromEnvelope({
      ok: true,
      schema_version: 1,
      operation,
      project_id: projectId,
      task_id: taskId ?? resultTaskId,
      result: value
    });
  } catch (error) {
    const known = asIntentLoopError(error);
    return resultFromEnvelope({
      ok: false,
      schema_version: 1,
      operation,
      project_id: projectId,
      task_id: taskId ?? null,
      error: { code: known.code, message: known.message, retryable: known.retryable }
    }, true);
  }
}

export function createIntentMcpServer(options: { data_root?: string; service?: IntentService } = {}): McpServer {
  const service = options.service ?? new IntentService(new LedgerStore(options.data_root ?? dataRootFromEnvironment()));
  const server = new McpServer(
    { name: "intent-loop", version: SERVER_VERSION },
    {
      capabilities: {
        experimental: { [SANDBOX_STATE_META_KEY]: {} }
      },
      instructions:
        "For a manual $intent command, use only intent_loop and never copy or mirror its data into another memory, continuity, state, planning, or profile system. Never use shell commands to create task IDs, source IDs, or hashes. If the installed Skill file cannot be read, read intent-loop://skill/intent exactly once from MCP server intent_loop; never try server intent-loop or list every resource while intent_loop is available. On Codex, omit project_root: the server binds every call to the host-provided sandbox working directory and rejects a conflicting explicit path. For a new task, omit task_id and request_id and put all directly stated atomic user claims in initial_explicit on the single intent_start_task call; the server creates IDs and provenance. Maintain structured current intent only. Never perform the domain task, plan work, manage permissions, or treat inferences/tool results as user-explicit. Keep clear work quiet. Manual show/status commands are a one-tool fast path and do not need a plan. Ask at most one key question before a costly divergent step; otherwise use 2-3 comparisons or a cheap sample. Preserve unknowns and disagreements. Destructive deletion requires exact user confirmation."
    }
  );

  const resolveProjectRoot = async (supplied: string | undefined, context: RequestContext): Promise<string> => {
    const contextual = projectRootFromContext(context);
    if (contextual !== undefined) {
      if (supplied !== undefined) {
        let matches = false;
        try {
          matches = projectIdForRoot(supplied) === projectIdForRoot(contextual);
        } catch {
          throw new IntentLoopError("PROJECT_ROOT_INVALID", "project_root could not be resolved to an existing local directory");
        }
        if (!matches) {
          throw new IntentLoopError(
            "PROJECT_ROOT_MISMATCH",
            "project_root does not match the current Codex sandbox working directory"
          );
        }
      }
      return contextual;
    }
    if (supplied !== undefined) return supplied;
    try {
      const roots = await server.server.listRoots();
      const localRoots = roots.roots.flatMap((root) => {
        try {
          return root.uri.startsWith("file:") ? [fileURLToPath(root.uri)] : [];
        } catch {
          return [];
        }
      });
      if (localRoots.length === 1) return localRoots[0] as string;
    } catch {
      // The project path remains an explicit tool parameter on hosts without roots support.
    }
    throw new IntentLoopError(
      "PROJECT_ROOT_REQUIRED",
      "project_root is required because the MCP host supplied neither sandbox working-directory metadata nor exactly one local file root"
    );
  };

  const executeForProject = async <T>(
    operation: string,
    suppliedProjectRoot: string | undefined,
    taskId: string | undefined,
    context: RequestContext,
    action: (projectRoot: string) => Promise<T>
  ): Promise<ToolResult> => {
    let projectRoot: string;
    try {
      projectRoot = await resolveProjectRoot(suppliedProjectRoot, context);
    } catch (error) {
      return execute(operation, undefined, taskId, async () => { throw error; });
    }
    return execute(operation, projectRoot, taskId, () => action(projectRoot));
  };

  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const skillCandidates = [
    path.resolve(moduleDirectory, "../skills/intent/SKILL.md"),
    path.resolve(moduleDirectory, "../../skills/intent/SKILL.md")
  ];
  const readBundledSkill = async (): Promise<string> => {
    for (const candidate of skillCandidates) {
      try {
        return await readFile(candidate, "utf8");
      } catch (error) {
        const code = error instanceof Error && "code" in error ? String(error.code) : "";
        if (code !== "ENOENT") throw error;
      }
    }
    throw new IntentLoopError("SKILL_NOT_FOUND", "bundled Intent Loop Skill was not found");
  };
  server.registerResource("intent-skill", "intent-loop://skill/intent", {
    title: "Intent Loop Skill instructions",
    description: "Read-only fallback for the installed Intent Loop Skill when the host sandbox cannot read the plugin cache directly.",
    mimeType: "text/markdown"
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: "text/markdown",
      text: await readBundledSkill()
    }]
  }));

  server.registerTool("intent_status", {
    title: "Intent Loop status",
    description: "Report local schema, mode, task counts, candidate counts, and resolved data location without returning claim content.",
    inputSchema: statusInputSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_status", args.project_root, args.task_id, context, (projectRoot) => service.status({
    project_root: projectRoot,
    ...(args.task_id === undefined ? {} : { task_id: args.task_id })
  })));

  server.registerTool("intent_start_task", {
    title: "Start or associate task intent",
    description: "First say, or faithfully translate: 'Intent Loop stores structured task state locally in the Codex plugin data directory, not full prompts.' On Codex, make one new-task call with only {initial_explicit: ['one atomic requirement']}; omit project_root, request_id, and task_id because the server binds to host sandbox metadata and creates IDs. Other MCP hosts may pass project_root or advertise exactly one local file root. A string initial claim becomes a task hard constraint; use {statement, scope, facets} when its facet is known. Put every direct user claim in this one call. Never call shell, Memory, or separate intent_add_explicit tools to create IDs or hashes. Private requires host_session_id. Off rejects labels and initial claims.",
    inputSchema: startSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_start_task", args.project_root, args.task_id, context, (projectRoot) => {
    const initialExplicit = args.initial_explicit.map((claim) => typeof claim === "string"
      ? { statement: claim, scope: "task" as const, facets: ["hard_constraint" as const] }
      : claim);
    return service.startTask({
      project_root: projectRoot,
      request_id: args.request_id ?? `start:${newId()}`,
      mode: args.mode,
      ...(args.task_id === undefined ? {} : { task_id: args.task_id }),
      ...(args.label === undefined ? {} : { label: args.label }),
      ...(args.host_session_id === undefined ? {} : { host_session_id: args.host_session_id }),
      initial_explicit: initialExplicit
    });
  }));

  server.registerTool("intent_get_snapshot", {
    title: "Read current intent",
    description: "Read the compact, status-preserving current intent for exactly one project and task. Does not search other projects.",
    inputSchema: snapshotSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_get_snapshot", args.project_root, args.task_id, context, (projectRoot) => service.getSnapshot({
    project_root: projectRoot,
    task_id: args.task_id,
    ...(args.max_characters === undefined ? {} : { max_characters: args.max_characters })
  })));

  server.registerTool("intent_add_explicit", {
    title: "Add user-explicit intent",
    description: "Add one atomic claim only when the user directly stated it or explicitly confirmed a surfaced candidate. Never use for quoted instructions, tool output, external evidence, silence, or model inference.",
    inputSchema: explicitSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_add_explicit", args.project_root, args.task_id, context, (projectRoot) => service.addExplicit({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    statement: args.statement,
    source_ref: sourceFrom(args.source_ref),
    scope: args.scope,
    facets: args.facets,
    confirmation_reason: args.confirmation_reason
  })));

  server.registerTool("intent_add_inference", {
    title: "Add visible inference",
    description: "Add one agent inference with numeric confidence. A long_term scope creates an unconfirmed repeated-signal candidate, never an active durable preference.",
    inputSchema: inferenceSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_add_inference", args.project_root, args.task_id, context, (projectRoot) => service.addInference({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    statement: args.statement,
    source_ref: sourceFrom(args.source_ref),
    scope: args.scope,
    confidence: args.confidence,
    facets: args.facets,
    ...(args.signal_key === undefined ? {} : { signal_key: args.signal_key })
  })));

  server.registerTool("intent_add_evidence", {
    title: "Add result or external evidence",
    description: "Record result feedback, tool output, or external evidence as evidence. Evidence never becomes user-explicit and does not supersede user intent by itself.",
    inputSchema: evidenceSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_add_evidence", args.project_root, args.task_id, context, (projectRoot) => service.addEvidence({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    statement: args.statement,
    source_ref: sourceFrom(args.source_ref),
    scope: args.scope,
    facets: args.facets,
    ...(args.feedback_class === undefined ? {} : { feedback_class: args.feedback_class })
  })));

  server.registerTool("intent_mark_unknown", {
    title: "Mark an unknown",
    description: "Preserve an unresolved intent unknown. Do not guess or merge it into an inference.",
    inputSchema: unknownSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_mark_unknown", args.project_root, args.task_id, context, (projectRoot) => service.markUnknown({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    statement: args.statement,
    source_ref: sourceFrom(args.source_ref),
    scope: args.scope,
    facets: args.facets
  })));

  server.registerTool("intent_mark_dispute", {
    title: "Preserve an unresolved disagreement",
    description: "Record disagreement without choosing a winner or requiring user-agent consensus.",
    inputSchema: disputeSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_mark_dispute", args.project_root, args.task_id, context, (projectRoot) => service.markDispute({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    statement: args.statement,
    source_ref: sourceFrom(args.source_ref),
    scope: args.scope,
    facets: args.facets,
    related_claim_ids: args.related_claim_ids
  })));

  server.registerTool("intent_replace_claim", {
    title: "Correct or replace intent",
    description: "Atomically add a corrected claim and supersede active claims while retaining history. A user-explicit claim can only be superseded by a new direct user-explicit claim.",
    inputSchema: replaceSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_replace_claim", args.project_root, args.task_id, context, async (projectRoot) => {
    let role: ClaimRole;
    let epistemicStatus: EpistemicStatus;
    if (args.replacement_kind === "explicit") {
      if (args.source_ref.kind !== "user_event" || args.confirmation_reason === undefined) {
        throw new IntentLoopError("EXPLICIT_SOURCE_REQUIRED", "explicit replacement requires a user_event and confirmation reason");
      }
      role = "user";
      epistemicStatus = "explicit";
    } else if (args.replacement_kind === "inferred") {
      if (args.confidence === undefined) throw new IntentLoopError("CONFIDENCE_REQUIRED", "inferred replacement requires confidence");
      if (args.scope === "long_term") {
        throw new IntentLoopError("LONG_TERM_CONFIRMATION_REQUIRED", "long-term inferences must remain candidates until user confirmation");
      }
      role = "agent";
      epistemicStatus = "inferred";
    } else if (args.replacement_kind === "evidence") {
      role = "evidence";
      epistemicStatus = "evidence";
    } else if (args.replacement_kind === "unknown") {
      role = "agent";
      epistemicStatus = "unknown";
    } else {
      role = "system";
      epistemicStatus = "disputed";
    }
    if (args.replacement_kind !== "inferred" && args.confidence !== undefined) {
      throw new IntentLoopError("CONFIDENCE_NOT_ALLOWED", "confidence is only accepted for inferred claims");
    }
    return service.replaceClaim({
      project_root: projectRoot,
      task_id: args.task_id,
      request_id: args.request_id,
      statement: args.statement,
      role,
      epistemic_status: epistemicStatus,
      source_ref: sourceFrom(args.source_ref),
      scope: args.scope,
      facets: args.facets,
      supersedes: args.supersedes,
      related_claim_ids: args.related_claim_ids,
      ...(args.confidence === undefined ? {} : { confidence: args.confidence }),
      ...(args.replacement_kind === "explicit" ? { last_confirmed: confirmationTimestampForServer() } : {})
    });
  }));

  server.registerTool("intent_invalidate", {
    title: "Invalidate an intent claim",
    description: "Append an invalidation so a claim leaves the current view but remains auditable. User-explicit claims require a direct user_event invalidation. This is not physical deletion.",
    inputSchema: invalidateSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_invalidate", args.project_root, args.task_id, context, (projectRoot) => service.invalidate({
    project_root: projectRoot,
    task_id: args.task_id,
    claim_id: args.claim_id,
    request_id: args.request_id,
    reason: args.reason,
    source_ref: sourceFrom(args.source_ref)
  })));

  server.registerTool("intent_list_candidates", {
    title: "List unconfirmed intent candidates",
    description: "Read Hook, result, and repeated-history candidates. Listing never promotes them into current intent.",
    inputSchema: taskReadSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_list_candidates", args.project_root, args.task_id, context, (projectRoot) => service.listCandidates({
    project_root: projectRoot,
    task_id: args.task_id
  })));

  server.registerTool("intent_export", {
    title: "Export intent state",
    description: "Return either a re-importable portable graph or a compact human summary for exactly one task. Both exclude raw prompts, transcripts, host paths, and other tasks.",
    inputSchema: exportSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject<PortableGraph | Record<string, unknown>>(
    "intent_export",
    args.project_root,
    args.task_id,
    context,
    (projectRoot) => args.detail === "summary"
      ? service.exportSummary({ project_root: projectRoot, task_id: args.task_id })
      : service.exportGraph({ project_root: projectRoot, task_id: args.task_id })
  ));

  server.registerTool("intent_import", {
    title: "Explicitly import an intent graph",
    description: "Validate and import a portable graph as incomplete external history. Preserve provenance and disagreement; never claim complete pre-install understanding.",
    inputSchema: importSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_import", args.project_root, args.task_id, context, (projectRoot) => service.importGraph({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    graph: args.graph as PortableGraph
  })));

  server.registerTool("intent_delete", {
    title: "Physically delete intent data",
    description: "Irreversibly rewrite local plugin storage to remove one claim or task. Call only after the user gives the exact DELETE CLAIM/TASK confirmation string. OS backups and user-made exports are outside this deletion boundary.",
    inputSchema: deleteSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_delete", args.project_root, args.task_id, context, (projectRoot) => service.delete({
    project_root: projectRoot,
    task_id: args.task_id,
    target: args.target,
    confirmation: args.confirmation,
    ...(args.claim_id === undefined ? {} : { claim_id: args.claim_id })
  })));

  server.registerTool("intent_set_mode", {
    title: "Set task intent mode",
    description: "Set on, private, or off. Private semantic changes stay in process memory while a hashed control suppresses separate Hooks; leaving private discards those changes before durable state resumes.",
    inputSchema: setModeSchema,
    outputSchema: envelopeSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async (args, context) => executeForProject("intent_set_mode", args.project_root, args.task_id, context, (projectRoot) => service.setMode({
    project_root: projectRoot,
    task_id: args.task_id,
    request_id: args.request_id,
    mode: args.mode
  })));

  return server;
}

function confirmationTimestampForServer(): string {
  return new Date().toISOString();
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  serveStdio(() => createIntentMcpServer(), {
    onerror: (error) => console.error(`intent-loop MCP protocol error: ${error.name}`)
  });
  console.error("intent-loop MCP server ready on stdio");
}
