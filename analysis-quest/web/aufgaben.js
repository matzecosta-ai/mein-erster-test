// Kurven-Quest: Aufgaben-Generatoren für Analysis (Grundkurs Berlin).
// Jede Aufgabe liefert: Fragetext, Antworttyp, richtige Antwort, zwei Hinweise und einen
// ausführlichen Lösungsweg. _f/_df bzw. _f/_F dienen nur den automatischen Tests.
(function (root) {
'use strict';
const K = (typeof module !== 'undefined' && module.exports) ? require('./kern.js') : root.Kern;
const { R, n, p, frac, fracOver, nq, pq, res, sup, pw, poly, pm, ex, cf, pv, pd, pint, fromRoots, padd, deg, mc, lgsText, det3, gaussSteps, part, L } = K;
const { TYPES, def, generate } = K.makeBank();

const E = Math.E;
const fx = (name, body) => `${name}(x) = ${body}`;
function rpoly(d, lo = -5, hi = 5) { const c = [R.nz(lo, hi)]; for (let i = 0; i < d; i++) c.push(R.int(lo, hi)); return c; }
function tplPoly(lhs, d, v = 'x', minE = 0) { const t = []; for (let e = d; e >= minE; e--) t.push('{}' + pw(v, e)); return `${lhs} = ${t.join(' + ')}`; }
const ZERO_NOTE = 'Fehlt ein Term, trag 0 ein. Brüche wie 1/3 sind erlaubt.';
const tolArr = (k, t) => Array(k).fill(t);

// ---------- Kapitel ----------
const CHAPTERS = [ // nach den Berliner Prüfungsschwerpunkten Mathematik Grundkurs (2026–2028)
  { id: 'fkt', name: 'Funktionen & Gleichungen', icon: '🧩', desc: 'Nullstellen, e-Gleichungen, Symmetrie, Verschiebungen, sin/cos, Umkehrfunktion' },
  { id: 'abl', name: 'Ableiten', icon: '✏️', desc: 'Potenz-, Summen-, Produkt- und Kettenregel, e-Funktion, 2. Ableitung' },
  { id: 'aen', name: 'Änderungsraten & Tangenten', icon: '📈', desc: 'Mittlere und lokale Änderungsrate, Tangente, Normale, Schnittwinkel' },
  { id: 'kur', name: 'Kurvendiskussion', icon: '🎢', desc: 'Extrem-, Wende- und Sattelpunkte, Monotonie, Randextrema' },
  { id: 'mod', name: 'Modellieren', icon: '🛠️', desc: 'Steckbriefaufgaben, LGS, Extremalprobleme' },
  { id: 'int', name: 'Integrieren', icon: '∫', desc: 'Stammfunktionen, bestimmtes Integral, Integralregeln' },
  { id: 'fla', name: 'Flächen & Bestand', icon: '🟩', desc: 'Flächen mit x-Achse und zwischen Graphen, rekonstruierter Bestand' },
];

// =====================================================================
// Kapitel 1: Funktionen & Gleichungen
// =====================================================================
function pqSteps(P, Q, lo, hi) {
  const D = (P / 2) ** 2 - Q, w = Math.sqrt(D);
  return [
    `pq-Formel mit p = ${nq(P)} und q = ${nq(Q)}: x = −p/2 ± √((p/2)² − q)`,
    `x = ${nq(-P / 2)} ± √(${nq((P / 2) ** 2)} − ${pq(Q)}) = ${nq(-P / 2)} ± √(${nq(D)}) = ${nq(-P / 2)} ± ${nq(w)}`,
    `⇒ x = ${nq(lo)} oder x = ${nq(hi)}`,
  ];
}

def({ id: 'fkt_pq', ch: 'fkt', name: 'Quadratische Gleichung', lvl: 1, gen() {
  let r1, r2; do { r1 = R.int(-7, 7); r2 = R.int(-7, 7); } while (r1 === r2);
  const a = R.pick([1, 1, 2, -1, 3, -2]), c = fromRoots(a, [r1, r2]);
  const P = -(r1 + r2), Q = r1 * r2, lo = Math.min(r1, r2), hi = Math.max(r1, r2);
  return {
    q: `Löse die Gleichung ${poly(c)} = 0.`,
    type: 'tpl', tpl: 'x₁ = {} &nbsp; x₂ = {}', answer: [lo, hi], unordered: true, note: 'Reihenfolge egal.',
    hints: [
      `Bring die Gleichung auf die Form x² + px + q = 0${a !== 1 ? ` – dafür erst durch ${p(a)} teilen` : ''} – und nutze die pq-Formel.`,
      `${a !== 1 ? `Nach dem Teilen: ${poly([1, P, Q])} = 0. ` : ''}Also p = ${n(P)}, q = ${n(Q)}. Unter der Wurzel steht ${nq((P / 2) ** 2 - Q)}.`,
    ],
    steps: [
      ...(a !== 1 ? [`Vor x² muss eine 1 stehen. Teile die ganze Gleichung durch ${p(a)}: ${poly([1, P, Q])} = 0`] : []),
      ...pqSteps(P, Q, lo, hi),
      `Probe (lohnt sich immer): ${poly(c)} mit x = ${n(lo)} ergibt ${n(pv(c, lo))}. ✓`,
      res(`x₁ = ${n(lo)}, x₂ = ${n(hi)}`),
    ],
  };
} });

def({ id: 'fkt_ausklammern', ch: 'fkt', name: 'Gleichung 3. Grades (Ausklammern)', lvl: 2, gen() {
  let r1, r2; do { r1 = R.nz(-5, 5); r2 = R.nz(-5, 5); } while (r1 === r2);
  const a = R.pick([1, -1, 2]), c = fromRoots(a, [0, r1, r2]), lo = Math.min(r1, r2), hi = Math.max(r1, r2);
  return {
    q: `Bestimme alle Lösungen der Gleichung ${poly(c)} = 0.`,
    type: 'tpl', tpl: 'x₁ = {} &nbsp; x₂ = {} &nbsp; x₃ = {}', answer: [0, lo, hi], unordered: true, note: 'Reihenfolge egal.',
    hints: [
      `Es gibt kein Glied ohne x. Klammere x aus und nutze den <b>Satz vom Nullprodukt</b>: Ein Produkt ist 0, wenn ein Faktor 0 ist.`,
      `x · (${poly(c.slice(0, 3))}) = 0. Also x = 0 oder ${poly(c.slice(0, 3))} = 0 (pq-Formel).`,
    ],
    steps: [
      `x ausklammern: x · (${poly(c.slice(0, 3))}) = 0`,
      `Satz vom Nullprodukt: x = 0 <b>oder</b> ${poly(c.slice(0, 3))} = 0`,
      ...(a !== 1 ? [`Zweite Gleichung durch ${p(a)} teilen: ${poly([1, -(r1 + r2), r1 * r2])} = 0`] : []),
      ...pqSteps(-(r1 + r2), r1 * r2, lo, hi),
      res(`x₁ = 0, x₂ = ${n(lo)}, x₃ = ${n(hi)}`),
    ],
  };
} });

def({ id: 'fkt_biquad', ch: 'fkt', name: 'Biquadratische Gleichung', lvl: 2, gen() {
  let a, b; do { a = R.int(1, 4); b = R.int(1, 5); } while (a >= b);
  const only = R.chance(0.35); // zweite Lösung für z ist negativ
  const m = R.int(1, 6);
  const c = only ? [1, 0, m - b * b, 0, -b * b * m] : [1, 0, -(a * a + b * b), 0, a * a * b * b];
  const zc = only ? [1, m - b * b, -b * b * m] : [1, -(a * a + b * b), a * a * b * b];
  const zs = only ? [-m, b * b] : [a * a, b * b];
  const ans = only ? [-b, b] : [-b, -a, a, b];
  return {
    q: `Bestimme alle reellen Lösungen der Gleichung ${poly(c)} = 0.`,
    type: 'tpl', tpl: only ? 'x₁ = {} &nbsp; x₂ = {}' : 'x₁ = {} &nbsp; x₂ = {} &nbsp; x₃ = {} &nbsp; x₄ = {}', answer: ans, unordered: true,
    note: `Reihenfolge egal. Es gibt genau ${ans.length} Lösungen.`,
    hints: [
      `Es kommen nur x⁴ und x² vor. <b>Substitution:</b> Setze z = x². Dann wird daraus eine quadratische Gleichung für z.`,
      `${poly(zc, 'z')} = 0 hat die Lösungen z = ${n(zs[0])} und z = ${n(zs[1])}. Jetzt zurück: x² = z.`,
    ],
    steps: [
      `Substitution z = x² (also x⁴ = z²): ${poly(zc, 'z')} = 0`,
      ...pqSteps(zc[1], zc[2], zs[0], zs[1]).map(s => s.replace(/x/g, 'z')),
      `Rücksubstitution x² = z: ${only ? `x² = ${n(-m)} hat <b>keine</b> reelle Lösung (ein Quadrat ist nie negativ). x² = ${b * b} ⇒ x = ±${b}` : `x² = ${a * a} ⇒ x = ±${a}; x² = ${b * b} ⇒ x = ±${b}`}`,
      res(`x ∈ {${ans.map(x => n(x)).join('; ')}}`),
    ],
  };
} });

def({ id: 'fkt_expgl', ch: 'fkt', name: 'Exponentialgleichung (ln)', lvl: 2, gen() {
  const a = R.pick([1, 2, 3, 4, 5]), m = R.pick([2, 3, 4, 5, 6, 8, 10]), k = R.pick([1, 2, 3, -1, -2, 0.5]), b = R.pick([0, 0, 1, -1, 2]);
  const cc = a * m, x = (Math.log(m) - b) / k;
  const lhs = `${a === 1 ? '' : a + '·'}${ex(k, b)}`;
  return {
    q: `Löse die Gleichung ${lhs} = ${cc}.<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: x, tol: 0.011,
    hints: [
      `Isoliere zuerst die e-Potenz${a !== 1 ? ` (durch ${a} teilen)` : ''}. Dann auf beiden Seiten den <b>natürlichen Logarithmus</b> ln anwenden: ln(e<sup>□</sup>) = □.`,
      `${ex(k, b)} = ${m} ⇒ ${poly([k, b])} = ln(${m}) ≈ ${n(Math.log(m), 4)}. Jetzt nach x auflösen.`,
    ],
    steps: [
      ...(a !== 1 ? [`Durch ${a} teilen: ${ex(k, b)} = ${m}`] : []),
      `ln anwenden (ln und e heben sich auf): ${poly([k, b])} = ln(${m})`,
      ...(b !== 0 ? [`${b > 0 ? `−${b}` : `+${-b}`} auf beiden Seiten: ${poly([k, 0])} = ln(${m}) ${pm(-b)}`] : []),
      ...(k !== 1 ? [`Durch ${p(k)} teilen: x = (ln(${m})${b ? pm(-b) : ''}) / ${p(k)}`] : []),
      `x ≈ ${n(x, 4)}`,
      res(`x ≈ ${n(x)}`),
    ],
  };
} });

def({ id: 'fkt_nullprodukt', ch: 'fkt', name: 'Nullprodukt mit e-Funktion', lvl: 3, gen() {
  if (R.chance(0.5)) {
    const r = R.int(1, 5), a = R.pick([1, 2, -1, 3]), k = R.pick([1, -1, 2]);
    return {
      q: `Bestimme alle Lösungen von (${poly([a, 0, -a * r * r])}) · ${ex(k)} = 0.`,
      type: 'tpl', tpl: 'x₁ = {} &nbsp; x₂ = {}', answer: [-r, r], unordered: true, note: 'Reihenfolge egal.',
      hints: [`Satz vom Nullprodukt: Einer der beiden Faktoren muss 0 sein. Kann ${ex(k)} überhaupt 0 werden?`, `${ex(k)} ist <b>immer positiv</b>, nie 0. Also bleibt nur ${poly([a, 0, -a * r * r])} = 0.`],
      steps: [
        `Satz vom Nullprodukt: ${poly([a, 0, -a * r * r])} = 0 oder ${ex(k)} = 0.`,
        `${ex(k)} > 0 für alle x – dieser Faktor liefert keine Lösung.`,
        `${poly([a, 0, -a * r * r])} = 0 ⇒ x² = ${r * r} ⇒ x = ±${r}`,
        res(`x₁ = −${r}, x₂ = ${r}`),
      ],
    };
  }
  const r = R.int(-4, 4), a = R.pick([1, 2, -1, 3]), m = R.pick([2, 3, 5, 7, 10]);
  const lm = Math.log(m);
  return {
    q: `Bestimme alle Lösungen von (${poly([a, -a * r])}) · (eˣ − ${m}) = 0.<br><small>Runde auf 2 Nachkommastellen.</small>`,
    type: 'tpl', tpl: 'x₁ = {} &nbsp; x₂ = {}', answer: [r, lm], unordered: true, tol: 0.011, note: 'Reihenfolge egal.',
    hints: [`Satz vom Nullprodukt: (${poly([a, -a * r])}) = 0 oder (eˣ − ${m}) = 0. Löse beide Gleichungen einzeln.`, `${poly([a, -a * r])} = 0 ⇒ x = ${n(r)}. Und eˣ = ${m} ⇒ x = ln(${m}).`],
    steps: [
      `Satz vom Nullprodukt: Ein Produkt ist 0, wenn mindestens ein Faktor 0 ist.`,
      `1. Faktor: ${poly([a, -a * r])} = 0 ⇒ x = ${n(r)}`,
      `2. Faktor: eˣ − ${m} = 0 ⇒ eˣ = ${m} ⇒ x = ln(${m}) ≈ ${n(lm, 4)}`,
      res(`x₁ = ${n(r)}, x₂ = ln(${m}) ≈ ${n(lm)}`),
    ],
  };
} });

def({ id: 'fkt_wurzel', ch: 'fkt', name: 'Wurzelgleichung', lvl: 1, gen() {
  const x = R.int(-4, 10), a = R.pick([1, 2, 3, -1, 4]), c = R.int(1, 6), b = c * c - a * x;
  return {
    q: `Löse die Gleichung √(${poly([a, b])}) = ${c}.`,
    type: 'num', answer: x,
    hints: [`Quadriere beide Seiten, dann verschwindet die Wurzel: ${poly([a, b])} = ${c}².`, `${poly([a, b])} = ${c * c}. Jetzt nach x auflösen – und am Ende die Probe machen!`],
    steps: [
      `Beide Seiten quadrieren: ${poly([a, b])} = ${c * c}`,
      ...(b !== 0 ? [`${b > 0 ? '−' + b : '+' + (-b)}: ${poly([a, 0])} = ${c * c - b}`] : []),
      ...(a !== 1 ? [`Durch ${p(a)} teilen: x = ${n(x)}`] : []),
      `Probe: x = ${n(x)} einsetzen ⇒ ${poly([a, b])} = ${c * c} und √${c * c} = ${c} ✓ (Quadrieren kann Scheinlösungen erzeugen – deshalb immer prüfen.)`,
      res(`x = ${n(x)}`),
    ],
  };
} });

def({ id: 'fkt_symm', ch: 'fkt', name: 'Symmetrie erkennen', lvl: 1, gen() {
  const kind = R.int(0, 2);
  let c;
  if (kind === 0) c = [R.nz(-4, 4), 0, R.nz(-6, 6), 0, R.int(-5, 5)];
  else if (kind === 1) c = R.chance(0.5) ? [R.nz(-4, 4), 0, R.nz(-6, 6), 0] : [R.nz(-3, 3), 0, R.nz(-4, 4), 0, R.nz(-6, 6), 0];
  else c = [R.nz(-4, 4), R.nz(-5, 5), R.int(-5, 5), R.nz(-5, 5)];
  const opts = ['achsensymmetrisch zur y-Achse', 'punktsymmetrisch zum Ursprung', 'keine dieser beiden Symmetrien'];
  const d = c.length - 1, exps = c.map((k, i) => k ? d - i : null).filter(e => e !== null);
  return {
    q: `Untersuche den Graphen von ${fx('f', poly(c))} auf Symmetrie.`,
    type: 'choice', options: opts, answer: kind,
    hints: [`Schau dir nur die <b>Exponenten</b> der x-Potenzen an (eine Zahl ohne x zählt als x⁰, also gerade).`, `Nur gerade Exponenten → achsensymmetrisch zur y-Achse. Nur ungerade → punktsymmetrisch zum Ursprung. Gemischt → keine.`],
    steps: [
      `Exponenten in f: ${exps.join(', ')}`,
      kind === 0 ? 'Alle Exponenten sind gerade ⇒ f(−x) = f(x).' : kind === 1 ? 'Alle Exponenten sind ungerade ⇒ f(−x) = −f(x).' : 'Gerade und ungerade Exponenten gemischt ⇒ weder f(−x) = f(x) noch f(−x) = −f(x).',
      res(`Der Graph ist ${opts[kind]}.`),
    ],
  };
} });

def({ id: 'fkt_unendlich', ch: 'fkt', name: 'Verhalten im Unendlichen', lvl: 1, gen() {
  if (R.chance(0.4)) {
    const cc = R.nz(-6, 8), a = R.nz(-5, 5), k = R.pick([1, 2, 0.5, 3]);
    return {
      q: `Gegen welchen Wert strebt ${fx('f', `${cc} ${a < 0 ? '−' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a) + '·'}${ex(-k)}`)} für x → +∞?`,
      type: 'num', answer: cc,
      hints: [`Was passiert mit ${ex(-k)}, wenn x sehr groß wird? Probier x = 100 aus.`, `${ex(-k)} → 0 für x → ∞. Übrig bleibt die Konstante.`],
      steps: [`${ex(-k)} = 1 / e<sup>${poly([k, 0])}</sup>. Der Nenner wird riesig ⇒ der Bruch geht gegen 0.`, `Also: f(x) → ${cc} ${a < 0 ? '−' : '+'} ${Math.abs(a)}·0 = ${n(cc)}. Die Gerade y = ${n(cc)} ist eine waagerechte Asymptote.`, res(`f(x) → ${n(cc)}`)],
    };
  }
  const d = R.int(2, 5), a = R.nz(-4, 4), c = [a, ...Array(d).fill(0).map(() => R.int(-5, 5))];
  const plus = a > 0 ? '+∞' : '−∞', minus = (a > 0) === (d % 2 === 0) ? '+∞' : '−∞';
  const txt = (m, pl) => `x → −∞: f(x) → ${m} &nbsp;und&nbsp; x → +∞: f(x) → ${pl}`;
  const all = [['+∞', '+∞'], ['−∞', '−∞'], ['−∞', '+∞'], ['+∞', '−∞']].map(([m, pl]) => txt(m, pl));
  const correct = txt(minus, plus);
  return Object.assign(mc(correct, all.filter(s => s !== correct)), {
    q: `Beschreibe das Verhalten von ${fx('f', poly(c))} für x → ±∞.`,
    hints: [`Für sehr große |x| entscheidet nur der Summand mit der <b>höchsten Potenz</b>: ${poly([a, ...Array(d).fill(0)])}.`, `Grad ${d} ist ${d % 2 === 0 ? 'gerade' : 'ungerade'}, der Faktor davor ist ${a > 0 ? 'positiv' : 'negativ'}. Setz zur Probe x = 100 und x = −100 ein.`],
    steps: [`Entscheidend: ${poly([a, ...Array(d).fill(0)])}`, `x → +∞: x${sup(d)} → +∞, mal ${n(a)} ⇒ ${plus}`, `x → −∞: x${sup(d)} → ${d % 2 === 0 ? '+∞ (gerader Exponent)' : '−∞ (ungerader Exponent)'}, mal ${n(a)} ⇒ ${minus}`, res(correct)],
  });
} });

function trafoText(a, c, d) {
  const t = [];
  if (a < 0) t.push('an der x-Achse gespiegelt');
  if (Math.abs(a) !== 1) t.push(`mit dem Faktor ${nq(Math.abs(a))} in y-Richtung ${Math.abs(a) > 1 ? 'gestreckt' : 'gestaucht'}`);
  t.push(`um ${Math.abs(c)} nach ${c > 0 ? 'rechts' : 'links'} und um ${Math.abs(d)} nach ${d > 0 ? 'oben' : 'unten'} verschoben`);
  return t.join(', ');
}
def({ id: 'fkt_trafo', ch: 'fkt', name: 'Verschieben, Strecken, Spiegeln', lvl: 2, gen() {
  const a = R.pick([1, 2, 3, 0.5, -1, -2]), c = R.nz(-4, 4), d = R.nz(-5, 5);
  const base = R.pick(['x²', 'x³', 'eˣ']);
  const g = base === 'eˣ' ? `${cf(a)}e<sup>x${pm(-c)}</sup>${pm(d)}` : `${cf(a)}(x${pm(-c)})${base === 'x²' ? '²' : '³'}${pm(d)}`;
  const correct = trafoText(a, c, d);
  return Object.assign(mc(correct, R.shuffle([trafoText(a, -c, d), trafoText(a, c, -d), trafoText(a, -c, -d), trafoText(-a, c, d)]).slice(0, 3)), {
    q: `Der Graph von ${fx('g', g)} entsteht aus dem Graphen von ${fx('f', base)}. Wie?`,
    hints: [`Steht etwas <b>im</b> Argument (bei x), wirkt es in x-Richtung – und zwar „andersherum“: x − 3 heißt 3 nach <b>rechts</b>. Ein Summand <b>außen</b> verschiebt nach oben/unten.`, `Ein Faktor vor dem Ganzen streckt (|a| > 1) oder staucht (|a| < 1). Ein Minus davor spiegelt an der x-Achse.`],
    steps: [
      `Allgemein: g(x) = a·f(x − c) + d`,
      `Hier: a = ${nq(a)}, c = ${n(c)}, d = ${n(d)}`,
      `x${pm(-c)} ⇒ Verschiebung um ${Math.abs(c)} nach ${c > 0 ? 'rechts' : 'links'}; ${pm(d).trim()} außen ⇒ um ${Math.abs(d)} nach ${d > 0 ? 'oben' : 'unten'}.`,
      a < 0 ? `Negativer Faktor ⇒ Spiegelung an der x-Achse.` : `Positiver Faktor ⇒ keine Spiegelung.`,
      res(`Der Graph wird ${correct}.`),
    ],
  });
} });

def({ id: 'fkt_trig', ch: 'fkt', name: 'Sinus und Kosinus', lvl: 2, gen() {
  const a = R.pick([2, 3, 0.5, -2, 4, 1.5]), b = R.pick([1, 2, 4, 0.5]), d = R.pick([0, 1, -1, 2, 3]), fn = R.pick(['sin', 'cos']);
  const per = 2 / b;
  return {
    q: `Gegeben ist ${fx('f', `${cf(a)}${fn}(${b === 1 ? 'x' : nq(b) + 'x'})${d ? pm(d) : ''}`)}.<br>Gib Amplitude, Periodenlänge und die Mittellinie an.`,
    type: 'tpl', tpl: 'Amplitude: {} &nbsp; Periode: {}·π &nbsp; Mittellinie: y = {}', answer: [Math.abs(a), per, d], tol: 0.011,
    hints: [`Bei f(x) = a·${fn}(bx) + d gilt: Amplitude = |a|, Periodenlänge = 2π / b, Mittellinie y = d.`, `Hier: a = ${nq(a)}, b = ${nq(b)}, d = ${n(d)}. Die Periode 2π / ${nq(b)} schreibst du als Vielfaches von π.`],
    steps: [
      `Amplitude = |a| = |${nq(a)}| = ${nq(Math.abs(a))} (wie weit der Graph über/unter die Mittellinie geht)`,
      `Periode = 2π / b = 2π / ${nq(b)} = ${nq(per)}π`,
      `Mittellinie: y = d = ${n(d)} (der Graph schwingt um diese Höhe)`,
      res(`Amplitude ${nq(Math.abs(a))}, Periode ${nq(per)}π, Mittellinie y = ${n(d)}`),
    ],
  };
} });

def({ id: 'fkt_umkehr', ch: 'fkt', name: 'Umkehrfunktion', lvl: 2, gen() {
  const v = R.int(0, 2);
  if (v === 0) {
    const m = R.pick([2, 3, 4, -2, -4, 0.5, -0.5, 5]), c = R.nz(-6, 6);
    return {
      q: `Bestimme die Umkehrfunktion von ${fx('f', poly([m, c]))}.`,
      type: 'tpl', tpl: 'f⁻¹(x) = {}·x + {}', answer: [1 / m, -c / m], tol: 0.011, note: 'Brüche wie 1/3 sind erlaubt.',
      hints: [`Schreibe y = ${poly([m, c])} und löse nach x auf. Danach x und y vertauschen.`, `y ${pm(-c)} = ${poly([m, 0])} ⇒ x = (y ${pm(-c)}) / ${p(m)}.`],
      steps: [`y = ${poly([m, c])}`, `Nach x auflösen: x = (y${pm(-c)}) / ${p(m)} = ${poly([1 / m, -c / m], 'y')}`, `x und y tauschen: y = ${poly([1 / m, -c / m])}`, res(`f⁻¹(x) = ${poly([1 / m, -c / m])}`)],
    };
  }
  if (v === 1) {
    const a = R.int(-3, 1), b = a + R.int(2, 5), r = R.int(-2, 3), s = r + R.int(2, 8);
    const I = (x, y) => `[${n(x)}; ${n(y)}]`;
    return Object.assign(mc(I(r, s), [I(a, b), I(-s, -r), 'ℝ (alle reellen Zahlen)']), {
      q: `Die Funktion f ist umkehrbar, hat die Definitionsmenge D = ${I(a, b)} und die Wertemenge W = ${I(r, s)}. Welche Definitionsmenge hat f⁻¹?`,
      hints: [`Die Umkehrfunktion „tauscht die Rollen“ von x und y.`, `Was bei f herauskommt (Wertemenge), wird bei f⁻¹ eingesetzt (Definitionsmenge).`],
      steps: [`Bei der Umkehrfunktion werden x und y vertauscht.`, `Deshalb gilt: D(f⁻¹) = W(f) und W(f⁻¹) = D(f).`, res(`D(f⁻¹) = ${I(r, s)}`)],
    });
  }
  return Object.assign(mc('durch Spiegelung an der Geraden y = x', ['durch Spiegelung an der x-Achse', 'durch Spiegelung an der y-Achse', 'durch Spiegelung am Ursprung']), {
    q: `Wie entsteht der Graph der Umkehrfunktion f⁻¹ aus dem Graphen von f? (Beispiel: f(x) = eˣ und f⁻¹(x) = ln(x))`,
    hints: [`Bei f⁻¹ werden x- und y-Koordinate jedes Punktes vertauscht: Aus (2 | 5) wird (5 | 2).`, `Welche Spiegelung macht aus (a | b) den Punkt (b | a)?`],
    steps: [`Ein Punkt (a | b) auf f wird zu (b | a) auf f⁻¹.`, `Das Vertauschen der Koordinaten ist die Spiegelung an der Winkelhalbierenden y = x. Beispiel: (0 | 1) liegt auf eˣ, (1 | 0) auf ln(x).`, res('Spiegelung an der Geraden y = x')],
  });
} });

// =====================================================================
// Kapitel 2: Ableiten
// =====================================================================
function powerRuleSteps(c, name = 'f') {
  const d = c.length - 1, out = [];
  c.forEach((k, i) => { const e = d - i; if (!k) return; out.push(e === 0 ? `${n(k)} → 0 (Konstante fällt weg)` : `${poly([k, ...Array(e).fill(0)])} → ${e}${Math.abs(k) === 1 && e > 1 ? (k < 0 ? '·(−1)·' : '') : '·' + p(k) + (e > 1 ? '·' : '')}${e - 1 ? pw('x', e - 1) : ''} =${poly([k * e, ...Array(e - 1).fill(0)])}`); });
  return `Potenzregel (x<sup>n</sup> → n·x<sup>n−1</sup>) für jeden Summanden:<ul class="calc">${out.map(o => `<li>${o}</li>`).join('')}</ul>`;
}
def({ id: 'abl_poly', ch: 'abl', name: 'Ganzrationale Funktion ableiten', lvl: 1, gen() {
  const c = rpoly(R.pick([3, 3, 4]), -6, 6), d1 = pd(c);
  return {
    q: `Bilde die erste Ableitung von ${fx('f', poly(c))}.`,
    type: 'tpl', tpl: tplPoly('f′(x)', d1.length - 1), answer: d1, note: ZERO_NOTE,
    hints: [`Potenzregel: Der Exponent wandert als Faktor nach vorn und wird um 1 kleiner: x<sup>n</sup> → n·x<sup>n−1</sup>. Konstanten fallen weg.`, `Erster Summand: ${poly([c[0], ...Array(c.length - 1).fill(0)])} → ${poly([d1[0], ...Array(d1.length - 1).fill(0)])}. Mach so mit jedem Summanden weiter.`],
    steps: [powerRuleSteps(c), res(fx('f′', poly(d1)))],
    _f: x => pv(c, x), _df: (ans => x => pv(ans, x)),
  };
} });

def({ id: 'abl_zweite', ch: 'abl', name: 'Zweite Ableitung', lvl: 1, gen() {
  const c = rpoly(R.pick([3, 4]), -5, 5), d1 = pd(c), d2 = pd(d1);
  return {
    q: `Bilde die zweite Ableitung f″ von ${fx('f', poly(c))}.`,
    type: 'tpl', tpl: tplPoly('f″(x)', d2.length - 1), answer: d2, note: ZERO_NOTE,
    hints: [`Erst f′ bilden, dann f′ noch einmal ableiten.`, `f′(x) = ${poly(d1)}`],
    steps: [`Erste Ableitung: f′(x) = ${poly(d1)}`, powerRuleSteps(d1, 'f′'), res(fx('f″', poly(d2)))],
  };
} });

def({ id: 'abl_wert', ch: 'abl', name: 'Ableitung an einer Stelle', lvl: 1, gen() {
  const c = rpoly(3, -4, 4), x0 = R.int(-3, 3), d1 = pd(c), v = pv(d1, x0);
  return {
    q: `Gegeben ist ${fx('f', poly(c))}. Berechne f′(${n(x0)}).`,
    type: 'num', answer: v,
    hints: [`Erst die Ableitungsfunktion f′(x) bilden, dann x = ${n(x0)} einsetzen.`, `f′(x) = ${poly(d1)}`],
    steps: [`f′(x) = ${poly(d1)}`, `f′(${n(x0)}) = ${d1.map((k, i) => { const e = d1.length - 1 - i; return e === 0 ? p(k) : `${p(k)}·${p(x0)}${e > 1 ? sup(e) : ''}`; }).join(' + ')} = ${n(v)}`, res(`f′(${n(x0)}) = ${n(v)}`)],
  };
} });

def({ id: 'abl_potenz', ch: 'abl', name: 'Potenzfunktion mit negativem Exponenten', lvl: 2, gen() {
  const k = R.int(1, 3), a = R.pick([1, 2, 3, 4, 5, 6, -2, -3]);
  const f = (a < 0 ? '−' : '') + fracOver(Math.abs(a), pw('x', k));
  return {
    q: `Leite ${fx('f', f)} ab.`,
    type: 'tpl', tpl: 'f′(x) = {} · xⁿ &nbsp; mit n = {}', answer: [-k * a, -k - 1],
    hints: [`Schreibe den Bruch als Potenz mit negativem Exponenten: ${f} = ${n(a)}·x<sup>−${k}</sup>. Dann Potenzregel.`, `x<sup>−${k}</sup> → −${k}·x<sup>−${k + 1}</sup>. Den Faktor ${n(a)} mitnehmen.`],
    steps: [`Umschreiben: f(x) = ${n(a)}·x<sup>−${k}</sup>`, `Potenzregel: f′(x) = ${n(a)}·(−${k})·x<sup>−${k} − 1</sup> = ${n(-k * a)}·x<sup>−${k + 1}</sup>`, `Als Bruch: f′(x) = ${-k * a < 0 ? '−' : ''}${fracOver(Math.abs(k * a), pw('x', k + 1))}`, res(`f′(x) = ${n(-k * a)}·x<sup>−${k + 1}</sup>`)],
    _f: x => a / x ** k, _df: (ans => x => ans[0] * x ** ans[1]),
  };
} });

def({ id: 'abl_kette', ch: 'abl', name: 'Kettenregel', lvl: 2, gen() {
  if (R.chance(0.55)) {
    const a = R.pick([1, 2, 3, -1, 4, 5]), k = R.pick([2, 3, -1, -2, 0.5, 4]), b = R.pick([0, 1, -1, 3]);
    return {
      q: `Leite ${fx('f', `${cf(a)}${ex(k, b)}`)} ab.`,
      type: 'tpl', tpl: `f′(x) = {} · ${ex(k, b)}`, answer: [a * k], tol: 0.006,
      hints: [`Kettenregel: äußere Ableitung · innere Ableitung. Die e-Funktion bleibt beim Ableiten gleich.`, `Innere Funktion: ${poly([k, b])}, ihre Ableitung ist ${nq(k)}.`],
      steps: [`Äußere Funktion e<sup>□</sup> → e<sup>□</sup> (bleibt gleich)`, `Innere Funktion ${poly([k, b])} → ${nq(k)}`, `f′(x) = ${n(a)} · ${ex(k, b)} · ${pq(k)} = ${cf(a * k)}${ex(k, b)}`, res(`f′(x) = ${cf(a * k)}${ex(k, b)}`)],
      _f: x => a * E ** (k * x + b), _df: (ans => x => ans[0] * E ** (k * x + b)),
    };
  }
  const a = R.pick([1, 2, 3, -1]), k = R.pick([2, 3, -1, -2, 4]), b = R.nz(-4, 4), m = R.int(2, 5);
  const inner = `(${poly([k, b])})`;
  return {
    q: `Leite ${fx('f', `${cf(a)}${inner}${sup(m)}`)} ab.`,
    type: 'tpl', tpl: `f′(x) = {} · ${inner}ⁿ &nbsp; mit n = {}`, answer: [a * m * k, m - 1],
    hints: [`Kettenregel: äußere Ableitung (Potenzregel auf die Klammer) mal innere Ableitung (Ableitung von ${poly([k, b])}).`, `Äußere Ableitung: ${n(a * m)}·${inner}${sup(m - 1)}. Innere Ableitung: ${n(k)}.`],
    steps: [`Äußere Funktion: ${cf(a)}□${sup(m)} → ${n(a * m)}·□${sup(m - 1)}`, `Innere Funktion: ${poly([k, b])} → ${n(k)}`, `f′(x) = ${n(a * m)}·${inner}${sup(m - 1)} · ${p(k)} = ${n(a * m * k)}·${inner}${sup(m - 1)}`, res(`f′(x) = ${n(a * m * k)}·${inner}${sup(m - 1)}`)],
    _f: x => a * (k * x + b) ** m, _df: (ans => x => ans[0] * (k * x + b) ** ans[1]),
  };
} });

def({ id: 'abl_produkt', ch: 'abl', name: 'Produktregel mit e-Funktion', lvl: 3, gen() {
  if (R.chance(0.6)) {
    const a = R.nz(-3, 4), b = R.int(-5, 5), k = R.pick([1, -1, 2, -2]);
    const ans = [k * a, a + k * b];
    return {
      q: `Leite ${fx('f', `(${poly([a, b])}) · ${ex(k)}`)} ab und fasse zusammen.`,
      type: 'tpl', tpl: `f′(x) = ({}x + {}) · ${ex(k)}`, answer: ans, note: ZERO_NOTE,
      hints: [`Produktregel: (u·v)′ = u′·v + u·v′ mit u = ${poly([a, b])} und v = ${ex(k)}.`, `u′ = ${n(a)}, v′ = ${cf(k)}${ex(k)} (Kettenregel). Danach ${ex(k)} ausklammern.`],
      steps: [`u = ${poly([a, b])}, u′ = ${n(a)}; v = ${ex(k)}, v′ = ${cf(k)}${ex(k)}`, `f′(x) = ${n(a)}·${ex(k)} + (${poly([a, b])})·${p(k)}·${ex(k)}`, `${ex(k)} ausklammern: f′(x) = (${n(a)} + ${p(k)}·(${poly([a, b])}))·${ex(k)} = (${poly(ans)})·${ex(k)}`, res(`f′(x) = (${poly(ans)})·${ex(k)}`)],
      _f: x => (a * x + b) * E ** (k * x), _df: (u => x => (u[0] * x + u[1]) * E ** (k * x)),
    };
  }
  const a = R.pick([1, -1, 2]), c = R.int(-5, 5), ans = [a, 2 * a, c];
  return {
    q: `Leite ${fx('f', `(${poly([a, 0, c])}) · eˣ`)} ab und fasse zusammen.`,
    type: 'tpl', tpl: 'f′(x) = ({}x² + {}x + {}) · eˣ', answer: ans, note: ZERO_NOTE,
    hints: [`Produktregel: (u·v)′ = u′·v + u·v′ mit u = ${poly([a, 0, c])} und v = eˣ.`, `u′ = ${poly([2 * a, 0])}, v′ = eˣ. Danach eˣ ausklammern.`],
    steps: [`u = ${poly([a, 0, c])}, u′ = ${poly([2 * a, 0])}; v = v′ = eˣ`, `f′(x) = ${poly([2 * a, 0])}·eˣ + (${poly([a, 0, c])})·eˣ`, `eˣ ausklammern und sortieren: f′(x) = (${poly(ans)})·eˣ`, res(`f′(x) = (${poly(ans)})·eˣ`)],
    _f: x => (a * x * x + c) * E ** x, _df: (u => x => pv(u, x) * E ** x),
  };
} });

const GRAPH_FACTS = [
  ['f′ hat bei x = s eine Nullstelle mit Vorzeichenwechsel von + nach −.', 'f hat bei x = s einen Hochpunkt.'],
  ['f′ hat bei x = s eine Nullstelle mit Vorzeichenwechsel von − nach +.', 'f hat bei x = s einen Tiefpunkt.'],
  ['f′ hat bei x = s eine Nullstelle ohne Vorzeichenwechsel.', 'f hat bei x = s einen Sattelpunkt.'],
  ['Der Graph von f′ hat bei x = s einen Hoch- oder Tiefpunkt.', 'f hat bei x = s einen Wendepunkt.'],
  ['f′(x) > 0 für alle x im Intervall ]a; b[.', 'f ist auf ]a; b[ streng monoton steigend.'],
  ['f′(x) < 0 für alle x im Intervall ]a; b[.', 'f ist auf ]a; b[ streng monoton fallend.'],
  ['f″(x) < 0 für alle x im Intervall ]a; b[.', 'Der Graph von f ist auf ]a; b[ rechtsgekrümmt.'],
  ['f″(x) > 0 für alle x im Intervall ]a; b[.', 'Der Graph von f ist auf ]a; b[ linksgekrümmt.'],
];
def({ id: 'abl_graph', ch: 'abl', name: 'Was verrät f′ über f?', lvl: 2, gen() {
  const s = R.int(-3, 4), a = R.int(-3, 0), b = a + R.int(2, 5);
  const sub = t => t.replace(/x = s/g, `x = ${n(s)}`).replace(/\]a; b\[/g, `]${n(a)}; ${n(b)}[`);
  const i = R.int(0, GRAPH_FACTS.length - 1), correct = sub(GRAPH_FACTS[i][1]);
  return Object.assign(mc(correct, R.shuffle(GRAPH_FACTS.filter((_, j) => j !== i)).slice(0, 3).map(f => sub(f[1]))), {
    q: `Über die Funktion f ist bekannt:<br><b>${sub(GRAPH_FACTS[i][0])}</b><br>Welche Aussage über f folgt daraus?`,
    hints: [`f′ ist die Steigung von f. f′ > 0 heißt „f steigt“, f′ < 0 heißt „f fällt“. f″ beschreibt die Krümmung.`, `Wechselt die Steigung von + nach −, geht es erst bergauf, dann bergab (Gipfel). Extremstellen von f′ = Stellen mit der größten/kleinsten Steigung von f = Wendestellen.`],
    steps: [
      'Merke: f′ = 0 mit Vorzeichenwechsel → Extrempunkt; ohne Vorzeichenwechsel → Sattelpunkt.',
      'Extremstellen von f′ (also f″ = 0 mit Vorzeichenwechsel) → Wendestellen von f.',
      'f′ > 0 → f steigt, f′ < 0 → f fällt; f″ > 0 → linksgekrümmt, f″ < 0 → rechtsgekrümmt.',
      res(correct),
    ],
  });
} });

// =====================================================================
// Kapitel 3: Änderungsraten & Tangenten
// =====================================================================
def({ id: 'aen_mittel', ch: 'aen', name: 'Mittlere Änderungsrate', lvl: 1, gen() {
  const c = rpoly(R.pick([2, 3]), -3, 3), a = R.int(-2, 2), b = a + R.int(1, 3);
  const fa = pv(c, a), fb = pv(c, b), m = (fb - fa) / (b - a);
  return {
    q: `Berechne die mittlere Änderungsrate von ${fx('f', poly(c))} im Intervall [${n(a)}; ${n(b)}].`,
    type: 'num', answer: m, tol: 0.011,
    hints: [`Mittlere Änderungsrate = Steigung der Sekante = (f(b) − f(a)) / (b − a).`, `f(${n(a)}) = ${n(fa)} und f(${n(b)}) = ${n(fb)}.`],
    steps: [`f(${n(a)}) = ${n(fa)}, f(${n(b)}) = ${n(fb)}`, `m = (f(${n(b)}) − f(${n(a)})) / (${n(b)} − ${p(a)}) = (${n(fb)} − ${p(fa)}) / ${b - a} = ${nq(m)}`, res(`m = ${nq(m)}${Number.isInteger(m) ? '' : ' ≈ ' + n(m)}`)],
  };
} });

function tangentData(c, x0) { const m = pv(pd(c), x0), y0 = pv(c, x0); return { m, y0, b: y0 - m * x0 }; }
def({ id: 'aen_tangente', ch: 'aen', name: 'Tangentengleichung', lvl: 2, gen() {
  const c = rpoly(R.pick([2, 3]), -3, 3), x0 = R.int(-2, 3), { m, y0, b } = tangentData(c, x0);
  return {
    q: `Bestimme die Gleichung der Tangente an den Graphen von ${fx('f', poly(c))} an der Stelle x₀ = ${n(x0)}.`,
    type: 'tpl', tpl: 't: y = {}x + {}', answer: [m, b],
    hints: [`Die Tangente ist eine Gerade y = mx + b. Ihre Steigung ist m = f′(x₀), sie geht durch den Punkt (x₀ | f(x₀)).`, `f′(x) = ${poly(pd(c))} ⇒ m = ${n(m)}. Der Punkt ist (${n(x0)} | ${n(y0)}). Setz ihn in y = ${n(m)}x + b ein.`],
    steps: [`Berührpunkt: f(${n(x0)}) = ${n(y0)} ⇒ B(${n(x0)} | ${n(y0)})`, `Steigung: f′(x) = ${poly(pd(c))} ⇒ m = f′(${n(x0)}) = ${n(m)}`, `B einsetzen in y = ${n(m)}x + b: ${n(y0)} = ${n(m)}·${p(x0)} + b ⇒ b = ${n(b)}`, res(`t: y = ${poly([m, b])}`)],
  };
} });

def({ id: 'aen_normale', ch: 'aen', name: 'Normalengleichung', lvl: 3, gen() {
  let c, x0, t; do { c = rpoly(2, -3, 3); x0 = R.int(-2, 3); t = tangentData(c, x0); } while (t.m === 0);
  const mn = -1 / t.m, bn = t.y0 - mn * x0;
  return {
    q: `Bestimme die Gleichung der <b>Normalen</b> an den Graphen von ${fx('f', poly(c))} an der Stelle x₀ = ${n(x0)}.<br><small>Brüche wie 1/3 oder Dezimalzahlen (2 Stellen) sind erlaubt.</small>`,
    type: 'tpl', tpl: 'n: y = {}x + {}', answer: [mn, bn], tol: 0.011,
    hints: [`Die Normale steht senkrecht auf der Tangente. Für senkrechte Geraden gilt m<sub>t</sub> · m<sub>n</sub> = −1, also m<sub>n</sub> = −1 / f′(x₀).`, `f′(${n(x0)}) = ${n(t.m)} ⇒ m<sub>n</sub> = ${nq(mn)}. Punkt: (${n(x0)} | ${n(t.y0)}).`],
    steps: [`Punkt: f(${n(x0)}) = ${n(t.y0)}`, `Tangentensteigung: f′(${n(x0)}) = ${n(t.m)}`, `Normalensteigung: m<sub>n</sub> = −1 / ${p(t.m)} = ${nq(mn)}`, `Punkt einsetzen: ${n(t.y0)} = ${nq(mn)}·${p(x0)} + b ⇒ b = ${nq(bn)}`, res(`n: y = ${poly([mn, bn])}`)],
  };
} });

function cubicWithSlope(m) { // f′(x) − m = 3a(x − p)(x − q)
  let x1, x2; do { x1 = R.int(-3, 3); x2 = R.int(-3, 3); } while (x1 >= x2);
  let a = R.pick([1, -1]); if ((x1 + x2) % 2 !== 0) a *= 2;
  return { x1, x2, a, c: [a, -3 * a * (x1 + x2) / 2, 3 * a * x1 * x2 + m, R.int(-4, 4)] };
}
def({ id: 'aen_stelle', ch: 'aen', name: 'Stellen mit vorgegebener Steigung', lvl: 2, gen() {
  const m = R.int(-4, 4), C = cubicWithSlope(m), d1 = pd(C.c);
  return {
    q: `An welchen Stellen hat der Graph von ${fx('f', poly(C.c))} die Steigung ${n(m)}?`,
    type: 'tpl', tpl: 'x₁ = {} &nbsp; x₂ = {}', answer: [C.x1, C.x2], unordered: true, note: 'Reihenfolge egal.',
    hints: [`Steigung = Ableitung. Löse die Gleichung f′(x) = ${n(m)}.`, `f′(x) = ${poly(d1)}. Also ${poly(d1)} = ${n(m)} ⇒ ${poly(padd(d1, [-m]))} = 0.`],
    steps: [`f′(x) = ${poly(d1)}`, `f′(x) = ${n(m)} ⇒ ${poly(padd(d1, [-m]))} = 0`, `Durch ${p(d1[0])} teilen: ${poly([1, -(C.x1 + C.x2), C.x1 * C.x2])} = 0`, ...pqSteps(-(C.x1 + C.x2), C.x1 * C.x2, C.x1, C.x2), res(`x₁ = ${n(C.x1)}, x₂ = ${n(C.x2)}`)],
  };
} });

def({ id: 'aen_winkel', ch: 'aen', name: 'Schnittwinkel', lvl: 2, gen() {
  if (R.chance(0.5)) {
    let r1, r2; do { r1 = R.int(-4, 4); r2 = R.int(-4, 4); } while (r1 >= r2);
    const a = R.pick([1, -1, 0.5, 2, -0.5]), c = fromRoots(a, [r1, r2]), r = R.pick([r1, r2]), m = pv(pd(c), r), ang = deg(Math.atan(Math.abs(m)));
    return {
      q: `Der Graph von ${fx('f', poly(c))} schneidet die x-Achse bei x = ${n(r)}. Unter welchem Winkel?<br><small>In Grad, auf 1 Nachkommastelle.</small>`,
      type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: [`Der Schnittwinkel mit der x-Achse ist der Steigungswinkel α der Tangente: tan α = |f′(x₀)|.`, `f′(x) = ${poly(pd(c))} ⇒ f′(${n(r)}) = ${nq(m)}.`],
      steps: [`f′(x) = ${poly(pd(c))}, f′(${n(r)}) = ${nq(m)}`, `tan α = |${nq(m)}| ⇒ α = tan⁻¹(${nq(Math.abs(m))}) ≈ ${n(ang, 1)}°`, res(`α ≈ ${n(ang, 1)}°`)],
    };
  }
  const a = R.pick([1, 0.5, -1]), x0 = R.nz(-3, 3), m1 = 2 * a * x0;
  let m2; do { m2 = R.int(-3, 3); } while (m2 === m1);
  const y0 = a * x0 * x0, b = y0 - m2 * x0;
  const a1 = deg(Math.atan(m1)), a2 = deg(Math.atan(m2));
  let ang = Math.abs(a1 - a2); if (ang > 90) ang = 180 - ang;
  return {
    q: `Die Graphen von ${fx('f', poly([a, 0, 0]))} und ${fx('g', poly([m2, b]))} schneiden sich im Punkt S(${n(x0)} | ${nq(y0)}). Berechne den Schnittwinkel.<br><small>In Grad, auf 1 Nachkommastelle.</small>`,
    type: 'num', answer: ang, tol: 0.11, unit: '°',
    hints: [`Berechne für beide Graphen den Steigungswinkel im Schnittpunkt (tan α = Steigung). Der Schnittwinkel ist der Unterschied der beiden Winkel.`, `Steigungen in S: f′(${n(x0)}) = ${nq(m1)}, g hat die Steigung ${n(m2)}.`],
    steps: [`f′(x) = ${poly([2 * a, 0])} ⇒ m₁ = f′(${n(x0)}) = ${nq(m1)} ⇒ α₁ = tan⁻¹(${nq(m1)}) ≈ ${n(a1, 2)}°`, `m₂ = ${n(m2)} ⇒ α₂ = tan⁻¹(${n(m2)}) ≈ ${n(a2, 2)}°`, `|α₁ − α₂| ≈ ${n(Math.abs(a1 - a2), 2)}°${Math.abs(a1 - a2) > 90 ? ` > 90°, also 180° − ${n(Math.abs(a1 - a2), 2)}°` : ''}`, res(`Schnittwinkel ≈ ${n(ang, 1)}°`)],
  };
} });

def({ id: 'aen_sach', ch: 'aen', name: 'Änderungsrate im Sachzusammenhang', lvl: 2, gen() {
  if (R.chance(0.5)) {
    const N0 = R.pick([100, 200, 500, 50]), k = R.pick([0.1, 0.2, 0.3, 0.05]), t0 = R.pick([5, 10, 4, 8]);
    const v = N0 * k * E ** (k * t0);
    return {
      q: `Eine Bakterienkultur wächst nach N(t) = ${N0}·e<sup>${n(k)}t</sup> (t in Stunden, N = Anzahl der Bakterien in Tausend). Wie schnell wächst die Kultur zum Zeitpunkt t = ${t0}?<br><small>In Tausend pro Stunde, auf ganze Zahlen runden.</small>`,
      type: 'num', answer: v, tol: 0.51, unit: 'Tsd./h',
      hints: [`„Wie schnell“ zu einem Zeitpunkt = momentane Änderungsrate = Ableitung N′(t).`, `Kettenregel: N′(t) = ${N0}·${n(k)}·e<sup>${n(k)}t</sup> = ${n(N0 * k)}·e<sup>${n(k)}t</sup>. Jetzt t = ${t0} einsetzen.`],
      steps: [`Kettenregel: N′(t) = ${N0}·${n(k)}·e<sup>${n(k)}t</sup> = ${n(N0 * k)}·e<sup>${n(k)}t</sup>`, `N′(${t0}) = ${n(N0 * k)}·e<sup>${n(k * t0)}</sup> ≈ ${n(v)}`, res(`≈ ${Math.round(v)} Tausend Bakterien pro Stunde`)],
    };
  }
  const a = R.pick([-0.5, -1, -0.25]), b = R.pick([3, 4, 6]), base = R.pick([10, 20, 50]), t0 = R.int(1, 5);
  const c = [a, b, 0, base], v = pv(pd(c), t0);
  return {
    q: `Der Wasserstand eines Flusses wird nach einem Unwetter durch ${fx('h', poly(c)).replace(/x/g, 't')} beschrieben (t in Stunden, h in cm). Mit welcher Geschwindigkeit ändert sich der Wasserstand zum Zeitpunkt t = ${t0}?<br><small>In cm pro Stunde (negativ, wenn er fällt).</small>`,
    type: 'num', answer: v, tol: 0.011, unit: 'cm/h',
    hints: [`Gesucht ist die momentane Änderungsrate, also h′(${t0}).`, `h′(t) = ${poly(pd(c), 't')}.`],
    steps: [`h′(t) = ${poly(pd(c), 't')}`, `h′(${t0}) = ${n(v)}`, res(`Der Wasserstand ${v >= 0 ? 'steigt' : 'fällt'} um ${n(Math.abs(v))} cm pro Stunde.`)],
  };
} });

// =====================================================================
// Kapitel 4: Kurvendiskussion
// =====================================================================
function cubicCrit() { // f′(x) = 3a(x − p)(x − q), ganzzahlige Koeffizienten
  let x1, x2; do { x1 = R.int(-3, 3); x2 = R.int(-3, 3); } while (x1 >= x2 || x2 - x1 > 4);
  let a = R.pick([1, -1, 1, -1, 2, -2]);
  if ((x1 + x2) % 2 !== 0 && a % 2 !== 0) a *= 2;
  const c = [a, -3 * a * (x1 + x2) / 2, 3 * a * x1 * x2, R.int(-4, 4)];
  const hx = a > 0 ? x1 : x2, tx = a > 0 ? x2 : x1;
  return { a, x1, x2, c, d1: pd(c), d2: pd(pd(c)), hx, tx };
}
function critSteps(C) {
  const { a, x1, x2, c, d1, d2 } = C;
  const kind = x => pv(d2, x) < 0 ? '< 0 ⇒ <b>Hochpunkt</b>' : '> 0 ⇒ <b>Tiefpunkt</b>';
  return [
    `Ableitungen: f′(x) = ${poly(d1)}, f″(x) = ${poly(d2)}`,
    `Notwendige Bedingung f′(x) = 0: ${poly(d1)} = 0 | : ${p(3 * a)} ⇒ ${poly([1, -(x1 + x2), x1 * x2])} = 0`,
    `pq-Formel (oder Satz von Vieta) ⇒ x₁ = ${n(x1)}, x₂ = ${n(x2)}`,
    `Hinreichende Bedingung mit f″: f″(${n(x1)}) = ${n(pv(d2, x1))} ${kind(x1)}; f″(${n(x2)}) = ${n(pv(d2, x2))} ${kind(x2)}`,
    `y-Werte: f(${n(x1)}) = ${nq(pv(c, x1))}, f(${n(x2)}) = ${nq(pv(c, x2))}`,
  ];
}
def({ id: 'kur_extrem', ch: 'kur', name: 'Hoch- oder Tiefpunkt bestimmen', lvl: 2, gen() {
  const C = cubicCrit(), hoch = R.chance(0.5), x = hoch ? C.hx : C.tx, y = pv(C.c, x), nm = hoch ? 'H' : 'T';
  return {
    q: `Bestimme den <b>${hoch ? 'Hochpunkt' : 'Tiefpunkt'}</b> des Graphen von ${fx('f', poly(C.c))}.`,
    type: 'tpl', tpl: `${nm}( {} | {} )`, answer: [x, y],
    hints: [`Notwendige Bedingung: f′(x) = 0. Hinreichend: f″(x) < 0 ⇒ Hochpunkt, f″(x) > 0 ⇒ Tiefpunkt.`, `f′(x) = ${poly(C.d1)} = 0 hat die Lösungen ${n(C.x1)} und ${n(C.x2)}. Prüfe beide mit f″(x) = ${poly(C.d2)}.`],
    steps: [...critSteps(C), res(`${nm}(${n(x)} | ${nq(y)})`)],
  };
} });

def({ id: 'kur_wende', ch: 'kur', name: 'Wendepunkt bestimmen', lvl: 2, gen() {
  const a = R.pick([1, -1, 2, -2]), xw = R.int(-3, 3), c = [a, -3 * a * xw, R.int(-6, 6), R.int(-5, 5)];
  const d1 = pd(c), d2 = pd(d1), y = pv(c, xw);
  return {
    q: `Bestimme den Wendepunkt des Graphen von ${fx('f', poly(c))}.`,
    type: 'tpl', tpl: 'W( {} | {} )', answer: [xw, y],
    hints: [`Notwendige Bedingung für Wendestellen: f″(x) = 0. Hinreichend: f‴(x) ≠ 0.`, `f″(x) = ${poly(d2)} = 0.`],
    steps: [`f′(x) = ${poly(d1)}, f″(x) = ${poly(d2)}, f‴(x) = ${n(6 * a)}`, `f″(x) = 0: ${poly(d2)} = 0 ⇒ x = ${n(xw)}`, `f‴(${n(xw)}) = ${n(6 * a)} ≠ 0 ⇒ Wendestelle ✓`, `f(${n(xw)}) = ${n(y)}`, res(`W(${n(xw)} | ${n(y)})`)],
  };
} });

def({ id: 'kur_wendetangente', ch: 'kur', name: 'Wendetangente', lvl: 3, gen() {
  const a = R.pick([1, -1, 2, -2]), xw = R.int(-2, 2), c = [a, -3 * a * xw, R.int(-5, 5), R.int(-5, 5)];
  const d1 = pd(c), d2 = pd(d1), y = pv(c, xw), m = pv(d1, xw), b = y - m * xw;
  return {
    q: `Bestimme die Gleichung der Tangente im Wendepunkt (Wendetangente) des Graphen von ${fx('f', poly(c))}.`,
    type: 'tpl', tpl: 'y = {}x + {}', answer: [m, b],
    hints: [`Zwei Schritte: 1) Wendepunkt über f″(x) = 0 bestimmen. 2) Tangente in diesem Punkt mit m = f′(x<sub>W</sub>).`, `f″(x) = ${poly(d2)} ⇒ x<sub>W</sub> = ${n(xw)}, W(${n(xw)} | ${n(y)}). f′(${n(xw)}) = ${n(m)}.`],
    steps: [`f″(x) = ${poly(d2)} = 0 ⇒ x<sub>W</sub> = ${n(xw)}; f‴ = ${n(6 * a)} ≠ 0`, `W(${n(xw)} | ${n(y)})`, `m = f′(${n(xw)}) = ${n(m)} (f′(x) = ${poly(d1)})`, `${n(y)} = ${n(m)}·${p(xw)} + b ⇒ b = ${n(b)}`, res(`y = ${poly([m, b])}`)],
  };
} });

def({ id: 'kur_monotonie', ch: 'kur', name: 'Monotonie', lvl: 2, gen() {
  const C = cubicCrit(), steig = R.chance(0.5);
  const outer = `]−∞; ${n(C.x1)}] und [${n(C.x2)}; ∞[`, inner = `[${n(C.x1)}; ${n(C.x2)}]`;
  const correct = (C.a > 0) === steig ? outer : inner;
  return Object.assign(mc(correct, [outer, inner, `]−∞; ${n(C.x2)}]`, `[${n(C.x1)}; ∞[`].filter(x => x !== correct)), {
    q: `Auf welchen Intervallen ist ${fx('f', poly(C.c))} monoton <b>${steig ? 'steigend' : 'fallend'}</b>?`,
    hints: [`f steigt, wo f′(x) ≥ 0, und fällt, wo f′(x) ≤ 0. Bestimme zuerst die Nullstellen von f′.`, `f′(x) = ${poly(C.d1)} = ${n(3 * C.a)}·(x ${pm(-C.x1)})(x ${pm(-C.x2)}). Teste einen x-Wert zwischen ${n(C.x1)} und ${n(C.x2)}.`],
    steps: [`f′(x) = ${poly(C.d1)} hat die Nullstellen ${n(C.x1)} und ${n(C.x2)}.`, `f′ ist eine nach ${C.a > 0 ? 'oben' : 'unten'} geöffnete Parabel ⇒ zwischen den Nullstellen ist f′ ${C.a > 0 ? 'negativ' : 'positiv'}, außerhalb ${C.a > 0 ? 'positiv' : 'negativ'}.`, `Test: f′(${nq((C.x1 + C.x2) / 2)}) = ${nq(pv(C.d1, (C.x1 + C.x2) / 2))}`, res(`f ist monoton ${steig ? 'steigend' : 'fallend'} auf ${correct}.`)],
  });
} });

def({ id: 'kur_art', ch: 'kur', name: 'Hoch-, Tief- oder Sattelpunkt?', lvl: 2, gen() {
  const v = R.pick([0, 0, 1, 2]), opts = ['Hochpunkt', 'Tiefpunkt', 'Sattelpunkt'];
  let c, x0, ans, steps;
  if (v === 0) {
    const C = cubicCrit(); x0 = R.pick([C.x1, C.x2]); c = C.c;
    const f2 = pv(C.d2, x0); ans = f2 < 0 ? 0 : 1;
    steps = [`f′(x) = ${poly(C.d1)}, f″(x) = ${poly(C.d2)}`, `f′(${n(x0)}) = 0 ✓, f″(${n(x0)}) = ${n(f2)} ${f2 < 0 ? '< 0 ⇒ rechtsgekrümmt ⇒ Hochpunkt' : '> 0 ⇒ linksgekrümmt ⇒ Tiefpunkt'}`];
  } else {
    const s = R.pick([-2, -1, 1, 2]), a = R.pick([1, -1]), d = R.int(-4, 4), e = v === 1 ? 3 : 4;
    x0 = s; c = padd(fromRoots(a, Array(e).fill(s)), [d]);
    const d1 = pd(c);
    if (v === 1) { ans = 2; steps = [`f′(x) = ${poly(d1)} = ${n(3 * a)}(x ${pm(-s)})²`, `f″(${n(s)}) = 0 – das f″-Kriterium hilft hier <b>nicht</b>. Prüfe den Vorzeichenwechsel von f′.`, `(x ${pm(-s)})² ≥ 0 ⇒ f′ hat links und rechts von ${n(s)} dasselbe Vorzeichen ⇒ kein Vorzeichenwechsel ⇒ Sattelpunkt.`]; }
    else { ans = a > 0 ? 1 : 0; steps = [`f′(x) = ${poly(d1)} = ${n(4 * a)}(x ${pm(-s)})³`, `f″(${n(s)}) = 0 – das f″-Kriterium hilft hier <b>nicht</b>. Prüfe den Vorzeichenwechsel von f′.`, `(x ${pm(-s)})³ wechselt bei ${n(s)} das Vorzeichen von − nach +; mal ${n(4 * a)} ⇒ f′ wechselt von ${a > 0 ? '− nach + ⇒ Tiefpunkt' : '+ nach − ⇒ Hochpunkt'}.`, `Achtung: f″ = 0 heißt also <b>nicht</b> automatisch Sattel- oder Wendepunkt!`]; }
  }
  return {
    q: `Für ${fx('f', poly(c))} gilt f′(${n(x0)}) = 0. Welche Art von Punkt hat der Graph an der Stelle x = ${n(x0)}?`,
    type: 'choice', options: opts, answer: ans,
    hints: [`Berechne f″(${n(x0)}). f″ < 0 → Hochpunkt, f″ > 0 → Tiefpunkt.`, `Ist f″(${n(x0)}) = 0, entscheidet der <b>Vorzeichenwechsel von f′</b>: + nach − → Hochpunkt, − nach + → Tiefpunkt, keiner → Sattelpunkt.`],
    steps: [...steps, res(opts[ans])],
  };
} });

def({ id: 'kur_eext', ch: 'kur', name: 'Extrempunkt einer e-Funktion', lvl: 3, gen() {
  const a = R.int(-2, 3), neg = R.chance(0.5);
  const x = neg ? a + 1 : a - 1, y = neg ? E ** -(a + 1) : -(E ** (a - 1)), nm = neg ? 'H' : 'T';
  const f = `(${poly([1, -a])}) · ${neg ? ex(-1) : 'eˣ'}`;
  const d1 = neg ? `(${poly([-1, a + 1])})·${ex(-1)}` : `(${poly([1, 1 - a])})·eˣ`;
  return {
    q: `Bestimme den Extrempunkt des Graphen von ${fx('f', f)} und gib an, ob es ein Hoch- oder Tiefpunkt ist.<br><small>y-Wert auf 2 Nachkommastellen.</small>`,
    type: 'tpl', tpl: `${nm}( {} | {} )`, answer: [x, y], tol: 0.011,
    note: `Tipp: Es ist ein ${neg ? 'Hochpunkt' : 'Tiefpunkt'} – rechne nach, warum.`,
    hints: [`Produktregel: u = ${poly([1, -a])}, v = ${neg ? ex(-1) : 'eˣ'}. Dann die e-Potenz ausklammern und den Satz vom Nullprodukt nutzen.`, `f′(x) = ${d1}. Die e-Potenz ist nie 0.`],
    steps: [`u = ${poly([1, -a])}, u′ = 1; v = ${neg ? ex(-1) : 'eˣ'}, v′ = ${neg ? '−' + ex(-1) : 'eˣ'}`, `f′(x) = ${neg ? ex(-1) + ' − (' + poly([1, -a]) + ')·' + ex(-1) : 'eˣ + (' + poly([1, -a]) + ')·eˣ'} = ${d1}`, `f′(x) = 0 ⇔ ${poly(neg ? [-1, a + 1] : [1, 1 - a])} = 0 ⇒ x = ${n(x)}`, `f″(x) = ${neg ? `(${poly([1, -a - 2])})·${ex(-1)}` : `(${poly([1, 2 - a])})·eˣ`} ⇒ f″(${n(x)}) = ${neg ? '−' : ''}e<sup>${n(neg ? -x : x)}</sup> ${neg ? '< 0 ⇒ Hochpunkt' : '> 0 ⇒ Tiefpunkt'}`, `y = f(${n(x)}) = ${neg ? '1' : '(−1)'}·e<sup>${n(neg ? -x : x)}</sup> ≈ ${n(y, 4)}`, res(`${nm}(${n(x)} | ${n(y)})`)],
  };
} });

def({ id: 'kur_rand', ch: 'kur', name: 'Randextrema auf einem Intervall', lvl: 3, gen() {
  const C = cubicCrit(), l = C.x1 - R.int(1, 2), r = C.x2 + R.int(1, 2), wantMax = R.chance(0.5);
  const xs = [l, C.x1, C.x2, r], ys = xs.map(x => pv(C.c, x));
  const best = wantMax ? Math.max(...ys) : Math.min(...ys), at = xs[ys.indexOf(best)];
  return {
    q: `Bestimme den <b>${wantMax ? 'größten' : 'kleinsten'}</b> Funktionswert von ${fx('f', poly(C.c))} auf dem Intervall [${n(l)}; ${n(r)}].`,
    type: 'num', answer: best,
    hints: [`Der größte/kleinste Wert liegt entweder an einer Extremstelle im Inneren <b>oder am Rand</b> des Intervalls. Berechne alle Kandidaten.`, `Kandidaten: x = ${n(l)} (Rand), x = ${n(C.x1)}, x = ${n(C.x2)} (f′ = 0), x = ${n(r)} (Rand).`],
    steps: [`f′(x) = ${poly(C.d1)} = 0 ⇒ x = ${n(C.x1)} oder x = ${n(C.x2)} (beide im Intervall)`, `Funktionswerte: ${xs.map((x, i) => `f(${n(x)}) = ${n(ys[i])}`).join(', ')}`, `Der ${wantMax ? 'größte' : 'kleinste'} Wert ist ${n(best)} bei x = ${n(at)}${at === l || at === r ? ' – ein <b>Randextremum</b>!' : '.'}`, res(`${wantMax ? 'Maximum' : 'Minimum'}: ${n(best)}`)],
  };
} });

// =====================================================================
// Kapitel 5: Modellieren
// =====================================================================
const ABC = ['a', 'b', 'c'];
def({ id: 'mod_lgs', ch: 'mod', name: 'LGS mit 3 Unbekannten (Gauß)', lvl: 2, gen() {
  let A; do { A = [0, 1, 2].map(() => [R.int(-3, 3), R.int(-3, 3), R.int(-3, 3)]); } while (det3(A) === 0 || A[0][0] === 0);
  const x = [R.int(-4, 4), R.int(-4, 4), R.int(-4, 4)], b = A.map(r => r[0] * x[0] + r[1] * x[1] + r[2] * x[2]);
  const G = gaussSteps(A.map((r, i) => [...r, b[i]]), ABC);
  return {
    q: `Löse das LGS mit dem Gauß-Verfahren:${lgsText(A, b, ABC)}`,
    type: 'tpl', tpl: 'a = {} &nbsp; b = {} &nbsp; c = {}', answer: x,
    hints: [`Mit Zeile I das a in II und III eliminieren, dann mit der neuen II das b in III. Danach von unten nach oben einsetzen.`, `Start: II → ${p(A[0][0])}·II − ${p(A[1][0])}·I und III → ${p(A[0][0])}·III − ${p(A[2][0])}·I.`],
    steps: [...G.steps, res(`a = ${n(x[0])}, b = ${n(x[1])}, c = ${n(x[2])}`)],
  };
} });

def({ id: 'mod_loesbar', ch: 'mod', name: 'Lösbarkeit eines LGS', lvl: 2, gen() {
  const kind = R.int(0, 2), u = R.nz(-4, 4), v = R.nz(-3, 3), w = R.nz(-5, 5);
  const last = kind === 0 ? [0, 0, R.nz(-3, 3), R.int(-6, 6)] : kind === 1 ? [0, 0, 0, R.nz(-5, 5)] : [0, 0, 0, 0];
  const M = [[R.nz(-3, 3), R.int(-3, 3), R.int(-3, 3), u], [0, R.nz(-3, 3), R.int(-3, 3), v], last];
  if (kind === 0) M[2][3] = w;
  const opts = ['genau eine Lösung', 'keine Lösung', 'unendlich viele Lösungen'];
  return {
    q: `Ein LGS wurde mit dem Gauß-Verfahren auf diese Stufenform gebracht:${lgsText(M.map(r => r.slice(0, 3)), M.map(r => r[3]), ABC)}Wie viele Lösungen hat es?`,
    type: 'choice', options: opts, answer: kind,
    hints: [`Entscheidend ist die letzte Zeile.`, `„0 = Zahl ≠ 0“ ist ein Widerspruch → keine Lösung. „0 = 0“ ist immer wahr → eine Variable ist frei wählbar → unendlich viele. Sonst → genau eine.`],
    steps: [`Letzte Zeile: ${lin(M[2].slice(0, 3))} = ${n(M[2][3])}`, kind === 0 ? 'Hier lässt sich c eindeutig berechnen, dann b, dann a.' : kind === 1 ? `0 = ${n(M[2][3])} ist falsch – ein Widerspruch.` : '0 = 0 ist immer wahr; c bleibt frei wählbar (z. B. c = t).', res(`Das LGS hat ${opts[kind]}.`)],
  };
  function lin(r) { return r.every(x => x === 0) ? '0' : K.lin(r, ABC); }
} });

def({ id: 'mod_steck2', ch: 'mod', name: 'Parabel durch drei Punkte', lvl: 2, gen() {
  const xs = R.shuffle([-3, -2, -1, 0, 1, 2, 3]).slice(0, 3).sort((a, b) => a - b);
  const co = [R.nz(-3, 3), R.int(-4, 4), R.int(-5, 5)], ys = xs.map(x => pv(co, x));
  const A = xs.map(x => [x * x, x, 1]);
  const G = gaussSteps(A.map((r, i) => [...r, ys[i]]), ABC);
  return {
    q: `Der Graph einer quadratischen Funktion f(x) = ax² + bx + c geht durch die Punkte ${xs.map((x, i) => `(${n(x)} | ${n(ys[i])})`).join(', ')}. Bestimme a, b und c.`,
    type: 'tpl', tpl: 'a = {} &nbsp; b = {} &nbsp; c = {}', answer: co,
    hints: [`Jeder Punkt liefert eine Gleichung: Setze x und y in y = ax² + bx + c ein. Das gibt ein LGS mit 3 Gleichungen.`, `Die Gleichungen lauten:${lgsText(A, ys, ABC)}`],
    steps: [`Punkte einsetzen:${lgsText(A, ys, ABC)}`, ...G.steps, res(fx('f', poly(co)))],
  };
} });

def({ id: 'mod_steck3', ch: 'mod', name: 'Steckbriefaufgabe 3. Grades', lvl: 3, gen() {
  if (R.chance(0.5)) {
    const a = R.pick([1, -1, 2, -2]), x0 = R.pick([1, 2, -1, -2]), c = -3 * a * x0 * x0, y0 = -2 * a * x0 ** 3;
    const hoch = 6 * a * x0 < 0;
    return {
      q: `Der Graph einer ganzrationalen Funktion 3. Grades ist <b>punktsymmetrisch zum Ursprung</b> und hat den ${hoch ? 'Hochpunkt' : 'Tiefpunkt'} (${n(x0)} | ${n(y0)}). Bestimme f(x) = ax³ + cx.`,
      type: 'tpl', tpl: 'a = {} &nbsp; c = {}', answer: [a, c],
      hints: [`Punktsymmetrie ⇒ nur ungerade Potenzen: f(x) = ax³ + cx, f′(x) = 3ax² + c. Zwei Bedingungen: f(${n(x0)}) = ${n(y0)} und f′(${n(x0)}) = 0.`, `Gleichungen: I: ${lin2(x0 ** 3, x0)} = ${n(y0)}; II: ${lin2(3 * x0 * x0, 1)} = 0.`],
      steps: [`f(x) = ax³ + cx, f′(x) = 3ax² + c`, `Punkt: f(${n(x0)}) = ${n(y0)} ⇒ I: ${lin2(x0 ** 3, x0)} = ${n(y0)}`, `Extremstelle: f′(${n(x0)}) = 0 ⇒ II: ${lin2(3 * x0 * x0, 1)} = 0 ⇒ c = ${n(-3 * x0 * x0)}a`, `In I einsetzen: ${n(x0 ** 3)}a ${pm(x0 * -3 * x0 * x0)}a = ${n(y0)} ⇒ ${n(-2 * x0 ** 3)}a = ${n(y0)} ⇒ a = ${n(a)}`, `c = ${n(-3 * x0 * x0)}·${p(a)} = ${n(c)}`, res(fx('f', poly([a, 0, c, 0])))],
    };
  }
  const a = R.pick([1, -1, 2, -2]), xw = R.pick([1, 2, -1]), m = R.nz(-4, 4), b = -3 * a * xw, yw = a * xw ** 3 + b * xw * xw + m * xw;
  return {
    q: `Der Graph einer Funktion f(x) = ax³ + bx² + cx geht durch den Ursprung und hat dort die Steigung ${n(m)}. Sein Wendepunkt ist W(${n(xw)} | ${n(yw)}). Bestimme a, b und c.`,
    type: 'tpl', tpl: 'a = {} &nbsp; b = {} &nbsp; c = {}', answer: [a, b, m],
    hints: [`Übersetze jede Info in eine Gleichung: f′(0) = ${n(m)}, f(${n(xw)}) = ${n(yw)}, f″(${n(xw)}) = 0.`, `f′(0) = c ⇒ c = ${n(m)}. f″(x) = 6ax + 2b ⇒ ${n(6 * xw)}a + 2b = 0.`],
    steps: [`f′(x) = 3ax² + 2bx + c, f″(x) = 6ax + 2b`, `Steigung im Ursprung: f′(0) = c = ${n(m)}`, `Wendestelle: f″(${n(xw)}) = 0 ⇒ ${n(6 * xw)}a + 2b = 0 ⇒ b = ${n(-3 * xw)}a`, `Punkt W: ${n(xw ** 3)}a + ${p(xw * xw)}b + ${p(m * xw)} = ${n(yw)} ⇒ mit b = ${n(-3 * xw)}a: ${n(-2 * xw ** 3)}a = ${n(yw - m * xw)} ⇒ a = ${n(a)}`, `b = ${n(-3 * xw)}·${p(a)} = ${n(b)}`, res(fx('f', poly([a, b, m, 0])))],
  };
  function lin2(ka, kc) { return K.lin([ka, kc], ['a', 'c']); }
} });

def({ id: 'mod_rechteck', ch: 'mod', name: 'Extremalproblem: größtes Rechteck', lvl: 2, gen() {
  if (R.chance(0.5)) {
    const u = R.int(1, 4), c = 3 * u * u, A = 4 * c * u / 3;
    return {
      q: `Unter dem Graphen von ${fx('f', `${c} − x²`)} soll ein Rechteck liegen: zwei Ecken auf der x-Achse bei −u und u, zwei Ecken auf dem Graphen. Für welches u ist der Flächeninhalt maximal, und wie groß ist er?`,
      type: 'tpl', tpl: 'u = {} &nbsp; A<sub>max</sub> = {}', answer: [u, A],
      hints: [`Breite = 2u, Höhe = f(u) = ${c} − u². Also A(u) = 2u·(${c} − u²). Ableiten und A′(u) = 0 setzen.`, `A(u) = ${poly([-2, 0, 2 * c, 0], 'u')} ⇒ A′(u) = ${poly([-6, 0, 2 * c], 'u')}.`],
      steps: [`Zielfunktion: A(u) = 2u·(${c} − u²) = ${poly([-2, 0, 2 * c, 0], 'u')}, mit 0 < u < ${n(Math.sqrt(c), 2)}`, `A′(u) = ${poly([-6, 0, 2 * c], 'u')} = 0 ⇒ u² = ${c / 3} ⇒ u = ${u} (u > 0)`, `A″(u) = −12u < 0 ⇒ Maximum ✓`, `A(${u}) = 2·${u}·(${c} − ${u * u}) = ${A}`, res(`u = ${u}, A<sub>max</sub> = ${A}`)],
    };
  }
  const Lz = R.pick([40, 60, 80, 100, 120]), x = Lz / 4, A = Lz * Lz / 8;
  return {
    q: `Mit ${Lz} m Zaun soll an einer langen Mauer eine rechteckige Weide eingezäunt werden (an der Mauer braucht man keinen Zaun). Wie lang müssen die beiden Seiten senkrecht zur Mauer sein (x), damit die Fläche maximal wird, und wie groß ist sie?`,
    type: 'tpl', tpl: 'x = {} m &nbsp; A<sub>max</sub> = {} m²', answer: [x, A],
    hints: [`Zwei Seiten der Länge x (senkrecht zur Mauer) und eine Seite parallel zur Mauer: ${Lz} − 2x. Also A(x) = x·(${Lz} − 2x).`, `A(x) = ${poly([-2, Lz, 0])} ⇒ A′(x) = ${poly([-4, Lz])} = 0.`],
    steps: [`Nebenbedingung: 2x + y = ${Lz} ⇒ y = ${Lz} − 2x`, `Zielfunktion: A(x) = x·(${Lz} − 2x) = ${poly([-2, Lz, 0])}`, `A′(x) = ${poly([-4, Lz])} = 0 ⇒ x = ${x}; A″ = −4 < 0 ⇒ Maximum`, `y = ${Lz} − ${2 * x} = ${Lz - 2 * x}, A = ${x}·${Lz - 2 * x} = ${A}`, res(`x = ${x} m, A<sub>max</sub> = ${A} m²`)],
  };
} });

def({ id: 'mod_schachtel', ch: 'mod', name: 'Extremalproblem: Schachtel', lvl: 3, gen() {
  const a = R.pick([12, 18, 24, 30, 36]), x = a / 6, V = 2 * a ** 3 / 27;
  return {
    q: `Aus einem quadratischen Karton (Seitenlänge ${a} cm) wird an jeder Ecke ein Quadrat der Seitenlänge x ausgeschnitten. Die Ränder werden zu einer offenen Schachtel hochgeklappt. Für welches x ist das Volumen maximal, und wie groß ist es?`,
    type: 'tpl', tpl: 'x = {} cm &nbsp; V<sub>max</sub> = {} cm³', answer: [x, V],
    hints: [`Die Grundfläche ist ein Quadrat mit Seite ${a} − 2x, die Höhe ist x. Also V(x) = x·(${a} − 2x)².`, `Ausmultipliziert: V(x) = ${poly([4, -4 * a, a * a, 0])}. V′(x) = ${poly([12, -8 * a, a * a])} = 0.`],
    steps: [`V(x) = x·(${a} − 2x)² = ${poly([4, -4 * a, a * a, 0])}, sinnvoll für 0 < x < ${a / 2}`, `V′(x) = ${poly([12, -8 * a, a * a])} = 0 | : 12 ⇒ ${poly([1, -8 * a / 12, a * a / 12])} = 0`, `pq-Formel ⇒ x = ${a / 2} (Volumen 0, entfällt) oder x = ${x}`, `V″(x) = ${poly([24, -8 * a])} ⇒ V″(${x}) = ${24 * x - 8 * a} < 0 ⇒ Maximum`, `V(${x}) = ${x}·(${a} − ${2 * x})² = ${x}·${(a - 2 * x) ** 2} = ${V}`, res(`x = ${x} cm, V<sub>max</sub> = ${V} cm³`)],
  };
} });

// =====================================================================
// Kapitel 6: Integrieren
// =====================================================================
function intSteps(c) {
  const d = c.length - 1, out = [];
  c.forEach((k, i) => { const e = d - i; if (!k) return; out.push(`${poly([k, ...Array(e).fill(0)])} → ${nq(k)}·${fracOver('x' + (e + 1 > 1 ? sup(e + 1) : ''), e + 1)} = ${poly([k / (e + 1), ...Array(e + 1).fill(0)])}`); });
  return `Potenzregel rückwärts (x<sup>n</sup> → x<sup>n+1</sup>/(n+1)) für jeden Summanden:<ul class="calc">${out.map(o => `<li>${o}</li>`).join('')}</ul>`;
}
def({ id: 'int_stamm_poly', ch: 'int', name: 'Stammfunktion (ganzrational)', lvl: 1, gen() {
  const c = [R.nz(-4, 4) * R.pick([1, 4]), R.int(-6, 6), R.int(-6, 6), R.int(-6, 6)], F = pint(c);
  return {
    q: `Bestimme eine Stammfunktion F von ${fx('f', poly(c))}.`,
    type: 'tpl', tpl: tplPoly('F(x)', 4, 'x', 1), answer: F.slice(0, 4), tol: 0.006, note: `${ZERO_NOTE} Die Konstante C lassen wir weg (C = 0).`,
    hints: [`Integrieren ist Ableiten rückwärts: x<sup>n</sup> → x<sup>n+1</sup>/(n+1). Der Exponent wird um 1 größer, und du teilst durch den neuen Exponenten.`, `${poly([c[0], 0, 0, 0])} → ${poly([F[0], 0, 0, 0, 0])}. Eine Zahl ohne x bekommt ein x dazu.`],
    steps: [intSteps(c), res(`F(x) = ${poly(F)} (+ C)`), 'Probe: F′(x) muss wieder f(x) ergeben.'],
    _f: x => pv(c, x), _F: (ans => x => pv([...ans, 0], x)),
  };
} });

def({ id: 'int_stamm_e', ch: 'int', name: 'Stammfunktion (lineare Verkettung)', lvl: 2, gen() {
  if (R.chance(0.6)) {
    const a = R.pick([2, 3, 4, 6, -2, 1]), k = R.pick([2, -1, 3, 0.5, -2, 4]), b = R.pick([0, 1, -1, 2]);
    return {
      q: `Bestimme eine Stammfunktion F von ${fx('f', `${cf(a)}${ex(k, b)}`)}.`,
      type: 'tpl', tpl: `F(x) = {} · ${ex(k, b)}`, answer: [a / k], tol: 0.006, note: 'Brüche wie 1/3 sind erlaubt.',
      hints: [`Lineare Substitution: Die e-Funktion bleibt, aber du musst durch die innere Ableitung ${nq(k)} <b>teilen</b>.`, `F(x) = ${n(a)} · ${fracOver(1, nq(k))} · ${ex(k, b)}. Probe: Ableiten muss f ergeben.`],
      steps: [`Innere Funktion ${poly([k, b])}, innere Ableitung ${nq(k)}`, `Beim Integrieren durch die innere Ableitung teilen: F(x) = ${n(a)} / ${pq(k)} · ${ex(k, b)} = ${cf(a / k)}${ex(k, b)}`, `Probe: F′(x) = ${nq(a / k)}·${pq(k)}·${ex(k, b)} = ${n(a)}·${ex(k, b)} ✓`, res(`F(x) = ${cf(a / k)}${ex(k, b)}`)],
      _f: x => a * E ** (k * x + b), _F: (ans => x => ans[0] * E ** (k * x + b)),
    };
  }
  const a = R.pick([2, 3, 4, 6, 1]), k = R.pick([2, 3, -1, 4]), b = R.nz(-3, 3), inner = `(${poly([k, b])})`;
  return {
    q: `Bestimme eine Stammfunktion F von ${fx('f', fracOver(a, inner + '²'))}.`,
    type: 'tpl', tpl: `F(x) = {} · ${inner}<sup>−1</sup>`, answer: [-a / k], tol: 0.006, note: 'Brüche wie 1/3 sind erlaubt.',
    hints: [`Schreibe f(x) = ${n(a)}·${inner}<sup>−2</sup>. Potenzregel rückwärts: Exponent −2 → −1, durch −1 teilen – und durch die innere Ableitung ${n(k)}.`, `F(x) = ${n(a)} · ${fracOver(1, '(−1)·' + p(k))} · ${inner}<sup>−1</sup>`],
    steps: [`f(x) = ${n(a)}·${inner}<sup>−2</sup>`, `Exponent um 1 erhöhen: −2 → −1; durch −1 und durch die innere Ableitung ${n(k)} teilen.`, `F(x) = ${n(a)} / ((−1)·${p(k)}) · ${inner}<sup>−1</sup> = ${nq(-a / k)}·${inner}<sup>−1</sup>`, res(`F(x) = ${nq(-a / k)}·${inner}<sup>−1</sup>`)],
    _f: x => a / (k * x + b) ** 2, _F: (ans => x => ans[0] / (k * x + b)),
  };
} });

def({ id: 'int_stamm_potenz', ch: 'int', name: 'Stammfunktion von a/xⁿ', lvl: 2, gen() {
  const k = R.int(2, 4), a = R.pick([2, 3, 4, 6, 8, -2, -6]);
  return {
    q: `Bestimme eine Stammfunktion F von ${fx('f', (a < 0 ? '−' : '') + fracOver(Math.abs(a), pw('x', k)))}.`,
    type: 'tpl', tpl: 'F(x) = {} · xⁿ &nbsp; mit n = {}', answer: [a / (1 - k), 1 - k], tol: 0.006, note: 'Brüche wie 1/3 sind erlaubt.',
    hints: [`Umschreiben: f(x) = ${n(a)}·x<sup>−${k}</sup>. Potenzregel rückwärts: Exponent + 1, durch den neuen Exponenten teilen.`, `Neuer Exponent: −${k} + 1 = ${1 - k}. Also F(x) = ${n(a)} / (${1 - k}) · x<sup>${1 - k}</sup>.`],
    steps: [`f(x) = ${n(a)}·x<sup>−${k}</sup>`, `F(x) = ${n(a)} · x<sup>${1 - k}</sup> / (${1 - k}) = ${nq(a / (1 - k))}·x<sup>${1 - k}</sup>`, `Probe: F′(x) = ${nq(a / (1 - k))}·(${1 - k})·x<sup>−${k}</sup> = ${n(a)}·x<sup>−${k}</sup> ✓`, res(`F(x) = ${nq(a / (1 - k))}·x<sup>${1 - k}</sup>`)],
    _f: x => a / x ** k, _F: (ans => x => ans[0] * x ** ans[1]),
  };
} });

def({ id: 'int_bestimmt', ch: 'int', name: 'Bestimmtes Integral', lvl: 1, gen() {
  const c = rpoly(R.pick([2, 3]), -4, 4), a = R.int(-2, 1), b = a + R.int(1, 3), F = pint(c), v = pv(F, b) - pv(F, a);
  return {
    q: `Berechne ∫<sub>${n(a)}</sub><sup>${n(b)}</sup> (${poly(c)}) dx.<br><small>Brüche oder 2 Nachkommastellen.</small>`,
    type: 'num', answer: v, tol: 0.011,
    hints: [`Hauptsatz: ∫<sub>a</sub><sup>b</sup> f(x) dx = F(b) − F(a). Erst eine Stammfunktion F bilden.`, `F(x) = ${poly(F)}. Jetzt F(${n(b)}) − F(${n(a)}) rechnen.`],
    steps: [`Stammfunktion: F(x) = ${poly(F)}`, `F(${n(b)}) = ${nq(pv(F, b))}, F(${n(a)}) = ${nq(pv(F, a))}`, `∫ = F(${n(b)}) − F(${n(a)}) = ${nq(pv(F, b))} − ${pq(pv(F, a))} = ${nq(v)}`, res(`${nq(v)}${Number.isInteger(v) ? '' : ' ≈ ' + n(v)}`)],
  };
} });

def({ id: 'int_best_e', ch: 'int', name: 'Integral einer e-Funktion', lvl: 2, gen() {
  const a = R.pick([1, 2, 3, 4]), k = R.pick([1, -1, 2, 0.5, -0.5]), u = R.pick([1, 2, 3]), v = a / k * (E ** (k * u) - 1);
  return {
    q: `Berechne ∫<sub>0</sub><sup>${u}</sup> ${cf(a)}${ex(k)} dx.<br><small>Auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: v, tol: 0.011,
    hints: [`Stammfunktion mit linearer Substitution: F(x) = ${n(a)}/${pq(k)} · ${ex(k)}.`, `F(x) = ${cf(a / k)}${ex(k)}. Rechne F(${u}) − F(0); beachte e⁰ = 1.`],
    steps: [`F(x) = ${cf(a / k)}${ex(k)}`, `F(${u}) = ${nq(a / k)}·e<sup>${n(k * u)}</sup> ≈ ${n(a / k * E ** (k * u), 4)}; F(0) = ${nq(a / k)}·1`, `∫ = F(${u}) − F(0) ≈ ${n(v, 4)}`, res(`≈ ${n(v)}`)],
  };
} });

def({ id: 'int_punkt', ch: 'int', name: 'Stammfunktion durch einen Punkt', lvl: 2, gen() {
  const c = [R.nz(-3, 3) * 3, R.int(-4, 4) * 2, R.int(-5, 5)], F = pint(c), x0 = R.pick([1, 2, -1, -2]), y0 = R.int(-8, 8), C = y0 - pv(F, x0);
  return {
    q: `Bestimme die Stammfunktion F von ${fx('f', poly(c))}, deren Graph durch P(${n(x0)} | ${n(y0)}) verläuft. Gib die Konstante C an.`,
    type: 'num', answer: C, tol: 0.011,
    hints: [`Alle Stammfunktionen: F(x) = ${poly(F)} + C. Setz den Punkt ein: F(${n(x0)}) = ${n(y0)}.`, `F(${n(x0)}) = ${nq(pv(F, x0))} + C = ${n(y0)}.`],
    steps: [`F(x) = ${poly(F)} + C`, `Punktprobe: ${nq(pv(F, x0))} + C = ${n(y0)} ⇒ C = ${nq(C)}`, res(`C = ${nq(C)}, also F(x) = ${poly(padd(F, [C]))}`)],
  };
} });

def({ id: 'int_regeln', ch: 'int', name: 'Integralregeln anwenden', lvl: 1, gen() {
  const v = R.int(0, 4), a = R.int(-2, 1), b = a + R.int(1, 3), c = b + R.int(1, 3), v1 = R.nz(-9, 9), v2 = R.nz(-9, 9), k = R.pick([2, 3, -2, 5]);
  const I = (lo, hi, f = 'f(x)') => `∫<sub>${n(lo)}</sub><sup>${n(hi)}</sup> ${f} dx`;
  const T = [
    [`Es gilt ${I(a, b)} = ${n(v1)}. Berechne ${I(b, a)}.`, -v1, 'Vorzeichenumkehr: Vertauscht man die Grenzen, ändert sich das Vorzeichen.', `${I(b, a)} = −${I(a, b)} = ${n(-v1)}`],
    [`Es gilt ${I(a, b)} = ${n(v1)}. Berechne ${I(a, b, `${k}·f(x)`)}.`, k * v1, 'Faktorregel: Ein konstanter Faktor darf vor das Integral.', `${I(a, b, `${k}·f(x)`)} = ${k}·${I(a, b)} = ${k}·${p(v1)} = ${n(k * v1)}`],
    [`Es gilt ${I(a, b)} = ${n(v1)} und ${I(b, c)} = ${n(v2)}. Berechne ${I(a, c)}.`, v1 + v2, 'Additivität: Aneinanderstoßende Intervalle darf man zusammenfassen.', `${I(a, c)} = ${I(a, b)} + ${I(b, c)} = ${n(v1)} + ${p(v2)} = ${n(v1 + v2)}`],
    [`Es gilt ${I(a, c)} = ${n(v1)} und ${I(a, b)} = ${n(v2)}. Berechne ${I(b, c)}.`, v1 - v2, 'Additivität: ∫ von a bis c = ∫ von a bis b + ∫ von b bis c.', `${I(b, c)} = ${I(a, c)} − ${I(a, b)} = ${n(v1)} − ${p(v2)} = ${n(v1 - v2)}`],
    [`Es gilt ${I(a, b)} = ${n(v1)} und ${I(a, b, 'g(x)')} = ${n(v2)}. Berechne ${I(a, b, `(${k}·f(x) − g(x))`)}.`, k * v1 - v2, 'Summen- und Faktorregel: Man darf das Integral aufteilen und Faktoren herausziehen.', `= ${k}·${n(v1)} − ${p(v2)} = ${n(k * v1 - v2)}`],
  ][v];
  return { q: T[0], type: 'num', answer: T[1], hints: [T[2], 'Schreib die Regel als Gleichung hin und setz die bekannten Werte ein.'], steps: [T[2], T[3], res(n(T[1]))] };
} });

def({ id: 'int_hauptsatz', ch: 'int', name: 'Welche Funktion ist eine Stammfunktion?', lvl: 2, gen() {
  const C0 = R.nz(-5, 5);
  if (R.chance(0.5)) {
    const nE = R.int(2, 4), a = (nE + 1) * R.pick([1, 2, -1]);
    const correct = `F(x) = ${poly([a / (nE + 1), ...Array(nE + 1).fill(0)])}${pm(C0)}`;
    return Object.assign(mc(correct, [`F(x) = ${poly([a * nE, ...Array(nE - 1).fill(0)])}`, `F(x) = ${poly([a, ...Array(nE + 1).fill(0)])}${pm(C0)}`, `F(x) = ${poly([a / (nE + 1), ...Array(nE).fill(0)])}`]), {
      q: `Welche Funktion ist eine Stammfunktion von ${fx('f', poly([a, ...Array(nE).fill(0)]))}?`,
      hints: [`F ist eine Stammfunktion von f, wenn F′(x) = f(x). Leite die Kandidaten ab!`, `Eine Konstante (+ ${Math.abs(C0)} oder − ${Math.abs(C0)}) fällt beim Ableiten weg – sie stört also nicht.`],
      steps: [`Ableiten der richtigen Lösung: (${poly([a / (nE + 1), ...Array(nE + 1).fill(0)])}${pm(C0)})′ = ${poly([a, ...Array(nE).fill(0)])} ✓`, `Die anderen: eine ist die Ableitung (nicht Stammfunktion), eine hat den Teiler vergessen, eine den falschen Exponenten.`, res(correct)],
    });
  }
  const a = R.pick([2, 3, 4, 6]), k = R.pick([2, 3, -1, -2]);
  const correct = `F(x) = ${cf(a / k)}${ex(k)}${pm(C0)}`;
  return Object.assign(mc(correct, [`F(x) = ${cf(a * k)}${ex(k)}`, `F(x) = ${n(a)}·${ex(k)}${pm(C0)}`, (k === -1 ? `F(x) = ${n(-a)}·x·${ex(k)}` : `F(x) = ${cf(a / (k + 1))}${ex(k + 1)}`)]), {
    q: `Welche Funktion ist eine Stammfunktion von ${fx('f', `${n(a)}·${ex(k)}`)}?`,
    hints: [`F ist Stammfunktion, wenn F′ = f. Leite die Kandidaten mit der Kettenregel ab.`, `Beim Ableiten von e<sup>${n(k)}x</sup> kommt der Faktor ${n(k)} dazu. Die Stammfunktion muss ihn also schon „vorher wegteilen“.`],
    steps: [`(${cf(a / k)}${ex(k)}${pm(C0)})′ = ${nq(a / k)}·${p(k)}·${ex(k)} = ${n(a)}·${ex(k)} ✓`, `Merke: Die Konstante C ist beliebig – es gibt unendlich viele Stammfunktionen.`, res(correct)],
  });
} });

// =====================================================================
// Kapitel 7: Flächen & Bestand
// =====================================================================
function defInt(c, a, b) { const F = pint(c); return { F, v: pv(F, b) - pv(F, a), Fa: pv(F, a), Fb: pv(F, b) }; }
def({ id: 'fla_xachse', ch: 'fla', name: 'Fläche zwischen Graph und x-Achse', lvl: 2, gen() {
  let r1, r2; do { r1 = R.int(-4, 3); r2 = R.int(-3, 4); } while (r1 >= r2 || r2 - r1 > 5);
  const a = R.pick([1, -1, 2, -2, 3]), c = fromRoots(a, [r1, r2]), I = defInt(c, r1, r2), A = Math.abs(I.v);
  return {
    q: `Berechne den Inhalt der Fläche, die der Graph von ${fx('f', poly(c))} mit der x-Achse einschließt.<br><small>Brüche oder 2 Nachkommastellen.</small>`,
    type: 'num', answer: A, tol: 0.011, unit: 'FE',
    hints: [`Zuerst die Nullstellen berechnen – sie sind die Integrationsgrenzen. Dann integrieren und den <b>Betrag</b> nehmen (Flächen sind positiv).`, `Nullstellen: x = ${n(r1)} und x = ${n(r2)}. Stammfunktion: F(x) = ${poly(I.F)}.`],
    steps: [`Nullstellen: ${poly(c)} = 0 ⇒ x = ${n(r1)}, x = ${n(r2)}`, `F(x) = ${poly(I.F)}`, `∫<sub>${n(r1)}</sub><sup>${n(r2)}</sup> f(x) dx = F(${n(r2)}) − F(${n(r1)}) = ${nq(I.Fb)} − ${pq(I.Fa)} = ${nq(I.v)}`, I.v < 0 ? `Das Integral ist negativ, weil die Fläche unter der x-Achse liegt ⇒ Betrag nehmen.` : `Das Integral ist positiv (Fläche oberhalb der x-Achse).`, res(`A = ${nq(A)}${Number.isInteger(A) ? '' : ' ≈ ' + n(A)} FE`)],
  };
} });

def({ id: 'fla_mehr', ch: 'fla', name: 'Fläche über mehrere Nullstellen', lvl: 3, gen() {
  const pp = R.int(1, 3), qq = R.int(1, 3), a = R.pick([1, -1]), c = fromRoots(a, [-qq, 0, pp]);
  const I1 = defInt(c, -qq, 0), I2 = defInt(c, 0, pp), A = Math.abs(I1.v) + Math.abs(I2.v);
  return {
    q: `Der Graph von ${fx('f', poly(c))} schließt mit der x-Achse zwei Flächenstücke ein. Berechne den gesamten Flächeninhalt.<br><small>Brüche oder 2 Nachkommastellen.</small>`,
    type: 'num', answer: A, tol: 0.011, unit: 'FE',
    hints: [`Nullstellen bestimmen (x ausklammern!). Dann <b>einzeln</b> von Nullstelle zu Nullstelle integrieren – sonst heben sich Flächen über und unter der x-Achse auf.`, `Nullstellen: ${n(-qq)}, 0, ${n(pp)}. F(x) = ${poly(I1.F)}.`],
    steps: [`f(x) = x·(${poly(c.slice(0, 3))}) ⇒ Nullstellen ${n(-qq)}, 0, ${n(pp)}`, `F(x) = ${poly(I1.F)}`, `∫<sub>${n(-qq)}</sub><sup>0</sup> f(x) dx = ${nq(I1.v)}`, `∫<sub>0</sub><sup>${n(pp)}</sup> f(x) dx = ${nq(I2.v)}`, `A = |${nq(I1.v)}| + |${nq(I2.v)}| = ${nq(A)}`, `Ohne Aufteilen käme ${nq(I1.v + I2.v)} heraus – falsch!`, res(`A = ${nq(A)}${Number.isInteger(A) ? '' : ' ≈ ' + n(A)} FE`)],
  };
} });

def({ id: 'fla_zwei', ch: 'fla', name: 'Fläche zwischen zwei Graphen', lvl: 2, gen() {
  let r1, r2; do { r1 = R.int(-3, 2); r2 = R.int(-2, 4); } while (r1 >= r2 || r2 - r1 > 5);
  const k = R.pick([1, 1, 2]), g = [R.int(-2, 2), R.int(-3, 3)], dd = fromRoots(-k, [r1, r2]), f = padd(dd, g);
  const I = defInt(dd, r1, r2), A = Math.abs(I.v);
  return {
    q: `Berechne den Inhalt der Fläche zwischen den Graphen von ${fx('f', poly(f))} und ${fx('g', poly(g))}.<br><small>Brüche oder 2 Nachkommastellen.</small>`,
    type: 'num', answer: A, tol: 0.011, unit: 'FE',
    hints: [`Bilde die Differenzfunktion d(x) = f(x) − g(x). Ihre Nullstellen sind die Schnittstellen und damit die Grenzen.`, `d(x) = ${poly(dd)} mit den Nullstellen ${n(r1)} und ${n(r2)}.`],
    steps: [`d(x) = f(x) − g(x) = ${poly(dd)}`, `Schnittstellen: d(x) = 0 ⇒ x = ${n(r1)}, x = ${n(r2)}`, `D(x) = ${poly(I.F)}`, `∫<sub>${n(r1)}</sub><sup>${n(r2)}</sup> d(x) dx = ${nq(I.Fb)} − ${pq(I.Fa)} = ${nq(I.v)}`, res(`A = ${nq(A)}${Number.isInteger(A) ? '' : ' ≈ ' + n(A)} FE`)],
  };
} });

def({ id: 'fla_achsen', ch: 'fla', name: 'Fläche bis zu einer senkrechten Geraden', lvl: 2, gen() {
  if (R.chance(0.5)) {
    const a = R.pick([1, 2, 3, 0.5]), k = R.pick([1, 0.5, -1, 2]), b = R.pick([1, 2, 3]), A = a / k * (E ** (k * b) - 1);
    return {
      q: `Der Graph von ${fx('f', `${cf(a)}${ex(k)}`)}, die Koordinatenachsen und die Gerade x = ${b} begrenzen eine Fläche. Berechne ihren Inhalt.<br><small>Auf 2 Nachkommastellen.</small>`,
      type: 'num', answer: A, tol: 0.011, unit: 'FE',
      hints: [`f ist immer positiv. Die Fläche ist also ∫<sub>0</sub><sup>${b}</sup> f(x) dx (Grenzen: y-Achse x = 0 und x = ${b}).`, `F(x) = ${cf(a / k)}${ex(k)}.`],
      steps: [`A = ∫<sub>0</sub><sup>${b}</sup> ${cf(a)}${ex(k)} dx`, `F(x) = ${cf(a / k)}${ex(k)}`, `A = F(${b}) − F(0) = ${nq(a / k)}·(e<sup>${n(k * b)}</sup> − 1) ≈ ${n(A, 4)}`, res(`A ≈ ${n(A)} FE`)],
    };
  }
  const a = R.pick([1, 2, 3, 4, 6]), b = R.pick([2, 3, 4, 5]), A = a * (1 - 1 / b);
  return {
    q: `Berechne den Inhalt der Fläche zwischen dem Graphen von ${fx('f', fracOver(a, 'x²'))}, der x-Achse und den Geraden x = 1 und x = ${b}.<br><small>Brüche oder 2 Nachkommastellen.</small>`,
    type: 'num', answer: A, tol: 0.011, unit: 'FE',
    hints: [`f(x) = ${a}·x<sup>−2</sup> ist positiv. Stammfunktion: F(x) = −${a}·x<sup>−1</sup> = −${fracOver(a, 'x')}.`, `A = F(${b}) − F(1).`],
    steps: [`F(x) = ${a}·x<sup>−1</sup>/(−1) = −${fracOver(a, 'x')}`, `A = F(${b}) − F(1) = −${frac(a, b)} − (−${a}) = ${nq(A)}`, res(`A = ${nq(A)}${Number.isInteger(A) ? '' : ' ≈ ' + n(A)} FE`)],
  };
} });

def({ id: 'fla_bestand', ch: 'fla', name: 'Rekonstruierter Bestand', lvl: 2, gen() {
  const k = R.pick([1, 2, 3]), q = R.pick([4, 5, 6, 8]), B0 = R.pick([50, 100, 200]), T = R.int(2, q + 2);
  const r = fromRoots(-k, [-1, q]), I = defInt(r, 0, T), B = B0 + I.v;
  return {
    q: `In einem Speicherbecken befinden sich zu Beginn ${B0} m³ Wasser. Die Zuflussrate wird durch ${fx('r', poly(r, 't')).replace('(x)', '(t)')} beschrieben (t in Stunden, r in m³/h; negative Werte bedeuten Abfluss). Wie viel Wasser ist nach ${T} Stunden im Becken?<br><small>Auf 2 Nachkommastellen.</small>`,
    type: 'num', answer: B, tol: 0.011, unit: 'm³',
    hints: [`Bestand = Anfangsbestand + Integral der Änderungsrate: B(${T}) = ${B0} + ∫<sub>0</sub><sup>${T}</sup> r(t) dt.`, `Stammfunktion: R(t) = ${poly(I.F, 't')}.`],
    steps: [`B(${T}) = ${B0} + ∫<sub>0</sub><sup>${T}</sup> r(t) dt`, `R(t) = ${poly(I.F, 't')}`, `∫<sub>0</sub><sup>${T}</sup> r(t) dt = R(${T}) − R(0) = ${nq(I.v)}${T > q ? ` (ab t = ${q} fließt Wasser ab – das Integral rechnet das automatisch mit)` : ''}`, `B(${T}) = ${B0} + ${pq(I.v)} ≈ ${n(B)}`, res(`≈ ${n(B)} m³`)],
  };
} });

const MEANINGS = {
  int: (a, b) => `die Wassermenge (in Litern), die zwischen Minute ${a} und Minute ${b} zufließt`,
  rate: b => `die Zuflussrate (in Litern pro Minute) zum Zeitpunkt t = ${b}`,
  bestand: b => `die Wassermenge im Becken nach ${b} Minuten`,
  mittel: (a, b) => `die mittlere Zuflussrate (in Litern pro Minute) zwischen Minute ${a} und ${b}`,
  aend: b => `wie schnell sich die Zuflussrate zum Zeitpunkt t = ${b} ändert`,
};
def({ id: 'fla_deutung', ch: 'fla', name: 'Integral im Sachzusammenhang deuten', lvl: 1, gen() {
  const a = R.int(0, 5), b = a + R.int(2, 10), B0 = R.pick([100, 200, 500]), v = R.int(0, 3);
  const I = `∫<sub>${a}</sub><sup>${b}</sup> r(t) dt`;
  const Q = [
    [`${I}`, MEANINGS.int(a, b)],
    [`${B0} + ∫<sub>0</sub><sup>${b}</sup> r(t) dt`, MEANINGS.bestand(b)],
    [`${fracOver(1, `${b} − ${a}`)}·${I}`, MEANINGS.mittel(a, b)],
    [`r′(${b})`, MEANINGS.aend(b)],
  ][v];
  const all = [MEANINGS.int(a, b), MEANINGS.bestand(b), MEANINGS.mittel(a, b), MEANINGS.aend(b), MEANINGS.rate(b)];
  return Object.assign(mc(Q[1], R.shuffle(all.filter(x => x !== Q[1])).slice(0, 3)), {
    q: `r(t) beschreibt die Zuflussrate von Wasser in ein Becken (t in Minuten, r in Litern pro Minute). Zu Beginn sind ${B0} Liter im Becken. Was beschreibt der Term <b>${Q[0]}</b>?`,
    hints: [`Das Integral einer Änderungsrate liefert die <b>Gesamtänderung</b> (hier: zugeflossene Menge). Die Ableitung einer Rate beschreibt, wie schnell sich die Rate selbst ändert.`, `Integral geteilt durch die Intervalllänge = Mittelwert der Rate. Anfangsbestand + Integral = Bestand.`],
    steps: ['∫ Rate dt = Gesamtänderung im Zeitraum (hier: Liter).', 'Anfangsbestand + Gesamtänderung = Bestand zum Endzeitpunkt.', '1/(b − a)·∫ = mittlere Rate; r′ = Änderung der Rate.', res(`${Q[0]} beschreibt ${Q[1]}.`)],
  });
} });

// =====================================================================
// Abi-Training Berlin
// =====================================================================
const HMF = ['fkt_pq', 'fkt_ausklammern', 'fkt_biquad', 'fkt_wurzel', 'fkt_symm', 'fkt_unendlich', 'fkt_trafo', 'fkt_umkehr', 'abl_poly', 'abl_kette', 'abl_produkt',
  'abl_wert', 'abl_graph', 'aen_mittel', 'aen_tangente', 'kur_extrem', 'kur_wende', 'kur_art', 'mod_loesbar', 'int_stamm_poly', 'int_bestimmt', 'int_regeln', 'int_hauptsatz',
  'fla_xachse', 'fla_deutung'];
const teilA = K.makeTeilA(HMF, generate, TYPES, 'Ohne Taschenrechner und ohne Formelsammlung. Im Abitur hast du für den gesamten Teil A (alle drei Sachgebiete) bis zu 100 Minuten.');

const EXAMS = [];
// ---------- Medikament ----------
EXAMS.push({ id: 'medikament', title: 'Medikament im Blut', gen() {
  const a = R.pick([10, 20, 30, 40]), k = R.pick([0.5, 0.25, 1]);
  const c = t => a * t * E ** (-k * t), dc = t => a * E ** (-k * t) * (1 - k * t);
  const tm = 1 / k, cm = c(tm), t2 = 3 / k, tw = 2 / k;
  const kt = k === 1 ? 't' : `${n(k)}t`, eT = `e<sup>−${kt}</sup>`;
  const ctx = `Nach der Einnahme eines Medikaments wird seine Konzentration im Blut beschrieben durch<br>c(t) = ${a}·t·${eT}<br>(t in Stunden nach der Einnahme, c in mg pro Liter).`;
  return { id: 'medikament', title: 'Medikament im Blut', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, q: `${L('a')}Berechne die Konzentration eine Stunde nach der Einnahme.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: c(1), tol: 0.011, unit: 'mg/l',
      hints: ['Setze t = 1 in c(t) ein.', `c(1) = ${a}·1·e<sup>−${n(k)}</sup>.`], steps: [`c(1) = ${a}·e<sup>−${n(k)}</sup> ≈ ${n(c(1), 4)}`, res(`≈ ${n(c(1))} mg/l`)] }),
    part({ label: 'b', be: 4, q: `${L('b')}Bestimme den Zeitpunkt der höchsten Konzentration und die maximale Konzentration.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'tpl', tpl: 't = {} h &nbsp; c<sub>max</sub> = {} mg/l', answer: [tm, cm], tol: 0.011,
      hints: [`Produktregel: u = ${a}t, v = ${eT}. Dann c′(t) = 0 setzen.`, `c′(t) = ${a}·${eT}·(1 − ${kt}). Die e-Potenz ist nie 0.`],
      steps: [`c′(t) = ${a}·${eT} + ${a}t·(−${n(k)})·${eT} = ${a}·${eT}·(1 − ${kt})`, `c′(t) = 0 ⇔ 1 − ${kt} = 0 ⇔ t = ${n(tm)}`, `Vorzeichenwechsel von c′ von + nach − (vorher steigt c, danach fällt c) ⇒ Maximum`, `c(${n(tm)}) = ${a}·${n(tm)}·e<sup>−1</sup> ≈ ${n(cm)}`, res(`Nach ${n(tm)} h: c<sub>max</sub> ≈ ${n(cm)} mg/l`)] }),
    part({ label: 'c', be: 3, lvl: 2, q: `${L('c')}Berechne die momentane Änderungsrate der Konzentration ${n(t2)} Stunden nach der Einnahme und deute das Vorzeichen.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: dc(t2), tol: 0.011, unit: 'mg/l pro h',
      hints: ['Momentane Änderungsrate = c′(t).', `c′(${n(t2)}) = ${a}·e<sup>−3</sup>·(1 − 3).`], steps: [`c′(${n(t2)}) = ${a}·e<sup>−3</sup>·(−2) ≈ ${n(dc(t2), 4)}`, 'Negativ ⇒ die Konzentration nimmt zu diesem Zeitpunkt ab.', res(`≈ ${n(dc(t2))} mg/l pro Stunde`)] }),
    part({ label: 'd', be: 4, q: `${L('d')}Zu welchem Zeitpunkt nimmt die Konzentration am stärksten ab?`, type: 'num', answer: tw, tol: 0.011, unit: 'h',
      hints: ['Stärkste Abnahme = kleinste (negativste) Steigung = Wendestelle. Löse c″(t) = 0.', `c″(t) = ${n(a * k)}·${eT}·(${kt} − 2).`],
      steps: [`c″(t) = −${n(a * k)}·${eT}·(1 − ${kt}) − ${n(a * k)}·${eT} = ${n(a * k)}·${eT}·(${kt} − 2)`, `c″(t) = 0 ⇔ ${kt} = 2 ⇔ t = ${n(tw)}`, `c″ wechselt dort das Vorzeichen (− nach +) ⇒ c′ hat ein Minimum ⇒ stärkste Abnahme.`, res(`t = ${n(tw)} h`)] }),
    part({ label: 'e', be: 2, lvl: 1, ...mc('Das Medikament wird langfristig vollständig abgebaut.', ['Die Konzentration nähert sich einem Wert über 0.', 'Die Konzentration steigt langfristig an.', 'Das Medikament wirkt sofort nach der Einnahme am stärksten.']),
      q: `${L('e')}Es gilt c(t) → 0 für t → ∞. Was bedeutet das im Sachzusammenhang?`, hints: ['Was passiert mit der Menge im Blut nach sehr langer Zeit?', 'Die e-Funktion „gewinnt“ gegen t: Das Produkt geht gegen 0.'], steps: [`c(t) = ${a}t·${eT} → 0, weil ${eT} schneller gegen 0 geht als t wächst.`, res('Das Medikament wird langfristig vollständig abgebaut.')] }),
    part({ label: 'f', be: 3, lvl: 2, q: `${L('f')}Berechne die mittlere Änderungsrate der Konzentration in den ersten ${n(tm)} Stunden.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: cm / tm, tol: 0.011, unit: 'mg/l pro h',
      hints: ['Mittlere Änderungsrate = (c(b) − c(a)) / (b − a).', `(c(${n(tm)}) − c(0)) / ${n(tm)} mit c(0) = 0.`], steps: [`(c(${n(tm)}) − c(0)) / (${n(tm)} − 0) = ${n(cm, 4)} / ${n(tm)} ≈ ${n(cm / tm)}`, res(`≈ ${n(cm / tm)} mg/l pro Stunde`)] }),
  ] };
} });

// ---------- Speicherbecken ----------
EXAMS.push({ id: 'becken', title: 'Speicherbecken', gen() {
  const k = R.pick([1, 2]), q = R.pick([5, 7, 9]), B0 = R.pick([20, 50, 100]);
  const r = fromRoots(-k, [-1, q]), F = pint(r), tm = (q - 1) / 2, rm = pv(r, tm);
  const Bq = B0 + pv(F, q), Bq2 = B0 + pv(F, q + 2);
  const rs = poly(r, 't');
  const ctx = `In ein Speicherbecken, in dem sich zu Beginn ${B0} m³ Wasser befinden, fließt Wasser zu. Die Zuflussrate wird für 0 ≤ t ≤ ${q + 2} beschrieben durch<br>r(t) = ${rs}<br>(t in Stunden, r in m³ pro Stunde; negative Werte bedeuten, dass Wasser abfließt).`;
  return { id: 'becken', title: 'Speicherbecken', intro: ctx, parts: [
    part({ label: 'a', be: 1, lvl: 1, q: `${L('a')}Gib die Zuflussrate zu Beobachtungsbeginn an.`, type: 'num', answer: pv(r, 0), unit: 'm³/h', hints: ['Setze t = 0 ein.', 'Nur der Summand ohne t bleibt übrig.'], steps: [`r(0) = ${n(pv(r, 0))}`, res(`${n(pv(r, 0))} m³/h`)] }),
    part({ label: 'b', be: 4, lvl: 2, q: `${L('b')}Bestimme den Zeitpunkt der größten Zuflussrate und die größte Zuflussrate.`, type: 'tpl', tpl: 't = {} h &nbsp; r<sub>max</sub> = {} m³/h', answer: [tm, rm], tol: 0.011,
      hints: ['Extremstelle von r: r′(t) = 0.', `r′(t) = ${poly(pd(r), 't')}.`], steps: [`r′(t) = ${poly(pd(r), 't')} = 0 ⇒ t = ${n(tm)}`, `r″(t) = ${n(-2 * k)} < 0 ⇒ Maximum`, `r(${n(tm)}) = ${n(rm)}`, res(`Nach ${n(tm)} h: ${n(rm)} m³/h`)] }),
    part({ label: 'c', be: 2, lvl: 2, q: `${L('c')}Ab welchem Zeitpunkt fließt Wasser ab?`, type: 'num', answer: q, unit: 'h', hints: ['Wasser fließt ab, sobald r(t) < 0. Bestimme die Nullstelle von r im Bereich t > 0.', `r(t) = ${n(-k)}·(t + 1)·(t − ${q}).`], steps: [`r(t) = 0 ⇒ t = −1 (nicht im Bereich) oder t = ${q}`, `Für t > ${q} ist r(t) < 0.`, res(`ab t = ${q} h`)] }),
    part({ label: 'd', be: 4, q: `${L('d')}Berechne die Wassermenge im Becken nach ${q} Stunden.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: Bq, tol: 0.011, unit: 'm³',
      hints: [`B(${q}) = ${B0} + ∫<sub>0</sub><sup>${q}</sup> r(t) dt.`, `Stammfunktion: R(t) = ${poly(F, 't')}.`], steps: [`R(t) = ${poly(F, 't')}`, `∫<sub>0</sub><sup>${q}</sup> r(t) dt = R(${q}) − R(0) = ${nq(pv(F, q))}`, `B(${q}) = ${B0} + ${nq(pv(F, q))} ≈ ${n(Bq)}`, res(`≈ ${n(Bq)} m³`)] }),
    part({ label: 'e', be: 2, lvl: 1, ...mc(`die Wassermenge im Becken ${q + 2} Stunden nach Beobachtungsbeginn`, [`die Zuflussrate ${q + 2} Stunden nach Beobachtungsbeginn`, `die Wassermenge, die in den ersten ${q + 2} Stunden abgeflossen ist`, `die mittlere Zuflussrate in den ersten ${q + 2} Stunden`]),
      q: `${L('e')}Was beschreibt der Term ${B0} + ∫<sub>0</sub><sup>${q + 2}</sup> r(t) dt im Sachzusammenhang?`, hints: ['Das Integral einer Rate ist die Gesamtänderung.', 'Anfangsbestand + Gesamtänderung = …?'], steps: [res(`die Wassermenge im Becken ${q + 2} Stunden nach Beobachtungsbeginn`)] }),
    part({ label: 'f', be: 3, q: `${L('f')}Berechne die Wassermenge im Becken nach ${q + 2} Stunden.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: Bq2, tol: 0.011, unit: 'm³',
      hints: [`Wie in d), nur mit der oberen Grenze ${q + 2}. Das Abfließen nach t = ${q} rechnet das Integral automatisch mit.`, `R(${q + 2}) = ${nq(pv(F, q + 2))}.`], steps: [`∫<sub>0</sub><sup>${q + 2}</sup> r(t) dt = R(${q + 2}) − R(0) = ${nq(pv(F, q + 2))}`, `B(${q + 2}) = ${B0} + ${pq(pv(F, q + 2))} ≈ ${n(Bq2)}`, res(`≈ ${n(Bq2)} m³`)] }),
  ] };
} });

// ---------- Tunnel ----------
EXAMS.push({ id: 'tunnel', title: 'Tunneleinfahrt', gen() {
  const [a, r0] = R.pick([[0.5, 3], [0.25, 4], [0.2, 5], [0.125, 6]]), h = a * r0 * r0;
  const f = x => h - a * x * x;
  const area = 4 / 3 * a * r0 ** 3, slope = 2 * a * r0, ang = deg(Math.atan(slope));
  const H = Math.round((f(1.25) + R.pick([-0.3, -0.2, 0.2, 0.3])) * 10) / 10, fits = f(1.25) >= H;
  const u = Math.sqrt(h / (3 * a)), Am = 4 * h * u / 3;
  const ctx = `Die Einfahrt eines Tunnels hat die Form einer Parabel. Ihr Rand wird beschrieben durch<br>${fx('f', `${nq(h)} − ${nq(a)}x²`)}<br>(x und f(x) in Metern; die x-Achse ist die Straße).`;
  return { id: 'tunnel', title: 'Tunneleinfahrt', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, q: `${L('a')}Berechne die Breite der Tunneleinfahrt am Boden.`, type: 'num', answer: 2 * r0, unit: 'm', hints: ['Die Breite am Boden ist der Abstand der beiden Nullstellen.', `${nq(h)} − ${nq(a)}x² = 0 ⇒ x² = ${r0 * r0}.`], steps: [`f(x) = 0 ⇒ x² = ${nq(h)} / ${nq(a)} = ${r0 * r0} ⇒ x = ±${r0}`, `Breite = ${r0} − (−${r0}) = ${2 * r0}`, res(`${2 * r0} m`)] }),
    part({ label: 'b', be: 4, lvl: 2, q: `${L('b')}Berechne die Fläche der Tunnelöffnung.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: area, tol: 0.011, unit: 'm²',
      hints: [`A = ∫<sub>−${r0}</sub><sup>${r0}</sup> f(x) dx.`, `F(x) = ${nq(h)}x − ${nq(a / 3)}x³.`], steps: [`F(x) = ${poly([-a / 3, 0, h, 0])}`, `A = F(${r0}) − F(−${r0}) = ${nq(pv([-a / 3, 0, h, 0], r0))} − (${nq(pv([-a / 3, 0, h, 0], -r0))}) ≈ ${n(area)}`, res(`≈ ${n(area)} m²`)] }),
    part({ label: 'c', be: 3, lvl: 2, q: `${L('c')}Unter welchem Winkel trifft der Tunnelrand bei x = ${r0} auf die Straße?<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: ang, tol: 0.11, unit: '°',
      hints: ['tan α = |f′(x₀)|.', `f′(x) = ${poly([-2 * a, 0])} ⇒ f′(${r0}) = ${nq(-slope)}.`], steps: [`f′(${r0}) = ${nq(-slope)}`, `α = tan⁻¹(${nq(slope)}) ≈ ${n(ang, 1)}°`, res(`≈ ${n(ang, 1)}°`)] }),
    part({ label: 'd', be: 3, lvl: 2, type: 'choice', options: ['Ja, er passt durch.', 'Nein, er passt nicht durch.'], answer: fits ? 0 : 1,
      q: `${L('d')}Ein Lkw ist 2,5 m breit und ${n(H, 1)} m hoch. Passt er durch den Tunnel, wenn er genau in der Mitte fährt?`,
      hints: ['In der Mitte fahrend reicht der Lkw von x = −1,25 bis x = 1,25. Die Tunneldecke ist dort am niedrigsten am Rand des Lkw.', `Berechne f(1,25) und vergleiche mit ${n(H, 1)} m.`],
      steps: [`f(1,25) = ${nq(h)} − ${nq(a)}·1,25² ≈ ${n(f(1.25))} m`, `${n(f(1.25))} m ${fits ? '≥' : '<'} ${n(H, 1)} m`, res(fits ? 'Ja, er passt durch.' : 'Nein, er passt nicht durch.')] }),
    part({ label: 'e', be: 5, q: `${L('e')}In die Öffnung soll ein rechteckiges Tor eingebaut werden (untere Ecken auf der Straße, obere Ecken auf dem Rand). Berechne den größtmöglichen Flächeninhalt des Tores.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: Am, tol: 0.011, unit: 'm²',
      hints: [`Ecken bei ±u: A(u) = 2u·f(u) = 2u·(${nq(h)} − ${nq(a)}u²). Dann A′(u) = 0.`, `A′(u) = ${nq(2 * h)} − ${nq(6 * a)}u² = 0 ⇒ u² = ${nq(h / (3 * a))}.`],
      steps: [`A(u) = 2u·(${nq(h)} − ${nq(a)}u²) = ${poly([-2 * a, 0, 2 * h, 0], 'u')}`, `A′(u) = ${poly([-6 * a, 0, 2 * h], 'u')} = 0 ⇒ u = √${nq(h / (3 * a))} ≈ ${n(u, 3)}`, `A″(u) = ${nq(-12 * a)}u < 0 ⇒ Maximum`, `A(${n(u, 3)}) ≈ ${n(Am)}`, res(`≈ ${n(Am)} m²`)] }),
  ] };
} });

// ---------- Achterbahn ----------
EXAMS.push({ id: 'achterbahn', title: 'Achterbahn', gen() {
  let C; do { C = cubicCrit(); } while (C.x2 - C.x1 < 2);
  const c = C.c, xw = (C.x1 + C.x2) / 2, yw = pv(c, xw), mw = pv(C.d1, xw), angW = deg(Math.atan(Math.abs(mw)));
  const x0 = C.x2 + 1, t = tangentData(c, x0);
  const ctx = `Ein Abschnitt einer Achterbahn wird im Bereich ${n(C.x1 - 1)} ≤ x ≤ ${n(C.x2 + 1)} durch ${fx('f', poly(c))} modelliert (1 LE = 10 m; f(x) ist die Höhe über einer Bezugslinie).`;
  return { id: 'achterbahn', title: 'Achterbahn', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, q: `${L('a')}Berechne die Steigung der Bahn an der Stelle x = 0.`, type: 'num', answer: pv(C.d1, 0), hints: ['Steigung = f′(0).', `f′(x) = ${poly(C.d1)}.`], steps: [`f′(0) = ${n(pv(C.d1, 0))}`, res(n(pv(C.d1, 0)))] }),
    part({ label: 'b', be: 5, q: `${L('b')}Bestimme den Hoch- und den Tiefpunkt der Bahn.`, type: 'tpl', tpl: 'H( {} | {} ) &nbsp; T( {} | {} )', answer: [C.hx, pv(c, C.hx), C.tx, pv(c, C.tx)],
      hints: ['f′(x) = 0 lösen, dann mit f″ entscheiden.', `f′(x) = ${poly(C.d1)} = 0 ⇒ x = ${n(C.x1)} oder x = ${n(C.x2)}.`], steps: [...critSteps(C), res(`H(${n(C.hx)} | ${n(pv(c, C.hx))}), T(${n(C.tx)} | ${n(pv(c, C.tx))})`)] }),
    part({ label: 'c', be: 4, q: `${L('c')}Zwischen Hoch- und Tiefpunkt ist die Bahn am steilsten. Bestimme diesen Punkt (Wendepunkt).<br><small>Brüche oder 2 Nachkommastellen.</small>`, type: 'tpl', tpl: 'W( {} | {} )', answer: [xw, yw], tol: 0.011,
      hints: ['Steilste Stelle = Wendestelle: f″(x) = 0.', `f″(x) = ${poly(C.d2)}.`], steps: [`f″(x) = ${poly(C.d2)} = 0 ⇒ x = ${nq(xw)}`, `f‴(x) = ${n(6 * C.a)} ≠ 0 ✓`, `f(${nq(xw)}) = ${nq(yw)}`, res(`W(${nq(xw)} | ${nq(yw)})`)] }),
    part({ label: 'd', be: 3, lvl: 2, q: `${L('d')}Berechne den Neigungswinkel der Bahn im Wendepunkt.<br><small>In Grad, auf 1 Nachkommastelle.</small>`, type: 'num', answer: angW, tol: 0.11, unit: '°',
      hints: ['tan α = |f′(x<sub>W</sub>)|.', `f′(${nq(xw)}) = ${nq(mw)}.`], steps: [`f′(${nq(xw)}) = ${nq(mw)}`, `α = tan⁻¹(${nq(Math.abs(mw))}) ≈ ${n(angW, 1)}°`, res(`≈ ${n(angW, 1)}°`)] }),
    part({ label: 'e', be: 4, q: `${L('e')}Am Ende des Abschnitts (x = ${n(x0)}) verlässt die Bahn das Modell geradlinig in Richtung der Tangente. Bestimme die Tangentengleichung.`, type: 'tpl', tpl: 'y = {}x + {}', answer: [t.m, t.b],
      hints: ['Tangente: Steigung m = f′(x₀), Punkt (x₀ | f(x₀)).', `f(${n(x0)}) = ${n(t.y0)}, f′(${n(x0)}) = ${n(t.m)}.`], steps: [`f(${n(x0)}) = ${n(t.y0)}, m = f′(${n(x0)}) = ${n(t.m)}`, `${n(t.y0)} = ${n(t.m)}·${p(x0)} + b ⇒ b = ${n(t.b)}`, res(`y = ${poly([t.m, t.b])}`)] }),
  ] };
} });

function teilB(id) { const E0 = id ? EXAMS.find(e => e.id === id) : R.pick(EXAMS); return E0.gen(); }

const IQB = 'https://www.iqb.hu-berlin.de/media/exercise_files/Abituraufgaben_Mathematik/';
const LINKS = [
  { title: 'IQB: alle veröffentlichten Abituraufgaben Mathematik', sub: 'Gemeinsamer Aufgabenpool der Länder, aus dem auch Berlin Aufgaben nutzt. Filter: „grundlegend“ + „Analysis“. Mit Erwartungshorizont (Lösungen).', url: 'https://www.iqb.hu-berlin.de/de/schule/aufgaben/sekii/abiturpruefungsaufgaben-mathematik/' },
  { title: 'Abitur 2025 · Teil A · Analysis (Aufgabe 1)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2025MgrundlegendAAnalysis11_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil A · Analysis (Aufgabe 2)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2025MgrundlegendAAnalysis12_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil A · Analysis (Aufgabe 3)', sub: 'grundlegendes Niveau, hilfsmittelfrei, anspruchsvoller', url: IQB + '2025MgrundlegendAAnalysis21_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil B · Analysis', sub: 'grundlegendes Niveau, mit Taschenrechner, mit Lösung', url: IQB + '2025MgrundlegendBAnalysisWTR1_Aufgabe.pdf' },
  { title: 'Abitur 2024 · Teil A · Analysis', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2024MgrundlegendAAnalysis11_Aufgabe.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2027', sub: 'Senatsverwaltung für Bildung – was im Abitur drankommt', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2027_gk.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2028', sub: 'Senatsverwaltung für Bildung', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2028_gk.pdf' },
];

const APP = {
  key: 'kurven-quest-v1',
  titles: [['🐣', 'Kurven-Neuling'], ['🐥', 'Steigungs-Sucher'], ['🦊', 'Nullstellen-Fuchs'], ['🦉', 'Ableitungs-Eule'], ['🐬', 'Tangenten-Surfer'],
    ['🦅', 'Extremwert-Adler'], ['🐉', 'Wendepunkt-Drache'], ['🧙', 'Integral-Zauberer'], ['🚀', 'Analysis-Ass'], ['👑', 'Abi-Champion']],
  inputHelp: 'Diese Eingabe verstehe ich nicht. Erlaubt: Zahlen wie −3, 2,5, 3/4 oder √3.',
};

const api = { APP, CHAPTERS, TYPES, EXAMS, LINKS, teilA, teilB, notenpunkte: K.notenpunkte, generate, check: K.check, parseNum: K.parseNum, withSeed: K.withSeed, R };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Aufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
