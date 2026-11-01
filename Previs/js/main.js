// Previs: Start, Zustand, Rückgängig, Speichern, Tastatur und Bildschleife.
import { World } from './world.js';
import { WorkView } from './workview.js';
import { CamView } from './camview.js';
import { UI } from './ui.js';
import { exportVideo, exportPng, projectFile, saveToDisk, reveal, download, downloadUrl, serverInfo } from './export.js';
import { newProject, exampleProject, newFigureState, newCameraKey, uid, OPENING_DEFAULTS, newObject } from './model.js';
import { openingRange } from './build.js';
import { clamp, dirToHeading, headingToDir } from './units.js';
import { promptText } from './prompttext.js';

const AUTOSAVE = 'previs.autosave.v1';
const REVEAL_LABEL = /Win/.test(navigator.platform) ? 'Im Explorer zeigen' : 'Im Finder zeigen';
const CLIPBOARD = 'previs.clipboard.v1';

// Schienen aus der Zeit des Schienen-Werkzeugs werden zu Flächen
function railsToSurfaces(set) {
  const H = Math.max(2.6 * !set.walls.length, ...set.walls.map((w) => w.h));
  for (const r of set.rails || []) {
    const dx = r.b.x - r.a.x, dz = r.b.z - r.a.z;
    const base = { w: r.w, color: r.color };
    const add = (x, z, over) => set.objects.push(Object.assign(newObject('schiene', x, z), base, over));
    const mid = { d: Math.hypot(dx, dz), heading: Math.round(dirToHeading(dx, dz)) };
    if (r.boden) add(r.a.x + dx / 2, r.a.z + dz / 2, mid);
    if (r.decke) add(r.a.x + dx / 2, r.a.z + dz / 2, { ...mid, surface: 'decke' });
    if (r.enden) for (const q of [r.a, r.b]) add(q.x, q.z, { surface: 'wand', d: H });
  }
  delete set.rails;
}

// Weg und Haltungswechsel aus älteren Dateien werden zu Schritten im Ablauf
function figureSteps(st) {
  if (st.steps) return;
  st.steps = [];
  if (st.path?.length) st.steps.push({ type: 'gehen', t: st.t0, t1: st.t1, path: st.path });
  for (const k of st.poses || []) st.steps.push({ type: 'haltung', t: k.t, t1: k.t + k.dur, pose: k.pose, to: k.to, heading: k.heading });
  st.steps.sort((a, b) => a.t - b.t);
  for (const k of ['path', 't0', 't1', 'ease', 'poses']) delete st[k];
}

// Kamerafahrten aus älteren Dateien (Start, Ende, Zeiten) werden zu Punkten
function cameraKeys(shot) {
  const c = shot.camera || {};
  if (c.keys) return;
  const start = { ...newCameraKey(), ...c.start };
  const keys = [];
  if (c.moving && c.end) {
    if (c.t0 > 0.04) keys.push({ id: uid(), t: c.t0, ...start });
    keys.push({ id: uid(), t: c.t1, ...c.end, via: c.via || [] });
  }
  shot.camera = { start, keys, aim: c.aim || '' };
}

// Der Ablauf aus der Zwischenzeit wird zu Punkten
function figureKeys(st) {
  if (st.keys) { delete st.steps; return; }
  figureSteps(st);
  st.keys = [];
  let pos = { x: st.x, z: st.z };
  let end = 0;
  let back = null;
  for (const s of st.steps) {
    if (s.type === 'gehen') {
      if (s.t > end + 0.05) st.keys.push({ id: uid(), t: s.t, ...pos });
      const last = s.path.at(-1);
      st.keys.push({ id: uid(), t: s.t1, x: last.x, z: last.z, via: s.path.slice(0, -1) });
      pos = { x: last.x, z: last.z };
      back = null;
    } else {
      const key = { id: uid(), t: s.t, ...pos, pose: s.pose, dur: s.t1 - s.t };
      if (s.to) { key.to = s.to; key.heading = s.heading; back = pos; pos = { ...s.to }; }
      else if (back && s.pose !== 'sitzen') { pos = back; back = null; }
      const same = st.keys.find((k) => Math.abs(k.t - s.t) < 0.04);
      if (same) Object.assign(same, { pose: key.pose, dur: key.dur, to: key.to, heading: key.heading });
      else st.keys.push(key);
    }
    end = s.t1;
  }
  delete st.steps;
}

// Ältere oder unvollständige Dateien auffüllen
function normalize(p) {
  if (!p || p.app !== 'previs' || !p.set || !Array.isArray(p.shots)) throw new Error('Das ist keine Previs-Projektdatei.');
  const set = p.set;
  Object.assign(set, { floorColor: '#a6a6a6', bgColor: '#6e6e6e', wallColor: '#c4c4c4', ceilingColor: '#d9d9d9', ceiling: false, autoCutaway: true, ...set });
  for (const k of ['walls', 'openings', 'objects', 'figures', 'folders']) set[k] = set[k] || [];
  set.openings = set.openings.map((o) => ({ ...OPENING_DEFAULTS[o.kind === 'fenster' ? 'fenster' : 'tuer'], ...o }));
  railsToSurfaces(set);
  p.images = p.images || {};
  if (!p.shots.length) p.shots.push(newProject().shots[0]);
  for (const s of p.shots) {
    s.figs = s.figs || {};
    s.doors = s.doors || {};
    for (const st of Object.values(s.figs)) { st.looks = st.looks || []; figureKeys(st); }
    s.fps = s.fps || 30;
    s.format = s.format || '16:9';
    cameraKeys(s);
    for (const f of set.figures) if (!s.figs[f.id]) s.figs[f.id] = newFigureState(0, 0, s.duration);
  }
  return p;
}

function loadAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* leer oder kaputt: Beispiel laden */ }
  return null;
}

const app = {
  state: { project: null, shotIndex: 0, time: 0, playing: false, loop: true, selection: null },
  history: [],
  hIndex: -1,

  get shot() {
    return this.state.project.shots[this.state.shotIndex];
  },

  init() {
    this.world = new World();
    this.ui = new UI(this);
    this.work = new WorkView(this, document.getElementById('workCanvas'));
    this.cam = new CamView(this, document.getElementById('camCanvas'));
    const project = loadAutosave() || exampleProject();
    this.loadProject(project);
    this.bindKeys();
    serverInfo().then((info) => {
      if (!info) this.toast('Der Previs-Server ist veraltet. Bitte „Previs starten“ noch einmal doppelklicken, sonst klappt das Speichern nicht.', 0);
    });
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (this.state.playing) {
        let t = this.state.time + dt;
        if (t >= this.shot.duration) {
          if (this.state.loop) t = 0;
          else { t = this.shot.duration; this.state.playing = false; }
        }
        this.state.time = t;
        this.ui.updateTime();
      }
      this.world.update(this, this.state.time);
      this.work.render();
      this.cam.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  loadProject(project) {
    this.state.project = project;
    this.state.shotIndex = 0;
    this.state.time = 0;
    this.state.playing = false;
    this.state.selection = null;
    this.history = [];
    this.hIndex = -1;
    this.world?.setMarked([]);
    this.work?.gizmo.detach();
    this.pushHistory();
    this.save();
    this.refresh('all');
  },

  // ---------- Änderungen ----------

  refresh(scope = 'all') {
    if (scope === 'all' || scope === 'set') this.world.syncSet(this.state.project);
    if (scope === 'all' || scope === 'figures') this.world.syncFigures(this.state.project);
    this.world.update(this, this.state.time);
    this.world.syncHelpers(this);
    this.world.update(this, this.state.time);
    this.ui.render();
  },

  // während des Ziehens: neu zeichnen, aber noch nicht speichern
  live(scope) {
    if (scope === 'set') this.world.syncSet(this.state.project);
    this.world.syncHelpers(this);
    this.world.update(this, this.state.time);
  },

  commit(scope = 'all') {
    this.clearHeld();
    this.pushHistory();
    this.save();
    if (scope !== 'none') this.refresh(scope);
  },

  pushHistory() {
    // Bilder bleiben außerhalb des Verlaufs, sonst läge jedes in bis zu 200 Kopien im Speicher
    const snap = JSON.stringify(this.state.project, (k, v) => (k === 'images' ? undefined : v));
    if (this.history[this.hIndex] === snap) return;
    this.history = this.history.slice(0, this.hIndex + 1);
    this.history.push(snap);
    if (this.history.length > 200) this.history.shift();
    this.hIndex = this.history.length - 1;
  },

  undo() {
    if (this.hIndex <= 0) return;
    this.hIndex--;
    this.restore();
  },
  redo() {
    if (this.hIndex >= this.history.length - 1) return;
    this.hIndex++;
    this.restore();
  },
  restore() {
    const { images } = this.state.project;
    this.state.project = JSON.parse(this.history[this.hIndex]);
    this.state.project.images = images;
    this.state.shotIndex = Math.min(this.state.shotIndex, this.state.project.shots.length - 1);
    this.validateSelection();
    this.work.gizmo.detach();
    this.save();
    this.refresh('all');
    this.work.onSelection();
  },

  validateSelection() {
    const sel = this.state.selection;
    if (!sel) return;
    const set = this.state.project.set;
    const exists = sel.kind === 'camera'
      || (sel.kind === 'object' && set.objects.some((o) => o.id === sel.id))
      || (sel.kind === 'figure' && set.figures.some((o) => o.id === sel.id))
      || (sel.kind === 'wall' && set.walls.some((o) => o.id === sel.id))
      || (sel.kind === 'opening' && set.openings.some((o) => o.id === sel.id));
    if (!exists) this.state.selection = null;
  },

  save() {
    try {
      localStorage.setItem(AUTOSAVE, JSON.stringify(this.state.project));
    } catch {
      // Speicher voll oder gesperrt: Ohne Bilder passt es meist noch
      try {
        localStorage.setItem(AUTOSAVE, JSON.stringify(this.state.project, (k, v) => (k === 'images' ? undefined : v)));
        this.toast('Die Bilder sind zu groß für die automatische Sicherung. Speichere das Projekt mit „Speichern“.');
      } catch { /* gesperrt */ }
    }
  },

  clearHeld() {
    if (this.world.held) this.world.setHeld(this, null);
  },

  clearMarks() {
    this.clearHeld();
    if (this.world.marked?.length) this.world.setMarked([]);
  },

  select(sel) {
    this.clearHeld();
    if (this.world.marked?.length) this.world.setMarked([]);
    this.state.selection = sel;
    this.world.syncHelpers(this);
    this.world.update(this, this.state.time);
    this.ui.render();
    this.work.onSelection();
  },

  setShot(i) {
    this.state.shotIndex = clamp(i, 0, this.state.project.shots.length - 1);
    this.state.time = Math.min(this.state.time, this.shot.duration);
    this.validateSelection();
    this.work.finishDraft();
    this.refresh('helpers');
    this.work.onSelection();
  },

  setTime(t) {
    this.state.time = clamp(t, 0, this.shot.duration);
    this.ui.updateTime();
    if (this.state.playing) return;
    if (this.state.selection?.kind === 'camera') { this.world.syncHelpers(this); this.ui.render(); }
    if (this.state.selection?.kind === 'figure') this.ui.refreshKey();
  },
  play() {
    if (this.state.time >= this.shot.duration - 1e-3) this.state.time = 0;
    this.state.playing = true;
    this.ui.updateTime();
  },
  pause() {
    this.state.playing = false;
    this.ui.updateTime();
  },
  togglePlay() {
    if (this.state.playing) this.pause();
    else this.play();
  },

  toast(text, ms = 4000, action = null) {
    const el = document.getElementById('toast');
    el.replaceChildren(text);
    if (action) {
      const b = document.createElement('button');
      b.className = 'small';
      b.textContent = action.label;
      b.addEventListener('click', action.run);
      el.append(' ', b);
    }
    clearTimeout(this.toastTimer);
    if (ms) this.toastTimer = setTimeout(() => { el.replaceChildren(); }, ms);
  },

  savedToast(what, saved) {
    this.toast(`${what} gespeichert: ${saved.folder}/${saved.name}`, 10000, { label: REVEAL_LABEL, run: () => reveal(saved.path) });
  },

  // ---------- Auswahl bearbeiten ----------

  // Kopieren geht über den Speicher des Browsers, so kommt es auch in anderen Projekten an.
  // Bilder reisen mit, Figuren bleiben im Projekt, weil sie an den Shots hängen.
  copyMarked() {
    const marked = this.world.marked || [];
    const sel = this.state.selection;
    const list = marked.length ? marked : (sel?.kind === 'object' || sel?.kind === 'wall' ? [sel] : []);
    if (!list.length) return false;
    const { set, images } = this.state.project;
    const objects = set.objects.filter((o) => list.some((m) => m.kind === 'object' && m.id === o.id));
    const walls = set.walls.filter((w) => list.some((m) => m.kind === 'wall' && m.id === w.id));
    const openings = set.openings.filter((o) => walls.some((w) => w.id === o.wall));
    const pics = {};
    for (const o of objects) if (o.image) pics[o.image] = images[o.image];
    const data = JSON.stringify({ objects, walls, openings, images: pics });
    try {
      localStorage.setItem(CLIPBOARD, data);
    } catch {
      this.toast('Das ist zu groß zum Kopieren, vermutlich wegen der Bilder.');
      return true;
    }
    this.toast(`${list.length} kopiert. In diesem oder einem anderen Projekt mit ⌘V einfügen.`);
    return true;
  },

  pasteMarked() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(CLIPBOARD)); } catch { /* leer */ }
    if (!data) { this.toast('Es wurde noch nichts kopiert.'); return; }
    const p = this.state.project;
    const pts = [...data.objects, ...data.walls.flatMap((w) => [w.a, w.b])];
    const cx = pts.reduce((v, q) => v + q.x, 0) / (pts.length || 1), cz = pts.reduce((v, q) => v + q.z, 0) / (pts.length || 1);
    const c = this.work.planCenter;
    const shift = (q) => ({ ...q, x: Math.round((q.x - cx + c.x) * 20) / 20, z: Math.round((q.z - cz + c.z) * 20) / 20 });
    const ids = new Map();
    const fresh = (old) => { const id = uid(); ids.set(old, id); return id; };
    const marked = [];
    for (const w of data.walls) {
      const copy = { ...w, id: fresh(w.id), a: shift(w.a), b: shift(w.b) };
      p.set.walls.push(copy);
      marked.push({ kind: 'wall', id: copy.id });
    }
    for (const o of data.openings) p.set.openings.push({ ...o, id: uid(), wall: ids.get(o.wall) });
    for (const o of data.objects) {
      const copy = { ...shift(o), id: uid() };
      delete copy.folder;
      delete copy.wall;
      if (copy.image) { p.images = p.images || {}; p.images[copy.image] = data.images[copy.image]; }
      p.set.objects.push(copy);
      marked.push({ kind: 'object', id: copy.id });
    }
    this.state.selection = null;
    this.commit('set');
    this.world.setMarked(marked);
    this.toast(`${marked.length} eingefügt. Zum Verschieben einfach ziehen.`);
  },

  deleteSelection() {
    const sel = this.state.selection;
    const p = this.state.project;
    const marked = this.world.marked || [];
    if (marked.length) {
      const gone = (kind, id) => marked.some((m) => m.kind === kind && m.id === id);
      p.set.objects = p.set.objects.filter((o) => !gone('object', o.id));
      p.set.walls = p.set.walls.filter((w) => !gone('wall', w.id));
      p.set.openings = p.set.openings.filter((o) => p.set.walls.some((w) => w.id === o.wall));
      this.world.setMarked([]);
      this.commit('set');
      return;
    }
    if (!sel) return;
    if (sel.kind === 'object') p.set.objects = p.set.objects.filter((o) => o.id !== sel.id);
    else if (sel.kind === 'wall') {
      p.set.walls = p.set.walls.filter((w) => w.id !== sel.id);
      p.set.openings = p.set.openings.filter((o) => o.wall !== sel.id);
    } else if (sel.kind === 'opening') {
      p.set.openings = p.set.openings.filter((o) => o.id !== sel.id);
      for (const s of p.shots) delete s.doors?.[sel.id];
    } else if (sel.kind === 'figure') {
      const f = p.set.figures.find((x) => x.id === sel.id);
      if (!confirm(`Figur „${f.name}“ aus dem Set und allen Shots entfernen?`)) return;
      p.set.figures = p.set.figures.filter((x) => x.id !== sel.id);
      for (const s of p.shots) {
        // Türen, die diese Figur bewegt hat, gehen zurück auf ihre Einstellung
        for (const k of s.figs[sel.id]?.keys || []) if (k.door) delete s.doors?.[k.door];
        delete s.figs[sel.id];
        if (s.camera.aim === sel.id) s.camera.aim = '';
      }
    } else return;
    this.state.selection = null;
    this.work.gizmo.detach();
    this.commit(sel.kind === 'figure' ? 'figures' : 'set');
  },

  duplicateSelection() {
    const sel = this.state.selection;
    const p = this.state.project;
    if (sel?.kind === 'opening') {
      const o = p.set.openings.find((x) => x.id === sel.id);
      const w = p.set.walls.find((x) => x.id === o.wall);
      const [min, max] = openingRange(p.set, w, o);
      const offset = o.offset + o.w + 0.5 <= max ? o.offset + o.w + 0.5 : o.offset - o.w - 0.5;
      if (offset < min) { this.toast('In dieser Wand ist kein Platz für eine zweite Öffnung daneben.'); return; }
      const copy = { ...o, id: uid(), offset };
      p.set.openings.push(copy);
      this.state.selection = { kind: 'opening', id: copy.id };
      this.commit('set');
      return;
    }
    if (sel?.kind !== 'object') return;
    const o = p.set.objects.find((x) => x.id === sel.id);
    const copy = { ...o, id: uid(), x: o.x + 0.3, z: o.z + 0.3 };
    if (o.kind === 'flaeche') {
      // 50 cm quer zur Längsrichtung: so entsteht schnell eine Reihe von Schienen
      const v = headingToDir(o.heading);
      const [mx, mz] = o.d >= o.w ? [-v.z * 0.5, v.x * 0.5] : [v.x * 0.5, v.z * 0.5];
      copy.x = Math.round((o.x + mx) * 1000) / 1000;
      copy.z = Math.round((o.z + mz) * 1000) / 1000;
    }
    p.set.objects.push(copy);
    this.state.selection = { kind: 'object', id: copy.id };
    this.commit('set');
    this.work.onSelection();
  },

  nudge(dx, dz) {
    const sel = this.state.selection;
    const p = this.state.project;
    if (sel?.kind === 'object') {
      const o = p.set.objects.find((x) => x.id === sel.id);
      o.x = Math.round((o.x + dx) * 1000) / 1000;
      o.z = Math.round((o.z + dz) * 1000) / 1000;
      this.commit('set');
    } else if (sel?.kind === 'figure') {
      const st = this.shot.figs[sel.id];
      st.x += dx; st.z += dz;
      this.commit('helpers');
    } else if (sel?.kind === 'camera') {
      const c = this.shot.camera;
      for (const k of [c.start, ...c.keys, ...c.keys.flatMap((q) => q.via || [])]) { k.x += dx; k.z += dz; }
      this.commit('helpers');
    } else if (sel?.kind === 'opening') {
      // Pfeile schieben entlang der Wand
      const o = p.set.openings.find((x) => x.id === sel.id);
      const w = p.set.walls.find((x) => x.id === o.wall);
      const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1;
      const [min, max] = openingRange(p.set, w, o);
      const along = (dx * (w.b.x - w.a.x) + dz * (w.b.z - w.a.z)) / L;
      o.offset = clamp(Math.round((o.offset + along) * 1000) / 1000, min, max);
      this.commit('set');
    }
  },

  // ---------- Knöpfe ----------

  showPromptText() {
    const fill = (id, lang) => { document.getElementById(id).value = promptText(this, lang); };
    fill('promptEn', 'en');
    fill('promptDe', 'de');
    document.getElementById('promptTitle').textContent = `Prompt-Text für ${this.shot.name}`;
    document.getElementById('promptDialog').showModal();
  },

  async action(name) {
    switch (name) {
      case 'new':
        this.askNewProject();
        break;
      case 'example':
        if (!confirm('Beispielszene laden? Das aktuelle Projekt bleibt nur erhalten, wenn du es gespeichert hast.')) return;
        this.loadProject(exampleProject());
        break;
      case 'open':
        document.getElementById('fileInput').click();
        break;
      case 'save': {
        const file = projectFile(this);
        const saved = await saveToDisk(file.blob, file.name, 'project');
        if (saved) this.savedToast('Projekt', saved);
        else { download(file.blob, file.name); this.toast('Projektdatei an den Browser übergeben (Ordner „Downloads“).'); }
        break;
      }
      case 'prompttext': this.showPromptText(); break;
      case 'undo': this.undo(); break;
      case 'redo': this.redo(); break;
      case 'help': document.getElementById('helpDialog').showModal(); break;
      case 'png': {
        const img = await exportPng(this, parseInt(document.getElementById('exportRes').value, 10));
        const saved = await saveToDisk(img.blob, img.name, 'export');
        if (saved) this.savedToast('Standbild', saved);
        else { downloadUrl(img.dataUrl, img.name); this.toast('Standbild an den Browser übergeben (Ordner „Downloads“).'); }
        break;
      }
      case 'pngEmpty': {
        const img = await exportPng(this, parseInt(document.getElementById('exportRes').value, 10), { empty: true });
        const saved = await saveToDisk(img.blob, img.name, 'export');
        if (saved) this.savedToast('Leerer Raum', saved);
        else { downloadUrl(img.dataUrl, img.name); this.toast('Bild an den Browser übergeben (Ordner „Downloads“).'); }
        break;
      }
      case 'video': await this.exportVideo(); break;
    }
  },

  async exportVideo() {
    if (this.exporting) return;
    this.exporting = true;
    this.pause();
    const overlay = document.createElement('div');
    overlay.className = 'progress';
    overlay.textContent = 'Video wird vorbereitet …';
    document.getElementById('camCanvas').append(overlay);
    try {
      const res = await exportVideo(this, parseInt(document.getElementById('exportRes').value, 10), (u, text) => {
        overlay.textContent = text || `Video wird erstellt … ${Math.round(u * 100)} %`;
      });
      let saved = res.saved || null;
      if (!saved && res.blob) {
        overlay.textContent = 'Video wird gespeichert …';
        saved = await saveToDisk(res.blob, res.name, 'export');
      }
      this.showExport(res, saved);
    } catch (err) {
      console.error(err);
      this.toast('Video-Export fehlgeschlagen: ' + err.message, 12000);
    } finally {
      overlay.remove();
      this.exporting = false;
    }
  },

  // Fertiges Video zeigen. Ist es schon gespeichert, gibt es „Im Finder zeigen“, sonst den Browser-Download.
  showExport(res, saved) {
    const dlg = document.getElementById('exportDialog');
    const blobUrl = res.blob ? URL.createObjectURL(res.blob) : null;
    const url = blobUrl || res.url;
    const video = document.getElementById('exportVideo');
    const link = document.getElementById('exportLink');
    const revealBtn = document.getElementById('exportReveal');
    video.src = url;
    link.href = url;
    link.download = res.name;
    const size = res.blob ? ` · ${(res.blob.size / 1e6).toFixed(1).replace('.', ',')} MB` : '';
    const facts = `${res.w} × ${res.h} Pixel · ${res.frames} Bilder${size}`;
    document.getElementById('exportTitle').textContent = saved ? 'Video gespeichert' : 'Video fertig';
    document.getElementById('exportInfo').textContent = saved
      ? `Im Ordner „previs/${saved.folder}“ als „${saved.name}“ · ${facts}`
      : `${res.name} · ${facts} · Direkt speichern ging nicht, deshalb über den Browser.`;
    revealBtn.hidden = !saved;
    link.hidden = !!saved;
    revealBtn.onclick = () => saved && reveal(saved.path);
    link.onclick = () => this.toast('Video an den Browser übergeben (Ordner „Downloads“).', 6000);
    dlg.addEventListener('close', () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }, { once: true });
    dlg.showModal();
    video.play().catch(() => {});
  },

  // Neues Projekt: erst nach dem Namen fragen
  askNewProject() {
    const dlg = document.getElementById('newDialog');
    const input = document.getElementById('newName');
    document.getElementById('newWarn').textContent = `„${this.state.project.name}“ wird dabei geschlossen. Was du nicht gespeichert hast, geht verloren.`;
    input.value = '';
    dlg.returnValue = '';
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return;
      const name = input.value.trim() || 'Neues Projekt';
      this.loadProject(newProject(name));
      this.toast(`Projekt „${name}“ angelegt. Leg links unter „Set“ den Raum an.`);
    }, { once: true });
    document.getElementById('newCancel').onclick = () => dlg.close();
    dlg.showModal();
    input.focus();
  },

  openFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        this.loadProject(normalize(JSON.parse(reader.result)));
        this.toast(`„${this.state.project.name}“ geöffnet.`);
      } catch (err) {
        this.toast('Datei konnte nicht geöffnet werden: ' + err.message, 8000);
      }
    };
    reader.readAsText(file);
  },

  bindKeys() {
    // Knöpfe und Häkchen geben den Fokus ab, sonst löst die Leertaste sie ein zweites Mal aus
    document.addEventListener('click', (e) => e.target.closest?.('button')?.blur());
    document.addEventListener('change', (e) => { if (e.target.type === 'checkbox') e.target.blur(); });
    for (const [button, area] of [['copyEn', 'promptEn'], ['copyDe', 'promptDe']]) {
      document.getElementById(button).addEventListener('click', async () => {
        const el = document.getElementById(area);
        el.select();
        try { await navigator.clipboard.writeText(el.value); } catch { document.execCommand('copy'); }
      });
    }
    document.getElementById('exportReveal').textContent = REVEAL_LABEL;
    const imgMenu = document.getElementById('imgMenu');
    imgMenu.addEventListener('change', () => {
      if (imgMenu.value) this.action(imgMenu.value);
      imgMenu.value = '';
      imgMenu.blur();
    });
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) this.openFile(f);
      e.target.value = '';
    });
    window.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== 'checkbox' && document.activeElement.type !== 'range';
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.action('save'); return; }
      // ⌘Z gilt auch in den Feldern der Seitenleisten: erst den getippten Text verwerfen, dann wie überall rückgängig
      const field = document.activeElement?.closest?.('#left, #right');
      if (mod && e.key.toLowerCase() === 'z' && (!typing || field)) {
        e.preventDefault();
        const el = document.activeElement;
        if (typing && el.tagName === 'INPUT' && !e.shiftKey && el.value !== el.defaultValue) { el.value = el.defaultValue; return; }
        e.shiftKey ? this.redo() : this.undo();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === 'c') { if (this.copyMarked()) e.preventDefault(); return; }
      if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); this.pasteMarked(); return; }
      if (mod) return;
      const step = e.shiftKey ? 0.1 : 0.01;
      switch (e.key) {
        case ' ': e.preventDefault(); this.togglePlay(); break;
        case 'Escape': if (!this.work.cancel()) this.select(null); break;
        case 'Enter': this.work.finishDraft(); if (this.work.tool !== 'select') this.work.setTool('select'); break;
        case 'Delete': case 'Backspace': e.preventDefault(); this.deleteSelection(); break;
        case 'ArrowLeft': e.preventDefault(); this.nudge(-step, 0); break;
        case 'ArrowRight': e.preventDefault(); this.nudge(step, 0); break;
        case 'ArrowUp': e.preventDefault(); this.nudge(0, -step); break;
        case 'ArrowDown': e.preventDefault(); this.nudge(0, step); break;
        case ',': this.pause(); this.setTime(this.state.time - 1 / this.shot.fps); break;
        case '.': this.pause(); this.setTime(this.state.time + 1 / this.shot.fps); break;
        case '1': this.work.setMode('plan'); break;
        case '2': this.work.setMode('3d'); break;
        case 'D': if (e.shiftKey) this.duplicateSelection(); break;
        default:
          switch (e.key.toLowerCase()) {
            case 'w': this.work.setTool('wall'); break;
            case 'm': this.work.setTool('measure'); break;
            case 'l': this.work.setTool('lasso'); break;
            case 'g': this.work.setGizmoMode('translate'); break;
            case 'r': this.work.setGizmoMode('rotate'); break;
            case 'f': this.work.focusSelection(); break;
          }
      }
    });
  },
};

window.previs = app;
app.init();
