import { describe, expect, it } from "vitest";
import {
  cycleSessionInputMode,
  isInputModeCycleChord,
  parseSessionInputMode,
  inputModeUsesComposer,
  inputModeUsesXtermStdin,
} from "./inputMode";

describe("inputMode", () => {
  it("cycles operator → commander → operator", () => {
    expect(cycleSessionInputMode("operator")).toBe("commander");
    expect(cycleSessionInputMode("commander")).toBe("operator");
  });

  it("parses legacy console and retired ai modes", () => {
    expect(parseSessionInputMode("commander")).toBe("commander");
    expect(parseSessionInputMode("console")).toBe("commander");
    expect(parseSessionInputMode("ai")).toBe("operator");
    expect(parseSessionInputMode("nope")).toBe("operator");
  });

  it("detects Ctrl+` chord", () => {
    expect(isInputModeCycleChord({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: false, key: "`" })).toBe(true);
    expect(isInputModeCycleChord({ ctrlKey: true, metaKey: false, altKey: false, shiftKey: true, key: "`" })).toBe(false);
  });

  it("maps operator vs commander surfaces", () => {
    expect(inputModeUsesComposer("operator")).toBe(true);
    expect(inputModeUsesComposer("commander")).toBe(false);
    expect(inputModeUsesXtermStdin("commander")).toBe(true);
    expect(inputModeUsesXtermStdin("operator")).toBe(false);
  });
});
