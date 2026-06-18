import type { HistoryEntry } from "./terminal";

/** UI cap for composer ↑/↓ and settings history (matches `COMPOSER_HISTORY_WINDOW`). */
export const HISTORY_UI_LIMIT = 250;

/**
 * Merge a freshly submitted command into the newest-first history list used by the UI.
 * Backend persists before emitting `command_submitted`; this avoids a round-trip on every Enter.
 */
export function prependHistoryEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  limit = HISTORY_UI_LIMIT,
): HistoryEntry[] {
  const command = entry.command.trim();
  if (!command) {
    return entries;
  }
  const normalized: HistoryEntry = { ...entry, command };
  const withoutDupId = entries.filter((candidate) => candidate.id !== normalized.id);
  const withoutDupHead =
    withoutDupId[0]?.command === normalized.command &&
    withoutDupId[0]?.session_id === normalized.session_id
      ? withoutDupId.slice(1)
      : withoutDupId;
  return [normalized, ...withoutDupHead].slice(0, limit);
}
