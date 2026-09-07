# Blind user acceptance holdout, version 7

This file describes authoring and internal validation only. No product evaluation has taken place.

## Scope and independence

The author used only the holdout assignment and the coordinator's clarification about manifest self-hashing. No product implementation, repository, Git history, prior corpus, experiment output, task history, memory file, account configuration, or web source was opened. All situations, names, quantities, and example records are synthetic. The four deliverables are self-contained and require no source files, network, accounts, or external execution to answer the user scenarios.

There were zero arm runs, zero grader runs, and zero model evaluation runs before sealing. Internal validation runs are mechanical checks of these authored files, not product or response evaluations. The authoring assistant itself is not counted as a model evaluation run.

All artifact reads and writes were confined to the assigned acceptance directory. The sandbox failed before executing commands with an apply-deny-read-ACL error, and direct sandboxed patch writes were denied. Only necessary directory creation, patch, runtime discovery, and validation commands were run with escalation. The Windows batch wrapper truncated multiline patches, so the installed Codex executable's same apply_patch engine was invoked directly. Command discovery exposed executable locations, and the PowerShell version was checked; no executable source or configuration was inspected. No material was sent to an external service.

## Scenario construction

There are 80 cases: 15 poorly expressed requests, 15 unformed directions, 15 conflicts, 15 preferences formed after a sample, and 20 clear requests. Each class contains four Chinese cases; the remaining cases are English. Each case has its own domain, so there are 80 domain labels and no label is repeated.

Poorly expressed cases present competing meanings that would materially change a rule, calculation, or allocation. Their frozen follow-up resolves one focused question. The ambiguity must concern the intended outcome; missing files, data access, or permissions are not used as substitutes for unclear intent.

Unformed cases leave the option space open and support a neutral comparison of two or three concrete directions. Conflict cases contain incompatible stated priorities, and the frozen follow-up chooses which priority governs. A quiet compromise that contradicts one stated goal is not counted as resolving a conflict.

Preference cases explicitly request a small disposable inline sample before frozen feedback. Their labels distinguish six acceptances, four execution changes that preserve the purpose, four changes of purpose, and one unresolved preference. Feedback refers to a direction or supplied requirement, not an assumed model-generated phrase. A dislike of wording or a different field arrangement does not by itself constitute an intent change.

Clear cases are inexpensive, reversible, specified requests, including serious uses and style language that do not justify an intent interview. The silent label means doing the requested work directly; it does not mean returning no answer.

Every final requirement is a contiguous, verbatim excerpt from that case's initial prompt or frozen follow-up. Requirements are excerpts of obligations, not expected answer strings to copy literally. A condition such as multiplying a value is judged by the requested operation, not by whether the response repeats that instruction. Evaluators must not turn explanatory decision-risk or unacceptable-first notes into additional delivery requirements. Those notes identify a harmful first move rather than a prohibition on harmless reversible work. Visible prompts govern how much new factual content may be introduced; there is no hidden universal restriction to supplied facts.

## Internal validation

Run node validate-holdout-v7.mjs in this directory. The validator reads only the four named deliverables in its own directory. It checks exact field order, allowed classes, IDs, language tags, class and language distributions, domain spelling and multiplicity, nonempty values, UTF-8 without BOM, LF-only lines, terminal LF, exact verbatim final-requirement provenance, and preference-feedback counts. It also checks that scenario text contains no URL or absolute machine path and that frozen follow-ups meet their minimum lengths.

For each case, the validator concatenates initial_prompt, final_requirements, unacceptable_first, decision_at_risk, and follow_up in that order, using single spaces and omitting absent fields. It applies Unicode NFKC normalization, lowercasing, whitespace collapse, and trim. Tokens are individual Han characters or runs of non-Han Unicode letters and numbers. Token-set Jaccard is computed for every distinct pair.

Character 4-grams are four consecutive Unicode code points, including spaces and punctuation after normalization. Set-based 4-gram Dice is the primary measure. Multiset Dice is also computed to make the treatment of repeated grams explicit, and both variants must pass the same threshold. Every one of the 3,160 pairs must remain strictly below Jaccard 0.65 and Dice 0.72. The manifest records the observed maximum and its pair for each measure. No comparison with an external corpus is performed.

Mechanical validation cannot establish every semantic judgment. Before sealing, the author additionally reviewed whether one question changes the next decision, whether options represent distinct purposes, whether a conflict can be satisfied without prioritization, and whether sample feedback changes the purpose or only the execution. This review strengthened one machine-counter ambiguity and corrected a requirement excerpt. No claim about future product performance follows from passing these checks.

## Sealing

The validator's --prepare-manifest mode first validates the corpus and prints the proposed manifest to stdout without writing files. The proposed manifest is then added with apply_patch. The default validator mode checks that the manifest exactly matches the current statistics and file hashes.

The manifest records ordinary SHA-256 digests and actual byte lengths for the corpus, this method, and the validator. Per the coordinator's clarification, it does not embed its own hash. The final seal report separately gives the ordinary byte SHA-256 and byte length of all four files, including the manifest. This avoids a self-referential hash definition.

The corpus will not be rewritten after sealing during subsequent product use. No product, arm, grader, or model evaluation is started by the validator. The sealed files provide independent test inputs and internal validation evidence, not a claim that any product has passed user acceptance.
