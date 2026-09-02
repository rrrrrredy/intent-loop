# Contributing

Thank you for helping improve Intent Formation.

## Ground rules

- Preserve the product boundary in `AGENTS.md`.
- Optimize the user-visible interaction before adding state or framework machinery.
- Do not add raw prompt, transcript, secret, workspace-file, or full-result persistence.
- Keep Hooks optional, inspectable, bounded, non-blocking, and fail-open.
- Treat privacy, task isolation, off/private controls, export, physical deletion, and receipt accuracy as release-critical.
- Separate implementation evidence, Codex outcome evidence, DeepSeek compatibility evidence, and unverified hypotheses.

## Codex package

Requires Node.js 20 or newer:

~~~shell
cd packages/intent-formation
npm ci
npm test
~~~

The build regenerates the exact committed distributions under `plugins/intent-formation` and `plugins/intent-formation-state`, including SBOMs and third-party notices. Include those generated changes whenever source or dependencies change.

## DeepSeek Harness adapter

Requires Node.js `^22.19.0` or `>=24.0.0` plus `pnpm`:

~~~shell
npm ci
npm test
npm run test:dsh-host
~~~

Root tests verify the public evidence hashes, shared policy, generated 15-tool catalog, dynamic DeepSeek `off` behavior, environment credential isolation, host-derived session and workspace binding, real MCP calls, private-state disk absence, deletion, legal inventory, and exact package composition. The host smoke uses a temporary Harness home and removes it whether the test succeeds or fails.

## Pull requests

Before opening a pull request:

1. Run both package suites on supported runtimes.
2. Run the current plugin validator when available.
3. Confirm generated distributions and evidence hashes are clean.
4. Add a regression for every behavior defect.
5. Describe user-visible impact, new persistence or network behavior, permissions, Hook changes, evidence affected, and remaining limitations.
6. Never include real prompts, credentials, task identifiers, state ledgers, or private exports in fixtures or issues.

Contributions are licensed under Apache-2.0.
