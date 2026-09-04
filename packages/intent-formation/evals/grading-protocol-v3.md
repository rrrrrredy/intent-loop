# Blind grading protocol v3

Status: freeze this protocol, the candidate, and the holdout before either arm runs. Record the exact corpus hash and generation method in `holdout-manifest.json`.

## User-visible requirement integrity

Every frozen final requirement must be an exact excerpt from the initial prompt or frozen follow-up. The runner, grader, analyzer, and evidence publisher reject a corpus that violates this rule before using it. Hidden evaluator fields may describe decision risk and unacceptable behavior, but may not introduce facts, requested items, quantities, or constraints that the user never supplied.

## First-cycle final match

- For a bounded question, comparison, or small sample, score the post-follow-up response.
- For a finished first response, score that first response. A trailing question does not convert delivery into elicitation.
- Clear tasks have no follow-up and are scored on the first response.

Later correction of a direct delivery remains visible to rework but cannot retroactively improve first-cycle final match.

## Avoidable rework and actions

Rework is first-response work made unnecessary, contradicted, or substantially replaced by the frozen follow-up. A bounded elicitation has no deliverable to discard. A proportionate requested comparison or sample is evidence. A disguised full delivery followed by a question remains work.

Blind input includes completed first-turn action-item types. Premature inspection, commands, or file changes count as work. The grader never receives command arguments, filesystem paths, or system labels.

## Proactive intervention

`helpful` and `wrong_or_unhelpful` apply only to an intent-formation move the user did not request. Requested samples or options are normal completion and grade `none`. A proactive move is helpful only when it exposes the frozen decision risk with less expected cost than guessing. It is wrong or unhelpful when the task was clear, the question is irrelevant, or it adds avoidable friction.

## Inference denial

An inference exists only when the first response commits work to an unstated preference, constraint, audience, or goal. Presenting an option is not an inference. The follow-up denies an inference only when it explicitly rejects or materially corrects that commitment.

## Experimental controls

- A/B assignment is deterministic from candidate commit, corpus hash, and scenario ID.
- Pair order alternates by corpus index; arms within one pair run sequentially.
- Both arms use the same explicit model, reasoning effort, timeout, verbatim user prompts, and isolated workspace policy.
- The primary timeout is 300,000 ms. A primary timeout is never replaced by a rerun.
- Candidate commit, generated plugin tree, installed cache tree, Git archive, dedicated Codex Home, and plugin inventory are fingerprinted.
- All non-target plugins and the State companion are disabled. The core is enabled only in the plugin arm.
- Clear latency uses the median within-pair percentage difference; arm medians are secondary.
- A retry may fill missing text for blind quality grading only and is disclosed.
- Numerical release gates are frozen before execution.
