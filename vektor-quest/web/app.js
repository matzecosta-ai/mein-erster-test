// Vektor-Quest: Oberfläche, Spielmechanik (XP, Level, Serien, Erfolge) und Speichern.
(function () {
'use strict';
const A = window.Aufgaben;
const $ = s => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// ---------- Spielstand ----------
const KEY = 'vektor-quest-v1';
const fresh = () => ({ xp: 0, total: 0, noHint: 0, lvl3NoHint: 0, solutions: 0, bestCombo: 0, blitzHigh: 0, dailyDone: 0,
  byType: {}, byCh: {}, streak: { days: 0, last: '' }, daily: null, badges: [] });
let S = fresh();
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); } catch (e) { /* ohne Speicher weiterspielen */ }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignorieren */ } }

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- Level ----------
const TITLES = [['🐣', 'Vektor-Neuling'], ['🐥', 'Pfeil-Schubser'], ['🦊', 'Geraden-Gärtner'], ['🦉', 'Ebenen-Entdecker'], ['🐬', 'Skalar-Surfer'],
  ['🦅', 'Kreuzprodukt-Kapitän'], ['🐉', 'Abstands-Ass'], ['🧙', 'Raum-Ritter'], ['🚀', 'Geometrie-Guru'], ['👑', 'Matrix-Meister']];
function levelInfo(xp) {
  let lvl = 1, need = 60, rest = xp;
  while (rest >= need) { rest -= need; lvl++; need = 60 + (lvl - 1) * 30; }
  const t = TITLES[Math.min(lvl - 1, TITLES.length - 1)];
  return { lvl, rest, need, icon: t[0], title: t[1] };
}

// ---------- Erfolge ----------
const BADGES = [
  ['first', '🎯', 'Erster Treffer', 'Die erste Aufgabe gelöst', s => s.total >= 1],
  ['ten', '🔟', 'Warm gelaufen', '10 Aufgaben gelöst', s => s.total >= 10],
  ['fifty', '🏅', 'Fleißbiene', '50 Aufgaben gelöst', s => s.total >= 50],
  ['hundred', '💯', 'Hundert!', '100 Aufgaben gelöst', s => s.total >= 100],
  ['combo5', '🔥', 'Heiße Serie', '5 richtig ohne Hilfe am Stück', s => s.bestCombo >= 5],
  ['combo10', '☄️', 'Unaufhaltsam', '10 richtig ohne Hilfe am Stück', s => s.bestCombo >= 10],
  ['solo', '🧠', 'Alleskönner', '25 Aufgaben ganz ohne Hinweis', s => s.noHint >= 25],
  ['boss', '⚔️', 'Bosskampf', 'Eine ●●●-Aufgabe ohne Hilfe gelöst', s => s.lvl3NoHint >= 1],
  ['learn', '📚', 'Wissensdurst', '10 Lösungswege durchgearbeitet', s => s.solutions >= 10],
  ['blitz10', '⚡', 'Blitzmerker', '10 Punkte in einer Blitzrunde', s => s.blitzHigh >= 10],
  ['blitz20', '🌩️', 'Lichtgeschwindigkeit', '20 Punkte in einer Blitzrunde', s => s.blitzHigh >= 20],
  ['daily1', '🏆', 'Tagessieger', 'Eine Tages-Challenge geschafft', s => s.dailyDone >= 1],
  ['streak3', '📅', 'Dranbleiber', '3 Tage am Stück geübt', s => s.streak.days >= 3],
  ['streak7', '🗓️', 'Wochen-Held', '7 Tage am Stück geübt', s => s.streak.days >= 7],
  ['explorer', '🧭', 'Weltenbummler', 'In jeder Themenwelt einen Stern', s => A.CHAPTERS.every(c => stars(c.id) >= 1)],
  ['master', '🌟', 'Themen-Meister', 'Eine Themenwelt mit 3 Sternen', s => A.CHAPTERS.some(c => stars(c.id) >= 3)],
  ['allmaster', '👑', 'Großmeister', 'Alle Themenwelten mit 3 Sternen', s => A.CHAPTERS.every(c => stars(c.id) >= 3)],
];
function stars(ch) { const c = S.byCh[ch] || 0; return c >= 30 ? 3 : c >= 12 ? 2 : c >= 3 ? 1 : 0; }
const starHtml = k => `<span class="stars">${'★'.repeat(k)}<span class="off">${'★'.repeat(3 - k)}</span></span>`;
const lvlHtml = k => `<span class="lvl-dots">${'●'.repeat(k)}<span class="off">${'●'.repeat(3 - k)}</span></span>`;
function checkBadges() {
  for (const [id, ico, name] of BADGES) {
    if (!S.badges.includes(id) && BADGES.find(b => b[0] === id)[4](S)) { S.badges.push(id); toast(`${ico} Erfolg freigeschaltet: ${name}`); }
  }
}

// ---------- Effekte ----------
function toast(msg) { const t = el('div', 'toast', msg); $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3100); }
function confetti() {
  const fx = $('#fx'), colors = ['#ffb547', '#8a63f2', '#22c1c3', '#ff7a59', '#4fd38e', '#ffe066'];
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.45;
  for (let i = 0; i < 28; i++) {
    const c = el('div', 'confetti');
    const ang = Math.random() * Math.PI * 2, dist = 90 + Math.random() * 160;
    c.style.left = cx + 'px'; c.style.top = cy + 'px'; c.style.background = colors[i % colors.length];
    c.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); c.style.setProperty('--dy', Math.sin(ang) * dist + 120 + 'px');
    c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
    fx.appendChild(c); setTimeout(() => c.remove(), 1400);
  }
}
function xpFloat(text) {
  const f = el('div', 'xpfloat', text); f.style.left = '50%'; f.style.top = '40%';
  $('#fx').appendChild(f); setTimeout(() => f.remove(), 1300);
}
function vibrate(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* egal */ } }

// ---------- Navigation ----------
let view = 'home', chapterId = null;
function show(v) {
  for (const s of document.querySelectorAll('.view')) s.hidden = s.id !== 'v-' + v;
  view = v; window.scrollTo(0, 0);
}
function goHome() { stopTimer(); round = null; renderHome(); show('home'); }
window.appBack = function () { // auch vom Android-Zurück-Knopf aufgerufen
  if (view === 'home') return false;
  if (view === 'task' && round && round.mode === 'type' && chapterId) { stopTimer(); round = null; openChapter(chapterId); return true; }
  if (view === 'task' && round && round.mode === 'chapter') { stopTimer(); round = null; openChapter(chapterId); return true; }
  goHome(); return true;
};
document.addEventListener('click', e => {
  if (e.target.closest('[data-back]')) window.appBack();
  if (e.target.closest('[data-home]')) goHome();
});

// ---------- Startseite ----------
function renderHome() {
  const L = levelInfo(S.xp);
  $('#avatar').textContent = L.icon; $('#lvl-title').textContent = L.title; $('#lvl').textContent = L.lvl;
  $('#xpfill').style.width = (100 * L.rest / L.need) + '%'; $('#xptext').textContent = `${L.rest} / ${L.need} XP bis Level ${L.lvl + 1} · gesamt ${S.xp} XP`;
  const alive = S.streak.last === today() || S.streak.last === yesterday();
  $('#streak-days').textContent = alive ? S.streak.days : 0;
  const d = S.daily && S.daily.date === today() ? S.daily : null;
  $('#daily-status').textContent = !d ? '5 Aufgaben · +50 XP Bonus' : d.finished ? '✅ Heute geschafft – morgen gibt\'s neue!' : `Weiter bei Aufgabe ${d.idx + 1} von 5`;
  $('#blitz-status').textContent = `90 Sekunden · Rekord: ${S.blitzHigh}`;
  const box = $('#chapters'); box.innerHTML = '';
  for (const c of A.CHAPTERS) {
    const cnt = S.byCh[c.id] || 0, st = stars(c.id), next = st === 0 ? 3 : st === 1 ? 12 : st === 2 ? 30 : 30;
    const b = el('button', 'ch-card', `<div class="ch-ico">${c.icon}</div>
      <div class="ch-body"><div class="ch-name">${c.name}</div><div class="ch-desc-s">${c.desc}</div>
      <div class="ch-bar"><div style="width:${Math.min(100, 100 * cnt / next)}%"></div></div></div>${starHtml(st)}`);
    b.onclick = () => openChapter(c.id);
    box.appendChild(b);
  }
  $('#badge-count').textContent = `${S.badges.length}/${BADGES.length}`;
}

function openChapter(id) {
  chapterId = id;
  const c = A.CHAPTERS.find(x => x.id === id);
  $('#ch-title').textContent = `${c.icon} ${c.name}`;
  $('#ch-desc').innerHTML = `${c.desc}<br>${starHtml(stars(id))} &nbsp;${S.byCh[id] || 0} gelöst`;
  const box = $('#ch-types'); box.innerHTML = '';
  for (const t of A.TYPES.filter(t => t.ch === id).sort((a, b) => a.lvl - b.lvl)) {
    const r = el('button', 'type-row', `${lvlHtml(t.lvl)}<span class="tn">${t.name}</span><span class="tc">${S.byType[t.id] ? '✓ ' + S.byType[t.id] : ''}</span>`);
    r.onclick = () => startRound({ mode: 'type', pool: [t.id] });
    box.appendChild(r);
  }
  $('#ch-mix').onclick = () => startRound({ mode: 'chapter', pool: A.TYPES.filter(t => t.ch === id).map(t => t.id) });
  show('chapter');
}

// ---------- Runden ----------
// mode: 'type' | 'chapter' | 'mix' | 'daily' | 'blitz'
let round = null, task = null, ts = null, timer = null;

function startRound(r) {
  round = Object.assign({ combo: 0, score: 0, xp: 0, count: 0, last: null }, r);
  if (r.mode === 'blitz') { round.end = Date.now() + 90000; startTimer(); }
  nextTask();
  show('task');
}
function pickType() {
  const pool = round.pool;
  let id; let guard = 0;
  do { id = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && id === round.last && guard++ < 10);
  round.last = id; return id;
}
function dailySet() {
  const seed = Number(today().replace(/-/g, ''));
  return A.withSeed(seed, () => {
    const chs = A.R.shuffle(A.CHAPTERS.map(c => c.id)).slice(0, 5);
    return chs.map((ch, i) => { const types = A.TYPES.filter(t => t.ch === ch && t.lvl === (i < 2 ? 1 : i < 4 ? 2 : 3)); const list = types.length ? types : A.TYPES.filter(t => t.ch === ch); return A.R.pick(list).id; });
  });
}
function nextTask() {
  if (round.mode === 'daily') {
    const d = S.daily;
    if (d.idx >= 5) return finishDaily();
    const seed = Number(today().replace(/-/g, '')) * 10 + d.idx;
    task = A.withSeed(seed, () => A.generate(d.types[d.idx]));
  } else {
    task = A.generate(pickType());
  }
  ts = { hints: 0, wrong: 0, solved: false, done: false };
  renderTask();
}

function renderTask() {
  const ch = A.CHAPTERS.find(c => c.id === task.ch);
  $('#task-tag').textContent = `${ch.icon} ${ch.name}`;
  $('#task-lvl').innerHTML = lvlHtml(task.lvl);
  $('#task-name').textContent = task.name;
  $('#question').innerHTML = task.q;
  $('#feedback').textContent = ''; $('#feedback').className = 'feedback';
  $('#help').innerHTML = '';
  $('#card').classList.remove('shake');
  const modeNames = { type: 'Gezielt üben', chapter: ch.name, mix: '🎲 Zufallsmix', daily: '🏆 Tages-Challenge', blitz: '⚡ Blitzrunde' };
  $('#task-mode').textContent = modeNames[round.mode];
  renderMeta();
  // Fortschrittspunkte für die Tages-Challenge
  const dots = $('#dots'); dots.innerHTML = '';
  if (round.mode === 'daily') S.daily.results.concat(Array(5 - S.daily.results.length).fill('')).forEach((r, i) => dots.appendChild(el('span', r || (i === S.daily.idx ? 'cur' : ''))));
  buildAnswer();
  updateButtons();
  window.scrollTo(0, 0);
}
function renderMeta() {
  const m = $('#task-meta');
  if (round.mode === 'blitz') {
    const left = Math.max(0, Math.ceil((round.end - Date.now()) / 1000));
    m.innerHTML = `⭐ ${round.score} &nbsp;<span class="timer${left <= 10 ? ' low' : ''}">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>`;
  } else m.innerHTML = round.combo >= 2 ? `🔥 ×${round.combo}` : '';
}
function startTimer() { stopTimer(); timer = setInterval(() => { renderMeta(); if (Date.now() >= round.end) finishBlitz(); }, 250); }
function stopTimer() { if (timer) clearInterval(timer); timer = null; }

// ---------- Eingabefelder ----------
let fields = [], active = null;
function mkField(cls = '') {
  const f = el('input', 'f ' + cls);
  f.setAttribute('inputmode', 'none'); f.autocomplete = 'off'; f.spellcheck = false;
  f.addEventListener('focus', () => setActive(f));
  f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onCheck(); } });
  f.addEventListener('input', () => f.classList.remove('good', 'wrong'));
  fields.push(f); return f;
}
function setActive(f) { fields.forEach(x => x.classList.toggle('active', x === f)); active = f; }
function buildAnswer() {
  const box = $('#answer'); box.innerHTML = ''; fields = []; active = null;
  const kp = $('#keypad');
  if (task.type === 'choice') {
    kp.hidden = true;
    const wrap = el('div', 'choices');
    task.options.forEach((o, i) => { const b = el('button', 'choice', o); b.onclick = () => onChoice(i, b); wrap.appendChild(b); });
    box.appendChild(wrap); return;
  }
  kp.hidden = false;
  if (task.type === 'num') {
    const row = el('div', 'in-row', '<span>Antwort:</span>');
    row.appendChild(mkField('wide'));
    if (task.unit) row.appendChild(el('span', 'unit', task.unit));
    box.appendChild(row);
  } else if (task.type === 'plane') {
    const row = el('div', 'in-plane');
    row.appendChild(el('span', '', 'E:'));
    ['x₁ +', 'x₂ +', 'x₃ ='].forEach(l => { row.appendChild(mkField()); row.appendChild(el('span', '', l)); });
    row.appendChild(mkField());
    box.appendChild(row);
    box.appendChild(el('small', '', '<br>Trag die Zahlen vor x₁, x₂, x₃ und die rechte Seite ein (negativ mit −, 0 wenn ein x fehlt). Vielfache sind auch richtig.'));
  } else { // vec, vecpar
    const k = task.answer.length;
    const v = el('div', 'in-vec' + (task.grid === 2 ? ' grid2' : ''));
    for (let i = 0; i < k; i++) {
      if (task.labels) { const l = el('label', '', task.labels[i]); l.appendChild(mkField()); v.appendChild(l); }
      else v.appendChild(mkField());
    }
    const row = el('div', 'in-row', '<span>Antwort:</span>'); row.appendChild(v); box.appendChild(row);
  }
  setActive(fields[0]);
}
$('#keypad').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !active) return;
  const k = b.dataset.k;
  if (k === 'del') active.value = active.value.slice(0, -1);
  else if (k === 'next') { const i = fields.indexOf(active); setActive(fields[(i + 1) % fields.length]); return; }
  else active.value += k;
  active.classList.remove('good', 'wrong');
  vibrate(8);
});

// ---------- Prüfen & Hilfe ----------
const PRAISE = ['Stark! 💪', 'Volltreffer! 🎯', 'Genial! 🧠', 'Richtig! ✨', 'Läuft bei dir! 🚀', 'Mathe-Magie! 🪄', 'Sauber gerechnet! 👏'];
const TRY = ['Knapp daneben – versuch\'s nochmal! 🤔', 'Noch nicht ganz. Prüf mal die Vorzeichen.', 'Fast! Rechne den Schritt nochmal nach.'];
const pick = a => a[Math.floor(Math.random() * a.length)];

function onChoice(i, btn) {
  if (ts.done) return;
  const r = A.check(task, i);
  if (r.ok) { btn.classList.add('good'); document.querySelectorAll('.choice').forEach(b => b.disabled = true); solved(); }
  else { btn.classList.add('wrong'); btn.disabled = true; wrong(); }
}
function onCheck() {
  if (ts.done) { nextTask(); return; }
  if (task.type === 'choice') return;
  const vals = fields.map(f => f.value);
  if (vals.some(v => v.trim() === '')) { feedback('info', 'Füll erst alle Felder aus.'); return; }
  const r = A.check(task, task.type === 'num' ? vals[0] : vals);
  if (r.invalid) { feedback('info', 'Diese Eingabe verstehe ich nicht. Erlaubt: Zahlen wie −3, 2,5, 3/4 oder √14.'); return; }
  if (r.parts) fields.forEach((f, i) => f.classList.add(r.parts[i] ? 'good' : 'wrong'));
  if (r.ok) { fields.forEach(f => f.classList.add('good')); solved(); }
  else wrong(r.parts ? `${r.parts.filter(Boolean).length} von ${r.parts.length} Einträgen stimmen schon.` : '');
}
function feedback(cls, msg) { const f = $('#feedback'); f.className = 'feedback ' + cls; f.innerHTML = msg; }

function wrong(extra = '') {
  ts.wrong++; round.combo = 0; renderMeta();
  const c = $('#card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
  vibrate([30, 40, 30]);
  if (round.mode === 'blitz') { feedback('bad', 'Falsch – nochmal oder überspringen.'); return; }
  feedback('bad', pick(TRY) + (extra ? ' ' + extra : '') + (ts.wrong >= 2 && ts.hints < 3 ? '<br>💡 Tipp: Hol dir einen Hinweis!' : ''));
  updateButtons();
}

function solved() {
  ts.done = true; ts.solved = true;
  const base = { 1: 10, 2: 15, 3: 20 }[task.lvl];
  let gain;
  if (round.mode === 'blitz') { round.score++; gain = 5; }
  else {
    gain = Math.round(base * [1, 0.7, 0.4, 0][ts.hints]);
    if (ts.hints === 0 && ts.wrong === 0) { round.combo++; if (round.combo >= 2) gain += Math.min(round.combo - 1, 5) * 2; }
    else round.combo = 0;
  }
  const before = levelInfo(S.xp).lvl;
  S.xp += gain; round.xp += gain;
  if (ts.hints < 3) {
    S.total++; S.byType[task.typeId] = (S.byType[task.typeId] || 0) + 1; S.byCh[task.ch] = (S.byCh[task.ch] || 0) + 1;
    if (ts.hints === 0) { S.noHint++; if (task.lvl === 3) S.lvl3NoHint++; }
    const t = today();
    if (S.streak.last !== t) { S.streak.days = S.streak.last === yesterday() ? S.streak.days + 1 : 1; S.streak.last = t; }
  }
  S.bestCombo = Math.max(S.bestCombo, round.combo);
  if (round.mode === 'daily') { S.daily.results[S.daily.idx] = ts.hints === 0 ? 'ok' : ts.hints < 3 ? 'help' : 'skip'; S.daily.idx++; }
  checkBadges(); save();
  if (gain > 0) { confetti(); xpFloat(`+${gain} XP`); vibrate(25); }
  const msg = ts.hints === 3 ? 'Richtig! Jetzt hast du den Weg verstanden. 👍 (Mit Lösungsweg gibt es keine XP.)'
    : `${pick(PRAISE)} +${gain} XP${round.combo >= 2 && round.mode !== 'blitz' ? ` · Serie 🔥×${round.combo}` : ''}${ts.hints ? ` <small>(mit ${ts.hints} Hinweis${ts.hints > 1 ? 'en' : ''})</small>` : ''}`;
  feedback('ok', msg);
  const after = levelInfo(S.xp);
  if (after.lvl > before) toast(`${after.icon} Level ${after.lvl}! Du bist jetzt „${after.title}“`);
  renderMeta(); updateButtons();
  if (round.mode === 'blitz') setTimeout(() => { if (round && round.mode === 'blitz' && view === 'task') nextTask(); }, 450);
}

function onHelp() {
  if (round.mode === 'blitz') { round.combo = 0; nextTask(); return; } // Überspringen
  if (ts.hints >= 3) return;
  ts.hints++;
  const box = $('#help');
  if (ts.hints <= 2) {
    box.appendChild(el('div', `hint h${ts.hints}`, `<div class="hint-title">💡 Hinweis ${ts.hints}</div>${task.hints[ts.hints - 1]}`));
  } else {
    S.solutions++; checkBadges(); save();
    box.appendChild(el('div', 'hint sol', `<div class="hint-title">📖 Lösungsweg Schritt für Schritt</div><ol>${task.steps.map(s => `<li>${s}</li>`).join('')}</ol>`));
    if (round.mode === 'daily') { /* Aufgabe zählt als gesehen, Ergebnis wird beim Weitergehen notiert */ }
    if (!ts.done) feedback('info', 'Jetzt du: Tipp das Ergebnis ein, damit es sitzt – oder geh direkt weiter.');
  }
  box.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateButtons();
}

function updateButtons() {
  const h = $('#btn-help'), c = $('#btn-check'), blitz = round.mode === 'blitz';
  h.classList.toggle('pulse', ts.wrong >= 2 && ts.hints < 3 && !ts.done && !blitz);
  h.disabled = ts.done;
  if (blitz) h.textContent = '⏭ Überspringen';
  else if (ts.hints >= 3) h.textContent = '⏭ Weiter';
  else h.textContent = ['💡 Hinweis 1', '💡 Hinweis 2', '📖 Lösungsweg'][ts.hints];
  if (ts.done) { c.textContent = round.mode === 'daily' && S.daily.idx >= 5 ? 'Auswertung 🏁' : 'Weiter ➜'; c.className = 'act next'; c.disabled = false; }
  else { c.textContent = 'Prüfen'; c.className = 'act primary'; c.disabled = task.type === 'choice'; }
  $('#keypad').hidden = task.type === 'choice' || ts.done;
}
$('#btn-help').onclick = () => { if (!ts.done && ts.hints >= 3 && round.mode !== 'blitz') skipAfterSolution(); else onHelp(); };
$('#btn-check').onclick = onCheck;
function skipAfterSolution() {
  ts.done = true; round.combo = 0;
  if (round.mode === 'daily') { S.daily.results[S.daily.idx] = 'skip'; S.daily.idx++; save(); }
  nextTask();
}

// ---------- Modi ----------
$('#btn-mix').onclick = () => { chapterId = null; startRound({ mode: 'mix', pool: A.TYPES.map(t => t.id) }); };
$('#btn-blitz').onclick = () => { chapterId = null; startRound({ mode: 'blitz', pool: A.TYPES.filter(t => t.lvl === 1).map(t => t.id) }); };
$('#btn-daily').onclick = () => {
  chapterId = null;
  if (!S.daily || S.daily.date !== today()) { S.daily = { date: today(), types: dailySet(), idx: 0, results: [], finished: false }; save(); }
  if (S.daily.finished) { showDailyResult(); return; }
  startRound({ mode: 'daily', pool: [] });
};
function finishDaily() {
  const d = S.daily;
  if (!d.finished) {
    d.finished = true;
    const noSolution = d.results.every(r => r !== 'skip');
    if (noSolution) { S.xp += 50; S.dailyDone++; toast('🏆 Tages-Challenge geschafft! +50 XP Bonus'); confetti(); }
    checkBadges(); save();
  }
  showDailyResult();
}
function showDailyResult() {
  const d = S.daily, ok = d.results.filter(r => r === 'ok').length, help = d.results.filter(r => r === 'help').length, skip = d.results.filter(r => r === 'skip').length;
  const won = skip === 0;
  $('#res-ico').textContent = won ? '🏆' : '💪';
  $('#res-title').textContent = won ? 'Tages-Challenge geschafft!' : 'Challenge beendet';
  $('#res-text').textContent = won ? 'Alle 5 Aufgaben ohne komplette Lösung – stark! Morgen wartet die nächste.' : 'Für den Bonus alle 5 ohne den kompletten Lösungsweg lösen. Morgen neuer Versuch!';
  $('#res-stats').innerHTML = `<div><b>${ok}</b><small>ohne Hilfe</small></div><div><b>${help}</b><small>mit Hinweis</small></div><div><b>${skip}</b><small>mit Lösung</small></div>`;
  $('#res-again').textContent = 'Zufallsmix spielen';
  $('#res-again').onclick = () => $('#btn-mix').click();
  stopTimer(); round = null; show('result');
}
function finishBlitz() {
  stopTimer();
  const sc = round.score, rec = sc > S.blitzHigh;
  if (rec) S.blitzHigh = sc;
  checkBadges(); save();
  $('#res-ico').textContent = rec && sc > 0 ? '🥇' : '⚡';
  $('#res-title').textContent = rec && sc > 0 ? 'Neuer Rekord!' : 'Zeit ist um!';
  $('#res-text').textContent = sc === 0 ? 'Aller Anfang ist schwer – im Themen-Modus mit Hinweisen üben hilft!' : 'Jede richtige Antwort zählt einen Punkt.';
  $('#res-stats').innerHTML = `<div><b>${sc}</b><small>Punkte</small></div><div><b>${S.blitzHigh}</b><small>Rekord</small></div><div><b>+${round.xp}</b><small>XP</small></div>`;
  $('#res-again').textContent = 'Nochmal! ⚡';
  $('#res-again').onclick = () => $('#btn-blitz').click();
  if (rec && sc > 0) confetti();
  round = null; show('result');
}

// ---------- Erfolge ----------
$('#btn-badges').onclick = () => {
  $('#stats').innerHTML = `<div><b>${S.total}</b><small>gelöst</small></div><div><b>${S.noHint}</b><small>ohne Hilfe</small></div><div><b>${S.bestCombo}</b><small>beste Serie</small></div>`;
  const g = $('#badge-grid'); g.innerHTML = '';
  for (const [id, ico, name, desc] of BADGES) g.appendChild(el('div', 'badge' + (S.badges.includes(id) ? '' : ' locked'), `<div class="bi">${ico}</div><b>${name}</b><small>${desc}</small>`));
  show('badges');
};
$('#streak-btn').onclick = () => toast(`🔥 ${$('#streak-days').textContent} Tag(e) am Stück geübt. Morgen weitermachen!`);
$('#btn-reset').onclick = () => { if (confirm('Wirklich alle XP, Sterne und Erfolge löschen?')) { S = fresh(); save(); goHome(); } };

// ---------- Start ----------
window.VQ = { get task() { return task; } }; // für automatische Tests
renderHome(); show('home');
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
