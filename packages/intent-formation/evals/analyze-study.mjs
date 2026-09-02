import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { violationRatePercent } from "./metrics.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const studyPath = path.resolve(repositoryRoot, option("--study", path.join(".tmp", "holdout-results", "summary.json")));
const gradesPath = path.resolve(repositoryRoot, option("--grades", path.join(".tmp", "holdout-grades", "summary.json")));
const scenariosPath = path.resolve(repositoryRoot, option("--scenarios", path.join("evals", "holdout-80.jsonl")));
const outputDirectory = path.resolve(repositoryRoot, option("--output", path.join(".tmp", "holdout-analysis")));
const defaultStatePath = path.join(
  process.env.CODEX_HOME || path.join(repositoryRoot, ".tmp", "missing-eval-home"),
  "plugin-data",
  "intent-formation",
  "intent-events-v1.jsonl"
);
const statePath = path.resolve(option("--state", defaultStatePath));

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const study = await readJson(studyPath);
const grading = await readJson(gradesPath);
const scenarios = (await readFile(scenariosPath, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
const gradeById = new Map(grading.grades.map((grade) => [grade.id, grade]));
if (grading.rubric_version !== "intent-formation-blind-v2") {
  throw new Error("Expected intent-formation-blind-v2 grades");
}

if (scenarios.length !== 80) throw new Error(`Expected 80 scenarios, found ${scenarios.length}`);
if (grading.graded_count !== scenarios.length || gradeById.size !== scenarios.length) {
  throw new Error(`Expected ${scenarios.length} grades, found ${gradeById.size}`);
}
if (
  study.candidate_commit !== grading.candidate_commit ||
  study.corpus_sha256 !== grading.corpus_sha256 ||
  study.plugin_tree?.sha256 !== grading.plugin_tree?.sha256
) {
  throw new Error("study and blind grades do not share one candidate binding");
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

function usable(result, scenario) {
  if (!result || result.first?.code !== 0 || !result.first?.response?.trim()) return false;
  if (!scenario.follow_up) return true;
  return result.second?.code === 0 && Boolean(result.second?.response?.trim());
}

function resultFor(id, arm) {
  return study.results.find((result) => result.id === id && result.arm === arm);
}

function percent(numerator, denominator) {
  return denominator ? round((numerator / denominator) * 100) : null;
}

function gate(metric, threshold, pass) {
  return { metric, threshold, status: pass ? "PASS" : "FAIL" };
}

const primaryRuns = study.results.map((result) => ({
  id: result.id,
  arm: result.arm,
  usable: usable(result, scenarioById.get(result.id)),
  timed_out: Boolean(result.first?.timed_out || result.second?.timed_out)
}));
const primaryFailures = primaryRuns.filter((run) => !run.usable);

const nonclearIds = scenarios.filter((scenario) => scenario.class !== "clear").map((scenario) => scenario.id);
const clearIds = scenarios.filter((scenario) => scenario.class === "clear").map((scenario) => scenario.id);
const nonclearGrades = nonclearIds.map((id) => gradeById.get(id));
const allGrades = scenarios.map((scenario) => gradeById.get(scenario.id));
const clearGrades = clearIds.map((id) => gradeById.get(id));

const baselineRework = nonclearGrades.reduce((sum, grade) => sum + grade.baseline.avoidable_rework, 0);
const pluginRework = nonclearGrades.reduce((sum, grade) => sum + grade.plugin.avoidable_rework, 0);
const reworkReductionPct = baselineRework ? round(((baselineRework - pluginRework) / baselineRework) * 100) : null;

const baselineMatchMean = mean(allGrades.map((grade) => grade.baseline.final_match));
const pluginMatchMean = mean(allGrades.map((grade) => grade.plugin.final_match));
const finalMatchGainPp = round(((pluginMatchMean - baselineMatchMean) / 4) * 100);
const nonclearBaselineMatchMean = mean(nonclearGrades.map((grade) => grade.baseline.final_match));
const nonclearPluginMatchMean = mean(nonclearGrades.map((grade) => grade.plugin.final_match));
const nonclearFinalMatchGainPp = round(((nonclearPluginMatchMean - nonclearBaselineMatchMean) / 4) * 100);

const clearExtraInterruptions = clearGrades.map((grade) => Math.max(0, grade.plugin.interruption_count - grade.baseline.interruption_count));
const clearPluginInterruptions = clearGrades.map((grade) => grade.plugin.interruption_count);
const clearExtraMedian = median(clearExtraInterruptions);
const clearExtraP90 = percentile(clearExtraInterruptions, 0.9);

const clearBaselineFirstMs = clearIds.map((id) => resultFor(id, "baseline")?.first?.duration_ms).filter(Number.isFinite);
const clearPluginFirstMs = clearIds.map((id) => resultFor(id, "plugin")?.first?.duration_ms).filter(Number.isFinite);
const clearBaselineMedianMs = median(clearBaselineFirstMs);
const clearPluginMedianMs = median(clearPluginFirstMs);
const clearArmMedianOverheadPct = round(((clearPluginMedianMs - clearBaselineMedianMs) / clearBaselineMedianMs) * 100);
const clearPairOverheadsPct = clearIds
  .map((id) => {
    const baseline = resultFor(id, "baseline")?.first?.duration_ms;
    const plugin = resultFor(id, "plugin")?.first?.duration_ms;
    return Number.isFinite(baseline) && Number.isFinite(plugin)
      ? ((plugin - baseline) / baseline) * 100
      : null;
  })
  .filter(Number.isFinite);
const clearLatencyOverheadPct = round(median(clearPairOverheadsPct));

const nonclearPrematureActions = nonclearIds.flatMap((id) => {
  const result = resultFor(id, "plugin");
  return (result?.first?.action_items ?? []).map((item) => ({ id, ...item }));
});

const interventionCounts = { helpful: 0, wrong_or_unhelpful: 0, none: 0 };
for (const grade of allGrades) interventionCounts[grade.plugin.intervention] += 1;
const proactiveCount = interventionCounts.helpful + interventionCounts.wrong_or_unhelpful;
const helpfulRatePct = percent(interventionCounts.helpful, proactiveCount);
const wrongRatePct = percent(interventionCounts.wrong_or_unhelpful, proactiveCount);

const inferenceMade = allGrades.filter((grade) => grade.plugin.agent_inference_made).length;
const inferenceDenied = allGrades.filter((grade) => grade.plugin.agent_inference_made && grade.plugin.inference_denied).length;
const inferenceDenialRatePct = violationRatePercent(inferenceDenied, inferenceMade);

const preferenceCounts = { plugin: 0, baseline: 0, tie: 0 };
for (const grade of allGrades) preferenceCounts[grade.preferred_arm] += 1;

const feedbackIds = scenarios.filter((scenario) => scenario.class === "preference_after_result").map((scenario) => scenario.id);
const feedbackGrades = feedbackIds.map((id) => gradeById.get(id));
const feedbackCorrect = feedbackGrades.filter((grade) => grade.plugin.feedback_handling === "correct").length;
const feedbackIncorrect = feedbackGrades.filter((grade) => grade.plugin.feedback_handling === "incorrect").length;
const matchBasisCounts = {
  baseline: { first_response: 0, post_followup_response: 0 },
  plugin: { first_response: 0, post_followup_response: 0 }
};
for (const grade of allGrades) {
  matchBasisCounts.baseline[grade.baseline.match_basis] += 1;
  matchBasisCounts.plugin[grade.plugin.match_basis] += 1;
}

const classBreakdown = {};
for (const className of [...new Set(scenarios.map((scenario) => scenario.class))]) {
  const ids = scenarios.filter((scenario) => scenario.class === className).map((scenario) => scenario.id);
  const grades = ids.map((id) => gradeById.get(id));
  const baselineClassRework = grades.reduce((sum, grade) => sum + grade.baseline.avoidable_rework, 0);
  const pluginClassRework = grades.reduce((sum, grade) => sum + grade.plugin.avoidable_rework, 0);
  classBreakdown[className] = {
    count: ids.length,
    baseline_rework_sum: baselineClassRework,
    plugin_rework_sum: pluginClassRework,
    rework_reduction_pct: baselineClassRework ? round(((baselineClassRework - pluginClassRework) / baselineClassRework) * 100) : null,
    baseline_final_match_mean: round(mean(grades.map((grade) => grade.baseline.final_match))),
    plugin_final_match_mean: round(mean(grades.map((grade) => grade.plugin.final_match))),
    plugin_preferences: grades.filter((grade) => grade.preferred_arm === "plugin").length,
    baseline_preferences: grades.filter((grade) => grade.preferred_arm === "baseline").length,
    ties: grades.filter((grade) => grade.preferred_arm === "tie").length
  };
}

let privacy = { status: "UNVERIFIED", state_path: statePath, state_bytes: null, exact_complete_prompt_matches: [] };
try {
  const persisted = await readFile(statePath, "utf8");
  const matches = [];
  for (const scenario of scenarios) {
    if (scenario.initial_prompt && persisted.includes(scenario.initial_prompt)) matches.push({ id: scenario.id, field: "initial_prompt" });
    if (scenario.follow_up && persisted.includes(scenario.follow_up)) matches.push({ id: scenario.id, field: "follow_up" });
  }
  privacy = {
    status: matches.length === 0 ? "PASS" : "FAIL",
    state_path: statePath,
    state_bytes: Buffer.byteLength(persisted),
    exact_complete_prompt_matches: matches
  };
} catch (error) {
  if (error?.code === "ENOENT") {
    privacy = {
      status: "PASS",
      state_path: statePath,
      state_bytes: 0,
      state_file_present: false,
      exact_complete_prompt_matches: []
    };
  } else {
    privacy.error = String(error?.code || error?.message || error);
  }
}

const gates = {
  avoidable_rework: gate(reworkReductionPct, ">= 25% reduction", reworkReductionPct !== null && reworkReductionPct >= 25),
  final_match: gate(finalMatchGainPp, ">= 10 percentage points", finalMatchGainPp >= 10),
  clear_extra_interruptions_median: gate(clearExtraMedian, "= 0", clearExtraMedian === 0),
  clear_extra_interruptions_p90: gate(clearExtraP90, "<= 1", clearExtraP90 <= 1),
  clear_latency: gate(clearLatencyOverheadPct, "<= 5% overhead", clearLatencyOverheadPct <= 5),
  proactive_helpful: gate(helpfulRatePct, ">= 70% of proactive interventions", helpfulRatePct !== null && helpfulRatePct >= 70),
  proactive_wrong: gate(wrongRatePct, "<= 15% of proactive interventions", wrongRatePct !== null && wrongRatePct <= 15),
  inference_denial: gate(inferenceDenialRatePct, "<= 10% of inferred cases", inferenceDenialRatePct <= 10),
  nonclear_premature_actions: gate(
    nonclearPrematureActions.length,
    "= 0 tool/action items before the intent-forming response",
    nonclearPrematureActions.length === 0
  ),
  raw_prompt_persistence: { metric: privacy.exact_complete_prompt_matches.length, threshold: "= 0 exact full corpus prompts", status: privacy.status }
};
const allMeasuredPass = Object.values(gates).every((item) => item.status === "PASS");
const stopCondition = gates.avoidable_rework.status === "FAIL" || gates.clear_latency.status === "FAIL" || clearExtraMedian > 1;
const decision = allMeasuredPass ? "GO_PENDING_STATE_TESTS" : stopCondition ? "STOP" : "ITERATE";

const analysis = {
  generated_at: new Date().toISOString(),
  candidate_commit: study.candidate_commit,
  corpus_sha256: study.corpus_sha256,
  plugin_tree: study.plugin_tree,
  execution_model: study.model,
  execution_reasoning_effort: study.reasoning_effort,
  grader_model: grading.model,
  grader_reasoning_effort: grading.reasoning_effort,
  decision,
  interpretation: "V2 final match scores the first completed intent-formation cycle. Retry text may complete blind quality grading but never replaces primary reliability or timing statistics.",
  primary_run_reliability: {
    run_count: primaryRuns.length,
    usable_count: primaryRuns.length - primaryFailures.length,
    usable_rate_pct: percent(primaryRuns.length - primaryFailures.length, primaryRuns.length),
    failures: primaryFailures
  },
  metrics: {
    nonclear_scenario_count: nonclearIds.length,
    baseline_avoidable_rework_sum: baselineRework,
    plugin_avoidable_rework_sum: pluginRework,
    avoidable_rework_reduction_pct: reworkReductionPct,
    baseline_final_match_mean_0_to_4: round(baselineMatchMean),
    plugin_final_match_mean_0_to_4: round(pluginMatchMean),
    final_match_gain_percentage_points: finalMatchGainPp,
    nonclear_final_match_gain_percentage_points: nonclearFinalMatchGainPp,
    clear_extra_interruption_median: clearExtraMedian,
    clear_extra_interruption_p90: clearExtraP90,
    clear_plugin_interruption_median: median(clearPluginInterruptions),
    clear_plugin_interruption_p90: percentile(clearPluginInterruptions, 0.9),
    clear_baseline_first_turn_median_ms: clearBaselineMedianMs,
    clear_plugin_first_turn_median_ms: clearPluginMedianMs,
    clear_arm_median_latency_overhead_pct: clearArmMedianOverheadPct,
    clear_paired_latency_overhead_pct: clearLatencyOverheadPct,
    intervention_counts: interventionCounts,
    proactive_intervention_count: proactiveCount,
    helpful_proactive_rate_pct: helpfulRatePct,
    wrong_or_unhelpful_proactive_rate_pct: wrongRatePct,
    inference_made_count: inferenceMade,
    inference_denied_count: inferenceDenied,
    inference_denial_rate_pct: inferenceDenialRatePct,
    nonclear_premature_action_count: nonclearPrematureActions.length,
    nonclear_premature_actions: nonclearPrematureActions,
    blind_preference_counts: preferenceCounts,
    result_feedback_correct_count: feedbackCorrect,
    result_feedback_incorrect_count: feedbackIncorrect,
    result_feedback_case_count: feedbackIds.length,
    match_basis_counts: matchBasisCounts
  },
  class_breakdown: classBreakdown,
  privacy,
  gates,
  state_test_gate: "UNVERIFIED_IN_THIS_SCRIPT"
};

function markdownGateRow(name, value) {
  return `| ${name} | ${value.metric} | ${value.threshold} | ${value.status} |`;
}

const markdown = [
  "# Frozen 80-task study result v2",
  "",
  `Decision: **${decision}**`,
  "",
  "The primary run remains the source for reliability and timing. The one retry is used only to give the blind grader a complete text pair.",
  "",
  "## Measured gates",
  "",
  "| Gate | Measured | Required | Status |",
  "| --- | ---: | ---: | --- |",
  ...Object.entries(gates).map(([name, value]) => markdownGateRow(name, value)),
  "",
  "## Core metrics",
  "",
  `- Primary conversations: ${analysis.primary_run_reliability.usable_count}/${analysis.primary_run_reliability.run_count} usable (${analysis.primary_run_reliability.usable_rate_pct}%).`,
  `- Non-clear avoidable rework: ${baselineRework} baseline vs ${pluginRework} plugin (${reworkReductionPct}% reduction).`,
  `- Final match: ${round(baselineMatchMean)}/4 baseline vs ${round(pluginMatchMean)}/4 plugin (${finalMatchGainPp} percentage points).`,
  `- Clear-task first-turn median: ${clearBaselineMedianMs} ms baseline vs ${clearPluginMedianMs} ms plugin (${clearLatencyOverheadPct}% overhead).`,
  `- Blind preferences: plugin ${preferenceCounts.plugin}, baseline ${preferenceCounts.baseline}, tie ${preferenceCounts.tie}.`,
  `- Proactive interventions: ${interventionCounts.helpful} helpful, ${interventionCounts.wrong_or_unhelpful} wrong/unhelpful, ${interventionCounts.none} none.`,
  `- Exact complete corpus prompts found in default state: ${privacy.exact_complete_prompt_matches.length}.`,
  "",
  "Deletion/export tests are intentionally reported by the repository test run, not inferred from conversation grades."
].join("\n") + "\n";

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "analysis.json"), JSON.stringify(analysis, null, 2) + "\n", "utf8");
await writeFile(path.join(outputDirectory, "analysis.md"), markdown, "utf8");
process.stdout.write(JSON.stringify({ decision, gates, output_directory: outputDirectory }, null, 2) + "\n");
