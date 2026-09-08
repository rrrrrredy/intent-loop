# Intent Formation for DeepSeek Harness

`dsh-intent-formation` brings the same compact intent-formation policy to the official DeepSeek Harness developer preview and exposes 15 session-bound local state tools. It contributes no planner, executor, chat client, or additional Agent.

DeepSeek Harness is a moving prerelease surface. This package is pinned to `@deepseek-ai/dsh` `0.1.2-rc.1`; a Harness API change may require a new Intent Formation prerelease.

## Source verification

There is no v0.3 tag or published installer. Existing v0.2 release assets are the earlier product. Do not remove an installed v0.2 bundle to try a nonexistent v0.3 tag.

Developers can verify the committed source with Node.js `^22.19.0` or `>=24.0.0` and `pnpm`. From the repository root:

~~~shell
npm ci
npm run test:dsh-host
~~~

The existing smoke script packs, adds, composes, checks help, and removes the package in a temporary headless Harness home. It requires no model API key, does not change a normal Harness profile, and removes its temporary home. This is developer verification, not a beginner installation guide or a DeepSeek model evaluation.

## Use

Talk to the active Harness Agent normally. The shared policy tells it to continue on clear tasks and use one bounded question, comparison, or sample before a costly divergent branch.

The adapter opens one local MCP process lazily per active Harness session. It obtains the workspace and session identity from the trusted host path, removes `task_id`, `cwd`, `project_root`, and `host_session_id` from model control, and injects a session-derived task ID. The child process receives a narrow environment allowlist with model API keys removed.

State lives under `${DSH_HOME}/plugin-data/intent-formation/v1`, or `~/.dsh/plugin-data/intent-formation/v1` when `DSH_HOME` is unset. Private state lives only for the MCP process lifetime. The session pool is bounded, closes idle processes, forwards cancellation and timeouts, and drains active siblings before closing a failed session.

## Uninstall

The source lifecycle check already removes its own temporary installation. No manual uninstall is needed after that check. The following applies only to an adapter you separately installed: select and verify the original `DSH_HOME` and profile first, then delete required task data through `intent_forget` before removing the package. Package removal and data deletion are separate operations. This command is for an original `headless` installation; replace `headless` with the original profile when it differs.

~~~shell
dsh plugin --profile headless remove dsh-intent-formation
~~~

## Evidence boundary

The repository tests the exact 15-tool catalog, shared-policy identity, next-turn and cold-restart `off` behavior, credential isolation, forged-workspace rejection, cross-session isolation, private-state disk absence, physical deletion, exact package contents, and a temporary package/add/compose/boot-help/remove lifecycle on Windows, Ubuntu, and macOS.

Those checks establish adapter and packaging behavior. The 80-scenario outcome study ran in Codex, so it does not establish DeepSeek efficacy. Releasing this adapter is a bounded compatibility experiment while Harness remains in developer preview.

Licensed under Apache-2.0.
