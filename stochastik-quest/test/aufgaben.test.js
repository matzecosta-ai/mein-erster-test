// Prüft alle Aufgabentypen und Prüfungsaufgaben: vollständig, lösbar, richtige Antwort wird akzeptiert.
// Aufruf: node test/aufgaben.test.js
const path = require('path');
const A = require(path.join(__dirname, '../web/aufgaben.js'));
let fails = 0;
const fail = (where, msg, task) => { fails++; if (fails <= 25) console.log('✗', where, msg, task ? JSON.stringify({ q: task.q && task.q.slice(0, 160), answer: task.answer }) : ''); };
const str = x => String(x).replace('.', ',');
const isNum = x => typeof x === 'number' && Number.isFinite(x);

function checkTask(t, where) {
  for (const k of ['q', 'hints', 'steps']) if (!t[k] || (Array.isArray(t[k]) && !t[k].length)) return fail(where, 'fehlt: ' + k, t);
  if (t.hints.length < 2) return fail(where, 'weniger als 2 Hinweise', t);
  const html = [t.q, ...t.hints, ...t.steps, ...(t.options || []), t.tpl || ''].join(' ');
  if (/undefined|NaN|Infinity|\[object/.test(html)) return fail(where, 'kaputter Text: ' + html.match(/.{0,40}(undefined|NaN|Infinity|\[object).{0,20}/)[0], t);
  if (t.type === 'choice') {
    if (!Number.isInteger(t.answer) || t.answer < 0 || t.answer >= t.options.length) return fail(where, 'Antwortindex', t);
    if (new Set(t.options).size !== t.options.length) return fail(where, 'doppelte Optionen', t);
    if (!A.check(t, t.answer).ok) return fail(where, 'choice nicht ok', t);
    return;
  }
  if (t.type === 'num') {
    if (!isNum(t.answer)) return fail(where, 'Antwort keine Zahl', t);
    if (!A.check(t, str(t.answer)).ok) return fail(where, 'richtige Antwort abgelehnt', t);
    if (A.check(t, str(t.answer + 1)).ok && (t.tol ?? 1e-6) < 0.9) return fail(where, 'falsche Antwort akzeptiert', t);
    // gerundete Eingabe, wie sie ein Mensch tippt
    if (t.tol >= 0.011 && !A.check(t, str(Math.round(t.answer * 100) / 100)).ok) return fail(where, 'auf 2 Stellen gerundet abgelehnt', t);
    if (t.tol >= 0.0006 && t.tol < 0.011 && !A.check(t, str(Math.round(t.answer * 1000) / 1000)).ok) return fail(where, 'auf 3 Stellen gerundet abgelehnt', t);
    return;
  }
  if (t.type === 'tpl') {
    const slots = t.tpl.split('{}').length - 1;
    if (slots !== t.answer.length) return fail(where, `Felder ${slots} ≠ Antworten ${t.answer.length}`, t);
    if (!t.answer.every(isNum)) return fail(where, 'Antwort keine Zahl', t);
    const input = (t.unordered ? t.answer.slice().reverse() : t.answer).map(str);
    if (!A.check(t, input).ok) return fail(where, 'richtige Antwort abgelehnt', t);
    const wrong = t.answer.map((x, i) => str(i === 0 ? x + 1 : x));
    if (A.check(t, wrong).ok) return fail(where, 'falsche Antwort akzeptiert', t);
    if ((t.tol ?? 0) >= 0.006 && !A.check(t, t.answer.map(x => str(Math.round(x * 100) / 100))).ok) return fail(where, 'auf 2 Stellen gerundet abgelehnt', t);
    // unabhängige numerische Probe (Ableitung bzw. Stammfunktion)
    const xs = [0.3, 0.7, 1.3, 2.1];
    if (t._f && t._df) { const d = t._df(t.answer); for (const x of xs) { const h = 1e-5, num = (t._f(x + h) - t._f(x - h)) / (2 * h); if (Math.abs(num - d(x)) > 1e-4 * (1 + Math.abs(num))) return fail(where, `Ableitung falsch bei x=${x}: ${num} vs ${d(x)}`, t); } }
    if (t._f && t._F) { const F = t._F(t.answer); for (const x of xs) { const h = 1e-5, num = (F(x + h) - F(x - h)) / (2 * h); if (Math.abs(num - t._f(x)) > 1e-4 * (1 + Math.abs(num))) return fail(where, `Stammfunktion falsch bei x=${x}: ${num} vs ${t._f(x)}`, t); } }
    return;
  }
  fail(where, 'unbekannter Typ ' + t.type, t);
}

const N = Number(process.env.N || 400);
for (const T of A.TYPES) for (let i = 0; i < N; i++) {
  let t; try { t = A.generate(T.id); } catch (e) { fail(T.id, 'Fehler: ' + e.message); break; }
  checkTask(t, T.id);
}
for (const E of A.EXAMS) for (let i = 0; i < 300; i++) {
  const ex = A.teilB(E.id);
  if (!ex.intro || !ex.parts.length) fail(E.id, 'leer');
  ex.parts.forEach(pt => { if (!pt.be || !pt.label) fail(E.id, 'BE/Label fehlt'); checkTask(pt, `${E.id} ${pt.label})`); });
}
for (let i = 0; i < 200; i++) { const ex = A.teilA(); if (ex.parts.length !== 5) fail('teilA', 'nicht 5 Aufgaben'); ex.parts.forEach(pt => checkTask(pt, 'teilA ' + pt.typeId)); }
// Tages-Challenge reproduzierbar
const s1 = A.withSeed(20261122, () => A.generate(A.TYPES[0].id).q), s2 = A.withSeed(20261122, () => A.generate(A.TYPES[0].id).q);
if (s1 !== s2) fail('seed', 'nicht reproduzierbar');
for (const ch of A.CHAPTERS) if (!A.TYPES.some(t => t.ch === ch.id && t.lvl === 1) && !A.TYPES.some(t => t.ch === ch.id)) fail(ch.id, 'Kapitel leer');
if (A.notenpunkte(100) !== 15 || A.notenpunkte(0) !== 0 || A.notenpunkte(50) !== 6) fail('noten', 'Umrechnung');

const be = A.EXAMS.map(E => `${E.id}: ${A.teilB(E.id).parts.reduce((s, p) => s + p.be, 0)} BE`).join(', ');
console.log(`${A.TYPES.length} Aufgabentypen in ${A.CHAPTERS.length} Kapiteln, ${A.EXAMS.length} Prüfungsaufgaben (${be})`);
console.log(fails ? `✗ ${fails} Fehler` : '✓ alle Tests bestanden');
process.exit(fails ? 1 : 0);
