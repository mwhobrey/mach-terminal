import { describe, expect, it } from "vitest";
import { isViewportAtBottom } from "./terminalViewport";
import type { Terminal } from "@xterm/xterm";

function mockTerminal(args: { baseY: number; rows: number; length: number }): Terminal {
  return {
    rows: args.rows,
    buffer: { active: { baseY: args.baseY, length: args.length } },
  } as Terminal;
}

describe("isViewportAtBottom", () => {
  it("returns true when visible window covers the buffer tail", () => {
    expect(isViewportAtBottom(mockTerminal({ baseY: 970, rows: 30, length: 1000 }))).toBe(true);
  });

  it("returns false when scrollback leaves tail off-screen", () => {
    expect(isViewportAtBottom(mockTerminal({ baseY: 0, rows: 30, length: 1000 }))).toBe(false);
  });
});
