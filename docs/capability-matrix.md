# Gate 0 and Gate 1 evidence

Checked on 2026-08-28 against Codex CLI `0.150.0-alpha.8` and current official documentation.

Status terms: **Confirmed** has direct documentation or an executed probe; **Unsupported** has direct negative evidence; **Unverified** remains an explicit implementation or end-to-end risk.

## Gate 0: repository and scope

| Check | Status | Direct evidence |
| --- | --- | --- |
| Canonical location | Confirmed | Release work used one canonical repository checkout; project commands were not split across placeholder workspaces. |
| Existing same-name project | Confirmed absent | The target repository was initialized as a new project rather than layered over another implementation. |
| Existing user assets or uncommitted changes | Confirmed absent | The new project path did not exist. Empty, unrelated experimental directories were not reused. |
| Repo instructions | Confirmed | Workspace instructions were read before implementation. No prior project contribution or plugin structure existed to preserve. |
| MVP scope | Confirmed | This release is Codex-only; other agent adapters are prohibited until real paired evaluation passes. |

Gate 0 result: **PASS**. There was no prior implementation whose direction could conflict with the frozen baseline.

## Gate 1: Codex capabilities

| Required capability | Status | Direct evidence and boundary |
| --- | --- | --- |
| Package Skill + bundled MCP + Hooks | Confirmed | Official plugin packaging supports `skills/`, `.mcp.json`, and `hooks/hooks.json`. The official plugin-creator validator accepted a local package containing all three. |
| Hook events and real I/O | Confirmed | A minimal hook received sanitized `SessionStart`, `UserPromptSubmit`, `PostCompact`, `Stop`, and `SessionEnd` fixtures and returned valid fail-open JSON. Official schemas define each event. |
| Non-blocking hooks | Confirmed | `continue: true` is supported. Stop blocking would make Codex continue, so the product never emits it. SessionEnd is advisory only. |
| Writable local plugin state | Confirmed with host limitation | Official packaging defines `PLUGIN_DATA` for Hooks. The installed MCP child uses the shared `${CODEX_HOME}/plugin-data/intent-loop/v1` compatibility root because Hook-only variables are not forwarded to the MCP process. A new Codex process recovered an earlier task/claim from that root, and a later process confirmed physical deletion. |
| Skill reads state and calls MCP | Confirmed with compatibility fallback | A clean-workspace `$intent show` run discovered the installed Skill. Direct cache reads were blocked by the Windows sandbox, so Codex read the actual bundled file through static MCP resource `intent-loop://skill/intent`, then called `intent_status` without mutation. Real installed write/read/delete calls also pass with normal approvals. |
| Current project scope reaches MCP | Confirmed | The server advertises experimental `codex/sandbox-state-meta`; Codex `0.150.0-alpha.8` injected a file-URI `sandboxCwd` on real calls. A fresh start plus later snapshot/correction/evidence/export/off calls all omitted `project_root` and resolved the same project ID. Contract tests reject a conflicting explicit root. |
| Structured user input in current surface | Partly supported | Plan-mode structured questions and MCP elicitation exist. `default_mode_request_user_input` is disabled on this build, so the MVP must use ordinary conversation in the normal/headless path. |
| Hook review and disable controls | Confirmed | Plugin hooks are not trusted automatically; the user must review them. Plugins, bundled MCP servers, and hooks can be disabled, and global hooks can be switched off. |
| MCP App / rich UI | Unsupported as an MVP dependency | `enable_mcp_apps` is false on this build. The core and Skill therefore expose a complete headless path. |
| Stable task history access inside a plugin | Unsupported | Full history is available through Codex App Server to a client, not as a documented plugin API. Transcript files are explicitly unstable. Pre-install history is explicit-import only. |
| App Server or independent client required | Confirmed no | The bounded architecture needs neither. App Server was inspected only to establish the history boundary. |

Installed feature probe:

```text
plugins                       stable              true
hooks                         stable              true
apps                          stable              true
enable_mcp_apps               under development   false
default_mode_request_user_input under development false
skill_mcp_dependency_install  stable              true
auth_elicitation              stable              true
tool_call_mcp_elicitation     stable              true
goals                         stable              true
```

Gate 1 result: **PASS FOR THE BOUNDED TECHNICAL MVP**. The installed headless path works and does not depend on a forbidden surface. Real installed MCP calls, approval behavior, restart persistence, deletion, and one-invocation `SessionStart` Hook delivery were verified. A naturally triggered `PostCompact` plus resume cycle remains a controlled-pilot check; it is not required to justify a new client or transcript parser.

## Gate 1b: DeepSeek Harness developer-preview adapter

Checked on 2026-08-31 against the official DeepSeek Harness repository and documentation plus local package `0.1.2-alpha.2`.

| Required capability | Status | Direct evidence and boundary |
| --- | --- | --- |
| Plugin tool registration | Confirmed | The Harness plugin API registers raw tool definitions through `ctx.tools.register`; the adapter contributes all fifteen generated Intent Loop tools and one compact guidance section. |
| Active workspace/session identity | Confirmed | Harness exposes the active agent session's `cwd` and session ID. The adapter removes caller-facing selectors, canonicalizes the host cwd, and privately hashes/injects session ownership. |
| Git package installation | Confirmed locally | Official plugin management accepts package or Git specs. A packed repository bundle was added to a temporary `headless` profile, composed, booted through the help path, removed, and confirmed absent. |
| Prebuilt package requirement | Confirmed | The root package ships prebuilt adapter JavaScript, the shared MCP runtime, generated tool catalog, Skill, notices, and SBOM; no install-time build is required. |
| Session-private MCP memory | Confirmed | A bounded pool creates one MCP child per active Harness session, preserves in-session private semantics, isolates another session, serializes concurrent creation, enforces a hard capacity, and closes every child on eviction or unload. The suite passes on all three public runner systems. |
| Credential boundary | Confirmed | Child environment tests show model-provider API keys/tokens are omitted. The state runtime contains no outbound network client. The adapter suite passes on all three public runner systems. |
| Windows/Linux/macOS | Confirmed for the headless candidate | Repaired code commit `d0fba7103c7999ce4f47b3ee6602380b7ead7932` passed all 18 jobs in public run [`33377049544`](https://github.com/rrrrrredy/intent-loop/actions/runs/33377049544), including adapter tests and a real temporary Harness package/add/compose/boot-help/remove lifecycle on each system. Native GUI-specific behavior is outside this claim. |

Gate 1b result: **PASS FOR THE REPAIRED BOUNDED ADAPTER ON THE THREE HEADLESS RUNNER SYSTEMS**. This is transport evidence and does not change the frozen `NO RESULT` efficacy status or authorize more host ports. Exact-tag public installation remains a separate release check.

## Primary sources

- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Build skills](https://developers.openai.com/plugins/build/skills)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [Codex Hooks](https://learn.chatgpt.com/docs/hooks)
- [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)
- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Slash commands](https://learn.chatgpt.com/docs/reference/slash-commands)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [Develop a Harness plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/)
- [Harness plugin tool API](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/tool)
- [Publish and install Harness plugins](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
