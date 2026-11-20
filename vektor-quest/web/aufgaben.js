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
function reduceVec(v) { const g = gcdAll(v) || 1; let w = v.map(x => x / g); const f = w.find(x => x !== 0); if (f < 0) w = w.map(x => -x); return w.map(x => x || 0); }
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
const plane = (name, nv, d) => `${name}: ${lin(nv)} = ${n(d)}`;
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
const co = k => Math.abs(k) === 1 ? "" : String(Math.abs(k)); // Koeffizient vor t, 1 weglassen
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
function crossSteps(a, b) {
  const c = V.cross(a, b);
  return `<ul class="calc">
<li>1. Zeile: ${p(a[1])}·${p(b[2])} − ${p(a[2])}·${p(b[1])} = ${n(a[1] * b[2])} − ${p(a[2] * b[1])} = <b>${n(c[0])}</b></li>
<li>2. Zeile: ${p(a[2])}·${p(b[0])} − ${p(a[0])}·${p(b[2])} = ${n(a[2] * b[0])} − ${p(a[0] * b[2])} = <b>${n(c[1])}</b></li>
<li>3. Zeile: ${p(a[0])}·${p(b[1])} − ${p(a[1])}·${p(b[0])} = ${n(a[0] * b[1])} − ${p(a[1] * b[0])} = <b>${n(c[2])}</b></li></ul>`;
}
const CROSS_RULE = `Kreuzprodukt-Formel: ${vec(['a₁', 'a₂', 'a₃'])} × ${vec(['b₁', 'b₂', 'b₃'])} = ${vec(['a₂b₃ − a₃b₂', 'a₃b₁ − a₁b₃', 'a₁b₂ − a₂b₁'])}<br><small>Eselsbrücke: Für die 1. Zeile deckst du die 1. Zeile zu und rechnest „über Kreuz“ mit den anderen beiden (bei der 2. Zeile anders herum: erst 3., dann 1. Komponente).</small>`;
function lenSteps(v, name = 'v') {
  const s = V.len2(v);
  const r = rootStr(s);
  const approx = Number.isInteger(Math.sqrt(s)) ? '' : ` ≈ <b>${n(Math.sqrt(s))}</b>`;
  return `|${ov(name)}| = ${sq(v.map(x => p(x) + '²').join(' + '))} = ${sq(v.map(x => x * x).join(' + '))} = ${sq(s)}${r !== sq(s) ? ' = ' + r : ''}${approx || ` = <b>${r}</b>`}`;
}
function insertLine(nv, A, u, t = 't') { // n·(A + t·u) ausgeschrieben
  return nv.map((k, i) => k === 0 ? null : `${p(k)}·(${n(A[i])} ${u[i] < 0 ? '−' : '+'} ${co(u[i])}${t})`).filter(Boolean).join(' + ');
}

// ---------- Kapitel ----------
const CHAPTERS = [
  { id: 'vek', name: 'Vektoren – Grundlagen', icon: '➡️', desc: 'Verbindungsvektor, Länge, Mittelpunkt, Parallelogramm' },
  { id: 'skp', name: 'Skalarprodukt & Winkel', icon: '📐', desc: 'Orthogonalität, Winkel zwischen Vektoren' },
  { id: 'krz', name: 'Kreuzprodukt, Fläche & Volumen', icon: '✖️', desc: 'Normalenvektor, Dreiecke, Spat, Pyramide' },
  { id: 'ger', name: 'Geraden', icon: '📏', desc: 'Parameterform, Punktprobe, Lage, Schnittpunkt' },
  { id: 'ebe', name: 'Ebenen', icon: '🟦', desc: 'Parameter- & Koordinatenform, Spurpunkte' },
  { id: 'lag', name: 'Lage, Schnitte & Winkel', icon: '🔀', desc: 'Gerade ∩ Ebene, Ebene ∩ Ebene, Schnittwinkel' },
  { id: 'abs', name: 'Abstände & Spiegelung', icon: '📍', desc: 'Punkt–Ebene, Punkt–Gerade, Lotfußpunkt' },
  { id: 'lgs', name: 'LGS & Matrizen', icon: '🧮', desc: 'Gauß-Verfahren, Determinante, Matrizen' },
];

const TYPES = [];
function def(o) { TYPES.push(o); }

// =====================================================================
// Kapitel 1: Vektoren – Grundlagen
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

def({ id: 'vek_kollinear', ch: 'vek', name: 'Liegen drei Punkte auf einer Geraden?', lvl: 2, gen() {
  const A = rv(-5, 5), u = rvnz(-3, 3), B = V.add(A, u);
  const yes = R.chance(0.5);
  const k = R.pick([-2, 2, 3, -1]);
  let C = V.add(A, V.mul(k, u));
  if (!yes) { const i = R.int(0, 2); C = C.slice(); C[i] += R.nz(-2, 2); }
  const AC = V.sub(C, A);
  const ratios = AC.map((x, i) => u[i] === 0 ? (x === 0 ? 'beliebig (0 = 0)' : `${n(x)} ≠ 0 → unmöglich`) : `${n(x)} : ${p(u[i])} = ${n(x / u[i])}`);
  return {
    q: `Liegen die Punkte ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)} auf einer gemeinsamen Geraden?`,
    type: 'choice', options: ['Ja', 'Nein'], answer: yes ? 0 : 1,
    hints: [
      `Drei Punkte liegen auf einer Geraden, wenn ${ov('AC')} ein Vielfaches von ${ov('AB')} ist (die Vektoren sind dann „kollinear“).`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(AC)}. Gibt es eine Zahl k mit ${ov('AC')} = k·${ov('AB')}? Teile Zeile für Zeile.`,
    ],
    steps: [
      `Berechne beide Verbindungsvektoren: ${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(AC)}.`,
      `Prüfe, ob in jeder Zeile derselbe Faktor k herauskommt:<ul class="calc">${ratios.map(r => `<li>${r}</li>`).join('')}</ul>`,
      yes ? `Überall passt k = ${n(k)}. Also ist ${ov('AC')} = ${n(k)}·${ov('AB')}.` : `Die Faktoren stimmen nicht überein – es gibt kein passendes k.`,
      res(yes ? 'Ja, A, B und C liegen auf einer Geraden.' : 'Nein, die Punkte liegen nicht auf einer Geraden.'),
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

def({ id: 'skp_orth', ch: 'skp', name: 'Sind die Vektoren orthogonal?', lvl: 1, gen() {
  const a = rvnz(-4, 4); let b;
  const yes = R.chance(0.5);
  if (yes) { do { b = reduceVec(V.cross(a, rvNotPar(a, -2, 2))); if (R.chance(0.5)) b = V.mul(-1, b); } while (V.zero(b) || Math.max(...b.map(Math.abs)) > 12); }
  else { do { b = rvnz(-5, 5); } while (V.dot(a, b) === 0); }
  return {
    q: `Stehen ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)} senkrecht (orthogonal) aufeinander?`,
    type: 'choice', options: ['Ja, orthogonal', 'Nein'], answer: yes ? 0 : 1,
    hints: [
      `Zwei Vektoren sind genau dann orthogonal, wenn ihr <b>Skalarprodukt 0</b> ist.`,
      `Rechne ${a.map((x, i) => `${p(x)}·${p(b[i])}`).join(' + ')} aus. Kommt 0 heraus?`,
    ],
    steps: [
      `Regel: ${ov('a')} ⊥ ${ov('b')} ⇔ ${ov('a')} · ${ov('b')} = 0`,
      dotSteps(a, b),
      res(yes ? 'Das Skalarprodukt ist 0 → ja, orthogonal.' : `Das Skalarprodukt ist ${n(V.dot(a, b))} ≠ 0 → nicht orthogonal.`),
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

def({ id: 'skp_rechterwinkel', ch: 'skp', name: 'Rechter Winkel im Dreieck', lvl: 3, gen() {
  const names = ['A', 'B', 'C'];
  const which = R.int(0, 3); // 3 = keiner
  let P = rv(-4, 4), u, v;
  if (which < 3) {
    do { u = rvnz(-3, 3); v = reduceVec(V.cross(u, rvNotPar(u, -2, 2))); } while (Math.max(...v.map(Math.abs)) > 6);
  } else {
    do { u = rvnz(-3, 3); v = rvNotPar(u, -3, 3); } while (V.dot(u, v) === 0 || V.dot(u, V.sub(v, u)) === 0 || V.dot(v, V.sub(u, v)) === 0);
  }
  const pts = [];
  const idx = which < 3 ? which : 0;
  pts[idx] = P; pts[(idx + 1) % 3] = V.add(P, u); pts[(idx + 2) % 3] = V.add(P, v);
  const [A, B, C] = pts;
  const AB = V.sub(B, A), AC = V.sub(C, A), BA = V.sub(A, B), BC = V.sub(C, B), CA = V.sub(A, C), CB = V.sub(B, C);
  const dA = V.dot(AB, AC), dB = V.dot(BA, BC), dC = V.dot(CA, CB);
  return {
    q: `Gegeben ist das Dreieck mit ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)}.<br>An welcher Ecke hat das Dreieck einen rechten Winkel?`,
    type: 'choice', options: ['bei A', 'bei B', 'bei C', 'nirgends'], answer: which,
    hints: [
      `Ein rechter Winkel bei einer Ecke heißt: Die beiden Seiten, die dort losgehen, sind orthogonal → Skalarprodukt = 0.`,
      `Prüfe ${ov('AB')}·${ov('AC')} (Ecke A), ${ov('BA')}·${ov('BC')} (Ecke B) und ${ov('CA')}·${ov('CB')} (Ecke C).`,
    ],
    steps: [
      `Ecke A: ${ov('AB')} = ${vec(AB)}, ${ov('AC')} = ${vec(AC)} → Skalarprodukt = ${n(dA)}`,
      `Ecke B: ${ov('BA')} = ${vec(BA)}, ${ov('BC')} = ${vec(BC)} → Skalarprodukt = ${n(dB)}`,
      `Ecke C: ${ov('CA')} = ${vec(CA)}, ${ov('CB')} = ${vec(CB)} → Skalarprodukt = ${n(dC)}`,
      res(which < 3 ? `Bei ${names[which]} ist das Skalarprodukt 0 → rechter Winkel bei ${names[which]}.` : 'Kein Skalarprodukt ist 0 → kein rechter Winkel.'),
    ],
  };
} });

// =====================================================================
// Kapitel 3: Kreuzprodukt, Fläche & Volumen
// =====================================================================
def({ id: 'krz_cross', ch: 'krz', name: 'Kreuzprodukt berechnen', lvl: 1, gen() {
  const a = rvnz(-4, 4), b = rvNotPar(a, -4, 4), c = V.cross(a, b);
  return {
    q: `Berechne das Kreuzprodukt ${ov('a')} × ${ov('b')} mit ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)}.`,
    type: 'vec', answer: c,
    hints: [CROSS_RULE,
      `Erste Zeile: ${p(a[1])}·${p(b[2])} − ${p(a[2])}·${p(b[1])} = ${n(c[0])}. Die anderen zwei Zeilen gehen genauso (Formel aus Hinweis 1).`],
    steps: [CROSS_RULE, crossSteps(a, b),
      `Kontrolle: Das Ergebnis steht senkrecht auf beiden Vektoren: ${ov('a')}·${ov('n')} = ${n(V.dot(a, c))}, ${ov('b')}·${ov('n')} = ${n(V.dot(b, c))} ✓`,
      res(`${ov('a')} × ${ov('b')} = ${vec(c)}`)],
  };
} });

def({ id: 'krz_dreieck', ch: 'krz', name: 'Flächeninhalt eines Dreiecks', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-4, 4), v = rvNotPar(u, -4, 4), B = V.add(A, u), C = V.add(A, v);
  const c = V.cross(u, v), s = V.len2(c), F = Math.sqrt(s) / 2;
  return {
    q: `Berechne den Flächeninhalt des Dreiecks ABC mit ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)}.<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: F, tol: 0.011, unit: 'FE',
    hints: [
      `Die Länge des Kreuzprodukts ist die Fläche des Parallelogramms. Ein Dreieck ist die Hälfte davon: A = ½·|${ov('AB')} × ${ov('AC')}|.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}, ${ov('AB')} × ${ov('AC')} = ${vec(c)}. Jetzt Länge berechnen und halbieren.`,
    ],
    steps: [
      `Spannvektoren: ${ov('AB')} = B − A = ${vec(u)}, ${ov('AC')} = C − A = ${vec(v)}`,
      `Kreuzprodukt:${crossSteps(u, v)}`,
      `Länge: ${lenSteps(c, 'n')}`,
      `Dreieck = halbes Parallelogramm: ½ · ${n(Math.sqrt(s), 3)} ≈ ${n(F)}`,
      res(`A ≈ ${n(F)} FE`),
    ],
  };
} });

def({ id: 'krz_parallelogramm', ch: 'krz', name: 'Fläche eines Parallelogramms', lvl: 2, gen() {
  const u = rvnz(-4, 4), v = rvNotPar(u, -4, 4), c = V.cross(u, v), F = V.len(c);
  return {
    q: `Ein Parallelogramm wird von ${ov('a')} = ${vec(u)} und ${ov('b')} = ${vec(v)} aufgespannt. Wie groß ist seine Fläche?<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: F, tol: 0.011, unit: 'FE',
    hints: [
      `Fläche Parallelogramm = |${ov('a')} × ${ov('b')}| (Länge des Kreuzprodukts).`,
      `${ov('a')} × ${ov('b')} = ${vec(c)}. Davon die Länge √(…²+…²+…²).`,
    ],
    steps: [
      `Formel: A = |${ov('a')} × ${ov('b')}|`,
      `Kreuzprodukt:${crossSteps(u, v)}`,
      lenSteps(c, 'n'),
      res(`A ≈ ${n(F)} FE`),
    ],
  };
} });

def({ id: 'krz_spat', ch: 'krz', name: 'Volumen eines Spats', lvl: 3, gen() {
  let a, b, c, V0; do { a = rvnz(-3, 3); b = rvNotPar(a, -3, 3); c = rvnz(-3, 3); V0 = V.dot(V.cross(a, b), c); } while (V0 === 0);
  const ab = V.cross(a, b);
  return {
    q: `Berechne das Volumen des Spats (schiefer Quader), der von ${ov('a')} = ${vec(a)}, ${ov('b')} = ${vec(b)} und ${ov('c')} = ${vec(c)} aufgespannt wird.`,
    type: 'num', answer: Math.abs(V0), unit: 'VE',
    hints: [
      `Spatprodukt: V = |(${ov('a')} × ${ov('b')}) · ${ov('c')}|. Erst Kreuzprodukt, dann Skalarprodukt, dann Betrag.`,
      `${ov('a')} × ${ov('b')} = ${vec(ab)}. Jetzt Skalarprodukt mit ${ov('c')} = ${vec(c)} bilden.`,
    ],
    steps: [
      `Formel: V = |(${ov('a')} × ${ov('b')}) · ${ov('c')}|`,
      `Kreuzprodukt ${ov('a')} × ${ov('b')}:${crossSteps(a, b)}`,
      `Skalarprodukt: ${dotSteps(ab, c, 'n', 'c')}`,
      `Betrag nehmen (Volumen ist nie negativ): |${n(V0)}| = ${Math.abs(V0)}`,
      res(`V = ${Math.abs(V0)} VE`),
    ],
  };
} });

def({ id: 'krz_pyramide', ch: 'krz', name: 'Volumen einer dreiseitigen Pyramide', lvl: 3, gen() {
  let A, u, v, w, V0; do { A = rv(-3, 3); u = rvnz(-3, 3); v = rvNotPar(u, -3, 3); w = rvnz(-3, 3); V0 = V.dot(V.cross(u, v), w); } while (V0 === 0);
  const B = V.add(A, u), C = V.add(A, v), D = V.add(A, w), uv = V.cross(u, v), vol = Math.abs(V0) / 6;
  return {
    q: `Berechne das Volumen der Pyramide (Tetraeder) mit den Ecken ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)} und ${pt('D', D)}.<br><small>Runde auf 2 Nachkommastellen oder gib einen Bruch ein (z. B. 7/3).</small>`,
    type: 'num', answer: vol, tol: 0.011, unit: 'VE',
    hints: [
      `Eine dreiseitige Pyramide ist ⅙ des Spats: V = ⅙·|(${ov('AB')} × ${ov('AC')}) · ${ov('AD')}|.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}, ${ov('AD')} = ${vec(w)}. ${ov('AB')} × ${ov('AC')} = ${vec(uv)}.`,
    ],
    steps: [
      `Spannvektoren ab A: ${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}, ${ov('AD')} = ${vec(w)}`,
      `Kreuzprodukt ${ov('AB')} × ${ov('AC')}:${crossSteps(u, v)}`,
      `Skalarprodukt mit ${ov('AD')}: ${dotSteps(uv, w, 'n', 'AD')}`,
      `V = ⅙ · |${n(V0)}| = ${frac(Math.abs(V0), 6)} ≈ ${n(vol)}`,
      res(`V = ${frac(Math.abs(V0), 6)} ≈ ${n(vol)} VE`),
    ],
  };
} });

// =====================================================================
// Kapitel 4: Geraden
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

def({ id: 'ger_punktprobe', ch: 'ger', name: 'Punktprobe Gerade', lvl: 1, gen() {
  const A = rv(-5, 5), u = rvnz(-3, 3), t = R.nz(-3, 3);
  const yes = R.chance(0.5);
  let P = V.add(A, V.mul(t, u));
  if (!yes) { let i; do { i = R.int(0, 2); } while (u[i] === 0 && u.filter(x => x !== 0).length === 3); P = P.slice(); P[i] += R.nz(-2, 2); }
  const rows = [0, 1, 2].map(i => {
    if (u[i] === 0) return `${n(P[i])} = ${n(A[i])}${P[i] === A[i] ? ' ✓ (passt für jedes t)' : ' ✗ (Widerspruch!)'}`;
    const ti = (P[i] - A[i]) / u[i];
    return `${n(P[i])} = ${n(A[i])} + ${ct(u[i])}t ⇒ t = ${frac(P[i] - A[i], u[i])}`;
  });
  return {
    q: `Liegt der Punkt ${pt('P', P)} auf der Geraden ${lineEq('g', A, u)}?`,
    type: 'choice', options: ['Ja', 'Nein'], answer: yes ? 0 : 1,
    hints: [
      `Setze P mit der Geradengleichung gleich. Dann bekommst du drei Gleichungen für t – eine pro Zeile.`,
      `Löse jede Zeile nach t auf. Liegt P auf g, muss überall <b>dasselbe</b> t herauskommen.`,
    ],
    steps: [
      `Ansatz: ${vec(P)} = ${vec(A)} + t·${vec(u)}`,
      `Zeile für Zeile:<ul class="calc">${rows.map(r => `<li>${r}</li>`).join('')}</ul>`,
      yes ? `Alle Zeilen liefern t = ${n(t)}.` : `Die Zeilen liefern kein gemeinsames t → Widerspruch.`,
      res(yes ? `Ja, P liegt auf g (für t = ${n(t)}).` : 'Nein, P liegt nicht auf g.'),
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

def({ id: 'ger_lage', ch: 'ger', name: 'Lagebeziehung zweier Geraden', lvl: 2, gen() {
  const kind = R.int(0, 3);
  const { A, u, B, w } = lineLineCase(kind);
  const sol = lineLineSteps(A, u, B, w);
  const opts = ['identisch', 'echt parallel', 'schneiden sich', 'windschief'];
  return {
    q: `Wie liegen die Geraden zueinander?<br>${lineEq('g', A, u, 's')}<br>${lineEq('h', B, w, 't')}`,
    type: 'choice', options: opts, answer: sol.kind,
    hints: [
      `Immer zuerst die <b>Richtungsvektoren</b> vergleichen: Sind sie Vielfache voneinander? Ja → parallel oder identisch. Nein → Schnitt oder windschief.`,
      V.par(u, w) ? `Die Richtungsvektoren sind Vielfache. Jetzt Punktprobe: Liegt ${pt('B', B)} auf g?` : `Die Richtungsvektoren sind <b>keine</b> Vielfachen. Setze g = h und löse das LGS mit zwei Zeilen, dann Probe mit der dritten.`,
    ],
    steps: [...sol.steps, res(`Die Geraden sind ${opts[sol.kind]}${sol.kind === 2 ? '.' : '.'}`)],
  };
} });

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

// =====================================================================
// Kapitel 5: Ebenen
// =====================================================================
def({ id: 'ebe_np', ch: 'ebe', name: 'Koordinatenform aus Normalenvektor', lvl: 1, gen() {
  const nv = rvnz(-4, 4), P = rv(-4, 4), d = V.dot(nv, P);
  return {
    q: `Die Ebene E hat den Normalenvektor ${ov('n')} = ${vec(nv)} und enthält den Punkt ${pt('P', P)}.<br>Gib E in Koordinatenform an.`,
    type: 'plane', answer: [...nv, d],
    hints: [
      `Koordinatenform: n₁x₁ + n₂x₂ + n₃x₃ = d. Die Zahlen vor x₁, x₂, x₃ sind einfach die Einträge des Normalenvektors.`,
      `Also ${lin(nv)} = d. Um d zu bekommen, setze P ein: d = ${ov('n')} · ${ov('p')}.`,
    ],
    steps: [
      `Ansatz mit dem Normalenvektor: ${lin(nv)} = d`,
      `Punkt P einsetzen: d = ${nv.map((k, i) => `${p(k)}·${p(P[i])}`).join(' + ')} = ${n(d)}`,
      res(plane('E', nv, d)),
    ],
  };
} });

def({ id: 'ebe_normal', ch: 'ebe', name: 'Normalenvektor einer Ebene', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), c = V.cross(u, v);
  return {
    q: `Bestimme einen Normalenvektor der Ebene<br>${planeParam('E', A, u, v)}<br><small>Jedes Vielfache wird akzeptiert.</small>`,
    type: 'vecpar', answer: c,
    hints: [
      `Ein Normalenvektor steht senkrecht auf <b>beiden</b> Spannvektoren. Das Kreuzprodukt liefert genau so einen Vektor.`,
      `Berechne ${vec(u)} × ${vec(v)}.<br>${CROSS_RULE}`,
    ],
    steps: [
      `Normalenvektor = Kreuzprodukt der Spannvektoren: ${ov('n')} = ${vec(u)} × ${vec(v)}`,
      crossSteps(u, v),
      gcdAll(c) > 1 ? `Tipp: Du darfst kürzen → ${vec(reduceVec(c))} ist auch ein Normalenvektor.` : '',
      res(`${ov('n')} = ${vec(c)}`),
    ].filter(Boolean),
  };
} });

def({ id: 'ebe_param2koord', ch: 'ebe', name: 'Parameterform → Koordinatenform', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), c = V.cross(u, v), nr = reduceVec(c), d = V.dot(nr, A);
  return {
    q: `Wandle die Ebene in Koordinatenform um:<br>${planeParam('E', A, u, v)}`,
    type: 'plane', answer: [...nr, d],
    hints: [
      `Zwei Schritte: (1) Normalenvektor per Kreuzprodukt der Spannvektoren. (2) d durch Einsetzen des Stützpunkts.`,
      `${vec(u)} × ${vec(v)} = ${vec(c)}${gcdAll(c) > 1 ? ` (gekürzt: ${vec(nr)})` : ''}. Jetzt d = ${ov('n')} · ${vec(A)}.`,
    ],
    steps: [
      `<b>Normalenvektor:</b> ${ov('n')} = ${vec(u)} × ${vec(v)}${crossSteps(u, v)}${gcdAll(c) > 1 || c.find(x => x !== 0) < 0 ? `Gekürzt/vereinfacht: ${ov('n')} = ${vec(nr)}` : ''}`,
      `<b>Ansatz:</b> ${lin(nr)} = d`,
      `<b>Stützpunkt einsetzen:</b> d = ${nr.map((k, i) => `${p(k)}·${p(A[i])}`).join(' + ')} = ${n(d)}`,
      res(plane('E', nr, d)),
    ],
  };
} });

def({ id: 'ebe_3p', ch: 'ebe', name: 'Ebene durch drei Punkte', lvl: 3, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), B = V.add(A, u), C = V.add(A, v);
  const c = V.cross(u, v), nr = reduceVec(c), d = V.dot(nr, A);
  return {
    q: `Bestimme eine Koordinatengleichung der Ebene durch ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.`,
    type: 'plane', answer: [...nr, d],
    hints: [
      `Spannvektoren: ${ov('AB')} und ${ov('AC')}. Normalenvektor = ${ov('AB')} × ${ov('AC')}. Dann A einsetzen, um d zu bekommen.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}, Kreuzprodukt = ${vec(c)}.`,
    ],
    steps: [
      `<b>Spannvektoren:</b> ${ov('AB')} = B − A = ${vec(u)}, ${ov('AC')} = C − A = ${vec(v)}`,
      `<b>Normalenvektor:</b> ${ov('AB')} × ${ov('AC')}${crossSteps(u, v)}${gcdAll(c) > 1 || c.find(x => x !== 0) < 0 ? `vereinfacht: ${vec(nr)}` : ''}`,
      `<b>Punkt A einsetzen:</b> d = ${nr.map((k, i) => `${p(k)}·${p(A[i])}`).join(' + ')} = ${n(d)}`,
      `<b>Probe:</b> B und C einsetzen muss ebenfalls ${n(d)} ergeben: ${n(V.dot(nr, B))} und ${n(V.dot(nr, C))} ✓`,
      res(plane('E', nr, d)),
    ],
  };
} });

def({ id: 'ebe_punktprobe', ch: 'ebe', name: 'Punktprobe Ebene', lvl: 1, gen() {
  const nv = rvnz(-4, 4), Q = rv(-4, 4), d = V.dot(nv, Q);
  const yes = R.chance(0.5);
  let P;
  if (yes) { let w; do { w = V.cross(nv, rvnz(-2, 2)); } while (V.zero(w)); P = V.add(Q, w); }
  else { do { P = rv(-5, 5); } while (V.dot(nv, P) === d); }
  const val = V.dot(nv, P);
  return {
    q: `Liegt der Punkt ${pt('P', P)} in der Ebene ${plane('E', nv, d)}?`,
    type: 'choice', options: ['Ja', 'Nein'], answer: val === d ? 0 : 1,
    hints: [
      `Setze die Koordinaten von P für x₁, x₂, x₃ in die Ebenengleichung ein.`,
      `Kommt links genau ${n(d)} heraus, liegt P in E – sonst nicht.`,
    ],
    steps: [
      `Einsetzen: ${nv.map((k, i) => k === 0 ? null : `${p(k)}·${p(P[i])}`).filter(Boolean).join(' + ')} = ${n(val)}`,
      `Vergleich mit der rechten Seite: ${n(val)} ${val === d ? '=' : '≠'} ${n(d)}`,
      res(val === d ? 'Ja, P liegt in E.' : 'Nein, P liegt nicht in E.'),
    ],
  };
} });

def({ id: 'ebe_spur', ch: 'ebe', name: 'Spurpunkte einer Ebene', lvl: 1, gen() {
  const pool = [1, 2, 3, 4, 6, -1, -2, -3];
  const nv = [R.pick(pool), R.pick(pool), R.pick(pool)];
  const l = nv.reduce((a, b) => Math.abs(a * b) / gcd(a, b), 1);
  const d = l * R.pick([1, 2, -1]);
  const ax = R.int(0, 2), S = [0, 0, 0]; S[ax] = d / nv[ax];
  const axes = ['x₁-Achse', 'x₂-Achse', 'x₃-Achse'];
  return {
    q: `Berechne den Spurpunkt der Ebene ${plane('E', nv, d)} mit der <b>${axes[ax]}</b>.`,
    type: 'vec', answer: S,
    hints: [
      `Auf der ${axes[ax]} sind die beiden anderen Koordinaten 0. Setze sie in der Ebenengleichung gleich 0.`,
      `Übrig bleibt ${p(nv[ax])}·${X[ax]} = ${n(d)}. Nach ${X[ax]} auflösen.`,
    ],
    steps: [
      `Punkte auf der ${axes[ax]} haben die Form ${vec([0, 1, 2].map(i => i === ax ? X[ax] : 0))}.`,
      `Einsetzen: ${p(nv[ax])}·${X[ax]} = ${n(d)} ⇒ ${X[ax]} = ${n(d)} : ${p(nv[ax])} = ${n(S[ax])}`,
      res(`S${ax + 1}(${S.map(x => n(x)).join(' | ')})`),
    ],
  };
} });

// =====================================================================
// Kapitel 6: Lage, Schnitte & Winkel
// =====================================================================
function lineInPlane(nv, A, u, d) {
  const nA = V.dot(nv, A), nu = V.dot(nv, u);
  const steps = [
    `Setze die Zeilen der Geraden (x₁ = ${n(A[0])} ${u[0] < 0 ? '−' : '+'} ${co(u[0])}t usw.) in die Ebenengleichung ein:`,
    `${insertLine(nv, A, u)} = ${n(d)}`,
    `Ausmultiplizieren und sortieren: ${n(nA)} ${nu < 0 ? '−' : '+'} ${co(nu)}t = ${n(d)}`,
  ];
  return { nA, nu, steps };
}

def({ id: 'lag_ge_lage', ch: 'lag', name: 'Lage Gerade – Ebene', lvl: 2, gen() {
  const nv = rvnz(-3, 3), kind = R.int(0, 2), A = rv(-4, 4);
  let u, d;
  if (kind === 0) { do { u = rvnz(-3, 3); } while (V.dot(nv, u) === 0); d = V.dot(nv, A) + R.int(-6, 6); }
  else { do { u = V.cross(nv, rvNotPar(nv, -2, 2)); u = reduceVec(u); } while (V.zero(u)); d = V.dot(nv, A) + (kind === 1 ? R.nz(-6, 6) : 0); }
  const L = lineInPlane(nv, A, u, d);
  const opts = ['schneidet E in einem Punkt', 'ist echt parallel zu E', 'liegt in E'];
  let last;
  if (L.nu !== 0) last = `Die Gleichung hat genau eine Lösung t = ${frac(d - L.nA, L.nu)} → genau ein Schnittpunkt.`;
  else if (L.nA === d) last = `Das t fällt weg und es bleibt ${n(L.nA)} = ${n(d)} – immer wahr → unendlich viele Lösungen, g liegt in E.`;
  else last = `Das t fällt weg und es bleibt ${n(L.nA)} = ${n(d)} – ein Widerspruch → keine Lösung, g ist parallel.`;
  return {
    q: `Wie liegt die Gerade ${lineEq('g', A, u)} zur Ebene ${plane('E', nv, d)}?`,
    type: 'choice', options: opts, answer: kind,
    hints: [
      `Kurzer Test: Ist ${ov('n')}·${ov('u')} = 0? Dann ist der Richtungsvektor parallel zur Ebene (g parallel oder in E). Sonst gibt es einen Schnittpunkt.`,
      `${ov('n')}·${ov('u')} = ${n(L.nu)}. ${L.nu === 0 ? `Jetzt Punktprobe: Liegt ${pt('A', A)} in E? Einsetzen ergibt ${n(L.nA)}, rechts steht ${n(d)}.` : 'Also schneidet g die Ebene.'}`,
    ],
    steps: [...L.steps, last, res(`g ${opts[kind]}.`)],
  };
} });

def({ id: 'lag_ge_schnitt', ch: 'lag', name: 'Schnittpunkt Gerade – Ebene', lvl: 2, gen() {
  let nv, u; do { nv = rvnz(-3, 3); u = rvnz(-3, 3); } while (V.dot(nv, u) === 0);
  const S = rv(-4, 4), t0 = R.nz(-3, 3), A = V.sub(S, V.mul(t0, u)), d = V.dot(nv, S);
  const L = lineInPlane(nv, A, u, d);
  return {
    q: `Berechne den Schnittpunkt S der Geraden ${lineEq('g', A, u)} mit der Ebene ${plane('E', nv, d)}.`,
    type: 'vec', answer: S,
    hints: [
      `Ersetze in der Ebenengleichung x₁, x₂, x₃ durch die Zeilen der Geraden. Dann hast du eine Gleichung, in der nur noch t vorkommt.`,
      `Einsetzen gibt ${n(L.nA)} ${L.nu < 0 ? '−' : '+'} ${co(L.nu)}t = ${n(d)}. Löse nach t und setze t in g ein.`,
    ],
    steps: [...L.steps,
      `Nach t auflösen: ${ct(L.nu)}t = ${n(d)} − ${p(L.nA)} = ${n(d - L.nA)} ⇒ t = ${n(t0)}`,
      `t in g einsetzen: ${vec(A)} + ${p(t0)}·${vec(u)} = ${vec(S)}`,
      res(pt('S', S))],
  };
} });

def({ id: 'lag_ee_lage', ch: 'lag', name: 'Lage zweier Ebenen', lvl: 2, gen() {
  const n1 = rvnz(-4, 4), P = rv(-3, 3), d1 = V.dot(n1, P), kind = R.int(0, 2);
  let n2, d2;
  if (kind === 2) { do { n2 = rvnz(-4, 4); } while (V.par(n1, n2)); d2 = R.int(-8, 8); }
  else { const k = R.pick([-2, 2, 3, -1]); n2 = V.mul(k, n1); d2 = k * d1 + (kind === 1 ? R.nz(-4, 4) : 0); }
  const opts = ['identisch', 'echt parallel', 'schneiden sich in einer Geraden'];
  const par = V.par(n1, n2);
  const k = par ? n2.find(x => x !== 0) / n1.find(x => x !== 0) : null;
  return {
    q: `Wie liegen die Ebenen zueinander?<br>${plane('E₁', n1, d1)}<br>${plane('E₂', n2, d2)}`,
    type: 'choice', options: opts, answer: kind,
    hints: [
      `Vergleiche die Normalenvektoren ${vec(n1)} und ${vec(n2)}. Sind sie Vielfache, sind die Ebenen parallel oder identisch – sonst schneiden sie sich.`,
      par ? `${vec(n2)} = ${n(k)}·${vec(n1)}. Gilt das auch für die rechte Seite: ist ${n(d2)} = ${n(k)}·${n(d1)}?` : `Die Normalenvektoren sind keine Vielfachen voneinander.`,
    ],
    steps: [
      `Normalenvektoren: ${ov('n₁')} = ${vec(n1)}, ${ov('n₂')} = ${vec(n2)}`,
      par ? `${ov('n₂')} = ${n(k)}·${ov('n₁')} → parallel oder identisch.` : `Kein gemeinsamer Faktor → die Ebenen sind nicht parallel, also schneiden sie sich in einer Geraden.`,
      par ? `Rechte Seite prüfen: ${n(k)}·${p(d1)} = ${n(k * d1)} ${k * d1 === d2 ? '=' : '≠'} ${n(d2)} → ${k * d1 === d2 ? 'die ganze Gleichung ist ein Vielfaches → identisch' : 'nur die linke Seite passt → echt parallel'}.` : '',
      res(`Die Ebenen sind ${opts[kind]}.`),
    ].filter(Boolean),
  };
} });

def({ id: 'lag_winkel_ge', ch: 'lag', name: 'Schnittwinkel Gerade – Ebene', lvl: 3, gen() {
  let nv, u; do { nv = rvnz(-3, 3); u = rvnz(-3, 3); } while (V.dot(nv, u) === 0);
  const A = rv(-3, 3), d = R.int(-6, 6), nu = V.dot(nv, u), ln = V.len2(nv), lu = V.len2(u);
  const sv = Math.abs(nu) / Math.sqrt(ln * lu), ang = deg(Math.asin(sv));
  return {
    q: `Berechne den Schnittwinkel α zwischen der Geraden ${lineEq('g', A, u)} und der Ebene ${plane('E', nv, d)}.<br><small>In Grad, auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [
      `Bei Gerade und Ebene nimmst du den <b>Sinus</b> (nicht Kosinus!): sin α = |${ov('n')} · ${ov('u')}| / (|${ov('n')}| · |${ov('u')}|).`,
      `${ov('n')} = ${vec(nv)}, ${ov('u')} = ${vec(u)}, ${ov('n')}·${ov('u')} = ${n(nu)}, |${ov('n')}| = ${sq(ln)}, |${ov('u')}| = ${sq(lu)}.`,
    ],
    steps: [
      `Warum Sinus? Der Normalenvektor steht senkrecht auf der Ebene. Der Winkel zu ${ov('n')} ist also 90° − α, und cos(90° − α) = sin α.`,
      `Normalenvektor aus der Ebene ablesen: ${ov('n')} = ${vec(nv)}; Richtungsvektor: ${ov('u')} = ${vec(u)}`,
      dotSteps(nv, u, 'n', 'u'),
      `sin α = |${n(nu)}| / (${sq(ln)}·${sq(lu)}) ≈ ${n(sv, 4)}`,
      `α = sin⁻¹(${n(sv, 4)}) ≈ ${n(ang, 1)}°`,
      res(`α ≈ ${n(ang, 1)}°`),
    ],
  };
} });

def({ id: 'lag_winkel_ee', ch: 'lag', name: 'Schnittwinkel zweier Ebenen', lvl: 3, gen() {
  let n1, n2; do { n1 = rvnz(-3, 3); n2 = rvnz(-3, 3); } while (V.par(n1, n2));
  const d1 = R.int(-6, 6), d2 = R.int(-6, 6), dd = V.dot(n1, n2), l1 = V.len2(n1), l2 = V.len2(n2);
  const cv = Math.abs(dd) / Math.sqrt(l1 * l2), ang = deg(Math.acos(cv));
  return {
    q: `Berechne den Schnittwinkel α der Ebenen<br>${plane('E₁', n1, d1)}<br>${plane('E₂', n2, d2)}<br><small>In Grad, auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [
      `Der Winkel zwischen zwei Ebenen ist der Winkel zwischen ihren Normalenvektoren: cos α = |${ov('n₁')}·${ov('n₂')}| / (|${ov('n₁')}|·|${ov('n₂')}|). Der Betrag sorgt dafür, dass α ≤ 90° ist.`,
      `${ov('n₁')}·${ov('n₂')} = ${n(dd)}, |${ov('n₁')}| = ${sq(l1)}, |${ov('n₂')}| = ${sq(l2)}.`,
    ],
    steps: [
      `Normalenvektoren ablesen: ${ov('n₁')} = ${vec(n1)}, ${ov('n₂')} = ${vec(n2)}`,
      dotSteps(n1, n2, 'n₁', 'n₂'),
      `cos α = |${n(dd)}| / (${sq(l1)}·${sq(l2)}) ≈ ${n(cv, 4)}`,
      `α = cos⁻¹(${n(cv, 4)}) ≈ ${n(ang, 1)}°`,
      res(`α ≈ ${n(ang, 1)}°`),
    ],
  };
} });

// =====================================================================
// Kapitel 7: Abstände & Spiegelung
// =====================================================================
def({ id: 'abs_pp', ch: 'abs', name: 'Abstand zweier Punkte', lvl: 1, gen() {
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

function pointPlaneSetup() {
  const { n: nv, len } = niceNormal();
  const F = rv(-4, 4), d = V.dot(nv, F), k = R.nz(-2, 2), P = V.add(F, V.mul(k, nv));
  return { nv, len, F, d, k, P };
}

def({ id: 'abs_pe', ch: 'abs', name: 'Abstand Punkt – Ebene', lvl: 2, gen() {
  const { nv, len, d, k, P } = pointPlaneSetup();
  const top = V.dot(nv, P) - d;
  return {
    q: `Berechne den Abstand des Punktes ${pt('P', P)} von der Ebene ${plane('E', nv, d)}.`,
    type: 'num', answer: Math.abs(k) * len, unit: 'LE',
    hints: [
      `Hessesche Normalform (HNF): d(P, E) = |n₁p₁ + n₂p₂ + n₃p₃ − d| / |${ov('n')}|. Also: P in die linke Seite einsetzen, d abziehen, Betrag, durch die Länge des Normalenvektors teilen.`,
      `|${ov('n')}| = ${sq(V.len2(nv))} = ${len}. P eingesetzt: ${n(V.dot(nv, P))}, minus ${p(d)} ergibt ${n(top)}.`,
    ],
    steps: [
      `Formel: d(P, E) = ${fracOver(`|${lin(nv)} − ${p(d)}|`, `|${ov('n')}|`)} mit den Koordinaten von P eingesetzt.`,
      `Länge des Normalenvektors: ${lenSteps(nv, 'n')}`,
      `Zähler: |${nv.map((c, i) => `${p(c)}·${p(P[i])}`).join(' + ')} − ${p(d)}| = |${n(V.dot(nv, P))} − ${p(d)}| = |${n(top)}| = ${Math.abs(top)}`,
      `d(P, E) = ${Math.abs(top)} : ${len} = ${Math.abs(k) * len}`,
      res(`d(P, E) = ${Math.abs(k) * len} LE`),
    ],
  };
} });

def({ id: 'abs_lotfuss', ch: 'abs', name: 'Lotfußpunkt auf einer Ebene', lvl: 2, gen() {
  const { nv, F, d, k, P } = pointPlaneSetup();
  const L = lineInPlane(nv, P, nv, d);
  return {
    q: `Bestimme den Lotfußpunkt F des Punktes ${pt('P', P)} auf der Ebene ${plane('E', nv, d)}.<br><small>(F ist der Punkt in E, der P am nächsten liegt.)</small>`,
    type: 'vec', answer: F,
    hints: [
      `Stelle die <b>Lotgerade</b> auf: Sie startet in P und läuft in Richtung des Normalenvektors: l: ${ov('x')} = ${vec(P)} + t·${vec(nv)}.`,
      `Schneide die Lotgerade mit E: Einsetzen gibt ${n(L.nA)} ${L.nu < 0 ? '−' : '+'} ${co(L.nu)}t = ${n(d)}.`,
    ],
    steps: [
      `Lotgerade: ${lineEq('l', P, nv)} (Richtung = Normalenvektor, weil sie senkrecht auf E steht).`,
      ...L.steps,
      `⇒ ${ct(L.nu)}t = ${n(d - L.nA)} ⇒ t = ${n(-k)}`,
      `F = ${vec(P)} + ${p(-k)}·${vec(nv)} = ${vec(F)}`,
      res(pt('F', F)),
    ],
  };
} });

def({ id: 'abs_spiegel', ch: 'abs', name: 'Punkt an Ebene spiegeln', lvl: 3, gen() {
  const { nv, F, d, k, P } = pointPlaneSetup();
  const P2 = V.sub(P, V.mul(2 * k, nv));
  const L = lineInPlane(nv, P, nv, d);
  return {
    q: `Spiegle den Punkt ${pt('P', P)} an der Ebene ${plane('E', nv, d)}. Gib den Spiegelpunkt P' an.`,
    type: 'vec', answer: P2,
    hints: [
      `Plan: (1) Lotgerade durch P mit Richtung ${ov('n')}, (2) Schnittpunkt mit E = Lotfußpunkt F, (3) von P aus <b>doppelt</b> so weit gehen: P' = P + 2·${ov('PF')}.`,
      `Lotgerade ${lineEq('l', P, nv)} schneidet E bei t = ${n(-k)}. Für P' nimmst du einfach t = ${n(-2 * k)}.`,
    ],
    steps: [
      `Lotgerade: ${lineEq('l', P, nv)}`,
      ...L.steps,
      `⇒ t = ${n(-k)} → Lotfußpunkt F = ${vec(F)}`,
      `Spiegelpunkt: doppelter Parameter t = ${n(-2 * k)} → P' = ${vec(P)} + ${p(-2 * k)}·${vec(nv)} = ${vec(P2)}`,
      `(Alternativ: P' = P + 2·${ov('PF')} mit ${ov('PF')} = ${vec(V.sub(F, P))}.)`,
      res(`P'(${P2.map(x => n(x)).join(' | ')})`),
    ],
  };
} });

def({ id: 'abs_pg', ch: 'abs', name: 'Abstand Punkt – Gerade', lvl: 3, gen() {
  let A, u, t0, w, P, F;
  do {
    A = rv(-4, 4); u = rvnz(-2, 2); t0 = R.nz(-2, 2); F = V.add(A, V.mul(t0, u));
    w = reduceVec(V.cross(u, rvNotPar(u, -2, 2)));
  } while (Math.max(...w.map(Math.abs)) > 6);
  if (R.chance(0.5)) w = V.mul(-1, w);
  P = V.add(F, w);
  const s = V.len2(w), L = Math.sqrt(s), exact = Number.isInteger(L);
  const AP = V.sub(A, P), uu = V.len2(u), apu = V.dot(AP, u);
  return {
    q: `Berechne den Abstand des Punktes ${pt('P', P)} von der Geraden ${lineEq('g', A, u)}.${exact ? '' : '<br><small>Runde auf 2 Nachkommastellen oder gib die Wurzel ein.</small>'}`,
    type: 'num', answer: L, tol: exact ? 1e-6 : 0.011, unit: 'LE',
    hints: [
      `Suche den Punkt F auf g, für den ${ov('PF')} <b>senkrecht</b> auf dem Richtungsvektor steht: ${ov('PF')} · ${ov('u')} = 0. Der Abstand ist dann |${ov('PF')}|.`,
      `Allgemeiner Geradenpunkt: F_t = ${vec(A.map((a, i) => `${n(a)} ${u[i] < 0 ? '−' : '+'} ${co(u[i])}t`))}. Bilde ${ov('PF_t')} = F_t − P und setze das Skalarprodukt mit ${vec(u)} gleich 0.`,
    ],
    steps: [
      `Ein beliebiger Punkt auf g: F_t = ${vec(A.map((a, i) => `${n(a)} ${u[i] < 0 ? '−' : '+'} ${co(u[i])}t`))}`,
      `Verbindungsvektor: ${ov('PF_t')} = F_t − P = ${vec(AP.map((a, i) => `${n(a)} ${u[i] < 0 ? '−' : '+'} ${co(u[i])}t`))}`,
      `Orthogonalität: ${ov('PF_t')} · ${vec(u)} = 0 ⇒ ${n(apu)} + ${co(uu)}t = 0 ⇒ t = ${n(t0)}`,
      `Lotfußpunkt: F = ${vec(F)}, also ${ov('PF')} = ${vec(V.sub(F, P))}`,
      `Abstand: ${lenSteps(V.sub(F, P), 'PF')}`,
      res(`d(P, g) = ${exact ? L : rootStr(s) + ' ≈ ' + n(L)} LE`),
    ],
  };
} });

def({ id: 'abs_ee', ch: 'abs', name: 'Abstand paralleler Ebenen', lvl: 2, gen() {
  const { n: nv, len } = niceNormal();
  const d1 = R.int(-10, 10), m = R.nz(-3, 3), d2 = d1 + m * len;
  const scaled = R.chance(0.4), k = scaled ? R.pick([2, -2, 3]) : 1;
  const n2 = V.mul(k, nv), dd2 = k * d2;
  return {
    q: `Die Ebenen sind parallel. Berechne ihren Abstand.<br>${plane('E₁', nv, d1)}<br>${plane('E₂', n2, dd2)}`,
    type: 'num', answer: Math.abs(m) * len, unit: 'LE',
    hints: [
      (scaled ? `Bring zuerst beide Gleichungen auf denselben Normalenvektor (E₂ durch ${n(k)} teilen). ` : '') + `Dann gilt: Abstand = |d₂ − d₁| / |${ov('n')}|.`,
      `Gleicher Normalenvektor ${vec(nv)} mit |${ov('n')}| = ${len}. Rechte Seiten: ${n(d1)} und ${n(d2)}.`,
    ],
    steps: [
      scaled ? `E₂ durch ${n(k)} teilen: ${plane('E₂', nv, d2)}` : `Beide Ebenen haben schon denselben Normalenvektor ${vec(nv)}.`,
      `Länge: ${lenSteps(nv, 'n')}`,
      `Abstand = |d₂ − d₁| / |${ov('n')}| = |${n(d2)} − ${p(d1)}| / ${len} = ${Math.abs(d2 - d1)} / ${len} = ${Math.abs(m) * len}`,
      `<small>Alternative: Einen Punkt von E₁ nehmen und mit der HNF den Abstand zu E₂ ausrechnen – gleiches Ergebnis.</small>`,
      res(`d = ${Math.abs(m) * len} LE`),
    ],
  };
} });

// =====================================================================
// Kapitel 8: LGS & Matrizen
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
    steps.push(`Aus ${Z(i)} (von unten nach oben einsetzen): ${p(r[i])}${vars[i]}${known.length ? ' + ' + known.join(' + ') : ''} = ${n(r[nn])} ⇒ ${p(r[i])}${vars[i]} = ${n(rest)} ⇒ <b>${vars[i]} = ${n(x[i])}</b>`);
  }
  return { steps, kind: 0, x };
}
function lgsText(A, b, vars) {
  return `<div class="lgs">${A.map((row, i) => `<div>${['I', 'II', 'III'][i]}: &nbsp;${lin(row, vars)} = ${n(b[i])}</div>`).join('')}</div>`;
}
const det2 = M => M[0][0] * M[1][1] - M[0][1] * M[1][0];
const det3 = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);

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

def({ id: 'lgs_art', ch: 'lgs', name: 'Wie viele Lösungen hat das LGS?', lvl: 3, gen() {
  const kind = R.int(0, 2);
  let A, b;
  if (kind === 0) {
    do { A = [0, 1, 2].map(() => [R.int(-3, 3), R.int(-3, 3), R.int(-3, 3)]); } while (det3(A) === 0);
    const x = rv(-3, 3); b = A.map(r => V.dot(r, x));
  } else {
    let r1, r2; do { r1 = rvnz(-3, 3); r2 = rvnz(-3, 3); } while (V.par(r1, r2) || r1[0] === 0);
    const k1 = R.pick([1, -1, 2]), k2 = R.pick([1, -1, 2]);
    const r3 = V.add(V.mul(k1, r1), V.mul(k2, r2));
    const x = rv(-3, 3), b1 = V.dot(r1, x), b2 = V.dot(r2, x);
    A = [r1, r2, r3]; b = [b1, b2, k1 * b1 + k2 * b2 + (kind === 1 ? R.nz(-3, 3) : 0)];
    if (V.zero(r3)) { A[2] = V.add(r1, r2); b[2] = b1 + b2 + (kind === 1 ? 1 : 0); }
  }
  const G = gaussSteps(A.map((r, i) => [...r, b[i]]), X);
  const opts = ['genau eine Lösung', 'keine Lösung', 'unendlich viele Lösungen'];
  return {
    q: `Wie viele Lösungen hat dieses LGS?${lgsText(A, b, X)}`,
    type: 'choice', options: opts, answer: G.kind,
    hints: [
      `Bring das LGS mit dem Gauß-Verfahren auf Stufenform und schau dir die letzte Zeile an.`,
      `Letzte Zeile „0 = Zahl ≠ 0“ → keine Lösung. „0 = 0“ → unendlich viele. Sonst → genau eine Lösung.`,
    ],
    steps: [...G.steps, res(`Das LGS hat ${opts[G.kind]}.`)],
  };
} });

def({ id: 'mat_det2', ch: 'lgs', name: 'Determinante 2×2', lvl: 1, gen() {
  const M = [[R.int(-6, 6), R.int(-6, 6)], [R.int(-6, 6), R.int(-6, 6)]], D = det2(M);
  return {
    q: `Berechne die Determinante der Matrix ${mat(M)}`,
    type: 'num', answer: D,
    hints: [
      `Bei 2×2: Hauptdiagonale (oben links · unten rechts) minus Nebendiagonale (oben rechts · unten links).`,
      `${p(M[0][0])}·${p(M[1][1])} − ${p(M[0][1])}·${p(M[1][0])} = ?`,
    ],
    steps: [
      `det = a·d − b·c`,
      `det = ${p(M[0][0])}·${p(M[1][1])} − ${p(M[0][1])}·${p(M[1][0])} = ${n(M[0][0] * M[1][1])} − ${p(M[0][1] * M[1][0])} = ${n(D)}`,
      res(`det = ${n(D)}`),
    ],
  };
} });

def({ id: 'mat_det3', ch: 'lgs', name: 'Determinante 3×3 (Sarrus)', lvl: 2, gen() {
  const M = [0, 1, 2].map(() => [R.int(-3, 3), R.int(-3, 3), R.int(-3, 3)]), D = det3(M);
  const plus = [[0, 1, 2], [1, 2, 0], [2, 0, 1]].map(([a, b, c]) => M[0][a] * M[1][b] * M[2][c]);
  const minus = [[2, 1, 0], [0, 2, 1], [1, 0, 2]].map(([a, b, c]) => M[0][a] * M[1][b] * M[2][c]);
  const pf = [[0, 1, 2], [1, 2, 0], [2, 0, 1]].map(([a, b, c]) => `${p(M[0][a])}·${p(M[1][b])}·${p(M[2][c])}`);
  const mf = [[2, 1, 0], [0, 2, 1], [1, 0, 2]].map(([a, b, c]) => `${p(M[0][a])}·${p(M[1][b])}·${p(M[2][c])}`);
  return {
    q: `Berechne die Determinante mit der Regel von Sarrus: ${mat(M)}`,
    type: 'num', answer: D,
    hints: [
      `Sarrus: Schreib die ersten beiden Spalten noch einmal rechts daneben. Dann: Summe der 3 Diagonalen von links oben nach rechts unten <b>minus</b> Summe der 3 Diagonalen von rechts oben nach links unten.`,
      `Plus-Diagonalen: ${pf.join(', ')}. Minus-Diagonalen: ${mf.join(', ')}.`,
    ],
    steps: [
      `Matrix mit den ersten zwei Spalten wiederholt: ${mat(M.map(r => [...r, r[0], r[1]]))}`,
      `Abwärts-Diagonalen (+): ${pf.join(' + ')} = ${plus.map(x => p(x)).join(' + ')} = ${n(plus.reduce((a, b) => a + b))}`,
      `Aufwärts-Diagonalen (−): ${mf.join(' + ')} = ${minus.map(x => p(x)).join(' + ')} = ${n(minus.reduce((a, b) => a + b))}`,
      `det = ${n(plus.reduce((a, b) => a + b))} − ${p(minus.reduce((a, b) => a + b))} = ${n(D)}`,
      res(`det = ${n(D)}`),
    ],
  };
} });

def({ id: 'mat_vec', ch: 'lgs', name: 'Matrix mal Vektor', lvl: 1, gen() {
  const M = [0, 1, 2].map(() => [R.int(-3, 4), R.int(-3, 4), R.int(-3, 4)]), v = rv(-4, 4), r = M.map(row => V.dot(row, v));
  return {
    q: `Berechne ${mat(M)} · ${vec(v)}`,
    type: 'vec', answer: r,
    hints: [
      `Zeile mal Spalte: Für jede Ergebnis-Zeile nimmst du eine Zeile der Matrix und bildest das „Skalarprodukt“ mit dem Vektor.`,
      `1. Zeile: ${M[0].map((x, i) => `${p(x)}·${p(v[i])}`).join(' + ')} = ${n(r[0])}. Die anderen beiden genauso.`,
    ],
    steps: [
      `Regel: Ergebnis-Zeile i = (Zeile i der Matrix) · Vektor`,
      `<ul class="calc">${M.map((row, i) => `<li>${i + 1}. Zeile: ${row.map((x, j) => `${p(x)}·${p(v[j])}`).join(' + ')} = <b>${n(r[i])}</b></li>`).join('')}</ul>`,
      res(vec(r)),
    ],
  };
} });

def({ id: 'mat_mul', ch: 'lgs', name: 'Matrizen multiplizieren (2×2)', lvl: 2, gen() {
  const A = [[R.int(-4, 4), R.int(-4, 4)], [R.int(-4, 4), R.int(-4, 4)]], B = [[R.int(-4, 4), R.int(-4, 4)], [R.int(-4, 4), R.int(-4, 4)]];
  const C = [0, 1].map(i => [0, 1].map(j => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
  const f = (i, j) => `${p(A[i][0])}·${p(B[0][j])} + ${p(A[i][1])}·${p(B[1][j])} = <b>${n(C[i][j])}</b>`;
  return {
    q: `Berechne das Produkt A · B mit A = ${mat(A)} und B = ${mat(B)}.<br><small>Gib die Einträge zeilenweise ein.</small>`,
    type: 'vec', answer: [C[0][0], C[0][1], C[1][0], C[1][1]], labels: ['c₁₁ =', 'c₁₂ =', 'c₂₁ =', 'c₂₂ ='], grid: 2,
    hints: [
      `„Zeile mal Spalte“: Der Eintrag c_ij (Zeile i, Spalte j) ist Zeile i von A mal Spalte j von B.`,
      `c₁₁ = ${f(0, 0)}. Für c₁₂ nimm Zeile 1 von A und Spalte 2 von B usw.`,
    ],
    steps: [
      `Für jeden Eintrag: Zeile von A mit Spalte von B multiplizieren und addieren.`,
      `<ul class="calc"><li>c₁₁ = ${f(0, 0)}</li><li>c₁₂ = ${f(0, 1)}</li><li>c₂₁ = ${f(1, 0)}</li><li>c₂₂ = ${f(1, 1)}</li></ul>`,
      res(`A · B = ${mat(C)}`),
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

const api = { CHAPTERS, TYPES, generate, check, parseNum, withSeed, R, V, fmt: { n, vec, plane, lin } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Aufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
