/** User-facing error text: prefer Error.message, otherwise the supplied fallback. */
export function surfaceErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}

/** Tauri invoke rejects with plain strings; normalize for user-facing banners. */
export function messageFromUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}
