import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createEvidenceSanitizer } from "./evidence-sanitizer.mjs";
import { gitArchiveFingerprint, sha256, treeFingerprint } from "./fingerprint.mjs";

function option(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requiredPath(name) {
  const value = option(name);
  if (!value) throw new Error(`${name} is required`);
  return path.resolve(value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function jsonLine(value) {
  return JSON.stringify(value) + "\n";
}

function round(value, places = 4) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function bootstrapInterval(values, statistic, seed, iterations = 50_000) {
  assert.ok(values.length > 0);
  const random = seededRandom(seed);
  const estimates = new Array(iterations);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = values.map(() => values[Math.floor(random() * values.length)]);
    estimates[iteration] = statistic(sample);
  }
  estimates.sort((left, right) => left - right);
  return {
    method: "paired percentile bootstrap",
    iterations,
    seed,
    lower_95: round(estimates[Math.floor(iterations * 0.025)]),
    upper_95: round(estimates[Math.floor(iterations * 0.975)])
  };
}

function exactTwoSidedSignPValue(leftWins, rightWins) {
  const trials = leftWins + rightWins;
  const tailEnd = Math.min(leftWins, rightWins);
  let combination = 1;
  let tail = 0;
  for (let successes = 0; successes <= tailEnd; successes += 1) {
    if (successes > 0) combination = (combination * (trials - successes + 1)) / successes;
    tail += combination / 2 ** trials;
  }
  return Math.min(1, 2 * tail);
}

const { sanitization, sanitizeValue } = createEvidenceSanitizer();

function publicTurn(turn) {
  if (!turn) return null;
  return sanitizeValue({
    exit_code: turn.code,
    signal: turn.signal,
    timed_out: turn.timed_out,
    duration_ms: turn.duration_ms,
    prompt_sha256: turn.prompt_sha256,
    response: turn.response,
    mcp_tool_calls: turn.mcp_tool_calls ?? [],
    action_items: turn.action_items ?? [],
    diagnostic_items: turn.diagnostic_items ?? []
  });
}

function publicRun(result) {
  assert.equal(result.thread_cleanup?.code, 0, `${result.arm}/${result.id} cleanup failed`);
  return {
    id: result.id,
    class: result.class,
    arm: result.arm,
    expected_first_move: result.expected_first_move,
    first: publicTurn(result.first),
    second: publicTurn(result.second),
    total_duration_ms: result.total_duration_ms,
    thread_cleanup: {
      exit_code: result.thread_cleanup.code,
      stderr_empty: String(result.thread_cleanup.stderr ?? "") === ""
    }
  };
}

function classifyAttempt(attempt) {
  return {
    attempt: attempt.attempt,
    resumed: attempt.resumed === true,
    exit_code: attempt.code ?? null,
    signal: attempt.signal ?? null,
    timed_out: attempt.timed_out ?? false,
    duration_ms: attempt.duration_ms ?? null,
    validation_error: attempt.error
      ? (attempt.timed_out ? "missing response after timeout" : "response validation failed")
      : null
  };
}

const packageRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const studyPath = requiredPath("--study");
const gradesPath = requiredPath("--grades");
const analysisPath = requiredPath("--analysis");
const definitionPath = path.resolve(
  repositoryRoot,
  option("--holdout-manifest", "packages/intent-formation/evals/holdout-manifest.json")
);
const outputDirectory = path.resolve(
  repositoryRoot,
  option("--output", "evidence/v0.3.0-beta.1")
);
const productVersion = option("--product-version", "0.3.0-beta.1");
assert.ok(outputDirectory.startsWith(repositoryRoot + path.sep));

const definition = await readJson(definitionPath);
assert.equal(definition.schema_version, 1);
assert.equal(definition.evidence_class, "sealed_holdout");
assert.equal(definition.sealed_before_candidate_run, true);
const corpusPath = path.resolve(repositoryRoot, definition.corpus.path);
const corpusText = await readFile(corpusPath, "utf8");
assert.equal(sha256(corpusText), definition.corpus.sha256, "sealed holdout hash changed");
const scenarios = corpusText.split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line));
assert.equal(scenarios.length, definition.corpus.scenario_count);

const study = await readJson(studyPath);
const grading = await readJson(gradesPath);
const sourceAnalysis = await readJson(analysisPath);
assert.equal(study.corpus_sha256, definition.corpus.sha256);
assert.equal(grading.corpus_sha256, definition.corpus.sha256);
assert.equal(study.candidate_commit, grading.candidate_commit);
assert.equal(sourceAnalysis.candidate_commit, study.candidate_commit);
assert.equal(study.plugin_tree?.sha256, grading.plugin_tree?.sha256);
assert.equal(sourceAnalysis.plugin_tree?.sha256, study.plugin_tree?.sha256);
assert.deepEqual(study.executed_plugin_tree, study.plugin_tree);
assert.equal(study.results?.length, scenarios.length * 2);
assert.equal(grading.rubric_version, "intent-formation-blind-v2");
assert.equal(grading.graded_count, scenarios.length);
assert.equal(grading.grades?.length, scenarios.length);
assert.equal(sourceAnalysis.primary_run_reliability?.run_count, scenarios.length * 2);
assert.equal(sourceAnalysis.primary_run_reliability?.usable_count, scenarios.length * 2);
assert.ok(Object.values(sourceAnalysis.gates).every((gate) => gate.status === "PASS"));
assert.equal(study.isolation?.user_prompts_verbatim, true);
assert.equal(study.isolation?.dedicated_codex_home, true);
assert.equal(study.isolation?.sandbox_base, "read-only");
assert.equal(study.isolation?.workspace_writes, "automatic review via --approve-for-me");
assert.equal(study.isolation?.approval_policy, "automatic-review");
assert.equal(study.isolation?.dangerous_approval_or_sandbox_bypass, false);
assert.equal(study.plugin_id, "intent-formation@intent-loop");
assert.equal(study.state_plugin_id, "intent-formation-state@intent-loop");
assert.ok(study.model && study.reasoning_effort && grading.model && grading.reasoning_effort);

const currentCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: repositoryRoot,
  encoding: "utf8"
}).trim();
assert.equal(currentCommit, study.candidate_commit, "publish from the frozen candidate commit");
const trackedChanges = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=no"],
  { cwd: repositoryRoot, encoding: "utf8" }
).trim();
assert.equal(trackedChanges, "", "publish from a clean tracked worktree");
const currentTree = await treeFingerprint(path.join(repositoryRoot, "plugins", "intent-formation"));
assert.deepEqual(currentTree, study.plugin_tree);
const currentArchive = gitArchiveFingerprint(
  repositoryRoot,
  study.candidate_commit,
  "plugins/intent-formation"
);
assert.deepEqual(currentArchive, study.candidate_archive);

const scenarioIds = scenarios.map((scenario) => scenario.id);
assert.equal(new Set(scenarioIds).size, scenarios.length);
assert.deepEqual(grading.grades.map((grade) => grade.id).sort(), [...scenarioIds].sort());
const runs = study.results.map(publicRun);
for (const run of runs) {
  assert.equal(run.first.exit_code, 0);
  assert.equal(run.first.timed_out, false);
  if (run.second) {
    assert.equal(run.second.exit_code, 0);
    assert.equal(run.second.timed_out, false);
  }
}
const grades = sanitizeValue(grading.grades);
const sanitizedAnalysis = sanitizeValue(structuredClone(sourceAnalysis));
delete sanitizedAnalysis.privacy.state_path;
sanitizedAnalysis.privacy.storage_location = "isolated local plugin-data ledger; machine path omitted";

const gradesById = new Map(grades.map((grade) => [grade.id, grade]));
const nonclear = scenarios.filter((scenario) => scenario.class !== "clear");
const finalMatchDifferencesPp = scenarios.map((scenario) => {
  const grade = gradesById.get(scenario.id);
  return ((grade.plugin.final_match - grade.baseline.final_match) / 4) * 100;
});
const reworkDifferences = nonclear.map((scenario) => {
  const grade = gradesById.get(scenario.id);
  return grade.baseline.avoidable_rework - grade.plugin.avoidable_rework;
});
const clearLatencyDifferencesPp = scenarios
  .filter((scenario) => scenario.class === "clear")
  .map((scenario) => {
    const baseline = runs.find((run) => run.id === scenario.id && run.arm === "baseline").first.duration_ms;
    const plugin = runs.find((run) => run.id === scenario.id && run.arm === "plugin").first.duration_ms;
    return ((plugin - baseline) / baseline) * 100;
  });
const preferences = sourceAnalysis.metrics.blind_preference_counts;
sanitizedAnalysis.inferential_statistics = {
  final_match_gain_percentage_points: {
    estimate: round(mean(finalMatchDifferencesPp)),
    confidence_interval: bootstrapInterval(finalMatchDifferencesPp, mean, 0x1f0a1001)
  },
  nonclear_avoidable_rework_units_saved_per_case: {
    estimate: round(mean(reworkDifferences)),
    confidence_interval: bootstrapInterval(reworkDifferences, mean, 0x1f0a1002)
  },
  clear_task_paired_latency_overhead_percentage_points: {
    estimate: round(median(clearLatencyDifferencesPp)),
    confidence_interval: bootstrapInterval(clearLatencyDifferencesPp, median, 0x1f0a1003)
  },
  blind_preference_sign_test: {
    plugin_wins: preferences.plugin,
    baseline_wins: preferences.baseline,
    ties_excluded: preferences.tie,
    two_sided_exact_p_value: exactTwoSidedSignPValue(preferences.plugin, preferences.baseline)
  },
  caution: "Intervals quantify sampling variation within this sealed synthetic corpus only."
};

let longestTurn = null;
for (const run of runs) {
  for (const phase of ["first", "second"]) {
    const turn = run[phase];
    if (turn && (!longestTurn || turn.duration_ms > longestTurn.duration_ms)) {
      longestTurn = { id: run.id, arm: run.arm, phase, duration_ms: turn.duration_ms };
    }
  }
}
const graderAttempts = grading.batch_attempts.map((batch) => ({
  batch: batch.index + 1,
  attempts: batch.attempts.map(classifyAttempt)
}));
const retryBatches = graderAttempts.filter((batch) => batch.attempts.length > 1);

await mkdir(outputDirectory, { recursive: true });
const runsText = runs.map(jsonLine).join("");
const gradesText = grades.map(jsonLine).join("");
const analysisText = JSON.stringify(sanitizedAnalysis, null, 2) + "\n";
await writeFile(path.join(outputDirectory, "runs.jsonl"), runsText, "utf8");
await writeFile(path.join(outputDirectory, "blind-grades.jsonl"), gradesText, "utf8");
await writeFile(path.join(outputDirectory, "analysis.json"), analysisText, "utf8");

const sourceFiles = [
  "src/policy.mjs",
  "evals/holdout-80.jsonl",
  "evals/holdout-manifest.json",
  "evals/holdout-method.md",
  "evals/fingerprint.mjs",
  "evals/run-study.mjs",
  "evals/grade-study.mjs",
  "evals/grading-protocol-v2.md",
  "evals/grading-output-v2.schema.json",
  "evals/analyze-study.mjs",
  "evals/metrics.mjs",
  "evals/publish-evidence.mjs"
];
const sourceHashes = {};
for (const relativePath of sourceFiles) {
  sourceHashes[`packages/intent-formation/${relativePath}`] = sha256(
    await readFile(path.join(packageRoot, relativePath))
  );
}

const timeouts = runs.reduce(
  (count, run) => count + Number(run.first.timed_out) + Number(run.second?.timed_out ?? false),
  0
);
const cleanupFailures = runs.filter((run) => run.thread_cleanup.exit_code !== 0).length;
const manifest = {
  schema_version: 2,
  evidence_class: "candidate_holdout",
  evidence_id: `intent-formation-${productVersion}-sealed-holdout-v1`,
  product_version: productVersion,
  candidate_commit: study.candidate_commit,
  candidate_plugin_tree: study.plugin_tree,
  executed_plugin_tree: study.executed_plugin_tree,
  candidate_git_archive: study.candidate_archive,
  corpus: definition.corpus,
  holdout_method: definition.method,
  design: study.design,
  execution: {
    host: study.host,
    primary_conversations: runs.length,
    usable_primary_conversations: sourceAnalysis.primary_run_reliability.usable_count,
    primary_timeouts: timeouts,
    cleanup_failures: cleanupFailures,
    model: study.model,
    reasoning_effort: study.reasoning_effort,
    codex_cli_version: study.codex_cli_version,
    plugin_id: study.plugin_id,
    state_plugin_id: study.state_plugin_id,
    plugin_inventory: study.plugin_inventory,
    isolation: study.isolation,
    longest_turn: longestTurn
  },
  grading: {
    method: "automated blind pairwise grading",
    rubric_version: grading.rubric_version,
    model: grading.model,
    reasoning_effort: grading.reasoning_effort,
    batches: graderAttempts.length,
    retry_batch_count: retryBatches.length,
    retry_batches: retryBatches,
    failed_batches_after_retry: grading.failed_batches.length
  },
  gates: sanitizedAnalysis.gates,
  release_gate_result: "PASS_CANDIDATE_HOLDOUT",
  sanitization,
  limitations: [
    "The holdout is synthetic and adversarially authored; it is not a sample of production users.",
    "The study ran on one execution host. Cross-platform source and host compatibility use separate CI gates.",
    "The judge was an automated model, not a human panel; full sanitized outputs and grades are published for audit.",
    "AB/BA order alternated by scenario, but arms ran sequentially within each pair.",
    "Confidence intervals cover corpus resampling only and do not capture model, judge, or host drift.",
    "This efficacy result covers the Codex policy only; DeepSeek has separate compatibility evidence."
  ],
  source_sha256: sourceHashes,
  artifact_sha256: {
    "analysis.json": sha256(analysisText),
    "blind-grades.jsonl": sha256(gradesText),
    "runs.jsonl": sha256(runsText)
  }
};
await writeFile(
  path.join(outputDirectory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

const metrics = sanitizedAnalysis.metrics;
const readme = `# Intent Formation ${productVersion}: sealed holdout evidence\n\n` +
  `This candidate-bound bundle contains ${runs.length}/${runs.length} usable primary Codex conversations across ${scenarios.length} paired scenarios. The user prompts were sent verbatim in separate empty workspaces under a dedicated Codex Home. The exact candidate commit, generated plugin tree, installed execution-cache tree, Git archive, model, reasoning effort, CLI version, and plugin inventory are recorded in \`manifest.json\`.\n\n` +
  `Measured gates passed: non-clear avoidable rework changed from ${metrics.baseline_avoidable_rework_sum} to ${metrics.plugin_avoidable_rework_sum}; mean final match changed from ${metrics.baseline_final_match_mean_0_to_4}/4 to ${metrics.plugin_final_match_mean_0_to_4}/4; clear-task extra interruptions were median ${metrics.clear_extra_interruption_median} and p90 ${metrics.clear_extra_interruption_p90}; clear paired median latency overhead was ${metrics.clear_paired_latency_overhead_pct}%; and premature plugin action items on non-clear first turns were ${metrics.nonclear_premature_action_count}.\n\n` +
  `Blind preference was plugin ${preferences.plugin}, baseline ${preferences.baseline}, tie ${preferences.tie}. ${retryBatches.length} grading batch(es) required a second attempt; primary product runs were never replaced.\n\n` +
  `This is synthetic, automated evidence for a bounded Codex beta. It is not a human-user study, a universal efficacy claim, or DeepSeek efficacy evidence. Read the limitations and sanitization record in \`manifest.json\`.\n\n` +
  `Files:\n\n- \`manifest.json\`: candidate binding, design, gates, retries, environment, sanitization, and limitations.\n- \`analysis.json\`: metrics, class detail, gates, and corpus-resampling uncertainty.\n- \`runs.jsonl\`: all sanitized primary responses, timings, and action-item types.\n- \`blind-grades.jsonl\`: all sanitized unblinded rubric results.\n`;
await writeFile(path.join(outputDirectory, "README.md"), readme, "utf8");

const publicText = [runsText, gradesText, analysisText, JSON.stringify(manifest), readme].join("\n");
assert.doesNotMatch(publicText, /(?:\\\\\?\\)?\b[A-Za-z]:[\\/]/u);
assert.doesNotMatch(publicText, /(^|\s)\/(?:Users|home|tmp|private|var\/folders)\//mu);
assert.doesNotMatch(publicText, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
assert.doesNotMatch(publicText, /\b01[a-f0-9]{6}-[a-f0-9-]{20,}\b/u);

process.stdout.write(JSON.stringify({
  output_directory: outputDirectory,
  files: ["README.md", "manifest.json", "analysis.json", "runs.jsonl", "blind-grades.jsonl"],
  candidate_commit: study.candidate_commit,
  corpus_sha256: definition.corpus.sha256,
  plugin_tree_sha256: study.plugin_tree.sha256,
  longest_turn: longestTurn,
  retry_batches: retryBatches.map((batch) => batch.batch),
  sanitization
}, null, 2) + "\n");
