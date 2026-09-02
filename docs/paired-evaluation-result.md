# Candidate-bound holdout result

Status: **PENDING**. No release-efficacy claim is active until the sealed holdout has run against a clean candidate commit and the resulting evidence bundle verifies.

The tables below preserve the earlier v8 development regression for historical audit only. That corpus was used while iterating the policy and cannot authorize the release.

## Result

| Measure | Baseline | Intent Formation | Gate result |
| --- | ---: | ---: | --- |
| Usable primary conversations | 80 / 80 | 80 / 80 | PASS |
| Avoidable rework, 60 non-clear cases | 66 | 0 | PASS, 100% reduction |
| Mean final match | 2.96 / 4 | 3.89 / 4 | PASS, +23.13 pp |
| Non-clear final-match gain | — | +30.83 pp | Descriptive |
| Clear extra interruptions | — | median 0, p90 0 | PASS |
| Clear first-turn median | 9,115 ms | 9,169 ms | Descriptive |
| Clear paired median latency overhead | — | +1.97% | PASS |
| Proactive intervention | — | 29 helpful, 0 wrong | PASS |
| Blind preference | 3 | 41 | 36 ties |
| Exact complete corpus prompts in default state | — | 0 | PASS |

No primary conversation timed out or failed cleanup. The longest primary turn was the second plugin turn for `conflict-06` at 175,993 ms, close to the 180-second timeout. Three of 40 blind-grader batches timed out on their first attempt and returned valid schema-conforming grades on their second attempt; product outputs were unchanged.

## Class detail

| Class | Baseline → plugin rework | Baseline → plugin final match | Preference: plugin / baseline / tie |
| --- | ---: | ---: | ---: |
| Poorly expressed | 27 → 0 | 1.80 → 3.80 | 14 / 0 / 1 |
| Unformed | 15 → 0 | 2.87 → 3.93 | 10 / 1 / 4 |
| Conflict | 23 → 0 | 2.07 → 4.00 | 15 / 0 / 0 |
| Preference after result | 1 → 0 | 3.73 → 3.67 | 2 / 2 / 11 |
| Clear | 0 → 0 | 4.00 → 4.00 | 0 / 0 / 20 |

The preference-after-result class does not show a final-match gain. The public product claim is therefore focused on preventing premature commitment when meaning, options, or tradeoffs remain unresolved. It does not claim that every feedback turn improves.

## Uncertainty and limits

- Paired-bootstrap 95% interval for mean final-match gain: +16.25 to +30.31 percentage points.
- Paired-bootstrap 95% interval for non-clear rework units saved per case: 0.83 to 1.37.
- Paired-bootstrap 95% interval for clear paired median latency overhead: -4.12% to +7.29%; this crosses the +5% gate despite a passing point estimate.
- Exact two-sided sign-test p-value on 41 plugin wins versus 3 baseline wins, excluding ties: approximately 1.62e-9.

The intervals resample this corpus only. They do not cover model drift, judge error, different users, different tasks, or another host. The runner and grader used configured Codex defaults and did not record exact model identities. Grading was automated, not a human panel.

All historical sanitized responses, grades, source hashes, retry records, and statistics are preserved in the [development regression bundle](../evidence/development-regression-v8/README.md).
