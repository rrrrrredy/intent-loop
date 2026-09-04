import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const workspace = path.resolve(option("--workspace", path.join(repositoryRoot, ".tmp", "pilot-workspace")));
const outputDirectory = path.resolve(option("--output", path.join(repositoryRoot, ".tmp", "pilot-results")));
const scenariosPath = path.resolve(
  repositoryRoot,
  option("--scenarios", path.join("evals", "scenarios.jsonl"))
);
const concurrency = Number(option("--concurrency", "2"));
const codexBinary = process.env.CODEX_BIN || "codex";
const arm = option("--arm", "plugin");
const model = option("--model", "");
const bypassHookTrust = process.argv.includes("--bypass-hook-trust");
const firstTurnOnly = process.argv.includes("--first-turn-only");
const pluginId = option("--plugin-id", "intent-formation@intent-loop");
const statePluginId = option("--state-plugin-id", "intent-formation-state@intent-loop");
const pluginConfigKey = `plugins.${pluginId}.enabled=`;
const statePluginOverride = `plugins.${statePluginId}.enabled=false`;
const requestedIds = option("--ids", "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) {
  throw new Error("--concurrency must be an integer from 1 to 4");
}
if (!["baseline", "plugin", "paired"].includes(arm)) {
  throw new Error("--arm must be baseline, plugin, or paired");
}
if (arm === "paired" && concurrency !== 1) {
  throw new Error("--arm paired requires --concurrency 1 so each AB/BA pair stays ordered");
}

const rawScenarios = await readFile(scenariosPath, "utf8");
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

await mkdir(workspace, { recursive: true });
await mkdir(outputDirectory, { recursive: true });

async function prepareWorkspace(scenario) {
  const scenarioWorkspace = path.join(workspace, scenario.id);
  await mkdir(path.join(scenarioWorkspace, "tests"), { recursive: true });
  await Promise.all([
    writeFile(path.join(scenarioWorkspace, "README.md"), "# Setup\n\nFixture project.\n", "utf8"),
    writeFile(
      path.join(scenarioWorkspace, "package.json"),
      JSON.stringify(
        {
          name: "intent-formation-pilot-fixture",
          private: true,
          type: "module",
          scripts: { test: "node --test" }
        },
        null,
        2
      ) + "\n",
      "utf8"
    ),
    writeFile(
      path.join(scenarioWorkspace, "parse-user.mjs"),
      [
        "export function parseUser(value) {",
        "  return { name: value.name.trim() };",
        "}",
        ""
      ].join("\n"),
      "utf8"
    ),
    writeFile(
      path.join(scenarioWorkspace, "tests", "parse-user.test.mjs"),
      [
        "import assert from \"node:assert/strict\";",
        "import test from \"node:test\";",
        "import { parseUser } from \"../parse-user.mjs\";",
        "",
        "test(\"parses a user\", () => {",
        "  assert.deepEqual(parseUser({ name: \" Ada \" }), { name: \"Ada\" });",
        "});",
        ""
      ].join("\n"),
      "utf8"
    )
  ]);
  return scenarioWorkspace;
}

function scenarioTurns(scenario) {
  if (Array.isArray(scenario.turns) && scenario.turns.length > 0) {
    return firstTurnOnly ? [scenario.turns[0]] : scenario.turns;
  }
  if (typeof scenario.initial_prompt === "string" && scenario.initial_prompt.trim()) {
    return scenario.follow_up && !firstTurnOnly
      ? [scenario.initial_prompt, scenario.follow_up]
      : [scenario.initial_prompt];
  }
  throw new Error(`Scenario ${scenario.id ?? "<unknown>"} has no usable prompt`);
}

function buildPrompt(scenario) {
  const turns = scenarioTurns(scenario);
  if (turns.length === 1) {
    return turns[0];
  }

  return [
    "Continue this existing task conversation from the user's latest message.",
    "User: " + turns[0],
    "Assistant: " +
      (typeof scenario.representative_result === "string"
        ? scenario.representative_result
        : "[A representative result was delivered for that request.]"),
    "User: " + turns[1]
  ].join("\n");
}

async function runScenario(scenario, runArm = arm) {
  const scenarioWorkspace = await prepareWorkspace(scenario);
  return new Promise((resolve) => {
    const armSuffix = arm === "paired" ? "." + runArm : "";
    const outputPath = path.join(outputDirectory, scenario.id + armSuffix + ".txt");
    const startedAt = Date.now();
    const args = [
      "-c",
      pluginConfigKey + (runArm === "plugin" ? "true" : "false"),
      "-c",
      statePluginOverride,
      "exec"
    ];
    if (model) {
      args.push("-m", model);
    }
    args.push("--ephemeral");
    if (bypassHookTrust) {
      args.push("--dangerously-bypass-hook-trust");
    }
    args.push(
      "--json",
      "-s",
      "workspace-write",
      "--skip-git-repo-check",
      "-C",
      scenarioWorkspace,
      "-o",
      outputPath,
      buildPrompt(scenario)
    );
    const child = spawn(
      codexBinary,
      args,
      {
        cwd: scenarioWorkspace,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    const timeout = setTimeout(() => child.kill(), 180_000);

    child.on("close", async (code, signal) => {
      clearTimeout(timeout);
      let response = "";
      try {
        response = await readFile(outputPath, "utf8");
      } catch {
        response = "";
      }

      await writeFile(
        path.join(outputDirectory, scenario.id + armSuffix + ".events.jsonl"),
        stdout,
        "utf8"
      );
      resolve({
        id: scenario.id,
        arm: runArm,
        expected_move: scenario.expected_move ?? scenario.expected_first_move,
        code,
        signal,
        duration_ms: Date.now() - startedAt,
        response,
        stderr
      });
    });
  });
}

const runs = arm === "paired"
  ? scenarios.flatMap((scenario, index) => {
      const order = index % 2 === 0
        ? ["baseline", "plugin"]
        : ["plugin", "baseline"];
      return order.map((runArm) => ({ scenario, runArm }));
    })
  : scenarios.map((scenario) => ({ scenario, runArm: arm }));
const results = new Array(runs.length);
let nextIndex = 0;

async function worker() {
  while (nextIndex < runs.length) {
    const index = nextIndex++;
    const { scenario, runArm } = runs[index];
    results[index] = await runScenario(scenario, runArm);
    process.stdout.write(
      results[index].id + " [" + results[index].arm + "]: exit=" + results[index].code +
      " duration=" + results[index].duration_ms + "ms\n"
    );
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
await writeFile(
  path.join(outputDirectory, "summary.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      codex_binary: codexBinary,
      arm,
      model: model || null,
      hook_trust: bypassHookTrust ? "automation-bypass" : "reviewed-host-state",
      first_turn_only: firstTurnOnly,
      plugin_id: pluginId,
      state_plugin_id: statePluginId,
      scenarios_path: scenariosPath,
      workspace,
      results
    },
    null,
    2
  ),
  "utf8"
);

if (results.some((result) => result.code !== 0 || !result.response.trim())) {
  process.exitCode = 1;
}
