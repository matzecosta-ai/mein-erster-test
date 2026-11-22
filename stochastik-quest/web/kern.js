// Gemeinsamer Rechen- und Formatierungskern für Kurven-Quest und Zufalls-Quest.
// Läuft im Browser (window.Kern) und in Node (module.exports) für die Tests.
(function (root) {
'use strict';

// ---------- Zufall (austauschbar, damit die Tages-Challenge reproduzierbar ist) ----------
const R = {
  rng: Math.random,
  int(a, b) { return a + Math.floor(R.rng() * (b - a + 1)); },
  nz(a, b) { let x; do { x = R.int(a, b); } while (x === 0); return x; },
  pick(arr) { return arr[Math.floor(R.rng() * arr.length)]; },
  chance(q) { return R.rng() < q; },
  shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
};
function seeded(seed) { // mulberry32
  let t = seed >>> 0;
  return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function withSeed(seed, fn) { const old = R.rng; R.rng = seeded(seed); try { return fn(); } finally { R.rng = old; } }

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }
function gcdAll(v) { return v.reduce((g, x) => gcd(g, x), 0); }
const round = (x, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

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
const p = x => (typeof x === 'number' && x < -1e-12) ? `(${n(x)})` : n(x);
function frac(num, den) {
  if (den < 0) { num = -num; den = -den; }
  const g = gcd(num, den) || 1; num /= g; den /= g;
  if (den === 1) return n(num);
  return `${num < 0 ? MINUS : ''}<span class="frac"><span>${Math.abs(num)}</span><span>${den}</span></span>`;
}
const fracOver = (top, bottom) => `<span class="frac"><span>${top}</span><span>${bottom}</span></span>`;
// Zahl als Bruch, wenn sie einen kleinen Nenner hat (1/3, 5/4 …), sonst gerundet
function ratio(x) { for (let d = 1; d <= 12; d++) { const k = Math.round(x * d); if (Math.abs(k / d - x) < 1e-9) return [k, d]; } return null; }
function nq(x, dp = 2) { const r = ratio(x); return r ? frac(r[0], r[1]) : n(x, dp); }
const pq = x => (x < -1e-12) ? `(${nq(x)})` : nq(x); // Bruch, negativ in Klammern
const res = s => `<div class="res">${s}</div>`;
const SUPS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻' };
const sup = k => String(k).split('').map(c => SUPS[c] || c).join('');
const pw = (v, e) => e === 0 ? '' : e === 1 ? v : v + sup(e);
// Polynom aus Koeffizienten (höchste Potenz zuerst): [2, 0, −3, 1] → 2x³ − 3x + 1
function poly(c, v = 'x') {
  const d = c.length - 1; let s = '';
  c.forEach((k, i) => {
    const e = d - i;
    if (Math.abs(k) < 1e-12) return;
    const a = Math.abs(k), coef = (Math.abs(a - 1) < 1e-12 && e > 0) ? '' : nq(a);
    const term = coef + pw(v, e);
    if (s === '') s = (k < 0 ? MINUS : '') + term; else s += (k < 0 ? ' − ' : ' + ') + term;
  });
  return s || '0';
}
const pm = x => (x < 0 ? ' − ' : ' + ') + nq(Math.abs(x)); // „ + 3“ / „ − 3“
const ex = (k, b = 0) => `e<sup>${poly([k, b])}</sup>`; // e^(kx+b)
const cf = a => a === 1 ? '' : a === -1 ? MINUS : nq(a) + '·'; // Faktor vor einem Ausdruck
// Polynom-Rechnung (Koeffizienten höchste Potenz zuerst)
const pv = (c, x) => c.reduce((s, k) => s * x + k, 0);
const pd = c => c.slice(0, -1).map((k, i) => k * (c.length - 1 - i));
const pint = c => [...c.map((k, i) => k / (c.length - i)), 0];
function pmul(a, b) { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; }
const fromRoots = (a, roots) => roots.reduce((c, r) => pmul(c, [1, -r]), [a]);
function padd(a, b) { const L = Math.max(a.length, b.length); const A = Array(L - a.length).fill(0).concat(a), B = Array(L - b.length).fill(0).concat(b); return A.map((x, i) => x + B[i]); }
const deg = r => r * 180 / Math.PI;

// Auswahlaufgabe: richtige Antwort + Ablenker, gemischt
function mc(correct, wrongs) {
  const opts = [correct];
  for (const w of wrongs) if (!opts.includes(w)) opts.push(w);
  const sh = R.shuffle(opts);
  return { type: 'choice', options: sh, answer: sh.indexOf(correct) };
}

// ---------- Lineare Gleichungssysteme ----------
const ct = k => k === 1 ? '' : k === -1 ? MINUS : p(k);
function lin(c, vars) {
  let s = '';
  c.forEach((k, i) => {
    if (k === 0) return;
    const a = Math.abs(k), coef = a === 1 ? '' : n(a);
    if (s === '') s = (k < 0 ? MINUS : '') + coef + vars[i]; else s += (k < 0 ? ' − ' : ' + ') + coef + vars[i];
  });
  return s || '0';
}
function mat(rows, aug = false) {
  return `<table class="mat${aug ? ' aug' : ''}">${rows.map(r => `<tr>${r.map((x, j) => `<td${aug && j === r.length - 1 ? ' class="rhs"' : ''}>${n(x)}</td>`).join('')}</tr>`).join('')}</table>`;
}
function lgsText(A, b, vars) {
  return `<div class="lgs">${A.map((row, i) => `<div>${['I', 'II', 'III'][i]}: &nbsp;${lin(row, vars)} = ${n(b[i])}</div>`).join('')}</div>`;
}
const det3 = M => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
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
  const bad = M.find(r => r.slice(0, nn).every(x => x === 0) && r[nn] !== 0);
  if (bad) { steps.push(`Eine Zeile lautet 0 = ${n(bad[nn])}. Das ist ein <b>Widerspruch</b> → das LGS hat <b>keine Lösung</b>.`); return { steps, kind: 1 }; }
  if (pivCols.length < nn) { steps.push(`Eine Zeile lautet 0 = 0 (immer wahr). Es bleiben weniger Gleichungen als Unbekannte → <b>unendlich viele Lösungen</b>.`); return { steps, kind: 2 }; }
  const x = new Array(nn);
  for (let i = nn - 1; i >= 0; i--) {
    const r = M[i]; let rest = r[nn]; const known = [];
    for (let j = i + 1; j < nn; j++) { rest -= r[j] * x[j]; if (r[j] !== 0) known.push(`${p(r[j])}·${pq(x[j])}`); }
    x[i] = rest / r[i];
    steps.push(`Aus ${Z(i)} (von unten nach oben einsetzen): ${ct(r[i])}${vars[i]}${known.length ? ' + ' + known.join(' + ') : ''} = ${n(r[nn])} ⇒ ${ct(r[i])}${vars[i]} = ${nq(rest)} ⇒ <b>${vars[i]} = ${nq(x[i])}</b>`);
  }
  return { steps, kind: 0, x };
}

// ---------- Eingaben auswerten ----------
function parseNum(s) {
  if (s == null) return NaN;
  s = String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, '').replace(/,/g, '.').replace(/·|\*/g, '');
  if (!s) return NaN;
  if (s.endsWith('%')) return parseNum(s.slice(0, -1)) / 100;
  const parts = s.split('/');
  if (parts.length === 2) return parseNum(parts[0]) / parseNum(parts[1]);
  if (parts.length > 2) return NaN;
  const m = s.match(/^([+-]?)(\d*\.?\d*)(?:√|sqrt)\(?(\d*\.?\d+)\)?$/);
  if (m) { const k = m[2] === '' ? 1 : parseFloat(m[2]); return (m[1] === '-' ? -1 : 1) * k * Math.sqrt(parseFloat(m[3])); }
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return parseFloat(s);
  return NaN;
}
// {ok, parts?: [bool], invalid?}
function check(task, input) {
  const tol = task.tol ?? 1e-6;
  if (task.type === 'choice') return { ok: input === task.answer };
  if (task.type === 'num') { const x = parseNum(input); return { ok: Number.isFinite(x) && Math.abs(x - task.answer) <= tol, invalid: !Number.isFinite(x) }; }
  const xs = input.map(parseNum), tolAt = i => (task.tols ? task.tols[i] : tol);
  const invalid = xs.some(x => !Number.isFinite(x));
  let parts;
  if (task.unordered) { // Reihenfolge egal (z. B. mehrere Nullstellen)
    const left = task.answer.slice();
    parts = xs.map(x => { const j = left.findIndex(a => a !== null && Number.isFinite(x) && Math.abs(x - a) <= tolAt(0)); if (j < 0) return false; left[j] = null; return true; });
  } else parts = xs.map((x, i) => Number.isFinite(x) && Math.abs(x - task.answer[i]) <= tolAt(i));
  return { ok: parts.every(Boolean), parts, invalid };
}

// ---------- Aufgabensammlung ----------
function makeBank() {
  const TYPES = [];
  const def = o => TYPES.push(o);
  function generate(typeId) {
    const T = TYPES.find(t => t.id === typeId);
    for (let tries = 0; tries < 20; tries++) {
      try {
        const task = cleanAnswer(T.gen());
        task.typeId = T.id; task.ch = T.ch; task.lvl = T.lvl; task.name = T.name;
        return task;
      } catch (e) { if (tries === 19) throw e; }
    }
  }
  return { TYPES, def, generate };
}
// Rundungsrauschen (1,8e−15 statt 0) entfernen
const clean = x => (typeof x === 'number' ? Math.round(x * 1e10) / 1e10 + 0 : x);
function cleanAnswer(t) { if (t.type !== 'choice') t.answer = Array.isArray(t.answer) ? t.answer.map(clean) : clean(t.answer); return t; }
const part = o => cleanAnswer(Object.assign({ lvl: 3, hints: [], steps: [] }, o));
const L = s => `<b>${s})</b> `;
const NOTEN = [[95, 15], [90, 14], [85, 13], [80, 12], [75, 11], [70, 10], [65, 9], [60, 8], [55, 7], [50, 6], [45, 5], [40, 4], [33, 3], [27, 2], [20, 1], [0, 0]];
const notenpunkte = pct => NOTEN.find(([g]) => pct >= g)[1];
function makeTeilA(HMF, generate, TYPES, intro) {
  return function teilA() {
    const ids = R.shuffle(HMF.filter(id => TYPES.some(t => t.id === id))).slice(0, 5);
    const parts = ids.map((id, i) => { const t = generate(id); t.be = { 1: 3, 2: 5, 3: 5 }[t.lvl]; t.label = `Aufgabe ${i + 1}`; return t; });
    return { id: 'teilA', title: 'Prüfungsteil A – ohne Hilfsmittel', intro, parts };
  };
}

const api = { R, seeded, withSeed, gcd, gcdAll, round, n, p, frac, fracOver, ratio, nq, pq, res, sup, pw, poly, pm, ex, cf, pv, pd, pint, pmul, fromRoots, padd, deg,
  mc, ct, lin, mat, lgsText, det3, gaussSteps, parseNum, check, makeBank, part, L, notenpunkte, makeTeilA };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Kern = api;
})(typeof window !== 'undefined' ? window : globalThis);
