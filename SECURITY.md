# Security policy

## Supported versions

Intent Loop 0.2.0-beta.5 and the main branch are supported. Earlier beta builds are superseded and do not receive backported fixes.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include private task data in a report. Use the repository's private GitHub Security Advisory reporting flow:

https://github.com/rrrrrredy/intent-loop/security/advisories/new

Include the affected version, platform, reproduction steps using synthetic data, and expected impact. Never attach real prompts, credentials, ledger files, or exported intent graphs.

## Security boundary

The runtime is local and contains no outbound network client. It stores structured claims rather than full prompts by default and redacts seeded credential formats; it does not claim comprehensive PII detection. OS backups, snapshots, copied exports, and data outside the resolved Intent Loop data root are outside its deletion guarantee.
