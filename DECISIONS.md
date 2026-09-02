# Decision log

## 2026-09-03: rebuild around user-visible intent formation

Accepted: replace the v0.2 requirement-ledger-first experience with a quiet interaction policy that proceeds on clear work, asks one question before a costly divergent branch, compares concrete directions when vocabulary is missing, and uses a small sample when preference needs a result.

Rejected: presenting the structured ledger, tool count, or process protocol as the product. Sparse state remains an optional continuity layer.

## 2026-09-03: split core behavior from optional state

Accepted: a state-free `intent-formation` core and an independently installable `intent-formation-state` companion. Core policy transport accepts no prompt input. State controls require receipt-backed success; `remember` may start standard state directly, while private, off, export, and forget remain explicit user controls rather than hidden automation.

Accepted: keep the existing GitHub repository and history while using a semver-minor prerelease with explicit breaking migration notes. Old v0.2 state is never imported silently.

## 2026-09-03: publish full efficacy evidence and its weaknesses

Accepted: publish all 160 sanitized primary conversations, all 80 blind grades, hashes, grader retries, long-tail timing, deterministic paired-bootstrap intervals, and the exact sign test. The v0.3 point-estimate gates pass.

Limit: the latency interval crosses the five-percent gate, the corpus is synthetic, the judge is automated, and exact model identities were not recorded. These constraints keep the release at beta and narrow the claim to the tested Codex policy.

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
