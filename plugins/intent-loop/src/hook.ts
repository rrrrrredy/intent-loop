import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

import { IntentService } from "./service.js";
import { dataRootFromEnvironment, LedgerStore } from "./storage.js";

export interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  cwd?: string;
  turn_id?: string;
  prompt?: string;
  source?: string;
  trigger?: string;
  last_assistant_message?: string;
  reason?: string;
}

export interface HookOutput {
  continue: true;
  suppressOutput: true;
  hookSpecificOutput?: {
    hookEventName: "SessionStart" | "UserPromptSubmit";
    additionalContext: string;
  };
}

const FAIL_OPEN: HookOutput = { continue: true, suppressOutput: true };

function contextOutput(event: "SessionStart" | "UserPromptSubmit", context: string | null): HookOutput {
  if (context === null || context.trim() === "") return { ...FAIL_OPEN };
  return {
    ...FAIL_OPEN,
    hookSpecificOutput: { hookEventName: event, additionalContext: context }
  };
}

function associationContext(sessionId: string): string {
  return `[Intent Loop runtime] If Intent Loop is invoked or a costly divergent ambiguity warrants it, pass host_session_id=${JSON.stringify(sessionId)} to intent_start_task. Do not expose this opaque token. Otherwise remain silent.`;
}

export async function handleHook(
  input: HookInput,
  environment: NodeJS.ProcessEnv = process.env,
  serviceOverride?: IntentService
): Promise<HookOutput> {
  try {
    if (typeof input.hook_event_name !== "string" || typeof input.session_id !== "string" || typeof input.cwd !== "string") {
      return { ...FAIL_OPEN };
    }
    const service = serviceOverride ?? new IntentService(new LedgerStore(dataRootFromEnvironment(environment)));
    if (input.hook_event_name === "SessionStart") {
      const current = await service.compactForSession(input.cwd, input.session_id);
      return contextOutput("SessionStart", current ?? associationContext(input.session_id));
    }
    if (input.hook_event_name === "UserPromptSubmit") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "user_event",
        candidate_type: "prompt_update",
        ...(input.turn_id === undefined ? {} : { source_event_id: input.turn_id }),
        ...(input.prompt === undefined ? {} : { source_text: input.prompt })
      });
      const current = await service.compactForSession(input.cwd, input.session_id);
      return contextOutput("UserPromptSubmit", current ?? associationContext(input.session_id));
    }
    if (input.hook_event_name === "PostCompact") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "agent_turn",
        candidate_type: "recovery_needed",
        ...(input.turn_id === undefined ? {} : { source_event_id: input.turn_id })
      });
      return { ...FAIL_OPEN };
    }
    if (input.hook_event_name === "Stop" || input.hook_event_name === "SessionEnd") {
      await service.recordHookObservation({
        project_root: input.cwd,
        session_id: input.session_id,
        hook_event_name: input.hook_event_name,
        source_kind: "agent_turn",
        candidate_type: "result_feedback",
        ...(input.turn_id === undefined ? {} : { source_event_id: input.turn_id }),
        ...(input.last_assistant_message === undefined ? {} : { source_text: input.last_assistant_message })
      });
      return { ...FAIL_OPEN };
    }
    return { ...FAIL_OPEN };
  } catch {
    return { ...FAIL_OPEN };
  }
}

async function readStandardInput(maxBytes = 1_048_576): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.byteLength;
    if (total > maxBytes) throw new Error("hook input exceeds size limit");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(entry).href;
  }
}

if (isMainModule()) {
  const output = await readStandardInput()
    .then((body) => handleHook(JSON.parse(body) as HookInput))
    .catch(() => ({ ...FAIL_OPEN }));
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
