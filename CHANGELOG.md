# Changelog

All notable changes are documented here. This project follows Semantic Versioning.

## 0.3.0-beta.1 - 2026-09-03

### Changed

- Reoriented the product from a requirement-ledger-first Intent Loop into Intent Formation: a quiet Codex interaction policy that continues on clear work and uses one focused question, concrete comparison, or small sample only before materially divergent work.
- Split the Codex distribution into a state-free `intent-formation` core and optional `intent-formation-state` companion.
- Renamed the DeepSeek package to `dsh-intent-formation`, shared the exact policy source across hosts, derived task identity from the trusted Harness session, exposed 15 state tools, and updated the tested host to `@deepseek-ai/dsh` `0.1.2-rc.1` with its current peer identities.
- Replaced the v0.2 public documentation with a beginner-first install path, explicit migration, narrower privacy terms, and a release-gate report.
- Generalized the costly-divergence rule around missing success criteria and materially different outcomes; the shipped policy no longer enumerates lexical trigger words or a memorized website example.
- Ran two independently authored 80-scenario paired studies to `ITERATE`, attributed each failed gate, and retired both corpora after their results informed later policy revisions.
- Ran the independently authored v5 candidate to 160 / 160 primary completions and 80 / 80 clean blind grades; retained `STOP` after final-match, clear paired-latency, and inference-denial gates failed, and retired the corpus before further revision.
- Ran a four-variant installed-Hook ablation and removed the automatic feedback taxonomy and generic constraint reminder from the v6 policy; v6 later exposed broader feedback failures, so the current revision restores a smaller feedback rule for fresh component testing.
- Compared warm MCP with a minimal command Hook on ten matched clear-prompt pairs; kept MCP after the command variant's median paired latency rose 12.61%, and rejected generic fidelity and automatic-feedback policy text that showed no behavioral gain.
- Retained the exact mix/reject/free-answer exit after relaxed wording omitted complete answer rights, and prohibited tools or project work during an explicit intent-forming comparison after a real regression searched the web.
- Revised the v6 interaction policy to 1,253 UTF-8 bytes, one byte below the original 1,254 bytes, with failure-derived leading-goal, explicit facts-only, and mechanically testable chosen-lead delivery rules; smaller variants that regressed behavior were rejected.
- After v6, tried five observable decision dimensions, then removed them after a real 17-case installed-Hook run produced eight unnecessary questions. A corrected-label rerun removed all eight questions but exposed invented card-game rules and a missed required-data question. The current 1,315-byte development policy keeps the general three-condition gate, makes bounded reversible drafts direct, forbids a fictional case from licensing new facts, lets missing required facts override drafting, and retains comparison and result-feedback behavior.

### Added

- Added an independently authored, hash-sealed 80-scenario paired Codex holdout pipeline that publishes all 160 primary conversations, blind grades, source and artifact hashes, grader retry history, paired-bootstrap intervals, and an exact sign test only after every release gate passes.
- Predeclared a bilingual release holdout with 60 English and 20 Simplified Chinese cases across at least 40 task domains and sealed 80 distinct domains, without giving its independent author access to the product policy or prior corpus text.
- Sealed the independent v5 release corpus at SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905` before either arm ran; root validation found zero threshold violations against both retired holdouts, every development corpus, and both ablation corpora.
- Sealed independent v6 at SHA-256 `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897` after zero model, arm, or grader runs; archived v5, preserved both frozen ablation corpora, and added a portable validator that reproduces zero cross-corpus threshold violations.
- Added evaluation contract v3, which requires every final outcome requirement to be an exact excerpt from a frozen user-visible turn and enforces that rule in execution, grading, analysis, and evidence publication.
- Added a 17-case post-v6 development corpus for reversible drafts, concrete comparisons, result-feedback updates, missing-data control, and clear-task silence. Its prompts remain unchanged after a label audit corrected seven over-intervention expectations and one fabrication-permitting expectation.
- Added `/intent remember <one short goal>` as a deterministic, receipt-backed standard-mode control with optional goal, constraint, preference, success, and tradeoff roles.
- Added deterministic evidence verification to the root test suite.
- Added exact core and State distribution allowlists, per-package CycloneDX SBOMs and notices, and seven-asset release verification with provenance and SBOM attestations.
- Added three-platform Codex, DeepSeek adapter, and real Harness lifecycle CI matrices totaling 18 jobs.

### Fixed

- Aligned the blind-grader JSON Schema, rubric, and runtime validator on a 40-520 character per-arm audit rationale after an invalid grading run exposed the mismatch; grading now records its clean Git tooling commit and contract hashes.
- Removed redundant DeepSeek adapter assertions tied to one policy phrase; the adapter tests still require its guidance to begin with the exact imported shared policy and retain the host/state boundaries.
- Kept the 100-process lock stress test inside its 180-second outer safety bound while allowing 120 seconds for a heavily scheduled worker to observe progress; a separate regression still proves that a live owner with no progress times out at the configured product boundary.
- Made manual export write a complete integrity-checked file inside the managed export directory while returning only an opaque export ID, count, digest, and receipt to model context.
- Bound ledger mutation, mode markers, and managed-export cleanup to one cross-process transaction; record deletion, private transition, and task deletion now scrub the intended artifacts without erasing a later generation's successful export.
- Rejected private-mode export before serialization or any filesystem write, and paginated `/intent show` under a hard 3,000-byte Hook-output ceiling.
- Allowed a fresh process to adopt the current private marker while rejecting a stale conflicting marker, avoiding failed writes and retry loops.
- Made `/intent off` use a durable lock-independent marker on every ordinary prompt, so a confirmed override still arrives under ledger-lock contention and general policy context cannot silently re-enable intervention.
- Refused `/intent remember` in private mode rather than returning a receipt for memory that disappears when its short-lived Hook exits.
- Closed a same-process lock-publication race by registering the unique owner token before its file becomes observable; the permanent regression now drives 100 simultaneous appends.
- Removed obsolete selector and session prototypes from the shipped surface.
- Excluded package-local `.tmp` fixtures from npm archives after a dry-run exposed an untracked fake Skill; the then-current archive contained 81 entries, and the v6 evidence-preserving archive contains 87, both with zero temporary paths.
- Required the opening sentence to express the user's selected priority before competing goals after stable-CLI repetitions exposed inconsistent lead order, and explicitly prohibited invented facts after a bounded sample added unsupported artistic themes.
- Replaced the insufficient compact facts rule after a valid Hook-enabled run still expanded scope; an explicit `only these facts` fallback now forbids descriptive padding and repeats supplied facts when exact length otherwise forces invention.
- Made evidence publication recompute every metric from complete unique pairs before an atomic publish, reject stale run directories and untracked candidate-plugin files, and bind the live tree to the candidate Git object and archive.
- Aligned the permanent holdout overlap test with the published method by comparing complete scenario text, tokenizing Han characters individually, and retaining normalized whitespace in four-gram checks.
- Made tag publication require an annotated tag targeting the workflow commit, deterministic archives, exact-candidate evidence, and digest-aware draft reconciliation that verifies an already immutable matching release without mutation.
- Made the real DeepSeek lifecycle probe use the invoking Node runtime's exact npm/npx binaries, reject unsupported Node versions, terminate a timed-out process tree, preserve the primary failure, and clean its temporary profile with bounded retries.
- Separated 100-process runtime launch from EventStore contention with an all-ready barrier after two full-suite runs showed Windows scheduling could pause a live lock owner for the test worker's 120-second boundary. The repaired test retains 100 simultaneous writers without changing product lock timeouts.

### Evidence boundary

- The earlier tuned v8 result and the failed v3/v4 holdouts are preserved as development evidence and excluded from the release decision.
- The v4 candidate completed 160 / 160 primary conversations but failed final match (+6.87 percentage points), inference denial (4 / 4), and premature action (2 searches) gates. Its blind grader used one grader-only retry and no primary conversation retry.
- Candidate `8def5a3` completed a separate 16 / 16 installed-Hook confirmation with zero first-turn actions, zero first-turn MCP calls, and complete task cleanup; this is targeted development evidence, not an efficacy result.
- The v5 primary run completed 160 / 160 without timeout, prompt drift, MCP calls, or cleanup failure. Its first blind-grading run was invalidated before score inspection; the clean rerun produced 80 / 80 grades and one allowed grader-only retry.
- V5 reduced avoidable rework 69.70% but failed final match (+5.94 percentage points), clear paired latency (+5.36%), and inference denial (75%, 6 / 8). No efficacy claim is active, and another release attempt requires a new sealed holdout.
- Post-v5 policy and transport trials remain failure-derived development evidence. Stable `codex-cli 0.153.0` facts-only and lead-order probes each passed 5 / 5, and the full 16-case corpus passed 16 / 16 under the audited Hook-trust path; three no-bypass repetition sets are excluded. Those trials supported the later failed v6 candidate and are not release evidence.
- V6 completed 160 / 160 primary conversations and 80 / 80 blind grades, then returned `STOP`: clear paired latency was +6.89%, wrong proactive interventions were 24.14%, and inference denial was 62.5%. A post-run audit also found at least eleven hidden final requirements, independently invalidating the run for efficacy. Its exact hashes and defect list are retained as failed diagnostic evidence.
- The failed 1,317-byte run, corrected 17-case labels, 1,293-byte routing repair, and current 1,315-byte factual repair are development material only. No v7 holdout has been authored or run, and no efficacy claim is active.
- Even a passing holdout remains limited by a synthetic corpus, automated grading, one Windows execution host, and model or judge drift. These constraints keep the release at beta.
- DeepSeek tests establish adapter, isolation, packaging, and host-lifecycle behavior only. They do not transfer the Codex efficacy result to DeepSeek.

## 0.2.0-beta.5 - 2026-09-01

### Fixed

- Uses one code-unit comparator for both local artifact names and GitHub draft asset names before byte verification, avoiding locale-sensitive ordering differences between uppercase and lowercase filenames.
- Advances every Codex, DeepSeek, runtime, SBOM, lockfile, and installation identity after the failed beta.4 publication candidate.

### Evidence boundary

- The `v0.2.0-beta.4` tag passed exact-tag CI **18/18**. Its Release job independently retested both packages, created all five attestations, and uploaded all five draft assets from one workflow. Draft verification then failed safely because local and remote asset lists used different sort semantics; publication never ran. The draft was deleted, while the tag and Actions evidence remain for audit.
- Beta.5 passed main and exact-tag CI at **18/18** each. Its Release workflow retested both packages, created five attestations, verified all five uploaded bytes, and published an immutable prerelease; fresh public Codex and DeepSeek Harness lifecycles also passed. The paired efficacy study remains `NO RESULT`.

## 0.2.0-beta.4 - 2026-09-01

### Fixed

- Looks up the exact draft Release through the authenticated release collection before comparing the five uploaded asset digests. GitHub's release-by-tag endpoint returns 404 for drafts.
- Advances every Codex, DeepSeek, runtime, SBOM, lockfile, and installation identity after the failed beta.3 publication candidate.

### Evidence boundary

- The `v0.2.0-beta.3` tag passed exact-tag CI **18/18** and its Release job built, attested, and uploaded all five draft assets from one workflow. Draft verification then failed safely on the unsupported by-tag lookup; publication never ran. The draft was deleted, while the tag and Actions evidence remain for audit.
- Beta.4 repeated main and tag CI at **18/18** but failed safely before publication because the draft asset-name check compared two differently sorted lists. No beta.4 Release was published. The paired efficacy study remains `NO RESULT`.

## 0.2.0-beta.3 - 2026-09-01

### Fixed

- Enabled one exact-tag release path that waits for all 18 Windows, Ubuntu, and macOS CI jobs before packaging or publication.
- Builds the Codex archive and DeepSeek Harness package in the same GitHub Actions job, verifies both distributions, and generates one checksum manifest over all four payload and SBOM files.
- Adds provenance and CycloneDX SBOM attestations for both host packages plus provenance for `SHA256SUMS`.
- Creates a draft prerelease, uploads all five assets, checks every remote asset digest against the local workflow output, and only then publishes.
- Requires the published release and every downloaded asset to pass GitHub's immutable release attestation verification.

### Evidence boundary

- `v0.2.0-beta.2` contained correct bytes but was first published before repository release immutability was enabled, and three assets were added afterward by a different uploader. GitHub later locked its current state, but that does not change the split publication history; it remains superseded rather than the recommended supply-chain artifact.
- The paired 80-task human study remains `NO RESULT`; release integrity and successful installed lifecycles do not establish product efficacy.

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
