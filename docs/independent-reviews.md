# Independent candidate reviews

Two separate agents reviewed candidate `2b9101f9fc99ab0874f05a5d1e80b03b070de6a0`; actual model-mediated use later ran on the identical runtime at `16c4b199cda677b9cb19898096d1bcc161b7215c`. These are agent reviews, not human-user research. The original privacy review is closed in its fixed scope. Six earlier real-use cases and the separate two-case continuity check below are complete.

## Final confirmation and goal review

On 2026-09-07, the adversarial agent independently checked the final six-file
archive against the raw runs, grades, frozen sources and candidate `3dd8ab2`.
It confirmed 160 attempts, 159 usable conversations, 79 complete pairs, 279 user
turns, one unreplaced baseline timeout and 160 successful native task deletions.
All 16 grading batches succeeded on their first attempt. Public runs and grades
match their original records after the disclosed sanitization. Hash bindings and
privacy scans passed; the one secret-pattern redaction was a fictional color,
not a credential. No public-archive blocker remained. This is not product-release
approval. The reviewed archive manifest SHA-256 is
`0c4b84ded946216534780ce509e05981a778a46178f9e7f7b193f80b60835e8f`.

The independent goal reviewer recomputed the 79-pair scores and read six selected
cases in detail, without new model calls, rescoring, or overwriting original grades.
Baseline/plugin final-match totals were 302/307 out of 316: a 1.58-percentage-point
gain, below the frozen 10-point gate. With 67 baseline full scores, even a perfect
plugin could gain only 4.43 points. Ordinal rework fell from six to two points;
this is not measured human time. Most blind preferences were ties (57 of 79).

The local case review found both value and friction. In `fc-uf-015`, the plugin
delivered the requested table in chat rather than creating an unrequested file.
In `fc-pe-006` and `fc-cl-005`, extra choice invitations added avoidable friction.
`fc-pe-001` raised a possible hindsight penalty for a priority introduced later;
`fc-uf-006` raised doubt that a procedural rework penalty represented actual
rewriting. These are bounded review observations, not replacement scores.

Both reviews support publishing the inspectable implementation and unchanged
negative evidence, finishing cleanup, and stopping this round. No extra model,
replacement case or new grader is needed. The Core-only final confirmation does
not establish State-only benefit or human market demand. The separately observed
ordinary-feedback State path is described below. Final physical cleanup happened
after these reviews and is recorded separately in the
[root cleanup receipt](../evidence/local-cleanup-20260907.json).

## Natural-feedback connection: 2026-09-07 development delta

The independent goal audit found a missing connection between ordinary user feedback
and the otherwise functional State tools. The [current goals](current-goals.md) put
that connection ahead of further evaluation tuning. The implementation reuses the
existing host, tools and store; it adds a small shared context formatter, not a new
semantic Hook or record abstraction.

The adversarial reviewer tested this delta on Node 20.19.1, without model requests.
It found a late off-mode check missing from recovery, a full-JSON size overshoot,
and missing record scope in the recovery projection. All three were fixed. Final
targeted rechecks observed off overrides in ordinary/resume/compact paths; a valid
360-quote record produced 2,917-byte ordinary output and 2,827-byte recovery output.
Recovery omitted the complete oversized record with `omitted: true`, not broken JSON.
Ordinary prompts did not alter ledger bytes; unstarted/private tasks stayed quiet.
The reviewer's synthetic temporary state was deleted. No blocker remained in scope.

Exact reviewed source SHA-256:

| File under packages/intent-formation | SHA-256 |
| --- | --- |
| src/continuity.mjs | bd72ef6455dcc11567d96d741f9ec64d9f62d65281672de8129c35c211df5720 |
| hooks/intent-command.mjs | 265793b0c860aef1a320e0fc1d6085a36f8d2c6b7f8a21e21f9c5fa246d5ab0c |
| hooks/intent-check.mjs | b2db4f04bfa3f4a260ac2e9e397a5a9b225b92d229744aaf0aba6b326b8a3c22 |

The main agent ran 124 source tests before the final size/off tightening, then all
26 final Hook tests on Node 20.19.1, the root evidence/package suite, and both
generated-plugin validators. These are implementation checks, not efficacy results.
The separate [continuous-loop archive](../evidence/continuous-intent-loop-20260907/README.md)
binds two synthetic cases / six real user turns to `c970c28`, with all 27 installed
Core/State files matching fixed source. After one start, ordinary feedback produced
five successful sourced MCP writes: an initial goal, an implementation correction,
a true goal supersession, an explicit label constraint and an unknown icon choice.
Actual Hook `turn_id` values matched the native turns and MCP sources. Fresh-process
resume injected the current records; a separate non-activated opt-out task delivered
correct files without State writes. Fifteen scoped consistency checks passed.

Ordinary resume retains conversation history; this proves persistence/reload, not
State-only causality or a time saving. The reviewer retained one failed non-Git
verification command, one failed no-prompt onboarding-task deletion, installation
friction and the sparsity question raised by retaining layout-only feedback. Both
actual model tasks, plugins and marketplace were removed successfully; the exact
temporary home/authentication, snapshot and synthetic workspace were verified absent.
No extra grader, compaction request, retry or Hook-trust bypass was used. The later
`9e9c465` automatic-policy deletion was not part of these six turns; the three
continuity-source hashes above are unchanged.

The older evidence and review manifests below remain unchanged and bound to their
original commits. This delta review does not silently approve a new release.

## Adversarial review

The reviewer independently reproduced five original defects and nine follow-up privacy/recovery boundaries, then reran the fixed 14-case set on Node 20.19.1. Both scripts exited zero. No remaining material blocker was observed within that scope. One probe script still printed its older hard-coded commit label; actual HEAD was checked before and after and was the candidate above.

Accepted and fixed:

- Conditional text appended to forget/private/off/export could be ignored. Extra arguments now cause no-change rejection without a success receipt.
- A short-lived Hook could acknowledge private memory that disappeared on exit, or imply access to another process's private records. Private remember/feedback/show/correct now refuse that path honestly.
- Losing primary erasure tokens before recovery cleanup could leave text on retry. Recovery scrubbing now precedes primary replacement and fault-injected retries are covered.
- Generic shared tokens or same-task IDs could erase unrelated corrupt fragments. Identified unrelated tasks/records, including identical content, are preserved.
- Parseable JSON that was not a valid event could evade recovery erasure. It now follows the same matching-content cleanup boundary.
- Concurrent task recreation could produce a false forget success receipt. The MCP success path now requires verified absence at its deletion point.
- Private task titles and workspace hashes could persist through create/reset/import/reaffirmation. Private markers omit them, and re-entering private mode repairs legacy content.

Source and generated fingerprints were stable before and after the rerun. The generated State server is `c9d26b974d25d09a698846ce3ae75d22f97daa6dbfd054875927fef6ca4614a7`; the command Hook is `cd04915c0fb155f2d4b0916c85fadc0489ddb508cc7ab528ec072596190e8f07`. Permanent source regressions preserve the accepted failure cases. Synthetic test state was removed.

## User-perspective review

The second agent first authored and sealed the new 80-case corpus without reading product code or prior corpora. Only after sealing did it install and read the product. It did not use the sealed cases as practice prompts or change them after exposure.

Actual CLI 0.153.4 / Node 22.19.0 installed core and State 0.3.0-beta.1 into a fresh temporary home. All 14 core files and 13 State files matched the source distributions byte-for-byte. Nineteen local component assertions passed across save, show, correction, actual export files, private disk purge, process-memory retention/restart loss, off overrides, and forget. The preserved artifacts are [component observations](../evidence/independent-reviews/local-acceptance-results-v7.json), [per-file fingerprints](../evidence/independent-reviews/install-fingerprints-v7.json), and [cleanup receipt](../evidence/independent-reviews/cleanup-v7.json).

**Evidence boundary:** the Hook was invoked directly with a synthetic host envelope; MCP calls were local component calls. The agent made zero model requests, zero Codex resume requests, and used no Hook-trust bypass. It did not verify real Codex chat trust, model-driven file changes, or reaction to a model sample. The 19th assertion's original label says forget removes off, but the task had already returned to standard before deletion; that observation cannot independently prove removal of an actively off marker. The raw record is preserved with this qualification.

Accepted beginner-documentation improvements:

1. Warn before installation commands when the requested public tag is unavailable.
2. Add show → copy record ID → correct → show, explaining that correction retains history.
3. Put standard/private/off command availability in a compact table and state that private has no equivalent beginner slash-write path today.
4. Explain that the receipt's SHA-256 covers structured export content, not all formatted file bytes, and provide a local verification command.
5. Avoid describing the optional State bundle as a trivially small script or implying that trust checks can be skipped.

These were implemented in the README, Chinese guide, and export-verification document. They did not substitute for actual conversational acceptance. At that historical stage, new synthetic model cases were not sent because the external-data reviewer required authorization beyond the specifically approved 17-case corpus. Additional authorization was subsequently obtained for the separate real-use phase below.

## Actual model-mediated use on 16c4b19

The user-perspective agent completed six independently written synthetic cases and 22 actual user turns on `gpt-5.6-sol / low`, without a baseline and without Hook-trust bypass. It used the normal interactive trust UI, reviewed the exact commands, and confirmed all three Hooks Active before model use. Native exec/resume then used that same isolated home. Twenty-two is the number of user turns, not the number of underlying model API calls. The [public real-use archive](../evidence/real-user-acceptance-v7/README.md) preserves complete synthetic prompts/answers, trusted receipts, fixed-Git installation proof, real CSV output and cleanup results with disclosed identifier/path substitutions.

The delivered CSV was correct and its input hash stayed unchanged; a requested Chinese comparison led to a concrete selected card; an incompatible deletion/retention request prompted a useful priority question; feedback changed a recruitment sample into an existing-member reminder. The delegated reversible order-rule case needed one correction but did not authorize or perform a real payment; the reviewer retained it as a transparency improvement, not a proven mandatory-question failure.

State start/remember/show/correct/export/private/off/forget produced ten success receipts matching trusted Hook results. Private show and off-mode remember were honestly refused without success receipts. Forget ran directly from off and left zero event bytes, off markers and managed exports. The private cross-process memory experience remains component-level evidence, not a newly supported beginner slash path.

Observed friction is retained: one unnecessary git-status failure; private show only pointing to a live MCP tool; the model's export answer omitting the content digest despite the Hook supplying it; terminal navigation and sandbox onboarding. The export omission motivated a direct Hook instruction repair plus Skill alignment, which is not yet a confirmed model fix.

All six model sessions were deleted with the official CLI, followed by official removal of both plugins and their marketplace. Two no-prompt onboarding UUID deletions failed; neither had a session file, and the exact isolated home and workspace were subsequently removed. Those two failures are not reported as native-delete successes. The original 19 local checks remain unchanged and separate.

## Post-v7 outcome audit

The adversarial agent separately audited four v7 cases without model calls. Its [case audit](v7-case-audit.md) retains real effect-selection and misplaced-access problems, distinguishes local read-only commands from external operations, and identifies a later-added-number grading error plus an uncertain denominator interpretation. Original grades and gates remain unchanged.

The agent removed its temporary State/core/marketplace installation, authentication copy, state, and empty workspace. Session count was zero. Its original authentication source, repository, four sealed files, and evidence were preserved. No privacy limitation was rejected or silently waived, and no additional product framework was added to address the feedback.
