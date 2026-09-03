# Sealed Holdout v4 Authoring Method

## Independence

I received only the schema and class definitions in the task contract. I did not open or search any repository, Git history, product policy, prior corpus, prior staging directory, evaluation result, or conversation history. I did not run either product arm; arm runs before sealing were zero.

## Authoring

The corpus was authored from scratch for this seal. Each scenario uses the required common fields, and only non-clear scenarios include `decision_at_risk` and `follow_up`. Only `preference_after_result` scenarios include `feedback_label`. Prompts were written as natural, self-contained requests that are safe in an empty workspace and require no network, account, secret, private data, deletion, money, public posting, or external side effect.

## Mechanical validation

Validation parsed every JSONL line independently, rejected blank lines, required exactly 80 unique IDs, checked the exact class and language allocations, checked required and forbidden fields by class, checked nonempty arrays and nonempty non-clear decision fields, checked allowed `expected_first_move` values against class, and checked the exact feedback-label distribution. It also counted distinct domains and enforced no more than two cases per domain; scanned the text for the prohibited development topics; verified UTF-8 without BOM and LF-only line endings; and computed pairwise similarity across normalized scenario text using token-set Jaccard and character four-gram Dice. The acceptance thresholds were 0.65 and 0.72 respectively. SHA-256 hashes and byte sizes were computed over the exact final bytes after all validation.
