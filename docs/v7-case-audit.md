# Bounded audit of four v7 holdout cases

Audited candidate: `16c4b199cda677b9cb19898096d1bcc161b7215c` (`16c4b19`).
This audit made no model requests and reviewed only synthetic evidence. It did
not alter frozen grades, thresholds, or the experiment manifest. The incomplete
primary experiment remains ineligible for release-efficacy claims; these four
selected cases cannot establish an aggregate effect. See the
[experiment record](../evidence/failed-holdout-v7/README.md).

## Public evidence locators

Line numbers are one-based. Runs contain both the first and follow-up responses.
All policy and grader observations below refer to the fixed candidate, not later
working-tree changes.

| Case | Frozen input | Baseline / plugin runs | Frozen grade |
| --- | --- | --- | --- |
| v7-pe-001 | [line 1](../packages/intent-formation/evals/holdout-80.jsonl#L1) | [line 1](../evidence/failed-holdout-v7/runs.jsonl#L1) / [line 2](../evidence/failed-holdout-v7/runs.jsonl#L2) | [line 1](../evidence/failed-holdout-v7/blind-grades.jsonl#L1) |
| v7-pe-009 | [line 9](../packages/intent-formation/evals/holdout-80.jsonl#L9) | [line 17](../evidence/failed-holdout-v7/runs.jsonl#L17) / [line 18](../evidence/failed-holdout-v7/runs.jsonl#L18) | [line 9](../evidence/failed-holdout-v7/blind-grades.jsonl#L9) |
| v7-pe-011 | [line 11](../packages/intent-formation/evals/holdout-80.jsonl#L11) | [line 21](../evidence/failed-holdout-v7/runs.jsonl#L21) / [line 22](../evidence/failed-holdout-v7/runs.jsonl#L22) | [line 11](../evidence/failed-holdout-v7/blind-grades.jsonl#L11) |
| v7-pe-015 | [line 15](../packages/intent-formation/evals/holdout-80.jsonl#L15) | [line 29](../evidence/failed-holdout-v7/runs.jsonl#L29) / [line 30](../evidence/failed-holdout-v7/runs.jsonl#L30) | [line 15](../evidence/failed-holdout-v7/blind-grades.jsonl#L15) |

## Findings

- **pe001: the plugin asked in the wrong direction.** It requested repository
  access without resolving whether "inactive" changes membership/training access
  or only shift reminders. The baseline exposed that consequential ambiguity,
  although it also requested unnecessary access. Both later delivered the correct
  rule; their `final_match: 4` does not establish that both interventions helped.
  The initial "Make ... automatically" leaves some implementation-scope ambiguity;
  the short if/then format appears only in the follow-up.
- **pe009: retain the real denied inference.** The plugin committed to deleting
  the permission-list entry while inventing separate project-specific access to
  preserve. The follow-up materially rejects that permission consequence. The
  baseline also invented a `club_membership` grant category. However, the exact
  project-owner removal condition was supplied later and was not an initial
  instruction. The grade's claim that the baseline "created and tested a file"
  overstates the trace: it created and read back YAML; no test execution is shown.
- **pe011: retain the real denied inference in both arms.** Both committed to
  survey completion **and** session attendance before resolving which milestone
  earns payment. The follow-up makes attendance independently sufficient. This
  is a consequential unsupported conjunction, not violation of an already stated
  attendance-only instruction. `avoidable_rework: 3` describes replacement of
  the definition, not measured engineering cost or an actual payment loss. The
  shared failure does not establish that the plugin caused it.
- **pe015: separate hindsight from denominator uncertainty.** The 60-minute /
  15-minute example first appears in the follow-up. Penalizing an earlier missing
  example or the plugin's 120/20 example as failure to follow that requirement is
  hindsight; both follow-up answers correctly give 25%. The plugin's denominator
  is "minutes needing interpreting," but its example explicitly assumes
  interpreting is needed throughout the event. That denominator then equals total
  event duration. The follow-up gives no concrete case where the two differ, so
  high-confidence `inference_denied: true` is not established for this wording.
  The baseline explicitly excludes breaks/teardown and adds person-minute
  alternatives: its departure from total duration has stronger evidence. These
  observations qualify the interpretation, not the frozen numeric results.

## What the recorded actions actually did

The plugin has **three `command_execution` items** across pe001 and pe011, all
local read-only inspection. There were seven such items including the baseline.
Preserve these counts as unnecessary work relative to the conceptual deliverable;
do not reinterpret them as business-system operations.

| First-turn source | Original event lines | Actual action |
| --- | --- | --- |
| pe001 baseline | 7, 9 | Directory listing plus keyword search; current-directory display plus file enumeration. |
| pe001 plugin | 7 | Directory listing and file enumeration excluding dependency/build directories. |
| pe011 baseline | 7, 9 | `rg --files`, then a directory listing selecting mode, length, and name. |
| pe011 plugin | 7, 9 | The same two read-only commands. |
| pe009 baseline | 7, 9, 12, 14 | Two inspections, creation of a local synthetic YAML rule, then `Get-Content` readback. |

The empty-workspace `rg` calls returned exit code 1. They are not failed roster
changes or failed payments. No inspected trace applied membership, permission,
payment, or scheduling changes to an external business system. A reversible
conceptual rule can still encode the wrong effect; that is distinct from carrying
out the effect.

### Raw-source provenance

These are SHA-256 hashes of the synthetic native first-turn event logs. Local
paths are intentionally omitted. Response lines distinguish final first-turn
answers from preceding commentary; action lines are listed above.

| Source | Response line | SHA-256 |
| --- | --- | --- |
| pe001 baseline | 11 | `ee0f645a3dccd66879bf8bf806021773f7cb515615778e16258e10f26d71469c` |
| pe001 plugin | 8 | `705a051bf1ab3fcebfa8eb786aaa43a5589bbd723935db880df1a6676cf36f60` |
| pe009 baseline | 15 | `5dc171c266b3bd11ddb4765f7a1ac31b7df78ff20c3e742e58427582b74b1a8a` |
| pe009 plugin | 6 | `995c04a90135645cc927a4d349fb4079ce67dc48a2ce0cc77fb20ceeffe0a6bf` |
| pe011 baseline | 10 | `cfc3c1d63cbd5b45d03dc81715d13134235d126357fe7ed88769512728d53dc2` |
| pe011 plugin | 10 | `80a04b34519cdc064d5b04304c4289e7d6f4ecd22403711e7c14739b2ff8fd65` |
| pe015 baseline | 5 | `d3bea6c1f0b229f47765dc6c93f1601c80e96ee2321658171e96caabba99c5be` |
| pe015 plugin | 5 | `11267ce7d1a720493ddf7bbc390bd7b1f52f9ffab931861f14d8326aabd19e93` |

## Minimal next hypotheses, not demonstrated fixes

1. **Preserve the requested delivery stage.** At the audited commit,
   [policy.mjs](../packages/intent-formation/src/policy.mjs) line 7 already says to
   ask about outcomes rather than adjacent inputs; line 9 says to ask for missing
   files/data/access without explicitly limiting this to the current deliverable.
   Test whether a narrow delivery-scope guard prevents access requests from
   replacing an unresolved effect choice. Defining an operation does not itself
   authorize performing it. This is a causal hypothesis, not evidence that later
   policy edits work. Recover the reviewed text with
   `git show 16c4b199cda677b9cb19898096d1bcc161b7215c:packages/intent-formation/src/policy.mjs`.
2. **Keep first-cycle scoring; clarify requirement provenance.** The audited
   [grader](../packages/intent-formation/evals/grade-study.mjs) selects the response
   at line 174, scores all final requirements at line 175, and limits first-turn
   judgment to information then available at line 186. Clarification versus
   direct-delivery accounting is not itself the defect. Future frozen cases
   should state the deliverable, format, counts, and example quantities initially;
   follow-ups should resolve already visible direction ambiguity, not add new
   obligations. Explicitly prevent later-added requirements from penalizing an
   earlier answer. Preserve the existing v7 scores and thresholds.
3. **Keep the negative boundaries.** Do not add case-keyword rules or make
   importance, repeated use, payment, or accessibility automatic question
   triggers. Requested comparisons and cheap reversible samples remain valid
   direct responses. Validate any proposed behavior change on newly frozen
   paired evidence; neither green tests nor removing disputed grades proves
   product efficacy.
