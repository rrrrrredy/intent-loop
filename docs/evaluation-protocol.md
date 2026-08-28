# Gate 2: evaluation protocol

Status: frozen before source implementation on 2026-08-28. Product thresholds cannot be relaxed after seeing results; a changed threshold requires a new protocol version and a fresh run.

## Unit of evaluation

The unit is an independently reviewable task delivery, not a question, tool call, claim, or protocol event. Each of the 80 frozen scenarios is run once with ordinary Codex (baseline) and once with Codex plus Intent Loop (plugin) on cloned inputs. The two runs use the same Codex model, reasoning setting, permissions, tool availability, time limit, and acceptance rubric.

To limit carry-over, matched runs are assigned to different participants where possible. Otherwise, use equivalent A/B fixtures and counterbalance condition order. Workspace identifiers and outputs are blinded before outcome grading. The task owner supplies result feedback, but does not see telemetry-derived condition labels during scoring.

## Operational definition: avoidable rework

An **action unit** is a reviewable piece of substantive work: a file change, research branch, generated section, design variant, data transformation, build/configuration attempt, or comparable artifact-producing action. Waiting and ordinary reading are not action units.

An action unit is **avoidable rework** only when all are true:

1. it is later discarded or materially redone;
2. the cause is a mismatch with intent relevant to the decision that launched it;
3. that mismatch was already present or could reasonably have been surfaced at that decision point with one low-burden question, two or three comparisons, or an inexpensive sample;
4. the later work is not primarily caused by an execution error, tool error, new external information, or intent that genuinely formed or changed only after a valid result.

Annotators record both action-unit count and active minutes. The primary rework measure is adjudicated active minutes. The secondary measure is discarded/materially-redone action units. Idle time, model wait time, and unrelated exploration are excluded.

For the 60 ambiguous or changing scenarios, aggregate reduction is:

```text
1 - (sum plugin avoidable-rework minutes / sum baseline avoidable-rework minutes)
```

If the baseline aggregate is zero, efficacy is not measurable and the release gate fails rather than treating the result as improvement.

## Failure attribution

Each material correction gets one primary label and optional secondary labels:

- `execution_error`: the current intent was sufficiently understood, but the agent implemented or delivered it incorrectly.
- `tool_error`: a tool, dependency, permission, environment, network, or host capability failed independently of intent interpretation.
- `intent_misunderstanding`: the agent followed a materially different interpretation even though the divergence was present and reasonably surfacable at the decision point.
- `intent_change`: the user formed or changed a preference after a valid comparison/result or because genuinely new information arrived; prior valid work is not avoidable rework.
- `no_material_error`: no correction materially affected acceptance.

Priority for a single primary label is causal, not convenient: tool/environment failure, then execution against understood intent, then pre-existing intent misunderstanding, then later intent formation/change. Disagreements are adjudicated by a second reviewer using the frozen event timeline. The plugin's own label is never ground truth.

## Metrics

| Metric | Definition |
| --- | --- |
| Avoidable rework | Primary: adjudicated active minutes; secondary: action units. Report aggregate and every intent stratum. |
| Final match | Blind 0-100 rubric: outcome 35, success/failure signals 25, constraints 20, tradeoff handling 10, unresolved-issue honesty 10. |
| Interruption count | Plugin-originated turns that require user attention before work can proceed. Codex safety/permission prompts and task-owner feedback requested by the protocol are excluded. |
| Helpful intervention | User rates it helpful, or blind trace review shows it prevented a divergent high-cost action without adding a comparable burden. |
| Wrong/unhelpful intervention | It asks what was already clear, frames false choices, promotes an untrusted signal, changes settled intent, or costs more than the divergence it could prevent. |
| Denied inference | An active agent-inferred claim later explicitly rejected by the user. Denominator is inferred claims that were exposed to a genuine opportunity for confirmation or correction. |
| Elapsed time | Wall-clock task time excluding approval queues and infrastructure outages. Clear-task overhead uses paired median ratio. |
| Privacy | At-rest scan for complete raw prompts, seeded secrets, and cross-project records in default mode. |
| Export/delete | Contract cases in which the exported graph round-trips and deletion removes the target from views, indexes, exports, and persistent bytes. |

Intervention usefulness is rated immediately on `helpful`, `neutral`, `unhelpful`, or `wrong/harmful`, with a short reason. The published helpfulness numerator includes only `helpful`; the error numerator includes `unhelpful` and `wrong/harmful`. `neutral` remains visible and cannot be silently discarded.

## Frozen corpus

`evals/tasks.jsonl` contains 80 scenarios:

- 15 `known_underspecified`;
- 15 `unformed`;
- 15 `goal_conflict`;
- 15 `result_formed`;
- 20 `clear_control`.

Each record includes the user-visible prompt, hidden evaluator context or a result-formation rule, the high-cost decision point, expected intervention class, acceptance signals, and a named fixture. The fixture is synthetic and contains no real user data. Corpus structure and identifiers are validated in CI; content changes require a new corpus version.

Frozen corpus SHA-256: `6796B9E40A5C0D6259CEF454A69AFFC767A0BD34C0E88153EF109FA2D2DB4F52`.

## Release thresholds

All must pass simultaneously before another-agent adaptation:

- ambiguous/changing-task avoidable rework falls at least 25%;
- final-match mean rises by at least 10 percentage points;
- clear-task added interruptions have median 0 and P90 at most 1;
- clear-task paired median elapsed-time overhead is at most 5%;
- proactive intervention helpfulness is at least 70%;
- wrong or unhelpful intervention rate is at most 15%;
- inferred claims later explicitly denied are at most 10%;
- default persistence contains zero complete raw prompts;
- export and deletion contract pass rate is 100%.

Report bootstrap 95% confidence intervals for rework and final-match deltas, but do not replace the fixed point thresholds with significance tests. Report every task, exclusion, timeout, neutral intervention, and disagreement. Missing plugin runs count as failures unless an independently confirmed infrastructure outage affected both arms.

## Exit rules

Stop expansion and report when any frozen product exit condition holds, including rework improvement below 25%, clear-task median added interventions above 1, dependence on private transcripts or a client, inability to distinguish execution error from intent change, or a core that must take over planning/execution.

A failed metric is diagnosed as intervention timing, data model, host limitation, or product value. It is not repaired by adding forms, more mandatory questions, or forced workflow steps.

## Gate decision

Gate 2 result: **PASS FOR IMPLEMENTATION**. Value can be measured from paired deliverables, traceable user corrections, rework, latency, and privacy outcomes. No efficacy result exists yet; the frozen corpus is an instrument, not proof that the product works.
