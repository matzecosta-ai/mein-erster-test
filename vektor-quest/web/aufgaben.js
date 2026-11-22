// Vektor-Quest: Aufgaben-Generatoren für Analytische Geometrie (Grundkurs Berlin).
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
function lenSteps(v, name = 'v') {
  const s = V.len2(v);
  const r = rootStr(s);
  const approx = Number.isInteger(Math.sqrt(s)) ? '' : ` ≈ <b>${n(Math.sqrt(s))}</b>`;
  return `|${ov(name)}| = ${sq(v.map(x => p(x) + '²').join(' + '))} = ${sq(v.map(x => x * x).join(' + '))} = ${sq(s)}${r !== sq(s) ? ' = ' + r : ''}${approx || ` = <b>${r}</b>`}`;
}

function lineInPlane(nv, A, u, d) {
  const nA = V.dot(nv, A), nu = V.dot(nv, u);
  const steps = [
    `Setze die Zeilen der Geraden (x₁ = ${n(A[0])} ${u[0] < 0 ? '−' : '+'} ${co(u[0])}t usw.) in die Ebenengleichung ein:`,
    `${insertLine(nv, A, u)} = ${n(d)}`,
    `Ausmultiplizieren und sortieren: ${n(nA)} ${nu < 0 ? '−' : '+'} ${co(nu)}t = ${n(d)}`,
  ];
  return { nA, nu, steps };
}
function pointPlaneSetup() {
  const { n: nv, len } = niceNormal();
  const F = rv(-4, 4), d = V.dot(nv, F), k = R.nz(-2, 2), P = V.add(F, V.mul(k, nv));
  return { nv, len, F, d, k, P };
}
function insertLine(nv, A, u, t = 't') { // n·(A + t·u) ausgeschrieben
  return nv.map((k, i) => k === 0 ? null : `${p(k)}·(${n(A[i])} ${u[i] < 0 ? '−' : '+'} ${co(u[i])}${t})`).filter(Boolean).join(' + ');
}

// ---------- Kapitel ----------
const CHAPTERS = [ // Inhalte nach den Berliner Prüfungsschwerpunkten Mathematik Grundkurs (2026–2028)
  { id: 'vek', name: 'Vektoren – Grundlagen', icon: '➡️', desc: 'Rechnen, Länge, Mittelpunkt, Teilverhältnis, Einheitsvektor, Linearkombination' },
  { id: 'skp', name: 'Skalarprodukt & Winkel', icon: '📐', desc: 'Orthogonalität, Winkel zwischen Vektoren, Winkel im Dreieck' },
  { id: 'fig', name: 'Figuren, Flächen & Körper', icon: '🔺', desc: 'Dreiecke & Vierecke untersuchen, Flächen, Umfang, Pyramide' },
  { id: 'ger', name: 'Geraden', icon: '📏', desc: 'Parameterform, Punktprobe, Spurpunkt, Lage, Schnittpunkt, Winkel' },
  { id: 'ebe', name: 'Ebenen', icon: '🟦', desc: 'Parameter- & Koordinatenform, Normalenvektor, Punktprobe, Spurpunkte' },
  { id: 'lag', name: 'Lage, Schnitte & Winkel', icon: '🔀', desc: 'Durchstoßpunkt, Schnittgerade, Winkel zwischen Gerade/Ebene/Ebene' },
  { id: 'abs', name: 'Abstände & Spiegelung', icon: '📍', desc: 'Lotfußpunkt, Abstand Punkt–Ebene, parallele Ebenen, Spiegelung' },
  { id: 'lgs', name: 'LGS lösen (Gauß)', icon: '🧮', desc: 'Gleichungssysteme mit 2 und 3 Unbekannten, Lösbarkeit' },
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
// Kapitel: Geraden
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
// Abstand (gehört zu Kapitel 1)
// =====================================================================
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
// LGS lösen (Gauß)
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





// =====================================================================
// Weitere Grundkurs-Aufgaben
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

// =====================================================================
// Figuren & Körper (typische Grundkurs-Abituraufgaben)
// =====================================================================
// Zeilen orthogonaler Matrizen: paarweise senkrecht, alle gleich lang
const OTRIPLES = [[[1, 2, 2], [2, 1, -2], [2, -2, 1], 3], [[2, 3, 6], [3, -6, 2], [6, 2, -3], 7], [[2, 6, 9], [6, 7, -6], [9, -6, 2], 11], [[1, 0, 0], [0, 1, 0], [0, 0, 1], 1]];
function shuffleCoords() { // gleiche Permutation + Vorzeichen für mehrere Vektoren
  const perm = R.shuffle([0, 1, 2]), sg = [0, 1, 2].map(() => R.pick([1, -1]));
  return v => perm.map((j, i) => sg[i] * v[j]);
}
function orthoPair() { // u ⟂ v, |u| = |v|
  const T = R.pick(OTRIPLES), f = shuffleCoords(), k = T[3] === 1 ? R.int(2, 5) : 1;
  const [i, j] = R.shuffle([0, 1, 2]);
  return { u: V.mul(k, f(T[i])), v: V.mul(k, f(T[j])), L: T[3] * k };
}
function equalNotOrtho(u) { // gleich lang wie u, nicht senkrecht, nicht parallel
  let v, g = 0;
  do { const f = shuffleCoords(); v = f(u); g++; } while ((V.dot(u, v) === 0 || V.par(u, v)) && g < 50);
  return (V.dot(u, v) === 0 || V.par(u, v)) ? null : v;
}
const lenTxt = s => Number.isInteger(Math.sqrt(s)) ? String(Math.sqrt(s)) : rootStr(s);

def({ id: 'fig_dreieck', ch: 'fig', name: 'Dreieck untersuchen', lvl: 2, gen() {
  const kind = R.int(0, 3); // 0 gleichschenklig, 1 rechtwinklig, 2 beides, 3 weder noch
  let P, u, v;
  for (;;) {
    P = rv(-4, 4);
    if (kind === 2) { ({ u, v } = orthoPair()); }
    else if (kind === 1) { const o = orthoPair(); u = o.u; v = V.mul(R.pick([2, 3]), o.v); if (Math.max(...v.map(Math.abs)) > 12) continue; }
    else if (kind === 0) { u = rvnz(-3, 3); v = equalNotOrtho(u); if (!v) continue; }
    else { u = rvnz(-4, 4); v = rvNotPar(u, -4, 4); }
    const Q = [P, V.add(P, u), V.add(P, v)];
    const s = [V.len2(V.sub(Q[1], Q[0])), V.len2(V.sub(Q[2], Q[1])), V.len2(V.sub(Q[2], Q[0]))];
    const eq = s[0] === s[1] || s[1] === s[2] || s[0] === s[2], all = s[0] === s[1] && s[1] === s[2];
    const m = Math.max(...s), right = s[0] + s[1] + s[2] === 2 * m;
    const got = eq && right ? 2 : right ? 1 : eq ? 0 : 3;
    if (all || got !== kind) continue;
    var pts = R.shuffle(Q); break;
  }
  const [A, B, C] = pts;
  const ab = V.len2(V.sub(B, A)), bc = V.len2(V.sub(C, B)), ac = V.len2(V.sub(C, A));
  const L = [['AB', ab], ['BC', bc], ['AC', ac]], big = L.reduce((x, y) => y[1] > x[1] ? y : x), rest = L.filter(x => x !== big);
  const opts = ['gleichschenklig (nicht rechtwinklig)', 'rechtwinklig (nicht gleichschenklig)', 'rechtwinklig und gleichschenklig', 'weder rechtwinklig noch gleichschenklig'];
  const isEq = ab === bc || bc === ac || ab === ac, isRight = big[1] === rest[0][1] + rest[1][1];
  return {
    q: `Untersuche das Dreieck mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.<br>Welche Aussage trifft zu?`,
    type: 'choice', options: opts, answer: kind,
    hints: [
      `Berechne alle drei Seitenlängen. <b>Gleichschenklig</b>: zwei Seiten sind gleich lang. <b>Rechtwinklig</b>: Satz des Pythagoras gilt (oder ein Skalarprodukt zweier Seiten ist 0).`,
      `Es reicht, die <b>Quadrate</b> der Längen zu vergleichen: |${ov('AB')}|² = ${ab}, |${ov('BC')}|² = ${bc}, |${ov('AC')}|² = ${ac}. Gilt „größtes Quadrat = Summe der beiden anderen“?`,
    ],
    steps: [
      `Seitenvektoren: ${ov('AB')} = ${vec(V.sub(B, A))}, ${ov('BC')} = ${vec(V.sub(C, B))}, ${ov('AC')} = ${vec(V.sub(C, A))}`,
      `Längen: |${ov('AB')}| = ${sq(ab)}${lenTxt(ab) !== sq(ab) ? ' = ' + lenTxt(ab) : ''}, |${ov('BC')}| = ${sq(bc)}${lenTxt(bc) !== sq(bc) ? ' = ' + lenTxt(bc) : ''}, |${ov('AC')}| = ${sq(ac)}${lenTxt(ac) !== sq(ac) ? ' = ' + lenTxt(ac) : ''}`,
      isEq ? `Zwei Seiten sind gleich lang → <b>gleichschenklig</b>.` : `Alle drei Seiten sind verschieden lang → nicht gleichschenklig.`,
      `Pythagoras-Test mit der längsten Seite ${big[0]}: ${rest[0][1]} + ${rest[1][1]} = ${rest[0][1] + rest[1][1]} ${isRight ? '=' : '≠'} ${big[1]} → ${isRight ? '<b>rechtwinklig</b> (der rechte Winkel liegt gegenüber von ' + big[0] + ')' : 'nicht rechtwinklig'}.`,
      res(`Das Dreieck ist ${opts[kind]}.`),
    ],
  };
} });

def({ id: 'fig_viereck', ch: 'fig', name: 'Viereck bestimmen', lvl: 2, gen() {
  const kind = R.int(0, 3); // 0 Quadrat, 1 Rechteck, 2 Raute, 3 Parallelogramm
  let u, v;
  for (;;) {
    if (kind === 0) ({ u, v } = orthoPair());
    else if (kind === 1) { const o = orthoPair(); u = o.u; v = V.mul(R.pick([2, 3]), o.v); if (Math.max(...v.map(Math.abs)) > 12) continue; }
    else if (kind === 2) { u = rvnz(-3, 3); v = equalNotOrtho(u); if (!v) continue; }
    else { u = rvnz(-4, 4); v = rvNotPar(u, -4, 4); if (V.dot(u, v) === 0 || V.len2(u) === V.len2(v)) continue; }
    break;
  }
  const A = rv(-4, 4), B = V.add(A, u), C = V.add(B, v), D = V.add(A, v);
  const l1 = V.len2(u), l2 = V.len2(v), d = V.dot(u, v);
  const opts = ['Quadrat', 'Rechteck (kein Quadrat)', 'Raute (kein Quadrat)', 'Parallelogramm (weder Rechteck noch Raute)'];
  return {
    q: `Die Punkte ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)} und ${pt('D', D)} bilden ein Viereck ABCD.<br>Um welches Viereck handelt es sich genau?`,
    type: 'choice', options: opts, answer: kind,
    hints: [
      `Schritt für Schritt: (1) Ist ${ov('AB')} = ${ov('DC')}? Dann ist es ein Parallelogramm. (2) Sind ${ov('AB')} und ${ov('AD')} senkrecht? → Rechteck. (3) Sind sie gleich lang? → Raute. Beides → Quadrat.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AD')} = ${vec(v)}. Berechne ${ov('AB')}·${ov('AD')} und vergleiche |${ov('AB')}|² mit |${ov('AD')}|².`,
    ],
    steps: [
      `${ov('AB')} = B − A = ${vec(u)} und ${ov('DC')} = C − D = ${vec(V.sub(C, D))} → gleich, also ist ABCD ein <b>Parallelogramm</b>.`,
      `Rechter Winkel bei A? ${dotSteps(u, v, 'AB', 'AD')} → ${d === 0 ? 'ja, senkrecht' : 'nein'}`,
      `Gleich lange Seiten? |${ov('AB')}| = ${sq(l1)}, |${ov('AD')}| = ${sq(l2)} → ${l1 === l2 ? 'ja, gleich lang' : 'nein'}`,
      `Senkrecht + gleich lang = Quadrat · nur senkrecht = Rechteck · nur gleich lang = Raute · keins = Parallelogramm`,
      res(`ABCD ist ein ${opts[kind]}.`),
    ],
  };
} });

def({ id: 'fig_rechteck', ch: 'fig', name: 'Flächeninhalt eines Rechtecks', lvl: 2, gen() {
  const o = orthoPair(); const m = R.pick([1, 2]); const u = o.u, v = V.mul(m, o.v);
  if (Math.max(...v.map(Math.abs)) > 14) return this.gen();
  const A = rv(-4, 4), B = V.add(A, u), C = V.add(B, v), D = V.add(A, v), F = Math.sqrt(V.len2(u)) * Math.sqrt(V.len2(v));
  return {
    q: `ABCD mit ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)} und ${pt('D', D)} ist ein Rechteck.<br>Berechne seinen Flächeninhalt.`,
    type: 'num', answer: F, unit: 'FE',
    hints: [
      `Fläche eines Rechtecks = Länge · Breite = |${ov('AB')}| · |${ov('AD')}|.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AD')} = ${vec(v)}. Berechne beide Längen und multipliziere.`,
    ],
    steps: [
      `Seiten: ${ov('AB')} = ${vec(u)}, ${ov('AD')} = ${vec(v)}`,
      `<small>Kontrolle rechter Winkel: ${dotSteps(u, v, 'AB', 'AD')}</small>`,
      lenSteps(u, 'AB'),
      lenSteps(v, 'AD'),
      `A = ${n(Math.sqrt(V.len2(u)))} · ${n(Math.sqrt(V.len2(v)))} = ${n(F)}`,
      res(`A = ${n(F)} FE`),
    ],
  };
} });

def({ id: 'fig_rwdreieck', ch: 'fig', name: 'Rechtwinkliges Dreieck: Fläche', lvl: 2, gen() {
  const o = orthoPair(); const m = R.pick([1, 2]); const u = o.u, v = V.mul(m, o.v);
  if (Math.max(...v.map(Math.abs)) > 14) return this.gen();
  const A = rv(-4, 4), B = V.add(A, u), C = V.add(A, v), a = Math.sqrt(V.len2(u)), b = Math.sqrt(V.len2(v)), F = a * b / 2;
  return {
    q: `Das Dreieck ABC mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)} hat bei A einen rechten Winkel.<br>Berechne den Flächeninhalt.`,
    type: 'num', answer: F, tol: 0.011, unit: 'FE',
    hints: [
      `Bei einem rechtwinkligen Dreieck sind die beiden Seiten am rechten Winkel Grundseite und Höhe: A = ½ · |${ov('AB')}| · |${ov('AC')}|.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}. Längen berechnen, multiplizieren, halbieren.`,
    ],
    steps: [
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)} <small>(Kontrolle: ${ov('AB')}·${ov('AC')} = ${n(V.dot(u, v))} → rechter Winkel ✓)</small>`,
      lenSteps(u, 'AB'),
      lenSteps(v, 'AC'),
      `A = ½ · ${n(a)} · ${n(b)} = ${n(F)}`,
      res(`A = ${n(F)} FE`),
    ],
  };
} });

def({ id: 'fig_umfang', ch: 'fig', name: 'Umfang eines Dreiecks', lvl: 1, gen() {
  const A = rv(-4, 4), u = rvnz(-4, 4), v = rvNotPar(u, -4, 4), B = V.add(A, u), C = V.add(A, v);
  const s = [V.sub(B, A), V.sub(C, B), V.sub(C, A)], L = s.map(V.len), U = L.reduce((a, b) => a + b);
  return {
    q: `Berechne den Umfang des Dreiecks mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: U, tol: 0.03, unit: 'LE',
    hints: [
      `Umfang = Summe der drei Seitenlängen: |${ov('AB')}| + |${ov('BC')}| + |${ov('AC')}|.`,
      `${ov('AB')} = ${vec(s[0])}, ${ov('BC')} = ${vec(s[1])}, ${ov('AC')} = ${vec(s[2])}. Von jedem die Länge √(…²+…²+…²).`,
    ],
    steps: [
      lenSteps(s[0], 'AB'), lenSteps(s[1], 'BC'), lenSteps(s[2], 'AC'),
      `U ≈ ${L.map(x => n(x)).join(' + ')} ≈ ${n(U)} <small>(mit ungerundeten Werten weiterrechnen!)</small>`,
      res(`U ≈ ${n(U)} LE`),
    ],
  };
} });

def({ id: 'fig_pyramide', ch: 'fig', name: 'Volumen einer Pyramide', lvl: 3, gen() {
  const [a0, b0] = R.pick([[2, 0], [4, 0], [3, 1], [1, 3], [2, 2], [4, 2], [6, 0], [3, 3]]);
  const a = R.pick([1, -1]) * a0, b = R.pick([1, -1]) * b0;
  const u = [a, b, 0], v = [-b, a, 0], A = [R.int(-3, 3), R.int(-3, 3), 0];
  const B = V.add(A, u), C = V.add(B, v), D = V.add(A, v), M = V.add(A, V.mul(0.5, V.add(u, v))), h = R.int(3, 9), S = V.add(M, [0, 0, h]);
  const G = V.len2(u), Vol = G * h / 3;
  return {
    q: `Die quadratische Grundfläche ABCD einer Pyramide liegt in der x₁x₂-Ebene: ${pt('A', A)}, ${pt('B', B)}, ${pt('C', C)}, ${pt('D', D)}. Die Spitze ist ${pt('S', S)}.<br>Berechne das Volumen der Pyramide.<br><small>Ggf. auf 2 Nachkommastellen runden oder als Bruch eingeben.</small>`,
    type: 'num', answer: Vol, tol: 0.011, unit: 'VE',
    hints: [
      `Pyramidenvolumen: V = ⅓ · G · h. G = Fläche des Quadrats = |${ov('AB')}|². Weil die Grundfläche in der x₁x₂-Ebene liegt, ist die Höhe h einfach die x₃-Koordinate der Spitze.`,
      `${ov('AB')} = ${vec(u)} → G = ${G}. Die Höhe ist h = ${h}.`,
    ],
    steps: [
      `Grundfläche: ${ov('AB')} = ${vec(u)}, |${ov('AB')}|² = ${p(a)}² + ${p(b)}² + 0² = ${G} → G = ${G} FE`,
      `Höhe: Die Grundfläche liegt in der x₁x₂-Ebene (x₃ = 0), die Spitze hat x₃ = ${h}. Also h = ${h}. <small>(S liegt genau über dem Mittelpunkt M(${M.map(x => n(x)).join(' | ')}) der Diagonale AC.)</small>`,
      `V = ⅓ · ${G} · ${h} = ${frac(G * h, 3)}${Number.isInteger(Vol) ? '' : ' ≈ ' + n(Vol)}`,
      res(`V = ${frac(G * h, 3)}${Number.isInteger(Vol) ? '' : ' ≈ ' + n(Vol)} VE`),
    ],
  };
} });

def({ id: 'fig_kante', ch: 'fig', name: 'Seitenkante einer Pyramide', lvl: 1, gen() {
  const A = [R.int(-4, 4), R.int(-4, 4), 0], v = R.chance(0.5) ? niceNormal().n.map((x, i) => i === 2 ? Math.abs(x) : x) : [R.int(-4, 4), R.int(-4, 4), R.int(2, 8)];
  const S = V.add(A, v), s = V.len2(v), L = Math.sqrt(s), exact = Number.isInteger(L);
  return {
    q: `Eine Pyramide hat die Ecke ${pt('A', A)} und die Spitze ${pt('S', S)}.<br>Wie lang ist die Seitenkante AS?${exact ? '' : '<br><small>Runde auf 2 Nachkommastellen oder gib die Wurzel ein.</small>'}`,
    type: 'num', answer: L, tol: exact ? 1e-6 : 0.011, unit: 'LE',
    hints: [
      `Kantenlänge = Länge des Verbindungsvektors ${ov('AS')} = S − A.`,
      `${ov('AS')} = ${vec(v)}. Jetzt √(…² + …² + …²).`,
    ],
    steps: [
      `${ov('AS')} = ${vec(S)} − ${vec(A)} = ${vec(v)}`,
      lenSteps(v, 'AS'),
      res(`|AS| = ${exact ? L : rootStr(s) + ' ≈ ' + n(L)} LE`),
    ],
  };
} });

def({ id: 'ebe_pprobe', ch: 'ebe', name: 'Punktprobe Ebene (Parameterform)', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), r0 = R.nz(-2, 2), s0 = R.nz(-2, 2), yes = R.chance(0.5);
  let P = V.add(V.add(A, V.mul(r0, u)), V.mul(s0, v));
  if (!yes) { const nn = V.cross(u, v); do { P = P.slice(); P[R.int(0, 2)] += R.nz(-2, 2); } while (V.dot(V.sub(P, A), nn) === 0); }
  const c = V.sub(P, A);
  let i, j; for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) if (u[a] * v[b] - u[b] * v[a] !== 0) { i = a; j = b; break; }
  const k = 3 - i - j, det = u[i] * v[j] - u[j] * v[i], rn = c[i] * v[j] - c[j] * v[i], sn = u[i] * c[j] - u[j] * c[i];
  const ok = u[k] * rn + v[k] * sn === c[k] * det;
  const eq2 = q => `${lin([u[q], v[q]], ['r', 's'])} = ${n(c[q])}`;
  return {
    q: `Liegt der Punkt ${pt('P', P)} in der Ebene<br>${planeParam('E', A, u, v)} ?`,
    type: 'choice', options: ['Ja', 'Nein'], answer: ok ? 0 : 1,
    hints: [
      `Setze P gleich der Ebenengleichung. Das ergibt drei Gleichungen mit zwei Unbekannten r und s. Löse zwei davon und prüfe mit der dritten.`,
      `Stützvektor nach rechts: Zeile ${i + 1}: ${eq2(i)}, Zeile ${j + 1}: ${eq2(j)}. Danach r und s in Zeile ${k + 1} einsetzen.`,
    ],
    steps: [
      `Ansatz: ${vec(P)} = ${vec(A)} + r·${vec(u)} + s·${vec(v)}`,
      `Stützvektor nach rechts (P − A = ${vec(c)}):<ul class="calc">${[0, 1, 2].map(q => `<li>${q + 1}. Zeile: ${eq2(q)}</li>`).join('')}</ul>`,
      `Zeilen ${i + 1} und ${j + 1} lösen (Additions- oder Einsetzverfahren): r = ${frac(rn, det)}, s = ${frac(sn, det)}`,
      `Probe in Zeile ${k + 1}: ${p(u[k])}·${frac(rn, det)} + ${p(v[k])}·${frac(sn, det)} = ${frac(u[k] * rn + v[k] * sn, det)} ${ok ? '=' : '≠'} ${n(c[k])} → ${ok ? 'passt ✓' : 'Widerspruch ✗'}`,
      res(ok ? `Ja, P liegt in E (r = ${frac(rn, det)}, s = ${frac(sn, det)}).` : 'Nein, P liegt nicht in E.'),
    ],
  };
} });

def({ id: 'ebe_3p', ch: 'ebe', name: 'Ebene durch drei Punkte (Parameterform)', lvl: 1, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), B = V.add(A, u), C = V.add(A, v);
  return {
    q: `Die Ebene E geht durch ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}. Mit Stützpunkt A und erstem Spannvektor ${ov('AB')} lautet sie E: ${ov('x')} = ${vec(A)} + r·${vec(u)} + s·${ov('v')}.<br>Gib den zweiten Spannvektor ${ov('v')} = ${ov('AC')} an.`,
    type: 'vec', answer: v,
    hints: [
      `Eine Ebene durch drei Punkte: Stützvektor = ein Punkt (A), Spannvektoren = die Verbindungsvektoren von A zu den anderen beiden Punkten.`,
      `${ov('AC')} = C − A = ${vec(C)} − ${vec(A)}.`,
    ],
    steps: [
      `Rezept: E: ${ov('x')} = A + r·${ov('AB')} + s·${ov('AC')}`,
      `${ov('AC')} = ${vec(C)} − ${vec(A)} = ${vec(v)}`,
      `Damit: ${planeParam('E', A, u, v)}`,
      res(`${ov('v')} = ${vec(v)}`),
    ],
  };
} });

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

def({ id: 'ebe_punktprobe', ch: 'ebe', name: 'Punktprobe Ebene (Koordinatenform)', lvl: 1, gen() {
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

def({ id: 'lag_ge_schnitt', ch: 'lag', name: 'Durchstoßpunkt Gerade – Ebene', lvl: 2, gen() {
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

// =====================================================================
// Berliner Grundkurs: Ebenen, Lagebeziehungen, Winkel, Abstände (über Lotfußpunkte)
// =====================================================================
const NV = ['n₁', 'n₂', 'n₃'];
// Normalenvektor über ein LGS bestimmen (n·u = 0 und n·v = 0) – ohne Kreuzprodukt
function normalLGS(u, v, nu = 'u', nvn = 'v') {
  const pi = [0, 1, 2].find(i => u[i] !== 0), [q, r] = [0, 1, 2].filter(i => i !== pi);
  const A = v[q] * u[pi] - u[q] * v[pi], B = v[r] * u[pi] - u[r] * v[pi];
  let nq, nr;
  if (A === 0) { nq = 1; nr = 0; } else if (B === 0) { nq = 0; nr = 1; } else { nq = B; nr = -A; }
  const raw = []; raw[q] = nq * u[pi]; raw[r] = nr * u[pi]; raw[pi] = -(u[q] * nq + u[r] * nr);
  const nRed = reduceVec(raw);
  const e2 = [0, 0, 0]; e2[q] = A; e2[r] = B;
  const steps = [
    `Der Normalenvektor ${ov('n')} steht senkrecht auf ${ov(nu)} und ${ov(nvn)}, also ${ov('n')}·${ov(nu)} = 0 und ${ov('n')}·${ov(nvn)} = 0:<div class="lgs"><div>I: ${lin(u, NV)} = 0</div><div>II: ${lin(v, NV)} = 0</div></div>`,
    `${NV[pi]} eliminieren: ${p(u[pi])}·II − ${p(v[pi])}·I ergibt ${lin(e2, NV)} = 0`,
    `Zwei Gleichungen, drei Unbekannte → eine Unbekannte frei wählen. Wähle ${NV[q]} = ${n(raw[q])}, dann folgt ${NV[r]} = ${n(raw[r])} <small>(Probe: ${p(A)}·${p(raw[q])} + ${p(B)}·${p(raw[r])} = 0 ✓)</small>`,
    `In I einsetzen und nach ${NV[pi]} auflösen: ${NV[pi]} = ${n(raw[pi])}`,
    `${ov('n')} = ${vec(raw)}${gcdAll(raw) > 1 || raw.find(x => x !== 0) < 0 ? ` → gekürzt: ${vec(nRed)}` : ''}`,
  ];
  return { n: nRed, raw, steps };
}
const NORMAL_HINT = `Ansatz: ${ov('n')} = ${vec(NV)} mit ${ov('n')}·${ov('u')} = 0 und ${ov('n')}·${ov('v')} = 0. Das gibt ein LGS mit 2 Gleichungen und 3 Unbekannten – eine Unbekannte darfst du frei wählen. <small>(Wer das Kreuzprodukt kennt, kann es als Abkürzung nutzen.)</small>`;

def({ id: 'ebe_normal', ch: 'ebe', name: 'Normalenvektor bestimmen', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), N = normalLGS(u, v);
  return {
    q: `Bestimme einen Normalenvektor der Ebene<br>${planeParam('E', A, u, v)}<br><small>Jedes Vielfache wird akzeptiert.</small>`,
    type: 'vecpar', answer: N.n,
    hints: [NORMAL_HINT, `Die Gleichungen lauten I: ${lin(u, NV)} = 0 und II: ${lin(v, NV)} = 0. Eliminiere eine Unbekannte und wähle dann eine frei.`],
    steps: [...N.steps, res(`${ov('n')} = ${vec(N.n)}`)],
  };
} });

def({ id: 'ebe_param2koord', ch: 'ebe', name: 'Parameterform → Koordinatenform', lvl: 2, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), N = normalLGS(u, v), d = V.dot(N.n, A);
  return {
    q: `Wandle die Ebene in Koordinatenform um:<br>${planeParam('E', A, u, v)}`,
    type: 'plane', answer: [...N.n, d],
    hints: [`Zwei Schritte: (1) Normalenvektor ${ov('n')}, der auf beiden Spannvektoren senkrecht steht. (2) Ansatz n₁x₁ + n₂x₂ + n₃x₃ = d, Stützpunkt einsetzen ergibt d.`,
      `Ein Normalenvektor ist ${vec(N.n)}. Jetzt d = ${ov('n')}·${vec(A)} berechnen.`],
    steps: [`<b>Normalenvektor:</b>`, ...N.steps, `<b>Ansatz:</b> ${lin(N.n)} = d`,
      `<b>Stützpunkt einsetzen:</b> d = ${N.n.map((k, i) => `${p(k)}·${p(A[i])}`).join(' + ')} = ${n(d)}`, res(plane('E', N.n, d))],
  };
} });

def({ id: 'ebe_3p_koord', ch: 'ebe', name: 'Ebene durch drei Punkte (Koordinatenform)', lvl: 3, gen() {
  const A = rv(-4, 4), u = rvnz(-3, 3), v = rvNotPar(u, -3, 3), B = V.add(A, u), C = V.add(A, v), N = normalLGS(u, v, 'AB', 'AC'), d = V.dot(N.n, A);
  return {
    q: `Bestimme eine Koordinatengleichung der Ebene durch ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.`,
    type: 'plane', answer: [...N.n, d],
    hints: [`Spannvektoren ${ov('AB')} und ${ov('AC')} berechnen, dann einen Normalenvektor, der auf beiden senkrecht steht. Zum Schluss A einsetzen, um d zu bekommen.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}. Ein Normalenvektor ist ${vec(N.n)}.`],
    steps: [`<b>Spannvektoren:</b> ${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}`, ...N.steps,
      `<b>A einsetzen:</b> d = ${N.n.map((k, i) => `${p(k)}·${p(A[i])}`).join(' + ')} = ${n(d)}`,
      `<small>Probe: B und C ergeben ebenfalls ${n(V.dot(N.n, B))} und ${n(V.dot(N.n, C))} ✓</small>`, res(plane('E', N.n, d))],
  };
} });

def({ id: 'lag_schnittgerade', ch: 'lag', name: 'Schnittgerade zweier Ebenen', lvl: 3, gen() {
  let n1, n2; do { n1 = rvnz(-3, 3); n2 = rvnz(-3, 3); } while (V.par(n1, n2));
  const S = rv(-3, 3), d1 = V.dot(n1, S), d2 = V.dot(n2, S), N = normalLGS(n1, n2, 'n₁', 'n₂');
  let k = 0; for (const c of [2, 1, 0]) { const [a, b] = [0, 1, 2].filter(i => i !== c); if (n1[a] * n2[b] - n1[b] * n2[a] !== 0) { k = c; break; } }
  const [a, b] = [0, 1, 2].filter(i => i !== k);
  return {
    q: `Die Ebenen schneiden sich in einer Geraden g.<br>${plane('E₁', n1, d1)}<br>${plane('E₂', n2, d2)}<br>Gib einen Richtungsvektor von g an.<br><small>Jedes Vielfache wird akzeptiert.</small>`,
    type: 'vecpar', answer: N.n,
    hints: [`Die Schnittgerade liegt in beiden Ebenen, ihr Richtungsvektor ${ov('u')} steht also senkrecht auf <b>beiden</b> Normalenvektoren: ${ov('u')}·${ov('n₁')} = 0 und ${ov('u')}·${ov('n₂')} = 0.`,
      `${ov('n₁')} = ${vec(n1)}, ${ov('n₂')} = ${vec(n2)}. Löse das LGS wie bei einem Normalenvektor (eine Unbekannte frei wählen).`],
    steps: [`Richtungsvektor ${ov('u')} senkrecht zu ${ov('n₁')} = ${vec(n1)} und ${ov('n₂')} = ${vec(n2)} (gleiche Rechnung wie beim Normalenvektor):`,
      ...N.steps.map(s => s.replace(/Normalenvektor/g, 'gesuchte Vektor')),
      `<b>Stützpunkt</b> (für die vollständige Gleichung): Setze ${X[k]} = ${n(S[k])} und löse das 2×2-LGS aus beiden Ebenengleichungen → ${X[a]} = ${n(S[a])}, ${X[b]} = ${n(S[b])}. Also ${pt('S', S)}.`,
      `Schnittgerade: ${lineEq('g', S, N.n)}`,
      `<small>Alternative: Das LGS aus beiden Ebenengleichungen direkt lösen und dabei eine Variable als Parameter t setzen.</small>`,
      res(`Richtungsvektor z. B. ${vec(N.n)}`)],
  };
} });

// ---------- Abstände über Lotfußpunkte (Berlin: keine HNF nötig) ----------
function lotSteps(P, nv, d, name = 'P') {
  const L = lineInPlane(nv, P, nv, d), t = (d - L.nA) / L.nu, F = V.add(P, V.mul(t, nv));
  return {
    t, F, steps: [
      `<b>Lotgerade</b> durch ${name} senkrecht zur Ebene (Richtung = Normalenvektor): ${lineEq('l', P, nv)}`,
      ...L.steps,
      `⇒ ${ct(L.nu)}t = ${n(d - L.nA)} ⇒ t = ${frac(d - L.nA, L.nu)}`,
      `<b>Lotfußpunkt:</b> F = ${vec(P)} + ${Number.isInteger(t) ? p(t) : '(' + frac(d - L.nA, L.nu) + ')'}·${vec(nv)} = ${vec(F)}`,
    ],
  };
}

def({ id: 'abs_pe', ch: 'abs', name: 'Abstand Punkt – Ebene (Lotfußpunkt)', lvl: 2, gen() {
  const { nv, len, d, k, P } = pointPlaneSetup();
  const Lt = lotSteps(P, nv, d), PF = V.sub(Lt.F, P);
  return {
    q: `Berechne den Abstand des Punktes ${pt('P', P)} von der Ebene ${plane('E', nv, d)}.`,
    type: 'num', answer: Math.abs(k) * len, unit: 'LE',
    hints: [`Abstand über den <b>Lotfußpunkt</b>: (1) Lotgerade durch P in Richtung des Normalenvektors, (2) mit E schneiden → Lotfußpunkt F, (3) Abstand = |${ov('PF')}|.`,
      `Lotgerade ${lineEq('l', P, nv)}. In E eingesetzt ergibt sich t = ${n(-k)}.`],
    steps: [...Lt.steps, `${ov('PF')} = F − P = ${vec(PF)}`, lenSteps(PF, 'PF'), res(`d(P, E) = ${Math.abs(k) * len} LE`)],
  };
} });

def({ id: 'abs_ee', ch: 'abs', name: 'Abstand paralleler Ebenen', lvl: 2, gen() {
  const { n: nv, len } = niceNormal();
  const P = rv(-3, 3), d1 = V.dot(nv, P), m = R.nz(-2, 2), d2 = d1 + m * V.len2(nv);
  const scaled = R.chance(0.4), s = scaled ? R.pick([2, -2, 3]) : 1;
  const Lt = lotSteps(P, nv, d2), PF = V.sub(Lt.F, P);
  return {
    q: `Die Ebenen sind parallel. Berechne ihren Abstand.<br>${plane('E₁', nv, d1)}<br>${plane('E₂', V.mul(s, nv), s * d2)}`,
    type: 'num', answer: Math.abs(m) * len, unit: 'LE',
    hints: [`Nimm einen beliebigen Punkt P aus E₁ und berechne seinen Abstand zu E₂ über den Lotfußpunkt.${scaled ? ` Tipp: E₂ vorher durch ${n(s)} teilen.` : ''}`,
      `Ein Punkt von E₁ ist z. B. ${pt('P', P)} (einsetzen: ${n(d1)} ✓). Lotgerade: ${lineEq('l', P, nv)}.`],
    steps: [scaled ? `E₂ durch ${n(s)} teilen: ${plane('E₂', nv, d2)}` : `Beide Ebenen haben den Normalenvektor ${vec(nv)} → parallel.`,
      `Punkt aus E₁ wählen (zwei Koordinaten frei wählen, die dritte ausrechnen), z. B. ${pt('P', P)}.`,
      ...Lt.steps, `${ov('PF')} = ${vec(PF)}`, lenSteps(PF, 'PF'), res(`d = ${Math.abs(m) * len} LE`)],
  };
} });

def({ id: 'abs_ge', ch: 'abs', name: 'Abstand Gerade – parallele Ebene', lvl: 3, gen() {
  const { n: nv, len } = niceNormal();
  const F0 = rv(-3, 3), d = V.dot(nv, F0), m = R.nz(-2, 2), A = V.add(F0, V.mul(m, nv));
  let u; do { u = reduceVec(V.cross(nv, rvNotPar(nv, -2, 2))); } while (V.zero(u) || Math.max(...u.map(Math.abs)) > 12);
  const Lt = lotSteps(A, nv, d, 'A'), AF = V.sub(Lt.F, A);
  return {
    q: `Die Gerade ${lineEq('g', A, u)} verläuft parallel zur Ebene ${plane('E', nv, d)}.<br>Berechne den Abstand von g zu E.`,
    type: 'num', answer: Math.abs(m) * len, unit: 'LE',
    hints: [`Weil g parallel zu E ist, haben alle Punkte von g denselben Abstand zu E. Nimm einfach den Stützpunkt A und bestimme seinen Abstand über den Lotfußpunkt.`,
      `Lotgerade durch ${pt('A', A)}: ${lineEq('l', A, nv)}.`],
    steps: [`Kontrolle parallel: ${dotSteps(nv, u, 'n', 'u')} → ${ov('u')} ⊥ ${ov('n')}, also g parallel zu E ✓`,
      ...Lt.steps, `${ov('AF')} = ${vec(AF)}`, lenSteps(AF, 'AF'), res(`d(g, E) = ${Math.abs(m) * len} LE`)],
  };
} });

// ---------- Vektoren: Einheitsvektor, Teilverhältnis, Linearkombination ----------
def({ id: 'vek_einheit', ch: 'vek', name: 'Einheitsvektor', lvl: 2, gen() {
  const { n: v, len } = niceNormal(); const e = v.map(x => x / len);
  return {
    q: `Bestimme den Einheitsvektor (Länge 1) in Richtung von ${ov('v')} = ${vec(v)}.<br><small>Brüche wie 2/3 sind erlaubt.</small>`,
    type: 'vec', answer: e, tol: 0.006,
    hints: [`Einheitsvektor = Vektor geteilt durch seine Länge: ${ov('v')}₀ = ${fracOver('1', `|${ov('v')}|`)} · ${ov('v')}.`,
      `|${ov('v')}| = ${sq(V.len2(v))} = ${len}. Teile jede Zeile durch ${len}.`],
    steps: [lenSteps(v), `${ov('v')}₀ = ${fracOver('1', len)} · ${vec(v)} = ${vec(v.map(x => frac(x, len)))}`,
      `<small>Probe: Die Länge des Ergebnisses ist 1.</small>`, res(`${ov('v')}₀ = ${vec(v.map(x => frac(x, len)))}`)],
  };
} });

def({ id: 'vek_teil', ch: 'vek', name: 'Teilverhältnis einer Strecke', lvl: 2, gen() {
  const A = rv(-5, 5), w = rvnz(-2, 2), [m, k] = R.pick([[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [1, 1]]);
  const B = V.add(A, V.mul(m + k, w)), T = V.add(A, V.mul(m, w)), AB = V.sub(B, A);
  return {
    q: `Der Punkt T teilt die Strecke von ${pt('A', A)} nach ${pt('B', B)} im Verhältnis ${m} : ${k}.<br>Berechne T.`,
    type: 'vec', answer: T,
    hints: [`Verhältnis ${m} : ${k} heißt: Die Strecke wird in ${m + k} gleiche Teile geteilt, T liegt ${m} Teile von A entfernt. Also T = A + ${frac(m, m + k)}·${ov('AB')}.`,
      `${ov('AB')} = ${vec(AB)}. ${frac(m, m + k)}·${ov('AB')} = ${vec(V.mul(m, w))}.`],
    steps: [`${ov('AB')} = B − A = ${vec(AB)}`, `Anteil von A aus: ${m} von ${m + k} Teilen = ${frac(m, m + k)}`,
      `T = A + ${frac(m, m + k)}·${ov('AB')} = ${vec(A)} + ${vec(V.mul(m, w))} = ${vec(T)}`, res(pt('T', T))],
  };
} });

def({ id: 'vek_lk', ch: 'vek', name: 'Vektor als Linearkombination', lvl: 3, gen() {
  const a = rvnz(-3, 3), b = rvNotPar(a, -3, 3), r0 = R.nz(-3, 3), s0 = R.nz(-3, 3), c = V.add(V.mul(r0, a), V.mul(s0, b));
  let i, j; for (const [x, y] of [[0, 1], [0, 2], [1, 2]]) if (a[x] * b[y] - a[y] * b[x] !== 0) { i = x; j = y; break; }
  const k = 3 - i - j, eq = q => `${lin([a[q], b[q]], ['r', 's'])} = ${n(c[q])}`;
  return {
    q: `Stelle ${ov('c')} = ${vec(c)} als Linearkombination von ${ov('a')} = ${vec(a)} und ${ov('b')} = ${vec(b)} dar, d. h. bestimme r und s mit ${ov('c')} = r·${ov('a')} + s·${ov('b')}.`,
    type: 'vec', answer: [r0, s0], labels: ['r =', 's ='],
    hints: [`Schreibe ${ov('c')} = r·${ov('a')} + s·${ov('b')} zeilenweise auf. Das sind 3 Gleichungen mit 2 Unbekannten: zwei lösen, mit der dritten prüfen.`,
      `Zeile ${i + 1}: ${eq(i)}, Zeile ${j + 1}: ${eq(j)}.`],
    steps: [`Ansatz: ${vec(c)} = r·${vec(a)} + s·${vec(b)}<ul class="calc">${[0, 1, 2].map(q => `<li>${q + 1}. Zeile: ${eq(q)}</li>`).join('')}</ul>`,
      `Zeilen ${i + 1} und ${j + 1} lösen (Additions- oder Einsetzverfahren): r = ${n(r0)}, s = ${n(s0)}`,
      `Probe in Zeile ${k + 1}: ${p(a[k])}·${p(r0)} + ${p(b[k])}·${p(s0)} = ${n(c[k])} ✓`, res(`${ov('c')} = ${n(r0)}·${ov('a')} ${s0 < 0 ? '−' : '+'} ${Math.abs(s0)}·${ov('b')}`)],
  };
} });

def({ id: 'fig_dreiecksflaeche', ch: 'fig', name: 'Flächeninhalt eines Dreiecks', lvl: 3, gen() {
  const A = rv(-4, 4), u = rvnz(-4, 4), v = rvNotPar(u, -4, 4), B = V.add(A, u), C = V.add(A, v);
  const d = V.dot(u, v), lu = V.len2(u), lv = V.len2(v), cs = d / Math.sqrt(lu * lv), al = Math.acos(cs), F = 0.5 * Math.sqrt(lu * lv - d * d);
  return {
    q: `Berechne den Flächeninhalt des Dreiecks mit ${pt('A', A)}, ${pt('B', B)} und ${pt('C', C)}.<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: F, tol: 0.02, unit: 'FE',
    hints: [`Flächenformel mit Winkel: A = ½ · |${ov('AB')}| · |${ov('AC')}| · sin α, wobei α der Winkel bei A ist. α bekommst du über das Skalarprodukt.`,
      `${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}, Skalarprodukt ${n(d)}, Längen ${sq(lu)} und ${sq(lv)} → α ≈ ${n(deg(al), 1)}°.`],
    steps: [`${ov('AB')} = ${vec(u)}, ${ov('AC')} = ${vec(v)}`, dotSteps(u, v, 'AB', 'AC'),
      `cos α = ${n(d)} / (${sq(lu)}·${sq(lv)}) ≈ ${n(cs, 4)} ⇒ α ≈ ${n(deg(al), 2)}°`,
      `A = ½ · ${sq(lu)} · ${sq(lv)} · sin(${n(deg(al), 2)}°) ≈ ½ · ${n(Math.sqrt(lu), 3)} · ${n(Math.sqrt(lv), 3)} · ${n(Math.sin(al), 4)} ≈ ${n(F)}`,
      `<small>Mit ungerundeten Werten weiterrechnen!</small>`, res(`A ≈ ${n(F)} FE`)],
  };
} });

// =====================================================================
// Abi-Training Berlin: Prüfungsteil A (hilfsmittelfrei) und Teil B (komplexe Aufgaben)
// =====================================================================
// Teil A: kurze Aufgaben mit glatten Zahlen, ohne Taschenrechner lösbar
const HMF = ['vek_ab', 'vek_mitte', 'vek_linkomb', 'vek_parallelogramm', 'vek_kollinear', 'vek_teil', 'skp_dot', 'skp_orth', 'skp_fehlend',
  'ger_punktprobe', 'ger_spur', 'ger_lage', 'ebe_np', 'ebe_punktprobe', 'ebe_spur', 'ebe_pprobe', 'lag_ge_lage', 'lag_ee_lage', 'lgs_art', 'abs_pe'];
function teilA() {
  const ids = R.shuffle(HMF.filter(id => TYPES.some(t => t.id === id))).slice(0, 5);
  const parts = ids.map((id, i) => { const t = generate(id); t.be = { 1: 3, 2: 5, 3: 5 }[t.lvl]; t.label = `Aufgabe ${i + 1}`; return t; });
  return { id: 'teilA', title: 'Prüfungsteil A – ohne Hilfsmittel', intro: 'Ohne Taschenrechner und ohne Formelsammlung. Im Abitur hast du für den gesamten Teil A (alle drei Sachgebiete) bis zu 100 Minuten.', parts };
}

function part(o) { return Object.assign({ lvl: 3, hints: [], steps: [] }, o); }
const L = s => `<b>${s})</b> `;

const EXAMS = [];
// ---------- Glaspyramide ----------
EXAMS.push({ id: 'pyramide', title: 'Glaspyramide', gen() {
  const a = R.pick([4, 8]), h = R.pick([2, 4, 6]);
  const Ap = [0, 0, 0], B = [a, 0, 0], C = [a, a, 0], D = [0, a, 0], S = [a / 2, a / 2, h];
  const BC = V.sub(C, B), BS = V.sub(S, B), N = normalLGS(BC, BS, 'BC', 'BS'), nn = N.n, d = V.dot(nn, B);
  const AS = V.sub(S, Ap), kante = V.len(AS), vol = a * a * h / 3;
  const cosA = Math.abs(nn[2]) / V.len(nn), ang = deg(Math.acos(cosA));
  const Q = [3 * a / 4, a / 2, h / 2];
  let w; do { w = [-R.int(1, 3), R.int(-1, 1), -1]; } while (V.dot(nn, w) === 0);
  const t0 = R.pick([2, 3, 4]), Lp = V.sub(Q, V.mul(t0, w)), Lg = lineInPlane(nn, Lp, w, d);
  const M = [a / 2, a / 2, 0], Lt = lotSteps(M, nn, d, 'M'), MF = V.sub(Lt.F, M), dist = V.len(MF);
  const ctx = `Ein Museum plant eine Glaspyramide mit quadratischer Grundfläche ABCD und Spitze S. Im Koordinatensystem (1 LE = 1 m) gilt:<br>${pt('A', Ap)}, ${pt('B', B)}, ${pt('C', C)}, ${pt('D', D)}, ${pt('S', S)}.<br>Die Grundfläche liegt in der x₁x₂-Ebene (Boden).`;
  return { id: 'pyramide', title: 'Glaspyramide', intro: ctx, parts: [
    part({ label: 'a', be: 2, q: `${L('a')}Berechne die Länge der Kante AS.<br><small>Auf 2 Nachkommastellen runden.</small>`, type: 'num', answer: kante, tol: 0.011, unit: 'm',
      hints: [`Kantenlänge = Länge des Vektors ${ov('AS')} = S − A.`, `${ov('AS')} = ${vec(AS)}.`],
      steps: [`${ov('AS')} = ${vec(AS)}`, lenSteps(AS, 'AS'), res(`|AS| ≈ ${n(kante)} m`)] }),
    part({ label: 'b', be: 2, q: `${L('b')}Berechne das Volumen der Pyramide.`, type: 'num', answer: vol, tol: 0.011, unit: 'm³',
      hints: [`V = ⅓ · G · h. G ist die quadratische Grundfläche, h die Höhe der Spitze über dem Boden.`, `G = ${a}² = ${a * a}, h = ${h} (x₃-Koordinate von S).`],
      steps: [`Grundfläche: Quadrat mit Seitenlänge |${ov('AB')}| = ${a} → G = ${a * a} m²`, `Höhe: Die Grundfläche liegt in x₃ = 0, also h = ${h} m`, `V = ⅓ · ${a * a} · ${h} = ${frac(a * a * h, 3)}${Number.isInteger(vol) ? '' : ' ≈ ' + n(vol)}`, res(`V ${Number.isInteger(vol) ? '=' : '≈'} ${n(vol)} m³`)] }),
    part({ label: 'c', be: 4, q: `${L('c')}Die Seitenfläche BCS liegt in der Ebene E. Bestimme eine Koordinatengleichung von E.`, type: 'plane', answer: [...nn, d],
      hints: [`Spannvektoren ${ov('BC')} und ${ov('BS')}, dann einen Normalenvektor über ${ov('n')}·${ov('BC')} = 0 und ${ov('n')}·${ov('BS')} = 0.`, `${ov('BC')} = ${vec(BC)}, ${ov('BS')} = ${vec(BS)}. Ein Normalenvektor ist ${vec(nn)}.`],
      steps: [`Spannvektoren: ${ov('BC')} = ${vec(BC)}, ${ov('BS')} = ${vec(BS)}`, ...N.steps, `B einsetzen: d = ${nn.map((k, i) => `${p(k)}·${p(B[i])}`).join(' + ')} = ${n(d)}`, res(plane('E', nn, d))] }),
    part({ label: 'd', be: 3, q: `${L('d')}Berechne den Neigungswinkel der Seitenfläche BCS gegenüber dem Boden.<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: [`Winkel zwischen zwei Ebenen = Winkel zwischen ihren Normalenvektoren. Der Boden (x₁x₂-Ebene) hat den Normalenvektor ${vec([0, 0, 1])}.`, `cos α = |${ov('n')}·${vec([0, 0, 1])}| / (|${ov('n')}| · 1) mit ${ov('n')} = ${vec(nn)}.`],
      steps: [`${ov('n_E')} = ${vec(nn)}, ${ov('n_Boden')} = ${vec([0, 0, 1])}`, `cos α = |${n(nn[2])}| / ${sq(V.len2(nn))} ≈ ${n(cosA, 4)}`, `α = cos⁻¹(${n(cosA, 4)}) ≈ ${n(ang, 1)}°`, res(`α ≈ ${n(ang, 1)}°`)] }),
    part({ label: 'e', be: 5, q: `${L('e')}Ein Laserstrahl verläuft entlang der Geraden ${lineEq('g', Lp, w)}.<br>Berechne den Punkt, in dem er auf die Ebene E der Seitenfläche BCS trifft.`, type: 'vec', answer: Q,
      hints: [`Durchstoßpunkt: Setze die Zeilen der Geraden in die Koordinatengleichung von E ein und löse nach t.`, `Einsetzen ergibt ${n(Lg.nA)} ${Lg.nu < 0 ? '−' : '+'} ${co(Lg.nu)}t = ${n(d)}.`],
      steps: [...Lg.steps, `⇒ t = ${n(t0)}`, `In g einsetzen: ${vec(Lp)} + ${p(t0)}·${vec(w)} = ${vec(Q)}`, res(pt('P', Q))] }),
    part({ label: 'f', be: 4, q: `${L('f')}M ist der Mittelpunkt der Grundfläche. Berechne den Abstand von M zur Ebene E.<br><small>Über den Lotfußpunkt; auf 2 Nachkommastellen runden.</small>`, type: 'num', answer: dist, tol: 0.011, unit: 'm',
      hints: [`Erst M bestimmen (Mittelpunkt der Diagonale AC). Dann Lotgerade durch M mit Richtung ${ov('n')}, mit E schneiden, Abstand |${ov('MF')}|.`, `${pt('M', M)}. Lotgerade ${lineEq('l', M, nn)}.`],
      steps: [`M = ½·(A + C) = ${vec(M)}`, ...Lt.steps, `${ov('MF')} = ${vec(MF.map(x => Number.isInteger(x) ? x : Math.round(x * 1000) / 1000))}`, `|${ov('MF')}| ≈ ${n(dist)}`, res(`d(M, E) ≈ ${n(dist)} m`)] }),
  ] };
} });

// ---------- Flugbahnen ----------
EXAMS.push({ id: 'flug', title: 'Flugbahnen', gen() {
  const U = R.pick([[[4, 4, 2], 6], [[6, 3, 2], 7], [[3, 6, 2], 7], [[8, 4, 1], 9], [[4, 8, 1], 9]]);
  const u = U[0].map((x, i) => i < 2 && R.chance(0.5) ? -x : x), len = U[1];
  const A = [R.int(-30, 30), R.int(-30, 30), R.int(1, 2)];
  const kind = R.chance(0.5) ? 2 : 3;
  let w, B, s0, t0;
  if (kind === 2) {
    s0 = R.int(1, 3); t0 = s0 + R.int(1, 2);
    do { w = [R.nz(-6, 6), R.nz(-6, 6), R.int(-1, 1)]; } while (V.par(u, w));
    const S = V.add(A, V.mul(s0, u)); B = V.sub(S, V.mul(t0, w));
  } else {
    do { w = [R.nz(-6, 6), R.nz(-6, 6), R.int(-1, 1)]; } while (V.par(u, w));
    do { B = [R.int(-30, 30), R.int(-30, 30), R.int(5, 9)]; } while (V.dot(V.sub(B, A), V.cross(u, w)) === 0);
  }
  const P2 = V.add(A, V.mul(2, u)), sinA = u[2] / len, ang = deg(Math.asin(sinA));
  const sol = lineLineSteps(A, u, B, w);
  const ctx = `Zwei Flugzeuge F₁ und F₂ bewegen sich geradlinig mit konstanter Geschwindigkeit. Ihre Positionen werden beschrieben durch<br>F₁: ${ov('x')} = ${vec(A)} + s·${vec(u)} und F₂: ${ov('x')} = ${vec(B)} + t·${vec(w)}<br>(s, t in Minuten seit Beobachtungsbeginn, 1 LE = 1 km; die x₁x₂-Ebene ist der Erdboden).`;
  const parts = [
    part({ label: 'a', be: 2, lvl: 1, q: `${L('a')}Berechne die Position von F₁ zwei Minuten nach Beobachtungsbeginn.`, type: 'vec', answer: P2,
      hints: [`Setze s = 2 in die Gleichung von F₁ ein.`, `2·${vec(u)} = ${vec(V.mul(2, u))}.`],
      steps: [`${vec(A)} + 2·${vec(u)} = ${vec(A)} + ${vec(V.mul(2, u))} = ${vec(P2)}`, res(pt('P', P2))] }),
    part({ label: 'b', be: 2, lvl: 2, q: `${L('b')}Berechne die Geschwindigkeit von F₁ in km/h.`, type: 'num', answer: len * 60, unit: 'km/h',
      hints: [`In einer Minute legt F₁ genau den Richtungsvektor zurück. Seine Länge ist die Geschwindigkeit in km pro Minute.`, `|${ov('u')}| = ${sq(V.len2(u))} = ${len} km/min. Jetzt mal 60.`],
      steps: [lenSteps(u, 'u'), `${len} km/min · 60 = ${len * 60} km/h`, res(`v = ${len * 60} km/h`)] }),
    part({ label: 'c', be: 3, q: `${L('c')}Berechne den Winkel, unter dem F₁ steigt (Winkel zwischen Flugbahn und Erdboden).<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: [`Winkel zwischen Gerade und Ebene: sin α = |${ov('n')}·${ov('u')}| / (|${ov('n')}|·|${ov('u')}|). Der Erdboden hat ${ov('n')} = ${vec([0, 0, 1])}.`, `sin α = ${u[2]} / ${len}.`],
      steps: [`${ov('n')}·${ov('u')} = ${u[2]}, |${ov('n')}| = 1, |${ov('u')}| = ${len}`, `sin α = ${frac(u[2], len)} ≈ ${n(sinA, 4)}`, `α = sin⁻¹(${n(sinA, 4)}) ≈ ${n(ang, 1)}°`, res(`α ≈ ${n(ang, 1)}°`)] }),
    part({ label: 'd', be: 5, q: `${L('d')}Untersuche die Lage der beiden Flugbahnen zueinander.`, type: 'choice', options: ['identisch', 'echt parallel', 'schneiden sich', 'windschief'], answer: kind,
      hints: [`Erst Richtungsvektoren vergleichen (Vielfache?), dann Bahnen gleichsetzen: ${vec(A)} + s·${vec(u)} = ${vec(B)} + t·${vec(w)}. Zwei Zeilen lösen, mit der dritten prüfen.`, `Die Richtungsvektoren sind keine Vielfachen. Löse das LGS aus zwei Zeilen nach s und t.`],
      steps: [...sol.steps, res(kind === 2 ? 'Die Flugbahnen schneiden sich.' : 'Die Flugbahnen sind windschief.')] }),
  ];
  if (kind === 2) {
    const S = V.add(A, V.mul(s0, u));
    parts.push(part({ label: 'e', be: 4, q: `${L('e')}Die Flugbahnen schneiden sich. Gib den Schnittpunkt an.`, type: 'vec', answer: S,
      hints: [`Du hast in d) die Parameter s und t bestimmt. Setze s in F₁ ein.`, `s = ${s0}.`],
      steps: [`Aus d): s = ${s0}, t = ${t0}`, `${vec(A)} + ${s0}·${vec(u)} = ${vec(S)}`, res(pt('S', S))] }));
    parts.push(part({ label: 'f', be: 4, q: `${L('f')}Besteht Kollisionsgefahr? Gib an, wie viele Minuten nach F₁ das Flugzeug F₂ den Schnittpunkt erreicht.`, type: 'num', answer: t0 - s0, unit: 'min',
      hints: [`Die Parameter s und t sind Zeiten. F₁ ist zum Zeitpunkt s im Schnittpunkt, F₂ zum Zeitpunkt t.`, `s = ${s0}, t = ${t0}.`],
      steps: [`F₁ erreicht S nach s = ${s0} min, F₂ nach t = ${t0} min.`, `Differenz: ${t0} − ${s0} = ${t0 - s0} min → die Flugzeuge sind nicht gleichzeitig dort, also keine Kollision (nur die Bahnen kreuzen sich).`, res(`${t0 - s0} Minuten später`)] }));
  } else {
    const k = R.int(2, 4), H = A[2] + k * u[2], P = V.add(A, V.mul(k, u));
    parts.push(part({ label: 'e', be: 4, q: `${L('e')}Eine Wolkendecke liegt in ${H} km Höhe (Ebene x₃ = ${H}). Nach wie vielen Minuten erreicht F₁ die Wolkendecke?`, type: 'num', answer: k, unit: 'min',
      hints: [`Die Höhe ist die x₃-Koordinate. Setze die 3. Zeile von F₁ gleich ${H}.`, `${A[2]} + ${co(u[2])}s = ${H}.`],
      steps: [`3. Zeile: ${A[2]} + ${ct(u[2])}s = ${H} ⇒ ${ct(u[2])}s = ${H - A[2]} ⇒ s = ${k}`, res(`nach ${k} Minuten`)] }));
    parts.push(part({ label: 'f', be: 4, lvl: 2, q: `${L('f')}In welchem Punkt durchstößt F₁ die Wolkendecke?`, type: 'vec', answer: P,
      hints: [`Setze das Ergebnis aus e) in die Gleichung von F₁ ein.`, `s = ${k}.`],
      steps: [`${vec(A)} + ${k}·${vec(u)} = ${vec(P)}`, res(pt('W', P))] }));
  }
  return { id: 'flug', title: 'Flugbahnen', intro: ctx, parts };
} });

// ---------- Würfel mit abgeschnittener Ecke ----------
EXAMS.push({ id: 'wuerfel', title: 'Würfel mit Schnittebene', gen() {
  const k = R.pick([3, 6]);
  const names = { '000': 'A', '100': 'B', '110': 'C', '010': 'D', '001': 'E', '101': 'F', '111': 'G', '011': 'H' };
  const bits = R.pick(Object.keys(names)), c = bits.split('').map(Number);
  const P = c.map(x => x * k), nbs = [0, 1, 2].map(i => { const b = c.slice(); b[i] = 1 - b[i]; return b; });
  const NB = nbs.map(b => b.map(x => x * k)), nbNames = nbs.map(b => names[b.join('')]), pn = names[bits];
  const u = V.sub(NB[1], NB[0]), v = V.sub(NB[2], NB[0]), N = normalLGS(u, v, nbNames[0] + nbNames[1], nbNames[0] + nbNames[2]), nn = N.n, d = V.dot(nn, NB[0]);
  const Lt = lotSteps(P, nn, d, pn), F = Lt.F, PF = V.sub(F, P), dist = V.len(PF), P2 = V.add(P, V.mul(2, PF));
  const ang = deg(Math.acos(1 / Math.sqrt(3)));
  const ctx = `Ein Würfel ABCDEFGH aus Holz hat die Ecken ${pt('A', [0, 0, 0])}, ${pt('B', [k, 0, 0])}, ${pt('C', [k, k, 0])}, ${pt('D', [0, k, 0])} und ${pt('E', [0, 0, k])}, ${pt('F', [k, 0, k])}, ${pt('G', [k, k, k])}, ${pt('H', [0, k, k])} (1 LE = 1 cm).<br>Die Ecke ${pn} wird abgesägt. Der Schnitt verläuft durch die Ecken ${nbNames.join(', ')} und liegt in der Ebene T.`;
  return { id: 'wuerfel', title: 'Würfel mit Schnittebene', intro: ctx, parts: [
    part({ label: 'a', be: 4, q: `${L('a')}Bestimme eine Koordinatengleichung der Ebene T.`, type: 'plane', answer: [...nn, d],
      hints: [`Ebene durch drei Punkte: zwei Spannvektoren, Normalenvektor über das Skalarprodukt, dann einen Punkt einsetzen.`, `Spannvektoren ${ov(nbNames[0] + nbNames[1])} = ${vec(u)} und ${ov(nbNames[0] + nbNames[2])} = ${vec(v)}. Normalenvektor z. B. ${vec(nn)}.`],
      steps: [`Spannvektoren: ${ov(nbNames[0] + nbNames[1])} = ${vec(u)}, ${ov(nbNames[0] + nbNames[2])} = ${vec(v)}`, ...N.steps, `${nbNames[0]} einsetzen: d = ${n(d)}`, res(plane('T', nn, d))] }),
    part({ label: 'b', be: 3, q: `${L('b')}Berechne den Winkel zwischen der Schnittebene T und der Grundfläche ABCD.<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: [`Winkel zwischen Ebenen = Winkel zwischen den Normalenvektoren (mit Betrag im Zähler). Die Grundfläche liegt in x₃ = 0, Normalenvektor ${vec([0, 0, 1])}.`, `cos α = |${n(nn[2])}| / (${sq(V.len2(nn))} · 1).`],
      steps: [`cos α = |${ov('n_T')}·${vec([0, 0, 1])}| / (|${ov('n_T')}| · 1) = 1 / ${sq(3)} ≈ ${n(1 / Math.sqrt(3), 4)}`, `α ≈ ${n(ang, 1)}°`, res(`α ≈ ${n(ang, 1)}°`)] }),
    part({ label: 'c', be: 4, q: `${L('c')}Bestimme den Lotfußpunkt L der Ecke ${pn} auf der Ebene T.`, type: 'vec', answer: F,
      hints: [`Lotgerade durch ${pn} mit Richtung des Normalenvektors aufstellen und mit T schneiden.`, `Lotgerade ${lineEq('l', P, nn)}. Einsetzen ergibt t = ${n(Lt.t)}.`],
      steps: [...Lt.steps, res(pt('L', F))] }),
    part({ label: 'd', be: 3, lvl: 2, q: `${L('d')}Berechne den Abstand der Ecke ${pn} von der Ebene T.<br><small>Auf 2 Nachkommastellen runden.</small>`, type: 'num', answer: dist, tol: 0.011, unit: 'cm',
      hints: [`Der Abstand ist die Länge von ${ov(pn + 'L')}.`, `${ov(pn + 'L')} = ${vec(PF)}.`],
      steps: [`${ov(pn + 'L')} = L − ${pn} = ${vec(PF)}`, lenSteps(PF, pn + 'L'), res(`d ≈ ${n(dist)} cm`)] }),
    part({ label: 'e', be: 3, q: `${L('e')}Die Ecke ${pn} wird an der Ebene T gespiegelt. Berechne den Spiegelpunkt ${pn}'.`, type: 'vec', answer: P2,
      hints: [`Spiegelpunkt = vom Punkt aus doppelt so weit wie bis zum Lotfußpunkt: ${pn}' = ${pn} + 2·${ov(pn + 'L')}.`, `${ov(pn + 'L')} = ${vec(PF)}.`],
      steps: [`${pn}' = ${pn} + 2·${ov(pn + 'L')} = ${vec(P)} + 2·${vec(PF)} = ${vec(P2)}`, res(`${pn}'(${P2.map(x => n(x)).join(' | ')})`)] }),
    part({ label: 'f', be: 3, lvl: 2, q: `${L('f')}Berechne das Volumen des abgesägten Stücks (Pyramide mit den Ecken ${pn}, ${nbNames.join(', ')}).`, type: 'num', answer: k ** 3 / 6, tol: 0.011, unit: 'cm³',
      hints: [`Die drei Kanten an der Ecke ${pn} stehen senkrecht aufeinander und sind alle ${k} cm lang. Nimm ein rechtwinkliges Dreieck als Grundfläche.`, `G = ½ · ${k} · ${k} = ${k * k / 2}, Höhe h = ${k}. V = ⅓·G·h.`],
      steps: [`Grundfläche: rechtwinkliges Dreieck mit Katheten ${k} und ${k} → G = ½·${k}·${k} = ${n(k * k / 2)} cm²`, `Höhe: die dritte Kante, h = ${k} cm`, `V = ⅓ · ${n(k * k / 2)} · ${k} = ${n(k ** 3 / 6)} cm³`, res(`V = ${n(k ** 3 / 6)} cm³`)] }),
  ] };
} });

// ---------- Haus mit Satteldach ----------
EXAMS.push({ id: 'haus', title: 'Haus mit Satteldach', gen() {
  const a = R.pick([6, 8, 10]), b = R.pick([8, 10, 12]), w = R.pick([3, 4]), r = R.pick([2, 3, 4]), h = w + r;
  const E = [0, 0, w], P = [a / 2, 0, h], H = [0, b, w], Q = [a / 2, b, h];
  const EP = V.sub(P, E), EH = V.sub(H, E), N = normalLGS(EP, EH, 'EP', 'EH'), nn = N.n, d = V.dot(nn, E);
  const sparren = V.len(EP), cosA = Math.abs(nn[2]) / V.len(nn), ang = deg(Math.acos(cosA));
  const K = [1, b / 2, h + 1], s = [R.int(1, 3), R.int(-2, 2), -1], tK = K[2], Sh = V.add(K, V.mul(tK, s));
  const sinS = 1 / V.len(s), angS = deg(Math.asin(sinS));
  const onRoof = R.chance(0.5), lam = R.int(1, b - 1);
  const Rp = onRoof ? V.add(P, [0, lam, 0]) : V.add(P, [0, lam, 1]);
  const ctx = `Ein Haus hat einen rechteckigen Grundriss und ein Satteldach. Im Koordinatensystem (1 LE = 1 m, x₁x₂-Ebene = Erdboden) haben die oberen Ecken der Wände die Koordinaten ${pt('E', E)}, ${pt('F', [a, 0, w])}, ${pt('G', [a, b, w])}, ${pt('H', H)}. Der Dachfirst verläuft von ${pt('P', P)} nach ${pt('Q', Q)}.<br>Die linke Dachfläche ist das Rechteck EPQH.`;
  return { id: 'haus', title: 'Haus mit Satteldach', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, q: `${L('a')}Berechne die Länge eines Dachsparrens von E nach P.<br><small>Auf 2 Nachkommastellen runden.</small>`, type: 'num', answer: sparren, tol: 0.011, unit: 'm',
      hints: [`Länge des Vektors ${ov('EP')}.`, `${ov('EP')} = ${vec(EP)}.`],
      steps: [`${ov('EP')} = ${vec(EP)}`, lenSteps(EP, 'EP'), res(`|EP| ≈ ${n(sparren)} m`)] }),
    part({ label: 'b', be: 5, q: `${L('b')}Bestimme eine Koordinatengleichung der Ebene D, in der die linke Dachfläche liegt.`, type: 'plane', answer: [...nn, d],
      hints: [`Spannvektoren ${ov('EP')} und ${ov('EH')}, Normalenvektor über das Skalarprodukt, dann E einsetzen.`, `${ov('EP')} = ${vec(EP)}, ${ov('EH')} = ${vec(EH)}. Normalenvektor z. B. ${vec(nn)}.`],
      steps: [`Spannvektoren: ${ov('EP')} = ${vec(EP)}, ${ov('EH')} = ${vec(EH)}`, ...N.steps, `E einsetzen: d = ${n(d)}`, res(plane('D', nn, d))] }),
    part({ label: 'c', be: 3, q: `${L('c')}Berechne den Neigungswinkel des Daches gegenüber der Horizontalen.<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: [`Winkel zwischen der Dachebene und der x₁x₂-Ebene: über die Normalenvektoren, ${ov('n')}_Boden = ${vec([0, 0, 1])}.`, `cos α = |${n(nn[2])}| / ${sq(V.len2(nn))}.`],
      steps: [`cos α = |${ov('n_D')}·${vec([0, 0, 1])}| / |${ov('n_D')}| = ${Math.abs(nn[2])} / ${sq(V.len2(nn))} ≈ ${n(cosA, 4)}`, `α ≈ ${n(ang, 1)}°`, `<small>Kontrolle ohne Vektoren: tan α = ${r} / ${a / 2} → α ≈ ${n(deg(Math.atan(r / (a / 2))), 1)}°</small>`, res(`α ≈ ${n(ang, 1)}°`)] }),
    part({ label: 'd', be: 2, lvl: 2, q: `${L('d')}Ein Vogel sitzt im Punkt ${pt('R', Rp)}. Sitzt er auf der Ebene D der linken Dachfläche?`, type: 'choice', options: ['Ja', 'Nein'], answer: onRoof ? 0 : 1,
      hints: [`Punktprobe: Koordinaten von R in die Gleichung von D einsetzen.`, `Linke Seite ausrechnen und mit ${n(d)} vergleichen.`],
      steps: [`${nn.map((c2, i) => c2 === 0 ? null : `${p(c2)}·${p(Rp[i])}`).filter(Boolean).join(' + ')} = ${n(V.dot(nn, Rp))} ${V.dot(nn, Rp) === d ? '=' : '≠'} ${n(d)}`, res(onRoof ? 'Ja, R liegt in D.' : 'Nein, R liegt nicht in D.')] }),
    part({ label: 'e', be: 4, q: `${L('e')}Die Spitze eines Schornsteins ist ${pt('K', K)}. Sonnenstrahlen haben die Richtung ${vec(s)}. Berechne den Schattenpunkt von K auf der Ebene x₃ = 0.`, type: 'vec', answer: Sh,
      hints: [`Gerade durch K in Richtung der Sonnenstrahlen aufstellen und mit dem Boden x₃ = 0 schneiden.`, `3. Zeile: ${K[2]} − t = 0 ⇒ t = ${tK}.`],
      steps: [`Strahl: ${lineEq('s', K, s)}`, `Boden: x₃ = 0 ⇒ ${K[2]} − t = 0 ⇒ t = ${tK}`, `${vec(K)} + ${tK}·${vec(s)} = ${vec(Sh)}`, res(pt('K\'', Sh))] }),
    part({ label: 'f', be: 4, q: `${L('f')}Unter welchem Winkel treffen die Sonnenstrahlen auf den Erdboden?<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: angS, tol: 0.11, unit: '°',
      hints: [`Winkel zwischen Gerade und Ebene: sin α = |${ov('n')}·${ov('s')}| / (|${ov('n')}|·|${ov('s')}|) mit ${ov('n')} = ${vec([0, 0, 1])}.`, `sin α = 1 / ${sq(V.len2(s))}.`],
      steps: [`${ov('n')}·${ov('s')} = −1, |${ov('s')}| = ${sq(V.len2(s))}`, `sin α = 1 / ${sq(V.len2(s))} ≈ ${n(sinS, 4)}`, `α ≈ ${n(angS, 1)}°`, res(`α ≈ ${n(angS, 1)}°`)] }),
  ] };
} });

function teilB(id) { const E0 = id ? EXAMS.find(e => e.id === id) : R.pick(EXAMS); return E0.gen(); }
const NOTEN = [[95, 15], [90, 14], [85, 13], [80, 12], [75, 11], [70, 10], [65, 9], [60, 8], [55, 7], [50, 6], [45, 5], [40, 4], [33, 3], [27, 2], [20, 1], [0, 0]];
const notenpunkte = pct => NOTEN.find(([g]) => pct >= g)[1];

// Echte Abituraufgaben (frei zugänglich, offizielle Quellen)
const LINKS = [
  { title: 'IQB: alle veröffentlichten Abituraufgaben Mathematik', sub: 'Gemeinsamer Aufgabenpool der Länder, aus dem auch Berlin Aufgaben nutzt. Filter: „grundlegend“ + „Analytische Geometrie“. Mit Erwartungshorizont (Lösungen).', url: 'https://www.iqb.hu-berlin.de/de/schule/aufgaben/sekii/abiturpruefungsaufgaben-mathematik/' },
  { title: 'Abitur 2025 · Teil A · Geometrie (Aufgabe 1)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: 'https://www.iqb.hu-berlin.de/media/exercise_files/Abituraufgaben_Mathematik/2025MgrundlegendAAGLAA211_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil A · Geometrie (Aufgabe 2)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: 'https://www.iqb.hu-berlin.de/media/exercise_files/Abituraufgaben_Mathematik/2025MgrundlegendAAGLAA221_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil B · Geometrie „Partyzelt“', sub: 'grundlegendes Niveau, CAS-Variante, mit Lösung', url: 'https://www.iqb.hu-berlin.de/media/exercise_files/Abituraufgaben_Mathematik/2025MgrundlegendBAGLAA2MMS1_Aufgabe.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2027', sub: 'Senatsverwaltung für Bildung – was im Abitur drankommt', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2027_gk.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2028', sub: 'Senatsverwaltung für Bildung', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2028_gk.pdf' },
  { title: 'Berlin: Infos zur Abiturprüfung', sub: 'Senatsverwaltung für Bildung, Jugend und Familie', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/' },
];

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

const api = { CHAPTERS, TYPES, EXAMS, LINKS, teilA, teilB, notenpunkte, generate, check, parseNum, withSeed, R, V, fmt: { n, vec, lin } };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Aufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
