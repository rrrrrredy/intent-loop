# Release decision

Decision date: 2026-09-01

Decision: **V0.2.0-BETA.4 RELEASE CANDIDATE GO; IMMUTABLE RELEASE AND PUBLIC INSTALL VALIDATION REQUIRED; EFFICACY ITERATE**

Intent Loop `v0.2.0-beta.2` passed its exact-tag 18-job matrix and both public Windows installed-host lifecycles, but the final adversarial review found a release-integrity P1: GitHub release immutability was disabled, and the DeepSeek package, its SBOM, and the expanded checksum manifest were added after the Release workflow had already published. The five public bytes and hashes are correct; their future non-replaceability and one-workflow provenance were not established. Beta.2 therefore remains superseded history.

The beta.3 tag kept the same reviewed product code and passed exact-tag CI 18/18. Its Release job tested both hosts, built and attested all five assets, and uploaded them to one draft. The safety gate then stopped before publication because GitHub's release-by-tag endpoint does not return drafts. The unpublished draft was deleted; the tag and Actions run remain as audit evidence.

The beta.4 candidate changes that lookup to the authenticated release collection, selects the exact tag's draft ID, then fetches and compares all remote asset digests before publication. No product-state semantics changed. Publication remains gated on repeated main and tag CI, `immutable:true`, GitHub release-attestation verification, fresh public Codex and DeepSeek lifecycles, repeated independent reviews, and final cleanup.

This adapter was directly authorized by the user after the original Codex-only beta. The exception is limited to transport and packaging. It does not authorize another planner, client, executor, transcript reader, remote service, broad data collection, or further host ports. The frozen 80-task human study remains unrun, so the efficacy decision stays **Iterate**.

## V0.2 candidate gates

| Gate | Current result | Reason |
| --- | --- | --- |
| Shared product boundary | **Pass** | Codex and DeepSeek expose the same fifteen state tools from one local MCP core; the adapter owns no reasoning or execution. Local beta.3 checks and the beta.2 public three-OS matrix agree. |
| DeepSeek host binding | **Pass** | Model-visible schemas omit project/session selectors; the adapter injects canonical active-agent values and rejects cross-project access in the adapter suite on all three systems. |
| Session and credential isolation | **Pass** | One bounded MCP child per active Harness session; API-key variables are omitted; serialized creation, hard capacity, failure draining, one-close cleanup, idle, unload, timeout, and cancellation behavior pass locally and in the public three-OS matrix. |
| Codex regression | **Beta.3 tag pass; beta.4 pending** | Beta.3 passed 73/73 locally and all nine exact-tag Node 20/22/24 Windows, Ubuntu, and macOS jobs. The beta.4 identity must repeat the same checks. |
| DeepSeek package | **Local pass; public beta.4 pending** | Generated catalog/legal checks, six adapter test groups, the exact 16-file package, live version handshake, and zero-vulnerability audit pass locally. Exact-tag package and host-lifecycle evidence remains a publication gate. |
| Linux/macOS | **Beta.3 pass for headless packages; beta.4 pending** | Beta.3 passed Codex, DeepSeek adapter, and temporary Harness lifecycles on hosted Ubuntu and macOS. The same exact-tag checks must pass again for beta.4; native GUI-specific and physical end-user machine behavior remain outside this claim. |
| Release integrity | **Pending** | Beta.3 proved exact-tag CI ordering and one-job five-asset construction/attestation but stopped safely on the draft lookup. Beta.4 fixes that lookup and must still prove draft digest checks, immutable publication, and release/asset attestation verification. |
| Efficacy | **No result** | The frozen paired 80-task study has not been run. |

## V0.2 cross-platform decision

- **The same headless packages on Windows, Linux, and macOS are worth supporting.** The state core is Node-based, the host adapters depend on filesystem and process primitives, and a three-OS matrix directly tests the largest portability risks at modest maintenance cost.
- **Further agent-host ports are not justified yet.** DeepSeek is the one user-authorized experiment. More hosts would multiply trust, session, packaging, and support boundaries before outcome value is measured.

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
