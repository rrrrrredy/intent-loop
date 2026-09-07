# Decision log

> D-001 through D-015 record the first prototype and its required STOP. They are retained as research history, not the current release verdict. D-016 onward records the user-authorized redesign and v0.3 candidate.

## D-016 — Redesign on the unchanged frozen corpus

**Decision:** Replace the failing broad policy with a compact rule set derived from observed errors, then rerun the unchanged 80-scenario corpus with paired primary runs and blind grading.

**Result:** v8 produced 160/160 usable primary conversations and passed every predeclared point-estimate gate. Because the policy was iterated against this corpus, the result is retained only as a development regression and does not reopen release by itself.

## D-017 — Separate state-free core and optional State companion

**Decision:** Ship a quiet state-free policy plugin by default. Put persistence, resume, private/off controls, export, and deletion in a separately installed companion with receipt-backed commands.

**Reason:** The user-visible formation loop should not require a requirement ledger. Users who need continuity can opt into its privacy and operational cost.

## D-018 — Keep v0.3 at beta and publish weaknesses

**Decision:** Preserve full sanitized outputs, blind grades, hashes, retries, long-tail timing, and uncertainty statistics, but label this run as development-only. Require a new sealed holdout with explicit model identity and candidate fingerprint before release.

## D-019 — Add deterministic standard-mode remember and reject false private receipts

**Decision:** Execute `/intent remember` inside the trusted local command Hook in standard mode, with optional explicit role prefixes. Refuse it in private mode because the short-lived Hook cannot preserve process-memory state after exit. Do not widen the automatic Hook into a state-changing MCP prompt bridge.

## D-020 — Register same-process lock ownership before publication

**Decision:** Put each contender's unique token in the process-active set before the lock owner file can be observed, and always remove it on exit. Strengthen the permanent concurrency case to 100 simultaneous appends.

**Reason:** A real suite run exposed the prior publication window: another caller could read the just-written owner token before it was marked active and reclaim a live lock.

## D-021 — Treat the first independent holdout as ITERATE

**Decision:** Do not release candidate `bae8e03`. Its 160 / 160 usable conversations passed the rework, final-match, clear-interruption, latency, inference-denial, and raw-prompt gates, but helpful proactive intervention was 50.85%, wrong or unhelpful intervention was 49.15%, and non-clear tasks contained 15 premature actions.

**Reason:** The product gate is conjunctive. Strong averages in other metrics cannot compensate for giving the wrong kind of help or beginning work when the user requested only evidence for forming a preference.

## D-022 — Route explicit evidence before generic gates

**Decision:** Answer an explicit comparison directly; produce exactly the requested number of tiny inline samples without project work; preserve neutrality after priorities; ask only for ordinary missing inputs; and keep impossible-requirement conflict handling outside generic option generation.

**Result:** Eight new real installed-Hook regressions completed with 8 / 8 semantic passes, no first-turn actions or MCP calls, and complete cleanup. The policy is 1,098 UTF-8 bytes, 12.4% below the original 1,254-byte version.

**Evidence boundary:** These cases were derived from failure classes and therefore remain development evidence. The holdout that exposed them is retired; release requires a newly and independently authored unseen corpus.

## D-023 — Treat the second independent holdout as ITERATE

**Decision:** Do not release candidate `fcba88e`. Its 160 / 160 usable primary conversations reduced avoidable rework by 82.93%, kept clear extra interruptions at median 0 and P90 0, limited clear paired latency overhead to 4.59%, and passed proactive-intervention rates. It failed the final-match gate at +6.87 percentage points, all four inferred preferences were denied, and one non-clear task produced two premature web searches.

**Evidence boundary:** The blind grader completed 80 / 80 pairs in 16 batches. Batch 12 needed one grader-only retry after its first response omitted a required rationale; no primary conversation was retried. Because the result informed the next policy revision, v4 is permanently retired from release-gate use.

## D-024 — Ablate redundant automatic policy text

**Decision:** Remove the automatic feedback taxonomy and generic `obey stated constraints` sentence; keep feedback semantics in the explicit Skill and optional state schema. Retain the exact mix/reject/free-answer exit, and explicitly forbid tools or project work during an intent-forming comparison.

**Result:** Four installed-Hook variants ran over the same frozen 16-task development corpus without primary retries. The relaxed exit omitted complete answer rights in three of five applicable responses, the full variant searched during an explicit comparison, and the two removed sentences showed no useful behavioral benefit. Candidate `8def5a3` reduces the policy from 1,254 to 967 UTF-8 bytes. A separate 16-task confirmation completed 16 / 16 with no first-turn actions, no first-turn MCP calls, and complete cleanup.

**Evidence boundary:** The ablation is development evidence based on small-sample operational metrics and manual transcript inspection, not blind outcome grading. A newly authored v5 holdout remains mandatory.

## D-025 — Separate stress-fixture scheduling margin from the product timeout

**Decision:** Increase the synthetic 100-process worker's lock timeout from 60 to 120 seconds, within the test's existing 180-second outer bound. Keep the product's default no-progress and absolute deadlines unchanged.

**Reason:** One exact Node 22.19 full-suite run failed at 99 / 100 when a worker was starved past 60 seconds; five isolated reruns passed in 10.6–13.0 seconds. A new regression proves that a live owner with no progress still fails at a deliberately configured 100 ms boundary, so the larger stress margin does not convert a deadlock into a pass.

## D-026 — Seal v5 before candidate execution

**Decision:** Bind the next release attempt to the independently authored 80-scenario corpus with SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`. Its author ran neither arm and did not inspect the product policy, repository, previous holdouts, development corpora, prior experiment output, or conversation history.

**Evidence boundary:** Root validation after seal found zero threshold violations against both retired holdouts, all development corpora, and both ablation corpora. The seal is not an efficacy result; any user-visible policy change after execution retires v5.

## D-027 — Invalidate a grader run with a mismatched rationale contract

**Decision:** Do not combine the first run's 70 valid grades with later output or add an undisclosed third batch attempt. Its two failed clear-control batches exhausted the declared two attempts because the runtime required 40 rationale characters while the output Schema and rubric did not.

**Fix:** Align Schema, rubric, and runtime on 40-520 characters, bind grading to a clean Git tooling commit and contract hashes, preserve invalid summary SHA-256 `4ab5df8d454ef15e624c86b518f70bf72f565a2eaf8920129bbbc26d8f422125`, and rerun all 80 pairs in a fresh isolated grader environment. Product policy bytes remain frozen.

## D-028 — Treat v5 as STOP and isolate its failure mechanisms

**Decision:** Do not publish candidate `fca68c5489d9698ad4894096818469aad3f5520b`. Its 160 / 160 primary conversations and 80 / 80 clean blind grades passed rework, clear-interruption, proactive-intervention, premature-action, and persistence gates, but final match improved only 5.94 percentage points, clear paired latency rose 5.36%, and six of eight inferred preferences were denied.

**Next experiment:** Test precise rules for unresolved leading priorities and exact post-resolution delivery on new development cases. Separately compare the static MCP policy transport with a minimal command Hook because the MCP server carries no dynamic product state. V5 is retired and cannot authorize a later release.

## D-029 — Keep MCP and remove post-v5 abstractions without measured value

**Decision:** Keep the warm static MCP transport. In ten matched clear-prompt pairs it had a -3.75% median paired change against baseline, while a minimal command Hook had +12.61%. Both completed 10 / 10 without user-work actions; the sample is operational development evidence, not a general latency claim.

**Policy:** Add only precise leading-goal, stated-facts sample, and chosen-lead delivery rules. Remove the generic fidelity reminder after it failed to improve literal delivery, and keep the automatic feedback taxonomy out after both variants scored 9 / 9 on repeated feedback cases. The candidate is 1,099 UTF-8 bytes, 12.4% below the original.

**Evidence boundary:** Development runs used `codex-cli 0.153.0-alpha.5`; the final wording has not yet run through stable `0.153.0`. Stable regression and a new independent sealed holdout are mandatory before release.

## D-030 — Let stable behavior set the policy byte budget

**Decision:** Restore the established explicit-sample, explicit-comparison, conflict, and resolved-branch phrases after an over-compressed variant caused four routing regressions. Require the opening sentence to express the chosen priority before competing goals. Treat the 1,165-byte version as an intermediate candidate rather than a byte ceiling.

**Evidence:** Stable `codex-cli 0.153.0` exposed strict lead-order failures in two of three targeted runs. The revised lead-order case then passed 5 / 5, while a 16-case pass exposed unsupported embellishment in the 18-word sample. A later valid Hook-enabled five-repeat showed that `never invent facts` still allowed unsupported scope.

## D-031 — Align permanent overlap checks with the sealed method

**Decision:** Compare complete scenario text, tokenize Han text one character at a time, and calculate four-gram Dice over NFKC/lowercased/whitespace-normalized text. Do not keep the weaker first-prompt-only implementation.

**Evidence:** The stronger implementation was committed before v6 content was inspected and the existing v5 holdout still passes its thresholds. V6 root sealing covered historical holdouts, every development corpus, and both hash-verified ablation corpora with zero violations.

## D-032 — Prefer explicit facts-only behavior over a smaller ineffective rule

**Decision:** Under an explicit `only these facts` request, forbid added adjectives, themes, implications, intensifiers, and scope; permit verbatim repetition of supplied facts to satisfy an exact count. The final development policy is 1,253 UTF-8 bytes, one byte below the original 1,254-byte policy.

**Evidence:** With the exact Hook-trust bypass used by the formal runner, the 1,165-byte rule still expanded scope in at least two of five repetitions. The explicit rule then passed the facts-only probe 5 / 5, the chosen-lead probe 5 / 5, and the full 16-case development corpus 16 / 16 with zero tool calls or user-work actions. Three no-bypass repetition sets are excluded because they did not establish policy injection.

## D-033 — Seal v6 and make overlap evidence reproducible

**Decision:** Archive the used v5 corpus, preserve the two frozen ablation corpora, and bind the canonical v6 corpus plus a portable overlap validator in the candidate commit. Do not run either arm before that commit exists.

**Evidence:** The independent author ran zero models, arms, or graders. Corpus SHA-256 is `359220c857d36ff2ad25ba036c70fcae52b3b055240bf5f2229a2dcc4f63a897`; root cross-corpus maxima are `0.45614035087719296` Jaccard and `0.5330882352941176` four-gram Dice, with zero threshold violations.

## D-034 — Retire v6 after STOP and a corpus-integrity failure

**Decision:** Do not publish candidate `a67148e7eb55db1bc92593829661c31b9929fb32`. All 160 primary conversations and all 80 blind grades completed, with one disclosed grader-only format retry. Rework reduction was 65.96% and final-match gain was 13.75 percentage points, but clear paired latency was +6.89%, wrong or unhelpful proactive intervention was 24.14%, and five of eight inferred preferences were denied.

**Validity boundary:** Post-run inspection found at least eleven scenarios whose evaluator-only final requirements introduced concrete facts absent from both user-visible turns. V6 remains useful for failure discovery, but none of its aggregate efficacy values may support a release claim.

## D-035 — Restore feedback updates and use observable decision dimensions

**Decision:** Treat a limit scoped to one turn as expired when a later user message explicitly expands the work. Restore compact keep, implementation-change, intent-change, and uncertain-feedback behavior after v6 falsified its earlier removal. Require concrete parallel micro-examples for abstract comparisons. Replace the under-firing two-goal abstraction with observable content decisions: recipient or context, teaching pace or depth, feasibility or innovation, procedural autonomy or supervision, and brand voice family.

**Evidence boundary:** The resulting policy is 1,317 UTF-8 bytes after narrowing the general sample rule from all content to factual claims. A 1,260-byte intermediate version retained the generic missing-decision test and failed five of seven real one-turn routing probes. The strengthened policy still requires authorized real-Codex regression and component-removal trials before a new holdout can be sealed.

## D-036 — Reject hidden requirements at every formal evidence stage

**Decision:** Upgrade blind grading to `intent-formation-blind-v3`. Require each frozen final requirement to be an exact excerpt from the initial prompt or follow-up. Validate this contract in the formal runner, grader, analyzer, and evidence publisher before accepting the corpus.

**Reason:** A hash proves that a corpus stayed unchanged; it does not prove that the grader used only information the user supplied. Exact excerpt provenance closes the concrete v6 failure without adding a subjective post-hoc exception.

## D-037 — Separate process launch from lock contention

**Decision:** Keep the 100-process write requirement, but make every worker publish a ready marker and wait behind one start barrier before touching the EventStore. Open the barrier only after all 100 runtimes are live.

**Reason:** Two full-suite runs started workers while earlier workers were already acquiring the lock; Windows scheduling and endpoint scanning paused a live lock owner long enough to trip the worker's 120-second no-progress boundary. The old test mixed process-launch pressure with lock correctness. With the barrier, Node 20 and Node 22 completed simultaneous 100-writer runs in 16.2 and 18.0 seconds with all events and no lock residue. Product lock timeouts remain unchanged, and the separate stalled-live-owner regression still checks bounded failure.

## D-038 — Remove named decision dimensions and repair the development labels

**Decision:** Remove recipient, teaching, persuasion, autonomy, and brand-voice trigger lists from the compact Hook policy. Restore the three-condition activation gate and make bounded reversible drafts a direct-delivery exit. Keep all 17 authorized synthetic prompts unchanged, but relabel seven cheap drafts from `question` to `direct_delivery` and require a missing-data question when the library-card duration is absent.

**Evidence:** Candidate `598f83f` completed every real Codex turn and cleanup without tools or user-work actions, yet asked eight unnecessary questions and fabricated one missing duration. The original seven question labels contradicted the frozen rule that a cheap reversible sample should precede an interview. The reduced policy is 1,293 UTF-8 bytes and passes 107 / 107 tests on Node 20.19.1 and Node 22.19.0; real behavioral rerun and component ablation remain required.

## D-039 — Make fictional fidelity and required data explicit

**Decision:** Keep the general activation gate and direct bounded-draft exit. Strengthen only the existing factual boundary: `fictional` does not authorize new rules, properties, or history; if a fact is required to answer, ask only for it. Do not restore named content dimensions or a general questionnaire.

**Evidence:** Candidate `d10a920` removed all eight unnecessary questions on the unchanged 17 prompts, but added four unsupplied card-game mechanics and answered a missing library-card duration with “unspecified” instead of requesting the value. The strengthened compact policy is 1,315 bytes, two bytes below the rejected 1,317-byte named-dimension policy. Targeted real-Codex regression remains required.

## D-040 — Give required data explicit precedence over drafting

**Decision:** Move the missing required fact, file, data, or access rule before requested draft/sample handling and state that it overrides drafting. Separate allowed creative wording from user-supplied case facts. Raise the compact-policy guardrail from 1,320 to 1,400 bytes rather than compressing away an observed necessary precedence rule.

**Evidence:** In the targeted real-Codex run, candidate `6a54622` again invented a three-business-day duration even though its draft rule said to ask for required facts, and it retained one unsupplied card-game implication. The missing-data and direct-draft instructions were adjacent without explicit priority. The revised policy is 1,362 bytes; targeted behavior and both full suites remain required.

## D-041 — Retract the fictional-duration label and remove broad factual policing

**Decision:** Supersede the library-duration interpretation in D-038 through D-040. The initial request explicitly permits a fictional one-sentence sample, so no real duration must be requested. Keep prompt bytes unchanged, restore the sample label, and remove the required-fact-before-draft rule. Evaluator-only flags cannot add a facts-only instruction. Preserve the explicit user-supplied quantities/rules and explicit facts-only boundary.

**Evidence:** Broad fictional-fact policing produced repetitive prose, while the original sample request did not justify the supposed missing-duration failure. The genuinely missing five-object list remains a separate boundary regression. The full audit and unabridged selected development outputs are preserved rather than counted as efficacy.

## D-042 — Retain only behavior-supported interaction clauses

**Decision:** Keep warm MCP, the three-condition question gate, cheap shared-step/sample exit, neutral requested comparisons, scope-aware later-turn control, quantities/placeholders, and explicit facts-only handling. Remove the automatic feedback taxonomy, automatic micro-example clause, named decision dimensions, and universal closing sentence. Scope the mix/reject/free-reply invitation to requested comparisons/options; requested file/research work remains host-owned and permitted.

**Evidence:** Five feedback cases and three comparison cases retained their expected moves after the respective clause removals. A literal closing sentence leaked into clear work and incompatible tradeoffs; semantic wording stopped that spill but omitted invitations in two comparisons. Candidate `2b9101f` includes the invitation in all three repeated comparisons. Its 1,193-byte policy is backed by development observations only; fresh costly-branch and independent efficacy tests remain required.

## D-043 — Close adversarial privacy and receipt defects

**Decision:** Reject extra conditions on no-argument controls, refuse private-memory claims from short-lived Hooks, purge recovery artifacts before losing erasure tokens, preserve identified unrelated fragments, reject false concurrent-deletion success, and keep private markers free of titles/workspace hashes across creation, reset, import, and legacy repair.

**Evidence:** The independent adversarial agent reran its fixed 14-case set against `2b9101f` on Node 20.19.1 with no remaining blocker in that bounded scope. Permanent source regressions cover the accepted failures. The State companion remains optional; no new storage framework was introduced.

## D-044 — Preserve the v7 author seal and enforce external-data scope

**Decision:** Archive v6 bytes, preserve the independent v7 author's four original files, and mechanically wrap only the evaluator annotation field into the existing array schema. Compare every canonical field to the original, bind both hashes, and validate exact visible requirements and historical overlap before any model run. Do not send new cases outside the user's explicit 17-case authorization until further approval.

**Evidence:** All local v7 checks passed with zero overlap violations. The initial/follow-up/requirement strings are unchanged. The reviewer rejected a new seven-case cloud run, which was not started; the user-perspective agent made zero model requests. Product efficacy and actual chat acceptance remain pending.

## D-045 — Preserve the incomplete v7 primary and separate grading defects

**Decision:** Retain all 160 attempts, five operational failures, 75 complete-pair grades and original failed gates. No primary replacement or favorable subset release claim. Four explicit capacity errors and one timeout produced 155 usable conversations; all native tasks were deleted.

**Reason:** The available-pair diagnosis still exposes real permission/payment-rule assumptions and a misplaced access question. The independent audit also found later-added example numbers unfairly charged to first responses and a disputed denominator denial. These qualifications do not rewrite the original scores or turn the incomplete study into evidence of release efficacy.

## D-046 — Test delivery boundaries and temporal grading without another framework

**Decision:** Add narrow delivery-scope and settled-rule/delegation text, preserve explicit file/research/implementation requests, constrain access requests to the actual deliverable, and make the export Hook preserve its content digest. Prepare removal controls on already sent development and failed v7 cases. The 1,496-byte policy is a candidate for regression and ablation, not a measured improvement.

**Reason:** A short rule can choose consequential effects without any system write; explicit delegation and disposable samples still allow direct progress. Prospective grading v4 records exact-excerpt timing and distinguishes later additions from clarification, while preserving first-cycle selection and numerical gates. Old v3 artifacts bind to their original Git commit and remain unchanged.

## D-001 — Start a new product repository

**Decision:** Build `intent-formation` from a clean product baseline instead of extending `intent-loop`.

**Reason:** The earlier repository had shifted toward Harness-style workflow enforcement. The controlling product is the user-visible formation and revision of intent inside the current Agent task.

## D-002 — Codex first, no other host yet

**Decision:** Implement and evaluate only the Codex MVP.

**Reason:** The original gate requires real Codex outcome evidence before Claude Code, Cursor, Gemini CLI, DeepSeek Harness, WorkBuddy, Linux/macOS host packaging, or shared-host expansion. Cross-platform path code is allowed; another adapter is not.

## D-003 — Prove the interaction before state infrastructure

**Decision:** Begin with a 12-scenario Skill/Hook instrument pilot.

**Result:** The strongest incremental signal appeared in costly divergence and option formation. Clear text stayed quiet. Native Codex was already strong on samples and result feedback. File-oriented cases were confounded by a Windows sandbox failure.

**Consequence:** Proceed with the smallest traceable state core, retain an ITERATE decision, and require the 80-task study before release.

## D-004 — Keep implicit Skill invocation off

**Decision:** `allow_implicit_invocation` remains false. A short UserPromptSubmit hook supplies a silent decision cue; explicit invocation remains available.

**Reason:** Earlier Codex behavior could narrate Skill loading and add avoidable latency. The user-visible product should not announce an internal intent check.

## D-005 — Use ordinary conversation as the required UI

**Decision:** Manual `/intent ...` messages and normal questions/comparisons/samples are the headless product path.

**Reason:** A rich structured-choice UI is not guaranteed on every surface. The MVP must remain useful without an MCP App or custom client.

## D-006 — Append normally; rewrite only for deletion

**Decision:** Normal state changes append events. Corrections use supersession and invalidations remain auditable. Explicit deletion atomically rewrites matching data, including precise recovery-side-file scrubbing.

**Reason:** Auditability and reliable deletion require different mechanics. Silent overwrite would destroy provenance; logical tombstones alone would not satisfy forget semantics.

## D-007 — Preserve epistemic separation

**Decision:** Explicit user expression, Agent inference, result/external evidence, unknown, and disagreement have different states and source rules.

**Reason:** The product maintains a current working intent. It does not claim a single hidden truth or require the user and Agent to agree.

## D-008 — No transcript parser

**Decision:** Never parse Codex transcript files.

**Reason:** The host does not guarantee a stable transcript contract. The plugin only uses documented hook input and deliberately created MCP records.

## D-009 — Bundle a dependency-free stdio server

**Decision:** Development uses pinned MCP SDK and Zod packages; release packaging includes one bundled `dist/intent-formation-server.mjs` executed by Node.

**Reason:** Users should not run `npm install` inside the installed plugin. The bundle makes the runtime package self-contained while keeping source and lockfile reproducible.

## D-010 — Use relative MCP cwd, not placeholder arguments

**Decision:** The plugin MCP uses `cwd: "."`, a relative bundle path, and the server key `intent_formation`.

**Reason:** The tested traditional plugin runtime left path placeholders literal, causing a handshake failure. A hyphenated server key also has a current tool-exposure compatibility risk.

## D-011 — Derive stable local storage from installed cache root

**Decision:** When available, both Hook and MCP infer configured Codex Home from the installed plugin cache path and use `<CODEX_HOME>/plugin-data/intent-formation`.

**Reason:** The tested MCP child did not inherit the expected data variables. This method aligned components and respected the user's D-drive configuration on the real host.

## D-012 — No public repository or release before the product gate

**Decision:** Keep the new repository local and unlicensed until the paired 80-task outcome evaluation and independent reviews support a Go decision.

**Reason:** Packaging success, tool calls, and plausible prose cannot establish market value. If the gate passes, Apache-2.0 is the intended permissive license because the product is an extensible local Agent plugin with explicit patent terms; this choice is provisional until publication.

## D-013 — Stop publication and host expansion

**Decision:** The frozen 80-task result is STOP. Do not create a public GitHub repository, release, profile entry, other-host adapter, or marketing asset for this version.

**Reason:** Rework improved 23.88% against a 25% gate; final match fell 0.62 percentage points; clear latency rose 26.88%; helpful intervention, wrong intervention, and inference-denial gates also failed. Independent adversarial and beginner-use reviews both returned HOLD.

## D-014 — Fix state reliability without reopening the product gate

**Decision:** Accept and fix reviewer findings in lock ownership, private-mode atomicity, record-reference deletion, import confirmation/rollback, and automatic context provenance. Retain STOP after those fixes.

**Reason:** These are correctness and privacy defects in the delivered source. Closing them makes the research artifact honest and reproducible, but does not change the frozen behavioral result or ordinary-session entry failure.

## D-015 — Reject scope-changing workarounds

**Decision:** Do not add a global task browser, custom client, new Harness, form, or cross-host implementation to compensate for the failed Codex entry.

**Reason:** Those changes expand privacy exposure or change the frozen product. A future attempt must first prove a trustworthy headless entry and verified manual receipts inside the current Agent task.
