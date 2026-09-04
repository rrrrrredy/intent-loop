# v0.3.0-beta.1 verification report

This report is intentionally incomplete while the candidate is being prepared. A green source test alone does not authorize publication.

## Product evidence

- Historical v8 development regression: preserved and hash-verified, but excluded from release-efficacy claims because the policy was tuned against its corpus.
- First independently sealed holdout on candidate `bae8e03`: 160 / 160 usable conversations, but `ITERATE` because intervention-quality and premature-action gates failed. It is retired from release-gate use after informing the revision.
- Second independently sealed holdout on candidate `fcba88e`: 160 / 160 usable primary conversations, but `ITERATE` because final-match, inference-denial, and premature-action gates failed. It is also retired after informing the reduced policy.
- Independently authored v5 holdout: SEALED before either arm ran, SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`; 80 scenarios, 60 English / 20 Chinese, 80 distinct domains, and zero threshold violations against both retired holdouts, every development corpus, and both ablation corpora.
- Candidate `fca68c5489d9698ad4894096818469aad3f5520b`: 160 / 160 primary conversations completed without timeout, prompt drift, MCP calls, or cleanup failure; source, Git, and executed plugin trees match SHA-256 `dba53218e6b4b7feab0e1c0d1e86d69177b38c75508b8e4898332643a670f7a8`.
- First grader run: INVALID before score inspection. It produced 70 / 80 grades, but two batches exhausted their two allowed attempts because the runtime required a 40-character rationale that the output Schema and rubric had not declared. Invalid summary SHA-256: `4ab5df8d454ef15e624c86b518f70bf72f565a2eaf8920129bbbc26d8f422125`.
- Clean blind-grader rerun: PASS operationally, 80 / 80 unique grades with one declared grader-only retry and no primary retry. Summary SHA-256: `10e995aa6f923f094fbcc27b9f4578e686fec9962f0b0269fc22dad3a553bb27`.
- Canonical v5 decision: **STOP**. Rework reduction (69.70%), clear interruptions, proactive-intervention rates, premature-action, and persistence gates passed. Final-match gain (+5.94 points), clear paired latency (+5.36%), and inference denial (75%, 6 / 8) failed. Analysis JSON SHA-256: `2566f3c2a07e2b2fb060b5e583c911b710c73427b21c880754a59ab7dadb084e`.
- Sanitized public release evidence: BLOCKED. V5 is retired after informing the next revision.
- Post-v5 stable-CLI regression: the 1,099-byte candidate passed the original 15 cases but failed strict chosen-lead order in two of three targeted runs. An over-compressed intermediate variant caused four routing regressions and was rejected. The 1,145-byte correction passed a new lead-order case 5 / 5 and retained the other routes, but one bounded sample invented unsupported details.
- Retired v6 candidate: 1,253 policy bytes, one byte below the original 1,254 bytes. The 1,165-byte `never invent facts` rule failed a valid Hook-enabled scope check; the explicit facts-only fallback passed 5 / 5, chosen-lead order passed 5 / 5, and the complete 16-case corpus passed 16 / 16 with zero tool calls or user-work actions. Three no-bypass runs are excluded as invalid transport diagnostics. Warm MCP remained; the command Hook and generic fidelity reminder stayed removed.
- Independently authored v6 holdout: SEALED before any model, arm, or grader run, SHA-256 `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897`; 80 scenarios, 60 English / 20 Chinese, and 80 distinct domains.
- Portable overlap checker: aligned before v6 inspection with the published whole-scenario, individual-Han-token, normalized four-gram method. It reproduced maximum Jaccard `0.45614035087719296` and four-gram Dice `0.5330882352941176` against historical holdouts, all development corpora, and both preserved ablation corpora, with zero violations.
- V6 execution: 160 / 160 usable primary conversations, zero primary timeout, zero cleanup failure, 80 / 80 blind grades, and one allowed grader-only retry. Candidate `a67148e7eb55db1bc92593829661c31b9929fb32`; executed plugin-tree SHA-256 `a26fb3ef63390701c13f7ff81e969a0dfb898b47a5b4ad9ff7760bb4d26f8897`.
- V6 point-estimate decision: **STOP**. Avoidable rework reduction (65.96%), final-match gain (+13.75 points), clear interruptions, helpful interventions, premature action, and persistence passed. Clear paired latency (+6.89%), wrong proactive interventions (24.14%), and inference denial (62.5%, 5 / 8) failed.
- V6 validity audit: **INVALID FOR EFFICACY**. At least eleven scenarios placed concrete expected facts only in evaluator fields, outside both user-visible turns. The aggregate run remains a failure diagnostic, not a product claim; exact artifact hashes and the defect list are preserved under `evidence/failed-holdout-v6`.
- Current post-v6 revision: 1,317 policy bytes. It restores result-feedback semantics, names five observable decision dimensions after v6 under-fired or asked surface questions, and narrows the sample rule to factual invention without suppressing requested creative examples. An intermediate 1,260-byte rule asked correctly on only 2 / 7 targeted decision cases, so it was rejected. Real installed-Hook validation of the strengthened rule and component ablation are pending.
- Evaluation contract v3: every final requirement must be an exact excerpt from the initial prompt or frozen follow-up; the runner, grader, analyzer, and publisher all fail closed on hidden requirements. No v7 holdout has been authored or run.

## State lifecycle

- Sealed-v6 source regression suite: PASS, 105 / 105 on Node 20.19.1 and 105 / 105 on explicitly invoked Node 22.19.0, including the portable v6 overlap reproduction, 100-writer lock regression, and package-scratch exclusion.
- Current revision source/package regression: PASS, 107 / 107 on Node 20.19.1 and 107 / 107 on Node 22.19.0, covering policy routing, package surfaces, post-v6 development-corpus structure, evaluation contract v3, state correctness, and simultaneous 100-process writes.
- Lock pressure: 10 additional rounds of 100 simultaneous appends completed without event loss after repairing the owner-publication race exposed by a real failed run.
- Pressure-test validity repair: two full-suite attempts failed after process-launch scheduling paused a live owner for the worker's 120-second boundary, while an isolated 100-process run completed in 10.3 seconds. The fixture now waits until all 100 runtimes publish ready markers before opening one contention barrier, separating launch pressure from lock behavior. Full-suite barrier runs completed in 12.0 seconds on Node 20 and 14.4 seconds on Node 22 with every event and no lock residue; product timeouts were not relaxed.
- Development-plugin real host: PASS for receipt-backed start, atomic save, show, file export plus digest verification, private purge, fresh-process private write, off, and forget.
- Fresh candidate marketplace real host: PASS for direct `remember`, `show`, export plus independently recomputed digest, managed-export purge on private transition, private `remember` refusal without a receipt, `off`, and physical `forget`.
- Real-host off override: PASS. After receipt `IF-0A5DC13F`, the frozen ambiguous landing-page prompt produced a finished headline and subheading with no intent-formation interruption.
- Plugin-managed disk checks: PASS. The ordinary prompt and private canary were absent; the managed export disappeared on private transition; the task ID was absent after `forget` receipt `IF-C04D0DA6`.

## DeepSeek Harness

- Adapter and exact 18-file package suite: PASS on Node 20.19.1 and an explicitly verified Node 22.19.0 PATH; 8 / 8 adapter tests passed on each runtime. Package bytes and digests come from the generated pack manifest rather than a hand-maintained number.
- Real temporary package/add/compose/boot-help/remove lifecycle: PASS against `@deepseek-ai/dsh` `0.1.2-rc.1` on Node 22.19.0, with no model API key and automatic profile cleanup.
- Node 22.19 real host lifecycle: PASS for pack/add/compose/boot-help/remove with a temporary `DSH_HOME`, no model API key, and complete cleanup.
- Sealed-v6 source-package dry run: PASS with 87 expected entries and zero `.tmp` paths. The current revision changes evaluation sources and must repeat this check after v7 integration.
- Previous DeepSeek/root production dependency audit: PASS against the then-current live npm advisory endpoint with zero vulnerabilities; a current-manifest rerun is required.
- Codex production dependency audit: local advisory-cache check found zero vulnerabilities; the bounded live endpoint request timed out and remains PENDING. Both CI and exact-tag release workflows rerun the live audit.
- Node 24 local run: not available on this host; covered by the required CI matrix before release.
- Windows, Ubuntu, macOS CI: PENDING.

## Independent reviews

- Adversarial review: PENDING final candidate.
- Beginner/user-perspective review: PENDING final candidate.

## Public release

- Main-branch CI: PENDING.
- Exact-tag CI: PENDING.
- Release assets and attestations: PENDING.
- Immutable GitHub prerelease: PENDING.
- Fresh public Codex and DeepSeek installs: PENDING.
- GitHub profile update: PENDING.
- Local cleanup: PENDING.
