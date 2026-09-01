# Distribution and submission status

## Supported public distributions

Intent Loop uses one public GitHub repository and one shared local MCP core with two host packages:

- a self-contained Codex repository-marketplace plugin under `plugins/intent-loop`;
- a DeepSeek Harness bundle at the repository root, published as `dsh-intent-loop` and installable from a pinned Git tag.

The committed Codex runtime bundles are generated from the reviewed TypeScript source and do not require npm lifecycle scripts or a `node_modules` directory at install time. The DeepSeek package ships prebuilt JavaScript because Harness does not run unapproved dependency builds for Git package installs. Its tool catalog and legal inventory are generated from the same committed MCP runtime.

Users still need Node.js 20 or newer because the bundled MCP server and Hooks run with Node.

On Codex, project-scoped tools receive the current sandbox working directory through server-advertised `codex/sandbox-state-meta`. On DeepSeek Harness, the adapter reads the active agent's immutable working directory and session ID, removes both fields from model-visible tool schemas, and injects them privately. This removes model-generated path and session preparation from normal use. Unsupported MCP clients retain explicit-path and single-root fallbacks; clients that support neither receive a fail-closed `PROJECT_ROOT_REQUIRED` result.

Pinned install paths:

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.2.0-beta.2
codex plugin add intent-loop@intent-loop
dsh plugin --profile headless add github:rrrrrredy/intent-loop#v0.2.0-beta.2
~~~

DeepSeek Harness is a developer preview. The adapter is pinned to `0.1.2-alpha.2`, and a Harness API break requires a new Intent Loop prerelease rather than an unbounded compatibility claim.

## OpenAI universal directory

This repository is not represented as an approved listing in the OpenAI universal plugin directory.

Current OpenAI submission rules require a public HTTPS MCP server, domain verification, a verified developer or business identity, platform submission permissions, public policy/support URLs, and reviewer materials for a plugin with MCP. Intent Loop intentionally stores task intent locally and currently ships a stdio MCP server. Replacing that with a hosted data service would materially change the privacy and product boundary, so it is not done implicitly.

## Prepared reviewer material

The repository contains:

- production-facing manifest metadata and an original logo;
- public privacy, terms, support, security, and license documents;
- complete MCP tool names, schemas, annotations, and model-readable results;
- a DeepSeek bundle manifest, generated tool catalog, bounded session adapter, package-composition check, and host lifecycle smoke test;
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
4. A DeepSeek tool call supplies a forged project root or session owner; the adapter discards it and uses the active host context.
