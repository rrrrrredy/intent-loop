# Fixed-source usability and known-failure regression

These are nine synthetic user turns in two separate Windows Codex tasks, not an independent efficacy study. The original final 80-case failure and release decision are unchanged.

## What was actually used

Both tasks installed the public Git commit into a fresh disposable Codex Home. All 27 Core/State files matched that fixed Git source. Normal interactive review changed three Hooks from inactive to active; no copied trust or bypass was used. Codex CLI 0.153.4 then ran `gpt-5.6-sol / low` through native exec/resume. Counts below are user turns, not underlying model API requests. No primary turn was retried.

| Check | Source | Observed result |
| --- | --- | --- |
| Six-turn natural-feedback trial | `93fb105300d70e3a90a1ff41c562eba88f352b99` | Start, create a two-sentence library note, shorten it, change its purpose, show, forget. All three actual file versions met their scoped requests. The goal was naturally recorded and superseded, but old implementation feedback incorrectly remained active. |
| Three-turn seeded regression | `73865b698e9a94a90b1a031a2942a7c29f0b063f` | Start, change the note's purpose, show. Between the first two turns, the operator inserted one synthetic goal and two synthetic feedback records through existing local service APIs. The model corrected the goal, invalidated only the conflicting feedback, retained compatible feedback and history, and produced the correct file. |

The regression's starting records are explicitly a local fixture, not naturally captured historical user turns. The six-turn trial is the original failure observation; the three-turn check is a targeted regression, not an A/B experiment or replacement holdout.

## Visible work and the defect

The natural trial's file evolved from a note for return volunteers to a shorter note, then to:

~~~text
Bring chosen books to the desk.
Ask a librarian for a library card.
~~~

The old instruction to begin with "Put returned books" still appeared beside that new goal in State and `/intent show`. It did not corrupt this file. Future misuse after recovery was a risk, not an observed failure in this trial.

The repair adds one State-context instruction: use the existing invalidation tool for earlier feedback that directly conflicts with a changed goal, while keeping other feedback and history. It adds no tool, schema, storage, semantic Hook or Core policy. The targeted local suite passed 38 Hook/package checks; the repaired commit passed all 18 jobs in its [exact CI run](https://github.com/rrrrrredy/intent-loop/actions/runs/34179922088).

In the seeded regression, the model actually called `intent_correct` followed by `intent_invalidate`. "Use plain words" remained active. The final show listed only the new borrowing goal and that compatible feedback. Both superseded/invalidated records remained in history. The new output was:

~~~text
Bring your chosen books to the desk.
Ask a librarian for a library card.
~~~

## Retained friction and evidence limits

- One auxiliary `git diff` returned exit 1 because the disposable workspace was not a Git repository. The file had already been changed and successfully read back. That failure is retained, without a model rerun.
- The first interactive onboarding encountered a terminal warning and sandbox setup prompt; exit keystrokes unintentionally started normal setup. The second onboarding intentionally completed normal setup and observed "Sandbox ready". Neither used a trust bypass.
- Manual control answers contained receipts, and saved State matched the observed operations. These runs did not independently capture the trusted Hook receipt payload, so exact answer-to-Hook receipt matching is not claimed. Actual MCP results and their success receipts are captured.
- Source references agree between MCP arguments and saved records. The public native exec `turn.started` events did not contain a turn ID, so independent native-turn-ID matching is not established here.
- Resume also supplies conversation history. There was no forced compaction, State-only recovery comparison, human participant, human time measurement, or independent efficacy assessment.
- The user-view agent inspected the actual files, MCP events and State snapshots, first identified the stale-feedback defect, and then confirmed the targeted repair. A separate adversarial agent found no blocker in the narrow source change. These are agent reviews, not human-user research.

## Public artifacts and cleanup

`observations.json` retains the exact synthetic prompts, final answers, file contents, state snapshots, installed file hashes and relevant tool results. Native IDs and local paths have consistent substitutions. Long shell outputs are explicitly truncated. Raw stderr is excluded because it contains host diagnostic URLs; raw evidence file hashes remain in `manifest.json`. No reasoning stream, authentication, real user prompt or personal configuration is published.

Official commands removed both actual model tasks, both plugin installations in each Home and both trial marketplaces. Two empty onboarding task-delete commands returned exit 1; these are not reported as successes. The exact disposable Homes/workspaces were subsequently removed, including their authentication copies and all remaining state. Temporary build dependencies/cache were removed too. The cleanup preserved 81 existing raw files; daily inventory showed zero Intent plugins and 14 unrelated plugins, untouched. See `cleanup.json`.

This archive proves limited source-use observations, not market readiness. The [source trial](../../docs/source-trial.md) remains developer-only, and the [original release gate](../../docs/release-decision.md) remains unmet.
