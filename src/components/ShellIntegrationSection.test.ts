import { describe, expect, it } from "vitest";
import { canRestorePwshBackup } from "./ShellIntegrationSection";

describe("canRestorePwshBackup", () => {
  it("requires a selected backup id", () => {
    expect(canRestorePwshBackup({ busy: false, backupBusy: false, backupSelectedId: null })).toBe(false);
  });

  it("disables restore while any operation is busy", () => {
    expect(canRestorePwshBackup({ busy: true, backupBusy: false, backupSelectedId: "id" })).toBe(false);
    expect(canRestorePwshBackup({ busy: false, backupBusy: true, backupSelectedId: "id" })).toBe(false);
  });

  it("enables restore for idle state with selected backup", () => {
    expect(canRestorePwshBackup({ busy: false, backupBusy: false, backupSelectedId: "id" })).toBe(true);
  });
});
