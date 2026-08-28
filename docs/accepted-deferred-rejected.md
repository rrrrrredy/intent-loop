# Accepted, deferred, and rejected items

This list records product and implementation issues discovered while reconciling the frozen brief, current Codex capabilities, source implementation, and real-host verification.

## Accepted and implemented

- One Codex Plugin containing one focused intervention Skill, one local stdio MCP state service, and optional lifecycle Hooks.
- Codex retains reasoning, planning, execution, permissions, safety, verification, and delivery ownership.
- Atomic append-only, hash-chained events; ledger-derived current state; explicit supersession/invalidation; corruption recovery and serialized writes.
- First-class `explicit`, `inferred`, `evidence`, `unknown`, and `disputed` states with provenance, scope, confidence rules, timestamps, and retained history.
- Local `on`, `private`, and `off` modes; private semantic memory plus a hashed fail-closed Hook-suppression marker; project isolation; credential-pattern redaction before persistence; exact destructive confirmation; portable incomplete-history export; physical deletion with verification.
- History defaults to post-install visible signals. Long-term inferred signals require three independent tasks plus direct confirmation and become stale after 90 days.
- Manual `start`, `show`, `correct`, `feedback`, `forget`, `export`, and `off` paths in ordinary Codex dialogue.
- Hooks that only inject compact context or add unconfirmed hashed candidates, always fail open, and never decide completion or block a prompt.
- Relative MCP launch from installed `cwd`, because the tested host did not expand `${PLUGIN_ROOT}` inside MCP arguments.
- Underscore MCP namespace `intent_loop`, because it is reliably exposed on the tested Codex host.
- One read-only MCP resource that serves the actual bundled Skill file when the Windows sandbox blocks direct cache reads; it contains no task state and avoids duplicating policy.
- Lock-scoped cross-process request deduplication, PID/owner-token/heartbeat locks, non-mutating reads, and atomic repair that quarantines only a partial-tail digest rather than raw bytes.
- Direct-user transition guards for user-explicit claims and direct-user-only semantic Hook injection; persisted evidence, inference, and imported content cannot become hidden instructions.
- A compact summary export and one-tool manual read paths to reduce first-use latency and output size.
- Complete inventory and license text for direct and MCP-prebundled dependencies, a CycloneDX SBOM, prerelease metadata, checksums, and GitHub artifact attestations.
- Outcome-based paired evaluation with a frozen 80-task corpus; explicit `NO RESULT` rather than inferred efficacy.
- Single-call new-task initialization with server-derived task identity and up to 12 directly stated atomic claims; no model-generated UUID/source hash or separate claim loop.
- Codex project binding through the server-advertised `codex/sandbox-state-meta` capability on every tool call; normal calls omit `project_root`, explicit conflicts fail closed, and non-Codex clients retain explicit-root or exactly-one-root fallback.
- One-to-one private task/session CAS, current-session projection, task-level Hook suppression, pure-private restart recovery/delete, and expected-owner atomic control clearing.
- Atomic ledger replacement plus link-count/realpath checks for internal files and Windows junctions, with locked cleanup of crash-orphaned product temporaries.
- Request IDs bound to operation and normalized-parameter fingerprints; different parameters fail instead of returning a stale prior result.
- Imported claim/candidate/task identity remapping, acyclic supersession validation, and task-delete cleanup of cross-task candidate references.
- Release/reclaim marker races are treated as transient, post-commit lock cleanup cannot surface a false mutation failure, renamed lock remnants receive bounded cleanup retries, and waiters use a bounded no-progress timeout with an absolute ceiling under a progressing writer queue.
- Hook request/source identities use a validated event ID or credential-redacted text, and regression tests reject persistence of raw prompts, recognized secrets, or their raw SHA-256 digests.
- Import relations have per-array and total edge ceilings; deletion byte scans propagate unexpected filesystem failures; the next lock removes crash-orphaned release/reclaim marker directories.

## Deferred

- A controlled opt-in user study and the complete 160-run paired dataset.
- Natural host `PostCompact` plus resume observation under real long-running use; fixture and state-recovery contracts pass, but a naturally triggered compaction cycle was not retained as trusted Hook state during this build.
- MCP App or any rich interface. `enable_mcp_apps` is disabled on the tested surface, and the headless path is complete without it.
- SQLite or remote storage. The local JSONL design is sufficient for the bounded MVP and has concurrency/corruption tests.
- Explicit import of older history beyond portable Intent Loop graphs. No claim of complete pre-install understanding is allowed.
- Claude Code, Cursor, Gemini CLI, and WorkBuddy adapters. They are gated on passing the Codex paired evaluation, so no adaptation plan or person-day estimate is issued yet.
- OpenAI universal-directory submission. The current local stdio architecture does not meet the hosted public HTTPS MCP and domain-verification boundary, and changing that would require a separately authorized product/privacy decision.

## Rejected

- Prompt pack, intake form, one-shot brief, PRD generator, mandatory checklist, or completion gate.
- New Agent Harness, independent chat client, App Server client, digital twin, complete user profile, or large workbench.
- Parsing Codex transcript files or treating them as a stable plugin API.
- Hooks as semantic judges, permission bypasses, prompt blockers, or mechanisms that force another turn.
- Automatically promoting tool output, quoted content, silence, acceptance, or one repeated choice to user-explicit or durable intent.
- Silently overwriting an old claim, collapsing unknowns/disagreements, or forcing the user and agent to agree.
- Claiming product value from tool-call counts, question counts, fields, protocol prose, a valid package, or green tests.

## Accepted defects and host constraints

- The installed MCP launch initially failed on a literal `${PLUGIN_ROOT}` path. This was fixed with relative `cwd` packaging and revalidated in the installed cache.
- Non-interactive write approvals could not be pre-approved on this CLI build; real E2E used the normal interactive approval surface. The plugin does not weaken the host boundary.
- An ambiguous Hook-review keystroke sequence was not accepted as evidence. Persistent trust was audited and found absent; Hook delivery was then verified with the explicit one-invocation CLI bypass.
- A clean project could discover `$intent` but could not shell-read its installed cache file. The MCP Skill resource fallback was added, tested with the official client, reinstalled, and verified in that clean project.
- Independent adversarial review found private-mode cross-process leakage and ownership/recovery gaps, explicit-claim transition gaps, persistent prompt-injection risk, unsafe stale-lock and link handling, escaped secret-field gaps, import/deletion identity collisions, crash residue, and incomplete bundled-license evidence. Each release-blocking item was accepted and implemented as a regression-tested control; later findings on filesystem error propagation, relation bounds, lock-marker cleanup races, malformed host metadata, and unsafe project-root forms were also implemented. The reviewer approved the frozen source and local distribution candidate with no remaining P0/P1/P2 code finding.
- Independent first-use review found cache-read recovery friction, an unreliable multi-call start that attempted shell/global-Memory preparation, unnecessarily long manual command paths, missing aggregate candidate counts, and an oversized default export. The repaired installed build now reads the MCP Skill fallback once, starts with one successful `intent_start_task` call that omits paths and IDs, and completes snapshot/correction/feedback/summary/off calls without Shell or Memory. Final user-perspective acceptance of the frozen build remains required.
