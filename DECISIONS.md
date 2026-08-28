# Decision log

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
