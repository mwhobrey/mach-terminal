import { describe, expect, it } from "vitest";
import { canRestoreShellBackup, healthBadgeLabel, shellTargetFromKind } from "./ShellIntegrationSection";

describe("canRestoreShellBackup", () => {
  it("requires a selected backup id", () => {
    expect(canRestoreShellBackup({ busy: false, backupBusy: false, backupSelectedId: null })).toBe(false);
  });

  it("disables restore while any operation is busy", () => {
    expect(canRestoreShellBackup({ busy: true, backupBusy: false, backupSelectedId: "id" })).toBe(false);
    expect(canRestoreShellBackup({ busy: false, backupBusy: true, backupSelectedId: "id" })).toBe(false);
  });

  it("enables restore for idle state with selected backup", () => {
    expect(canRestoreShellBackup({ busy: false, backupBusy: false, backupSelectedId: "id" })).toBe(true);
  });
});

describe("shell integration rendering helpers", () => {
  it("maps known shell kinds and ignores unknown rows", () => {
    expect(shellTargetFromKind("pwsh")).toBe("pwsh");
    expect(shellTargetFromKind("bash")).toBe("bash");
    expect(shellTargetFromKind("zsh")).toBe("zsh");
    expect(shellTargetFromKind("powershell")).toBeNull();
    expect(shellTargetFromKind("fish")).toBeNull();
  });

  it("keeps health badge labels stable for known states", () => {
    expect(healthBadgeLabel("healthy")).toBe("health: healthy");
    expect(healthBadgeLabel("stale")).toBe("health: stale");
    expect(healthBadgeLabel("missing")).toBe("health: missing");
    expect(healthBadgeLabel("error")).toBe("health: error");
    expect(healthBadgeLabel("unexpected")).toBe("health: unexpected");
  });
});
