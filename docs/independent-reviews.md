# Independent candidate reviews

Two separate agents reviewed candidate `2b9101f9fc99ab0874f05a5d1e80b03b070de6a0`. These are agent reviews, not human-user research. The privacy review is closed in its fixed scope; model-mediated user acceptance is not complete.

## Adversarial review

The reviewer independently reproduced five original defects and nine follow-up privacy/recovery boundaries, then reran the fixed 14-case set on Node 20.19.1. Both scripts exited zero. No remaining material blocker was observed within that scope. One probe script still printed its older hard-coded commit label; actual HEAD was checked before and after and was the candidate above.

Accepted and fixed:

- Conditional text appended to forget/private/off/export could be ignored. Extra arguments now cause no-change rejection without a success receipt.
- A short-lived Hook could acknowledge private memory that disappeared on exit, or imply access to another process's private records. Private remember/feedback/show/correct now refuse that path honestly.
- Losing primary erasure tokens before recovery cleanup could leave text on retry. Recovery scrubbing now precedes primary replacement and fault-injected retries are covered.
- Generic shared tokens or same-task IDs could erase unrelated corrupt fragments. Identified unrelated tasks/records, including identical content, are preserved.
- Parseable JSON that was not a valid event could evade recovery erasure. It now follows the same matching-content cleanup boundary.
- Concurrent task recreation could produce a false forget success receipt. The MCP success path now requires verified absence at its deletion point.
- Private task titles and workspace hashes could persist through create/reset/import/reaffirmation. Private markers omit them, and re-entering private mode repairs legacy content.

Source and generated fingerprints were stable before and after the rerun. The generated State server is `c9d26b974d25d09a698846ce3ae75d22f97daa6dbfd054875927fef6ca4614a7`; the command Hook is `cd04915c0fb155f2d4b0916c85fadc0489ddb508cc7ab528ec072596190e8f07`. Permanent source regressions preserve the accepted failure cases. Synthetic test state was removed.

## User-perspective review

The second agent first authored and sealed the new 80-case corpus without reading product code or prior corpora. Only after sealing did it install and read the product. It did not use the sealed cases as practice prompts or change them after exposure.

Actual CLI 0.153.4 / Node 22.19.0 installed core and State 0.3.0-beta.1 into a fresh temporary home. All 14 core files and 13 State files matched the source distributions byte-for-byte. Nineteen local component assertions passed across save, show, correction, actual export files, private disk purge, process-memory retention/restart loss, off overrides, and forget. The preserved artifacts are [component observations](../evidence/independent-reviews/local-acceptance-results-v7.json), [per-file fingerprints](../evidence/independent-reviews/install-fingerprints-v7.json), and [cleanup receipt](../evidence/independent-reviews/cleanup-v7.json).

**Evidence boundary:** the Hook was invoked directly with a synthetic host envelope; MCP calls were local component calls. The agent made zero model requests, zero Codex resume requests, and used no Hook-trust bypass. It did not verify real Codex chat trust, model-driven file changes, or reaction to a model sample. The 19th assertion's original label says forget removes off, but the task had already returned to standard before deletion; that observation cannot independently prove removal of an actively off marker. The raw record is preserved with this qualification.

Accepted beginner-documentation improvements:

1. Warn before installation commands when the requested public tag is unavailable.
2. Add show → copy record ID → correct → show, explaining that correction retains history.
3. Put standard/private/off command availability in a compact table and state that private has no equivalent beginner slash-write path today.
4. Explain that the receipt's SHA-256 covers structured export content, not all formatted file bytes, and provide a local verification command.
5. Avoid describing the optional State bundle as a trivially small script or implying that trust checks can be skipped.

These are implemented in the README, Chinese guide, and export-verification document. They do not substitute for actual conversational acceptance. New synthetic model cases were not sent because the external-data reviewer required authorization beyond the specifically approved 17-case corpus.

The agent removed its temporary State/core/marketplace installation, authentication copy, state, and empty workspace. Session count was zero. Its original authentication source, repository, four sealed files, and evidence were preserved. No privacy limitation was rejected or silently waived, and no additional product framework was added to address the feedback.
