import type { HistoryEntry } from "./terminal";

export type ComposerHistoryDirection = "prev" | "next";

export interface ComposerHistoryState {
  index: number;
  baselineDraft: string | null;
}

export function createComposerHistoryState(): ComposerHistoryState {
  return { index: -1, baselineDraft: null };
}

export function predictionForDraft(draft: string, entries: HistoryEntry[]): string | null {
  const trimmed = draft.trim();
  if (!trimmed) {
    return null;
  }
  for (const entry of entries) {
    const command = entry.command.trim();
    if (!command || command === trimmed) {
      continue;
    }
    if (command.toLowerCase().startsWith(trimmed.toLowerCase())) {
      return command;
    }
  }
  return null;
}

export function nextHistoryDraft(
  state: ComposerHistoryState,
  entries: HistoryEntry[],
  currentDraft: string,
  direction: ComposerHistoryDirection,
): { state: ComposerHistoryState; draft: string | null } {
  if (entries.length === 0) {
    return { state, draft: null };
  }

  if (direction === "prev") {
    if (state.index + 1 >= entries.length) {
      return { state, draft: entries[entries.length - 1]?.command ?? null };
    }
    const baseline = state.index < 0 ? currentDraft : state.baselineDraft;
    const nextState: ComposerHistoryState = {
      index: state.index + 1,
      baselineDraft: baseline ?? "",
    };
    const draft = entries[nextState.index]?.command ?? null;
    return { state: nextState, draft };
  }

  if (state.index < 0) {
    return { state, draft: null };
  }
  const nextIndex = state.index - 1;
  if (nextIndex < 0) {
    const draft = state.baselineDraft ?? "";
    return { state: createComposerHistoryState(), draft };
  }
  const nextState: ComposerHistoryState = { ...state, index: nextIndex };
  return { state: nextState, draft: entries[nextIndex]?.command ?? null };
}
