#!/usr/bin/env python3
"""Tiny static dev server with caching disabled (so edited ES modules always reload).
Usage: python3 scripts/serve.py [port] [--public] [--root DIR]   then open http://localhost:8642
  --public    listen on all interfaces (for LAN / router port-forward). Dotfiles (.git, .claude, ...)
              are hidden and the /__shot dev helper only accepts requests from this machine.
              Over a slow uplink the full no-store reload is painful, so public mode instead lets the
              browser cache and revalidate (Last-Modified -> 304) and gzips JS/JSON/GLB/HTML/CSS/SVG.
  --root DIR  serve DIR instead of this checkout (e.g. another worktree).
"""
import argparse, email.utils, gzip, http.server, os

DEFAULT_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ap = argparse.ArgumentParser(description='THE LAST HOOLIGAN dev server')
ap.add_argument('port', nargs='?', type=int, default=8642)
ap.add_argument('--public', action='store_true')
ap.add_argument('--root', default=DEFAULT_ROOT)
OPTS = ap.parse_args()

PORT = OPTS.port
PUBLIC = OPTS.public
HOST = '0.0.0.0' if PUBLIC else '127.0.0.1'
ROOT = os.path.abspath(OPTS.root)

GZIP_EXT = {'.js', '.mjs', '.json', '.glb', '.gltf', '.bin', '.html', '.css', '.svg', '.txt'}
_gz_cache = {}  # abs path -> (mtime_ns, gzipped bytes)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        # public: cache but always revalidate (cheap 304s); local: never cache
        self.send_header('Cache-Control', 'no-cache' if PUBLIC else 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a):
        pass

    def _is_local(self):
        return self.client_address[0] in ('127.0.0.1', '::1')

    def _hidden(self):
        import urllib.parse
        parts = urllib.parse.unquote(urllib.parse.urlparse(self.path).path).split('/')
        return any(p.startswith('.') for p in parts if p)

    def do_GET(self):
        if self._hidden(): self.send_error(404); return
        if PUBLIC and self._send_gzipped(): return
        super().do_GET()

    def do_HEAD(self):
        if self._hidden(): self.send_error(404); return
        super().do_HEAD()

    def _send_gzipped(self):
        """Serve a compressible file gzipped (with 304 support). False = let the stock handler do it."""
        if 'gzip' not in self.headers.get('Accept-Encoding', ''):
            return False
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            if not self.path.split('?', 1)[0].endswith('/'):
                return False  # stock handler sends the trailing-slash redirect
            path = os.path.join(path, 'index.html')
        if os.path.splitext(path)[1].lower() not in GZIP_EXT or not os.path.isfile(path):
            return False
        st = os.stat(path)
        ims = self.headers.get('If-Modified-Since')
        if ims and 'If-None-Match' not in self.headers:
            try:
                if int(st.st_mtime) <= email.utils.parsedate_to_datetime(ims).timestamp():
                    self.send_response(304)
                    self.send_header('Last-Modified', self.date_time_string(st.st_mtime))
                    self.send_header('Vary', 'Accept-Encoding')
                    self.end_headers()
                    return True
            except (TypeError, ValueError, OverflowError):
                pass
        cached = _gz_cache.get(path)
        if not cached or cached[0] != st.st_mtime_ns:
            with open(path, 'rb') as f:
                cached = (st.st_mtime_ns, gzip.compress(f.read(), 6))
            _gz_cache[path] = cached
        body = cached[1]
        self.send_response(200)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Last-Modified', self.date_time_string(st.st_mtime))
        self.send_header('Vary', 'Accept-Encoding')
        self.end_headers()
        self.wfile.write(body)
        return True

    # dev helper: POST a PNG data URL to /__shot?name=foo -> build/shots/foo.png (localhost only)
    def do_POST(self):
        import base64, urllib.parse, re
        u = urllib.parse.urlparse(self.path)
        if u.path != '/__shot' or not self._is_local():
            self.send_error(404); return
        name = re.sub(r'[^a-zA-Z0-9_-]', '', urllib.parse.parse_qs(u.query).get('name', ['shot'])[0]) or 'shot'
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[-1])
        os.makedirs(os.path.join(ROOT, 'build', 'shots'), exist_ok=True)
        with open(os.path.join(ROOT, 'build', 'shots', name + '.png'), 'wb') as f: f.write(data)
        self.send_response(204); self.end_headers()

class Server(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 256

with Server((HOST, PORT), Handler) as httpd:
    print(f'THE LAST HOOLIGAN dev server on http://localhost:{PORT}'
          + (' (public: all interfaces, cached + gzip)' if PUBLIC else '')
          + (f'  root={ROOT}' if ROOT != DEFAULT_ROOT else ''))
    httpd.serve_forever()
