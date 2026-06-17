import { describe, expect, it } from "vitest";
import {
  buildRestorableSessions,
  closePane,
  createWorkspaceState,
  reconcileWorkspace,
  remapLayoutToSnapshot,
  resolveNextActivePaneIdAfterClose,
  removeSessionFromWorkspace,
  restoreWorkspaceFromSnapshot,
  setSplitDirection,
  setPaneSession,
  splitActivePane,
  workspaceLayoutFromSnapshot,
  WORKSPACE_LAYOUT_SCHEMA_VERSION,
} from "./workspace";

describe("workspace reconciliation", () => {
  it("reassigns active pane to first available session", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, workspace.activePaneId, "session-a");
    workspace = splitActivePane(workspace, "session-b");
    workspace = removeSessionFromWorkspace(workspace, "session-b", ["session-a"]);
    const activePane = workspace.panes.find((pane) => pane.id === workspace.activePaneId);
    expect(activePane?.sessionId).toBe("session-a");
  });

  it("drops pane session references for dead sessions", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, workspace.activePaneId, "session-a");
    const reconciled = reconcileWorkspace(workspace, []);
    expect(reconciled.panes[0].sessionId).toBeNull();
  });

  it("keeps chosen split orientation when splitting", () => {
    let workspace = createWorkspaceState();
    workspace = setSplitDirection(workspace, "row");
    workspace = splitActivePane(workspace, "session-a", "row");
    expect(workspace.splitDirection).toBe("row");
    expect(workspace.panes).toHaveLength(2);
  });

  it("chooses neighboring pane as active when closing active pane", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, workspace.activePaneId, "session-a");
    workspace = splitActivePane(workspace, "session-b", "column");
    workspace = splitActivePane(workspace, "session-c", "column");
    const activeBeforeClose = workspace.activePaneId;
    workspace = closePane(workspace, activeBeforeClose);
    expect(workspace.activePaneId).not.toBe(activeBeforeClose);
    expect(workspace.panes).toHaveLength(2);
  });

  it("keeps active pane unchanged when closing a non-active pane", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, workspace.activePaneId, "session-a");
    workspace = splitActivePane(workspace, "session-b", "column");
    const activePane = workspace.activePaneId;
    const firstPaneId = workspace.panes[0]?.id ?? activePane;
    workspace = closePane(workspace, firstPaneId);
    expect(workspace.activePaneId).toBe(activePane);
  });

  it("resolves deterministic active-pane fallback for rapid close sequences", () => {
    let workspace = createWorkspaceState();
    workspace = setPaneSession(workspace, workspace.activePaneId, "session-a");
    workspace = splitActivePane(workspace, "session-b", "row");
    workspace = splitActivePane(workspace, "session-c", "row");
    workspace = splitActivePane(workspace, "session-d", "row");
    const paneIds = workspace.panes.map((pane) => pane.id);
    expect(paneIds).toHaveLength(4);

    const nextAfterLastClose = resolveNextActivePaneIdAfterClose(
      workspace.panes,
      workspace.activePaneId,
      workspace.activePaneId,
    );
    expect(nextAfterLastClose).toBe(paneIds[2]);

    workspace = closePane(workspace, workspace.activePaneId);
    expect(workspace.activePaneId).toBe(paneIds[2]);
    workspace = closePane(workspace, workspace.activePaneId);
    expect(workspace.activePaneId).toBe(paneIds[1]);
    workspace = closePane(workspace, workspace.activePaneId);
    expect(workspace.activePaneId).toBe(paneIds[0]);
    workspace = closePane(workspace, workspace.activePaneId);
    expect(workspace.activePaneId).toBe(paneIds[0]);
    expect(workspace.panes).toHaveLength(1);
  });
});

describe("workspace restore", () => {
  it("restores valid snapshot when session ids exist", () => {
    const snapshot = JSON.stringify({
      rootPaneId: "pane-1",
      activePaneId: "pane-2",
      splitDirection: "column",
      panes: [
        { id: "pane-1", sessionId: "session-a" },
        { id: "pane-2", sessionId: "session-b" },
      ],
    });
    const restored = restoreWorkspaceFromSnapshot(snapshot, ["session-a", "session-b"], createWorkspaceState());
    expect(restored.activePaneId).toBe("pane-2");
    expect(restored.panes).toHaveLength(2);
  });

  it("falls back to provided state for malformed snapshot", () => {
    const fallback = createWorkspaceState();
    const restored = restoreWorkspaceFromSnapshot("{malformed", ["session-a"], fallback);
    expect(restored.panes).toHaveLength(1);
    expect(restored.activePaneId).toBe(fallback.activePaneId);
  });

  it("workspaceLayoutFromSnapshot adds schema version for disk payload", () => {
    const snap = {
      rootPaneId: "pane-1",
      activePaneId: "pane-1",
      splitDirection: "row" as const,
      panes: [{ id: "pane-1", sessionId: "s-1" as string | null }],
    };
    const layout = workspaceLayoutFromSnapshot(snap);
    expect(layout.schemaVersion).toBe(WORKSPACE_LAYOUT_SCHEMA_VERSION);
    expect(layout.splitDirection).toBe("row");
    expect(layout.panes[0].sessionId).toBe("s-1");
    expect(layout.sessions).toEqual([]);
  });

  it("workspaceLayoutFromSnapshot carries restorable sessions", () => {
    const snap = {
      rootPaneId: "pane-1",
      activePaneId: "pane-1",
      splitDirection: "column" as const,
      panes: [{ id: "pane-1", sessionId: "session-1" as string | null }],
    };
    const layout = workspaceLayoutFromSnapshot(snap, [
      { sessionId: "session-1", shell: "wsl.exe", cwd: "/home/me", name: "build" },
    ]);
    expect(layout.sessions).toEqual([{ sessionId: "session-1", shell: "wsl.exe", cwd: "/home/me", name: "build" }]);
  });
});

describe("buildRestorableSessions", () => {
  it("captures shell, cwd, and custom name, omitting empties", () => {
    const result = buildRestorableSessions(
      [
        { id: "session-1", shell: "wsl.exe" },
        { id: "session-2", shell: "pwsh.exe" },
      ],
      (id) => (id === "session-1" ? "/home/me" : undefined),
      { "session-2": "deploy" },
    );
    expect(result).toEqual([
      { sessionId: "session-1", shell: "wsl.exe", cwd: "/home/me" },
      { sessionId: "session-2", shell: "pwsh.exe", name: "deploy" },
    ]);
  });

  it("drops whitespace-only names", () => {
    const result = buildRestorableSessions([{ id: "session-1", shell: "bash" }], () => undefined, {
      "session-1": "   ",
    });
    expect(result).toEqual([{ sessionId: "session-1", shell: "bash" }]);
  });
});

describe("remapLayoutToSnapshot", () => {
  it("rewrites pane session ids via the id map and nulls unmapped ones", () => {
    const snapshot = remapLayoutToSnapshot(
      {
        rootPaneId: "pane-1",
        activePaneId: "pane-2",
        splitDirection: "row",
        panes: [
          { id: "pane-1", sessionId: "session-1" },
          { id: "pane-2", sessionId: "session-2" },
          { id: "pane-3", sessionId: "session-gone" },
        ],
      },
      { "session-1": "session-7", "session-2": "session-8" },
    );
    expect(snapshot.panes).toEqual([
      { id: "pane-1", sessionId: "session-7" },
      { id: "pane-2", sessionId: "session-8" },
      { id: "pane-3", sessionId: null },
    ]);
    expect(snapshot.activePaneId).toBe("pane-2");
    expect(snapshot.splitDirection).toBe("row");
  });
});
