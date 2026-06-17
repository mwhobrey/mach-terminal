import { describe, expect, it } from "vitest";
import { isComposerAiToggleKey, shellEchoCommandForAiPrompt, shellEchoForAiPrompt, toggleComposerSubmitKind } from "./composerAiIntent";
import { isAskFailureShortcut, buildFailureAiQuestion } from "./sessionCommandOutcome";

describe("composerAiIntent", () => {
  it("toggles command ↔ ai", () => {
    expect(toggleComposerSubmitKind("command")).toBe("ai");
    expect(toggleComposerSubmitKind("ai")).toBe("command");
  });

  it("detects ? toggle key (including Shift+/ on US keyboards)", () => {
    expect(isComposerAiToggleKey({ key: "?", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false })).toBe(true);
    expect(isComposerAiToggleKey({ key: "?", ctrlKey: false, metaKey: false, altKey: false, shiftKey: true })).toBe(true);
    expect(isComposerAiToggleKey({ key: "/", ctrlKey: false, metaKey: false, altKey: false, shiftKey: true })).toBe(true);
    expect(isComposerAiToggleKey({ key: "?", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false })).toBe(false);
    expect(isComposerAiToggleKey({ key: "/", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false })).toBe(false);
  });

  it("builds shell echo comments", () => {
    expect(shellEchoForAiPrompt("why fail")).toBe("# AI: why fail");
  });

  it("builds printf-safe shell echo commands for zsh", () => {
    expect(shellEchoCommandForAiPrompt("why fail")).toBe("printf '%s\\n' '# AI: why fail'");
    expect(shellEchoCommandForAiPrompt("it's fine")).toBe("printf '%s\\n' '# AI: it'\\''s fine'");
  });
});

describe("sessionCommandOutcome shortcuts", () => {
  it("detects Ctrl+Enter on empty draft when failure exists", () => {
    expect(
      isAskFailureShortcut({ key: "Enter", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, true, true),
    ).toBe(true);
    expect(
      isAskFailureShortcut({ key: "Enter", ctrlKey: true, metaKey: false, altKey: false, shiftKey: false }, false, true),
    ).toBe(false);
  });

  it("builds a smart failure question", () => {
    const q = buildFailureAiQuestion({ commandText: "npm test", exitCode: 1, failedAtMs: 0 }, "ERR!");
    expect(q).toContain("exit code 1");
    expect(q).toContain("npm test");
    expect(q).toContain("ERR!");
  });
});
