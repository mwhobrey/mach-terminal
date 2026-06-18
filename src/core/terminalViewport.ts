import type { Terminal } from "@xterm/xterm";

/**
 * True when the viewport shows the newest buffer lines (within optional line threshold).
 * Uses buffer length vs visible rows — more reliable than `viewportY >= baseY` after long scrollback.
 */
export function isViewportAtBottom(terminal: Terminal, threshold = 0): boolean {
  const buffer = terminal.buffer.active;
  return buffer.baseY + terminal.rows >= buffer.length - threshold;
}

/** Reflow canvas rows after scroll/resize to fix prompt column drift (WebView2/xterm). */
export function refreshTerminalViewport(terminal: Terminal): void {
  terminal.refresh(0, Math.max(0, terminal.rows - 1));
}
