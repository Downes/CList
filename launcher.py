#!/usr/bin/env python3
"""
CList desktop launcher — stdlib only.

Starts a local HTTP server on a random port bound to 127.0.0.1, opens
CList in the default browser, and proxies OAuth token exchanges and kvstore
API calls so no CORS configuration is needed.

On Windows and macOS the launcher sets up a locally-trusted TLS certificate
(via bundled mkcert) on first run and serves over HTTPS. On Linux it falls
back to plain HTTP with instructions for manual cert setup.

Usage:
    python launcher.py [--kvstore URL]

Options:
    --kvstore URL   Base URL of the kvstore server to use.
                    Defaults to the CLIST_KVSTORE_URL environment variable,
                    or https://kvstore.mooc.ca if neither is set.

Build (run from the project root):
    Windows:  .\\build-windows.ps1
    macOS:    ./build-macos.sh
    Linux:    ./build-linux.sh
"""

import http.server
import socketserver
import threading
import webbrowser
import json
import urllib.request
import urllib.parse
import urllib.error
import ssl
import sys
import os
import platform
import subprocess
import shutil
import socket
import argparse
import time


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description='CList desktop launcher')
    parser.add_argument('--kvstore', default=None, help='kvstore base URL')
    parser.add_argument('--port', type=int, default=None, help='override the fixed port')
    return parser.parse_args()


def get_base_dir():
    """Return the directory that contains the app files."""
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))


# Fixed port so localStorage (login state, tour flag, etc.) persists across restarts.
# Power users can override with --port.
DEFAULT_PORT = 51888


def is_clist_running(base_url):
    """Return True if CList is already serving at base_url."""
    ctx = None
    if base_url.startswith('https'):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    try:
        kwargs = {'timeout': 2}
        if ctx:
            kwargs['context'] = ctx
        with urllib.request.urlopen(base_url + '/runtime-config.js', **kwargs) as resp:
            return b'_launcherConfig' in resp.read(512)
    except Exception:
        return False


args     = parse_args()
BASE_DIR = get_base_dir()
PORT     = args.port if args.port else DEFAULT_PORT
BASE_URL = None  # set in main() after TLS detection

KVSTORE_URL = (
    args.kvstore
    or os.environ.get('CLIST_KVSTORE_URL')
    or 'https://kvstore.mooc.ca'
)

KVSTORE_PREFIX = '/kvstore-api'


# ---------------------------------------------------------------------------
# TLS setup (Windows and macOS only; Linux gets plain HTTP with instructions)
# ---------------------------------------------------------------------------

def get_certs_dir():
    """Return the platform-appropriate user data directory for TLS certs."""
    system = platform.system()
    if system == 'Windows':
        base = os.environ.get('APPDATA', os.path.expanduser('~'))
        return os.path.join(base, 'CList', 'certs')
    elif system == 'Darwin':
        return os.path.join(
            os.path.expanduser('~'), 'Library', 'Application Support', 'CList', 'certs'
        )
    else:
        xdg = os.environ.get('XDG_CONFIG_HOME', os.path.expanduser('~/.config'))
        return os.path.join(xdg, 'clist', 'certs')


def get_mkcert_exe():
    """Find mkcert: bundled in the PyInstaller package, or on system PATH."""
    if getattr(sys, 'frozen', False):
        system = platform.system()
        name   = 'mkcert.exe' if system == 'Windows' else 'mkcert-darwin'
        path   = os.path.join(sys._MEIPASS, 'tools', name)
        if os.path.exists(path):
            return path
    return shutil.which('mkcert')


def _install_ca_firefox_windows(mkcert_exe):
    """
    Add the mkcert CA to every Firefox profile on Windows.

    The prebuilt mkcert Windows binary lacks built-in Firefox/NSS support, so
    we locate Firefox's own certutil.exe and drive it directly.
    """
    firefox_dirs = [
        r'C:\Program Files\Mozilla Firefox',
        r'C:\Program Files (x86)\Mozilla Firefox',
    ]
    certutil = next(
        (os.path.join(d, 'certutil.exe') for d in firefox_dirs
         if os.path.exists(os.path.join(d, 'certutil.exe'))),
        None
    )
    if not certutil:
        return

    result = subprocess.run([mkcert_exe, '-CAROOT'], capture_output=True, text=True)
    if result.returncode != 0:
        return
    ca_cert = os.path.join(result.stdout.strip(), 'rootCA.pem')
    if not os.path.exists(ca_cert):
        return

    profiles_base = os.path.join(
        os.environ.get('APPDATA', ''), 'Mozilla', 'Firefox', 'Profiles'
    )
    if not os.path.isdir(profiles_base):
        return

    for profile in os.listdir(profiles_base):
        profile_path = os.path.join(profiles_base, profile)
        if os.path.isdir(profile_path):
            subprocess.run([
                certutil, '-A',
                '-n', 'CList Local CA',
                '-t', 'CT,,',
                '-i', ca_cert,
                '-d', 'sql:' + profile_path,
            ], capture_output=True)


def setup_tls(certs_dir):
    """
    Generate TLS certs using mkcert on first run.
    Returns (certfile, keyfile) on success, or None on failure/Linux.
    """
    system = platform.system()
    if system == 'Linux':
        return None

    mkcert = get_mkcert_exe()
    if not mkcert:
        return None

    os.makedirs(certs_dir, exist_ok=True)
    certfile = os.path.join(certs_dir, 'localhost.pem')
    keyfile  = os.path.join(certs_dir, 'localhost-key.pem')

    if system == 'Darwin':
        os.chmod(mkcert, 0o755)

    # Install the local CA into the system trust store.
    # On Windows this writes to CURRENT_USER\Root (no admin needed).
    # On macOS this pops the standard keychain password dialog.
    result = subprocess.run([mkcert, '-install'], capture_output=True)
    if result.returncode != 0:
        return None

    # Windows: also import into Firefox, which the prebuilt binary can't do itself.
    if system == 'Windows':
        _install_ca_firefox_windows(mkcert)

    # Generate the cert for localhost / 127.0.0.1.
    result = subprocess.run([
        mkcert,
        '-cert-file', certfile,
        '-key-file',  keyfile,
        'localhost', '127.0.0.1',
    ], capture_output=True)

    if result.returncode != 0 or not os.path.exists(certfile):
        return None

    return certfile, keyfile


def get_or_create_certs():
    """
    Return (certfile, keyfile) for TLS, running first-run setup if needed.
    Returns None on Linux or if setup fails.
    """
    certs_dir = get_certs_dir()
    certfile  = os.path.join(certs_dir, 'localhost.pem')
    keyfile   = os.path.join(certs_dir, 'localhost-key.pem')

    if os.path.exists(certfile) and os.path.exists(keyfile):
        return certfile, keyfile

    return setup_tls(certs_dir)


def print_linux_tls_instructions():
    certs_dir = get_certs_dir()
    certfile  = os.path.join(certs_dir, 'localhost.pem')
    keyfile   = os.path.join(certs_dir, 'localhost-key.pem')
    print('Running over HTTP (no TLS certs found).')
    print('To enable HTTPS and unlock providers that require it (e.g. WordPress):')
    print('  1. Install mkcert: https://github.com/FiloSottile/mkcert#installation')
    print('  2. mkcert -install')
    print(f'  3. mkcert -cert-file "{certfile}" -key-file "{keyfile}" localhost 127.0.0.1')
    print('  4. Relaunch CList.')


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
            # Monkey-patch window.fetch to intercept kvstore calls and route them through
            # the local proxy, avoiding CORS restrictions without touching any call sites.
            # X-Kvstore-Target tells the proxy which upstream to forward to, so server-
            # switching (flaskSiteUrl changing at runtime) is transparently picked up.
            #
            # RISKS TO KNOW ABOUT:
            # 1. Fragile global: the patch references window.flaskSiteUrl by name. If that
            #    variable is ever renamed or moved out of global scope, the proxy silently
            #    stops working with no error.
            # 2. JS in a Python string: hard to syntax-highlight, read, or test. If this
            #    logic grows, extract it into js/launcher-proxy.js and have runtime-config.js
            #    activate it by checking window._launcherConfig.
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

        The browser talks to BASE_URL/kvstore-api/... (same origin, so no CORS
        restriction), and the launcher forwards each request to KVSTORE_URL/...
        server-side where CORS does not apply.
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
    ctx = None
    if url.startswith('https'):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    while time.time() < deadline:
        try:
            kwargs = {'timeout': 1}
            if ctx:
                kwargs['context'] = ctx
            urllib.request.urlopen(url + '/runtime-config.js', **kwargs)
            return True
        except Exception:
            time.sleep(0.05)
    return False


def main():
    global BASE_URL

    # Determine TLS availability and set BASE_URL accordingly.
    certs = get_or_create_certs()
    if certs:
        certfile, keyfile = certs
        BASE_URL = f'https://localhost:{PORT}'
    else:
        certfile = keyfile = None
        BASE_URL = f'http://localhost:{PORT}'
        if platform.system() == 'Linux':
            print_linux_tls_instructions()

    try:
        server = socketserver.TCPServer(('127.0.0.1', PORT), CListHandler)
    except OSError:
        # Port already in use — check if it's an existing CList instance.
        if is_clist_running(BASE_URL):
            print(f'CList is already running at {BASE_URL} — opening browser.')
            if sys.stdout:
                sys.stdout.flush()
            webbrowser.open(BASE_URL)
            return
        print(f'Port {PORT} is in use by another application.')
        print('CList uses a fixed port so your login state is remembered across restarts.')
        print(f'Please free port {PORT} and try again, or use --port to override.')
        if sys.stdout:
            sys.stdout.flush()
        sys.exit(1)

    server.allow_reuse_address = True

    if certfile and keyfile:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile, keyfile)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)

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
