// Seitenleisten, Eigenschaften und Zeitleiste.
import {
  FURNITURE, FIGURE_COLORS, OBJECT_COLORS, FORMATS, newObject, newFigure, newFigureState, rectangleWalls, uid,
  colorDistance, pathLength, evalCamera, camKeyAt, ensureCamKey, shotFromEnd, walkPoints, walks, stepsOf, evalFigure, keyAt, ensureKey, actionKey, newShot, newOpening, doorMax, doorValue, openingName,
} from './model.js';
import { POSES, poseInfo } from './mannequin.js';
import { parseLength, parseNumber, fmtCm, fmtM, fmtDeg, fmtSec, fmtNum, normDeg, clamp, headingToDir, dirToHeading } from './units.js';
import { findSupport } from './world.js';
import { supportHeight } from './model.js';
import { clearLength, wallInsets, openingRange, reachWalls, surfaceWalls, moveToWall } from './build.js';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

const CAM_COLOR = '#ffd84d';

const byLabel = (list) => [...list].sort((a, b) => a.label.localeCompare(b.label, 'de'));

// „Tür 1“, „Fenster 2“ … in der Reihenfolge, in der sie angelegt wurden
function openingLabel(set, o) {
  const same = set.openings.filter((x) => openingName(x) === openingName(o));
  return `${openingName(o)} ${same.indexOf(o) + 1}`;
}

// Wie die beiden Wandenden im Grundriss heißen: links/rechts bei waagerechten, oben/unten bei senkrechten Wänden
function wallSides(w) {
  const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? ['links', 'rechts'] : ['rechts', 'links'];
  return dz > 0 ? ['oben', 'unten'] : ['unten', 'oben'];
}

export class UI {
  constructor(app) {
    this.app = app;
    this.left = document.getElementById('left');
    this.right = document.getElementById('right');
    this.roomForm = null;
    this.newKind = 'stuhl';
    this.scrub = document.getElementById('scrub');
    this.timeText = document.getElementById('timeText');
    this.playBtn = document.getElementById('playBtn');
    this.bars = document.getElementById('bars');
    this.ticks = document.getElementById('ticks');

    this.scrub.addEventListener('input', () => {
      const t = parseFloat(this.scrub.value);
      app.pause();
      app.setTime(t);
    });
    this.playBtn.addEventListener('click', () => app.togglePlay());
    document.getElementById('loop').addEventListener('change', (e) => { app.state.loop = e.target.checked; });
    document.getElementById('thirds').addEventListener('change', (e) => document.getElementById('camFrame').classList.toggle('no-thirds', !e.target.checked));
    document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => app.action(b.dataset.act)));
    document.querySelectorAll('#modeSeg [data-mode]').forEach((b) => b.addEventListener('click', () => app.work.setMode(b.dataset.mode)));
    document.querySelectorAll('#toolSeg [data-tool]').forEach((b) => b.addEventListener('click', () => app.work.setTool(b.dataset.tool)));
    const name = document.getElementById('projectName');
    name.addEventListener('change', () => { app.state.project.name = name.value.trim() || 'Projekt'; app.commit('none'); });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
  }

  get project() { return this.app.state.project; }
  get shot() { return this.app.shot; }

  render() {
    const active = document.activeElement;
    const focusKey = active?.dataset?.key;
    this.renderLeft();
    this.renderRight();
    this.renderTimeline();
    this.syncViewbar();
    document.getElementById('projectName').value = this.project.name;
    if (focusKey) {
      const el = document.querySelector(`[data-key="${focusKey}"]`);
      if (el) { el.focus(); el.select?.(); }
    }
  }

  syncViewbar() {
    const work = this.app.work;
    if (!work) return;
    document.querySelectorAll('#modeSeg [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === work.mode));
    document.querySelectorAll('#toolSeg [data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === work.tool));
    document.getElementById('camTitle').textContent = `Kamera · ${this.shot.name}`;
  }

  // ---------- Felder ----------

  field(label, key, value, fmt, parse, apply, scope, opts = {}) {
    const input = h('input', { 'data-key': key, value: fmt(value), spellcheck: 'false', disabled: opts.disabled });
    const commit = (v) => {
      if (Number.isNaN(v) || v === null) { input.value = fmt(value); return; }
      if (opts.min !== undefined) v = Math.max(opts.min, v);
      if (opts.max !== undefined) v = Math.min(opts.max, v);
      apply(v);
      this.app.commit(scope);
    };
    input.addEventListener('change', () => commit(parse(input.value)));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { input.blur(); return; }
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && opts.step) {
        e.preventDefault();
        const cur = parse(input.value);
        commit((Number.isNaN(cur) ? value : cur) + (e.key === 'ArrowUp' ? 1 : -1) * opts.step * (e.shiftKey ? 10 : 1));
      }
    });
    return h('label', { class: 'f' + (opts.wide ? ' wide' : '') }, h('span', { text: label }), input);
  }

  len(label, key, value, apply, scope, unit = 'cm', opts = {}) {
    return this.field(label, key, value, unit === 'cm' ? fmtCm : fmtM, (t) => parseLength(t, unit), apply, scope, { step: unit === 'cm' ? 0.01 : 0.05, ...opts });
  }
  deg(label, key, value, apply, scope, opts = {}) {
    return this.field(label, key, value, fmtDeg, parseNumber, (v) => apply(opts.signed ? v : normDeg(v)), scope, { step: 1, ...opts });
  }
  sec(label, key, value, apply, scope, opts = {}) {
    return this.field(label, key, value, fmtSec, parseNumber, apply, scope, { step: 0.1, min: 0, ...opts });
  }
  text(label, key, value, apply, scope, opts = {}) {
    return this.field(label, key, value, (v) => v, (v) => v.trim(), apply, scope, opts);
  }
  select(label, key, value, options, apply, scope, opts = {}) {
    const sel = h('select', { 'data-key': key }, options.map((o) => h('option', { value: o.value, selected: o.value === value, text: o.label })));
    sel.addEventListener('change', () => { apply(sel.value); this.app.commit(scope); });
    return h('label', { class: 'f' + (opts.wide ? ' wide' : '') }, h('span', { text: label }), sel);
  }
  check(label, value, apply, scope) {
    const cb = h('input', { type: 'checkbox', checked: value });
    cb.addEventListener('change', () => { apply(cb.checked); this.app.commit(scope); });
    return h('label', { class: 'check' }, cb, label);
  }
  color(label, value, apply, scope) {
    const input = h('input', { type: 'color', value });
    input.addEventListener('change', () => { apply(input.value); this.app.commit(scope); });
    return h('label', { class: 'f' }, h('span', { text: label }), input);
  }
  swatches(list, value, apply, scope, opts = {}) {
    return h('div', { class: 'swatches' }, list.map((c) => h('button', {
      class: 'swatch' + (opts.square ? ' sq' : '') + (c.hex.toLowerCase() === String(value).toLowerCase() ? ' on' : '') + (opts.taken?.has(c.hex) ? ' taken' : ''),
      style: `background:${c.hex}`,
      title: c.name + (opts.taken?.has(c.hex) ? ' (schon vergeben)' : ''),
      onclick: () => { apply(c.hex); this.app.commit(scope); },
    })));
  }

  // ---------- Linke Leiste ----------

  renderLeft() {
    const app = this.app;
    const p = this.project;
    const set = p.set;
    const sel = app.state.selection || {};
    const L = this.left;
    L.replaceChildren();

    // Set
    L.append(h('h2', {}, 'Set'));
    L.append(h('div', { class: 'row' },
      h('button', { onclick: () => { this.roomForm = this.roomForm ? null : { w: 5, d: 4, h: 2.6, t: 0.15 }; this.render(); } }, 'Raum anlegen'),
      h('button', { onclick: () => app.work.setTool('wall'), title: 'W' }, 'Wand zeichnen')));
    if (this.roomForm) {
      const f = this.roomForm;
      const keep = (k) => (v) => { f[k] = v; };
      const form = h('div', { class: 'box' },
        h('div', { class: 'fields' },
          this.fieldLocal('Breite (innen)', f.w, keep('w')),
          this.fieldLocal('Tiefe (innen)', f.d, keep('d')),
          this.fieldLocal('Raumhöhe', f.h, keep('h')),
          this.fieldLocal('Wandstärke', f.t, keep('t'))),
        set.walls.length ? h('div', { class: 'warn' }, 'Ersetzt die vorhandenen Wände samt Türen und Fenstern.') : null,
        h('div', { class: 'row' },
          h('button', { class: 'primary', onclick: () => {
            set.walls = rectangleWalls(f.w, f.d, f.h, f.t);
            set.openings = [];
            this.roomForm = null;
            app.commit('set');
            app.toast(`Raum ${fmtM(f.w)} × ${fmtM(f.d)} angelegt. Türen und Fenster fügst du über eine gewählte Wand ein.`);
          } }, 'Anlegen'),
          h('button', { onclick: () => { this.roomForm = null; this.render(); } }, 'Abbrechen')));
      L.append(form);
    }
    L.append(h('div', { class: 'fields three' },
      this.color('Boden', set.floorColor, (v) => { set.floorColor = v; }, 'set'),
      this.color('Wände', set.wallColor, (v) => { set.wallColor = v; }, 'set'),
      this.color('Decke', set.ceilingColor, (v) => { set.ceilingColor = v; }, 'set'),
      this.color('Hintergrund', set.bgColor, (v) => { set.bgColor = v; }, 'set')));
    L.append(h('div', { class: 'fields' },
      this.field('Helligkeit', 's.brightness', set.brightness ?? 1, (v) => `${Math.round(v * 100)} %`, (t) => parseNumber(t) / 100, (v) => { set.brightness = v; }, 'set', { step: 0.05, min: 0, max: 2 })));
    L.append(h('div', { class: 'row' }, this.check('Wände vor der Kamera ausblenden', set.autoCutaway !== false, (v) => { set.autoCutaway = v; }, 'set')));
    L.append(h('div', { class: 'row' },
      this.check('Decke', set.ceiling, (v) => { set.ceiling = v; }, 'set'),
      set.walls.length ? h('span', { class: 'muted', style: 'font-size:12px' }, `${set.walls.length} Wände`) : null,
      set.walls.length ? h('button', { class: 'small danger', onclick: () => {
        if (!confirm('Alle Wände samt Türen und Fenstern löschen?')) return;
        set.walls = []; set.openings = []; app.select(null); app.commit('set');
      } }, 'Wände löschen') : null));

    // Figuren
    L.append(h('h2', {}, 'Figuren', h('span', { class: 'spacer' }), h('button', { class: 'small', onclick: () => this.addFigure() }, '+ Figur')));
    const figs = h('div', { class: 'list' });
    if (!set.figures.length) figs.append(h('div', { class: 'empty' }, 'Noch keine Figur.'));
    for (const f of set.figures) {
      const cname = FIGURE_COLORS.find((c) => c.hex === f.color)?.name || '';
      figs.append(h('div', { class: 'item' + (sel.kind === 'figure' && sel.id === f.id ? ' active' : ''), onclick: () => this.pickFromList({ kind: 'figure', id: f.id }) },
        h('span', { class: 'dot', style: `background:${f.color}` }), f.name, h('span', { class: 'meta' }, `${Math.round(f.height * 100)} cm ${cname}`)));
    }
    L.append(figs);

    // Möbel
    L.append(h('h2', {}, 'Möbel & Formen', h('span', { class: 'spacer' }), h('button', { class: 'small', title: 'Neuer Ordner für die Liste', onclick: () => this.addFolder() }, '+ Ordner')));
    const kindSel = h('select', { style: 'flex:1;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:3px 6px' },
      byLabel(Object.entries(FURNITURE).map(([value, d]) => ({ value, label: d.label }))).map((o) => h('option', { value: o.value, selected: o.value === this.newKind, text: o.label })));
    kindSel.addEventListener('change', () => { this.newKind = kindSel.value; });
    L.append(h('div', { class: 'row' }, kindSel, h('button', { onclick: () => this.addObject(kindSel.value) }, 'Hinzufügen')));
    L.append(this.objectList(set, sel));

    // Shots
    L.append(h('h2', {}, 'Shots', h('span', { class: 'spacer' }),
      h('button', { class: 'small', title: 'Neuer Shot, Figuren stehen dort, wo der aktuelle endet', onclick: () => {
        p.shots.splice(app.state.shotIndex + 1, 0, shotFromEnd(p, this.shot));
        app.setShot(app.state.shotIndex + 1);
        app.commit('helpers');
      } }, '+ ab Ende')));
    const shots = h('div', { class: 'list' });
    p.shots.forEach((s, i) => {
      shots.append(h('div', { class: 'item' + (i === app.state.shotIndex ? ' active' : ''), onclick: () => app.setShot(i) },
        h('span', { class: 'muted' }, String(i + 1)), s.name, h('span', { class: 'meta' }, `${fmtSec(s.duration)} · ${s.format}`)));
    });
    L.append(shots);
    L.append(h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => {
        const copy = JSON.parse(JSON.stringify(this.shot));
        copy.id = uid();
        copy.name = this.shot.name + ' (Kopie)';
        p.shots.splice(app.state.shotIndex + 1, 0, copy);
        app.setShot(app.state.shotIndex + 1);
        app.commit('helpers');
      } }, 'Kopieren'),
      h('button', { class: 'small', onclick: () => {
        p.shots.splice(app.state.shotIndex + 1, 0, newShot(p));
        app.setShot(app.state.shotIndex + 1);
        app.commit('helpers');
      } }, 'Leer'),
      h('button', { class: 'small danger', disabled: p.shots.length < 2, onclick: () => {
        if (!confirm(`Shot „${this.shot.name}“ löschen?`)) return;
        p.shots.splice(app.state.shotIndex, 1);
        app.setShot(Math.max(0, app.state.shotIndex - 1));
        app.commit('helpers');
      } }, 'Löschen')));
    const s = this.shot;
    L.append(h('div', { class: 'fields' },
      this.text('Name', 'shot.name', s.name, (v) => { s.name = v || s.name; }, 'helpers', { wide: true }),
      this.sec('Dauer', 'shot.duration', s.duration, (v) => this.setDuration(v), 'helpers', { min: 0.5, max: 120 }),
      this.select('Bildrate', 'shot.fps', String(s.fps), ['24', '25', '30'].map((v) => ({ value: v, label: v + ' fps' })), (v) => { s.fps = parseInt(v, 10); }, 'helpers'),
      this.select('Bildformat', 'shot.format', s.format, FORMATS.map((f) => ({ value: f.id, label: f.id })), (v) => { s.format = v; }, 'helpers', { wide: true })));
  }

  fieldLocal(label, value, apply) {
    const input = h('input', { value: fmtCm(value) });
    input.addEventListener('change', () => {
      const v = parseLength(input.value, 'cm');
      if (!Number.isNaN(v) && v > 0) apply(v);
      input.value = fmtCm(v > 0 ? v : value);
    });
    return h('label', { class: 'f' }, h('span', { text: label }), input);
  }

  setDuration(v) {
    const s = this.shot;
    s.duration = v;
    this.app.setTime(Math.min(this.app.state.time, v));
  }

  addFigure() {
    const app = this.app;
    const p = this.project;
    const f = newFigure(p);
    p.set.figures.push(f);
    const c = app.work.mode === 'plan' ? app.work.planCenter : { x: 0, z: 0 };
    for (const s of p.shots) s.figs[f.id] = newFigureState(Math.round(c.x * 20) / 20, Math.round(c.z * 20) / 20, s.duration);
    app.state.selection = { kind: 'figure', id: f.id };
    app.commit('figures');
    app.work.onSelection();
  }

  // In der Liste Gewähltes bleibt rot, bis etwas anderes gewählt oder etwas geändert wird: So findet man es im Bild
  pickFromList(sel) {
    this.app.select(sel);
    this.app.work.hold(sel);
  }

  // Liste mit Ordnern: Einträge lassen sich in einen Ordner ziehen und wieder heraus
  objectList(set, sel) {
    const app = this.app;
    const drop = (el, folder) => {
      el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop'); });
      el.addEventListener('dragleave', () => el.classList.remove('drop'));
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drop');
        const o = set.objects.find((x) => x.id === e.dataTransfer.getData('text/plain'));
        if (!o) return;
        if (folder) o.folder = folder.id;
        else delete o.folder;
        app.commit('none');
        this.render();
      });
    };
    const row = (o) => {
      const item = h('div', { class: 'item' + (sel.kind === 'object' && sel.id === o.id ? ' active' : ''), draggable: 'true', title: 'Doppelklick benennt um', onclick: () => {
        if (this.secondClick(o.id)) this.rename(o); else this.pickFromList({ kind: 'object', id: o.id });
      } },
        h('span', { class: 'square', style: `background:${o.image ? '#ffffff' : o.color}` }), o.name, h('span', { class: 'meta' }, `${Math.round(o.w * 100)}×${Math.round(o.d * 100)}`));
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', o.id); e.dataTransfer.effectAllowed = 'move'; });
      return item;
    };
    const objs = h('div', { class: 'list' });
    drop(objs, null);
    if (!set.objects.length && !set.folders.length) objs.append(h('div', { class: 'empty' }, 'Noch keine Möbel.'));
    for (const f of set.folders) {
      const inside = set.objects.filter((o) => o.folder === f.id);
      const head = h('div', { class: 'item folder', title: 'Klick klappt auf und zu, Doppelklick benennt um', onclick: () => {
          f.open = !f.open;
          if (this.secondClick(f.id)) this.rename(f); // der zweite Klick hat den Ordner wieder in den alten Zustand geklappt
          app.save();
          this.render();
        } },
        h('span', { class: 'chevron' }, f.open ? '▾' : '▸'), f.name, h('span', { class: 'meta' }, String(inside.length)),
        h('button', { class: 'small folder-del', title: 'Ordner auflösen, die Einträge bleiben erhalten', onclick: (e) => {
          e.stopPropagation();
          inside.forEach((o) => { delete o.folder; });
          set.folders = set.folders.filter((x) => x !== f);
          app.commit('none');
          this.render();
        } }, '×'));
      drop(head, f);
      objs.append(head);
      if (f.open) {
        const body = h('div', { class: 'folder-body' }, inside.map(row));
        drop(body, f);
        objs.append(body);
      }
    }
    for (const o of set.objects) if (!set.folders.some((f) => f.id === o.folder)) objs.append(row(o));
    return objs;
  }

  // Die Liste wird bei jedem Klick neu aufgebaut, ein echtes dblclick-Ereignis käme nicht an
  secondClick(id) {
    const now = performance.now();
    const twice = this.lastClick?.id === id && now - this.lastClick.at < 400;
    this.lastClick = twice ? null : { id, at: now };
    return twice;
  }

  rename(item) {
    const name = prompt('Neuer Name', item.name);
    if (name?.trim()) { item.name = name.trim(); this.app.commit('helpers'); }
  }

  addFolder() {
    const name = prompt('Name des neuen Ordners', 'Schienen');
    if (!name?.trim()) return;
    this.project.set.folders.push({ id: uid(), name: name.trim(), open: true });
    this.app.commit('none');
    this.render();
  }

  // Auswahl im Eigenschaften-Panel, nur wenn es Ordner gibt
  folderField(o) {
    const { folders } = this.project.set;
    if (!folders.length) return null;
    return this.select('Ordner', 'o.folder', o.folder || '', [{ value: '', label: 'Kein Ordner' }, ...folders.map((f) => ({ value: f.id, label: f.name }))], (v) => {
      if (v) { o.folder = v; folders.find((f) => f.id === v).open = true; } else delete o.folder;
    }, 'helpers', { wide: true });
  }

  addObject(kind) {
    const app = this.app;
    const c = app.work.mode === 'plan' ? app.work.planCenter : { x: 0, z: 0 };
    const o = newObject(kind, Math.round(c.x * 20) / 20, Math.round(c.z * 20) / 20);
    const same = this.project.set.objects.filter((x) => x.kind === kind).length;
    if (same) o.name = `${o.name} ${same + 1}`;
    this.project.set.objects.push(o);
    app.state.selection = { kind: 'object', id: o.id };
    app.commit('set');
    app.work.onSelection();
  }

  // ---------- Rechte Leiste ----------

  renderRight() {
    const sel = this.app.state.selection;
    const R = this.right;
    R.replaceChildren();
    if (sel?.kind === 'object') this.renderObject(R, sel.id);
    else if (sel?.kind === 'figure') this.renderFigure(R, sel.id);
    else if (sel?.kind === 'wall') this.renderWall(R, sel.id);
    else if (sel?.kind === 'opening') this.renderOpening(R, sel.id);
    else if (sel?.kind === 'camera') this.renderCamera(R);
    else {
      R.append(h('h2', {}, 'Auswahl'));
      R.append(h('p', { class: 'note' }, 'Klicke im Grundriss oder in der Liste auf eine Figur, ein Möbel, eine Wand oder die Kamera. Hier stellst du dann alle Maße genau ein.'));
      R.append(h('div', { class: 'row' }, h('button', { onclick: () => this.app.select({ kind: 'camera' }) }, 'Kamera bearbeiten')));
      R.append(h('p', { class: 'note' }, 'Maße tippst du mit Einheit ein, zum Beispiel „1,80 m“ oder „180 cm“. Ohne Einheit gilt die Einheit, die im Feld steht. Mit ↑ und ↓ änderst du Werte schrittweise.'));
    }
  }

  renderObject(R, id) {
    const app = this.app;
    const o = this.project.set.objects.find((x) => x.id === id);
    if (!o) return;
    if (o.kind === 'flaeche') { this.renderSurface(R, o); return; }
    if (o.kind === 'licht') { this.renderLight(R, o); return; }
    const def = FURNITURE[o.kind];
    R.append(h('h2', {}, h('span', { class: 'square', style: `background:${o.color}` }), def.label));
    R.append(h('div', { class: 'fields' },
      this.text('Name', 'o.name', o.name, (v) => { o.name = v || o.name; }, 'set', { wide: true }),
      this.folderField(o)));
    R.append(h('div', { class: 'fields' }, this.swatches(OBJECT_COLORS, o.color, (v) => { o.color = v; }, 'set', { square: true }),
      this.color('Eigene Farbe', o.color, (v) => { o.color = v; }, 'set')));
    const clash = this.project.set.figures.find((f) => colorDistance(f.color, o.color) < 0.3);
    if (clash) R.append(h('div', { class: 'warn' }, `Die Farbe ähnelt der Figur „${clash.name}“. Das Videomodell könnte beides verwechseln.`));

    R.append(h('h2', {}, 'Maße'));
    const dims = [
      this.len('Breite', 'o.w', o.w, (v) => { o.w = v; }, 'set', 'cm', { min: 0.02 }),
      this.len('Tiefe', 'o.d', o.d, (v) => { o.d = v; }, 'set', 'cm', { min: 0.02 }),
      this.len('Höhe', 'o.h', o.h, (v) => { o.h = v; if (o.seat !== undefined) o.seat = Math.min(o.seat, v); }, 'set', 'cm', { min: 0.02 }),
    ];
    if (o.seat !== undefined) dims.push(this.len(o.kind === 'bett' ? 'Liegehöhe' : 'Sitzhöhe', 'o.seat', o.seat, (v) => { o.seat = Math.min(v, o.h); }, 'set', 'cm', { min: 0.05 }));
    R.append(h('div', { class: 'fields' }, dims));

    R.append(h('h2', {}, 'Position'));
    R.append(h('div', { class: 'fields' },
      this.len('X (links/rechts)', 'o.x', o.x, (v) => { o.x = v; }, 'set', 'm'),
      this.len('Z (hinten/vorne)', 'o.z', o.z, (v) => { o.z = v; }, 'set', 'm'),
      this.len('Über dem Boden', 'o.y', o.y, (v) => { o.y = v; }, 'set', 'cm', { min: 0 }),
      this.deg('Drehung', 'o.heading', o.heading, (v) => { o.heading = v; }, 'set')));
    R.append(h('p', { class: 'note' }, 'Drehung 0° heißt: Die Vorderseite zeigt im Grundriss nach oben. 90° nach rechts, 180° nach unten.'));
    R.append(h('div', { class: 'row' },
      h('button', { onclick: () => app.duplicateSelection(), title: '⇧D' }, 'Duplizieren'),
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Löschen')));
  }

  renderLight(R, o) {
    const app = this.app;
    R.append(h('h2', {}, h('span', { class: 'square', style: `background:${o.color}` }), 'Lichtquelle'));
    R.append(h('div', { class: 'fields' },
      this.text('Name', 'o.name', o.name, (v) => { o.name = v || o.name; }, 'set', { wide: true }),
      this.folderField(o),
      this.color('Farbe', o.color, (v) => { o.color = v; }, 'set'),
      this.field('Stärke', 'o.power', o.power ?? 1, (v) => `${Math.round(v * 100)} %`, (t) => parseNumber(t) / 100, (v) => { o.power = v; }, 'set', { step: 0.1, min: 0, max: 20 })));
    R.append(h('h2', {}, 'Position'));
    R.append(h('div', { class: 'fields' },
      this.len('X (links/rechts)', 'o.x', o.x, (v) => { o.x = v; }, 'set', 'm'),
      this.len('Z (hinten/vorne)', 'o.z', o.z, (v) => { o.z = v; }, 'set', 'm'),
      this.len('Über dem Boden', 'o.y', o.y, (v) => { o.y = v; }, 'set', 'cm', { min: 0 })));
    R.append(h('p', { class: 'note' }, 'Die Kugel siehst du nur im Grundriss und in der 3D-Ansicht, im Kamerabild und im Export wirkt nur ihr Licht. Für einen dunklen Raum stellst du links unter „Set“ die Helligkeit herunter.'));
    R.append(h('div', { class: 'row' },
      h('button', { onclick: () => app.duplicateSelection(), title: '⇧D' }, 'Duplizieren'),
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Löschen')));
  }

  renderSurface(R, o) {
    const app = this.app;
    const set = this.project.set;
    const onWall = o.surface === 'wand';
    const image = o.image && this.project.images?.[o.image];
    R.append(h('h2', {}, h('span', { class: 'square', style: `background:${image ? '#ffffff' : o.color}` }), 'Fläche'));
    R.append(h('div', { class: 'fields' },
      this.text('Name', 'o.name', o.name, (v) => { o.name = v || o.name; }, 'set', { wide: true }),
      this.folderField(o),
      this.select('Liegt auf', 'o.surface', o.surface, [{ value: 'boden', label: 'Boden' }, { value: 'wand', label: 'Wand' }, { value: 'decke', label: 'Decke' }], (v) => {
        o.surface = v;
        if (v !== 'wand') return;
        // nicht auf eine Wand legen, die im Kamerabild gerade ausgeblendet ist
        const H = app.world.wallTop || 2.6;
        o.d = Math.min(o.d, H);
        o.y = Math.min(1, H - o.d);
        const n = app.world.wallNormals;
        const cam = app.world.shotCamera.position;
        const open = set.walls.filter((w) => n.has(w.id) && (cam.x - w.a.x) * n.get(w.id).x + (cam.z - w.a.z) * n.get(w.id).z >= 0 && !w.cutaway);
        const dist = (w) => Math.abs((o.x - w.a.x) * n.get(w.id).x + (o.z - w.a.z) * n.get(w.id).z);
        const best = open.sort((p, q) => dist(p) - dist(q))[0];
        if (best) moveToWall(set, o, best.id);
      }, 'set', { wide: true })));
    if (onWall && set.walls.length) {
      R.append(h('div', { class: 'fields' }, this.select('An welcher Wand', 'o.wall', o.wall || '', surfaceWalls(set), (v) => { moveToWall(set, o, v); }, 'set', { wide: true })));
      if (app.world.camHidden?.includes(app.world.objectGroups.get(o.id))) R.append(h('div', { class: 'warn' }, 'Diese Wand ist im Kamerabild gerade ausgeblendet, die Fläche deshalb auch. Wähle eine andere Wand.'));
    }
    if (onWall && !set.walls.length) R.append(h('div', { class: 'warn' }, 'Es gibt noch keine Wand.'));
    if (o.surface === 'decke' && !set.ceiling) R.append(h('div', { class: 'warn' }, 'Die Decke ist ausgeschaltet. Du schaltest sie links unter „Set“ ein.'));

    R.append(h('h2', {}, 'Bild'));
    const file = h('input', { type: 'file', accept: 'image/*', hidden: true });
    file.addEventListener('change', () => { if (file.files[0]) this.loadSurfaceImage(o, file.files[0]); });
    R.append(file, h('div', { class: 'row' },
      h('button', { onclick: () => file.click() }, image ? 'Anderes Bild laden' : 'Bild laden'),
      image ? h('button', { onclick: () => { this.dropSurfaceImage(o); app.commit('set'); } }, 'Bild entfernen') : null,
      image ? h('button', { title: 'Passt die Länge an das Seitenverhältnis des Bildes an', onclick: () => {
        const img = new Image();
        img.onload = () => { o.d = Math.round((o.w * img.height / img.width) * 1000) / 1000; app.commit('set'); };
        img.src = image;
      } }, 'Unverzerrt') : null));
    if (!image) {
      R.append(h('div', { class: 'fields' }, this.swatches(OBJECT_COLORS, o.color, (v) => { o.color = v; }, 'set', { square: true }),
        this.color('Eigene Farbe', o.color, (v) => { o.color = v; }, 'set')));
      const clash = set.figures.find((f) => colorDistance(f.color, o.color) < 0.3);
      if (clash) R.append(h('div', { class: 'warn' }, `Die Farbe ähnelt der Figur „${clash.name}“. Das Videomodell könnte beides verwechseln.`));
    }
    R.append(h('p', { class: 'note' }, 'Ohne Bild ist die Fläche einfarbig, zum Beispiel 3 cm breit in Alufarbe als Schiene. PNG-Bilder dürfen durchsichtig sein.'));

    R.append(h('h2', {}, 'Maße'));
    R.append(h('div', { class: 'fields' },
      this.len('Breite', 'o.w', o.w, (v) => { o.w = v; }, 'set', 'cm', { min: 0.005 }),
      this.len(onWall ? 'Höhe' : 'Länge', 'o.d', o.d, (v) => { o.d = v; }, 'set', 'cm', { min: 0.005 })));
    R.append(h('div', { class: 'row' }, onWall
      ? [h('button', { onclick: () => { o.y = 0; o.d = app.world.wallTop || o.d; app.commit('set'); } }, 'Vom Boden bis zur Decke'),
        h('button', { title: 'Tauscht Breite und Höhe: aus einer senkrechten Schiene wird eine waagerechte', onclick: () => {
          [o.w, o.d] = [o.d, o.w];
          o.y = o.w > o.d && o.y === 0 ? 1 : Math.min(o.y, Math.max(0, (app.world.wallTop || 2.6) - o.d));
          moveToWall(set, o, o.wall);
          app.commit('set');
        } }, o.d >= o.w ? 'Waagerecht legen' : 'Senkrecht stellen')]
      : h('button', { onclick: () => { if (reachWalls(set, o)) app.commit('set'); else app.toast('In Längsrichtung fehlt auf einer Seite eine Wand.'); } }, 'Länge bis zu den Wänden')));

    R.append(h('h2', {}, 'Position'));
    R.append(h('div', { class: 'fields' },
      this.len('X (links/rechts)', 'o.x', o.x, (v) => { o.x = v; }, 'set', 'm'),
      this.len('Z (hinten/vorne)', 'o.z', o.z, (v) => { o.z = v; }, 'set', 'm'),
      onWall ? this.len('Über dem Boden', 'o.y', o.y, (v) => { o.y = v; }, 'set', 'cm', { min: 0 }) : this.deg('Drehung', 'o.heading', o.heading, (v) => { o.heading = v; }, 'set')));
    R.append(h('p', { class: 'note' }, onWall
      ? 'Im Grundriss ziehen: Die Fläche gleitet an der Wand entlang. Eine senkrechte Schiene ist dort nur ein kurzer Strich.'
      : 'Im Grundriss ziehen, die Kanten rasten an den Wänden ein (mit ⌥ frei). Eine gestrichelte Linie liegt an der Decke. Mit Drehung 90° läuft eine Schiene quer durch den Raum.'));
    R.append(h('div', { class: 'row' },
      h('button', { onclick: () => app.duplicateSelection(), title: '⇧D' }, 'Duplizieren'),
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Löschen')));
  }

  // Bild verkleinern und im Projekt ablegen, die Fläche bekommt dessen Seitenverhältnis
  loadSurfaceImage(o, file) {
    const app = this.app;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); app.toast('Dieses Bild kann ich nicht lesen.'); };
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      this.dropSurfaceImage(o);
      const id = uid();
      this.project.images[id] = file.type === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.88) : c.toDataURL('image/png');
      o.image = id;
      o.d = Math.round((o.w * c.height / c.width) * 1000) / 1000;
      app.commit('set');
    };
    img.src = url;
  }

  dropSurfaceImage(o) {
    const id = o.image;
    delete o.image;
    if (!this.project.set.objects.some((x) => x.image === id)) delete this.project.images[id];
  }

  renderFigure(R, id) {
    const app = this.app;
    const p = this.project;
    const f = p.set.figures.find((x) => x.id === id);
    const st = this.shot.figs[id];
    if (!f || !st) return;
    R.append(h('h2', {}, h('span', { class: 'dot', style: `background:${f.color}` }), 'Figur'));
    const taken = new Set(p.set.figures.filter((x) => x.id !== f.id).map((x) => x.color));
    R.append(h('div', { class: 'fields' },
      this.text('Name', 'f.name', f.name, (v) => { f.name = v || f.name; }, 'figures', { wide: true }),
      this.len('Körpergröße', 'f.height', f.height, (v) => { f.height = v; }, 'figures', 'cm', { min: 0.5, max: 2.5 }),
      h('div', { class: 'f' }, h('span', { text: 'Farbe' }), h('div', { class: 'stat' }, FIGURE_COLORS.find((c) => c.hex === f.color)?.name || f.color)),
      this.swatches(FIGURE_COLORS, f.color, (v) => { f.color = v; }, 'figures', { taken })));
    const twin = p.set.figures.find((x) => x.id !== f.id && colorDistance(x.color, f.color) < 0.3);
    if (twin) R.append(h('div', { class: 'warn' }, `Gleiche Farbe wie „${twin.name}“. Im Prompt lassen sich die beiden dann nicht auseinanderhalten.`));
    const obj = p.set.objects.find((o) => colorDistance(o.color, f.color) < 0.3);
    if (obj) R.append(h('div', { class: 'warn' }, `Das Möbel „${obj.name}“ hat eine ähnliche Farbe.`));

    R.append(h('h2', {}, `In diesem Shot`));
    R.append(this.moveBox(f, st));
    R.append(h('div', { class: 'fields' },
      this.select('Haltung am Anfang', 'st.pose', st.pose, byLabel(POSES.map((x) => ({ value: x.id, label: x.label }))), (v) => {
        st.pose = v;
        st.side = poseInfo(v).arm;
        const info = poseInfo(v);
        if (info.support !== undefined && !walks(st).length) {
          const seat = p.set.objects.find((o) => o.seat !== undefined && Math.hypot(o.x - st.x, o.z - st.z) < Math.max(o.w, o.d) / 2);
          if (seat && v === 'sitzen') st.heading = seat.heading;
        }
      }, 'helpers', { wide: true }),
      this.len('Start X', 'st.x', st.x, (v) => { st.x = v; }, 'helpers', 'm'),
      this.len('Start Z', 'st.z', st.z, (v) => { st.z = v; }, 'helpers', 'm'),
      this.deg('Blickrichtung', 'st.heading', st.heading, (v) => { st.heading = v; }, 'helpers', {}),
      this.deg('Kopf drehen', 'st.headYaw', st.headYaw, (v) => { st.headYaw = clamp(v, -80, 80); }, 'helpers', { signed: true })));
    const info = poseInfo(st.pose);
    if (info.arm) R.append(this.sidePick(st));
    if (info.support !== undefined) {
      const ev = app.world.figEval.get(f.id) || st;
      const sup = findSupport(p.set, ev.x, ev.z);
      R.append(h('p', { class: sup === null ? 'warn' : 'note' }, sup === null
        ? (st.pose === 'sitzen' ? 'Unter der Figur steht kein Sitzmöbel. Sie sitzt deshalb auf 45 cm Höhe in der Luft. Schieb sie auf einen Stuhl, Sessel, ein Sofa oder einen Quader.' : 'Die Figur liegt auf dem Boden.')
        : `${st.pose === 'sitzen' ? 'Sitzt' : 'Liegt'} auf ${fmtCm(sup)} Höhe.`));
    }

    // Blickwechsel im Lauf des Shots
    st.looks = st.looks || [];
    const looks = st.looks;
    const targets = [
      { value: '', label: 'Geradeaus' },
      ...p.set.figures.filter((x) => x.id !== f.id).map((x) => ({ value: x.id, label: x.name })),
      { value: 'cam', label: 'In die Kamera' },
      ...p.set.openings.map((o) => ({ value: 'op:' + o.id, label: openingLabel(p.set, o) })),
    ];
    const lookBox = h('div', { class: 'box' });
    lookBox.append(h('div', { class: 'box-title' }, h('b', {}, 'Blick'), h('span', { class: 'spacer' }),
      h('button', { class: 'small', title: 'Neues Blickziel ab der aktuellen Zeit', onclick: () => {
        const t = Math.round(app.state.time * 10) / 10;
        looks.push({ t, at: targets[1]?.value ?? '' });
        looks.sort((a, b) => a.t - b.t);
        app.commit('helpers');
      } }, '+ Blick ab jetzt')));
    looks.forEach((k, i) => {
      lookBox.append(h('div', { class: 'fields look' },
        this.sec('Ab', `lk.${f.id}.${i}.t`, k.t, (v) => { k.t = Math.min(v, this.shot.duration); looks.sort((a, b) => a.t - b.t); }, 'helpers', { max: this.shot.duration }),
        this.select('Schaut zu', `lk.${f.id}.${i}.at`, k.at, targets, (v) => { k.at = v; }, 'helpers'),
        h('button', { class: 'small danger', title: 'Blick entfernen', onclick: () => { looks.splice(i, 1); app.commit('helpers'); } }, '×')));
    });
    lookBox.append(h('p', { class: 'note' }, looks.length
      ? 'Der Kopf dreht sich in knapp einer halben Sekunde zum neuen Ziel. Steht die Figur und muss weiter als 70° zur Seite schauen, dreht sie sich mit dem Körper mit.'
      : 'Ohne Einträge schaut die Figur in Blickrichtung. Mit „+ Blick ab jetzt“ legst du ab der aktuellen Zeit ein Ziel fest: eine andere Figur, die Kamera oder eine Tür.'));
    R.append(lookBox);

    R.append(h('div', { class: 'row' },
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Figur entfernen')));
  }

  // Befehle wirken an der Stelle der Zeitleiste. Bewegt wird die Figur im Bild, das setzt die Punkte.
  moveBox(f, st) {
    const app = this.app;
    const now = app.state.time;
    const cur = evalFigure(st, now);
    const key = keyAt(st, now);
    const command = (pose) => {
      const walking = walks(st).some((s) => s.t < now - 0.02 && now < s.t1 - 0.02);
      const k = walking && poseInfo(pose).upright && poseInfo(cur.pose).upright ? actionKey(st, now) : ensureKey(st, now);
      k.pose = pose;
      k.dur = 1;
      delete k.to;
      if (pose !== 'sitzen' || !this.placeSeat(k)) delete k.heading;
      // Bei Haltungen mit zwei Seiten bleibt die Zeitleiste stehen, damit die Auswahl links oder rechts sichtbar ist
      if (poseInfo(pose).arm) k.side = poseInfo(pose).arm;
      else { delete k.side; app.state.time = Math.min(k.t + k.dur, this.shot.duration); }
      app.commit('helpers');
    };
    const box = h('div', { class: 'box' });
    box.append(h('div', { class: 'box-title' }, h('b', {}, `Bei ${fmtSec(now)}`), h('span', { class: 'spacer' }),
      key ? null : h('button', { class: 'small', title: 'Die Figur bleibt bis hierher an ihrem Platz und geht erst danach los', onclick: () => { ensureKey(st, now); app.commit('helpers'); } }, 'Punkt setzen')));
    const others = h('select', { class: 'step-add', title: 'Andere Haltung an dieser Stelle' },
      h('option', { value: '', text: 'Befehl …' }), byLabel([...POSES.filter((x) => x.id !== cur.pose).map((x) => ({ value: x.id, label: x.id === 'stehen' ? (poseInfo(cur.pose).upright ? 'Normal weiter' : 'Aufstehen') : x.id === 'sitzen' ? 'Setzen' : x.label })), { value: 'tuer', label: 'Tür öffnen oder schließen' }]).map((o) => h('option', { value: o.value, text: o.label })));
    others.addEventListener('change', () => {
      if (others.value === 'tuer') this.useDoor(st, now);
      else if (others.value) command(others.value);
    });
    box.append(h('div', { class: 'row' }, others));
    if (key) {
      const row = h('div', { class: 'step' });
      row.append(h('div', { class: 'box-row' }, h('b', {}, key.pose ? poseInfo(key.pose).label : 'Punkt'), h('span', { class: 'spacer' }),
        h('button', { class: 'small danger', title: 'Punkt entfernen', onclick: () => { if (key.door) delete this.shot.doors[key.door]; st.keys.splice(st.keys.indexOf(key), 1); app.commit('helpers'); } }, 'Entfernen')));
      if (key.pose) {
        if (poseInfo(key.pose).arm) row.append(this.sidePick(key));
        row.append(h('div', { class: 'fields' }, this.sec('Dauer', `ky.${key.id}.dur`, key.dur ?? 1, (v) => { key.dur = Math.max(0.1, v); }, 'helpers', { min: 0.1, max: 10 })));
        row.append(h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => { for (const k of ['pose', 'dur', 'to', 'heading']) delete key[k]; app.commit('helpers'); } }, 'Nur Befehl entfernen')));
      }
      if (key.heading !== undefined && !key.to) row.append(h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => { delete key.heading; app.commit('helpers'); } }, 'Drehung entfernen')));
      if (key.via?.length) row.append(h('div', { class: 'row' }, h('button', { class: 'small', onclick: () => { delete key.via; app.commit('helpers'); } }, 'Weg wieder gerade')));
      box.append(row);
    }
    const step = walks(st).find((s) => s.t <= now && now <= s.t1);
    if (step) {
      const L = pathLength(walkPoints(st, step));
      const v = L / Math.max(0.01, step.t1 - step.t);
      box.append(h('p', { class: v > 2.2 ? 'warn' : 'note' }, `${fmtM(L)}, ${fmtNum(v, 2)} m/s: ${tempoWord(v)}`));
    }
    box.append(h('p', { class: 'note' }, 'Zeitleiste an die Stelle ziehen, dann die Figur ziehen: Sie geht bis dahin dorthin. Klick auf den Weg im Grundriss setzt einen Zwischenpunkt für einen Bogen. „Punkt setzen“ hält sie bis zu dieser Stelle an ihrem Platz. Drehst du sie mit dem blauen Griff, behält sie diese Richtung zum Weg: Um 180° gedreht geht sie rückwärts.'));
    return box;
  }

  // Auswahl links oder rechts für Haltungen mit zwei Seiten
  sidePick(item) {
    const side = item.side || poseInfo(item.pose).arm;
    const seg = h('div', { class: 'seg' });
    for (const [value, label] of [['links', 'Links'], ['rechts', 'Rechts']]) {
      seg.append(h('button', { class: value === side ? 'on' : '', onclick: () => { item.side = value; this.app.commit('helpers'); } }, label));
    }
    return h('div', { class: 'row' }, seg);
  }

  // Die Figur dreht sich zur nächsten Tür, greift hin, die Tür bewegt sich, dann nimmt sie die Hand wieder herunter
  useDoor(st, now) {
    const app = this.app;
    const set = this.project.set;
    const shot = this.shot;
    const at = evalFigure(st, now);
    if (!poseInfo(at.pose).upright) { app.toast('Dafür muss die Figur stehen.'); this.render(); return; }
    const place = (o) => {
      const w = set.walls.find((x) => x.id === o.wall);
      const L = w && Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
      return w ? { o, x: w.a.x + ((w.b.x - w.a.x) * o.offset) / L, z: w.a.z + ((w.b.z - w.a.z) * o.offset) / L } : null;
    };
    const door = set.openings.filter((o) => o.kind === 'tuer' && o.type !== 'loch').map(place).filter(Boolean)
      .sort((a, b) => Math.hypot(a.x - at.x, a.z - at.z) - Math.hypot(b.x - at.x, b.z - at.z))[0];
    if (!door || Math.hypot(door.x - at.x, door.z - at.z) > 1.6) {
      app.toast('Hier ist keine Tür in Reichweite. Bring die Figur bis auf gut einen Meter heran.', 7000);
      this.render();
      return;
    }
    const value = doorValue(door.o, shot, now);
    const key = ensureKey(st, now);
    Object.assign(key, { pose: 'greifen', side: 'rechts', dur: 0.4, heading: Math.round(dirToHeading(door.x - at.x, door.z - at.z)), door: door.o.id });
    delete key.to;
    shot.doors = shot.doors || {};
    shot.doors[door.o.id] = { from: value, to: value > 1 ? 0 : doorMax(door.o), t0: key.t + 0.2, t1: key.t + 1.2 };
    const drop = ensureKey(st, key.t + 1.3);
    Object.assign(drop, { pose: 'stehen', dur: 0.4, quiet: true }); // nur die Hand sinkt
    app.state.time = Math.min(drop.t + drop.dur, shot.duration);
    app.commit('helpers');
  }

  // Das Panel folgt der Zeitleiste, aber nur wenn sich dort etwas ändert
  refreshKey() {
    if (this.app.state.playing) return;
    const st = this.shot.figs[this.app.state.selection.id];
    if (!st) return;
    const t = this.app.state.time;
    const stamp = `${keyAt(st, t)?.id}|${evalFigure(st, t).pose}|${walks(st).find((s) => s.t <= t && t <= s.t1)?.key}`;
    if (stamp !== this.keyStamp) { this.keyStamp = stamp; this.render(); }
    else document.querySelector('#right .box-title b')?.replaceChildren(`Bei ${fmtSec(this.app.state.time)}`);
  }

  // Sitzmöbel nahe am Punkt finden: Die Figur kommt davor an, dreht sich um und rückt auf den Sitz
  placeSeat(key) {
    const set = this.project.set;
    const seat = set.objects.filter((o) => supportHeight(o) !== null && Math.hypot(o.x - key.x, o.z - key.z) < Math.max(o.w, o.d) / 2 + 0.8)
      .sort((a, b) => Math.hypot(a.x - key.x, a.z - key.z) - Math.hypot(b.x - key.x, b.z - key.z))[0];
    if (!seat) { this.app.toast('Hier steht kein Sitzmöbel. Die Figur setzt sich auf 45 cm Höhe in die Luft.', 7000); return false; }
    const front = headingToDir(seat.heading);
    key.x = Math.round((seat.x + front.x * (seat.d / 2 + 0.2)) * 1000) / 1000;
    key.z = Math.round((seat.z + front.z * (seat.d / 2 + 0.2)) * 1000) / 1000;
    key.to = { x: seat.x, z: seat.z };
    key.heading = seat.heading;
    return true;
  }

  renderWall(R, id) {
    const app = this.app;
    const set = this.project.set;
    const w = set.walls.find((x) => x.id === id);
    if (!w) return;
    const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
    R.append(h('h2', {}, 'Wand'));
    R.append(h('div', { class: 'fields' },
      this.len('Länge (Mitte)', 'w.len', L, (v) => {
        const ux = (w.b.x - w.a.x) / L, uz = (w.b.z - w.a.z) / L;
        const old = { ...w.b };
        const nb = { x: w.a.x + ux * v, z: w.a.z + uz * v };
        for (const other of set.walls) for (const k of ['a', 'b']) {
          if (Math.hypot(other[k].x - old.x, other[k].z - old.z) < 0.01) other[k] = { ...nb };
        }
      }, 'set', 'm', { min: 0.1 }),
      h('div', { class: 'f' }, h('span', { text: 'Lichtes Maß' }), h('div', { class: 'stat' }, fmtM(clearLength(set, w)))),
      this.len('Höhe', 'w.h', w.h, (v) => { w.h = v; }, 'set', 'cm', { min: 0.1 }),
      this.len('Dicke', 'w.t', w.t, (v) => { w.t = v; }, 'set', 'cm', { min: 0.02 })));
    R.append(h('div', { class: 'row' }, this.check('Im Kamerabild immer ausblenden', !!w.cutaway, (v) => { w.cutaway = v; }, 'set')));
    R.append(h('p', { class: 'note' }, 'Länge wird auf der Wandmitte gemessen, das lichte Maß zwischen den angrenzenden Wänden. Steht die Kamera außerhalb des Raums, verschwindet die Wand vor ihr automatisch (Häkchen links unter „Set“). „Immer ausblenden“ blendet sie auch aus, wenn die Kamera im Raum steht.'));
    R.append(h('p', { class: 'note' }, 'Die Wand ziehen verschiebt sie, die angrenzenden Wände wachsen mit. Die blauen Endpunkte verschieben nur eine Ecke.'));

    R.append(h('h2', {}, 'Türen und Fenster'));
    const ops = set.openings.filter((o) => o.wall === w.id).sort((p, q) => p.offset - q.offset);
    if (!ops.length) R.append(h('div', { class: 'empty' }, 'Noch keine Öffnung in dieser Wand.'));
    const [first] = wallSides(w);
    const { ia } = wallInsets(set, w);
    for (const o of ops) {
      R.append(h('div', { class: 'box box-row' },
        h('span', { class: 'square', style: `background:${o.color}` }),
        h('b', {}, openingName(o)),
        h('span', { class: 'muted' }, `${fmtCm(o.w)} breit, ${fmtM(o.offset - o.w / 2 - ia)} von ${first}`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'small', onclick: () => app.select({ kind: 'opening', id: o.id }) }, 'Bearbeiten')));
    }
    const add = (kind) => {
      const o = newOpening(kind, w.id, L / 2);
      if (o.h > w.h) o.h = w.h;
      if (o.sill + o.h > w.h) o.sill = Math.max(0, w.h - o.h - 0.2);
      set.openings.push(o);
      app.state.selection = { kind: 'opening', id: o.id };
      app.commit('set');
    };
    R.append(h('div', { class: 'row' },
      h('button', { onclick: () => add('tuer') }, '+ Tür'),
      h('button', { onclick: () => add('fenster') }, '+ Fenster'),
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Wand löschen')));
  }

  renderOpening(R, id) {
    const app = this.app;
    const set = this.project.set;
    const o = set.openings.find((x) => x.id === id);
    const w = o && set.walls.find((x) => x.id === o.wall);
    if (!w) return;
    const door = o.kind === 'tuer';
    const { L, ia, ib } = wallInsets(set, w);
    const fit = () => { const [min, max] = openingRange(set, w, o); o.offset = clamp(o.offset, min, max); };
    const [first, second] = wallSides(w);
    R.append(h('h2', {}, h('span', { class: 'square', style: `background:${o.color}` }), openingName(o)));

    R.append(h('h2', {}, 'Lage in der Wand'));
    const gaps = [
      this.len(`Abstand ${first}`, `op.${o.id}.gapA`, o.offset - o.w / 2 - ia, (v) => { o.offset = ia + v + o.w / 2; fit(); }, 'set', 'm', { min: 0 }),
      this.len(`Abstand ${second}`, `op.${o.id}.gapB`, L - ib - o.offset - o.w / 2, (v) => { o.offset = L - ib - v - o.w / 2; fit(); }, 'set', 'm', { min: 0 }),
    ];
    // links bzw. oben immer zuerst, egal in welche Richtung die Wand gezeichnet wurde
    if (first === 'rechts' || first === 'unten') gaps.reverse();
    R.append(h('div', { class: 'fields' }, gaps));
    R.append(h('p', { class: 'note' }, 'Gemessen von der Innenecke bis zur Kante der Öffnung, so wie im Grundriss. Dort ziehst du die Öffnung auch entlang der Wand (5-cm-Raster, mit ⌥ frei). Die Pfeiltasten schieben sie um 1 cm.'));

    R.append(h('h2', {}, 'Maße'));
    const dims = [
      this.len('Breite', `op.${o.id}.w`, o.w, (v) => { o.w = Math.min(v, L - ia - ib); fit(); }, 'set', 'cm', { min: 0.3 }),
      this.len('Höhe', `op.${o.id}.h`, o.h, (v) => { o.h = Math.min(v, w.h - o.sill); }, 'set', 'cm', { min: 0.3 }),
    ];
    if (!door) dims.push(this.len('Brüstung', `op.${o.id}.sill`, o.sill, (v) => { o.sill = Math.min(v, w.h - 0.3); o.h = Math.min(o.h, w.h - o.sill); }, 'set', 'cm', { min: 0 }));
    R.append(h('div', { class: 'fields' }, dims));
    if (!door) R.append(h('p', { class: 'note' }, 'Brüstung ist die Höhe der Fensterunterkante über dem Boden. Mit 0 cm wird daraus eine Fenstertür.'));

    const hole = door && o.type === 'loch';
    const typeSelect = () => this.select('Art', `op.${o.id}.type`, o.type, [{ value: 'dreh', label: 'Drehtür' }, { value: 'schiebe', label: 'Schiebetür' }, { value: 'loch', label: 'Öffnung (nur ein Loch)' }], (v) => {
      o.type = v;
      o.open = 0;
      for (const sh of this.project.shots) delete sh.doors?.[o.id];
    }, 'set', { wide: true });
    if (hole) {
      R.append(h('h2', {}, 'Art'));
      R.append(h('div', { class: 'fields' }, typeSelect()));
      R.append(h('p', { class: 'note' }, 'Nur eine Lücke in der Wand, ohne Rahmen und Türblatt. Soll die Lücke bis zur Decke gehen, stelle die Höhe auf die Wandhöhe. Soll sich im Shot eine Tür öffnen, nimm die Schiebetür.'));
    }

    if (door && !hole) {
      const slide = o.type === 'schiebe';
      const unit = slide ? (v) => `${Math.round(v)} %` : fmtDeg;
      const max = doorMax(o);
      const range = { min: 0, max: slide ? 100 : 180, step: 5 };
      // Eine feste Stellung ersetzt die Türbewegung dieses Shots, sonst hätte sie keine Wirkung
      const setOpen = (v) => { o.open = v; delete this.shot.doors?.[o.id]; };
      R.append(h('h2', {}, 'Türblatt'));
      R.append(h('div', { class: 'fields' },
        typeSelect(),
        slide ? null : this.select('Öffnet nach', `op.${o.id}.swing`, o.swing, [{ value: 'innen', label: 'Innen (in den Raum)' }, { value: 'aussen', label: 'Außen' }], (v) => { o.swing = v; }, 'set'),
        this.select(slide ? 'Läuft nach' : 'Bänder', `op.${o.id}.hinge`, o.hinge, [{ value: 'links', label: 'Links' }, { value: 'rechts', label: 'Rechts' }], (v) => { o.hinge = v; }, 'set'),
        this.field('Geöffnet', `op.${o.id}.open`, o.open, unit, parseNumber, (v) => setOpen(Math.round(v)), 'set', range)));
      R.append(h('div', { class: 'row' },
        h('button', { class: 'small', onclick: () => { setOpen(0); app.commit('set'); } }, 'Zu'),
        h('button', { class: 'small', onclick: () => { setOpen(max / 2); app.commit('set'); } }, 'Halb offen'),
        h('button', { class: 'small', onclick: () => { setOpen(max); app.commit('set'); } }, 'Offen')));
      R.append(h('p', { class: 'note' }, slide
        ? 'Links oder rechts gilt von innen gesehen. Das Türblatt fährt in die Wand hinein.'
        : 'Bänder links oder rechts gilt von der Seite gesehen, zu der die Tür aufgeht (wie bei DIN links/rechts). Der weiße Bogen im Grundriss zeigt, wohin sie schwenkt.'));

      // Bewegung im aktuellen Shot
      const shot = this.shot;
      const mv = shot.doors?.[o.id];
      R.append(h('h2', {}, `In ${shot.name}`));
      R.append(h('div', { class: 'row' }, this.check('Tür bewegt sich in diesem Shot', !!mv, (on) => {
        shot.doors = shot.doors || {};
        if (!on) { delete shot.doors[o.id]; return; }
        const r1 = (v) => Math.round(v * 10) / 10;
        const t0 = r1(clamp(app.state.time, 0, Math.max(0, shot.duration - 1)));
        shot.doors[o.id] = { from: o.open || 0, to: o.open ? 0 : max, t0, t1: Math.min(shot.duration, r1(t0 + 1)) };
      }, 'set')));
      if (mv) {
        R.append(h('div', { class: 'fields' },
          this.field('Anfangs geöffnet', `dm.${o.id}.from`, mv.from, unit, parseNumber, (v) => { mv.from = Math.round(v); }, 'set', range),
          this.field('Am Ende geöffnet', `dm.${o.id}.to`, mv.to, unit, parseNumber, (v) => { mv.to = Math.round(v); }, 'set', range),
          this.sec('Beginnt bei', `dm.${o.id}.t0`, mv.t0, (v) => { mv.t0 = Math.min(v, shot.duration); mv.t1 = Math.max(mv.t1, mv.t0); }, 'set', { max: shot.duration }),
          this.sec('Fertig bei', `dm.${o.id}.t1`, mv.t1, (v) => { mv.t1 = Math.max(Math.min(v, shot.duration), mv.t0); }, 'set', { max: shot.duration })));
        R.append(h('p', { class: 'note' }, `Die Tür bewegt sich ${fmtSec(mv.t1 - mv.t0)} lang, sanft anfahrend und abbremsend. In der Zeitleiste ist das der helle Balken.`));
      } else {
        R.append(h('p', { class: 'note' }, 'Ohne Häkchen steht die Tür in diesem Shot so, wie oben bei „Geöffnet“ eingestellt.'));
      }
    }

    if (!hole) {
      R.append(h('h2', {}, door ? 'Farbe' : 'Rahmenfarbe'));
      R.append(h('div', { class: 'fields' }, this.swatches(OBJECT_COLORS, o.color, (v) => { o.color = v; }, 'set', { square: true }),
        this.color('Eigene Farbe', o.color, (v) => { o.color = v; }, 'set')));
    }
    const clash = !hole && set.figures.find((f) => colorDistance(f.color, o.color) < 0.3);
    if (clash) R.append(h('div', { class: 'warn' }, `Die Farbe ähnelt der Figur „${clash.name}“. Das Videomodell könnte beides verwechseln.`));

    R.append(h('div', { class: 'row' },
      h('button', { onclick: () => app.select({ kind: 'wall', id: w.id }) }, 'Zur Wand'),
      h('button', { onclick: () => app.duplicateSelection(), title: '⇧D' }, 'Duplizieren'),
      h('button', { class: 'danger', onclick: () => app.deleteSelection() }, 'Entfernen')));
  }

  renderCamera(R) {
    const app = this.app;
    const shot = this.shot;
    const c = shot.camera;
    R.append(h('h2', {}, h('span', { class: 'dot', style: `background:${CAM_COLOR}` }), 'Kamera'));
    const figOpts = [{ value: '', label: 'Frei (Schwenk und Neigung)' }, ...this.project.set.figures.map((f) => ({ value: f.id, label: `Folgt ${f.name}` }))];
    R.append(h('div', { class: 'fields' },
      this.select('Ausrichtung', 'c.aim', c.aim, figOpts, (v) => { c.aim = v; }, 'helpers', { wide: true })));

    // Alles wirkt an der Stelle der Zeitleiste und setzt dort sofort einen Punkt
    const now = app.state.time;
    const at = evalCamera(c, now);
    const key = camKeyAt(c, now);
    const here = () => ensureCamKey(c, now);
    const box = h('div', { class: 'box' });
    box.append(h('div', { class: 'box-title' }, h('b', {}, `Bei ${fmtSec(now)}`), h('span', { class: 'spacer' }),
      now >= 0.04 && !key ? h('button', { class: 'small', title: 'Die Kamera bleibt bis hierher, wie sie ist, und bewegt sich erst danach', onclick: () => { here(); app.commit('helpers'); } }, 'Punkt setzen') : null,
      h('button', { class: 'small', title: 'Übernimmt Position und Blickrichtung der 3D-Ansicht', onclick: () => {
        if (app.work.mode !== '3d') { app.toast('Wechsle zuerst in die 3D-Ansicht und richte sie aus.'); return; }
        Object.assign(here(), app.work.viewAsCameraKey());
        app.commit('helpers');
      } }, 'Aus 3D-Ansicht')));
    box.append(h('div', { class: 'fields' },
      this.len('X', 'c.x', at.x, (v) => { here().x = v; }, 'helpers', 'm'),
      this.len('Z', 'c.z', at.z, (v) => { here().z = v; }, 'helpers', 'm'),
      this.len('Höhe', 'c.y', at.y, (v) => { here().y = v; }, 'helpers', 'm', { min: 0.02 }),
      this.field('Brennweite', 'c.focal', at.focal, (v) => `${fmtNum(v, 0)} mm`, parseNumber, (v) => { here().focal = v; }, 'helpers', { step: 1, min: 8, max: 300 }),
      this.deg('Schwenk', 'c.pan', at.pan, (v) => { here().pan = v; }, 'helpers', { disabled: !!c.aim }),
      this.deg('Neigung', 'c.tilt', at.tilt, (v) => { here().tilt = clamp(v, -89, 89); }, 'helpers', { signed: true, disabled: !!c.aim })));
    if (key) {
      box.append(h('div', { class: 'row' },
        h('button', { class: 'small danger', onclick: () => { c.keys.splice(c.keys.indexOf(key), 1); app.commit('helpers'); } }, 'Punkt entfernen'),
        key.via?.length ? h('button', { class: 'small', onclick: () => { delete key.via; app.commit('helpers'); } }, 'Weg wieder gerade') : null));
    }
    R.append(box);
    R.append(h('p', { class: 'note' }, 'Zeitleiste an die Stelle ziehen, dann die Kamera einrichten: Das setzt sofort einen Punkt, und sie bewegt sich bis dorthin. Klick auf den Weg im Grundriss setzt einen Zwischenpunkt. „Punkt setzen“ hält sie bis zu dieser Stelle still.'));
    const ce = app.world.camEval;
    if (ce) R.append(h('p', { class: 'note' }, `Jetzt (${fmtSec(app.state.time)}): Höhe ${fmtM(ce.y)}, Schwenk ${fmtDeg(normDeg(ce.pan))}, Neigung ${fmtNum(ce.tilt, 0)}°, ${Math.round(ce.focal)} mm.`));
    R.append(h('p', { class: 'note' }, 'Mit der Maus im Kamerablick: Ziehen schwenkt und neigt, ⇧ + Ziehen fährt hoch, runter und seitlich, ⌥ + Ziehen fährt vor und zurück, Scrollen ändert die Brennweite.'));
    R.append(h('p', { class: 'note' }, 'Die Brennweite gilt wie bei einer Kleinbildkamera: 24 mm weit, 35 mm normal-weit, 50 mm natürlich, 85 mm Porträt. Schwenk 0° schaut im Grundriss nach oben.'));
  }

  // ---------- Zeitleiste ----------

  renderTimeline() {
    const s = this.shot;
    this.scrub.max = String(s.duration);
    this.scrub.step = String(1 / s.fps);
    this.bars.replaceChildren();
    let row = 0;
    const bar = (t0, t1, color, title) => {
      const a = clamp(t0 / s.duration, 0, 1) * 100, b = clamp(t1 / s.duration, 0, 1) * 100;
      this.bars.append(h('div', { class: 'bar', title, style: `left:${a}%;width:${Math.max(0.5, b - a)}%;top:${(row % 3) * 4.5}px;background:${color}` }));
      row++;
    };
    for (const f of this.project.set.figures) {
      const st = s.figs[f.id];
      if (st) for (const k of stepsOf(st)) if (k.type === 'gehen' || k.pose) bar(k.t, k.t1, f.color, `${f.name}: ${k.type === 'gehen' ? 'Gehen' : poseInfo(k.pose).label}, ${fmtSec(k.t)} bis ${fmtSec(k.t1)}`);
    }
    s.camera.keys.forEach((k, i) => {
      const from = i ? s.camera.keys[i - 1] : { ...s.camera.start, t: 0 };
      bar(from.t, k.t, CAM_COLOR, `Kamera: ${fmtSec(from.t)} bis ${fmtSec(k.t)}`);
    });
    for (const o of this.project.set.openings) {
      const d = s.doors?.[o.id];
      if (d && d.from !== d.to) bar(d.t0, d.t1, '#e8e8e8', `${openingLabel(this.project.set, o)}: ${fmtSec(d.t0)} bis ${fmtSec(d.t1)}`);
    }
    this.keyMarks();
    this.ticks.replaceChildren();
    const step = s.duration > 30 ? 5 : s.duration > 12 ? 2 : 1;
    for (let t = 0; t <= s.duration + 1e-6; t += step) {
      this.ticks.append(h('span', { style: `left:${(t / s.duration) * 100}%` }, `${t}`));
    }
    this.updateTime();
  }

  // Rauten der gewählten Figur: Klick springt hin, Ziehen verschiebt den Punkt in der Zeit
  keyMarks() {
    const app = this.app;
    const s = this.shot;
    const sel = app.state.selection;
    const camera = sel?.kind === 'camera';
    const keys = camera ? s.camera.keys : s.figs[sel?.id]?.keys;
    if (!keys || !(camera || sel?.kind === 'figure')) return;
    const color = camera ? CAM_COLOR : this.project.set.figures.find((f) => f.id === sel.id)?.color;
    const left = (t) => `${clamp(t / s.duration, 0, 1) * 100}%`;
    keys.forEach((k, i) => {
      const mark = h('div', { class: 'keymark', title: `Punkt bei ${fmtSec(k.t)}. Klick springt hin, Ziehen verschiebt ihn`, style: `left:${left(k.t)};background:${color}` });
      mark.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        mark.setPointerCapture(e.pointerId);
        const r = this.bars.getBoundingClientRect();
        const min = (keys[i - 1]?.t ?? 0) + 0.1, max = (keys[i + 1]?.t ?? s.duration + 0.1) - 0.1;
        let moved = false;
        const move = (ev) => {
          const t = clamp(Math.round(((ev.clientX - r.left) / r.width) * s.duration * s.fps) / s.fps, min, Math.min(max, s.duration));
          if (Math.abs(ev.clientX - e.clientX) < 3 && !moved) return;
          moved = true;
          k.t = t;
          mark.style.left = left(t);
          app.setTime(t);
          app.live();
        };
        const up = () => {
          mark.removeEventListener('pointermove', move);
          mark.removeEventListener('pointerup', up);
          if (moved) app.commit('helpers');
          else app.setTime(k.t);
        };
        mark.addEventListener('pointermove', move);
        mark.addEventListener('pointerup', up);
      });
      this.bars.append(mark);
    });
  }

  updateTime() {
    const t = this.app.state.time;
    this.scrub.value = String(t);
    this.timeText.textContent = `${fmtSec(t)} / ${fmtSec(this.shot.duration)}`;
    this.playBtn.textContent = this.app.state.playing ? '❚❚' : '▶';
  }
}

function tempoWord(v) {
  if (v < 0.5) return 'Sehr langsam';
  if (v < 1.0) return 'Langsames Gehen';
  if (v < 1.6) return 'Normales Gehen';
  if (v < 2.5) return 'Zügiges Gehen bis Joggen';
  return 'Rennen';
}
