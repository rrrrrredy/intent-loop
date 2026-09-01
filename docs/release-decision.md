# Release decision

Decision date: 2026-09-01

Decision: **V0.2.0-BETA.5 PUBLIC BETA GO; EFFICACY ITERATE**

Intent Loop `v0.2.0-beta.2` passed its exact-tag 18-job matrix and both public Windows installed-host lifecycles, but the final adversarial review found a release-integrity P1: GitHub release immutability was disabled when it was published, and the DeepSeek package, its SBOM, and the expanded checksum manifest were added about three minutes later by a different uploader. GitHub later locked the current release and release-attestation verification now succeeds. That protects the present bytes, but it does not turn the three post-publication uploads into outputs of the original exact-tag Release workflow or erase the earlier mutable interval. Beta.2 therefore remains superseded history.

The beta.3 tag kept the same reviewed product code and passed exact-tag CI 18/18. Its Release job tested both hosts, built and attested all five assets, and uploaded them to one draft. The safety gate then stopped before publication because GitHub's release-by-tag endpoint does not return drafts. The unpublished draft was deleted; the tag and Actions run remain as audit evidence.

The beta.4 tag changed that lookup to the authenticated release collection and selected the exact draft by ID. Main and exact-tag CI both passed 18/18, and its Release job rebuilt, attested, and uploaded all five assets. The workflow again stopped before publication because the local and remote filename lists used different sort semantics. The draft was deleted; the tag remains audit evidence.

Beta.5 applies the same deterministic code-unit comparator to both lists. Commit `29951cda05c4fc545037a4f058325153599918ab` passed main CI and exact-tag CI at **18/18** each. Release run [`33469669275`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469669275) retested both packages, built and attested all five assets, verified every draft byte, then published [`v0.2.0-beta.5`](https://github.com/rrrrrredy/intent-loop/releases/tag/v0.2.0-beta.5) as an immutable prerelease. Fresh public-tag Codex and DeepSeek Harness lifecycles on Windows then completed install, identity checks, normal operations, deletion or removal, and uninstall. The release is suitable for bounded public-beta use; efficacy remains unmeasured.

This adapter was directly authorized by the user after the original Codex-only beta. The exception is limited to transport and packaging. It does not authorize another planner, client, executor, transcript reader, remote service, broad data collection, or further host ports. The frozen 80-task human study remains unrun, so the efficacy decision stays **Iterate**.

## V0.2 candidate gates

| Gate | Current result | Reason |
| --- | --- | --- |
| Shared product boundary | **Pass** | Codex and DeepSeek expose the same fifteen state tools from one local MCP core; the adapter owns no reasoning or execution. Local beta.5 checks and both beta.5 public three-OS matrices agree. |
| DeepSeek host binding | **Pass** | Model-visible schemas omit project/session selectors; the adapter injects canonical active-agent values and rejects cross-project access in the adapter suite on all three systems. |
| Session and credential isolation | **Pass** | One bounded MCP child per active Harness session; API-key variables are omitted; serialized creation, hard capacity, failure draining, one-close cleanup, idle, unload, timeout, and cancellation behavior pass locally and in the public three-OS matrix. |
| Codex regression | **Pass** | The source and packed plugin passed **73/73** tests, type checking, self-contained distribution verification, and a live MCP handshake. Main run [`33469255872`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469255872) and exact-tag run [`33469669257`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469669257) each passed all nine Codex jobs across Node 20/22/24 on Windows, Ubuntu, and macOS. A fresh Windows public-tag install completed the full natural-language lifecycle and was removed. |
| DeepSeek package | **Pass** | The adapter passed all six test groups, exact 16-file packaging, live version handshake, legal/SBOM generation, and zero-vulnerability production audit. The release package was added to an isolated DeepSeek Harness `0.1.2-alpha.2` profile, dumped, booted through the help path, removed, and verified absent without using a model API key. |
| Linux/macOS | **Pass for hosted headless validation** | Both beta.5 CI matrices passed the Codex package, DeepSeek adapter, and temporary real Harness lifecycle on GitHub-hosted Ubuntu and macOS. Native GUI-specific behavior and a physical end-user-machine smoke test remain outside this claim. |
| Release integrity | **Pass** | Release run `33469669275` waited for exact-tag CI, independently retested both packages, built and attested all five assets in one job, verified draft bytes, published once, and verified the release and asset attestations. GitHub reports `draft:false`, `prerelease:true`, and `immutable:true`; all assets were uploaded by `github-actions[bot]`. |
| Efficacy | **No result** | The frozen paired 80-task study has not been run. |

## V0.2 cross-platform decision

- **The same headless packages on Windows, Linux, and macOS are worth maintaining.** They now share one Node-based core, and both beta.5 matrices exercise the package and host-lifecycle boundaries on all three operating systems. This is a useful compatibility surface at modest maintenance cost, although physical Linux/macOS end-user smoke tests should precede a stable-release claim.
- **Further agent-host ports are not justified yet.** DeepSeek is the one user-authorized experiment. More hosts would multiply trust, session, packaging, and support boundaries before outcome value is measured.

## V0.2 follow-up priorities

1. Add the running server SemVer to `intent_status` so a user or support tool can verify the live process without consulting installed metadata or bundle banners.
2. Use signed annotated tags for future releases and keep the immutable beta.5 tag's stale README badge documented as a historical snapshot rather than rewriting it.
3. Run one physical Linux and one physical macOS install/use/remove smoke before a stable three-platform claim.
4. Run the frozen paired study before claiming reduced rework, improved final match, or better intervention timing.

The remainder of this document retains the completed `v0.1.0-beta.3` decision as historical evidence.

## V0.1.0-beta.3 decision

Decision: **PUBLIC BETA GO; EFFICACY ITERATE**

Intent Loop `v0.1.0-beta.3` is published as the recommended Apache-2.0 prerelease at commit `9432dde72ac8c6b5c4bd1bc7936f8b14ef37246c`. Local source and distribution checks, the six-job Windows/Ubuntu GitHub Actions matrix, release assets and attestations, two fresh GitHub-only Windows lifecycles, independent adversarial and practical reviews, and final uninstall all passed. This is not a stable-product or efficacy Go, an OpenAI universal-directory approval, or authorization for another-agent port.

`v0.1.0-beta.1` and `v0.1.0-beta.2` are superseded. Beta.1 tag CI exposed a real stale-lock generation race on Ubuntu/Node 24. Beta.2 fixed that family, but final Windows pressure rechecks then exposed marker/parent `realpath` transition failures and related lock timeouts. Beta.3 binds both generations and treats an unconfirmed Windows access transition only as a bounded, fail-closed race.

## Gate summary

| Gate | Result | Reason |
| --- | --- | --- |
| Gate 0: repository and scope | **Pass** | Canonical `D:\Codex\intent-loop` repository, Codex-only boundary, no user assets or unrelated workspace changes. |
| Gate 1: Codex capability | **Pass for bounded technical MVP** | One Plugin packages one Skill, one local stdio MCP service, and optional Hooks. Real Codex calls bind to host sandbox metadata without model-generated paths or IDs. |
| Gate 2: evaluability | **Pass for instrument; no efficacy result** | The frozen 80-task paired protocol, grading, failure attribution, and thresholds exist. The required 80 baseline plus 80 plugin deliveries have not been run. |
| Gate 3: privacy and threat contracts | **Pass for public beta** | The current 72-test suite covers persistence, project isolation, modes, redaction, import, deletion, link containment, crash recovery, and parent-plus-marker generation-bound locking. Root and adversarial reviewers each passed ten 32-process stale-lock pressure runs; the reviewer also passed two independent 60-round safety groups. |
| Gate 4: public distribution | **Pass for beta.3** | The public tag, both six-job CI matrices, release workflow, exact-tag assets, and two fresh installed Windows lifecycles passed. Beta.1 and beta.2 remain public only as clearly superseded history. |
| Gate 5: open-source operations | **Pass for prerelease** | Apache-2.0, NOTICE, embedded notices, CycloneDX SBOM, checksums, strict provenance/SBOM attestations, exact-tag file verification, public install instructions, and final plugin/marketplace/data/cache cleanup passed. |

## Public-beta promise

The supported beta promise is deliberately bounded: a Codex user can install from the public GitHub marketplace, keep structured intent state locally, inspect and correct it, classify evidence separately from explicit intent, export a compact summary, switch semantic reads and writes off, and uninstall cleanly. The plugin remains advisory and optional; Hooks are not trusted automatically.

The beta.3 adversarial reviewer gave **RELEASE** with no P0/P1 after 72/72 tests, two 60-round safety groups, and 10-by-32 real-process pressure. Its P2 items are a future fault-injection seam for stable access errors, applying bounded rechecks to an invalid-marker-only helper, and further shrinking the final marker check-to-unlink window. All remain fail-closed. The beta.3 practical reviewer independently installed the public tag and completed start, snapshot, replacement, evidence, summary, off, and off-mode rejection with every business call succeeding first try; its verdict was also **RELEASE**, P0/P1 zero.

## Why efficacy remains Iterate

Every product-value threshold is still unmeasured. Passing implementation tests and successful installed lifecycles prove defined behavior; they do not prove lower avoidable rework, better final-match scores, acceptable interruption cost, or helpful intervention timing across independent work. `paired-evaluation-result.md` therefore remains `NO RESULT`.

## Cross-platform decision

Cross-platform has two different meanings:

- **The same Codex plugin on more desktop operating systems: worth doing, narrowly.** Windows has two real public-tag install/use checks followed by clean uninstall, and Windows plus Ubuntu CI pass on Node 20/22/24. The next proportional step is to add macOS CI, one real macOS install/use/uninstall smoke test, and one real Linux end-user smoke test. Until those pass, the project must not claim three-OS end-user support.
- **Ports for Claude Code, Cursor, Gemini CLI, WorkBuddy, or other agent hosts: not yet worth building.** A port would multiply sandbox metadata, Hook, trust, namespace, data-path, packaging, and support boundaries before the Codex version has demonstrated outcome value. The frozen paired study and real demand must clear first; then one narrow host adapter can be evaluated rather than starting a multi-host rewrite.

## Allowed next steps

1. Collect beta issue and usability evidence without changing the frozen efficacy thresholds.
2. Run the 80 baseline and 80 matched plugin deliveries, blind final artifacts, adjudicate corrections, and publish every frozen metric and exclusion.
3. Capture one naturally triggered trusted `PostCompact` plus resume sequence before a stable release.
4. Add macOS CI and one real macOS install/use/uninstall smoke test before claiming three-OS Codex support.
5. Consider one other host only after paired efficacy passes and real user demand identifies it.

## Prohibited next steps

Do not compensate for missing efficacy evidence with mandatory questions, intake forms, a PRD workflow, a custom client, an Agent Harness, broad user profiling, or speculative multi-agent ports. Do not describe green tests or tool-call traces as proof of product value.
