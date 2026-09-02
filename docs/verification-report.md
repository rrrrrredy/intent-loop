# v0.3.0-beta.1 verification report

This report is intentionally incomplete while the candidate is being prepared. A green source test alone does not authorize publication.

## Product evidence

- Historical v8 development regression: preserved and hash-verified, but excluded from release-efficacy claims because the policy was tuned against its corpus.
- Candidate-bound sealed holdout: PENDING.
- Exact model/reasoning settings, isolated Codex Home, candidate commit, plugin-tree fingerprint, verbatim prompts, blind grades, and sanitized public artifacts: PENDING.

## State lifecycle

- Source regression suite: 68/68 on Node 20.19 and Node 22.19, including the 100-writer lock regression.
- Lock pressure: 10 additional rounds of 100 simultaneous appends completed without event loss after repairing the owner-publication race exposed by a real failed run.
- Development-plugin real host: PASS for receipt-backed start, atomic save, show, file export plus digest verification, private purge, fresh-process private write, off, and forget.
- Fresh candidate marketplace real host: PASS for direct `remember`, `show`, export plus independently recomputed digest, managed-export purge on private transition, private `remember` refusal without a receipt, `off`, and physical `forget`.
- Real-host off override: PASS. After receipt `IF-0A5DC13F`, the frozen ambiguous landing-page prompt produced a finished headline and subheading with no intent-formation interruption.
- Plugin-managed disk checks: PASS. The ordinary prompt and private canary were absent; the managed export disappeared on private transition; the task ID was absent after `forget` receipt `IF-C04D0DA6`.

## DeepSeek Harness

- Adapter and exact 18-file package suite: PASS on Node 20.19 and Node 22.19; the bundled DeepSeek package is 189,742 bytes in the current Windows build.
- Real temporary package/add/compose/boot-help/remove lifecycle: PASS against `@deepseek-ai/dsh` `0.1.2-alpha.5`, with no model API key and automatic profile cleanup.
- Node 22.19 real host lifecycle: PASS for pack/add/compose/boot-help/remove with a temporary `DSH_HOME`, no model API key, and complete cleanup.
- Runtime dependency audit: PASS, with zero high-severity or greater npm advisories in both packages at verification time.
- Node 24 local run: not available on this host; covered by the required CI matrix before release.
- Windows, Ubuntu, macOS CI: PENDING.

## Independent reviews

- Adversarial review: PENDING final candidate.
- Beginner/user-perspective review: PENDING final candidate.

## Public release

- Main-branch CI: PENDING.
- Exact-tag CI: PENDING.
- Release assets and attestations: PENDING.
- Immutable GitHub prerelease: PENDING.
- Fresh public Codex and DeepSeek installs: PENDING.
- GitHub profile update: PENDING.
- Local cleanup: PENDING.
