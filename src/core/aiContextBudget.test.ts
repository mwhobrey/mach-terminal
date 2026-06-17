import { describe, expect, it } from "vitest";
import type { AiChatMessage } from "./aiChatState";
import {
  buildHistoryForExecute,
  mergeOutputExcerpts,
  trimHistoryToBudget,
} from "./aiContextBudget";

describe("aiContextBudget", () => {
  it("keeps newest history when trimming", () => {
    const turns = [
      { role: "user" as const, content: "a".repeat(100) },
      { role: "assistant" as const, content: "b".repeat(100) },
      { role: "user" as const, content: "recent" },
    ];
    const trimmed = trimHistoryToBudget(turns, 120);
    expect(trimmed).toHaveLength(2);
    expect(trimmed[0]?.content).toContain("b");
    expect(trimmed[1]?.content).toBe("recent");
  });

  it("builds bounded history for execute", () => {
    const prior: AiChatMessage[] = [
      { id: "1", role: "user", content: "old", atMs: 1 },
      { id: "2", role: "assistant", content: "reply", atMs: 2 },
    ];
    const history = buildHistoryForExecute(prior, "follow up", 8_000);
    expect(history).toHaveLength(2);
    expect(history[1]?.content).toBe("reply");
  });

  it("merges attachment and scrollback excerpts", () => {
    const merged = mergeOutputExcerpts("scroll tail", "[lines 1-2]\nselected", 200);
    expect(merged).toContain("selected");
    expect(merged).toContain("scroll tail");
  });
});
