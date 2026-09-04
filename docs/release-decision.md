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
- Post-v5 stable-CLI development regression: facts-only sample 5 / 5, chosen-lead order 5 / 5, and the complete 16-case corpus 16 / 16 with zero tools or user-work actions under the formal runner's audited Hook-trust path. These results describe the retired v6 candidate, not the current revision.
- Independently authored v6 holdout sealed before execution at SHA-256 `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897`; portable root overlap validation found zero threshold violations.
- V6 completed 160 / 160 primary conversations and 80 / 80 blind grades, then returned `STOP`; its failure record is preserved without an efficacy claim.
- Evaluation contract v3 rejects a corpus unless every final requirement is an exact excerpt from a frozen user-visible turn.
- Current source/package suites: PASS, 107 / 107 on Node 20.19.1 and 107 / 107 on Node 22.19.0, covering the 1,315-byte factual-boundary policy, corrected development labels, evaluation contract v3, privacy/deletion behavior, generated packages, and simultaneous 100-process writes.

## Required before publication

- Corrected installed-Hook regression, genuinely costly decision-gate probes, and component ablation for the post-v6 revision; remove any rule that does not show necessary behavior.
- A newly and independently authored v7 holdout with no hidden final requirements, sealed before any arm runs.
- A verbatim, candidate-commit-bound v7 evaluation with explicit model settings, isolated Codex Home, full plugin-tree fingerprint, complete sanitized outputs, and all predeclared gates passing.
- Independent adversarial review with accepted blockers fixed.
- Independent beginner/user-perspective use with accepted blockers fixed.
- Clean repository, version identity, generated-distribution, SBOM, notice, secret-scan, and package-allowlist checks.
- Successful live npm advisory audits for both production dependency manifests. Authorized requests reached npm: the retiring quick endpoint returned HTTP 500 and the official bulk endpoint timed out, so no current live result is claimed.
- Commit and push, then all 18 main CI jobs.
- Annotated `v0.3.0-beta.1` tag, all 18 exact-tag CI jobs, verified release assets, attestations, immutable prerelease, and fresh public installs.
- GitHub profile placement and final local installation/state/cache/dependency cleanup.

V6 cannot authorize publication for two independent reasons: clear paired latency was +6.89%, wrong proactive interventions were 24.14%, and inference denial was 62.5%; additionally, at least eleven final-match checklists contained facts absent from the user-visible conversation. The release remains a beta even if v7 passes because the holdout is synthetic, automated grading can be wrong, model behavior can drift, and DeepSeek Harness is a developer preview.
