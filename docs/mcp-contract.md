# MCP tool contract

The local server stores and projects intent state only. It does no domain task work, planning, host permission management, file editing, testing, or delivery.

All tools return both a concise text block and `structuredContent` with `ok`, `schema_version`, `operation`, `project_id`, `task_id`, and an operation-specific result or structured error. Inputs are strict; unknown keys are rejected.

Every project-scoped tool accepts an optional `project_root`. The server advertises Codex's experimental `codex/sandbox-state-meta` capability and uses the host-provided `sandboxCwd` as the authoritative root when present. Malformed advertised metadata returns `PROJECT_ROOT_METADATA_INVALID`; a conflicting explicit root returns `PROJECT_ROOT_MISMATCH`, both before state access. Roots must be absolute existing local directories, and Windows UNC/device namespaces are rejected before filesystem resolution. On another MCP host, an explicit existing local root is accepted; if it is omitted, the server accepts exactly one advertised local file root and otherwise fails closed with `PROJECT_ROOT_REQUIRED`. The service stores only the canonical-root hash, exposes no global task search, and still requires a task UUID for task-level reads.

The server also exposes one static read-only MCP resource, `intent-loop://skill/intent`. It returns the actual bundled `skills/intent/SKILL.md` as `text/markdown`. This is a host-compatibility fallback for Windows sandboxes that discover a plugin Skill but deny direct shell reads from the installed cache. It contains no task data and introduces no second policy source.

## Tools

| Tool | Required intent and effect |
| --- | --- |
| `intent_start_task` | Start or associate a task with the current host-bound project and optional host session ID; private mode requires that hidden host token. Returns task UUID and compact empty/current snapshot. |
| `intent_get_snapshot` | Read a capped current snapshot, unresolved disputes/unknowns, stale warnings, and resolved storage location. No mutation. |
| `intent_add_explicit` | Add an atomic statement directly expressed or confirmed by the user. Requires a user-event source and `direct_statement` or `confirmed_candidate`; never accepts tool/evidence source kinds. |
| `intent_add_inference` | Add an agent inference with required numeric confidence and minimal source. It remains visibly inferred. |
| `intent_add_evidence` | Add result feedback or external/tool evidence. Evidence remains evidence even when compelling. |
| `intent_mark_unknown` | Add a first-class unknown with the decision it affects. |
| `intent_mark_dispute` | Add a disagreement referencing two or more claim IDs or an explicit free-standing disagreement. It does not choose a winner. |
| `intent_replace_claim` | Atomically add a corrected claim and supersede one or more existing claims while preserving their source history. |
| `intent_invalidate` | Append invalidation for a claim with reason and source. The claim leaves the current projection. |
| `intent_list_candidates` | Read unconfirmed Hook/result/history candidates. It never promotes them. |
| `intent_export` | Return either a compact human summary or one portable versioned task graph. Default output is structured content, not a file write. |
| `intent_import` | Validate and explicitly import a portable graph. Preserves provenance and relationships, labels the import as incomplete external history, and never silently merges conflicts. |
| `intent_delete` | Physically delete one claim or task after an exact confirmation token; verifies views, mappings, exports, and persistent bytes. |
| `intent_set_mode` | Set task `on`, `private`, or `off`. Private semantics are process-local; a hashed control marker suppresses Hooks and makes restart fail closed. |
| `intent_status` | Report server/schema versions, runtime mode, resolved storage directory, corruption status, the real aggregate Hook candidate count, and private-control counts without returning claim content. Read-only status does not create storage. |

## Mutating-tool invariants

- Statements are redacted and capped at 500 characters; source excerpts at 160.
- `inferred` requires confidence; no other status accepts model confidence.
- Tool/external results cannot use `intent_add_explicit`.
- Replacement and invalidation target active records in the same task/project. A user-explicit claim can be replaced only by direct user-explicit input and invalidated only by a direct user event.
- Long-term inferred claims cannot be promoted directly; they become candidates until the three-task plus confirmation rule is met.
- `private` never writes semantic content to disk; it does write the hashed suppression control described above. `off` rejects semantic reads and writes with a non-blocking status result.
- Task-scoped mutations deduplicate the same `request_id` inside the storage lock, including across MCP processes. Starting a new task is intentionally not advertised as idempotent.

## Hook-only command surface

Hooks invoke a small local CLI, not MCP tools exposed to the model:

- `hook session-start`: load same-project direct user-event/user-explicit context or output nothing;
- `hook user-prompt`: record only event ID/hash and candidate metadata when mode is on;
- `hook post-compact`: verify state and flag recovery for the next SessionStart;
- `hook stop` / `hook session-end`: record only hashed candidate outcome metadata.

Every Hook catches all errors, emits `continue: true`, and exits within its timeout. No Hook calls the network, reads a transcript path, blocks a prompt, sets user satisfaction, or promotes a candidate.

## Manual Skill entry points

The `intent` Skill maps the requested entry points to these tools:

- `/intent start` → start/associate;
- `/intent show` → snapshot;
- `/intent correct` → replacement or invalidation after one low-burden clarification if necessary;
- `/intent feedback` → result evidence followed by keep / implementation change / intent change / uncertain classification;
- `/intent forget` → explicit deletion confirmation and delete;
- `/intent export` → portable export;
- `/intent off` → task-level off.

If the installed surface exposes skills through `$intent` rather than a direct `/intent` alias, the Skill must still accept the same subcommands in ordinary conversation. Exact command discoverability is an E2E item, not an assumed fact.
