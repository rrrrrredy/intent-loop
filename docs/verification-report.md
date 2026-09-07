# v0.3.0-beta.1 verification report

Status on 2026-09-07: candidate, not released. Implementation results, development observations, independent efficacy, and public release are separate gates.

The working post-v7 repair uses 1,496 policy bytes, adds a direct export-digest reply instruction, and introduces prospective v4 requirement-timing calibration. The complete Node 22 source suite passed 121 / 121 before the export-only instruction change; its affected Hook suite then passed 21 / 21. The affected evaluation/Hook/package/policy suites passed 65 / 65 on Node 20.19.1 before the final file/research wording refinement. These checks do not establish a model-level repair, ablation benefit or fresh holdout success. Historical fingerprints below describe the executed v7 candidate, not the changed working tree.

Candidate `b025222` has now completed the original 17 authorized post-v6 controls: 17 first turns, five follow-ups and 17 native task deletions, with no retries or first-turn actions. Its source/Git/fresh-installed core tree is `7048d10c8f1f501200967dc00c0bb796b90ff0f275652d768ac4cdbc2dec1363` (14 files, 35,535 bytes). Manual inspection confirms the intended control routes, not perfect content: the abstract is 131 rather than 130 words and the game explanation adds an unsupplied mechanism. See the [post-v7 regression boundary](../evidence/post-v6-development/README.md#post-v7-repair-regression). Costly-branch repair, clause removal and fresh confirmation remain unverified.

The repair run's official plugin and marketplace removal succeeded. Its exact isolated home, authentication copy and empty test workspaces were verified absent at 2026-09-07 08:11 UTC, while raw results and installation inventory were retained. No daily installation was added by this run.

## Current implementation and development

- Runtime candidate: `2b9101f9fc99ab0874f05a5d1e80b03b070de6a0`. The compact core policy is 1,193 UTF-8 bytes. Source/Git/fresh-installed core tree SHA-256: `581f12c654f45caeca4fac65ff13bbd012434e9da8a3719f842e13ff60bca567` (14 files, 34,427 bytes).
- Real Codex CLI `0.153.4`, `gpt-5.6-sol`, low reasoning: 17 / 17 first turns, 5 / 5 follow-ups, and 17 / 17 task deletions completed with exit zero. No first-turn action or domain-tool items occurred. All three comparisons retained neutral examples/placeholders and mix/reject/free-reply invitations. These are development observations, not an efficacy result or an all-content-pass score.
- [Selected post-v6 archive](../evidence/post-v6-development/README.md): 18 trials / 180 conversations with source, policy, installed-tree and artifact binding, including the new 17-control repair regression above. The earlier seven-case run completed seven first turns, four follow-ups and seven task deletions: four costly branches prompted a priority question and three controls proceeded directly, with no first-turn action items. This is development observation, not an all-content-pass score. A long host-interrupted batch remains invalid for both quality and timing. Older raw action counts are not retroactively removed.
- Evaluation-label correction: seven cheap-draft question labels were corrected; the later library-duration missing-data label was itself retracted because the initial prompt explicitly requested fiction. Broad factual-precedence policing, automatic feedback taxonomy, automatic micro-example text, named dimensions, and universal closing text were removed. See [ablation results](ablation-report.md).
- Complete source suites, including current v7 validation: 120 / 120 on Node 20.19.1 and 120 / 120 on Node 22.19.0. The 100-independent-writer regression passed without missing events or lock residue. Product lock timeouts were not relaxed.
- Root suite: evidence hashes, four release-planning/tag tests, 8 / 8 DeepSeek adapter tests, legal inventory and the exact 18-file DeepSeek package passed on Node 22.19.0.
- Fresh DeepSeek Harness 0.1.2-rc.1 lifecycle on Node 22.19.0: pack, add, compose, boot/help and remove passed on the current runtime. No model API key was used; its temporary home, installation and caches were removed automatically.
- Dated npm audits: both lockfiles returned HTTP 200 and zero advisories from the official bulk endpoint at 2026-09-07 03:00 UTC. Only dependency names/versions were sent. Exact hashes and responses are in [dependency audits](../evidence/post-v6-development/dependency-audits.json). These successful responses supersede the earlier timeout; CI/tag jobs must rerun the audit.
- X draft: 257 weighted characters, with Chinese translation. Xiaohongshu body: 612 characters, five titles and four hash-checked 1086 by 1448 images. These are prepared drafts, not evidence that the product is ready to announce.

## State privacy and reviews

Accepted adversarial fixes reject conditions appended to no-argument controls, refuse short-lived private-memory receipts, retain erasure tokens until recovery cleanup completes, preserve unrelated recovery records, reject deletion success after concurrent recreation, and remove private titles/workspace hashes across new/reset/import/legacy paths.

The adversarial agent reran its fixed 14 cases on `2b9101f` with no remaining blocker in that scope. Its completed [v7 case audit](v7-case-audit.md) retains real failures and qualifies hindsight grading. The user-perspective agent's historical 19 local installed-component checks made zero model requests; that snapshot remains separate from six completed synthetic cases / 22 real model turns using normally reviewed Hooks. All six model sessions, both plugins and the isolated home/workspace were removed. Two no-prompt onboarding UUID deletions failed despite no session files being present; whole-home removal subsequently completed. Post-v7 source changes still need targeted renewed review. See [independent reviews](independent-reviews.md) for exact limits.

The documented export-check command was executed against a newly generated synthetic export: it accepted the valid content digest and rejected a deliberately corrupted digest. Its temporary fixture was removed. The main evaluator removed its completed 17-case and seven-case isolated installations and authentication copies after native task deletion. The everyday Codex home now has zero Intent Formation/State installations and no intent-loop marketplace entry. Windows initially refused removal while eight exact project-owned MCP children held files open; those children were individually verified and stopped, then official CLI removal succeeded. The Codex app, unrelated processes, source repository and evidence were preserved. Earlier isolated environments and final dependency cleanup remain outstanding.

Historical real Codex State lifecycle tests established receipt-backed save/show/export/private/off/forget and ordinary/private prompt absence for earlier candidates. They do not replace a new exact-candidate conversational acceptance run. Local component success cannot stand in for that host-mediated gate.

## Independent v7 primary run and incomplete-pair diagnosis

- Independent author's original four files remain byte-identical under `packages/intent-formation/evals/seals/v7`. Original corpus SHA-256: `f2c25b9f251d8dcfb145132b4628dab853b7e0d20ed82271c91313f30e9dedec`.
- Canonical corpus SHA-256: `12c2a0658b9de2af0f5e3e3461fd0b88f028a92bd68c0937fa7f7c6c2252e851`. Only `unacceptable_first` was wrapped from one string to a one-element array; tests prove every other field value is identical. All 80 initial prompts and frozen follow-ups remain unseen by the root evaluator during preparation.
- Distribution: 15 / 15 / 15 / 15 / 20; 60 English / 20 Chinese; 80 domains. Every final requirement occurs verbatim in a user-visible turn.
- Local root overlap validation: zero violations against internal pairs, retired v6/v5, earlier Git holdouts, all tracked development corpora and both ablation corpora. Cross-corpus maxima: Jaccard `0.2721518987341772`, four-gram Dice `0.3095652173913043`. Internal maxima reproduce the author's results. See the [canonical method](../packages/intent-formation/evals/holdout-method.md).
- After additional authorization, candidate `16c4b199cda677b9cb19898096d1bcc161b7215c` ran all 160 primary conversations on the unchanged runtime tree. Four conversations returned an explicit model-capacity error and one hit the fixed 300,000 ms timeout; 155 conversations / 75 complete pairs were usable. No primary retry, replacement, or model change occurred. All 160 native tasks were deleted successfully.
- The 75 operationally complete pairs alone received diagnostic blind grading under frozen v3 rules: 15 batches, 15 attempts, zero failed batches; `gpt-5.6-sol`, medium grader reasoning versus low execution reasoning. No quality-based pair selection was used. This subset cannot satisfy the required 80-pair release study.
- Available-pair diagnostic: rework 44 to 12; first-cycle match gain +19.67 percentage points; clear paired latency +1.68%; helpful interventions 20 / 21. Two raw gates still fail: denied inferences 3 / 8 (37.5%) and three non-clear first-turn command items. Commands were local workspace inspection, not roster or payment writes. Case-level scope and grading defects are being audited; original outputs and grades are preserved unchanged.
- [Failed v7 evidence](../evidence/failed-holdout-v7/README.md) contains every primary result, all five failures, the 75 original grades, analysis and hashes bound to the executed commit. Eight machine-local paths were replaced; no response strings were length-truncated. It is explicitly ineligible for release efficacy.

## Historical efficacy failures remain failures

| Holdout | Execution | Decision and failed gates |
| --- | --- | --- |
| Candidate `bae8e03` | 160 usable conversations | ITERATE: intervention quality and premature action. |
| Candidate `fcba88e` | 160 usable conversations | ITERATE: final match, inference denial, premature action. |
| V5, `fca68c5` | 160 conversations, 80 clean grades; an earlier invalid grader attempt remains excluded | STOP: +5.94-point final-match gain, +5.36% clear latency, 75% inference denial. |
| V6, `a67148e` | 160 conversations, 80 grades | STOP: +6.89% clear latency, 24.14% wrong interventions, 62.5% inference denial. At least eleven hidden final requirements independently invalidate efficacy. |
| V7, `16c4b19` | 155 / 160 usable conversations, 75 complete pairs | Incomplete primary; no release efficacy. Available-pair diagnosis also fails inference denial and premature-action gates; case-level audit is separate from the unchanged raw grades. |

The tuned historical v8 corpus and all post-failure development trials remain excluded from release-efficacy claims. The v6 failure, invalidity audit, raw-grade analysis and hashes are preserved in [failed v6 evidence](../evidence/failed-holdout-v6/manifest.json).

## Remaining release gates

Actual candidate-bound model efficacy and user acceptance, fresh real-host checks, Linux/macOS and Node 24 CI, all 18 main jobs, all 18 annotated exact-tag jobs, verified release assets/attestations, prerelease and fresh public installations remain required. DeepSeek host compatibility never inherits a Codex efficacy result.

The public GitHub profile was checked through GitHub's API on 2026-09-07: Intent Formation is already under Research and applied systems, but links the old v0.2.0-beta.5 prerelease (profile README blob `52a4504ba2d7f1d66db1e13d88fa00376b301584`). The new release/profile refresh and final removal of all task-created local installations, state, caches, and dependencies are not complete.
