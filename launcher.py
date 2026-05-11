#!/usr/bin/env python3
"""
CList desktop launcher — stdlib only.

Starts a local HTTP server on a random port bound to 127.0.0.1, opens
CList at http://localhost:PORT in the default browser, and proxies OAuth
token exchanges and kvstore API calls so no CORS configuration is needed.

http://localhost is treated as a secure context by all major browsers
(SubtleCrypto, etc. all work), and Firefox's HTTPS-Only mode exempts it,
so no TLS certificates are required.

Usage:
    python launcher.py [--kvstore URL]

Options:
    --kvstore URL   Base URL of the kvstore server to use.
                    Defaults to the CLIST_KVSTORE_URL environment variable,
                    or https://kvstore.mooc.ca if neither is set.

Build (run from the project root, requires PyInstaller):
    pyinstaller --onefile --noconsole launcher.py
"""

import http.server
import socketserver
import threading
import webbrowser
import json
import urllib.request
import urllib.parse
import urllib.error
import sys
import os
import socket
import argparse
import time


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description='CList desktop launcher')
    parser.add_argument('--kvstore', default=None, help='kvstore base URL')
    return parser.parse_args()


def get_base_dir():
    """Return the directory that contains the app files."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return s.getsockname()[1]


args     = parse_args()
BASE_DIR = get_base_dir()
PORT     = find_free_port()
BASE_URL = f'http://localhost:{PORT}'

KVSTORE_URL = (
    args.kvstore
    or os.environ.get('CLIST_KVSTORE_URL')
    or 'https://kvstore.mooc.ca'
)

KVSTORE_PREFIX = '/kvstore-api'


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------

class CListHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/runtime-config.js':
            self._serve_runtime_config()
        elif path.startswith(KVSTORE_PREFIX + '/') or path == KVSTORE_PREFIX:
            self._handle_kvstore_proxy()
        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split('?')[0]
        if path == '/oauth/token':
            self._handle_token_exchange()
        elif path.startswith(KVSTORE_PREFIX + '/') or path == KVSTORE_PREFIX:
            self._handle_kvstore_proxy()
        else:
            self.send_error(404, 'Not found')

    def do_DELETE(self):
        path = self.path.split('?')[0]
        if path.startswith(KVSTORE_PREFIX + '/') or path == KVSTORE_PREFIX:
            self._handle_kvstore_proxy()
        else:
            self.send_error(404, 'Not found')

    def do_OPTIONS(self):
        path = self.path.split('?')[0]
        if path.startswith(KVSTORE_PREFIX + '/') or path == KVSTORE_PREFIX:
            self._handle_kvstore_proxy()
        else:
            self.send_error(404, 'Not found')

    def _serve_runtime_config(self):
        """Return a JS snippet that sets window._launcherConfig and installs a kvstore fetch proxy."""
        proxy_base = json.dumps(BASE_URL + KVSTORE_PREFIX)
        js = (
            f'window._launcherConfig = {{'
            f' kvstoreUrl: {json.dumps(KVSTORE_URL)},'
            f' port: {PORT}'
            f' }};\n'
            # Intercept fetch calls to flaskSiteUrl and route them through the local proxy,
            # avoiding CORS restrictions without changing any kvstore call sites.
            # X-Kvstore-Target tells the proxy which upstream server to forward to,
            # so changing flaskSiteUrl (server switch) is transparently picked up.
            '(function(){\n'
            f'  var _proxy={proxy_base};\n'
            '  var _real=window.fetch;\n'
            '  window.fetch=function fetchWithKvstoreProxy(input,init){\n'
            '    try{\n'
            '      var url=typeof input==="string"?input:(input instanceof Request?input.url:String(input));\n'
            '      var up=typeof flaskSiteUrl==="string"&&flaskSiteUrl.startsWith("http")?flaskSiteUrl:null;\n'
            '      if(up&&(url.startsWith(up+"/")||url===up)){\n'
            '        var hdrs=new Headers((init&&init.headers)||{});\n'
            '        hdrs.set("X-Kvstore-Target",up);\n'
            '        return _real(_proxy+url.slice(up.length),Object.assign({},init,{headers:hdrs}));\n'
            '      }\n'
            '    }catch(_){}\n'
            '    return _real(input,init);\n'
            '  };\n'
            '})();\n'
        )
        content = js.encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/javascript')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(content)

    def _handle_token_exchange(self):
        """
        Proxy the OAuth authorization-code → token exchange.

        The browser cannot POST directly to Mastodon's token endpoint because
        Mastodon does not send CORS headers for cross-origin token requests.
        This endpoint receives the exchange parameters as JSON and forwards
        them to the provider as application/x-www-form-urlencoded, returning
        the provider's JSON response verbatim.
        """
        try:
            length   = int(self.headers.get('Content-Length', 0))
            body     = self.rfile.read(length)
            params   = json.loads(body)

            token_url = params['instanceUrl'] + params['tokenPath']
            post_fields = {
                'grant_type':   'authorization_code',
                'code':         params['code'],
                'redirect_uri': params['redirectUri'],
                'client_id':    params['clientId'],
            }
            if params.get('clientSecret'):
                post_fields['client_secret'] = params['clientSecret']
            if params.get('codeVerifier'):
                post_fields['code_verifier'] = params['codeVerifier']

            post_data = urllib.parse.urlencode(post_fields).encode()
            req = urllib.request.Request(
                token_url,
                data=post_data,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_body = resp.read()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except Exception as e:
            error_body = json.dumps({'error': str(e)}).encode()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_body)))
            self.end_headers()
            self.wfile.write(error_body)

    def _handle_kvstore_proxy(self):
        """
        Proxy all kvstore API requests to the upstream kvstore server.

        The browser talks to http://localhost:PORT/kvstore-api/... (same origin,
        so no CORS restriction), and the launcher forwards each request to
        KVSTORE_URL/... server-side where CORS does not apply.
        """
        # X-Kvstore-Target lets the JS tell us which upstream to forward to,
        # so the user can switch kvstore servers without bypassing the proxy.
        upstream   = self.headers.get('X-Kvstore-Target', '').strip() or KVSTORE_URL
        tail       = self.path[len(KVSTORE_PREFIX):]
        target_url = upstream + tail

        length = int(self.headers.get('Content-Length', 0))
        body   = self.rfile.read(length) if length > 0 else None

        forward_headers = {}
        for h in ('Authorization', 'Content-Type'):
            v = self.headers.get(h)
            if v:
                forward_headers[h] = v
        # X-Kvstore-Target is consumed here — not forwarded to the upstream server

        req = urllib.request.Request(
            target_url,
            data=body,
            headers=forward_headers,
            method=self.command,
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_body    = resp.read()
                content_type = resp.headers.get('Content-Type', 'application/json')
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)

        except Exception as e:
            error_body = json.dumps({'error': str(e)}).encode()
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(error_body)))
            self.end_headers()
            self.wfile.write(error_body)

    def log_message(self, format, *args):
        pass  # suppress per-request logging to keep the console clean


# ---------------------------------------------------------------------------
# Server startup
# ---------------------------------------------------------------------------

def wait_for_server(url, timeout=5.0):
    """Poll until the server is accepting connections."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url + '/runtime-config.js', timeout=1)
            return True
        except Exception:
            time.sleep(0.05)
    return False


def main():
    server = socketserver.TCPServer(('127.0.0.1', PORT), CListHandler)
    server.allow_reuse_address = True

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    if not wait_for_server(BASE_URL):
        if sys.stderr:
            print('Warning: server did not start within 5 seconds', file=sys.stderr)

    port_file = os.path.join(BASE_DIR, '.launcher-port')
    with open(port_file, 'w') as f:
        f.write(str(PORT))

    print(f'CList running at {BASE_URL}')
    print(f'kvstore: {KVSTORE_URL}')
    print('Press Ctrl+C to stop.')
    if sys.stdout:
        sys.stdout.flush()

    webbrowser.open(BASE_URL)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nShutting down.')
        server.shutdown()


if __name__ == '__main__':
    main()
