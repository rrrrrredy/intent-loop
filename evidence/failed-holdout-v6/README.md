# Failed holdout v6 diagnostic

This directory records why candidate `a67148e7eb55db1bc92593829661c31b9929fb32` cannot authorize a release.

The run itself was operationally complete: 160 of 160 primary conversations were usable, all task cleanups succeeded, and 80 of 80 pairs received blind grades. One grader batch needed its allowed second attempt because the first response omitted a required rationale.

The point-estimate decision was `STOP`. Clear paired latency, wrong or unhelpful intervention, and inference denial failed their fixed gates. A post-run corpus audit then found a more fundamental validity problem: at least eleven scenarios expected concrete content that appeared only in evaluator fields, not in either user-visible turn. The aggregate values are retained as diagnostics and must not be cited as efficacy evidence.

Raw local study files are not published here. They contain machine-local execution metadata, and publishing a full sanitized transcript of an invalid experiment adds audit surface without supporting a product claim. `manifest.json` binds their exact hashes and records every gate. `corpus-audit.json` identifies the user-visibility defects. The spent v6 corpus remains under `packages/intent-formation/evals/retired` after v7 is sealed.
