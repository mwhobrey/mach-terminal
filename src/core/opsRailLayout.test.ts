import { describe, expect, it } from "vitest";
import {
  clampOpsRailWidth,
  OPS_RAIL_WIDTH_DEFAULT,
  OPS_RAIL_WIDTH_MAX,
  OPS_RAIL_WIDTH_MIN,
  opsRailWidthForPointerDelta,
} from "./opsRailLayout";

describe("opsRailLayout", () => {
  it("clamps rail width", () => {
    expect(clampOpsRailWidth(100)).toBe(OPS_RAIL_WIDTH_MIN);
    expect(clampOpsRailWidth(999)).toBe(OPS_RAIL_WIDTH_MAX);
    expect(clampOpsRailWidth(OPS_RAIL_WIDTH_DEFAULT)).toBe(OPS_RAIL_WIDTH_DEFAULT);
  });

  it("grows the rail when the handle moves left", () => {
    expect(opsRailWidthForPointerDelta(280, -40)).toBe(320);
    expect(opsRailWidthForPointerDelta(280, 40)).toBe(240);
  });
});
