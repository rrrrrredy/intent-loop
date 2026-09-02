# Candidate-bound holdout protocol

## Question

Does the frozen Intent Formation policy reduce avoidable first-cycle rework and improve final intent match on non-clear tasks without adding friction to clear tasks or acting before the consequential choice is formed?

## Separation from development

The earlier 80-scenario v8 corpus was used during policy iteration. Its outputs remain available as development regression evidence and are excluded from the release decision.

For the release holdout:

- an adversarial reviewer authors 80 new scenarios outside the repository;
- the product policy is frozen before the main engineer inspects the scenario contents;
- the corpus, method note, and SHA-256 manifest are committed with the candidate;
- any policy change after seeing holdout results invalidates that holdout for release efficacy; and
- a failed holdout becomes development evidence and requires a newly authored holdout after the next candidate freeze.

## Corpus

The committed `packages/intent-formation/evals/holdout-manifest.json` binds the exact corpus and method note. Composition is predeclared:

- 15 poorly expressed requests;
- 15 requests where the user lacks an option model;
- 15 requests with conflicting goals;
- 15 cases where preference becomes visible after a result; and
- 20 clear controls where the correct behavior is direct completion.

Every non-clear scenario has a response frozen before either arm runs. Prompts are natural user messages that can run safely in an empty workspace without accounts or network access.

## Candidate and execution binding

The runner refuses to start unless all of the following match:

- one clean full Git candidate commit;
- the complete generated `plugins/intent-formation` tree fingerprint;
- a deterministic Git archive fingerprint of that plugin tree;
- the exact installed local plugin path;
- a dedicated Codex Home marker and plugin inventory; and
- an explicit Codex model and reasoning effort.

Each arm gets a separate empty workspace. The initial request and frozen follow-up are sent verbatim, with no evaluation wrapper. User configuration and project rules are ignored. All non-target plugins are disabled. The State companion is disabled in both arms. Model tools run with `workspace-write`, no approval escalation, and no network requirement. The only dangerous automation flag is the Hook-trust bypass, used after the exact package has been inspected and fingerprinted.

The baseline disables the core plugin. The plugin arm enables only `intent-formation@intent-loop`. Pair order alternates AB/BA, and the two arms of one scenario run sequentially.

## Blind grading

The grader receives randomized A/B conversations, frozen requirements, decision risk, and completed first-turn action-item types. It does not receive the system label. It records first move, interruption count, proactive intervention, avoidable rework from 0 to 3, first-cycle final match from 0 to 4, inference handling, result-feedback handling, preference, and confidence.

A direct first delivery cannot receive retroactive final-match credit from its later correction. A bounded question, comparison, or sample is scored after the frozen response because that exchange is the first completed intent-formation cycle.

## Predeclared gates

| Gate | Required |
| --- | ---: |
| Avoidable rework across 60 non-clear cases | At least 25% reduction |
| Mean final-match gain | At least +10 percentage points on the 0-4 scale |
| Clear extra interruptions, median | 0 |
| Clear extra interruptions, p90 | At most 1 |
| Clear paired median latency overhead | At most 5% |
| Helpful proactive interventions | At least 70% of proactive interventions |
| Wrong or unhelpful proactive interventions | At most 15% |
| Later denial of a committed inference | At most 10% of cases where an inference was committed |
| Plugin tool/action items before a non-clear first response | 0 |
| Exact complete holdout prompt in default state | 0 |

When both inference opportunities and violations are zero, the denial rate is defined as zero. This means no denial was observed; it does not estimate conditional performance where an inference exists.

## Publication boundary

All primary conversations must be usable; a primary retry cannot replace timing or reliability. Grader batches may retry once after timeout or schema failure and every attempt is disclosed.

The public evidence includes sanitized complete responses, action types, blind grades, source and artifact hashes, candidate/tree/archive fingerprints, model settings, CLI version, plugin inventory, retry history, gates, and bootstrap intervals. Machine paths, common credential patterns, and control characters are replaced and counted; response text is not length-truncated. Automated grading and a synthetic holdout support only a bounded beta claim. DeepSeek efficacy requires separate evidence.
