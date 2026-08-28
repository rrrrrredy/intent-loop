import { access } from "node:fs/promises";
import path from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const serverPath = path.resolve(process.argv[2] ?? "");
await access(serverPath);

const pluginRoot = path.dirname(path.dirname(serverPath));
const client = new Client({ name: "intent-loop-installed-probe", version: "0.1.0-beta.1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  cwd: pluginRoot,
  env: {}
});

let timeoutHandle;
const timeout = new Promise((_, reject) => {
  timeoutHandle = setTimeout(() => reject(new Error("installed MCP probe timed out")), 10_000);
});

try {
  await Promise.race([client.connect(transport), timeout]);
  const tools = await Promise.race([client.listTools(), timeout]);
  const resources = await Promise.race([client.listResources(), timeout]);
  const skill = await Promise.race([client.readResource({ uri: "intent-loop://skill/intent" }), timeout]);
  const skillText = skill.contents[0]?.text;
  process.stdout.write(`${JSON.stringify({
    ok: true,
    tool_count: tools.tools.length,
    resource_count: resources.resources.length,
    skill_policy_present: typeof skillText === "string" && skillText.includes("# Intent Loop")
  })}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutHandle);
  await client.close().catch(() => undefined);
}
