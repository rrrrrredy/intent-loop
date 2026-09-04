# Candidate-bound holdout result

Status: **STOP**. Candidate `fca68c5489d9698ad4894096818469aad3f5520b` did not pass every predeclared release-efficacy gate and must not be published as v0.3.0-beta.1.

## Bound inputs and execution

- Independently authored v5 corpus: 80 scenarios, 60 English / 20 Simplified Chinese, 80 distinct domains; SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`.
- Product plugin tree: 14 files, 34,742 bytes; SHA-256 `dba53218e6b4b7feab0e1c0d1e86d69177b38c75508b8e4898332643a670f7a8`.
- Git archive: SHA-256 `cae3e130d66749222b2f97e9344bbf9b8b6f771ccaaee7d2c6382a06c0bb672f`.
- Primary model: `gpt-5.6-sol`, low reasoning, baseline and installed-plugin arms, four workers, no primary retry.
- Primary completion: 160 / 160 usable conversations and 80 complete pairs; zero timeout, empty response, prompt drift, MCP call, or cleanup failure.
- Blind grader: `gpt-5.6-terra`, medium reasoning, 16 batches of five pairs, two workers, at most two attempts per batch.
- Final grading: 80 / 80 unique pairs. Batch 12 used its declared second attempt after the first response omitted one audit rationale; all other batches used one attempt.
- Final grader summary: SHA-256 `10e995aa6f923f094fbcc27b9f4578e686fec9962f0b0269fc22dad3a553bb27`.
- Canonical analysis: JSON SHA-256 `2566f3c2a07e2b2fb060b5e583c911b710c73427b21c880754a59ab7dadb084e`; Markdown SHA-256 `5ccd90e620c13f3f51044f844cf7b7ac221a4b608c4f3a4bbf369a4badc17bf0`.

The earlier 70-pair grader output is invalid and excluded. Its runtime required a rationale length that its Schema and rubric had not declared. The clean rerun graded all 80 pairs under an aligned contract; invalid-run summary SHA-256 is `4ab5df8d454ef15e624c86b518f70bf72f565a2eaf8920129bbbc26d8f422125`.

## Predeclared gates

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 69.70% (33 to 10) | at least 25% | Pass |
| Final-match change | +5.94 percentage points | at least +10 points | **Fail** |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | +5.36% | increase at most 5% | **Fail** |
| Helpful proactive interventions | 91.67% (22 / 24) | at least 70% | Pass |
| Wrong or unhelpful proactive interventions | 8.33% (2 / 24) | at most 15% | Pass |
| Explicitly denied inferences | 75% (6 / 8) | at most 10% | **Fail** |
| Premature actions on non-clear tasks | 0 | 0 | Pass |
| Full raw prompts persisted | 0 | 0 | Pass |

Mean final match was 3.45 / 4 for baseline and 3.69 / 4 for the plugin. Blind preferences were 19 plugin, 11 baseline, and 50 ties. Non-clear final-match gain was +7.92 percentage points. Clear-task arm medians were nearly identical, but the predeclared median of paired percentage changes was +5.36%; the paired median delta was +458 ms and both arm-order groups were positive.

## Failure attribution

The product materially improved poorly expressed and conflicting requests, but it still drafted some public, lasting, or high-stakes outputs before the user chose which of two compatible priorities should lead. Six of eight model-owned preference inferences were later denied. The compact instruction to avoid promoting an inference to a preference was too abstract to prevent this behavior.

After a branch was resolved, several outputs lost exact user constraints: one task reverted from the selected task-based structure, one exact seven-word line used eight words, one exact name changed case, and two responses added framing or advice the user did not request. This is a specific delivery-fidelity mechanism, not evidence for restoring a broad generic constraint reminder.

The core also used an always-on MCP server solely to return static policy text. The consistent paired clear-task delta makes that transport a candidate for architecture ablation; the v5 result alone does not prove the transport is the cause.

## Decision and limitations

V5 is permanently retired from release-gate use because its failures now inform the next revision. The next candidate requires development-only component ablation followed by a newly and independently authored sealed holdout. V5 may remain a regression corpus but cannot be rerun into a passing release claim.

This result is limited by a synthetic corpus, automated grading, one Windows primary execution host, and model or judge drift. DeepSeek tests establish adapter and packaging compatibility only; they do not inherit Codex efficacy evidence.

The earlier v8 run remains only a [development regression](../evidence/development-regression-v8/README.md) because its corpus informed policy iteration.
