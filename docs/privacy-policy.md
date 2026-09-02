# Privacy policy

Effective date: 2026-09-03

Intent Formation is open-source software distributed through GitHub. The project author does not operate a hosted Intent Formation service, user account system, analytics endpoint, or telemetry collector.

## Core plugin

The core `intent-formation` plugin runs locally. Its MCP policy tool accepts no arguments, receives no prompt text, and returns a fixed compact policy. It does not write intent records and contains no outbound network client.

Codex supplies the UserPromptSubmit event and may retain conversations under its own product terms. That host processing is outside this project's data control.

## Optional State companion

State is opt-in. After `/intent start`, it can store deliberately selected atomic statements, semantic labels, minimal provenance, timestamps, task identifiers, record links, and integrity hashes in the local Codex plugin-data directory.

It does not persist complete prompts, transcripts, assistant responses, workspace files, or tool output by default. Common credential patterns are redacted before a record is written, but redaction is best effort and is not general personal-information detection.

Standard mode persists records locally. On Unix-like systems, managed directories are restricted to mode `0700` and files to `0600`; on Windows, protection depends on the current account's inherited filesystem ACLs. A verified private-mode receipt means the task's managed persisted content and managed exports were purged before new record text is kept only in the current MCP process. If a privacy or deletion command fails, the result reports that change is unknown and tells the user to inspect and retry. Off mode retains existing state but blocks new updates. `/intent forget` purges the task's managed events and managed export files. Copies moved elsewhere, operating-system backups and snapshots, and host conversation logs remain outside the plugin's deletion authority.

## DeepSeek Harness adapter

The adapter runs the same state server locally. It derives task identity from the active Harness session, removes model credentials from the child-process environment, and contains no project telemetry. DeepSeek Harness and any configured model provider process data under their own terms.

## Network access and sharing

The product runtime does not send intent state to the project author or third parties. Installing from GitHub, installing dependencies for development, checking for updates, and using Codex, DeepSeek Harness, or a model provider can involve those services independently.

## Security and questions

Do not put passwords, private keys, access tokens, or highly sensitive personal data in intent records. Anyone with access to the local account or plugin-data directory may read standard-mode records.

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/rrrrrredy/intent-loop/security/advisories/new). General privacy questions may be opened in the repository issue tracker without including sensitive data.
