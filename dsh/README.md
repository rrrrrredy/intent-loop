# Intent Loop for DeepSeek Harness

This package is a thin DeepSeek Harness adapter over the same local MCP core used by the Codex plugin. It adds fifteen structured intent tools and a compact model-guidance section. It does not add another agent, planner, chat client, or execution layer.

DeepSeek Harness is currently a developer preview. This adapter is pinned to `@deepseek-ai/dsh` `0.1.2-alpha.2`; breaking Harness changes may require a new Intent Loop prerelease.

## Install from GitHub

DeepSeek Harness requires Node.js `^22.19.0` or `>=24.0.0` and `pnpm` on `PATH`.

~~~shell
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.2.0-beta.4
~~~

Use `web` instead of `headless` to add the same bundle to the Web profile. The package contributes `dsh/cordis.patch.yml`, which inserts one `dsh-intent-loop` plugin row.

## Use

Ask in ordinary language. For example:

- `Track the requirements I just gave you with Intent Loop.`
- `Show the current intent for this task.`
- `Record that this result needs an implementation change; the goal itself is unchanged.`
- `Export a short intent summary.`

The adapter reads the immutable workspace and session identity from the active Harness agent. `project_root` and `host_session_id` are removed from model-visible schemas and injected by the adapter. A model cannot redirect an Intent Loop call to another workspace or select a different private-session owner.

One local MCP process is opened lazily per active Harness session. This preserves private-mode memory within that session. The pool is bounded, closes idle processes, forwards cancellation and timeouts, and closes every process when the plugin unloads. If one concurrent call fails, that session stops accepting new calls, lets already-active sibling calls settle, and then closes the shared client once. A private task's in-memory semantic state is lost if its MCP process or the Harness process exits; the durable recovery control remains available for exact deletion.

By default, durable data is stored under `${DSH_HOME}/plugin-data/intent-loop/v1`, or `~/.dsh/plugin-data/intent-loop/v1` when `DSH_HOME` is unset. The MCP runtime has no outbound network client. The child process receives a small allowlist of OS environment variables and no model API keys.

## Uninstall

If task data must be physically deleted, ask the active task to use `intent_delete` with its exact confirmation before removing the package. Package removal and task-data deletion are separate operations.

~~~shell
dsh plugin --profile headless remove dsh-intent-loop
~~~

## Evidence boundary

The adapter lifecycle, workspace binding, cross-project rejection, private-session isolation, deletion, package composition, and uninstall are testable without a model API key. Those checks establish transport and packaging behavior. The frozen paired 80-task outcome study remains `NO RESULT`, so this adapter does not establish reduced rework, better final matching, or a product-value Go for multi-host expansion.
