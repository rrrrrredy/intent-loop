# Hook definitions and trust boundary

The optional Hook file is `plugins/intent-loop/hooks/hooks.json`. Codex does not automatically trust plugin Hooks; the user can inspect the commands and decline them. Disabling Hooks or the plugin never blocks normal Codex work.

| Event | What Intent Loop does | What it never does |
| --- | --- | --- |
| `SessionStart` | Supplies an opaque in-task association token when no task is linked, or injects the compact same-project snapshot after startup/resume/clear/compact. | Read a transcript, start a task without the Skill, or block startup. |
| `UserPromptSubmit` | Hashes the prompt in memory, stores only hash/event ID/length as an unconfirmed candidate, and may inject the current compact snapshot. | Store the prompt, block submission, or promote semantics. |
| `PostCompact` | Records a hashed recovery-needed candidate; the next SessionStart supplies the current snapshot. | Parse compacted transcript text or decide what is true. |
| `Stop` | Hashes the last assistant message as a possible result-feedback candidate. | Return `block`, force another turn, or decide completion/satisfaction. |
| `SessionEnd` | Performs the same advisory result-signal recording if available. | Depend on an end reason beyond the documented current `other`, or steer the session. |

Every path returns `continue: true`, requests `suppressOutput: true`, catches all failures, uses a three-second timeout, and performs no network request. Current Codex documentation says `suppressOutput` is parsed but not yet implemented, so the command itself emits only the required JSON and writes no content-bearing operational logs. Prompts, claims, excerpts, and tokens never enter Hook logs.

The association token is injected only as developer context with an instruction not to expose it. It lets the Skill connect a user-invoked task to future same-session Hook events. Without Hook trust, manual MCP state remains available but automatic association and compaction recovery are intentionally unavailable.

Real-host check on 2026-08-28: a single ephemeral, read-only Codex invocation used the explicit `--dangerously-bypass-hook-trust` switch after local source review. `SessionStart` context reached the model, which reported `HOST_HOOK_CONTEXT_PRESENT` without revealing the token. The bypass applied only to that invocation; the post-run `[hooks.state]` contained no Intent Loop trust hash. Other Hook events pass their official fixture contracts, but a naturally triggered host `PostCompact`/resume cycle remains unverified.

Official references: [Hooks](https://learn.chatgpt.com/docs/hooks) and [plugin packaging/trust](https://developers.openai.com/plugins/build/plugins).
