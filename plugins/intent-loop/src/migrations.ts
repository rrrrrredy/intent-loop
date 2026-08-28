import { IntentLoopError } from "./errors.js";
import { LedgerEvent, SCHEMA_VERSION } from "./types.js";

export interface MigrationResult {
  from_version: number;
  to_version: typeof SCHEMA_VERSION;
  event: LedgerEvent;
  changed: boolean;
}

export function migrateEventRecord(input: unknown): MigrationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new IntentLoopError("CORRUPT_LEDGER", "ledger record is not an object");
  }
  const version = (input as Record<string, unknown>).schema_version;
  if (version === SCHEMA_VERSION) {
    return {
      from_version: SCHEMA_VERSION,
      to_version: SCHEMA_VERSION,
      event: structuredClone(input) as LedgerEvent,
      changed: false
    };
  }
  if (typeof version === "number" && version > SCHEMA_VERSION) {
    throw new IntentLoopError("FUTURE_SCHEMA", `ledger schema ${version} is newer than supported schema ${SCHEMA_VERSION}`);
  }
  throw new IntentLoopError("MIGRATION_UNAVAILABLE", `no trusted migration path exists from schema ${String(version)}`);
}
