import type { AiChatState } from "./aiChatState";
import { persistAiChatsForSessions, prunePersistedAiChats } from "./aiChatPersistence";
import type { SessionInputMode } from "./inputMode";
import type { PtySessionInfo } from "./terminal";
import { workspaceLayoutSet } from "./terminal";
import type { SessionCwdMap } from "./sessionCwd";
import {
  buildRestorableSessions,
  snapshotWorkspace,
  workspaceLayoutFromSnapshot,
  type WorkspaceState,
} from "../state/workspace";

export type ExitPersistPhase = "ai-chats" | "workspace-layout" | "closing";

export type ExitPersistSnapshot = {
  workspace: WorkspaceState;
  sessions: PtySessionInfo[];
  sessionCwd: SessionCwdMap;
  sessionNames: Record<string, string>;
  sessionInputModes: Record<string, SessionInputMode>;
  sessionChatKeys: Record<string, string>;
  aiChatState: AiChatState;
  sessionsById: Record<string, PtySessionInfo>;
};

export function exitPersistCopy(phase: ExitPersistPhase): { title: string; detail: string } {
  switch (phase) {
    case "ai-chats":
      return {
        title: "Saving AI chat history",
        detail:
          "Mach is writing your per-session AI threads to local storage so they restore after the next launch.",
      };
    case "workspace-layout":
      return {
        title: "Saving workspace layout",
        detail:
          "Mach is writing your tabs, split panes, shells, and session metadata to disk before closing.",
      };
    case "closing":
      return {
        title: "Closing Mach Terminal",
        detail: "Save complete. Shutting down now.",
      };
  }
}

export const EXIT_PERSIST_PHASES: readonly ExitPersistPhase[] = ["ai-chats", "workspace-layout", "closing"];

/** Give React a frame to paint the exit overlay before blocking on I/O. */
export async function yieldForExitOverlayPaint(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function flushPersistedStateForExit(
  snap: ExitPersistSnapshot,
  bootstrapped: boolean,
  onPhase?: (phase: ExitPersistPhase) => void,
): Promise<void> {
  if (!bootstrapped) {
    return;
  }
  onPhase?.("ai-chats");
  const restorable = buildRestorableSessions(
    snap.sessions,
    (id) => snap.sessionCwd[id] ?? snap.sessionsById[id]?.cwd,
    snap.sessionNames,
    snap.sessionInputModes,
    snap.sessionChatKeys,
  );
  const layout = workspaceLayoutFromSnapshot(snapshotWorkspace(snap.workspace), restorable);
  persistAiChatsForSessions(snap.aiChatState, snap.sessionChatKeys);
  prunePersistedAiChats(new Set(Object.values(snap.sessionChatKeys)));
  onPhase?.("workspace-layout");
  try {
    await workspaceLayoutSet(layout);
  } catch (error) {
    console.warn("failed to persist workspace layout on exit", error);
  }
  onPhase?.("closing");
}
