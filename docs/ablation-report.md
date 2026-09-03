# Development ablation report

Status: **POST-FAILURE ABLATION COMPLETE AS DEVELOPMENT EVIDENCE.** The first sealed 80-scenario study returned `ITERATE`; a newly authored, unseen holdout is required before release.

## Question

Which policy and architecture elements are necessary for Intent Formation to interrupt only a materially divergent step, provide the smallest useful evidence, and then get out of Codex's way?

## Method

- Tests used a real locally installed Codex Plugin and its `UserPromptSubmit` MCP Hook, not policy text pasted into a task.
- Every trial used a fresh workspace and isolated Codex Home. The runner saved the visible response and completed action-item types, then deleted the task.
- Component-removal trials used unretried conversations. Repeated prompts measure instruction-following variation; they are not independent product tasks.
- The first formal study froze candidate `bae8e03` before running 80 unseen scenarios in baseline and plugin arms. All 160 conversations completed and were graded blind.
- Post-failure regression prompts were written from failure classes, not copied from holdout prompts. They cannot authorize release.

## First formal holdout result

The candidate passed rework, final-match, clear-task interruption, latency, inference-denial, and raw-prompt persistence gates. It failed the intervention-quality and premature-action gates:

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 90% | at least 25% | Pass |
| Final-match change | +12.19 percentage points | at least +10 points | Pass |
| Helpful proactive interventions | 50.85% (30 / 59) | at least 70% | **Fail** |
| Wrong or unhelpful proactive interventions | 49.15% (29 / 59) | at most 15% | **Fail** |
| Premature actions on non-clear tasks | 15 | 0 | **Fail** |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | -19.7% | increase at most 5% | Pass |
| Explicitly denied inferences | 0 | at most 10% | Pass |
| Full raw prompts persisted | 0 | 0 | Pass |

Class-level inspection located the failures instead of averaging them away. All 15 `unformed` cases were wrong because the generic question-only rule displaced requested comparisons and the model sometimes chose after being told to stay neutral. Ten of 15 `preference_after_result` interventions were wrong because a request for one tiny sample became an abstract question or several alternatives. All 15 premature actions came from five sample tasks where inline evidence was mistaken for project execution. Three clear controls added format or delivery questions when only ordinary input was missing.

## What the failure removed

The post-failure edit removed or narrowed these abstractions:

- the global “question only” override, replacing it with direct routing for an explicitly requested comparison or sample;
- the generic “two or three alternatives” expansion when the user requested exactly one sample;
- any recommendation or selection after the user asks for neutral comparison, including after priorities are supplied;
- format or delivery questions when the only blocker is a missing file, value, or access; and
- shared option-generation behavior for impossible requirements. A conflict now names both incompatible requirements and asks only which one wins.

The experiment retained only behavior with observed or product-required value:

- a semantic costly-divergence trigger before materially different expensive outcomes;
- a neutral mix/reject/free-description exit when the user does not know the available directions;
- one tiny inline sample, with no tools, commands, or files, when preference needs evidence;
- explicit separation of implementation change, intent change, keep, and uncertainty; and
- the state-free core. State continuity and DeepSeek compatibility remain optional adapters.

No GUI, planner, transcript parser, custom Harness, intake form, or independent chat client was added. Earlier ablation had already removed lexical trigger lists, a memorized website example, conflict-generated “balanced” options, mandatory `label + effect` scaffolding, and duplicated reply-format instructions.

## Post-failure real-host regression

The revised policy is 1,098 UTF-8 bytes, 12.4% below the original 1,254-byte policy. It is 99 bytes longer than the failed formal candidate because those bytes isolate explicit evidence requests and conflict handling; byte count is descriptive, not the acceptance criterion.

Eight new development cases ran through the installed Hook on `gpt-5.6-sol` at low reasoning:

- 8 / 8 completed and passed their semantic assertions;
- 0 first-turn action items and 0 first-turn MCP calls;
- 8 / 8 task cleanups succeeded;
- an explicit comparison was answered directly and neutrally;
- a request for one sample returned one short inline sample;
- neutral ownership remained with the user after priorities were supplied;
- uncertain feedback produced concrete micro-variants; and
- the adjacent-boundary conflict response named the contradiction and asked which requirement wins, without options or work.

These are targeted development regressions. They show that the diagnosed failure mechanisms were removed on the tested host; they do not estimate product efficacy.

## Freeze decision

Retire the first holdout from release-gate use because its result informed the policy. Freeze the revised policy only after a different independent author seals a new 80-scenario corpus without access to product policy, old holdout prompts, or development prompt text. Any later policy change invalidates that outcome run and requires another unseen holdout.
