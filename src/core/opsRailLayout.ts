export const OPS_RAIL_WIDTH_STORAGE_KEY = "mach-terminal.opsRail.width";

export const OPS_RAIL_WIDTH_DEFAULT = 280;
export const OPS_RAIL_WIDTH_MIN = 200;
export const OPS_RAIL_WIDTH_MAX = 560;

export function clampOpsRailWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return OPS_RAIL_WIDTH_DEFAULT;
  }
  return Math.min(Math.max(Math.round(width), OPS_RAIL_WIDTH_MIN), OPS_RAIL_WIDTH_MAX);
}

export function loadOpsRailWidth(): number {
  if (typeof window === "undefined") {
    return OPS_RAIL_WIDTH_DEFAULT;
  }
  try {
    const raw = window.localStorage.getItem(OPS_RAIL_WIDTH_STORAGE_KEY);
    if (!raw) {
      return OPS_RAIL_WIDTH_DEFAULT;
    }
    return clampOpsRailWidth(Number.parseInt(raw, 10));
  } catch {
    return OPS_RAIL_WIDTH_DEFAULT;
  }
}

export function saveOpsRailWidth(width: number): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(OPS_RAIL_WIDTH_STORAGE_KEY, String(clampOpsRailWidth(width)));
  } catch {
    /* ignore */
  }
}

/** Dragging the handle left (negative deltaX) grows the rail on the right. */
export function opsRailWidthForPointerDelta(startWidth: number, deltaX: number): number {
  return clampOpsRailWidth(startWidth - deltaX);
}
