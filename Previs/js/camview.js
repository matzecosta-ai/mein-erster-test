// Kamerablick: zeigt den Shot genau so, wie er exportiert wird, im gewählten Bildformat.
// Mit der Maus lässt sich die Kamera direkt im Bild führen.
import * as THREE from 'three';
import { formatAspect, evalCamera, ensureCamKey } from './model.js';
import { fmtM, fmtSec, fmtNum, normDeg, clamp, headingToDir } from './units.js';

const M_PER_PX = 0.01;
const round = (v, step) => Math.round(v / step) / Math.round(1 / step);

export class CamView {
  constructor(app, container) {
    this.app = app;
    this.el = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor('#101113');
    container.prepend(this.renderer.domElement);
    this.frame = container.querySelector('#camFrame');
    this.info = container.querySelector('#camInfo');
    this.size = { w: 0, h: 0 };
    this.frameH = 1;
    this.drag = null;

    const c = this.renderer.domElement;
    c.title = 'Ziehen: schwenken und neigen · ⇧ Ziehen: hoch, runter, seitlich · ⌥ Ziehen: vor und zurück · Scrollen: Brennweite';
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
  }

  onDown(e) {
    const app = this.app;
    if (e.button !== 0) return;
    app.pause();
    if (app.state.selection?.kind !== 'camera') app.select({ kind: 'camera' });
    // erst beim Bewegen entsteht ein Punkt, ein bloßer Klick ändert nichts
    this.drag = { x: e.clientX, y: e.clientY, orig: evalCamera(app.shot.camera, app.state.time), moved: false };
    this.el.classList.add('grabbing');
    try { this.renderer.domElement.setPointerCapture(e.pointerId); } catch { /* ältere Browser */ }
  }

  onMove(e) {
    const d = this.drag;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 2) return;
    d.moved = true;
    const cam = this.app.shot.camera;
    const k = ensureCamKey(cam, this.app.state.time);
    const o = d.orig;
    if (e.shiftKey) {
      // Kran und seitlich
      const right = headingToDir(o.pan + 90);
      k.y = Math.max(0.05, round(o.y - dy * M_PER_PX, 0.01));
      k.x = round(o.x + right.x * dx * M_PER_PX, 0.01);
      k.z = round(o.z + right.z * dx * M_PER_PX, 0.01);
    } else if (e.altKey) {
      // vor und zurück in Blickrichtung
      const fwd = headingToDir(o.pan);
      k.x = round(o.x + fwd.x * -dy * M_PER_PX, 0.01);
      k.z = round(o.z + fwd.z * -dy * M_PER_PX, 0.01);
    } else {
      if (cam.aim) {
        if (!d.warned) this.app.toast('Die Kamera folgt einer Figur. Stell rechts „Ausrichtung: Frei“ ein, um selbst zu schwenken.', 5000);
        d.warned = true;
        return;
      }
      const degPerPx = this.app.world.shotCamera.fov / this.frameH;
      k.pan = round(normDeg(o.pan + dx * degPerPx), 0.5);
      k.tilt = round(clamp(o.tilt - dy * degPerPx, -89, 89), 0.5);
    }
    this.app.live();
  }

  onUp() {
    const d = this.drag;
    this.drag = null;
    this.el.classList.remove('grabbing');
    if (d?.moved) this.app.commit('helpers');
  }

  onWheel(e) {
    e.preventDefault();
    const app = this.app;
    app.pause();
    if (app.state.selection?.kind !== 'camera') app.select({ kind: 'camera' });
    const k = ensureCamKey(app.shot.camera, app.state.time);
    k.focal = clamp(k.focal * Math.exp(-e.deltaY * 0.0015), 8, 300);
    app.live();
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      k.focal = Math.round(k.focal);
      app.commit('helpers');
    }, 350);
  }

  render() {
    const { world } = this.app;
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      this.renderer.setSize(w, h);
    }
    const shot = this.app.shot;
    const aspect = formatAspect(shot.format);
    const column = getComputedStyle(this.el.parentElement.parentElement).flexDirection === 'column';
    const flex = column ? (aspect >= 1 ? '0.8' : '1.3') : (aspect >= 1 ? '1' : '0.55');
    if (this.flex !== flex) { this.el.parentElement.style.flex = flex; this.flex = flex; }
    const pad = 10;
    let vw = w - 2 * pad, vh = vw / aspect;
    if (vh > h - 2 * pad) { vh = h - 2 * pad; vw = vh * aspect; }
    vw = Math.max(1, Math.floor(vw)); vh = Math.max(1, Math.floor(vh));
    const x = Math.floor((w - vw) / 2), y = Math.floor((h - vh) / 2);
    this.frameH = vh;

    this.renderer.setScissorTest(false);
    this.renderer.clear();
    this.renderer.setViewport(x, y, vw, vh);
    this.renderer.setScissor(x, y, vw, vh);
    this.renderer.setScissorTest(true);
    renderShot(this.app, this.renderer);
    this.renderer.setScissorTest(false);

    Object.assign(this.frame.style, { left: x + 'px', top: y + 'px', width: vw + 'px', height: vh + 'px' });
    const ce = world.camEval;
    if (ce) {
      this.info.textContent = `${shot.format} · ${Math.round(ce.focal)} mm · Höhe ${fmtM(ce.y)} · Neigung ${fmtNum(ce.tilt, 0)}° · ${fmtSec(this.app.state.time)}`;
    }
  }
}

// Rendert nur die Szene (Ebene 0) durch die Shot-Kamera, ohne Hilfslinien
export function renderShot(app, renderer) {
  const { world } = app;
  const gizmo = app.work?.gizmoHelper;
  const hidden = [...(world.camHidden || []), ...(gizmo ? [gizmo] : [])].filter((o) => o.visible);
  hidden.forEach((o) => { o.visible = false; });
  renderer.render(world.scene, world.shotCamera);
  hidden.forEach((o) => { o.visible = true; });
}
