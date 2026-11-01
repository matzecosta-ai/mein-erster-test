// Baut Möbel, Wände, Boden und Decke als Three.js-Objekte. Alles in Metern, Front zeigt lokal nach +Z.
import * as THREE from 'three';
import { headingToRotY, headingToDir, dirToHeading, clamp, DEG } from './units.js';

export function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
}

function shade(color, amount) {
  const c = new THREE.Color(color);
  return amount >= 0 ? c.lerp(new THREE.Color('#ffffff'), amount) : c.lerp(new THREE.Color('#000000'), -amount);
}

function mesh(geometry, mat) {
  const m = new THREE.Mesh(geometry, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Quader von (x0,y0,z0) bis (x1,y1,z1)
function block(group, mat, x0, y0, z0, x1, y1, z1) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  if (w < 1e-4 || h < 1e-4 || d < 1e-4) return null;
  const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  group.add(m);
  return m;
}

function cylinder(group, mat, rx, rz, y0, y1, x = 0, z = 0, rTop = null) {
  const g = new THREE.CylinderGeometry(rTop ?? rx, rx, y1 - y0, 32);
  const m = mesh(g, mat);
  m.scale.z = rz / rx;
  m.position.set(x, (y0 + y1) / 2, z);
  group.add(m);
  return m;
}

function legs(group, mat, w, d, top, size, inset) {
  const xs = w / 2 - inset - size / 2;
  const zs = d / 2 - inset - size / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    block(group, mat, sx * xs - size / 2, 0, sz * zs - size / 2, sx * xs + size / 2, top, sz * zs + size / 2);
  }
}

function upholstered(g, o, back, arm) {
  const m = material(o.color);
  const dark = material(shade(o.color, -0.5));
  const foot = 0.08;
  const { w, d, h } = o;
  const seat = o.seat ?? 0.43;
  legs(g, dark, w, d, foot, 0.05, 0.04);
  block(g, m, -w / 2, foot, -d / 2, w / 2, Math.min(seat - 0.12, h), d / 2); // Unterbau
  block(g, m, -w / 2 + arm, seat - 0.12, -d / 2 + back, w / 2 - arm, seat, d / 2); // Sitzpolster
  block(g, m, -w / 2, seat - 0.12, -d / 2, w / 2, h, -d / 2 + back); // Rückenlehne
  const armTop = Math.min(h, seat + 0.2);
  block(g, m, -w / 2, seat - 0.12, -d / 2, -w / 2 + arm, armTop, d / 2);
  block(g, m, w / 2 - arm, seat - 0.12, -d / 2, w / 2, armTop, d / 2);
}

// Bilder werden nur einmal geladen, das Set wird bei jeder Änderung neu gebaut
const textures = new Map();
function textureFor(id, url) {
  if (!textures.has(id)) {
    const tex = new THREE.TextureLoader().load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textures.set(id, tex);
  }
  return textures.get(id);
}

const BUILDERS = {
  stuhl(g, o) {
    const m = material(o.color);
    const seat = o.seat ?? 0.46;
    const t = 0.04;
    legs(g, m, o.w, o.d, seat - t, 0.035, 0.015);
    block(g, m, -o.w / 2, seat - t, -o.d / 2, o.w / 2, seat, o.d / 2);
    for (const sx of [-1, 1]) block(g, m, sx * (o.w / 2 - 0.0325) - 0.0175, seat, -o.d / 2 + 0.015, sx * (o.w / 2 - 0.0325) + 0.0175, o.h, -o.d / 2 + 0.05);
    block(g, m, -o.w / 2 + 0.015, Math.max(seat + 0.18, o.h - 0.25), -o.d / 2 + 0.015, o.w / 2 - 0.015, o.h, -o.d / 2 + 0.045);
  },
  sessel(g, o) { upholstered(g, o, Math.min(0.2, o.d * 0.25), Math.min(0.15, o.w * 0.18)); },
  sofa(g, o) { upholstered(g, o, Math.min(0.22, o.d * 0.25), Math.min(0.16, o.w * 0.1)); },
  bank(g, o) {
    const m = material(o.color);
    const seat = o.seat ?? 0.45;
    legs(g, m, o.w, o.d, seat - 0.05, 0.05, 0.05);
    block(g, m, -o.w / 2, seat - 0.05, -o.d / 2, o.w / 2, seat, o.d / 2);
    for (const sx of [-1, 1]) block(g, m, sx * (o.w / 2 - 0.1) - 0.025, seat, -o.d / 2 + 0.02, sx * (o.w / 2 - 0.1) + 0.025, o.h, -o.d / 2 + 0.07);
    block(g, m, -o.w / 2, o.h - 0.3, -o.d / 2 + 0.03, o.w / 2, o.h, -o.d / 2 + 0.06);
  },
  bett(g, o) {
    const m = material(o.color);
    const light = material(shade(o.color, 0.45));
    const seat = o.seat ?? 0.5;
    legs(g, m, o.w, o.d, 0.08, 0.06, 0.03);
    block(g, m, -o.w / 2, 0.08, -o.d / 2, o.w / 2, seat - 0.18, o.d / 2);
    block(g, light, -o.w / 2 + 0.03, seat - 0.18, -o.d / 2 + 0.06, o.w / 2 - 0.03, seat, o.d / 2 - 0.03);
    block(g, m, -o.w / 2, 0.08, -o.d / 2, o.w / 2, o.h, -o.d / 2 + 0.06);
    block(g, light, -o.w / 2 + 0.12, seat, -o.d / 2 + 0.1, o.w / 2 - 0.12, seat + 0.12, -o.d / 2 + 0.5);
  },
  tisch(g, o) {
    const m = material(o.color);
    legs(g, m, o.w, o.d, o.h - 0.04, 0.05, 0.04);
    block(g, m, -o.w / 2, o.h - 0.04, -o.d / 2, o.w / 2, o.h, o.d / 2);
  },
  couchtisch(g, o) {
    const m = material(o.color);
    cylinder(g, m, o.w / 2, o.d / 2, o.h - 0.04, o.h);
    cylinder(g, m, 0.04, 0.04, 0.02, o.h - 0.04);
    cylinder(g, m, o.w / 4, o.d / 4, 0, 0.02);
  },
  schrank(g, o) {
    const m = material(o.color);
    const dark = material(shade(o.color, -0.35));
    block(g, m, -o.w / 2, 0, -o.d / 2, o.w / 2, o.h, o.d / 2);
    block(g, dark, -0.004, 0.05, o.d / 2 - 0.002, 0.004, o.h - 0.05, o.d / 2 + 0.002);
  },
  stehlampe(g, o) {
    const dark = material('#3a3a3a');
    const shadeMat = material(o.color, { side: THREE.DoubleSide, emissive: new THREE.Color(o.color), emissiveIntensity: 0.25 });
    cylinder(g, dark, Math.min(0.15, o.w / 3), Math.min(0.15, o.d / 3), 0, 0.03);
    cylinder(g, dark, 0.015, 0.015, 0.03, o.h - 0.3);
    const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(o.w * 0.33, o.w / 2, 0.34, 32, 1, true), shadeMat);
    shadeMesh.scale.z = o.d / o.w;
    shadeMesh.position.y = o.h - 0.17;
    shadeMesh.castShadow = true;
    g.add(shadeMesh);
  },
  auto(g, o) {
    const m = material(o.color);
    const glass = material(shade(o.color, -0.6));
    const tyre = material('#222222');
    const r = Math.min(0.34, o.h * 0.24);
    block(g, m, -o.w / 2, r * 0.7, -o.d / 2, o.w / 2, o.h * 0.55, o.d / 2);
    block(g, glass, -o.w * 0.43, o.h * 0.55, -o.d * 0.28, o.w * 0.43, o.h, o.d * 0.18);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const wheel = mesh(new THREE.CylinderGeometry(r, r, 0.22, 24), tyre);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (o.w / 2 - 0.12), r, sz * (o.d / 2 - 0.75));
      g.add(wheel);
    }
  },
  baum(g, o) {
    const m = material(o.color);
    const trunk = material(shade(o.color, -0.45));
    cylinder(g, trunk, o.w * 0.05, o.d * 0.05, 0, o.h * 0.5);
    const crown = mesh(new THREE.SphereGeometry(0.5, 24, 16), m);
    crown.scale.set(o.w, o.h * 0.6, o.d);
    crown.position.y = o.h * 0.7;
    g.add(crown);
  },
  quader(g, o) {
    block(g, material(o.color), -o.w / 2, 0, -o.d / 2, o.w / 2, o.h, o.d / 2);
  },
  zylinder(g, o) {
    cylinder(g, material(o.color), o.w / 2, o.d / 2, 0, o.h);
  },
  // Das Licht wirkt im Bild, die Kugel dazu sieht nur die Arbeitsansicht (Ebene 1)
  licht(g, o) {
    const lamp = new THREE.PointLight(o.color, 12 * (o.power ?? 1), 0, 2);
    // Schatten: Figuren und Möbel werfen sie, Wände halten das Licht auf
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.1;
    lamp.shadow.camera.far = 30;
    lamp.shadow.bias = -0.003;
    lamp.shadow.normalBias = 0;
    g.add(lamp);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), material(o.color, { emissive: new THREE.Color(o.color), emissiveIntensity: 1 }));
    ball.layers.set(1);
    g.add(ball);
  },
  // Der obere Bildrand zeigt zur Vorderseite, an der Wand nach oben
  flaeche(g, o, ctx) {
    const url = o.image && ctx.images?.[o.image];
    const tex = url ? { map: textureFor(o.image, url), transparent: true, alphaTest: 0.02 } : {};
    // an der Decke leuchtet die Fläche selbst, von unten bekäme sie sonst kaum Licht
    const glow = o.surface === 'decke' ? { emissive: new THREE.Color(url ? '#ffffff' : o.color), emissiveIntensity: 0.75, emissiveMap: tex.map ?? null } : {};
    const mat = material(url ? '#ffffff' : o.color, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...tex, ...glow });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), mat);
    m.receiveShadow = true;
    const lift = 0.005;
    const size = [Math.max(o.w, 0.16), 0.02, Math.max(o.d, 0.16)];
    let hitY = 0.01;
    if (o.surface === 'wand') {
      m.position.set(0, o.d / 2, lift);
      size[2] = 0.16;
      hitY = ctx.H - o.y + 0.03; // über der Wand, damit der Grundriss sie greifen kann
    } else if (o.surface === 'decke') {
      m.rotation.x = Math.PI / 2;
      m.position.y = -lift;
      m.userData.hideInPlan = true;
      hitY = 0.01 - ctx.H;
    } else {
      m.rotation.set(-Math.PI / 2, 0, Math.PI);
      m.position.y = lift;
    }
    g.add(m);
    // unsichtbarer Klickbereich, auch schmale Schienen sollen sich greifen lassen
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hitY;
    g.add(hit);
  },
};

export function buildObject(o, ctx = {}) {
  const g = new THREE.Group();
  (BUILDERS[o.kind] || BUILDERS.quader)(g, o, ctx);
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = headingToRotY(o.heading);
  tag(g, { kind: 'object', id: o.id });
  return g;
}

export function tag(root, data) {
  root.userData = { ...data };
  root.traverse((c) => { c.userData.pick = data; });
}

// ---------- Wände mit Türen und Fenstern ----------

const near = (p, q) => Math.hypot(p.x - q.x, p.z - q.z) < 0.01;

// Ebene für Wände, die im Kamerabild ausgeblendet sind (nur Arbeitsansicht sieht sie)
export const CUTAWAY_LAYER = 2;

// Schnitthöhe des Grundrisses: Was ganz darüber liegt (Stürze über Türen und Fenstern), zeigt der Grundriss nicht
const PLAN_CUT = 1.2;

// Länge auf der Wandmitte und wie weit die angrenzenden Wände an den Enden hineinragen
export function wallInsets(set, wall) {
  const L = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z);
  const others = set.walls.filter((w) => w !== wall);
  const at = (p) => others.find((w) => near(w.a, p) || near(w.b, p));
  const wa = at(wall.a), wb = at(wall.b);
  return { L, ia: wa ? wa.t / 2 : 0, ib: wb ? wb.t / 2 : 0 };
}

// Lichtes Maß: Länge zwischen den angrenzenden Wänden
export function clearLength(set, wall) {
  const { L, ia, ib } = wallInsets(set, wall);
  return L - ia - ib;
}

// Erlaubter Bereich für die Mitte einer Öffnung, damit sie ganz in der Wand bleibt
export function openingRange(set, wall, o) {
  const { L, ia, ib } = wallInsets(set, wall);
  const min = ia + o.w / 2, max = L - ib - o.w / 2;
  return min <= max ? [min, max] : [L / 2, L / 2];
}

// Lage einer Öffnung in Wandkoordinaten: x entlang der Wand ab Punkt a, z quer dazu.
// zIn zeigt zur Raumseite, sz zur Seite, zu der die Tür aufgeht.
export function openingLayout(wall, o, inner) {
  const dx = wall.b.x - wall.a.x, dz = wall.b.z - wall.a.z;
  const L = Math.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;
  const zIn = inner ? Math.sign(-inner.x * uz + inner.z * ux) || 1 : 1;
  const sz = o.swing === 'aussen' ? -zIn : zIn;
  return {
    L, ux, uz, zIn, sz,
    s: Math.max(0, o.offset - o.w / 2),
    e: Math.min(L, o.offset + o.w / 2),
    // DIN links: Bänder links, von der Seite gesehen, zu der die Tür aufgeht
    hingeAtStart: (o.hinge !== 'rechts') === (sz > 0),
    toWorld: (x, z) => ({ x: wall.a.x + ux * x - uz * z, z: wall.a.z + uz * x + ux * z }),
  };
}

const glassMat = () => new THREE.MeshStandardMaterial({ color: '#a9cbe0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false });

// Zarge, Türblatt und Klinke bzw. Rahmen, Glas und Fensterbank, in Wandkoordinaten.
// Gibt bei Türen eine Funktion zurück, die den Öffnungsgrad setzt (Drehtür in Grad, Schiebetür in Prozent).
function buildOpening(og, wall, o, lay) {
  const t = wall.t / 2;
  const { s, e, sz } = lay;
  const H = wall.h;
  const frame = material(shade(o.color, -0.12));
  const leafMat = material(o.color);
  let setOpen = null;
  if (o.type === 'loch') {
    // nur die Lücke in der Wand
  } else if (o.kind === 'tuer' && o.type === 'schiebe') {
    // schmaler Rahmen, das Blatt läuft in die Wand hinein
    const h = Math.min(o.h, H);
    const f = 0.03;
    block(og, frame, s, 0, -t - 0.004, s + f, h, t + 0.004);
    block(og, frame, e - f, 0, -t - 0.004, e, h, t + 0.004);
    block(og, frame, s, h - f, -t - 0.004, e, h, t + 0.004);
    const lw = Math.max(0.1, e - s - 2 * f);
    const dirX = o.hinge === 'rechts' ? lay.zIn : -lay.zIn; // von innen gesehen
    const slider = new THREE.Group();
    const zr = lay.zIn * Math.max(0.005, t - 0.012);
    block(slider, leafMat, 0, 0.005, zr, lw, h - f, zr - lay.zIn * 0.04);
    og.add(slider);
    setOpen = (v) => { slider.position.x = s + f + dirX * (clamp(v, 0, 100) / 100) * lw; };
  } else if (o.kind === 'tuer') {
    const h = Math.min(o.h, H);
    const f = 0.05;
    const c = 0.06; // Bekleidung auf beiden Wandseiten
    block(og, frame, s, 0, -t - 0.012, s + f, h, t + 0.012);
    block(og, frame, e - f, 0, -t - 0.012, e, h, t + 0.012);
    block(og, frame, s, h - f, -t - 0.012, e, h, t + 0.012);
    for (const side of [-1, 1]) {
      const z0 = side * t, z1 = side * (t + 0.012);
      block(og, frame, s - c, 0, z0, s, h + c, z1);
      block(og, frame, e, 0, z0, e + c, h + c, z1);
      block(og, frame, s, h, z0, e, h + c, z1);
    }
    const lw = Math.max(0.1, e - s - 2 * f);
    const lh = h - f - 0.01;
    const dir = lay.hingeAtStart ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(lay.hingeAtStart ? s + f : e - f, 0, sz * t);
    setOpen = (v) => { pivot.rotation.y = -dir * sz * clamp(v, 0, 180) * DEG; };
    block(pivot, leafMat, 0, 0.01, -sz * 0.04, dir * lw, 0.01 + lh, 0);
    const knob = material('#3a3a3a', { roughness: 0.4, metalness: 0.6 });
    const hx = dir * (lw - 0.07);
    for (const [side, zFace] of [[sz, 0], [-sz, -sz * 0.04]]) {
      const parts = [
        block(pivot, knob, hx - 0.02, 1.015, zFace, hx + 0.02, 1.085, zFace + side * 0.01),
        block(pivot, knob, hx - 0.01, 1.04, zFace, hx + 0.01, 1.06, zFace + side * 0.055),
        block(pivot, knob, hx, 1.039, zFace + side * 0.045, hx - dir * 0.13, 1.061, zFace + side * 0.066),
      ];
      parts.forEach((m) => { m.userData.hideInPlan = true; }); // Klinken gehören nicht in den Grundriss
    }
    og.add(pivot);
  } else {
    const y0 = o.sill, y1 = Math.min(o.sill + o.h, H);
    const f = 0.06, d = 0.035;
    block(og, leafMat, s, y0, -d, s + f, y1, d);
    block(og, leafMat, e - f, y0, -d, e, y1, d);
    block(og, leafMat, s, y0, -d, e, y0 + f, d);
    block(og, leafMat, s, y1 - f, -d, e, y1, d);
    if (e - s > 1.0) block(og, leafMat, (s + e) / 2 - 0.035, y0 + f, -d + 0.005, (s + e) / 2 + 0.035, y1 - f, d - 0.005);
    const glass = block(og, glassMat(), s + f, y0 + f, -0.004, e - f, y1 - f, 0.004);
    if (glass) glass.castShadow = false;
    if (o.sill > 0.05) block(og, frame, s - 0.03, y0 - 0.025, -t - 0.04, e + 0.03, y0 + 0.005, t + 0.04);
  }
  // unsichtbarer Klickbereich über die ganze Wandhöhe, damit die Öffnung im Grundriss leicht zu greifen ist
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, e - s), H + 0.02, wall.t + 0.12), hitMat);
  hit.position.set((s + e) / 2, (H + 0.02) / 2, 0);
  og.add(hit);
  setOpen?.(o.open || 0);
  return setOpen;
}

// Liefert die Wände als Gruppe; userData.doors hält für jede Tür eine Funktion, die sie öffnet
export function buildWalls(set) {
  const group = new THREE.Group();
  const normals = innerNormals(set.walls);
  const doors = new Map();
  group.userData.doors = doors;
  for (const wall of set.walls) {
    const dx = wall.b.x - wall.a.x;
    const dz = wall.b.z - wall.a.z;
    const L = Math.hypot(dx, dz);
    if (L < 0.01) continue;
    // je Wand eigenes Material, damit sie sich einzeln markieren lässt; beide Seiten werfen Schatten, sonst schimmert Licht an den Ecken durch
    const mat = material(set.wallColor, { shadowSide: THREE.DoubleSide });
    const g = new THREE.Group();
    g.position.set(wall.a.x, 0, wall.a.z);
    g.rotation.y = Math.atan2(-dz, dx);
    const others = set.walls.filter((w) => w !== wall);
    const extA = others.some((w) => near(w.a, wall.a) || near(w.b, wall.a)) ? wall.t / 2 : 0;
    const extB = others.some((w) => near(w.a, wall.b) || near(w.b, wall.b)) ? wall.t / 2 : 0;
    const t = wall.t / 2;
    const H = wall.h;
    const openings = set.openings
      .filter((o) => o.wall === wall.id)
      .map((o) => ({ ...o, s: Math.max(0, o.offset - o.w / 2), e: Math.min(L, o.offset + o.w / 2) }))
      .sort((p, q) => p.s - q.s);
    let cursor = -extA;
    for (const o of openings) {
      if (o.s > cursor) block(g, mat, cursor, 0, -t, o.s, H, t);
      const s = Math.max(cursor, o.s);
      if (o.e > s) {
        if (o.sill > 0) block(g, mat, s, 0, -t, o.e, Math.min(o.sill, H), t);
        if (o.sill + o.h < H) block(g, mat, s, o.sill + o.h, -t, o.e, H, t);
      }
      cursor = Math.max(cursor, o.e);
    }
    if (L + extB > cursor) block(g, mat, cursor, 0, -t, L + extB, H, t);
    const parts = [];
    for (const o of openings) {
      const og = new THREE.Group();
      const setOpen = buildOpening(og, wall, o, openingLayout(wall, o, normals.get(wall.id)));
      if (setOpen) doors.set(o.id, setOpen);
      g.add(og);
      parts.push([og, o.id]);
    }
    tag(g, { kind: 'wall', id: wall.id });
    for (const [og, id] of parts) tag(og, { kind: 'opening', id });
    g.updateMatrixWorld(true);
    const box = new THREE.Box3();
    g.traverse((c) => { if (c.isMesh && box.setFromObject(c).min.y >= PLAN_CUT) c.userData.hideInPlan = true; });
    if (wall.cutaway) g.traverse((c) => c.layers.set(CUTAWAY_LAYER));
    group.add(g);
  }
  return group;
}

// ---------- Flächen auf Boden, Wand und Decke ----------

const roomHeight = (set) => wallBounds(set)?.h ?? 2.6;
const faces = (set) => {
  const normals = innerNormals(set.walls);
  return set.walls.filter((w) => normals.has(w.id)).map((w) => {
    const n = normals.get(w.id);
    const L = Math.hypot(w.b.x - w.a.x, w.b.z - w.a.z) || 1;
    return { w, n, L, ux: (w.b.x - w.a.x) / L, uz: (w.b.z - w.a.z) / L, fx: w.a.x + (n.x * w.t) / 2, fz: w.a.z + (n.z * w.t) / 2 };
  });
};

// Legt eine Fläche auf ihre Unterlage: Höhe von Boden oder Decke, an der Wand Lage und Blickrichtung
export function settleSurface(set, o) {
  if (o.kind !== 'flaeche') return;
  if (o.surface === 'boden') o.y = 0;
  if (o.surface === 'decke') o.y = roomHeight(set);
  if (o.surface !== 'wand') return;
  let best = null;
  for (const f of faces(set)) {
    const along = clamp((o.x - f.fx) * f.ux + (o.z - f.fz) * f.uz, 0, f.L);
    const x = f.fx + f.ux * along, z = f.fz + f.uz * along;
    const dist = Math.hypot(o.x - x, o.z - z);
    if (!best || dist < best.dist) best = { dist, x, z, f };
  }
  if (!best) return;
  o.x = Math.round(best.x * 1000) / 1000;
  o.z = Math.round(best.z * 1000) / 1000;
  o.heading = Math.round(dirToHeading(best.f.n.x, best.f.n.z));
  o.wall = best.f.w.id;
}

// Die Wände eines Raums für die Auswahl, benannt nach ihrer Lage im Grundriss
export function surfaceWalls(set) {
  return faces(set).map((f, i) => {
    const side = Math.abs(f.n.z) >= Math.abs(f.n.x) ? (f.n.z > 0 ? 'Hintere Wand' : 'Vordere Wand') : (f.n.x > 0 ? 'Linke Wand' : 'Rechte Wand');
    return { value: f.w.id, label: side, index: i };
  }).map((w, _, all) => (all.filter((x) => x.label === w.label).length > 1 ? { ...w, label: `${w.label} ${w.index + 1}` } : w));
}

// Setzt eine Fläche auf eine bestimmte Wand, möglichst nahe an ihrer jetzigen Lage
export function moveToWall(set, o, wallId) {
  const f = faces(set).find((x) => x.w.id === wallId);
  if (!f) return;
  const inset = Math.min(f.L / 2, o.w / 2 + f.w.t);
  const along = clamp((o.x - f.fx) * f.ux + (o.z - f.fz) * f.uz, inset, f.L - inset);
  o.x = f.fx + f.ux * along;
  o.z = f.fz + f.uz * along;
  settleSurface(set, o);
}

// Beim Ziehen: Kanten einer Fläche auf Boden oder Decke rasten an den Wänden ein
export function snapSurfaceEdges(set, o) {
  if (o.kind !== 'flaeche' || o.surface === 'wand') return;
  const v = headingToDir(o.heading);
  for (const f of faces(set)) {
    const reach = Math.abs(v.x * f.n.x + v.z * f.n.z) * (o.d / 2) + Math.abs(v.z * f.n.x - v.x * f.n.z) * (o.w / 2);
    const off = (o.x - f.fx) * f.n.x + (o.z - f.fz) * f.n.z - reach;
    const along = (o.x - f.fx) * f.ux + (o.z - f.fz) * f.uz;
    if (Math.abs(off) > 0.12 || along < -0.25 || along > f.L + 0.25) continue;
    o.x -= off * f.n.x;
    o.z -= off * f.n.z;
  }
}

// Zieht eine Fläche auf Boden oder Decke in ihrer Länge bis an die Wände. Gibt false zurück, wenn dort keine sind.
export function reachWalls(set, o) {
  const v = headingToDir(o.heading);
  let ahead = Infinity, behind = -Infinity;
  for (const f of faces(set)) {
    const dn = v.x * f.n.x + v.z * f.n.z;
    if (Math.abs(dn) < 0.1) continue;
    const t = ((f.fx - o.x) * f.n.x + (f.fz - o.z) * f.n.z) / dn;
    const along = (o.x + v.x * t - f.fx) * f.ux + (o.z + v.z * t - f.fz) * f.uz;
    if (along < -0.1 || along > f.L + 0.1) continue;
    if (t > 0) ahead = Math.min(ahead, t);
    else behind = Math.max(behind, t);
  }
  if (!Number.isFinite(ahead) || !Number.isFinite(behind)) return false;
  const mid = (ahead + behind) / 2;
  o.d = Math.round((ahead - behind) * 1000) / 1000;
  o.x = Math.round((o.x + v.x * mid) * 1000) / 1000;
  o.z = Math.round((o.z + v.z * mid) * 1000) / 1000;
  return true;
}

// Innenseite jeder Wand als Einheitsvektor. Geschlossene Räume über die Umlaufrichtung,
// einzelne Wände zeigen zur Mitte aller Wandpunkte.
export function innerNormals(walls) {
  const res = new Map();
  const key = (p) => `${Math.round(p.x * 100)},${Math.round(p.z * 100)}`;
  const adj = new Map();
  for (const w of walls) for (const end of ['a', 'b']) {
    const k = key(w[end]);
    if (!adj.has(k)) adj.set(k, []);
    adj.get(k).push({ w, end });
  }
  for (const w0 of walls) {
    if (res.has(w0.id)) continue;
    const chain = [{ w: w0, from: w0.a, to: w0.b }];
    const seen = new Set([w0.id]);
    let closed = false;
    for (;;) {
      const last = chain[chain.length - 1];
      if (chain.length > 2 && key(last.to) === key(w0.a)) { closed = true; break; }
      const next = (adj.get(key(last.to)) || []).filter((e) => !seen.has(e.w.id));
      if (next.length !== 1) break;
      const e = next[0];
      chain.push({ w: e.w, from: e.w[e.end], to: e.w[e.end === 'a' ? 'b' : 'a'] });
      seen.add(e.w.id);
    }
    if (!closed) continue;
    let area = 0;
    for (const c of chain) area += c.from.x * c.to.z - c.to.x * c.from.z;
    const s = Math.sign(area) || 1;
    for (const c of chain) {
      const dx = c.to.x - c.from.x, dz = c.to.z - c.from.z;
      const L = Math.hypot(dx, dz) || 1;
      res.set(c.w.id, { x: (s * -dz) / L, z: (s * dx) / L });
    }
  }
  const pts = walls.flatMap((w) => [w.a, w.b]);
  const cx = pts.reduce((a, p) => a + p.x, 0) / (pts.length || 1);
  const cz = pts.reduce((a, p) => a + p.z, 0) / (pts.length || 1);
  for (const w of walls) {
    if (res.has(w.id)) continue;
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
    const L = Math.hypot(dx, dz) || 1;
    let n = { x: -dz / L, z: dx / L };
    const side = (cx - w.a.x) * n.x + (cz - w.a.z) * n.z;
    if (Math.abs(side) < 0.05) continue;
    if (side < 0) n = { x: -n.x, z: -n.z };
    res.set(w.id, n);
  }
  return res;
}

export function wallBounds(set) {
  if (!set.walls.length) return null;
  const box = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, h: 0 };
  for (const w of set.walls) for (const p of [w.a, w.b]) {
    box.minX = Math.min(box.minX, p.x); box.maxX = Math.max(box.maxX, p.x);
    box.minZ = Math.min(box.minZ, p.z); box.maxZ = Math.max(box.maxZ, p.z);
    box.h = Math.max(box.h, w.h);
  }
  return box;
}

// Die geschlossenen Räume als Polygone. Wände werden an Anschlüssen geteilt, dann läuft man um jede Fläche herum.
function roomFaces(walls) {
  const nodes = new Map();
  const node = (p) => {
    const k = `${Math.round(p.x * 50)},${Math.round(p.z * 50)}`;
    if (!nodes.has(k)) nodes.set(k, { k, x: p.x, z: p.z, out: [] });
    return nodes.get(k);
  };
  const pts = walls.flatMap((w) => [w.a, w.b]);
  for (const w of walls) {
    const dx = w.b.x - w.a.x, dz = w.b.z - w.a.z;
    const L2 = dx * dx + dz * dz || 1;
    const stops = [0, 1];
    for (const p of pts) {
      const u = ((p.x - w.a.x) * dx + (p.z - w.a.z) * dz) / L2;
      if (u > 0.001 && u < 0.999 && Math.hypot(w.a.x + dx * u - p.x, w.a.z + dz * u - p.z) < 0.02) stops.push(u);
    }
    stops.sort((a, b) => a - b);
    for (let i = 0; i < stops.length - 1; i++) {
      const at = (u) => ({ x: w.a.x + dx * u, z: w.a.z + dz * u });
      const n0 = node(at(stops[i])), n1 = node(at(stops[i + 1]));
      if (n0 === n1) continue;
      n0.out.push({ to: n1, seen: false, angle: Math.atan2(n1.z - n0.z, n1.x - n0.x) });
      n1.out.push({ to: n0, seen: false, angle: Math.atan2(n0.z - n1.z, n0.x - n1.x) });
    }
  }
  for (const n of nodes.values()) n.out.sort((a, b) => a.angle - b.angle);
  const faces = [];
  for (const n of nodes.values()) for (const first of n.out) {
    if (first.seen) continue;
    const poly = [];
    let from = n, e = first;
    for (let guard = 0; guard < 500 && !e.seen; guard++) {
      e.seen = true;
      poly.push({ x: from.x, z: from.z });
      const list = e.to.out;
      const back = list.findIndex((o) => o.to === from);
      from = e.to;
      e = list[(back + list.length - 1) % list.length];
    }
    let area = 0;
    poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; area += p.x * q.z - q.x * p.z; });
    if (area > 0.02) faces.push(poly); // die Außenfläche läuft andersherum
  }
  return faces;
}

export function buildCeiling(set) {
  const b = wallBounds(set);
  if (!b || !set.ceiling) return null;
  const faces = roomFaces(set.walls);
  const geometry = faces.length
    ? new THREE.ShapeGeometry(faces.map((poly) => new THREE.Shape(poly.map((p) => new THREE.Vector2(p.x, -p.z)))))
    : new THREE.PlaneGeometry(b.maxX - b.minX + 0.4, b.maxZ - b.minZ + 0.4);
  // ohne Beleuchtung: Von unten bekäme die Decke kaum Licht und wäre in jeder Farbe fast schwarz
  const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: set.ceilingColor, side: THREE.DoubleSide }));
  m.rotation.x = faces.length ? -Math.PI / 2 : Math.PI / 2;
  if (faces.length) m.position.y = b.h;
  else m.position.set((b.minX + b.maxX) / 2, b.h, (b.minZ + b.maxZ) / 2);
  m.receiveShadow = true;
  tag(m, { kind: 'ceiling' });
  return m;
}

export function buildFloor(set) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), material(set.floorColor, { roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  tag(m, { kind: 'floor' });
  return m;
}

export function disposeTree(root) {
  root.traverse((c) => {
    if (c.isLight) c.dispose?.();
    if (c.geometry) c.geometry.dispose();
    if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m.dispose());
  });
}
