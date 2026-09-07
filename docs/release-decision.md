# v0.3.0-beta.1 release decision

As of 2026-09-07: **ITERATE / NOT RELEASED.** Do not tag, push the candidate as a release, or announce v0.3 until every applicable gate passes. Existing v0.2 public artifacts are separate.

## Current verified implementation and development evidence

- Candidate `2b9101f9fc99ab0874f05a5d1e80b03b070de6a0`: privacy fixes cover conditional controls, private false receipts and metadata, interrupted erasure, unrelated recovery records, and concurrent recreation. The adversarial agent reran its fixed 14-case set with no remaining blocker in that scope.
- Complete Codex source suites: 120 / 120 on Node 20.19.1; 120 / 120 on Node 22.19.0, including the current v7 local validation. These prove implementation behavior, not product value.
- Fresh installed core: 17 first turns, five follow-ups, and 17 task deletions completed with no first-turn actions. Three requested comparisons include mix/reject/free-reply invitations. Raw outputs retain remaining prose/rule-following imperfections; this is not an all-content-pass score.
- Selected post-v6 development evidence is preserved as 16 trials / 156 conversations and is explicitly excluded from efficacy claims. The invalid long-interrupted batch is excluded from timing and quality metrics.
- Independent v7 author artifacts are sealed and preserved. Canonicalization only wraps `unacceptable_first` in a one-element array; all prompt/follow-up/requirement values remain identical. Local validation found zero internal or cross-corpus overlap violations. No v7 arm or grader has run.
- Both exact lockfile snapshots returned HTTP 200 / zero advisories from the authorized npm official bulk endpoint on 2026-09-07. Release CI must still obtain a fresh advisory result.
- Root checks passed for evidence hashes, 8 / 8 DeepSeek adapter tests, legal inventory, and the 18-file DeepSeek package. X and Xiaohongshu drafts still satisfy their local length checks, with four image assets present.

## Remaining gates

- Authorization and execution of the new seven costly-branch development cases, the independent v7 paired evaluation and blind grading, and actual model-mediated user-perspective cases. The external-data reviewer rejected expansion beyond the specifically authorized 17-case corpus; no workaround was attempted.
- All original joint efficacy thresholds must pass on a clean candidate bound to the complete installed plugin tree. Do not change thresholds or tune the policy against v7 after seeing its results.
- User-perspective review currently verifies local installed components, not the real Codex chat/Hook trust chain. Complete the actual-user interaction gate and address any accepted blocker.
- Final exact-candidate source/package/secret checks, real Codex State lifecycle, current DeepSeek host lifecycle, and generated/SBOM/notice consistency.
- Push the verified candidate and obtain all 18 main CI jobs, including real Linux/macOS runners; then an annotated exact tag, all 18 tag CI jobs, verified assets and attestations, prerelease, and fresh public installs.
- Refresh the existing Research and applied systems profile entry for the new public version. It currently links v0.2.0-beta.5.
- Delete all task-created local installations, state, caches, and dependencies after the work is complete, retaining the source and sanitized evidence.

## Evidence limits

V5 failed final-match gain, clear latency, and inference denial. V6 also returned STOP: clear paired latency +6.89%, wrong interventions 24.14%, and inference denial 62.5%. At least eleven v6 final requirements were invisible to the user-facing model, independently invalidating its efficacy result. Neither run authorizes publication.

Even a passing v7 remains a synthetic, automated evaluation on one model/host configuration. Real users may behave differently, models and graders can drift, and DeepSeek compatibility does not inherit a Codex efficacy result. No new platform adapter beyond the existing requested DeepSeek/Linux/macOS scope is authorized by these local checks.
