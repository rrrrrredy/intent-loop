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

Accepted after failure attribution: remove the global question-only override for explicit evidence requests; honor exact sample counts; preserve neutral user ownership; treat missing files/data/access as ordinary inputs; and isolate conflict handling from generic option generation. The revised policy is 1,098 bytes, 12.4% below the original, and passed 8 / 8 real-host failure regressions with no first-turn actions or MCP calls.

Retained: the semantic costly-divergence trigger, neutral flexible-answer exit, tiny inline samples, and feedback classification. Removing these either caused observed failures or would erase a frozen product requirement.

Limit: both ablation sets and the eight post-failure cases are development evidence. Because the first holdout informed the revision, it is permanently retired from release-gate use; a different independent author must seal a new unseen 80-scenario corpus before another formal run.

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
