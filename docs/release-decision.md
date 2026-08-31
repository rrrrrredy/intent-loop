# Release decision

Decision date: 2026-08-31

Decision: **BETA.3 SOURCE CANDIDATE GO; PUBLIC ARTIFACT VALIDATION PENDING; EFFICACY ITERATE**

Intent Loop `v0.1.0-beta.3` has passed its local source, self-contained distribution, dependency, schema, and independent adversarial gates. The public tag, six-job GitHub Actions matrix, release assets and attestations, fresh GitHub-only install, independent practical-use review, and final uninstall must still be rerun before the public-beta decision becomes final. This is not a stable-product or efficacy Go, an OpenAI universal-directory approval, or authorization for another-agent port.

`v0.1.0-beta.1` and `v0.1.0-beta.2` are superseded. Beta.1 tag CI exposed a real stale-lock generation race on Ubuntu/Node 24. Beta.2 fixed that family, but final Windows pressure rechecks then exposed marker/parent `realpath` transition failures and related lock timeouts. Beta.3 binds both generations and treats an unconfirmed Windows access transition only as a bounded, fail-closed race.

## Gate summary

| Gate | Result | Reason |
| --- | --- | --- |
| Gate 0: repository and scope | **Pass** | Canonical `D:\Codex\intent-loop` repository, Codex-only boundary, no user assets or unrelated workspace changes. |
| Gate 1: Codex capability | **Pass for bounded technical MVP** | One Plugin packages one Skill, one local stdio MCP service, and optional Hooks. Real Codex calls bind to host sandbox metadata without model-generated paths or IDs. |
| Gate 2: evaluability | **Pass for instrument; no efficacy result** | The frozen 80-task paired protocol, grading, failure attribution, and thresholds exist. The required 80 baseline plus 80 plugin deliveries have not been run. |
| Gate 3: privacy and threat contracts | **Pass for public beta** | The current 72-test suite covers persistence, project isolation, modes, redaction, import, deletion, link containment, crash recovery, and parent-plus-marker generation-bound locking. Root and adversarial reviewers each passed ten 32-process stale-lock pressure runs; the reviewer also passed two independent 60-round safety groups. |
| Gate 4: public distribution | **Pending for beta.3** | Beta.2 installed lifecycles are historical only because beta.2 is superseded. A fresh public GitHub install pinned to `v0.1.0-beta.3` must complete root and independent practical-user lifecycles before this gate passes. |
| Gate 5: open-source operations | **Partial; publication pending** | Apache-2.0, NOTICE, embedded notices, generated CycloneDX SBOM, source validation, and local cleanup are ready. Beta.3 GitHub Actions, release checksums/attestations, exact-tag asset verification, and final plugin/marketplace/data/cache removal remain pending. |

## Public-beta promise

The supported beta promise is deliberately bounded: a Codex user can install from the public GitHub marketplace, keep structured intent state locally, inspect and correct it, classify evidence separately from explicit intent, export a compact summary, switch semantic reads and writes off, and uninstall cleanly. The plugin remains advisory and optional; Hooks are not trusted automatically.

The beta.3 adversarial reviewer gave **RELEASE** with no P0/P1 after 72/72 tests, two 60-round safety groups, and 10-by-32 real-process pressure. Its P2 items are a future fault-injection seam for stable access errors, applying bounded rechecks to an invalid-marker-only helper, and further shrinking the final marker check-to-unlink window. All remain fail-closed. The beta.2 practical review is historical; beta.3 still needs a fresh independent practical-user review before the public decision is final.

## Why efficacy remains Iterate

Every product-value threshold is still unmeasured. Passing implementation tests and successful installed lifecycles prove defined behavior; they do not prove lower avoidable rework, better final-match scores, acceptable interruption cost, or helpful intervention timing across independent work. `paired-evaluation-result.md` therefore remains `NO RESULT`.

## Cross-platform decision

Cross-platform has two different meanings:

- **The same Codex plugin on more desktop operating systems: worth doing, narrowly.** Windows has a real install/use/uninstall proof, and Windows plus Ubuntu CI pass on Node 20/22/24. The next proportional step is to add macOS CI and one real macOS install/use/uninstall smoke test. Until that passes, the project must not claim macOS support; Linux remains CI-proven rather than a full end-user install claim.
- **Ports for Claude Code, Cursor, Gemini CLI, WorkBuddy, or other agent hosts: not yet worth building.** A port would multiply sandbox metadata, Hook, trust, namespace, data-path, packaging, and support boundaries before the Codex version has demonstrated outcome value. The frozen paired study and real demand must clear first; then one narrow host adapter can be evaluated rather than starting a multi-host rewrite.

## Allowed next steps

1. Collect beta issue and usability evidence without changing the frozen efficacy thresholds.
2. Run the 80 baseline and 80 matched plugin deliveries, blind final artifacts, adjudicate corrections, and publish every frozen metric and exclusion.
3. Capture one naturally triggered trusted `PostCompact` plus resume sequence before a stable release.
4. Add macOS CI and one real macOS install/use/uninstall smoke test before claiming three-OS Codex support.
5. Consider one other host only after paired efficacy passes and real user demand identifies it.

## Prohibited next steps

Do not compensate for missing efficacy evidence with mandatory questions, intake forms, a PRD workflow, a custom client, an Agent Harness, broad user profiling, or speculative multi-agent ports. Do not describe green tests or tool-call traces as proof of product value.
