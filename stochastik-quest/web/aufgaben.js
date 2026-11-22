// Zufalls-Quest: Aufgaben-Generatoren für Stochastik (Grundkurs Berlin).
// Jede Aufgabe liefert: Fragetext, Antworttyp, richtige Antwort, zwei Hinweise und einen ausführlichen Lösungsweg.
(function (root) {
'use strict';
const K = (typeof module !== 'undefined' && module.exports) ? require('./kern.js') : root.Kern;
const { R, n, p, frac, fracOver, nq, res, mc, part, L } = K;
const { TYPES, def, generate } = K.makeBank();

// ---------- Werkzeuge ----------
const pr = x => n(x, 4);                    // Wahrscheinlichkeit mit 4 Stellen
const pc = x => n(100 * x, 2) + ' %';       // in Prozent
const approx = x => Math.abs(x * 10000 - Math.round(x * 10000)) < 1e-9 ? '= ' + pr(x) : '≈ ' + pr(x);
const PROB = '<small>Als Bruch, als Dezimalzahl (mindestens 3 Nachkommastellen) oder in %.</small>';
const TOL = 0.0006;
function C(nn, k) { if (k < 0 || k > nn) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (nn - k + i) / i; return Math.round(r); }
const fact = k => k <= 1 ? 1 : k * fact(k - 1);
const binom = (nn, k) => `<span class="binom"><span>${nn}</span><span>${k}</span></span>`;
const pdf = (nn, q, k) => C(nn, k) * q ** k * (1 - q) ** (nn - k);
const cdf = (nn, q, k) => { let s = 0; for (let i = 0; i <= Math.min(k, nn); i++) s += pdf(nn, q, i); return s; };
const fr = (a, b) => frac(a, b);            // Bruch gekürzt
const ov = s => `${s}̄`;               // Gegenereignis: Ā, B̄
const sum = a => a.reduce((s, x) => s + x, 0);
function vft(cells, lab) { // cells: [[a, b, a+b], [c, d, c+d], [a+c, b+d, N]], Strings erlaubt (z. B. „?“)
  const td = x => `<td${x === '?' ? ' class="q"' : ''}>${typeof x === 'number' ? n(x, 4) : x}</td>`;
  return `<table class="vft"><tr><th></th><th>${lab[2]}</th><th>${lab[3]}</th><th>Summe</th></tr>${[lab[0], lab[1], 'Summe'].map((r, i) => `<tr><th>${r}</th>${cells[i].map(td).join('')}</tr>`).join('')}</table>`;
}
function distTable(xs, ps, name = 'X') {
  const cell = v => `<td${v === '?' ? ' class="q"' : ''}>${typeof v === 'number' ? n(v, 4) : v}</td>`;
  return `<table class="vft"><tr><th>${name.toLowerCase()}<sub>i</sub></th>${xs.map(cell).join('')}</tr><tr><th>P(${name} = ${name.toLowerCase()}<sub>i</sub>)</th>${ps.map(cell).join('')}</tr></table>`;
}
function weights(k, total = 20) { // k positive ganze Zahlen mit Summe total
  let w; do { w = Array.from({ length: k }, () => R.int(1, total)); } while (sum(w) !== total);
  return w;
}
const probAns = (v, extra = {}) => Object.assign({ type: 'num', answer: v, tol: TOL }, extra);

// ---------- Kapitel ----------
const CHAPTERS = [ // nach den Berliner Prüfungsschwerpunkten Mathematik Grundkurs (2026–2028)
  { id: 'grd', name: 'Grundbegriffe & Laplace', icon: '🎲', desc: 'Ereignisse, Mengen, Gegenereignis, Additionssatz, relative Häufigkeit' },
  { id: 'kom', name: 'Kombinatorik & Urnen', icon: '🏺', desc: 'Abzählen, Ziehen mit und ohne Zurücklegen, Lotto-Modell' },
  { id: 'bau', name: 'Baumdiagramm & Vierfeldertafel', icon: '🌳', desc: 'Pfadregeln, totale Wahrscheinlichkeit, Tafeln ergänzen' },
  { id: 'bed', name: 'Bedingte Wahrscheinlichkeit', icon: '🔍', desc: 'P_A(B), Bayes mit Tafel oder Baum, Unabhängigkeit' },
  { id: 'zgr', name: 'Zufallsgrößen', icon: '🎰', desc: 'Verteilung, Erwartungswert, Varianz, faire Spiele' },
  { id: 'sta', name: 'Kenngrößen von Daten', icon: '📊', desc: 'Mittelwert, Median, Modalwert, Spannweite, Streuung' },
  { id: 'bin', name: 'Binomialverteilung', icon: '🎯', desc: 'Bernoulli-Ketten, P(X = k), kumuliert, μ und σ, Mindestanzahl' },
];

// =====================================================================
// Kapitel 1: Grundbegriffe & Laplace
// =====================================================================
def({ id: 'grd_wuerfel', ch: 'grd', name: 'Zwei Würfel (Laplace)', lvl: 1, gen() {
  const v = R.int(0, 3), s = v === 0 ? R.int(3, 11) : R.int(8, 11);
  const [txt, pred] = [
    [`die Augensumme ist ${s}`, (a, b) => a + b === s],
    [`die Augensumme ist mindestens ${s}`, (a, b) => a + b >= s],
    ['es fällt ein Pasch (zwei gleiche Augenzahlen)', (a, b) => a === b],
    ['mindestens eine Sechs fällt', (a, b) => a === 6 || b === 6],
  ][v];
  const fav = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (pred(a, b)) fav.push(`(${a}|${b})`);
  return probAns(fav.length / 36, {
    q: `Zwei faire Würfel werden geworfen. Mit welcher Wahrscheinlichkeit gilt: ${txt}?<br>${PROB}`,
    hints: ['Es gibt 6 · 6 = 36 gleich wahrscheinliche Ergebnisse (a|b). Laplace: P = günstige / mögliche Ergebnisse.', `Zähle die passenden Paare – z. B. ${fav.slice(0, 3).join(', ')} … (Reihenfolge zählt: (1|2) ≠ (2|1)).`],
    steps: [`Mögliche Ergebnisse: 6 · 6 = 36`, `Günstige Ergebnisse: ${fav.length <= 12 ? fav.join(', ') : fav.length + ' Stück'} → ${fav.length} Stück`, `P = ${fav.length}/36 = ${fr(fav.length, 36)} ${approx(fav.length / 36)}`, res(`P = ${fr(fav.length, 36)}`)],
  });
} });

def({ id: 'grd_gegen', ch: 'grd', name: 'Mindestens einmal (Gegenereignis)', lvl: 1, gen() {
  const [obj, ev, q] = R.pick([['ein Würfel', 'eine Sechs', 1 / 6], ['eine Münze', '„Zahl“', 0.5], ['ein Glücksrad', '„Rot“ (Wahrscheinlichkeit 0,2)', 0.2], ['ein Glücksrad', '„Gewinn“ (Wahrscheinlichkeit 0,1)', 0.1], ['ein Würfel', 'eine Eins oder Zwei', 1 / 3]]);
  const k = R.int(2, 6), v = 1 - (1 - q) ** k, qs = q === 1 / 6 ? '1/6' : q === 1 / 3 ? '1/3' : n(q);
  const qq = q === 1 / 6 ? '5/6' : q === 1 / 3 ? '2/3' : n(1 - q);
  return probAns(v, {
    q: `${obj[0].toUpperCase() + obj.slice(1)} wird ${k}-mal ${obj.includes('rad') ? 'gedreht' : 'geworfen'}. Mit welcher Wahrscheinlichkeit erhält man <b>mindestens einmal</b> ${ev}?<br>${PROB}`,
    hints: ['„Mindestens einmal“ rechnet man am einfachsten über das <b>Gegenereignis</b> „kein einziges Mal“: P(mind. 1) = 1 − P(keinmal).', `P(keinmal) = (${qq})${K.sup(k)}, weil jeder Versuch mit Wahrscheinlichkeit ${qq} „daneben“ geht.`],
    steps: [`Einzelwahrscheinlichkeit: ${qs}, Gegenwahrscheinlichkeit: ${qq}`, `P(keinmal) = (${qq})${K.sup(k)} ${approx((1 - q) ** k)}`, `P(mindestens einmal) = 1 − (${qq})${K.sup(k)} ${approx(v)}`, res(`P ${approx(v)} (${pc(v)})`)],
  });
} });

const PRED = [
  ['eine gerade Zahl', x => x % 2 === 0], ['eine ungerade Zahl', x => x % 2 === 1], ['eine Primzahl', x => [2, 3, 5, 7, 11, 13, 17, 19].includes(x)],
  ['eine durch 3 teilbare Zahl', x => x % 3 === 0], ['eine Zahl größer als 7', x => x > 7], ['eine Zahl kleiner als 5', x => x < 5], ['eine durch 4 teilbare Zahl', x => x % 4 === 0],
];
def({ id: 'grd_mengen', ch: 'grd', name: 'Ereignisse verknüpfen', lvl: 2, gen() {
  const N = R.pick([10, 12, 20]), [pa, pb] = R.shuffle(PRED).slice(0, 2), Om = Array.from({ length: N }, (_, i) => i + 1);
  const A = Om.filter(pa[1]), B = Om.filter(pb[1]);
  const ops = [
    ['A ∩ B', x => pa[1](x) && pb[1](x), 'A und B gleichzeitig (Schnittmenge)'],
    ['A ∪ B', x => pa[1](x) || pb[1](x), 'A oder B oder beide (Vereinigung)'],
    [`${ov('A')} ∩ B`, x => !pa[1](x) && pb[1](x), 'nicht A, aber B'],
    [`${ov('A ∪ B')}`, x => !pa[1](x) && !pb[1](x), 'weder A noch B'],
  ];
  const [sym, f, word] = R.pick(ops), E = Om.filter(f);
  const set = a => `{${a.join('; ') || ' '}}`;
  return probAns(E.length / N, {
    q: `Aus einer Urne mit ${N} Kugeln mit den Nummern 1 bis ${N} wird eine gezogen.<br>A: „Die Nummer ist ${pa[0]}.“ &nbsp; B: „Die Nummer ist ${pb[0]}.“<br>Berechne P(${sym}).<br>${PROB}`,
    hints: [`Schreib A und B als Mengen auf. ${sym} bedeutet: ${word}.`, `A = ${set(A)}, B = ${set(B)}.`],
    steps: [`A = ${set(A)}`, `B = ${set(B)}`, `${sym} (${word}) = ${set(E)} → ${E.length} Elemente`, `P(${sym}) = ${E.length}/${N} = ${fr(E.length, N)}`, res(`P = ${fr(E.length, N)}`)],
  });
} });

const SYM = [
  ['A ∩ B', (a, b) => `${a} und ${b}`], ['A ∪ B', (a, b) => `${a} oder ${b} (oder beides)`],
  [`${ov('A')} ∩ ${ov('B')}`, (a, b) => `weder ${a} noch ${b}`], [`A ∩ ${ov('B')}`, (a, b) => `${a}, aber nicht ${b}`], [`${ov('A ∩ B')}`, (a, b) => `nicht beides (${a} und ${b}) gleichzeitig`],
];
def({ id: 'grd_symbol', ch: 'grd', name: 'Ereignisse in Symbolen', lvl: 1, gen() {
  const [ctx, A, B, a, b] = R.pick([
    ['Eine Kundin wird zufällig ausgewählt.', 'Die Kundin kauft Brot.', 'Die Kundin kauft Milch.', 'sie kauft Brot', 'Milch'],
    ['Ein Schüler wird zufällig ausgewählt.', 'Er spielt ein Instrument.', 'Er treibt Sport im Verein.', 'er spielt ein Instrument', 'treibt Sport im Verein'],
    ['Ein Tag im Juli wird zufällig ausgewählt.', 'Es regnet.', 'Es ist wärmer als 25 °C.', 'es regnet', 'ist wärmer als 25 °C'],
  ]);
  const i = R.int(0, SYM.length - 1), desc = j => { const s = SYM[j][1]('A tritt ein', 'B tritt ein'); return s; };
  const words = SYM.map((s, j) => j === 0 ? `${a} und ${b}` : j === 1 ? `${a} oder ${b} (oder beides)` : j === 2 ? `weder trifft „${A.slice(0, -1)}“ zu noch „${B.slice(0, -1)}“` : j === 3 ? `${a}, aber nicht: ${b}` : `nicht beides gleichzeitig`);
  return Object.assign(mc(words[i], R.shuffle(words.filter((_, j) => j !== i)).slice(0, 3)), {
    q: `${ctx}<br>A: „${A}“ &nbsp; B: „${B}“<br>Was bedeutet das Ereignis <b>${SYM[i][0]}</b>?`,
    hints: ['∩ heißt „und“ (beides), ∪ heißt „oder“ (mindestens eins), der Strich oben heißt „nicht“ (Gegenereignis).', `Lies ${SYM[i][0]} Zeichen für Zeichen: ${desc(i)}.`],
    steps: ['∩ = und, ∪ = oder (einschließend), Ā = nicht A', `${SYM[i][0]} bedeutet: ${desc(i)}`, res(words[i])],
  });
} });

def({ id: 'grd_add', ch: 'grd', name: 'Additionssatz', lvl: 2, gen() {
  let a, b, ab; do { a = R.int(2, 8) / 10; b = R.int(2, 8) / 10; ab = R.int(1, 5) / 10; } while (ab > Math.min(a, b) || a + b - ab > 1);
  const u = Math.round((a + b - ab) * 100) / 100, rev = R.chance(0.4);
  return probAns(rev ? ab : u, {
    q: rev ? `Es gilt P(A) = ${n(a)}, P(B) = ${n(b)} und P(A ∪ B) = ${n(u)}. Berechne P(A ∩ B).` : `Es gilt P(A) = ${n(a)}, P(B) = ${n(b)} und P(A ∩ B) = ${n(ab)}. Berechne P(A ∪ B).`,
    hints: ['Additionssatz: P(A ∪ B) = P(A) + P(B) − P(A ∩ B).', 'Die Schnittmenge wird abgezogen, weil sie in P(A) und in P(B) doppelt gezählt ist.'],
    steps: ['P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', rev ? `${n(u)} = ${n(a)} + ${n(b)} − P(A ∩ B) ⇒ P(A ∩ B) = ${n(a + b)} − ${n(u)} = ${n(ab)}` : `P(A ∪ B) = ${n(a)} + ${n(b)} − ${n(ab)} = ${n(u)}`, res(rev ? `P(A ∩ B) = ${n(ab)}` : `P(A ∪ B) = ${n(u)}`)],
  });
} });

def({ id: 'grd_haeufig', ch: 'grd', name: 'Relative Häufigkeit', lvl: 1, gen() {
  const Nv = R.pick([200, 500, 1000]), h = R.int(Nv / 10, Nv * 0.8), rel = h / Nv, M = R.pick([50, 100, 250, 400]);
  const obj = R.pick([['Eine Reißzwecke', 'mit der Spitze nach oben'], ['Ein Kronkorken', 'mit der offenen Seite nach oben'], ['Ein Legostein', 'auf der Seite']]);
  if (R.chance(0.5)) return probAns(rel, {
    q: `${obj[0]} wurde ${Nv}-mal geworfen und landete ${h}-mal ${obj[1]}. Schätze die Wahrscheinlichkeit für das Ergebnis „${obj[1]}“.<br>${PROB}`,
    hints: ['Bei vielen Versuchen ist die <b>relative Häufigkeit</b> ein guter Schätzwert für die Wahrscheinlichkeit (Gesetz der großen Zahlen).', `Relative Häufigkeit = ${h} / ${Nv}.`],
    steps: [`h = ${h} / ${Nv} = ${pr(rel)}`, 'Je mehr Würfe, desto verlässlicher ist diese Schätzung.', res(`P ≈ ${pr(rel)}`)],
  });
  return { q: `${obj[0]} wurde ${Nv}-mal geworfen und landete ${h}-mal ${obj[1]}. Wie oft erwartest du dieses Ergebnis bei ${M} weiteren Würfen?<br><small>Auf ganze Zahlen runden.</small>`, type: 'num', answer: rel * M, tol: 0.51,
    hints: ['Schätze zuerst die Wahrscheinlichkeit über die relative Häufigkeit.', `p ≈ ${h}/${Nv} = ${pr(rel)}. Erwartete Anzahl = n · p.`],
    steps: [`p ≈ ${h}/${Nv} = ${pr(rel)}`, `Erwartete Anzahl: ${M} · ${pr(rel)} = ${n(rel * M)}`, res(`etwa ${Math.round(rel * M)}-mal`)] };
} });

// =====================================================================
// Kapitel 2: Kombinatorik & Urnen
// =====================================================================
def({ id: 'kom_zaehlen', ch: 'kom', name: 'Abzählen (Kombinatorik)', lvl: 1, gen() {
  const v = R.int(0, 3);
  if (v === 0) { const k = R.int(4, 7); return { q: `Auf wie viele Arten können sich ${k} Personen nebeneinander auf ${k} Stühle setzen?`, type: 'num', answer: fact(k), hints: ['Für den ersten Stuhl gibt es ' + k + ' Möglichkeiten, für den zweiten eine weniger …', `${k}! = ${Array.from({ length: k }, (_, i) => k - i).join(' · ')}`], steps: [`Produktregel: ${Array.from({ length: k }, (_, i) => k - i).join(' · ')} = ${k}! = ${fact(k)}`, res(String(fact(k)))] }; }
  if (v === 1) { const [m, k, what] = R.pick([[10, 4, 'eine vierstellige PIN aus den Ziffern 0–9'], [10, 3, 'ein dreistelliges Zahlenschloss (Ziffern 0–9)'], [2, 8, 'eine Folge aus 8 Münzwürfen (Kopf/Zahl)'], [6, 3, 'das Ergebnis von drei Würfelwürfen (in Reihenfolge)']]); const v2 = m ** k; return { q: `Wie viele Möglichkeiten gibt es für ${what}?`, type: 'num', answer: v2, hints: ['Jede Stelle kann unabhängig belegt werden, Wiederholungen sind erlaubt.', `Pro Stelle ${m} Möglichkeiten, ${k} Stellen: ${m}${K.sup(k)}.`], steps: [`${Array(k).fill(m).join(' · ')} = ${m}${K.sup(k)} = ${v2}`, res(String(v2))] }; }
  if (v === 2) { const N = R.int(6, 12), r = N * (N - 1) * (N - 2); return { q: `Bei einem Lauf mit ${N} Teilnehmenden werden Gold, Silber und Bronze vergeben. Wie viele verschiedene Siegerehrungen sind möglich?`, type: 'num', answer: r, hints: ['Reihenfolge ist wichtig, und niemand kann zwei Medaillen bekommen.', `Gold: ${N} Möglichkeiten, Silber: ${N - 1}, Bronze: ${N - 2}.`], steps: [`${N} · ${N - 1} · ${N - 2} = ${r}`, res(String(r))] }; }
  const N = R.int(6, 15), k = R.int(2, 4), r = C(N, k);
  return { q: `Aus ${N} Schülerinnen und Schülern wird ein Team aus ${k} Personen ausgelost (Reihenfolge egal). Wie viele verschiedene Teams sind möglich?`, type: 'num', answer: r,
    hints: ['Reihenfolge egal, keine Wiederholung ⇒ Binomialkoeffizient „n über k“.', `${binom(N, k)} = ${N}! / (${k}! · ${N - k}!). Taschenrechner: nCr.`],
    steps: [`Anzahl = ${binom(N, k)} = ${fracOver(Array.from({ length: k }, (_, i) => N - i).join(' · '), Array.from({ length: k }, (_, i) => k - i).join(' · '))} = ${r}`, res(String(r))] };
} });

function urn() { const r = R.int(2, 7), b = R.int(2, 7); return { r, b, N: r + b }; }
def({ id: 'kom_mit', ch: 'kom', name: 'Ziehen mit Zurücklegen', lvl: 1, gen() {
  const { r, b, N } = urn(), v = R.int(0, 2);
  const pR = r / N, pB = b / N;
  const [txt, val, calc] = [
    ['beide Kugeln rot sind', pR * pR, `${fr(r, N)} · ${fr(r, N)} = ${fr(r * r, N * N)}`],
    ['genau eine Kugel rot ist', 2 * pR * pB, `${fr(r, N)} · ${fr(b, N)} + ${fr(b, N)} · ${fr(r, N)} = ${fr(2 * r * b, N * N)}`],
    ['beide Kugeln gleichfarbig sind', pR * pR + pB * pB, `${fr(r, N)} · ${fr(r, N)} + ${fr(b, N)} · ${fr(b, N)} = ${fr(r * r + b * b, N * N)}`],
  ][v];
  return probAns(val, {
    q: `In einer Urne liegen ${r} rote und ${b} blaue Kugeln. Es wird zweimal <b>mit Zurücklegen</b> gezogen. Wie groß ist die Wahrscheinlichkeit, dass ${txt}?<br>${PROB}`,
    hints: [`Mit Zurücklegen bleibt die Urne gleich: P(rot) = ${fr(r, N)} bei jedem Zug. Zeichne ein Baumdiagramm mit zwei Stufen.`, '1. Pfadregel: entlang eines Pfades multiplizieren. 2. Pfadregel: passende Pfade addieren.'],
    steps: [`P(rot) = ${fr(r, N)}, P(blau) = ${fr(b, N)} – bei beiden Zügen gleich.`, `Passende Pfade multiplizieren und addieren: ${calc}`, res(`P = ${fr(Math.round(val * N * N), N * N)} ${approx(val)}`)],
  });
} });

def({ id: 'kom_ohne', ch: 'kom', name: 'Ziehen ohne Zurücklegen', lvl: 2, gen() {
  const { r, b, N } = urn(), v = R.int(0, 2), D = N * (N - 1);
  const [txt, num, calc] = [
    ['beide Kugeln rot sind', r * (r - 1), `${fr(r, N)} · ${fr(r - 1, N - 1)}`],
    ['genau eine Kugel rot ist', 2 * r * b, `${fr(r, N)} · ${fr(b, N - 1)} + ${fr(b, N)} · ${fr(r, N - 1)}`],
    ['beide Kugeln gleichfarbig sind', r * (r - 1) + b * (b - 1), `${fr(r, N)} · ${fr(r - 1, N - 1)} + ${fr(b, N)} · ${fr(b - 1, N - 1)}`],
  ][v];
  return probAns(num / D, {
    q: `In einer Urne liegen ${r} rote und ${b} blaue Kugeln. Es werden zwei Kugeln <b>ohne Zurücklegen</b> gezogen. Wie groß ist die Wahrscheinlichkeit, dass ${txt}?<br>${PROB}`,
    hints: ['Ohne Zurücklegen ändert sich die Urne: Beim zweiten Zug ist eine Kugel weniger drin – und von der gezogenen Farbe eine weniger.', `Erster Zug rot: ${fr(r, N)}. Danach sind noch ${r - 1} rote von ${N - 1} Kugeln übrig.`],
    steps: [`Baumdiagramm: 1. Zug aus ${N} Kugeln, 2. Zug aus ${N - 1} Kugeln.`, `${calc} = ${fr(num, D)}`, res(`P = ${fr(num, D)} ${approx(num / D)}`)],
  });
} });

def({ id: 'kom_mindestens', ch: 'kom', name: 'Mindestens eine (ohne Zurücklegen)', lvl: 2, gen() {
  const { r, b, N } = urn(), m = R.pick([2, 3]); if (b < m) return this.gen();
  const p0 = C(b, m) / C(N, m), v = 1 - p0;
  return probAns(v, {
    q: `In einer Urne liegen ${r} rote und ${b} blaue Kugeln. Es werden ${m} Kugeln ohne Zurücklegen gezogen. Mit welcher Wahrscheinlichkeit ist <b>mindestens eine rote</b> dabei?<br>${PROB}`,
    hints: ['Gegenereignis: „keine rote“ = „nur blaue“.', `P(nur blaue) = ${Array.from({ length: m }, (_, i) => fr(b - i, N - i)).join(' · ')}.`],
    steps: [`P(keine rote) = ${Array.from({ length: m }, (_, i) => fr(b - i, N - i)).join(' · ')} ${approx(p0)}`, `P(mindestens eine rote) = 1 − ${pr(p0)} ${approx(v)}`, res(`P ${approx(v)}`)],
  });
} });

def({ id: 'kom_lotto', ch: 'kom', name: 'Lotto-Modell', lvl: 3, gen() {
  const ctx = R.pick([
    () => ({ N: 49, Kk: 6, m: 6, k: R.int(2, 4), t: (k) => `Beim Lotto „6 aus 49“ werden 6 von 49 Kugeln gezogen. Du hast 6 Zahlen getippt. Mit welcher Wahrscheinlichkeit hast du <b>genau ${k} Richtige</b>?`, good: 'Richtige', bad: 'Falsche' }),
    () => { const N = R.pick([20, 25, 30]), Kk = R.int(3, 6), m = R.int(3, 5); return { N, Kk, m, k: R.int(1, 2), t: (k) => `In einer Kiste liegen ${N} Glühbirnen, davon sind ${Kk} defekt. Es werden ${m} Glühbirnen zufällig entnommen. Mit welcher Wahrscheinlichkeit sind <b>genau ${k}</b> davon defekt?`, good: 'defekte', bad: 'intakte' }; },
  ])();
  const { N, Kk, m, k } = ctx, v = C(Kk, k) * C(N - Kk, m - k) / C(N, m);
  return probAns(v, {
    q: `${ctx.t(k)}<br><small>Auf mindestens 4 Nachkommastellen oder in % (2 Stellen).</small>`, tol: 0.00006,
    hints: ['Lotto-Modell (Ziehen ohne Zurücklegen, Reihenfolge egal): P = (Anzahl günstige Auswahlen) / (Anzahl aller Auswahlen).', `Günstig: ${k} aus den ${Kk} ${ctx.good} und ${m - k} aus den ${N - Kk} ${ctx.bad}: ${binom(Kk, k)} · ${binom(N - Kk, m - k)}. Alle: ${binom(N, m)}.`],
    steps: [`Alle Auswahlen: ${binom(N, m)} = ${C(N, m)}`, `Günstige: ${binom(Kk, k)} · ${binom(N - Kk, m - k)} = ${C(Kk, k)} · ${C(N - Kk, m - k)} = ${C(Kk, k) * C(N - Kk, m - k)}`, `P = ${C(Kk, k) * C(N - Kk, m - k)} / ${C(N, m)} ≈ ${n(v, 5)}`, res(`P ≈ ${n(v, 5)} (${n(100 * v, 3)} %)`)],
  });
} });

// =====================================================================
// Kapitel 3: Baumdiagramm & Vierfeldertafel
// =====================================================================
def({ id: 'bau_pfad', ch: 'bau', name: 'Pfadregeln (zwei Stufen)', lvl: 1, gen() {
  const p1 = R.int(3, 9) / 10, p2 = R.int(3, 9) / 10, q1 = 1 - p1, q2 = 1 - p2;
  const [ctx, e] = R.pick([['Auf dem Schulweg kommt Mia an zwei Ampeln vorbei, die unabhängig voneinander geschaltet sind. Ampel 1 ist mit ${p1}, Ampel 2 mit ${p2} Wahrscheinlichkeit grün.', 'grün'], ['Zwei Bogenschützen schießen unabhängig voneinander je einmal. Sie treffen mit den Wahrscheinlichkeiten ${p1} und ${p2}.', 'Treffer']]);
  const v = R.int(0, 3);
  const [txt, val, calc] = [
    [e === 'grün' ? 'beide Ampeln grün sind' : 'beide treffen', p1 * p2, `${n(p1)} · ${n(p2)}`],
    [e === 'grün' ? 'genau eine Ampel grün ist' : 'genau einer trifft', p1 * q2 + q1 * p2, `${n(p1)} · ${n(q2)} + ${n(q1)} · ${n(p2)}`],
    [e === 'grün' ? 'keine Ampel grün ist' : 'keiner trifft', q1 * q2, `${n(q1)} · ${n(q2)}`],
    [e === 'grün' ? 'höchstens eine Ampel grün ist' : 'höchstens einer trifft', 1 - p1 * p2, `1 − ${n(p1)} · ${n(p2)}`],
  ][v];
  return probAns(val, {
    q: `${ctx.replace('${p1}', n(p1)).replace('${p2}', n(p2))}<br>Wie groß ist die Wahrscheinlichkeit, dass ${txt}?`,
    hints: ['Baumdiagramm mit zwei Stufen zeichnen. 1. Pfadregel: Wahrscheinlichkeiten entlang eines Pfades multiplizieren.', '2. Pfadregel: Wahrscheinlichkeiten aller passenden Pfade addieren. „Höchstens eine“ geht schnell über das Gegenereignis „beide“.'],
    steps: [`Gegenwahrscheinlichkeiten: ${n(q1)} und ${n(q2)}`, `${calc} = ${pr(val)}`, res(`P = ${pr(val)}`)],
  });
} });

def({ id: 'bau_drei', ch: 'bau', name: 'Drei Stufen', lvl: 2, gen() {
  const q = R.pick([0.2, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9]), mind = R.chance(0.5);
  const exact2 = 3 * q * q * (1 - q), v = mind ? exact2 + q ** 3 : exact2;
  return probAns(v, {
    q: `Eine Basketballspielerin trifft einen Freiwurf mit der Wahrscheinlichkeit ${n(q)}. Sie wirft dreimal (unabhängig). Mit welcher Wahrscheinlichkeit trifft sie <b>${mind ? 'mindestens' : 'genau'} zweimal</b>?`,
    hints: ['Baumdiagramm mit drei Stufen (T = Treffer, F = Fehlwurf). Welche Pfade passen?', `Genau 2 Treffer: TTF, TFT, FTT – jeder Pfad hat die Wahrscheinlichkeit ${n(q)}² · ${n(1 - q)}.${mind ? ' Für „mindestens 2“ kommt TTT dazu.' : ''}`],
    steps: [`Pfade mit genau 2 Treffern: TTF, TFT, FTT → 3 · ${n(q)}² · ${n(1 - q)} = ${pr(exact2)}`, ...(mind ? [`Dazu TTT: ${n(q)}³ = ${pr(q ** 3)}`] : []), res(`P = ${pr(v)}`)],
  });
} });

const VFT_CTX = [
  ['Mädchen', 'Jungen', 'mit Brille', 'ohne Brille', 'Schülerinnen und Schüler eines Jahrgangs'],
  ['Raucher', 'Nichtraucher', 'treibt Sport', 'treibt keinen Sport', 'Befragte einer Umfrage'],
  ['geimpft', 'nicht geimpft', 'erkrankt', 'nicht erkrankt', 'Personen einer Studie'],
];
function vftCounts() {
  const a = R.int(5, 60), b = R.int(5, 60), c = R.int(5, 60), d = R.int(5, 60);
  return { a, b, c, d, rA: a + b, rN: c + d, cB: a + c, cN: b + d, N: a + b + c + d };
}
const fullCells = T => [[T.a, T.b, T.rA], [T.c, T.d, T.rN], [T.cB, T.cN, T.N]];
def({ id: 'bau_vft', ch: 'bau', name: 'Vierfeldertafel ergänzen', lvl: 1, gen() {
  const T = vftCounts(), lab = R.pick(VFT_CTX);
  const cells = [[T.a, '', T.rA], ['', '?', ''], [T.cB, '', T.N]];
  return { q: `Ergänze die Vierfeldertafel (${lab[4]}) und gib den Wert im Feld „?“ an.${vft(cells, lab)}`, type: 'num', answer: T.d,
    hints: ['In jeder Zeile und jeder Spalte ergeben die beiden inneren Felder die Summe am Rand.', `Rechne zuerst die fehlenden Randsummen: ${lab[1]} gesamt = ${T.N} − ${T.rA}, „${lab[3]}“ gesamt = ${T.N} − ${T.cB}.`],
    steps: [`${lab[0]}, ${lab[3]}: ${T.rA} − ${T.a} = ${T.b}`, `${lab[1]}, ${lab[2]}: ${T.cB} − ${T.a} = ${T.c}`, `${lab[1]} gesamt: ${T.N} − ${T.rA} = ${T.rN}`, `Gesuchtes Feld: ${T.rN} − ${T.c} = ${T.d}`, `Vollständige Tafel:${vft(fullCells(T), lab)}`, res(`? = ${T.d}`)] };
} });

def({ id: 'bau_total', ch: 'bau', name: 'Totale Wahrscheinlichkeit', lvl: 2, gen() {
  const a = R.pick([0.2, 0.3, 0.4, 0.6, 0.7]), x = R.pick([0.01, 0.02, 0.03, 0.05]), y = R.pick([0.04, 0.06, 0.08]);
  const v = a * x + (1 - a) * y;
  return probAns(v, {
    q: `Eine Firma stellt Teile auf zwei Maschinen her. Maschine M₁ fertigt ${pc(a)} aller Teile, davon sind ${pc(x)} fehlerhaft. Bei Maschine M₂ sind ${pc(y)} der Teile fehlerhaft. Mit welcher Wahrscheinlichkeit ist ein zufällig gewähltes Teil fehlerhaft?<br>${PROB}`,
    hints: ['Baumdiagramm: 1. Stufe Maschine (M₁/M₂), 2. Stufe fehlerhaft/in Ordnung.', `P(F) = P(M₁)·P<sub>M₁</sub>(F) + P(M₂)·P<sub>M₂</sub>(F) = ${n(a)}·${n(x)} + ${n(1 - a)}·${n(y)}.`],
    steps: [`P(M₁) = ${n(a)}, P(M₂) = ${n(1 - a)}`, `P(F) = ${n(a)}·${n(x)} + ${n(1 - a)}·${n(y)} = ${pr(a * x)} + ${pr((1 - a) * y)} = ${pr(v)}`, res(`P(F) = ${pr(v)} (${pc(v)})`)],
  });
} });

// =====================================================================
// Kapitel 4: Bedingte Wahrscheinlichkeit
// =====================================================================
def({ id: 'bed_vft', ch: 'bed', name: 'Bedingte Wahrscheinlichkeit aus der Tafel', lvl: 1, gen() {
  const T = vftCounts(), lab = R.pick(VFT_CTX), byRow = R.chance(0.5);
  const v = byRow ? T.a / T.rA : T.a / T.cB;
  const qtxt = byRow ? `Eine Person aus der Gruppe „${lab[0]}“ wird zufällig gewählt. Mit welcher Wahrscheinlichkeit gehört sie zu „${lab[2]}“?` : `Eine Person aus der Gruppe „${lab[2]}“ wird zufällig gewählt. Mit welcher Wahrscheinlichkeit gehört sie zu „${lab[0]}“?`;
  return probAns(v, {
    q: `Vierfeldertafel (${lab[4]}):${vft(fullCells(T), lab)}${qtxt}<br>${PROB}`,
    hints: ['Bei einer bedingten Wahrscheinlichkeit ist die Grundgesamtheit <b>nicht mehr alle</b>, sondern nur die Gruppe, die schon feststeht.', `Teile also durch die Summe der Gruppe „${byRow ? lab[0] : lab[2]}“ (${byRow ? T.rA : T.cB}), nicht durch ${T.N}.`],
    steps: [`Bedingung: „${byRow ? lab[0] : lab[2]}“ → ${byRow ? T.rA : T.cB} Personen`, `Davon „${byRow ? lab[2] : lab[0]}“: ${T.a}`, `P = ${T.a} / ${byRow ? T.rA : T.cB} = ${fr(T.a, byRow ? T.rA : T.cB)} ${approx(v)}`, res(`P ${approx(v)}`)],
  });
} });

def({ id: 'bed_bayes', ch: 'bed', name: 'Medizinischer Test (Bayes)', lvl: 3, gen() {
  const q = R.pick([0.01, 0.02, 0.05, 0.1]), s = R.pick([0.9, 0.95, 0.98]), t = R.pick([0.9, 0.95, 0.97]);
  const kp = q * s, gp = (1 - q) * (1 - t), v = kp / (kp + gp);
  const Nn = 10000;
  return probAns(v, {
    q: `${pc(q)} der Bevölkerung haben eine bestimmte Krankheit. Ein Test erkennt eine Erkrankung mit ${pc(s)} Wahrscheinlichkeit. Bei Gesunden zeigt er mit ${pc(t)} Wahrscheinlichkeit korrekt „negativ“. Eine Person wird positiv getestet. Mit welcher Wahrscheinlichkeit ist sie tatsächlich krank?<br>${PROB}`,
    hints: [`Stell dir ${Nn} Personen vor und fülle eine Vierfeldertafel (krank/gesund × positiv/negativ).`, `Krank und positiv: ${Nn}·${n(q)}·${n(s)} = ${n(Nn * kp)}. Gesund und positiv: ${Nn}·${n(1 - q)}·${n(1 - t, 2)} = ${n(Nn * gp)}. Gesucht: Anteil der Kranken unter allen Positiven.`],
    steps: [`Von ${Nn} Personen: krank ${n(Nn * q)}, gesund ${n(Nn * (1 - q))}`, `krank & positiv: ${n(Nn * q)}·${n(s)} = ${n(Nn * kp)}`, `gesund & positiv: ${n(Nn * (1 - q))}·${n(1 - t)} = ${n(Nn * gp)}`, `P<sub>positiv</sub>(krank) = ${n(Nn * kp)} / (${n(Nn * kp)} + ${n(Nn * gp)}) ${approx(v)}`, `Überraschend klein? Weil es viel mehr Gesunde gibt, fallen auch wenige Fehlalarme stark ins Gewicht.`, res(`P ${approx(v)} (${pc(v)})`)],
  });
} });

def({ id: 'bed_unabh', ch: 'bed', name: 'Stochastische Unabhängigkeit', lvl: 2, gen() {
  let a, b, ab, dep;
  do { a = R.int(2, 8) / 10; b = R.int(2, 8) / 10; dep = R.chance(0.5); ab = Math.round((a * b + (dep ? R.pick([-0.06, -0.04, 0.04, 0.06]) : 0)) * 100) / 100; } while (ab <= 0 || ab >= Math.min(a, b) || a + b - ab >= 1);
  const r2 = x => Math.round(x * 100) / 100;
  const cells = [[ab, r2(a - ab), a], [r2(b - ab), r2(1 - a - b + ab), r2(1 - a)], [b, r2(1 - b), 1]];
  return {
    q: `Für zwei Ereignisse A und B gilt diese Vierfeldertafel (Wahrscheinlichkeiten):${vft(cells, ['A', ov('A'), 'B', ov('B')])}Sind A und B stochastisch unabhängig?`,
    type: 'choice', options: ['Ja, A und B sind unabhängig.', 'Nein, A und B sind abhängig.'], answer: dep ? 1 : 0,
    hints: ['A und B sind unabhängig, wenn P(A ∩ B) = P(A) · P(B).', `Vergleiche P(A ∩ B) = ${n(ab)} mit ${n(a)} · ${n(b)}.`],
    steps: [`P(A) · P(B) = ${n(a)} · ${n(b)} = ${n(a * b, 4)}`, `P(A ∩ B) = ${n(ab)}`, dep ? `${n(ab)} ≠ ${n(a * b, 4)} ⇒ abhängig` : `${n(ab)} = ${n(a * b, 4)} ⇒ unabhängig`, res(dep ? 'A und B sind abhängig.' : 'A und B sind unabhängig.')],
  };
} });

def({ id: 'bed_formel', ch: 'bed', name: 'Rechnen mit P_A(B)', lvl: 2, gen() {
  const a = R.int(2, 8) / 10, x = R.int(1, 9) / 10, ab = Math.round(a * x * 100) / 100;
  if (R.chance(0.5)) return probAns(ab, {
    q: `Es gilt P(A) = ${n(a)} und P<sub>A</sub>(B) = ${n(x)}. Berechne P(A ∩ B).`,
    hints: ['P<sub>A</sub>(B) ist die Wahrscheinlichkeit für B, <b>wenn A schon eingetreten ist</b>. Im Baumdiagramm steht sie auf dem Ast hinter A.', 'Pfadregel: P(A ∩ B) = P(A) · P<sub>A</sub>(B).'],
    steps: [`P(A ∩ B) = P(A) · P<sub>A</sub>(B) = ${n(a)} · ${n(x)} = ${n(ab)}`, res(`P(A ∩ B) = ${n(ab)}`)],
  });
  return probAns(x, {
    q: `Es gilt P(A) = ${n(a)} und P(A ∩ B) = ${n(ab)}. Berechne P<sub>A</sub>(B).`,
    hints: ['Definition: P<sub>A</sub>(B) = P(A ∩ B) / P(A).', `P<sub>A</sub>(B) = ${n(ab)} / ${n(a)}.`],
    steps: [`P<sub>A</sub>(B) = P(A ∩ B) / P(A) = ${n(ab)} / ${n(a)} = ${n(x)}`, res(`P<sub>A</sub>(B) = ${n(x)}`)],
  });
} });

def({ id: 'bed_symbol', ch: 'bed', name: 'Bedingt oder „und“?', lvl: 1, gen() {
  const [A, B, an, bn] = R.pick([['R', 'S', 'Raucher', 'Sportler'], ['M', 'B', 'Mädchen', 'Brillenträger'], ['K', 'P', 'Kranken', 'positiv Getesteten']]);
  const x = R.int(5, 60), v = R.int(0, 2);
  const sentences = [`Von den ${an} sind ${x} % auch ${bn}.`, `Von den ${bn} sind ${x} % auch ${an}.`, `${x} % aller Personen sind ${an} und zugleich ${bn}.`];
  const forms = [`P<sub>${A}</sub>(${B}) = ${n(x / 100)}`, `P<sub>${B}</sub>(${A}) = ${n(x / 100)}`, `P(${A} ∩ ${B}) = ${n(x / 100)}`, `P(${B}) = ${n(x / 100)}`];
  return Object.assign(mc(forms[v], forms.filter((_, i) => i !== v)), {
    q: `${A}: „Die Person gehört zu den ${an}.“ &nbsp; ${B}: „Die Person gehört zu den ${bn}.“<br>Welche Schreibweise passt zur Aussage: <b>${sentences[v]}</b>`,
    hints: ['„Von den …“ legt fest, auf welche Gruppe man sich bezieht – das ist die <b>Bedingung</b> und steht unten am P.', 'P(A ∩ B) bezieht sich auf <b>alle</b> Personen; P<sub>A</sub>(B) nur auf die Gruppe A.'],
    steps: [`„${sentences[v]}“`, v === 2 ? 'Bezug auf alle Personen, beide Eigenschaften gleichzeitig ⇒ Schnittmenge.' : `Bezug nur auf die ${v === 0 ? an : bn} ⇒ bedingte Wahrscheinlichkeit, Bedingung ${v === 0 ? A : B}.`, res(forms[v])],
  });
} });

// =====================================================================
// Kapitel 5: Zufallsgrößen
// =====================================================================
function randDist(k) {
  const xs = R.shuffle(Array.from({ length: 13 }, (_, i) => i - 3)).slice(0, k).sort((a, b) => a - b);
  const ps = weights(k).map(w => w / 20);
  return { xs, ps, E: sum(xs.map((x, i) => x * ps[i])) };
}
const eSteps = (xs, ps) => xs.map((x, i) => `${p(x)}·${n(ps[i], 2)}`).join(' + ');
def({ id: 'zgr_erwartung', ch: 'zgr', name: 'Erwartungswert', lvl: 1, gen() {
  const D = randDist(R.int(3, 4));
  return { q: `Die Zufallsgröße X hat folgende Wahrscheinlichkeitsverteilung:${distTable(D.xs, D.ps)}Berechne den Erwartungswert E(X).`, type: 'num', answer: D.E, tol: TOL,
    hints: ['E(X) = Summe aus „Wert mal Wahrscheinlichkeit“: E(X) = x₁·P(X = x₁) + x₂·P(X = x₂) + …', `E(X) = ${eSteps(D.xs, D.ps)}`],
    steps: [`E(X) = ${eSteps(D.xs, D.ps)}`, `= ${D.xs.map((x, i) => n(x * D.ps[i], 2)).join(' + ').replace(/\+ −/g, '− ')} = ${n(D.E, 4)}`, res(`E(X) = ${n(D.E, 4)}`)] };
} });

def({ id: 'zgr_fehlend', ch: 'zgr', name: 'Fehlende Wahrscheinlichkeit', lvl: 1, gen() {
  const D = randDist(4), i = R.int(0, 3), shown = D.ps.map((x, j) => j === i ? '?' : x);
  return { q: `Vervollständige die Wahrscheinlichkeitsverteilung:${distTable(D.xs, shown)}Welche Zahl gehört an die Stelle „?“`, type: 'num', answer: D.ps[i], tol: TOL,
    hints: ['Die Wahrscheinlichkeiten einer Verteilung ergeben zusammen immer 1.', `? = 1 − (${D.ps.filter((_, j) => j !== i).map(x => n(x, 2)).join(' + ')})`],
    steps: [`Summe der bekannten Werte: ${n(1 - D.ps[i], 2)}`, `? = 1 − ${n(1 - D.ps[i], 2)} = ${n(D.ps[i], 2)}`, res(`? = ${n(D.ps[i], 2)}`)] };
} });

def({ id: 'zgr_varianz', ch: 'zgr', name: 'Varianz und Standardabweichung', lvl: 2, gen() {
  const D = randDist(3), V = sum(D.xs.map((x, i) => (x - D.E) ** 2 * D.ps[i])), sd = Math.sqrt(V), wantSd = R.chance(0.5);
  return { q: `Gegeben ist die Wahrscheinlichkeitsverteilung von X:${distTable(D.xs, D.ps)}Berechne ${wantSd ? 'die Standardabweichung σ' : 'die Varianz V(X)'}.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: wantSd ? sd : V, tol: 0.011,
    hints: [`Zuerst E(X) = μ berechnen. Dann V(X) = Σ (xᵢ − μ)² · P(X = xᵢ)${wantSd ? ' und σ = √V(X)' : ''}.`, `μ = ${n(D.E, 4)}.`],
    steps: [`μ = E(X) = ${n(D.E, 4)}`, `V(X) = ${D.xs.map((x, i) => `(${n(x)} − ${p(D.E)})²·${n(D.ps[i], 2)}`).join(' + ')} ≈ ${n(V, 4)}`, ...(wantSd ? [`σ = √${n(V, 4)} ≈ ${n(sd, 4)}`] : []), res(wantSd ? `σ ≈ ${n(sd)}` : `V(X) ≈ ${n(V)}`)] };
} });

function wheel() {
  const [ps, lab] = R.pick([[[1 / 2, 1 / 3, 1 / 6], ['½', '⅓', '⅙']], [[1 / 2, 1 / 4, 1 / 4], ['½', '¼', '¼']], [[3 / 4, 1 / 6, 1 / 12], ['¾', '⅙', '1/12']], [[0.6, 0.3, 0.1], ['0,6', '0,3', '0,1']], [[0.5, 0.4, 0.1], ['0,5', '0,4', '0,1']]]);
  const pay = [0, R.pick([1, 2]), R.pick([5, 6, 8, 10])];
  return { ps, lab, pay, E: sum(pay.map((x, i) => x * ps[i])) };
}
const wheelTxt = W => `Ein Glücksrad hat drei Felder: „Niete“ (Wahrscheinlichkeit ${W.lab[0]}, Auszahlung 0 €), „Klein“ (${W.lab[1]}, ${W.pay[1]} €) und „Groß“ (${W.lab[2]}, ${W.pay[2]} €).`;
def({ id: 'zgr_fair', ch: 'zgr', name: 'Faires Spiel', lvl: 2, gen() {
  const W = wheel();
  if (R.chance(0.5)) return { q: `${wheelTxt(W)}<br>Wie hoch muss der Einsatz sein, damit das Spiel <b>fair</b> ist?<br><small>In €, auf 2 Nachkommastellen.</small>`, type: 'num', answer: W.E, tol: 0.011, unit: '€',
    hints: ['Ein Spiel ist fair, wenn der Erwartungswert des Gewinns 0 ist – also Einsatz = erwartete Auszahlung.', `E(Auszahlung) = 0·${W.lab[0]} + ${W.pay[1]}·${W.lab[1]} + ${W.pay[2]}·${W.lab[2]}.`],
    steps: [`E(Auszahlung) = 0·${W.lab[0]} + ${W.pay[1]}·${W.lab[1]} + ${W.pay[2]}·${W.lab[2]} ≈ ${n(W.E, 4)} €`, `Fair ⇔ Einsatz = E(Auszahlung)`, res(`Einsatz ≈ ${n(W.E)} €`)] };
  const e = R.pick([1, 2, 3]), g = W.E - e;
  return { q: `${wheelTxt(W)}<br>Ein Spiel kostet ${e} € Einsatz. Berechne den Erwartungswert des <b>Gewinns</b> pro Spiel (Auszahlung minus Einsatz).<br><small>In €, auf 2 Nachkommastellen, negativ bei Verlust.</small>`, type: 'num', answer: g, tol: 0.011, unit: '€',
    hints: ['Gewinn = Auszahlung − Einsatz. Also E(Gewinn) = E(Auszahlung) − Einsatz.', `E(Auszahlung) ≈ ${n(W.E, 4)} €.`],
    steps: [`E(Auszahlung) = ${W.pay[1]}·${W.lab[1]} + ${W.pay[2]}·${W.lab[2]} ≈ ${n(W.E, 4)}`, `E(Gewinn) = ${n(W.E, 4)} − ${e} ≈ ${n(g)}`, res(`${n(g)} € pro Spiel – ${g < 0 ? 'auf Dauer verliert man' : g > 0 ? 'auf Dauer gewinnt man' : 'fair'}`)] };
} });

def({ id: 'zgr_vert', ch: 'zgr', name: 'Wahrscheinlichkeitsverteilung aufstellen', lvl: 2, gen() {
  if (R.chance(0.5)) {
    const m = R.pick([3, 4]), k = R.int(0, m);
    return probAns(C(m, k) / 2 ** m, { q: `Eine Münze wird ${m}-mal geworfen. X ist die Anzahl von „Zahl“. Berechne P(X = ${k}).<br>${PROB}`,
      hints: [`Es gibt 2${K.sup(m)} = ${2 ** m} gleich wahrscheinliche Ergebnisse.`, `Zähle die Ergebnisse mit genau ${k}-mal „Zahl“: das sind ${binom(m, k)} Stück.`],
      steps: [`Alle Ergebnisse: ${2 ** m}`, `Günstige: ${binom(m, k)} = ${C(m, k)}`, `P(X = ${k}) = ${C(m, k)}/${2 ** m} = ${fr(C(m, k), 2 ** m)}`, res(`P(X = ${k}) = ${fr(C(m, k), 2 ** m)}`)] });
  }
  const { r, b, N } = urn(), k = R.int(0, 2), num = [b * (b - 1), 2 * r * b, r * (r - 1)][k], D = N * (N - 1);
  return probAns(num / D, { q: `Aus einer Urne mit ${r} roten und ${b} blauen Kugeln werden zwei Kugeln ohne Zurücklegen gezogen. X ist die Anzahl der roten Kugeln. Berechne P(X = ${k}).<br>${PROB}`,
    hints: ['Zeichne ein zweistufiges Baumdiagramm (ohne Zurücklegen!).', `X = ${k} heißt: ${['beide blau', 'eine rote und eine blaue (zwei Pfade!)', 'beide rot'][k]}.`],
    steps: [[`P(X = 0) = ${fr(b, N)} · ${fr(b - 1, N - 1)}`, `P(X = 1) = ${fr(r, N)} · ${fr(b, N - 1)} + ${fr(b, N)} · ${fr(r, N - 1)}`, `P(X = 2) = ${fr(r, N)} · ${fr(r - 1, N - 1)}`][k] + ` = ${fr(num, D)}`, res(`P(X = ${k}) = ${fr(num, D)} ${approx(num / D)}`)] });
} });

// =====================================================================
// Kapitel 6: Kenngrößen von Daten
// =====================================================================
const DATA_CTX = [['Punktzahlen in einem Test', 'Punkte'], ['Tore pro Spiel einer Fußballmannschaft', 'Tore'], ['Wartezeiten an einer Kasse', 'Minuten'], ['verkaufte Eis-Kugeln pro Stunde', 'Kugeln']];
function dataset(k = R.int(7, 10)) { return Array.from({ length: k }, () => R.int(0, 15)); }
const listTxt = d => d.join('; ');
def({ id: 'sta_mittel', ch: 'sta', name: 'Arithmetisches Mittel', lvl: 1, gen() {
  const d = dataset(), [c] = R.pick(DATA_CTX), m = sum(d) / d.length;
  return { q: `${c}: ${listTxt(d)}<br>Berechne das arithmetische Mittel.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: m, tol: 0.011,
    hints: ['Arithmetisches Mittel = Summe aller Werte geteilt durch die Anzahl der Werte.', `Summe = ${sum(d)}, Anzahl = ${d.length}.`],
    steps: [`x̄ = (${d.join(' + ')}) / ${d.length} = ${sum(d)} / ${d.length} ≈ ${n(m, 4)}`, res(`x̄ ≈ ${n(m)}`)] };
} });

def({ id: 'sta_median', ch: 'sta', name: 'Median', lvl: 1, gen() {
  const d = dataset(), [c] = R.pick(DATA_CTX), s = d.slice().sort((a, b) => a - b), k = s.length;
  const med = k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2;
  return { q: `${c}: ${listTxt(d)}<br>Bestimme den Median.`, type: 'num', answer: med, tol: 0.011,
    hints: ['Sortiere die Werte zuerst der Größe nach. Der Median ist der Wert in der Mitte.', `Es sind ${k} Werte – ${k % 2 ? 'ungerade, also gibt es genau einen mittleren Wert' : 'gerade, also nimmst du den Mittelwert der beiden mittleren Werte'}.`],
    steps: [`Sortiert: ${s.join('; ')}`, k % 2 ? `Mittlerer (${(k + 1) / 2}.) Wert: ${med}` : `Die beiden mittleren Werte: ${s[k / 2 - 1]} und ${s[k / 2]} ⇒ (${s[k / 2 - 1]} + ${s[k / 2]}) / 2 = ${n(med)}`, res(`Median = ${n(med)}`)] };
} });

def({ id: 'sta_modal', ch: 'sta', name: 'Modalwert und Spannweite', lvl: 1, gen() {
  let d; do { d = dataset(); const m = R.pick(d); d.push(m, m); } while ((() => { const c = {}; d.forEach(x => { c[x] = (c[x] || 0) + 1; }); const mx = Math.max(...Object.values(c)); return Object.values(c).filter(v => v === mx).length > 1; })());
  d = R.shuffle(d);
  const cnt = {}; d.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
  const mode = Number(Object.keys(cnt).find(k => cnt[k] === Math.max(...Object.values(cnt)))), sp = Math.max(...d) - Math.min(...d);
  const [c] = R.pick(DATA_CTX);
  return { q: `${c}: ${listTxt(d)}<br>Gib den Modalwert und die Spannweite an.`, type: 'tpl', tpl: 'Modalwert: {} &nbsp; Spannweite: {}', answer: [mode, sp],
    hints: ['Modalwert = der Wert, der am häufigsten vorkommt. Spannweite = größter Wert − kleinster Wert.', `Größter Wert: ${Math.max(...d)}, kleinster Wert: ${Math.min(...d)}.`],
    steps: [`Sortiert: ${d.slice().sort((a, b) => a - b).join('; ')}`, `Am häufigsten: ${mode} (${cnt[mode]}-mal) ⇒ Modalwert ${mode}`, `Spannweite: ${Math.max(...d)} − ${Math.min(...d)} = ${sp}`, res(`Modalwert ${mode}, Spannweite ${sp}`)] };
} });

def({ id: 'sta_streu', ch: 'sta', name: 'Streumaße einer Stichprobe', lvl: 2, gen() {
  const d = dataset(R.int(5, 7)), m = sum(d) / d.length, k = d.length, v = R.int(0, 2);
  const mla = sum(d.map(x => Math.abs(x - m))) / k, V = sum(d.map(x => (x - m) ** 2)) / k, sd = Math.sqrt(V);
  const [name, val, form] = [['die mittlere lineare Abweichung (vom Mittelwert)', mla, `(${d.map(x => `|${x} − ${n(m, 2)}|`).join(' + ')}) / ${k}`], ['die Varianz (Teiler n)', V, `(${d.map(x => `(${x} − ${n(m, 2)})²`).join(' + ')}) / ${k}`], ['die Standardabweichung (Teiler n)', sd, `√V mit V = (${d.map(x => `(${x} − ${n(m, 2)})²`).join(' + ')}) / ${k}`]][v];
  return { q: `Stichprobe: ${listTxt(d)}<br>Berechne ${name}.<br><small>Auf 2 Nachkommastellen.</small>`, type: 'num', answer: val, tol: 0.011,
    hints: [`Erst den Mittelwert x̄ berechnen: x̄ = ${sum(d)} / ${k} ≈ ${n(m, 4)}.`, ['Mittlere lineare Abweichung: Mittelwert der Abstände |xᵢ − x̄|.', 'Varianz: Mittelwert der quadrierten Abweichungen (xᵢ − x̄)².', 'Standardabweichung: Wurzel aus der Varianz (mittlere quadratische Abweichung).'][v]],
    steps: [`x̄ = ${sum(d)} / ${k} ≈ ${n(m, 4)}`, `${form} ≈ ${n(val, 4)}`, res(`≈ ${n(val)}`)] };
} });

// =====================================================================
// Kapitel 7: Binomialverteilung
// =====================================================================
const BIN_YES = ['Ein Würfel wird 10-mal geworfen; X zählt die Sechsen.', 'Eine Münze wird 20-mal geworfen; X zählt, wie oft „Zahl“ fällt.', 'Aus einer Urne mit 3 roten und 7 blauen Kugeln wird 5-mal <b>mit</b> Zurücklegen gezogen; X zählt die roten Kugeln.', 'Ein Basketballer mit fester Trefferquote 70 % wirft 8 Freiwürfe (unabhängig); X zählt die Treffer.'];
const BIN_NO = ['Aus einer Urne mit 3 roten und 7 blauen Kugeln wird 5-mal <b>ohne</b> Zurücklegen gezogen; X zählt die roten Kugeln.', 'Ein Würfel wird so lange geworfen, bis die erste Sechs fällt; X zählt die Würfe.', 'Ein Würfel wird 10-mal geworfen; X ist die Augensumme.', 'Aus einer Klasse mit 12 Mädchen und 13 Jungen werden 4 Personen ausgelost; X zählt die Mädchen.', 'Ein Glücksrad mit den Feldern rot, gelb und blau wird 5-mal gedreht; X ist die Anzahl verschiedener Farben.'];
def({ id: 'bin_erkennen', ch: 'bin', name: 'Ist das eine Bernoulli-Kette?', lvl: 1, gen() {
  const correct = R.pick(BIN_YES);
  return Object.assign(mc(correct, R.shuffle(BIN_NO).slice(0, 3)), {
    q: 'Bei welcher Zufallsgröße X liegt eine <b>Binomialverteilung</b> vor?',
    hints: ['Binomialverteilung = Bernoulli-Kette: feste Anzahl n von Versuchen, nur zwei Ausgänge (Treffer/Niete), Trefferwahrscheinlichkeit p bleibt <b>immer gleich</b> (Versuche unabhängig). X zählt die Treffer.', 'Ohne Zurücklegen ändert sich p. „Bis zum ersten Treffer“ hat keine feste Anzahl. Eine Augensumme zählt keine Treffer.'],
    steps: ['Prüfe: feste Anzahl n? Nur Treffer/Niete? Gleiches p bei jedem Versuch? X = Anzahl der Treffer?', `Nur hier ist alles erfüllt: ${correct}`, res(correct)],
  });
} });

const BIN_P = [0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9];
function binSetup() { const nn = R.int(8, 30), q = R.pick(BIN_P); return { nn, q, mu: nn * q }; }
const binCtx = (nn, q) => R.pick([`Ein Spieler trifft beim Elfmeter mit der Wahrscheinlichkeit ${n(q)}. Er schießt ${nn} Elfmeter.`, `Ein Saatkorn keimt mit der Wahrscheinlichkeit ${n(q)}. Es werden ${nn} Körner gesät.`, `Ein Bauteil ist mit der Wahrscheinlichkeit ${n(q)} fehlerhaft. Es werden ${nn} Bauteile geprüft.`]);
def({ id: 'bin_punkt', ch: 'bin', name: 'P(X = k)', lvl: 2, gen() {
  const { nn, q, mu } = binSetup(), k = Math.max(0, Math.min(nn, Math.round(mu) + R.int(-2, 2))), v = pdf(nn, q, k);
  return probAns(v, { q: `X ist binomialverteilt mit n = ${nn} und p = ${n(q)}. Berechne P(X = ${k}).<br><small>Auf 3 Nachkommastellen oder in % (1 Stelle).</small>`,
    hints: [`Bernoulli-Formel: P(X = k) = ${binom('n', 'k')} · p<sup>k</sup> · (1 − p)<sup>n − k</sup>.`, `P(X = ${k}) = ${binom(nn, k)} · ${n(q)}<sup>${k}</sup> · ${n(1 - q)}<sup>${nn - k}</sup>. Taschenrechner: binompdf(${nn}; ${n(q)}; ${k}).`],
    steps: [`P(X = ${k}) = ${binom(nn, k)} · ${n(q)}<sup>${k}</sup> · ${n(1 - q)}<sup>${nn - k}</sup>`, `${binom(nn, k)} = ${C(nn, k)}`, `P(X = ${k}) ≈ ${n(v, 4)}`, res(`P(X = ${k}) ≈ ${n(v, 3)} (${n(100 * v, 1)} %)`)] });
} });

def({ id: 'bin_kumul', ch: 'bin', name: 'Kumulierte Wahrscheinlichkeiten', lvl: 2, gen() {
  const { nn, q, mu } = binSetup(), k = Math.max(1, Math.min(nn - 1, Math.round(mu) + R.int(-3, 3))), v = R.int(0, 4);
  const a = Math.max(0, k - R.int(1, 3)), b = Math.min(nn, k + R.int(1, 3));
  const [txt, sym, val, conv] = [
    [`höchstens ${k}`, `P(X ≤ ${k})`, cdf(nn, q, k), `P(X ≤ ${k}) – direkt mit binomcdf`],
    [`weniger als ${k}`, `P(X &lt; ${k})`, cdf(nn, q, k - 1), `P(X &lt; ${k}) = P(X ≤ ${k - 1})`],
    [`mindestens ${k}`, `P(X ≥ ${k})`, 1 - cdf(nn, q, k - 1), `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1})`],
    [`mehr als ${k}`, `P(X > ${k})`, 1 - cdf(nn, q, k), `P(X > ${k}) = 1 − P(X ≤ ${k})`],
    [`mindestens ${a} und höchstens ${b}`, `P(${a} ≤ X ≤ ${b})`, cdf(nn, q, b) - cdf(nn, q, a - 1), `P(${a} ≤ X ≤ ${b}) = P(X ≤ ${b}) − P(X ≤ ${a - 1})`],
  ][v];
  return probAns(val, { q: `${binCtx(nn, q)} X sei die Anzahl der Treffer (Erfolge). Mit welcher Wahrscheinlichkeit sind es <b>${txt}</b>?<br><small>Auf 3 Nachkommastellen oder in % (1 Stelle).</small>`,
    hints: ['Übersetze den Text: „höchstens k“ = X ≤ k, „weniger als k“ = X ≤ k − 1, „mindestens k“ = 1 − P(X ≤ k − 1), „mehr als k“ = 1 − P(X ≤ k).', `Hier: ${conv}. Taschenrechner: binomcdf(n; p; k) liefert P(X ≤ k).`],
    steps: [`X ~ B(${nn}; ${n(q)})`, `${sym}: ${conv}`, `${sym} ≈ ${n(val, 4)}`, res(`${sym} ≈ ${n(val, 3)} (${n(100 * val, 1)} %)`)] });
} });

def({ id: 'bin_kenn', ch: 'bin', name: 'Erwartungswert und σ', lvl: 1, gen() {
  const { nn, q } = binSetup(), mu = nn * q, sd = Math.sqrt(nn * q * (1 - q));
  return { q: `X ist binomialverteilt mit n = ${nn} und p = ${n(q)}. Berechne Erwartungswert μ und Standardabweichung σ.<br><small>σ auf 2 Nachkommastellen.</small>`, type: 'tpl', tpl: 'μ = {} &nbsp; σ = {}', answer: [mu, sd], tol: 0.011,
    hints: ['Für binomialverteilte X gilt: μ = n · p und σ = √(n · p · (1 − p)).', `μ = ${nn} · ${n(q)}, σ = √(${nn} · ${n(q)} · ${n(1 - q)}).`],
    steps: [`μ = ${nn} · ${n(q)} = ${n(mu)}`, `σ = √(${nn} · ${n(q)} · ${n(1 - q)}) = √${n(nn * q * (1 - q), 4)} ≈ ${n(sd, 4)}`, res(`μ = ${n(mu)}, σ ≈ ${n(sd)}`)] };
} });

def({ id: 'bin_mindestens', ch: 'bin', name: 'Mindestanzahl von Versuchen', lvl: 3, gen() {
  const [q, txt, act] = R.pick([[1 / 6, 'mindestens eine Sechs', 'würfeln'], [0.1, 'mindestens einen Gewinn (Gewinnwahrscheinlichkeit 0,1 pro Los)', 'Lose kaufen'], [0.2, 'mindestens einen Treffer (Trefferquote 0,2)', 'werfen'], [0.05, 'mindestens ein fehlerhaftes Teil (Fehlerquote 5 %)', 'Teile prüfen'], [0.3, 'mindestens einen Treffer (Trefferquote 0,3)', 'schießen']]);
  const goal = R.pick([0.9, 0.95, 0.99]); let k = 1; while (1 - (1 - q) ** k < goal) k++;
  const qq = q === 1 / 6 ? '5/6' : n(1 - q), qd = Math.log(1 - goal) / Math.log(1 - q);
  return { q: `Wie oft muss man mindestens ${act}, um mit einer Wahrscheinlichkeit von mindestens ${pc(goal)} ${txt} zu erhalten?`, type: 'num', answer: k,
    hints: ['Ansatz: P(X ≥ 1) = 1 − P(X = 0) = 1 − (1 − p)<sup>n</sup> ≥ ' + n(goal) + '.', `(${qq})<sup>n</sup> ≤ ${n(1 - goal)}. Löse mit dem Logarithmus – Achtung: Beim Teilen durch ln(${qq}) < 0 dreht sich das Zeichen um!`],
    steps: [`1 − (${qq})<sup>n</sup> ≥ ${n(goal)} ⇔ (${qq})<sup>n</sup> ≤ ${n(1 - goal)}`, `ln anwenden: n · ln(${qq}) ≤ ln(${n(1 - goal)})`, `Durch ln(${qq}) < 0 teilen (Zeichen dreht sich): n ≥ ln(${n(1 - goal)}) / ln(${qq}) ≈ ${n(qd, 3)}`, `Kleinste ganze Zahl: n = ${k}. Probe: 1 − (${qq})<sup>${k}</sup> ≈ ${n(1 - (1 - q) ** k, 4)} ≥ ${n(goal)} ✓`, res(`mindestens ${k}-mal`)] };
} });

def({ id: 'bin_formel', ch: 'bin', name: 'Terme deuten', lvl: 2, gen() {
  const nn = R.int(8, 20), k = R.int(2, nn - 3), [q, ev] = R.pick([[0.2, 'Treffer'], [0.3, 'Treffer'], [0.25, 'Gewinne']]), qq = n(1 - q), qs = n(q), sg = ev === 'Gewinne' ? 'Gewinn' : 'Treffer';
  const T = [
    [`${binom(nn, k)} · ${qs}<sup>${k}</sup> · ${qq}<sup>${nn - k}</sup>`, `genau ${k} ${ev}`],
    [`1 − ${qq}<sup>${nn}</sup>`, `mindestens einen ${sg}`],
    [`${qq}<sup>${nn}</sup>`, `keinen einzigen ${sg}`],
    [`1 − P(X ≤ ${k})`, `mehr als ${k} ${ev}`],
    [`P(X ≤ ${k})`, `höchstens ${k} ${ev}`],
    [`${qs}<sup>${nn}</sup>`, `nur ${ev}`],
  ];
  const i = R.int(0, T.length - 1);
  return Object.assign(mc(`Die Wahrscheinlichkeit für ${T[i][1]}.`, R.shuffle(T.filter((_, j) => j !== i)).slice(0, 3).map(t => `Die Wahrscheinlichkeit für ${t[1]}.`)), {
    q: `Bei einem Spiel gibt es bei jedem Versuch mit der Wahrscheinlichkeit ${qs} einen ${sg}. Es werden ${nn} Versuche gemacht, X zählt die ${ev}. Welches Ereignis beschreibt der Term <b>${T[i][0]}</b>?`,
    hints: [`${qq}<sup>${nn}</sup> ist die Wahrscheinlichkeit, dass ${nn}-mal hintereinander <b>kein</b> ${sg} kommt. 1 − … ist immer das Gegenereignis.`, `${binom('n', 'k')}·p<sup>k</sup>·(1−p)<sup>n−k</sup> = genau k Treffer. P(X ≤ k) = höchstens k.`],
    steps: [`${T[i][0]} bedeutet: ${T[i][1]}.`, res(`Die Wahrscheinlichkeit für ${T[i][1]}.`)],
  });
} });

def({ id: 'bin_modus', ch: 'bin', name: 'Wahrscheinlichste Trefferzahl', lvl: 2, gen() {
  let nn, q; do { nn = R.int(8, 25); q = R.pick(BIN_P); } while (Number.isInteger(Math.round((nn + 1) * q * 1e9) / 1e9));
  const k = Math.floor((nn + 1) * q);
  const show = [k - 1, k, k + 1].filter(x => x >= 0 && x <= nn);
  return { q: `X ist binomialverteilt mit n = ${nn} und p = ${n(q)}. Welcher Wert von X ist am wahrscheinlichsten (höchste Säule im Histogramm)?`, type: 'num', answer: k,
    hints: [`Die höchste Säule liegt beim Erwartungswert μ = n·p = ${n(nn * q)} oder direkt daneben.`, `Vergleiche P(X = k) für die ganzen Zahlen um ${n(nn * q)}.`],
    steps: [`μ = ${nn}·${n(q)} = ${n(nn * q)}`, show.map(x => `P(X = ${x}) ≈ ${n(pdf(nn, q, x), 4)}`).join(', '), `Am größten bei X = ${k}`, res(`X = ${k}`)] };
} });

// =====================================================================
// Abi-Training Berlin
// =====================================================================
const HMF = ['grd_wuerfel', 'grd_gegen', 'grd_mengen', 'grd_symbol', 'grd_add', 'kom_zaehlen', 'kom_mit', 'kom_ohne', 'bau_pfad', 'bau_drei', 'bau_vft',
  'bed_formel', 'bed_symbol', 'bed_unabh', 'zgr_erwartung', 'zgr_fehlend', 'zgr_vert', 'sta_mittel', 'sta_median', 'sta_modal', 'bin_erkennen', 'bin_formel'];
const teilA = K.makeTeilA(HMF, generate, TYPES, 'Ohne Taschenrechner und ohne Formelsammlung. Im Abitur hast du für den gesamten Teil A (alle drei Sachgebiete) bis zu 100 Minuten. Brüche sind hier oft die einfachste Antwort.');
const P3 = '<br><small>Auf 3 Nachkommastellen oder in % (1 Stelle).</small>';

const EXAMS = [];
// ---------- Schokolinsen ----------
EXAMS.push({ id: 'linsen', title: 'Schokolinsen', gen() {
  const q = R.pick([0.15, 0.2, 0.25]), nn = R.pick([20, 25, 30]), mu = nn * q, sd = Math.sqrt(nn * q * (1 - q));
  const k = Math.round(mu), h = k - 2, m = k + 2, goal = 0.95; let need = 1; while (1 - (1 - q) ** need < goal) need++;
  const ctx = `In einer großen Packung Schokolinsen sind ${pc(q)} der Linsen rot. Eine Tüte enthält ${nn} zufällig abgefüllte Linsen. X ist die Anzahl der roten Linsen in einer Tüte (binomialverteilt).`;
  return { id: 'linsen', title: 'Schokolinsen', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 2, type: 'num', answer: pdf(nn, q, k), tol: TOL, q: `${L('a')}Berechne die Wahrscheinlichkeit, dass genau ${k} Linsen rot sind.${P3}`, hints: ['P(X = k) mit der Bernoulli-Formel oder binompdf.', `binompdf(${nn}; ${n(q)}; ${k})`], steps: [`P(X = ${k}) = ${binom(nn, k)}·${n(q)}<sup>${k}</sup>·${n(1 - q)}<sup>${nn - k}</sup> ≈ ${n(pdf(nn, q, k), 4)}`, res(`≈ ${n(pdf(nn, q, k), 3)}`)] }),
    part({ label: 'b', be: 3, lvl: 2, type: 'num', answer: cdf(nn, q, h), tol: TOL, q: `${L('b')}Berechne die Wahrscheinlichkeit, dass höchstens ${h} Linsen rot sind.${P3}`, hints: ['„Höchstens“ = X ≤ …', `binomcdf(${nn}; ${n(q)}; ${h})`], steps: [`P(X ≤ ${h}) ≈ ${n(cdf(nn, q, h), 4)}`, res(`≈ ${n(cdf(nn, q, h), 3)}`)] }),
    part({ label: 'c', be: 3, lvl: 2, type: 'num', answer: 1 - cdf(nn, q, m - 1), tol: TOL, q: `${L('c')}Berechne die Wahrscheinlichkeit, dass mindestens ${m} Linsen rot sind.${P3}`, hints: ['Mindestens ⇒ Gegenereignis: P(X ≥ k) = 1 − P(X ≤ k − 1).', `1 − binomcdf(${nn}; ${n(q)}; ${m - 1})`], steps: [`P(X ≥ ${m}) = 1 − P(X ≤ ${m - 1}) ≈ 1 − ${n(cdf(nn, q, m - 1), 4)} ≈ ${n(1 - cdf(nn, q, m - 1), 4)}`, res(`≈ ${n(1 - cdf(nn, q, m - 1), 3)}`)] }),
    part({ label: 'd', be: 3, lvl: 1, type: 'tpl', tpl: 'μ = {} &nbsp; σ = {}', answer: [mu, sd], tol: 0.011, q: `${L('d')}Berechne Erwartungswert und Standardabweichung von X.<br><small>σ auf 2 Nachkommastellen.</small>`, hints: ['μ = n·p, σ = √(n·p·(1 − p))', `μ = ${nn}·${n(q)}`], steps: [`μ = ${nn}·${n(q)} = ${n(mu)}`, `σ = √(${nn}·${n(q)}·${n(1 - q)}) ≈ ${n(sd, 4)}`, res(`μ = ${n(mu)}, σ ≈ ${n(sd)}`)] }),
    part({ label: 'e', be: 4, type: 'num', answer: need, q: `${L('e')}Wie viele Linsen muss man mindestens zufällig entnehmen, damit mit einer Wahrscheinlichkeit von mindestens 95 % mindestens eine rote dabei ist?`, hints: ['1 − (1 − p)<sup>n</sup> ≥ 0,95', `${n(1 - q)}<sup>n</sup> ≤ 0,05 ⇒ n ≥ ln(0,05) / ln(${n(1 - q)}) (Zeichen dreht sich!)`], steps: [`${n(1 - q)}<sup>n</sup> ≤ 0,05`, `n ≥ ln(0,05) / ln(${n(1 - q)}) ≈ ${n(Math.log(0.05) / Math.log(1 - q), 3)}`, res(`mindestens ${need} Linsen`)] }),
    part({ label: 'f', be: 2, lvl: 1, ...mc('Die Wahrscheinlichkeit, dass keine der Linsen in der Tüte rot ist.', ['Die Wahrscheinlichkeit, dass alle Linsen rot sind.', 'Die Wahrscheinlichkeit, dass genau eine Linse rot ist.', 'Die Wahrscheinlichkeit, dass mindestens eine Linse rot ist.']), q: `${L('f')}Beschreibe ein Ereignis, dessen Wahrscheinlichkeit mit ${n(1 - q)}<sup>${nn}</sup> berechnet wird.`, hints: [`${n(1 - q)} ist die Wahrscheinlichkeit für eine nicht-rote Linse.`, `${nn}-mal hintereinander „nicht rot“ …`], steps: [res('Keine der Linsen ist rot.')] }),
  ] };
} });

// ---------- Corona-/Grippetest ----------
EXAMS.push({ id: 'test', title: 'Schnelltest', gen() {
  const q = R.pick([0.02, 0.04, 0.05, 0.08]), s = R.pick([0.9, 0.95]), t = R.pick([0.96, 0.98]), Nn = 10000;
  const kp = Nn * q * s, kn = Nn * q - kp, gp = Nn * (1 - q) * (1 - t), gn = Nn * (1 - q) - gp, P = kp + gp;
  const lab = ['krank', 'gesund', 'positiv', 'negativ'];
  const ctx = `Eine Grippe-Welle: ${pc(q)} der Bevölkerung sind erkrankt. Ein Schnelltest zeigt bei Erkrankten mit ${pc(s)} Wahrscheinlichkeit „positiv“, bei Gesunden mit ${pc(t)} Wahrscheinlichkeit „negativ“. Betrachtet werden ${Nn} zufällig ausgewählte Personen.`;
  return { id: 'test', title: 'Schnelltest', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, type: 'num', answer: kp, q: `${L('a')}Wie viele der ${Nn} Personen sind zu erwarten, die krank sind <b>und</b> positiv getestet werden?`, hints: [`Erst die Kranken: ${Nn}·${n(q)}.`, `Davon ${pc(s)} positiv.`], steps: [`${Nn}·${n(q)} = ${n(Nn * q)} Kranke`, `${n(Nn * q)}·${n(s)} = ${n(kp)}`, res(n(kp))] }),
    part({ label: 'b', be: 3, lvl: 2, type: 'num', answer: P / Nn, tol: TOL, q: `${L('b')}Berechne die Wahrscheinlichkeit, dass eine zufällig gewählte Person positiv getestet wird.<br>${PROB}`, hints: ['Positiv können Kranke (richtig) und Gesunde (Fehlalarm) sein.', `Gesund & positiv: ${n(Nn * (1 - q))}·${n(1 - t)} = ${n(gp)}.`], steps: [`krank & positiv: ${n(kp)}; gesund & positiv: ${n(gp)}`, `P(positiv) = (${n(kp)} + ${n(gp)}) / ${Nn} = ${pr(P / Nn)}`, res(`P(positiv) = ${pr(P / Nn)}`)] }),
    part({ label: 'c', be: 4, type: 'num', answer: kp / P, tol: TOL, q: `${L('c')}Eine Person wird positiv getestet. Mit welcher Wahrscheinlichkeit ist sie tatsächlich krank?<br>${PROB}`, hints: ['Bedingte Wahrscheinlichkeit: Grundgesamtheit sind jetzt nur die positiv Getesteten.', `P = ${n(kp)} / ${n(P)}`], steps: [`Vierfeldertafel (erwartete Anzahlen):${vft([[kp, kn, Nn * q], [gp, gn, Nn * (1 - q)], [P, Nn - P, Nn]], lab)}`, `P<sub>positiv</sub>(krank) = ${n(kp)} / ${n(P)} ≈ ${pr(kp / P)}`, res(`≈ ${pr(kp / P)}`)] }),
    part({ label: 'd', be: 3, lvl: 2, type: 'num', answer: gn / (Nn - P), tol: TOL, q: `${L('d')}Eine Person wird negativ getestet. Mit welcher Wahrscheinlichkeit ist sie tatsächlich gesund?<br>${PROB}`, hints: ['Grundgesamtheit: alle negativ Getesteten.', `Negativ insgesamt: ${n(Nn - P)}; davon gesund: ${n(gn)}.`], steps: [`P<sub>negativ</sub>(gesund) = ${n(gn)} / ${n(Nn - P)} ≈ ${pr(gn / (Nn - P))}`, res(`≈ ${pr(gn / (Nn - P))}`)] }),
    part({ label: 'e', be: 2, lvl: 2, ...mc('Weil es viel mehr Gesunde als Kranke gibt, sind unter den positiven Tests viele Fehlalarme.', ['Weil der Test bei Kranken meistens versagt.', 'Weil Kranke häufiger getestet werden als Gesunde.', 'Weil P(positiv) größer als 1 ist.']), q: `${L('e')}Warum ist die Wahrscheinlichkeit aus c) deutlich kleiner als ${pc(s)}?`, hints: ['Vergleiche die Anzahl „gesund & positiv“ mit „krank & positiv“.', `${n(gp)} Fehlalarme gegenüber ${n(kp)} richtigen Treffern.`], steps: [res('Viele Gesunde ⇒ auch wenige Fehlalarme pro Person ergeben insgesamt viele falsch-positive Tests.')] }),
    part({ label: 'f', be: 2, lvl: 2, type: 'choice', options: ['Ja, unabhängig.', 'Nein, abhängig.'], answer: 1, q: `${L('f')}Sind die Ereignisse „krank“ und „positiv getestet“ stochastisch unabhängig?`, hints: ['Unabhängig hieße: P<sub>krank</sub>(positiv) = P(positiv).', `P<sub>krank</sub>(positiv) = ${n(s)}, P(positiv) = ${pr(P / Nn)}.`], steps: [`${n(s)} ≠ ${pr(P / Nn)} ⇒ abhängig (zum Glück – sonst wäre der Test nutzlos).`, res('abhängig')] }),
  ] };
} });

// ---------- Glücksrad ----------
EXAMS.push({ id: 'gluecksrad', title: 'Glücksrad', gen() {
  const W = wheel(), e = Math.ceil(W.E) + R.pick([0, 1]);
  const V = sum(W.pay.map((x, i) => (x - W.E) ** 2 * W.ps[i])), sd = Math.sqrt(V), pG = W.ps[2];
  const nn = 10, mind2 = 1 - cdf(nn, pG, 1);
  const ctx = `${wheelTxt(W)} Ein Spiel kostet ${e} € Einsatz. X ist die Auszahlung bei einem Spiel.`;
  return { id: 'gluecksrad', title: 'Glücksrad', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, type: 'num', answer: pG * pG, tol: TOL, q: `${L('a')}Das Rad wird zweimal gedreht. Berechne die Wahrscheinlichkeit, dass beide Male „Groß“ erscheint.<br>${PROB}`, hints: ['Pfadregel: multiplizieren.', `${W.lab[2]} · ${W.lab[2]}`], steps: [`${W.lab[2]} · ${W.lab[2]} = ${pr(pG * pG)}`, res(pr(pG * pG))] }),
    part({ label: 'b', be: 3, lvl: 2, type: 'num', answer: W.E, tol: 0.011, unit: '€', q: `${L('b')}Berechne den Erwartungswert der Auszahlung X.<br><small>Auf 2 Nachkommastellen.</small>`, hints: ['E(X) = Σ xᵢ·P(X = xᵢ)', `0·${W.lab[0]} + ${W.pay[1]}·${W.lab[1]} + ${W.pay[2]}·${W.lab[2]}`], steps: [`E(X) = 0·${W.lab[0]} + ${W.pay[1]}·${W.lab[1]} + ${W.pay[2]}·${W.lab[2]} ≈ ${n(W.E, 4)}`, res(`≈ ${n(W.E)} €`)] }),
    part({ label: 'c', be: 2, lvl: 2, type: 'num', answer: W.E - e, tol: 0.011, unit: '€', q: `${L('c')}Berechne den erwarteten Gewinn des Spielers pro Spiel (Auszahlung minus Einsatz).<br><small>Auf 2 Nachkommastellen, negativ bei Verlust.</small>`, hints: ['E(Gewinn) = E(X) − Einsatz', `${n(W.E, 4)} − ${e}`], steps: [`${n(W.E, 4)} − ${e} ≈ ${n(W.E - e)}`, res(`≈ ${n(W.E - e)} € pro Spiel`)] }),
    part({ label: 'd', be: 3, lvl: 2, type: 'num', answer: W.E, tol: 0.011, unit: '€', q: `${L('d')}Bei welchem Einsatz wäre das Spiel fair?<br><small>Auf 2 Nachkommastellen.</small>`, hints: ['Fair heißt: erwarteter Gewinn = 0.', 'Also Einsatz = E(X).'], steps: [`Einsatz = E(X) ≈ ${n(W.E)} €`, res(`≈ ${n(W.E)} €`)] }),
    part({ label: 'e', be: 3, type: 'num', answer: sd, tol: 0.011, unit: '€', q: `${L('e')}Berechne die Standardabweichung der Auszahlung X.<br><small>Auf 2 Nachkommastellen.</small>`, hints: ['V(X) = Σ (xᵢ − μ)²·P(X = xᵢ), σ = √V(X)', `μ ≈ ${n(W.E, 4)}`], steps: [`V(X) = ${W.pay.map((x, i) => `(${x} − ${n(W.E, 3)})²·${W.lab[i]}`).join(' + ')} ≈ ${n(V, 4)}`, `σ = √V(X) ≈ ${n(sd, 4)}`, res(`σ ≈ ${n(sd)} €`)] }),
    part({ label: 'f', be: 3, type: 'num', answer: mind2, tol: TOL, q: `${L('f')}Jemand spielt ${nn}-mal. Mit welcher Wahrscheinlichkeit erscheint mindestens zweimal „Groß“?${P3}`, hints: [`Y = Anzahl „Groß“ ist binomialverteilt mit n = ${nn}, p = ${n(pG, 4)}.`, 'P(Y ≥ 2) = 1 − P(Y ≤ 1)'], steps: [`P(Y ≥ 2) = 1 − P(Y ≤ 1) = 1 − (${n(pdf(nn, pG, 0), 4)} + ${n(pdf(nn, pG, 1), 4)}) ≈ ${n(mind2, 4)}`, res(`≈ ${n(mind2, 3)}`)] }),
  ] };
} });

// ---------- Freiwürfe ----------
EXAMS.push({ id: 'freiwurf', title: 'Freiwürfe', gen() {
  const q = R.pick([0.7, 0.75, 0.8, 0.85]), nn = R.pick([10, 12, 15]), k = Math.round(nn * q) - 1, a = k - 2, b = k + 1;
  const goal = 0.99; let need = 1; while (1 - q ** need <= goal) need++;
  const ctx = `Eine Basketballspielerin trifft einen Freiwurf mit der Wahrscheinlichkeit ${n(q)}. Die Würfe sind unabhängig. Im Training wirft sie ${nn} Freiwürfe; X ist die Anzahl der Treffer.`;
  return { id: 'freiwurf', title: 'Freiwürfe', intro: ctx, parts: [
    part({ label: 'a', be: 2, lvl: 1, type: 'num', answer: q ** nn, tol: TOL, q: `${L('a')}Berechne die Wahrscheinlichkeit, dass sie alle Würfe trifft.${P3}`, hints: ['Alle Treffer = ein einziger Pfad.', `${n(q)}<sup>${nn}</sup>`], steps: [`P(X = ${nn}) = ${n(q)}<sup>${nn}</sup> ≈ ${n(q ** nn, 4)}`, res(`≈ ${n(q ** nn, 3)}`)] }),
    part({ label: 'b', be: 2, lvl: 2, type: 'num', answer: pdf(nn, q, k), tol: TOL, q: `${L('b')}Berechne P(X = ${k}).${P3}`, hints: ['Bernoulli-Formel bzw. binompdf', `binompdf(${nn}; ${n(q)}; ${k})`], steps: [`${binom(nn, k)}·${n(q)}<sup>${k}</sup>·${n(1 - q)}<sup>${nn - k}</sup> ≈ ${n(pdf(nn, q, k), 4)}`, res(`≈ ${n(pdf(nn, q, k), 3)}`)] }),
    part({ label: 'c', be: 3, lvl: 2, type: 'num', answer: 1 - cdf(nn, q, k), tol: TOL, q: `${L('c')}Berechne die Wahrscheinlichkeit, dass sie mehr als ${k}-mal trifft.${P3}`, hints: ['„Mehr als k“ = 1 − P(X ≤ k)', `1 − binomcdf(${nn}; ${n(q)}; ${k})`], steps: [`P(X > ${k}) = 1 − P(X ≤ ${k}) ≈ ${n(1 - cdf(nn, q, k), 4)}`, res(`≈ ${n(1 - cdf(nn, q, k), 3)}`)] }),
    part({ label: 'd', be: 2, lvl: 2, type: 'num', answer: q * q * (1 - q), tol: TOL, q: `${L('d')}Berechne die Wahrscheinlichkeit, dass sie die ersten beiden Würfe trifft und den dritten verfehlt (der Rest ist egal).${P3}`, hints: ['Nur die ersten drei Würfe sind festgelegt, die übrigen sind beliebig (Faktor 1).', `${n(q)}·${n(q)}·${n(1 - q)}`], steps: [`${n(q)}·${n(q)}·${n(1 - q)} = ${pr(q * q * (1 - q))}`, res(`≈ ${n(q * q * (1 - q), 3)}`)] }),
    part({ label: 'e', be: 3, type: 'num', answer: cdf(nn, q, b) - cdf(nn, q, a - 1), tol: TOL, q: `${L('e')}Berechne die Wahrscheinlichkeit, dass sie mindestens ${a}- und höchstens ${b}-mal trifft.${P3}`, hints: ['P(a ≤ X ≤ b) = P(X ≤ b) − P(X ≤ a − 1)', `binomcdf(${nn}; ${n(q)}; ${b}) − binomcdf(${nn}; ${n(q)}; ${a - 1})`], steps: [`P(${a} ≤ X ≤ ${b}) = ${n(cdf(nn, q, b), 4)} − ${n(cdf(nn, q, a - 1), 4)} ≈ ${n(cdf(nn, q, b) - cdf(nn, q, a - 1), 4)}`, res(`≈ ${n(cdf(nn, q, b) - cdf(nn, q, a - 1), 3)}`)] }),
    part({ label: 'f', be: 4, type: 'num', answer: need, q: `${L('f')}Wie viele Freiwürfe muss sie mindestens werfen, damit sie mit einer Wahrscheinlichkeit von mehr als 99 % mindestens einmal danebenwirft?`, hints: [`P(mindestens ein Fehlwurf) = 1 − ${n(q)}<sup>n</sup> > 0,99`, `${n(q)}<sup>n</sup> < 0,01 ⇒ n > ln(0,01) / ln(${n(q)})`], steps: [`${n(q)}<sup>n</sup> < 0,01`, `n > ln(0,01) / ln(${n(q)}) ≈ ${n(Math.log(0.01) / Math.log(q), 3)}`, res(`mindestens ${need} Würfe`)] }),
  ] };
} });

function teilB(id) { const E0 = id ? EXAMS.find(e => e.id === id) : R.pick(EXAMS); return E0.gen(); }

const IQB = 'https://www.iqb.hu-berlin.de/media/exercise_files/Abituraufgaben_Mathematik/';
const LINKS = [
  { title: 'IQB: alle veröffentlichten Abituraufgaben Mathematik', sub: 'Gemeinsamer Aufgabenpool der Länder, aus dem auch Berlin Aufgaben nutzt. Filter: „grundlegend“ + „Stochastik“. Mit Erwartungshorizont (Lösungen).', url: 'https://www.iqb.hu-berlin.de/de/schule/aufgaben/sekii/abiturpruefungsaufgaben-mathematik/' },
  { title: 'Abitur 2025 · Teil A · Stochastik (Aufgabe 1)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2025MgrundlegendAStochastik11_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil A · Stochastik (Aufgabe 2)', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2025MgrundlegendAStochastik12_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil A · Stochastik (Aufgabe 3)', sub: 'grundlegendes Niveau, hilfsmittelfrei, anspruchsvoller', url: IQB + '2025MgrundlegendAStochastik21_Aufgabe.pdf' },
  { title: 'Abitur 2025 · Teil B · Stochastik', sub: 'grundlegendes Niveau, mit Taschenrechner, mit Lösung', url: IQB + '2025MgrundlegendBStochastikWTR1_Aufgabe.pdf' },
  { title: 'Abitur 2024 · Teil A · Stochastik', sub: 'grundlegendes Niveau, hilfsmittelfrei, mit Lösung', url: IQB + '2024MgrundlegendAStochastik11_Aufgabe.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2027', sub: 'Senatsverwaltung für Bildung – was im Abitur drankommt', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2027_gk.pdf' },
  { title: 'Berlin: Prüfungsschwerpunkte Mathematik GK 2028', sub: 'Senatsverwaltung für Bildung', url: 'https://www.berlin.de/sen/bildung/schule/pruefungen-und-abschluesse/abitur/ps_mathematik_2028_gk.pdf' },
];

const APP = {
  key: 'zufalls-quest-v1',
  titles: [['🐣', 'Zufalls-Neuling'], ['🐥', 'Würfel-Werfer'], ['🦊', 'Münz-Fuchs'], ['🦉', 'Baumdiagramm-Eule'], ['🐬', 'Urnen-Taucher'],
    ['🦅', 'Erwartungs-Adler'], ['🐉', 'Binomial-Drache'], ['🧙', 'Bayes-Zauberer'], ['🚀', 'Statistik-Ass'], ['👑', 'Abi-Champion']],
  inputHelp: 'Diese Eingabe verstehe ich nicht. Erlaubt: Zahlen wie 0,25, 3/8 oder 25%.',
};

const api = { APP, CHAPTERS, TYPES, EXAMS, LINKS, teilA, teilB, notenpunkte: K.notenpunkte, generate, check: K.check, parseNum: K.parseNum, withSeed: K.withSeed, R };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.Aufgaben = api;
})(typeof window !== 'undefined' ? window : globalThis);
