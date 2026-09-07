# Sealed Holdout V6 Authorship and Root Validation Method

## Independence and scope

This corpus was written from scratch inside the designated target directory, using only the evaluation specification supplied to the independent author. During authorship, the author did not list, open, search, or inspect any repository, Git history, product policy, generated plugin, prior holdout, development corpus, prior staging directory, experiment output, conversation history, memory file, or internet source. The author did not run Codex, any model, either evaluation arm, or a grader.

## Construction procedure

The author first allocated the required identifiers, languages, class totals, feedback labels, and 80 distinct domain slugs. Each scenario was then written independently around a concrete, offline-safe task that can be handled in an empty workspace without accounts, network access, or real personal data. Non-clear cases freeze both the consequential decision and the resolving or reacting follow-up before any evaluation arm is run. Preference-after-result first turns ask for exactly one tiny inline sample and no project work.

The corpus contains exactly 80 scenarios: 15 `poorly_expressed`, 15 `unformed`, 15 `conflict`, 15 `preference_after_result`, and 20 `clear`. It contains 60 English and 20 Simplified Chinese scenarios. Every class has four `zh-CN` scenarios; the four 15-case classes each have eleven `en` scenarios, and `clear` has sixteen. Preference feedback labels are frozen at six `keep`, four `implementation_change`, four `intent_change`, and one `uncertain`.

## Mechanical validation

In the isolated authoring directory, `validate-holdout-v6.mjs` checks the exact four-file directory surface; UTF-8 decoding without BOM; LF-only endings and a final LF; JSONL parsing; exact property order, presence, and omission by class; identifier sequences; allowed class, language, and first-move values; nonempty strings and arrays; unique lowercase ASCII kebab-case domains; all required class, language, and feedback-label distributions; and the declared zero arm-run count.

For internal overlap, scenario text is concatenated from `initial_prompt`, `final_requirements`, `unacceptable_first`, and, when present, `decision_at_risk` and `follow_up`. It is normalized with Unicode NFKC, lowercased, and whitespace-collapsed. Token sets contain individual Han characters plus contiguous non-Han Unicode letter/number tokens. Character similarity uses sets of distinct Unicode-character four-grams. Validation rejects any internal pair with token-set Jaccard similarity at or above 0.65 or character four-gram Dice similarity at or above 0.72, and reports the observed maxima, SHA-256 hashes, byte sizes, counts, and zero arm runs.

Cross-corpus overlap is intentionally not checked by this author. It is left to the root evaluator after the authored corpus is sealed.

## Canonicalization and root validation

The author sealed `holdout-80-v6.jsonl` at SHA-256 `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897` and 69,746 bytes. The root evaluator copied those bytes unchanged to `packages/intent-formation/evals/holdout-80.jsonl` without opening the scenario text. The used v5 corpus remains byte-identical under `evals/retired/holdout-80-v5.jsonl` and cannot be reused as release evidence.

Before either v6 arm ran, the root evaluator mechanically compared full normalized scenario text with v6 itself, v5, every tracked development corpus, two frozen ablation corpora, and the earlier v3, v4, and v5 holdouts recovered from Git. The maximum token-set Jaccard was `0.45614035087719296`; the maximum character four-gram Dice was `0.5330882352941176`. Both are below the predeclared rejection thresholds, with zero violations. Only aggregate counts, hashes, scores, and pair identifiers were inspected.

The candidate Git commit binds the canonical corpus, this method, the root validation result, the product policy, and the generated plugin tree before any v6 arm or grader run.
