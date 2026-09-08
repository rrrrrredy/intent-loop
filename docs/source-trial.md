# Try a fixed source snapshot

This is an experimental developer path, not a v0.3 release or an efficacy claim. The last independent confirmation failed its original gate. Do not use sensitive material or replace a working v0.2 setup for this trial.

Prerequisites: an already working Codex CLI, Git, and Node.js 20 or newer on `PATH`. The commands were checked with Codex CLI 0.153.4 and Node.js 20.19.1 on Windows. Linux/macOS have separate CI coverage, not an interactive user-test claim.

## 1. Use a disposable Codex environment

Use a separate test account or a disposable `CODEX_HOME`, following [Codex configuration](https://developers.openai.com/codex/config-basic). Keep the test environment active for **all** installation, login, use, and removal commands below. Start in an empty test folder, not a private project. Do not copy someone else's authentication or Hook trust entries.

For PowerShell, first open a scratch folder on your preferred drive. The following creates two new empty folders there and selects the disposable environment for this terminal only. Keep this terminal open until removal; it also retains your previous setting.

~~~powershell
$intentPreviousHome = $env:CODEX_HOME
$intentTrial = Join-Path (Get-Location).Path ('intent-trial-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path "$intentTrial/codex-home", "$intentTrial/workspace" | Out-Null
$env:CODEX_HOME = "$intentTrial/codex-home"
Set-Location -LiteralPath "$intentTrial/workspace"
$env:CODEX_HOME
codex login status
~~~

The printed Home must end in your new `intent-trial-.../codex-home`, not your daily Home. If login is required, use the normal `codex login` flow in this same terminal. An isolated Home does not avoid model usage charges or host sandbox prerequisites. These are PowerShell instructions; Linux/macOS interactive onboarding was not tested here.

Run `codex plugin marketplace list --json` first. If this environment already has an `intent-loop` marketplace, stop and choose a fresh environment; do not remove or upgrade the existing source. Normal Codex login and any host sandbox setup are separate prerequisites.

## 2. Install the reviewed commit

The full commit below exists publicly. It includes bounded task-outcome retention and guidance to retire directly conflicting old feedback when the goal changes; it is not a moving `main` reference or the absent v0.3 tag.

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref 73865b698e9a94a90b1a031a2942a7c29f0b063f --sparse .agents/plugins --sparse plugins/intent-formation --sparse plugins/intent-formation-state
codex plugin add intent-formation@intent-loop
codex plugin add intent-formation-state@intent-loop
codex plugin list --json
~~~

The final command should show both plugins enabled. Their manifests say `0.3.0-beta.1`; that identifies the source package, not a published release.

## 3. Review, start, and give feedback

Open interactive `codex` in the test folder. Review the three new Hooks: one Core MCP policy reader, one State prompt Hook, and one State recovery Hook. Do not bypass review. `/hooks` should show two active `UserPromptSubmit` handlers and one active `SessionStart` handler.

In the Codex chat, enter `/intent start`. A response with an exact `IF-...` receipt confirms activation. Then use ordinary language, for example:

> Make a two-sentence note for library volunteers handling returned books.
>
> Keep that purpose. Shorten the first sentence.
>
> I changed my mind: make the note for visitors borrowing books.

Use `/intent show` to inspect the current records. An implementation correction should preserve the goal; a changed purpose should replace the old goal with a sourced current version. Check the result yourself: these are model-mediated decisions and can be wrong.

The [source-use evidence](../evidence/source-usability-20260908/README.md) preserves a six-turn natural-feedback trial on the preceding commit, including the stale-feedback defect it exposed, and a separate three-turn seeded regression on this fixed commit. Neither is an independent efficacy study or proof of State-only recovery.

`/intent off` stops intervention and updates but retains old records. `/intent forget` removes this task's managed records and exports. Neither command is confirmed without its receipt. Noninteractive `codex exec` cannot perform the initial Hook review.

## 4. Remove the trial

In every trial task with retained State, enter `/intent forget` and check its receipt. Close those Codex processes. Verify that the current terminal still selects the original disposable `CODEX_HOME` and that `codex plugin marketplace list --json` identifies the trial source before running:

~~~shell
codex plugin remove intent-formation-state@intent-loop
codex plugin remove intent-formation@intent-loop
codex plugin marketplace remove intent-loop
codex plugin list --json
~~~

Both plugins should be absent. On Windows, a file-in-use error means an active task may still hold the package open; close that task and retry removal, without ending unrelated Node processes. A new terminal must select and verify the same disposable environment again before any removal command.

After preserving only the test results you need, remove the **exact disposable environment you created**, including its login copy, State, and caches. Do not delete a daily Codex Home or the source repository. Package removal alone does not erase Codex chat history or exports copied elsewhere.

For the PowerShell setup above, move outside `$intentTrial`, verify its full path, and remove only that trial folder using your file manager. In the same terminal, restore the previous selection with `$env:CODEX_HOME = $intentPreviousHome`. Closing the terminal also discards its temporary environment setting.
