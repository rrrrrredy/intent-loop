import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { violationRatePercent } from "./metrics.mjs";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
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
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(fraction * sorted.length) - 1)];
}

function percent(numerator, denominator) {
  return denominator ? round((numerator / denominator) * 100) : null;
}

function gate(metric, threshold, pass) {
  return { metric, threshold, status: pass ? "PASS" : "FAIL" };
}

function usable(result, scenario) {
  if (!result || result.first?.code !== 0 || !result.first?.response?.trim()) return false;
  if (!scenario.follow_up) return true;
  return result.second?.code === 0 && Boolean(result.second?.response?.trim());
}

export function validateStudyStructure(study, grading, scenarios, options = {}) {
  const requireUsable = options.requireUsable === true;
  invariant(Array.isArray(scenarios) && scenarios.length > 0, "study scenarios are required");
  invariant(Array.isArray(study?.results), "study results must be an array");
  invariant(Array.isArray(grading?.grades), "blind grades must be an array");
  invariant(["intent-formation-blind-v3", "intent-formation-blind-v4"].includes(grading.rubric_version), "unexpected blind rubric");
  invariant(
    study.candidate_commit === grading.candidate_commit &&
      study.corpus_sha256 === grading.corpus_sha256 &&
      study.plugin_tree?.sha256 === grading.plugin_tree?.sha256,
    "study and blind grades do not share one candidate binding"
  );

  const scenarioById = new Map();
  for (const scenario of scenarios) {
    invariant(typeof scenario?.id === "string" && scenario.id !== "", "scenario id is invalid");
    invariant(!scenarioById.has(scenario.id), `duplicate scenario id: ${scenario.id}`);
    scenarioById.set(scenario.id, scenario);
  }

  const resultByPair = new Map();
  for (const result of study.results) {
    const scenario = scenarioById.get(result?.id);
    invariant(scenario !== undefined, `study contains unknown scenario: ${result?.id}`);
    invariant(["baseline", "plugin"].includes(result.arm), `study arm is invalid: ${result.arm}`);
    const key = `${result.id}\0${result.arm}`;
    invariant(!resultByPair.has(key), `duplicate study run: ${result.arm}/${result.id}`);
    resultByPair.set(key, result);
    invariant(result.class === scenario.class, `scenario class mismatch: ${result.id}`);
    invariant(
      result.expected_first_move === scenario.expected_first_move,
      `expected first move mismatch: ${result.id}`
    );
    invariant(
      result.first?.prompt_sha256 === sha256(scenario.initial_prompt),
      `initial prompt hash mismatch: ${result.arm}/${result.id}`
    );
    if (scenario.follow_up) {
      if (result.second !== null && result.second !== undefined) {
        invariant(
          result.second.prompt_sha256 === sha256(scenario.follow_up),
          `follow-up prompt hash mismatch: ${result.arm}/${result.id}`
        );
      }
    } else {
      invariant(result.second === null || result.second === undefined, `unexpected second turn: ${result.arm}/${result.id}`);
    }
    if (requireUsable) {
      invariant(result.first?.code === 0, `first turn failed: ${result.arm}/${result.id}`);
      invariant(result.first?.timed_out !== true, `first turn timed out: ${result.arm}/${result.id}`);
      invariant(Boolean(result.first?.response?.trim()), `first response is empty: ${result.arm}/${result.id}`);
      if (scenario.follow_up) {
        invariant(result.second?.code === 0, `required second turn failed: ${result.arm}/${result.id}`);
        invariant(result.second?.timed_out !== true, `required second turn timed out: ${result.arm}/${result.id}`);
        invariant(Boolean(result.second?.response?.trim()), `required second response is empty: ${result.arm}/${result.id}`);
      }
    }
  }
  invariant(resultByPair.size === scenarios.length * 2, "study does not contain exactly two arms per scenario");
  for (const scenario of scenarios) {
    for (const arm of ["baseline", "plugin"]) {
      invariant(resultByPair.has(`${scenario.id}\0${arm}`), `missing study run: ${arm}/${scenario.id}`);
    }
  }

  const gradeById = new Map();
  for (const grade of grading.grades) {
    invariant(scenarioById.has(grade?.id), `grade contains unknown scenario: ${grade?.id}`);
    invariant(!gradeById.has(grade.id), `duplicate blind grade: ${grade.id}`);
    gradeById.set(grade.id, grade);
  }
  invariant(gradeById.size === scenarios.length, "blind grades do not cover every scenario exactly once");
  invariant(grading.graded_count === scenarios.length, "blind graded_count is inconsistent");
  return { scenarioById, resultByPair, gradeById };
}

export async function inspectPromptPrivacy(statePath, scenarios) {
  try {
    const persisted = await readFile(statePath, "utf8");
    const matches = [];
    for (const scenario of scenarios) {
      if (scenario.initial_prompt && persisted.includes(scenario.initial_prompt)) {
        matches.push({ id: scenario.id, field: "initial_prompt" });
      }
      if (scenario.follow_up && persisted.includes(scenario.follow_up)) {
        matches.push({ id: scenario.id, field: "follow_up" });
      }
    }
    return {
      status: matches.length === 0 ? "PASS" : "FAIL",
      state_path: statePath,
      state_bytes: Buffer.byteLength(persisted),
      exact_complete_prompt_matches: matches
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        status: "PASS",
        state_path: statePath,
        state_bytes: 0,
        state_file_present: false,
        exact_complete_prompt_matches: []
      };
    }
    return {
      status: "UNVERIFIED",
      state_path: statePath,
      state_bytes: null,
      exact_complete_prompt_matches: [],
      error: String(error?.code || error?.message || error)
    };
  }
}

export function buildAnalysis({ study, grading, scenarios, privacy, generatedAt }) {
  const { scenarioById, resultByPair, gradeById } = validateStudyStructure(
    study,
    grading,
    scenarios
  );
  const resultFor = (id, arm) => resultByPair.get(`${id}\0${arm}`);
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
  const reworkReductionPct = baselineRework
    ? round(((baselineRework - pluginRework) / baselineRework) * 100)
    : null;
  const baselineMatchMean = mean(allGrades.map((grade) => grade.baseline.final_match));
  const pluginMatchMean = mean(allGrades.map((grade) => grade.plugin.final_match));
  const finalMatchGainPp = round(((pluginMatchMean - baselineMatchMean) / 4) * 100);
  const nonclearBaselineMatchMean = mean(nonclearGrades.map((grade) => grade.baseline.final_match));
  const nonclearPluginMatchMean = mean(nonclearGrades.map((grade) => grade.plugin.final_match));
  const nonclearFinalMatchGainPp = round(
    ((nonclearPluginMatchMean - nonclearBaselineMatchMean) / 4) * 100
  );

  const clearExtraInterruptions = clearGrades.map((grade) =>
    Math.max(0, grade.plugin.interruption_count - grade.baseline.interruption_count)
  );
  const clearPluginInterruptions = clearGrades.map((grade) => grade.plugin.interruption_count);
  const clearExtraMedian = median(clearExtraInterruptions);
  const clearExtraP90 = percentile(clearExtraInterruptions, 0.9);
  const clearBaselineFirstMs = clearIds
    .map((id) => resultFor(id, "baseline")?.first?.duration_ms)
    .filter(Number.isFinite);
  const clearPluginFirstMs = clearIds
    .map((id) => resultFor(id, "plugin")?.first?.duration_ms)
    .filter(Number.isFinite);
  const clearBaselineMedianMs = median(clearBaselineFirstMs);
  const clearPluginMedianMs = median(clearPluginFirstMs);
  const clearArmMedianOverheadPct = clearBaselineMedianMs > 0 && clearPluginMedianMs !== null
    ? round(((clearPluginMedianMs - clearBaselineMedianMs) / clearBaselineMedianMs) * 100)
    : null;
  const clearPairOverheadsPct = clearIds.map((id) => {
    const baseline = resultFor(id, "baseline")?.first?.duration_ms;
    const plugin = resultFor(id, "plugin")?.first?.duration_ms;
    return Number.isFinite(baseline) && baseline > 0 && Number.isFinite(plugin)
      ? ((plugin - baseline) / baseline) * 100
      : null;
  }).filter(Number.isFinite);
  const clearLatencyOverheadPct = clearPairOverheadsPct.length
    ? round(median(clearPairOverheadsPct))
    : null;

  const nonclearPrematureActions = nonclearIds.flatMap((id) =>
    (resultFor(id, "plugin")?.first?.action_items ?? []).map((item) => ({ id, ...item }))
  );
  const interventionCounts = { helpful: 0, wrong_or_unhelpful: 0, none: 0 };
  for (const grade of allGrades) interventionCounts[grade.plugin.intervention] += 1;
  const proactiveCount = interventionCounts.helpful + interventionCounts.wrong_or_unhelpful;
  const helpfulRatePct = percent(interventionCounts.helpful, proactiveCount);
  const wrongRatePct = percent(interventionCounts.wrong_or_unhelpful, proactiveCount);
  const inferenceMade = allGrades.filter((grade) => grade.plugin.agent_inference_made).length;
  const inferenceDenied = allGrades.filter(
    (grade) => grade.plugin.agent_inference_made && grade.plugin.inference_denied
  ).length;
  const inferenceDenialRatePct = violationRatePercent(inferenceDenied, inferenceMade);
  const preferenceCounts = { plugin: 0, baseline: 0, tie: 0 };
  for (const grade of allGrades) preferenceCounts[grade.preferred_arm] += 1;
  const feedbackIds = scenarios
    .filter((scenario) => scenario.class === "preference_after_result")
    .map((scenario) => scenario.id);
  const feedbackGrades = feedbackIds.map((id) => gradeById.get(id));
  const feedbackCorrect = feedbackGrades.filter(
    (grade) => grade.plugin.feedback_handling === "correct"
  ).length;
  const feedbackIncorrect = feedbackGrades.filter(
    (grade) => grade.plugin.feedback_handling === "incorrect"
  ).length;
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
      rework_reduction_pct: baselineClassRework
        ? round(((baselineClassRework - pluginClassRework) / baselineClassRework) * 100)
        : null,
      baseline_final_match_mean: round(mean(grades.map((grade) => grade.baseline.final_match))),
      plugin_final_match_mean: round(mean(grades.map((grade) => grade.plugin.final_match))),
      plugin_preferences: grades.filter((grade) => grade.preferred_arm === "plugin").length,
      baseline_preferences: grades.filter((grade) => grade.preferred_arm === "baseline").length,
      ties: grades.filter((grade) => grade.preferred_arm === "tie").length
    };
  }

  const gates = {
    avoidable_rework: gate(reworkReductionPct, ">= 25% reduction", reworkReductionPct !== null && reworkReductionPct >= 25),
    final_match: gate(finalMatchGainPp, ">= 10 percentage points", finalMatchGainPp >= 10),
    clear_extra_interruptions_median: gate(clearExtraMedian, "= 0", clearExtraMedian === 0),
    clear_extra_interruptions_p90: gate(clearExtraP90, "<= 1", clearExtraP90 !== null && clearExtraP90 <= 1),
    clear_latency: gate(clearLatencyOverheadPct, "<= 5% overhead", clearLatencyOverheadPct !== null && clearLatencyOverheadPct <= 5),
    proactive_helpful: gate(helpfulRatePct, ">= 70% of proactive interventions", helpfulRatePct !== null && helpfulRatePct >= 70),
    proactive_wrong: gate(wrongRatePct, "<= 15% of proactive interventions", wrongRatePct !== null && wrongRatePct <= 15),
    inference_denial: gate(inferenceDenialRatePct, "<= 10% of inferred cases", inferenceDenialRatePct <= 10),
    nonclear_premature_actions: gate(
      nonclearPrematureActions.length,
      "= 0 tool/action items before the intent-forming response",
      nonclearPrematureActions.length === 0
    ),
    raw_prompt_persistence: {
      metric: privacy.exact_complete_prompt_matches.length,
      threshold: "= 0 exact full corpus prompts",
      status: privacy.status
    }
  };
  const allMeasuredPass = Object.values(gates).every((item) => item.status === "PASS");
  const stopCondition =
    gates.avoidable_rework.status === "FAIL" ||
    gates.clear_latency.status === "FAIL" ||
    clearExtraMedian > 1;
  const decision = allMeasuredPass ? "GO_PENDING_STATE_TESTS" : stopCondition ? "STOP" : "ITERATE";
  const graderBatches = Array.isArray(grading.batch_attempts) ? grading.batch_attempts : [];
  const graderAttemptCount = graderBatches.reduce(
    (sum, batch) => sum + (Array.isArray(batch.attempts) ? batch.attempts.length : 0),
    0
  );
  const graderRetryCount = graderBatches.reduce(
    (sum, batch) => sum + Math.max(0, (Array.isArray(batch.attempts) ? batch.attempts.length : 0) - 1),
    0
  );

  return {
    generated_at: generatedAt || new Date().toISOString(),
    candidate_commit: study.candidate_commit,
    corpus_sha256: study.corpus_sha256,
    plugin_tree: study.plugin_tree,
    execution_model: study.model,
    execution_reasoning_effort: study.reasoning_effort,
    grader_model: grading.model,
    grader_reasoning_effort: grading.reasoning_effort,
    decision,
    interpretation: "V2 final match scores the first completed intent-formation cycle. Retry text may complete blind quality grading but never replaces primary reliability or timing statistics.",
    evaluation_attempts: {
      supplemental_conversation_retry_configured: Boolean(grading.retry_path),
      blind_grader_batch_count: graderBatches.length,
      blind_grader_attempt_count: graderAttemptCount,
      blind_grader_retry_count: graderRetryCount
    },
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
}

function markdownGateRow(name, value) {
  return `| ${name} | ${value.metric} | ${value.threshold} | ${value.status} |`;
}

export function renderAnalysisMarkdown(analysis) {
  const metrics = analysis.metrics;
  const attempts = analysis.evaluation_attempts;
  const supplementalLine = attempts.supplemental_conversation_retry_configured
    ? "A configured supplemental conversation run could supply missing text for blind quality grading only; primary reliability and timing still use the primary run."
    : "No supplemental conversation retry was configured; primary responses supply reliability, timing, and blind quality evidence.";
  return [
    "# Frozen 80-task study result v2",
    "",
    `Decision: **${analysis.decision}**`,
    "",
    supplementalLine,
    "",
    "## Measured gates",
    "",
    "| Gate | Measured | Required | Status |",
    "| --- | ---: | ---: | --- |",
    ...Object.entries(analysis.gates).map(([name, value]) => markdownGateRow(name, value)),
    "",
    "## Core metrics",
    "",
    `- Primary conversations: ${analysis.primary_run_reliability.usable_count}/${analysis.primary_run_reliability.run_count} usable (${analysis.primary_run_reliability.usable_rate_pct}%).`,
    `- Non-clear avoidable rework: ${metrics.baseline_avoidable_rework_sum} baseline vs ${metrics.plugin_avoidable_rework_sum} plugin (${metrics.avoidable_rework_reduction_pct}% reduction).`,
    `- Final match: ${metrics.baseline_final_match_mean_0_to_4}/4 baseline vs ${metrics.plugin_final_match_mean_0_to_4}/4 plugin (${metrics.final_match_gain_percentage_points} percentage points).`,
    `- Clear-task first-turn median: ${metrics.clear_baseline_first_turn_median_ms} ms baseline vs ${metrics.clear_plugin_first_turn_median_ms} ms plugin (${metrics.clear_paired_latency_overhead_pct}% overhead).`,
    `- Blind preferences: plugin ${metrics.blind_preference_counts.plugin}, baseline ${metrics.blind_preference_counts.baseline}, tie ${metrics.blind_preference_counts.tie}.`,
    `- Blind grader: ${attempts.blind_grader_batch_count} batches, ${attempts.blind_grader_attempt_count} attempts, ${attempts.blind_grader_retry_count} ${attempts.blind_grader_retry_count === 1 ? "retry" : "retries"}.`,
    `- Proactive interventions: ${metrics.intervention_counts.helpful} helpful, ${metrics.intervention_counts.wrong_or_unhelpful} wrong/unhelpful, ${metrics.intervention_counts.none} none.`,
    `- Exact complete corpus prompts found in default state: ${analysis.privacy.exact_complete_prompt_matches.length}.`,
    "",
    "Deletion/export tests are intentionally reported by the repository test run, not inferred from conversation grades."
  ].join("\n") + "\n";
}
