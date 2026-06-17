/** Operator composer: shell command vs AI prompt (toggled with `?`, not typed into the draft). */
export type ComposerSubmitKind = "command" | "ai";

export function defaultComposerSubmitKind(): ComposerSubmitKind {
  return "command";
}

export function toggleComposerSubmitKind(current: ComposerSubmitKind): ComposerSubmitKind {
  return current === "command" ? "ai" : "command";
}

export function composerSubmitKindLabel(kind: ComposerSubmitKind): string {
  return kind === "ai" ? "AI" : "Cmd";
}

/** `?` toggles AI intent without inserting into the draft. */
export function isComposerAiToggleKey(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  // On US layouts `?` is Shift+/ — shift must not block the toggle.
  if (event.key === "?") {
    return true;
  }
  return event.key === "/" && event.shiftKey;
}

export function shellEchoForAiPrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return "";
  }
  return `# AI: ${trimmed.replace(/\r?\n/g, " ")}`;
}

/**
 * Cross-shell safe tape echo (zsh interactive does not treat `#` as a comment unless
 * `interactivecomments` is set — use printf instead of piping a raw comment line).
 */
export function shellEchoCommandForAiPrompt(prompt: string): string {
  const line = shellEchoForAiPrompt(prompt);
  if (line.length === 0) {
    return "";
  }
  const escaped = line.replace(/'/g, "'\\''");
  return `printf '%s\\n' '${escaped}'`;
}
