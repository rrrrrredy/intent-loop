# State and MCP contract

## Boundary

The state service remembers only the smallest traceable working direction that may matter after compaction or resume. It does not plan, execute a domain task, read a transcript, manage permissions, or decide whether Codex has finished.

The public record and export contracts are:

- `schemas/intent-record.schema.json`
- `schemas/intent-export.schema.json`

## Local files

An installed marketplace plugin resolves its data directory from the plugin cache root and stores state under:

~~~text
<CODEX_HOME>/plugin-data/intent-formation/intent-events-v1.jsonl
~~~

This works around older Codex plugin runtimes that resolve a relative MCP `cwd` but do not expand `${PLUGIN_ROOT}` or `${PLUGIN_DATA}` inside a traditional `.mcp.json`. Explicit test deployments may set `INTENT_FORMATION_DATA_DIR`. A native `PLUGIN_DATA` directory is used when the host supplies one and no installed-cache root can be resolved.

Normal writes are append-only JSON Lines events. A replacement or invalidation adds an event; it does not overwrite the earlier source. Physical deletion is the exception: it atomically rewrites the store and precisely scrubs the deleted task or record from plugin-managed backup, interrupted-write, and corruption-quarantine side files while preserving unrelated recovery events.

The store uses a generation-checked directory lock, a short-lived `.bak`, atomic `.next.<id>` replacement files, and corruption quarantine files. On Unix-like systems it restricts managed directories to `0700` and files to `0600`; Windows uses inherited filesystem ACLs. Schema version 0 events have a tested migration to version 1.

## Record semantics

Each materialized record contains:

- one atomic `statement`;
- a semantic `role`;
- an `epistemic_status` that distinguishes user expression, Agent inference, evidence, unknown, and disagreement;
- a minimal `source_ref`;
- `scope`, `valid_from`, `last_confirmed`, and confirmation fields;
- `supersedes` links;
- active, superseded, or invalidated status; and
- optional result-feedback classification.

`explicit` means the user expressed the statement. It does not mean the statement is objectively true. Inferences require a numeric confidence and an Agent-inference source. Tool output and external material can only enter as evidence. Unknown and disputed records remain separate.

Long-term scope is rejected unless it is an explicitly confirmed user rule, or the same signal has appeared across at least three tasks and the user confirms promotion.

## Modes

| Mode | Behavior |
|---|---|
| `standard` | Persists deliberate atomic records locally. |
| `private` | Physically purges persisted task content; new record text remains only in the current MCP process and disappears on restart. |
| `off` | Stops state updates and implicit intent intervention; an existing snapshot is retained but not injected. |

## MCP tools

Every tool returns a short text result plus structured content.

| Tool | Purpose |
|---|---|
| `intent_start` | Associate a task ID with standard, private, or off mode. |
| `intent_show` | Return the full materialized snapshot and a compact current view. |
| `intent_add_explicit` | Add one statement directly expressed by the user. |
| `intent_add_inference` | Add one tentative Agent inference with confidence from 0 to 1. |
| `intent_add_evidence` | Add one result or external-evidence statement without elevating it to user intent. |
| `intent_mark_unknown` | Preserve an unresolved unknown. |
| `intent_mark_disagreement` | Preserve a user-Agent or evidence conflict without forcing consensus. |
| `intent_correct` | Add an explicit replacement and link the records it supersedes. |
| `intent_feedback` | Save keep, implementation change, intent change, or uncertain result feedback. |
| `intent_invalidate` | Make a record inactive without adding a replacement. |
| `intent_set_mode` | Change task privacy behavior. |
| `intent_export` | Create an integrity-checked portable export with a hashed source task ID and return an opaque managed-export ID. |
| `intent_import` | Verify and import a portable export only with explicit user confirmation; merging requires a separate explicit flag. Integrity does not authenticate the export author. |
| `intent_delete_record` | Physically purge one record and remove references to it. |
| `intent_forget` | Physically purge all plugin-managed state for one task. |

Tools accept the exact current task ID supplied by hook context. Record statements are capped at 2,000 characters; source excerpts are capped at 160 characters. A complete prompt, response, or transcript is outside the contract.

## Manual controls

These remain ordinary messages in the current Codex task:

~~~text
/intent start
/intent remember <one short goal>
/intent show
/intent correct
/intent feedback
/intent export
/intent private
/intent off
/intent forget
~~~

The hook maps them to the bounded MCP tools. There is no separate chat product or form. An export is stored under `<CODEX_HOME>/plugin-data/intent-formation/exports/<export-id>`; the absolute path is deliberately excluded from model context.

In standard mode, `/intent remember <text>` defaults to an explicit task `desired_outcome` and starts state when needed. Optional `goal:`, `outcome:`, `constraint:`, `preference:`, `success:`, and `tradeoff:` prefixes select a role without asking the model to infer one. The short-lived command Hook refuses this command in private mode because an in-memory record created there would disappear as soon as the Hook process exits; private records are available only through the continuing State MCP process.

The controls require the packaged Hooks to be reviewed and trusted by Codex. The implicit Skill can recover receipt-backed operations when a command Hook is unavailable, except for `off`: it deliberately refuses `/intent off` and `/intent start off` because a model-initiated state write cannot prove that future UserPromptSubmit events will receive the task-specific override. Headless release automation may use Codex's explicit Hook-trust bypass only after auditing the exact package under test.

## Compact handoff

`intent_show` computes the current view from active events. Session resume and post-compaction context use the same compact representation, with labels such as `Outcome [user]`, `Unknown [unknown]`, and `Disagreement [disputed]`. Inferences include their confidence. Superseded and invalidated records remain in the auditable full snapshot but are omitted from the compact active view.
