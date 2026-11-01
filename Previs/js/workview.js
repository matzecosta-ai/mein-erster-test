// Arbeitsansicht: Grundriss (von oben) oder freie 3D-Ansicht, mit Werkzeugen zum Stellen, Zeichnen und Messen.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { TransformControls } from 'three/addons/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { HELPER_LAYER } from './world.js';
import { CUTAWAY_LAYER, openingRange, settleSurface, snapSurfaceEdges } from './build.js';
import { dirToHeading, headingToRotY, fmtM, normDeg, clamp, DEG } from './units.js';
import { uid, keyAt, ensureKey, ensureCamKey, evalCamera } from './model.js';
import { poseInfo } from './mannequin.js';

const SNAP = 0.05;
const snap = (v, free) => (free ? Math.round(v * 1000) / 1000 : Math.round(v / SNAP) / Math.round(1 / SNAP));
const snapDeg = (d, e) => normDeg(e.altKey ? Math.round(d) : Math.round(d / (e.shiftKey ? 15 : 5)) * (e.shiftKey ? 15 : 5));
const same = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.01;

const HINTS = {
  select: 'Ziehen verschiebt, blauer Griff dreht. Leere Fläche ziehen verschiebt die Ansicht.',
  wall: 'Punkt anklicken, ziehen, nächsten Punkt anklicken. Rechte Winkel rasten ein, an Wänden dockt die Wand an. Mit ⌥ frei. Enter oder Esc beendet.',
  measure: 'Zwei Punkte anklicken.',
  lasso: 'Mit gedrückter Maustaste einkreisen. Danach gemeinsam ziehen, ⌘C kopiert, ⌘V fügt ein.',
};

// Wo der Weg zu einem Punkt beginnt: am vorigen Punkt oder, ohne ihn, am Start der Figur
function walkStart(st, key) {
  const before = st.keys.slice(0, st.keys.indexOf(key)).filter((k) => !k.action).at(-1);
  return before ? before.to || before : st;
}

export class WorkView {
  constructor(app, container) {
    this.app = app;
    this.el = container;
    this.world = app.world;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.prepend(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    this.labels.domElement.className = 'labels';
    container.appendChild(this.labels.domElement);
    this.coords = container.querySelector('#coords');

    this.mode = 'plan';
    this.planCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.planCam.up.set(0, 0, -1);
    this.planCam.layers.enable(HELPER_LAYER);
    this.planCam.layers.enable(CUTAWAY_LAYER);
    this.planCenter = { x: 0, z: 2 };
    this.planHeight = 13;

    this.perspCam = new THREE.PerspectiveCamera(45, 1, 0.05, 300);
    this.perspCam.position.set(6, 6.5, 9);
    this.perspCam.layers.enable(HELPER_LAYER);
    this.perspCam.layers.enable(CUTAWAY_LAYER);
    this.orbit = new OrbitControls(this.perspCam, this.renderer.domElement);
    this.orbit.target.set(0, 0.8, 0);
    this.orbit.enableDamping = false;
    this.orbit.enabled = false;
    this.orbit.update();

    this.proxy = new THREE.Object3D();
    this.world.scene.add(this.proxy);
    this.gizmo = new TransformControls(this.perspCam, this.renderer.domElement);
    this.gizmo.setTranslationSnap(SNAP);
    this.gizmo.setRotationSnap(5 * DEG);
    this.gizmo.setSize(0.8);
    this.gizmoHelper = this.gizmo.getHelper();
    this.world.scene.add(this.gizmoHelper);
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = this.mode === '3d' && !e.value;
      if (e.value) {
        this.gizmoStart = this.proxy.position.clone();
        this.hold(this.app.state.selection);
      } else {
        this.hold(null);
        this.app.commit(this.gizmoScope || 'helpers');
      }
    });
    this.gizmo.addEventListener('objectChange', () => this.onGizmoChange());

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();
    this.drag = null;
    this.draft = null;
    this.measure = null;
    this.size = { w: 0, h: 0 };

    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointerleave', () => { this.coords.textContent = ''; });
    c.addEventListener('dblclick', (e) => this.onDouble(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    this.setTool('select');
  }

  // ---------- Modus und Werkzeug ----------

  setMode(mode) {
    this.mode = mode;
    this.orbit.enabled = mode === '3d';
    if (mode === 'plan') this.gizmo.detach();
    this.finishDraft();
    this.onSelection();
    this.app.ui?.syncViewbar();
  }

  setTool(tool) {
    this.finishDraft();
    this.clearMeasure();
    this.tool = tool;
    if (tool !== 'select' && this.mode === '3d') this.setMode('plan');
    this.el.className = 'canvas-wrap tool-' + tool;
    document.getElementById('toolHint').textContent = HINTS[tool];
    this.app.ui?.syncViewbar();
  }

  onSelection() {
    const sel = this.app.state.selection;
    if (this.mode !== '3d' || !sel || (sel.kind !== 'object' && sel.kind !== 'figure')) {
      this.gizmo.detach();
      return;
    }
    this.gizmoScope = sel.kind === 'object' ? 'set' : 'helpers';
    this.syncProxy();
    this.gizmo.attach(this.proxy);
    this.applyGizmoMode();
  }

  applyGizmoMode() {
    const sel = this.app.state.selection;
    if (!sel) return;
    this.gizmo.showX = this.gizmo.getMode() === 'translate';
    this.gizmo.showZ = this.gizmo.getMode() === 'translate';
    this.gizmo.showY = this.gizmo.getMode() === 'rotate' || sel.kind === 'object';
  }

  setGizmoMode(mode) {
    if (this.mode !== '3d') return;
    this.gizmo.setMode(mode);
    this.applyGizmoMode();
  }

  syncProxy() {
    const sel = this.app.state.selection;
    if (!sel) return;
    if (sel.kind === 'object') {
      const o = this.app.state.project.set.objects.find((x) => x.id === sel.id);
      if (!o) return;
      this.proxy.position.set(o.x, o.y, o.z);
      this.proxy.rotation.set(0, headingToRotY(o.heading), 0);
    } else if (sel.kind === 'figure') {
      const ev = this.world.figEval.get(sel.id);
      if (!ev) return;
      this.proxy.position.set(ev.x, 0, ev.z);
      this.proxy.rotation.set(0, headingToRotY(ev.heading), 0);
    }
    this.lastProxy = this.proxy.position.clone();
  }

  onGizmoChange() {
    const sel = this.app.state.selection;
    if (!sel) return;
    const heading = normDeg(180 - this.proxy.rotation.y / DEG);
    if (sel.kind === 'object') {
      const o = this.app.state.project.set.objects.find((x) => x.id === sel.id);
      o.x = snap(this.proxy.position.x);
      o.z = snap(this.proxy.position.z);
      o.y = Math.max(0, snap(this.proxy.position.y));
      o.heading = Math.round(heading);
      settleSurface(this.app.state.project.set, o);
      const g = this.world.objectGroups.get(o.id);
      g.position.set(o.x, o.y, o.z);
      g.rotation.y = headingToRotY(o.heading);
    } else {
      const st = this.app.shot.figs[sel.id];
      const dx = this.proxy.position.x - this.lastProxy.x;
      const dz = this.proxy.position.z - this.lastProxy.z;
      this.lastProxy = this.proxy.position.clone();
      const time = this.app.state.time;
      if (dx || dz) {
        const target = time < 0.04 ? st : ensureKey(st, time);
        target.x += dx; target.z += dz;
      }
      if (time < 0.04) st.heading = Math.round(heading);
      else if (this.gizmo.getMode() === 'rotate') ensureKey(st, time).heading = Math.round(heading);
    }
    this.app.live();
  }

  // ---------- Koordinaten ----------

  ndc(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  get camera() {
    return this.mode === 'plan' ? this.planCam : this.perspCam;
  }

  ground(e, y = 0) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const p = new THREE.Vector3();
    const ok = this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p);
    return ok ? { x: p.x, z: p.z } : null;
  }

  pick(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    const order = [this.world.handles || [], this.world.pathLines || [], [this.world.camGizmo, ...(this.world.discs ? this.world.discs.values() : [])].filter(Boolean), [this.world.figGroup, this.world.setGroup]];
    for (const targets of order) {
      const hits = this.raycaster.intersectObjects(targets, true);
      for (const h of hits) {
        const p = h.object.userData.pick;
        if (!p || p.kind === 'floor' || p.kind === 'ceiling') continue;
        if (!h.object.visible) continue;
        return p;
      }
    }
    return null;
  }

  // ---------- Maus ----------

  onDown(e) {
    const app = this.app;
    const p = this.ground(e);
    this.downAt = { x: e.clientX, y: e.clientY };
    if (this.mode === '3d') {
      if (this.tool !== 'select') return;
      this.downPick = e.button === 0 ? this.pick(e) : null;
      this.hold(this.downPick);
      return;
    }
    if (e.button !== 0) {
      this.startPan(e);
      return;
    }
    if (!p) return;
    if (this.tool === 'wall') return this.wallClick(p, e);
    if (this.tool === 'measure') return this.measureClick(p, e);
    if (this.tool === 'lasso') { this.lasso = [p]; this.renderer.domElement.setPointerCapture(e.pointerId); return; }

    const hit = this.pick(e);
    const group = hit && app.world.marked?.some((x) => x.kind === hit.kind && x.id === hit.id);
    if (group) return this.startGroup(p, e);
    if (!hit) {
      if (app.state.selection || app.world.marked?.length) app.select(null);
      this.startPan(e);
      return;
    }
    this.startDrag(hit, p, e);
  }

  startPan(e) {
    this.drag = { kind: 'pan', last: { x: e.clientX, y: e.clientY } };
    this.el.classList.add('grabbing');
    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  startDrag(hit, p, e) {
    const app = this.app;
    const { project } = app.state;
    const shot = app.shot;
    const sel = app.state.selection || {};
    // Steht die Figur auf einem Punkt oder ihrem Weg, gilt der Griff der Figur
    if (hit.kind === 'keyHandle' || hit.kind === 'pathLine') {
      const ev = this.world.figEval.get(hit.fig);
      if (ev && Math.hypot(ev.x - p.x, ev.z - p.z) < 0.35) hit = { kind: 'figure', id: hit.fig };
    }
    if ((hit.kind === 'camHandle' && hit.index === undefined) || hit.kind === 'camLine') {
      const at = evalCamera(shot.camera, app.state.time);
      if (Math.hypot(at.x - p.x, at.z - p.z) < 0.35) hit = { kind: 'camera' };
    }
    const d = { kind: hit.kind, hit, start: p, moved: false, scope: 'helpers' };
    switch (hit.kind) {
      case 'object': {
        const o = project.set.objects.find((x) => x.id === hit.id);
        d.obj = o;
        d.orig = { x: o.x, z: o.z };
        d.scope = 'set';
        if (sel.kind !== 'object' || sel.id !== o.id) app.select({ kind: 'object', id: o.id });
        break;
      }
      case 'figure': {
        const st = shot.figs[hit.id];
        d.st = st;
        const ev = this.world.figEval.get(hit.id);
        d.orig = { x: ev.x, z: ev.z };
        d.time = app.state.time;
        d.key = keyAt(st, d.time);
        // Sitzt oder liegt sie gerade, muss sie erst aufstehen, um zu gehen
        d.stuck = d.time >= 0.04 && !d.key && !poseInfo(ev.pose).upright;
        if (sel.kind !== 'figure' || sel.id !== hit.id) app.select({ kind: 'figure', id: hit.id });
        break;
      }
      case 'pathLine':
      case 'keyHandle':
      case 'pathHandle': {
        d.st = shot.figs[hit.fig];
        d.key = d.st.keys.find((k) => k.id === hit.key);
        if (hit.kind === 'pathLine') {
          // neuer Zwischenpunkt dort, wo er den Weg am wenigsten verlängert
          const start = walkStart(d.st, d.key);
          const via = d.key.via = d.key.via || [];
          const pts = [start, ...via, d.key];
          let best = 0, cost = Infinity;
          for (let i = 0; i < pts.length - 1; i++) {
            const c = Math.hypot(pts[i].x - p.x, pts[i].z - p.z) + Math.hypot(pts[i + 1].x - p.x, pts[i + 1].z - p.z) - Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
            if (c < cost) { cost = c; best = i; }
          }
          via.splice(best, 0, { x: p.x, z: p.z });
          d.kind = 'pathHandle';
          d.hit = { ...hit, index: best };
        }
        if (sel.kind !== 'figure' || sel.id !== hit.fig) app.select({ kind: 'figure', id: hit.fig });
        break;
      }
      case 'rotHandle':
        d.sel = { ...sel };
        d.scope = sel.kind === 'object' ? 'set' : 'helpers';
        break;
      case 'camera': {
        const at = evalCamera(shot.camera, app.state.time);
        d.orig = { x: at.x, z: at.z };
        d.time = app.state.time;
        if (sel.kind !== 'camera') app.select({ kind: 'camera' });
        break;
      }
      case 'camLine': {
        // neuer Zwischenpunkt auf dem Kameraweg
        const c = shot.camera;
        const key = c.keys.find((k) => k.id === hit.key);
        const i = c.keys.indexOf(key);
        const via = key.via = key.via || [];
        const pts = [i ? c.keys[i - 1] : c.start, ...via, key];
        let best = 0, cost = Infinity;
        for (let n = 0; n < pts.length - 1; n++) {
          const v = Math.hypot(pts[n].x - p.x, pts[n].z - p.z) + Math.hypot(pts[n + 1].x - p.x, pts[n + 1].z - p.z) - Math.hypot(pts[n + 1].x - pts[n].x, pts[n + 1].z - pts[n].z);
          if (v < cost) { cost = v; best = n; }
        }
        via.splice(best, 0, { x: p.x, z: p.z });
        d.kind = 'camHandle';
        d.hit = { kind: 'camHandle', key: hit.key, index: best };
        break;
      }
      case 'camHandle':
      case 'camRot':
        if (sel.kind !== 'camera') app.select({ kind: 'camera' });
        break;
      case 'wall':
      case 'wallEnd': {
        const w = project.set.walls.find((x) => x.id === hit.id);
        d.wall = w;
        d.scope = 'set';
        const ends = hit.kind === 'wallEnd' ? [w[hit.end]] : [w.a, w.b];
        d.points = [];
        for (const end of ends) {
          for (const other of project.set.walls) for (const k of ['a', 'b']) {
            if (same(other[k], end)) d.points.push({ ref: other[k], orig: { ...other[k] } });
          }
        }
        if (sel.kind !== 'wall' || sel.id !== w.id) app.select({ kind: 'wall', id: w.id });
        break;
      }
      case 'opening': {
        const o = project.set.openings.find((x) => x.id === hit.id);
        const w = o && project.set.walls.find((x) => x.id === o.wall);
        if (!w) return;
        const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z);
        d.op = o;
        d.wall = w;
        d.u = { x: (w.b.x - w.a.x) / L, z: (w.b.z - w.a.z) / L };
        d.grab = (p.x - w.a.x) * d.u.x + (p.z - w.a.z) * d.u.z - o.offset;
        d.scope = 'set';
        if (sel.kind !== 'opening' || sel.id !== o.id) app.select({ kind: 'opening', id: o.id });
        break;
      }
      default:
        return;
    }
    this.drag = d;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.hold(hit);
  }

  // Rote Markierung, solange etwas angefasst ist
  hold(hit) {
    const kind = hit?.kind === 'wallEnd' ? 'wall' : hit?.kind;
    const held = ['object', 'figure', 'wall', 'opening'].includes(kind) ? { kind, id: hit.id } : null;
    if (held?.kind === this.world.held?.kind && held?.id === this.world.held?.id) return;
    this.world.setHeld(this.app, held);
  }

  onMove(e) {
    const p = this.ground(e);
    if (p) this.coords.textContent = `X ${fmtM(p.x)}   Z ${fmtM(p.z)}`;
    if (this.mode === '3d') return;
    if (this.draft && p) this.updateDraftPreview(p, e);
    if (this.measure && this.measure.a && !this.measure.b && p) this.drawMeasure(this.measure.a, p);
    if (this.lasso && p) { this.lasso.push(p); this.drawLasso(); return; }
    const d = this.drag;
    if (!d) {
      if (this.tool === 'select') {
        const hit = this.pick(e);
        this.el.classList.toggle('grab', !!hit);
      }
      return;
    }
    if (d.kind === 'pan') {
      const r = this.renderer.domElement.getBoundingClientRect();
      const mPerPx = this.planHeight / r.height;
      this.planCenter.x -= (e.clientX - d.last.x) * mPerPx;
      this.planCenter.z -= (e.clientY - d.last.y) * mPerPx;
      d.last = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!p) return;
    if (!d.moved && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 3) return;
    d.moved = true;
    const free = e.altKey;
    const dx = p.x - d.start.x;
    const dz = p.z - d.start.z;
    const shot = this.app.shot;
    switch (d.kind) {
      case 'object': {
        d.obj.x = snap(d.orig.x + dx, free);
        d.obj.z = snap(d.orig.z + dz, free);
        const { set } = this.app.state.project;
        if (!free) snapSurfaceEdges(set, d.obj);
        settleSurface(set, d.obj);
        const g = this.world.objectGroups.get(d.obj.id);
        g.position.set(d.obj.x, d.obj.y, d.obj.z);
        g.rotation.y = headingToRotY(d.obj.heading);
        break;
      }
      case 'figure': {
        if (d.stuck) return;
        const nx = snap(d.orig.x + dx, free);
        const nz = snap(d.orig.z + dz, free);
        // am Anfang des Shots ist es der Startpunkt, sonst setzt das Ziehen einen Punkt
        const target = d.time < 0.04 ? d.st : (d.key = d.key || ensureKey(d.st, d.time));
        delete target.action; // bekommt der Befehl einen Ort, wird er ein normaler Punkt
        target.x = nx; target.z = nz;
        break;
      }
      case 'group': {
        const mx = snap(dx, free), mz = snap(dz, free);
        for (const q of d.items) { q.ref.x = q.x + mx; q.ref.z = q.z + mz; }
        this.app.live('set');
        return;
      }
      case 'keyHandle': {
        d.key.x = snap(p.x, free);
        d.key.z = snap(p.z, free);
        break;
      }
      case 'pathHandle': {
        const target = d.key.via[d.hit.index];
        target.x = snap(p.x, free);
        target.z = snap(p.z, free);
        break;
      }
      case 'rotHandle': {
        const { project } = this.app.state;
        if (d.sel.kind === 'object') {
          const o = project.set.objects.find((x) => x.id === d.sel.id);
          o.heading = snapDeg(dirToHeading(p.x - o.x, p.z - o.z), e);
          this.world.objectGroups.get(o.id).rotation.y = headingToRotY(o.heading);
        } else if (d.sel.kind === 'figure') {
          const st = shot.figs[d.sel.id];
          const time = this.app.state.time;
          const ev = this.world.figEval.get(d.sel.id);
          const value = snapDeg(dirToHeading(p.x - ev.x, p.z - ev.z), e);
          if (time < 0.04) st.heading = value;
          else ensureKey(st, time).heading = value;
        }
        break;
      }
      case 'camera': {
        const k = ensureCamKey(shot.camera, d.time);
        k.x = snap(d.orig.x + dx, free);
        k.z = snap(d.orig.z + dz, free);
        break;
      }
      case 'camHandle': {
        const key = shot.camera.keys.find((k) => k.id === d.hit.key);
        const target = d.hit.index === undefined ? key : key.via[d.hit.index];
        target.x = snap(p.x, free);
        target.z = snap(p.z, free);
        break;
      }
      case 'camRot': {
        const at = evalCamera(shot.camera, this.app.state.time);
        ensureCamKey(shot.camera, this.app.state.time).pan = snapDeg(dirToHeading(p.x - at.x, p.z - at.z), e);
        break;
      }
      case 'wallEnd':
      case 'wall': {
        let mx = dx, mz = dz;
        if (d.kind === 'wallEnd') {
          const w = d.wall;
          const other = d.hit.end === 'a' ? w.b : w.a;
          let nx = snap(d.points[0].orig.x + dx, free);
          let nz = snap(d.points[0].orig.z + dz, free);
          if (!free && Math.abs(nx - other.x) < 0.12) nx = other.x;
          if (!free && Math.abs(nz - other.z) < 0.12) nz = other.z;
          mx = nx - d.points[0].orig.x;
          mz = nz - d.points[0].orig.z;
        } else {
          mx = snap(dx, free);
          mz = snap(dz, free);
        }
        for (const pt of d.points) { pt.ref.x = pt.orig.x + mx; pt.ref.z = pt.orig.z + mz; }
        this.app.live('set');
        return;
      }
      case 'opening': {
        // nur entlang der Wand; gerastert wird der Abstand zur Ecke, nicht die Mitte
        const { op, wall } = d;
        const [min, max] = openingRange(this.app.state.project.set, wall, op);
        const along = (p.x - wall.a.x) * d.u.x + (p.z - wall.a.z) * d.u.z - d.grab;
        const gap = snap(along - min, free);
        op.offset = clamp(min + gap, min, max);
        this.app.live('set');
        return;
      }
    }
    this.app.live();
  }

  // Eingekreistes gemeinsam ziehen
  startGroup(p, e) {
    const set = this.app.state.project.set;
    const pts = [];
    for (const m of this.app.world.marked) {
      if (m.kind === 'object') pts.push(set.objects.find((o) => o.id === m.id));
      else if (m.kind === 'wall') { const w = set.walls.find((x) => x.id === m.id); pts.push(w.a, w.b); }
    }
    const items = pts.filter(Boolean).map((ref) => ({ ref, x: ref.x, z: ref.z }));
    this.drag = { kind: 'group', items, start: p, moved: false, scope: 'set' };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  }

  drawLasso() {
    this.clearTool();
    const pts = [...this.lasso, this.lasso[0]].map((q) => new THREE.Vector3(q.x, 0.06, q.z));
    this.world.toolGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' })));
    this.world.toolGroup.traverse((c) => c.layers.set(HELPER_LAYER));
  }

  finishLasso() {
    const poly = this.lasso;
    this.lasso = null;
    this.clearTool();
    const inside = (q) => {
      let hit = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if ((a.z > q.z) !== (b.z > q.z) && q.x < ((b.x - a.x) * (q.z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
      }
      return hit;
    };
    const set = this.app.state.project.set;
    const list = [
      ...set.objects.filter(inside).map((o) => ({ kind: 'object', id: o.id })),
      ...set.walls.filter((w) => inside(w.a) && inside(w.b)).map((w) => ({ kind: 'wall', id: w.id })),
    ];
    this.setTool('select');
    this.app.select(null);
    this.world.setMarked(list);
    this.app.toast(list.length ? `${list.length} eingekreist. Ziehen verschiebt alles, ⌘C kopiert.` : 'Nichts eingekreist. Möbel zählen mit ihrer Mitte, Wände mit beiden Enden.');
  }

  onUp(e) {
    if (this.lasso) return this.finishLasso();
    this.hold(null);
    if (this.mode === '3d') {
      const moved = this.downAt && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 4;
      if (!moved && e.button === 0 && this.tool === 'select' && !this.gizmo.dragging) {
        const hit = this.downPick;
        if (!hit) this.app.select(null);
        else if (hit.kind === 'object' || hit.kind === 'figure' || hit.kind === 'wall' || hit.kind === 'opening') this.app.select({ kind: hit.kind, id: hit.id });
        else if (hit.kind === 'camera' || hit.kind === 'camHandle') this.app.select({ kind: 'camera' });
      }
      return;
    }
    const d = this.drag;
    this.drag = null;
    this.el.classList.remove('grabbing');
    if (!d || d.kind === 'pan') return;
    if (d.stuck && d.moved) this.app.toast('Die Figur sitzt oder liegt hier. Wähle rechts erst „Aufstehen“ und zieh sie dann später in der Zeitleiste.', 7000);
    // Wer einen Sitzplatz verschiebt, setzt die Figur am neuen Ort wieder richtig hin
    if (d.moved && (d.kind === 'figure' || d.kind === 'keyHandle') && d.key?.pose === 'sitzen') this.app.ui.placeSeat(d.key);
    if (d.moved) this.app.commit(d.scope);
  }

  onDouble(e) {
    if (this.tool === 'wall') {
      this.finishDraft();
      this.setTool('select');
    }
  }

  onWheel(e) {
    if (this.mode !== 'plan') return;
    e.preventDefault();
    const before = this.ground(e);
    const factor = Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.planHeight = clamp(this.planHeight * factor, 1.5, 150);
    this.updatePlanCamera();
    const after = this.ground(e);
    if (before && after) {
      this.planCenter.x += before.x - after.x;
      this.planCenter.z += before.z - after.z;
    }
  }

  // ---------- Wände zeichnen ----------

  // Zeichenpunkt für Wände. Vorrang: Wandecke, dann Stelle auf einer Wand, dann rechter Winkel. Mit ⌥ frei.
  // this.docked sagt, ob der Punkt an einer bestehenden Wand liegt.
  snapPoint(p, e, from) {
    this.docked = false;
    if (e.altKey) return { x: snap(p.x, true), z: snap(p.z, true) };
    const { walls } = this.app.state.project.set;
    for (const w of walls) for (const k of ['a', 'b']) {
      if (Math.hypot(w[k].x - p.x, w[k].z - p.z) < 0.18) { this.docked = true; return { ...w[k] }; }
    }
    let q = from ? this.squareUp(p, from) : { x: snap(p.x), z: snap(p.z) };
    for (const w of walls) {
      const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
      const L2 = dx * dx + dz * dz || 1;
      const u = ((q.x - w.a.x) * dx + (q.z - w.a.z) * dz) / L2;
      if (u <= 0 || u >= 1) continue;
      const on = { x: w.a.x + dx * u, z: w.a.z + dz * u };
      if (Math.hypot(on.x - q.x, on.z - q.z) < 0.18) {
        this.docked = true;
        return { x: Math.round(on.x * 1000) / 1000, z: Math.round(on.z * 1000) / 1000 };
      }
    }
    return q;
  }

  // Liegt die Richtung nahe an einem rechten Winkel zur vorigen Wand oder zum Raster, rastet sie dort ein.
  // Die Länge läuft in 5-cm-Schritten.
  squareUp(p, from) {
    const dx = p.x - from.x, dz = p.z - from.z;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dz, dx);
    const prev = this.draft?.points.length > 1 ? this.draft.points.at(-2) : null;
    const base = prev ? Math.atan2(from.z - prev.z, from.x - prev.x) : 0;
    const bases = [base, 0];
    let best = null, off = 7 * DEG;
    for (const b of bases) for (let k = 0; k < 4; k++) {
      const a = b + (k * Math.PI) / 2;
      const d = Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a)));
      if (d < off) { off = d; best = a; }
    }
    if (best === null) return { x: snap(p.x), z: snap(p.z) };
    const L = Math.round(len / SNAP) * SNAP;
    const q = { x: Math.round((from.x + Math.cos(best) * L) * 1000) / 1000, z: Math.round((from.z + Math.sin(best) * L) * 1000) / 1000 };
    // auf Höhe des ersten Punkts rasten, damit sich der Raum rechtwinklig schließt
    const start = this.draft?.points[0];
    if (start && Math.abs(Math.sin(best)) < 1e-6 && Math.abs(q.x - start.x) < 0.15) q.x = start.x;
    if (start && Math.abs(Math.cos(best)) < 1e-6 && Math.abs(q.z - start.z) < 0.15) q.z = start.z;
    return q;
  }

  wallClick(p, e) {
    const set = this.app.state.project.set;
    const last = this.draft?.points.at(-1);
    const q = this.snapPoint(p, e, last);
    const docked = this.docked;
    if (!this.draft) {
      this.draft = { kind: 'wall', points: [q] };
      return;
    }
    if (same(q, last)) return this.finishDraft();
    const prev = set.walls.at(-1);
    set.walls.push({ id: uid(), a: { ...last }, b: { ...q }, t: prev?.t ?? 0.15, h: prev?.h ?? 2.6 });
    this.draft.points.push(q);
    this.app.commit('set');
    // Raum geschlossen oder an eine bestehende Wand angedockt: Der Strang ist fertig
    if (same(q, this.draft.points[0]) || docked) this.setTool('select');
  }

  updateDraftPreview(p, e) {
    const d = this.draft;
    const last = d.points.at(-1);
    const q = d.kind === 'wall' ? this.snapPoint(p, e, last) : { x: snap(p.x, e.altKey), z: snap(p.z, e.altKey) };
    this.clearTool();
    const y = d.kind === 'path' ? 0.03 : 0.05;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(last.x, y, last.z), new THREE.Vector3(q.x, y, q.z)]);
    const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff' }));
    const lb = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'lbl lbl-tool', textContent: fmtM(Math.hypot(q.x - last.x, q.z - last.z)) }));
    lb.position.set((last.x + q.x) / 2, y, (last.z + q.z) / 2);
    this.world.toolGroup.add(ln, lb);
    this.world.toolGroup.traverse((c) => c.layers.set(HELPER_LAYER));
  }

  finishDraft() {
    if (!this.draft) return;
    this.draft = null;
    this.clearTool();
  }

  clearTool() {
    for (const c of [...this.world.toolGroup.children]) {
      if (c.element) c.element.remove();
      c.geometry?.dispose();
      this.world.toolGroup.remove(c);
    }
  }

  // ---------- Messen ----------

  measureClick(p, e) {
    const q = { x: snap(p.x, e.altKey), z: snap(p.z, e.altKey) };
    if (!this.measure || this.measure.b) this.measure = { a: q };
    else {
      this.measure.b = q;
      this.drawMeasure(this.measure.a, q);
    }
  }

  drawMeasure(a, b) {
    this.clearTool();
    const y = 0.06;
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, y, a.z), new THREE.Vector3(b.x, y, b.z)]);
    const ln = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#ffffff' }));
    const lb = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'lbl lbl-tool', textContent: fmtM(Math.hypot(b.x - a.x, b.z - a.z)) }));
    lb.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
    this.world.toolGroup.add(ln, lb);
    this.world.toolGroup.traverse((c) => c.layers.set(HELPER_LAYER));
  }

  clearMeasure() {
    this.measure = null;
    this.clearTool();
  }

  cancel() {
    if (this.draft || this.tool !== 'select') {
      this.finishDraft();
      this.setTool('select');
      return true;
    }
    return false;
  }

  focusSelection() {
    const sel = this.app.state.selection;
    let p = null;
    if (sel?.kind === 'object') {
      const o = this.app.state.project.set.objects.find((x) => x.id === sel.id);
      if (o) p = new THREE.Vector3(o.x, o.y + o.h / 2, o.z);
    } else if (sel?.kind === 'figure') {
      const ev = this.world.figEval.get(sel.id);
      if (ev) p = new THREE.Vector3(ev.x, 0.9, ev.z);
    } else if (sel?.kind === 'camera') {
      p = this.world.shotCamera.position.clone();
    } else if (sel?.kind === 'opening' || sel?.kind === 'wall') {
      const set = this.app.state.project.set;
      const o = set.openings.find((x) => x.id === sel.id);
      const w = set.walls.find((x) => x.id === (o ? o.wall : sel.id));
      if (w) {
        const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1;
        const k = o ? o.offset / L : 0.5;
        p = new THREE.Vector3(w.a.x + (w.b.x - w.a.x) * k, 1, w.a.z + (w.b.z - w.a.z) * k);
      }
    }
    if (!p) return;
    if (this.mode === 'plan') {
      this.planCenter = { x: p.x, z: p.z };
    } else {
      const off = this.perspCam.position.clone().sub(this.orbit.target);
      this.orbit.target.copy(p);
      this.perspCam.position.copy(p).add(off);
      this.orbit.update();
    }
  }

  // ---------- Zeichnen ----------

  updatePlanCamera() {
    const { w, h } = this.size;
    const aspect = w / Math.max(1, h);
    const hh = this.planHeight / 2;
    Object.assign(this.planCam, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    this.planCam.position.set(this.planCenter.x, 25, this.planCenter.z);
    this.planCam.lookAt(this.planCenter.x, 0, this.planCenter.z);
    this.planCam.updateProjectionMatrix();
  }

  render() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this.renderer.setSize(w, h);
      this.labels.setSize(w, h);
      this.perspCam.aspect = w / Math.max(1, h);
      this.perspCam.updateProjectionMatrix();
    }
    const plan = this.mode === 'plan';
    if (plan) this.updatePlanCamera();
    if (!plan && this.gizmo.object && !this.gizmo.dragging) this.syncProxy();
    this.world.handleScale = plan ? clamp(this.planHeight / 11, 0.5, 8) : 1.2;
    this.world.minorGrid.visible = plan && this.planHeight < 25;
    const ceiling = this.world.ceiling;
    if (ceiling) ceiling.visible = !plan;
    // Grundriss wie ein Bauplan: Stürze über Türen und Fenstern weg, Fenstersymbole nur hier
    const cut = plan ? this.world.planHidden || [] : [];
    cut.forEach((o) => { o.visible = false; });
    for (const o of this.world.planOnly || []) o.visible = plan;
    this.gizmoHelper.visible = !plan && !!this.gizmo.object;
    this.renderer.render(this.world.scene, this.camera);
    this.labels.render(this.world.scene, this.camera);
    if (ceiling) ceiling.visible = true;
    cut.forEach((o) => { o.visible = true; });
  }

  // Kamera eines Shots auf die aktuelle 3D-Ansicht setzen
  viewAsCameraKey() {
    const cam = this.perspCam;
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    return {
      x: Math.round(cam.position.x * 100) / 100,
      y: Math.round(Math.max(0.05, cam.position.y) * 100) / 100,
      z: Math.round(cam.position.z * 100) / 100,
      pan: Math.round(dirToHeading(d.x, d.z)),
      tilt: Math.round(Math.asin(clamp(d.y, -1, 1)) / DEG),
    };
  }
}
