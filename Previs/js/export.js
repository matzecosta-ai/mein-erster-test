// Export: Vorschauvideo (MP4), Standbild (PNG), Projektdatei (JSON).
import * as THREE from 'three';
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { formatAspect } from './model.js';
import { renderShot } from './camview.js';

// Muss direkt aus einem Klick heraus laufen, sonst blockieren manche Browser (Safari) den Download
export function downloadUrl(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// Speichert über den lokalen Previs-Server direkt in previs/Exporte bzw. previs/Projekte.
// Gibt null zurück, wenn das nicht geht (dann bleibt nur der Browser-Download).
export async function saveToDisk(blob, name, kind) {
  try {
    const res = await fetch(`api/save?kind=${kind}&name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'X-Previs': '1', 'Content-Type': 'application/octet-stream' },
      body: blob,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function reveal(path) {
  return fetch('api/reveal', { method: 'POST', headers: { 'X-Previs': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
}

const safeName = (s) => String(s).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'previs';

function outputSize(format, shortSide) {
  const aspect = formatAspect(format);
  const even = (v) => Math.max(2, Math.round(v / 2) * 2);
  return aspect >= 1 ? { w: even(shortSide * aspect), h: even(shortSide) } : { w: even(shortSide), h: even(shortSide / aspect) };
}

function offscreen(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return { canvas, renderer };
}

export async function exportPng(app, shortSide, { empty = false } = {}) {
  app.clearMarks(); // keine rote Markierung im Export
  const { w, h } = outputSize(app.shot.format, shortSide);
  const { canvas, renderer } = offscreen(w, h);
  app.world.update(app, app.state.time);
  app.world.figGroup.visible = !empty; // leerer Raum: gleiche Kamera, keine Figuren
  renderShot(app, renderer);
  app.world.figGroup.visible = true;
  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  renderer.dispose();
  const t = app.state.time.toFixed(1).replace('.', ',');
  return { blob, dataUrl, name: `${safeName(app.state.project.name)} - ${safeName(app.shot.name)} - ${t}s${empty ? ' - leer' : ''}.png` };
}

async function pickCodec(w, h, fps) {
  const bitrate = Math.round(Math.min(12e6, w * h * fps * 0.12));
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.42001f']) {
    const config = { codec, width: w, height: h, bitrate, framerate: fps };
    try {
      const res = await VideoEncoder.isConfigSupported(config);
      if (res.supported) return config;
    } catch { /* nächsten Codec probieren */ }
  }
  return null;
}

export async function serverInfo() {
  try {
    const res = await fetch('api/info', { cache: 'no-store' });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function post(url, body, type = 'application/octet-stream') {
  const res = await fetch(url, { method: 'POST', headers: { 'X-Previs': '1', 'Content-Type': type }, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server antwortet mit ${res.status}`);
  return data;
}

// Bevorzugt: Einzelbilder an den lokalen Server, ffmpeg baut das MP4 (geht in jedem Browser).
// Sonst: der Videoencoder des Browsers (klappt in Chrome, in Safari nicht zuverlässig).
export async function exportVideo(app, shortSide, onProgress) {
  app.clearMarks(); // keine rote Markierung im Export
  const shot = app.shot;
  const fps = shot.fps;
  const frames = Math.max(1, Math.round(shot.duration * fps));
  const { w, h } = outputSize(shot.format, shortSide);
  const name = `${safeName(app.state.project.name)} - ${safeName(shot.name)}.mp4`;
  const info = await serverInfo();
  if (info?.ffmpeg) return exportWithFfmpeg(app, { w, h, fps, frames, name }, onProgress);
  return exportWithWebCodecs(app, { w, h, fps, frames, name }, onProgress);
}

async function exportWithFfmpeg(app, { w, h, fps, frames, name }, onProgress) {
  const { canvas, renderer } = offscreen(w, h);
  const keep = app.state.time;
  const { job } = await post(`api/video/start?name=${encodeURIComponent(name)}&fps=${fps}`);
  try {
    for (let i = 0; i < frames; i++) {
      app.world.update(app, i / fps);
      renderShot(app, renderer);
      const jpeg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
      await post(`api/video/frame?job=${job}`, jpeg);
      onProgress?.(i / frames);
    }
    onProgress?.(1, 'ffmpeg schreibt das Video …');
    const saved = await post(`api/video/finish?job=${job}`);
    return { saved, url: `${saved.folder}/${encodeURIComponent(saved.name)}`, name: saved.name, w, h, frames };
  } catch (err) {
    post(`api/video/cancel?job=${job}`).catch(() => {});
    throw err;
  } finally {
    renderer.dispose();
    app.world.update(app, keep);
  }
}

async function exportWithWebCodecs(app, { w, h, fps, frames, name }, onProgress) {
  if (!('VideoEncoder' in window)) throw new Error('Dieser Browser kann kein MP4 erzeugen. Starte Previs neu über „Previs starten“, dann übernimmt ffmpeg.');
  const config = await pickCodec(w, h, fps);
  if (!config) throw new Error(`Für ${w} × ${h} gibt es hier keinen passenden H.264-Encoder.`);

  const { canvas, renderer } = offscreen(w, h);
  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' });
  let failure = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failure = e; } });
  encoder.configure(config);
  const keep = app.state.time;
  try {
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      app.world.update(app, i / fps);
      renderShot(app, renderer);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 8 || i % 6 === 0) {
        onProgress?.(i / frames);
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    onProgress?.(1, 'Video wird abgeschlossen …');
    // Safari bleibt hier manchmal hängen: nach 20 Sekunden abbrechen statt einzufrieren
    await Promise.race([
      encoder.flush(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Der Videoencoder des Browsers antwortet nicht. Starte Previs neu über „Previs starten“, dann übernimmt ffmpeg.')), 20000)),
    ]);
    if (failure) throw failure;
    muxer.finalize();
  } finally {
    if (encoder.state !== 'closed') encoder.close();
    renderer.dispose();
    app.world.update(app, keep);
  }
  const blob = new Blob([muxer.target.buffer], { type: 'video/mp4' });
  return { blob, name, w, h, frames };
}

export function projectFile(app) {
  const json = JSON.stringify(app.state.project, null, 2);
  return { blob: new Blob([json], { type: 'application/json' }), name: `${safeName(app.state.project.name)}.previs.json` };
}
