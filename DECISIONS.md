# Decision log

## 2026-09-03: rebuild around user-visible intent formation

Accepted: replace the v0.2 requirement-ledger-first experience with a quiet interaction policy that proceeds on clear work, asks one question before a costly divergent branch, compares concrete directions when vocabulary is missing, and uses a small sample when preference needs a result.

Rejected: presenting the structured ledger, tool count, or process protocol as the product. Sparse state remains an optional continuity layer.

## 2026-09-03: split core behavior from optional state

Accepted: a state-free `intent-formation` core and an independently installable `intent-formation-state` companion. Core policy transport accepts no prompt input. State controls require receipt-backed success; `remember` may start standard state directly, while private, off, export, and forget remain explicit user controls rather than hidden automation.

Accepted: keep the existing GitHub repository and history while using a semver-minor prerelease with explicit breaking migration notes. Old v0.2 state is never imported silently.

## 2026-09-03: ablate policy and architecture around observed failures

Accepted before the first formal freeze: use real installed-Hook trials to remove lexical triggers, a separate unknown-branch rule, conflict-generated option lists, required `label+effect` formatting, and duplicated choice instructions. That candidate was 999 bytes, down from 1,254 bytes, while State and DeepSeek remained optional adapters outside the state-free core.

Formal result: candidate `bae8e03` completed all 160 primary conversations but returned `ITERATE`. Helpful proactive interventions were 50.85% against a 70% gate, wrong or unhelpful interventions were 49.15% against a 15% ceiling, and 15 premature actions violated the zero-action gate.

Accepted after v3 failure attribution: remove the global question-only override for explicit evidence requests; honor exact sample counts; preserve neutral user ownership; treat missing files/data/access as ordinary inputs; and isolate conflict handling from generic option generation. That intermediate policy was 1,098 bytes, 12.4% below the original, and passed 8 / 8 real-host failure regressions with no first-turn actions or MCP calls.

Retained: the semantic costly-divergence trigger, an exact neutral mix/reject/free-answer exit, tiny inline samples, and feedback classification in the explicit Skill and optional state schema. The automatic compact policy carries only behavior that affected an observed next action.

Limit: both ablation sets and the eight post-failure cases are development evidence. Because the v3 holdout informed the revision, it is permanently retired from release-gate use.

## 2026-09-03: treat the second independent holdout as ITERATE

Formal result: candidate `fcba88e` completed 160 / 160 primary conversations on corpus `252f3b057ab263c98f9439b69e216b3227736997cf641fbce0529cc4be5dda70`. Avoidable rework improved 82.93%, clear extra interruptions remained at median 0 and P90 0, clear paired latency rose 4.59%, and proactive intervention rates passed. Final match improved only 6.87 percentage points against a 10-point gate; all four inferred preferences were denied; and one non-clear case performed two premature web searches.

Accepted: keep the decision at `ITERATE`. The grader completed all 80 pairs in 16 batches with one grader-only retry for a missing rationale; there was no primary conversation retry. The result informed later changes, so v4 is also permanently retired from release-gate use.

## 2026-09-03: remove compact-policy abstractions without observed value

Method: run four installed-Hook variants over the same frozen 16-task development corpus, one unretried conversation per variant and case, using `gpt-5.6-sol` at low reasoning in isolated homes and workspaces. Treat timing as descriptive because the corpus is small and long-tail variance is high.

Accepted: remove the automatic feedback-taxonomy sentence and the generic `obey stated constraints` sentence. Neither improved the tested behavior. Keep the full taxonomy in the explicit Skill and optional state layer, where it still expresses a deliberate user operation.

Accepted: retain the exact mix/reject/free-answer exit. Its relaxed wording omitted a complete exit in three of five applicable responses. Add a concrete no-tools/no-work rule to explicit comparisons after the full variant performed a web search. Candidate `8def5a3` is 967 policy bytes, 22.9% below the original, and its separate 16-task confirmation completed 16 / 16 with zero first-turn actions, zero first-turn MCP calls, and complete cleanup.

Limit: no independent blind grade is claimed for the development ablation. A newly authored v5 holdout must pass every conjunctive release gate before publication.

## 2026-09-03: seal v5 before candidate execution

Accepted: use the independently authored v5 corpus with SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`. The author worked from the evaluation contract alone, did not inspect product policy, prior holdouts, development material, repository state, or either arm, and recorded zero arm runs before seal.

Verification: the 80 scenarios contain 60 English and 20 Simplified Chinese cases across 80 distinct domains. Root-owned validation after seal found zero threshold violations against both retired holdouts, all development corpora, and both ablation corpora; maximum observed cross-corpus overlap was 0.6086956522 token-set Jaccard and 0.5168539326 character four-gram Dice, below the frozen 0.65 and 0.72 limits.

Boundary: sealing authorizes only the exact candidate-bound experiment. It does not authorize an efficacy claim or publication. Any user-visible policy change after the run retires v5.

## 2026-09-03: invalidate the first v5 grader run and align its contract

Observed: all 160 candidate-bound primary conversations completed without retry, timeout, prompt drift, MCP calls, or cleanup failure. The first blind grader run produced only 70 / 80 grades because two clear-control batches twice returned rationales shorter than the runtime-only 40-character minimum. The JSON Schema declared no minimum and the rubric did not state one.

Accepted: invalidate the entire grader run before inspecting semantic scores. Preserve its summary at SHA-256 `4ab5df8d454ef15e624c86b518f70bf72f565a2eaf8920129bbbc26d8f422125`; do not combine its 70 grades with another run or silently add a third batch attempt. Align Schema, rubric, and runtime on 40-520 characters, bind grading to a clean committed tooling revision, and rerun all 80 pairs in a fresh grader Home and output directory.

Boundary: this changes evaluation infrastructure only. The evaluated plugin tree remains byte-identical to candidate `fca68c5489d9698ad4894096818469aad3f5520b`; if any user-visible policy byte changes, v5 is retired.

## 2026-09-04: treat v5 as STOP and retire it

Formal result: candidate `fca68c5489d9698ad4894096818469aad3f5520b` completed 160 / 160 primary conversations and the clean rerun produced 80 / 80 blind grades. It passed rework, clear-interruption, proactive-intervention, premature-action, and raw-persistence gates. It failed final match at +5.94 percentage points, clear paired latency at +5.36%, and inference denial at 75% (6 / 8).

Accepted: retain the conjunctive `STOP`; do not publish v5 or reuse its corpus as release evidence. Use only its failure classes to construct development regressions for unresolved leading priorities, exact post-resolution delivery, and static-policy transport latency. A subsequent release attempt requires a fresh independent holdout.

## 2026-09-04: keep the warm MCP transport and accept only targeted post-v5 rules

Architecture result: ten matched clear-prompt pairs per transport completed without user-work actions. The warm MCP arm had a -3.75% median paired change versus baseline; the command Hook had +12.61%. This small development sample does not establish general latency, but the proposed command replacement was slower and is rejected.

Accepted: ask for the leading goal when two stated goals produce different public, lasting, costly, or high-stakes versions; treat public identity and assurance-versus-risk prominence as concrete instances; keep samples to stated facts; and put the chosen lead first after resolution. The resulting policy is 1,099 bytes, 12.4% below the original.

Rejected: a generic fidelity reminder and automatic feedback taxonomy in the always-on policy. The former did not improve literal or emphasis preservation; the latter tied the 9 / 9 behavior of the smaller policy. Feedback classification stays in the explicit Skill and optional State companion.

## 2026-09-04: let observed behavior set the compact-policy budget

Observed on stable `codex-cli 0.153.0`: the 1,099-byte candidate passed the original 15 development cases but put a user-selected leading priority first in only 1 / 3 targeted runs. Compressing already proven trigger phrases to make room under 1,100 bytes then caused four routing regressions, so that compression was rejected.

Accepted: keep the proven trigger phrases, require the opening sentence to express the selected priority before competing goals, and explicitly prohibit invented facts in bounded samples. The current policy is 1,165 bytes, still 7.1% below the original 1,254 bytes. The new lead-order probe passed 5 / 5; the final stated-facts repetition remains a development gate before candidate freeze.

Boundary: these failure-derived stable-CLI runs may justify implementation changes but cannot authorize publication. A fresh independently authored v6 holdout remains mandatory after the final candidate is frozen.

## 2026-09-04: make the permanent overlap test match the sealed method

Observed: the root test compared only the first prompt, removed punctuation before four-gram calculation, and did not tokenize Han text one character at a time, while the published holdout method specified whole-scenario text, NFKC plus whitespace normalization, and individual Han tokens.

Accepted before v6 authoring completed: align the permanent test with the published method and verify that the retired v5 corpus still passes unchanged. Root v6 sealing will additionally compare the new corpus with three historical holdouts, every committed development corpus, and both hash-verified ablation corpora.

Boundary: these are failure-derived development trials on `codex-cli 0.153.0-alpha.5`. Stable `0.153.0` regression and a fresh independent holdout are still required; no current efficacy or publication claim exists.

## 2026-09-03: require independent efficacy evidence and publish its weaknesses

Accepted: freeze an independently authored 80-scenario holdout before running either arm, then publish all 160 sanitized primary conversations, all 80 blind grades, hashes, grader retries, long-tail timing, deterministic paired-bootstrap intervals, and the exact sign test only if every predeclared release gate passes.

Current boundary: the earlier v8 result is preserved as tuned development regression evidence and cannot authorize release. The candidate holdout must record exact execution and grader model settings and bind the source plugin tree, installed execution cache, and Git archive to one clean commit.

Accepted: predeclare 60 English and 20 Simplified Chinese cases, four Chinese cases in every class, at least 40 task domains, and no more than two cases per domain. The sealed corpus exceeds this with 80 distinct domains. The independent author receives the outcome and schema but cannot inspect the product policy, generated plugin, old holdout, or development corpus text.

Rejected: coupling either the policy or the release holdout contract to a list of subjective adjectives or one memorized product example. The policy now describes the semantic condition: an unstated success criterion matters only when plausible interpretations materially change the deliverable.

Limit: even a passing result uses a synthetic corpus, one execution host, and an automated judge, and it cannot cover future model or judge drift. These constraints keep the release at beta and narrow any claim to the tested Codex policy.

Accepted: build the user-authorized DeepSeek Harness adapter from the identical policy and state server, but describe it only as compatibility and lifecycle evidence until a separate DeepSeek outcome study exists.

## 2026-09-03: make deliberate memory deterministic without widening the automatic boundary

Accepted: add `/intent remember <one short goal>` to the reviewed local command Hook, with optional explicit role prefixes. This produces a real record and receipt without depending on whether the model volunteers an MCP call.

Accepted: refuse `remember` in private mode without a receipt. The command Hook is short-lived, so an in-process private record would disappear as it exits. An automatically invoked, state-changing MCP prompt bridge was rejected because it would widen the trusted prompt and mutation surface.

## 2026-09-03: repair same-process lock initialization

Accepted: register a lock token as active before publishing its owner file, and remove the token on every exit path. A real test failure showed that a concurrent caller could otherwise observe the new owner before registration and reclaim a live same-process lock.

Verification: ten independent rounds of 100 simultaneous appends plus the strengthened permanent 100-writer regression completed without loss or lock residue.

## 2026-09-03: keep lock-pressure evidence bounded without changing product semantics

Observed: the exact Node 22.19 full suite produced one 99 / 100 result when a stress worker did not observe a new owner within its 60-second fixture timeout. Five immediate isolated reruns of the same 100-process test passed in 10.6–13.0 seconds, so the evidence supports a host-scheduling long tail rather than a data-loss or mutual-exclusion defect.

Accepted: increase only the synthetic worker timeout to 120 seconds, still below the test's 180-second outer bound. Add a separate live-owner test with a 100 ms configured timeout so this margin cannot hide a no-progress deadlock. Do not change the product's default 5-second no-progress deadline or 120-second absolute deadline without product evidence.

## 2026-08-28: freeze the product boundary

Accepted: one Codex Plugin, one intervention Skill, one local MCP state service, and optional fail-open Hooks. Codex keeps all planning and execution ownership.

Rejected: a prompt pack, intake form, PRD generator, completion gate, full user profile, Agent Harness, independent chat client, App Server client, transcript parser, or cross-agent adapters in this MVP.

## 2026-08-28: use outcome evidence

Accepted: paired deliverables, blinded final-match grading, causally attributed rework, user corrections, interruption burden, latency, privacy scans, export round-trip, and physical deletion.

Rejected: tool calls, question counts, populated fields, protocol text, build success, or test invocation as proof of efficacy.

## 2026-08-28: local append ledger

Accepted: per-project hash-chained JSONL with a serialized append lock, ledger-derived projections, explicit supersession/invalidation, and privacy deletion through a verified atomic rewrite.

Deferred: SQLite or a remote database. The MVP has no network and no native database dependency; the JSONL design is covered by corruption and concurrency tests.

## 2026-08-28: no rich UI dependency

Accepted: ordinary Codex dialogue and a manual Skill path. Structured input is opportunistic only.

Deferred: MCP App UI because it is disabled on the installed surface and is not needed for the core loop.

## 2026-08-28: honest release state

The implementation can become technically usable after E2E. It cannot become a product Go until the frozen 80-task paired evaluation clears every threshold. Until then the release judgment is Iterate.

## 2026-08-28: public beta distribution

Accepted: an opt-in GitHub repo marketplace beta with committed self-contained Node runtime bundles, Apache-2.0 licensing, public privacy/terms/security/support documents, CI, and tagged releases.

Accepted evidence language: public beta distribution is technically Go while product efficacy remains Iterate. Installation, runtime, privacy, and deletion evidence cannot be relabeled as lower rework or better final-match evidence.

Deferred: OpenAI universal-directory submission. A plugin with MCP currently requires a public HTTPS server, domain verification, platform identity and permissions, and reviewer materials. Moving local intent data to a hosted service would materially change the frozen privacy boundary.
