# Contributing

Thank you for helping improve Intent Loop.

## Ground rules

- Preserve the product boundary in AGENTS.md. Intent Loop may expose thin host adapters, but it must not become a planner, execution harness, transcript parser, or user-profile product.
- Do not add raw prompt or transcript persistence. Treat privacy, project isolation, export, and deletion behavior as release-critical.
- Keep Hooks optional, inspectable, non-blocking, and fail-open.
- Separate implementation evidence from claims about user outcomes.

## Codex development

Requires Node.js 20 or newer.

~~~powershell
Set-Location plugins/intent-loop
npm ci
npm test
~~~

The build produces committed self-contained files in `plugins/intent-loop/runtime`. Include the regenerated runtime, third-party notices, and `SBOM.cdx.json` whenever source or dependencies change.

## DeepSeek Harness development

Requires Node.js `^22.19.0` or `>=24.0.0`. DeepSeek Harness is pinned to the version recorded in the root package and is treated as a developer-preview host.

~~~powershell
npm ci
npm test
npm run test:dsh-host
~~~

Root tests verify the generated tool catalog and legal inventory, exercise real shared MCP children, reject forged project scope, check private-session isolation and cleanup, and inspect the packed bundle. The host smoke test uses a temporary Harness home and removes it on success or failure. Include regenerated `dsh/tool-catalog.json`, `dsh/THIRD_PARTY_NOTICES.md`, and `dsh/SBOM.cdx.json` whenever the shared runtime or dependencies change.

Before opening a pull request:

1. Run `npm test` from `plugins/intent-loop`.
2. Run root `npm test` with a supported DeepSeek Node.js version.
3. Run the plugin validator documented in README.md when Codex development tools are available.
4. Confirm the frozen corpus hash still passes.
5. Describe new persistence, permission, Hook, deletion, host-binding, or external-network behavior explicitly.
6. Add a regression test for every defect fix.

## Pull requests

Keep changes focused. Explain the user-visible outcome, evidence, limitations, and security/privacy impact. Contributions are licensed under Apache-2.0.
