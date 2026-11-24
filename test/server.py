"""Test server for ExtShim e2e tests.

/page?csp=<mode>&load=<url>&boot=<bundle>  sample page; csp modes: none, strict, noscript, tt, tt-none
/out/...      built artifacts (test/.out)
/examples/... raw example extensions
/dist/...     runtime builds
/samples/...  chrome-extensions-samples checkout (when present)
"""
import http.server
import os
import sys
import threading
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MOUNTS = {
    '/out/': os.path.join(ROOT, 'test', '.out'),
    '/examples/': os.path.join(ROOT, 'examples'),
    '/dist/': os.path.join(ROOT, 'dist'),
    '/samples/': '/tmp/chrome-extensions-samples',
    '/fixtures/': os.path.join(ROOT, 'test', '.fixtures'),
    '/testext/': os.path.join(ROOT, 'test'),
}
CSP = {
    'none': None,
    'strict': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; connect-src 'self'",
    'noscript': "default-src 'none'; script-src 'none'; style-src 'self'; img-src 'self'",
    'tt': "script-src 'self'; require-trusted-types-for 'script'; trusted-types extshim",
    'tt-none': "script-src 'self'; require-trusted-types-for 'script'; trusted-types 'none'",
}

PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>ExtShim test page</title>
{head}
</head><body>
<h1>Test page</h1>
<p id="p1">The quick brown fox jumps over the lazy dog. A fox is quick.</p>
<p id="p2">Another paragraph about the fox and the dog, with <a id="link" href="https://example.com/">a link</a>.</p>
<ul><li>alpha</li><li>beta fox</li><li>gamma</li></ul>
<img id="pic" src="/examples/highlighter-mv3/icons/icon48.png" alt="pic">
<input id="inp" placeholder="input">
{body}
</body></html>"""


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def translate_path(self, path):
        p = urllib.parse.urlparse(path).path
        for prefix, d in MOUNTS.items():
            if p.startswith(prefix):
                return os.path.join(d, urllib.parse.unquote(p[len(prefix):]))
        return os.path.join(ROOT, 'nonexistent')

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        if u.path == '/echo':
            import json as _json
            body = _json.dumps({'headers': {k.lower(): v for k, v in self.headers.items()}, 'query': {k: v[0] for k, v in urllib.parse.parse_qs(u.query, keep_blank_values=True).items()}, 'path': u.path}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if u.path in ('/page', '/page2'):
            q = urllib.parse.parse_qs(u.query)
            mode = q.get('csp', ['none'])[0]
            head = ''
            body = ''
            if mode != 'noscript':
                head += '<script src="/fixtures/page-global.js"></script>'
            for b in q.get('boot', []):
                body += f'<script src="{b}"></script>'
            for src in q.get('lib', []):
                head += f'<script src="{src}"></script>'
            html = PAGE.format(head=head, body=body).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            if CSP.get(mode):
                self.send_header('Content-Security-Policy', CSP[mode])
            self.send_header('Content-Length', str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        return super().do_GET()


def start(port=8765):
    os.makedirs(MOUNTS['/fixtures/'], exist_ok=True)
    with open(os.path.join(MOUNTS['/fixtures/'], 'page-global.js'), 'w') as f:
        f.write("window.pageGlobal = 'from-page'; var pageVar = 42; window.chrome = window.chrome || {};\n")
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    return srv


if __name__ == '__main__':
    start(int(sys.argv[1]) if len(sys.argv) > 1 else 8765)
    print('serving on http://127.0.0.1:8765/page')
    threading.Event().wait()
