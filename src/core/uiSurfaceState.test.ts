import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_SURFACE_STATE,
  mergeUiSurfaceState,
  reduceUiSurfaceStateForRequest,
  uiSurfaceFindLabel,
  uiSurfaceFollowLabel,
} from "./uiSurfaceState";

describe("uiSurfaceState reducers", () => {
  it("normalizes merged find query state", () => {
    const next = mergeUiSurfaceState(DEFAULT_UI_SURFACE_STATE, {
      findOpen: true,
      findQuery: "foo\r\nbar",
    });
    expect(next).toEqual({
      followOutput: true,
      findOpen: true,
      findQuery: "foo\nbar",
    });
  });

  it("updates canonical state for terminal requests", () => {
    const opened = reduceUiSurfaceStateForRequest(DEFAULT_UI_SURFACE_STATE, { kind: "openFind" });
    const jumped = reduceUiSurfaceStateForRequest(opened, { kind: "jumpSearch", query: "npm test\n--watch" });
    const toggled = reduceUiSurfaceStateForRequest(jumped, { kind: "toggleFollowOutput" });
    const scrolled = reduceUiSurfaceStateForRequest(toggled, { kind: "scrollToBottom" });
    expect(opened.findOpen).toBe(true);
    expect(jumped).toEqual({
      followOutput: false,
      findOpen: true,
      findQuery: "npm test",
    });
    expect(toggled.followOutput).toBe(true);
    expect(scrolled.followOutput).toBe(true);
  });

  it("keeps label formatting stable", () => {
    expect(uiSurfaceFollowLabel(true)).toBe("Follow output: on");
    expect(uiSurfaceFollowLabel(false)).toBe("Follow output: off");
    expect(uiSurfaceFindLabel({ findOpen: false, findQuery: "foo" })).toBe("Find: closed");
    expect(uiSurfaceFindLabel({ findOpen: true, findQuery: "" })).toBe("Find: open");
    expect(uiSurfaceFindLabel({ findOpen: true, findQuery: "build" })).toBe("Find: build");
  });
});
