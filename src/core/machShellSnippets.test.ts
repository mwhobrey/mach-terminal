import { describe, expect, it } from "vitest";
import {
  MACH_SNIPPET_OSC7_BASH,
  MACH_SNIPPET_OSC7_PWSH,
  MACH_SNIPPET_OSC7_ZSH,
} from "./machShellSnippets";

describe("machShellSnippets", () => {
  it("includes OSC 7 markers and shell integration hooks", () => {
    expect(MACH_SNIPPET_OSC7_PWSH).toContain("]7;");
    expect(MACH_SNIPPET_OSC7_PWSH).toContain("LocationChangedAction");
    expect(MACH_SNIPPET_OSC7_BASH).toContain("]7;");
    expect(MACH_SNIPPET_OSC7_ZSH).toContain("precmd");
  });
});
