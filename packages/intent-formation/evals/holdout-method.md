# Sealed holdout generation method

Date: 2026-09-03

## Purpose

This directory contains a fresh holdout corpus for the final Intent Formation evaluation. It is intentionally outside the repository so the candidate can be frozen before either evaluation arm sees the scenarios.

## Generation constraints

- Exactly 80 natural prompts were authored for verbatim use: 15 `poorly_expressed`, 15 `unformed`, 15 `conflict`, 15 `preference_after_result`, and 20 `clear`.
- Expected first moves are fixed by class: question, comparison, question, sample, and silent respectively.
- Every non-clear scenario has one follow-up written and frozen before either arm runs. No follow-up was produced from, or adapted to, an arm's output.
- All `preference_after_result` rows include a frozen `feedback_label`. Coverage is: 6 `keep`, 4 `implementation_change`, 4 `intent_change`, and 1 `uncertain`.
- The corpus includes public, costly, consequential, reversible, and low-stakes work. Five initial prompts explicitly use only subjective quality words from the requested set (`professional`, `premium`, `clean`, or `高级`) to leave the consequential interpretation unresolved.
- Prompts require no network access, external account, credential, or pre-existing private data.
- The three prompts that instruct file creation explicitly confine it to an empty temporary workspace and prohibit other changes. No destructive file task is included.
- The 20 clear controls are fully specified; asking a question is deliberate friction in those cases.
- Existing `packages/intent-formation/evals/study-80.jsonl` was read only to match its data shape and avoid duplicate or near-duplicate scenarios.

## Independence and freeze statement

No product policy, repository source, or product configuration was modified for this work. During corpus construction, the product policy was not opened, executed, or tuned against these scenarios. No candidate arm was run, no model response was observed, and no scenario or follow-up was revised in response to product behavior. The corpus was validated first and is now sealed by the digest below.

## Validation

- JSON parsing: pass for all 80 lines.
- Required and class-specific fields: pass.
- Unique IDs: 80 of 80.
- Exact normalized duplicate initial prompts within this holdout: 0.
- Exact normalized duplicate initial prompts against the existing 80: 0.
- Automated near-duplicate threshold hits within this holdout: 0.
- Automated near-duplicate threshold hits against the existing 80: 0.
- Thresholds: token-set Jaccard at least 0.65 or normalized character four-gram Dice at least 0.72.
- Maximum similarity within this holdout: token Jaccard 0.357143; character four-gram Dice 0.454545.
- Maximum similarity against the existing 80: token Jaccard 0.357143; character four-gram Dice 0.392857.
- A separate manual topic-and-decision pass found no copy or close paraphrase of an existing scenario.

## Sealed corpus digest

`holdout-80.jsonl` SHA-256:

`9b209f5fe28de8f0c58e16fbc7cc44dbd5945a566b39e4d8afad9c6d34afa216`
