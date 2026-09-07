# V7 incomplete primary study

Candidate: `16c4b199cda677b9cb19898096d1bcc161b7215c`. **Not eligible for release efficacy.**

All 160 planned conversations were attempted without primary retries. 155 were usable; four failed with an explicit provider-capacity error and one required follow-up timed out at the fixed five-minute limit. All 160 native tasks were deleted. No failure was replaced or scored as a success.

Only the 75 complete pairs were graded under the frozen blind-v3 contract. They were selected by operational completeness, never by answer quality. The model was gpt-5.6-sol: low reasoning for execution, medium for the blind judge. This diagnostic is neither the frozen 80-pair result nor a new holdout, and missing cases or provider load may bias it.

Within those available pairs only: non-clear rework reduction 72.73%; first-cycle final-match gain 19.67 points; clear paired median latency 1.68%; wrong proactive interventions 4.76%; inference denial 37.5%. These numbers do not clear publication gates.

Files: `runs.jsonl` retains every primary response, including empty/failed turns; `failures.json` contains the native error evidence; `blind-grades.jsonl` retains every available-pair grade; `analysis.json` separates the full primary reliability from subset calculations; `manifest.json` binds the candidate, corpus, instruments, and artifacts. No response or grade text is length-truncated.
