import { describe, expect, it } from "vitest";
import { aiExecuteRequestToWire, aiExecuteResponseFromWire } from "./terminal";

describe("aiExecute wire mapping", () => {
  it("maps snake_case request fields to camelCase for Tauri", () => {
    const wire = aiExecuteRequestToWire({
      session_id: "session-1",
      prompt: "hello",
      provider_id: "ollama",
      intent: "freeform",
      context: {
        cwd: "/tmp",
        git_branch: "main",
        output_excerpt: "tail",
      },
      enable_tools: true,
      use_provider_messages: true,
      provider_messages: [
        {
          role: "tool",
          content: "result",
          tool_call_id: "call_1",
          name: "list_command_runs",
        },
      ],
    });

    expect(wire.sessionId).toBe("session-1");
    expect(wire.providerId).toBe("ollama");
    expect(wire.context?.gitBranch).toBe("main");
    expect(wire.context?.outputExcerpt).toBe("tail");
    expect(wire.enableTools).toBe(true);
    expect(wire.useProviderMessages).toBe(true);
    expect(wire.providerMessages?.[0]?.toolCallId).toBe("call_1");
  });

  it("maps camelCase response fields back to TS DTOs", () => {
    const response = aiExecuteResponseFromWire({
      providerId: "anthropic",
      output: "done",
      toolCalls: [{ id: "t1", name: "list_command_runs", arguments: "{}" }],
      finishReason: "tool_calls",
    });

    expect(response.provider_id).toBe("anthropic");
    expect(response.tool_calls?.[0]?.name).toBe("list_command_runs");
    expect(response.finish_reason).toBe("tool_calls");
  });
});
