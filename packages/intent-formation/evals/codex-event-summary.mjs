const nonActionItemTypes = new Set([
  "agent_message",
  "reasoning",
  "mcp_tool_call",
  "error",
  "warning"
]);

export function summarizeCodexEvents(events) {
  const thread = events.find((event) => event.type === "thread.started");
  const completedItems = events
    .filter((event) => event.type === "item.completed" && event.item)
    .map((event) => event.item);
  const toolCalls = completedItems
    .filter((item) => item.type === "mcp_tool_call")
    .map((item) => ({
      server: item.server,
      tool: item.tool,
      status: item.status,
      error: item.error || null
    }));
  const actionItems = completedItems
    .filter((item) => !nonActionItemTypes.has(item.type))
    .map((item) => ({
      type: item.type,
      status: item.status ?? null
    }));
  const diagnosticItems = completedItems
    .filter((item) => item.type === "error" || item.type === "warning")
    .map((item) => ({
      type: item.type,
      message: String(item.message ?? item.error ?? "")
    }));
  return {
    thread_id: thread?.thread_id || null,
    mcp_tool_calls: toolCalls,
    action_items: actionItems,
    diagnostic_items: diagnosticItems
  };
}
