import { describe, expect, it } from "vitest";
import { APP_COMMANDS } from "./commands";
import { DEFAULT_KEYMAP } from "./keymap";
import { commandToTerminalUiIntent } from "./terminalCommandRouting";

const PALETTE_SURFACE_COMMANDS = [
  "palette.toggle",
  "session.new",
  "terminal.openFind",
  "terminal.toggleFollowOutput",
] as const;

describe("settings palette coordination smoke", () => {
  it("registers settings-adjacent commands in the palette", () => {
    const paletteIds = new Set(APP_COMMANDS.map((command) => command.id));
    for (const commandId of PALETTE_SURFACE_COMMANDS) {
      expect(paletteIds.has(commandId), `palette missing ${commandId}`).toBe(true);
    }
  });

  it("keeps palette.toggle and session.new on the default keymap", () => {
    const keymapIds = new Set(DEFAULT_KEYMAP.map((binding) => binding.command));
    expect(keymapIds.has("palette.toggle")).toBe(true);
    expect(keymapIds.has("session.new")).toBe(true);
  });

  it("maps terminal palette commands to stable UI request kinds", () => {
    expect(commandToTerminalUiIntent("terminal.openFind")).toBe("openFind");
    expect(commandToTerminalUiIntent("terminal.toggleFollowOutput")).toBe("toggleFollowOutput");
  });
});
