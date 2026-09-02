# Intent Formation repository rules

## Product outcome

- Help a person form or revise intent inside the current Codex or DeepSeek Harness task.
- Clear, cheap, reversible work continues without extra ceremony.
- Intervene only when two plausible directions change the next useful action and guessing risks material rework, irreversibility, or external impact.
- Use one low-burden move: one focused question, two or three concrete comparisons, or the smallest meaningful sample.
- Separate implementation feedback from a genuine intent change.

## Boundaries

- Do not turn the product into a requirement form, prompt pack, PRD generator, planner, executor, completion gate, user profile, transcript parser, separate chat client, or Agent Harness.
- Codex or DeepSeek Harness retains reasoning, planning, permissions, tools, execution, testing, and delivery.
- Never claim to discover a single true intent or promote an Agent inference to user preference.
- The core plugin stays state-free. Persistent state remains an optional companion.
- Do not persist complete prompts, transcripts, assistant responses, secrets, workspace files, or tool output by default.
- Hooks stay inspectable, bounded, non-blocking, and fail-open. Manual state success requires a trusted receipt.

## Evidence

- Green tests establish implementation behavior only. Outcome claims require the frozen paired study and public per-case evidence.
- Preserve the v0.3 corpus and policy fingerprints. If user-visible policy behavior changes, describe whether the existing efficacy evidence still applies and rerun the relevant gate when it does not.
- Treat automated grading, model identity, synthetic-corpus coverage, latency uncertainty, and long-tail timing as explicit limitations.
- DeepSeek support is adapter and host-lifecycle evidence only; do not transfer the Codex efficacy result to DeepSeek.

## Engineering

- Work from the canonical D-drive repository.
- Source lives under `packages/intent-formation`; generated install surfaces live under `plugins/intent-formation` and `plugins/intent-formation-state`.
- Every behavior fix needs a positive, negative, or boundary regression.
- Keep generated distributions, SBOMs, notices, the DeepSeek catalog, and all version identities deterministic and synchronized.
- Public release requires the documented source, real-host, cross-platform, independent-review, exact-tag, asset, public-install, and cleanup gates.
