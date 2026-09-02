# Codex capability check

> Historical Gate 1 result. Host capability was sufficient to continue evaluation. The first product study returned STOP. Later runs on the same tuned corpus are development regressions, not independent release-efficacy evidence.

Checked against current official OpenAI documentation and a real local Codex host on 2026-09-01.

Statuses mean:

- **Confirmed** — supported by current documentation and/or direct runtime evidence;
- **Unsupported** — the checked host or official contract does not provide it;
- **Unverified** — plausible, but no stable contract or direct evidence was established.

| Capability | Status | Direct evidence | Product consequence |
|---|---|---|---|
| Plugin packages Skill and local MCP components | Confirmed | [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins); Plugin Creator validation; `codex plugin add` installed the bundled package | One Codex plugin can carry the interaction policy and bounded local state service. |
| Bundled stdio MCP starts from a portable plugin path | Confirmed with host caveat | Real `codex mcp list` resolved `cwd: "."` to the installed plugin cache and launched `dist/intent-formation-server.mjs` | Use relative `cwd` plus a relative bundle path. Do not rely on placeholder expansion in a traditional marketplace `.mcp.json`. |
| Traditional plugin MCP expands `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` | Unsupported in the tested host | Initial real-host handshake failed; `codex mcp list` displayed the placeholders literally | The package infers Codex Home from the resolved cache root and uses the host's native data variable only when actually supplied. |
| Skill can call the local state MCP | Confirmed | Real Codex emitted completed `intent_start`, `intent_add_explicit`, `intent_show`, and `intent_forget` calls with structured `ok: true` results | Manual and sparse automatic state updates work in the current task. |
| Local state survives a new Codex/MCP process | Confirmed | A second independent Codex process read the prior process's explicit record and then deleted it | Continuity is disk-backed, not an in-memory demo. |
| Plugin data stays under configured Codex Home | Confirmed for tested Windows host | The repaired run wrote under `<CODEX_HOME>/plugin-data/intent-formation`; the earlier empty fallback outside the configured home was removed | The configured Codex Home boundary is respected on the tested host. Linux/macOS path logic is implementation-tested but not yet host-tested. |
| The product's SessionStart and UserPromptSubmit hooks are available | Confirmed | [Codex Hooks](https://learn.chatgpt.com/docs/hooks); real plugin hook execution and lifecycle tests | The State companion restores compact context on resume/compact and handles bounded controls with three-second fail-open limits. The core policy uses one warm MCP UserPromptSubmit hook. |
| Users review and can disable plugin hooks | Confirmed | [Plugin-bundled hooks](https://learn.chatgpt.com/docs/hooks#plugin-bundled-hooks); real CLI required explicit test trust bypass | Hook code and configuration remain inspectable; disabling tracking does not block Codex. |
| Stable transcript parsing is available | Unsupported | [Codex Hooks](https://learn.chatgpt.com/docs/hooks) states transcript format is not stable | The product never reads or parses transcript files and cannot promise pre-install history access. |
| Ordinary conversational input is available everywhere Codex runs | Confirmed | Real manual `/intent ...` messages and standard prompts | Headless text controls are the required MVP path. |
| Rich structured user-choice UI is guaranteed on every Codex surface | Unverified | No current official cross-surface guarantee found | Comparisons use ordinary conversation. Rich UI is optional future enhancement. |
| MCP Apps can provide an optional richer surface | Confirmed as platform capability, unused | [Build an MCP Apps UI](https://developers.openai.com/plugins/build/mcp-apps) | The MVP deliberately remains headless and does not depend on Apps. |
| Deletion and export can be implemented locally | Confirmed | stdio MCP integration plus failure regressions for main store, recovery side files, provenance-preserving export/import, and integrity rejection | Gate 3 can be tested without a custom client. |

## Real-host failure chronology

1. The first package used `${PLUGIN_ROOT}` in MCP arguments and `${PLUGIN_DATA}` in its environment.
2. The host listed both literally; MCP initialization closed during handshake.
3. Codex nevertheless produced prose claiming the requested state operation had succeeded. That prose was rejected because no tool receipt existed.
4. The MCP key changed from `intent-formation` to `intent_formation`, and the config changed to `cwd: "."` with a relative bundle argument.
5. Structured calls then completed successfully.
6. A storage-location check found the child process lacked the expected data variables. Cache-root inference aligned MCP and Hooks under configured Codex Home.
7. Two independent processes then proved persistence and physical deletion.

This chronology is retained because a green bundle test and a plausible final response did not reveal the real integration failures.

## Gate decision

**GO for continued Codex MVP evaluation.**

Gate 1 is satisfied without private transcripts, Codex source modification, App Server, a custom chat client, or takeover of planning and execution.

This was not a public-release decision or product-efficacy result. The later redesigned paired evaluation and release review are documented separately.
