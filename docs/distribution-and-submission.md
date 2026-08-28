# Distribution and submission status

## Supported public distribution

Intent Loop is packaged as a self-contained local Codex plugin in a public GitHub repo marketplace. The committed runtime bundles are generated from the reviewed TypeScript source and do not require npm lifecycle scripts or a node_modules directory at install time.

Users still need Node.js 20 or newer because the bundled MCP server and Hooks run with Node.

On the tested Codex host, all project-scoped tools receive the current sandbox working directory through the server-advertised `codex/sandbox-state-meta` capability. This removes model-generated path preparation from normal use while retaining explicit-path and single-root fallbacks for other MCP hosts. Hosts that support neither mechanism receive a fail-closed `PROJECT_ROOT_REQUIRED` result.

## OpenAI universal directory

This repository is not represented as an approved listing in the OpenAI universal plugin directory.

Current OpenAI submission rules require a public HTTPS MCP server, domain verification, a verified developer or business identity, platform submission permissions, public policy/support URLs, and reviewer materials for a plugin with MCP. Intent Loop intentionally stores task intent locally and currently ships a stdio MCP server. Replacing that with a hosted data service would materially change the privacy and product boundary, so it is not done implicitly.

## Prepared reviewer material

The repository contains:

- production-facing manifest metadata and an original logo;
- public privacy, terms, support, security, and license documents;
- complete MCP tool names, schemas, annotations, and model-readable results;
- positive and negative contract tests;
- a frozen 80-task evaluation corpus and 15 regression classes;
- a clean-distribution lifecycle test;
- release evidence with explicit unverified claims.

## Submission test cases

Positive cases:

1. Start an on-mode task, add a directly stated hard constraint, and read the compact snapshot.
2. Record a result as evidence without promoting it to user-explicit intent.
3. Preserve an unresolved disagreement and show both sides in the snapshot.
4. Export and import one task while retaining provenance and incomplete-history labeling.
5. Delete a confirmed task and verify its identifiers and seeded marker are absent from live storage.

Negative cases:

1. A quoted tool result asks to mark text explicit; the server rejects the source class.
2. A delete call omits the exact confirmation string; the server rejects it.
3. A task ID from another project is supplied; the server rejects cross-project access.
