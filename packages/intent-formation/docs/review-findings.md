# Review findings

> Historical review of the failed first prototype. The accepted implementation findings below were fixed, then the interaction policy was redesigned and rerun on the unchanged frozen corpus. The final v0.3 candidate requires two new independent reviews; see the root `docs/independent-reviews.md`.

## Accepted and fixed

- Replace literal plugin path placeholders with tested relative MCP paths and infer Codex Home from the installed cache root when host variables are absent.
- Use an underscore MCP server key after the hyphenated key failed real tool exposure.
- Retry transient Windows state-lock operations.
- Track live lock ownership with process and token identity; reclaim inactive same-process owners and retry lock release.
- Make private-mode replacement atomic and condition persistent appends on the current mode.
- Bind process-memory private records to the exact persisted private-session marker.
- Scrub record IDs from supersession, source, scope, backup, interrupted-write, and corruption artifacts during physical deletion.
- Fully prevalidate imports, require explicit user confirmation, and commit all imported events in one store operation. If a filesystem acknowledgement is ambiguous, report `changed: unknown` and require inspection instead of guessing or issuing an unsafe compensating write.
- Exclude inference and evidence text from automatic Hook context; inject quoted user-origin data with a data-only boundary.
- Require a structured MCP `ok: true` receipt before the policy may claim a manual state or deletion command succeeded.

## Blockers at that historical checkpoint

- Ordinary new CLI sessions did not reliably expose or enter the Intent Formation Skill/Hook path.
- Manual commands produced conversational success claims without MCP receipts in the practical-use run.
- A high-cost ambiguous request proceeded to a decision without the required single question.
- The evaluated product missed six efficacy thresholds and triggered the formal stop condition.
- The latest receipt rule and context filter have implementation tests but no new ordinary-host practical run; they do not clear the earlier blocker.

## Deferred

- A narrow opt-in option-comparison experiment may be reconsidered only with a new frozen evaluation.
- Linux and macOS host packaging remain untested. Cross-platform path code alone is not host evidence.
- Optional rich UI remains out of scope; the headless path has to work first.

## Rejected

- A global task enumeration tool as a workaround for missing task context: it expands cross-project exposure and does not repair host entry.
- A custom client, new Harness, form, PRD generator, or independent chat surface: each changes the frozen product.
- Broad deletion of unrelated malformed recovery lines that contain only an unidentifiable text fragment: ownership cannot be established without risking unrelated recovery evidence.
- Publication, GitHub profile promotion, cross-host adapters, and marketing work after a failed product gate.

## Historical independent recommendations

- Adversarial review: **HOLD**.
- User-perspective practical review: **HOLD**; a technical beginner cannot safely use the current prototype from the simple README instructions alone.
