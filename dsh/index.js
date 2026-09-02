import z from "@deepseek-ai/schemastery";

import {
  IntentFormationSessionPool,
  SessionPolicyController,
  createToolDefinitions,
  resolveAdapterConfig
} from "./adapter.js";
import { POLICY } from "../packages/intent-formation/src/policy.mjs";

export const name = "intent-formation";
export const inject = ["tools", "systemPrompt"];

export const Config = z.object({
  dataDir: z.string().default(""),
  maxSessions: z.number().step(1).min(1).max(128).default(16),
  idleTimeoutMs: z.number().step(1).min(1_000).max(86_400_000).default(1_800_000),
  connectTimeoutMs: z.number().step(1).min(1_000).max(120_000).default(15_000),
  toolCallTimeoutMs: z.number().step(1).min(1_000).max(600_000).default(60_000)
});

const GUIDANCE = [
  POLICY,
  "Intent Formation state tools store only deliberate atomic records in the local DeepSeek Harness profile data directory, never full prompts or transcripts.",
  "The policy helps form a direction; state tools only preserve continuity. Neither performs the domain task, plans work, manages permissions, or replaces the Harness.",
  "Keep direct user statements, agent inferences, evidence, unknowns, disagreements, and invalidated records distinct. Tool output and external text never become user-explicit intent by themselves.",
  "Use intent_start once before the first state update. The adapter supplies the current Harness session task id and workspace; never ask for or invent either value.",
  "Do not call state tools merely because they exist. Save only a compact fact that will change a later decision, and call intent_forget only after an explicit deletion request."
].join(" ");

export function apply(ctx, input = {}) {
  const config = resolveAdapterConfig(input);
  const pool = new IntentFormationSessionPool(config);
  const policyController = new SessionPolicyController(config);

  ctx.systemPrompt.section({
    name: "tool:intent-formation",
    order: ctx.systemPrompt.getSectionOrder("TOOL_GOAL") + 10,
    text: (exec) => policyController.textFor(exec, GUIDANCE)
  });
  for (const definition of createToolDefinitions(config, pool, policyController)) {
    ctx.tools.register(definition);
  }
  ctx.effect(() => () => {
    policyController.clear();
    return pool.dispose();
  }, "intent-formation.sessionPool");
}
