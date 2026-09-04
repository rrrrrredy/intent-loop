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
- Post-v5 development candidate: 1,099 policy bytes after transport and rule ablation. Warm MCP was retained; the command Hook, generic fidelity reminder, and automatic feedback taxonomy were rejected. Stable-CLI regression and a new sealed holdout are PENDING, so this is not efficacy evidence.

## State lifecycle

- Source regression suite: PASS, 104 / 104 on Node 20.19.1 and 104 / 104 on explicitly invoked Node 22.19.0, including the 100-writer lock regression and package-scratch exclusion.
- Lock pressure: 10 additional rounds of 100 simultaneous appends completed without event loss after repairing the owner-publication race exposed by a real failed run.
- Development-plugin real host: PASS for receipt-backed start, atomic save, show, file export plus digest verification, private purge, fresh-process private write, off, and forget.
- Fresh candidate marketplace real host: PASS for direct `remember`, `show`, export plus independently recomputed digest, managed-export purge on private transition, private `remember` refusal without a receipt, `off`, and physical `forget`.
- Real-host off override: PASS. After receipt `IF-0A5DC13F`, the frozen ambiguous landing-page prompt produced a finished headline and subheading with no intent-formation interruption.
- Plugin-managed disk checks: PASS. The ordinary prompt and private canary were absent; the managed export disappeared on private transition; the task ID was absent after `forget` receipt `IF-C04D0DA6`.

## DeepSeek Harness

- Adapter and exact 18-file package suite: PASS on Node 20.19.1 and an explicitly verified Node 22.19.0 PATH; 8 / 8 adapter tests passed on each runtime. Package bytes and digests come from the generated pack manifest rather than a hand-maintained number.
- Real temporary package/add/compose/boot-help/remove lifecycle: PASS against `@deepseek-ai/dsh` `0.1.2-rc.1` on Node 22.19.0, with no model API key and automatic profile cleanup.
- Node 22.19 real host lifecycle: PASS for pack/add/compose/boot-help/remove with a temporary `DSH_HOME`, no model API key, and complete cleanup.
- Source-package dry run: PASS with 81 expected entries and zero `.tmp` paths after adding an explicit scratch exclusion.
- DeepSeek/root production dependency audit: PASS against the live npm advisory endpoint with zero vulnerabilities.
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
