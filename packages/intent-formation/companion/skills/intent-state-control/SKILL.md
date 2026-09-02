---
name: intent-state-control
description: Use only for exact /intent start, remember, show, correct, feedback, export, private, off, and forget messages when Intent Formation State is installed. Execute the requested local state operation and report its verified receipt. Do not use for ordinary prompts or implicit intent formation.
---

# Intent Formation State control

Handle one exact `/intent` control without inspecting the workspace, memories, conversation files, or unrelated configuration.

## Prefer a trusted Hook result

If current trusted local context already contains a result with `source: intent_formation_hook`, `ok: true`, and a non-empty `receipt_id`, do not call another tool. Report its summary and exact receipt in one short answer.

If the Hook result says `ok: false`, or any success field is missing, report that the command is unconfirmed. Do not reconstruct state from conversation history and do not retry through shell or web tools.

## MCP fallback when the command Hook was not trusted

Read only `CODEX_THREAD_ID`, falling back to `CODEX_SESSION_ID`, with one smallest direct environment read. Do not list the environment, search files, read Memory, or inspect the workspace. If neither value exists, say the current task ID is unavailable and make no success claim.

Do not execute `/intent off` or `/intent start off` through this fallback. A model-initiated MCP call can save an off-mode value, but it cannot prove that the untrusted UserPromptSubmit Hook will suppress the core policy on later prompts. Report the command as unconfirmed and tell the user to review and trust the State Hook in an interactive Codex task. Never claim that intervention is off without the trusted Hook receipt.

Call exactly one matching `intent_formation` MCP tool with that task ID:

- `/intent start` → `intent_start` in standard mode;
- `/intent start private` → `intent_start` in private mode;
- `/intent remember <statement>` → `intent_add_explicit` as a task-scoped `desired_outcome`; optional `goal:`, `outcome:`, `constraint:`, `preference:`, `success:`, or `tradeoff:` prefixes select the corresponding role and are removed from the saved statement;
- `/intent show` → `intent_show`;
- `/intent export` → `intent_export`;
- `/intent private` → `intent_set_mode`;
- `/intent forget` → `intent_forget`;
- `/intent correct <record-id> => <replacement>` → `intent_correct` using the selected record's role and one atomic replacement;
- `/intent feedback <keep|implementation_change|intent_change|uncertain>: <feedback>` → `intent_feedback`.

Do not call a state tool for incomplete syntax. Explain the required syntax in one sentence.

Success requires `structuredContent.ok: true`, `source: intent_formation_mcp`, and a non-empty `receipt_id`. Include the exact receipt in the answer. Missing fields or a tool error means failure; never imitate a receipt.

For export, report only the path, record count, SHA-256 digest, and receipt returned by the tool. Never paste the exported records into the conversation.
