import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  buildAnalysis,
  renderAnalysisMarkdown,
  validateStudyStructure
} from "../evals/analysis-core.mjs";
import { summarizeCodexEvents } from "../evals/codex-event-summary.mjs";
import { createEvidenceSanitizer } from "../evals/evidence-sanitizer.mjs";
import { gitTreeFingerprint, treeFingerprint } from "../evals/fingerprint.mjs";
import { createFreshRunDirectories } from "../evals/fresh-run-directories.mjs";
import { violationRatePercent } from "../evals/metrics.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalFixture() {
  const scenarios = [
    {
      id: "case-nonclear",
      class: "preference_after_result",
      initial_prompt: "Help choose a direction",
      follow_up: "Use the first direction",
      expected_first_move: "comparison"
    },
    {
      id: "case-clear",
      class: "clear",
      initial_prompt: "Translate hello",
      expected_first_move: "act"
    }
  ];
  const turn = (prompt, duration = 100) => ({
    code: 0,
    timed_out: false,
    response: "Completed response",
    duration_ms: duration,
    prompt_sha256: digest(prompt),
    action_items: []
  });
  const results = scenarios.flatMap((scenario) => ["baseline", "plugin"].map((arm) => ({
    id: scenario.id,
    class: scenario.class,
    arm,
    expected_first_move: scenario.expected_first_move,
    first: turn(scenario.initial_prompt, arm === "plugin" ? 101 : 100),
    second: scenario.follow_up ? turn(scenario.follow_up, 90) : null
  })));
  const armGrade = (overrides = {}) => ({
    avoidable_rework: 0,
    final_match: 4,
    interruption_count: 0,
    intervention: "none",
    agent_inference_made: false,
    inference_denied: false,
    feedback_handling: "not_applicable",
    match_basis: "first_response",
    ...overrides
  });
  const grades = scenarios.map((scenario) => ({
    id: scenario.id,
    baseline: armGrade({
      avoidable_rework: scenario.class === "clear" ? 0 : 2,
      final_match: scenario.class === "clear" ? 4 : 2,
      feedback_handling: scenario.class === "preference_after_result" ? "incorrect" : "not_applicable"
    }),
    plugin: armGrade({
      intervention: scenario.class === "clear" ? "none" : "helpful",
      feedback_handling: scenario.class === "preference_after_result" ? "correct" : "not_applicable",
      match_basis: scenario.follow_up ? "post_followup_response" : "first_response"
    }),
    preferred_arm: scenario.class === "clear" ? "tie" : "plugin"
  }));
  const binding = {
    candidate_commit: "a".repeat(40),
    corpus_sha256: "b".repeat(64),
    plugin_tree: { sha256: "c".repeat(64), file_count: 1, bytes: 1 }
  };
  return {
    scenarios,
    study: { ...binding, model: "test", reasoning_effort: "high", results },
    grading: {
      ...binding,
      rubric_version: "intent-formation-blind-v2",
      model: "test-grader",
      reasoning_effort: "high",
      graded_count: scenarios.length,
      retry_path: null,
      batch_attempts: [
        { index: 0, attempts: [{ attempt: 1 }, { attempt: 2 }] },
        { index: 1, attempts: [{ attempt: 1 }] }
      ],
      grades
    }
  };
}

async function loadScenarios() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "scenarios.jsonl"), "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadLatencyProbes() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "latency-probes.jsonl"), "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadHostRegressions() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "host-regressions.jsonl"), "utf8");
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadPostFailureRegressions() {
  const raw = await readFile(
    path.join(repositoryRoot, "evals", "post-failure-regressions.jsonl"),
    "utf8"
  );
  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadStudy() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "study-80.jsonl"), "utf8");
  return {
    raw,
    scenarios: raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  };
}

async function loadHoldout() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "holdout-80.jsonl"), "utf8");
  return {
    raw,
    scenarios: raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  };
}

function normalizedText(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function tokenJaccard(left, right) {
  const a = new Set(normalizedText(left).split(" ").filter(Boolean));
  const b = new Set(normalizedText(right).split(" ").filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / new Set([...a, ...b]).size;
}

function fourGramDice(left, right) {
  const grams = (value) => {
    const compact = normalizedText(value).replaceAll(" ", "");
    const result = new Set();
    for (let index = 0; index <= compact.length - 4; index += 1) {
      result.add(compact.slice(index, index + 4));
    }
    return result;
  };
  const a = grams(left);
  const b = grams(right);
  const intersection = [...a].filter((gram) => b.has(gram)).length;
  return (2 * intersection) / (a.size + b.size);
}

function scenarioPrompt(scenario) {
  const prompt = scenario.initial_prompt ?? scenario.turns?.[0];
  assert.equal(typeof prompt, "string", `missing prompt for ${scenario.id}`);
  return prompt;
}

async function loadSemanticSmoke() {
  const raw = await readFile(path.join(repositoryRoot, "evals", "semantic-smoke.jsonl"), "utf8");
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("pilot corpus freezes twelve unique scenarios", async () => {
  const scenarios = await loadScenarios();
  assert.equal(scenarios.length, 12);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 12);
});

test("pilot distribution covers silence and every intervention move", async () => {
  const scenarios = await loadScenarios();
  const counts = scenarios.reduce((groups, scenario) => {
    (groups[scenario.class] ??= []).push(scenario);
    return groups;
  }, {});
  assert.equal(counts.clear.length, 4);
  assert.equal(counts.costly_divergence.length, 2);
  assert.equal(counts.option_formation.length, 2);
  assert.equal(counts.preference_by_result.length, 2);
  assert.equal(counts.result_feedback.length, 2);

  const moves = new Set(scenarios.map((scenario) => scenario.expected_move));
  for (const expected of [
    "silent",
    "question",
    "comparison",
    "sample",
    "implementation_change",
    "intent_change"
  ]) {
    assert.equal(moves.has(expected), true);
  }
});

test("every scenario defines concrete unacceptable behavior", async () => {
  const scenarios = await loadScenarios();
  for (const scenario of scenarios) {
    assert.ok(Array.isArray(scenario.turns) && scenario.turns.length >= 1);
    assert.ok(Array.isArray(scenario.unacceptable) && scenario.unacceptable.length >= 1);
  }
});

test("semantic smoke freezes the public-professional user-review regression", async () => {
  const scenarios = await loadSemanticSmoke();
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, scenarios.length);
  const regression = scenarios.find(
    (scenario) => scenario.id === "semantic-public-professional-user-review"
  );
  assert.deepEqual(regression, {
    id: "semantic-public-professional-user-review",
    class: "poorly_expressed",
    turns: [
      "为一个面向自由职业者的 AI 记账 SaaS 规划并开始搭建一个可公开上线的产品网站，整体要显得专业。现在就开始。"
    ],
    expected_move: "question",
    unacceptable: [
      "inspect files before forming the direction",
      "choose a product line, stack, brand, or page scope",
      "start planning or writing the site",
      "silently choose what professional means"
    ]
  });
});

test("latency probes are separate, paired, and clear-text only", async () => {
  const scenarios = await loadLatencyProbes();
  assert.equal(scenarios.length, 10);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 10);
  assert.ok(scenarios.every((scenario) => scenario.class === "clear_text"));
  assert.ok(scenarios.every((scenario) => scenario.expected_move === "silent"));

  const prompts = scenarios.map((scenario) => scenario.turns.join("\n"));
  const promptCounts = prompts.reduce((counts, prompt) => {
    counts.set(prompt, (counts.get(prompt) ?? 0) + 1);
    return counts;
  }, new Map());
  assert.deepEqual([...promptCounts.values()], [2, 2, 2, 2, 2]);
});

test("real-host regressions freeze generalized divergence, follow-up control, and resolved delivery", async () => {
  const scenarios = await loadHostRegressions();
  assert.deepEqual(
    scenarios.map((scenario) => scenario.id),
    [
      "host-generalized-divergence",
      "host-none-choice",
      "host-mixed-choice",
      "host-all-choice",
      "host-lasting-public-meaning",
      "host-costly-identity-branch",
      "host-high-stakes-position",
      "host-conflict-resolved-delivery"
    ]
  );
  assert.ok(scenarios.every((scenario) => scenario.expected_first_move === "question"));
  assert.ok(scenarios.every((scenario) => scenario.follow_up.length > 20));
  assert.equal(scenarios.filter((scenario) => scenario.language === "zh-CN").length, 2);
  assert.ok(scenarios.some((scenario) => scenario.id === "host-conflict-resolved-delivery"));
  assert.ok(scenarios.some((scenario) => scenario.final_requirements.includes("no invented biography")));
  assert.doesNotMatch(
    scenarios[0].initial_prompt,
    /\b(?:professional|premium|clean|modern)\b|专业|高级|清爽/iu
  );
});

test("post-failure regressions cover direct evidence, neutrality, missing input, conflict, and clear work", async () => {
  const scenarios = await loadPostFailureRegressions();
  assert.equal(scenarios.length, 8);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 8);
  assert.deepEqual(
    new Set(scenarios.map((scenario) => scenario.expected_first_move)),
    new Set(["comparison", "sample", "question", "direct_delivery"])
  );
  assert.ok(scenarios.some((scenario) => scenario.id === "dev-neutral-after-priorities"));
  assert.ok(scenarios.some((scenario) => scenario.id === "dev-clear-missing-input"));
  assert.ok(scenarios.every((scenario) => Array.isArray(scenario.unacceptable_first)));
});

test("the paired study freezes exactly eighty unique tasks", async () => {
  const { raw, scenarios } = await loadStudy();
  assert.equal(scenarios.length, 80);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 80);
  assert.equal(
    createHash("sha256").update(raw, "utf8").digest("hex"),
    "9f66af3f968d2df52fac4f0ffb5ea8c12fa9a8f5076a0645ec25ddca0e4f428b"
  );
});

test("the eighty-task study has the required 15/15/15/15/20 distribution", async () => {
  const { scenarios } = await loadStudy();
  const counts = scenarios.reduce((result, scenario) => {
    result[scenario.class] = (result[scenario.class] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    poorly_expressed: 15,
    unformed: 15,
    conflict: 15,
    preference_after_result: 15,
    clear: 20
  });
});

test("study tasks freeze real follow-ups, outcome requirements, and intervention boundaries", async () => {
  const { scenarios } = await loadStudy();
  for (const scenario of scenarios) {
    assert.equal(typeof scenario.initial_prompt, "string");
    assert.ok(scenario.initial_prompt.length > 20);
    assert.ok(Array.isArray(scenario.final_requirements));
    assert.ok(scenario.final_requirements.length >= 1);
    assert.ok(Array.isArray(scenario.unacceptable_first));
    assert.ok(scenario.unacceptable_first.length >= 1);

    if (scenario.class === "clear") {
      assert.equal(scenario.expected_first_move, "silent");
      assert.equal(Object.hasOwn(scenario, "follow_up"), false);
    } else {
      assert.ok(["question", "comparison", "sample"].includes(scenario.expected_first_move));
      assert.equal(typeof scenario.follow_up, "string");
      assert.ok(scenario.follow_up.length > 20);
      assert.equal(typeof scenario.decision_at_risk, "string");
    }
  }

  const feedbackLabels = new Set(
    scenarios
      .filter((scenario) => scenario.class === "preference_after_result")
      .map((scenario) => scenario.feedback_label)
  );
  assert.deepEqual(feedbackLabels, new Set([
    "keep",
    "implementation_change",
    "intent_change",
    "uncertain"
  ]));
});

test("sealed holdout is hash-bound, independent, and has the frozen 80-task contract", async () => {
  const { raw, scenarios } = await loadHoldout();
  const manifest = JSON.parse(
    await readFile(path.join(repositoryRoot, "evals", "holdout-manifest.json"), "utf8")
  );
  const method = await readFile(path.join(repositoryRoot, "evals", "holdout-method.md"), "utf8");

  assert.equal(manifest.evidence_class, "sealed_holdout");
  assert.equal(manifest.sealed_before_candidate_run, true);
  assert.equal(manifest.arm_runs_before_seal, 0);
  assert.equal(manifest.product_policy_opened_by_author, false);
  assert.equal(manifest.old_corpus_opened_by_author, false);
  assert.equal(createHash("sha256").update(raw, "utf8").digest("hex"), manifest.corpus.sha256);
  assert.equal(createHash("sha256").update(method, "utf8").digest("hex"), manifest.method.sha256);
  assert.equal(scenarios.length, 80);
  assert.equal(new Set(scenarios.map((scenario) => scenario.id)).size, 80);

  const counts = Object.fromEntries(Object.keys(manifest.corpus.distribution).map((key) => [key, 0]));
  const expectedMove = {
    poorly_expressed: "question",
    unformed: "comparison",
    conflict: "question",
    preference_after_result: "sample",
    clear: "silent"
  };
  for (const scenario of scenarios) {
    assert.ok(Object.hasOwn(counts, scenario.class), `unexpected class for ${scenario.id}`);
    counts[scenario.class] += 1;
    assert.equal(scenario.expected_first_move, expectedMove[scenario.class]);
    assert.equal(typeof scenario.initial_prompt, "string");
    assert.ok(scenario.initial_prompt.length > 20);
    assert.ok(Array.isArray(scenario.final_requirements) && scenario.final_requirements.length > 0);
    assert.ok(Array.isArray(scenario.unacceptable_first) && scenario.unacceptable_first.length > 0);
    if (scenario.class === "clear") {
      assert.equal(Object.hasOwn(scenario, "follow_up"), false);
      assert.equal(Object.hasOwn(scenario, "feedback_label"), false);
    } else {
      assert.equal(typeof scenario.follow_up, "string");
      assert.ok(scenario.follow_up.length > 20);
      assert.equal(typeof scenario.decision_at_risk, "string");
    }
  }
  assert.deepEqual(counts, manifest.corpus.distribution);

  const feedbackCounts = scenarios
    .filter((scenario) => scenario.class === "preference_after_result")
    .reduce((result, scenario) => {
      result[scenario.feedback_label] = (result[scenario.feedback_label] ?? 0) + 1;
      return result;
    }, {});
  assert.deepEqual(feedbackCounts, {
    implementation_change: 4,
    keep: 6,
    intent_change: 4,
    uncertain: 1
  });
  const languageCounts = scenarios.reduce((result, scenario) => {
    assert.ok(["en", "zh-CN"].includes(scenario.language), "invalid language for " + scenario.id);
    assert.match(scenario.domain, /^[a-z][a-z0-9-]{2,}$/u);
    result[scenario.language] = (result[scenario.language] ?? 0) + 1;
    return result;
  }, {});
  assert.deepEqual(languageCounts, manifest.corpus.language_distribution);
  assert.deepEqual(languageCounts, { en: 60, "zh-CN": 20 });
  for (const className of Object.keys(manifest.corpus.distribution)) {
    const classLanguages = scenarios
      .filter((scenario) => scenario.class === className)
      .reduce((result, scenario) => {
        result[scenario.language] = (result[scenario.language] ?? 0) + 1;
        return result;
      }, {});
    assert.deepEqual(classLanguages, manifest.corpus.language_allocation_by_class[className]);
  }
  const domainCounts = scenarios.reduce((result, scenario) => {
    result[scenario.domain] = (result[scenario.domain] ?? 0) + 1;
    return result;
  }, {});
  assert.ok(Object.keys(domainCounts).length >= manifest.corpus.minimum_distinct_domains);
  assert.equal(Object.keys(domainCounts).length, manifest.corpus.actual_distinct_domains);
  assert.equal(manifest.corpus.maximum_cases_per_domain, 2);
  assert.ok(Math.max(...Object.values(domainCounts)) <= manifest.corpus.maximum_cases_per_domain);
  assert.equal(Math.max(...Object.values(domainCounts)), manifest.corpus.actual_maximum_cases_per_domain);
  assert.notEqual(raw.charCodeAt(0), 0xfeff);
  assert.doesNotMatch(raw, /\r/u);
  assert.doesNotMatch(raw, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
  assert.doesNotMatch(raw, /(?:\\\\\?\\)?\b[A-Za-z]:[\\/]/u);
  assert.doesNotMatch(raw, /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/u);
});

test("sealed holdout has no exact or threshold near-duplicate prompt in itself or any development corpus", async () => {
  const { scenarios: holdout } = await loadHoldout();
  const { scenarios: study } = await loadStudy();
  const development = [
    ...study,
    ...(await loadScenarios()),
    ...(await loadSemanticSmoke()),
    ...(await loadLatencyProbes()),
    ...(await loadHostRegressions()),
    ...(await loadPostFailureRegressions())
  ];
  const normalized = holdout.map((scenario) => normalizedText(scenarioPrompt(scenario)));
  assert.equal(new Set(normalized).size, holdout.length);

  const compare = (left, right) => {
    assert.ok(tokenJaccard(scenarioPrompt(left), scenarioPrompt(right)) < 0.65,
      `token overlap threshold exceeded: ${left.id}/${right.id}`);
    assert.ok(fourGramDice(scenarioPrompt(left), scenarioPrompt(right)) < 0.72,
      `four-gram overlap threshold exceeded: ${left.id}/${right.id}`);
  };
  for (let left = 0; left < holdout.length; left += 1) {
    for (let right = left + 1; right < holdout.length; right += 1) compare(holdout[left], holdout[right]);
    for (const prior of development) compare(holdout[left], prior);
  }
});

test("public evidence sanitizer removes credentials, local paths, and controls without offset leakage", () => {
  const { sanitization, sanitizeString, sanitizeValue } = createEvidenceSanitizer();
  const tokenShapedValue = ["sk", "proj", "ABCDEFGHIJKLMNOPQRST"].join("-");
  const labeledSecret = ["to", "ken=", "super-secret-value"].join("");
  const sanitized = sanitizeString(
    `prefix ${tokenShapedValue} ${labeledSecret} ` +
    "C:\\private\\study.json /Users/example/private.json suffix"
  );
  assert.equal(
    sanitized,
    "prefix [REDACTED] token=[REDACTED] [local path omitted] [local path omitted] suffix"
  );
  assert.equal(sanitizeString("left\u0001right"), "left�right");
  assert.deepEqual(sanitizeValue({ nested: [["Bear", "er abcdefghijklmnop"].join("")] }), {
    nested: ["[REDACTED]"]
  });
  assert.deepEqual(sanitization, {
    control_characters_replaced: 1,
    local_paths_replaced: 2,
    secret_patterns_replaced: 3,
    strings_truncated: 0,
    note: sanitization.note
  });
});

test("Codex diagnostics cannot be misclassified as premature user work", () => {
  const summary = summarizeCodexEvents([
    { type: "thread.started", thread_id: "thread-test" },
    { type: "item.completed", item: { type: "error", message: "hook trust bypass warning" } },
    { type: "item.completed", item: { type: "agent_message", text: "one question" } },
    { type: "item.completed", item: { type: "mcp_tool_call", server: "policy", tool: "load", status: "completed" } },
    { type: "item.completed", item: { type: "command_execution", status: "completed" } }
  ]);
  assert.equal(summary.thread_id, "thread-test");
  assert.deepEqual(summary.action_items, [{ type: "command_execution", status: "completed" }]);
  assert.deepEqual(summary.diagnostic_items, [{ type: "error", message: "hook trust bypass warning" }]);
  assert.equal(summary.mcp_tool_calls.length, 1);
});

test("blind grading schema fixes the bounded evidence labels", async () => {
  const schema = JSON.parse(
    await readFile(path.join(repositoryRoot, "evals", "grading-output-v2.schema.json"), "utf8")
  );
  assert.deepEqual(schema.required, ["grades"]);
  assert.equal(schema.properties.grades.maxItems, 5);
  assert.deepEqual(schema.$defs.armGrade.properties.intervention.enum, [
    "helpful",
    "wrong_or_unhelpful",
    "none"
  ]);
  assert.equal(schema.$defs.armGrade.properties.avoidable_rework.maximum, 3);
  assert.equal(schema.$defs.armGrade.properties.final_match.maximum, 4);
  assert.equal(schema.$defs.armGrade.properties.violations.items.minLength, 12);
  assert.equal(schema.$defs.armGrade.properties.violations.items.maxLength, 240);
  assert.deepEqual(schema.$defs.armGrade.properties.match_basis.enum, [
    "first_response",
    "post_followup_response"
  ]);
});

test("v2 grading prevents retroactive credit and distinguishes proactive intervention", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "evals", "grade-study.mjs"),
    "utf8"
  );
  assert.match(source, /intent-formation-blind-v2/);
  assert.match(source, /Never give a direct first delivery retroactive credit/i);
  assert.match(source, /options\/samples the user explicitly requested/i);
  assert.match(source, /Select match_basis independently/i);
  assert.match(source, /Inconsistent match_basis/);
  assert.match(source, /cannot be helpful proactive intervention/i);
  assert.match(source, /Malformed violation evidence/);
  assert.match(source, /Missing audit rationale/);
});

test("inference-denial violation rate treats no committed inference as zero violations", () => {
  assert.equal(violationRatePercent(0, 0), 0);
  assert.equal(violationRatePercent(1, 4), 25);
  assert.throws(() => violationRatePercent(1, 0), /inconsistent/i);
  assert.throws(() => violationRatePercent(2, 1), /inconsistent/i);
});

test("blind grader resumes only an exact, currently valid batch", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "evals", "grade-study.mjs"),
    "utf8"
  );
  assert.match(source, /process\.argv\.includes\("--resume"\)/);
  assert.match(source, /previousBlindInput === blindInput/);
  assert.match(source, /validateGrades\(parsed, batch\)/);
  assert.match(source, /exact_blind_input_and_current_contract/);
  assert.match(source, /resumed_batch_count/);
});

test("paired study keeps each pair sequential and alternates AB and BA", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "evals", "run-study.mjs"),
    "utf8"
  );
  assert.match(source, /index % 2 === 0/);
  assert.match(source, /for \(const job of jobGroups\[index\]\)/);
  assert.match(source, /alternating AB\/BA/);
  assert.match(source, /arms_within_pair: "sequential"/);
  assert.match(source, /intent-formation@intent-loop/);
  assert.match(source, /intent-formation-state@intent-loop/);
  assert.doesNotMatch(source, /intent-formation-test/);
  assert.match(source, /scenario\.initial_prompt/);
  assert.match(source, /scenario\.follow_up/);
  assert.match(source, /user_prompts_verbatim: true/);
  assert.match(source, /candidate_commit/);
  assert.match(source, /plugin_tree/);
  assert.match(source, /executed_plugin_tree/);
  assert.match(source, /installed plugin cache does not match candidate plugin tree/);
  assert.match(source, /runtime_cache_matches_candidate: true/);
  assert.match(source, /candidate_archive/);
  assert.match(source, /sandbox_base: "read-only"/);
  assert.match(source, /workspace_writes: "automatic review via --approve-for-me"/);
  assert.match(source, /--approve-for-me/);
  assert.match(source, /dangerous_approval_or_sandbox_bypass: false/);
  assert.doesNotMatch(source, /approval_policy=\\\"never\\\"/);
  assert.match(source, /--ignore-user-config/);
  assert.match(source, /--ignore-rules/);
  assert.doesNotMatch(source, /Respond to the user's task in ordinary conversation/);
  assert.doesNotMatch(source, /Do not inspect or modify workspace files/);
});

test("blind grader disables the real core and state plugin ids", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "evals", "grade-study.mjs"),
    "utf8"
  );
  assert.match(source, /intent-formation@intent-loop/);
  assert.match(source, /intent-formation-state@intent-loop/);
  assert.match(source, /study\.plugin_inventory\?\.installed_plugin_ids/);
  assert.match(source, /pluginId,/);
  assert.match(source, /statePluginId/);
  assert.match(source, /plugins\.\$\{id\}\.enabled=false/);
  assert.doesNotMatch(source, /intent-formation-test/);
  assert.match(source, /first_actions/);
  assert.match(source, /--reasoning-effort/);
  assert.match(source, /candidate_commit/);
});

test("canonical study validation rejects duplicate arms, missing follow-ups, and prompt drift", () => {
  const fixture = canonicalFixture();
  assert.doesNotThrow(() =>
    validateStudyStructure(fixture.study, fixture.grading, fixture.scenarios, {
      requireUsable: true
    })
  );

  const duplicate = structuredClone(fixture.study);
  duplicate.results[1] = structuredClone(duplicate.results[0]);
  assert.throws(
    () => validateStudyStructure(duplicate, fixture.grading, fixture.scenarios, { requireUsable: true }),
    /duplicate study run/
  );

  const missingSecond = structuredClone(fixture.study);
  missingSecond.results.find((result) => result.id === "case-nonclear").second = null;
  assert.throws(
    () => validateStudyStructure(missingSecond, fixture.grading, fixture.scenarios, { requireUsable: true }),
    /required second turn failed/
  );

  const wrongPrompt = structuredClone(fixture.study);
  wrongPrompt.results[0].first.prompt_sha256 = "0".repeat(64);
  assert.throws(
    () => validateStudyStructure(wrongPrompt, fixture.grading, fixture.scenarios, { requireUsable: true }),
    /initial prompt hash mismatch/
  );
});

test("canonical analysis is derived from raw grades and exposes gate tampering", () => {
  const fixture = canonicalFixture();
  const privacy = {
    status: "PASS",
    state_path: "isolated-ledger",
    state_bytes: 0,
    exact_complete_prompt_matches: []
  };
  const canonical = buildAnalysis({
    ...fixture,
    privacy,
    generatedAt: "2026-09-03T00:00:00.000Z"
  });
  assert.deepEqual(canonical.metrics.blind_preference_counts, {
    plugin: 1,
    baseline: 0,
    tie: 1
  });
  assert.deepEqual(canonical.evaluation_attempts, {
    supplemental_conversation_retry_configured: false,
    blind_grader_batch_count: 2,
    blind_grader_attempt_count: 3,
    blind_grader_retry_count: 1
  });
  const markdown = renderAnalysisMarkdown(canonical);
  assert.match(markdown, /No supplemental conversation retry was configured/);
  assert.match(markdown, /Blind grader: 2 batches, 3 attempts, 1 retry\./);
  assert.doesNotMatch(markdown, /The one retry is used only/);
  const tampered = structuredClone(canonical);
  tampered.gates.clear_latency.status = "PASS";
  tampered.gates.clear_latency.metric = -99;
  assert.notDeepEqual(tampered, canonical);
});

test("candidate Git tree fingerprint excludes an untracked auto-discovered skill", async (context) => {
  const scratchRoot = path.join(repositoryRoot, ".tmp");
  await mkdir(scratchRoot, { recursive: true });
  const repository = await mkdtemp(path.join(scratchRoot, "candidate-tree-"));
  context.after(() => rm(repository, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100
  }));
  const pluginRoot = path.join(repository, "plugins", "intent-formation");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(path.join(pluginRoot, "plugin.json"), "{}\n", "utf8");
  await execFileAsync("git", ["init"], { cwd: repository });
  await execFileAsync("git", ["add", "plugins/intent-formation/plugin.json"], { cwd: repository });
  await execFileAsync(
    "git",
    ["-c", "user.name=Intent Formation Tests", "-c", "user.email=tests@example.invalid", "commit", "-m", "fixture"],
    { cwd: repository }
  );
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repository });
  const committed = gitTreeFingerprint(
    repository,
    stdout.trim(),
    "plugins/intent-formation"
  );
  assert.deepEqual(await treeFingerprint(pluginRoot), committed);

  const untrackedSkill = path.join(pluginRoot, "skills", "hidden", "SKILL.md");
  await mkdir(path.dirname(untrackedSkill), { recursive: true });
  await writeFile(untrackedSkill, "---\nname: hidden\n---\n", "utf8");
  assert.notDeepEqual(await treeFingerprint(pluginRoot), committed);
});

test("formal study directories reject stale or sentinel-bearing paths", async (context) => {
  const scratchRoot = path.join(repositoryRoot, ".tmp");
  await mkdir(scratchRoot, { recursive: true });
  const scratch = await mkdtemp(path.join(scratchRoot, "fresh-study-directories-"));
  context.after(() => rm(scratch, { recursive: true, force: true }));
  const staleWorkspace = path.join(scratch, "stale-workspace");
  await mkdir(staleWorkspace);
  await writeFile(path.join(staleWorkspace, "sentinel.txt"), "old run", "utf8");
  await assert.rejects(
    createFreshRunDirectories([
      { label: "study workspace", target: staleWorkspace },
      { label: "study output", target: path.join(scratch, "fresh-output") }
    ]),
    /study workspace must not already exist/
  );
  assert.equal(await readFile(path.join(staleWorkspace, "sentinel.txt"), "utf8"), "old run");

  const workspace = path.join(scratch, "workspace");
  const output = path.join(scratch, "output");
  await createFreshRunDirectories([
    { label: "study workspace", target: workspace },
    { label: "study output", target: output }
  ]);
  await assert.rejects(
    createFreshRunDirectories([
      { label: "study workspace", target: workspace },
      { label: "study output", target: output }
    ]),
    /must not already exist/
  );
  await assert.rejects(
    createFreshRunDirectories([
      { label: "study workspace", target: path.join(scratch, "nested") },
      { label: "study output", target: path.join(scratch, "nested", "output") }
    ]),
    /must be separate directories/
  );
});

test("paired runner, blind grader, and analysis scripts pass Node syntax checks", async () => {
  for (const script of [
    "run-codex-pilot.mjs",
    "run-study.mjs",
    "grade-study.mjs",
    "analysis-core.mjs",
    "fresh-run-directories.mjs",
    "analyze-study.mjs",
    "fingerprint.mjs",
    "publish-evidence.mjs"
  ]) {
    await execFileAsync(process.execPath, [
      "--check",
      path.join(repositoryRoot, "evals", script)
    ]);
  }
});

test("pilot runner defaults to reviewed hook state and supports a true baseline arm", async () => {
  const source = await readFile(
    path.join(repositoryRoot, "evals", "run-codex-pilot.mjs"),
    "utf8"
  );
  assert.match(source, /--arm/);
  assert.match(source, /reviewed-host-state/);
  assert.match(source, /--bypass-hook-trust/);
  assert.match(source, /--arm paired requires --concurrency 1/);
  assert.match(source, /index % 2 === 0/);
  assert.match(source, /runArm === "plugin" \? "true" : "false"/);
});
