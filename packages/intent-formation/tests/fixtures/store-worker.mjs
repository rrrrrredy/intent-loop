import { access, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { createEvent, EventStore } from "../../src/store.mjs";

const [mode, dataDirectory, value, signalPath, readyPath] = process.argv.slice(2);
if (!mode || !dataDirectory) throw new TypeError("mode and data directory are required");

const store = new EventStore({
  dataDirectory,
  lockTimeoutMs: 120_000,
  staleLockMs: 200
});

if (mode === "hold") {
  if (!value || !signalPath) throw new TypeError("hold requires entered and release paths");
  await store.withLock(async () => {
    await writeFile(value, "entered", "utf8");
    const deadline = Date.now() + 15_000;
    while (true) {
      try {
        await access(signalPath);
        break;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (Date.now() >= deadline) throw new Error("timed out waiting for release signal");
      await delay(10);
    }
  });
} else if (mode === "append" || mode === "append-barrier") {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0) throw new TypeError("append index is invalid");
  if (mode === "append-barrier") {
    if (!signalPath || !readyPath) {
      throw new TypeError("append-barrier requires start and ready paths");
    }
    await writeFile(readyPath, "ready", { encoding: "utf8", flag: "wx" });
    const deadline = Date.now() + 120_000;
    while (true) {
      try {
        await access(signalPath);
        break;
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
      if (Date.now() >= deadline) throw new Error("timed out waiting for start signal");
      await delay(10);
    }
  }
  await store.append(
    createEvent({
      event_id: "evt_process_" + index,
      event_type: "task_mode_changed",
      occurred_at: new Date(Date.UTC(2026, 8, 2, 0, 0, index)).toISOString(),
      task_id: "task-process-stress",
      payload: { mode: index % 2 === 0 ? "standard" : "off" }
    })
  );
} else {
  throw new TypeError("unsupported worker mode");
}
