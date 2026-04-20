import { useState } from "react";
import type { StatusGlyphKey } from "../core/statusStripGlyphAssets";
import { STATUS_STRIP_GLYPH_FALLBACK_VISIBLE, STATUS_STRIP_GLYPH_SRC } from "../core/statusStripGlyphAssets";

interface StatusStripGlyphProps {
  kind: StatusGlyphKey;
  title?: string;
}

/**
 * Custom PNG glyphs from `public/`; falls back to Nerd Font PUA if an asset fails to load.
 */
export function StatusStripGlyph({ kind, title }: StatusStripGlyphProps) {
  const [useFallback, setUseFallback] = useState(false);
  const src = STATUS_STRIP_GLYPH_SRC[kind];
  const fallback = STATUS_STRIP_GLYPH_FALLBACK_VISIBLE[kind];
  if (useFallback) {
    return (
      <span className="mach-status-glyph mach-status-glyph-fallback-char" title={title} aria-hidden="true">
        {fallback}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="mach-status-glyph mach-status-glyph-img"
      width={14}
      height={14}
      decoding="async"
      title={title}
      aria-hidden="true"
      onError={() => setUseFallback(true)}
    />
  );
}
