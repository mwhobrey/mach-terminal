import { describe, expect, it } from "vitest";
import { deriveExitedInfo } from "./sessionLifecycle";
import { getRestartCwd } from "./sessionCwd";
import { summarizeExitedInfo } from "./sessionExitSummary";
import { buildTabTooltip, collectExitedSessionIds } from "./sessionTabStatus";
import type { PtyLifecycleEvent } from "./terminal";
import type { SessionExitedInfo } from "./sessionLifecycle";

describe("Exited-session lifecycle smoke contracts", () => {
  it("derives overlay lines and tooltip text from lifecycle events", () => {
    const event: PtyLifecycleEvent = {
      session_id: "sess-1",
      status: "stopped",
      message: "shell exited",
      timestamp_ms: 42,
      exit_code: 5,
    };
    const exited = deriveExitedInfo(event);
    expect(exited).not.toBeNull();
    expect(exited).toEqual({
      status: "stopped",
      message: "shell exited",
      timestampMs: 42,
      exitCode: 5,
    });

    const summary = summarizeExitedInfo(exited!);
    expect(summary).toEqual({
      headline: "Session stopped",
      detail: "shell exited",
      codeLine: "Exited with code 5",
    });
    expect(buildTabTooltip(exited!.status, exited!.message, exited!.exitCode)).toBe(
      "Session stopped (code 5): shell exited",
    );
  });

  it("keeps exited-session batch order stable by tab order", () => {
    const sessionExited: Record<string, SessionExitedInfo> = {
      "sess-c": { status: "error", message: "boom", timestampMs: 1, exitCode: null },
      "sess-a": { status: "closed", message: null, timestampMs: 2, exitCode: null },
      "sess-b": { status: "stopped", message: "done", timestampMs: 3, exitCode: 0 },
    };
    expect(collectExitedSessionIds(sessionExited, ["sess-a", "sess-b", "sess-c"])).toEqual([
      "sess-a",
      "sess-b",
      "sess-c",
    ]);
  });

  it("prefers tracked cwd for restart and falls back safely", () => {
    expect(getRestartCwd({ "sess-1": "/workspace/current" }, "sess-1", "/workspace/default")).toBe(
      "/workspace/current",
    );
    expect(getRestartCwd({}, "sess-1", "/workspace/default")).toBe("/workspace/default");
    expect(getRestartCwd({}, "sess-1", null)).toBeNull();
  });
});
