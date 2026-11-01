// Die 3D-Welt: Set, Figuren, Kamera und Hilfslinien (Hilfslinien nur in der Arbeitsansicht, Ebene 1).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/CSS2DRenderer.js';
import { CUTAWAY_LAYER, buildObject, buildWalls, buildCeiling, settleSurface, buildFloor, disposeTree, tag, clearLength, innerNormals, wallBounds, wallInsets, openingLayout } from './build.js';
import { buildMannequin, applyPose, placeMannequin, strideLength, poseInfo } from './mannequin.js';
import { walks, walkPoints, evalFigure, evalCamera, samplePath, verticalFov, formatAspect, supportHeight, doorValue } from './model.js';
import { headingToDir, headingToRotY, dirToHeading, DEG, fmtM, clamp, lerpDeg, smoothstep } from './units.js';

export const HELPER_LAYER = 1;
const GAZE_TURN = 0.45; // Sekunden für einen Blickwechsel
const NECK_MAX = 70; // weiter dreht sich eine stehende Figur mit dem ganzen Körper
const ACCENT = '#4da3ff';
const CAM_COLOR = '#ffd84d';
const HELD_COLOR = '#ff1a1a';

function toHelperLayer(obj) {
  obj.traverse((c) => c.layers.set(HELPER_LAYER));
  return obj;
}

function label(text, cls = 'lbl') {
  const el = document.createElement('div');
  el.className = cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.layers.set(HELPER_LAYER);
  return o;
}

function flatMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
}

function handleMesh(color, r = 0.09) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 20), flatMat(color));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.22, 6, 24), flatMat('#ffffff'));
  ring.rotation.x = Math.PI / 2;
  m.add(ring);
  m.userData.handle = true;
  m.renderOrder = 10;
  return m;
}

// flaches Band auf dem Boden, besser sichtbar als eine 1-Pixel-Linie
function ribbon(points, width, color, opacity = 1) {
  const pos = [];
  const idx = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * width / 2, nz = (dx / l) * width / 2;
    pos.push(p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz);
    if (i < points.length - 1) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, side: THREE.DoubleSide, depthWrite: false }));
  m.renderOrder = 5;
  return m;
}

function line(points, color, opacity = 1, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  const l = new THREE.Line(g, mat);
  if (dashed) l.computeLineDistances();
  return l;
}

export function findSupport(set, x, z) {
  const o = supportObject(set, x, z);
  return o ? supportHeight(o) : null;
}

// Das höchste Möbel unter einem Punkt, auf dem man sitzen oder liegen kann
function supportObject(set, x, z) {
  let best = null;
  for (const o of set.objects) {
    const h = supportHeight(o);
    if (h === null || h > 1.3) continue;
    const ry = headingToRotY(o.heading);
    const dx = x - o.x, dz = z - o.z;
    const lx = dx * Math.cos(ry) - dz * Math.sin(ry);
    const lz = dx * Math.sin(ry) + dz * Math.cos(ry);
    if (Math.abs(lx) <= o.w / 2 && Math.abs(lz) <= o.d / 2 && (!best || h > supportHeight(best))) best = o;
  }
  return best;
}

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight('#ffffff', '#5c5c5c', 1.6);
    this.scene.add(hemi);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight('#ffffff', 2.2);
    sun.position.set(5, 12, 8);
    this.sun = sun;
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 0.5, far: 60 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    this.setGroup = new THREE.Group();
    this.figGroup = new THREE.Group();
    this.helperGroup = new THREE.Group();
    this.toolGroup = new THREE.Group();
    this.scene.add(this.setGroup, this.figGroup, this.helperGroup, this.toolGroup);

    this.mannequins = new Map();
    this.objectGroups = new Map();
    this.figEval = new Map();
    this.camEval = null;
    this.handleScale = 1;
    this.shotCamera = new THREE.PerspectiveCamera(35, 16 / 9, 0.05, 300);
    this.ceiling = null;

    this.scene.add(toHelperLayer(this.makeGrid()));
  }

  makeGrid() {
    const g = new THREE.Group();
    const minor = new THREE.GridHelper(60, 600, '#000000', '#000000');
    minor.material.transparent = true;
    minor.material.opacity = 0.06;
    minor.position.y = 0.002;
    const major = new THREE.GridHelper(60, 60, '#1b1b1b', '#3a3a3a');
    major.material.transparent = true;
    major.material.opacity = 0.35;
    major.position.y = 0.003;
    g.add(minor, major);
    this.minorGrid = minor;
    return g;
  }

  syncSet(project) {
    const set = project.set;
    disposeTree(this.setGroup);
    this.setGroup.clear();
    this.objectGroups.clear();
    this.scene.background = new THREE.Color(set.bgColor);
    this.scene.fog = new THREE.Fog(set.bgColor, 35, 110);
    this.setGroup.add(buildFloor(set));
    const walls = buildWalls(set);
    this.setGroup.add(walls);
    this.wallGroups = new Map(walls.children.map((g) => [g.userData.id, g]));
    this.doorSetters = walls.userData.doors;
    this.planHidden = [];
    walls.traverse((c) => { if (c.userData.hideInPlan) this.planHidden.push(c); });
    this.wallNormals = innerNormals(set.walls);
    this.wallTop = wallBounds(set)?.h ?? 0;
    const brightness = set.brightness ?? 1;
    this.hemi.intensity = 1.6 * brightness;
    this.sun.intensity = 2.2 * brightness;
    // Sobald eigene Lichtquellen im Raum sind, bestimmen sie die Schatten, der Schatten von außen stört dann
    this.sun.castShadow = !set.objects.some((o) => o.kind === 'licht');
    this.ceiling = buildCeiling(set);
    this.ceiling?.material.color.multiplyScalar(Math.min(1, brightness)); // die Decke ist unbeleuchtet, sie folgt der Helligkeit von Hand
    if (this.ceiling) this.setGroup.add(this.ceiling);
    for (const o of set.objects) {
      settleSurface(set, o);
      const g = buildObject(o, { H: this.wallTop || 2.6, images: project.images });
      this.objectGroups.set(o.id, g);
      this.setGroup.add(g);
      g.traverse((c) => { if (c.userData.hideInPlan) this.planHidden.push(c); });
      // Bilder an einer immer ausgeblendeten Wand verschwinden mit ihr
      if (o.surface === 'wand' && set.walls.find((w) => w.id === o.wall)?.cutaway) g.traverse((c) => c.layers.set(CUTAWAY_LAYER));
    }
    this.applyHeld();
  }

  // Was gerade angefasst wird, leuchtet rot, bis es losgelassen wird. kind wie in userData.pick
  // Mit dem Lasso Eingekreistes bleibt rot, bis etwas anderes gewählt wird
  setMarked(list) {
    this.marked = list;
    this.applyHeld();
  }

  setHeld(app, held) {
    this.held = held;
    this.applyHeld();
    this.syncHelpers(app);
    this.update(app, app.state.time);
  }

  applyHeld() {
    const { held } = this;
    const marked = this.marked || [];
    for (const root of [this.setGroup, this.figGroup]) {
      root.traverse((c) => {
        const m = c.material;
        if (!m?.emissive) return;
        const pick = c.userData.pick;
        const on = (held && pick?.kind === held.kind && pick?.id === held.id) || marked.some((x) => x.kind === pick?.kind && x.id === pick?.id);
        if (on && !m.userData.plain) {
          m.userData.plain = { color: m.color.getHex(), emissive: m.emissive.getHex(), intensity: m.emissiveIntensity };
          m.color.set(HELD_COLOR);
          m.emissive.set(HELD_COLOR);
          m.emissiveIntensity = 0.7;
        } else if (!on && m.userData.plain) {
          const p = m.userData.plain;
          m.color.setHex(p.color);
          m.emissive.setHex(p.emissive);
          m.emissiveIntensity = p.intensity;
          delete m.userData.plain;
        }
      });
    }
  }

  syncFigures(project) {
    disposeTree(this.figGroup);
    this.figGroup.clear();
    this.mannequins.clear();
    for (const f of project.set.figures) {
      const man = buildMannequin(f);
      tag(man.root, { kind: 'figure', id: f.id });
      this.mannequins.set(f.id, man);
      this.figGroup.add(man.root);
    }
    this.applyHeld();
  }

  // Hilfslinien, die sich nur bei Änderungen ändern
  syncHelpers(app) {
    const { project } = app.state;
    const shot = app.shot;
    const sel = app.state.selection || {};
    this.helperGroup.traverse((c) => c.element?.remove());
    disposeTree(this.helperGroup);
    this.helperGroup.clear();
    this.discs = new Map();
    this.handles = [];
    this.pathLines = [];

    // Wände: Längen und, wenn gewählt, Endpunkte
    for (const w of project.set.walls) {
      const lb = label(fmtM(clearLength(project.set, w)) + (w.cutaway ? ' · ausgeblendet' : ''), 'lbl lbl-dim');
      // außen neben die Wand, damit die Zahl nicht auf Türen und Fenstern liegt
      const n = this.wallNormals?.get(w.id) || { x: 0, z: 0 };
      const out = w.t / 2 + 0.3;
      lb.position.set((w.a.x + w.b.x) / 2 - n.x * out, w.h + 0.05, (w.a.z + w.b.z) / 2 - n.z * out);
      this.helperGroup.add(lb);
      if (sel.kind === 'wall' && sel.id === w.id) {
        for (const end of ['a', 'b']) {
          const h = handleMesh(ACCENT, 0.11);
          h.position.set(w[end].x, w.h + 0.02, w[end].z);
          tag(h, { kind: 'wallEnd', id: w.id, end });
          this.addHandle(h);
        }
      }
    }

    // Türen und Fenster: Schwenkbereich bzw. Fenstersymbol, und für die gewählte Öffnung Abstände und Griff
    this.planOnly = [];
    for (const o of project.set.openings) {
      const w = project.set.walls.find((x) => x.id === o.wall);
      if (!w) continue;
      const lay = openingLayout(w, o, this.wallNormals?.get(w.id));
      const isSel = sel.kind === 'opening' && sel.id === o.id;
      const t = w.t / 2;
      const P = (x, z, y) => { const q = lay.toWorld(x, z); return new THREE.Vector3(q.x, y, q.z); };
      if (o.type === 'loch') {
        // Die Lücke in der Wand ist das Symbol
      } else if (o.kind === 'tuer' && o.type === 'schiebe') {
        // Laufweg des Blatts: Linie an der Wand mit Pfeil in Laufrichtung
        const f = 0.03;
        const lw = Math.max(0.1, lay.e - lay.s - 2 * f);
        const dirX = o.hinge === 'rechts' ? lay.zIn : -lay.zIn;
        const x0 = dirX > 0 ? lay.s + f : lay.e - f;
        const x1 = x0 + dirX * 2 * lw;
        const z = lay.zIn * (t + 0.08);
        const col = isSel ? ACCENT : '#ffffff';
        this.helperGroup.add(line([P(x0, z, 0.02), P(x1, z, 0.02)], col, isSel ? 1 : 0.6));
        this.helperGroup.add(line([P(x1 - dirX * 0.12, z + 0.07, 0.02), P(x1, z, 0.02), P(x1 - dirX * 0.12, z - 0.07, 0.02)], col, isSel ? 1 : 0.6));
      } else if (o.kind === 'tuer') {
        const f = 0.05;
        const lw = Math.max(0.1, lay.e - lay.s - 2 * f);
        const dir = lay.hingeAtStart ? 1 : -1;
        const hx = lay.hingeAtStart ? lay.s + f : lay.e - f;
        const z0 = lay.sz * t;
        const arc = [];
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * (Math.PI / 2);
          arc.push(P(hx + dir * lw * Math.cos(a), z0 + lay.sz * lw * Math.sin(a), 0.02));
        }
        this.helperGroup.add(line(arc, isSel ? ACCENT : '#ffffff', isSel ? 1 : 0.6));
        this.helperGroup.add(line([P(hx, z0, 0.02), P(hx, z0 + lay.sz * lw, 0.02)], isSel ? ACCENT : '#ffffff', isSel ? 1 : 0.6));
      } else {
        for (const z of [-0.035, 0.035]) {
          const l = line([P(lay.s, z, w.h + 0.02), P(lay.e, z, w.h + 0.02)], isSel ? ACCENT : '#bfe3ff', 0.9);
          this.helperGroup.add(l);
          this.planOnly.push(l);
        }
      }
      if (!isSel) continue;
      const { L, ia, ib } = wallInsets(project.set, w);
      const zd = lay.zIn * (t + 0.15);
      this.helperGroup.add(line([P(ia, zd, 0.03), P(L - ib, zd, 0.03)], ACCENT, 0.8));
      for (const x of [ia, lay.s, lay.e, L - ib]) this.helperGroup.add(line([P(x, zd - 0.06, 0.03), P(x, zd + 0.06, 0.03)], ACCENT, 0.8));
      for (const [x0, x1] of [[ia, lay.s], [lay.s, lay.e], [lay.e, L - ib]]) {
        if (x1 - x0 < 0.005) continue;
        const lb = label(fmtM(x1 - x0), 'lbl lbl-dim lbl-sel');
        lb.position.copy(P((x0 + x1) / 2, lay.zIn * (t + 0.38), 0.05));
        this.helperGroup.add(lb);
      }
      const hd = handleMesh(ACCENT, 0.09);
      hd.position.copy(P(o.offset, 0, w.h + 0.03));
      tag(hd, { kind: 'opening', id: o.id });
      this.addHandle(hd);
    }

    // Lichtquellen hängen hoch und klein im Raum: im Grundriss ein Griff in ihrer Farbe, mit Namen
    for (const o of project.set.objects) {
      if (o.kind !== 'licht') continue;
      const h = handleMesh(o.color, 0.16);
      h.position.set(o.x, 0.04, o.z);
      tag(h, { kind: 'object', id: o.id });
      this.addHandle(h);
      this.planOnly.push(h);
      const lb = label(o.name, 'lbl lbl-dim');
      lb.position.set(o.x, 0.05, o.z + 0.35);
      this.helperGroup.add(lb);
    }

    // Flächen an Wand und Decke sind von oben nicht zu sehen: Umriss im Grundriss
    for (const o of project.set.objects) {
      const isHeld = this.held?.kind === 'object' && this.held.id === o.id;
      if (o.kind !== 'flaeche' || (o.surface === 'boden' && !isHeld)) continue;
      const isSel = sel.kind === 'object' && sel.id === o.id;
      const v = headingToDir(o.heading);
      const ax = { x: -v.z * (o.w / 2), z: v.x * (o.w / 2) };
      const by = o.surface === 'wand' ? { x: v.x * 0.03, z: v.z * 0.03 } : { x: v.x * (o.d / 2), z: v.z * (o.d / 2) };
      const pts = [[1, 1], [-1, 1], [-1, -1], [1, -1], [1, 1]].map(([s, t]) => new THREE.Vector3(o.x + ax.x * s + by.x * t, 0.03, o.z + ax.z * s + by.z * t));
      // angefasst als breites Band, eine schmale Schiene ist sonst kaum einen Pixel breit
      const ln = isHeld ? ribbon(pts.map((q) => q.setY(0.04)), 0.05 * this.handleScale, HELD_COLOR) : line(pts, isSel ? ACCENT : '#e8edf2', isSel ? 1 : 0.75, o.surface === 'decke');
      this.helperGroup.add(ln);
      this.planOnly.push(ln);
    }

    // Figuren: Scheibe mit Richtung, Name, Weg
    for (const f of project.set.figures) {
      const st = shot.figs[f.id];
      if (!st) continue;
      const isSel = sel.kind === 'figure' && sel.id === f.id;
      const disc = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.31, 40), flatMat(isSel ? ACCENT : f.color, 0.95));
      ring.rotation.x = -Math.PI / 2;
      const fill = new THREE.Mesh(new THREE.CircleGeometry(0.26, 40), flatMat(f.color, 0.28));
      fill.rotation.x = -Math.PI / 2;
      const arrowShape = new THREE.Shape([new THREE.Vector2(-0.1, 0), new THREE.Vector2(0.1, 0), new THREE.Vector2(0, 0.16)]);
      const arrow = new THREE.Mesh(new THREE.ShapeGeometry(arrowShape), flatMat(isSel ? ACCENT : f.color));
      arrow.rotation.x = -Math.PI / 2;
      arrow.position.z = 0.33;
      arrow.rotation.z = Math.PI;
      const arrowHolder = new THREE.Group();
      arrowHolder.add(arrow);
      disc.add(ring, fill, arrowHolder);
      disc.position.y = 0.012;
      const name = label(f.name, 'lbl lbl-fig');
      name.position.set(0, f.height + 0.25, 0);
      name.element.style.borderColor = f.color;
      disc.add(name);
      tag(disc, { kind: 'figure', id: f.id });
      this.helperGroup.add(disc);
      this.discs.set(f.id, disc);

      walks(st).forEach((step) => {
        const pts = walkPoints(st, step);
        if (pts.length < 2) return;
        const curve = samplePath(pts, 96).map((v) => v.setY(0.02));
        this.helperGroup.add(ribbon(curve, isSel ? 0.06 : 0.04, f.color, isSel ? 1 : 0.8));
        if (isSel) {
          // breiter, unsichtbarer Streifen: Klick auf die Linie setzt einen Zwischenpunkt
          const hit = ribbon(curve, 0.2, f.color, 0);
          tag(hit, { kind: 'pathLine', fig: f.id, key: step.key });
          this.helperGroup.add(hit);
          this.pathLines.push(hit);
        }
        pts.slice(1).forEach((p, i) => {
          const end = i === pts.length - 2; // der Punkt selbst, davor die Zwischenpunkte
          const h = handleMesh(end ? f.color : '#ffffff', isSel ? 0.09 : 0.06);
          h.position.set(p.x, 0.025, p.z);
          tag(h, end ? { kind: 'keyHandle', fig: f.id, key: step.key } : { kind: 'pathHandle', fig: f.id, key: step.key, index: i });
          this.addHandle(h);
        });
        const len = label(`${fmtM(curveLength(pts))} · ${fmtSpeed(pts, step)}`, 'lbl lbl-dim');
        const last = pts[pts.length - 1];
        len.position.set(last.x, 0.05, last.z);
        if (isSel) this.helperGroup.add(len);
      });
    }

    // Kamera: Weg mit Punkten und Zwischenpunkten, Drehgriff an der Stelle der Zeitleiste
    const cam = shot.camera;
    const camSel = sel.kind === 'camera';
    let from = cam.start;
    for (const key of cam.keys) {
      const pts = [{ x: from.x, z: from.z }, ...(key.via || []), { x: key.x, z: key.z }];
      if (Math.hypot(key.x - from.x, key.z - from.z) > 0.01 || key.via?.length) {
        const curve = samplePath(pts, 64);
        curve.forEach((v, i) => v.setY(from.y + (key.y - from.y) * (i / (curve.length - 1))));
        this.helperGroup.add(line(curve, CAM_COLOR, 0.9, true));
        const flat = samplePath(pts, 64).map((v) => v.setY(0.02));
        this.helperGroup.add(line(flat, CAM_COLOR, 0.35, true));
        if (camSel) {
          const hit = ribbon(flat, 0.2, CAM_COLOR, 0);
          tag(hit, { kind: 'camLine', key: key.id });
          this.helperGroup.add(hit);
          this.pathLines.push(hit);
        }
        (key.via || []).forEach((p, index) => {
          const h = handleMesh('#ffffff', 0.07);
          h.position.set(p.x, 0.03, p.z);
          tag(h, { kind: 'camHandle', key: key.id, index });
          this.addHandle(h);
        });
      }
      const h = handleMesh(CAM_COLOR, camSel ? 0.11 : 0.08);
      h.position.set(key.x, 0.03, key.z);
      tag(h, { kind: 'camHandle', key: key.id });
      this.addHandle(h);
      from = key;
    }
    if (camSel && !cam.aim) {
      const k = evalCamera(cam, app.state.time);
      const d = headingToDir(k.pan);
      const r = handleMesh(ACCENT, 0.06);
      r.position.set(k.x + d.x * 0.7, 0.03, k.z + d.z * 0.7);
      tag(r, { kind: 'camRot' });
      this.addHandle(r);
      this.helperGroup.add(line([new THREE.Vector3(k.x, 0.03, k.z), r.position.clone()], ACCENT, 0.8));
    }

    // Kamera-Symbol mit Bildwinkel
    this.camGizmo = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), flatMat('#303030'));
    body.position.z = 0.12;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 16), flatMat('#151515'));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.0;
    this.camGizmo.add(body, lens);
    this.frustum = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: camSel ? ACCENT : CAM_COLOR }));
    this.camGizmo.add(this.frustum);
    tag(this.camGizmo, { kind: 'camera' });
    this.helperGroup.add(this.camGizmo);

    // Drehgriff und Maße für das gewählte Objekt
    this.rotHandle = null;
    const selObj = sel.kind === 'object' ? project.set.objects.find((x) => x.id === sel.id) : null;
    if ((selObj && selObj.surface !== 'wand') || (sel.kind === 'figure' && shot.figs[sel.id])) {
      const r = handleMesh(ACCENT, 0.07);
      tag(r, { kind: 'rotHandle' });
      this.addHandle(r);
      this.rotHandle = r;
      this.rotLine = line([new THREE.Vector3(), new THREE.Vector3()], ACCENT, 0.8);
      this.helperGroup.add(this.rotLine);
    }
    this.dimLabel = null;
    if (sel.kind === 'object') {
      const o = project.set.objects.find((x) => x.id === sel.id);
      if (o) {
        this.dimLabel = label(o.kind === 'flaeche' ? `${Math.round(o.w * 100)} × ${Math.round(o.d * 100)} cm` : `${Math.round(o.w * 100)} × ${Math.round(o.d * 100)} × ${Math.round(o.h * 100)} cm`, 'lbl lbl-dim lbl-sel');
        this.helperGroup.add(this.dimLabel);
      }
    }
    this.selBox = new THREE.BoxHelper(undefined, ACCENT);
    this.selBox.visible = false;
    this.helperGroup.add(this.selBox);

    toHelperLayer(this.helperGroup);
  }

  // Blick einer Figur: Kopfdrehung und, wenn sie steht und weit wegschauen muss, Körperdrehung.
  // st.looks = [{ t, at }], at: '' geradeaus, Figuren-ID, 'cam' oder 'op:<Tür/Fenster-ID>'
  gaze(set, st, ev, t, ce, canTurn) {
    const base = ev.heading + (st.headYaw || 0);
    const looks = st.looks || [];
    let k = -1;
    for (let i = 0; i < looks.length; i++) if (looks[i].t <= t + 1e-6) k = i;
    let dir = base;
    if (k >= 0) {
      const target = (key) => this.lookTarget(set, key.at, ev, ce) ?? base;
      const prev = k > 0 ? target(looks[k - 1]) : base;
      dir = lerpDeg(prev, target(looks[k]), smoothstep(clamp((t - looks[k].t) / GAZE_TURN, 0, 1)));
    }
    let rel = ((dir - ev.heading + 540) % 360) - 180;
    let body = ev.heading;
    if (canTurn && Math.abs(rel) > NECK_MAX) {
      body += rel - Math.sign(rel) * NECK_MAX;
      rel = Math.sign(rel) * NECK_MAX;
    }
    return { body, headYaw: clamp(rel, -85, 85) };
  }

  lookTarget(set, at, from, ce) {
    if (!at) return null;
    let p = null;
    if (at === 'cam') p = ce;
    else if (at.startsWith('op:')) {
      const o = set.openings.find((x) => x.id === at.slice(3));
      const w = o && set.walls.find((x) => x.id === o.wall);
      if (w) {
        const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1;
        p = { x: w.a.x + ((w.b.x - w.a.x) * o.offset) / L, z: w.a.z + ((w.b.z - w.a.z) * o.offset) / L };
      }
    } else p = this.figEval.get(at);
    if (!p || Math.hypot(p.x - from.x, p.z - from.z) < 0.05) return null;
    return dirToHeading(p.x - from.x, p.z - from.z);
  }

  addHandle(h) {
    this.handles.push(h);
    this.helperGroup.add(h);
  }

  // Pro Bild: Figuren, Kamera und mitlaufende Hilfen
  update(app, t) {
    const { project } = app.state;
    const shot = app.shot;
    const set = project.set;
    const sel = app.state.selection || {};

    // Türen, die sich in diesem Shot bewegen
    for (const o of set.openings) this.doorSetters?.get(o.id)?.(doorValue(o, shot, t));

    // erst alle Positionen, dann Haltung und Blick (der Blick braucht die Positionen der anderen)
    const ce = evalCamera(shot.camera, t);
    for (const f of set.figures) {
      const st = shot.figs[f.id];
      if (st) this.figEval.set(f.id, evalFigure(st, t));
    }
    for (const f of set.figures) {
      const st = shot.figs[f.id];
      const man = this.mannequins.get(f.id);
      if (!man) continue;
      man.root.visible = !!st;
      if (!st) continue;
      const ev = this.figEval.get(f.id);
      const info = poseInfo(ev.pose);
      const supportFor = (p, at) => (p.support !== undefined ? findSupport(set, at.x, at.z) ?? p.support : null);
      const support = supportFor(info, ev.to || ev);
      const avg = ev.avg;
      const stride = strideLength(f.height, avg);
      const look = this.gaze(set, st, ev, t, ce, info.upright && ev.speed < 0.02);
      applyPose(man, ev.pose, {
        side: ev.side,
        fromSide: ev.fromSide,
        from: ev.from,
        fromSupport: ev.from ? supportFor(poseInfo(ev.from), ev.fromTo || ev) : null,
        blend: ev.u,
        support,
        walkPhase: (ev.dist / stride) * Math.PI * 2,
        walkAmount: ev.speed > 0.02 ? clamp(ev.speed / 0.35, 0, 1) : 0,
        walkSpeed: avg,
        headYaw: look.headYaw,
      });
      placeMannequin(man, ev.x, ev.z, look.body);
      const disc = this.discs?.get(f.id);
      if (disc) {
        disc.position.set(ev.x, 0.012, ev.z);
        disc.rotation.y = headingToRotY(ev.heading);
      }
    }

    // Kamera
    const cam = this.shotCamera;
    cam.position.set(ce.x, ce.y, ce.z);
    const aimMan = shot.camera.aim && this.mannequins.get(shot.camera.aim);
    if (aimMan && aimMan.root.visible) {
      const target = new THREE.Vector3();
      aimMan.joints.neck.getWorldPosition(target);
      cam.lookAt(target);
      const d = target.sub(cam.position).normalize();
      ce.pan = dirToHeading(d.x, d.z);
      ce.tilt = Math.asin(clamp(d.y, -1, 1)) / DEG;
    } else {
      const p = ce.pan * DEG, tl = ce.tilt * DEG;
      cam.lookAt(ce.x + Math.sin(p) * Math.cos(tl), ce.y + Math.sin(tl), ce.z - Math.cos(p) * Math.cos(tl));
    }
    const aspect = formatAspect(shot.format);
    cam.aspect = aspect;
    cam.fov = verticalFov(ce.focal, aspect);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.camEval = ce;

    // Wände, hinter denen die Kamera steht, verschwinden im Kamerabild (wie ein Puppenhaus)
    this.camHidden = [];
    if (set.autoCutaway !== false && this.wallGroups) {
      for (const w of set.walls) {
        const n = this.wallNormals.get(w.id);
        if (!n) continue;
        if ((cam.position.x - w.a.x) * n.x + (cam.position.z - w.a.z) * n.z < 0) {
          const g = this.wallGroups.get(w.id);
          if (g) this.camHidden.push(g);
        }
      }
      const above = this.ceiling && cam.position.y > this.wallTop;
      if (above) this.camHidden.push(this.ceiling);
      // Flächen an ausgeblendeten Wänden und Decken verschwinden mit ihnen
      const gone = new Set(this.camHidden);
      for (const o of set.objects) {
        if (o.surface === 'decke' ? above : o.surface === 'wand' && gone.has(this.wallGroups.get(o.wall))) this.camHidden.push(this.objectGroups.get(o.id));
      }
    }

    if (this.camGizmo) {
      this.camGizmo.position.copy(cam.position);
      this.camGizmo.quaternion.copy(cam.quaternion);
      const D = 2.2;
      const hh = D * Math.tan((cam.fov * DEG) / 2);
      const hw = hh * aspect;
      const c = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]].map(([x, y]) => new THREE.Vector3(x, y, -D));
      const o = new THREE.Vector3();
      const segs = [o, c[0], o, c[1], o, c[2], o, c[3], c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0]];
      this.frustum.geometry.dispose();
      this.frustum.geometry = new THREE.BufferGeometry().setFromPoints(segs);
    }

    // Auswahl-Rahmen, Drehgriff, Maße
    let target = null, center = null, heading = 0, radius = 0.4;
    if (sel.kind === 'object') {
      target = this.objectGroups.get(sel.id);
      const o = set.objects.find((x) => x.id === sel.id);
      if (o) { center = new THREE.Vector3(o.x, 0, o.z); heading = o.heading; radius = Math.max(o.w, o.d) / 2 + 0.25; }
      if (o && this.dimLabel) this.dimLabel.position.set(o.x, o.y + o.h + 0.12, o.z);
    } else if (sel.kind === 'figure') {
      const man = this.mannequins.get(sel.id);
      target = man?.root;
      const ev = this.figEval.get(sel.id);
      if (ev) { center = new THREE.Vector3(ev.x, 0, ev.z); heading = ev.heading; radius = 0.55; }
    }
    if (this.selBox) {
      if (target) {
        this.selBox.setFromObject(target);
        this.selBox.visible = true;
      } else this.selBox.visible = false;
    }
    if (this.rotHandle && center) {
      const d = headingToDir(heading);
      this.rotHandle.position.set(center.x + d.x * radius, 0.03, center.z + d.z * radius);
      const pos = this.rotLine.geometry.attributes.position;
      pos.setXYZ(0, center.x, 0.03, center.z);
      pos.setXYZ(1, this.rotHandle.position.x, 0.03, this.rotHandle.position.z);
      pos.needsUpdate = true;
    }
    for (const h of this.handles || []) h.scale.setScalar(this.handleScale);
  }
}

function curveLength(pts) {
  const s = samplePath(pts, 200);
  let L = 0;
  for (let i = 1; i < s.length; i++) L += s[i].distanceTo(s[i - 1]);
  return L;
}

function fmtSpeed(pts, step) {
  const L = curveLength(pts);
  const v = L / Math.max(0.01, step.t1 - step.t);
  return `${v.toFixed(2).replace('.', ',')} m/s`;
}
