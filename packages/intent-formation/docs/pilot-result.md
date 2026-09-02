# Instrument pilot result

> Historical pilot result from the first prototype. It justified a full study but did not establish efficacy. That first study returned STOP; a later v8 run on the tuned corpus is retained only as a development regression. See `study-result.md`.

Run date: 2026-09-01

Decision: **ITERATE**

This pilot stabilized the interaction and exposed host-integration failures. It did not establish product efficacy and is not a substitute for the frozen paired 80-task evaluation.

## Runs

The frozen 12-scenario instrument included four clear controls, two costly divergences, two option-formation cases, two preference-by-result cases, and two result-feedback cases. Baseline and plugin responses are preserved in ignored local evidence directories during development.

A separate paired latency probe used five clear text requests twice in each arm. Text-only cases avoided filesystem and tool confounds.

## What the pilot supports

### Clear text remained quiet

For the translation control, the plugin returned only the translation. Across all ten clear text latency calls it did not announce an intent check, ask a preference question, expose policy language, or use an internal state tool.

### Costly divergence improved in the valid comparison

In the authentication cutover case, the revised plugin asked what “move everyone” meant and offered three consequences: hard cutover, account-preserving cutover, or grace period. It allowed a mix, none, or another policy.

The corresponding baseline run became dominated by a Windows workspace ACL failure and did not isolate product behavior. That case is useful as a failure observation, not as efficacy evidence.

### Option formation showed the clearest incremental behavior

For personal-versus-team positioning, the plugin reduced the decision to three concrete value-loop outcomes and explicitly allowed a mix or none. The baseline gave a sensible framework but also chose a prior direction and asked multiple follow-up questions.

For the unspecified small-team AI feature, the plugin supplied a bounded set of consequential directions. The baseline also offered useful ideas, but selected a product direction before learning enough and expanded to five categories.

This is the strongest pilot evidence that the intervention policy can add value beyond native Codex behavior.

### Samples and result feedback had little measured increment

Both baseline and plugin produced useful small copy samples. Both also handled the two scripted feedback cases correctly: promotional wording was treated as implementation correction, while a shift from collaboration to local privacy was treated as an intent change.

Native Codex was already strong here. The plugin has not yet shown a material advantage for these cases.

## Latency probe

Ten paired clear-text calls produced:

| Arm | Median elapsed time |
|---|---:|
| Baseline | 11,532 ms |
| Plugin | 11,006 ms |
| Change | -4.56% |

This small probe rules out an obvious fixed latency penalty in the tested text path. It does not prove a general speed improvement. Model variance, shared-host load, and the small sample dominate a difference of this size.

## Confounds and failures

- Several file-oriented scenarios hit a Windows nested-sandbox `apply deny-read ACLs` failure in both arms.
- Four plugin file scenarios and one baseline file scenario reached the 180-second runner timeout.
- Those outputs cannot be used to estimate rework, final match, or latency.
- Early real-host state testing initially appeared successful in the final prose even though MCP startup had failed. Runtime logs exposed the false completion claim.
- The MCP failure was traced to unexpanded plugin path placeholders and a hyphenated server key. A relative `cwd`, relative bundle path, and `intent_formation` key fixed it.
- A second real test found state falling back to C because the MCP child lacked data-directory variables. The service now derives the configured Codex Home from the resolved plugin cache root.

## State-layer real-host evidence after the pilot

The repaired plugin completed a real Codex sequence with structured MCP receipts:

1. start standard state;
2. save one confirmed explicit desired outcome;
3. show one active record;
4. forget the task;
5. show zero records.

A separate Codex process then read a record written by an earlier process, proving disk persistence rather than process-memory continuity, and physically deleted it. The verified data file was under the D-drive Codex Home. The erroneous zero-byte C-drive fallback file was removed.

## Decision rationale

The interaction has enough incremental signal to justify a bounded state-backed Codex prototype. It does not yet meet the public-release or cross-host gate because:

- the full paired 80-task outcome study is incomplete;
- the pilot did not isolate file-oriented delivery behavior;
- sample and feedback cases showed limited advantage over baseline; and
- prompt-origin enforcement remains behavioral because current MCP provenance is not signed by the host.

No public efficacy claim, beta release, or other-Agent adapter should be created from this pilot alone.
