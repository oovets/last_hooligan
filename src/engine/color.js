// Small colour helpers. Colours are '#rrggbb' strings unless noted.
const cache = new Map();

export function hexToRgb(hex) {
  let c = cache.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
  const n = parseInt(h.slice(0, 6), 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, c);
  return c;
}

export function rgbToHex(r, g, b) {
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + ((1 << 24) | (cl(r) << 16) | (cl(g) << 8) | cl(b)).toString(16).slice(1);
}

// f in [-1,1]: negative darkens toward black, positive lightens toward white.
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  if (f < 0) return rgbToHex(r * (1 + f), g * (1 + f), b * (1 + f));
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
