# Release decision

Decision date: 2026-08-28

Decision: **READY TO PUBLISH; PUBLICATION PROOF STILL REQUIRED**

The source-level release blockers found by the adversarial and practical first-use reviews have implementations and regression tests. Both independent reviewers approved the frozen local candidate, and the matching installed build completed its host lifecycle, including one-call start with no model-supplied project path. Public GitHub CI/Release checks, remote-install proof, and clean uninstall are still pending. This document must not be read as a product-efficacy Go, an OpenAI universal-directory approval, or authorization for any other-agent adaptation.

## Gate summary

| Gate | Result | Reason |
| --- | --- | --- |
| Gate 0: repository and scope | **Pass** | Canonical D: repo, no pre-existing implementation or user assets, Codex-only boundary preserved. |
| Gate 1: Codex capability | **Pass for bounded technical MVP** | Plugin packages Skill/MCP/Hooks; a clean workspace loads the Skill through the read-only MCP fallback and calls the installed server; SessionStart Hook delivery works without App Server, private transcript parsing, Codex changes, rich UI, or a new client. |
| Gate 2: evaluability | **Pass for instrument; no efficacy result** | Outcome-level definitions, frozen corpus, pairing, grading, failure attribution, and thresholds exist. The paired 160 deliveries have not been run. |
| Gate 3: privacy and threat contracts | **Pass for frozen local candidate** | 62 tests cover private ownership/restart/deletion recovery, internal junction/hardlink rejection, orphan cleanup, credential escaping, import bounds/remapping, fail-closed host project binding, local-root enforcement, exact confirmation, and byte scans. The adversarial reviewer independently passed the suite and approved the candidate; isolated package deletion also passed. |
| Gate 4: public distribution | **Local pass; remote proof pending** | The self-contained runtime passes clean-copy execution and an installed Codex lifecycle locally; remote GitHub installation has not yet been run on the reviewed commit. |
| Gate 5: open-source operations | **Pending external proof** | Apache-2.0, NOTICE, third-party notices, SBOM, policy documents, CI, and release workflows are present. Default branch, public CI, prerelease assets, checksums, and attestations must be verified after publication. |

## Conditions for public beta Go

The bounded public-beta promise is: install from the public GitHub marketplace, run locally, preserve structured intent state, expose user controls, and fail open. A Go requires all current tests and validators, final approval from both independent reviewers, public CI and prerelease evidence, a clean remote install, and verified local uninstall. Until those checks complete, publication is blocked.

## Why efficacy remains Iterate

Every product-value threshold is still unmeasured. Passing implementation tests and a successful installed lifecycle can prove implementation behavior, not lower rework, better final match, acceptable interruption cost, or useful intervention timing across independent tasks. `docs/paired-evaluation-result.md` therefore records `NO RESULT`, and all efficacy metrics block a stable-product or effectiveness Go.

## Why Iterate, not Stop

No architectural exit condition has been demonstrated:

- the core does not depend on a private transcript, Codex modification, App Server client, or independent chat surface;
- it does not need to take over planning or execution;
- explicit/evidence/inference and implementation-error/intent-change boundaries are represented and tested;
- storage, permissions, Hook trust, and physical deletion remain inspectable and optional;
- the core is a host-neutral MCP state model, although portability value is not yet proven.

The remaining uncertainty is principally product value and intervention timing, not a requirement to become a Harness.

## Allowed next step

Run the frozen paired study without changing thresholds:

1. produce 80 baseline and 80 matched plugin deliveries on cloned fixtures;
2. blind final artifacts and preserve complete exclusions/timeouts;
3. independently annotate corrections and adjudicate disputes;
4. compute every frozen metric, confidence interval, and intent stratum;
5. scan paired-run persistence, and rerun export/deletion contracts;
6. issue a new Go/Iterate/Stop decision from those results.

Before a stable release, also capture one naturally triggered PostCompact plus resume sequence with the optional Hooks explicitly trusted for that controlled run.

## Prohibited next step

Do not add more mandatory questions, forms, a PRD workflow, user-profile expansion, a custom client, an Agent Harness, or any other-agent adapter to compensate for missing evidence. If the paired thresholds fail, diagnose intervention timing, data semantics, host limitations, or product value using the frozen attribution rules.

There is intentionally no cross-agent adaptation plan or new single-point person-day estimate until the frozen efficacy thresholds pass.
