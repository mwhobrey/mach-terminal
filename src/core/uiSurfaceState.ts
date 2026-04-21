import type { TerminalUiRequest } from "./terminalUiRequest";

export interface UiSurfaceState {
  followOutput: boolean;
  findOpen: boolean;
  findQuery: string;
}

export type UiSurfaceStatePatch = Partial<UiSurfaceState>;
export type UiSurfaceStateRequest =
  | { kind: Exclude<TerminalUiRequest["kind"], "jumpSearch"> }
  | { kind: "jumpSearch"; query: string };

export const DEFAULT_UI_SURFACE_STATE: UiSurfaceState = {
  followOutput: true,
  findOpen: false,
  findQuery: "",
};

function normalizeFindQuery(query: string): string {
  return query.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function mergeUiSurfaceState(current: UiSurfaceState, patch: UiSurfaceStatePatch): UiSurfaceState {
  const next = { ...current, ...patch };
  if (typeof patch.findQuery === "string") {
    next.findQuery = normalizeFindQuery(patch.findQuery);
  }
  return next;
}

export function reduceUiSurfaceStateForRequest(
  current: UiSurfaceState,
  request: UiSurfaceStateRequest,
): UiSurfaceState {
  switch (request.kind) {
    case "openFind":
      return mergeUiSurfaceState(current, { findOpen: true });
    case "scrollToBottom":
      return mergeUiSurfaceState(current, { followOutput: true });
    case "toggleFollowOutput":
      return mergeUiSurfaceState(current, { followOutput: !current.followOutput });
    case "jumpSearch": {
      const query = request.query.split(/\r?\n/)[0]?.trim() ?? "";
      if (!query) {
        return current;
      }
      return mergeUiSurfaceState(current, {
        findOpen: true,
        findQuery: query,
        followOutput: false,
      });
    }
    default:
      return current;
  }
}

export function uiSurfaceFollowLabel(followOutput: boolean): string {
  return followOutput ? "Follow output: on" : "Follow output: off";
}

export function uiSurfaceFindLabel(state: Pick<UiSurfaceState, "findOpen" | "findQuery">): string {
  if (!state.findOpen) {
    return "Find: closed";
  }
  if (state.findQuery.trim().length === 0) {
    return "Find: open";
  }
  return `Find: ${state.findQuery}`;
}
