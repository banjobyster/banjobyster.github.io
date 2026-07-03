// Small shared helpers for behavior modules.

export function cssColorToInt(str, fallback) {
  if (!str) return fallback;
  const s = str.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16));
    return (r << 16) | (g << 8) | b;
  }
  m = s.match(/^#([0-9a-f]{6})/i);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (m) return (+m[1] << 16) | (+m[2] << 8) | +m[3];
  return fallback;
}

// Face palette [off, dim, main, hot] derived from an accent color.
export function accentPalette(col) {
  const r = (col >> 16) & 255;
  const g = (col >> 8) & 255;
  const b = col & 255;
  const mix = (c, t, k) => Math.round(c + (t - c) * k);
  const dim = (mix(r, 0, 0.55) << 16) | (mix(g, 0, 0.55) << 8) | mix(b, 0, 0.55);
  const hot = (mix(r, 255, 0.75) << 16) | (mix(g, 255, 0.75) << 8) | mix(b, 255, 0.75);
  return [0, dim, col, hot];
}
