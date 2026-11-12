#!/usr/bin/env python3
"""Tiny static dev server with caching disabled (so edited ES modules always reload).
Usage: python3 scripts/serve.py [port] [--public]   then open http://localhost:8642
  --public  listen on all interfaces (for LAN / router port-forward). Dotfiles (.git, .claude, ...)
            are hidden and the /__shot dev helper only accepts requests from this machine.
"""
import http.server, socketserver, sys, os

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
PUBLIC = '--public' in sys.argv[1:]
PORT = int(ARGS[0]) if ARGS else 8642
HOST = '0.0.0.0' if PUBLIC else '127.0.0.1'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
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
        super().do_GET()

    def do_HEAD(self):
        if self._hidden(): self.send_error(404); return
        super().do_HEAD()

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
    print(f'THE LAST HOOLIGAN dev server on http://localhost:{PORT}' + (' (public: all interfaces)' if PUBLIC else ''))
    httpd.serve_forever()
