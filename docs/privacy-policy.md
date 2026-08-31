# Intent Loop privacy policy

Effective date: 2026-08-31

Intent Loop is open-source software that runs locally in Codex or DeepSeek Harness. The project maintainer does not operate a hosted Intent Loop service and does not receive plugin data through the runtime.

## Data processed locally

When enabled for a task, Intent Loop can process and store:

- atomic intent claims and their explicit, inferred, evidence, unknown, or disputed status;
- minimal source references such as event IDs and SHA-256 hashes;
- task and project-scoped identifiers;
- correction, supersession, invalidation, mode, and deletion events;
- optional Hook candidates represented by hashes and short redacted excerpts.

By default it does not persist complete prompts, transcripts, workspace files, or tool outputs. Input is screened for seeded credential formats and transcript-shaped records are rejected. Redaction is not comprehensive PII detection: a user can intentionally place names, addresses, or other personal information in an atomic claim, and that content can then be stored locally.

## Storage and network behavior

The runtime contains no outbound network client. Durable data stays below the active host's plugin data root reported by the status tool. Codex supplies its sandbox working directory through MCP metadata. The DeepSeek adapter supplies the immutable workspace and session identity from the active Harness agent and removes those fields from model-visible schemas. Intent Loop canonicalizes and hashes the workspace for project isolation and does not persist the raw path in ledger events.

The DeepSeek adapter starts one local MCP child lazily per active Harness session. Its child environment contains a small allowlist of operating-system variables and intentionally omits model API keys and similar credentials. Private mode keeps semantic state only in the session's MCP process. It writes a small control file containing hashed session metadata and a task ID so independent processes fail closed and a restarted MCP does not write private semantics. Re-enabling durable mode or deleting the task removes that control. Off mode stores no semantic records.

Codex, DeepSeek Harness, the operating system, GitHub, and any tools a user separately invokes have their own data practices and are not controlled by Intent Loop.

## Retention, access, export, and deletion

Durable task data remains until the user deletes it. Uninstalling the plugin does not delete that data. Users can inspect current state, return a compact human summary, export one task's portable graph, invalidate a claim while retaining audit history, or physically delete one claim or task after an exact confirmation.

Physical deletion verifies the live Intent Loop data root. It cannot erase independent backups, volume snapshots, copied exports, or files outside that root.

## Sharing

The runtime does not transmit or sell local plugin data. Users decide whether to share exported graphs, diagnostics, or repository issues. Never include private task data in a public issue.

## Security

The project uses host-bound project isolation, explicit-path mismatch rejection, schema validation, a hash-chained ledger, live-owner locks with heartbeats, credential-pattern redaction, bounded Codex Hook input, fail-open Hooks, a credential-minimized DeepSeek child environment, and post-delete identifier scans. Hook-injected compact context contains only direct user-event and user-explicit claims; persisted evidence, inferences, imports, unknowns, and disputes are not re-injected as instructions. No software can eliminate all risk; review SECURITY.md before reporting a vulnerability.

## Changes and contact

Material policy changes will be recorded in the repository history and release notes. Questions may be opened at https://github.com/rrrrrredy/intent-loop/issues using synthetic data only.
