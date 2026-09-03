# Candidate-bound holdout result

Status: **PENDING**. No release-efficacy claim is active until a newly authored sealed holdout has run verbatim against a clean candidate commit and the resulting public bundle passes independent verification.

The earlier v8 run is retained only as a [development regression](../evidence/development-regression-v8/README.md). Its corpus was used during policy iteration, so none of its outcome, rework, preference, or latency numbers are release evidence.

This file will be replaced from the canonical analyzer output after the final run. Publication is fail-closed: missing pairs, retries that do not recover, prompt drift, an unclean plugin tree, a candidate-tree mismatch, a failed predeclared gate, or a changed policy after the run keeps the release blocked.

The final report will state the exact execution and grader settings, all point estimates and uncertainty intervals, failure and retry counts, synthetic-corpus and automated-grading limitations, and the separate DeepSeek compatibility boundary.
