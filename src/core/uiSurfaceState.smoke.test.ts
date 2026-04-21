import { describe, expect, it } from "vitest";
import { commandToTerminalUiIntent } from "./terminalCommandRouting";
import { DEFAULT_UI_SURFACE_STATE, reduceUiSurfaceStateForRequest } from "./uiSurfaceState";

describe("Cross-surface UI state smoke contracts", () => {
  it("keeps command routing and canonical state transitions aligned", () => {
    const openFindIntent = commandToTerminalUiIntent("terminal.openFind");
    const toggleFollowIntent = commandToTerminalUiIntent("terminal.toggleFollowOutput");
    const scrollBottomIntent = commandToTerminalUiIntent("terminal.scrollBottom");

    expect(openFindIntent).toBe("openFind");
    expect(toggleFollowIntent).toBe("toggleFollowOutput");
    expect(scrollBottomIntent).toBe("scrollToBottom");

    const openFindState = reduceUiSurfaceStateForRequest(DEFAULT_UI_SURFACE_STATE, { kind: "openFind" });
    const followOffState = reduceUiSurfaceStateForRequest(openFindState, { kind: "toggleFollowOutput" });
    const followOnState = reduceUiSurfaceStateForRequest(followOffState, { kind: "scrollToBottom" });

    expect(openFindState.findOpen).toBe(true);
    expect(followOffState.followOutput).toBe(false);
    expect(followOnState.followOutput).toBe(true);
  });

  it("keeps jump-search state parity for find + follow output surfaces", () => {
    const jumped = reduceUiSurfaceStateForRequest(DEFAULT_UI_SURFACE_STATE, {
      kind: "jumpSearch",
      query: "  npm run build --watch  ",
    });
    expect(jumped).toEqual({
      followOutput: false,
      findOpen: true,
      findQuery: "npm run build --watch",
    });
  });
});
