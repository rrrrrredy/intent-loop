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
const failedV7Root = path.join(repositoryRoot, "evidence", "failed-holdout-v7");
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

const failedV7Manifest = await readJson(path.join(failedV7Root, "manifest.json"));
assert.equal(failedV7Manifest.evidence_class, "incomplete_primary_diagnostic");
assert.equal(failedV7Manifest.current_release_efficacy, false);
assert.equal(failedV7Manifest.release_gate_result, "NOT_ELIGIBLE_INCOMPLETE_PRIMARY");
await verifyArtifactHashes(failedV7Root, failedV7Manifest);
// Historical evidence binds to its executed commit, not a later repaired policy.
for (const [relativePath, expected] of Object.entries(failedV7Manifest.source_sha256)) {
  assert.equal(sha256(execFileSync("git", ["show", `${failedV7Manifest.candidate_commit}:${relativePath}`], {
    cwd: repositoryRoot
  })), expected, `failed-v7 source drifted: ${relativePath}`);
}
assert.deepEqual(gitTreeFingerprint(repositoryRoot, failedV7Manifest.candidate_commit,
  "plugins/intent-formation"), failedV7Manifest.candidate_plugin_tree);
const failedV7Runs = (await readFile(path.join(failedV7Root, "runs.jsonl"), "utf8"))
  .trim().split(/\r?\n/u).map(JSON.parse);
const failedV7Grades = (await readFile(path.join(failedV7Root, "blind-grades.jsonl"), "utf8"))
  .trim().split(/\r?\n/u).map(JSON.parse);
const failedV7Analysis = await readJson(path.join(failedV7Root, "analysis.json"));
const failedV7Failures = await readJson(path.join(failedV7Root, "failures.json"));
const failedV7Corpus = execFileSync("git", ["show",
  `${failedV7Manifest.candidate_commit}:${failedV7Manifest.corpus.path}`], {
  cwd: repositoryRoot, encoding: "utf8"
}).trim().split(/\r?\n/u).map(JSON.parse);
const completeTurn = (turn) => turn && turn.exit_code === 0 &&
  !turn.timed_out && Boolean(turn.response?.trim());
const failedV7Usable = failedV7Runs.filter((run) => completeTurn(run.first) &&
  (!failedV7Corpus.find(({ id }) => id === run.id)?.follow_up || completeTurn(run.second)));
const failedV7PairIds = failedV7Corpus.filter(({ id }) =>
  ["baseline", "plugin"].every((arm) => failedV7Usable.some((run) => run.id === id && run.arm === arm))
).map(({ id }) => id).sort();
assert.equal(failedV7Corpus.length, 80);
assert.equal(failedV7Runs.length, 160);
assert.deepEqual(failedV7Runs.map(({ id, arm }) => `${arm}:${id}`).sort(),
  failedV7Corpus.flatMap(({ id }) => [`baseline:${id}`, `plugin:${id}`]).sort());
assert.equal(failedV7Usable.length, 155);
assert.equal(failedV7PairIds.length, 75);
assert.ok(failedV7Runs.every((run) => run.thread_cleanup.exit_code === 0));
assert.deepEqual(failedV7Grades.map(({ id }) => id).sort(), failedV7PairIds);
assert.deepEqual(failedV7Analysis.full_primary_reliability, failedV7Failures);
assert.equal(failedV7Analysis.release_efficacy_usable, false);
assert.equal(failedV7Manifest.execution.primary_retries, 0);
assert.equal(failedV7Manifest.execution.usable_conversations, failedV7Usable.length);
assert.equal(failedV7Manifest.execution.usable_pairs, failedV7PairIds.length);
assert.equal(failedV7Manifest.execution.native_task_deletions, failedV7Runs.length);
assert.equal(failedV7Manifest.grading.graded_pairs, failedV7Grades.length);
assert.deepEqual(failedV7Failures.failed_conversations.map(({ id, arm }) => `${arm}:${id}`).sort(),
  failedV7Runs.filter((run) => !failedV7Usable.includes(run))
    .map(({ id, arm }) => `${arm}:${id}`).sort());
assert.equal(failedV7Failures.failed_conversations.filter((run) =>
  run.native_errors.some(({ message }) => message.includes("Selected model is at capacity"))).length, 4);
assert.equal(failedV7Failures.failed_conversations.filter((run) =>
  run.first.timed_out || run.second?.timed_out).length, 1);
const failedV7Metrics = failedV7Analysis.available_pair_diagnostic.metrics;
assert.equal(failedV7Metrics.inference_denied_count,
  failedV7Grades.filter((grade) => grade.plugin.inference_denied).length);
assert.equal(failedV7Metrics.inference_made_count,
  failedV7Grades.filter((grade) => grade.plugin.agent_inference_made).length);
assert.equal(failedV7Metrics.nonclear_premature_action_count,
  failedV7Usable.filter((run) => failedV7PairIds.includes(run.id) &&
    run.arm === "plugin" && run.class !== "clear")
    .reduce((sum, run) => sum + run.first.action_items.length, 0));
assert.deepEqual(Object.entries(failedV7Analysis.available_pair_diagnostic.gates)
  .filter(([, gate]) => gate.status === "FAIL").map(([name]) => name).sort(),
  ["inference_denial", "nonclear_premature_actions"]);

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
  assert.equal(sha256(execFileSync("git", ["show", `${review.candidate_commit}:${relativePath}`], {
    cwd: repositoryRoot
  })), expected, `historical reviewed file drifted: ${relativePath}`);
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
    const bytes = execFileSync("git", ["show", `${reviewedInstall.candidate}:plugins/${plugin}/${file.path}`], {
      cwd: repositoryRoot
    });
    assert.equal(bytes.length, file.bytes);
    assert.equal(sha256(bytes), file.sha256);
  }
}
const reviewCleanup = await readJson(path.join(reviewRoot, "cleanup-v7.json"));
assert.equal(reviewCleanup.isolated_home_exists, false);
assert.equal(reviewCleanup.live_workspace_exists, false);

const liveReviewRoot = path.join(repositoryRoot, "evidence", "real-user-acceptance-v7");
execFileSync(process.execPath, [path.join(liveReviewRoot, "build-public-evidence.mjs"), "--verify"], {
  cwd: repositoryRoot, stdio: "inherit"
});
const liveInstall = await readJson(path.join(liveReviewRoot, "installation-verification.json"));
for (const tree of liveInstall.trees) {
  for (const commit of [liveInstall.candidate, reviewedInstall.candidate]) {
    assert.equal(execFileSync("git", ["rev-parse", `${commit}:plugins/${tree.plugin}`], {
      cwd: repositoryRoot, encoding: "utf8"
    }).trim(), tree.git_tree_object_id);
  }
  assert.deepEqual(tree.files.map((file) => ({ path: file.path, bytes: file.installed_bytes,
    sha256: file.installed_sha256 })), reviewedInstall.fingerprints[tree.plugin].source.files);
}

const continuityReviewRoot = path.join(repositoryRoot, "evidence", "continuous-intent-loop-20260907");
execFileSync(process.execPath, [path.join(continuityReviewRoot, "build-public-evidence.mjs"), "--verify"], {
  cwd: repositoryRoot, stdio: "inherit"
});

const calibrationRoot = path.join(repositoryRoot, "evidence", "grader-calibration-v4-20260907");
const calibration = await readJson(path.join(calibrationRoot, "manifest.json"));
assert.equal(calibration.evidence_class, "bounded_grader_calibration");
assert.equal(calibration.release_efficacy_usable, false);
assert.equal(calibration.new_product_conversations, 0);
assert.equal(calibration.actual_grader_requests, 2);
await verifyArtifactHashes(calibrationRoot, calibration);

if (!(await exists(finalRoot))) {
  if (requireCandidate) {
    throw new Error("candidate holdout evidence is required for a release");
  }
  process.stdout.write(
    "verified historical development, failed v6, incomplete v7, and post-v6 artifact hashes; candidate holdout evidence pending\n"
  );
  process.exit(0);
}

const manifest = await readJson(path.join(finalRoot, "manifest.json"));
assert.equal(manifest.schema_version, 2);
assert.equal(manifest.evidence_class, "candidate_holdout");
assert.equal(manifest.product_version, "0.3.0-beta.1");
assert.equal(manifest.release_gate_result, "PASS_CANDIDATE_HOLDOUT");
assert.equal(manifest.grading.rubric_version, "intent-formation-blind-v4");
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
for (const [relativePath, expected] of Object.entries(review.adversarial.source_and_generated_sha256)) {
  assert.equal(sha256(await readFile(path.join(repositoryRoot, relativePath))), expected,
    `current candidate needs renewed adversarial review: ${relativePath}`);
}
// A historical installed-component snapshot is never enough to approve a
// changed delivery. Keep it verifiable above; release must match its reviewed bytes.
for (const [plugin, fingerprints] of Object.entries(reviewedInstall.fingerprints)) {
  for (const file of fingerprints.source.files) {
    assert.equal(sha256(await readFile(path.join(repositoryRoot, "plugins", plugin, file.path))),
      file.sha256, `current candidate needs renewed installed review: ${plugin}/${file.path}`);
  }
}
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
