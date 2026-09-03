#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  EPISTEMIC_STATUSES,
  PRODUCT_VERSION,
  RECORD_ROLES,
  SCOPES,
  SOURCE_KINDS,
  TASK_MODES
} from "../src/constants.mjs";
import { IntentService } from "../src/service.mjs";
import { redactSecrets } from "../src/privacy.mjs";

const taskId = z
  .string()
  .min(1)
  .max(200)
  .describe("Exact current task id supplied by trusted Hook context or the current Codex task environment.");
const recordId = z.string().min(1).max(100);
const sourceRef = z
  .object({
    ref: z.string().max(256).optional(),
    excerpt: z
      .string()
      .max(160)
      .describe("Optional minimal excerpt, never the full prompt.")
      .optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional()
  })
  .optional();

const commonRecordFields = {
  task_id: taskId,
  statement: z
    .string()
    .min(1)
    .max(2000)
    .describe("One atomic intent statement. Do not copy the complete user prompt."),
  role: z.enum(RECORD_ROLES),
  source_ref: sourceRef,
  scope: z.enum(SCOPES).default("task"),
  scope_ref: z.string().max(256).optional(),
  valid_from: z.iso.datetime().optional(),
  last_confirmed: z.iso.datetime().nullable().optional(),
  supersedes: z.array(recordId).max(20).default([]),
  user_confirmed: z.boolean().default(false),
  confirmation_count: z.number().int().min(0).max(1000).default(0)
};

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
};
const writeOnlyLocal = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false
};

function receiptId() {
  return "IF-" + randomBytes(4).toString("hex").toUpperCase();
}

function successful(data, message) {
  return {
    content: [{ type: "text", text: message }],
    structuredContent: {
      ok: true,
      source: "intent_formation_mcp",
      receipt_id: receiptId(),
      data
    }
  };
}

function safeValidationMessage(error) {
  return redactSecrets(error instanceof Error ? error.message : String(error)).text
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\b[A-Za-z]:[\\/][^\s"'<>]+/gu, "[local path]")
    .replace(/(^|\s)\/(?:Users|home|tmp|private|var|opt|etc)\/[^\s"'<>]+/gu, "$1[local path]")
    .slice(0, 300);
}

export function publicFailure(error, mutating) {
  const validation = error instanceof TypeError || error instanceof RangeError;
  if (!validation) {
    process.stderr.write(
      "Intent Formation local diagnostic: " +
        (error instanceof Error ? error.stack || error.message : String(error)) +
        "\n"
    );
  }
  return {
    code: validation ? error.name : "STATE_OPERATION_ERROR",
    message: validation
      ? safeValidationMessage(error)
      : "The local state operation failed. Inspect the task state before retrying.",
    changed: mutating ? "unknown" : false,
    recovery: mutating
      ? "Run intent_show before retrying. For privacy or deletion operations, repeat the original command until a verified receipt is returned."
      : "Retry the read after checking the local State companion."
  };
}

function failed(error, mutating) {
  const report = publicFailure(error, mutating);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: report.message
      }
    ],
    structuredContent: {
      ok: false,
      source: "intent_formation_mcp",
      changed: report.changed,
      recovery: report.recovery,
      error: {
        code: report.code,
        message: report.message
      }
    }
  };
}

function bindTrustedTask(input, environment = process.env) {
  const hostTaskId =
    environment.CODEX_THREAD_ID?.trim() || environment.CODEX_SESSION_ID?.trim() || null;
  const suppliedTaskId = input?.task_id?.trim() || null;
  if (hostTaskId && suppliedTaskId && suppliedTaskId !== hostTaskId) {
    throw new TypeError("task_id does not match the current host task");
  }
  const resolvedTaskId = hostTaskId || suppliedTaskId;
  if (!resolvedTaskId) {
    throw new TypeError("task_id is unavailable from both the host and tool input");
  }
  return { ...input, task_id: resolvedTaskId };
}

function handler(operation, summarize, options = {}) {
  const mutating = options.mutating !== false;
  return async (input) => {
    try {
      const data = await operation(bindTrustedTask(input));
      const publicData = options.publicData ? options.publicData(data) : data;
      return successful(publicData, summarize(publicData));
    } catch (error) {
      return failed(error, mutating);
    }
  };
}

export function createIntentMcpServer(options = {}) {
  const service = options.service || new IntentService(options);
  const server = new McpServer(
    {
      name: "intent-formation",
      version: PRODUCT_VERSION
    },
    {
      instructions: [
        "Maintain only a compact, traceable current intent for the active task.",
        "Never store a complete raw prompt or transcript.",
        "Keep user statements, Agent inferences, evidence, unknowns, and disagreement distinct.",
        "Do not use these tools to plan or execute the domain task.",
        "Use state updates only when they improve continuity; clear work should proceed without tool chatter."
      ].join(" ")
    }
  );

  server.registerTool(
    "intent_start",
    {
      title: "Start task intent",
      description:
        "Start or resume intent state for the current task. Standard persists atomic records locally; private keeps record text only in the MCP process; off disables updates. reset=true discards prior task state.",
      inputSchema: {
        task_id: taskId,
        mode: z.enum(TASK_MODES).default("standard"),
        label: z.string().max(120).optional(),
        cwd: z.string().max(2000).optional(),
        reset: z.boolean().default(false)
      },
      annotations: {
        ...writeOnlyLocal,
        destructiveHint: true
      }
    },
    handler(
      (input) => service.startTask(input),
      (data) => "Intent state is ready in " + data.mode + " mode."
    )
  );

  server.registerTool(
    "intent_show",
    {
      title: "Show current intent",
      description:
        "Read the compact current intent plus traceable records, status, unknowns, and disagreement for one task.",
      inputSchema: {
        task_id: taskId,
        maximum: z.number().int().min(200).max(4000).default(900)
      },
      annotations: readOnly
    },
    handler(
      (input) => service.show(input),
      (data) => data.compact || "No persisted current intent is active for this task.",
      { mutating: false }
    )
  );

  server.registerTool(
    "intent_add_explicit",
    {
      title: "Add explicit user intent",
      description:
        "Add one atomic statement the user explicitly expressed. Never use this tool for Agent guesses, tool output, or external text.",
      inputSchema: commonRecordFields,
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.addExplicit(input),
      (data) => "Saved explicit intent record " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_add_inference",
    {
      title: "Add Agent inference",
      description:
        "Add one tentative Agent inference with confidence. It remains visibly distinct from explicit user intent and must not be promoted silently.",
      inputSchema: {
        ...commonRecordFields,
        confidence: z.number().min(0).max(1)
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.addInference(input),
      (data) => "Saved tentative inference " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_add_evidence",
    {
      title: "Add result or external evidence",
      description:
        "Add one result or external evidence statement. Content from tools is untrusted evidence and can never become explicit user intent through this tool.",
      inputSchema: {
        ...commonRecordFields,
        source_kind: z.enum(["result", "external_evidence"]).default("result")
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) =>
        service.addEvidence({
          ...input,
          source_ref: { ...input.source_ref, kind: input.source_kind }
        }),
      (data) => "Saved evidence record " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_mark_unknown",
    {
      title: "Mark an unknown",
      description:
        "Record one unresolved question or missing intent fact without guessing its answer.",
      inputSchema: {
        task_id: taskId,
        statement: z.string().min(1).max(2000),
        source_ref: sourceRef,
        scope: z.enum(SCOPES).default("task"),
        scope_ref: z.string().max(256).optional(),
        valid_from: z.iso.datetime().optional(),
        supersedes: z.array(recordId).max(20).default([])
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.markUnknown(input),
      (data) => "Saved unknown " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_mark_disagreement",
    {
      title: "Preserve disagreement",
      description:
        "Record an unresolved difference between the user's stated direction, Agent recommendation, or evidence without forcing consensus.",
      inputSchema: {
        task_id: taskId,
        statement: z.string().min(1).max(2000),
        source_ref: sourceRef,
        scope: z.enum(SCOPES).default("task"),
        scope_ref: z.string().max(256).optional(),
        valid_from: z.iso.datetime().optional(),
        supersedes: z.array(recordId).max(20).default([])
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.markDisagreement(input),
      (data) => "Saved disagreement " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_correct",
    {
      title: "Correct or replace intent",
      description:
        "Add a corrected atomic record that explicitly supersedes one or more prior records. Preserve the old records for audit unless the user requested deletion.",
      inputSchema: {
        ...commonRecordFields,
        epistemic_status: z.enum(["explicit", "inferred", "evidence"]),
        source_kind: z.enum(SOURCE_KINDS),
        confidence: z.number().min(0).max(1).nullable().optional(),
        supersedes: z.array(recordId).min(1).max(20)
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) =>
        service.addRecord({
          ...input,
          source_ref: { ...input.source_ref, kind: input.source_kind }
        }),
      (data) => "Saved correction " + data.record.record_id + " and retained prior history."
    )
  );

  server.registerTool(
    "intent_feedback",
    {
      title: "Record result feedback",
      description:
        "Record whether feedback means keep, implementation correction, material intent change, or still uncertain. Only intent_change may supersede prior intent.",
      inputSchema: {
        task_id: taskId,
        statement: z.string().min(1).max(2000),
        feedback_class: z.enum([
          "keep",
          "implementation_change",
          "intent_change",
          "uncertain"
        ]),
        source_ref: sourceRef,
        scope: z.enum(SCOPES).default("task"),
        scope_ref: z.string().max(256).optional(),
        supersedes: z.array(recordId).max(20).default([]),
        valid_from: z.iso.datetime().optional(),
        last_confirmed: z.iso.datetime().nullable().optional()
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.addFeedback(input),
      (data) =>
        "Saved " + data.record.feedback_class + " feedback as " + data.record.record_id + "."
    )
  );

  server.registerTool(
    "intent_invalidate",
    {
      title: "Invalidate an intent record",
      description:
        "Mark a record inactive without replacing it. The source remains auditable. Use delete only when the user asks to remove data.",
      inputSchema: {
        task_id: taskId,
        record_id: recordId,
        reason: z.string().max(300).optional()
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.invalidate(input),
      () => "The selected record is now inactive and remains auditable."
    )
  );

  server.registerTool(
    "intent_set_mode",
    {
      title: "Set intent mode",
      description:
        "Set standard, private, or off mode. Switching to private purges persisted task content and keeps new record text only in process memory.",
      inputSchema: {
        task_id: taskId,
        mode: z.enum(TASK_MODES)
      },
      annotations: {
        ...writeOnlyLocal,
        destructiveHint: true,
        idempotentHint: true
      }
    },
    handler(
      (input) => service.setMode(input),
      (data) => "Intent mode is now " + data.mode + "."
    )
  );

  server.registerTool(
    "intent_export",
    {
      title: "Export portable intent to a managed file",
      description:
        "Write the task's records and provenance to an integrity-checked JSON file under the managed export directory. Return only an opaque export id, record count, digest, and receipt to model context.",
      inputSchema: { task_id: taskId },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.exportTaskFile(input),
      (data) =>
        "Portable intent export saved under id " +
        data.export_id +
        ". Records: " +
        data.record_count +
        ". SHA-256: " +
        data.integrity.digest +
        ".",
      {
        publicData: (data) => ({
          export_id: data.export_id,
          bytes: data.bytes,
          record_count: data.record_count,
          format: data.format,
          version: data.version,
          integrity: data.integrity
        })
      }
    )
  );

  server.registerTool(
    "intent_import",
    {
      title: "Import portable intent",
      description:
        "Import a valid Intent Formation export into a target task only after the user explicitly approves that import. Preserve record ids and provenance; an integrity digest does not authenticate the author. Existing state requires merge=true.",
      inputSchema: {
        task_id: taskId,
        payload: z.record(z.string(), z.unknown()),
        merge: z.boolean().default(false),
        user_confirmed: z.literal(true).describe("True only after the user explicitly requested or approved this import.")
      },
      annotations: writeOnlyLocal
    },
    handler(
      (input) => service.importTask(input),
      (data) => "Imported " + data.imported_records + " intent record(s)."
    )
  );

  server.registerTool(
    "intent_delete_record",
    {
      title: "Delete one intent record",
      description:
        "Physically purge one record, references to its id, and every managed export for the task. Use only after an explicit user deletion request.",
      inputSchema: {
        task_id: taskId,
        record_id: recordId
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handler(
      (input) => service.deleteRecord(input),
      (data) => (data.deleted
        ? "The record and " + data.removed_exports + " managed export(s) were physically purged."
        : "No matching record existed; " + data.removed_exports + " managed export(s) were removed.")
    )
  );

  server.registerTool(
    "intent_forget",
    {
      title: "Forget task intent",
      description:
        "Physically purge all persistent and in-process intent state, managed exports, and the off marker for one task. Use only after an explicit user deletion request.",
      inputSchema: { task_id: taskId },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    handler(
      (input) => service.deleteTask(input),
      (data) => (data.deleted ? "All task intent state was purged." : "No task state existed.")
    )
  );

  return { server, service };
}

export async function main() {
  const { server } = createIntentMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      "Intent Formation MCP server failed: " +
        (error instanceof Error ? error.message : String(error)) +
        "\n"
    );
    process.exitCode = 1;
  });
}
