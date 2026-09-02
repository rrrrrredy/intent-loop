# Frozen 80-scenario paired study: v8 development regression

The redesigned v8 policy passed every predeclared point-estimate gate on 2026-09-02. Because the policy was iterated against this unchanged corpus, the result is development regression evidence only. It does not supersede the need for a fresh candidate-bound holdout and cannot authorize release.

## Summary

- Corpus: 80 synthetic scenarios, SHA-256 `9f66af3f968d2df52fac4f0ffb5ea8c12fa9a8f5076a0645ec25ddca0e4f428b`.
- Design: within-scenario pairing, alternating AB/BA order, arms sequential within each pair.
- Primary conversations: 160/160 usable, no product timeout, no cleanup failure.
- Avoidable rework: 66 baseline units versus 0 plugin units across 60 non-clear cases.
- Mean final match: 2.96/4 baseline versus 3.89/4 plugin, a gain of 23.13 percentage points.
- Clear-task extra interruptions: median 0, p90 0.
- Clear paired median latency overhead: +1.97%.
- Blind preference: 41 plugin, 3 baseline, 36 ties.
- Proactive interventions: 29 helpful, 0 wrong or unhelpful.

Three of 40 automated grading batches timed out once and passed on their second attempt. The longest primary turn took 175,993 ms. Exact model identities were not recorded. The clear-latency paired-bootstrap 95% interval is -4.12% to +7.29%, so the interval crosses the +5% point-estimate gate.

The full, sanitized, hash-verified historical evidence is in `evidence/development-regression-v8` at the repository root. It is not a human-user study, independent efficacy estimate, or DeepSeek efficacy result.

The release remains conditional on final source, package, real-host, independent-review, cross-platform, exact-tag, public-install, and cleanup gates.
