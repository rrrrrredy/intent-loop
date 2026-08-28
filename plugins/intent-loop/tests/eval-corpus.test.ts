import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const expectedHash = "6796B9E40A5C0D6259CEF454A69AFFC767A0BD34C0E88153EF109FA2D2DB4F52";
const expectedCounts: Record<string, number> = {
  known_underspecified: 15,
  unformed: 15,
  goal_conflict: 15,
  result_formed: 15,
  clear_control: 20
};

function repositoryFile(relative: string): string {
  const compiledTestDirectory = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(compiledTestDirectory, "../../../../", relative);
}

test("the frozen corpus has 80 unique tasks in the required strata and exact hash", async () => {
  const body = await readFile(repositoryFile("evals/tasks.jsonl"), "utf8");
  const rows = body.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(rows.length, 80);
  assert.equal(new Set(rows.map((row) => row.id)).size, 80);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    assert.equal(row.schema_version, 1);
    assert.equal(typeof row.visible_prompt, "string");
    assert.equal(typeof row.evaluator_context, "string");
    assert.equal(typeof row.decision_point, "string");
    assert.equal(Array.isArray(row.acceptance), true);
    const category = String(row.category);
    counts[category] = (counts[category] ?? 0) + 1;
  }
  assert.deepEqual(counts, expectedCounts);
  assert.equal(createHash("sha256").update(body).digest("hex").toUpperCase(), expectedHash);
});

test("the failure-oriented policy suite covers all 15 frozen regression classes", async () => {
  const body = await readFile(repositoryFile("evals/policy-regressions.jsonl"), "utf8");
  const rows = body.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
  assert.equal(rows.length, 15);
  assert.equal(new Set(rows.map((row) => row.id)).size, 15);
  for (const row of rows) {
    assert.equal(typeof row.scenario, "string");
    assert.equal(typeof row.expected, "string");
    assert.equal(typeof row.failure, "string");
  }
});
