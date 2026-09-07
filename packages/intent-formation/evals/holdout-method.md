# Sealed Holdout V7 Authorship and Root Validation

The independent author's four original files are preserved byte-for-byte under `evals/seals/v7`. The author saw the evaluation specification only, not the product, old corpora, policy, experiment output, task history, memory, or web sources. The authoring assistant did not run the product, either arm, a model evaluation, or a grader before sealing. See the preserved author method and manifest for the complete procedure and original hashes.

## Corpus and visible requirements

There are 80 synthetic, offline-answerable cases across 80 domains: 15 poorly expressed, 15 unformed, 15 conflict, 15 preference-after-result, and 20 clear. Each class contains four Chinese cases, giving 60 English and 20 Chinese cases. Feedback labels are six keep, four implementation changes, four intent changes, and one uncertain.

Every final requirement must occur verbatim in the initial prompt or frozen follow-up. Evaluator notes cannot introduce extra facts, a universal facts-only restriction, or a prohibition on harmless reversible work. The final-delivery contract is checked before execution, grading, analysis, and publication.

## Mechanical canonicalization

The author represented `unacceptable_first` as one string. The existing evaluator consumes an array. The root wrapped that field in a one-element array in the canonical JSONL; no other field value changed. In particular, all initial prompts, follow-ups, and final requirements remain identical. The original seal is not rewritten. Tests compare every canonical object to the corresponding original object with exactly this one structural transformation.

The manifest separately records the original author hash and the canonical corpus hash. This conversion and all validation occur before any v7 model, arm, or grader run. The root has inspected only schema checks, hashes, counts, overlap scores, and pair identifiers, not the new prompt text. V6 corpus, manifest, method, and overlap-validator bytes remain under `evals/retired` and cannot support a new release claim.

## Cross-corpus validation

`node evals/validate-holdout-overlap.mjs` compares all normalized scenario text internally and against retired v6/v5, earlier Git holdouts, every tracked development corpus including post-v6 and the seven costly-branch cases, and both preserved ablation corpora. It rejects token-set Jaccard at or above 0.65 or set-based character-four-gram Dice at or above 0.72.

Normalization is NFKC, lowercase, collapsed whitespace, and trim. Tokens are individual Han code points or runs of non-Han Unicode letters and numbers. Four-grams are Unicode code points including normalized spaces and punctuation. For v7 the portable code makes the Han boundary and code-point treatment explicit; the unmodified v6 implementation remains archived with its original results. The root checks that its internal maxima reproduce the independent author's primary set-based maxima before accepting cross-corpus results.

The canonical manifest binds the source sets, validator, method, original seal, and canonical corpus. Validation is local and mechanical: it does not send any prompt or model output to a provider. A clean candidate commit and exact installed plugin tree must still be bound before the paired model evaluation. No v7 efficacy result exists until that evaluation and blind grading finish.
