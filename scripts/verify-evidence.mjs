import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  gitArchiveFingerprint,
  gitTreeFingerprint,
  sha256,
  treeFingerprint
} from "../packages/intent-formation/evals/fingerprint.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const developmentRoot = path.join(repositoryRoot, "evidence", "development-regression-v8");
const failedV6Root = path.join(repositoryRoot, "evidence", "failed-holdout-v6");
const postV6Root = path.join(repositoryRoot, "evidence", "post-v6-development");
const finalRoot = path.join(repositoryRoot, "evidence", "v0.3.0-beta.1");
const requireCandidate = process.argv.includes("--require-candidate");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function verifyArtifactHashes(root, manifest) {
  for (const [fileName, expected] of Object.entries(manifest.artifact_sha256)) {
    assert.equal(sha256(await readFile(path.join(root, fileName))), expected, `${fileName} hash drifted`);
  }
}

const developmentManifest = await readJson(path.join(developmentRoot, "manifest.json"));
assert.equal(developmentManifest.evidence_class, "development_regression");
assert.equal(developmentManifest.current_release_efficacy, false);
assert.equal(developmentManifest.release_gate_result, "NOT_APPLICABLE_TUNED_DEVELOPMENT_CORPUS");
await verifyArtifactHashes(developmentRoot, developmentManifest);
const developmentRuns = (await readFile(path.join(developmentRoot, "runs.jsonl"), "utf8"))
  .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
const developmentGrades = (await readFile(path.join(developmentRoot, "blind-grades.jsonl"), "utf8"))
  .trim().split(/\r?\n/u).map((line) => JSON.parse(line));
assert.equal(developmentRuns.length, 160);
assert.equal(developmentGrades.length, 80);

const failedV6Manifest = await readJson(path.join(failedV6Root, "manifest.json"));
assert.equal(failedV6Manifest.schema_version, 1);
assert.equal(failedV6Manifest.evidence_class, "failed_holdout_diagnostic");
assert.equal(failedV6Manifest.current_release_efficacy, false);
assert.equal(failedV6Manifest.decision, "STOP_AND_INVALID_FOR_EFFICACY");
assert.equal(failedV6Manifest.execution.primary_conversations, 160);
assert.equal(failedV6Manifest.execution.usable_primary_conversations, 160);
assert.equal(failedV6Manifest.grading.graded_pairs, 80);
assert.equal(failedV6Manifest.corpus.minimum_user_visibility_defects, 11);
assert.deepEqual(
  Object.entries(failedV6Manifest.gates)
    .filter(([, gate]) => gate.status === "FAIL")
    .map(([name]) => name)
    .sort(),
  ["clear_latency", "inference_denial", "proactive_wrong"]
);
for (const [fileName, expected] of Object.entries(
  failedV6Manifest.published_artifact_sha256
)) {
  assert.equal(
    sha256(await readFile(path.join(failedV6Root, fileName))),
    expected,
    `failed-v6 ${fileName} hash drifted`
  );
}
const failedV6Audit = await readJson(path.join(failedV6Root, "corpus-audit.json"));
assert.equal(failedV6Audit.corpus_sha256, failedV6Manifest.corpus.sha256);
assert.equal(failedV6Audit.minimum_defect_count, 11);
assert.equal(failedV6Audit.defects.length, 11);
assert.equal(new Set(failedV6Audit.defects.map(({ id }) => id)).size, 11);

const postV6 = await readJson(path.join(postV6Root, "manifest.json"));
assert.equal(postV6.evidence_class, "development_regression");
assert.equal(postV6.current_release_efficacy, false);
await verifyArtifactHashes(postV6Root, postV6);
const postV6Runs = (await readFile(path.join(postV6Root, "runs.jsonl"), "utf8"))
  .trim().split("\n").map(JSON.parse);
assert.equal(postV6Runs.length, postV6.trials.reduce((sum, trial) => sum + trial.first_turns, 0));
assert.equal(new Set(postV6.trials.map((trial) => trial.id)).size, postV6.trials.length);
for (const trial of postV6.trials) {
  const rows = postV6Runs.filter((row) => row.trial === trial.id);
  assert.equal(rows.length, trial.first_turns);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.equal(rows.filter((row) => row.second).length, trial.follow_ups);
  assert.equal(rows.filter((row) => row.thread_cleanup.exit_code === 0).length, trial.successful_cleanups);
  assert.equal(rows.filter((row) => row.first.exit_code !== 0 ||
    (row.second && row.second.exit_code !== 0) || row.thread_cleanup.exit_code !== 0).length, trial.operational_failures);
  assert.equal(Buffer.byteLength(trial.policy), trial.policy_bytes);
  assert.deepEqual(trial.installed_tree, trial.plugin_tree);
  assert.deepEqual(trial.git_tree, trial.plugin_tree);
  assert.deepEqual(gitTreeFingerprint(repositoryRoot, trial.candidate_commit, "plugins/intent-formation"), trial.plugin_tree);
}
const interruptedPostV6 = await readJson(path.join(postV6Root, "interrupted-run.json"));
assert.equal(interruptedPostV6.status, "INVALID_HOST_INTERRUPTED");
assert.equal(interruptedPostV6.efficacy_usable, false);
assert.equal(interruptedPostV6.operational_timing_usable, false);

const reviewRoot = path.join(repositoryRoot, "evidence", "independent-reviews");
const review = await readJson(path.join(reviewRoot, "manifest.json"));
assert.equal(review.current_release_efficacy, false);
assert.equal(review.chat_acceptance_completed, false);
await verifyArtifactHashes(reviewRoot, review);
for (const [relativePath, expected] of Object.entries(review.adversarial.source_and_generated_sha256)) {
  assert.equal(sha256(await readFile(path.join(repositoryRoot, relativePath))), expected, `reviewed file drifted: ${relativePath}`);
}
const localAcceptance = await readJson(path.join(reviewRoot, "local-acceptance-results-v7.json"));
assert.equal(localAcceptance.model_requests, 0);
assert.equal(localAcceptance.hook_trust_bypass_used, false);
assert.equal(localAcceptance.checks.length, 19);
assert.ok(localAcceptance.checks.every((check) => check.passed));
const reviewedInstall = await readJson(path.join(reviewRoot, "install-fingerprints-v7.json"));
for (const [plugin, fingerprints] of Object.entries(reviewedInstall.fingerprints)) {
  assert.deepEqual(fingerprints.source, fingerprints.installed);
  for (const file of fingerprints.source.files) {
    const bytes = await readFile(path.join(repositoryRoot, "plugins", plugin, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(sha256(bytes), file.sha256);
  }
}
const reviewCleanup = await readJson(path.join(reviewRoot, "cleanup-v7.json"));
assert.equal(reviewCleanup.isolated_home_exists, false);
assert.equal(reviewCleanup.live_workspace_exists, false);

if (!(await exists(finalRoot))) {
  if (requireCandidate) {
    throw new Error("candidate holdout evidence is required for a release");
  }
  process.stdout.write(
    "verified historical development, failed v6, and post-v6 artifact hashes; candidate holdout evidence pending\n"
  );
  process.exit(0);
}

const manifest = await readJson(path.join(finalRoot, "manifest.json"));
assert.equal(manifest.schema_version, 2);
assert.equal(manifest.evidence_class, "candidate_holdout");
assert.equal(manifest.product_version, "0.3.0-beta.1");
assert.equal(manifest.release_gate_result, "PASS_CANDIDATE_HOLDOUT");
assert.equal(manifest.corpus.scenario_count, 80);
assert.equal(manifest.execution.primary_conversations, 160);
assert.equal(manifest.execution.usable_primary_conversations, 160);
assert.equal(manifest.execution.primary_timeouts, 0);
assert.equal(manifest.execution.cleanup_failures, 0);
assert.equal(manifest.grading.failed_batches_after_retry, 0);
assert.ok(Object.values(manifest.gates).every((gate) => gate.status === "PASS"));

for (const [relativePath, expected] of Object.entries(manifest.source_sha256)) {
  assert.equal(
    sha256(await readFile(path.join(repositoryRoot, relativePath))),
    expected,
    `${relativePath} hash drifted`
  );
}
await verifyArtifactHashes(finalRoot, manifest);

const currentTree = await treeFingerprint(path.join(repositoryRoot, "plugins", "intent-formation"));
const pluginPathspec = "plugins/intent-formation";
assert.equal(
  execFileSync(
    "git",
    ["status", "--porcelain", "--untracked-files=all", "--", pluginPathspec],
    { cwd: repositoryRoot, encoding: "utf8" }
  ).trim(),
  "",
  "candidate plugin tree contains tracked changes or untracked files"
);
assert.deepEqual(currentTree, manifest.candidate_plugin_tree);
assert.deepEqual(manifest.executed_plugin_tree, manifest.candidate_plugin_tree);
const candidateGitTree = gitTreeFingerprint(
  repositoryRoot,
  manifest.candidate_commit,
  pluginPathspec
);
assert.deepEqual(candidateGitTree, manifest.candidate_git_tree);
assert.deepEqual(currentTree, candidateGitTree);
assert.deepEqual(
  gitArchiveFingerprint(repositoryRoot, manifest.candidate_commit, pluginPathspec),
  manifest.candidate_git_archive
);
execFileSync("git", ["merge-base", "--is-ancestor", manifest.candidate_commit, "HEAD"], {
  cwd: repositoryRoot,
  stdio: "ignore"
});

const runsText = await readFile(path.join(finalRoot, "runs.jsonl"), "utf8");
const gradesText = await readFile(path.join(finalRoot, "blind-grades.jsonl"), "utf8");
const analysisText = await readFile(path.join(finalRoot, "analysis.json"), "utf8");
const runs = runsText.trim().split(/\r?\n/u).map((line) => JSON.parse(line));
const grades = gradesText.trim().split(/\r?\n/u).map((line) => JSON.parse(line));
const analysis = JSON.parse(analysisText);
assert.equal(runs.length, 160);
assert.equal(grades.length, 80);
assert.equal(new Set(runs.map((run) => `${run.arm}:${run.id}`)).size, 160);
assert.equal(new Set(grades.map((grade) => grade.id)).size, 80);
assert.ok(runs.every((run) => run.first.exit_code === 0 && !run.first.timed_out));
assert.ok(runs.every((run) => !run.second || (run.second.exit_code === 0 && !run.second.timed_out)));
assert.ok(Object.values(analysis.gates).every((gate) => gate.status === "PASS"));
assert.equal(analysis.metrics.nonclear_premature_action_count, 0);

const publicEvidence = [JSON.stringify(manifest), runsText, gradesText, analysisText].join("\n");
assert.doesNotMatch(publicEvidence, /(?:\\\\\?\\)?\b[A-Za-z]:[\\/]/u);
assert.doesNotMatch(publicEvidence, /(^|\s)\/(?:Users|home|tmp|private|var\/folders)\//mu);
assert.doesNotMatch(publicEvidence, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
assert.doesNotMatch(publicEvidence, /\b01[a-f0-9]{6}-[a-f0-9-]{20,}\b/u);

process.stdout.write("verified candidate-bound holdout evidence: 160 runs, 80 blind grades, candidate and artifact hashes intact\n");
