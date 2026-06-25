import { describe, expect, it } from "vitest";
import { FOCUS_ACTIVE_TERMINAL_EVENT } from "./workspaceFocus";
import {
  activeGroupLayout,
  addNewSessionTab,
  createWorkspaceState,
  selectTabGroup,
  setPaneSession,
  type WorkspaceState,
} from "../state/workspace";

function activePaneId(state: WorkspaceState): string {
  return activeGroupLayout(state).activePaneId;
}

describe("workspace focus smoke contracts", () => {
  it("exposes a stable Commander focus event name", () => {
    expect(FOCUS_ACTIVE_TERMINAL_EVENT).toBe("mach-terminal:focus-active-terminal");
  });

  it("selectTabGroup syncs composer target to focused pane after tab switch", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, activePaneId(workspace), "session-a");
    workspace = addNewSessionTab(workspace, ["session-a"], "session-b");
    const secondGroupId = workspace.groups[1]!.id;
    const stale = {
      ...workspace.groups[1]!,
      activePaneId: "ghost-pane",
      targetPaneId: "also-ghost",
    };
    workspace = {
      ...workspace,
      groups: workspace.groups.map((group) => (group.id === secondGroupId ? stale : group)),
    };

    const selected = selectTabGroup(workspace, secondGroupId);
    const layout = activeGroupLayout({ ...selected, activeGroupId: secondGroupId });
    expect(layout.activePaneId).toBe(layout.targetPaneId);
    expect(layout.panes.some((pane) => pane.id === layout.activePaneId)).toBe(true);
    expect(selected.activeGroupId).toBe(secondGroupId);
  });
});
