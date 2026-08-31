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
const serverPath = path.join(packageRoot, "plugins", "intent-loop", "runtime", "server.mjs");
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
    throw new TypeError("Intent Loop adapter config must be an object");
  }
  const configuredDataDir = input.dataDir ?? DEFAULTS.dataDir;
  if (typeof configuredDataDir !== "string") throw new TypeError("dataDir must be a string");
  const dshHome = process.env.DSH_HOME?.trim()
    ? path.resolve(process.env.DSH_HOME)
    : path.join(os.homedir(), ".dsh");
  const dataDir = configuredDataDir.trim() === ""
    ? path.join(dshHome, "plugin-data", "intent-loop", "v1")
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
  const result = { INTENT_LOOP_DATA_DIR: dataDir };
  for (const key of SYSTEM_ENV_KEYS) {
    const value = parent[key];
    if (typeof value === "string" && value !== "") result[key] = value;
  }
  return result;
}

function sessionBinding(sessionId) {
  return `dsh:${createHash("sha256").update(sessionId).digest("hex")}`;
}

export async function resolveExecutionContext(exec) {
  const header = exec?.agent?.session?.header;
  if (header === undefined || typeof header.id !== "string" || header.id.trim() === "") {
    throw new Error("Intent Loop requires a DeepSeek Harness agent session id");
  }
  if (typeof header.cwd !== "string" || header.cwd.trim() === "") {
    throw new Error("Intent Loop requires a DeepSeek Harness session workspace");
  }
  let cwd;
  try {
    cwd = await realpath(header.cwd);
    const details = await stat(cwd);
    if (!details.isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error("Intent Loop could not resolve the current DeepSeek Harness workspace");
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
  delete args.project_root;
  delete args.host_session_id;
  args.project_root = execution.cwd;
  if (toolName === "intent_start_task" && args.mode === "private") {
    args.host_session_id = execution.hostSessionId;
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
    throw new Error("Intent Loop MCP returned an invalid structured envelope");
  }
  if (result?.isError === true || envelope.ok === false) {
    const code = isRecord(envelope.error) && typeof envelope.error.code === "string"
      ? envelope.error.code
      : "MCP_TOOL_ERROR";
    const message = isRecord(envelope.error) && typeof envelope.error.message === "string"
      ? envelope.error.message
      : textFromContent(result?.content);
    throw new Error(`Intent Loop ${code}: ${message}`);
  }
  return envelope;
}

export async function createMcpClient(config, signal) {
  const client = new Client(
    { name: "dsh-intent-loop", version: String(packageManifest.version) },
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

export class IntentLoopSessionPool {
  constructor(config, createClient = createMcpClient) {
    this.config = config;
    this.createClient = createClient;
    this.holders = new Map();
    this.disposed = false;
    this.creationTail = Promise.resolve();
  }

  async run(sessionId, cwd, signal, operation) {
    if (this.disposed) throw new Error("Intent Loop adapter is unloaded");
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
      if (this.disposed) throw new Error("Intent Loop adapter is unloaded");
      let holder = this.holders.get(sessionId);
      if (holder !== undefined && holder.cwd !== cwd) {
        throw new Error("Intent Loop rejected a changed workspace for the same DeepSeek Harness session");
      }
      if (holder?.draining) {
        throw new Error("Intent Loop session is draining after a failed call; retry after active calls settle");
      }
      if (holder === undefined) {
        await this.ensureCapacity();
        if (this.disposed) throw new Error("Intent Loop adapter is unloaded");
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
      throw new Error(`Intent Loop has ${this.config.maxSessions} active DeepSeek Harness sessions; retry after one settles`);
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

export function createToolDefinitions(config, pool, catalog = TOOL_CATALOG) {
  if (!Array.isArray(catalog.tools) || catalog.tools.length !== 15) {
    throw new Error("Intent Loop DeepSeek tool catalog must contain exactly 15 tools");
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
      return envelopeFromMcpResult(result);
    }
  }));
}
