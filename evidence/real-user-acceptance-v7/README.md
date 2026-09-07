# Real-user acceptance: six synthetic Codex cases

This is a small, independent user-perspective exercise on fixed pre-release candidate `16c4b199cda677b9cb19898096d1bcc161b7215c`, run on 2026-09-07. It records actual use, including inconvenient results, rather than an efficacy score.

**There is no baseline or control arm. These observations do not establish that the plugin improved model performance.** They do not replace the frozen paired study, establish public-install readiness, or apply automatically to a later policy revision. The reviewer read product documentation and the execution closure for safety; this live phase was not implementation-blind. The six cases were independently authored without reading or running the sealed 80-case set or consulting its results. Follow-ups were written after seeing actual answers.

## Contents

- [cases.json](cases.json): all 6 initial requests and all 22 user-turn prompts and final answers, with only the disclosed substitutions below.
- [hook-evidence.json](hook-evidence.json): all 10 successful and 2 unsuccessful trusted Hook envelopes, exact turn links and unchanged success receipt IDs.
- [verification.json](verification.json): model/effort, file/State observations, minimal trust evidence and the separate historical 19 offline checks.
- [installation-verification.json](installation-verification.json): all 27 installed fingerprints compared against fixed Git blobs, never the current worktree.
- [cleanup.json](cleanup.json): all native deletion/uninstall outcomes, including failures and final filesystem verification.
- [inventory.csv](artifacts/inventory.csv) and [totals.csv](artifacts/totals.csv): synthetic input and actual model-created output.
- [manifest.json](manifest.json): original private-source SHA256/bytes and published-artifact SHA256/bytes, excluding the manifest itself.

The original 106-file local evidence collection was not copied here or modified. Unrelated host/system context, executable/workspace paths, raw session stores, runtime UUIDs and authentication material are omitted. Private-source hashes provide provenance, not independent public access to those private files.

## Conditions and normal trust flow

Both locally installed plugins were version 0.3.0-beta.1. Actual turn context confirmed gpt-5.6-sol and low effort for every case. Codex CLI was 0.153.4; Node was 22.19.0. A new isolated home used supported local-source marketplace/install commands, not an unpublished public tag. Public-tag installation was not tested.

Before prompts, the reviewer read all first-party Hook, entry, service, storage, policy and build code, checked the lockfile/runtime dependency boundary, and matched generated State/command bundles to the reviewed fixed hashes. This was not a fresh line-by-line audit of the roughly 900 KB third-party bundle.

The normal interactive UI warned that Hooks can run outside the sandbox. The reviewer inspected and trusted State resume, State command and Core MCP Hooks individually. The final UI showed SessionStart 1 installed / 1 active and UserPromptSubmit 2 installed / 2 active. **Hook trust bypass was used zero times; private trust configuration was not edited.** A combined terminal key sequence accidentally toggled resume off; it was re-enabled and checked before any prompt.

Normal non-administrator sandbox onboarding completed in about 32 seconds; no administrator installation occurred. Live work then used native exec/resume with --approve-for-me in that same home. Normal Hook trust and automatic command approval are distinct: not every file command was individually approved by a human. All 22 user turns completed. This is not an underlying API-request count including tool-follow-up reasoning. No user turn was retried, model changed, or grading API called by this reviewer.

## Observations

| Case | Actual behavior | Interpretation |
|---|---|---|
| 01: real file | Read synthetic CSV, added quantities, wrote sorted badge,5 and ribbon,5. Input hash unchanged. | Direct delivery without an intent interview. An unnecessary Git-status check failed in the non-repository workspace; the file output was correct. |
| 02: reusable order rule | Initially chose collection as the seller-payment trigger. After the reviewer requested verified packing instead, delivered the revised rule in two sentences. | Successfully revised reversible draft. The first answer did not explain the interests its default favored, but the request explicitly said “Please settle the rule.” No unauthorized payment or deployment occurred. |
| 03: unformed direction | Chinese request received inventory, progress tracking and project-workbench options with maintenance tradeoffs. Selecting progress yielded a small lighthouse restart card. | A concrete comparison helped make a choice, followed by direct delivery. |
| 04: incompatible goals | Explained why deleting every copy and retaining the original forever conflict, then asked the priority. Deletion choice yielded a short rule and loss-of-evidence consequence. | Useful prioritization without silently redefining deletion as hiding. |
| 05: change after sample | Supplied a small recruitment invitation; after the reviewer changed purpose/audience to existing members, wrote a reminder to bring one puzzle explainable in five minutes. | Followed a genuine goal change, not merely tone polishing. Initial sample was generic; this is not evidence of a high creative-quality ceiling. |
| 06: State | Save/show/correct/export/private/off/forget had local evidence. Private-show and off-remember were refused without success receipts. Ordinary rewriting still worked after off. | Ten successful receipts match trusted envelopes, and two expected restrictions were honestly stated. This is a small workflow observation, not universal reliability. |

Case 02 cost one extra correction turn. Delayed seller payment is a hypothetical downstream consequence if the draft were adopted, not harm that occurred. No money moved or production rule changed. Directly answering a requested cheap draft is not automatically wrong. The initial unexplained tradeoff and later correction are both retained without adding unstated requirements afterward.

## State and historical evidence

Correction superseded exactly the old record and preserved its role/task scope. Private left only a private-mode marker in the active event file; earlier statements were absent there, and the managed export count fell from one to zero. This live exercise did not separately inspect every conceivable backup after that transition. Final removal of the entire isolated home is separately recorded.

After off, actual trusted task-specific context overrode the general intent policy. This does not mean the Core Hook stopped running or prove that a base model will never ask its own question. A short ordinary request completed and a later State write was refused. Forget was invoked directly from off; the active event file then had zero bytes, off-marker count zero and managed-export count zero.

The previous 19 checks were local Hook/MCP component checks with zero model interaction, not extra live chat passes. The old check “Forget also removes the off marker” had already returned to standard before forgetting, so it alone did not establish removal of a still-active off marker. The new live off-to-forget observation is distinct evidence, not a rewrite of that old result.

## Friction and limits

1. **Private usability:** private slash show accurately refused and pointed to the live State MCP tool, but ordinary users lack an equally simple slash path. Documentation now explains the limit. A scoped MCP example or clearer route back to standard would help. Earlier process-local private MCP tests must not be presented as a new live slash-chat feature.
2. **Export reply omission:** the Hook summary and data contained content digest 2596eec2728bf1efc56ba9afd8c3987195034756e4d59e36598ded6ba7fd65cc. The final answer omitted it while retaining export ID/count/receipt. This was an information omission, not export failure or proven corruption. The updated guide explains content-digest versus whole-file SHA256; this live run did not repeat that algorithm test.
3. **Pre-release installation:** the updated README/guide warn users to check publication before using a tag. This improves an earlier misleading impression, but only local source installation was tested here.
4. **Correction documentation:** the new show → correct → show example made real record-ID syntax usable without guessing.
5. **Host friction:** TERM=dumb made navigation awkward. All 22 invocations logged unsupported PowerShell shell snapshots; two logged rollout-flush “thread not found” warnings. Resume, completion records and evidence still existed. No capacity error or timeout occurred in these cases.
6. **Cleanup failures:** six model-session native deletions succeeded. Two no-prompt onboarding IDs returned generic failed-to-delete errors; neither had a session file in the inspected isolated store. These are not successful native deletions. The whole isolated home was later removed.
7. **Uninstall boundary:** after closing these CLI sessions, official State/Core/marketplace uninstall succeeded without file-in-use errors. The coordinator separately reported a desktop-host file-in-use problem in another environment while MCP processes remained alive. It was not inspected or reproduced here and is not counted as a local failure. Documentation can suggest closing specific owning tasks/hosts, without indiscriminate process termination.

No observed product issue blocked these requested small local deliverables. This is not a release decision or a conclusion about the separate formal study.

## Redaction and hash definitions

Complete prompts/final answers are retained except for deterministic substitutions: the machine-specific output link becomes artifacts/totals.csv; runtime UUIDs are omitted or consistently labeled; State record IDs become record-01/record-02 and the opaque export ID becomes export-01.json. The ten IF receipt IDs and export content digest remain exact. No reversible runtime-ID map is published.

Timestamps, terminal handles, machine argv paths, unrelated host instructions and raw State ledgers are omitted. Only synthetic statements needed to understand the State results remain in envelopes. This explicitly authorized archive does not change default plugin persistence.

Installation-tree fingerprints use SHA256 of compact JSON containing path-sorted {path,bytes,sha256} descriptors plus one LF. They are not Git tree object IDs or public JSON artifact hashes. Installed and fixed-commit contents use that same descriptor algorithm; Git tree IDs/object format are separately labeled. Manifest artifact hashes cover actual file bytes. The manifest excludes its own hash.

## Reproduce locally

Validate without private sources:

```sh
node build-public-evidence.mjs --verify
```

Rebuilding requires the retained private source directory, its sibling earlier-component evidence, and a repository containing the fixed commit:

```sh
node build-public-evidence.mjs --build <private-source-directory> <repository-directory>
```

The builder uses local Node and read-only Git object commands only. It sends no model/network request, never compares the current worktree, verifies original-source hashes, and writes only this directory. Validation checks counts, unchanged receipt correspondence, model/effort, all 27 file comparisons, cleanup accounting, published hashes, UTF-8/LF encoding and absence of machine paths, runtime UUIDs, original opaque State IDs and common secret patterns. Pattern scanning is not a universal secrecy proof.
