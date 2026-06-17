import { isTerminalStatus, type SessionExitedInfo } from "./sessionLifecycle";
import type { SessionStatus } from "./terminal";

/**
 * Alias kept local so downstream components can import a single symbol for
 * status-variant work without reaching into `./terminal` for the full enum.
 */
export type TabStatusVariant = SessionStatus;

/**
 * Compose the `title` string we hang off a `.tab-btn`. Non-terminal statuses
 * get the legacy "Switch session" / "Starting session..." phrasing so hover
 * feedback on healthy tabs does not regress. Terminal statuses carry either
 * "click to focus pane" (no message) or "<status>: <message>" so hovering a
 * dead tab surfaces the exit reason without opening the pane.
 *
 * When the backend reported an exit code via `PtyLifecycleEvent.exit_code` we
 * splice a `(code <n>)` fragment between the status and the message so the
 * tooltip mirrors what the exit overlay shows in its dedicated code line.
 */
export function buildTabTooltip(
  status: SessionStatus,
  exitedMessage: string | null,
  exitCode: number | null = null,
): string {
  if (status === "starting") {
    return "Starting session...";
  }
  if (!isTerminalStatus(status)) {
    return "Switch session";
  }
  const trimmed = (exitedMessage ?? "").trim();
  const codeSuffix = exitCode !== null ? ` (code ${exitCode})` : "";
  if (trimmed.length === 0) {
    return `Session ${status}${codeSuffix} - click to focus pane`;
  }
  return `Session ${status}${codeSuffix}: ${trimmed}`;
}

/**
 * Return the session ids that are currently in the `sessionExited` map,
 * preserving the caller-provided `order`. Callers pass `sessions.map(s => s.id)`
 * so batch operations walk tabs left-to-right instead of relying on the
 * non-deterministic `Object.keys` insertion order of the exited map.
 */
export function collectExitedSessionIds(
  sessionExited: Record<string, SessionExitedInfo>,
  order: readonly string[],
): string[] {
  return order.filter((id) => Object.prototype.hasOwnProperty.call(sessionExited, id));
}

/**
 * Short, meaningful tab label derived from the shell path. Tabs live in the
 * compact titlebar now, so we drop the full executable path + status word and
 * show just the shell name: the last path segment (handles both `\\` and `/`)
 * with a trailing `.exe` stripped, lowercased. Full session/shell/status detail
 * still lives in the tab's `title`/`aria-label` tooltip (`buildTabTooltip`).
 */
export function tabShortLabel(shell: string): string {
  const trimmed = (shell ?? "").trim();
  if (trimmed.length === 0) {
    return "shell";
  }
  const base = trimmed.split(/[\\/]/).pop() ?? trimmed;
  const noExt = base.replace(/\.exe$/i, "");
  return (noExt || base).toLowerCase();
}

/** Minimal session shape the label builder needs. */
export interface TabLabelSession {
  id: string;
  shell: string;
}

function customName(names: Record<string, string | undefined>, id: string): string {
  return (names[id] ?? "").trim();
}

/**
 * Compute the display label for every tab.
 *
 * - A user-set custom name always wins.
 * - Otherwise the label is the short shell name (`tabShortLabel`). When two or
 *   more *uncustomized* tabs share that short name we append a 1-based ordinal
 *   in left-to-right order ("wsl 1", "wsl 2"); a lone uncustomized tab stays
 *   bare ("wsl"). Custom-named siblings are excluded from the count so renaming
 *   one tab doesn't spuriously number the rest.
 */
export function buildTabLabels(
  sessions: readonly TabLabelSession[],
  names: Record<string, string | undefined>,
): Record<string, string> {
  const bases = sessions.map((session) => tabShortLabel(session.shell));
  const uncustomizedPerBase = new Map<string, number>();
  sessions.forEach((session, index) => {
    if (customName(names, session.id).length > 0) {
      return;
    }
    const base = bases[index];
    uncustomizedPerBase.set(base, (uncustomizedPerBase.get(base) ?? 0) + 1);
  });

  const ordinalCounters = new Map<string, number>();
  const labels: Record<string, string> = {};
  sessions.forEach((session, index) => {
    const custom = customName(names, session.id);
    if (custom.length > 0) {
      labels[session.id] = custom;
      return;
    }
    const base = bases[index];
    if ((uncustomizedPerBase.get(base) ?? 0) >= 2) {
      const ordinal = (ordinalCounters.get(base) ?? 0) + 1;
      ordinalCounters.set(base, ordinal);
      labels[session.id] = `${base} ${ordinal}`;
    } else {
      labels[session.id] = base;
    }
  });
  return labels;
}

/**
 * Narrow type guard so JSX branches in TabBar can pattern-match on
 * `{ status, exited }` pairs without repeating the `isTerminalStatus`
 * check plus an `!= null` on the map lookup.
 */
export function isExitedTab(
  status: SessionStatus,
  exited: SessionExitedInfo | undefined,
): exited is SessionExitedInfo {
  return isTerminalStatus(status) && exited !== undefined;
}
