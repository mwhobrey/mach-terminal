import { describe, expect, it } from "vitest";
import { normalizeBroadcastMode } from "./broadcastMode";
import {
  armBroadcastSticky,
  createWorkspaceState,
  getActiveGroup,
  setBroadcastMode,
  toggleBroadcastOnce,
} from "../state/workspace";

describe("normalizeBroadcastMode", () => {
  it("maps legacy boolean true to once", () => {
    expect(normalizeBroadcastMode(true)).toBe("once");
  });

  it("maps legacy boolean false to off", () => {
    expect(normalizeBroadcastMode(false)).toBe("off");
  });

  it("preserves string modes", () => {
    expect(normalizeBroadcastMode("sticky")).toBe("sticky");
  });
});

describe("broadcastMode workspace", () => {
  it("arms one-shot broadcast", () => {
    const next = toggleBroadcastOnce(createWorkspaceState());
    expect(getActiveGroup(next)?.broadcastMode).toBe("once");
  });

  it("disarms one-shot when toggled again", () => {
    const armed = toggleBroadcastOnce(createWorkspaceState());
    const next = toggleBroadcastOnce(armed);
    expect(getActiveGroup(next)?.broadcastMode).toBe("off");
  });

  it("arms sticky broadcast", () => {
    const next = armBroadcastSticky(createWorkspaceState());
    expect(getActiveGroup(next)?.broadcastMode).toBe("sticky");
  });

  it("setBroadcastMode applies explicit mode", () => {
    const next = setBroadcastMode(createWorkspaceState(), "sticky");
    expect(getActiveGroup(next)?.broadcastMode).toBe("sticky");
  });
});
