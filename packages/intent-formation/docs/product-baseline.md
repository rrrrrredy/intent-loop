# Frozen product baseline

Frozen on 2026-09-01 from the user's original product definition.

## One-sentence product

Intent Formation stays inside the current Agent task and, only when it matters, uses one question, two or three comparisons, or a small sample to help the user form what they want while working, then gives the updated direction back to the current Agent.

## Problem

People do not always possess a complete requirement before work begins. Intent can form while they explain, compare alternatives, or react to a result. An Agent that always asks for a specification creates friction; an Agent that always guesses can do expensive work in the wrong direction.

## Product promise

Help the user reach a better task outcome with less avoidable rework, without adding noticeable friction to clear tasks.

## The five user-visible moves

1. **Silent continuation** — act when the next step is clear, cheap, and reversible.
2. **One key question** — ask only when plausible interpretations lead to materially different costly next actions.
3. **Concrete comparison** — offer two or three consequential directions when the user lacks vocabulary or does not know the option space.
4. **Small sample** — make the cheapest useful result when preference is easier to form by seeing or trying.
5. **Result revision** — after feedback, distinguish keep, implementation correction, intent change, and still uncertain.

## Current intent semantics

When a working direction is reflected back to the user, it may include desired outcome, success or failure signals, constraints, tradeoffs, unknowns, result feedback, unresolved disagreement, and superseded direction.

User statements, Agent inferences, and evidence are not interchangeable. A user and Agent do not need to agree.

## Phase-zero implementation decision

This first prototype uses an optional, inspectable, fail-open hook for the implicit low-burden behavior and a Skill that users can invoke explicitly for deeper intent work. It does not yet persist intent or include an MCP server. Implicit Skill activation is disabled because current Codex behavior can expose Skill-loading narration and add avoidable latency.

That is a deliberate experiment boundary, not the final architecture. The purpose is to test the distinguishing interaction before investing again in state infrastructure. If the interaction pilot fails, development stops or the intervention policy changes. If it passes, the smallest traceable state layer can be added behind the proven experience.

## Non-goals

- a requirement form or one-time brief;
- a prompt pack sold as a product;
- an independent chat interface;
- a planner or task executor;
- a complete user profile;
- a decision interceptor;
- automatic access to pre-install history; or
- another Agent host before the Codex product gate.

## Claims

### Verified facts

- Current official Codex documentation supports Skills, plugin packaging, and plugin-bundled hooks.
- The repository contains a runnable hook and a frozen pilot corpus.

### Unverified hypotheses

- The intervention policy reduces avoidable rework.
- It improves final user-match scores.
- It can stay silent often enough on clear tasks.
- A compact state layer will later improve continuity without becoming the visible product.
