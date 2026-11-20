// Vektor-Quest: Aufgaben-Generatoren für Analytische Geometrie & Lineare Algebra.
// Jede Aufgabe liefert: Fragetext, Antworttyp, richtige Antwort, zwei Hinweise
// und einen ausführlichen Lösungsweg. Läuft im Browser und in Node (für Tests).
(function (root) {
'use strict';

// ---------- Zufall (austauschbar, damit die Tages-Challenge reproduzierbar ist) ----------
const R = {
  rng: Math.random,
  int(a, b) { return a + Math.floor(R.rng() * (b - a + 1)); },
  nz(a, b) { let x; do { x = R.int(a, b); } while (x === 0); return x; },
  pick(arr) { return arr[Math.floor(R.rng() * arr.length)]; },
  chance(p) { return R.rng() < p; },
  shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
};
function seeded(seed) { // mulberry32
  let t = seed >>> 0;
  return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// ---------- Vektor-Rechnung ----------
const det2 = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const det3 = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
const V = {
  add: (a, b) => a.map((x, i) => x + b[i]),
  sub: (a, b) => a.map((x, i) => x - b[i]),
  mul: (k, a) => a.map(x => k * x),
  dot: (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len2: a => a.reduce((s, x) => s + x * x, 0),
  len: a => Math.sqrt(V.len2(a)),
  zero: a => a.every(x => x === 0),
  par: (a, b) => V.zero(V.cross(a, b)),
};
const rv = (lo = -5, hi = 5) => [R.int(lo, hi), R.int(lo, hi), R.int(lo, hi)];
function rvnz(lo = -4, hi = 4) { let v; do { v = rv(lo, hi); } while (V.zero(v)); return v; }
function rvNotPar(u, lo = -4, hi = 4) { let v; do { v = rvnz(lo, hi); } while (V.par(u, v)); return v; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
function gcdAll(v) { return v.reduce((g, x) => gcd(g, x), 0); }
const deg = r => r * 180 / Math.PI;
// Pythagoreische Quadrupel: Normalenvektoren mit ganzzahliger Länge
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11]];
function niceNormal() {
  const q = R.pick(QUADS);
  const v = R.shuffle(q.slice(0, 3)).map(x => R.chance(0.5) ? -x : x);
  return { n: v, len: q[3] };
}

// ---------- Formatierung (HTML) ----------
const MINUS = '−';
function n(x, dp = 2) {
  if (typeof x === 'string') return x;
  if (Object.is(x, -0) || Math.abs(x) < 1e-12) x = 0;
  if (Number.isInteger(x)) return x < 0 ? MINUS + (-x) : String(x);
  let s = (Math.round(x * 10 ** dp) / 10 ** dp).toFixed(dp).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  if (s === '-0') s = '0';
  return s.startsWith('-') ? MINUS + s.slice(1) : s;
}
const p = x => (typeof x === 'number' && x < 0) ? `(${n(x)})` : n(x);
const vec = v => `<span class="vec">${v.map(x => `<span>${n(x)}</span>`).join('')}</span>`;
const pt = (name, v) => `${name}(${v.map(x => n(x)).join(' | ')})`;
const ov = s => `<span class="ov">${s}</span>`;
const X = ['x₁', 'x₂', 'x₃'];
function lin(c, vars = X) {
  let s = '';
  c.forEach((k, i) => {
    if (k === 0) return;
    const a = Math.abs(k), coef = a === 1 ? '' : n(a);
    if (s === '') s = (k < 0 ? MINUS : '') + coef + vars[i];
    else s += (k < 0 ? ' − ' : ' + ') + coef + vars[i];
  });
  return s || '0';
}
const lineEq = (name, A, u, t = 't') => `${name}: ${ov('x')} = ${vec(A)} + ${t}·${vec(u)}`;
const planeParam = (name, A, u, v) => `${name}: ${ov('x')} = ${vec(A)} + r·${vec(u)} + s·${vec(v)}`;
function rootStr(k) { // √k vereinfacht
  if (k === 0) return '0';
  let a = 1;
  for (let i = Math.floor(Math.sqrt(k)); i > 1; i--) if (k % (i * i) === 0) { a = i; break; }
  const m = k / (a * a);
  if (m === 1) return String(a);
  return (a === 1 ? '' : a) + `√<span class="rad">${m}</span>`;
}
function frac(num, den) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(num, den) || 1; num /= g; den /= g;
  if (den === 1) return n(num);
  return `${num < 0 ? MINUS : ''}<span class="frac"><span>${Math.abs(num)}</span><span>${den}</span></span>`;
}
function fracOver(top, bottom) { return `<span class="frac"><span>${top}</span><span>${bottom}</span></span>`; }
const ct = k => k === 1 ? "" : k === -1 ? "−" : p(k); // Faktor vor einer Variablen
const sq = s => `√<span class="rad">${s}</span>`;
const res = s => `<div class="res">${s}</div>`;
function mat(rows, aug = false) {
  return `<table class="mat${aug ? ' aug' : ''}">${rows.map(r => `<tr>${r.map((x, j) => `<td${aug && j === r.length - 1 ? ' class="rhs"' : ''}>${n(x)}</td>`).join('')}</tr>`).join('')}</table>`;
}

// Bausteine für Lösungswege
function dotSteps(a, b, na = 'a', nb = 'b') {
  return `${ov(na)} · ${ov(nb)} = ${a.map((x, i) => `${p(x)}·${p(b[i])}`).join(' + ')} = ${a.map((x, i) => p(x * b[i])).join(' + ')} = <b>${n(V.dot(a, b))}</b>`;
}
function lenSteps(v, name = 'v') {
  const s = V.len2(v);
  const r = rootStr(s);
  const approx = Number.isInteger(Math.sqrt(s)) ? '' : ` ≈ <b>${n(Math.sqrt(s))}</b>`;
  return `|${ov(name)}| = ${sq(v.map(x => p(x) + '²').join(' + '))} = ${sq(v.map(x => x * x).join(' + '))} = ${sq(s)}${r !== sq(s) ? ' = ' + r : ''}${approx || ` = <b>${r}</b>`}`;
}

// ---------- Kapitel ----------
const CHAPTERS = [ // Inhalte des Grundkurses (grundlegendes Niveau)
  { id: 'vek', name: 'Vektoren rechnen', icon: '➡️', desc: 'Addieren, Vervielfachen, Verbindungsvektor, Länge, Mittelpunkt' },
  { id: 'skp', name: 'Skalarprodukt & Winkel', icon: '📐', desc: 'Skalarprodukt, senkrechte Vektoren, Winkel im Dreieck' },
  { id: 'ger', name: 'Geraden', icon: '📏', desc: 'Parameterform, Punktprobe, Spurpunkt, Schnittpunkt, Schnittwinkel' },
  { id: 'ebe', name: 'Ebenen (Parameterform)', icon: '🟦', desc: 'Punkte, Punktprobe, Schnittpunkt mit einer Geraden' },
  { id: 'lgs', name: 'LGS lösen (Gauß)', icon: '🧮', desc: 'Gleichungssysteme mit 2 und 3 Unbekannten' },
];

const TYPES = [];
function def(o) { TYPES.push(o); }

// =====================================================================
// Kapitel 1: Vektoren rechnen
// =====================================================================
def({ id: 'vek_ab', ch: 'vek', name: 'Verbindungsvektor', lvl: 1, gen() {
  const A = rv(-6, 6), B = rv(-6, 6), AB = V.sub(B, A);
  return {
    q: `Gegeben sind die Punkte ${pt('A', A)} und ${pt('B', B)}.<br>Berechne den Verbindungsvektor ${ov('AB')}.`,
    type: 'vec', answer: AB,
    hints: [
      `Merksatz: <b>„Spitze minus Fuß“</b>. Der Pfeil startet bei A (Fuß) und zeigt auf B (Spitze). Also: ${ov('AB')} = B − A.`,
      `Rechne jede Zeile einzeln: ${ov('AB')} = ${vec(B)} − ${vec(A)} = ${vec(B.map((b, i) => `${n(b)} − ${p(A[i])}`))}`,
    ],
    steps: [
      `Ein Verbindungsvektor beschreibt den Weg von A nach B. Man rechnet immer <b>Endpunkt minus Startpunkt</b>.`,
      `${ov('AB')} = ${vec(B)} − ${vec(A)} = ${vec(B.map((b, i) => `${n(b)} − ${p(A[i])}`))}`,
      `Achtung bei Minus mal Minus: „− (−3)“ wird zu „+ 3“.`,
      res(`${ov('AB')} = ${vec(AB)}`),
    ],
  };
} });

def({ id: 'vek_betrag', ch: 'vek', name: 'Länge eines Vektors', lvl: 1, gen() {
  let v;
  if (R.chance(0.4)) { const q = niceNormal(); v = q.n; } else v = rvnz(-6, 6);
  const s = V.len2(v), L = Math.sqrt(s);
  const exact = Number.isInteger(L);
  return {
    q: `Berechne die Länge (den Betrag) des Vektors ${ov('v')} = ${vec(v)}.${exact ? '' : '<br><small>Runde auf 2 Nachkommastellen oder gib die Wurzel ein (z. B. √14).</small>'}`,
    type: 'num', answer: L, tol: exact ? 1e-6 : 0.011,
    hints: [
      `Die Länge ist wie der Satz des Pythagoras in 3D: |${ov('v')}| = √(v₁² + v₂² + v₃²).`,
      `Quadriere jede Komponente: ${v.map(x => `${p(x)}² = ${x * x}`).join(', ')}. Addiere sie und zieh die Wurzel.`,
    ],
    steps: [
      `Formel: |${ov('v')}| = √(v₁² + v₂² + v₃²). Minuszeichen verschwinden beim Quadrieren!`,
      lenSteps(v),
      res(`|${ov('v')}| = ${exact ? L : rootStr(s) + ' ≈ ' + n(L)}`),
    ],
  };
} });

def({ id: 'vek_mitte', ch: 'vek', name: 'Mittelpunkt einer Strecke', lvl: 1, gen() {
  const A = rv(-6, 6), B = A.map(a => a + 2 * R.int(-4, 4));
  if (V.zero(V.sub(A, B))) B[0] += 2;
  const M = A.map((a, i) => (a + B[i]) / 2);
  return {
    q: `Bestimme den Mittelpunkt M der Strecke zwischen ${pt('A', A)} und ${pt('B', B)}.`,
    type: 'vec', answer: M,
    hints: [
      `Der Mittelpunkt ist der „Durchschnitt“ der beiden Punkte: M = ½·(A + B).`,
      `Addiere A und B: ${vec(V.add(A, B))}. Teile dann jede Zeile durch 2.`,
    ],
    steps: [
      `Formel: M = ½·(A + B) – also bei jeder Koordinate den Mittelwert bilden.`,
      `A + B = ${vec(A)} + ${vec(B)} = ${vec(V.add(A, B))}`,
      `½ · ${vec(V.add(A, B))} = ${vec(M)}`,
      res(`${pt('M', M)}`),
    ],
  };
} });

def({ id: 'vek_parallelogramm', ch: 'vek', name: 'Parallelogramm ergänzen', lvl: 2, gen() {
  const A = rv(-5, 5), B = V.add(A, rvnz(-4, 4));
  let C; do { C = V.add(B, rvnz(-4, 4)); } while (V.par(V.sub(B, A), V.sub(C, B)));
  const BC = V.sub(C, B), D = V.add(A, BC);
  return {
    q: `Die Punkte ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)} sind drei Ecken des Parallelogramms ABCD.<br>Berechne die vierte Ecke D.`,
    type: 'vec', answer: D,
    hints: [
      `Im Parallelogramm sind gegenüberliegende Seiten gleich lang und parallel: ${ov('AD')} = ${ov('BC')}.`,
      `${ov('BC')} = C − B = ${vec(BC)}. Geh von A aus diesen Weg: D = A + ${ov('BC')}.`,
    ],
    steps: [
      `Skizze im Kopf: A → B → C → D → zurück zu A. Die Seite AD ist parallel und gleich lang wie BC.`,
      `${ov('BC')} = C − B = ${vec(C)} − ${vec(B)} = ${vec(BC)}`,
      `D = A + ${ov('BC')} = ${vec(A)} + ${vec(BC)} = ${vec(D)}`,
      res(pt('D', D)),
    ],
  };
} });

def({ id: 'vek_schwerpunkt', ch: 'vek', name: 'Schwerpunkt eines Dreiecks', lvl: 2, gen() {
  const A = rv(-5, 5), B = rv(-5, 5), C = A.map((a, i) => { let c; do { c = R.int(-6, 6); } while ((a + B[i] + c) % 3 !== 0); return c; });
  const S = A.map((a, i) => (a + B[i] + C[i]) / 3);
  return {
    q: `Berechne den Schwerpunkt S des Dreiecks mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.`,
    type: 'vec', answer: S,
    hints: [
      `Der Schwerpunkt ist der Durchschnitt aller drei Ecken: S = ⅓·(A + B + C).`,
      `A + B + C = ${vec(V.add(V.add(A, B), C))}. Jetzt jede Zeile durch 3 teilen.`,
    ],
    steps: [
      `Formel: S = ⅓·(A + B + C)`,
      `A + B + C = ${vec(A)} + ${vec(B)} + ${vec(C)} = ${vec(V.add(V.add(A, B), C))}`,
      `⅓ · ${vec(V.add(V.add(A, B), C))} = ${vec(S)}`,
      res(pt('S', S)),
    ],
  };
} });


// =====================================================================
// Kapitel 2: Skalarprodukt & Winkel
// =====================================================================
def({ id: 'skp_dot', ch: 'skp', name: 'Skalarprodukt berechnen', lvl: 1, gen() {
  const a = rvnz(-6, 6), b = rvnz(-6, 6);
  return {
    q: `Berechne das Skalarprodukt ${ov('a')} · ${ov('b')} mit ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)}.`,
    type: 'num', answer: V.dot(a, b),
    hints: [
      `Skalarprodukt: Multipliziere die Zeilen paarweise und addiere alles: a₁·b₁ + a₂·b₂ + a₃·b₃. Das Ergebnis ist eine <b>Zahl</b>, kein Vektor!`,
      `Die drei Produkte sind ${a.map((x, i) => p(x * b[i])).join(', ')}. Jetzt nur noch addieren.`,
    ],
    steps: [
      `Formel: ${ov('a')} · ${ov('b')} = a₁·b₁ + a₂·b₂ + a₃·b₃`,
      dotSteps(a, b),
      res(`${ov('a')} · ${ov('b')} = ${n(V.dot(a, b))}`),
    ],
  };
} });


def({ id: 'skp_fehlend', ch: 'skp', name: 'Fehlende Koordinate für Orthogonalität', lvl: 2, gen() {
  let a, b1, b2, k;
  do { a = [R.nz(-5, 5), R.nz(-5, 5), R.pick([1, -1, 2, -2])]; b1 = R.int(-5, 5); b2 = R.int(-5, 5); k = -(a[0] * b1 + a[1] * b2) / a[2]; } while (!Number.isInteger(k) || Math.abs(k) > 15);
  const b = [b1, b2, k];
  const part = a[0] * b1 + a[1] * b2;
  return {
    q: `Bestimme die Zahl k so, dass ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec([b1, b2, 'k'])} orthogonal sind.`,
    type: 'num', answer: k,
    hints: [
      `Orthogonal heißt: ${ov('a')} · ${ov('b')} = 0. Stell diese Gleichung mit k auf.`,
      `${p(a[0])}·${p(b1)} + ${p(a[1])}·${p(b2)} + ${p(a[2])}·k = 0 ⇒ ${n(part)} + ${p(a[2])}k = 0. Jetzt nach k umstellen.`,
    ],
    steps: [
      `Bedingung: ${ov('a')} · ${ov('b')} = 0`,
      `${p(a[0])}·${p(b1)} + ${p(a[1])}·${p(b2)} + ${p(a[2])}·k = 0`,
      `${n(part)} + ${p(a[2])}·k = 0 &nbsp;|&nbsp; − ${p(part)}`,
      `${p(a[2])}·k = ${n(-part)} &nbsp;|&nbsp; : ${p(a[2])}`,
      res(`k = ${n(k)}`),
      `Probe: ${dotSteps(a, b)} ✓`,
    ],
  };
} });

def({ id: 'skp_winkel', ch: 'skp', name: 'Winkel zwischen zwei Vektoren', lvl: 2, gen() {
  let a, b; do { a = rvnz(-5, 5); b = rvnz(-5, 5); } while (V.par(a, b));
  const d = V.dot(a, b), la = V.len2(a), lb = V.len2(b);
  const ang = deg(Math.acos(d / Math.sqrt(la * lb)));
  return {
    q: `Berechne den Winkel α zwischen ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)} in Grad.<br><small>Runde auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [
      `Winkelformel: cos α = (${ov('a')} · ${ov('b')}) / (|${ov('a')}| · |${ov('b')}|). Du brauchst das Skalarprodukt und die beiden Längen.`,
      `${ov('a')} · ${ov('b')} = ${n(d)}, |${ov('a')}| = ${sq(la)}, |${ov('b')}| = ${sq(lb)}. Also cos α = ${n(d)} / (${sq(la)}·${sq(lb)}). Danach cos⁻¹ (arccos) am Taschenrechner.`,
    ],
    steps: [
      `Formel: cos α = ${fracOver(`${ov('a')} · ${ov('b')}`, `|${ov('a')}| · |${ov('b')}|`)}`,
      `Zähler: ${dotSteps(a, b)}`,
      `Nenner: |${ov('a')}| = ${sq(la)}, |${ov('b')}| = ${sq(lb)} → ${sq(la)}·${sq(lb)} = ${sq(la * lb)} ≈ ${n(Math.sqrt(la * lb), 3)}`,
      `cos α = ${n(d)} / ${n(Math.sqrt(la * lb), 3)} ≈ ${n(d / Math.sqrt(la * lb), 4)}`,
      `α = cos⁻¹(${n(d / Math.sqrt(la * lb), 4)}) ≈ ${n(ang, 1)}° <small>(Taschenrechner auf DEG stellen!)</small>`,
      res(`α ≈ ${n(ang, 1)}°`),
    ],
  };
} });


// =====================================================================
// Kapitel 3: Geraden
// =====================================================================
def({ id: 'ger_punkt', ch: 'ger', name: 'Punkt auf der Geraden berechnen', lvl: 1, gen() {
  const A = rv(-5, 5), u = rvnz(-4, 4), t = R.nz(-3, 3), P = V.add(A, V.mul(t, u));
  return {
    q: `Gegeben ist die Gerade ${lineEq('g', A, u)}.<br>Welcher Punkt P gehört zum Parameter t = ${n(t)}?`,
    type: 'vec', answer: P,
    hints: [
      `Setz einfach t = ${n(t)} in die Geradengleichung ein: P = Stützvektor + ${n(t)}·Richtungsvektor.`,
      `${n(t)}·${vec(u)} = ${vec(V.mul(t, u))}. Jetzt noch zum Stützvektor ${vec(A)} addieren.`,
    ],
    steps: [
      `Einsetzen: ${ov('p')} = ${vec(A)} + ${p(t)}·${vec(u)}`,
      `Erst multiplizieren: ${p(t)}·${vec(u)} = ${vec(V.mul(t, u))}`,
      `Dann addieren: ${vec(A)} + ${vec(V.mul(t, u))} = ${vec(P)}`,
      res(pt('P', P)),
    ],
  };
} });

def({ id: 'ger_zweipunkte', ch: 'ger', name: 'Gerade durch zwei Punkte', lvl: 1, gen() {
  const A = rv(-5, 5); let B; do { B = rv(-5, 5); } while (V.zero(V.sub(B, A)));
  const u = V.sub(B, A);
  return {
    q: `Die Gerade g geht durch ${pt('A', A)} und ${pt('B', B)}.<br>Gib einen Richtungsvektor von g an.<br><small>Jedes Vielfache wird akzeptiert.</small>`,
    type: 'vecpar', answer: u,
    hints: [
      `Der Richtungsvektor zeigt von einem Punkt der Geraden zum anderen: ${ov('u')} = ${ov('AB')} = B − A.`,
      `${vec(B)} − ${vec(A)} = ?`,
    ],
    steps: [
      `Stützvektor: Ortsvektor von A. Richtungsvektor: ${ov('AB')}.`,
      `${ov('AB')} = ${vec(B)} − ${vec(A)} = ${vec(u)}`,
      `Damit: ${lineEq('g', A, u)}`,
      res(`Richtungsvektor z. B. ${vec(u)} (oder ein Vielfaches davon)`),
    ],
  };
} });


def({ id: 'ger_spur', ch: 'ger', name: 'Spurpunkt einer Geraden', lvl: 2, gen() {
  const ax = R.int(0, 2); const planes = ['x₂x₃-Ebene', 'x₁x₃-Ebene', 'x₁x₂-Ebene'];
  const S = rv(-5, 5); S[ax] = 0;
  const u = rvnz(-3, 3); if (u[ax] === 0) u[ax] = R.nz(-3, 3);
  const t0 = R.nz(-3, 3), A = V.sub(S, V.mul(t0, u));
  return {
    q: `In welchem Punkt S durchstößt die Gerade ${lineEq('g', A, u)} die <b>${planes[ax]}</b>?`,
    type: 'vec', answer: S,
    hints: [
      `In der ${planes[ax]} ist die Koordinate ${X[ax]} = 0. Setze also die ${ax + 1}. Zeile der Geraden gleich 0.`,
      `${n(A[ax])} + ${p(u[ax])}·t = 0 ⇒ t = ${n(t0)}. Setze dieses t in die Geradengleichung ein.`,
    ],
    steps: [
      `Bedingung: ${X[ax]} = 0 (alle Punkte der ${planes[ax]} haben ${X[ax]} = 0).`,
      `${ax + 1}. Zeile: ${n(A[ax])} + ${p(u[ax])}·t = 0 ⇒ ${p(u[ax])}·t = ${n(-A[ax])} ⇒ t = ${n(t0)}`,
      `Einsetzen: ${vec(A)} + ${p(t0)}·${vec(u)} = ${vec(S)}`,
      res(pt('S', S)),
    ],
  };
} });

function lineLineCase(kind) {
  const A = rv(-4, 4), u = rvnz(-3, 3);
  let B, w, S;
  if (kind === 0) { // identisch
    B = V.add(A, V.mul(R.nz(-2, 2), u)); w = V.mul(R.pick([-2, -1, 2]), u);
  } else if (kind === 1) { // parallel
    B = V.add(A, rvNotPar(u, -3, 3)); w = V.mul(R.pick([-2, -1, 2]), u);
  } else if (kind === 2) { // schneiden
    w = rvNotPar(u, -3, 3);
    S = V.add(A, V.mul(R.nz(-2, 2), u));
    B = V.sub(S, V.mul(R.nz(-2, 2), w));
  } else { // windschief
    w = rvNotPar(u, -3, 3);
    do { B = rv(-4, 4); } while (V.dot(V.sub(B, A), V.cross(u, w)) === 0);
  }
  return { A, u, B, w, S };
}
function lineLineSolve(A, u, B, w) { // löst A + s u = B + t w über zwei Zeilen
  const c = V.sub(B, A);
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
    const det = -u[i] * w[j] + w[i] * u[j];
    if (det !== 0) {
      const sn = c[i] * (-w[j]) + w[i] * c[j], tn = u[i] * c[j] - u[j] * c[i];
      const k = 3 - i - j;
      const ok = sn * u[k] - tn * w[k] === c[k] * det;
      return { i, j, k, det, sn, tn, ok, c };
    }
  }
  return null;
}
function lineLineSteps(A, u, B, w) {
  const steps = [];
  const parallel = V.par(u, w);
  steps.push(`<b>Schritt 1 – Richtungsvektoren vergleichen:</b> Ist ${vec(w)} ein Vielfaches von ${vec(u)}?`);
  if (parallel) {
    const k = w.find((x, i) => u[i] !== 0) / u.find(x => x !== 0);
    steps.push(`Ja: ${vec(w)} = ${n(k)}·${vec(u)}. Die Geraden sind also <b>parallel oder identisch</b>.`);
    const AB = V.sub(B, A);
    const on = V.par(AB, u);
    steps.push(`<b>Schritt 2 – Punktprobe:</b> Liegt der Stützpunkt ${pt('B', B)} von h auf g? Dafür prüfen, ob ${ov('AB')} = ${vec(AB)} ein Vielfaches von ${vec(u)} ist.`);
    steps.push(on ? `Ja → B liegt auf g. Also sind die Geraden <b>identisch</b>.` : `Nein → B liegt nicht auf g. Also sind die Geraden <b>echt parallel</b>.`);
    return { steps, kind: on ? 0 : 1 };
  }
  steps.push(`Nein, die Richtungsvektoren sind keine Vielfachen. Die Geraden <b>schneiden sich oder sind windschief</b>.`);
  const L = lineLineSolve(A, u, B, w);
  const eq = r => `${n(A[r])} + ${ct(u[r])}s = ${n(B[r])} + ${ct(w[r])}t`;
  steps.push(`<b>Schritt 2 – Gleichsetzen:</b> ${vec(A)} + s·${vec(u)} = ${vec(B)} + t·${vec(w)}<ul class="calc">${[0, 1, 2].map(r => `<li>${r + 1}. Zeile: ${eq(r)}</li>`).join('')}</ul>`);
  steps.push(`<b>Schritt 3 – Zwei Zeilen lösen</b> (hier Zeile ${L.i + 1} und ${L.j + 1}), z. B. mit dem Additionsverfahren: s = ${frac(L.sn, L.det)}, t = ${frac(L.tn, L.det)}`);
  const sv = L.sn / L.det, tv = L.tn / L.det;
  steps.push(`<b>Schritt 4 – Probe in Zeile ${L.k + 1}:</b> links ${n(A[L.k])} + ${p(u[L.k])}·${frac(L.sn, L.det)} ${L.ok ? '=' : '≠'} rechts ${n(B[L.k])} + ${p(w[L.k])}·${frac(L.tn, L.det)} → ${L.ok ? 'passt ✓' : 'Widerspruch ✗'}`);
  if (L.ok) {
    const S = V.add(A, V.mul(sv, u));
    steps.push(`Die Geraden <b>schneiden sich</b>. Schnittpunkt: s = ${n(sv)} in g einsetzen → ${vec(A)} + ${p(sv)}·${vec(u)} = ${vec(S)}`);
    return { steps, kind: 2, S };
  }
  steps.push(`Kein gemeinsamer Punkt, nicht parallel → die Geraden sind <b>windschief</b>.`);
  return { steps, kind: 3 };
}


def({ id: 'ger_schnitt', ch: 'ger', name: 'Schnittpunkt zweier Geraden', lvl: 3, gen() {
  const { A, u, B, w, S } = lineLineCase(2);
  const sol = lineLineSteps(A, u, B, w);
  return {
    q: `Die Geraden schneiden sich. Berechne den Schnittpunkt S.<br>${lineEq('g', A, u, 's')}<br>${lineEq('h', B, w, 't')}`,
    type: 'vec', answer: S,
    hints: [
      `Setze beide Geradengleichungen gleich. Du erhältst 3 Gleichungen mit den Unbekannten s und t.`,
      `Nimm zwei der Zeilen und löse nach s und t (Additions- oder Einsetzverfahren). Dann s in g einsetzen.`,
    ],
    steps: [...sol.steps.slice(2), res(pt('S', S))],
  };
} });

def({ id: 'abs_pp', ch: 'vek', name: 'Abstand zweier Punkte', lvl: 1, gen() {
  const A = rv(-5, 5); const v = R.chance(0.5) ? niceNormal().n : rvnz(-5, 5); const B = V.add(A, v);
  const s = V.len2(v), L = Math.sqrt(s), exact = Number.isInteger(L);
  return {
    q: `Wie weit sind ${pt('A', A)} und ${pt('B', B)} voneinander entfernt?${exact ? '' : '<br><small>Runde auf 2 Nachkommastellen oder gib die Wurzel ein.</small>'}`,
    type: 'num', answer: L, tol: exact ? 1e-6 : 0.011, unit: 'LE',
    hints: [
      `Der Abstand ist die Länge des Verbindungsvektors: d = |${ov('AB')}|.`,
      `${ov('AB')} = ${vec(v)}. Jetzt √(…² + …² + …²).`,
    ],
    steps: [
      `${ov('AB')} = B − A = ${vec(v)}`,
      lenSteps(v, 'AB'),
      res(`d(A, B) = ${exact ? L : rootStr(s) + ' ≈ ' + n(L)} LE`),
    ],
  };
} });







// =====================================================================
// Kapitel 5: LGS lösen (Gauß)
// =====================================================================
function gaussSteps(Ab, vars) {
  const M = Ab.map(r => r.slice()), m = M.length, nn = vars.length, steps = [];
  const Z = i => `Z${i + 1}`;
  steps.push(`Schreibe das LGS als erweiterte Matrix (links die Koeffizienten, rechts die Ergebnisse): ${mat(M, true)}`);
  steps.push(`<b>Ziel:</b> Unterhalb der Diagonalen sollen Nullen stehen (Stufenform). Dafür ziehst du passende Vielfache von Zeilen voneinander ab.`);
  let row = 0; const pivCols = [];
  for (let col = 0; col < nn && row < m; col++) {
    let r = row; while (r < m && M[r][col] === 0) r++;
    if (r === m) continue;
    if (r !== row) { [M[r], M[row]] = [M[row], M[r]]; steps.push(`${Z(row)} und ${Z(r)} tauschen (oben brauchen wir eine Zahl ≠ 0): ${mat(M, true)}`); }
    const ops = [];
    for (let i = row + 1; i < m; i++) {
      if (M[i][col] === 0) continue;
      const a = M[row][col], b = M[i][col], g = gcd(a, b), fa = a / g, fb = b / g;
      M[i] = M[i].map((x, j) => fa * x - fb * M[row][j]);
      const gg = gcdAll(M[i]); if (gg > 1) M[i] = M[i].map(x => x / gg);
      ops.push(`${Z(i)} → ${fa === 1 ? '' : p(fa) + '·'}${Z(i)} ${fb < 0 ? '+' : '−'} ${Math.abs(fb) === 1 ? '' : Math.abs(fb) + '·'}${Z(row)}${gg > 1 ? ` (danach durch ${gg} gekürzt)` : ''}`);
    }
    if (ops.length) steps.push(`Nullen in Spalte ${col + 1} erzeugen:<ul class="calc">${ops.map(o => `<li>${o}</li>`).join('')}</ul>${mat(M, true)}`);
    pivCols.push(col); row++;
  }
  // Auswertung
  const bad = M.find(r => r.slice(0, nn).every(x => x === 0) && r[nn] !== 0);
  if (bad) { steps.push(`Eine Zeile lautet 0 = ${n(bad[nn])}. Das ist ein <b>Widerspruch</b> → das LGS hat <b>keine Lösung</b>.`); return { steps, kind: 1 }; }
  if (pivCols.length < nn) { steps.push(`Eine Zeile lautet 0 = 0 (immer wahr). Es bleiben weniger Gleichungen als Unbekannte → <b>unendlich viele Lösungen</b>.`); return { steps, kind: 2 }; }
  const x = new Array(nn);
  for (let i = nn - 1; i >= 0; i--) {
    const r = M[i]; let rest = r[nn]; const known = [];
    for (let j = i + 1; j < nn; j++) { rest -= r[j] * x[j]; if (r[j] !== 0) known.push(`${p(r[j])}·${p(x[j])}`); }
    x[i] = rest / r[i];
    steps.push(`Aus ${Z(i)} (von unten nach oben einsetzen): ${ct(r[i])}${vars[i]}${known.length ? ' + ' + known.join(' + ') : ''} = ${n(r[nn])} ⇒ ${ct(r[i])}${vars[i]} = ${n(rest)} ⇒ <b>${vars[i]} = ${n(x[i])}</b>`);
  }
  return { steps, kind: 0, x };
}
function lgsText(A, b, vars) {
  return `<div class="lgs">${A.map((row, i) => `<div>${['I', 'II', 'III'][i]}: &nbsp;${lin(row, vars)} = ${n(b[i])}</div>`).join('')}</div>`;
}

def({ id: 'lgs_2', ch: 'lgs', name: 'LGS mit 2 Unbekannten', lvl: 1, gen() {
  let A; do { A = [[R.nz(-5, 5), R.nz(-5, 5)], [R.nz(-5, 5), R.nz(-5, 5)]]; } while (det2(A) === 0);
  const x = [R.int(-5, 5), R.int(-5, 5)], b = A.map(r => r[0] * x[0] + r[1] * x[1]);
  const vars = ['x', 'y'];
  const G = gaussSteps(A.map((r, i) => [...r, b[i]]), vars);
  return {
    q: `Löse das Gleichungssystem:${lgsText(A, b, vars)}`,
    type: 'vec', answer: x, labels: ['x =', 'y ='],
    hints: [
      `Additionsverfahren: Multipliziere die Gleichungen so, dass vor x (oder y) dieselbe Zahl mit umgekehrtem Vorzeichen steht. Dann addieren → eine Unbekannte fällt weg.`,
      `Rechne z. B. ${p(A[0][0])}·II − ${p(A[1][0])}·I. Dann bleibt nur y übrig. Danach y in I einsetzen.`,
    ],
    steps: [...G.steps, res(`x = ${n(x[0])}, y = ${n(x[1])}`)],
  };
} });

def({ id: 'lgs_3', ch: 'lgs', name: 'LGS mit 3 Unbekannten (Gauß)', lvl: 2, gen() {
  let A; do { A = [0, 1, 2].map(() => [R.int(-3, 3), R.int(-3, 3), R.int(-3, 3)]); } while (det3(A) === 0 || A[0][0] === 0);
  const x = [R.int(-4, 4), R.int(-4, 4), R.int(-4, 4)], b = A.map(r => V.dot(r, x));
  const G = gaussSteps(A.map((r, i) => [...r, b[i]]), X);
  return {
    q: `Löse das LGS mit dem Gauß-Verfahren:${lgsText(A, b, X)}`,
    type: 'vec', answer: x, labels: ['x₁ =', 'x₂ =', 'x₃ ='],
    hints: [
      `Gauß-Verfahren: Erst mit Zeile I die x₁ in Zeile II und III wegbekommen. Dann mit der neuen Zeile II das x₂ in Zeile III wegbekommen. Am Ende hat III nur noch x₃.`,
      `Starte mit: II → ${p(A[0][0])}·II − ${p(A[1][0])}·I und III → ${p(A[0][0])}·III − ${p(A[2][0])}·I. Dann weiter mit Spalte 2.`,
    ],
    steps: [...G.steps, res(`x₁ = ${n(x[0])}, x₂ = ${n(x[1])}, x₃ = ${n(x[2])}`)],
  };
} });






// =====================================================================
// Zusätzliche Grundkurs-Rechenaufgaben
// =====================================================================
function termK(k, name, first) { // „2a“, „− b“, „+ 3b“
  const a = Math.abs(k), c = a === 1 ? '' : String(a);
  if (first) return (k < 0 ? '−' : '') + c + ov(name);
  return (k < 0 ? ' − ' : ' + ') + c + ov(name);
}

def({ id: 'vek_linkomb', ch: 'vek', name: 'Vektoren addieren & vervielfachen', lvl: 1, gen() {
  const a = rvnz(-5, 5), b = rvnz(-5, 5), r = R.nz(-3, 3), s = R.nz(-3, 3);
  const ra = V.mul(r, a), sb = V.mul(s, b), c = V.add(ra, sb);
  const expr = termK(r, 'a', true) + termK(s, 'b', false);
  return {
    q: `Gegeben sind ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)}.<br>Berechne ${expr}.`,
    type: 'vec', answer: c,
    hints: [
      `Zwei Schritte: (1) Jeden Vektor mit seiner Zahl malnehmen – <b>jede Zeile</b>! (2) Dann Zeile für Zeile addieren.`,
      `${p(r)}·${vec(a)} = ${vec(ra)} und ${p(s)}·${vec(b)} = ${vec(sb)}. Jetzt nur noch zeilenweise addieren.`,
    ],
    steps: [
      `Ein Vektor wird mit einer Zahl multipliziert, indem man <b>jede Zeile</b> mit der Zahl multipliziert.`,
      `${p(r)}·${vec(a)} = ${vec(a.map(x => `${p(r)}·${p(x)}`))} = ${vec(ra)}`,
      `${p(s)}·${vec(b)} = ${vec(b.map(x => `${p(s)}·${p(x)}`))} = ${vec(sb)}`,
      `Addieren (oben + oben, Mitte + Mitte, unten + unten): ${vec(ra)} + ${vec(sb)} = ${vec(ra.map((x, i) => `${n(x)} + ${p(sb[i])}`))} = ${vec(c)}`,
      res(`${expr} = ${vec(c)}`),
    ],
  };
} });

def({ id: 'vek_faktor', ch: 'vek', name: 'Vielfaches eines Vektors erkennen', lvl: 2, gen() {
  const A = rv(-5, 5), u = rvnz(-3, 3), B = V.add(A, u), k = R.pick([-3, -2, -1, 2, 3, 4]);
  const C = V.add(A, V.mul(k, u)), AC = V.sub(C, A);
  const i = u.findIndex(x => x !== 0);
  return {
    q: `Die Punkte ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)} liegen auf einer Geraden.<br>Bestimme die Zahl k mit ${ov('AC')} = k · ${ov('AB')}.`,
    type: 'num', answer: k,
    hints: [
      `Berechne zuerst beide Verbindungsvektoren („Spitze minus Fuß“): ${ov('AB')} = B − A und ${ov('AC')} = C − A.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(AC)}. Teile eine Zeile von ${ov('AC')} durch dieselbe Zeile von ${ov('AB')}.`,
    ],
    steps: [
      `${ov('AB')} = ${vec(B)} − ${vec(A)} = ${vec(u)}`,
      `${ov('AC')} = ${vec(C)} − ${vec(A)} = ${vec(AC)}`,
      `Aus Zeile ${i + 1}: ${n(AC[i])} = k · ${p(u[i])} ⇒ k = ${n(AC[i])} : ${p(u[i])} = ${n(k)}`,
      `Probe mit allen Zeilen: ${n(k)} · ${vec(u)} = ${vec(V.mul(k, u))} ✓`,
      res(`k = ${n(k)}`),
    ],
  };
} });

def({ id: 'skp_innenwinkel', ch: 'skp', name: 'Innenwinkel im Dreieck', lvl: 3, gen() {
  let A, B, C; do { A = rv(-4, 4); B = rv(-4, 4); C = rv(-4, 4); } while (V.par(V.sub(B, A), V.sub(C, A)));
  const names = ['A', 'B', 'C'], P = [A, B, C], k = R.int(0, 2);
  const X0 = P[k], Y = P[(k + 1) % 3], Z = P[(k + 2) % 3], ny = names[(k + 1) % 3], nz = names[(k + 2) % 3], nx = names[k];
  const a = V.sub(Y, X0), b = V.sub(Z, X0), d = V.dot(a, b), la = V.len2(a), lb = V.len2(b);
  const ang = deg(Math.acos(d / Math.sqrt(la * lb)));
  const ab = ov(nx + ny), ac = ov(nx + nz);
  return {
    q: `Gegeben ist das Dreieck mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.<br>Berechne den Innenwinkel bei <b>${nx}</b> in Grad.<br><small>Runde auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [
      `Der Winkel bei ${nx} liegt zwischen den beiden Seiten, die <b>bei ${nx} starten</b>: ${ab} und ${ac}. Dann die Winkelformel cos α = (${ov('a')}·${ov('b')}) / (|${ov('a')}|·|${ov('b')}|).`,
      `${ab} = ${vec(a)}, ${ac} = ${vec(b)}. Skalarprodukt = ${n(d)}, Längen ${sq(la)} und ${sq(lb)}.`,
    ],
    steps: [
      `Beide Vektoren müssen bei ${nx} starten: ${ab} = ${ny} − ${nx} = ${vec(a)}, ${ac} = ${nz} − ${nx} = ${vec(b)}`,
      `Skalarprodukt: ${dotSteps(a, b, nx + ny, nx + nz)}`,
      `Längen: ${lenSteps(a, nx + ny)} und ${lenSteps(b, nx + nz)}`,
      `cos α = ${n(d)} / (${sq(la)}·${sq(lb)}) ≈ ${n(d / Math.sqrt(la * lb), 4)}`,
      `α = cos⁻¹(${n(d / Math.sqrt(la * lb), 4)}) ≈ ${n(ang, 1)}° <small>(Taschenrechner auf DEG!)</small>`,
      res(`Winkel bei ${nx} ≈ ${n(ang, 1)}°`),
    ],
  };
} });

def({ id: 'ger_param', ch: 'ger', name: 'Punktprobe: Parameter bestimmen', lvl: 1, gen() {
  const A = rv(-5, 5), u = rvnz(-3, 3), t = R.nz(-3, 3), P = V.add(A, V.mul(t, u));
  const rows = [0, 1, 2].map(i => u[i] === 0
    ? `${i + 1}. Zeile: ${n(P[i])} = ${n(A[i])} ✓ (gilt für jedes t)`
    : `${i + 1}. Zeile: ${n(P[i])} = ${n(A[i])} + ${ct(u[i])}t ⇒ ${ct(u[i])}t = ${n(P[i] - A[i])} ⇒ t = ${n(t)}`);
  return {
    q: `Der Punkt ${pt('P', P)} liegt auf der Geraden ${lineEq('g', A, u)}.<br>Für welchen Parameter t erhält man P?`,
    type: 'num', answer: t,
    hints: [
      `Setze P gleich der Geradengleichung: ${vec(P)} = ${vec(A)} + t·${vec(u)}. Das sind drei Gleichungen, eine pro Zeile.`,
      `Nimm eine Zeile, in der der Richtungsvektor keine 0 hat, und stelle nach t um. Die anderen Zeilen dienen zur Probe.`,
    ],
    steps: [
      `Ansatz: ${vec(P)} = ${vec(A)} + t·${vec(u)}`,
      `<ul class="calc">${rows.map(r => `<li>${r}</li>`).join('')}</ul>`,
      `Alle Zeilen liefern dasselbe t – P liegt also wirklich auf g.`,
      res(`t = ${n(t)}`),
    ],
  };
} });

def({ id: 'ger_winkel', ch: 'ger', name: 'Schnittwinkel zweier Geraden', lvl: 2, gen() {
  const { A, u, B, w } = lineLineCase(2);
  const d = V.dot(u, w), lu = V.len2(u), lw = V.len2(w), cv = Math.abs(d) / Math.sqrt(lu * lw), ang = deg(Math.acos(cv));
  return {
    q: `Die Geraden schneiden sich. Berechne ihren Schnittwinkel α in Grad.<br>${lineEq('g', A, u, 's')}<br>${lineEq('h', B, w, 't')}<br><small>Runde auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [
      `Für den Winkel brauchst du nur die <b>Richtungsvektoren</b>: cos α = |${ov('u')}·${ov('v')}| / (|${ov('u')}|·|${ov('v')}|). Die Betragsstriche oben sorgen dafür, dass α höchstens 90° ist.`,
      `${ov('u')} = ${vec(u)}, ${ov('v')} = ${vec(w)}, ${ov('u')}·${ov('v')} = ${n(d)}, |${ov('u')}| = ${sq(lu)}, |${ov('v')}| = ${sq(lw)}.`,
    ],
    steps: [
      `Richtungsvektoren ablesen: ${ov('u')} = ${vec(u)}, ${ov('v')} = ${vec(w)}`,
      dotSteps(u, w, 'u', 'v'),
      `Längen: |${ov('u')}| = ${sq(lu)}, |${ov('v')}| = ${sq(lw)}`,
      `cos α = |${n(d)}| / (${sq(lu)}·${sq(lw)}) ≈ ${n(cv, 4)}`,
      `α = cos⁻¹(${n(cv, 4)}) ≈ ${n(ang, 1)}°`,
      res(`α ≈ ${n(ang, 1)}°`),
    ],
  };
} });

// =====================================================================
// Ebenen in Parameterform
// =====================================================================
def({ id: 'ebe_punkt', ch: 'ebe', name: 'Punkt der Ebene berechnen', lvl: 1, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), r = R.nz(-2, 2), s = R.nz(-2, 2);
  const P = V.add(V.add(A, V.mul(r, u)), V.mul(s, v));
  return {
    q: `Gegeben ist die Ebene ${planeParam('E', A, u, v)}.<br>Berechne den Punkt P für r = ${n(r)} und s = ${n(s)}.`,
    type: 'vec', answer: P,
    hints: [
      `Setze r = ${n(r)} und s = ${n(s)} ein: P = Stützvektor + ${n(r)}·(1. Spannvektor) + ${n(s)}·(2. Spannvektor).`,
      `${p(r)}·${vec(u)} = ${vec(V.mul(r, u))} und ${p(s)}·${vec(v)} = ${vec(V.mul(s, v))}. Jetzt alles zum Stützvektor addieren.`,
    ],
    steps: [
      `Einsetzen: ${vec(A)} + ${p(r)}·${vec(u)} + ${p(s)}·${vec(v)}`,
      `Multiplizieren: ${vec(A)} + ${vec(V.mul(r, u))} + ${vec(V.mul(s, v))}`,
      `Zeilenweise addieren: ${vec(P)}`,
      res(pt('P', P)),
    ],
  };
} });

def({ id: 'ebe_rs', ch: 'ebe', name: 'Punktprobe Ebene: r und s bestimmen', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), r0 = R.nz(-3, 3), s0 = R.nz(-3, 3);
  const P = V.add(V.add(A, V.mul(r0, u)), V.mul(s0, v)), c = V.sub(P, A);
  let i, j; for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) if (u[a] * v[b] - u[b] * v[a] !== 0) { i = a; j = b; break; }
  const k = 3 - i - j;
  const eq2 = q => `${lin([u[q], v[q]], ['r', 's'])} = ${n(c[q])}`;
  return {
    q: `Der Punkt ${pt('P', P)} liegt in der Ebene<br>${planeParam('E', A, u, v)}<br>Bestimme die Parameter r und s.`,
    type: 'vec', answer: [r0, s0], labels: ['r =', 's ='],
    hints: [
      `Setze P gleich der Ebenengleichung. Du bekommst drei Gleichungen mit zwei Unbekannten r und s.`,
      `Bring den Stützvektor nach rechts. Dann lauten Zeile ${i + 1} und ${j + 1}: ${eq2(i)} und ${eq2(j)}. Löse dieses 2×2-LGS (Additionsverfahren) und mach die Probe mit Zeile ${k + 1}.`,
    ],
    steps: [
      `Ansatz: ${vec(P)} = ${vec(A)} + r·${vec(u)} + s·${vec(v)}`,
      `Stützvektor nach rechts bringen (P − A = ${vec(c)}):<ul class="calc">${[0, 1, 2].map(q => `<li>${q + 1}. Zeile: ${eq2(q)}</li>`).join('')}</ul>`,
      `Zeilen ${i + 1} und ${j + 1} lösen: Multipliziere so, dass r wegfällt, und setze das Ergebnis wieder ein. Ergebnis: r = ${n(r0)}, s = ${n(s0)}`,
      `Probe in Zeile ${k + 1}: ${lin([u[k], v[k]], ['r', 's'])} = ${p(u[k])}·${p(r0)} + ${p(v[k])}·${p(s0)} = ${n(u[k] * r0 + v[k] * s0)} = ${n(c[k])} ✓`,
      res(`r = ${n(r0)}, s = ${n(s0)}`),
    ],
  };
} });

def({ id: 'ebe_schnitt', ch: 'ebe', name: 'Schnittpunkt Gerade – Ebene', lvl: 3, gen() {
  let A, u, v, w, S, B, t0, M;
  do {
    A = rv(-3, 3); u = rvnz(-2, 2); v = rvNotPar(u, -2, 2); w = rvnz(-2, 2);
    M = [0, 1, 2].map(i => [u[i], v[i], -w[i]]);
  } while (det3(M) === 0);
  const r0 = R.int(-2, 2), s0 = R.int(-2, 2); t0 = R.nz(-2, 2);
  S = V.add(V.add(A, V.mul(r0, u)), V.mul(s0, v)); B = V.sub(S, V.mul(t0, w));
  const c = V.sub(B, A);
  const G = gaussSteps(M.map((row, i) => [...row, c[i]]), ['r', 's', 't']);
  return {
    q: `Berechne den Schnittpunkt S der Geraden ${lineEq('g', B, w)} mit der Ebene<br>${planeParam('E', A, u, v)}`,
    type: 'vec', answer: S,
    hints: [
      `Setze Ebene und Gerade gleich. Bring alle Unbekannten (r, s, t) nach links und die Zahlen nach rechts. Du bekommst ein LGS mit drei Gleichungen.`,
      `Das LGS lautet zeilenweise: ${[0, 1, 2].map(i => `${lin(M[i], ['r', 's', 't'])} = ${n(c[i])}`).join(' ; ')}. Löse es mit dem Gauß-Verfahren und setze t in die Gerade ein.`,
    ],
    steps: [
      `Gleichsetzen: ${vec(A)} + r·${vec(u)} + s·${vec(v)} = ${vec(B)} + t·${vec(w)}`,
      `Umstellen (t-Term nach links, Stützvektor A nach rechts):<div class="lgs">${[0, 1, 2].map(i => `<div>${['I', 'II', 'III'][i]}: ${lin(M[i], ['r', 's', 't'])} = ${n(c[i])}</div>`).join('')}</div>`,
      ...G.steps,
      `t = ${n(t0)} in die Gerade einsetzen: ${vec(B)} + ${p(t0)}·${vec(w)} = ${vec(S)}`,
      `<small>Kontrolle: r = ${n(r0)}, s = ${n(s0)} in die Ebene eingesetzt ergibt denselben Punkt.</small>`,
      res(pt('S', S)),
    ],
  };
} });

// ---------- Eingaben auswerten ----------
function parseNum(s) {
  if (s == null) return NaN;
  s = String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/,/g, '.').replace(/·|\*/g, '');
  if (!s) return NaN;
  const parts = s.split('/');
  if (parts.length === 2) return parseNum(parts[0]) / parseNum(parts[1]);
  if (parts.length > 2) return NaN;
  const m = s.match(/^([+-]?)(\d*\.?\d*)(?:√|sqrt)\(?(\d*\.?\d+)\)?$/);
  if (m) { const k = m[2] === '' ? 1 : parseFloat(m[2]); return (m[1] === '-' ? -1 : 1) * k * Math.sqrt(parseFloat(m[3])); }
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
  return NaN;
}
function isParallel(a, b) {
  if (a.every(x => Math.abs(x) < 1e-9) || b.every(x => Math.abs(x) < 1e-9)) return false;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++)
    if (Math.abs(a[i] * b[j] - a[j] * b[i]) > 1e-6 * (1 + Math.abs(a[i] * b[j]))) return false;
  return true;
}
// Liefert {ok, parts?: [bool]} – parts markiert richtige Komponenten (nur bei 'vec').
function check(task, input) {
  const tol = task.tol ?? 1e-6;
  switch (task.type) {
    case 'num': { const x = parseNum(input); return { ok: Number.isFinite(x) && Math.abs(x - task.answer) <= tol, invalid: !Number.isFinite(x) }; }
    case 'choice': return { ok: input === task.answer };
    case 'vec': {
      const xs = input.map(parseNum);
      const parts = xs.map((x, i) => Number.isFinite(x) && Math.abs(x - task.answer[i]) <= tol);
      return { ok: parts.every(Boolean), parts, invalid: xs.some(x => !Number.isFinite(x)) };
    }
    case 'vecpar': case 'plane': {
      const xs = input.map(parseNum);
      if (xs.some(x => !Number.isFinite(x))) return { ok: false, invalid: true };
      return { ok: isParallel(xs, task.answer) };
    }
  }
  return { ok: false };
}

function generate(typeId) {
  const T = TYPES.find(t => t.id === typeId);
  for (let tries = 0; tries < 20; tries++) {
    try {
      const task = T.gen();
      task.typeId = T.id; task.ch = T.ch; task.lvl = T.lvl; task.name = T.name;
      return task;
    } catch (e) { if (tries === 19) throw e; }
  }
}
function withSeed(seed, fn) { const old = R.rng; R.rng = seeded(seed); try { return fn(); } finally { R.rng = old; } }

const api = { CHAPTERS, TYPES, generate, check, parseNum, withSeed, R, V, fmt: { n, vec, lin } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Aufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
