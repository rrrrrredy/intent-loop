# Intent state and storage contract

Status: schema v1 frozen before implementation on 2026-08-28.

## Scope and location

On the tested Codex host, runtime data lives below `${CODEX_HOME}/plugin-data/intent-loop/v1/`. This compatibility location is necessary because `PLUGIN_DATA` is guaranteed for Hooks but was not available to the installed bundled MCP process. Resolution order is explicit test/development override, `CODEX_HOME`, `PLUGIN_DATA`, then a cache-layout inference that is accepted only when the executable is inside `<codex-home>/plugins/cache/`. Development and tests may set `INTENT_LOOP_DATA_DIR` explicitly; production never falls back to the plugin source tree, an arbitrary home folder, or a user workspace.

Each canonical project root becomes `project_id = sha256("intent-loop-project-v1\\0" + canonical_root)`. Roots must be absolute existing local directories; Windows UNC and device namespaces are rejected before filesystem resolution. On Windows the canonical root is case-folded. User path segments and the raw root never become storage path segments. On Codex, the MCP server advertises `codex/sandbox-state-meta` and resolves every tool call from the host-provided `sandboxCwd`; malformed host metadata and an explicit conflicting root are rejected before storage access. Other MCP hosts must pass an existing local root or advertise exactly one local file root. Each task has a UUID; when a new start omits it, the server derives a UUIDv5-shaped identifier from the project and opaque request ID so an exact retry resolves to the same task. Task reads require the resolved project scope and task ID, and the service rejects a task whose recorded project ID differs from the requested project.

Directory shape:

```text
${CODEX_HOME}/plugin-data/intent-loop/v1/
  projects/<project_id>/
    ledger.jsonl
    ledger.lock/
    private-sessions/<host_session_hash>.json
    quarantine/
```

There is no network transport and no analytics endpoint.

## Append event

Every durable mutation is one canonical JSON object on one line:

```json
{
  "schema_version": 1,
  "event_id": "uuid",
  "event_type": "claim_added",
  "project_id": "sha256",
  "task_id": "uuid",
  "occurred_at": "RFC3339 UTC",
  "actor": "user|agent|evidence|system",
  "payload": {},
  "prev_hash": "sha256 or null",
  "event_hash": "sha256"
}
```

`event_hash` covers the canonical event without `event_hash`; `prev_hash` creates a per-project integrity chain. A mutating process obtains an exclusive directory lock containing its PID and random owner token, maintains a heartbeat, validates the owner before release, checks liveness before stale recovery, validates the current chain, writes the complete next ledger to a mode-0600 sibling file, fsyncs it, atomically replaces the ledger, fsyncs the directory, and releases the lock. Reclaim and release markers coordinate atomic directory moves; product-owned move/delete races are retried as transient, renamed remnants are removed with bounded retries, and a successful durable action is never reported as a failed mutation solely because cleanup raced. Waiters time out after a bounded period without owner-token progress and also retain an absolute wait ceiling, so a progressing writer queue is not mistaken for a stuck lock. Replacing rather than opening an existing ledger for append prevents writes through a hardlink. The ledger, lock, quarantine, and private-control paths reject symbolic links, Windows junctions, non-regular files, and multiply linked data files; resolved paths must stay inside the project directory. Reads do not create project directories, locks, or repair files. On the next mutation, a crashed trailing partial line is summarized in quarantine by byte length and SHA-256, removed through a temporary verified ledger plus fsync and atomic replace, and never retained verbatim. Strictly named orphan ledger/control temporary files are removed under the same lock. A malformed middle record or broken hash chain stops projection.

Every mutation stores a SHA-256 request fingerprint over its operation and normalized parameters. It contains no raw parameter body. An exact retry is deduplicated under the project lock; the same request ID with different normalized parameters fails with `REQUEST_ID_REUSED`.

## Claim

An atomic claim payload contains:

| Field | Contract |
| --- | --- |
| `claim_id` | UUID, immutable. |
| `statement` | Atomic, redacted text, 1-500 characters; not a full prompt or transcript. |
| `role` | `user`, `agent`, `evidence`, or `system`. |
| `epistemic_status` | `explicit`, `inferred`, `evidence`, `unknown`, or `disputed`. |
| `source_ref` | Minimal source object described below. |
| `scope` | `task`, `project`, or `long_term`; default `task`. |
| `confidence` | Required 0-1 only for `inferred`; absent for other states. |
| `valid_from` | RFC3339 UTC. |
| `last_confirmed` | RFC3339 UTC or null. |
| `supersedes` | Claim IDs replaced by this claim; old records remain auditable. |
| `facets` | One or more of `outcome`, `success_signal`, `failure_signal`, `hard_constraint`, `soft_constraint`, `tradeoff`, `unknown`, `result_feedback`, `disagreement`. |

Lifecycle is event-derived. `claim_invalidated` makes a claim inactive; `claim_replaced` adds a new claim and supersedes old IDs in the same locked mutation. An active user-explicit claim can be superseded only by a new direct user-explicit claim and invalidated only from a direct user event. Evidence, inference, imports, and system records cannot silently displace it. `explicit` records what the user said, not whether it is objectively true. `unknown` and `disputed` records are never auto-merged with an inference.

A new `task_started` event may contain up to 12 `initial_claims`. The server creates their task, claim, source, and provenance identifiers, so a manual start can preserve all directly stated atomic claims in one locked MCP operation without model-generated UUIDs, hashes, or follow-up claim calls. Off mode rejects a label or initial claims.

## Source reference

```json
{
  "kind": "user_event|agent_turn|tool_result|external_evidence|explicit_import",
  "event_id": "opaque host or plugin event id",
  "sha256": "hash of a validated event ID, or of available source text after redaction",
  "excerpt": "optional redacted excerpt, at most 160 characters"
}
```

At least one of `event_id` or `sha256` is required. For Hook observations, a validated opaque host event ID is the sole source identity when available. Without one, text is credential-redacted before request and source hashes are derived; neither the raw text nor a digest of the raw text or recognized secret is retained. An excerpt is optional and off by default for Hook-observed prompts. Full prompts, transcript paths, tool payloads, and recognized credential/token patterns are rejected or redacted. Imports are validated for bounded size, UTC timestamps, unique IDs, reference integrity, acyclic/time-ordered supersession, and legal role/status/confidence combinations. Every imported claim, candidate, and internal task reference receives a fresh UUID; source identities survive only inside provenance hashes. Accepted source provenance becomes `explicit_import` and is not treated as a direct user event.

## Current projection

The current snapshot is computed from the verified ledger; it is not a separately authoritative file. It contains active claims grouped by facet and epistemic status, unresolved disagreements, unknowns, minimal sources, and stale-long-term warnings. Invalidated and superseded claims appear only in audit/history views.

The manual compact snapshot is deterministically capped by record count and character budget. Hook-injected context is narrower: only direct user-event and user-explicit claims can appear as semantic text. Evidence, inference, imports, unknowns, and disputes are represented only by omitted-item counts so persisted content cannot become a later instruction channel. Neither view resolves a conflict merely to fit the budget.

Private semantic events live only in the active MCP process. The `private-sessions` control file contains a schema version, project ID, task ID, hashed host-session ID, mode, and timestamp, but no statement or excerpt. Session/task ownership is one-to-one and compare-and-set under the same project lock; a different task cannot take a session and a different session cannot clear a task's control. Hook paths check both the current session association and any task-level private control. After restart the control is a recovery handle: the user can resume an empty private task, explicitly create an empty durable on/off task, or delete it. Re-enable append and control removal are one locked transaction, so a retry can finish cleanup after interruption.

## Long-term promotion

- A direct user declaration of a durable rule can create a `long_term` explicit claim.
- Otherwise a repeated signal must occur in at least three distinct task IDs and remain only a candidate until the user confirms it.
- Acceptance, silence, and a single choice never count as confirmation.
- An inferred long-term record with no confirmation for 90 days becomes stale and is excluded from automatic compact handoff until reviewed.

## Migration and recovery

The first line declares schema v1 through its event. Readers reject newer schemas. A future migration must verify the entire source chain, write a new ledger in a sibling temporary file, fsync, atomically replace, and preserve a migration manifest. The v1 migration is identity and is covered by fixtures.

Corruption recovery is fail-closed for state mutation but fail-open for Codex: the MCP tool returns a structured diagnostic and Hooks emit `continue: true` with no injected state. A recovery command can export the verified prefix and quarantine the damaged suffix; it never invents claims.
