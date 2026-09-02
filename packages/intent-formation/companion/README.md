# Intent Formation State

Optional local state and user controls for the Intent Formation Codex plugin. The core `intent-formation` plugin works without this companion.

Install State when you want a small task-local record to survive compaction or a later process. Start it explicitly with `/intent start`. It stores deliberate atomic statements with provenance, never a complete prompt or transcript by default.

Controls:

- `/intent start`
- `/intent remember <one short goal>`
- `/intent show`
- `/intent export`
- `/intent private`
- `/intent off`
- `/intent forget`
- `/intent correct <record-id> => <replacement>`
- `/intent feedback <keep|implementation_change|intent_change|uncertain>: <feedback>`

Every successful command returns an `IF-...` receipt. Missing receipts mean the command is unconfirmed.

In standard mode, `/intent remember <text>` is the reliable beginner path for saving one explicit goal; it executes in the local Hook instead of depending on the model to decide whether to call a tool. Optional `constraint:`, `preference:`, `success:`, and `tradeoff:` prefixes classify the statement.

Review the two packaged local Hooks in an interactive Codex task before using the controls. `/intent off` is never confirmed through the model-only MCP fallback because that path cannot prove suppression on later prompts. Noninteractive release tests use Codex's Hook-trust bypass only after auditing the exact packaged Hook.

Private mode purges persisted task content before keeping new MCP-tool record text in that MCP process only. The short-lived command Hook refuses `/intent remember` in private mode instead of returning a receipt for memory that would disappear as the Hook exits. Off mode supplies a task-specific override on every ordinary prompt. Forget removes the task's managed events and managed export files. Copies outside the managed directory, operating-system backups, and host conversation logs remain outside that deletion boundary.

The local runtime has no outbound network client. Review `.mcp.json`, `hooks/hooks.json`, and the repository privacy documentation before enabling the companion.

Licensed under Apache-2.0.
