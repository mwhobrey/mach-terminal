/** Session input posture: Operator (composer) or Commander (raw PTY). */
export type SessionInputMode = "operator" | "commander";

/** Legacy persisted value from builds that used `console`. */
export type LegacySessionInputMode = SessionInputMode | "console" | "ai";

export const INPUT_MODE_CYCLE: readonly SessionInputMode[] = ["operator", "commander"];

const MODE_LABELS: Record<SessionInputMode, string> = {
  operator: "Operator",
  commander: "Commander",
};

export function defaultSessionInputMode(): SessionInputMode {
  return "operator";
}

export function parseSessionInputMode(raw: unknown): SessionInputMode {
  if (raw === "commander" || raw === "console") {
    return "commander";
  }
  if (raw === "operator" || raw === "ai") {
    // `ai` was a retired third mode — restore as Operator (AI is composer toggle now).
    return "operator";
  }
  return defaultSessionInputMode();
}

export function cycleSessionInputMode(current: SessionInputMode): SessionInputMode {
  const index = INPUT_MODE_CYCLE.indexOf(current);
  const next = index < 0 ? 0 : (index + 1) % INPUT_MODE_CYCLE.length;
  return INPUT_MODE_CYCLE[next] ?? defaultSessionInputMode();
}

export function inputModeLabel(mode: SessionInputMode): string {
  return MODE_LABELS[mode];
}

export function inputModeUsesComposer(mode: SessionInputMode): boolean {
  return mode === "operator";
}

export function inputModeUsesXtermStdin(mode: SessionInputMode): boolean {
  return mode === "commander";
}

/** Sacred chord: Ctrl+` cycles Operator ↔ Commander. Never forwarded to PTY. */
export function isInputModeCycleChord(event: Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "key">): boolean {
  if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    return false;
  }
  return event.key === "`" || event.key === "Backquote";
}

export function composerPlaceholderForMode(mode: SessionInputMode, locked: boolean, aiIntent: boolean): string {
  if (locked) {
    return "Session unavailable…";
  }
  if (mode === "commander") {
    return "Commander mode — use the terminal tape.";
  }
  if (aiIntent) {
    return "Ask AI — Enter sends to the AI panel (Ctrl+` for Commander)…";
  }
  return "Type a command — press ? to ask AI…";
}
