import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const runtimePath = path.join(repositoryRoot, "plugins", "intent-loop", "runtime", "server.mjs");
const outputPath = path.join(repositoryRoot, "dsh", "tool-catalog.json");
const checkOnly = process.argv.includes("--check");
const scratch = await mkdtemp(path.join(os.tmpdir(), "intent-loop-dsh-catalog-"));

function sanitizedInputSchema(schema) {
  const result = structuredClone(schema);
  assert.equal(result.type, "object");
  result.properties ??= {};
  delete result.properties.project_root;
  delete result.properties.host_session_id;
  if (Array.isArray(result.required)) {
    result.required = result.required.filter((name) => name !== "project_root" && name !== "host_session_id");
  }
  result.additionalProperties = false;
  return result;
}

const client = new Client({ name: "intent-loop-dsh-catalog", version: "0.2.0-beta.1" });
try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [runtimePath],
    cwd: repositoryRoot,
    env: {
      INTENT_LOOP_DATA_DIR: path.join(scratch, "data"),
      ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
      ...(process.env.PATH ? { PATH: process.env.PATH } : {})
    }
  });
  await client.connect(transport, { timeout: 15_000 });
  const listed = await client.listTools();
  assert.equal(listed.tools.length, 15, "the shared MCP core must expose exactly 15 tools");
  const runtimeBytes = await readFile(runtimePath);
  const catalog = {
    schema_version: 1,
    generated_from: "plugins/intent-loop/runtime/server.mjs",
    source_runtime_sha256: createHash("sha256").update(runtimeBytes).digest("hex"),
    tools: listed.tools
      .map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        inputSchema: sanitizedInputSchema(tool.inputSchema),
        outputSchema: tool.outputSchema ?? {},
        annotations: tool.annotations ?? {}
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  };
  const names = new Set(catalog.tools.map((tool) => tool.name));
  assert.equal(names.size, 15, "tool names must be unique");
  assert.equal(names.has("intent_start_task"), true);
  assert.equal(names.has("intent_delete"), true);
  for (const tool of catalog.tools) {
    assert.equal("project_root" in tool.inputSchema.properties, false);
    assert.equal("host_session_id" in tool.inputSchema.properties, false);
  }
  const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
  if (checkOnly) {
    const current = await readFile(outputPath, "utf8");
    assert.equal(current, serialized, "dsh/tool-catalog.json is stale; run npm run generate:dsh-catalog");
  } else {
    await writeFile(outputPath, serialized, "utf8");
  }
  process.stdout.write(JSON.stringify({ ok: true, check: checkOnly, tools: catalog.tools.length }) + "\n");
} finally {
  await client.close().catch(() => undefined);
  const resolvedScratch = path.resolve(scratch);
  assert.equal(resolvedScratch.startsWith(path.resolve(os.tmpdir())), true);
  await rm(resolvedScratch, { recursive: true, force: true });
}
