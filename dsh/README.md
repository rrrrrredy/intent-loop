# Intent Formation for DeepSeek Harness

`dsh-intent-formation` brings the same compact intent-formation policy to the official DeepSeek Harness developer preview and exposes 15 session-bound local state tools. It contributes no planner, executor, chat client, or additional Agent.

DeepSeek Harness is a moving prerelease surface. This package is pinned to `@deepseek-ai/dsh` `0.1.2-rc.1`; a Harness API change may require a new Intent Formation prerelease.

## Install

Prerequisites: Node.js `^22.19.0` or `>=24.0.0`, `pnpm`, and DeepSeek Harness.

~~~shell
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.3.0-beta.1
~~~

Use `web` in place of `headless` for the Web profile. The patch contributes one `dsh-intent-formation` plugin row.

## Use

Talk to the active Harness Agent normally. The shared policy tells it to continue on clear tasks and use one bounded question, comparison, or sample before a costly divergent branch.

The adapter opens one local MCP process lazily per active Harness session. It obtains the workspace and session identity from the trusted host path, removes `task_id`, `cwd`, `project_root`, and `host_session_id` from model control, and injects a session-derived task ID. The child process receives a narrow environment allowlist with model API keys removed.

State lives under `${DSH_HOME}/plugin-data/intent-formation/v1`, or `~/.dsh/plugin-data/intent-formation/v1` when `DSH_HOME` is unset. Private state lives only for the MCP process lifetime. The session pool is bounded, closes idle processes, forwards cancellation and timeouts, and drains active siblings before closing a failed session.

## Uninstall

Delete required task data through `intent_forget` before removing the package. Package removal and data deletion are separate operations.

~~~shell
dsh plugin --profile headless remove dsh-intent-formation
~~~

## Evidence boundary

The repository tests the exact 15-tool catalog, shared-policy identity, next-turn and cold-restart `off` behavior, credential isolation, forged-workspace rejection, cross-session isolation, private-state disk absence, physical deletion, exact package contents, and a temporary package/add/compose/boot-help/remove lifecycle on Windows, Ubuntu, and macOS.

Those checks establish adapter and packaging behavior. The 80-scenario outcome study ran in Codex, so it does not establish DeepSeek efficacy. Releasing this adapter is a bounded compatibility experiment while Harness remains in developer preview.

Licensed under Apache-2.0.
