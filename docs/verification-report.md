# Verification report

Verified on 2026-08-31 from `D:\Codex\intent-loop` with local Node.js `20.19.1` and a final real-host run on Codex CLI `0.151.0-alpha.7.2`. This report separates executed implementation and publication evidence from efficacy claims that remain untested.

## Release identity

- Public repository: `https://github.com/rrrrrredy/intent-loop`
- Visibility/default branch/license: public, `main`, Apache-2.0
- Release candidate: `v0.1.0-beta.3`
- Candidate commit/tag/release: pending public push and GitHub Actions
- Superseded releases: `v0.1.0-beta.1` and `v0.1.0-beta.2`; both public release bodies warn users not to install them.

The first beta tag exposed a stale-lock generation race on Ubuntu/Node 24. Beta.2 repaired that family, but final Windows pressure rechecks found parent/marker `realpath` access races and related lock timeouts. Neither failure was hidden or treated as flaky: both builds were marked superseded, and beta.3 adds parent-plus-marker generation binding with bounded fail-closed transition rechecks.

## Executed implementation evidence

| Surface | Executed check | Result |
| --- | --- | --- |
| Source suite | Root ran `npm test` after the beta.3 metadata update | **72/72 pass**, 0 skipped, followed by the clean-distribution gate. |
| Independent source suite | Adversarial reviewer independently ran `npm test` before the metadata-only version bump | **72/72 pass** plus self-contained distribution verification. Root regenerated the version-specific bundles/SBOM from unchanged source and reran the full suite. |
| Clean distribution | `npm run test:distribution` | No `node_modules`; **15 tools**, **1 Skill resource**, start/add/read/delete lifecycle, redaction, physical-delete scan, and **9 SBOM components** passed. |
| Root generation regressions | Twenty rounds of four replacement and validation cases | **20/20 rounds pass**, 80 focused executions. |
| Independent generation regressions | Reviewer ran four generation cases plus cleanup/tamper groups | Two independent **60/60** round groups passed, 480 focused executions total. |
| Root stale-lock pressure | Ten repetitions of the real 32-process stale-recovery case | **10/10 pass**, 320 child processes; each iteration produced 33 events, 33 unique request IDs, and zero `ledger.lock*` residue. |
| Independent stale-lock pressure | Reviewer repeated the same real-process case ten times | **10/10 pass**, another 320 child processes with the same event, ID, exit, and residue assertions. |
| Source identity around review | SHA-256 before and after independent execution | `storage.ts` `78AAE758AF28B300931BEFAED1AC798D93F61236390D4F7ED7BB3C868D7E10D2`; `storage.test.ts` `208DF4884D52A8097742AF02D17A0F8B6CD04F6B17914DF8A8816EA07C4C64D0`. |
| Beta.3 generated identity | Rebuilt version-specific outputs and compared SHA-256 before/after | `runtime/server.mjs` `FB6FE258941BD22CC1FEE9DD7AC801D5C9107C4C6020147FE69D1794AAA5FAD0`; `runtime/hook.mjs` `C7B71E19D796D364585BF8CE9D8E9F046C195CF86E75E76D37E29BD57F72D960`; `SBOM.cdx.json` `D6C4C920B72EE6EE99FE87ACE37344C1A52D4F9868DA5FD08AA100B180FD32D3`; zero output drift. |
| Plugin/Skill validation | Official plugin validator and Skill validator | **Pass**. The Skill validator requires Python UTF-8 mode on this Chinese Windows locale; the initial GBK decode failure was environmental, not a schema failure. |
| Dependencies | `npm audit --audit-level=moderate` | **0** known vulnerabilities at the check time. |
| Frozen evaluation corpus | Suite recomputes counts, IDs, strata, and hash | **80 unique tasks**, frozen hash `6796B9E40A5C0D6259CEF454A69AFFC767A0BD34C0E88153EF109FA2D2DB4F52`; no outcome result was manufactured. |

The storage regressions cover a stale snapshot facing a replacement markerless generation, owner-publication failure without deleting a newer live generation, parent/marker generation replacement and unsafe replacement, bounded markerless recovery, same-PID/different-token isolation, truncated reclaim-marker crash recovery, invalid release-marker repair, and retention of the stable-token compromise check.

## Public CI and release evidence

Beta.3 public CI, release assets, attestations, exact-tag installation, real lifecycles, practical-user review, and final cleanup are pending at this source-candidate checkpoint. The remainder of this section and the historical sections below record beta.2 evidence only; beta.2 is superseded and this evidence is not used to clear beta.3.

The beta.2 tag CI run `33357641225` passed all six matrix jobs: Windows and Ubuntu on Node 20, 22, and 24. Every job ran install, the full test suite, audit, and generated-distribution diff verification:

`https://github.com/rrrrrredy/intent-loop/actions/runs/33357641225`

The beta.2 release run `33357641300` passed tests, distribution diff, tag/package version matching, archive construction, provenance attestation, CycloneDX SBOM attestation, and prerelease publication:

`https://github.com/rrrrrredy/intent-loop/actions/runs/33357641300`

Downloaded release assets were independently checked:

| Asset | GitHub/computed SHA-256 |
| --- | --- |
| `intent-loop-plugin-v0.1.0-beta.2.tar.gz` | `aedcab1b4c5d695bba82c5ad00d82221b6e01f88922937c820adc9706b2d82d3` |
| `SBOM.cdx.json` | `08820c60bb736d5a2ae3ab3eed542f50d0516aa11bdbc3685c159a53a42b07e8` |
| `SHA256SUMS` | `9d183370d7c0e26256ed5c1f98447ea673c7e4dd23b1ba5dfe2505e6cbab1f1f` |

The checksum file matched the downloaded archive and SBOM. The archive contained exactly 11 distributable files: plugin manifest, MCP manifest, Hook manifest, two runtime bundles, Skill, icon, LICENSE, NOTICE, third-party notices, and SBOM. It contained no source, tests, or `node_modules`. All 11 extracted files matched the corresponding beta.2 Git blobs; the one initial byte comparison difference was only the local checkout's Windows line ending and disappeared when compared against tag blobs.

The SBOM parsed as CycloneDX 1.6 with serial `urn:uuid:5897606e-ec60-5274-9474-fdc97424fec5`, root version `0.1.0-beta.2`, and nine components. Strict `gh attestation verify` checks passed for both provenance and CycloneDX attestations while requiring the exact release workflow, source commit `c5e5874f7ac323a3f144b4c81618aa6cfa03b85e`, tag ref, and GitHub-hosted runners.

## Historical beta.2 GitHub-only install identity

The final install used only the public, pinned command path:

```text
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.1.0-beta.2
codex plugin add intent-loop@intent-loop
```

`codex plugin list --json` reported installed/enabled version `0.1.0-beta.2`, marketplace source `https://github.com/rrrrrredy/intent-loop.git`, and marketplace `HEAD` `c5e5874f7ac323a3f144b4c81618aa6cfa03b85e`. Critical file hashes matched between the GitHub marketplace checkout and installed cache:

| File | SHA-256 |
| --- | --- |
| `.codex-plugin/plugin.json` | `C3E3B8A56996CED1E0E2C0786097DF27AF61675475CAE392A315FFF43CE54969` |
| `.mcp.json` | `9CD50C15DE4CB1BBDF85F2DB821A748ADA8573989A2305EC97B9F7ED95AA0E98` |
| `runtime/server.mjs` | `97A2D27F67A5EEFEDD2C1467864FB9DC74B2775B6B0861CB4038048A06FF6A75` |
| `skills/intent/SKILL.md` | `575C9624F04243BC988A22CD80FABB60FA8A5818A41780900DB0DA56C4AFD350` |

## Historical beta.2 root-operated real lifecycle

Root personally launched a fresh `codex exec --ephemeral` from an empty `D:\Codex\_tmp` project. The server created task `c87ee02f-27be-5493-8178-32c65a6e46af` without caller-supplied project root, task ID, request ID, claim IDs, or hashes.

1. One `intent_start_task` transaction created both direct requirements.
2. `intent_get_snapshot` returned the generated claim and source identities.
3. The first correction probe was correctly rejected because its provenance reference lacked an event ID or hash; no state was written. Retrying with the snapshot's real event ID succeeded and superseded the intended claim.
4. `intent_add_evidence` stored result feedback as evidence, not user-explicit intent.
5. `intent_export(detail=summary)` returned three active records with no candidates, unknowns, or disagreements.
6. `intent_set_mode` switched the task to `off`.
7. A structurally valid inference write was rejected with `MODE_OFF`, `retryable=false`, and produced no claim.

This lifecycle used the installed MCP and no project-file writes or mirrored Memory. The validation-first correction failure is recorded as a P2 provenance-usability observation, not concealed as a first-attempt business success.

## Historical beta.2 installed-host reviews

The adversarial reviewer gave **RELEASE**, P0/P1 zero. It inspected the repaired generation/marker protocol, independently reran 70 tests, distribution verification, dependency audit, ten 32-process pressure iterations, and a source-hash freeze. Its two P2 residual risks are rare filesystems whose birth time is unreliable while inodes are rapidly reused, and path-based heartbeat `utimes` not separately rebound to generation/token under same-user external tampering.

The practical-user reviewer independently installed the public beta.2 checkout and ran one natural Chinese request in a new ephemeral Codex session. Task `f875fa3c-fb59-5eb2-9712-b5e59deb0184` completed one-call start with five explicit statements, snapshot, claim replacement, evidence, summary export, off, and an off-after-write rejection. Every business call succeeded on its first attempt; the final summary had six active records and zero candidates, unknowns, or disputes. The marketplace `HEAD` remained unchanged before and after. Verdict: **RELEASE**, P0/P1 zero.

Practical P2 observations are the roughly 90-second complete model-mediated flow, technical narration and identifiers, one transient model statement that simplified off as write-only before the tool correctly stated that semantic reads and writes are disabled, and Codex/Windows host warnings for marketplace refresh, PowerShell shell snapshots, and unrelated icon metadata. These did not alter Intent Loop state or the release checkout.

## Historical beta.2 uninstall and cleanup

After all tests and both reviews:

- `codex plugin remove intent-loop@intent-loop --json` succeeded.
- `codex plugin marketplace remove intent-loop --json` succeeded.
- The final plugin list contained zero `intent-loop@intent-loop` entries.
- Exact checks found no Intent Loop MCP process.
- `D:\Codex\_home\plugins\cache\intent-loop`, `D:\Codex\_home\plugin-data\intent-loop`, and `D:\Codex\_home\.tmp\marketplaces\intent-loop` were absent.
- `D:\Codex\_tmp` contained zero direct children whose names began with `intent-loop`.
- The canonical source repository remained present and clean.

The source repository and public GitHub release are intentionally retained; only the local installation, task data, marketplace checkout, cache, processes, and test scratch were removed.

## Evidence boundary

### Verified

- Beta.3 reviewed source, generated runtime/SBOM, 72-test suite, clean distribution, official validators, dependency audit, focused generation regressions, and root plus independent 32-process pressure agree and pass.
- The beta.3 adversarial source review is RELEASE with no P0/P1; its documented P2 items remain fail-closed.
- Start, projection, correction, evidence classification, summary, off mode, off-mode rejection, redaction, export, physical deletion, corruption recovery, project isolation, and concurrency have executable local evidence.
- Beta.2 Windows/Ubuntu CI, public assets, real Windows install/use/uninstall, and practical-user review remain historical evidence only; beta.2 is superseded.

### Not verified and not claimed

- Beta.3 public tag/commit identity, GitHub Actions, release assets/checksums/attestations, public-GitHub installed cache, practical-user lifecycle, and final local cleanup at this source-candidate checkpoint.
- Lower avoidable rework, better final match, acceptable interruption cost, or helpful timing across the frozen paired 160 deliveries.
- A naturally triggered, trusted long-running `PostCompact` plus resume sequence.
- A real Linux or macOS end-user install lifecycle; Linux currently has CI evidence, while macOS is not yet tested.
- Value, compatibility, or safety of ports for other agent hosts.
- OpenAI universal-directory listing or approval.
