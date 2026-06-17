/** Milliseconds without PTY output before we hint the session may be hung. */
export const SESSION_OUTPUT_STALE_MS = 45_000;

/**
 * True when a session is still marked running but has not emitted output recently.
 * Requires at least one output event so idle shells right after spawn are not flagged.
 */
export function isSessionOutputStale(
  status: string,
  lastOutputAtMs: number | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (status !== "running" || lastOutputAtMs == null) {
    return false;
  }
  return nowMs - lastOutputAtMs >= SESSION_OUTPUT_STALE_MS;
}
