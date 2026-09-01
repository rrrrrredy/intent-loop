# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 0.2.0-beta.2 - 2026-09-01

### Fixed

- Aligned `.codex-plugin/plugin.json`, both package manifests, lockfiles, generated runtimes, SBOMs, install documentation, and release identity at `0.2.0-beta.2`.
- Added distribution regressions that fail when the installed Codex manifest, Codex package, DeepSeek package, or SBOM version diverges.
- Added live MCP-handshake assertions so a stale running-server version fails both Codex distribution and DeepSeek catalog verification.
- Derived the DeepSeek catalog client version from the root package instead of a release-specific string.
- Changed the DeepSeek package verifier to require the exact 16-file allowlist, including the third-party notice path referenced by the shared runtime banner.
- Replaced the shell-dependent DeepSeek test glob with an explicit test entry so the root suite runs on Windows as well as Linux and macOS.
- Bound orphan release/stale-lock cleanup to the originally observed filesystem generation and added bounded Windows delete-transition rechecks, including deadline-edge, replacement, and stable-escape regressions.

### Evidence boundary

- `v0.2.0-beta.1` passed source and tag CI but is superseded. Fresh public-tag Codex installation exposed the stale plugin-manifest version before final delivery; the release page warns users not to install it.
- The corrected prerelease must repeat source, three-platform, exact-tag asset, public-install, independent practical-use, and cleanup checks. The paired efficacy study remains `NO RESULT`.

## 0.2.0-beta.1 - 2026-08-31

### Added

- Added a bounded DeepSeek Harness developer-preview bundle over the existing local MCP core, pinned to `@deepseek-ai/dsh` `0.1.2-alpha.2`.
- Registered the same fifteen intent-state tools with host-supplied workspace and session binding; model-visible schemas cannot select another project or private-session owner.
- Added a bounded per-session MCP process pool with idle eviction, timeout and cancellation forwarding, full unload cleanup, and a credential-free child environment.
- Added deterministic DeepSeek tool-catalog, CycloneDX SBOM, third-party notices, package-composition verification, and a no-model-key host lifecycle smoke test.
- Expanded GitHub Actions to Codex and DeepSeek adapter matrices on Windows, Ubuntu, and macOS, plus real DeepSeek package/add/compose/boot-help/remove smoke jobs on all three systems.
- Added dual-host install, uninstall, privacy, contributor, and plain-language documentation.

### Fixed

- Resolve Hook and MCP entry paths through the filesystem before main-module comparison, so macOS `/var` to `/private/var` aliases do not make a packaged process exit silently.
- Discover lowercase dependency license filenames on case-sensitive Linux filesystems while retaining deterministic notice normalization.
- Drain a failed per-session MCP holder until already-active sibling calls settle, reject new acquisitions while draining, and close the shared client idempotently so one call error cannot terminate another in-flight call.

### Evidence boundary

- Local Windows checks passed the 72-test Codex suite, six DeepSeek adapter groups using real MCP children, deterministic catalog/legal checks, package dry-run, dependency audit, and temporary DeepSeek Harness lifecycle cleanup.
- Earlier candidate `c78ebfb74cde2d7aca31cd3026e9b9bab812b272` passed all 18 public jobs but was not tagged after adversarial review found the shared-client concurrency issue above. Repaired code commit `d0fba7103c7999ce4f47b3ee6602380b7ead7932` then passed all 18 Windows/Ubuntu/macOS CI and real temporary host-lifecycle jobs in public run `33377049544`. Exact-tag publication evidence is recorded separately in `docs/verification-report.md`.
- This release is a user-authorized transport and packaging experiment. The paired 80-task efficacy study remains `NO RESULT`; no reduced-rework or improved-outcome claim is made.

## 0.1.0-beta.3 - 2026-08-31

### Fixed

- Bound every lock-marker read to both its containing lock-directory generation and marker-file generation before open, after read, and at final path validation.
- Treated Windows `EACCES`/`EPERM` during a verified lock transition as an unreadable race for at most one second; an unconfirmed path can only retry and never authorizes deletion, reclaim, or release.
- Reclassified unsafe marker or parent replacements as `PATH_ESCAPE`/`UNSAFE_DATA_FILE` while retaining fail-closed behavior for stable access and `ELOOP` errors.
- Replaced unsafe recursive test-peer cleanup with the same generation- and token-checked release path used by the product.

### Verification

- Expanded the source suite to 72 tests and retained the self-contained distribution, privacy, deletion, and frozen evaluation-instrument gates.
- Root verification passed 20 rounds of four generation regressions and 10 rounds of 32 real processes. Independent adversarial verification passed two 60-round safety groups plus its own 10-by-32-process pressure run with no event loss, timeout, access-error leak, or lock residue.
- This release supersedes 0.1.0-beta.2. A final Windows pressure recheck found a lock-transition `realpath` race after beta.2 publication; beta.2 was marked superseded rather than treating the failure as flaky. No efficacy claim is made.

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
