# Contributing

Thank you for helping improve Intent Loop.

## Ground rules

- Preserve the product boundary in AGENTS.md. Intent Loop must not become a planner, execution harness, transcript parser, or user-profile product.
- Do not add raw prompt or transcript persistence. Treat privacy, project isolation, export, and deletion behavior as release-critical.
- Keep Hooks optional, inspectable, non-blocking, and fail-open.
- Separate implementation evidence from claims about user outcomes.

## Development

Requires Node.js 20 or newer.

~~~powershell
Set-Location plugins/intent-loop
npm ci
npm test
~~~

The build produces committed self-contained files in `plugins/intent-loop/runtime`. Include the regenerated runtime, third-party notices, and `SBOM.cdx.json` whenever source or dependencies change.

Before opening a pull request:

1. Run npm test from plugins/intent-loop.
2. Run the plugin validator documented in README.md when Codex development tools are available.
3. Confirm the frozen corpus hash still passes.
4. Describe new persistence, permission, Hook, deletion, or external-network behavior explicitly.
5. Add a regression test for every defect fix.

## Pull requests

Keep changes focused. Explain the user-visible outcome, evidence, limitations, and security/privacy impact. Contributions are licensed under Apache-2.0.
