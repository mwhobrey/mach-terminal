import type { StatusGlyphs } from "./statusStripGlyphs";

/** Keys match `StatusGlyphs` in statusStripGlyphs.ts */
export type StatusGlyphKey = keyof typeof StatusGlyphs;

/**
 * Resolve a filename from `public/` for both Vite dev server and packaged Tauri builds.
 * Root-only paths (`/foo.png`) break when the app base is `./` or non-root — use BASE_URL.
 */
export function resolvePublicGlyph(filename: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const name = filename.replace(/^\/+/, "");
  return `${base}${name}`;
}

/** PNG URLs for custom strip icons (same names as files in `public/`). */
export const STATUS_STRIP_GLYPH_SRC: Record<StatusGlyphKey, string> = {
  terminal: resolvePublicGlyph("terminal_glyph.png"),
  folder: resolvePublicGlyph("folder_glyph.png"),
  clock: resolvePublicGlyph("clock_glyph.png"),
  gitBranch: resolvePublicGlyph("git_branch_glyph.png"),
  gitWorkingTree: resolvePublicGlyph("git_working_tree_glyph.png"),
  shieldAdmin: resolvePublicGlyph("admin_glyph.png"),
  metrics: resolvePublicGlyph("metrics_glyph.png"),
};

/**
 * Visible single-char fallbacks when a PNG fails to load (broken path, CSP, corrupt file).
 * Avoid Nerd Font PUA here — those codepoints often render as punctuation like `"`.
 */
export const STATUS_STRIP_GLYPH_FALLBACK_VISIBLE: Record<StatusGlyphKey, string> = {
  terminal: ">",
  folder: "/",
  clock: "@",
  gitBranch: "^",
  gitWorkingTree: "~",
  shieldAdmin: "!",
  metrics: "#",
};
