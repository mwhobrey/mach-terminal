import { describe, expect, it } from "vitest";
import type { SessionExitedInfo } from "./sessionLifecycle";
import {
  buildTabLabels,
  buildTabTooltip,
  collectExitedSessionIds,
  isExitedTab,
  tabShortLabel,
} from "./sessionTabStatus";

function info(partial: Partial<SessionExitedInfo> = {}): SessionExitedInfo {
  return {
    status: "stopped",
    message: null,
    timestampMs: 0,
    exitCode: null,
    ...partial,
  };
}

describe("buildTabTooltip", () => {
  it("returns the legacy switch message for non-terminal statuses", () => {
    expect(buildTabTooltip("running", null)).toBe("Switch session");
    expect(buildTabTooltip("idle", null)).toBe("Switch session");
  });

  it("returns the starting hint while the session is spinning up", () => {
    expect(buildTabTooltip("starting", null)).toBe("Starting session...");
  });

  it("falls back to click-to-focus when the exited message is empty", () => {
    expect(buildTabTooltip("stopped", null)).toBe("Session stopped - click to focus pane");
    expect(buildTabTooltip("closed", "")).toBe("Session closed - click to focus pane");
    expect(buildTabTooltip("error", "   ")).toBe("Session error - click to focus pane");
  });

  it("inlines the exit message for terminal statuses with a reason", () => {
    expect(buildTabTooltip("error", "boom")).toBe("Session error: boom");
    expect(buildTabTooltip("stopped", "shell exited cleanly")).toBe(
      "Session stopped: shell exited cleanly",
    );
  });

  it("appends (code <n>) when an exit code is known and a message is present", () => {
    expect(buildTabTooltip("stopped", "shell exited", 7)).toBe(
      "Session stopped (code 7): shell exited",
    );
  });

  it("appends (code <n>) before the click-to-focus hint when no message is present", () => {
    expect(buildTabTooltip("stopped", null, 0)).toBe(
      "Session stopped (code 0) - click to focus pane",
    );
    expect(buildTabTooltip("error", "   ", 137)).toBe(
      "Session error (code 137) - click to focus pane",
    );
  });

  it("omits the code suffix when exitCode is null (backend did not report one)", () => {
    expect(buildTabTooltip("stopped", "shell exited", null)).toBe(
      "Session stopped: shell exited",
    );
  });

  it("ignores exitCode on non-terminal statuses", () => {
    expect(buildTabTooltip("running", null, 7)).toBe("Switch session");
    expect(buildTabTooltip("starting", null, 7)).toBe("Starting session...");
  });
});

describe("collectExitedSessionIds", () => {
  it("drops ids that are not in the exited map", () => {
    const map = { "sess-a": info(), "sess-b": info() };
    expect(collectExitedSessionIds(map, ["sess-a", "sess-c", "sess-b"])).toEqual([
      "sess-a",
      "sess-b",
    ]);
  });

  it("drops map keys that are not in the caller-provided order", () => {
    const map = { "sess-a": info(), "sess-b": info(), "sess-orphan": info() };
    expect(collectExitedSessionIds(map, ["sess-a", "sess-b"])).toEqual(["sess-a", "sess-b"]);
  });

  it("preserves the caller-provided order regardless of map key order", () => {
    const map: Record<string, SessionExitedInfo> = {};
    map["sess-z"] = info();
    map["sess-a"] = info();
    expect(collectExitedSessionIds(map, ["sess-a", "sess-z"])).toEqual(["sess-a", "sess-z"]);
  });

  it("returns an empty list when nothing overlaps", () => {
    expect(collectExitedSessionIds({}, ["sess-a"])).toEqual([]);
    expect(collectExitedSessionIds({ "sess-a": info() }, [])).toEqual([]);
  });
});

describe("isExitedTab", () => {
  it("is false when the status is not terminal", () => {
    expect(isExitedTab("running", info())).toBe(false);
    expect(isExitedTab("starting", info())).toBe(false);
    expect(isExitedTab("idle", info())).toBe(false);
  });

  it("is false when the exited info is missing", () => {
    expect(isExitedTab("stopped", undefined)).toBe(false);
  });

  it("narrows to true when both the status is terminal and info is present", () => {
    const maybe: SessionExitedInfo | undefined = info({ status: "error", message: "bad" });
    if (isExitedTab("error", maybe)) {
      expect(maybe.message).toBe("bad");
    } else {
      throw new Error("expected isExitedTab to narrow the info");
    }
  });
});

describe("tabShortLabel", () => {
  it("strips Windows paths and the .exe suffix", () => {
    expect(tabShortLabel("C:\\WINDOWS\\system32\\wsl.exe")).toBe("wsl");
    expect(tabShortLabel("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBe("pwsh");
  });

  it("handles POSIX shell paths", () => {
    expect(tabShortLabel("/usr/bin/bash")).toBe("bash");
    expect(tabShortLabel("/bin/zsh")).toBe("zsh");
  });

  it("falls back to a generic label for empty input", () => {
    expect(tabShortLabel("")).toBe("shell");
    expect(tabShortLabel("   ")).toBe("shell");
  });

  it("returns a bare shell name unchanged (lowercased)", () => {
    expect(tabShortLabel("cmd.exe")).toBe("cmd");
    expect(tabShortLabel("fish")).toBe("fish");
  });
});

describe("buildTabLabels", () => {
  const wsl = "C:\\WINDOWS\\system32\\wsl.exe";
  const pwsh = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";

  it("leaves a lone shell unnumbered", () => {
    const labels = buildTabLabels([{ id: "s1", shell: wsl }], {});
    expect(labels).toEqual({ s1: "wsl" });
  });

  it("numbers shells that share a short name, left to right", () => {
    const labels = buildTabLabels(
      [
        { id: "s1", shell: wsl },
        { id: "s2", shell: wsl },
        { id: "s3", shell: pwsh },
      ],
      {},
    );
    expect(labels).toEqual({ s1: "wsl 1", s2: "wsl 2", s3: "pwsh" });
  });

  it("lets a custom name win and excludes it from sibling numbering", () => {
    const labels = buildTabLabels(
      [
        { id: "s1", shell: wsl },
        { id: "s2", shell: wsl },
      ],
      { s1: "build" },
    );
    // s2 is now the only uncustomized wsl, so it stays bare.
    expect(labels).toEqual({ s1: "build", s2: "wsl" });
  });

  it("still numbers the remaining uncustomized siblings when 2+ remain", () => {
    const labels = buildTabLabels(
      [
        { id: "s1", shell: wsl },
        { id: "s2", shell: wsl },
        { id: "s3", shell: wsl },
      ],
      { s2: "deploy" },
    );
    expect(labels).toEqual({ s1: "wsl 1", s2: "deploy", s3: "wsl 2" });
  });

  it("treats whitespace-only custom names as unset", () => {
    const labels = buildTabLabels([{ id: "s1", shell: wsl }], { s1: "   " });
    expect(labels).toEqual({ s1: "wsl" });
  });
});
