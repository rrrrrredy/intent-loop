# Sealed Holdout V5 Authoring Method

## Independence

I authored holdout-80-v5.jsonl from the evaluation contract alone in a brand-new staging directory. I did not open, search, list, or inspect any repository, Git history, product policy, previous holdout, development corpus, prior staging directory, experiment output, conversation history, memory, or internet source, and I did not run either evaluation arm.

The corpus was written from scratch. Scenario domains, prompts, branch decisions, follow-ups, grading requirements, and concrete failure conditions were created without adapting old material.

## Authoring procedure

I allocated the cases before drafting: 15 poorly_expressed, 15 unformed, 15 conflict, 15 preference_after_result, and 20 clear. Each 15-case class contains 11 English and 4 Chinese cases; clear contains 16 English and 4 Chinese cases. I assigned a distinct domain to every case, then wrote the scenario fields in the mandated order.

Poorly expressed cases isolate one consequential unresolved outcome or tradeoff. Unformed cases request neutral concrete directions before selection. Conflict cases contain requirements that genuinely cannot coexist. Preference-after-result cases request exactly one tiny inline sample and carry the prescribed feedback labels. Clear controls are directly answerable or lack only an ordinary required input.

Each non-clear follow-up resolves or reacts to the branch and requests delivery. Final requirements are written so a grader can assess the response after that follow-up. Unacceptable-first lists identify case-specific failures rather than generic policy language.

Before any arm run, all domain identifiers were mechanically normalized to unique lowercase ASCII kebab-case slugs. Scenario text and every non-domain scenario field remained unchanged.

## Mechanical checks

The local validator checks:

- exactly 80 nonblank JSONL records with unique class-specific v5 IDs;
- exact class, expected-move, language, per-class Chinese, and feedback-label distributions;
- exact property order and allowed or forbidden fields for every class;
- nonempty required strings and concrete nonempty array entries;
- at least 40 domains and no domain used more than twice;
- UTF-8 without BOM, LF-only endings, and a final LF;
- pairwise normalized token-set Jaccard below 0.65;
- pairwise normalized character four-gram Dice below 0.72.

For similarity, scenario text concatenates initial_prompt, final_requirements, unacceptable_first, decision_at_risk when present, and follow_up when present. Text is normalized with Unicode NFKC, lowercasing, and collapsed whitespace. Token sets use individual Han characters plus contiguous non-Han Unicode letter or number tokens. Character four-gram Dice uses distinct four-gram sets from normalized scenario text.

Hashes and byte sizes are computed only after every validation check succeeds.

## Seal boundary

Arm runs before seal were zero. Cross-corpus overlap checking is intentionally left to the root evaluator after seal so no old material is exposed to this author. This method makes no claim that cross-corpus validation was performed here.
