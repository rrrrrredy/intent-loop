# Frozen product baseline

Status: frozen before source implementation on 2026-08-28.

## Definition

Intent Loop stays inside the current agent. Only when it matters, it uses one question, two or three comparisons, or one inexpensive sample to help the user form what they want while work proceeds, then hands the current version of intent back to that same agent.

The product maintains an updateable, traceable, disagreement-preserving current intent. It does not claim to discover one objectively true intent. The user and agent may each be wrong and need not reach consensus.

## Included semantic surface

- desired outcome;
- success and failure signals;
- hard and soft constraints;
- tradeoffs;
- unknowns;
- result feedback;
- unresolved disagreements.

Every claim carries at least `statement`, `role`, `epistemic_status`, `source_ref`, `scope`, inferred `confidence`, `valid_from`, `last_confirmed`, and `supersedes`.

`epistemic_status` distinguishes user-explicit statements, agent inferences, result or external evidence, unknowns, disputes, and superseded or invalidated material. Explicit means explicitly stated, not necessarily factually correct. Unknown and disputed records remain distinct.

## Architecture decision

The Codex MVP is one plugin containing:

- one Skill for intervention policy and normal-dialogue/manual entry points;
- one local MCP server for structured state;
- optional `SessionStart`, `UserPromptSubmit`, `PostCompact`, `Stop`, and `SessionEnd` hooks.

Hooks observe, restore compact context, or record candidate signals. They never block a user prompt, force another turn, or act as semantic judges. The MVP has a headless path and no rich-UI dependency. It does not use Codex App Server to build a client and never parses an unstable transcript file.

## Ownership boundary

Intent Loop owns intent versions, sources, unknowns, disagreements, invalidation, intervention advice, post-install history-signal filtering, compact handoff, and result feedback.

Codex continues to own reasoning, planning, research, coding, file and tool operations, permissions, safety, tests, verification, delivery, and sub-agent orchestration.

## History and long-term rules

- Only events visible after installation are used by default.
- Older history requires an explicit import and is never described as complete understanding.
- A single choice, acceptance, or silence does not establish a durable preference.
- A durable rule is either explicitly declared by the user or becomes a candidate after the same signal appears across at least three independent tasks and the user confirms it.
- Inferred durable preferences become stale after 90 days without confirmation and are not silently injected.
- Conflicts and stale records keep provenance and require review; they are not silently erased.

## Explicit non-goals

- prompt pack, intake form, one-shot task brief, PRD generator, or decision interceptor;
- full user model, digital twin, independent chat surface, or large workbench;
- replacement for Codex reasoning, planning, execution, tools, approvals, validation, or agents;
- Claude Code, Cursor, Gemini CLI, or WorkBuddy adapters in this release;
- automatic access to all pre-install history;
- efficacy claims based on calls, questions, fields, protocol prose, or green builds.

## Frozen release gates

1. Gate 0: canonical repository and scope are safe.
2. Gate 1: current Codex surfaces support the bounded architecture without private transcript access, Codex modification, App Server, or a new client.
3. Gate 2: value is measurable from independent task outcomes and failure attribution.
4. Gate 3: persistence, privacy, export, invalidation, deletion, and threat boundaries are testable before any real user data is stored.

The implementation may proceed after these gates. User pilot and cross-agent expansion remain separately gated.
