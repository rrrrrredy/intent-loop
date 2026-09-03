import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  buildAnalysis,
  inspectPromptPrivacy,
  renderAnalysisMarkdown
} from "./analysis-core.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const studyPath = path.resolve(
  repositoryRoot,
  option("--study", path.join(".tmp", "holdout-results", "summary.json"))
);
const gradesPath = path.resolve(
  repositoryRoot,
  option("--grades", path.join(".tmp", "holdout-grades", "summary.json"))
);
const scenariosPath = path.resolve(
  repositoryRoot,
  option("--scenarios", path.join("evals", "holdout-80.jsonl"))
);
const outputDirectory = path.resolve(
  repositoryRoot,
  option("--output", path.join(".tmp", "holdout-analysis"))
);
const defaultStatePath = path.join(
  process.env.CODEX_HOME || path.join(repositoryRoot, ".tmp", "missing-eval-home"),
  "plugin-data",
  "intent-formation",
  "intent-events-v1.jsonl"
);
const statePath = path.resolve(option("--state", defaultStatePath));

const study = await readJson(studyPath);
const grading = await readJson(gradesPath);
const scenarios = (await readFile(scenariosPath, "utf8"))
  .split(/\r?\n/u)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
if (scenarios.length !== 80) {
  throw new Error(`Expected 80 scenarios, found ${scenarios.length}`);
}
const privacy = await inspectPromptPrivacy(statePath, scenarios);
const analysis = buildAnalysis({ study, grading, scenarios, privacy });
const markdown = renderAnalysisMarkdown(analysis);

await mkdir(outputDirectory, { recursive: true });
await writeFile(
  path.join(outputDirectory, "analysis.json"),
  JSON.stringify(analysis, null, 2) + "\n",
  "utf8"
);
await writeFile(path.join(outputDirectory, "analysis.md"), markdown, "utf8");
process.stdout.write(
  JSON.stringify(
    { decision: analysis.decision, gates: analysis.gates, output_directory: outputDirectory },
    null,
    2
  ) + "\n"
);
