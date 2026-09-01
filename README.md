# Intent Loop

[![CI](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-0.2.0--beta.3-6657D9.svg)](CHANGELOG.md)

Intent Loop gives Codex or DeepSeek Harness a small, local, traceable memory of what you currently want. It keeps requirements, guesses, evidence, unknowns, and disagreements separate, and updates the current view without erasing earlier corrections.

It stays inside the task where work is already happening. It does not plan or execute the work, bypass permissions, read private transcripts, create a user profile, or add another agent harness.

## In plain language

Think of Intent Loop as a requirement note that the AI can keep tidy while you work:

1. You say what you want, what must not change, and what is still uncertain.
2. Intent Loop records those points in separate labeled boxes.
3. When you correct something, the new version becomes current and the old version remains traceable.
4. You can ask to see, export, switch off, or delete the note at any time.

See the [simple Chinese guide](docs/simple-guide.zh-CN.md) for a two-minute introduction.

## What it does

- Keeps explicit statements, inferences, external evidence, unknowns, and disagreements separate.
- Preserves corrections through supersession and invalidation instead of silently overwriting history.
- Stores structured, credential-redacted local records instead of complete prompts or transcripts by default.
- Supports `on`, `private`, and `off` modes.
- Binds every project-scoped call to the active host workspace; a model cannot redirect a call to another project.
- Exports a compact summary or a portable task graph and physically deletes a claim or task after exact confirmation.
- Provides the same fifteen intent-state tools to Codex and DeepSeek Harness through one shared local MCP core.

## Hosts and evidence boundary

| Host | Package | Runtime | Current boundary |
| --- | --- | --- | --- |
| Codex | Repository marketplace plugin | Node.js 20+ | Self-contained Skill, MCP server, and optional fail-open Hooks |
| DeepSeek Harness | `dsh-intent-loop` bundle | Node.js `^22.19.0` or `>=24.0.0` | Thin adapter pinned to Harness `0.1.2-alpha.2`, which is a developer preview |

The source suite has 73 Codex tests. The DeepSeek adapter additionally tests tool registration, credential isolation, bounded session cleanup, real MCP calls, workspace forgery rejection, session isolation, deletion, and package composition. A temporary Windows DeepSeek Harness lifecycle completed package, add, compose, boot-help, remove, and cleanup without a model API key.

GitHub Actions runs the Codex and DeepSeek suites on Windows, Ubuntu, and macOS. Exact release results are recorded in the [verification report](docs/verification-report.md). These checks establish implementation and packaging behavior. The frozen paired 80-task human study has not been run, so this beta makes no claim that it reduces rework or improves final results.

## Install for Codex

Review the plugin manifest, Skill, MCP definition, and optional Hooks before installation:

- `plugins/intent-loop/.codex-plugin/plugin.json`
- `plugins/intent-loop/skills/intent/SKILL.md`
- `plugins/intent-loop/.mcp.json`
- `plugins/intent-loop/hooks/hooks.json`

~~~powershell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.2.0-beta.3
codex plugin add intent-loop@intent-loop
~~~

Start a new Codex task after installation. Manual Skill and MCP use works without Hook trust. Automatic session association and compact-context restoration require you to inspect and explicitly trust the Hook definition.

## Install for DeepSeek Harness

DeepSeek Harness requires Node.js `^22.19.0` or `>=24.0.0` and `pnpm` on `PATH`.

~~~shell
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.2.0-beta.3
~~~

Use `web` instead of `headless` for the Web profile. See the [DeepSeek adapter guide](dsh/README.md) for its session, storage, and uninstall boundaries.

## Use

Ask in ordinary language:

- `Track the requirements I just gave you with Intent Loop.`
- `Show the current intent for this task.`
- `I changed my mind: the output must be a single HTML file.`
- `Keep the goal, but record that this result needs an implementation change.`
- `Export a short intent summary.`
- `Delete this task's Intent Loop data.`

Codex also supports the manual routes `$intent start`, `$intent show`, `$intent correct`, `$intent feedback`, `$intent export`, `$intent forget`, and `$intent off`.

## Data and privacy

The bundled runtime has no outbound network client. Durable state stays under the active host's local plugin data directory. The host supplies the current workspace; Intent Loop canonicalizes and hashes it for isolation and does not persist the raw project path in ledger events.

Default persistence stores atomic claims and minimal source references, not complete prompts, transcripts, workspace files, or tool output. Credential-pattern redaction is not comprehensive personal-information detection: personal data intentionally placed in a claim can remain. See the [privacy policy](docs/privacy-policy.md), [threat model](docs/privacy-threat-model.md), and [security policy](SECURITY.md).

## Uninstall

Codex:

~~~powershell
codex plugin remove intent-loop@intent-loop
codex plugin marketplace remove intent-loop
~~~

DeepSeek Harness:

~~~shell
dsh plugin --profile headless remove dsh-intent-loop
~~~

Package removal and task-data deletion are separate operations. Ask Intent Loop to delete the task first if its local records must also be physically removed. Operating-system backups, snapshots, and copied exports remain outside the deletion boundary.

## Develop and test

Codex package, Node.js 20+:

~~~powershell
Set-Location .\plugins\intent-loop
npm ci
npm test
~~~

DeepSeek package, Node.js 22.19+ or 24+:

~~~powershell
Set-Location ..\..
npm ci
npm test
npm run test:dsh-host
~~~

The host-smoke command creates a temporary DeepSeek home, installs the packed repository bundle, composes and boots the profile help path, removes the bundle, and deletes the temporary home. It does not require or use a model API key.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements and [distribution-and-submission.md](docs/distribution-and-submission.md) for the two public package paths.

## Release and evidence

- [verification-report.md](docs/verification-report.md) records automated and real-host behavior.
- [paired-evaluation-result.md](docs/paired-evaluation-result.md) records `NO RESULT` for the unrun human comparison.
- [release-decision.md](docs/release-decision.md) separates public-beta readiness from unverified efficacy.
- [accepted-deferred-rejected.md](docs/accepted-deferred-rejected.md) records the bounded, user-authorized DeepSeek transport exception.
- [independent-reviews.md](docs/independent-reviews.md) records adversarial and practical-use review findings.

## License

Apache License 2.0. It permits commercial and private use, modification, and redistribution while retaining notices, and includes an explicit patent grant. See [LICENSE](LICENSE), the [Codex notices](plugins/intent-loop/THIRD_PARTY_NOTICES.md), and the [DeepSeek package notices](dsh/THIRD_PARTY_NOTICES.md).
