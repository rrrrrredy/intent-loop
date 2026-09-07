# Development ablation report

Status: **POST-V6 DEVELOPMENT REVISION; NOT RELEASE EVIDENCE.** V6 returned `STOP` and a post-run audit invalidated it for efficacy use. A first authorized 17-case installed-Hook run exposed both a development-label defect and eight unnecessary questions. Candidate `d10a920` removed all eight questions, while `6a54622` still guessed a missing duration despite a narrower fact rule. The current 1,362-byte precedence repair requires targeted rerun and component ablation before a new holdout can be sealed.

## Question

Which policy and architecture elements are necessary for Intent Formation to interrupt only a materially divergent step, provide the smallest useful evidence, and then get out of Codex's way?

## Method

- Tests used a real locally installed Codex Plugin and its `UserPromptSubmit` MCP Hook, not policy text pasted into a task.
- Every trial used a fresh workspace and isolated Codex Home. The runner saved the visible response and completed action-item types, then deleted the task.
- Component-removal trials used unretried conversations. Repeated prompts measure instruction-following variation; they are not independent product tasks.
- The first formal study froze candidate `bae8e03` before running 80 unseen scenarios in baseline and plugin arms. All 160 conversations completed and were graded blind.
- The second formal study independently sealed a different 80-scenario corpus before freezing candidate `fcba88e`. Its corpus SHA-256 is `252f3b057ab263c98f9439b69e216b3227736997cf641fbce0529cc4be5dda70`.
- The second study completed 160 / 160 primary conversations without a conversation retry. Its blind grader completed all 80 pairs in 16 batches; batch 12 required one grader-only retry because the first response omitted an audit rationale.
- A different independent author sealed the v5 release holdout before either arm ran. Its corpus SHA-256 is `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`; root validation found zero threshold violations against both retired holdouts, every development corpus, and both ablation corpora.
- A new independent author sealed v6 at SHA-256 `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897` after zero model, arm, or grader runs. Root validation found zero overlap violations against all historical holdouts, tracked development corpora, and both now-preserved ablation corpora. The study later completed but failed three gates and a post-run user-visibility audit.
- Post-failure regressions and component-removal prompts were written from failure classes, not copied from holdout prompts. They cannot authorize release.

## Third formal holdout result

Candidate `fca68c5` completed 160 / 160 primary conversations and 80 / 80 clean blind grades. It reduced avoidable rework 69.70% and kept non-clear premature actions at zero, but returned `STOP`:

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 69.70% | at least 25% | Pass |
| Final-match change | +5.94 percentage points | at least +10 points | **Fail** |
| Helpful proactive interventions | 91.67% (22 / 24) | at least 70% | Pass |
| Wrong or unhelpful proactive interventions | 8.33% (2 / 24) | at most 15% | Pass |
| Premature actions on non-clear tasks | 0 | 0 | Pass |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | +5.36% | increase at most 5% | **Fail** |
| Explicitly denied inferences | 75% (6 / 8) | at most 10% | **Fail** |
| Full raw prompts persisted | 0 | 0 | Pass |

The remaining behavior has two concrete causes. First, compatible goals in a public, lasting, or high-stakes request were sometimes treated as permission to choose which goal should lead. Second, after the user resolved a branch, the delivery sometimes changed exact text, case, count, format, or structure, or added unrequested advice. These mechanisms justify precise regression rules; they do not justify restoring the removed generic constraint abstraction.

The predeclared paired clear-task latency exceeded its ceiling by 0.36 percentage points. The core's always-on MCP process returns only static policy text, so a command-Hook transport is eligible for an operational component ablation before the next freeze.

## Fourth formal holdout diagnostic

Candidate `a67148e` completed 160 / 160 primary conversations and 80 / 80 blind grades. The run had no primary timeout, cleanup failure, action by the plugin arm, or prompt persistence, but its point estimates returned `STOP`:

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 65.96% | at least 25% | Pass |
| Final-match change | +13.75 percentage points | at least +10 points | Pass |
| Helpful proactive interventions | 75.86% (22 / 29) | at least 70% | Pass |
| Wrong or unhelpful proactive interventions | 24.14% (7 / 29) | at most 15% | **Fail** |
| Premature actions on non-clear tasks | 0 | 0 | Pass |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | +6.89% | increase at most 5% | **Fail** |
| Explicitly denied inferences | 62.5% (5 / 8) | at most 10% | **Fail** |
| Full raw prompts persisted | 0 | 0 | Pass |

A separate post-run corpus audit found at least eleven scenarios whose `final_requirements` contained concrete facts absent from both user-visible turns. That defect invalidates the study for efficacy independently of its failed gates. Its aggregate data is retained only to locate failure classes: the policy under-fired on recipient/context, teaching pace/depth, feasibility/innovation, autonomy/supervision, and brand voice; some questions selected a surface tone or false tradeoff; abstract comparisons lacked concrete micro-examples; turn-bounded constraints were treated as permanent; and result-feedback semantics were too weak after the earlier removal.

Evaluation contract v3 now rejects hidden requirements in the runner, grader, analyzer, and publisher. Every final requirement must be an exact excerpt from the initial prompt or frozen follow-up. This structural check is necessary even when authorship and overlap controls pass.

## Post-v5 architecture and policy ablation

The transport experiment ran the same ten clear prompts through baseline and plugin arms for each transport, alternating arm order with concurrency one. It used real installed Hooks, isolated homes and workspaces, `gpt-5.6-sol` at low reasoning, and `codex-cli 0.153.0-alpha.5`. All 20 pairs completed without user-work actions.

| Transport | Pairs | Baseline median | Plugin median | Median paired change | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Warm static MCP | 10 / 10 | 9,047.5 ms | 8,751.5 ms | -356.5 ms (-3.75%) | Keep |
| Minimal command Hook | 10 / 10 | 8,795 ms | 10,000 ms | +1,085.5 ms (+12.61%) | Remove |

This small operational sample does not prove a general latency improvement for MCP. It does show that replacing the warm server with a per-prompt command did not solve the observed latency problem and made this matched probe materially slower, so the command abstraction was removed.

Policy trials then isolated each v5 failure mechanism:

- On seven retired v5 leading-priority failures, the prior policy asked before drafting in only 2 / 7 cases. A precise rule for two stated goals that yield different public, lasting, costly, or high-stakes versions raised the broad rerun to 6 / 7. Targeted follow-ups for lasting public identity, assurance-versus-risk prominence, and prohibiting self-blending each asked in 3 / 3 repetitions.
- On the retired retry-message sample, the prior policy invented an unstated 30-second duration in 2 / 3 repetitions. Restricting tiny samples to stated facts and marking or omitting unknowns avoided invention in 3 / 3 repetitions.
- A generic exact-delivery reminder did not improve preservation of literal text, capitalization, or requested emphasis, so it was removed. The narrower resolved-branch exit avoided a repeated question in 3 / 3 repetitions; the final `chosen lead first` wording still requires stable-CLI regression.
- Reintroducing the automatic feedback taxonomy scored 9 / 9 on three repeated result-feedback cases, exactly matching the policy without it. It remains removed from the always-on core and available only in the explicit Skill and optional State companion.
- The pre-final policy completed the 15-case post-v5 development corpus 15 / 15 operationally. These manually checked, failure-derived trials are development evidence only.

The alpha-CLI candidate was 1,099 UTF-8 bytes, 12.4% below the original 1,254-byte policy. Local Node 20 and Node 22 package suites passed, but those deterministic tests establish implementation integrity, not behavioral efficacy.

### Stable CLI regression and second-order failures

Real installed-Hook runs on `codex-cli 0.153.0` then exposed behavior hidden by the first development pass:

- The 1,099-byte candidate completed the 15-case post-v5 corpus 15 / 15, and three high-risk leading-priority classes each asked correctly in 3 / 3 repetitions. However, only one of three resolved merger-letter runs put the user-selected uncertainty emphasis strictly before the competing confidence goal.
- Compressing several established trigger phrases to keep a strengthened lead-order rule under the old 1,100-byte ceiling caused four regressions in the next 15-case run and repeated the question after an explicit selection. That variant was rejected.
- Restoring the proven phrases and requiring the opening sentence itself to express the chosen priority passed a new fictional museum closure case 5 / 5. A subsequent 16-case run preserved all other routing behavior, but its 18-word sample invented unsupported artistic themes.
- The 1,165-byte follow-up added `never invent facts`, but a valid Hook-enabled five-repeat still created unsupported scope with words such as `each`, `throughout`, and `across`. That compact wording was rejected.
- Three intervening five-repeat sets omitted the evaluator's audited Hook-trust bypass. Their transport metadata did not establish policy injection, so their outputs are excluded rather than used to tune or support the candidate.
- The final rule targets only an explicit `only these facts` request: it forbids new adjectives, themes, implications, intensifiers, and scope, and uses verbatim fact repetition when an exact count needs filler. With the same Hook-trust path as the formal runner, the facts-only probe passed 5 / 5, chosen-lead order passed 5 / 5, and the complete 16-case corpus passed 16 / 16 with no tool calls or user-work actions.

The observed behavior, rather than a round byte target, set the v6 policy budget. That 1,253-byte candidate was one byte smaller than the original policy, while the command Hook, generic fidelity reminder, automatic feedback taxonomy, and other then-unused abstractions stayed removed. V6 later showed that the feedback removal and generic decision trigger were under-specified, so those conclusions were reopened rather than defended by byte count. None of these stable-CLI trials is independent release evidence.

## Post-v6 component results and label corrections

The first post-v6 revision optimized against faulty development labels. Seven cheap drafts had been labeled as mandatory questions; the named-dimension policy then asked eight unnecessary questions in 17 real installed-Hook cases. Removing that list restored direct drafting. A later audit also retracted the claimed missing-duration failure: the library-card prompt explicitly requested a fictional sample, so its original sample route was valid. Neither prompts nor follow-ups were changed. Earlier required-fact-precedence conclusions are superseded by this correction.

Selected repeated runs are published with raw responses and exact policy/tree hashes in [post-v6 development evidence](../evidence/post-v6-development/README.md). They support these bounded component decisions:

| Component | Observed removal or repair result | Decision |
| --- | --- | --- |
| Named decision dimensions | Removing them stopped unnecessary interviews on the observed reversible-draft cases. | Remove; use the general costly-divergence gate and shared-step exit. |
| Required-fact-before-draft precedence and broad fictional-fact policing | Motivated partly by a false library-duration label; broader rules produced repetitive fictional prose. | Remove; keep genuinely missing files/data/access separate from permitted fiction. |
| Automatic feedback taxonomy | All five observed feedback cases retained their expected move after removal. | Remove automatic taxonomy; retain later-turn control. |
| Automatic micro-example clause | All three observed comparisons still supplied examples requested by the user. | Remove automatic clause; preserve requested examples. |
| Literal universal mix/reject/free closing | Appeared in clear instructions and mutually incompatible tradeoffs. Semantic wording removed that spill but initially omitted invitations in two comparisons. | Scope a natural-language invitation to requested comparisons; all three repeated comparisons include it on `2b9101f`. |
| Quantities and placeholders | A quantity changed from exactly three to up to three; a placeholder layout acquired invented recipe steps. Narrow instructions preserved both in later runs. | Retain explicit quantities/rules and placeholder handling. |
| Explicit facts-only boundary | Five-repeat ablations had shown added scope with a generic fidelity reminder. | Retain only when explicitly requested by the user. |
| Warm MCP transport | Ten earlier matched clear pairs favored MCP over the command Hook; the command variant added 12.61% median paired latency. | Keep warm MCP; do not infer current efficacy or latency from this development sample. |

Candidate `2b9101f` uses 1,193 policy bytes. Its complete 17-case run finished all first turns, five follow-ups, and all task deletions with no first-turn actions. This is not a blanket quality pass: the card-game response still mentions an unsupplied mechanism and a wall label ends with awkward filler. These outputs remain in the archive rather than being silently excluded.

The fresh seven-case costly-branch repeat and v7 efficacy run have not started because they require external-data authorization beyond the existing 17-case approval. Original joint thresholds remain unchanged. None of the component trials or corrected labels supplies independent release evidence.

## First formal holdout result

The candidate passed rework, final-match, clear-task interruption, latency, inference-denial, and raw-prompt persistence gates. It failed the intervention-quality and premature-action gates:

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 90% | at least 25% | Pass |
| Final-match change | +12.19 percentage points | at least +10 points | Pass |
| Helpful proactive interventions | 50.85% (30 / 59) | at least 70% | **Fail** |
| Wrong or unhelpful proactive interventions | 49.15% (29 / 59) | at most 15% | **Fail** |
| Premature actions on non-clear tasks | 15 | 0 | **Fail** |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | -19.7% | increase at most 5% | Pass |
| Explicitly denied inferences | 0 | at most 10% | Pass |
| Full raw prompts persisted | 0 | 0 | Pass |

Class-level inspection located the failures instead of averaging them away. All 15 `unformed` cases were wrong because the generic question-only rule displaced requested comparisons and the model sometimes chose after being told to stay neutral. Ten of 15 `preference_after_result` interventions were wrong because a request for one tiny sample became an abstract question or several alternatives. All 15 premature actions came from five sample tasks where inline evidence was mistaken for project execution. Three clear controls added format or delivery questions when only ordinary input was missing.

## Second formal holdout result

Candidate `fcba88e` fixed most v3 mechanisms but still returned `ITERATE`:

| Gate | Result | Threshold | Decision |
| --- | ---: | ---: | --- |
| Avoidable rework reduction | 82.93% | at least 25% | Pass |
| Final-match change | +6.87 percentage points | at least +10 points | **Fail** |
| Helpful proactive interventions | 85.19% (23 / 27) | at least 70% | Pass |
| Wrong or unhelpful proactive interventions | 14.81% (4 / 27) | at most 15% | Pass |
| Premature actions on non-clear tasks | 2 | 0 | **Fail** |
| Clear-task extra interruptions | median 0, P90 0 | median 0, P90 at most 1 | Pass |
| Clear-task paired latency | +4.59% | increase at most 5% | Pass |
| Explicitly denied inferences | 100% (4 / 4) | at most 10% | **Fail** |
| Full raw prompts persisted | 0 | 0 | Pass |

The remaining error pattern was narrower and actionable. Four proactive interventions asked about an adjacent concern or proceeded directly instead of separating the consequential outcome. All four model-owned inferred preferences were later denied by the user. One explicit-comparison case performed two web searches before returning the comparison. The class means also showed that the plugin improved conflict and poorly expressed tasks, stayed flat on unformed tasks, and slightly reduced clear and result-feedback match.

## What the earlier failures removed

The revisions removed or narrowed these abstractions:

- the global “question only” override, replacing it with direct routing for an explicitly requested comparison or sample;
- the generic “two or three alternatives” expansion when the user requested exactly one sample;
- any recommendation or selection after the user asks for neutral comparison, including after priorities are supplied;
- format or delivery questions when the only blocker is a missing file, value, or access; and
- shared option-generation behavior for impossible requirements. A conflict now names both incompatible requirements and asks only which one wins;
- success-criterion wording that could be satisfied by an adjacent tone or input question instead of the outcome, priority, tradeoff, or exposure that changes the deliverable; and
- optional follow-up questions after the user has resolved the branch. Delivery now proceeds with the chosen lead first, requested placeholders, and no invented personal or case facts.

The experiment retained only behavior with observed or product-required value:

- a semantic costly-divergence trigger before materially different expensive outcomes;
- a neutral mix/reject/free-description exit when the user does not know the available directions;
- one tiny inline sample, with no tools, commands, or files, when preference needs evidence;
- explicit feedback classification in the compact core, full manually invoked Skill, and optional state model; and
- the state-free core. State continuity and DeepSeek compatibility remain optional adapters.

No GUI, planner, transcript parser, custom Harness, intake form, or independent chat client was added. Earlier ablation had already removed lexical trigger lists, a memorized website example, conflict-generated “balanced” options, mandatory `label + effect` scaffolding, and duplicated reply-format instructions.

## Component-removal experiment after v4

A frozen 16-task development corpus covered two clear, five conflict, five poorly expressed, two result-feedback, and two unformed cases. Its original run-input SHA-256 was `c5c3c889c302fbc1f8f11ced67c1f78125c8a2c768aae4081100f07d34b5b0b7`; the byte-equivalent public LF-normalized copy is `513fd7f6b9e433914ae29991cd7a0b5859d3be4289ffdd2360f7adbbe91eed72`. Each variant used `gpt-5.6-sol` at low reasoning through an installed Hook, isolated Home and workspace, four workers, no primary retries, and task cleanup after every case.

| Variant | Candidate | Policy bytes | Usable | First-turn actions | Median total | Maximum total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Full pre-ablation policy | `2f1f003` | 1,096 | 16 / 16 | 1 | 27,893.5 ms | 166,546 ms |
| Remove automatic feedback taxonomy | `37db32b` | 971 | 16 / 16 | 0 | 29,301.5 ms | 161,147 ms |
| Relax the fixed answer exit | `bd7e6b4` | 1,084 | 16 / 16 | 0 | 30,281 ms | 168,274 ms |
| Remove generic “obey constraints” | `a2cbcfb` | 1,068 | 16 / 16 | 0 | 25,319.5 ms | 185,587 ms |

The small sample and high timing variance do not support a latency ranking. The useful evidence was behavioral:

- The full variant's one first-turn action was a web search during an explicitly requested comparison. The policy now forbids tools and project work for intent-forming comparisons.
- Replacing the exact `mix / reject all / answer freely` exit with a generic allowance caused three of five applicable gate responses to omit at least one exit right. The exact exit remains.
- Removing the automatic feedback taxonomy did not damage those two result-feedback cases, so the v6 policy dropped it. V6 later exposed incorrect result-feedback handling in a broader independent set; the current revision restores a smaller rule and requires a new removal test before freeze.
- Removing the generic `obey stated constraints` sentence produced no meaningful constraint or compactness loss. It remains deleted.
- That post-v4 candidate retained the product boundary and observed mechanisms in 967 UTF-8 bytes, 22.9% below the original 1,254-byte policy. Later v5 failures required the targeted rules documented above.

No independent blind grade is claimed for this development ablation. Manual transcript inspection was used because the optional external ablation grader was not authorized to receive the local experiment material; an earlier draft also exposed variant paths and therefore was not blind. Formal outcome evidence remains the separate paired holdout.

## Confirmation on the reduced policy

Candidate `8def5a3` ran a second frozen 16-task confirmation corpus with original run-input SHA-256 `87252f02f62461e27ba881044db139e3199af2520180268c25edb4cf072aca03`; its public LF-normalized copy is `addb1a418036d3b03b011367cae9ea1a7797669127fa8a9d012c34885bf38c2c`:

- 16 / 16 conversations were usable, with no timeout;
- first-turn action items: 0; first-turn MCP calls: 0;
- 16 / 16 task cleanups succeeded;
- the explicit comparison completed directly and neutrally with no search;
- every applicable choice response preserved mix, reject-all, and free-answer exits;
- intent-resolved follow-ups delivered without a second question; and
- two second turns created files only after the user explicitly said to begin implementation, so they are authorized execution rather than premature actions.

Median total conversation time was 26,301 ms and the maximum was 166,818 ms. These values are operational observations, not efficacy or latency claims.

## Freeze decision

V3, v4, v5, and v6 are permanently retired from release-gate use because their results informed later policy, evaluation, or architecture work. V6 is additionally invalid for efficacy because its hidden final requirements violated the user-visible evidence boundary. The current revision must pass the corrected installed-Hook regression, genuine costly-branch probes, and component removal first. Only then may a fresh independent author create v7 under the exact-excerpt contract; no v7 arm may run before its corpus and candidate are separately sealed.
