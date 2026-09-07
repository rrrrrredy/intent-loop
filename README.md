# Intent Formation

[![CI](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml)
[![Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Prerelease](https://img.shields.io/github/v/release/rrrrrredy/intent-loop?include_prereleases&label=prerelease)](https://github.com/rrrrrredy/intent-loop/releases)

Intent Formation helps Codex notice the one undecided choice that could send expensive work in the wrong direction. Clear tasks continue normally. When a choice genuinely changes the next useful action, Codex asks one focused question, shows two or three concrete directions, or makes a tiny sample you can react to.

There is no form to fill in and no separate chat app. Talk to Codex as usual.

## What it feels like

- “Translate this paragraph.” → Codex translates it directly.
- “Design the product so it feels premium.” → If plausible meanings would produce materially different work, Codex asks one useful tradeoff question.
- “I know this screen is wrong, but I cannot describe why.” → Codex shows a few small alternatives so you can point to what fits.
- “The button is broken; keep the design.” → Codex treats that as an implementation correction, not a new preference.

The product stays inside the current task. Codex still owns planning, tools, permissions, implementation, testing, and delivery.

## Install the simplest version

These instructions target `v0.3.0-beta.1`. Check [Releases](https://github.com/rrrrrredy/intent-loop/releases) first: if that version is not listed, these commands are not yet a usable public installation path. Follow the instructions attached to an available release instead.

Prerequisites: [Codex CLI](https://developers.openai.com/codex/cli) and Node.js 20 or newer on `PATH`.

Copy these two commands into a terminal:

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.3.0-beta.1
codex plugin add intent-formation@intent-loop
~~~

Start a new Codex task. Review the plugin Hook when Codex asks. The core plugin receives no prompt text through its MCP tool and writes no intent records.

That is all most people need. Give Codex a task in your own words.

## Optional local memory and controls

Install the State companion only when you want a small task-local record that can survive compaction or a later process:

~~~shell
codex plugin add intent-formation-state@intent-loop
~~~

Start a new task, review the two local Hooks, then type:

~~~text
/intent start
~~~

Useful controls:

| Message | Effect |
| --- | --- |
| `/intent remember <one short goal>` | In standard mode, save one explicit goal with a receipt; `constraint:`, `preference:`, `success:`, and `tradeoff:` prefixes are optional. |
| `/intent show` | Show the active task records and their source. |
| `/intent correct <record-id> => <replacement>` | After `show`, copy the record ID and replace its current statement; the old record remains auditable. |
| `/intent export` | Write an integrity-checked JSON export and report its opaque export ID and SHA-256. |
| `/intent private` | Purge persisted task content; new record text lives only in the current MCP process. |
| `/intent off` | Stop implicit intent intervention and state updates for this task. |
| `/intent forget` | Physically purge this task from plugin-managed state and managed exports. |

`/intent off` is confirmed only when the reviewed State UserPromptSubmit Hook returns an `IF-...` receipt. Noninteractive `codex exec` cannot perform Codex's Hook review; do not treat its model-only fallback as an off switch. Release automation uses the bypass flag only after reviewing the exact packaged Hook.

Successful controls return a short receipt such as `IF-12AB34CD`. No receipt means no success claim.

Exports are stored under `<CODEX_HOME>/plugin-data/intent-formation/exports/<export-id>`. The plugin does not place an absolute local path into model context.

The reported SHA-256 is the structured content digest, not the hash of the complete formatted file. Import verifies it automatically; see [export verification](docs/export-verification.md) for the exact calculation.

The State companion stores deliberate, atomic statements. It does not store complete prompts, transcripts, assistant responses, workspace files, or tool output by default. Personal information deliberately placed in an atomic statement can still remain; this is not a secret vault or general DLP system. On Unix-like systems, managed directories/files use `0700`/`0600`; Windows relies on the current account's inherited filesystem ACLs.

The trusted short-lived Hook refuses private remember, feedback, show, and correction commands: it cannot retain writes or retrieve another process's private memory. Private records can still be managed through the State MCP tools and last only for that MCP process. Private mode never stores a custom task title or workspace hash. Returning to standard mode with `/intent start` restores the reliable slash-command path.

See the [two-minute Chinese guide](docs/simple-guide.zh-CN.md), [privacy policy](docs/privacy-policy.md), and [threat model](docs/privacy-threat-model.md).

## DeepSeek Harness

The repository also contains `dsh-intent-formation`, a thin adapter for the official DeepSeek Harness developer preview. It shares the exact interaction policy and exposes the optional state tools through a session-bound local MCP process. Setting a session to `off` removes the policy on the next Harness system-prompt assembly, including after adapter restart.

~~~shell
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.3.0-beta.1
~~~

DeepSeek Harness currently requires Node.js `^22.19.0` or `>=24.0.0` and `pnpm`. The adapter is pinned to Harness `0.1.2-rc.1`; prerelease API changes may require a new Intent Formation prerelease. See [dsh/README.md](dsh/README.md).

## Evidence status

An earlier 80-scenario run is preserved as a [development regression](evidence/development-regression-v8/README.md). Because the policy was iterated against that corpus, its strong result is not used as release-efficacy evidence.

The [development ablation report](docs/ablation-report.md) records which policy and architecture elements were removed, which removals caused real Hook failures, and the observed model boundary. It is also excluded from release-efficacy claims.

The independently sealed v6 holdout was run to completion and returned `STOP`: clear-task paired latency, wrong-intervention rate, and inference-denial rate missed their fixed thresholds. A post-run audit also found at least eleven scenarios whose final-match checklist contained facts absent from the user-visible turns, so the run is retained only as a [failed diagnostic](evidence/failed-holdout-v6/README.md), never as efficacy evidence.

The prerelease remains blocked while the failure-derived revision is tested and ablated. Publication requires a newly authored, hash-sealed holdout whose every outcome requirement is an exact excerpt from a user-visible turn, run verbatim in an isolated Codex Home against one clean candidate commit, with explicit model settings, full plugin-tree fingerprints, randomized blind grading, and every predeclared gate passing. DeepSeek support has a separate compatibility and lifecycle gate; a Codex outcome result will not be presented as DeepSeek efficacy.

## Platform boundary

Source and packaging checks run on Windows, Ubuntu, and macOS with supported Node versions. The release gate requires all 18 jobs to pass: 9 Codex package combinations, 6 DeepSeek adapter combinations, and a real temporary DeepSeek package/add/compose/boot-help/remove lifecycle on all three operating systems. Native GUI behavior is outside this headless claim.

## Uninstall

If State is installed and you want its current task data removed, run `/intent forget` first and keep the receipt. Then:

~~~shell
codex plugin remove intent-formation-state@intent-loop
codex plugin remove intent-formation@intent-loop
codex plugin marketplace remove intent-loop
~~~

For DeepSeek Harness:

~~~shell
dsh plugin --profile headless remove dsh-intent-formation
~~~

Removing a package does not remove operating-system backups or exports copied outside the managed plugin-data directory.

Users of the older Intent Loop v0.2 beta should read the [v0.2 migration note](docs/migration-v0.2.md). This release deliberately does not import old state silently.

## Develop and verify

~~~shell
cd packages/intent-formation
npm ci
npm test

cd ../..
npm ci
npm test
~~~

The core build creates exact, dependency-contained Codex distributions in `plugins/intent-formation` and `plugins/intent-formation-state`. The root suite verifies published study hashes, DeepSeek tool generation, credential isolation, real MCP behavior, and the exact package allowlist.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and the [release evidence report](docs/verification-report.md).

## License

Apache License 2.0. You may use, modify, and redistribute the project, including commercially, while retaining the required license and notices. The license includes an explicit patent grant. See [LICENSE](LICENSE) and the package-specific third-party notices.
