# Intent Formation v8 development regression

This directory preserves the complete sanitized outputs, blind grades, aggregate analysis, and source fingerprints from a 160-conversation development run. The policy was iterated against this 80-scenario corpus, so the result is useful for regression and audit only. It is **not** independent release-efficacy evidence and does not authorize publication.

The predeclared measured gates passed: avoidable rework fell from 66 to 0 units across 60 non-clear scenarios; mean final match rose from 2.96/4 to 3.89/4; clear-task median paired latency overhead was 1.97%; and clear-task extra interruptions were 0 at both median and p90.

Blind preference was plugin 41, baseline 3, tie 36. Three of 40 grading batches timed out once and passed on the second attempt. Product outputs were never replaced by retries. The longest primary turn was 175993 ms (plugin, conflict-06, second).

Read `manifest.json` before interpreting the result. In addition to tuning contamination, the run used synthetic scenarios, one Windows execution host, unrecorded exact model identities, and automated model grading. A separate candidate-bound holdout is required for any release claim.

Files:

- `manifest.json`: design, hashes, retries, environment, and limitations.
- `analysis.json`: gates, class breakdown, and post-study uncertainty statistics.
- `runs.jsonl`: all 160 responses and timing records with task thread IDs removed.
- `blind-grades.jsonl`: all 80 unblinded rubric results.
