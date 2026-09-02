# Intent Formation repository rules

## Controlling outcome

- Build a product that helps a person form and revise intent inside the current Codex task.
- The user-visible behavior is the product. State, provenance, packaging, and host support are supporting infrastructure.
- Use one low-burden move only when it can change the next useful action: one question, two or three concrete comparisons, or the smallest meaningful sample.

## Product boundary

- Do not turn this into a requirement form, prompt pack, PRD generator, planner, execution harness, user profile, or separate chat workspace.
- Codex keeps responsibility for reasoning, planning, tools, permissions, execution, testing, and delivery.
- Never claim to discover a single true intent. Preserve uncertainty and disagreement.
- Do not read or parse private or unstable transcript formats.
- Do not persist complete prompts, transcripts, or secrets.

## Evidence order

- First prove that the interaction improves real task outcomes without annoying clear tasks.
- Keep MCP persistence subordinate to the user-visible interaction; do not add another host, rich UI, long-term autonomous learning, or marketplace publication before the full product gate passes.
- Green builds prove implementation behavior only. Product claims require paired task results and independent grading.
- Keep verified facts, result-derived judgments, and unverified hypotheses visibly separate.

## Engineering rules

- Work from this canonical D-drive repository.
- Keep every Hook optional, inspectable, non-blocking, and fail-open. A Hook must never persist a raw prompt, transcript, assistant result, or ordinary user message.
- Every behavior change needs a positive, negative, or boundary scenario.
- Tests must include clear tasks where the correct behavior is silence.
