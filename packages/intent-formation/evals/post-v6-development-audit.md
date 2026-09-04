# Post-v6 development corpus audit

Status: corrected development data; never release evidence.

Candidate `598f83f` ran all 17 prompts through a real installed Codex Hook. Transcript review then found a labeling defect in the development corpus itself:

- Seven prompts requested bounded, cheap, reversible drafts. Their original `question` labels contradicted the frozen product rule that a cheap sample should expose preference before an interview. The prompts are unchanged; their labels now require direct delivery.
- The library-card prompt supplied no processing duration. Its original `sample` label rewarded fabrication. The prompt is unchanged; the corrected label requires a question only for that missing value.
- The other nine scenarios retain their original routing labels.

The run is diagnostic evidence against the 1,317-byte named-dimension policy: it asked unnecessary direction questions on six of the seven reversible drafts, on one explicitly bounded perfume sentence, and on one fully specified clear control. The policy was reduced to the general three-condition activation gate and a bounded-draft exit before any rerun.

Candidate `d10a920` reran the same prompt bytes after that reduction. All eight unnecessary questions disappeared, all comparison and feedback routes remained usable, no action was taken, and every task cleanup succeeded. The run still failed two explicit boundaries: the card-game tutorial invented unsupplied rules, and the library-card response marked its duration unspecified instead of asking only for the required value. Those failures motivated a narrower factual-boundary revision; they do not reopen the removed decision-dimension list.

Because the audit used observed candidate output to repair development labels, neither the original run nor a rerun on these prompts can serve as an independent holdout or efficacy claim.
