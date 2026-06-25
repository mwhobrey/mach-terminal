import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellPresetsGet = vi.fn(async () => [] as Array<{ id: string; name: string; shell: string; args: string[] }>);
const shellPresetsSet = vi.fn(async (presets: Array<{ id: string; name: string; shell: string; args: string[] }>) => presets);

vi.mock("./terminal", () => ({
  shellPresetsGet: () => shellPresetsGet(),
  shellPresetsSet: (presets: Array<{ id: string; name: string; shell: string; args: string[] }>) =>
    shellPresetsSet(presets),
}));

import {
  addShellPreset,
  fetchShellPresets,
  parseShellPresetPaletteId,
  removeShellPreset,
  shellPresetPaletteId,
  shellPresetDescription,
} from "./shellPresets";

const legacyStorage = new Map<string, string>();

beforeEach(() => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => legacyStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        legacyStorage.set(key, value);
      },
      removeItem: (key: string) => {
        legacyStorage.delete(key);
      },
      clear: () => {
        legacyStorage.clear();
      },
    },
  });
});

describe("shellPresets", () => {
  beforeEach(() => {
    shellPresetsGet.mockReset();
    shellPresetsSet.mockReset();
    shellPresetsGet.mockResolvedValue([]);
    shellPresetsSet.mockImplementation(async (presets) => presets);
    legacyStorage.clear();
  });

  afterEach(() => {
    legacyStorage.clear();
    vi.unstubAllGlobals();
  });

  it("round-trips presets through settings", async () => {
    const presets = await addShellPreset({ name: "Ubuntu WSL", shell: "wsl.exe", args: ["-d", "Ubuntu"] });
    expect(shellPresetsSet).toHaveBeenCalled();
    shellPresetsGet.mockResolvedValue(presets);
    expect(await fetchShellPresets()).toEqual(presets);
  });

  it("removes presets by id", async () => {
    const [preset] = await addShellPreset({ name: "pwsh", shell: "pwsh.exe", args: ["-NoLogo"] });
    shellPresetsGet.mockResolvedValue([preset]);
    const next = await removeShellPreset(preset.id);
    expect(next).toEqual([]);
    expect(shellPresetsSet).toHaveBeenLastCalledWith([]);
  });

  it("migrates legacy localStorage presets when settings are empty", async () => {
    legacyStorage.set(
      "mach-terminal.shell-presets.v1",
      JSON.stringify([{ id: "legacy-1", name: "cmd", shell: "cmd.exe", args: [] }]),
    );
    const migrated = await fetchShellPresets();
    expect(migrated).toHaveLength(1);
    expect(shellPresetsSet).toHaveBeenCalledWith(migrated);
    expect(legacyStorage.has("mach-terminal.shell-presets.v1")).toBe(false);
  });

  it("maps palette ids", () => {
    expect(shellPresetPaletteId("preset-abc")).toBe("preset:preset-abc");
    expect(parseShellPresetPaletteId("preset:preset-abc")).toBe("preset-abc");
    expect(parseShellPresetPaletteId("session.new")).toBeNull();
  });

  it("describes preset command preview", () => {
    const description = shellPresetDescription({ id: "x", name: "n", shell: "pwsh.exe", args: ["-NoLogo"] });
    expect(description).toContain("pwsh.exe");
  });
});
