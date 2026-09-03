import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const studyPath = path.resolve(repositoryRoot, option("--study", path.join(".tmp", "holdout-results", "summary.json")));
const retryOption = option("--retry", "");
const retryPath = retryOption ? path.resolve(repositoryRoot, retryOption) : null;
const scenariosPath = path.resolve(repositoryRoot, option("--scenarios", path.join("evals", "holdout-80.jsonl")));
const schemaPath = path.resolve(repositoryRoot, option("--schema", path.join("evals", "grading-output-v2.schema.json")));
const outputDirectory = path.resolve(repositoryRoot, option("--output", path.join(".tmp", "holdout-grades")));
const workspace = path.resolve(option("--workspace", path.join(repositoryRoot, ".tmp", "holdout-grader-workspace")));
const batchSize = Number(option("--batch-size", "5"));
const concurrency = Number(option("--concurrency", "2"));
const timeoutMs = Number(option("--timeout-ms", "240000"));
const model = option("--model", "");
const reasoningEffort = option("--reasoning-effort", "");
const resume = process.argv.includes("--resume");
const codexBinary = process.env.CODEX_BIN || "codex";
const pluginId = option("--plugin-id", "intent-formation@intent-loop");
const statePluginId = option("--state-plugin-id", "intent-formation-state@intent-loop");
const requestedIds = option("--ids", "").split(",").map((id) => id.trim()).filter(Boolean);

if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) throw new Error("--batch-size must be an integer from 1 to 5");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error("--concurrency must be an integer from 1 to 2");
if (!Number.isInteger(timeoutMs) || timeoutMs < 30000) throw new Error("--timeout-ms must be an integer of at least 30000");
if (!model) throw new Error("--model is required for candidate-bound grading");
if (!new Set(["low", "medium", "high", "xhigh"]).has(reasoningEffort)) {
  throw new Error("--reasoning-effort must be low, medium, high, or xhigh");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readTextIfPresent(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

const study = await readJson(studyPath);
const retry = retryPath ? await readJson(retryPath) : { results: [] };
const scenariosText = await readFile(scenariosPath, "utf8");
const scenarios = scenariosText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
if (hashText(scenariosText) !== study.corpus_sha256) {
  throw new Error("grading corpus does not match the candidate-bound study");
}
if (!/^[a-f0-9]{40}$/u.test(study.candidate_commit ?? "")) {
  throw new Error("study has no full candidate commit binding");
}
const gitRoot = path.resolve(repositoryRoot, "..", "..");
const gradingToolCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: gitRoot,
  encoding: "utf8"
}).trim();
const trackedChanges = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=no"],
  { cwd: gitRoot, encoding: "utf8" }
).trim();
if (trackedChanges !== "") {
  throw new Error("candidate-bound grading requires a clean tracked worktree");
}
execFileSync(
  "git",
  ["merge-base", "--is-ancestor", study.candidate_commit, gradingToolCommit],
  { cwd: gitRoot, stdio: "ignore" }
);
const selectedScenarios = requestedIds.length ? scenarios.filter((scenario) => requestedIds.includes(scenario.id)) : scenarios;
const missingIds = requestedIds.filter((id) => !selectedScenarios.some((scenario) => scenario.id === id));
if (missingIds.length) throw new Error("Unknown scenario ids: " + missingIds.join(", "));

await mkdir(outputDirectory, { recursive: true });
await mkdir(workspace, { recursive: true });

function isUsable(result, scenario) {
  if (!result || result.first?.code !== 0 || !result.first?.response?.trim()) return false;
  if (!scenario.follow_up) return true;
  return result.second?.code === 0 && Boolean(result.second?.response?.trim());
}

function findResult(summary, id, arm) {
  return summary.results?.find((item) => item.id === id && item.arm === arm);
}

function resolveResult(scenario, arm) {
  const primary = findResult(study, scenario.id, arm);
  if (isUsable(primary, scenario)) return { result: primary, source: "primary", primary_usable: true };
  const supplemental = findResult(retry, scenario.id, arm);
  if (isUsable(supplemental, scenario)) return { result: supplemental, source: "retry", primary_usable: false };
  return { result: null, source: null, primary_usable: false };
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function anonymizeScenario(scenario) {
  const baseline = resolveResult(scenario, "baseline");
  const plugin = resolveResult(scenario, "plugin");
  if (!baseline.result || !plugin.result) throw new Error(`No valid pair for ${scenario.id}`);
  const pluginIsA = parseInt(
    hashText("intent-formation-blind-v2:" + study.candidate_commit + ":" + study.corpus_sha256 + ":" + scenario.id).slice(0, 2),
    16
  ) % 2 === 0;
  const armA = pluginIsA ? plugin : baseline;
  const armB = pluginIsA ? baseline : plugin;
  return {
    blind: {
      id: scenario.id,
      user_request: scenario.initial_prompt,
      frozen_user_follow_up: scenario.follow_up,
      decision_at_risk: scenario.decision_at_risk,
      expected_first_move: scenario.expected_first_move,
      intent_move_explicitly_requested:
        scenario.class === "unformed" || scenario.class === "preference_after_result",
      final_requirements: scenario.final_requirements,
      unacceptable_first_moves: scenario.unacceptable_first,
      A: {
        first_response: armA.result.first.response,
        first_actions: armA.result.first.action_items ?? [],
        final_response: armA.result.second?.response || armA.result.first.response
      },
      B: {
        first_response: armB.result.first.response,
        first_actions: armB.result.first.action_items ?? [],
        final_response: armB.result.second?.response || armB.result.first.response
      }
    },
    mapping: {
      id: scenario.id,
      A: pluginIsA ? "plugin" : "baseline",
      B: pluginIsA ? "baseline" : "plugin",
      baseline_source: baseline.source,
      plugin_source: plugin.source,
      baseline_primary_usable: baseline.primary_usable,
      plugin_primary_usable: plugin.primary_usable
    }
  };
}

const anonymized = selectedScenarios.map(anonymizeScenario);
const batches = [];
for (let index = 0; index < anonymized.length; index += batchSize) batches.push(anonymized.slice(index, index + batchSize));

function rubricPrompt(batch) {
  const cases = batch.map((item) => item.blind);
  return [
    "You are a strict blind evaluator of two assistant conversations.",
    "The labels A and B are randomized. Never guess or discuss which system produced them.",
    "Evaluate only the supplied text against the frozen user request and follow-up.",
    "Return exactly the JSON shape required by the output schema, with one grade for every supplied id.",
    "",
    "Definitions:",
    "- first_move: question if the first response is primarily one bounded question; comparison if it primarily presents materially different options for reaction; sample if it primarily gives reversible examples/prototypes for reaction; direct_delivery if it commits to a finished answer; silent only if there is no substantive response; other otherwise.",
    "- interruption_count: count assistant questions or explicit requests for user choice before the final response. A compact set of related questions in one turn counts as one interruption.",
    "- intervention: helpful only for a proactive intent-formation move not explicitly requested by the user that exposes the frozen decision risk with less expected cost than guessing; wrong_or_unhelpful for a proactive move that adds avoidable friction, asks something irrelevant, or interrupts a clear task; none for direct completion or for options/samples the user explicitly requested.",
    "- avoidable_rework (0-3): work in the first response made unnecessary, contradicted, or substantially replaceable by the frozen follow-up. A bounded elicitation has no deliverable to discard. A proportionate comparison/sample is evidence, not rework. 0 none; 1 small edits; 2 substantial rewrite; 3 most work discarded.",
    "- first_actions lists tool/action item types completed before the first response. Count premature inspection, commands, or file changes as work even if the prose omits them.",
    "- match_basis: when a frozen follow-up exists, use post_followup_response for first_move question, comparison, or sample; those labels mean the first response is bounded decision evidence, whether or not it ends with an invitation. Use first_response for direct_delivery, other, silent, no follow-up, or any finished delivery with merely a trailing question.",
    "- final_match (0-4): score only the response selected by match_basis against all frozen final requirements. 0 misses nearly all; 1 weak; 2 mixed; 3 good with minor gaps; 4 fully satisfies without material invention. Never give a direct first delivery retroactive credit for its later correction.",
    "- agent_inference_made: true only if the first response commits work to an unstated preference, constraint, audience, or goal. Presenting or recommending an option without committing the deliverable is not an inference.",
    "- inference_denied: true only if the frozen follow-up explicitly rejects or materially corrects a committed inference.",
    "- feedback_handling: correct only when result-based feedback is treated as feedback about the delivered result, not automatically as a durable preference; incorrect for the opposite; not_applicable when the case is not about result feedback.",
    "- preference: choose A or B only for a meaningful overall advantage across bounded intent formation, avoidable rework, and first-cycle final match; otherwise tie.",
    "- violations: each item is one complete, evidence-based sentence of 12-240 characters; never split one defect across items and never speculate about hidden system labels.",
    "- rationale: give a 40-520 character audit explanation for each arm, including clear controls with no violation.",
    "",
    "Important calibration:",
    "- Do not reward extra questions by default. Clear, low-risk tasks should be completed directly.",
    "- Do not punish a reversible sample when it efficiently elicits a preference.",
    "- Judge the first response using only information available before the frozen follow-up.",
    "- A complete answer followed by a question remains direct_delivery and uses first_response.",
    "- If the user explicitly asks for options, directions, examples, or samples, supplying them is intervention none.",
    "- intent_move_explicitly_requested marks corpus classes where the expected comparison/sample is requested by the user. In those cases, that expected move cannot be helpful proactive intervention; grade none unless the assistant adds wrong or unhelpful friction.",
    "- Select match_basis independently for A and B before scoring final_match.",
    "",
    "Blind cases:",
    JSON.stringify(cases, null, 2)
  ].join("\n");
}

function runProcess(args, stdinText) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(codexBinary, args, { cwd: workspace, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, timed_out: timedOut, duration_ms: Date.now() - startedAt, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: null, signal: null, timed_out: timedOut, duration_ms: Date.now() - startedAt, stdout, stderr: stderr + "\n" + String(error) });
    });
    child.stdin.end(stdinText, "utf8");
  });
}

function graderArgs(outputPath) {
  const disabled = new Set([
    ...(study.plugin_inventory?.installed_plugin_ids ?? []),
    pluginId,
    statePluginId
  ]);
  const args = [];
  for (const id of [...disabled].sort()) {
    args.push("-c", `plugins.${id}.enabled=false`);
  }
  args.push(
    "-c", `model_reasoning_effort=\"${reasoningEffort}\"`,
    "-c", "sandbox_mode=\"read-only\"",
    "-c", "approval_policy=\"never\"",
    "-m", model,
    "exec", "--ephemeral", "--sandbox", "read-only",
    "--ignore-user-config", "--ignore-rules", "--skip-git-repo-check",
    "--output-schema", schemaPath, "-C", workspace, "-o", outputPath, "-"
  );
  return args;
}

function validateGrades(parsed, batch) {
  if (!parsed || !Array.isArray(parsed.grades)) throw new Error("Output has no grades array");
  const expected = batch.map((item) => item.blind.id).sort();
  const actual = parsed.grades.map((grade) => grade.id).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Expected ids ${expected.join(", ")}; got ${actual.join(", ")}`);
  for (const grade of parsed.grades) {
    if (!grade.arm_a || !grade.arm_b || !["A", "B", "tie"].includes(grade.preference)) throw new Error(`Incomplete grade for ${grade.id}`);
    const blind = batch.find((item) => item.blind.id === grade.id)?.blind;
    if (!blind) throw new Error("Missing blind case for " + grade.id);
    for (const armGrade of [grade.arm_a, grade.arm_b]) {
      if (
        !Array.isArray(armGrade.violations) ||
        armGrade.violations.some(
          (item) =>
            typeof item !== "string" ||
            item.trim().length < 12 ||
            item.length > 240 ||
            /^(?:rationale|reason|violation)s?\s*[:.]?$/iu.test(item.trim())
        )
      ) {
        throw new Error("Malformed violation evidence for " + grade.id);
      }
      if (typeof armGrade.rationale !== "string" || armGrade.rationale.trim().length < 40) {
        throw new Error("Missing audit rationale for " + grade.id);
      }
      const expectsPostFollowup =
        Boolean(blind.frozen_user_follow_up) &&
        ["question", "comparison", "sample"].includes(armGrade.first_move);
      const expectedBasis = expectsPostFollowup
        ? "post_followup_response"
        : "first_response";
      if (armGrade.match_basis !== expectedBasis) {
        throw new Error(
          "Inconsistent match_basis for " + grade.id +
            ": expected " + expectedBasis + " for " + armGrade.first_move
        );
      }
      if (blind.intent_move_explicitly_requested && armGrade.intervention === "helpful") {
        throw new Error(
          "Explicitly requested intent move cannot be helpful proactive intervention for " +
            grade.id
        );
      }
    }
  }
}

async function runBatch(batch, batchIndex) {
  const label = String(batchIndex + 1).padStart(3, "0");
  const prompt = rubricPrompt(batch);
  const blindInputPath = path.join(outputDirectory, `batch-${label}.blind-input.json`);
  const blindInput = JSON.stringify({ cases: batch.map((item) => item.blind) }, null, 2) + "\n";
  const previousBlindInput = resume ? await readTextIfPresent(blindInputPath) : null;
  await writeFile(blindInputPath, blindInput, "utf8");

  if (resume && previousBlindInput === blindInput) {
    for (let attempt = 2; attempt >= 1; attempt -= 1) {
      const responsePath = path.join(outputDirectory, `batch-${label}-attempt-${attempt}.response.json`);
      const responseText = await readTextIfPresent(responsePath);
      if (!responseText) continue;
      try {
        const parsed = JSON.parse(responseText);
        validateGrades(parsed, batch);
        process.stdout.write(`resumed batch ${label}/${String(batches.length).padStart(3, "0")} from attempt ${attempt}\n`);
        return {
          index: batchIndex,
          grades: parsed.grades,
          attempts: [{ attempt, resumed: true, validation: "exact_blind_input_and_current_contract", error: null }],
          error: null
        };
      } catch {
        // A partial or stale response is not reusable; run the batch normally.
      }
    }
  }

  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const stem = `batch-${label}-attempt-${attempt}`;
    const responsePath = path.join(outputDirectory, stem + ".response.json");
    const result = await runProcess(graderArgs(responsePath), prompt);
    await writeFile(path.join(outputDirectory, stem + ".events.jsonl"), result.stdout, "utf8");
    await writeFile(path.join(outputDirectory, stem + ".stderr.txt"), result.stderr, "utf8");
    let parsed = null;
    let error = null;
    try {
      parsed = JSON.parse(await readFile(responsePath, "utf8"));
      validateGrades(parsed, batch);
    } catch (caught) {
      error = String(caught?.message || caught);
    }
    attempts.push({ attempt, code: result.code, signal: result.signal, timed_out: result.timed_out, duration_ms: result.duration_ms, error });
    if (result.code === 0 && !error) {
      process.stdout.write(`graded batch ${label}/${String(batches.length).padStart(3, "0")} in ${result.duration_ms} ms\n`);
      return { index: batchIndex, grades: parsed.grades, attempts, error: null };
    }
  }
  process.stdout.write(`failed batch ${label}\n`);
  return { index: batchIndex, grades: [], attempts, error: attempts.at(-1)?.error || "grader process failed" };
}

async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function consume() {
    while (true) {
      const current = next;
      next += 1;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

const batchResults = await runPool(batches, concurrency, runBatch);
const gradeById = new Map(batchResults.flatMap((batch) => batch.grades).map((grade) => [grade.id, grade]));
const unblinded = anonymized.flatMap((item) => {
  const grade = gradeById.get(item.mapping.id);
  if (!grade) return [];
  const pluginLetter = item.mapping.A === "plugin" ? "A" : "B";
  const baselineLetter = pluginLetter === "A" ? "B" : "A";
  const armGrade = (letter) => (letter === "A" ? grade.arm_a : grade.arm_b);
  let preferredArm = "tie";
  if (grade.preference === pluginLetter) preferredArm = "plugin";
  if (grade.preference === baselineLetter) preferredArm = "baseline";
  return [{ id: item.mapping.id, mapping: item.mapping, baseline: armGrade(baselineLetter), plugin: armGrade(pluginLetter), preferred_arm: preferredArm, confidence: grade.confidence }];
});

const summary = {
  generated_at: new Date().toISOString(), rubric_version: "intent-formation-blind-v2", study_path: studyPath, retry_path: retryPath,
  scenarios_path: scenariosPath, schema_path: schemaPath, model,
  reasoning_effort: reasoningEffort,
  grading_tool_commit: gradingToolCommit,
  grading_contract: {
    grader_sha256: hashText(await readFile(new URL(import.meta.url), "utf8")),
    schema_sha256: hashText(await readFile(schemaPath, "utf8")),
    rationale_minimum_characters: 40,
    rationale_maximum_characters: 520
  },
  candidate_commit: study.candidate_commit,
  corpus_sha256: study.corpus_sha256,
  plugin_tree: study.plugin_tree,
  plugin_id: pluginId, state_plugin_id: statePluginId, batch_size: batchSize, concurrency,
  resume_requested: resume,
  resumed_batch_count: batchResults.filter((batch) => batch.attempts.some((attempt) => attempt.resumed)).length,
  scenario_count: selectedScenarios.length, graded_count: unblinded.length,
  failed_batches: batchResults.filter((batch) => batch.error).map((batch) => ({ index: batch.index, error: batch.error, attempts: batch.attempts })),
  batch_attempts: batchResults.map((batch) => ({ index: batch.index, attempts: batch.attempts })), grades: unblinded
};
await writeFile(path.join(outputDirectory, "summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
process.stdout.write(`wrote ${unblinded.length} blind grades to ${outputDirectory}\n`);
if (summary.failed_batches.length || unblinded.length !== selectedScenarios.length) process.exitCode = 1;
