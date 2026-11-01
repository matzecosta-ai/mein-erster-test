# Kleiner lokaler Webserver für Previs.
# - liefert die App ohne Cache aus, damit Änderungen sofort sichtbar sind
# - speichert Videos, Bilder und Projekte direkt in Ordner neben der App,
#   weil Browser wie Safari Downloads aus einer Web-App oft blockieren
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import urllib.parse
import uuid

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8173
ROOT = os.path.dirname(os.path.abspath(__file__))
FOLDERS = {'export': 'Exporte', 'project': 'Projekte'}
ALLOWED = {'.mp4', '.png', '.json'}
MAX_BYTES = 2 * 1024 * 1024 * 1024
WINDOWS = sys.platform == 'win32'
# Windows: Eine ffmpeg.exe direkt neben dieser Datei reicht, eine Installation ist dann nicht nötig
FFMPEG = shutil.which('ffmpeg') or next((p for p in (os.path.join(ROOT, 'ffmpeg.exe'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg') if os.path.exists(p)), None)
JOBS = {}
JOBS_LOCK = threading.Lock()


def safe_name(name):
    name = os.path.basename(name).strip()
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', '-', name)
    return name[:180] or 'previs'


def unique(path):
    if not os.path.exists(path):
        return path
    base, ext = os.path.splitext(path)
    i = 2
    while os.path.exists(f'{base} ({i}){ext}'):
        i += 1
    return f'{base} ({i}){ext}'


def inside_folders(path):
    real = os.path.realpath(path)
    for folder in FOLDERS.values():
        root = os.path.realpath(os.path.join(ROOT, folder))
        if real.startswith(root + os.sep):
            return True
    return False


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.mjs': 'text/javascript'}

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass

    def reply(self, status, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if urllib.parse.urlparse(self.path).path == '/api/info':
            return self.reply(200, {'version': 2, 'save': True, 'ffmpeg': bool(FFMPEG)})
        return super().do_GET()

    def read_body(self, length):
        return self.rfile.read(length) if length > 0 else b''

    # Video: Einzelbilder (JPEG) kommen nacheinander, ffmpeg baut daraus ein MP4
    def video(self, action, query, length):
        if not FFMPEG:
            return self.reply(500, {'error': 'ffmpeg fehlt'})
        if action == 'start':
            name = safe_name(query.get('name', ['previs.mp4'])[0])
            if not name.lower().endswith('.mp4'):
                name += '.mp4'
            fps = max(1, min(120, int(float(query.get('fps', ['30'])[0]))))
            target_dir = os.path.join(ROOT, FOLDERS['export'])
            os.makedirs(target_dir, exist_ok=True)
            path = unique(os.path.join(target_dir, name))
            log = open(os.path.join(target_dir, '.ffmpeg.log'), 'wb')
            proc = subprocess.Popen(
                [FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', str(fps),
                 '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                 '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv',
                 '-movflags', '+faststart', path],
                stdin=subprocess.PIPE, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW if WINDOWS else 0)
            job = uuid.uuid4().hex
            with JOBS_LOCK:
                JOBS[job] = {'proc': proc, 'path': path, 'log': log}
            return self.reply(200, {'job': job})
        with JOBS_LOCK:
            info = JOBS.get(query.get('job', [''])[0])
        if not info:
            return self.reply(404, {'error': 'unknown job'})
        proc = info['proc']
        if action == 'frame':
            try:
                proc.stdin.write(self.read_body(length))
            except OSError:  # auf dem Mac BrokenPipeError, unter Windows ein allgemeinerer Fehler
                return self.reply(500, {'error': 'ffmpeg abgebrochen'})
            return self.reply(200, {'ok': True})
        if action in ('finish', 'cancel'):
            with JOBS_LOCK:
                JOBS.pop(query.get('job', [''])[0], None)
            if action == 'cancel':
                proc.kill()
                info['log'].close()
                if os.path.exists(info['path']):
                    os.remove(info['path'])
                return self.reply(200, {'ok': True})
            proc.stdin.close()
            code = proc.wait(timeout=600)
            info['log'].close()
            if code != 0 or not os.path.exists(info['path']):
                return self.reply(500, {'error': f'ffmpeg Fehler {code}'})
            return self.reply(200, {'path': info['path'], 'name': os.path.basename(info['path']), 'folder': FOLDERS['export']})
        return self.reply(404, {'error': 'not found'})

    def do_POST(self):
        # Nur die eigene Seite darf speichern: eigener Header und passende Herkunft
        if self.headers.get('X-Previs') != '1':
            return self.reply(403, {'error': 'forbidden'})
        origin = self.headers.get('Origin')
        if origin and urllib.parse.urlparse(origin).hostname not in ('127.0.0.1', 'localhost'):
            return self.reply(403, {'error': 'forbidden'})
        url = urllib.parse.urlparse(self.path)
        query = urllib.parse.parse_qs(url.query)
        length = int(self.headers.get('Content-Length') or 0)

        if url.path == '/api/save':
            kind = query.get('kind', ['export'])[0]
            folder = FOLDERS.get(kind)
            name = safe_name(query.get('name', [''])[0])
            if not folder or os.path.splitext(name)[1].lower() not in ALLOWED:
                return self.reply(400, {'error': 'bad name'})
            if length <= 0 or length > MAX_BYTES:
                return self.reply(413, {'error': 'bad size'})
            target_dir = os.path.join(ROOT, folder)
            os.makedirs(target_dir, exist_ok=True)
            path = os.path.join(target_dir, name)
            if kind == 'export':
                path = unique(path)
            remaining = length
            with open(path, 'wb') as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 1024 * 1024))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)
            return self.reply(200, {'path': path, 'name': os.path.basename(path), 'folder': folder})

        if url.path.startswith('/api/video/'):
            return self.video(url.path.rsplit('/', 1)[1], query, length)

        if url.path == '/api/reveal':
            body = json.loads(self.rfile.read(length) or b'{}') if length else {}
            path = body.get('path', '')
            if not path or not os.path.exists(path) or not inside_folders(path):
                return self.reply(400, {'error': 'bad path'})
            subprocess.Popen(['explorer', '/select,', os.path.normpath(path)] if WINDOWS else ['open', '-R', path])
            return self.reply(200, {'ok': True})

        return self.reply(404, {'error': 'not found'})


os.chdir(ROOT)
print(f'Previs läuft auf http://127.0.0.1:{PORT}/', flush=True)
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
