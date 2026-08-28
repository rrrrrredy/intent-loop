# Intent Loop repository rules

- Keep the product inside the current Codex task. Do not build a chat client, Agent Harness, planner, executor, PRD generator, prompt pack, or user-profile product.
- The shared core owns only versioned intent state, provenance, unknowns, disagreements, invalidation, compact handoff, and candidate intervention signals.
- Codex remains responsible for reasoning, planning, tools, permissions, execution, verification, and delivery.
- Do not parse private or unstable transcript formats. Pre-install history is explicit-import only.
- Hooks are optional, inspectable, non-blocking, and fail open. They never decide completion or user satisfaction.
- Default persistence must exclude complete raw prompts and secrets. Keep project scopes isolated.
- Do not adapt to another agent until the frozen 80-task paired evaluation clears every release threshold.
- Keep claims separated as verified fact, result-derived judgment, or unverified product hypothesis.
