# Post-v6 development evidence

These are selected failure-derived development runs, not an independent holdout and not a release efficacy claim. `manifest.json` binds each run to its real Codex CLI/model settings, policy bytes, Git candidate, installed tree, original local summary hash, and published response rows. `runs.jsonl` preserves every response in those runs, including failures. It excludes local session IDs and machine paths.

## What changed

- A named decision-dimension list and a required-fact-before-drafting rule were removed. The list had treated cheap drafts as costly commitments. The library-duration case was itself mislabeled: its initial user prompt explicitly requested a fictional sentence, so asking for a real missing duration was not a valid requirement. Prompt bytes were not changed when that label was corrected.
- Broad fictional-fact policing produced awkward, repetitive prose. The retained facts-only rule applies only when the user explicitly requests that boundary; evaluator-only `facts_only` flags cannot invent a new user requirement.
- Removing the automatic feedback taxonomy preserved the expected move in five observed feedback cases. Removing an automatic micro-example clause preserved the requested examples in three comparison cases. This supports removing those clauses, not claiming that feedback or examples never matter.
- Quantity and placeholder checks exposed observable losses, so the compact policy retains supplied quantities/rules and requested placeholders. Later scope changes allow requested file/research work and cheap shared steps. Neither publicity nor style alone justifies an interview.
- A fixed comparison closing sentence appeared in ordinary instructions and incompatible tradeoffs. Replacing it with semantic guidance removed that spill in the observed runs, but candidate `288e54d` omitted an explicit mix/reject/free-reply invitation in two requested comparisons. Candidate `2b9101f` narrows the invitation to requested comparisons/options and includes it in all three repeated comparison cases.

## Pre-v7 measured boundary

On `2b9101f`, all 17 first turns, five follow-ups, and 17 task deletions completed with exit code zero; there were no first-turn domain-tool or action items. Reversible drafts were delivered directly, three comparisons remained neutral with placeholders/examples and answer freedom, changed requirements were followed, and the actually missing list of five objects prompted only for that list. This is a routing and boundary observation, not a blanket semantic-quality score: for example, the card-game explanation still mentions an unsupplied ability mechanism, and the wall label's last words are awkward count-filling. The raw responses remain visible for that reason.

The earlier `288e54d` layout run recorded one command. Inspection of the native JSON event showed a read of the host's built-in ImageGen Skill instructions, not project-file work. The published raw action count is retained; historical metrics were not retroactively changed to hide it.

The seven-case run initially stopped for specific external-data authorization. After that authorization, candidate `16c4b19` (the same core runtime tree as `2b9101f`) completed seven first turns, four follow-ups, and seven native task deletions. Four costly unresolved cases asked for a priority; the resolved, shared-step, and disposable-sample controls delivered directly. No first-turn tool or action items occurred. This remains a development boundary check, not a blanket semantic-quality or release-efficacy score; the compatible-priority question still appends a generic invitation to propose a mix, and the raw wording is preserved. Its isolated installation and authentication copy were removed after the run.

`interrupted-run.json` records an earlier batch without a completed summary after a long host interruption. Its elapsed times and partial results are invalid for performance and efficacy; it is not counted as a model-quality failure or a successful run.

## Post-v7 repair regression

Candidate `b025222` repeated only the 17 explicitly authorized post-v6 cases on the repaired 1,496-byte policy. All 17 first turns, five follow-ups and 17 native task deletions completed without retries or first-turn actions. Source, fixed Git and fresh-installed core trees matched SHA-256 `7048d10c8f1f501200967dc00c0bb796b90ff0f275652d768ac4cdbc2dec1363` (14 files, 35,535 bytes). The runner used Codex CLI 0.153.4, `gpt-5.6-sol`, low reasoning and two workers; its trusted-Hook execution path is not the separate normal-trust user acceptance test.

Observed routing remained intact: cheap drafts were direct, three requested comparisons preserved neutral alternatives and mix/reject/free-reply invitations, four feedback cases followed the changed request, and one genuinely missing object list prompted only for that list. This does not establish that the newly added costly-decision clauses help, because these 17 controls do not test those failure branches. Nor is it an all-content-pass score: the requested 130-word abstract has 131 whitespace-delimited words, and the card-game explanation still adds an unsupplied ability mechanism. The 110- and 70-word labels meet their exact counts. All original responses are retained.

The seven costly-branch cases, three v7 failure probes, component-removal runs and prospective grader calibration have not been rerun on this candidate. One fresh independent 80-case paired confirmation and blind grading is authorized but has not started; no holdout success is claimed.

For this 17-case repair run, official core-plugin and marketplace removal both returned exit zero. On 2026-09-07 at 08:11 UTC, the exact isolated home, its authentication copy and the empty test workspaces were verified absent; raw results and the installation inventory remained present. This cleanup does not assert that all older project-created environments or final build dependencies have been removed.

`dependency-audits.json` preserves the two authorized npm official bulk responses from 2026-09-07. Both returned HTTP 200 with zero advisories for the exact lockfile snapshots. This is a dated advisory snapshot, not a guarantee against future vulnerabilities; release CI must rerun the audits.

No public release gate is cleared by this directory. Run `npm run verify:evidence` at the repository root to reproduce hash, conversation-count, cleanup-count, and candidate-tree binding checks.
