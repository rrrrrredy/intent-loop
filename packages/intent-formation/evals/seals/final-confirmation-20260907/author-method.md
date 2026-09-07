# Independent synthetic authoring record

Status: prepared_for_seal  
Author revision: 3 (one original set, repaired before any execution)  
Authoring date: 2026-09-07

## Scope and independence

This is the single original 80-case set commissioned for a one-time final confirmation experiment. The author used only the supplied task specification and the cases being authored. No previous tasks, memory, old case libraries, product source, model outputs, web pages, credentials, or calibration contents were inspected. No test model API, product, grader, or delegated agent was run.

All case worlds, names, counts, objects, and events are invented. Every task can be answered offline from its own messages in an otherwise empty directory. Deliverables remain text in the original chat: copy, tables, lists, short scripts, arithmetic, or other explicit small artifacts. There are no real accounts, files, professional medical/legal/investment questions, publication actions, or live facts to obtain.

All authored files reside in this directory. Directory creation required the parent D: scratch path as the setup working directory; no project was inspected there. A read of the system apply_patch launcher and direct invocation of its implementation resolved Windows multiline argument handling. The apply_patch implementation resides on C: as a necessary global-tool exception; no C: project or user data was inspected or modified.

## Composition and interpretation

| Class | Cases | English | Chinese |
| --- | ---: | ---: | ---: |
| poorly_expressed | 15 | 11 | 4 |
| unformed | 15 | 11 | 4 |
| conflict | 15 | 11 | 4 |
| preference_after_result | 15 | 11 | 4 |
| clear | 20 | 16 | 4 |
| Total | 80 | 60 | 20 |

There are 80 distinct short domain labels, 60 fixed follow-ups, and 20 null follow-ups. Feedback kinds are keep 6, implementation_change 4, intent_change 4, and uncertain 1.

The current expected first-action shapes are question 18, comparison 8, sample 20, and direct_delivery 34. Fourteen non-clear cases support immediate useful delivery: seven poorly expressed prompts with a usable shared draft or concrete interpretation, three unformed larger projects with useful common next steps, and four conflicts whose priority or correction rule is already specified. Revision 1's question 21 / direct_delivery 31 counts were corrected after the three material common-delivery label defects described below.

A requested comparison or exploratory sample is itself useful delivery; its label does not imply an extra permission turn. A complete answer followed by an optional question remains direct delivery. Clear controls include requested multiple styles, a finished comparison, and an email draft containing a question for a fictional recipient. None of those calls for an additional question to the current user.

Every non-clear prompt makes its eventual artifact, delivery surface, format or quantity, supplied example values, and relevant fictional premises visible initially. Its fixed follow-up either selects a visible fork, confirms an inexpensive completed direction, evaluates the requested sample, or keeps both visibly allowed directions. It is sufficient to complete the requested artifact on the next turn without further interviewing. Final requirements describe the final artifact, not a demand to turn a requested first-turn sample into the final artifact prematurely.

The four intent-change cases expressly call the first result exploratory, state the possible alternate direction initially, and retain the same kind of final artifact after feedback. Implementation changes keep the underlying purpose and contents while selecting presentation options already exposed initially. Keep feedback accepts the proposed direction; uncertain feedback retains two already permitted directions.

## Author checks

Run from this directory:

    node .\validate-author.mjs

The validator is a small self-contained Node script using only built-in file/path modules. It reads author-80.jsonl, prints its report, and writes nothing. It checks JSONL structure, exact required fields, the six authorized optional boolean request-metadata overrides, IDs, class/language/feedback counts, unique domain labels, fixed/null follow-ups, move labels, nonempty arrays, and exact contiguous excerpts.

All 266 final-requirement strings passed strict case-sensitive substring checks against one initial prompt or one fixed follow-up. Of these, 209 occur in the initial message and 57 occur only in the follow-up. Cross-message concatenation is never used for excerpt validation. A minimum of 12 non-whitespace Unicode code points serves as a small mechanical guard against trivial fragments; semantic meaningfulness was separately reviewed by the author.

Similarity normalization is Unicode NFKC, lowercase, and whitespace collapse. The required token regex is:

    /\p{Script=Han}|(?:(?!\p{Script=Han})[\p{L}\p{N}])+/gu

Each Han code point is its own token; non-Han letters and numbers form maximal runs. Scenario text consists, in order, of initial_prompt, each final_requirements item, each unacceptable_first item, decision_at_risk, and follow_up, joined with single spaces before normalization. Null follow-ups are omitted. IDs, domain labels, class labels, move labels, and feedback_kind are not part of this specified projection.

Character 4-grams use Unicode code points, not UTF-16 code units. Jaccard is intersection divided by union; Dice is twice the intersection divided by the two set sizes. All 3,160 pairs of the 80 scenario texts are checked, and equality with either threshold fails.

The corrected revision-2 run and the current revision-3 run returned pass, exited 0, and reported an empty errors array. Maximum token-set Jaccard remains 0.3225806451612903 (fc-pr-012 / fc-pr-015), below 0.65. Maximum character 4-gram set Dice remains 0.2929532858273951 (fc-pr-001 / fc-pr-009), below 0.72. The revision-3 optional metadata field is excluded from scenario text by the specified projection.

The revision-1 similarity measurements below are superseded and do not establish compliance with the required similarity specification. That implementation grouped Han into larger letter/number runs and excluded required evaluator fields from scenario text. The following historical figures are preserved only as a correction trail:

| Superseded revision-1 view | Old lexical token Jaccard | Old whitespace token Jaccard | Old character 4-gram Dice |
| --- | ---: | ---: | ---: |
| Initial prompt | 0.2285714286 | 0.1869158879 | 0.2787878788 |
| All user messages | 0.2250000000 | 0.1832061069 | 0.2926829268 |
| Fixed follow-up | 0.2285714286 | 0.2187500000 | 0.2935779817 |

Revision 1's previously reported overall maxima of 0.2285714286 and 0.2935779817 are superseded by the corrected scenario-text maxima above. No case was rewritten to reduce similarity, and neither threshold was changed. The initial structure/excerpt checks had found two short requirement fragments, repaired in revision 1; those structure/excerpt results remain independently valid.

The author reviewed all IDs in all five contiguous ID ranges for: delivery surface; upfront final-artifact specification; availability of facts and numeric examples; relevance of the expected first action; fixed-follow-up sufficiency; absence of new downstream requirements used retroactively; and absence of evaluator-only facts. The review found and corrected the defects logged below. It is an author self-review, not independent validation.

## Pre-execution repair log

The original 80-case draft is revision 0. Revision 1 edits only the following existing cases; no case was added, deleted, replaced by another case, or tested against a model. The before/after fragments below, together with each ID and the current JSONL, preserve the actual changes. A combined same-row patch made these edits before any experiment execution.

1. fc-pe-003, initial_prompt: before `Available events are Mira raising a card, Len ringing a bell, and Jo opening a curtain.`; after `Mira starts on the stage manager's nod. Available events are Mira raising a card, Len ringing a bell, and Jo opening a curtain.` Reason: place the opening trigger in the initial premise rather than introducing it in the fixed reply.
2. fc-pe-003, decision_at_risk: before `The middle cue depends on a visual or spoken trigger, and the initial trigger needs to be fixed before a runnable cue note exists.`; after `The middle cue depends on a visual or spoken trigger; the opening trigger is already supplied in the user prompt.` Reason: align evaluator explanation with the visible premise.
3. fc-pe-008, follow_up: before `The card is for assembling one complete set in a single tray. End the four steps by checking that the tray contains two brown tokens and one green token.`; after `The card is for assembling one complete set in a single tray. Keep that whole-set direction for the four-step card.` Reason: remove an unnecessary new last-step prescription.
4. fc-pe-010, initial_prompt: before `a turn ends when the active player draws a pebble. I haven't`; after `a turn ends when the active player draws a pebble. The game starts with red active. I haven't`. Reason: expose the eventual start state before the fixed reply.
5. fc-pe-010, initial_prompt: before `For an example, red has 2 pebbles, blue 1, and gold 4.`; after `For the example, blue is active, red has 1 pebble, blue 3, and gold 4.` Reason: make the example discriminate the two already stated turn rules without a missing active player or tie.
6. fc-pe-012, initial_prompt: before `模型有书脊、书口和红色底板；展柜中线已经画好。`; after `模型有书脊、书口和红色底板；展柜中线已经画好。红色底板已确定放在纸模型下面。` Reason: expose the settled base placement initially.
7. fc-co-009, initial_prompt: before `Both names must remain. I could lengthen`; after `Both names must remain, and Spiral comes before Streamer in either version. I could lengthen`. Reason: make the fixed session ordering visible before selecting the time concession.
8. fc-co-012, initial_prompt: before `列是来客、座位。六位`; after `列是来客、座位，座位从1开始编号。六位`. The corresponding requirement changed from `一张文字座位安排表，在聊天里交付，列是来客、座位` to `一张文字座位安排表，在聊天里交付，列是来客、座位，座位从1开始编号`. Reason: expose seat numbering initially and maintain an exact excerpt.
9. fc-co-013, follow_up: before `十年经验的那一条删掉，介绍保持对新人的欢迎。`; after `十年经验的那一条删掉，请完成这段招募介绍。` Reason: confine the fixed reply to the visible eligibility choice and requested artifact.
10. fc-co-015, final_requirements: before `在这里给四条短句`; after `请修正虚构温室游戏的周五值班卡，在这里给四条短句`. Reason: expand a mechanically short fragment into a meaningful existing initial-message excerpt.
11. fc-pr-004, final_requirements: before the two entries `倒着的“山”字、沾蓝色的字块、印有浅浅凹痕的卡纸` and `不补充真实印刷知识`; after one entry `三件纸道具分别是倒着的“山”字、沾蓝色的字块、印有浅浅凹痕的卡纸，不补充真实印刷知识`. Reason: combine adjacent initial-message content into one meaningful exact excerpt, removing the short-fragment defect.
12. fc-pr-015, initial_prompt: before `也可以两个方向各两个，取决于我看样本后的感受。`; after `也可以两个方向各两个并分别标明方向，取决于我看样本后的感受。` Reason: expose grouping labels initially rather than first asking for them in uncertain feedback.

These are 13 literal substring substitutions across 10 cases; the numbered log combines the two linked seat-numbering substitutions in item 8. No similarity-driven rewriting was necessary.

## Revision-2 pre-execution corrections

The requesting task's specification review identified three evaluator-label errors: a shared short mug sign need not choose story versus care from its placement; a four-row hold table can have separately labeled route and difficulty columns; and a four-column notebook can preserve all supplied observations by combining location and time. Expected first move changed from question to direct_delivery for fc-pe-001, fc-pe-006, and fc-uf-007. Their decision explanations and unacceptable actions now permit those reasonable common deliveries. A useful shared draft or sample is not a missed clarification.

All three initial prompts, final-requirement arrays, and fixed follow-ups remain unchanged. Reviewing those follow-ups confirmed that they select an already visible placement/emphasis, numbering purpose, or notebook purpose; they introduce no extra artifact, quantity, or factual premise. They do not make the first-turn common delivery retroactively incorrect.

The exact nine evaluator-only substitutions below preserve the repair trail:

```json
[
  {
    "id": "fc-pe-001",
    "before": "\"expected_first_move\":\"question\"",
    "after": "\"expected_first_move\":\"direct_delivery\""
  },
  {
    "id": "fc-pe-001",
    "before": "Treating the undecided placement as a settled choice and presenting a finished display story.",
    "after": "Claiming that the user has already chosen a placement, or that placement necessarily fixes the sign's story-versus-care emphasis."
  },
  {
    "id": "fc-pe-001",
    "before": "The visible placement choice determines whether the sign primarily tells the object's story or gives ownership guidance.",
    "after": "Placement is undecided but does not itself settle story-versus-care emphasis. A short sign can combine the supplied identifying details and hand-washing guidance for either placement; a reasonable shared draft or sample is valid before feedback."
  },
  {
    "id": "fc-pe-006",
    "before": "\"expected_first_move\":\"question\"",
    "after": "\"expected_first_move\":\"direct_delivery\""
  },
  {
    "id": "fc-pe-006",
    "before": "Giving difficulty ranks as the route sequence without resolving the stated ambiguity.",
    "after": "Labeling difficulty ranks as route numbers or route numbers as difficulty ranks."
  },
  {
    "id": "fc-pe-006",
    "before": "The same four numbers would encode incompatible information on the mock-up.",
    "after": "Route numbers and difficulty ranks differ, but a four-row table can distinguish them in separate labeled columns. That common table is a valid direct delivery; the prompt does not require choosing only one kind of number."
  },
  {
    "id": "fc-uf-007",
    "before": "\"expected_first_move\":\"question\"",
    "after": "\"expected_first_move\":\"direct_delivery\""
  },
  {
    "id": "fc-uf-007",
    "before": "\"unacceptable_first\":[\"Inferring a real mineral identification from the invented observation instead of designing the notebook page.\"]",
    "after": "\"unacceptable_first\":[\"Inferring a real mineral identification from the invented observation instead of designing the notebook page.\",\"Declining to provide the table on the claim that four columns cannot preserve the supplied observation.\"]"
  },
  {
    "id": "fc-uf-007",
    "before": "Limited columns force a choice between recording object properties separately and giving the route more structure.",
    "after": "Four columns can preserve the specimen, surface, specks, and combined location/time observation. The broader purpose remains open, but it does not block a useful common example table; the field arrangement is reversible."
  }
]
```

The validator's token regex and scenario projection were corrected to the requesting task's explicit standard. The old comparison scopes and whitespace-token metric were removed from active validation, while their prior values are preserved above and in author-manifest.json under superseded_checks. Normalization, code-point 4-grams, and the strict thresholds 0.65 / 0.72 are unchanged.

Only these three case-label defects and the specified validator/method defects were repaired in revision 2. No new difficulty or first-turn constraint was added. Another review of explicit-request metadata was pending in the requesting task at that point; its authorized correction is recorded in revision 3 below. No speculative additional relabeling or sealing was performed.

## Revision-3 explicit-request metadata correction

The requesting task completed its pre-execution request-metadata review and specified six explicit overrides to the category default. Only the optional boolean field `intent_move_explicitly_requested` was added, with value `false`, to these existing records:

- fc-uf-002: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.
- fc-uf-005: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.
- fc-uf-007: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.
- fc-uf-008: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.
- fc-uf-009: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.
- fc-uf-015: field absent in revision 2; `intent_move_explicitly_requested:false` in revision 3.

All pre-existing fields in those records remain unchanged, and the other 74 records have no such field. This is a correction of category-default request metadata. It does not change user text, fixed follow-ups, final requirements, expected-action labels, unacceptable-action criteria, decision explanations, task purposes, task difficulty, or any product or evaluator implementation.

fc-uf-012 still explicitly asks to choose the purpose first and therefore retains its existing interpretation without an override; that interpretation does not make one particular action shape mandatory. All 15 preference_after_result prompts already request exploratory samples explicitly, so none were revised.

The validator permits the optional field only as a boolean, requires exactly these six IDs to contain it, requires their value to be false, and rejects its presence on any other case. The report lists the six overrides for audit. This metadata field is outside the previously specified scenario-text projection, so it does not alter the similarity corpus.

Revision 3 validation returned pass, exit code 0, no errors, 80 cases, 266 exact excerpts, and the same 3,160 scenario pairs. The unchanged maxima are Jaccard 0.3225806451612903 and Dice 0.2929532858273951. No model API, product, grader, external code, previous case library, or credential was used. These six optional-field additions are logged separately from the 22 earlier literal substitutions. The requesting task's final SHA256 sealing instruction remains pending.

## Limits and sealing

Synthetic toy tasks make facts and side effects controllable, but do not establish performance on real projects, long conversations, or professional decisions. Distinct labels and low lexical similarity do not prove semantic independence or global novelty. Exact substring matching does not prove chronology; chronology and evaluator grounding were reviewed manually by the same author. Broader themed overlap, such as arts, exhibits, and invented games, remains possible despite different named subject domains.

No old-library comparison was performed by this author. The requesting task will perform that check and a separate pre-execution specification review. The author did not use any calibration contents or results to adapt cases.

The four delivered files are author-80.jsonl, author-method.md, validate-author.mjs, and author-manifest.json. They are prepared_for_seal, with no SHA256 seal or other content hash computed. Sealing awaits the requesting task's explicit confirmation after its pending checks. Any further pre-execution change is limited to a concrete structure, chronology, grounding, or duplication defect and must extend this log; no alternative set may be authored.
