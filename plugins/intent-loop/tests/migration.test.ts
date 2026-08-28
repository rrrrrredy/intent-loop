import assert from "node:assert/strict";
import test from "node:test";

import { newId } from "../src/canonical.js";
import { IntentLoopError } from "../src/errors.js";
import { migrateEventRecord } from "../src/migrations.js";

const fixture = {
  schema_version: 1,
  event_id: newId(),
  event_type: "task_started",
  project_id: "a".repeat(64),
  task_id: newId(),
  occurred_at: new Date().toISOString(),
  actor: "user",
  request_id: "migration-test",
  payload: { mode: "on" },
  prev_hash: null,
  event_hash: "b".repeat(64)
};

test("schema v1 migration is an explicit identity operation", () => {
  const result = migrateEventRecord(fixture);
  assert.equal(result.from_version, 1);
  assert.equal(result.to_version, 1);
  assert.equal(result.changed, false);
  assert.deepEqual(result.event, fixture);
  assert.notEqual(result.event, fixture);
});

test("future and unknown schemas fail closed", () => {
  assert.throws(
    () => migrateEventRecord({ ...fixture, schema_version: 2 }),
    (error: unknown) => error instanceof IntentLoopError && error.code === "FUTURE_SCHEMA"
  );
  assert.throws(
    () => migrateEventRecord({ ...fixture, schema_version: 0 }),
    (error: unknown) => error instanceof IntentLoopError && error.code === "MIGRATION_UNAVAILABLE"
  );
});
