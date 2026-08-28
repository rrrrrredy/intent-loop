# Independent pre-release reviews

Review date: 2026-08-28

Two independent reviews were required before public beta publication: one adversarial security/reliability review and one practical first-use review. Both reviewed an installed build rather than only reading design documents.

## Adversarial review

The adversarial review attempted cross-process mode confusion, claim-authority escalation, persistent prompt injection, concurrent mutation, credential leakage, malformed imports, deletion edge cases, and incomplete distribution provenance.

Release-blocking findings and dispositions:

| Finding | Disposition |
| --- | --- |
| Private semantics could escape through a separate Hook process or survive misleading mode records. | Accepted. Private semantics remain in MCP memory; a hashed session control suppresses Hooks and makes restart fail closed. Durable `mode=private` events are rejected. |
| Evidence or inference could supersede/invalidate a user-explicit claim. | Accepted. Only direct user-explicit input can replace it, and only a direct user event can invalidate it. |
| Persisted evidence could later be injected as model instructions. | Accepted. Hook context now emits semantic text only from direct user-event and user-explicit claims. |
| JSON credential fields and opaque identifiers could retain secrets. | Accepted. JSON password/API-key formats are redacted and known credential/token patterns are rejected in identifiers. |
| A time-based stale lock could be stolen from a live writer. | Accepted. Locks now carry PID, owner token, and heartbeat; liveness and ownership are checked before recovery/release. |
| Tail repair retained raw partial bytes and read paths could mutate storage. | Accepted. Reads are non-mutating; the next locked mutation performs temp-file/fsync/atomic repair and stores only length plus digest metadata. |
| Same-text claims could make deletion report a false failure; quarantine could retain task material. | Accepted. Verification keys on target identity/unique markers, and task deletion removes quarantine and private controls before rescanning. |
| Imports lacked strict size, timestamp, uniqueness, relation, and provenance validation. | Accepted. All are bounded and checked; imported records use `explicit_import` and are excluded from Hook semantic injection. |
| The distribution omitted licenses/SBOM evidence for dependencies embedded inside the MCP bundle. | Accepted. Build-time inventory matching, full notices, CycloneDX SBOM, checksums, prerelease marking, and artifact attestations are release requirements. |
| Private task deletion could leave durable history, controls could be hijacked across task/session, and pure-private restart could become undeletable. | Accepted. Task deletion always rewrites durable history and then clears controls; ownership is one-to-one CAS; controls are expected-owner recovery handles; exact-confirmation deletion is retryable after a partial crash. |
| Old Hook-session associations could write while the same task was private under a newer session. | Accepted. Session association is projected from the latest event, reassociation revokes the old session, and Hook writes also check for any task-level private control under the mutation lock. |
| Same-project import IDs and long-term candidate task references could prevent physical deletion. | Accepted. Imports remap claim/candidate/task identities and preserve source identities only by hash; task deletion removes structured references held by other events. |
| Internal `private-sessions` junctions, ledger hardlinks, and crash-orphaned temporary files could escape or retain data. | Accepted. Every internal mutable directory is link-rejected and realpath-contained, ledger files must be singly linked, append uses atomic replacement, and strictly named orphan temporaries are removed under the project lock. |
| Escaped JSON passwords, spaced assignments, and off-mode labels could retain semantic or credential text. | Accepted. JSON sensitive keys are recursively replaced without secret-derived digests, quoted assignments handle escapes/spaces, and off start rejects labels/initial claims. |
| Concurrent stale-lock cleanup could observe a renamed lock directory after another process removed it and surface `ENOENT` as a failed operation. | Accepted. Product-owned removal races are treated as transient. The reviewer reran the 32-process case six times on the frozen storage source with no failures or remnants. |
| Malformed Codex sandbox metadata could fall back to a caller path; caller paths could be relative, regular files, or Windows UNC/device namespaces. | Accepted. Present-but-malformed metadata fails closed, roots must be absolute existing local directories, and Windows UNC/device namespaces are rejected before filesystem resolution. |
| The distribution deletion scanner swallowed every directory-read error. | Accepted. It now ignores only `ENOENT`; permission and I/O failures block the gate. |

Final verdict: **APPROVE** for the frozen source and local distribution candidate, with no remaining P0, P1, or P2 code finding. The reviewer independently passed all 62 tests, type checking, self-contained distribution verification, and dependency audit.

## Practical first-use review

The first-use review installed the beta on Windows and exercised start, show, correct, feedback, export, off, and forget from a fresh task.

Positive behavior observed before remediation: a clear arithmetic request stayed silent; ordinary lifecycle commands worked; deletion ended with zero tasks.

Friction findings and dispositions:

| Finding | Disposition |
| --- | --- |
| The sandbox denied direct reads of the installed Skill cache, and recovery was not immediate. | Accepted. The bundled read-only MCP Skill resource is now the first fallback; shell-read retries are prohibited. |
| Simple manual commands created plans, performed shell hashing, and took 28-95 seconds. The first start required 2 start attempts and 12 add-explicit attempts, and it attempted to mirror state into global Memory. | Accepted and independently rechecked. New start omitted task ID and project root, created six atomic direct claims in one first-attempt call, and used no Shell, Memory, or follow-up claim calls. |
| Project status promised a candidate count but did not return the aggregate. | Accepted. Status computes the real cross-task total. |
| Portable export was too large for routine human review. | Accepted. Human-facing export uses compact summary detail; portable graph remains an explicit option. |
| Initial disclosure could be skipped when start failed. | Accepted. Disclosure is required before the start call, including failure paths. |
| Isolated uninstall could leave empty cache parent directories. | Accepted within plugin scope. Final verification removes the plugin, marketplace entry, version cache, and test data; shared empty Codex cache parents are not recursively deleted. |

The practical reviewer exercised natural-language start, show, correct, feedback, summary export, off, and the forget confirmation boundary. Every business MCP call succeeded on its first attempt. A final cache check against `0.1.0-beta.1+codex.final.20260828215901` reused the off task without supplying a project root or schema: one `intent_status` call returned `mode=off`, seven active records, and zero candidates, with no Memory, other MCP, task creation, mode change, deletion, or workspace write.

Final verdict: **APPROVE** for public beta. Remaining P2 user friction is latency of roughly 24-52 seconds per short Codex turn, repeated Skill reads, an English disclosure in the observed Chinese first-use turn, and visible technical identifiers. These do not change the state or privacy boundary and remain beta usability work.

## Evidence boundary

These reviews found defects, shaped controls, and approved the frozen local candidate; they are not an efficacy study. Public-repository CI, release-asset verification, GitHub-only install proof, and clean uninstall remain separate external gates. The frozen paired 80-task comparison remains unrun and is reported as `NO RESULT`.
