// Beschreibt den aktuellen Shot als Text für den Prompt: wer welche Puppe ist, wo alle im Bild stehen und was geschieht.
// Lagen werden aus dem Kamerabild berechnet, damit „links“ und „Rücken zur Kamera“ so stimmen, wie man es sieht.
import * as THREE from 'three';
import { evalCamera, evalFigure, stepsOf, walkPoints, doorValue, pathLength } from './model.js';
import { DEG } from './units.js';
import { poseInfo } from './mannequin.js';

const WORDS = {
  en: {
    colors: { '#d42a2a': 'red', '#1f5bd8': 'blue', '#f2c418': 'yellow', '#1e9e4a': 'green', '#f2761d': 'orange', '#7b3fd1': 'purple', '#e0409a': 'pink', '#17a3b8': 'turquoise' },
    head: (fmt, dur, focal, y) => `${fmt}, ${dur} s, ${focal} mm lens, camera at ${y} m height.`,
    labels: 'The coloured jointed mannequins in the layout image are placeholders and must not appear in the video. Their colours are only labels, not clothing colours:',
    openT: 'Opening frame, seen from the camera:', endT: 'End of the shot, seen from the camera:', actT: 'What happens:',
    still: 'The camera does not move.', pan: { l: 'The camera pans left.', r: 'The camera pans right.' }, moveIn: 'The camera moves closer.', moveOut: 'The camera moves back.', moveSide: 'The camera moves sideways.',
    x: { l: 'on the left', c: 'in the centre', r: 'on the right' }, z: { n: 'in the foreground', m: 'in the middle ground', f: 'in the background' },
    out: 'out of frame', self: { cam: 'facing the camera', back: 'with the back to the camera', l: 'facing left', r: 'facing right' },
    held: { stehen: 'standing', sitzen: 'sitting', arme: 'with crossed arms', zeigen: 'pointing with the right arm', handgelenk: 'looking at the wrist', hand_heben: 'with the right hand raised', greifen: 'reaching out with the right hand', telefonieren: 'holding a phone to the ear', buecken: 'bent forward', hocken: 'crouching', knien: 'kneeling', knien_einseitig: 'on one knee', liegen: 'lying on the back', liegen_seite: 'lying on the side' },
    verb: { stehen: 'stands up', sitzen: 'sits down', arme: 'crosses the arms', zeigen: 'points with the right arm', handgelenk: 'looks at the wrist', hand_heben: 'raises the right hand', greifen: 'reaches out with the right hand', telefonieren: 'holds a phone to the ear', buecken: 'bends forward', hocken: 'crouches', knien: 'kneels down', knien_einseitig: 'goes down on one knee', liegen: 'lies down on the back', liegen_seite: 'lies down on the side' },
    move: (v) => (v >= 2.5 ? 'runs' : v >= 1.8 ? 'jogs' : v >= 1 ? 'walks' : 'walks slowly'), to: ', ending', relax: 'lowers the arms', back: ' backwards', reachDoor: 'reaches for the door', looksAt: 'looks at', ahead: 'looks straight ahead', cam: 'the camera', door: 'the door',
    doorOpen: 'The open door is', doorShut: 'The closed door is', opens: 'the door opens', closes: 'the door closes', none: 'Nobody moves.',
  },
  de: {
    colors: { '#d42a2a': 'Rot', '#1f5bd8': 'Blau', '#f2c418': 'Gelb', '#1e9e4a': 'Grün', '#f2761d': 'Orange', '#7b3fd1': 'Violett', '#e0409a': 'Pink', '#17a3b8': 'Türkis' },
    head: (fmt, dur, focal, y) => `${fmt}, ${dur} s, Brennweite ${focal} mm, Kamera auf ${y} m Höhe.`,
    labels: 'Die farbigen Gliederpuppen im Aufstellungsbild sind Platzhalter und dürfen im Video nicht vorkommen. Ihre Farben sind nur Kennzeichen, keine Kleidungsfarben:',
    openT: 'Anfangsbild, aus Kamerasicht:', endT: 'Ende des Shots, aus Kamerasicht:', actT: 'Was geschieht:',
    still: 'Die Kamera bewegt sich nicht.', pan: { l: 'Die Kamera schwenkt nach links.', r: 'Die Kamera schwenkt nach rechts.' }, moveIn: 'Die Kamera fährt näher heran.', moveOut: 'Die Kamera fährt zurück.', moveSide: 'Die Kamera fährt seitlich.',
    x: { l: 'links', c: 'in der Mitte', r: 'rechts' }, z: { n: 'im Vordergrund', m: 'im Mittelgrund', f: 'im Hintergrund' },
    out: 'außerhalb des Bildes', self: { cam: 'schaut zur Kamera', back: 'mit dem Rücken zur Kamera', l: 'schaut nach links', r: 'schaut nach rechts' },
    held: { stehen: 'stehend', sitzen: 'sitzend', arme: 'mit verschränkten Armen', zeigen: 'zeigt mit dem rechten Arm', handgelenk: 'schaut aufs Handgelenk', hand_heben: 'hebt die rechte Hand', greifen: 'greift mit der rechten Hand', telefonieren: 'telefoniert', buecken: 'vorgebeugt', hocken: 'hockend', knien: 'kniend', knien_einseitig: 'auf einem Knie', liegen: 'auf dem Rücken liegend', liegen_seite: 'auf der Seite liegend' },
    verb: { stehen: 'steht auf', sitzen: 'setzt sich', arme: 'verschränkt die Arme', zeigen: 'zeigt mit dem rechten Arm', handgelenk: 'schaut aufs Handgelenk', hand_heben: 'hebt die rechte Hand', greifen: 'greift mit der rechten Hand', telefonieren: 'nimmt das Telefon ans Ohr', buecken: 'beugt sich vor', hocken: 'geht in die Hocke', knien: 'kniet sich hin', knien_einseitig: 'geht auf ein Knie', liegen: 'legt sich auf den Rücken', liegen_seite: 'legt sich auf die Seite' },
    move: (v) => (v >= 2.5 ? 'rennt' : v >= 1.8 ? 'läuft' : v >= 1 ? 'geht' : 'geht langsam'), to: ', am Ende', relax: 'nimmt die Arme herunter', back: ' rückwärts', reachDoor: 'greift zur Tür', looksAt: 'schaut zu', ahead: 'schaut geradeaus', cam: 'die Kamera', door: 'die Tür',
    doorOpen: 'Die offene Tür ist', doorShut: 'Die geschlossene Tür ist', opens: 'die Tür geht auf', closes: 'die Tür geht zu', none: 'Niemand bewegt sich.',
  },
};

// Lage eines Punkts im Kamerabild, oder null, wenn er nicht im Bild ist
function inFrame(cam, p) {
  if (p.clone().applyMatrix4(cam.matrixWorldInverse).z >= 0) return null;
  const v = p.clone().project(cam);
  return Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 ? v : null;
}

function placeWords(w, cam, points) {
  const v = points.map((p) => inFrame(cam, p)).find(Boolean);
  if (!v) return null;
  const d = cam.position.distanceTo(points[0]);
  return { x: w.x[v.x < -0.33 ? 'l' : v.x > 0.33 ? 'r' : 'c'], z: w.z[d < 2.2 ? 'n' : d > 4 ? 'f' : 'm'] };
}

// Blick und Lage aller Figuren zu einem Zeitpunkt
function snapshot(app, t, w) {
  const { world } = app;
  const { set } = app.state.project;
  world.update(app, t);
  const cam = world.shotCamera;
  cam.updateMatrixWorld();
  const right = new THREE.Vector3(1, 0, 0).transformDirection(cam.matrixWorld);
  const out = new Map();
  for (const f of set.figures) {
    const man = world.mannequins.get(f.id);
    const st = app.shot.figs[f.id];
    if (!man || !st) continue;
    const head = man.joints.neck.getWorldPosition(new THREE.Vector3());
    const hips = man.joints.hips.getWorldPosition(new THREE.Vector3());
    const place = placeWords(w, cam, [head, hips]);
    const front = new THREE.Vector3(0, 0, 1).transformDirection(man.root.matrixWorld).setY(0).normalize();
    const toCam = cam.position.clone().sub(hips).setY(0).normalize();
    const c = front.dot(toCam);
    const self = c > 0.7 ? w.self.cam : c < -0.7 ? w.self.back : front.dot(right) < 0 ? w.self.l : w.self.r;
    const ev = evalFigure(st, t);
    out.set(f.id, { place, self, pose: ev.pose, side: ev.side });
  }
  return out;
}

// Die Wörter nennen die rechte Seite, sie gelten sinngemäß für links
const sided = (text, side) => (side === 'links' ? text.replace('right', 'left').replace('rechten', 'linken').replace('rechte', 'linke') : text);

function lineFor(w, f, s) {
  if (!s.place) return `- ${f.name}: ${w.out}`;
  return `- ${f.name}: ${s.place.x}, ${s.place.z}, ${sided(w.held[s.pose] || s.pose, s.side)}, ${s.self}`;
}

function cameraLine(w, shot) {
  const c = shot.camera;
  if (!c.keys.length && !c.aim) return w.still;
  const a = evalCamera(c, 0), b = evalCamera(c, shot.duration);
  const out = [];
  const pan = ((b.pan - a.pan + 540) % 360) - 180;
  if (Math.abs(pan) > 3) out.push(w.pan[pan < 0 ? 'l' : 'r']);
  const dx = b.x - a.x, dz = b.z - a.z;
  if (Math.hypot(dx, dz) > 0.1) {
    const fwd = dx * Math.sin(a.pan * DEG) - dz * Math.cos(a.pan * DEG);
    out.push(Math.abs(fwd) < 0.05 ? w.moveSide : fwd > 0 ? w.moveIn : w.moveOut);
  }
  return out.join(' ') || w.still;
}

export function promptText(app, lang) {
  const w = WORDS[lang];
  const num = (v) => { const t = String(Math.round(v * 10) / 10); return lang === 'de' ? t.replace('.', ',') : t; };
  const { set } = app.state.project;
  const shot = app.shot;
  const figs = set.figures.filter((f) => shot.figs[f.id]);
  const first = snapshot(app, 0, w);
  const openCam = evalCamera(shot.camera, 0);
  const doors = set.openings.filter((o) => o.kind === 'tuer').map((o) => {
    const wall = set.walls.find((x) => x.id === o.wall);
    if (!wall) return null;
    const L = Math.hypot(wall.b.x - wall.a.x, wall.b.z - wall.a.z) || 1;
    const k = o.offset / L;
    const p = new THREE.Vector3(wall.a.x + (wall.b.x - wall.a.x) * k, 1, wall.a.z + (wall.b.z - wall.a.z) * k);
    const place = placeWords(w, app.world.shotCamera, [p]);
    const open = o.type === 'loch' || doorValue(o, shot, 0) > 2;
    return `${open ? w.doorOpen : w.doorShut} ${place ? `${place.x}, ${place.z}` : w.out}.`;
  }).filter(Boolean);
  const last = snapshot(app, shot.duration, w);

  const acts = [];
  const span = (a, b) => (b > a ? `${num(a)}–${num(b)} s` : `${num(a)} s`);
  const name = (id) => set.figures.find((f) => f.id === id)?.name;
  for (const f of figs) {
    const st = shot.figs[f.id];
    for (const s of stepsOf(st)) {
      const end = Math.min(s.t1, shot.duration);
      if (s.type === 'gehen') {
        const speed = pathLength(walkPoints(st, s)) / Math.max(0.01, s.t1 - s.t);
        const at = snapshot(app, end, w).get(f.id)?.place;
        acts.push({ t: s.t, text: `${span(s.t, end)}: ${f.name} ${w.move(speed)}${evalFigure(st, (s.t + end) / 2).dist < 0 ? w.back : ''}${at ? `${w.to} ${at.x}, ${at.z}` : ''}` });
      } else if (s.pose && !s.quiet) {
        // „stehen“ ist nach dem Sitzen ein Aufstehen, sonst nimmt die Figur nur die Arme herunter
        const plain = s.pose === 'stehen' && poseInfo(evalFigure(st, s.t - 0.01).pose).upright;
        acts.push({ t: s.t, text: `${span(s.t, end)}: ${f.name} ${s.door ? w.reachDoor : plain ? w.relax : sided(w.verb[s.pose] || s.pose, s.side)}` });
      }
    }
    for (const k of st.looks || []) {
      const target = k.at === 'cam' ? w.cam : k.at.startsWith('op:') ? w.door : name(k.at);
      acts.push({ t: k.t, text: `${num(k.t)} s: ${f.name} ${target ? `${w.looksAt} ${target}` : w.ahead}` });
    }
  }
  for (const [id, d] of Object.entries(shot.doors || {})) {
    if (d.from !== d.to && set.openings.some((o) => o.id === id)) acts.push({ t: d.t0, text: `${span(d.t0, d.t1)}: ${d.to > d.from ? w.opens : w.closes}` });
  }
  acts.sort((a, b) => a.t - b.t);

  app.world.update(app, app.state.time);
  return [
    w.head(shot.format, num(shot.duration), Math.round(openCam.focal), num(openCam.y)),
    cameraLine(w, shot),
    '',
    w.labels,
    ...figs.map((f) => `- ${w.colors[f.color.toLowerCase()] || f.color} = ${f.name}`),
    '',
    w.openT,
    ...figs.map((f) => lineFor(w, f, first.get(f.id))),
    ...doors,
    '',
    w.actT,
    ...(acts.length ? acts.map((a) => `- ${a.text}`) : [w.none]),
    '',
    w.endT,
    ...figs.map((f) => lineFor(w, f, last.get(f.id))),
  ].join('\n');
}
