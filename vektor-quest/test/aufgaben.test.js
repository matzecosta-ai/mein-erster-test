// Prüft jeden Aufgabentyp 400-mal: keine Fehler, kein NaN/undefined im Text,
// die hinterlegte Antwort wird vom Prüfer akzeptiert, falsche Antworten nicht.
const A = require('../web/aufgaben.js');
let fails = 0;
const fmtAns = (t) => {
  if (t.type === 'num') return [String(t.answer).replace('.', ',')];
  return t.answer.map(String);
};
for (const T of A.TYPES) {
  const choiceSeen = new Set();
  for (let i = 0; i < 400; i++) {
    let t;
    try { t = A.generate(T.id); } catch (e) { console.log('THROW', T.id, e.message); fails++; break; }
    const all = [t.q, ...t.hints, ...t.steps].join(' ');
    if (/NaN|undefined|Infinity|\[object/.test(all)) { console.log('BAD TEXT', T.id, all.match(/.{40}(NaN|undefined|Infinity|\[object).{40}/)?.[0]); fails++; break; }
    if (t.hints.length !== 2 || t.steps.length < 2) { console.log('HINTS/STEPS', T.id); fails++; break; }
    let r;
    if (t.type === 'choice') { r = A.check(t, t.answer); choiceSeen.add(t.answer); if (A.check(t, (t.answer + 1) % t.options.length).ok) { console.log('CHOICE WRONG OK', T.id); fails++; } }
    else if (t.type === 'num') {
      r = A.check(t, String(Math.round(t.answer * 100) / 100).replace('.', ','));
      if (A.check(t, String(t.answer + 1)).ok) { console.log('NUM WRONG OK', T.id); fails++; }
    } else {
      r = A.check(t, t.answer.map(String));
      if (t.type !== 'vec') { const k = A.check(t, t.answer.map(x => String(-2 * x))); if (!k.ok) { console.log('PAR multiple rejected', T.id); fails++; } }
      const w = t.answer.slice(); const j = t.type === 'vec' ? 0 : Math.max(0, w.findIndex(x => x === 0)); w[j] += 1; if (A.check(t, w.map(String)).ok) { console.log('VEC WRONG OK', T.id, t.answer); fails++; }
      if (!t.tol && t.answer.some(x => !Number.isInteger(x))) { console.log('NON-INT VEC', T.id, t.answer); fails++; break; }
    }
    if (!r.ok) { console.log('ANSWER REJECTED', T.id, t.answer); fails++; break; }
  }
  if (T.gen && choiceSeen.size === 1) { console.log('ONLY ONE CHOICE SEEN', T.id); fails++; }
  console.log('ok', T.id, choiceSeen.size ? [...choiceSeen].sort().join('') : '');
}
// Abi-Training: Teil A und alle Teil-B-Prüfungsaufgaben
function checkPart(t, where) {
  const all = [t.q, ...t.hints, ...t.steps].join(' ');
  if (/NaN|undefined|Infinity|\[object/.test(all)) { console.log('BAD TEXT', where, all.match(/.{40}(NaN|undefined|Infinity|\[object).{40}/)?.[0]); fails++; return false; }
  if (t.hints.length !== 2 || t.steps.length < 2 || !(t.be > 0)) { console.log('HINTS/STEPS/BE', where); fails++; return false; }
  let r;
  if (t.type === 'choice') r = A.check(t, t.answer);
  else if (t.type === 'num') { r = A.check(t, String(Math.round(t.answer * 100) / 100).replace('.', ',')); if (A.check(t, String(t.answer + 1)).ok) { console.log('NUM WRONG OK', where); fails++; } }
  else { r = A.check(t, t.answer.map(String)); }
  if (!r.ok) { console.log('ANSWER REJECTED', where, t.answer); fails++; return false; }
  return true;
}
for (const E of A.EXAMS) {
  const kinds = new Set();
  for (let i = 0; i < 300; i++) {
    let ex; try { ex = A.teilB(E.id); } catch (e) { console.log('THROW', E.id, e.message); fails++; break; }
    if (!ex.intro || ex.parts.length < 5) { console.log('EXAM STRUCT', E.id); fails++; break; }
    if (/NaN|undefined/.test(ex.intro)) { console.log('BAD INTRO', E.id); fails++; break; }
    let ok = true; ex.parts.forEach((t, k) => { if (!checkPart(t, E.id + ' ' + t.label)) ok = false; });
    kinds.add(ex.parts.reduce((s, t) => s + t.be, 0));
    if (!ok) break;
  }
  console.log('ok Prüfung', E.id, 'BE:', [...kinds].join('/'));
}
for (let i = 0; i < 200; i++) { const ex = A.teilA(); if (ex.parts.length !== 5) { console.log('TEIL A'); fails++; break; } ex.parts.forEach(t => checkPart(t, 'TeilA ' + t.typeId)); }
console.log('ok Teil A');
if (A.notenpunkte(100) !== 15 || A.notenpunkte(50) !== 6 || A.notenpunkte(10) !== 0) { console.log('NOTEN'); fails++; }
// Parser
const P = A.parseNum;
const cases = [['3', 3], ['-2,5', -2.5], ['−4', -4], ['3/4', 0.75], ['√16', 4], ['2√9', 6], ['-√4', -2], ['sqrt(9)', 3], ['√14/2', Math.sqrt(14) / 2]];
for (const [s, v] of cases) if (Math.abs(P(s) - v) > 1e-9) { console.log('PARSE', s, P(s)); fails++; }
console.log(fails ? `${fails} FEHLER` : 'ALLE TESTS OK');
process.exit(fails ? 1 : 0);
