# Intent Formation for Codex

Intent Formation is a quiet interaction policy for the current Codex task. It lets clear work continue and intervenes only when an unresolved choice changes the next useful action and guessing risks material rework or external impact.

It chooses one low-burden move: one focused question, two or three concrete directions, or the smallest useful sample. It also separates a flaw in the delivered result from a genuine change in the user's goal.

The core plugin is state-free. Its warm local MCP tool accepts no arguments, receives no prompt text, makes no network request, and returns only the compact policy used by the UserPromptSubmit Hook.

## Use

Install through the repository marketplace, start a new Codex task, review the Hook, and talk normally. No command is required.

The optional `intent-formation-state` companion adds receipt-backed `/intent` controls, sparse local records, resume, private mode, export, and deletion. Install it only when continuity matters.

## Development

Requires Node.js 20 or newer:

~~~shell
npm ci
npm test
~~~

`npm test` rebuilds both exact distribution directories, runs policy and packaging checks, exercises the bundled stdio MCP server, and tests state, privacy, recovery, export, and deletion boundaries.

The product evidence and complete install guide live at <https://github.com/rrrrrredy/intent-loop>.

Licensed under Apache-2.0.
