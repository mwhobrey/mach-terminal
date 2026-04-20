import { describe, expect, it } from "vitest";
import { decidePaletteKeyAction } from "../components/CommandPalette";
import { commandToTerminalUiIntent } from "./terminalCommandRouting";
import { formatFindStatus } from "./terminalFindStatus";
import { evaluateTerminalUiIntent } from "./terminalUiIntent";

describe("Palette and find smoke contracts", () => {
  it("keeps command-palette keyboard lifecycle stable", () => {
    expect(
      decidePaletteKeyAction({
        key: "ArrowDown",
        activeIndex: 0,
        filteredCount: 3,
        hasSelection: true,
      }),
    ).toEqual({
      preventDefault: true,
      nextActiveIndex: 1,
      shouldRunSelection: false,
      shouldClose: false,
    });
    expect(
      decidePaletteKeyAction({
        key: "ArrowUp",
        activeIndex: 0,
        filteredCount: 3,
        hasSelection: true,
      }),
    ).toEqual({
      preventDefault: true,
      nextActiveIndex: 2,
      shouldRunSelection: false,
      shouldClose: false,
    });
    expect(
      decidePaletteKeyAction({
        key: "Enter",
        activeIndex: 1,
        filteredCount: 3,
        hasSelection: true,
      }),
    ).toEqual({
      preventDefault: true,
      nextActiveIndex: 1,
      shouldRunSelection: true,
      shouldClose: true,
    });
    expect(
      decidePaletteKeyAction({
        key: "Enter",
        activeIndex: 0,
        filteredCount: 0,
        hasSelection: false,
      }),
    ).toEqual({
      preventDefault: true,
      nextActiveIndex: 0,
      shouldRunSelection: false,
      shouldClose: false,
    });
    expect(
      decidePaletteKeyAction({
        key: "Escape",
        activeIndex: 0,
        filteredCount: 0,
        hasSelection: false,
      }),
    ).toEqual({
      preventDefault: true,
      nextActiveIndex: 0,
      shouldRunSelection: false,
      shouldClose: true,
    });
  });

  it("routes find commands only when focused and query is present", () => {
    expect(commandToTerminalUiIntent("terminal.openFind")).toBe("openFind");
    const unfocused = evaluateTerminalUiIntent({
      request: { kind: "openFind", seq: 7 },
      isFocused: false,
      consumedSeq: 3,
      findQuery: "",
      followOutput: true,
    });
    expect(unfocused).toEqual({ nextConsumedSeq: 7 });

    expect(commandToTerminalUiIntent("terminal.findNext")).toBe("findNext");
    const focusedNoQuery = evaluateTerminalUiIntent({
      request: { kind: "findNext", seq: 8 },
      isFocused: true,
      consumedSeq: 7,
      findQuery: "   ",
      followOutput: true,
    });
    expect(focusedNoQuery).toEqual({ nextConsumedSeq: 8 });

    const focusedWithQuery = evaluateTerminalUiIntent({
      request: { kind: "findNext", seq: 9 },
      isFocused: true,
      consumedSeq: 8,
      findQuery: "build",
      followOutput: true,
    });
    expect(focusedWithQuery).toEqual({
      nextConsumedSeq: 9,
      action: { type: "findNext" },
    });
  });

  it("keeps find counter wording stable across high-signal states", () => {
    expect(formatFindStatus({ query: "", resultIndex: -1, resultCount: 0 })).toBe("");
    expect(formatFindStatus({ query: "err", resultIndex: -1, resultCount: 0 })).toBe("no matches");
    expect(formatFindStatus({ query: "err", resultIndex: -1, resultCount: 50 })).toBe("many matches");
    expect(formatFindStatus({ query: "err", resultIndex: 2, resultCount: 5 })).toBe("3 / 5");
  });
});
