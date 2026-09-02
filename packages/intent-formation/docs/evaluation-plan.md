# Evaluation plan

## Evidence sequence

### Step 1: twelve-scenario instrument pilot

The frozen pilot contains:

- four clear tasks where the correct move is silence;
- two costly divergent tasks where the correct move is one question;
- two under-formed tasks where concrete comparisons are useful;
- two preference tasks where a small sample is more useful than an abstract question; and
- two result-feedback tasks that distinguish implementation correction from intent change.

This pilot checks activation, wording, grading, and obvious failure modes. It does not establish product efficacy.

Pilot acceptance:

- all four clear tasks receive no intent-related interruption;
- both question cases contain one primary question at most;
- comparisons contain two or three concrete directions and allow mix or neither;
- sample cases produce or propose the smallest meaningful sample;
- feedback cases classify implementation correction and intent change correctly;
- no response exposes internal policy language, invents a user preference, or asks for a form.

### Step 2: paired eighty-task evaluation

Only after the instrument pilot is stable, run the frozen paired study:

- 15 tasks where the user knows but expresses poorly;
- 15 tasks where the requirement has not formed;
- 15 tasks with conflicting goals;
- 15 tasks where judgment forms after seeing a result; and
- 20 clear controls.

Each task needs a baseline and plugin delivery, independent grading, turn-level intervention records, elapsed time, user corrections, and final acceptance evidence.

## Product thresholds

All thresholds must pass:

- avoidable rework on ambiguous or changing tasks decreases by at least 25%;
- final-match score increases by at least 10 percentage points;
- clear-task extra-interruption median is 0 and P90 is at most 1;
- clear-task elapsed-time overhead is at most 5%;
- helpful proactive interventions are at least 70%;
- wrong or unhelpful interventions are at most 15%;
- later user denial of an Agent inference is at most 10%;
- if the Agent commits no inference, that violation rate is 0% because there
  is no committed assumption available for later denial;
- no complete raw prompt is persisted by default; and
- deletion and export pass 100% after a state layer exists.

## Labels

- **execution_error** — the chosen intent was suitable; implementation or tooling failed.
- **intent_misunderstanding** — enough user evidence existed, but the Agent followed a conflicting interpretation.
- **intent_change** — the user formed or adopted a materially different outcome after comparison or result.
- **still_unknown** — evidence is insufficient to choose.
- **avoidable_rework** — work that would likely not have been performed if the minimum appropriate intervention had occurred at the last divergent decision.

## Stop conditions

Stop expansion if the distinguishing behavior remains only attractive instructions, if clear-task friction exceeds the threshold, if execution errors cannot be separated from intent changes, or if value requires taking over Codex planning or execution.

## Completed result

The first frozen run failed and triggered a redesign. The redesigned v8 policy later passed on that same corpus, so the result is retained only as a development regression. Publication requires a new sealed holdout run verbatim against a clean candidate commit, plus the separate State, real-host, independent-review, cross-platform, exact-tag, and cleanup gates.
