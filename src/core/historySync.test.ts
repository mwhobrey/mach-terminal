import { describe, expect, it } from "vitest";
import { prependHistoryEntry } from "./historySync";
import type { HistoryEntry } from "./terminal";

function entry(id: number, command: string, session = "s1"): HistoryEntry {
  return { id, session_id: session, command, timestamp_ms: id * 1000 };
}

describe("prependHistoryEntry", () => {
  it("prepends newest command first", () => {
    const next = prependHistoryEntry([entry(2, "git status")], entry(3, "npm test"));
    expect(next.map((row) => row.command)).toEqual(["npm test", "git status"]);
  });

  it("dedupes consecutive identical commands for the same session", () => {
    const next = prependHistoryEntry([entry(5, "clear")], entry(6, "clear"));
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe(6);
  });

  it("replaces same id when refetch races optimistic append", () => {
    const next = prependHistoryEntry([entry(7, "old text")], entry(7, "new text"));
    expect(next).toHaveLength(1);
    expect(next[0]?.command).toBe("new text");
  });
});
