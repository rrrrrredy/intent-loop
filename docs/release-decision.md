# v0.3.0-beta.1 release decision

As of 2026-09-07: **FINAL CONFIRMATION INCOMPLETE / PUBLIC RESEARCH SNAPSHOT ONLY.** This development round is closed. Reviewed source and all diagnostic evidence are public; no v0.3 tag, prerelease or installer is justified. Do not start another model/corpus round or relax gates to manufacture a release. Existing v0.2 public artifacts are separate.

The independent goal audit found that manual state tools were implemented but ordinary feedback was not connected to them. The [re-scoped delivery goals](current-goals.md) prioritize that connection, provenance and recovery before more efficacy testing. Progress is not a passing product evaluation.

## Subsequent bounded maintenance

On 2026-09-08, a [small State-context repair](current-goals.md#bounded-maintenance-context-retention-2026-09-08)
gave the current task outcome a place before newer execution feedback fills the
snapshot. This is component-tested maintenance, not a new efficacy result. The
Core policy, final corpus, original scores and all frozen archive files are
unchanged. Earlier real-host State results remain historical and do not establish
the repaired package's model-mediated behavior. The release decision is unchanged.

## Final confirmation and decision

The frozen candidate `3dd8ab2283e86ad99ccc70a296b11b575f1ff7ce` passed all 18 jobs
in its [exact CI run](https://github.com/rrrrrredy/intent-loop/actions/runs/34113187891).
The one final independent study attempted all 160 conversations / 279 user turns.
The baseline first turn for `fc-co-013` timed out at 300,120 ms without a substantive
answer or an explicit capacity error. Its underlying cause is not established.
No failure was replaced. There were 159 usable conversations, 79 complete pairs,
and 160 successful native task deletions.

All 79 operationally complete pairs were blind-graded in 16 successful first attempts
under the frozen v4 prompt. These are subset diagnostics, never the required full
80-pair confirmation. [Every result and failure is preserved](../evidence/final-confirmation-20260907/README.md).

| Diagnostic on the 79 available pairs | Observed | Original gate |
| --- | --- | --- |
| First-cycle final-match gain | 1.58 percentage points | At least 10: **FAIL** |
| Non-clear ordinal rework sum | 6 to 2 (66.67% reduction) | At least 25% reduction |
| Clear extra interruptions | Median 0; P90 0 | Median 0; P90 at most 1 |
| Clear paired median latency overhead | -3.54% | At most 5% |
| Helpful / wrong proactive moves | 19 / 1 out of 20 | At least 70% / at most 15% |
| Denied committed inferences | 0 of 1 | At most 10% |
| Non-clear premature actions / complete persisted prompts | 0 / 0 | 0 / 0 |

Final-match scores totaled 302/316 baseline and 307/316 plugin, or 95.57% and
97.15% of the scale maximum. These are ordinal scores, not user success rates.
The baseline already scored 4/4 in 67 of 79 pairs. Even a perfect plugin could
gain at most 4.43 percentage points on this observed baseline, below the frozen
10-point gate. This ceiling is a measurement limitation, not a reason to lower
the gate after observing results or replace the corpus.

Rework was only six ordinal points before the plugin, so its large percentage
reduction must not be called human time saved. Blind preferences were plugin 13,
baseline 9, tie 57. The [independent review](independent-reviews.md#final-confirmation-and-goal-review)
also retained unnecessary choice invitations and possible grading asymmetries;
it did not rescore the archive. The implemented continuity path and compatible
packages are useful inspectable work; these observations do not establish a
market-ready product or meaningful average improvement on real projects.

The conservative archive sanitizer also redacted one fictional color after `token:`;
its generic secret pattern matched benign synthetic text, not a runtime credential.
No supplied DeepSeek or Kimi API key was used for this confirmation.

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

## Unmet release conditions and closed scope

- The authorized regressions, three-variant removal, grader calibration and one final independent confirmation have finished. They are not a standing authorization for another replacement holdout, alternate model or policy-tuning round.
- All original joint efficacy thresholds must pass on a clean candidate bound to the complete installed plugin tree. Do not change thresholds or present selected pairs, retries or a tuned corpus as the original complete study.
- The earlier six-case / 22-turn user-perspective archive and the supplementary two-case / six-turn continuity archive remain separate and source-bound. Neither replaces final exact-package checks or a human-user study.
- Source/package checks, State observations and Windows/Linux/macOS DeepSeek host lifecycles remain implementation evidence. The exact final candidate passed its 18-job CI matrix.
- No passing final confirmation exists, so annotated tag, tag CI, release assets, prerelease and fresh public installs were not initiated. This is an intentionally unmet release gate, not unfinished publishing work to bypass.
- The Research and applied systems entry on the [GitHub profile](https://github.com/rrrrrredy) was updated at profile commit `93dd68048778b9e1849bf653062db3689990cdcf`. It describes the intent-formation goal, links the current development status and discloses the incomplete final confirmation. It does not present v0.2 as the new product or imply that v0.3 is installable.
- Local cleanup is complete within the task-owned scope. The final check found zero daily Intent plugins, preserved all 14 other daily plugins, and verified the retired homes, final test homes, dependencies, caches and empty daily remnants absent. Source, historical worktrees and raw study/grading evidence were retained. See the [cleanup receipt](../evidence/local-cleanup-20260907.json); it is a local observation, not a claim that CI can inspect this computer.

## Evidence limits

V5 failed final-match gain, clear latency, and inference denial. V6 also returned STOP: clear paired latency +6.89%, wrong interventions 24.14%, and inference denial 62.5%. At least eleven v6 final requirements were invisible to the user-facing model, independently invalidating its efficacy result. Neither run authorizes publication.

V7 is an incomplete primary with a diagnostic subset, not a passing release study. Any later passing study remains a synthetic, automated evaluation on one model/host configuration. Real users may behave differently, models and graders can drift, and DeepSeek compatibility does not inherit a Codex efficacy result. No new platform adapter beyond the existing requested DeepSeek/Linux/macOS scope is authorized by these local checks.
