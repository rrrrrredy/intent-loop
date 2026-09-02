import process from "node:process";
import { pathToFileURL } from "node:url";
import { PRODUCT_VERSION } from "../src/constants.mjs";
import { POLICY } from "../src/policy.mjs";

export { POLICY };

function hookOutput() {
  return {
    continue: true,
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: POLICY
    }
  };
}

function toolResult(output) {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output
  };
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function respond(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function handle(message) {
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    fail(message?.id, -32600, "Invalid Request");
    return;
  }
  if (!Object.hasOwn(message, "id")) return;
  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "intent-formation-policy", version: PRODUCT_VERSION }
    });
    return;
  }
  if (message.method === "ping") {
    respond(message.id, {});
    return;
  }
  if (message.method === "tools/list") {
    respond(message.id, {
      tools: [
        {
          name: "get_intent_policy",
          title: "Load the intent-formation policy",
          description:
            "Return the bounded UserPromptSubmit policy without receiving or persisting the prompt.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false
          }
        }
      ]
    });
    return;
  }
  if (message.method === "tools/call") {
    if (message.params?.name !== "get_intent_policy") {
      fail(message.id, -32602, "Unknown tool");
      return;
    }
    const args = message.params?.arguments;
    if (args && (typeof args !== "object" || Array.isArray(args) || Object.keys(args).length)) {
      fail(message.id, -32602, "No arguments are accepted");
      return;
    }
    respond(message.id, toolResult(hookOutput()));
    return;
  }
  fail(message.id, -32601, "Method not found");
}

export function main() {
  let pending = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    pending += chunk;
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1);
      if (!line) continue;
      try {
        handle(JSON.parse(line));
      } catch {
        fail(null, -32700, "Parse error");
      }
    }
  });
  process.stdin.resume();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
