import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createEvidenceSanitizer } from "../evals/evidence-sanitizer.mjs";
import { violationRatePercent } from "../evals/metrics.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

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
  assert.equal(manifest.method.arm_runs_before_seal, 0);
  assert.equal(manifest.method.product_policy_opened_by_author, false);
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
  assert.equal(
    scenarios.filter((scenario) => /\b(?:professional|premium|clean)\b|高级/iu.test(scenario.initial_prompt)).length,
    5
  );
  assert.doesNotMatch(raw, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
  assert.doesNotMatch(raw, /(?:\\\\\?\\)?\b[A-Za-z]:[\\/]/u);
  assert.doesNotMatch(raw, /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/u);
});

test("sealed holdout has no exact or threshold near-duplicate prompt in itself or the development corpus", async () => {
  const { scenarios: holdout } = await loadHoldout();
  const { scenarios: development } = await loadStudy();
  const normalized = holdout.map((scenario) => normalizedText(scenario.initial_prompt));
  assert.equal(new Set(normalized).size, holdout.length);

  const compare = (left, right) => {
    assert.ok(tokenJaccard(left.initial_prompt, right.initial_prompt) < 0.65,
      `token overlap threshold exceeded: ${left.id}/${right.id}`);
    assert.ok(fourGramDice(left.initial_prompt, right.initial_prompt) < 0.72,
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
  assert.match(source, /candidate_archive/);
  assert.match(source, /workspace-write/);
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

test("paired runner, blind grader, and analysis scripts pass Node syntax checks", async () => {
  for (const script of [
    "run-codex-pilot.mjs",
    "run-study.mjs",
    "grade-study.mjs",
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
