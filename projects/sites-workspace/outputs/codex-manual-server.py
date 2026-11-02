from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import json

ROOT = Path(__file__).resolve().parent
SHARED = Path('C:/Users/Administrator/CodexWork')
DOCS = {
    'workspace': SHARED / 'AGENTS.md',
    'handoff': SHARED / 'memory/GENTEAM_HANDOFF.md',
    'quality': SHARED / 'memory/MARU_DIRECTOR_COMMITMENT.md',
    'story': SHARED / 'memory/JONGGA_DRAMA_DECISIONS.md',
    'maru': SHARED / 'chat-studio/README.md',
}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host') not in ('127.0.0.1', '127.0.0.1:8787', 'localhost', 'localhost:8787'):
            self.send_error(403); return
        route = urlsplit(self.path).path
        if route == '/health':
            data, mime = json.dumps({'service':'codex-file-manual','version':1}).encode(), 'application/json'
        elif route in ('/', '/Codex.html'):
            data, mime = (ROOT / 'Codex.html').read_bytes(), 'text/html; charset=utf-8'
        elif route.startswith('/docs/') and route[6:] in DOCS:
            try: data = DOCS[route[6:]].read_bytes()
            except OSError: self.send_error(404); return
            mime = 'text/plain; charset=utf-8'
        else:
            self.send_error(404); return
        self.send_response(200)
        self.send_header('Content-Type',mime)
        self.send_header('Content-Length',str(len(data)))
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.end_headers()
        self.wfile.write(data)
    def log_message(self,*args): pass

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1',8787), Handler).serve_forever()
