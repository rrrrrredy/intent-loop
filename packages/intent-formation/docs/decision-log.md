# Decision log

> D-001 through D-015 record the first prototype and its required STOP. They are retained as research history, not the current release verdict. D-016 onward records the user-authorized redesign and v0.3 candidate.

## D-016 — Redesign on the unchanged frozen corpus

**Decision:** Replace the failing broad policy with a compact rule set derived from observed errors, then rerun the unchanged 80-scenario corpus with paired primary runs and blind grading.

**Result:** v8 produced 160/160 usable primary conversations and passed every predeclared point-estimate gate. Because the policy was iterated against this corpus, the result is retained only as a development regression and does not reopen release by itself.

## D-017 — Separate state-free core and optional State companion

**Decision:** Ship a quiet state-free policy plugin by default. Put persistence, resume, private/off controls, export, and deletion in a separately installed companion with receipt-backed commands.

**Reason:** The user-visible formation loop should not require a requirement ledger. Users who need continuity can opt into its privacy and operational cost.

## D-018 — Keep v0.3 at beta and publish weaknesses

**Decision:** Preserve full sanitized outputs, blind grades, hashes, retries, long-tail timing, and uncertainty statistics, but label this run as development-only. Require a new sealed holdout with explicit model identity and candidate fingerprint before release.

## D-019 — Add deterministic standard-mode remember and reject false private receipts

**Decision:** Execute `/intent remember` inside the trusted local command Hook in standard mode, with optional explicit role prefixes. Refuse it in private mode because the short-lived Hook cannot preserve process-memory state after exit. Do not widen the automatic Hook into a state-changing MCP prompt bridge.

## D-020 — Register same-process lock ownership before publication

**Decision:** Put each contender's unique token in the process-active set before the lock owner file can be observed, and always remove it on exit. Strengthen the permanent concurrency case to 100 simultaneous appends.

**Reason:** A real suite run exposed the prior publication window: another caller could read the just-written owner token before it was marked active and reclaim a live lock.

## D-021 — Treat the first independent holdout as ITERATE

**Decision:** Do not release candidate `bae8e03`. Its 160 / 160 usable conversations passed the rework, final-match, clear-interruption, latency, inference-denial, and raw-prompt gates, but helpful proactive intervention was 50.85%, wrong or unhelpful intervention was 49.15%, and non-clear tasks contained 15 premature actions.

**Reason:** The product gate is conjunctive. Strong averages in other metrics cannot compensate for giving the wrong kind of help or beginning work when the user requested only evidence for forming a preference.

## D-022 — Route explicit evidence before generic gates

**Decision:** Answer an explicit comparison directly; produce exactly the requested number of tiny inline samples without project work; preserve neutrality after priorities; ask only for ordinary missing inputs; and keep impossible-requirement conflict handling outside generic option generation.

**Result:** Eight new real installed-Hook regressions completed with 8 / 8 semantic passes, no first-turn actions or MCP calls, and complete cleanup. The policy is 1,098 UTF-8 bytes, 12.4% below the original 1,254-byte version.

**Evidence boundary:** These cases were derived from failure classes and therefore remain development evidence. The holdout that exposed them is retired; release requires a newly and independently authored unseen corpus.

## D-023 — Treat the second independent holdout as ITERATE

**Decision:** Do not release candidate `fcba88e`. Its 160 / 160 usable primary conversations reduced avoidable rework by 82.93%, kept clear extra interruptions at median 0 and P90 0, limited clear paired latency overhead to 4.59%, and passed proactive-intervention rates. It failed the final-match gate at +6.87 percentage points, all four inferred preferences were denied, and one non-clear task produced two premature web searches.

**Evidence boundary:** The blind grader completed 80 / 80 pairs in 16 batches. Batch 12 needed one grader-only retry after its first response omitted a required rationale; no primary conversation was retried. Because the result informed the next policy revision, v4 is permanently retired from release-gate use.

## D-024 — Ablate redundant automatic policy text

**Decision:** Remove the automatic feedback taxonomy and generic `obey stated constraints` sentence; keep feedback semantics in the explicit Skill and optional state schema. Retain the exact mix/reject/free-answer exit, and explicitly forbid tools or project work during an intent-forming comparison.

**Result:** Four installed-Hook variants ran over the same frozen 16-task development corpus without primary retries. The relaxed exit omitted complete answer rights in three of five applicable responses, the full variant searched during an explicit comparison, and the two removed sentences showed no useful behavioral benefit. Candidate `8def5a3` reduces the policy from 1,254 to 967 UTF-8 bytes. A separate 16-task confirmation completed 16 / 16 with no first-turn actions, no first-turn MCP calls, and complete cleanup.

**Evidence boundary:** The ablation is development evidence based on small-sample operational metrics and manual transcript inspection, not blind outcome grading. A newly authored v5 holdout remains mandatory.

## D-025 — Separate stress-fixture scheduling margin from the product timeout

**Decision:** Increase the synthetic 100-process worker's lock timeout from 60 to 120 seconds, within the test's existing 180-second outer bound. Keep the product's default no-progress and absolute deadlines unchanged.

**Reason:** One exact Node 22.19 full-suite run failed at 99 / 100 when a worker was starved past 60 seconds; five isolated reruns passed in 10.6–13.0 seconds. A new regression proves that a live owner with no progress still fails at a deliberately configured 100 ms boundary, so the larger stress margin does not convert a deadlock into a pass.

## D-026 — Seal v5 before candidate execution

**Decision:** Bind the next release attempt to the independently authored 80-scenario corpus with SHA-256 `d172f3d47a1f67b73b5dd182d07b1bf6a7551d8fdf98ab34ee42498434374905`. Its author ran neither arm and did not inspect the product policy, repository, previous holdouts, development corpora, prior experiment output, or conversation history.

**Evidence boundary:** Root validation after seal found zero threshold violations against both retired holdouts, all development corpora, and both ablation corpora. The seal is not an efficacy result; any user-visible policy change after execution retires v5.

## D-001 — Start a new product repository

**Decision:** Build `intent-formation` from a clean product baseline instead of extending `intent-loop`.

**Reason:** The earlier repository had shifted toward Harness-style workflow enforcement. The controlling product is the user-visible formation and revision of intent inside the current Agent task.

## D-002 — Codex first, no other host yet

**Decision:** Implement and evaluate only the Codex MVP.

**Reason:** The original gate requires real Codex outcome evidence before Claude Code, Cursor, Gemini CLI, DeepSeek Harness, WorkBuddy, Linux/macOS host packaging, or shared-host expansion. Cross-platform path code is allowed; another adapter is not.

## D-003 — Prove the interaction before state infrastructure

**Decision:** Begin with a 12-scenario Skill/Hook instrument pilot.

**Result:** The strongest incremental signal appeared in costly divergence and option formation. Clear text stayed quiet. Native Codex was already strong on samples and result feedback. File-oriented cases were confounded by a Windows sandbox failure.

**Consequence:** Proceed with the smallest traceable state core, retain an ITERATE decision, and require the 80-task study before release.

## D-004 — Keep implicit Skill invocation off

**Decision:** `allow_implicit_invocation` remains false. A short UserPromptSubmit hook supplies a silent decision cue; explicit invocation remains available.

**Reason:** Earlier Codex behavior could narrate Skill loading and add avoidable latency. The user-visible product should not announce an internal intent check.

## D-005 — Use ordinary conversation as the required UI

**Decision:** Manual `/intent ...` messages and normal questions/comparisons/samples are the headless product path.

**Reason:** A rich structured-choice UI is not guaranteed on every surface. The MVP must remain useful without an MCP App or custom client.

## D-006 — Append normally; rewrite only for deletion

**Decision:** Normal state changes append events. Corrections use supersession and invalidations remain auditable. Explicit deletion atomically rewrites matching data, including precise recovery-side-file scrubbing.

**Reason:** Auditability and reliable deletion require different mechanics. Silent overwrite would destroy provenance; logical tombstones alone would not satisfy forget semantics.

## D-007 — Preserve epistemic separation

**Decision:** Explicit user expression, Agent inference, result/external evidence, unknown, and disagreement have different states and source rules.

**Reason:** The product maintains a current working intent. It does not claim a single hidden truth or require the user and Agent to agree.

## D-008 — No transcript parser

**Decision:** Never parse Codex transcript files.

**Reason:** The host does not guarantee a stable transcript contract. The plugin only uses documented hook input and deliberately created MCP records.

## D-009 — Bundle a dependency-free stdio server

**Decision:** Development uses pinned MCP SDK and Zod packages; release packaging includes one bundled `dist/intent-formation-server.mjs` executed by Node.

**Reason:** Users should not run `npm install` inside the installed plugin. The bundle makes the runtime package self-contained while keeping source and lockfile reproducible.

## D-010 — Use relative MCP cwd, not placeholder arguments

**Decision:** The plugin MCP uses `cwd: "."`, a relative bundle path, and the server key `intent_formation`.

**Reason:** The tested traditional plugin runtime left path placeholders literal, causing a handshake failure. A hyphenated server key also has a current tool-exposure compatibility risk.

## D-011 — Derive stable local storage from installed cache root

**Decision:** When available, both Hook and MCP infer configured Codex Home from the installed plugin cache path and use `<CODEX_HOME>/plugin-data/intent-formation`.

**Reason:** The tested MCP child did not inherit the expected data variables. This method aligned components and respected the user's D-drive configuration on the real host.

## D-012 — No public repository or release before the product gate

**Decision:** Keep the new repository local and unlicensed until the paired 80-task outcome evaluation and independent reviews support a Go decision.

**Reason:** Packaging success, tool calls, and plausible prose cannot establish market value. If the gate passes, Apache-2.0 is the intended permissive license because the product is an extensible local Agent plugin with explicit patent terms; this choice is provisional until publication.

## D-013 — Stop publication and host expansion

**Decision:** The frozen 80-task result is STOP. Do not create a public GitHub repository, release, profile entry, other-host adapter, or marketing asset for this version.

**Reason:** Rework improved 23.88% against a 25% gate; final match fell 0.62 percentage points; clear latency rose 26.88%; helpful intervention, wrong intervention, and inference-denial gates also failed. Independent adversarial and beginner-use reviews both returned HOLD.

## D-014 — Fix state reliability without reopening the product gate

**Decision:** Accept and fix reviewer findings in lock ownership, private-mode atomicity, record-reference deletion, import confirmation/rollback, and automatic context provenance. Retain STOP after those fixes.

**Reason:** These are correctness and privacy defects in the delivered source. Closing them makes the research artifact honest and reproducible, but does not change the frozen behavioral result or ordinary-session entry failure.

## D-015 — Reject scope-changing workarounds

**Decision:** Do not add a global task browser, custom client, new Harness, form, or cross-host implementation to compensate for the failed Codex entry.

**Reason:** Those changes expand privacy exposure or change the frozen product. A future attempt must first prove a trustworthy headless entry and verified manual receipts inside the current Agent task.
