# v0.3.0-beta.1 release decision

As of 2026-09-07: **ITERATE / NOT RELEASED.** Reviewed development source and honest diagnostic evidence may be pushed to main. Do not tag or announce v0.3 as a release until every applicable gate passes. Existing v0.2 public artifacts are separate.

The independent goal audit found that manual state tools were implemented but ordinary feedback was not connected to them. The [re-scoped delivery goals](current-goals.md) prioritize that connection, provenance and recovery before more efficacy testing. Progress is not a passing product evaluation.

## Public development integration

Development commit `c970c28` and the revised GitHub profile entry are public. Its
[first 18-job CI run](https://github.com/rrrrrredy/intent-loop/actions/runs/34104135229)
failed overall: the nine Codex source-test steps passed, but six Unix generated-file
checks found a missing executable Git mode; root evidence checks could not fetch a
detached historical ablation commit; and the fresh DeepSeek Corepack home selected an
unpinned newer pnpm. These are integration failures, not failed model conversations.

The follow-up fixes the generated server's Git mode, pins and verifies pnpm 11.7.0
inside the actual isolated home, and preserves original experiment commits on the
separate `evidence/history` branch without merging their runtime changes into main.
The corrected local DeepSeek pack/add/compose/help/remove lifecycle passed without
an API key and removed its temporary home. Public main `9e9c465` then passed all
18 jobs in the [exact-commit CI run](https://github.com/rrrrrredy/intent-loop/actions/runs/34106864707),
including Windows, Linux/macOS, dependency audits and DeepSeek host lifecycles.
Full-history clones fetch the evidence branch; shallow/single-branch
clones must also fetch `evidence/history` before verifying historical evidence.

## Current verified implementation and development evidence

- Repaired candidate `b025222` repeated the 17 authorized controls with five follow-ups and 17 successful native task deletions, no primary retries and no first-turn actions. The 1,496-byte policy retains the observed cheap-draft/comparison/feedback routes; this does not verify costly-branch improvements. A 131-word response to a 130-word request and an unsupplied game mechanism remain visible in the raw outputs. Core source/Git/installed SHA-256 is `7048d10c8f1f501200967dc00c0bb796b90ff0f275652d768ac4cdbc2dec1363`.
- Candidate `2b9101f9fc99ab0874f05a5d1e80b03b070de6a0`: privacy fixes cover conditional controls, private false receipts and metadata, interrupted erasure, unrelated recovery records, and concurrent recreation. The adversarial agent reran its fixed 14-case set with no remaining blocker in that scope.
- The continuity delta passed the targeted 26 Hook tests on Node 20.19.1, with the full source suite subsequently passing in the public Node 20/22/24 CI matrix. These prove implementation behavior, not product value.
- Fresh installed core: 17 first turns, five follow-ups, and 17 task deletions completed with no first-turn actions. Three requested comparisons include mix/reject/free-reply invitations. Raw outputs retain remaining prose/rule-following imperfections; this is not an all-content-pass score.
- Selected post-v6 development evidence is preserved as 24 trials / 210 conversations, including the completed ten-case / three-variant removal. All old rows are unchanged. The invalid long-interrupted batch is excluded from timing and quality metrics. Current Core is 1,330 policy bytes after removing an unsupported automatic clause; it exactly matches the tested without-settled Core tree `a06dd3489f58a1bdc1c7a7e52cd540486c31242f98f59e98dec00c6bdb95cd8a`. Two effect-selection failures remain; this is not a claim that every development probe passes.
- Two supplementary synthetic cases / six real host turns on `c970c28` exercised ordinary feedback, sourced State updates, implementation-versus-intent correction, unknowns, actual source binding, fresh-process recovery and a non-activated task. All 15 scoped consistency checks passed. Ordinary resume also contains history, so no State-only efficacy or user time-saving claim follows. The separate source-bound archive retains observed friction and complete cleanup.
- Independent v7 author artifacts are sealed and preserved. Candidate `16c4b19` completed 160 attempts but only 155 usable conversations / 75 complete pairs: four explicit capacity errors and one fixed-timeout failure, with no primary retry. All 160 native tasks were deleted. Its 75-pair blind diagnostic does not meet the predeclared 80-pair design and also retains two raw failed gates (inference denial and premature actions). See [preserved v7 failure evidence](../evidence/failed-holdout-v7/README.md).
- Both exact lockfile snapshots returned HTTP 200 / zero advisories from the authorized npm official bulk endpoint on 2026-09-07. Release CI must still obtain a fresh advisory result.
- Root checks passed for evidence hashes, 8 / 8 DeepSeek adapter tests, legal inventory, and the 18-file DeepSeek package. X and Xiaohongshu drafts still satisfy their local length checks, with four image assets present.

## Remaining gates

- Diagnose the retained v7 failures, fix reproducible product defects, and repair any prospective evaluation defects without rewriting original grades. A repaired policy requires a new independent sealed confirmation; v7 is now exposed development material. The user authorized one new independent 80-case OpenAI gpt-5.6-sol paired confirmation and blind grading after clarification on 2026-09-07. Regression, component removal and prospective grader calibration must precede its seal.
- All original joint efficacy thresholds must pass on a clean candidate bound to the complete installed plugin tree. Do not change thresholds or present selected pairs, retries or a tuned corpus as the original complete study.
- The earlier six-case / 22-turn user-perspective archive and the supplementary two-case / six-turn continuity archive remain separate and source-bound. Neither replaces final exact-package checks or a human-user study.
- Final exact-candidate source/package/secret checks, real Codex State lifecycle, current DeepSeek host lifecycle, and generated/SBOM/notice consistency.
- Main is public and its 18-job CI passed. A passing final confirmation is still required before an annotated exact tag, all 18 tag CI jobs, verified assets and attestations, prerelease, and fresh public installs.
- The Research and applied systems profile entry was updated publicly at profile commit `e79d4951e819a13f8bae48ddc17dd2150ab1c15d`. It describes the current experimental goal, links current development status and does not present v0.2 as the new product. Change it again only if the release status changes.
- Finish deleting task-created isolated installations, state, caches, and dependencies after the work is complete, retaining source and sanitized evidence. Everyday Codex core/State installations and the intent-loop marketplace entry have already been removed and verified absent.

## Evidence limits

V5 failed final-match gain, clear latency, and inference denial. V6 also returned STOP: clear paired latency +6.89%, wrong interventions 24.14%, and inference denial 62.5%. At least eleven v6 final requirements were invisible to the user-facing model, independently invalidating its efficacy result. Neither run authorizes publication.

V7 is an incomplete primary with a diagnostic subset, not a passing release study. Any later passing study remains a synthetic, automated evaluation on one model/host configuration. Real users may behave differently, models and graders can drift, and DeepSeek compatibility does not inherit a Codex efficacy result. No new platform adapter beyond the existing requested DeepSeek/Linux/macOS scope is authorized by these local checks.
