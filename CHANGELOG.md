# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 0.1.0-beta.2 - 2026-08-31

### Fixed

- Bound stale-lock decisions to a stable filesystem generation before and after reclaim and rename, closing a Linux/Node 24 ABA race exposed by public tag CI.
- Removed recursive cleanup of an unverified canonical lock after owner publication races; transient owner writes now retry without deleting a newer live generation.
- Gave every lock operation an independent reclaim token so concurrent calls in one process cannot adopt each other's authority.
- Distinguished present, missing, invalid, and raced lock markers and added crash recovery for stable markerless locks plus truncated reclaim/release markers.

### Verification

- Added deterministic regressions for generation replacement, owner-publication failure, markerless recovery, same-process token isolation, and truncated markers.
- Expanded the source suite to 70 tests while retaining the self-contained distribution, privacy, deletion, and frozen evaluation-instrument gates.
- This release supersedes 0.1.0-beta.1, whose tag CI exposed the stale-lock generation race. No efficacy claim is made.

## 0.1.0-beta.1 - 2026-08-28

### Added

- A Codex-first Intent Loop Skill, local MCP server, and optional fail-open lifecycle Hooks.
- Fifteen structured intent tools plus a read-only Skill resource fallback.
- Hash-chained project-local storage, redaction, private/off modes, identity-remapped import/export, and verified physical deletion with crash-retry cleanup.
- A frozen 80-task evaluation instrument and 15 failure-oriented regression classes.
- Self-contained Node 20 runtime bundles for GitHub marketplace installation without dependency installation.
- Apache-2.0 licensing, complete embedded third-party notices, a CycloneDX SBOM, CI, and release workflows for checksums and GitHub artifact attestations, plus security, privacy, and release documentation.

### Hardened after independent review

- Private mode now keeps semantics in process memory while a one-task/one-session compare-and-set marker suppresses Hooks and remains a restart recovery/delete handle.
- User-explicit claims cannot be displaced by evidence or inference; Hook context excludes persisted non-user semantic content.
- Durable writes use live-owner locks, normalized request fingerprints, non-mutating reads, atomic ledger replacement, and trailing-partial/orphan recovery without retaining raw quarantine bytes.
- Internal storage rejects Windows junctions, symlinks, and multiply linked ledger files; private ownership, mode recovery, and control cleanup are lock-scoped and expected-owner checked.
- Credential redaction recursively covers escaped JSON secret fields and quoted spaced assignments without secret-derived digests; imports enforce bounded acyclic provenance and remap all identities.
- Task deletion clears durable/private state, cross-task candidate references, control/ledger temporaries, and quarantine, and exact-confirmation retries complete cleanup after interruption.
- New task initialization accepts up to 12 directly stated atomic claims in one server-side call, with deterministic task identity and server-generated claim/source provenance.
- Manual `show`, `status`, and summary export paths are compact, and the Skill resource is the documented Windows cache-read fallback.
- Cross-process locking now treats product-owned marker moves as transient, suppresses post-commit cleanup errors from becoming false mutation failures, clears release/reclaim remnants, and uses a bounded no-progress timeout so a progressing Windows writer queue is not rejected by a fixed wall-clock deadline.
- Hook source identities are derived from a validated host event ID when available, or from text only after credential redaction; raw prompt and secret-derived digests are regression-tested absent from the ledger.
- Codex project scope now resolves from the server-advertised `codex/sandbox-state-meta` capability on every tool call. `project_root` may be omitted, explicit conflicts are rejected, and non-Codex hosts retain an explicit-path or exactly-one-root fallback.
- Import relations are bounded per array and in aggregate; deletion scans propagate unexpected directory errors; crashed release/reclaim lock directories are cleaned by the next locked mutation.

### Evidence boundary

- Automated and installed-host verification establishes implementation behavior.
- The frozen paired human study has not been run, so this beta makes no efficacy claim.
