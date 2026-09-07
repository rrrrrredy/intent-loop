import process from "node:process";
import { POLICY } from "../src/policy.mjs";
import { continuityContext } from "../src/continuity.mjs";

const chunks = [];

function outputJson(value) {
  process.stdout.write(JSON.stringify(value));
}

function taskIdFor(event) {
  if (typeof event?.session_id === "string" && event.session_id.trim()) {
    return event.session_id.trim();
  }
  return null;
}

function activePolicy() {
  return POLICY;
}

function offPolicy() {
  return "Intent Formation is off for this task. Do not perform implicit intent intervention or state updates.";
}

async function handle(event) {
  if (event?.hook_event_name !== "SessionStart") {
    return;
  }
  const taskId = taskIdFor(event);
  if (!taskId) {
    return;
  }

  let policy = activePolicy();
  const context = [];
  if (event.source === "resume" || event.source === "compact") {
    const { IntentService } = await import("../src/service.mjs");
    const service = new IntentService();
    if (await service.fastTaskMode({ task_id: taskId }) === "off") {
      policy = offPolicy();
    } else {
      const snapshot = await service.show({ task_id: taskId });
      if (snapshot.mode === "off") {
        policy = offPolicy();
      } else {
        // Budget the full escaped envelope, including the recovery policy prefix.
        const restored = continuityContext(snapshot, {
          maximumEncodedBytes: 3896 - Buffer.byteLength(JSON.stringify(policy + "\n\n"), "utf8")
        });
        if (restored) context.push(restored);
      }
    }
  }

  outputJson({
    continue: true,
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: [policy, ...context].join("\n\n")
    }
  });
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("end", async () => {
  let event;
  try {
    event = JSON.parse(chunks.join(""));
  } catch {
    process.exitCode = 0;
    return;
  }

  try {
    await handle(event);
  } catch {
    process.exitCode = 0;
  }
});

process.stdin.resume();
