# Intent Loop

[![CI](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml/badge.svg)](https://github.com/rrrrrredy/intent-loop/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/badge/release-0.1.0--beta.3-6657D9.svg)](CHANGELOG.md)

Intent Loop is a Codex-first plugin that keeps an updateable, traceable, disagreement-preserving view of current intent inside the task where work is already happening. It stays quiet for clear, reversible work and surfaces one low-burden question, comparison, or sample only when different interpretations would change a costly next step.

Version 0.1.0-beta.3 is the current self-contained public beta for opt-in use. It is technically installable and tested, but it is not an efficacy claim: the frozen paired 80-task human study has not been run.

## What it does

- Keeps explicit statements, inferences, external evidence, unknowns, and disagreements separate.
- Preserves corrections through supersession and invalidation rather than silently overwriting history.
- Stores structured, redacted local records instead of complete prompts or transcripts by default.
- Supports on, private, and off modes. Private semantics stay in MCP process memory; a one-task/one-session hashed control suppresses independent Hooks and remains an explicit recovery/delete handle after restart.
- Starts a new task and records up to 12 directly stated atomic claims in one server-side operation; users and models do not need to construct task/claim UUIDs or source hashes.
- On Codex, binds every project-scoped tool call to the host-provided sandbox working directory; callers may omit `project_root`, and a conflicting explicit path is rejected before state access.
- Exports one portable task graph with remapped import identities and physically deletes a claim or task after exact confirmation.
- Provides fifteen MCP tools, one read-only Skill resource fallback, and optional fail-open Hooks.

Intent Loop does not plan or execute the user's work, bypass permissions, parse private transcripts, judge task completion, or create a separate agent harness.

## Requirements

- Codex CLI or desktop with repository marketplace plugin support
- Node.js 20 or newer available as node

No npm install or build step is required for users. The repository includes reviewed runtime bundles, complete embedded-dependency notices, and a CycloneDX SBOM.

## Install from GitHub

Review the plugin manifest, Skill, MCP definition, and optional Hooks first:

- plugins/intent-loop/.codex-plugin/plugin.json
- plugins/intent-loop/skills/intent/SKILL.md
- plugins/intent-loop/.mcp.json
- plugins/intent-loop/hooks/hooks.json

Add the public repository marketplace and install the plugin:

~~~powershell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.1.0-beta.3
codex plugin add intent-loop@intent-loop
~~~

Start a new Codex task after installation so the Skill and MCP tools are loaded.

Compatibility evidence is intentionally narrow. Two fresh Windows installations from the public beta.3 tag completed real use and clean uninstall, while Windows and Ubuntu CI pass on Node 20, 22, and 24. Linux has not received a complete end-user install smoke test, and macOS support is not claimed until macOS CI plus a real install/use/uninstall run pass.

Hooks are not trusted automatically. Manual Skill and MCP use work without Hook trust; automatic session association and compact-context restoration require the user to review and explicitly trust the current Hook definition.

## Use

Recommended entry points:

- $intent start associates the current task and records directly stated initial claims in one MCP call.
- $intent show displays compact current intent.
- $intent correct records a direct correction and preserves what it replaces.
- $intent feedback classifies a result as keep, implementation change, intent change, or uncertain.
- $intent export returns a compact human summary by default; request portable detail for a re-importable task graph.
- $intent forget performs confirmed physical deletion.
- $intent off disables semantic state for the task.

The bundled MCP server is named intent_loop. It runs runtime/server.mjs from the installed plugin root and exposes fifteen intent-state tools plus the intent-loop://skill/intent read-only resource.

## Data and privacy

On supported Codex hosts, durable state is below ${CODEX_HOME}/plugin-data/intent-loop/v1. ${PLUGIN_DATA}/intent-loop/v1 is the secondary host fallback. Development tests use an explicit temporary INTENT_LOOP_DATA_DIR.

The runtime contains no outbound network client. Default persistence stores atomic claims after credential-pattern redaction and minimal hashes or event IDs, not complete prompts, transcripts, or workspace files. JSON sensitive-key values and quoted password assignments are replaced without retaining a secret-derived digest. This is not comprehensive PII detection: personal information intentionally placed in a claim can remain. See the [privacy policy](docs/privacy-policy.md), [threat model](docs/privacy-threat-model.md), and [security policy](SECURITY.md).

## Uninstall

Remove the plugin and its configured repository marketplace:

~~~powershell
codex plugin remove intent-loop@intent-loop
codex plugin marketplace remove intent-loop
~~~

Uninstalling the package and deleting Intent Loop task data are separate operations. Use $intent forget before uninstalling if local task records must also be physically removed. OS backups, snapshots, and copied exports remain outside the plugin's deletion boundary.

## Develop and test

~~~powershell
Set-Location .\plugins\intent-loop
npm ci
npm test
~~~

The test command type-checks source, compiles tests, regenerates the self-contained runtime, runs unit and MCP contract tests, checks the frozen evaluation corpus, and copies only distributable files to a clean temporary directory for a start-add-read-delete lifecycle.

Each release publishes an archive containing `SBOM.cdx.json`, a separate `SHA256SUMS` file, and GitHub artifact attestations for the archive and SBOM. Verify an archive with `gh attestation verify <archive> --repo rrrrrredy/intent-loop` and compare its checksum before use.

Maintainers with the bundled Codex development skills can also run the validators below, replacing CODEX_HOME with their configured Codex home:

~~~powershell
python CODEX_HOME\skills\.system\plugin-creator\scripts\validate_plugin.py .\plugins\intent-loop
python CODEX_HOME\skills\.system\skill-creator\scripts\quick_validate.py .\plugins\intent-loop\skills\intent
~~~

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution requirements.

## Release and evidence

- [verification-report.md](docs/verification-report.md) records automated and real-host behavior.
- [paired-evaluation-result.md](docs/paired-evaluation-result.md) records no result for the unrun human comparison.
- [release-decision.md](docs/release-decision.md) separates public beta readiness from unverified efficacy.
- [distribution-and-submission.md](docs/distribution-and-submission.md) explains GitHub distribution and why an OpenAI universal-directory MCP listing would require a separately authorized public HTTPS architecture.
- [accepted-deferred-rejected.md](docs/accepted-deferred-rejected.md) records scope decisions.
- [independent-reviews.md](docs/independent-reviews.md) records adversarial and user-practical review findings and their disposition.

## License

Apache License 2.0. It permits commercial and private use, modification, and redistribution while retaining notices, and includes an explicit patent grant. See [LICENSE](LICENSE) and the generated [third-party notices](plugins/intent-loop/THIRD_PARTY_NOTICES.md).
