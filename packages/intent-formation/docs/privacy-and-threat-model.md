# Privacy and threat model

## Privacy posture

Intent Formation is local and sparse by default. The MCP server makes no network request and does not require a third-party account. It stores atomic intent statements and provenance needed for continuity, not complete prompts, assistant responses, or transcripts.

The plugin is not a secret vault. Anyone who can read the local Codex data directory can read standard-mode intent records.

## Data by event

| Input or event | Persisted in standard mode |
|---|---|
| User prompt | No. The UserPromptSubmit hook receives it from Codex but neither echoes nor writes it. |
| Atomic explicit statement | Yes, only when Codex deliberately calls the corresponding MCP tool. |
| Agent inference | Yes, as a separate inferred record with confidence and Agent provenance. |
| Tool result or external evidence | Only a bounded evidence statement when deliberately added; never through the evidence API as explicit user intent. |
| Source reference | Optional event/reference ID, 160-character maximum excerpt, or SHA-256 digest. |
| Private-mode statements | Process memory only; they disappear when the MCP process exits. |
| Off-mode activity | No new semantic state updates. |
| Portable export | Full selected record text, provenance, status, and integrity digest in the plugin-managed export directory. Model context receives only an opaque export ID. Private mode rejects export before serialization or any filesystem write. |

## Local location

Normal installed state is:

~~~text
<CODEX_HOME>/plugin-data/intent-formation/intent-events-v1.jsonl
~~~

The exact location and fallback order are documented in `state-and-tools.md`. On Unix-like systems, managed directories are restricted to `0700` and files to `0600`. Windows uses the current account's inherited filesystem ACLs.

## User controls

- `/intent show [page]` exposes at most three bounded active records and provenance summaries per Hook page; the full MCP read remains available to the explicit fallback.
- `/intent correct` adds a replacement while preserving the earlier source.
- `intent_invalidate` makes a record inactive without erasing its audit history.
- `/intent export` creates a portable integrity-checked copy.
- `/intent private` physically removes persisted task content before accepting process-memory-only records.
- `/intent off` stops new tracking without deleting an existing snapshot.
- `intent_delete_record` physically removes one record, its references, and all managed exports for that task.
- `/intent forget` physically removes one task's plugin-managed events, exports, and off marker.

Physical deletion atomically rewrites the primary store and, while the same cross-process lock remains held, precisely scrubs the target from plugin-managed backup, interrupted-write, corruption-quarantine, mode-marker, and applicable managed-export files. It does not delete copies moved outside the managed directory, operating-system backups, disk snapshots, or Codex host logs outside the plugin's data directory.

## Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Full prompt or transcript retention | Hooks never persist the prompt or parse transcript files; MCP inputs cap each atomic statement and source excerpt. | Codex itself may retain conversation history under its own product policy. |
| Secrets inside an atomic statement | Common API key, bearer token, credential-label, and password patterns are redacted before persistence. | Pattern redaction is best effort and is not a general DLP system. Users should not place secrets in intent records. |
| Prompt injection in tool or external content | Evidence has a distinct API and source kind. The service rejects attempts to label evidence as explicit through the evidence path. Automatic Hook restoration excludes inference/evidence text and injects only quoted explicit/unknown/disputed records whose source kind is `user_turn`, with a data-only boundary. | The current host provides no signed user-turn provenance to MCP. A compromised Agent could still misuse the explicit-record tool. This is behaviorally regression-tested, not a cryptographic guarantee. |
| Cross-project leakage | Task IDs partition current views; project and long-term records require explicit scope and confirmation rules. Session context injects only the exact current task snapshot. | Local users or processes with filesystem access can read the shared store. Task IDs are namespacing, not access-control credentials. |
| Stale long-term assumptions | A single action, acceptance, or silence cannot promote a long-term record. Long-term scope requires an explicitly confirmed rule or three-task repetition plus confirmation. | Reconfirmation timing still depends on the Agent applying the Skill policy. |
| Corrupt or partial writes | Generation-checked directory locks, fsync, atomic replacement, backup restore, schema migration, quarantine recovery, independent-process stress, and stale-lock ABA races are tested. Failed mutations report `changed: unknown` with an inspect-and-retry step. | Abrupt storage or hardware failure can still lose the last operation or acknowledgement. |
| Deletion leaving old side files | Delete operations rewrite matching backup, interrupted-write, and quarantine content while retaining unrelated recovery events. | Copies outside the plugin-managed directory remain outside its authority. |
| Malicious import | Import bounds bytes and record count, rejects extra fields, verifies format/version, SHA-256 integrity, every record and free-text field, IDs, relationships, modes, and status consistency before one atomic store operation. Explicit user confirmation is required and merge is separately opt-in. Original provenance remains visible. | SHA-256 detects modification but does not authenticate who created an export. Inspect untrusted exports before approving import. |
| Hook failure or denial of service | Hooks have three-second limits, fail open, never block the prompt, and do not intercept tool permissions. Confirmed off uses a lock-independent marker. Command output is capped at 3,000 UTF-8 bytes and show is paginated, avoiding current Codex `hook_outputs` spill under the configured 4,000-token limit. The model-only fallback refuses to claim that off is active. | A failed hook may reduce continuity for that turn. Codex and its conversation/history storage remain outside this boundary; a future Hook contract change requires revalidation. |

## Trust and inspection

Codex asks the user to trust plugin-bundled hooks. The complete hook configuration is in `hooks/hooks.json`; each command is a short local Node process with a three-second timeout. `/intent off` is confirmed only through this trusted path because the override must run on later prompts. Users can disable the plugin or task-level tracking. No PreToolUse or PermissionRequest hook is installed.

## Security claim boundary

Verified implementation claims cover the plugin-managed store, MCP validation, hook output, and real-host behavior tested in this repository. They do not claim to secure the surrounding Codex installation, operating system, model behavior under every injection, or user-created exports.
