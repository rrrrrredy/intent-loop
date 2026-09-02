import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { summarizeCodexEvents } from "./codex-event-summary.mjs";
import { gitArchiveFingerprint, sha256, treeFingerprint } from "./fingerprint.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const scenariosPath = path.resolve(
  repositoryRoot,
  option("--scenarios", path.join("evals", "holdout-80.jsonl"))
);
const workspace = path.resolve(
  option("--workspace", path.join(repositoryRoot, ".tmp", "holdout-workspaces"))
);
const outputDirectory = path.resolve(
  option("--output", path.join(repositoryRoot, ".tmp", "holdout-results"))
);
const requestedArm = option("--arm", "both");
const concurrency = Number(option("--concurrency", "4"));
const timeoutMs = Number(option("--timeout-ms", "180000"));
const model = option("--model", "");
const reasoningEffort = option("--reasoning-effort", "");
const candidateCommit = option("--candidate-commit", "");
const codexBinary = process.env.CODEX_BIN || "codex";
const pluginId = option("--plugin-id", "intent-formation@intent-loop");
const statePluginId = option("--state-plugin-id", "intent-formation-state@intent-loop");
const pluginConfigKey = `plugins.${pluginId}.enabled=`;
const statePluginOverride = `plugins.${statePluginId}.enabled=false`;
const gitRoot = path.resolve(repositoryRoot, "..", "..");
const pluginRoot = path.resolve(
  option("--plugin-root", path.join(gitRoot, "plugins", "intent-formation"))
);
const inventoryPath = path.resolve(option("--plugin-inventory", ""));
const requestedIds = option("--ids", "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!["baseline", "plugin", "both"].includes(requestedArm)) {
  throw new Error("--arm must be baseline, plugin, or both");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("--concurrency must be an integer from 1 to 4");
}
if (!Number.isInteger(timeoutMs) || timeoutMs < 10000) {
  throw new Error("--timeout-ms must be an integer of at least 10000");
}
if (!model) throw new Error("--model is required for candidate-bound evidence");
if (!new Set(["low", "medium", "high", "xhigh"]).has(reasoningEffort)) {
  throw new Error("--reasoning-effort must be low, medium, high, or xhigh");
}
if (!/^[a-f0-9]{40}$/u.test(candidateCommit)) {
  throw new Error("--candidate-commit must be a full Git commit id");
}
if (option("--plugin-inventory", "") === "") {
  throw new Error("--plugin-inventory is required");
}
if (!process.env.CODEX_HOME?.trim()) {
  throw new Error("CODEX_HOME must point to a dedicated evaluation home");
}

const rawScenarios = await readFile(scenariosPath, "utf8");
const corpusSha256 = sha256(rawScenarios);
const allScenarios = rawScenarios
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const scenarios =
  requestedIds.length === 0
    ? allScenarios
    : allScenarios.filter((scenario) => requestedIds.includes(scenario.id));
const missingIds = requestedIds.filter(
  (id) => !scenarios.some((scenario) => scenario.id === id)
);
if (missingIds.length > 0) {
  throw new Error("Unknown scenario ids: " + missingIds.join(", "));
}

const actualCommit = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: gitRoot,
  encoding: "utf8"
}).trim();
if (actualCommit !== candidateCommit) {
  throw new Error(`candidate commit mismatch: expected ${candidateCommit}, found ${actualCommit}`);
}
const trackedChanges = execFileSync(
  "git",
  ["status", "--porcelain", "--untracked-files=no"],
  { cwd: gitRoot, encoding: "utf8" }
).trim();
if (trackedChanges !== "") {
  throw new Error("candidate-bound study requires a clean tracked worktree");
}
const pluginTree = await treeFingerprint(pluginRoot);
const isolationMarkerPath = path.join(
  path.resolve(process.env.CODEX_HOME),
  ".intent-formation-eval-home.json"
);
const isolationMarkerText = await readFile(isolationMarkerPath, "utf8");
const isolationMarker = JSON.parse(isolationMarkerText);
if (
  isolationMarker.purpose !== "intent-formation-candidate-evaluation" ||
  isolationMarker.candidate_commit !== candidateCommit ||
  isolationMarker.plugin_tree_sha256 !== pluginTree.sha256
) {
  throw new Error("evaluation-home marker does not match the candidate");
}
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
if (!Array.isArray(inventory.installed)) throw new Error("plugin inventory is invalid");
const installedPluginIds = inventory.installed.map((item) => item.pluginId).sort();
const installedCandidate = inventory.installed.find((item) => item.pluginId === pluginId);
if (!installedCandidate) {
  throw new Error("the candidate core plugin is not installed in the evaluation home");
}
if (
  installedCandidate.source?.source !== "local" ||
  path.resolve(installedCandidate.source.path ?? "") !== pluginRoot
) {
  throw new Error("the installed core plugin path does not match --plugin-root");
}
const disabledPluginIds = installedPluginIds.filter((id) => id !== pluginId);
if (!disabledPluginIds.includes(statePluginId)) disabledPluginIds.push(statePluginId);
disabledPluginIds.sort();
const codexCliVersion = execFileSync(codexBinary, ["--version"], {
  encoding: "utf8",
  env: process.env
}).trim();
const candidateArchive = gitArchiveFingerprint(
  gitRoot,
  candidateCommit,
  "plugins/intent-formation"
);

const jobGroups = scenarios.map((scenario, index) => {
  const orderedArms =
    requestedArm === "both"
      ? index % 2 === 0
        ? ["baseline", "plugin"]
        : ["plugin", "baseline"]
      : [requestedArm];
  return orderedArms.map((arm) => ({ scenario, arm }));
});

await mkdir(workspace, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

function pluginOverride(arm) {
  return pluginConfigKey + (arm === "plugin" ? "true" : "false");
}

function parseEvents(stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) {
      continue;
    }
    try {
      events.push(JSON.parse(line));
    } catch {
      // Preserve raw stdout separately; malformed console lines are not study events.
    }
  }
  return events;
}

function runProcess(args, runTimeoutMs = timeoutMs, workingDirectory = workspace, stdinText = null) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(codexBinary, args, {
      cwd: workingDirectory,
      env: process.env,
      stdio: [stdinText === null ? "ignore" : "pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, runTimeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        stdout,
        stderr
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        code: null,
        signal: null,
        timed_out: timedOut,
        duration_ms: Date.now() - startedAt,
        stdout,
        stderr: stderr + "\n" + String(error)
      });
    });
    if (stdinText !== null) child.stdin.end(stdinText, "utf8");
  });
}

async function readResponse(responsePath) {
  try {
    return await readFile(responsePath, "utf8");
  } catch {
    return "";
  }
}

function commonExecArgs(arm) {
  const args = [];
  for (const id of disabledPluginIds) {
    args.push("-c", `plugins.${id}.enabled=false`);
  }
  args.push(
    "-c", pluginOverride(arm),
    "-c", statePluginOverride,
    "-c", `model_reasoning_effort=\"${reasoningEffort}\"`,
    "-m", model,
    "exec",
    "--approve-for-me",
    "--dangerously-bypass-hook-trust",
    "--ignore-user-config",
    "--ignore-rules",
    "--skip-git-repo-check"
  );
  return args;
}

async function deleteThread(threadId) {
  if (!threadId) {
    return { code: null, stderr: "No thread id was emitted." };
  }
  const result = await runProcess(
    ["delete", "--force", threadId],
    Math.min(timeoutMs, 60000)
  );
  return {
    code: result.code,
    stderr: result.stderr.trim()
  };
}

async function runJob(job) {
  const scenario = job.scenario;
  const arm = job.arm;
  const prefix = arm + "-" + scenario.id;
  const jobWorkspace = path.join(workspace, prefix);
  await mkdir(jobWorkspace, { recursive: true });
  const firstPath = path.join(outputDirectory, prefix + "-first.txt");
  const secondPath = path.join(outputDirectory, prefix + "-second.txt");
  const firstArgs = commonExecArgs(arm).concat([
    "--json",
    "-C",
    jobWorkspace,
    "-o",
    firstPath,
    "-"
  ]);
  const first = await runProcess(firstArgs, timeoutMs, jobWorkspace, scenario.initial_prompt);
  const firstEvents = parseEvents(first.stdout);
  const firstEventSummary = summarizeCodexEvents(firstEvents);
  const firstResponse = await readResponse(firstPath);
  await writeFile(
    path.join(outputDirectory, prefix + "-first.events.jsonl"),
    first.stdout,
    "utf8"
  );
  await writeFile(
    path.join(outputDirectory, prefix + "-first.stderr.txt"),
    first.stderr,
    "utf8"
  );

  let second = null;
  let secondResponse = "";
  let secondEventSummary = {
    thread_id: null,
    mcp_tool_calls: [],
    action_items: [],
    diagnostic_items: []
  };
  if (
    scenario.follow_up &&
    first.code === 0 &&
    firstEventSummary.thread_id &&
    firstResponse.trim()
  ) {
    const secondArgs = commonExecArgs(arm).concat([
      "resume",
      "--json",
      "-o",
      secondPath,
      firstEventSummary.thread_id,
      "-"
    ]);
    second = await runProcess(secondArgs, timeoutMs, jobWorkspace, scenario.follow_up);
    const secondEvents = parseEvents(second.stdout);
    secondEventSummary = summarizeCodexEvents(secondEvents);
    secondResponse = await readResponse(secondPath);
    await writeFile(
      path.join(outputDirectory, prefix + "-second.events.jsonl"),
      second.stdout,
      "utf8"
    );
    await writeFile(
      path.join(outputDirectory, prefix + "-second.stderr.txt"),
      second.stderr,
      "utf8"
    );
  }

  const result = {
    id: scenario.id,
    class: scenario.class,
    arm,
    expected_first_move: scenario.expected_first_move,
    first: {
      code: first.code,
      signal: first.signal,
      timed_out: first.timed_out,
      duration_ms: first.duration_ms,
      response: firstResponse,
      prompt_sha256: sha256(scenario.initial_prompt),
      mcp_tool_calls: firstEventSummary.mcp_tool_calls,
      action_items: firstEventSummary.action_items,
      diagnostic_items: firstEventSummary.diagnostic_items
    },
    second:
      second === null
        ? null
        : {
            code: second.code,
            signal: second.signal,
            timed_out: second.timed_out,
            duration_ms: second.duration_ms,
            response: secondResponse,
            prompt_sha256: sha256(scenario.follow_up),
            mcp_tool_calls: secondEventSummary.mcp_tool_calls,
            action_items: secondEventSummary.action_items,
            diagnostic_items: secondEventSummary.diagnostic_items
          },
    total_duration_ms:
      first.duration_ms + (second === null ? 0 : second.duration_ms),
    thread_id: firstEventSummary.thread_id,
    thread_cleanup: null
  };
  await writeFile(
    path.join(outputDirectory, prefix + "-result.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  return result;
}

const resultGroups = new Array(jobGroups.length);
let nextIndex = 0;

async function worker() {
  while (nextIndex < jobGroups.length) {
    const index = nextIndex++;
    const groupResults = [];
    for (const job of jobGroups[index]) {
      const result = await runJob(job);
      groupResults.push(result);
      process.stdout.write(
        result.arm +
          "/" +
          result.id +
          ": first=" +
          result.first.code +
          " second=" +
          (result.second?.code ?? "-") +
          " total=" +
          result.total_duration_ms +
          "ms\n"
      );
    }
    resultGroups[index] = groupResults;
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
const results = resultGroups.flat();

for (const result of results) {
  result.thread_cleanup = await deleteThread(result.thread_id);
  await writeFile(
    path.join(outputDirectory, result.arm + "-" + result.id + "-result.json"),
    JSON.stringify(result, null, 2),
    "utf8"
  );
  process.stdout.write(
    "cleanup/" +
      result.arm +
      "/" +
      result.id +
      ": " +
      result.thread_cleanup.code +
      "\n"
  );
}

const summary = {
  generated_at: new Date().toISOString(),
  design: {
    pairing: requestedArm === "both" ? "within-scenario" : "single-arm",
    pair_order: requestedArm === "both" ? "alternating AB/BA" : null,
    arms_within_pair: "sequential",
    pair_worker_concurrency: concurrency,
    turn_timeout_ms: timeoutMs,
    primary_run_retry_policy: "none"
  },
  scenarios_path: scenariosPath,
  workspace,
  corpus_sha256: corpusSha256,
  requested_arm: requestedArm,
  plugin_id: pluginId,
  state_plugin_id: statePluginId,
  model,
  reasoning_effort: reasoningEffort,
  candidate_commit: candidateCommit,
  host: {
    platform: process.platform,
    arch: process.arch,
    node: process.version
  },
  codex_cli_version: codexCliVersion,
  plugin_tree: pluginTree,
  candidate_archive: candidateArchive,
  plugin_inventory: {
    installed_plugin_ids: installedPluginIds,
    disabled_plugin_ids: disabledPluginIds,
    active_plugin_id_by_arm: {
      baseline: null,
      plugin: pluginId
    }
  },
  isolation: {
    dedicated_codex_home: true,
    ignore_user_config: true,
    ignore_rules: true,
    workspace_per_arm: true,
    user_prompts_verbatim: true,
    sandbox_base: "read-only",
    workspace_writes: "automatic review via --approve-for-me",
    approval_policy: "automatic-review",
    dangerous_approval_or_sandbox_bypass: false,
    hook_trust_bypass_after_package_review: true,
    marker_sha256: sha256(isolationMarkerText)
  },
  results
};
await writeFile(
  path.join(outputDirectory, "summary.json"),
  JSON.stringify(summary, null, 2),
  "utf8"
);

const failed = results.some(
  (result) =>
    result.first.code !== 0 ||
    !result.first.response.trim() ||
    (result.second !== null &&
      (result.second.code !== 0 || !result.second.response.trim())) ||
    result.thread_cleanup.code !== 0
);
if (failed) {
  process.exitCode = 1;
}
