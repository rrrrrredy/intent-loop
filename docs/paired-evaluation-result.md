# Paired 80-task evaluation result

Status: **NO RESULT — study not run**.

This is not a zero score, a failed efficacy result, or evidence of no value. It means the frozen 80-task instrument exists, but the required 80 baseline deliveries plus 80 matched plugin deliveries have not been performed and independently graded. Implementation tests and the single installed-host lifecycle cannot substitute for those outcomes.

## Frozen metric status

| Release metric | Threshold | Observed paired result | Gate status |
| --- | --- | --- | --- |
| Ambiguous/changing-task avoidable rework | reduction at least 25% | Not measured | Blocking |
| Final-match mean | increase at least 10 percentage points | Not measured | Blocking |
| Clear-task extra interruptions | median 0; P90 at most 1 | Not measured | Blocking |
| Clear-task elapsed-time overhead | at most 5% | Not measured | Blocking |
| Proactive intervention helpfulness | at least 70% | Not measured | Blocking |
| Wrong or unhelpful intervention | at most 15% | Not measured | Blocking |
| Exposed inference later denied | at most 10% | Not measured | Blocking |
| Complete raw prompts persisted by default | zero | Pass in implementation/installed-host checks; paired run not yet scanned | Still required in study |
| Export and deletion contracts | 100% | Pass in automated contract tests; installed task deletion E2E passed | Still required in study |

## What exists for a valid run

- `evals/tasks.jsonl`: frozen 80-task corpus and fixed SHA-256;
- `evals/annotation-guide.md`: correction attribution, final-match rubric, intervention labels, and adjudication;
- `evals/result.schema.json`: machine-readable per-run record contract;
- `docs/evaluation-protocol.md`: pairing, blinding, counterbalancing, exclusions, confidence intervals, and fixed thresholds;
- `evals/policy-regressions.jsonl`: 15 failure-oriented cases that must remain visible beside aggregate metrics.

## Why the release cannot be Go

The implementation evidence answers “does the bounded plugin work as specified on this host?” It does not answer “does it improve independent user deliveries enough to justify its interruption and persistence cost?” Only the paired study can answer the latter. Until complete results exist, every product-value threshold remains unknown and the release decision is **Iterate**.
