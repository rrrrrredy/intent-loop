# Final confirmation: incomplete primary

Candidate: `3dd8ab2283e86ad99ccc70a296b11b575f1ff7ce`. **Not eligible for v0.3 release efficacy.**

All 160 planned conversations were attempted without primary retry. 159 were usable, giving 79/80 complete pairs. The original failures were not replaced; all 160 native tasks were deleted.

The frozen v4 blind grader evaluated only the 79 operationally complete pairs. Selection did not inspect answer quality. This is an available-pair diagnostic, not the required complete 80-pair confirmation. It cannot clear release gates, even if any subset metric passes.

The observed baseline timeout reached the unchanged five-minute limit after task start, without a substantive answer or an explicit provider-capacity error. The logs do not establish its underlying cause. The corresponding plugin attempt remains a separate actual result.

The completed calibration already exposed semantic grading errors. Raw grades are retained unchanged; synthetic ordinal rework is not human time saved or market demand. No replacement holdout, alternate model or v0.3 prerelease follows this final confirmation.

Files: `runs.jsonl` contains every primary response and failure; `failures.json` preserves full-primary reliability; `blind-grades.jsonl` retains every available-pair grade; `analysis.json` separates subset metrics from primary completeness; `manifest.json` binds frozen sources, provenance and artifacts. No response or grade text is length-truncated.
