# Continuous intent loop: two targeted user cases

On 2026-09-07, two synthetic cases completed six user turns on fixed candidate `c970c28f208f1055ca5983702ff042eafc9c7669`. After `/intent start`, ordinary feedback produced five real State MCP writes. Execution correction preserved the goal, a genuine purpose change superseded it, and an undecided preference remained unknown. A separate, non-activated opt-out task delivered two requested files without State writes.

This is targeted user-path evidence, not a blind test, baseline comparison, efficacy estimate or release gate. Ordinary native resume includes earlier chat history: observing stored records and their injection does **not** establish State's independent benefit or exclusive causality. Later `9e9` POLICY bytes were not tested here. The earlier six-case/22-turn archive and its historical 19 offline checks remain separate and unchanged; those checks are not included in this run's 15 checks. No frozen 80-case material was used.

## Read the evidence

- [cases.json](cases.json): all six exact synthetic prompts, final answers and assistant messages; the file task's actual command/file-change completions, including its failed verification command.
- [continuity-evidence.json](continuity-evidence.json): one manual Hook result, eight continuity contexts and five automatic MCP calls. Actual arguments, receipts, record status, supersedes and source relationships are preserved with consistent identifier substitutions.
- [verification.json](verification.json): 15 scoped consistency checks, exact receipt correspondence, normal trust observations, input/output hashes, host warnings and retained friction.
- [installation-verification.json](installation-verification.json): 27 recorded installed files compared again with immutable fixed-commit Git blobs; owned-source and dependency-boundary fingerprints.
- [cleanup.json](cleanup.json): all native deletion and official uninstall outcomes, including the failed empty onboarding deletion, followed by exact temporary-directory absence checks.
- [artifacts](artifacts): the two synthetic inputs, [rule-notes.txt](artifacts/rule-notes.txt) and [badges.csv](artifacts/badges.csv), and actual outputs, [readiness-rule.md](artifacts/readiness-rule.md) and [badge-status.csv](artifacts/badge-status.csv).
- [manifest.json](manifest.json): original private-source SHA256/bytes and actual published-artifact SHA256/bytes; the manifest excludes its own hash.

## Observed sequence

| Turn | Result |
| --- | --- |
| 07-01: start | Real activation receipt `IF-D9347625`. |
| 07-02: initial purpose | Saved reader genre-choice goal as `record-01`; delivered Mystery and Nature labels. Receipt `IF-DCE5D333`. |
| 07-03: layout correction | `implementation_change` saved as `record-02`; original goal remained active. Delivered `Mystery / Nature`. Receipt `IF-E7CD814A`. |
| 07-04: purpose change | Volunteer sorting became `record-03`, superseding exactly `record-01`. Requested labels became `record-04`; unresolved icons became unknown `record-05`, not confirmed agreement. Receipts `IF-A0EA5C14`, `IF-EB8446A6`, `IF-024EB0DA`. |
| 07-05: fresh-process resume | Both State contexts loaded the four active records with their IDs and sources, not the superseded goal. Answer restated volunteer sorting and the open icon choice. No duplicate write; ledger hash unchanged. |
| 08-01: file task with opt-out | Delivered the short readiness rule and ordered status CSV. Both input byte hashes were unchanged. No State MCP call, continuity context or record for this task; ledger hash unchanged. |

The first ordinary Hook output had a non-null current turn ID matching native turn metadata and the subsequent MCP source. Fixed source passes only `event.turn_id` into ordinary continuity; missing values become null and forbid writing. This is indirect native-field evidence through actual output and source binding, not a separately captured raw Hook input. Earlier SessionStart context had a null turn ID; UserPromptSubmit supplied the current ID. No artificial capture Hook, manual remember repair, rewritten rollout, fake task or compaction was used.

## Conditions and friction

Codex CLI 0.153.4 and Node 22.19.0 used a fresh isolated local-source installation of Core and State 0.3.0-beta.1. Public-tag installation was not tested. The reviewer checked the first-party change and fixed generated/dependency boundary before individually trusting three Hooks through the normal UI. Final Active counts were SessionStart 1/1 and UserPromptSubmit 2/2. Non-administrator sandbox setup completed. Hook trust bypass and private trust-config edits: zero. Subsequent native exec/resume used `--approve-for-me`, which is automatic tool approval, not bypass of Hook trust.

All six user turns used OpenAI gpt-5.6-sol / low. There were no content retries, extra cases, graders or model calls during archival. Six user turns is not a count of underlying inference requests during tool use. Per-turn usage and durations are observations, not a matched performance comparison.

- The file task tried Git validation outside a repository. One command failed and produced an irrelevant no-index comparison of the two different input files. The final unchanged-input claim was true, but independent hashes established it, not that Git attempt. This is an observed agent verification mistake; plugin causality is unproven.
- Layout feedback stayed at task scope after the purpose changed. No incorrect goal or answer resulted, but retaining one-off feedback is a concrete sparsity/lifetime concern.
- Tiny requests still incurred State work and brief bookkeeping commentary. Five successful MCP receipts do not demonstrate saved time or net value.
- Installation required workspace trust, three Hook reviews and sandbox onboarding. TERM=dumb complicated navigation. Plugin listing returned both enabled plugins but warned that a remote catalog response could not be parsed. Every turn logged unsupported PowerShell snapshots; start also logged one rollout-flush warning. Actual outputs, receipt and rollout remained available. No capacity error or timeout occurred.
- The local verifier initially assumed unused optional mode/export directories existed. Its ENOENT assumption was corrected locally, with no model retry; this was not a product failure.
- After closing the CLI processes, native deletion succeeded for both model tasks. A no-prompt onboarding deletion failed with `Error: failed to delete session`; no narrower cause is inferred. State/Core/marketplace removal succeeded without file-in-use errors. Exact isolated home, fixed-source snapshot and synthetic workspace were removed; no session files remained.

All 15 scoped checks passed, while the failed command and failed onboarding deletion remain visible. No observed issue blocked these small deliverables. The opt-out case combines non-activation and an explicit opt-out, so it isolates neither condition. Core remained installed; absence of State activity does not mean its read-only policy Hook stopped running. This small targeted run does not establish general usefulness or a storage cost/benefit advantage.

## Redaction, preservation and validation

The original sealed 53-file private collection and its manifest were read-only and hash-verified before and after archival. It is not copied here. Native task/turn UUIDs and opaque record IDs are consistently replaced by task-caseNN, turn-caseNN-NN and record-NN labels; no reversible map is published. All six IF receipt strings stay exact. Output links and file changes become artifacts-relative; the executable path becomes `pwsh`. Prompts and answers are otherwise complete. Host/account/environment data, raw ledgers and timestamps are omitted; MCP snapshots retain the fields needed to audit status and source relationships. Actual Hook text and its parsed data both remain, with identical substitutions. Publication of these explicitly authorized synthetic cases does not change the product's default persistence behavior.

Installation descriptors use SHA256 of compact JSON containing path-sorted `{path,bytes,sha256}` entries plus one LF. This is not a Git tree object ID or a hash of the pretty-printed public JSON. Both installed and fixed-Git descriptor hashes use the same serialization; Git object IDs and format are separately labeled. Source hashes provide provenance, not public access to private records.

Validate without private sources:

```sh
node build-public-evidence.mjs --verify
```

Rebuild with the sealed private collection and a repository containing the fixed commit:

```sh
node build-public-evidence.mjs --build <private-source-directory> <repository-directory>
```

The bounded builder adapts the earlier archive's local hash/redaction approach. It writes only this directory and uses read-only Git object commands, never the current worktree or a model/network API. Validation checks published hashes, UTF-8/LF, counts, receipts, record/source equality, restoration, fingerprints and cleanup accounting. It rechecks retained evidence, not the deleted runtime: live optional-directory observations remain backed by the sealed original verifier result. Path/UUID/common-secret scans and explicit field selection are not a universal secrecy proof.
