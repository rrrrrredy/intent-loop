# v0.3.0-beta.1 release decision

Current state: **candidate; do not tag or announce until every remaining gate below is recorded as PASS.**

## Passed

- Historical 80-scenario development regression completed, preserved for audit, and explicitly excluded from release-efficacy claims because the policy was tuned against it.
- Source-level State privacy, export, private-mode, off-mode, recovery, and deletion regressions.
- Real development-plugin State lifecycle, including receipt-backed start/show/export/private/off/forget and absence of private text on disk.
- Full local source/package suites on Node 20.19 and Node 22.19, plus ten 100-writer lock stress rounds.
- Fresh exact-candidate install with receipt-backed `remember`/show/export/private/off/forget, digest verification, private false-receipt prevention, and managed-data deletion.
- Real `/intent off` follow-up on a frozen ambiguous prompt, with direct delivery and no intent interruption.
- DeepSeek Harness `0.1.2-rc.1` package/add/compose/boot-help/remove on Node 22.19 using a temporary cleaned profile and no model API key.
- DeepSeek/root live npm audit with zero vulnerabilities; Codex package cache-backed audit with zero vulnerabilities.

## Required before publication

- A sealed, verbatim, candidate-commit-bound holdout evaluation with explicit model settings, isolated Codex Home, full plugin-tree fingerprint, complete sanitized outputs, and all predeclared gates passing.
- The final 1,165-byte installed-Hook candidate must first pass repeated stated-facts and lead-order development probes; the lead-order probe is 5 / 5, while the stated-facts rerun is still pending.
- Independent adversarial review with accepted blockers fixed.
- Independent beginner/user-perspective use with accepted blockers fixed.
- Clean repository, version identity, generated-distribution, SBOM, notice, secret-scan, and package-allowlist checks.
- A successful live npm advisory audit for the Codex package; the latest bounded local request timed out, and cached zero findings are not treated as this gate.
- Commit and push, then all 18 main CI jobs.
- Annotated `v0.3.0-beta.1` tag, all 18 exact-tag CI jobs, verified release assets, attestations, immutable prerelease, and fresh public installs.
- GitHub profile placement and final local installation/state/cache/dependency cleanup.

The release remains a beta because the final holdout is synthetic, automated grading can be wrong, model behavior can drift, and DeepSeek Harness is a developer preview.
