# Privacy and threat model

## Trust boundary

The core policy plugin is local and state-free. The optional State companion owns the plugin-managed ledger and exports. Codex or DeepSeek Harness owns conversation history, model traffic, permissions, and task execution. The operating system owns account access, backups, and snapshots.

## Stored data

| Surface | Stored by Intent Formation |
| --- | --- |
| Core policy | Nothing. The MCP tool accepts no prompt input. |
| Standard State | Deliberately added atomic records, provenance, mode events, links, hashes, and timestamps. |
| Private State | A mode marker without custom title or workspace hash; new semantic record text stays in MCP-process memory. Re-entering private mode purges legacy marker metadata. |
| Off State | Existing snapshot, an off-mode event, and a hashed lock-independent marker directory; no new semantic updates. |
| Managed export | Full selected records and provenance in an integrity-checked JSON file. |

## Main threats

| Threat | Control | Residual risk |
| --- | --- | --- |
| Accidental transcript retention | Hooks do not write prompts; record statements and excerpts are bounded; full outputs are outside the state contract. `/intent show` returns three bounded records per page and the complete command output is capped at 3,000 UTF-8 bytes, below its 4,000-token Hook limit. | A model can still misuse a state tool. Host conversation storage and any future host spill behavior are separate; the real-host gate checks that current valid outputs create no `hook_outputs` spill. |
| Secrets in a record | Common key, token, bearer, password, and credential-label patterns are redacted. | Pattern matching is incomplete. Never use State as a vault. |
| Prompt injection through saved data | Automatic resume includes only quoted user-origin explicit, unknown, or disputed data and labels it as data. Evidence and inferences are excluded. | Host provenance is behavioral rather than cryptographically signed. |
| Cross-task access | Host-derived task IDs partition state; the DeepSeek adapter strips model-selected task and workspace fields. | Local filesystem access remains stronger than this namespace boundary. |
| Partial or concurrent writes | Generation-checked directory locks, fsync, atomic replacement, backup restore, migration, corrupt-line quarantine, independent-process stress, and stale-lock ABA tests have regression coverage. A failed mutation reports `changed: unknown` and a recovery step. | Storage or hardware failure can still lose the last operation or its acknowledgement. Inspect state before retrying. |
| False command success | Manual controls require `ok: true`, a trusted source, and a non-empty receipt. Missing receipts must be reported as failure. | A model can ignore instructions; users should check the receipt. |
| Private commands claim inaccessible or transient memory | The short-lived command Hook refuses private remember, feedback, show, and correction commands, makes no change, and returns no receipt. | Private records created through the MCP tools last only for that MCP process. |
| `/intent off` ignored | The trusted Codex State Hook reads a hashed marker without taking the ledger lock and injects a task-specific override on every ordinary prompt. The DeepSeek adapter invalidates its cache from durable ledger generation and omits policy after acknowledged or acknowledgement-lost changes. Both paths have regression tests; the model-only Codex fallback refuses off commands. | Codex users must review the Hook first; model behavior cannot be made cryptographically deterministic. |
| Deletion leaves copies | Record deletion, forget, and private-mode transition hold the ledger lock while scrubbing recovery artifacts and matching managed exports. Recovery cleanup precedes primary replacement so an interrupted purge retains the tokens needed on retry. Identified unrelated task and record fragments remain intact. Private export is rejected before serialization or write. | External exports, host logs, backups, snapshots, and storage-media remnants remain. |
| Child process receives credentials | DeepSeek adapter uses an environment allowlist and removes model-provider key, token, and secret variables. | The surrounding Harness process remains outside this boundary. |
| Another local account reads state | Unix directories/files are created as `0700`/`0600`; Windows uses inherited account ACLs. | Administrators, same-account processes, backups, and permissive parent ACLs remain outside the plugin boundary. |

## Deletion meaning

“Physical purge” means removal from the plugin-managed active ledger, matching recovery files, and applicable managed exports while one cross-process transaction lock is held. It does not promise secure erasure from storage media, operating-system backups, snapshots, third-party sync, Codex conversation/history storage, or copied files.

## Verification boundary

Tests establish source, package, local MCP, and selected real-host behavior. They cannot prove every future model response, prevent a malicious local administrator, or guarantee that a host never changes its plugin contract.
