export type BroadcastMode = "off" | "once" | "sticky";

export function isBroadcastArmed(mode: BroadcastMode): boolean {
  return mode !== "off";
}

/** Migrate legacy boolean snapshots and unknown values. */
export function normalizeBroadcastMode(raw: unknown): BroadcastMode {
  if (raw === true) {
    return "once";
  }
  if (raw === false || raw == null) {
    return "off";
  }
  if (raw === "off" || raw === "once" || raw === "sticky") {
    return raw;
  }
  return "off";
}

export function broadcastModeLabel(mode: BroadcastMode): string {
  switch (mode) {
    case "once":
      return "Broadcast (one-shot)";
    case "sticky":
      return "Broadcast (sticky)";
    default:
      return "Broadcast";
  }
}
