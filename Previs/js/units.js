// Maße: intern immer Meter, Grad und Sekunden. Anzeige deutsch mit Komma.

export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const cleaned = String(text).trim().replace(/\s+/g, '').replace(',', '.');
  const match = cleaned.match(/^[-+]?\d*\.?\d+/);
  return match ? parseFloat(match[0]) : NaN;
}

// "1,80 m", "180 cm", "180" (in defaultUnit), "1.8m" -> Meter
export function parseLength(text, defaultUnit = 'cm') {
  const s = String(text).trim().toLowerCase();
  const value = parseNumber(s);
  if (Number.isNaN(value)) return NaN;
  let unit = defaultUnit;
  if (/mm\s*$/.test(s)) unit = 'mm';
  else if (/cm\s*$/.test(s)) unit = 'cm';
  else if (/m\s*$/.test(s)) unit = 'm';
  if (unit === 'mm') return value / 1000;
  if (unit === 'cm') return value / 100;
  return value;
}

function de(value, digits) {
  return value.toFixed(digits).replace('.', ',').replace(/^-0(,0+)?$/, '0$1');
}

export const fmtCm = (m) => `${de(m * 100, Math.abs(m * 100 - Math.round(m * 100)) > 0.05 ? 1 : 0)} cm`;
export const fmtM = (m, digits = 2) => `${de(m, digits)} m`;
export const fmtDeg = (d) => `${de(d, Math.abs(d - Math.round(d)) > 0.05 ? 1 : 0)}°`;
export const fmtSec = (s) => `${de(s, 1)} s`;
export const fmtNum = (v, digits = 1) => de(v, digits);

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const DEG = Math.PI / 180;

// Kompassrichtung: 0° = oben im Grundriss (−Z), 90° = rechts (+X)
export function headingToDir(deg) {
  return { x: Math.sin(deg * DEG), z: -Math.cos(deg * DEG) };
}
export function dirToHeading(dx, dz) {
  return normDeg(Math.atan2(dx, -dz) / DEG);
}
export function normDeg(d) {
  let r = d % 360;
  if (r < 0) r += 360;
  return r;
}
// kürzester Weg zwischen zwei Winkeln
export function lerpDeg(a, b, u) {
  let diff = ((b - a + 540) % 360) - 180;
  return a + diff * u;
}
// Objekt mit Front nach +Z lokal soll in Kompassrichtung deg zeigen
export const headingToRotY = (deg) => Math.PI - deg * DEG;

export const smoothstep = (u) => u * u * (3 - 2 * u);
