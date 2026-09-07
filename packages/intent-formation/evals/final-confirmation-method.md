# One-time final confirmation

Frozen on 2026-09-07 after the independent goal audit. This is the one remaining
authorized 80-case confirmation, not another development loop. Older v7 author
files, corpus, grades and failures remain unchanged.

## Frozen inputs

The independent author created one 80-case set without reading product policy,
old corpora, model outputs or calibration material. The author records and separate
seal are preserved byte-for-byte in `seals/final-confirmation-20260907/`.
Pre-execution repairs are fully logged: visible-premise/chronology defects, three
incorrect mandatory-question labels, and six explicit-request metadata overrides.
No user prompt was run against a product or grader before sealing.

The root's overlap report covers 19 source snapshots / 686 records, including the
old development and holdout corpora and both user-perspective archives. Thresholds
remain token-set Jaccard < 0.65 and code-point 4-gram Dice < 0.72. Low lexical
overlap does not establish semantic independence. Distinct toy domains still share
themes such as invented exhibits and games.

The Core tree is the tested without-settled-clause variant, unchanged since public
commit `9e9c4650d3dc55dba6e41bec878f8958dbc10d79`. The final manifest binds its
complete tree and the exact runner, grader, schema, protocol and analysis bytes.
The actual clean Git candidate and installed tree are recorded by `run-study.mjs`.

## One execution

Use the existing runner with this sealed corpus, both arms, two pair workers,
alternating AB/BA, and sequential arms within each pair. Both arms use
`gpt-5.6-sol`, low reasoning effort and the unchanged 300,000 ms turn timeout.
There are 160 primary conversations and at most 280 user turns. No primary retry,
replacement pair, alternate model or replacement holdout is permitted.

Use an isolated Codex home and empty per-arm workspaces. Disable all non-target
plugins and State; the baseline also disables Core. The existing reviewed Hook
trust bypass is a study setup control, not normal-user installation evidence.
The separate two-case / six-turn archive exercised normal trust and sourced State
continuity; this Core study does not establish State-only recovery efficacy.

Blind grading uses the same v4 prompt and v3 output schema as the completed
calibration: batches of five, two workers, low effort on `gpt-5.6-sol`, and the
existing 240,000 ms timeout. The runner's maximum two attempts only handles
operational/format failure; retain both attempts. Do not regrade a valid result.
The six per-case false overrides correct request metadata, not scoring definitions.

## Decision and stopping rule

Require all 80 usable primary pairs and unchanged joint gates: rework score reduction
at least 25%; first-cycle match gain at least 10 percentage points; clear-task extra
interruptions median 0 and P90 at most 1; clear paired median latency overhead at
most 5%; helpful proactive interventions at least 70%; wrong interventions at most
15%; denied committed inferences at most 10%; no premature non-clear first-turn
actions and no complete-prompt persistence. Export/delete, source, host, package,
independent review and exact-release gates remain separate requirements.

If a primary run fails, keep it. Any grading of only usable pairs is diagnostic and
cannot satisfy the 80-pair gate. If the final confirmation fails, publish its actual
results and stop expansion; do not tune against it or issue a v0.3 release.

Even numerical success is not sufficient: calibration exposed semantic mistakes.
The existing independent-review gate must resolve release-affecting judgments.
Unresolved disagreement blocks release; manual rescoring cannot manufacture a pass.
Synthetic ordinal rework is not measured human time, market demand or DeepSeek
model efficacy. Delete task-created native conversations, installations, State,
temporary credentials and obsolete dependencies/caches after preserving evidence.
