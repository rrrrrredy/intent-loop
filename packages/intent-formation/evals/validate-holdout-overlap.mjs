import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const holdoutPath = "packages/intent-formation/evals/holdout-80.jsonl";
const candidatePath = path.resolve(repositoryRoot, process.argv[2] ?? holdoutPath);
const fileSources = [
  ["retired-v5-holdout", "packages/intent-formation/evals/retired/holdout-80-v5.jsonl"],
  ["development-study-80", "packages/intent-formation/evals/study-80.jsonl"],
  ["development-scenarios", "packages/intent-formation/evals/scenarios.jsonl"],
  ["development-semantic-smoke", "packages/intent-formation/evals/semantic-smoke.jsonl"],
  ["development-latency", "packages/intent-formation/evals/latency-probes.jsonl"],
  ["development-host-regressions", "packages/intent-formation/evals/host-regressions.jsonl"],
  ["development-post-failure", "packages/intent-formation/evals/post-failure-regressions.jsonl"],
  ["development-post-v5", "packages/intent-formation/evals/post-v5-development.jsonl"],
  ["ablation-16", "packages/intent-formation/evals/retired/ablation-16.jsonl"],
  ["ablation-confirm-16", "packages/intent-formation/evals/retired/ablation-confirm-16.jsonl"]
];
const historicalSources = [
  ["retired-holdout-at-bae8e03", "bae8e03"],
  ["retired-holdout-at-fcba88e", "fcba88e"],
  ["retired-holdout-v5-at-fca68c5", "fca68c5"]
];

function parseJsonl(raw, label) {
  const records = raw.split(/\r?\n/u).filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} line ${index + 1}: ${error.message}`);
    }
  });
  return records;
}

function normalize(value) {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/gu, " ").trim();
}

function scenarioText(scenario) {
  return [
    scenario.initial_prompt,
    ...(scenario.turns ?? []),
    ...(scenario.final_requirements ?? []),
    ...(scenario.unacceptable_first ?? []),
    scenario.decision_at_risk,
    scenario.representative_result,
    scenario.follow_up
  ].filter((value) => typeof value === "string").join(" ");
}

function tokenSet(value) {
  return new Set(normalize(value).match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? []);
}

function gramSet(value) {
  const normalized = normalize(value);
  const result = new Set();
  if (normalized.length < 4) {
    if (normalized.length > 0) result.add(normalized);
    return result;
  }
  for (let index = 0; index <= normalized.length - 4; index += 1) {
    result.add(normalized.slice(index, index + 4));
  }
  return result;
}

function intersectionSize(left, right) {
  const [small, large] = left.size <= right.size ? [left, right] : [right, left];
  let count = 0;
  for (const item of small) if (large.has(item)) count += 1;
  return count;
}

function similarity(left, right) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const tokenIntersection = intersectionSize(leftTokens, rightTokens);
  const tokenUnion = leftTokens.size + rightTokens.size - tokenIntersection;
  const leftGrams = gramSet(left);
  const rightGrams = gramSet(right);
  const gramIntersection = intersectionSize(leftGrams, rightGrams);
  return {
    token_set_jaccard: tokenUnion === 0 ? 1 : tokenIntersection / tokenUnion,
    character_four_gram_dice:
      leftGrams.size + rightGrams.size === 0
        ? 1
        : (2 * gramIntersection) / (leftGrams.size + rightGrams.size)
  };
}

async function loadFileSource(label, sourcePath) {
  const absolute = path.isAbsolute(sourcePath) ? sourcePath : path.join(repositoryRoot, sourcePath);
  const raw = await readFile(absolute, "utf8");
  return {
    label,
    sha256: createHash("sha256").update(raw, "utf8").digest("hex"),
    records: parseJsonl(raw, label)
  };
}

function loadHistoricalSource(label, commit) {
  const raw = execFileSync("git", ["show", `${commit}:${holdoutPath}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  });
  return {
    label,
    sha256: createHash("sha256").update(raw, "utf8").digest("hex"),
    records: parseJsonl(raw, label)
  };
}

const candidateRaw = await readFile(candidatePath, "utf8");
const candidate = parseJsonl(candidateRaw, "candidate-v6");
const sources = [];
for (const [label, sourcePath] of fileSources) sources.push(await loadFileSource(label, sourcePath));
for (const [label, commit] of historicalSources) sources.push(loadHistoricalSource(label, commit));

let internalMax = { token_set_jaccard: -1, character_four_gram_dice: -1, pair: [] };
let crossMax = { token_set_jaccard: -1, token_pair: [], character_four_gram_dice: -1, gram_pair: [] };
const violations = [];

function consider(left, right, sourceLabel, internal) {
  const scores = similarity(scenarioText(left), scenarioText(right));
  if (internal) {
    if (scores.token_set_jaccard > internalMax.token_set_jaccard) {
      internalMax.token_set_jaccard = scores.token_set_jaccard;
      internalMax.pair = [left.id, right.id];
    }
    if (scores.character_four_gram_dice > internalMax.character_four_gram_dice) {
      internalMax.character_four_gram_dice = scores.character_four_gram_dice;
    }
  } else {
    if (scores.token_set_jaccard > crossMax.token_set_jaccard) {
      crossMax.token_set_jaccard = scores.token_set_jaccard;
      crossMax.token_pair = [left.id, `${sourceLabel}:${right.id ?? "unnamed"}`];
    }
    if (scores.character_four_gram_dice > crossMax.character_four_gram_dice) {
      crossMax.character_four_gram_dice = scores.character_four_gram_dice;
      crossMax.gram_pair = [left.id, `${sourceLabel}:${right.id ?? "unnamed"}`];
    }
  }
  if (scores.token_set_jaccard >= 0.65 || scores.character_four_gram_dice >= 0.72) {
    violations.push({
      candidate_id: left.id,
      source: sourceLabel,
      source_id: right.id ?? "unnamed",
      token_set_jaccard: scores.token_set_jaccard,
      character_four_gram_dice: scores.character_four_gram_dice
    });
  }
}

for (let left = 0; left < candidate.length; left += 1) {
  for (let right = left + 1; right < candidate.length; right += 1) {
    consider(candidate[left], candidate[right], "candidate-v6", true);
  }
  for (const source of sources) {
    for (const prior of source.records) consider(candidate[left], prior, source.label, false);
  }
}

const report = {
  candidate_sha256: createHash("sha256").update(candidateRaw, "utf8").digest("hex"),
  candidate_bytes: Buffer.byteLength(candidateRaw, "utf8"),
  candidate_count: candidate.length,
  source_counts: Object.fromEntries(sources.map(({ label, records }) => [label, records.length])),
  source_sha256: Object.fromEntries(sources.map(({ label, sha256 }) => [label, sha256])),
  internal_maximum: internalMax,
  cross_corpus_maximum: crossMax,
  thresholds: { token_set_jaccard: 0.65, character_four_gram_dice: 0.72 },
  threshold_violations: violations
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
if (violations.length > 0) process.exitCode = 1;
