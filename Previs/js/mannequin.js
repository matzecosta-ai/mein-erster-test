// Gliederpuppe: starre Glieder an Gelenken, Proportionen aus der Körpergröße.
// Winkel in Grad. Vorzeichen: Bein/Arm nach vorn = X negativ, Knie beugen = X positiv,
// Ellbogen beugen = X negativ, Oberkörper/Kopf nach vorn = X positiv, linker Arm seitlich raus = Z positiv.
import * as THREE from 'three';
import { DEG, headingToRotY, clamp } from './units.js';

export const POSES = [
  { id: 'stehen', label: 'Stehen', upright: true },
  { id: 'sitzen', label: 'Sitzen', support: 0.45 },
  { id: 'arme', label: 'Arme verschränkt', upright: true },
  { id: 'zeigen', label: 'Zeigen', upright: true, arm: 'rechts' },
  { id: 'handgelenk', label: 'Aufs Handgelenk schauen', upright: true, arm: 'links' },
  { id: 'hand_heben', label: 'Hand heben', upright: true, arm: 'rechts' },
  { id: 'greifen', label: 'Greifen', upright: true, arm: 'rechts' },
  { id: 'telefonieren', label: 'Telefonieren', upright: true, arm: 'rechts' },
  { id: 'buecken', label: 'Bücken', upright: true },
  { id: 'hocken', label: 'Hocken' },
  { id: 'knien', label: 'Knien' },
  { id: 'knien_einseitig', label: 'Auf einem Knie', arm: 'links' },
  { id: 'liegen', label: 'Liegen (Rücken)', support: 0 },
  { id: 'liegen_seite', label: 'Liegen (Seite)', support: 0 },
];
export const poseInfo = (id) => POSES.find((p) => p.id === id) || POSES[0];

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'elbowL', 'wristL', 'shoulderR', 'elbowR', 'wristR', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR'];

export function buildMannequin(fig) {
  const H = fig.height;
  const mat = new THREE.MeshStandardMaterial({ color: fig.color, roughness: 0.65, metalness: 0 });
  const root = new THREE.Group();
  const j = {};
  const joint = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x * H, y * H, z * H);
    parent.add(g);
    j[name] = g;
    return g;
  };
  const add = (parent, geometry, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x * H, y * H, z * H);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const ellipsoid = (parent, rx, ry, rz, x, y, z) => add(parent, new THREE.SphereGeometry(1, 20, 14), x, y, z, rx * H, ry * H, rz * H);
  const ball = (parent, r) => ellipsoid(parent, r, r, r, 0, 0, 0);
  const limb = (parent, length, r) => add(parent, new THREE.CapsuleGeometry(r * H, Math.max(0.001, (length - 2 * r) * H), 4, 12), 0, -length / 2, 0);

  const hips = joint('hips', root, 0, 0.53, 0);
  ellipsoid(hips, 0.085, 0.055, 0.058, 0, 0.025, 0);
  const spine = joint('spine', hips, 0, 0.075, 0);
  ellipsoid(spine, 0.074, 0.06, 0.05, 0, 0.045, 0);
  const chest = joint('chest', spine, 0, 0.085, 0);
  ellipsoid(chest, 0.098, 0.078, 0.058, 0, 0.07, 0);
  const neck = joint('neck', chest, 0, 0.14, 0);
  add(neck, new THREE.CapsuleGeometry(0.024 * H, 0.03 * H, 4, 10), 0, 0.022, 0);
  const head = joint('head', neck, 0, 0.05, 0);
  ellipsoid(head, 0.058, 0.07, 0.066, 0, 0.058, 0.004);
  add(head, new THREE.BoxGeometry(0.014 * H, 0.024 * H, 0.03 * H), 0, 0.05, 0.068); // Nase zeigt die Blickrichtung

  for (const [side, sx] of [['L', 1], ['R', -1]]) {
    const sh = joint('shoulder' + side, chest, sx * 0.105, 0.122, 0);
    ball(sh, 0.03);
    limb(sh, 0.186, 0.026);
    const el = joint('elbow' + side, sh, 0, -0.186, 0);
    ball(el, 0.022);
    limb(el, 0.146, 0.021);
    const wr = joint('wrist' + side, el, 0, -0.146, 0);
    ellipsoid(wr, 0.014, 0.052, 0.03, 0, -0.05, 0);

    const hp = joint('hip' + side, hips, sx * 0.052, 0, 0);
    ball(hp, 0.042);
    limb(hp, 0.245, 0.04);
    const kn = joint('knee' + side, hp, 0, -0.245, 0);
    ball(kn, 0.032);
    limb(kn, 0.246, 0.031);
    const an = joint('ankle' + side, kn, 0, -0.246, 0);
    add(an, new THREE.BoxGeometry(0.055 * H, 0.036 * H, 0.155 * H), 0, -0.021, 0.045);
  }
  return { root, joints: j, height: H, material: mat };
}

// ---------- Haltungen ----------

const T = 0.245; // Oberschenkel / Größe
const S = 0.246; // Unterschenkel / Größe
const A = 0.039; // Knöchelhöhe / Größe

const ARMS_DOWN = { shoulderL: [0, 0, 6], shoulderR: [0, 0, -6], elbowL: [-8, 0, 0], elbowR: [-8, 0, 0] };

// Sitzen: Oberschenkel waagerecht oder leicht abfallend, Füße auf dem Boden
function seatedLegs(hipsY) {
  const need = hipsY - A; // in Körpergrößen
  if (need > S) {
    const a = Math.asin(clamp((need - S) / T, 0, 1)) / DEG;
    return { hip: -(90 - a), knee: 90 - a };
  }
  const phi = Math.acos(clamp(need / S, -1, 1)) / DEG;
  return { hip: -90, knee: 90 - phi };
}

function poseDef(id, support) {
  // hipsY in Körpergrößen; support in Körpergrößen (Sitz- oder Liegefläche)
  switch (id) {
    case 'sitzen': {
      const hipsY = support + 0.052;
      const legs = seatedLegs(hipsY);
      return {
        hipsY,
        j: { hipL: [legs.hip, 0, 2], hipR: [legs.hip, 0, -2], kneeL: [legs.knee, 0, 0], kneeR: [legs.knee, 0, 0], shoulderL: [-28, 0, 6], shoulderR: [-28, 0, -6], elbowL: [-42, 0, 0], elbowR: [-42, 0, 0], spine: [-3, 0, 0] },
      };
    }
    case 'arme':
      return { j: { shoulderL: [-12, -62, 14], shoulderR: [-12, 62, -14], elbowL: [-104, 0, 0], elbowR: [-96, 0, 0] } };
    case 'zeigen':
      return { j: { ...ARMS_DOWN, shoulderR: [-85, 0, -6], elbowR: [-4, 0, 0], head: [0, -8, 0] } };
    case 'handgelenk':
      return { j: { ...ARMS_DOWN, shoulderL: [-14, -30, 8], elbowL: [-92, 0, 0], neck: [14, 0, 0], head: [30, 12, 0] } };
    case 'hand_heben':
      return { j: { ...ARMS_DOWN, shoulderR: [-160, 0, -12], elbowR: [-15, 0, 0] } };
    case 'greifen':
      return { j: { ...ARMS_DOWN, shoulderR: [-68, 0, -4], elbowR: [-22, 0, 0], chest: [4, -8, 0] } };
    case 'telefonieren':
      return { j: { ...ARMS_DOWN, shoulderR: [-28, 25, -38], elbowR: [-150, 0, 0], head: [4, 0, -6] } };
    case 'buecken':
      return { j: { ...ARMS_DOWN, spine: [38, 0, 0], chest: [30, 0, 0], neck: [-12, 0, 0], head: [-18, 0, 0], shoulderL: [-68, 0, 6], shoulderR: [-68, 0, -6], hipL: [-12, 0, 0], hipR: [-12, 0, 0], kneeL: [18, 0, 0], kneeR: [18, 0, 0] } };
    case 'hocken':
      return { j: { hipL: [-115, 0, 8], hipR: [-115, 0, -8], kneeL: [135, 0, 0], kneeR: [135, 0, 0], spine: [22, 0, 0], chest: [10, 0, 0], head: [-15, 0, 0], shoulderL: [-55, 0, 12], shoulderR: [-55, 0, -12], elbowL: [-30, 0, 0], elbowR: [-30, 0, 0] } };
    case 'knien':
      return { hipsY: 0.03 + T, keepAnkles: true, j: { ...ARMS_DOWN, kneeL: [90, 0, 0], kneeR: [90, 0, 0], ankleL: [90, 0, 0], ankleR: [90, 0, 0] } };
    case 'knien_einseitig':
      return { hipsY: 0.03 + T, keepAnkles: true, j: { ...ARMS_DOWN, hipL: [-88, 0, 0], kneeL: [88, 0, 0], kneeR: [90, 0, 0], ankleR: [90, 0, 0], shoulderL: [-30, 0, 8], elbowL: [-40, 0, 0] } };
    case 'liegen':
      return { hipsY: support + 0.06, hipsRot: [-90, 0, 0], keepAnkles: true, j: { shoulderL: [0, 0, 10], shoulderR: [0, 0, -10], ankleL: [-10, 0, 0], ankleR: [-10, 0, 0] } };
    case 'liegen_seite':
      return { hipsY: support + 0.1, hipsRot: [-90, 0, 90], keepAnkles: true, j: { shoulderL: [-30, 0, 0], shoulderR: [-70, 0, 0], elbowR: [-60, 0, 0], hipL: [-35, 0, 0], kneeL: [55, 0, 0], hipR: [-25, 0, 0], kneeR: [40, 0, 0], head: [0, 0, 0] } };
    default:
      return { j: { ...ARMS_DOWN } };
  }
}

// Höhe der Hüfte, damit das tiefere Bein den Boden berührt
function groundedHipsY(rot) {
  const leg = (hip, knee) => T * Math.cos(hip * DEG) + S * Math.cos((hip + knee) * DEG);
  return A + Math.max(leg(rot.hipL[0], rot.kneeL[0]), leg(rot.hipR[0], rot.kneeR[0]));
}

// Gelenkwinkel und Hüfte einer Haltung, noch ohne Kopfdrehung
function solvePose(H, poseId, ctx, support, side) {
  const info = poseInfo(poseId);
  const supportM = support ?? info.support ?? 0;
  const def = poseDef(info.id, supportM / H);
  const rot = {};
  for (const name of JOINTS) rot[name] = [0, 0, 0];
  for (const [name, v] of Object.entries(def.j)) rot[name] = [...v];

  const amount = info.upright ? clamp(ctx.walkAmount || 0, 0, 1) : 0;
  if (amount > 0) {
    const p = ctx.walkPhase || 0;
    const swing = amount * (14 + 10 * Math.min(ctx.walkSpeed ?? 1.3, 1.6) / 1.6);
    rot.hipL[0] += -swing * Math.sin(p);
    rot.hipR[0] += swing * Math.sin(p);
    rot.kneeL[0] += amount * (4 + 48 * Math.max(0, Math.cos(p)) ** 1.5);
    rot.kneeR[0] += amount * (4 + 48 * Math.max(0, -Math.cos(p)) ** 1.5);
    if (info.id === 'stehen') {
      rot.shoulderL[0] += 20 * amount * Math.sin(p);
      rot.shoulderR[0] -= 20 * amount * Math.sin(p);
      rot.elbowL[0] -= 12 * amount;
      rot.elbowR[0] -= 12 * amount;
    }
    rot.chest[1] += 4 * amount * Math.sin(p);
  }

  if (!def.keepAnkles) {
    rot.ankleL[0] = -(rot.hipL[0] + rot.kneeL[0]);
    rot.ankleR[0] = -(rot.hipR[0] + rot.kneeR[0]);
  }
  // Die andere Seite: linke und rechte Gelenke tauschen, Drehungen spiegeln
  if (info.arm && side && side !== info.arm) {
    for (const name of JOINTS) rot[name] = [rot[name][0], -rot[name][1], -rot[name][2]];
    for (const j of ['shoulder', 'elbow', 'wrist', 'hip', 'knee', 'ankle']) [rot[j + 'L'], rot[j + 'R']] = [rot[j + 'R'], rot[j + 'L']];
  }
  const hipsY = def.hipsY ?? (info.upright || info.id === 'hocken' ? groundedHipsY(rot) : 0.53);
  return { rot, hipsY, hipsRot: def.hipsRot || [0, 0, 0] };
}

// ctx: { support: Meter oder null, walkPhase, walkAmount, headYaw, side, from, fromSupport, fromSide, blend }
// Mit from und blend (0 bis 1) überblendet die Puppe von der Haltung from zu poseId.
export function applyPose(man, poseId, ctx = {}) {
  const H = man.height;
  const to = solvePose(H, poseId, ctx, ctx.support, ctx.side);
  let { rot, hipsY, hipsRot } = to;
  const u = ctx.blend ?? 1;
  if (ctx.from && ctx.from !== poseId && u < 1) {
    const a = solvePose(H, ctx.from, ctx, ctx.fromSupport, ctx.fromSide);
    const mix = (p, q) => p.map((v, i) => v + (q[i] - v) * u);
    rot = {};
    for (const name of JOINTS) rot[name] = mix(a.rot[name], to.rot[name]);
    hipsRot = mix(a.hipsRot, to.hipsRot);
    // Die Füße bleiben während des Wechsels am Boden, die Abweichung davon wird überblendet
    const lift = (s) => s.hipsY - groundedHipsY(s.rot);
    hipsY = groundedHipsY(rot) + lift(a) + (lift(to) - lift(a)) * u;
  }
  // Kopfdrehung auf Kopf, Hals und Oberkörper verteilt, damit sie auch von weitem lesbar ist
  rot.head[1] += -(ctx.headYaw || 0) * 0.55;
  rot.neck[1] += -(ctx.headYaw || 0) * 0.25;
  rot.chest[1] += -(ctx.headYaw || 0) * 0.2;

  for (const name of JOINTS) {
    if (name === 'hips') continue;
    const [x, y, z] = rot[name];
    man.joints[name].rotation.set(x * DEG, y * DEG, z * DEG, 'YXZ');
  }
  man.joints.hips.position.y = hipsY * H;
  man.joints.hips.rotation.set(hipsRot[0] * DEG, hipsRot[1] * DEG, hipsRot[2] * DEG, 'ZXY');
}

export function placeMannequin(man, x, z, heading) {
  man.root.position.set(x, 0, z);
  man.root.rotation.y = headingToRotY(heading);
}

// Schrittlänge (zwei Schritte) aus dem Durchschnittstempo
export function strideLength(height, avgSpeed) {
  return height * (0.42 + 0.45 * Math.min(avgSpeed, 1.6) / 1.6);
}
