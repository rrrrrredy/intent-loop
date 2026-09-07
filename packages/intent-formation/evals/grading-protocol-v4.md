# Blind grading protocol v4

Status: bounded calibration completed on six existing case pairs with two grader requests; known semantic errors remain. This is not an autonomous release judge or efficacy evidence. V7's original v3 grades remain unchanged. Numerical release gates and first-cycle response selection are unchanged.

## User-visible requirements and time

Every final requirement must be an exact excerpt within one user-visible turn. Excerpts cannot span two turns. Blind input records where each excerpt first appeared; this is provenance, not an automatic semantic classification.

For future sealed studies, put requested deliverables, format, counts, example numbers and factual premises in the initial prompt. The frozen follow-up should resolve an already-visible direction ambiguity. Do not introduce a new deliverable and penalize an earlier answer for failing to anticipate it. Make the requested delivery surface explicit when an operational verb could mean either writing a rule or applying it to a real system.

Independent review must still check this distinction; exact-excerpt validation alone cannot establish that a later phrase is clarification rather than a new requirement.

## First-cycle match and rework

- A bounded question, comparison or sample uses the post-follow-up response.
- A finished first response uses that first response. A trailing question does not turn delivery into elicitation.
- Clear tasks have no follow-up and use their first response.
- When scoring a first response, use the initial delivery contract. A follow-up may reveal which already-visible direction was intended, but genuinely new facts, formats, counts, example numbers or requested items cannot be charged against an earlier answer.
- Score a post-follow-up response against the complete visible contract. Never give a direct first delivery retroactive credit for its later correction.
- Avoidable rework is earlier committed work made unnecessary or contradicted by the resolved direction. Merely adding newly requested material is not avoidable rework.

## Intervention and inference

Requested options and samples are normal completion. A proactive move is helpful only when it exposes a consequential unresolved choice with less expected cost than guessing; clear or cheap reversible work should proceed directly. Premature first-turn commands, inspection and file changes retain their raw action count. Read-only inspection is not a claim of external mutation.

An inference is a first-turn commitment to an unstated preference, constraint, audience or goal. Presenting an option is not a commitment. A denial requires an explicit rejection or material correction of that commitment; additional specificity or potentially synonymous wording alone is insufficient. The rationale must identify the incompatible commitment, not just a difference in phrasing.

Before the final confirmation, specification review found six `unformed` cases that
do not explicitly request an intent-formation move. An optional per-case boolean
`intent_move_explicitly_requested` corrects that input metadata; absent values retain
the historical class default. This does not change the v4 prompt, schema, scoring
definitions or the already published six calibration inputs. The six false overrides
are recorded in the independent author's repair log and frozen before execution.

## Experimental controls

The [bounded calibration](../../../evidence/grader-calibration-v4-20260907/report.md)
retains a material target/entity misreading, uncertain inference-denial severity and
overstated wording about a failed inspection attempt. Do not tune or overwrite those
raw grades. The final confirmation uses the frozen grader as an inspectable estimate,
not numeric ground truth. Even if its raw numerical gates pass, the existing
independent-review gate must resolve release-affecting semantic judgments. Unresolved
disagreement blocks release; manual rescoring cannot be used to manufacture a pass.

Freeze candidate, corpus, this protocol and grader before execution. Bind the complete installed plugin tree, use identical explicit model/reasoning/timeout settings in both arms, alternate AB/BA and execute arms sequentially within each pair. Disable all non-target plugins and State. Keep the 300,000 ms primary timeout and no primary replacement; retries can supply missing diagnostic text only and must remain disclosed. Use median within-pair clear latency. The JSON output schema remains v3 because its structure did not change; the rubric and deterministic blind-assignment namespace are v4. Historical analysis accepts its original v3 grades, while new release publication requires v4.
