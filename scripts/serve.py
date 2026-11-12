#!/usr/bin/env python3
"""Tiny static dev server with caching disabled (so edited ES modules always reload).
Usage: python3 scripts/serve.py [port]   then open http://localhost:8642
"""
import http.server, socketserver, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()
    def log_message(self, *a):
        pass

    # dev helper: POST a PNG data URL to /__shot?name=foo -> build/shots/foo.png (localhost only)
    def do_POST(self):
        import base64, urllib.parse, re
        u = urllib.parse.urlparse(self.path)
        if u.path != '/__shot':
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

with Server(('127.0.0.1', PORT), Handler) as httpd:
    print(f'THE LAST HOOLIGAN dev server on http://localhost:{PORT}')
    httpd.serve_forever()
