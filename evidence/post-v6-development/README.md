# Post-v6 development evidence

These are selected failure-derived development runs, not an independent holdout and not a release efficacy claim. `manifest.json` binds each run to its real Codex CLI/model settings, policy bytes, Git candidate, installed tree, original local summary hash, and published response rows. `runs.jsonl` preserves every response in those runs, including failures. It excludes local session IDs and machine paths.

## What changed

- A named decision-dimension list and a required-fact-before-drafting rule were removed. The list had treated cheap drafts as costly commitments. The library-duration case was itself mislabeled: its initial user prompt explicitly requested a fictional sentence, so asking for a real missing duration was not a valid requirement. Prompt bytes were not changed when that label was corrected.
- Broad fictional-fact policing produced awkward, repetitive prose. The retained facts-only rule applies only when the user explicitly requests that boundary; evaluator-only `facts_only` flags cannot invent a new user requirement.
- Removing the automatic feedback taxonomy preserved the expected move in five observed feedback cases. Removing an automatic micro-example clause preserved the requested examples in three comparison cases. This supports removing those clauses, not claiming that feedback or examples never matter.
- Quantity and placeholder checks exposed observable losses, so the compact policy retains supplied quantities/rules and requested placeholders. Later scope changes allow requested file/research work and cheap shared steps. Neither publicity nor style alone justifies an interview.
- A fixed comparison closing sentence appeared in ordinary instructions and incompatible tradeoffs. Replacing it with semantic guidance removed that spill in the observed runs, but candidate `288e54d` omitted an explicit mix/reject/free-reply invitation in two requested comparisons. Candidate `2b9101f` narrows the invitation to requested comparisons/options and includes it in all three repeated comparison cases.

## Current measured boundary

On `2b9101f`, all 17 first turns, five follow-ups, and 17 task deletions completed with exit code zero; there were no first-turn domain-tool or action items. Reversible drafts were delivered directly, three comparisons remained neutral with placeholders/examples and answer freedom, changed requirements were followed, and the actually missing list of five objects prompted only for that list. This is a routing and boundary observation, not a blanket semantic-quality score: for example, the card-game explanation still mentions an unsupplied ability mechanism, and the wall label's last words are awkward count-filling. The raw responses remain visible for that reason.

The earlier `288e54d` layout run recorded one command. Inspection of the native JSON event showed a read of the host's built-in ImageGen Skill instructions, not project-file work. The published raw action count is retained; historical metrics were not retroactively changed to hide it.

The new seven-case run on `2b9101f` was not started: the external-data reviewer required specific authorization beyond the approved 17-case corpus. Prior seven-case development results remain historical diagnostics; they do not establish the changed candidate's behavior.

`interrupted-run.json` records an earlier batch without a completed summary after a long host interruption. Its elapsed times and partial results are invalid for performance and efficacy; it is not counted as a model-quality failure or a successful run.

`dependency-audits.json` preserves the two authorized npm official bulk responses from 2026-09-07. Both returned HTTP 200 with zero advisories for the exact lockfile snapshots. This is a dated advisory snapshot, not a guarantee against future vulnerabilities; release CI must rerun the audits.

No public release gate is cleared by this directory. Run `npm run verify:evidence` at the repository root to reproduce hash, conversation-count, cleanup-count, and candidate-tree binding checks.
