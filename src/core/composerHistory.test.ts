import { describe, expect, it } from "vitest";
import {
  createComposerHistoryState,
  nextHistoryDraft,
  predictionForDraft,
} from "./composerHistory";
import type { HistoryEntry } from "./terminal";

const ENTRIES: HistoryEntry[] = [
  { id: 3, session_id: "a", command: "npm run build", timestamp_ms: 3 },
  { id: 2, session_id: "a", command: "npm test", timestamp_ms: 2 },
  { id: 1, session_id: "a", command: "git status", timestamp_ms: 1 },
];

describe("composer history contracts", () => {
  it("returns case-insensitive prediction from recent history", () => {
    expect(predictionForDraft("NpM", ENTRIES)).toBe("npm run build");
    expect(predictionForDraft("zzz", ENTRIES)).toBeNull();
  });

  it("navigates history while preserving baseline draft", () => {
    let state = createComposerHistoryState();
    const prevOne = nextHistoryDraft(state, ENTRIES, "npm r", "prev");
    state = prevOne.state;
    expect(prevOne.draft).toBe("npm run build");

    const prevTwo = nextHistoryDraft(state, ENTRIES, "npm r", "prev");
    state = prevTwo.state;
    expect(prevTwo.draft).toBe("npm test");

    const downOne = nextHistoryDraft(state, ENTRIES, "npm r", "next");
    state = downOne.state;
    expect(downOne.draft).toBe("npm run build");

    const downTwo = nextHistoryDraft(state, ENTRIES, "npm r", "next");
    expect(downTwo.draft).toBe("npm r");
  });
});
