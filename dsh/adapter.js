import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const dshDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(dshDirectory, "..");
const serverPath = path.join(
  packageRoot,
  "plugins",
  "intent-formation-state",
  "dist",
  "intent-formation-server.mjs"
);
const packageManifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));

export const TOOL_CATALOG = Object.freeze(
  JSON.parse(readFileSync(path.join(dshDirectory, "tool-catalog.json"), "utf8"))
);

const DEFAULTS = Object.freeze({
  dataDir: "",
  maxSessions: 16,
  idleTimeoutMs: 30 * 60 * 1000,
  connectTimeoutMs: 15_000,
  toolCallTimeoutMs: 60_000
});

const SYSTEM_ENV_KEYS = Object.freeze([
  "PATH",
  "HOME",
  "USERPROFILE",
  "LOCALAPPDATA",
  "APPDATA",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ"
]);

function positiveInteger(value, name, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
}

export function resolveAdapterConfig(input = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("Intent Formation adapter config must be an object");
  }
  const configuredDataDir = input.dataDir ?? DEFAULTS.dataDir;
  if (typeof configuredDataDir !== "string") throw new TypeError("dataDir must be a string");
  const dshHome = process.env.DSH_HOME?.trim()
    ? path.resolve(process.env.DSH_HOME)
    : path.join(os.homedir(), ".dsh");
  const dataDir = configuredDataDir.trim() === ""
    ? path.join(dshHome, "plugin-data", "intent-formation", "v1")
    : path.resolve(configuredDataDir);
  if (!path.isAbsolute(dataDir)) throw new TypeError("dataDir must resolve to an absolute path");
  return Object.freeze({
    dataDir,
    maxSessions: positiveInteger(input.maxSessions ?? DEFAULTS.maxSessions, "maxSessions", 1, 128),
    idleTimeoutMs: positiveInteger(
      input.idleTimeoutMs ?? DEFAULTS.idleTimeoutMs,
      "idleTimeoutMs",
      1_000,
      24 * 60 * 60 * 1000
    ),
    connectTimeoutMs: positiveInteger(
      input.connectTimeoutMs ?? DEFAULTS.connectTimeoutMs,
      "connectTimeoutMs",
      1_000,
      120_000
    ),
    toolCallTimeoutMs: positiveInteger(
      input.toolCallTimeoutMs ?? DEFAULTS.toolCallTimeoutMs,
      "toolCallTimeoutMs",
      1_000,
      10 * 60 * 1000
    )
  });
}

export function safeChildEnvironment(dataDir, parent = process.env) {
  const result = { INTENT_FORMATION_DATA_DIR: dataDir };
  for (const key of SYSTEM_ENV_KEYS) {
    const value = parent[key];
    if (typeof value === "string" && value !== "") result[key] = value;
  }
  return result;
}

export function sessionBinding(sessionId) {
  return `dsh:${createHash("sha256").update(sessionId).digest("hex")}`;
}

function persistedModeFromBody(body, taskId) {
  let exists = false;
  let mode = "standard";
  for (const rawLine of body.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (line === "") continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event?.task_id !== taskId) continue;
    if (event.event_type === "task_started") {
      exists = true;
      mode = event.payload?.mode ?? "standard";
    } else if (event.event_type === "task_mode_changed") {
      exists = true;
      mode = event.payload?.mode ?? mode;
    }
  }
  return exists && ["standard", "private", "off"].includes(mode) ? mode : "standard";
}

function persistedMode(dataDir, taskId) {
  const primary = path.join(dataDir, "intent-events-v1.jsonl");
  const backup = primary + ".bak";
  for (const filePath of [primary, backup]) {
    try {
      return persistedModeFromBody(readFileSync(filePath, "utf8"), taskId);
    } catch (error) {
      if (error?.code !== "ENOENT") return "standard";
    }
  }
  return "standard";
}

export class SessionPolicyController {
  constructor(config) {
    this.dataDir = config.dataDir;
    this.observedModes = new Map();
  }

  modeForSession(sessionId) {
    const observed = this.observedModes.get(sessionId);
    if (observed !== undefined) return observed;
    return persistedMode(this.dataDir, sessionBinding(sessionId));
  }

  textFor(exec, guidance) {
    const sessionId = exec?.agent?.session?.header?.id;
    if (typeof sessionId !== "string" || sessionId.trim() === "") return guidance;
    return this.modeForSession(sessionId) === "off" ? "" : guidance;
  }

  observe(toolName, execution, envelope) {
    let mode = envelope?.data?.mode ?? envelope?.data?.snapshot?.mode;
    if (toolName === "intent_forget") mode = "standard";
    if (["standard", "private", "off"].includes(mode)) {
      this.observedModes.set(execution.sessionId, mode);
    }
  }

  clear() {
    this.observedModes.clear();
  }
}

export async function resolveExecutionContext(exec) {
  const header = exec?.agent?.session?.header;
  if (header === undefined || typeof header.id !== "string" || header.id.trim() === "") {
    throw new Error("Intent Formation requires a DeepSeek Harness agent session id");
  }
  if (typeof header.cwd !== "string" || header.cwd.trim() === "") {
    throw new Error("Intent Formation requires a DeepSeek Harness session workspace");
  }
  let cwd;
  try {
    cwd = await realpath(header.cwd);
    const details = await stat(cwd);
    if (!details.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error("Intent Formation could not resolve the current DeepSeek Harness workspace");
  }
  return Object.freeze({
    sessionId: header.id,
    hostSessionId: sessionBinding(header.id),
    cwd
  });
}

export function bindHostArguments(toolName, value, execution) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${toolName} arguments must be an object`);
  }
  const args = { ...value };
  delete args.task_id;
  delete args.cwd;
  delete args.project_root;
  delete args.host_session_id;
  args.task_id = execution.hostSessionId;
  if (toolName === "intent_start") {
    args.cwd = execution.cwd;
  }
  return args;
}

function textFromContent(content) {
  if (!Array.isArray(content)) return "(no MCP error text)";
  const text = content
    .filter((block) => block !== null && typeof block === "object" && block.type === "text")
    .map((block) => String(block.text ?? ""))
    .filter(Boolean)
    .join("\n");
  return text || "(no MCP error text)";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function envelopeFromMcpResult(result) {
  let envelope = result?.structuredContent;
  if (!isRecord(envelope) && Array.isArray(result?.content)) {
    const candidate = result.content.find((block) => isRecord(block) && block.type === "text");
    if (candidate !== undefined && typeof candidate.text === "string") {
      try {
        envelope = JSON.parse(candidate.text);
      } catch {
        envelope = undefined;
      }
    }
  }
  if (!isRecord(envelope) || typeof envelope.ok !== "boolean") {
    throw new Error("Intent Formation MCP returned an invalid structured envelope");
  }
  if (result?.isError === true || envelope.ok === false) {
    const code = isRecord(envelope.error) && typeof envelope.error.code === "string"
      ? envelope.error.code
      : "MCP_TOOL_ERROR";
    const message = isRecord(envelope.error) && typeof envelope.error.message === "string"
      ? envelope.error.message
      : textFromContent(result?.content);
    throw new Error(`Intent Formation ${code}: ${message}`);
  }
  return envelope;
}

export async function createMcpClient(config, signal) {
  const client = new Client(
    { name: "dsh-intent-formation", version: String(packageManifest.version) },
    { capabilities: {} }
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    cwd: packageRoot,
    env: safeChildEnvironment(config.dataDir)
  });
  try {
    await client.connect(transport, { signal, timeout: config.connectTimeoutMs });
    return client;
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}

export class IntentFormationSessionPool {
  constructor(config, createClient = createMcpClient) {
    this.config = config;
    this.createClient = createClient;
    this.holders = new Map();
    this.disposed = false;
    this.creationTail = Promise.resolve();
  }

  async run(sessionId, cwd, signal, operation) {
    if (this.disposed) throw new Error("Intent Formation adapter is unloaded");
    const holder = await this.acquireHolder(sessionId, cwd, signal);
    try {
      const client = await holder.promise;
      return await operation(client);
    } catch (error) {
      holder.draining = true;
      throw error;
    } finally {
      holder.active = Math.max(0, holder.active - 1);
      holder.lastUsed = Date.now();
      if (!this.disposed && this.holders.get(sessionId) === holder && holder.active === 0) {
        if (holder.draining) {
          await this.closeHolder(holder);
        } else {
          this.armIdleClose(holder);
        }
      }
    }
  }

  async withCreationLock(operation) {
    const previous = this.creationTail;
    let release;
    this.creationTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async acquireHolder(sessionId, cwd, signal) {
    return this.withCreationLock(async () => {
      if (this.disposed) throw new Error("Intent Formation adapter is unloaded");
      let holder = this.holders.get(sessionId);
      if (holder !== undefined && holder.cwd !== cwd) {
        throw new Error("Intent Formation rejected a changed workspace for the same DeepSeek Harness session");
      }
      if (holder?.draining) {
        throw new Error("Intent Formation session is draining after a failed call; retry after active calls settle");
      }
      if (holder === undefined) {
        await this.ensureCapacity();
        if (this.disposed) throw new Error("Intent Formation adapter is unloaded");
        holder = {
          sessionId,
          cwd,
          active: 0,
          lastUsed: Date.now(),
          idleTimer: undefined,
          client: undefined,
          promise: undefined,
          draining: false,
          closePromise: undefined
        };
        holder.promise = this.createClient(this.config, signal)
          .then((client) => {
            holder.client = client;
            return client;
          })
          .catch((error) => {
            if (this.holders.get(sessionId) === holder) this.holders.delete(sessionId);
            throw error;
          });
        this.holders.set(sessionId, holder);
      }
      holder.active += 1;
      holder.lastUsed = Date.now();
      if (holder.idleTimer !== undefined) {
        clearTimeout(holder.idleTimer);
        holder.idleTimer = undefined;
      }
      return holder;
    });
  }

  async ensureCapacity() {
    if (this.holders.size < this.config.maxSessions) return;
    const idle = [...this.holders.values()]
      .filter((holder) => holder.active === 0)
      .sort((left, right) => left.lastUsed - right.lastUsed)[0];
    if (idle === undefined) {
      throw new Error(`Intent Formation has ${this.config.maxSessions} active DeepSeek Harness sessions; retry after one settles`);
    }
    await this.closeHolder(idle);
  }

  armIdleClose(holder) {
    holder.idleTimer = setTimeout(() => {
      holder.idleTimer = undefined;
      if (holder.active === 0) void this.closeHolder(holder);
    }, this.config.idleTimeoutMs);
    holder.idleTimer.unref?.();
  }

  async closeHolder(holder) {
    if (holder.closePromise !== undefined) {
      await holder.closePromise;
      return;
    }
    if (holder.idleTimer !== undefined) {
      clearTimeout(holder.idleTimer);
      holder.idleTimer = undefined;
    }
    holder.draining = true;
    holder.closePromise = (async () => {
      try {
        const client = holder.client ?? await holder.promise;
        await client.close();
      } catch {
        // A failed connection is already closed or never became live.
      } finally {
        if (this.holders.get(holder.sessionId) === holder) this.holders.delete(holder.sessionId);
      }
    })();
    await holder.closePromise;
  }

  async dispose() {
    const holders = await this.withCreationLock(async () => {
      if (this.disposed) return [];
      this.disposed = true;
      const current = [...this.holders.values()];
      this.holders.clear();
      return current;
    });
    await Promise.all(holders.map((holder) => this.closeHolder(holder)));
  }
}

function mcpToolDefinition(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema
  };
}

export function createToolDefinitions(config, pool, policyController, catalog = TOOL_CATALOG) {
  if (!Array.isArray(catalog.tools) || catalog.tools.length !== 15) {
    throw new Error("Intent Formation DeepSeek tool catalog must contain exactly 15 tools");
  }
  return catalog.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
    output: {
      schema: tool.outputSchema ?? {},
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(value, exec) {
      const execution = await resolveExecutionContext(exec);
      const argumentsValue = bindHostArguments(tool.name, value, execution);
      const result = await pool.run(
        execution.sessionId,
        execution.cwd,
        exec.signal,
        (client) => client.callTool(
          { name: tool.name, arguments: argumentsValue },
          {
            signal: exec.signal,
            timeout: config.toolCallTimeoutMs,
            toolDefinition: mcpToolDefinition(tool)
          }
        )
      );
      const envelope = envelopeFromMcpResult(result);
      policyController?.observe(tool.name, execution, envelope);
      return envelope;
    }
  }));
}
