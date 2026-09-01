# Independent pre-release reviews

Review period: 2026-08-28 through 2026-09-01

Two independent reviews were required before final delivery: one adversarial security/reliability review and one practical first-use review. Together they reviewed frozen source, the self-contained distribution, and a public-GitHub installed build rather than relying on design documents or green status alone.

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

Initial-candidate verdict: **APPROVE** for the then-frozen source and local distribution candidate, with no remaining finding at that checkpoint. The reviewer independently passed all 62 tests, type checking, self-contained distribution verification, and dependency audit.

### Beta.2 adversarial release recheck

The beta.1 tag CI subsequently exposed a genuine stale-lock generation race on Ubuntu/Node 24. The finding and adjacent destructive-error/token/invalid-marker branches were accepted. The repair binds reclaim/release decisions to a directory generation, distinguishes present/missing/invalid/raced marker states, uses one stable per-operation reclaim token, prevents owner-publication failure from recursively deleting an unverified newer lock, and recovers crash-truncated reclaim/release markers with bounded checks.

The reviewer froze `storage.ts` at SHA-256 `0EB6F05484B74F68AD1345AFEEA5F904722E23D9AFB1F60DBE8B2E974483FEF9` and `storage.test.ts` at `AFD6E317CDEFDC00F9BC8C4731A8BCCB7F64C5651FCEEE39E794E3445441CC41`, then independently passed all **70 tests**, distribution verification, dependency audit, and **10/10** repetitions of the 32-real-process stale-lock case. Across 320 child processes, every iteration had 33 events, 33 unique request IDs, and no lock residue; hashes were unchanged afterward.

Beta.2 checkpoint verdict: **RELEASE**, P0/P1 zero. A later root finalization run nevertheless reproduced intermittent Windows lock-path `EPERM` and false `PATH_ESCAPE` failures, and the adversarial reviewer independently reproduced marker `realpath EPERM` plus related `LOCK_TIMEOUT`. Beta.2 was therefore marked superseded rather than shipped as the recommended build.

### Beta.3 adversarial release recheck

The accepted repair binds every marker read to both the containing lock-directory generation and the marker-file generation before open, after read, and at final path validation. Windows `EACCES`/`EPERM` transition errors receive at most one second of bounded rechecks; if the path cannot be confirmed, the observation becomes `raced` and can only make the caller wait. Stable readable symlinks, junctions, non-directories, non-regular files, hard links, and containment failures remain fail-closed.

The final reviewer froze `storage.ts` at SHA-256 `78AAE758AF28B300931BEFAED1AC798D93F61236390D4F7ED7BB3C868D7E10D2` and `storage.test.ts` at `208DF4884D52A8097742AF02D17A0F8B6CD04F6B17914DF8A8816EA07C4C64D0`. It independently passed all **72 tests**, self-contained distribution verification, **60/60** rounds of four generation-safety regressions, **60/60** rounds of release/reclaimer cleanup and stable-identity tamper regressions, and **10/10** repetitions of the 32-real-process stale-lock case. The pressure run covered 320 child processes; every round produced 33 events, 33 unique request IDs, and zero lock residue. Root then regenerated the version-specific bundles and SBOM from the unchanged reviewed source and reran the full suite after the beta.3 metadata bump.

Final beta.3 source verdict: **RELEASE**, P0/P1 zero. Documented P2 hardening opportunities are a direct fault-injection seam for stable `EACCES`/`EPERM`/`ELOOP`, applying the bounded helper to the invalid-marker-only `observeLockMarkerFile` path, and replacing the final check-to-unlink marker cleanup window with unique-name quarantine. Current behavior remains fail-closed and no P2 authorizes lock takeover or deletion.

### V0.2 DeepSeek adversarial release recheck

The first v0.2 documentation candidate passed its 18-job public matrix, but the required adversarial review then reproduced a release-blocking same-session concurrency failure. Two calls shared one MCP client; when either call failed, the pool immediately closed the holder and caused an otherwise healthy active sibling to fail. The candidate was held and no tag was created.

The accepted repair marks the holder as draining, rejects new acquisitions for that holder, waits for already-active siblings to settle, retains the holder in the capacity map while closing, and uses one close promise for idempotence. The repository now retains a deterministic regression in which the failing call returns while the sibling remains live, new same-session acquisition is rejected, the sibling finishes, and close occurs exactly once.

The reviewer independently reran the original two-call failure, a slow-close capacity probe, and a double-failure probe. During a failed call the sibling remained live and `closeCount` stayed zero; no new same-session or over-capacity session was admitted; after drain the holder count became zero and close count became one. Slow close retained the holder and capacity until completion, and double failure plus dispose did not close twice. On Node 22.19.0, the reviewer also passed the full **6/6** DeepSeek suite, package verification, generated 15-tool catalog, 24-component SBOM and 15 additional notices, plus the Codex **72/72** suite and self-contained distribution check.

V0.2 repaired-source verdict: **RELEASE**, P0/P1 zero. Repaired code commit `d0fba7103c7999ce4f47b3ee6602380b7ead7932` then passed the same 18-job public matrix in run `33377049544`, satisfying the review's publication condition. Non-blocking P2 items are a bounded fallback for a permanently hanging SDK `client.close()`, adding root DeepSeek tests and dual-version checks inside the tag-triggered Release workflow itself, and changing package composition verification from required/forbidden checks to a complete path allowlist.

### V0.2.0-beta.2 release-identity recheck

Fresh Codex installation from public tag `v0.2.0-beta.1` checked out the intended commit but reported installed version `0.1.0-beta.3`. The hidden `.codex-plugin/plugin.json` version had not advanced with the two package manifests, and the existing source and release checks did not compare that installed identity. The plugin and marketplace were removed immediately, the unmoved beta.1 tag was retained for audit, and its release page was marked superseded.

The first beta.2 recheck found a second release blocker: the TypeScript server constant and therefore the live MCP handshake still reported `0.1.0-beta.1`, even though the generated runtime banner was beta.2. The repaired candidate aligns that source constant and makes both Codex distribution verification and DeepSeek catalog verification connect with the official client and assert that the live server handshake equals the package version. The review also found a non-blocking broken notice reference inside the DeepSeek artifact; the exact allowlist now requires all and only the intended 16 files, including the third-party notice path referenced by the runtime banner. The reviewer independently verified the corrected live handshake, exact package, and resolved notice path and returned **RELEASE**, P0/P1 zero. Publication remains gated on exact-commit public CI, exact-tag installed-host lifecycles, and practical-user review.

A later final freeze run reproduced a separate Windows release blocker in orphan lock cleanup: one legitimate peer deletion was observed as an outside realpath transition after the initial directory check, so one of 32 writers failed before mutation. The repair binds the initial, current, deadline-edge, and pre-delete observations to one bigint filesystem generation. Only confirmed `ENOENT` becomes a raced disappearance; `ENOTDIR`, `EBADF`, replacement generations, symlinks, non-directories, and stable outside resolutions remain fail-closed. Deterministic tests cover two initial `EPERM` transitions, peer disappearance, deadline-late `ENOENT`, deadline-late outside resolution, replacement preservation, and stable escape rejection. The final code passed **73/73**, distribution verification, and **10/10** repetitions of the 32-process case (320 child processes). The adversarial reviewer returned **RELEASE**, P0/P1 zero. A narrow final-lstat-to-path-rm TOCTOU remains documented as non-blocking P2 hardening for a future atomic claim-rename design.

### V0.2.0-beta.2 public supply-chain recheck

The final public review verified that all five current beta.2 asset bytes, hashes, manifests, runtime identities, SBOM contents, exact file allowlists, installation commands, and code blobs agree with tag commit `d975191540b94386307ef2ebd1d107d099d13fa6`. Main and tag CI each passed 18/18, and the Release workflow succeeded.

The reviewer nevertheless returned **HOLD**, P1. GitHub reported `immutable:false` and repository release immutability was disabled. The Release workflow had published the Codex archive, Codex SBOM, and an earlier checksum file; the DeepSeek package, DeepSeek SBOM, and expanded checksum file were uploaded manually about three minutes later. The current bytes are correct, but a repository writer could still replace the tag or assets, and the checksum stored beside those mutable assets is not an external trust anchor. GitHub's prospective immutability setting cannot repair an already published release.

The accepted repair is a new beta.3 tag after enabling immutable releases. Its workflow waits for exact-tag 18/18 CI, builds and attests both packages in one job, verifies all five draft asset digests, publishes once, and verifies GitHub's release attestation. Beta.2 remains superseded evidence and its tag is not moved or reused.

Beta.3 then passed exact-tag CI 18/18 and its Release job built, attested, and uploaded all five assets to an unpublished draft as `github-actions[bot]`. The digest gate used GitHub's release-by-tag endpoint, which returns 404 for drafts, so the workflow failed before publication. The draft was deleted and the tag was retained without movement. Beta.4 changes only the draft lookup to select the exact tag from the authenticated release collection and fetch by release ID; the full public review must repeat.

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

The initial practical reviewer exercised natural-language start, show, correct, feedback, summary export, off, and the forget confirmation boundary. Every business MCP call succeeded on its first attempt. A cache check against the local beta.1 candidate reused the off task without supplying a project root or schema: one `intent_status` call returned `mode=off`, seven active records, and zero candidates, with no Memory, other MCP, task creation, mode change, deletion, or workspace write.

Initial verdict: **APPROVE** for public beta. Remaining P2 user friction was latency of roughly 24-52 seconds per short Codex turn, repeated Skill reads, an English disclosure in the observed Chinese first-use turn, and visible technical identifiers.

### Public beta.2 practical release recheck

The final reviewer verified installed/enabled version `0.1.0-beta.2`, GitHub marketplace source `https://github.com/rrrrrredy/intent-loop.git`, tag `v0.1.0-beta.2`, and unchanged checkout commit `c5e5874f7ac323a3f144b4c81618aa6cfa03b85e`. A single natural Chinese request in a new `codex exec --ephemeral` session created task `f875fa3c-fb59-5eb2-9712-b5e59deb0184` and completed:

- one first-attempt start whose only argument was five direct `initial_explicit` statements;
- first-attempt snapshot, claim replacement, evidence classification, compact summary, and off calls;
- a first-attempt `MODE_OFF`, `retryable=false` rejection for a post-off evidence write;
- six final active records, zero candidates/unknowns/disputes, and `history_complete=false`.

There were no business retries, no Memory or other MCP use, and no user-project write. Final verdict: **RELEASE**, P0/P1 zero. P2 observations are the roughly 90-second end-to-end model flow, technical narration/identifiers, and one transient model phrase that reduced off to write-only before the server correctly reported semantic reads and writes disabled. Marketplace-refresh file locks, unsupported PowerShell shell snapshots, and icon warnings came from the Codex/Windows host; the Intent Loop manifest and checkout did not drift.

### Public beta.3 practical release recheck

The final reviewer independently verified installed/enabled version `0.1.0-beta.3`, GitHub marketplace source `https://github.com/rrrrrredy/intent-loop.git`, and checkout commit `9432dde72ac8c6b5c4bd1bc7936f8b14ef37246c`. In one fresh natural-language Windows session, task `3170ad52-ba58-5259-b427-8d739ea260d8` completed privacy disclosure, start, snapshot, direct-claim replacement, evidence classification, compact summary, off, and a structurally valid post-off rejection. Every business call succeeded first try; the final summary contained seven active records, zero candidates, zero unknowns, zero disagreements, and `history_complete=false`. No caller project root, IDs, or hashes were fabricated, and there was no Memory, other MCP, or user-project write.

Final beta.3 practical verdict: **RELEASE**, P0/P1 zero. P2 observations are visible technical terms and identifiers, one model sentence that abbreviated off as write-only even though the server correctly disabled semantic reads and writes, and a roughly 121-second eight-step flow. Icon-path, unsupported PowerShell snapshot, and marketplace file-lock warnings came from the Codex/Windows host and did not affect business calls.

### V0.2.0-beta.2 public practical-use recheck

The reviewer independently installed exact tag `v0.2.0-beta.2`, confirmed installed/enabled version `0.2.0-beta.2` and marketplace commit `d975191540b94386307ef2ebd1d107d099d13fa6`, and exercised one natural Chinese lifecycle. Privacy disclosure, a five-claim start, snapshot, claim replacement with preserved supersession history, implementation-change evidence, compact summary, off, and the first post-off `MODE_OFF` rejection all succeeded without a business retry. The final summary had six active records, zero candidates, zero unknowns, zero disagreements, and `history_complete=false`.

The reviewer then used the exact delete confirmation, observed zero tasks and zero private-session controls, removed the plugin and marketplace, and verified the temporary project, cache shell, and marketplace snapshot were absent. Verdict: **RELEASE for product behavior**. Product P0/P1 were zero. One host P1 observation was a recurring Windows marketplace auto-upgrade file-lock warning; icon-path and PowerShell snapshot warnings were also host-originated and did not alter Intent Loop calls. P2 observations were missing runtime SemVer in status, one redundant read-only status call, one model phrase that reduced off to write-only before the server corrected it, technical narration, and a roughly two-minute full flow.

## Evidence boundary

These reviews found defects and shaped controls; they are not an efficacy study. The `v0.1.0-beta.2` installed-host review remains historical because that release is superseded. The `v0.1.0-beta.3` public-repository CI, release-asset verification, GitHub-only install proof, practical-user review, and clean uninstall were all rerun against its public tag. The v0.2 adapter review found and closed a release-blocking concurrency defect before tagging; `v0.2.0-beta.2` then passed product behavior review but failed the final immutable-release supply-chain gate. The frozen paired 80-task comparison remains unrun and is reported as `NO RESULT`.
