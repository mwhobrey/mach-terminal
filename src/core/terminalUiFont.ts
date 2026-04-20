/**
 * Primary stack for xterm + composer + status strip.
 * - If a full Nerd face is installed OS-wide, it wins first.
 * - Otherwise `Mach Terminal Symbols` (bundled Symbols Nerd Font Mono, OFL) fills PUA icons.
 * Keep in sync with `--mach-terminal-mono` and `@font-face` in App.css.
 */
export const MACH_TERMINAL_MONO_FONT =
  '"FiraCode Nerd Font Mono", "FiraCode NF", "JetBrains Mono", "Fira Code", "Mach Terminal Symbols", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
