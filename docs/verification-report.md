# Verification report

Verified on 2026-08-28 from `D:\Codex\intent-loop` with Codex CLI `0.150.0-alpha.8` and Node.js `20.19.1`. This report separates executed implementation evidence, public-release evidence that is still pending, and product hypotheses that have not been tested.

## Executed implementation evidence

| Surface | Executed check | Result |
| --- | --- | --- |
| Build and automated tests | `npm test` in `plugins/intent-loop` | **62/62 pass**, 0 skipped. The suite covers storage integrity and recovery, real-process locking, privacy and deletion, provenance transitions, private/off modes, import bounds/remapping, Hooks, official MCP client behavior, Codex project metadata binding, local-directory path enforcement, and corpus invariants. |
| Failure regressions | Test reads `evals/policy-regressions.jsonl` | **15/15 required failure classes present**. State/security classes have executable regressions; intervention-timing classes remain frozen paired-study cases. |
| Clean distribution | `npm run test:distribution` | Self-contained copy with no `node_modules` launched Hook and MCP runtime, exposed **15 tools** and **1 Skill resource**, completed start-add-read-delete, redacted a seeded secret, and found no task ID or marker bytes after deletion. |
| Embedded dependency inventory | Runtime build plus `SBOM.cdx.json` and notices | **9 bundled components** matched the locked inventory and complete embedded license texts. |
| Plugin structure | Official plugin-creator validator | **Pass**. |
| Skill structure | Official skill-creator validator under Python UTF-8 mode | **Pass**. The first Windows run failed only because Python defaulted to GBK while reading UTF-8 punctuation. |
| Dependencies | `npm audit --json` | **0** known info/low/moderate/high/critical vulnerabilities across 64 resolved dependencies at check time. |
| Frozen corpus | Test recomputes counts, IDs, strata, and file hash | **80 unique tasks** in the frozen 15/15/15/15/20 strata; SHA-256 `6796B9E40A5C0D6259CEF454A69AFFC767A0BD34C0E88153EF109FA2D2DB4F52`. |

## Installed build identity

The final locally installed verification build was `0.1.0-beta.1+codex.final.20260828215901`. The cache suffix exists only to defeat local plugin caching; the source manifest was restored to `0.1.0-beta.1` immediately after installation.

- Installed `runtime/server.mjs` SHA-256 `BFBDB0D5691CD9EDF7D94B21D0BA5AC250C49EBA34A58C60E1910E7D29AEE09B` matched the just-tested source runtime.
- Installed `runtime/hook.mjs` SHA-256 `A6D7B0FED82A4358B99AF62794AAD81031E54DCE4A80EED8CB5E9B1738EE5464` matched the just-tested source Hook.
- Installed `skills/intent/SKILL.md` SHA-256 `575C9624F04243BC988A22CD80FABB60FA8A5818A41780900DB0DA56C4AFD350` matched the just-tested source Skill.
- The official MCP client loaded the installed runtime, read the bundled Skill resource, and saw 15 tools plus one resource.
- The initialization response advertised experimental capability `codex/sandbox-state-meta`.

## Real Codex first-use evidence

A fresh ephemeral Codex task ran in the empty project `D:\Codex\_tmp\intent-loop-host-e2e-20260828-2230`. The natural-language request asked for `$intent start`, seven direct constraints, and `19 + 23`.

Observed trace:

1. Direct shell access to the installed Skill was unavailable, so Codex used the documented `intent-loop://skill/intent` fallback exactly once.
2. Codex made exactly one `intent_start_task` call with only `initial_explicit`; it supplied no `project_root`, `request_id`, task ID, claim IDs, source IDs, or hashes.
3. The call succeeded on its first attempt. Host `sandboxCwd` resolved project ID `ae3b4053ed7a1323bf6b2b2ad817371ce0e314ff329228cc152bba8c51e12a7c` and task `d2b1f371-ac7c-519b-8384-ba16d3e9d3bf`.
4. All seven directly stated constraints were created transactionally as user-explicit task claims.
5. No Shell, file, Memory, planning, or non-Intent-Loop tool ran. The final answer was `42`.

This closes the earlier first-use failure in which the model omitted `project_root`. The server now advertises Codex's sandbox metadata capability and treats the host working directory as authoritative. The contract suite separately proves that a conflicting explicit path returns `PROJECT_ROOT_MISMATCH`, while another MCP host can use an explicit root or exactly one advertised local file root.

## Real Codex continuation lifecycle

A second fresh Codex process used the same project and task ID. Every project-scoped call again omitted `project_root` and resolved the same project ID.

| Operation | Executed result |
| --- | --- |
| `intent_get_snapshot` | Recovered the seven original explicit claims in `on` mode. |
| `intent_replace_claim` | Replaced `Output only the integer.` with the user's direct correction while retaining the superseded claim in history. |
| `intent_add_evidence` | Stored `The one-call start worked; keep this behavior` as `role=evidence`, `epistemic_status=evidence`, `feedback_class=keep`; it was not promoted to explicit intent. |
| `intent_export` with `detail=summary` | Returned `history_complete=false`, 8 active claims, and zero candidates, unknowns, or disagreements without a full graph dump. |
| `intent_set_mode` | Switched the task to `off`; semantic reads/writes are disabled until re-enabled. |

The destructive task-delete step was not executed against this local installed record because the product requires an exact user confirmation and the test agent cannot manufacture that authorization. Physical deletion remains executed on the same frozen runtime in the isolated clean-distribution lifecycle, including post-delete byte scans.

## Independent final rechecks

- The adversarial reviewer independently ran the frozen 62-test suite, type checking, distribution lifecycle, dependency audit, and six total executions of the 32-process stale-lock recovery case. It approved the source and local distribution candidate with no remaining P0, P1, or P2 code finding.
- The practical reviewer approved the full natural-language lifecycle. It then checked the final hash-matched cache `0.1.0-beta.1+codex.final.20260828215901` against the existing off task: one Skill read and one first-attempt `intent_status` call, with no project root, schema, Memory, other MCP, task creation, mode change, deletion, or workspace write. The response correctly distinguished off mode from deletion.
- Practical P2 observations remain: short Codex turns took roughly 24-52 seconds, each turn reread the Skill, the observed Chinese first-use disclosure stayed in English, and technical identifiers were visible. These are public-beta usability limits, not hidden correctness or efficacy claims.

## Hook evidence and trust state

Hooks are optional and are not trusted automatically. Earlier installed-host testing delivered the reviewed `SessionStart` context under a one-invocation trust bypass without persisting an Intent Loop Hook trust entry. Fixture tests cover `SessionStart`, `UserPromptSubmit`, `PostCompact`, `Stop`, and `SessionEnd`, including fail-open behavior and absence of raw prompt/secret-derived digests.

A naturally triggered long-running `PostCompact` plus resume sequence has not been retained as trusted host evidence. It remains a stable-release pilot item, not a public-beta implementation blocker or a hidden claim.

## Defects found and fixed during real use

| Defect | Executed evidence | Resolution |
| --- | --- | --- |
| `${PLUGIN_ROOT}` was not expanded in MCP arguments | Installed launch attempted a literal path. | MCP uses installed `cwd: "."` plus `runtime/server.mjs`; `${PLUGIN_ROOT}` remains only where Hook packaging provides it. |
| Hyphenated server namespace was not exposed reliably | Initial host probe lacked the expected tool namespace. | MCP server key is `intent_loop`; plugin identity remains `intent-loop`. |
| Windows sandbox denied installed Skill file reads | Fresh Codex tasks could discover the Skill but not shell-read the cache. | One static read-only MCP resource serves the actual bundled Skill; real tasks recovered through it without Shell retries. |
| Model omitted required IDs and made multi-call starts | Initial practical review saw failed starts, shell hashing, and follow-up claim loops. | New start accepts string claims, creates opaque IDs/provenance server-side, and records all claims in one mutation. |
| Codex did not advertise MCP roots and the model omitted `project_root` | A repaired intermediate build still failed with `PROJECT_ROOT_REQUIRED`. | Server advertises `codex/sandbox-state-meta`; all tools resolve host `sandboxCwd`, reject conflicts, and keep explicit/single-root fallback for other hosts. |

The project-root solution is based on executed host behavior and current public Codex source: the Codex MCP client injects sandbox state only when the server advertises that experimental capability. It does not assume the MCP process's own working directory is the user's project.

## Evidence boundary

### Verified

- Source, clean distribution, and the matching installed build execute successfully.
- Codex first use now succeeds with one start mutation and no caller-generated project path or IDs.
- Snapshot, correction, feedback classification, summary export, and off mode work across fresh Codex processes.
- Isolated physical deletion removes task identifiers and seeded marker bytes from live plugin storage.
- Project mismatch, path/link escape, import-size, credential, concurrency, stale-lock, crash-residue, and request-reuse controls have executable regressions.

### Pending before public release completion

- Public GitHub default-branch and CI proof.
- GitHub-only marketplace installation of the reviewed commit.
- Prerelease archive, checksum, SBOM, and artifact-attestation verification.
- Final independent adversarial and practical-user rechecks.
- Verified local plugin and marketplace removal after all tests.

### Not verified and not claimed

- Lower avoidable rework, better final-match scores, acceptable interruption cost, or helpful intervention timing across independent tasks.
- The frozen paired 160-delivery study; `docs/paired-evaluation-result.md` remains `NO RESULT`.
- Naturally triggered compaction/resume under sustained trusted-Hook use.
- Value or safety of adapters for other agents.
