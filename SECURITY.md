# Security policy

## Supported versions

The latest v0.3 prerelease and the main branch receive security fixes. Intent Loop v0.2 prereleases are superseded and do not receive backports.

## Report privately

Do not open a public issue for a suspected vulnerability. Use [GitHub private vulnerability reporting](https://github.com/rrrrrredy/intent-loop/security/advisories/new).

Include the affected version, operating system, synthetic reproduction, and expected impact. Never attach real prompts, credentials, task IDs, ledger files, exported intent records, or user data.

## Security boundary

The core policy runtime is local, accepts no prompt input, writes no state, and contains no outbound network client. The optional State companion persists deliberate atomic records locally and performs best-effort credential-pattern redaction. It is not a secret vault or comprehensive DLP system.

Task IDs isolate views but are not filesystem access-control credentials. A local user or process with permission to read the plugin-data directory can read standard-mode records. Physical purge covers plugin-managed active and recovery files plus managed exports; operating-system backups, snapshots, host conversation logs, and copied exports remain outside that guarantee.

The DeepSeek adapter removes common model-provider credentials from the child-process environment and derives task and workspace identity from the host. The surrounding Harness, model provider, operating system, and package installer remain outside the project boundary.
