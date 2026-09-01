# Verification report

Verified through 2026-09-01 from `D:\Codex\intent-loop` with local Node.js `20.19.1` and a final real-host run on Codex CLI `0.151.0-alpha.7.2`. This report separates executed implementation and publication evidence from efficacy claims that remain untested.

## V0.2.0-beta.5 public-release evidence

The final beta.2 adversarial review returned **HOLD** despite correct current asset bytes. At that checkpoint GitHub reported `immutable:false`, repository release immutability was disabled, and three DeepSeek-related assets had been uploaded after the Release workflow published. GitHub later locked beta.2's current state and release-attestation verification now succeeds. That current lock does not change its split upload history or establish that all five assets came from the original exact-tag Release workflow, so beta.2 remains superseded.

The beta.3 tag changed no product-state semantics. It passed exact-tag CI run [`33466884550`](https://github.com/rrrrrredy/intent-loop/actions/runs/33466884550) **18/18**. Release run [`33466884600`](https://github.com/rrrrrredy/intent-loop/actions/runs/33466884600) retested both packages, built all five assets, generated both package provenance attestations, both package-to-SBOM attestations, and checksum-manifest provenance, then uploaded every draft asset as `github-actions[bot]`. The next step failed safely because `GET /releases/tags/{tag}` returns 404 for an unpublished draft. The publish step was skipped, the draft was deleted, and the beta.3 tag remains audit-only.

Beta.4 selected the exact draft from the authenticated release collection and fetched it by release ID. Main and exact-tag CI each passed **18/18**. Release run [`33468156467`](https://github.com/rrrrrredy/intent-loop/actions/runs/33468156467) retested both packages, created five attestations, and uploaded all five draft assets, then failed safely because local and remote asset names used different sort semantics. Publication never ran and the draft was deleted.

Beta.5 applies one code-unit comparator to both name lists before digest comparison. Every installed and generated identity advances again; product-state semantics remain unchanged. Exact commit `29951cda05c4fc545037a4f058325153599918ab` passed main CI run [`33469255872`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469255872) and exact-tag CI run [`33469669257`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469669257), **18/18** in each matrix.

Release run [`33469669275`](https://github.com/rrrrrredy/intent-loop/actions/runs/33469669275) waited for the exact-tag matrix, retested both packages, rebuilt all assets in one job, issued five GitHub attestations, uploaded one draft, verified every remote byte, published once, and verified the immutable release plus each asset. GitHub currently reports [`v0.2.0-beta.5`](https://github.com/rrrrrredy/intent-loop/releases/tag/v0.2.0-beta.5) as `draft:false`, `prerelease:true`, and `immutable:true`.

| Beta.5 public surface | Executed check | Result |
| --- | --- | --- |
| Codex structure and core | Official plugin validator plus full plugin `npm test` | **Pass**; **73/73** tests, type check, runtime build, self-contained distribution, 15 tools, one Skill resource, and live MCP handshake `0.2.0-beta.5`. |
| DeepSeek adapter and contract | Catalog/legal regeneration plus root `npm test` | **Pass**; **6/6** groups, 15-tool catalog, live handshake `0.2.0-beta.5`, 24 SBOM components, and 15 additional notices. |
| DeepSeek package | Exact-path package gate | **Pass**; **16/16 intended files**, `260477` bytes, with no tests, scripts, or `node_modules`. |
| Dependencies | Both production dependency audits at high severity | **Pass**; zero known vulnerabilities at check time. |
| Three-OS matrices | Main and exact-tag Actions on Windows, Ubuntu, and macOS | **Pass**; each run completed all nine Codex Node 20/22/24 jobs, six DeepSeek adapter Node 22.19/24 jobs, and three temporary DeepSeek Harness lifecycles. |
| Immutable publication | Exact-tag Release workflow plus public API and attestation verification | **Pass**; one successful release job, five Actions-uploaded assets, five attestations, matching remote digests, and `immutable:true`. |
| Windows Codex public install | README GitHub-tag install, installed identity, natural Chinese lifecycle, exact deletion, uninstall, and absence checks | **Pass**; version `0.2.0-beta.5`, marketplace commit `29951cda05c4fc545037a4f058325153599918ab`, start/show/replace/evidence/summary/off/`MODE_OFF`/on/delete all behaved as specified, no user-workspace file was created, and the plugin plus marketplace were removed. |
| Windows DeepSeek public install | README GitHub-tag add under isolated `DSH_HOME`, profile dump, host help, remove, and absence checks | **Pass** on DeepSeek Harness `0.1.2-alpha.2` with isolated Node `22.19.0`; exact beta.5 package identity loaded, no model API key entered the child, and the profile dependency was removed. |
| Linux/macOS claim boundary | Hosted package, adapter, and real temporary Harness lifecycle | **Pass for headless CI validation**; no physical end-user Linux/macOS machine or native GUI flow was claimed. |

Public asset digests:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `dsh-intent-loop-0.2.0-beta.5.tgz` | 260477 | `d0568d29aa366c93f5e34373dd77c5f146f08b462ef1fe0a941fd46690557b1b` |
| `dsh-intent-loop-SBOM.cdx.json` | 9871 | `c8274f0298e014b987dcb7ccf614fc5bc36cbf74fc1b65aeb71b8fabca64e48b` |
| `intent-loop-plugin-v0.2.0-beta.5.tar.gz` | 269701 | `53ffcf727b812b1ef07872beaf8d5d26339f0594dd0f940633872fe19985c684` |
| `SBOM.cdx.json` | 6820 | `d4d0436d192e1cfdf785ae2d299014ed341a38b7693bfc70766ea33728f6a435` |
| `SHA256SUMS` | 381 | `a57129aa8a0d9648d71e8904d95eb082423aa48536d92ff15a24f0c2d5a59ec7` |

## V0.2.0-beta.2 publication and supersession evidence

Fresh installation from public tag `v0.2.0-beta.1` checked out the correct commit `3aa083d26a8b4624ab9a465f05c65d3c5e1b913e` but Codex reported installed version `0.1.0-beta.3`. The source package and generated runtime were `0.2.0-beta.1`; `.codex-plugin/plugin.json` alone was stale. The plugin and marketplace were removed immediately, beta.1 was marked superseded without rewriting its tag, and no business lifecycle result was credited.

The beta.2 repair aligned the hidden Codex plugin manifest, source server constant, Codex package, DeepSeek package, lockfiles, generated runtimes, SBOMs, and install references. Exact commit `d975191540b94386307ef2ebd1d107d099d13fa6` passed **18/18** on main in run [`33463193008`](https://github.com/rrrrrredy/intent-loop/actions/runs/33463193008), **18/18** on tag in run [`33463578654`](https://github.com/rrrrrredy/intent-loop/actions/runs/33463578654), and Release run [`33463578770`](https://github.com/rrrrrredy/intent-loop/actions/runs/33463578770). Fresh public-tag Codex and DeepSeek Windows installs, business lifecycles, deletion, uninstall, and cleanup also passed. Beta.2 is still superseded because the DeepSeek package, DeepSeek SBOM, and expanded checksum manifest were added after publication by a different uploader rather than produced with all five assets by the original Release workflow. GitHub's later immutable lock protects the current bytes but does not rewrite that provenance history.

| Beta.2 surface | Executed local check | Result |
| --- | --- | --- |
| Codex structure and core | Official plugin validator plus full plugin `npm test` | **Pass**; **73/73** tests, type check, runtime build, self-contained distribution, 15 tools, one Skill resource, secret redaction, lifecycle deletion, and live MCP handshake `0.2.0-beta.2`. |
| DeepSeek adapter and contract | Root `npm test` | **6/6** groups, 15-tool generated catalog, live shared-core handshake `0.2.0-beta.2`, 24 SBOM components, and 15 additional notices. |
| DeepSeek package | Exact-path `npm pack --dry-run` gate | **16/16 intended files**, `260477` bytes, including the notice path referenced by the runtime banner; no tests, scripts, or `node_modules`. |
| Windows DeepSeek Harness | Temporary `DSH_HOME`; pack, add, compose/dump, boot-help path, remove, absence check, cleanup | **Pass** on Harness `0.1.2-alpha.2`; no model API key used and the temporary home was removed. |
| Windows lock pressure | Deterministic delete-transition boundaries plus 10 repetitions of the 32-real-process stale-lock recovery case | **Pass**; 320 child processes plus the full-suite run completed without lost events or lock residue. |
| Three-OS public code matrix | Nine Codex jobs, six DeepSeek adapter jobs, and three real temporary Harness lifecycle jobs | **18/18 pass** at exact code commit `4f51d82bfe718e2e5f4f35a2dd8f422d29c0c54b` in public run [`33462684659`](https://github.com/rrrrrredy/intent-loop/actions/runs/33462684659). |
| Independent adversarial recheck | Installed identity, live handshake, package path set, notice references, Windows orphan-lock transition handling, and release workflow boundary | **RELEASE**, P0/P1 zero after the handshake-version and peer-cleanup blockers plus the notice-reference P2 were fixed. Exact-tag publication and installed-host validation remain separate gates. |

## V0.2.0-beta.1 candidate evidence

The `v0.2.0-beta.1` candidate adds a DeepSeek Harness `0.1.2-alpha.2` developer-preview adapter and expands compatibility validation to Windows, Ubuntu, and macOS. Local checks and the public code-candidate matrix pass. Exact-tag release assets and fresh public-install evidence remain separate publication checks.

| Surface | Executed check | Result |
| --- | --- | --- |
| Shared Codex core | `plugins/intent-loop` full `npm test` after the version bump | **72/72 pass**, frozen corpus and clean distribution unchanged. |
| DeepSeek generated contract | Live MCP catalog generation/check | **15 tools**, hidden project/session selectors removed, source-runtime SHA-256 recorded. |
| DeepSeek adapter | Direct local test suite with real MCP child processes | **6/6 groups pass**: exact registration/guidance, credential omission, serialized creation and hard-cap enforcement, failed-holder draining without sibling teardown, idempotent close, pool eviction/unload, workspace forgery rejection, cross-project rejection, private-session isolation, and physical deletion. |
| DeepSeek legal/package | Deterministic legal generation plus packed-file verification | **24 SBOM components**, **15 additional notices**, **15 packed files**; package composition verifier passes. |
| Dependencies | Root `npm audit --omit=dev --audit-level=high` | **0 known vulnerabilities** at check time. |
| Windows real Harness lifecycle | Temporary `DSH_HOME`; pack, add to `headless`, compose/dump, boot help path, remove, absence check, cleanup | **Pass** on Harness `0.1.2-alpha.2`; no model API key used or left in the child environment; temporary home removed. |
| Three-OS public matrix | Codex Node 20/22/24, DeepSeek adapter Node 22.19/24, and DeepSeek host lifecycle on Windows/Ubuntu/macOS | Repaired code commit `d0fba7103c7999ce4f47b3ee6602380b7ead7932` passed **18/18** in public run [`33377049544`](https://github.com/rrrrrredy/intent-loop/actions/runs/33377049544). |

The DeepSeek adapter launches one MCP child lazily per active Harness session and injects the host's canonical workspace and session binding. The child receives a limited OS environment instead of the parent process's model-provider credentials. Pool capacity, idle eviction, tool timeout, cancellation, and plugin-unload cleanup are bounded and tested.

The final local Codex runtime after cross-platform fixes has SHA-256 `F19127B4B0E2AFD02C56C4968C8FF55847B5C848E19E04B8C4CE3C79D5B0794F`. The DeepSeek catalog was regenerated from that exact runtime and then passed its stale-file check. The final temporary Harness lifecycle returned `pack-add-compose-boot-help-remove`, `api_key_used=false`, and `dsh_home=temporary-and-removed`.

The first expanded public matrix run, [`33369885952`](https://github.com/rrrrrredy/intent-loop/actions/runs/33369885952), was correctly treated as a failed candidate. It exposed two platform assumptions hidden by Windows: macOS resolves the temporary `/var` path through `/private/var`, which broke string-only Hook/MCP main-module detection, and Ubuntu's case-sensitive filesystem exposed a lowercase dependency `license` filename that the legal generator did not scan. The same run's temporary DeepSeek Harness lifecycle passed on Windows, Ubuntu, and macOS. Both failures were repaired in source and retained as publication history.

The repair commit then passed all 18 jobs in public run [`33370869114`](https://github.com/rrrrrredy/intent-loop/actions/runs/33370869114): nine Codex jobs, six DeepSeek adapter jobs, and three real temporary DeepSeek Harness lifecycle jobs. This clears the three-OS code-candidate gate without turning CI success into an efficacy claim.

A later documentation-only candidate also passed all 18 jobs in run [`33372099059`](https://github.com/rrrrrredy/intent-loop/actions/runs/33372099059). The mandatory adversarial review then reproduced a separate P1 in the DeepSeek session pool: one failed call immediately closed its shared MCP client while a sibling call was still active. The candidate was held instead of tagged. The repaired holder enters a draining state, rejects new acquisitions, lets active siblings settle, and closes exactly once. A deterministic failure regression and the six-group local adapter suite pass.

The adversarial reviewer independently confirmed the original failure is closed, including slow-close capacity retention and two simultaneous failures. It passed the six-group DeepSeek suite on Node 22.19.0, package/catalog/legal checks, and the Codex 72-test distribution suite, then returned **RELEASE**, P0/P1 zero. Repaired code commit `d0fba7103c7999ce4f47b3ee6602380b7ead7932` subsequently passed all 18 jobs in public run [`33377049544`](https://github.com/rrrrrredy/intent-loop/actions/runs/33377049544), satisfying the review's publication condition. Root also repeated the temporary local Harness package/add/compose/boot-help/remove lifecycle with `api_key_used=false` and confirmed the temporary home was removed. The reviewer's P2 items are bounded fallback for a permanently hanging SDK close, root DeepSeek checks inside the tag Release job, and an exact package-path allowlist.

These checks establish transport, state, isolation, deletion, package, and lifecycle behavior. They do not establish reduced rework, improved final-match scores, interruption quality, or product-value efficacy. The paired evaluation remains `NO RESULT`.

## V0.1.0-beta.3 evidence

## Release identity

- Public repository: `https://github.com/rrrrrredy/intent-loop`
- Visibility/default branch/license: public, `main`, Apache-2.0
- Recommended prerelease: `v0.1.0-beta.3`
- Release commit: `9432dde72ac8c6b5c4bd1bc7936f8b14ef37246c`; local and remote peeled tag identities matched this commit.
- Public release: `https://github.com/rrrrrredy/intent-loop/releases/tag/v0.1.0-beta.3`
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

The beta.3 main CI run `33361723160` and tag CI run `33361813075` each passed all six jobs: Windows and Ubuntu on Node 20, 22, and 24. The release run `33361813109` passed tests, deterministic distribution checks, tag/package version matching, archive construction, SLSA provenance attestation, CycloneDX SBOM attestation, and prerelease publication:

- `https://github.com/rrrrrredy/intent-loop/actions/runs/33361723160`
- `https://github.com/rrrrrredy/intent-loop/actions/runs/33361813075`
- `https://github.com/rrrrrredy/intent-loop/actions/runs/33361813109`

Downloaded beta.3 assets were independently checked:

| Asset | GitHub/computed SHA-256 |
| --- | --- |
| `intent-loop-plugin-v0.1.0-beta.3.tar.gz` | `7E56808F02926E5C5C4DFF74DE8B52616D17EC42D35ED7BB841317D0754B1D7A` |
| `SBOM.cdx.json` | `D6C4C920B72EE6EE99FE87ACE37344C1A52D4F9868DA5FD08AA100B180FD32D3` |
| `SHA256SUMS` | `5399246C8A82A99A10E6CDE6C669A1DBB2191B06128773F76CF2CCB488696556` |

The checksum file matched the archive and SBOM. The archive contained exactly 11 intended distributable files, no source, tests, or `node_modules`, and every extracted file matched the tag's Git blob. The SBOM parsed as CycloneDX 1.6 with serial `urn:uuid:0ce9895f-7378-5d3d-af1d-31658694f16e`, root version `0.1.0-beta.3`, and nine components. Strict `gh attestation verify` checks passed for both SLSA provenance and the CycloneDX predicate while requiring repository `rrrrrredy/intent-loop`, release workflow `release.yml`, exact source commit and tag ref, and GitHub-hosted runners.

### Historical beta.2 publication evidence

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

## Beta.3 GitHub-only install identity

The final install used only the public pinned path:

```text
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.1.0-beta.3 --json
codex plugin add intent-loop@intent-loop --json
```

The CLI reported installed/enabled version `0.1.0-beta.3`, marketplace source `https://github.com/rrrrrredy/intent-loop.git`, and marketplace `HEAD` `9432dde72ac8c6b5c4bd1bc7936f8b14ef37246c`. Critical installed files matched the tag's Git blobs. Generated SHA-256 identities included `runtime/server.mjs` `FB6FE258941BD22CC1FEE9DD7AC801D5C9107C4C6020147FE69D1794AAA5FAD0`, `runtime/hook.mjs` `C7B71E19D796D364585BF8CE9D8E9F046C195CF86E75E76D37E29BD57F72D960`, and `SBOM.cdx.json` `D6C4C920B72EE6EE99FE87ACE37344C1A52D4F9868DA5FD08AA100B180FD32D3`.

## Beta.3 root-operated real lifecycle

Root personally launched a fresh ephemeral Codex session from an empty test project. Task `3c784b5f-5d16-5b16-8e2f-a23dda2f39a8`, bound to project `336d20699c6a352a13dffd29cf41c2db762305dace4f1441d983f40cb031c1a8`, completed one-call start, snapshot, first-attempt direct-claim replacement, evidence classification, a four-active-record compact summary, off, and an expected post-off `MODE_OFF`, `retryable=false` rejection. The first evidence call was structurally rejected before mutation because its provenance reference had an excerpt but no event ID or hash; the model used the snapshot's real event ID and the retry succeeded. This is recorded as P2 provenance usability. The lifecycle used only the installed Skill/MCP and made no user-project writes or Memory calls.

## Beta.3 installed-host reviews

The independent adversarial reviewer gave **RELEASE**, P0/P1 zero after 72/72 tests, 480 focused generation/cleanup/tamper executions, and 320 real child-process executions with exact source-hash freeze. Its three P2 hardening opportunities remain fail-closed and cannot authorize takeover or deletion.

The independent practical reviewer gave **RELEASE**, P0/P1 zero after a separate public-tag install. Task `3170ad52-ba58-5259-b427-8d739ea260d8`, project `2b3dab0d7c5e8e16a6fe9405511e7c6054ffeaf312f888b05dbc2ca992d15098`, completed privacy disclosure, start, snapshot, replacement, evidence, summary, off, and off-mode rejection with every business call succeeding first try. The final summary contained seven active records and no candidates, unknowns, or disagreements. The roughly 121-second flow and visible technical terms are P2 usability observations. Codex/Windows icon, shell-snapshot, and marketplace-lock warnings did not affect Intent Loop calls.

## Beta.3 uninstall and cleanup

After both public-tag lifecycles and both independent reviews, the supported CLI removed `intent-loop@intent-loop` and its `intent-loop` marketplace. Final lists contained zero matching plugin or marketplace entries; exact process checks found no Intent Loop MCP server. The plugin cache, plugin data, marketplace checkout, release-verification directory, and both lifecycle test directories were absent. The canonical source repository and public GitHub release were intentionally retained.

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

- Beta.5 reviewed source, generated runtimes and SBOMs, the **73/73** Codex suite, **6/6** DeepSeek suite, exact distributions, official plugin validator, live version handshakes, and production dependency audits agree and pass.
- The beta.5 public commit and tag identity, main and exact-tag **18/18** matrices, one-job Release workflow, five assets, checksums, SBOMs, five attestations, and GitHub's immutable-release verification all agree and pass.
- Windows public-tag Codex and DeepSeek Harness lifecycles cover install or add, identity, normal use, deletion or removal, absence checks, and uninstall. The independent adversarial reviewer also completed an isolated beta.5 Codex installation and cleanup with no P0/P1 product or asset finding; the practical reviewer completed the full natural-language Codex lifecycle plus the DeepSeek developer-preview path and returned RELEASE.
- Start, projection, correction, evidence classification, summary, off mode, off-mode rejection, redaction, export, physical deletion, corruption recovery, project isolation, and concurrency have executable evidence.
- Beta.1 and beta.2 are superseded public history. Beta.3 and beta.4 are unpublished, safely failed publication attempts retained only for audit.

### Not verified and not claimed

- Lower avoidable rework, better final match, acceptable interruption cost, or helpful timing across the frozen paired 160 deliveries.
- A naturally triggered, trusted long-running `PostCompact` plus resume sequence.
- A physical Linux or macOS end-user install lifecycle. Both operating systems have beta.5 hosted package, adapter, and temporary DeepSeek Harness lifecycle evidence.
- Value, compatibility, or safety of ports for other agent hosts.
- OpenAI universal-directory listing or approval.
