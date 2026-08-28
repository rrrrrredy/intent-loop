# Frozen brief reconciliation

The supplied research/PRD text was treated as the controlling brief. The product baseline was frozen before source implementation, then every implementation choice was checked against it. No pre-existing same-name repository or user assets were found to overwrite.

| Brief requirement | Delivered surface | Status and boundary |
| --- | --- | --- |
| Stay in the current Codex task | Plugin Skill plus bundled MCP and optional Hooks | Implemented; there is no second client or workbench. |
| Help intent form through one question, 2-3 comparisons, or a cheap sample | `skills/intent/SKILL.md` plus read-only MCP resource fallback | Implemented and clean-workspace loaded; task-level effectiveness remains a paired-eval hypothesis. |
| Updateable, traceable, disagreement-preserving current intent | Event schema, projection, service, export | Implemented and tested; no “one true intent” claim. |
| Distinguish explicit/inferred/evidence/unknown/disputed/superseded | Types, validators, MCP tools, projection | Implemented and tested; explicit means stated, not factual. |
| Preserve all required claim fields | `Claim` model and ledger schema | Implemented; confidence is mandatory only for inference and disallowed elsewhere. |
| Plugin + one Skill + local MCP + optional Hooks | `plugins/intent-loop` | Implemented, validated, installed, and real-host probed. A clean project read the complete installed Skill through `intent-loop://skill/intent` after direct cache reading was denied. |
| Hooks observe/restore/candidate only; never semantic gate | Hook handler and trust doc | Implemented; every output is `continue: true`; Stop never returns a continuation decision. |
| Native structured input or ordinary dialogue; no rich UI dependency | Skill manual routes | Headless ordinary dialogue is complete. Current normal-mode structured question support is unavailable, so it is opportunistic rather than required. |
| No App Server client or unstable transcript parsing | Architecture and code search | Enforced as a non-goal. App Server was consulted only to establish the formal-history boundary. |
| Codex keeps reasoning/execution/permissions | Skill and MCP tool descriptions | Enforced; MCP contains only intent state operations. |
| Gates 0-3 before implementation | `frozen-baseline`, capability, evaluation, privacy docs | Frozen before source work. Gate 0 passed; Gate 1 passed for the bounded host architecture; Gate 2 produced an evaluable protocol but no efficacy result; Gate 3 contracts and selected real-host lifecycle checks passed. |
| Atomic append state, migration, recovery, concurrency | Storage, migrations, tests | Implemented and passing. |
| Minimum MCP semantic tools | 15 `intent_*` tools | Implemented; official MCP client and installed Codex calls pass. |
| Manual intent commands | Skill manual-entry section | Implemented as Skill routes, not a custom slash-command client. |
| Context restore | Hook plus compact snapshot | Fixture/contract tests pass and real SessionStart delivery passes; a naturally triggered real PostCompact/resume cycle remains unobserved. |
| Post-install history and cautious long-term learning | Candidate and long-term rules | Implemented and tested; older history is explicit import with `history_complete=false`. |
| Failure-oriented regressions | 15-case frozen policy suite plus tests | Present; implementation/security cases run automatically, while outcome/intervention cases belong in the paired study. |
| Real Codex E2E | Installed create/write/read-restart/delete and Hook probe | Completed for core state lifecycle and SessionStart delivery. |
| 80-task evaluation and fixed thresholds | Corpus, schema, annotation guide, protocol | Instrument complete and frozen; paired human task execution has not occurred. |
| Other-agent adaptations only after success | Decision log and release decision | Enforced. No adapter, plan, or estimate is produced at **Iterate**. |

## Reconciled deviations forced by current host behavior

Two implementation details changed without changing the product:

1. Bundled MCP launch uses `cwd: "."` and a relative script path. The tested Codex build expands `${PLUGIN_ROOT}` for Hook commands as documented, but not in MCP arguments.
2. The MCP server key is `intent_loop` rather than `intent-loop` because the underscore namespace is exposed reliably by the tested host. The plugin/product name remains Intent Loop.

Both changes are transport/packaging fixes. They do not add a client, Harness, transcript dependency, UI, or execution ownership.
