# Blind grading protocol v2

Status: frozen with the candidate-bound holdout before either arm ran. The exact corpus hash and generation method are in `holdout-manifest.json`.

## First-cycle final match

- If the first response is primarily one bounded question, a comparison, or a small sample, score the post-follow-up response. Those response types are decision evidence whether or not they end with an invitation.
- If the first response primarily delivers a finished answer, score the first response. A trailing question does not convert a finished delivery into an elicitation turn.
- Clear tasks have no follow-up and are scored on the first response.

The grader records `match_basis` for every arm. Later correction of a direct delivery remains visible to the rework score but cannot retroactively improve first-cycle final match.

## Avoidable rework and actions

Rework measures first-response work that the frozen response makes unnecessary, contradicted, or substantially replaceable. A bounded question has no deliverable to discard. A proportionate comparison or sample is evidence, not rework. A disguised full delivery followed by a question remains deliverable work.

The blind input also lists completed first-turn action-item types. Premature inspection, commands, or file changes count as work even when the final prose does not mention them. The grader never receives command arguments, filesystem paths, or system labels.

## Proactive intervention

`helpful` and `wrong_or_unhelpful` apply only when the assistant adds an intent-formation move that the user did not request. Supplying requested samples or options is normal completion and is graded `none`. A proactive move is helpful only when it exposes the frozen decision risk with less expected cost than guessing. It is wrong or unhelpful when the task was clear, the question is irrelevant, or the move adds avoidable friction.

The unformed and preference-after-result classes explicitly request their comparison or sample move. Their expected move cannot be marked helpful proactive intervention.

## Inference denial

An inference exists only when the assistant commits work to an unstated preference, constraint, audience, or goal. Presenting a possible direction as one option is not an inference. The frozen response denies an inference only when it explicitly rejects or materially corrects that committed assumption. With no committed inference and no violation, the aggregate denial rate is zero; that does not estimate performance on an inference opportunity.

## Experimental controls

- A/B assignment is deterministic from the candidate commit, corpus hash, and scenario ID.
- Pair order alternates by corpus index; arms within one pair run sequentially.
- Both arms use the same explicit Codex model, reasoning effort, timeout, verbatim user prompts, and isolated workspace policy.
- The candidate commit, full generated plugin tree, Git archive, dedicated Codex Home, and plugin inventory are fingerprinted.
- All non-target plugins and the State companion are disabled. The core is enabled only in the plugin arm.
- Clear latency uses the median within-pair percentage difference; arm medians are secondary diagnostics.
- Primary runs remain the source for timing and reliability. A retry may fill a missing text pair for blind quality grading only and is disclosed.
- The numerical release gates are fixed before execution.
