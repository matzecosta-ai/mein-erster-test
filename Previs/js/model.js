// Datenmodell: ein Projekt hat ein Set (Raum, Möbel, Figuren) und mehrere Shots.
// Möbel und Wände gehören zum Set, Positionen und Wege der Figuren sowie die Kamera zum Shot.
import * as THREE from 'three';
import { clamp, smoothstep, dirToHeading, lerpDeg } from './units.js';
import { poseInfo } from './mannequin.js';

export const uid = () => 'i' + Math.random().toString(36).slice(2, 9);

export const FIGURE_COLORS = [
  { name: 'Rot', hex: '#d42a2a' },
  { name: 'Blau', hex: '#1f5bd8' },
  { name: 'Gelb', hex: '#f2c418' },
  { name: 'Grün', hex: '#1e9e4a' },
  { name: 'Orange', hex: '#f2761d' },
  { name: 'Violett', hex: '#7b3fd1' },
  { name: 'Pink', hex: '#e0409a' },
  { name: 'Türkis', hex: '#17a3b8' },
];

export const OBJECT_COLORS = [
  { name: 'Grau', hex: '#8c8c8c' },
  { name: 'Hellgrau', hex: '#b8b8b8' },
  { name: 'Dunkelgrau', hex: '#555555' },
  { name: 'Weiß', hex: '#e6e6e6' },
  { name: 'Schwarz', hex: '#2b2b2b' },
  { name: 'Braun', hex: '#6b4a32' },
  { name: 'Holz', hex: '#b08458' },
  { name: 'Beige', hex: '#cdb894' },
];

// seat: Sitz- oder Liegehöhe; fehlt sie, kann man auf der Oberseite (h) sitzen, wenn flat gesetzt ist
export const FURNITURE = {
  stuhl: { label: 'Stuhl', w: 0.45, d: 0.5, h: 0.9, seat: 0.46 },
  sessel: { label: 'Sessel', w: 0.85, d: 0.85, h: 0.8, seat: 0.42 },
  sofa: { label: 'Sofa', w: 2.0, d: 0.9, h: 0.8, seat: 0.43 },
  bank: { label: 'Bank', w: 1.6, d: 0.6, h: 0.8, seat: 0.45 },
  bett: { label: 'Bett', w: 1.6, d: 2.1, h: 0.95, seat: 0.5 },
  tisch: { label: 'Tisch', w: 1.6, d: 0.9, h: 0.75, flat: true },
  couchtisch: { label: 'Couchtisch rund', w: 0.8, d: 0.8, h: 0.48, flat: true },
  schrank: { label: 'Schrank', w: 1.0, d: 0.6, h: 2.0 },
  stehlampe: { label: 'Stehlampe', w: 0.45, d: 0.45, h: 1.65 },
  auto: { label: 'Auto', w: 1.8, d: 4.5, h: 1.45 },
  baum: { label: 'Baum', w: 3.0, d: 3.0, h: 6.0 },
  quader: { label: 'Quader', w: 0.45, d: 0.45, h: 0.45, flat: true },
  zylinder: { label: 'Zylinder', w: 0.4, d: 0.4, h: 0.45, flat: true },
  // Flächen liegen auf Boden, Wand oder Decke. w = Breite, d = Länge (an der Wand: Höhe)
  flaeche: { label: 'Fläche oder Bild', w: 2, d: 1.5, h: 0.01 },
  schiene: { label: 'Schiene (schmale Fläche)', w: 0.03, d: 3, h: 0.01 },
  licht: { label: 'Lichtquelle', w: 0.2, d: 0.2, h: 0.2 },
};

export const FORMATS = [
  { id: '16:9', w: 16, h: 9 },
  { id: '9:16', w: 9, h: 16 },
  { id: '1:1', w: 1, h: 1 },
  { id: '4:5', w: 4, h: 5 },
  { id: '4:3', w: 4, h: 3 },
  { id: '2,39:1', w: 2.39, h: 1 },
];
export const formatAspect = (id) => {
  const f = FORMATS.find((x) => x.id === id) || FORMATS[0];
  return f.w / f.h;
};

export function newObject(kind, x = 0, z = 0) {
  const def = FURNITURE[kind];
  const obj = { id: uid(), kind, name: def.label, color: OBJECT_COLORS[0].hex, x, z, y: 0, heading: 0, w: def.w, d: def.d, h: def.h };
  if (kind === 'flaeche') obj.surface = 'boden';
  if (kind === 'licht') Object.assign(obj, { y: 2.2, color: '#fff2d8', power: 1 });
  if (kind === 'schiene') Object.assign(obj, { kind: 'flaeche', name: 'Schiene', surface: 'boden', color: '#b9bec4' });
  if (def.seat !== undefined) obj.seat = def.seat;
  return obj;
}

// Türen und Fenster sitzen in einer Wand. offset = Mitte ab Wandanfang (Punkt a), auf der Wandmitte gemessen.
// hinge: Bänder links/rechts, gesehen von der Seite, zu der die Tür aufgeht (wie DIN). open: Öffnungswinkel in Grad.
export const OPENING_DEFAULTS = {
  tuer: { w: 0.9, h: 2.1, sill: 0, type: 'dreh', hinge: 'links', swing: 'innen', open: 0, color: '#8c8c8c' },
  fenster: { w: 1.2, h: 1.3, sill: 0.9, color: '#e6e6e6' },
};

// type 'loch': nur die Lücke in der Wand, ohne Rahmen und Türblatt
export const openingName = (o) => (o.kind !== 'tuer' ? 'Fenster' : o.type === 'loch' ? 'Öffnung' : 'Tür');

export function newOpening(kind, wall, offset) {
  return { id: uid(), wall, kind, offset, ...OPENING_DEFAULTS[kind] };
}

// Öffnungsgrad einer Tür zur Zeit t: Grad bei Drehtüren, Prozent bei Schiebetüren.
// Ein Shot kann die Tür bewegen: shot.doors[id] = { from, to, t0, t1 }, sonst gilt der Wert aus dem Set.
export const doorMax = (o) => (o.type === 'schiebe' ? 100 : 90);
export function doorValue(o, shot, t) {
  const d = shot.doors?.[o.id];
  if (!d) return o.open || 0;
  const u = d.t1 > d.t0 ? clampU((t - d.t0) / (d.t1 - d.t0)) : (t >= d.t1 ? 1 : 0);
  return d.from + (d.to - d.from) * (u * u * (3 - 2 * u));
}
const clampU = (u) => Math.min(1, Math.max(0, u));

// Höhe, auf der eine Figur sitzt oder liegt, oder null
export function supportHeight(obj) {
  const def = FURNITURE[obj.kind];
  if (!def) return null;
  if (obj.seat !== undefined) return obj.y + obj.seat;
  if (def.flat) return obj.y + obj.h;
  return null;
}

export function newFigure(project) {
  const used = new Set(project.set.figures.map((f) => f.color));
  const color = FIGURE_COLORS.find((c) => !used.has(c.hex)) || FIGURE_COLORS[project.set.figures.length % FIGURE_COLORS.length];
  return { id: uid(), name: `Figur ${project.set.figures.length + 1}`, color: color.hex, height: 1.75 };
}

export function newFigureState(x = 0, z = 0, duration = 5) {
  return { x, z, heading: 180, pose: 'stehen', headYaw: 0, looks: [], keys: [] };
}

export function newCameraKey(over = {}) {
  return { x: 0, z: 6, y: 1.6, pan: 0, tilt: -5, focal: 35, ...over };
}

export function newShot(project, name) {
  const duration = 5;
  const shot = {
    id: uid(),
    name: name || `Shot ${project.shots.length + 1}`,
    duration,
    fps: 30,
    format: '16:9',
    camera: { start: newCameraKey(), keys: [], aim: '' },
    figs: {},
    doors: {},
  };
  project.set.figures.forEach((f, i) => {
    shot.figs[f.id] = newFigureState(i * 0.8, 0, duration);
  });
  return shot;
}

export function newProject(name = 'Neues Projekt') {
  const project = {
    app: 'previs',
    version: 1,
    name,
    set: { floorColor: '#a6a6a6', bgColor: '#6e6e6e', wallColor: '#c4c4c4', ceilingColor: '#d9d9d9', ceiling: false, autoCutaway: true, walls: [], openings: [], objects: [], figures: [], folders: [] },
    shots: [],
    images: {},
  };
  project.shots.push(newShot(project));
  return project;
}

// Rechteckiger Raum mit Innenmaßen w × d, Mitte im Ursprung
export function rectangleWalls(w, d, h, t) {
  const x = w / 2 + t / 2;
  const z = d / 2 + t / 2;
  const c = [
    { x: -x, z: -z }, { x, z: -z }, { x, z }, { x: -x, z },
  ];
  return c.map((a, i) => ({ id: uid(), a: { ...a }, b: { ...c[(i + 1) % 4] }, t, h }));
}

// ---------- Auswertung zu einem Zeitpunkt ----------

const curveCache = new Map();
function curveFor(points) {
  const key = points.map((p) => `${p.x.toFixed(4)},${p.z.toFixed(4)}`).join(';');
  let curve = curveCache.get(key);
  if (!curve) {
    curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
    curve.arcLengthDivisions = 400;
    if (curveCache.size > 200) curveCache.clear();
    curveCache.set(key, curve);
  }
  return curve;
}

export function pathLength(points) {
  if (points.length < 2) return 0;
  return curveFor(points).getLength();
}

export function samplePath(points, n = 64) {
  if (points.length < 2) return points.map((p) => new THREE.Vector3(p.x, 0, p.z));
  return curveFor(points).getSpacedPoints(n);
}


// Punkte einer Figur (wie Keyframes): st.keys = [{ id, t, x, z, via, pose, dur, to, heading }], nach Zeit sortiert.
// x, z: Dort steht sie bei t. via: Zwischenpunkte des Wegs vom vorigen Punkt. pose: Befehl ab t mit Dauer dur.
// to und heading: Sitzplatz. Die Figur steht vor dem Möbel, dreht sich vorher um und rückt beim Hinsetzen auf den Sitz.
const SEAT_TURN = 0.8; // Sekunden für die Drehung vor dem Hinsetzen
const WALK_TURN = 0.4; // Sekunden zum Einschwenken in die Laufrichtung
const TURN_TIME = 0.5; // Sekunden für eine Drehung von Hand
const KEY_NEAR = 0.04; // Sekunden: So nah an einem Punkt gilt die Zeitleiste als auf dem Punkt

export const keyAt = (st, t) => (st.keys || []).find((k) => Math.abs(k.t - t) < KEY_NEAR);

// Der Punkt zur Zeit t; gibt es keinen, entsteht er dort, wo die Figur gerade ist
export function ensureKey(st, t) {
  const found = keyAt(st, t);
  if (found) return found;
  const at = evalFigure(st, t);
  const key = { id: uid(), t: Math.round(t * 100) / 100, x: at.x, z: at.z };
  st.keys.push(key);
  st.keys.sort((a, b) => a.t - b.t);
  return key;
}

// Ein Befehl für den Oberkörper, während die Figur läuft: Er setzt keinen Ort und unterbricht den Gang nicht
export function actionKey(st, t) {
  const found = keyAt(st, t);
  if (found) return found;
  const key = { id: uid(), t: Math.round(t * 100) / 100, action: true };
  st.keys.push(key);
  st.keys.sort((a, b) => a.t - b.t);
  return key;
}

// Aus den Punkten werden die Schritte, die die Figur nacheinander ausführt.
// Ein Gang beginnt, sobald der vorige Befehl zu Ende ist, und kommt zur Zeit des Punkts an.
export function stepsOf(st) {
  const out = [];
  let pos = { x: st.x, z: st.z };
  let free = 0;
  let pose = st.pose;
  for (const key of st.keys || []) {
    if (key.action) {
      out.push({ type: 'haltung', t: key.t, t1: key.t + (key.dur ?? 1), pose: key.pose, side: key.side, action: true });
      pose = key.pose || pose;
      continue;
    }
    if (Math.hypot(key.x - pos.x, key.z - pos.z) > 0.01) {
      out.push({ type: 'gehen', key: key.id, t: Math.max(0, Math.min(free, key.t - 0.05)), t1: key.t, path: [...(key.via || []), { x: key.x, z: key.z }] });
    }
    pos = key.to || key;
    free = key.t;
    if (key.pose || key.heading !== undefined) {
      // Eine von Hand gedrehte Figur hält ihre Richtung zum Weg, auch wenn das rückwärts bedeutet. Der Gang startet dabei sofort.
      const turn = !key.to && key.heading !== undefined;
      const dur = key.pose ? key.dur ?? 1 : TURN_TIME;
      out.push({ type: 'haltung', t: key.t, t1: key.t + dur, pose: key.pose, to: key.to, heading: key.heading, turn, door: key.door, quiet: key.quiet, side: key.side });
      // Hinsetzen, Knien, Aufstehen brauchen ihre Zeit. Arme und Oberkörper laufen neben dem Gehen her.
      if (key.pose && !(poseInfo(key.pose).upright && poseInfo(pose).upright)) free = key.t + dur;
      pose = key.pose || pose;
    }
  }
  out.sort((a, b) => a.t - b.t);
  // Bremsen nur, wo der Gang wirklich beginnt oder endet, nicht an Punkten mitten im Weg
  const paths = out.filter((s) => s.type === 'gehen');
  paths.forEach((s, i) => {
    s.easeIn = !(paths[i - 1] && Math.abs(paths[i - 1].t1 - s.t) < 0.03);
    s.easeOut = !(paths[i + 1] && Math.abs(paths[i + 1].t - s.t1) < 0.03);
  });
  return out;
}

// Fortschritt auf einem Wegstück, mit Anfahren und Abbremsen nur dort, wo es gilt
function walkProgress(t, s) {
  const r = clamp((t - s.t) / Math.max(0.01, s.t1 - s.t), 0, 1);
  const curve = s.easeIn ? (s.easeOut ? [smoothstep(r), 6 * r * (1 - r)] : [r * r, 2 * r]) : (s.easeOut ? [1 - (1 - r) ** 2, 2 * (1 - r)] : [r, 1]);
  return { u: curve[0], rate: t > s.t && t < s.t1 ? curve[1] / Math.max(0.01, s.t1 - s.t) : 0 };
}

export const walks = (st) => stepsOf(st).filter((s) => s.type === 'gehen');

// Wo die Figur zur Zeit t steht, wohin sie schaut und in welcher Haltung sie ist.
// Während eines Haltungswechsels: from, die Haltung davor, mit Fortschritt u; to und fromTo sind die Sitzplätze.
export function evalFigure(st, t) {
  const cur = { x: st.x, z: st.z, heading: st.heading, pose: st.pose, side: st.side, back: st.back || null };
  const out = { speed: 0, dist: 0, length: 0, avg: 0, from: null, to: null, fromTo: null, u: 1 };
  for (const step of stepsOf(st)) {
    if (t < step.t) {
      // Am Punkt ist die Drehung fertig, sie beginnt also davor
      const lead = step.turn ? TURN_TIME : SEAT_TURN;
      if (step.heading !== undefined && t >= step.t - lead) cur.heading = lerpDeg(cur.heading, step.heading, smoothstep(clamp((t - (step.t - lead)) / lead, 0, 1)));
      break;
    }
    if (step.type === 'gehen') {
      if (!step.path.length) continue;
      const curve = curveFor([{ x: cur.x, z: cur.z }, ...step.path]);
      const length = curve.getLength();
      if (length < 0.01) continue;
      const { u, rate } = walkProgress(t, step);
      const p = curve.getPointAt(u);
      const tan = curve.getTangentAt(u);
      const m = cur.manual;
      const first = curve.getTangentAt(0);
      const offset = m ? ((m.heading - dirToHeading(first.x, first.z) + 540) % 360) - 180 : 0;
      const way = dirToHeading(tan.x, tan.z) + offset;
      cur.heading = m ? way : lerpDeg(cur.heading, way, smoothstep(clamp((t - step.t) / WALK_TURN, 0, 1)));
      if (t >= step.t1) cur.manual = null;
      cur.x = p.x;
      cur.z = p.z;
      cur.back = null;
      if (t < step.t1) Object.assign(out, { speed: length * rate, dist: (Math.abs(offset) > 90 ? -1 : 1) * length * u, length, avg: length / Math.max(0.01, step.t1 - step.t) });
    } else {
      if (!step.pose) {
        cur.manual = { heading: step.heading };
        cur.heading = step.heading;
        continue;
      }
      if (!step.action) cur.manual = null;
      const u = smoothstep(clamp((t - step.t) / Math.max(0.01, step.t1 - step.t), 0, 1));
      const rising = step.pose && step.pose !== 'sitzen' && cur.back;
      const seatNow = rising ? { x: cur.x, z: cur.z } : null;
      const start = { x: cur.x, z: cur.z };
      const goal = step.to || (rising ? cur.back : null);
      if (goal) { cur.x = start.x + (goal.x - start.x) * u; cur.z = start.z + (goal.z - start.z) * u; }
      Object.assign(out, u < 1 ? { from: cur.pose, fromSide: cur.side, u, to: step.to || null, fromTo: seatNow } : { from: null, u: 1, to: null, fromTo: null });
      cur.back = step.to ? start : rising ? null : cur.back;
      cur.pose = step.pose;
      cur.side = step.side;
      if (step.heading !== undefined) cur.heading = step.heading;
    }
  }
  return { ...out, x: cur.x, z: cur.z, heading: cur.heading, pose: cur.pose, side: cur.side, back: cur.back };
}

// Punkte eines Gehen-Schritts samt Startpunkt
export function walkPoints(st, step) {
  const from = evalFigure(st, step.t);
  return [{ x: from.x, z: from.z }, ...step.path];
}

// Die Kamera arbeitet wie die Figuren mit Punkten: cam.start gilt ab 0, cam.keys = [{ id, t, x, y, z, pan, tilt, focal, via }].
// Bremsen nur, wo die Bewegung wirklich beginnt oder endet.
const camMoves = (a, b) => ['x', 'y', 'z', 'pan', 'tilt', 'focal'].some((k) => Math.abs(a[k] - b[k]) > 1e-3);

export function evalCamera(cam, t) {
  const keys = cam.keys || [];
  const list = [{ ...cam.start, t: 0 }, ...keys];
  let i = 0;
  while (i < list.length - 1 && t >= list[i + 1].t) i++;
  const a = list[i], b = list[i + 1];
  if (!b) return { x: a.x, y: a.y, z: a.z, pan: a.pan, tilt: a.tilt, focal: a.focal };
  const before = list[i - 1], after = list[i + 2];
  const { u } = walkProgress(t, { t: a.t, t1: b.t, easeIn: !(before && camMoves(before, a)), easeOut: !(after && camMoves(b, after)) });
  let x = a.x + (b.x - a.x) * u;
  let z = a.z + (b.z - a.z) * u;
  if (b.via?.length) {
    const p = curveFor([{ x: a.x, z: a.z }, ...b.via, { x: b.x, z: b.z }]).getPointAt(u);
    x = p.x;
    z = p.z;
  }
  return { x, z, y: a.y + (b.y - a.y) * u, pan: lerpDeg(a.pan, b.pan, u), tilt: a.tilt + (b.tilt - a.tilt) * u, focal: a.focal + (b.focal - a.focal) * u };
}

export const camKeyAt = (cam, t) => (cam.keys || []).find((k) => Math.abs(k.t - t) < KEY_NEAR);

// Der Kamerapunkt an dieser Stelle; am Anfang des Shots ist das der Start. Fehlt er, entsteht er aus der aktuellen Lage.
export function ensureCamKey(cam, t) {
  if (t < KEY_NEAR) return cam.start;
  const found = camKeyAt(cam, t);
  if (found) return found;
  const key = { id: uid(), t: Math.round(t * 100) / 100, ...evalCamera(cam, t) };
  cam.keys.push(key);
  cam.keys.sort((a, b) => a.t - b.t);
  return key;
}

// Brennweite als Kleinbild-Äquivalent über die Bilddiagonale -> vertikaler Bildwinkel in Grad
export function verticalFov(focal, aspect) {
  const tanHalfDiag = 43.27 / (2 * focal);
  const tanHalfV = tanHalfDiag / Math.sqrt(1 + aspect * aspect);
  return (2 * Math.atan(tanHalfV) * 180) / Math.PI;
}

export function colorDistance(a, b) {
  const pa = new THREE.Color(a);
  const pb = new THREE.Color(b);
  return Math.hypot(pa.r - pb.r, pa.g - pb.g, pa.b - pb.b);
}

// Beim neuen Shot: Figuren stehen dort, wo sie im vorigen Shot aufgehört haben
export function shotFromEnd(project, prev) {
  const shot = newShot(project);
  shot.format = prev.format;
  shot.camera = { start: evalCamera(prev.camera, prev.duration), keys: [], aim: prev.camera.aim };
  // Türen bleiben so, wie sie am Ende des vorigen Shots stehen
  for (const [id, d] of Object.entries(prev.doors || {})) shot.doors[id] = { from: d.to, to: d.to, t0: 0, t1: 0 };
  for (const f of project.set.figures) {
    const st = prev.figs[f.id];
    if (!st) continue;
    const end = evalFigure(st, 1e6); // alle Schritte zu Ende
    const r = (v) => Math.round(v * 1000) / 1000;
    shot.figs[f.id] = { ...newFigureState(r(end.x), r(end.z), shot.duration), heading: Math.round(end.heading), pose: end.pose, side: end.side, back: end.back, headYaw: st.headYaw };
  }
  return shot;
}

// ---------- Beispiel: Nachbau von Animation.mp4 ----------

export function exampleProject() {
  const p = newProject();
  p.name = 'Beispiel Sitzgruppe';
  p.shots = [];
  const o = (kind, x, z, heading, over = {}) => {
    const obj = newObject(kind, x, z);
    Object.assign(obj, { heading, color: '#5a3d2b' }, over);
    p.set.objects.push(obj);
    return obj;
  };
  o('sessel', -2.0, 0.35, 125, { name: 'Sessel links' });
  o('sessel', -0.35, -0.95, 165, { name: 'Sessel hinten' });
  o('sofa', 1.25, -0.85, 200, { name: 'Sofa', w: 1.9 });
  o('sessel', 2.35, 0.35, 250, { name: 'Sessel rechts' });
  o('couchtisch', 0.25, 0.35, 0, { name: 'Couchtisch', color: '#3b2a1e' });
  o('stehlampe', 0.75, -1.85, 0, { name: 'Stehlampe', color: '#c9a25e' });

  const frau = { id: uid(), name: 'Frau', color: FIGURE_COLORS[0].hex, height: 1.68 };
  p.set.figures.push(frau);

  const s1 = newShot(p, 'Gang um den Tisch');
  s1.duration = 8;
  s1.format = '16:9';
  s1.figs[frau.id] = { ...newFigureState(-1.75, -0.75, 8), keys: [{ id: uid(), t: 0.3, x: -1.75, z: -0.75 }, { id: uid(), t: 8, x: -1.05, z: 1.75, via: [{ x: -0.8, z: 0.15 }, { x: -0.6, z: 1.0 }] }] };
  s1.camera = {
    start: newCameraKey({ x: -0.9, z: 7.4, y: 2.3, pan: 6, tilt: -14, focal: 32 }),
    keys: [{ id: uid(), t: 8, ...newCameraKey({ x: -0.6, z: 5.6, y: 1.8, pan: 8, tilt: -12, focal: 32 }) }],
    aim: '',
  };
  p.shots.push(s1);

  const s2 = newShot(p, 'Sitzt auf dem Sofa');
  s2.duration = 4;
  s2.format = '9:16';
  s2.figs[frau.id] = { ...newFigureState(1.25, -0.85, 4), heading: 200, pose: 'sitzen', headYaw: -20 };
  s2.camera = {
    start: newCameraKey({ x: 1.55, z: 1.4, y: 1.05, pan: 351, tilt: -6, focal: 50 }),
    keys: [],
    aim: '',
  };
  p.shots.push(s2);
  return p;
}
