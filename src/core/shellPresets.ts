import { formatShellCommandPreview } from "./shellProfiles";
import { shellPresetsGet, shellPresetsSet, type ShellPreset } from "./terminal";

export type { ShellPreset };

const LEGACY_STORAGE_KEY = "mach-terminal.shell-presets.v1";

let cachedPresets: ShellPreset[] | null = null;

function loadLegacyLocalStoragePresets(): ShellPreset[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as ShellPreset[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (preset) =>
        typeof preset.id === "string" &&
        typeof preset.name === "string" &&
        typeof preset.shell === "string" &&
        Array.isArray(preset.args),
    );
  } catch {
    return [];
  }
}

function clearLegacyLocalStoragePresets(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export async function fetchShellPresets(): Promise<ShellPreset[]> {
  let presets = await shellPresetsGet();
  const legacy = loadLegacyLocalStoragePresets();
  if (presets.length === 0 && legacy.length > 0) {
    presets = legacy;
    await shellPresetsSet(presets);
    clearLegacyLocalStoragePresets();
  }
  cachedPresets = presets;
  return presets;
}

/** Returns the last fetched preset list; call `fetchShellPresets` on boot first. */
export function loadShellPresets(): ShellPreset[] {
  return cachedPresets ?? [];
}

export function createShellPresetId(): string {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addShellPreset(preset: Omit<ShellPreset, "id"> & { id?: string }): Promise<ShellPreset[]> {
  const next: ShellPreset = {
    id: preset.id ?? createShellPresetId(),
    name: preset.name.trim(),
    shell: preset.shell.trim(),
    args: [...preset.args],
    cwd: preset.cwd,
    env: preset.env,
  };
  const presets = [...(await fetchShellPresets()), next];
  const saved = await shellPresetsSet(presets);
  cachedPresets = saved;
  return saved;
}

export async function removeShellPreset(id: string): Promise<ShellPreset[]> {
  const presets = (await fetchShellPresets()).filter((preset) => preset.id !== id);
  const saved = await shellPresetsSet(presets);
  cachedPresets = saved;
  return saved;
}

export function shellPresetPaletteId(presetId: string): string {
  return `preset:${presetId}`;
}

export function parseShellPresetPaletteId(commandId: string): string | null {
  return commandId.startsWith("preset:") ? commandId.slice("preset:".length) : null;
}

export function shellPresetDescription(preset: ShellPreset): string {
  return formatShellCommandPreview(preset.shell, preset.args);
}
