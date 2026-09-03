# Development ablation report

Status: **COMPLETE as development evidence; not release-efficacy evidence.** The sealed 80-scenario study remains the release gate.

## Question

Which policy and architecture elements are necessary for Intent Formation to interrupt only a materially divergent step, give the user a usable way to answer, and then get out of Codex's way?

## Method

- Tests used a real locally installed Codex Plugin and its `UserPromptSubmit` MCP Hook, not prompt text pasted into a task.
- Every trial used a fresh workspace and an isolated Codex Home. The runner saved the visible response and completed action-item types, then deleted the task.
- Component removals used `gpt-5.4-mini` at low reasoning. The model-boundary check repeated the same three ambiguous and three conflicting prompts on `gpt-5.6-sol` at low reasoning.
- Each row was one unretried conversation. Repeated prompts measure instruction-following variation; they are not independent product tasks.
- An earlier attempt injected the policy through `developer_instructions`. It did not reproduce Hook placement and is excluded from every result below.

The development prompts deliberately cover an ambiguous public launch page, an impossible public-announcement constraint set, a requested small sample followed by changed implementation details, and a clear translation control. They are not part of the sealed release holdout.

## Component removals

| Removal | Trials | Observed failure | Decision |
| --- | ---: | --- | --- |
| Semantic costly-divergence trigger | 1 ambiguous task | Codex immediately used five action items and wrote the page. | Retain the semantic trigger. |
| Neutral, flexible answer boundary | 3 ambiguous tasks | One response pushed numbered-only replies with “best if” framing, one was empty, and one offered choices without mix/reject/free permission. | Retain a short neutrality and flexible-answer invariant. |
| Stop asking after resolution | 1 conflict task | The follow-up was completed, but the first response was empty, so the ablation is not interpretable. | Retain because the product brief requires one low-burden intervention and this sample cannot justify removal. |
| Feedback classification | 1 sample-and-feedback task | The implementation change was handled correctly without the clause. | Inconclusive; retain because distinguishing implementation change from intent change is an explicit product requirement. |

## Design removals

The experiment removed the following shipped behavior and wording:

- lexical trigger lists and the memorized “professional website” example;
- a separate high-cost-without-known-branches rule;
- generated option lists for explicit conflicts, which repeatedly produced invented “balanced” or impossible choices;
- the required `label+effect` option structure, which added formatting pressure without preventing inline or invented alternatives; and
- duplicated instructions for numbers, defaults, recommendations, and free-form replies, consolidated into one invariant.

An explicit conflict now gets one free-form priority question with no generated options. Other alternatives may be proposed as neutral possibilities, but the policy says they are not a decision and requires a mix/reject/free-answer exit. The core remains one state-free Hook; State and DeepSeek support remain optional adapters. No GUI, planner, transcript parser, custom Harness, or independent chat client was added.

The interaction policy fell from 1,254 to 999 UTF-8 bytes, a 20.3% reduction. Size was not the acceptance criterion: a shorter 901-character variant was rejected after real Hook failures.

## Model boundary observed before freeze

On the same pre-freeze 968-character gate clause:

| Model | Ambiguous tasks stopped before action | Conflict tasks stopped before action | Flexible exit on stopped ambiguous tasks |
| --- | ---: | ---: | ---: |
| `gpt-5.4-mini`, low | 1 / 3 | 3 / 3 | 1 / 1 |
| `gpt-5.6-sol`, low | 3 / 3 | 3 / 3 | 3 / 3 |

The mini result is a real failure boundary, not a passing average. The release study therefore uses the reliable tested Codex model and records its exact setting. The final 999-byte candidate must still pass the candidate-bound real-host regression and sealed holdout; this development study cannot substitute for either gate.

## Freeze decision

Freeze the 999-byte policy for candidate validation. Any later policy change invalidates the sealed outcome run and requires a new independently authored holdout.
