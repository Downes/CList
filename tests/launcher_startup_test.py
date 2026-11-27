"""Exercise the launcher's actual server class without starting the application."""
import ast
import http.server
import http.client
import json
import pathlib
import threading
import unittest
import urllib.request


class LauncherStartupTest(unittest.TestCase):
    def test_assets_and_runtime_config_reuse_one_connection(self):
        base = pathlib.Path(__file__).resolve().parents[1]
        tree = ast.parse((base / 'launcher.py').read_text(encoding='utf-8'))
        nodes = [n for n in tree.body if isinstance(n, ast.ClassDef)
                 and n.name in ('CListServer', 'CListHandler')]
        scope = {'http': __import__('http'), 'BASE_DIR': str(base), 'json': json,
                 'KVSTORE_PREFIX': '/kvstore-api', 'PROXY_PREFIX': '/proxy',
                 'BASE_URL': 'https://localhost:51888', 'PORT': 51888,
                 'KVSTORE_URL': 'https://store.invalid'}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), 'launcher.py', 'exec'), scope)
        server = scope['CListServer'](('127.0.0.1', 0), scope['CListHandler'])
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=3)
        try:
            socket = None
            for path in ['/js/ui.js', '/runtime-config.js', '/js/kvstore.js']:
                connection.request('GET', path)
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.version, 11)
                body = response.read()
                self.assertEqual(len(body), int(response.getheader('Content-Length')))
                self.assertEqual(response.getheader('Cache-Control'), 'no-store')
                self.assertFalse(response.will_close)
                if socket is None:
                    socket = connection.sock
                self.assertIs(connection.sock, socket)
        finally:
            connection.close()
            server.shutdown()
            server.server_close()
            worker.join(2)

    def test_slow_request_does_not_block_other_assets(self):
        source = pathlib.Path(__file__).resolve().parents[1] / 'launcher.py'
        tree = ast.parse(source.read_text(encoding='utf-8'))
        node = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'CListServer')
        scope = {'http': __import__('http')}
        exec(compile(ast.Module(body=[node], type_ignores=[]), str(source), 'exec'), scope)
        entered, release = threading.Event(), threading.Event()

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/slow':
                    entered.set()
                    release.wait(5)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'asset')

            def log_message(self, *args):
                pass

        server = scope['CListServer'](('127.0.0.1', 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        # Bypass environment proxies for this isolated loopback-only fixture.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        errors = []

        def slow():
            try:
                with opener.open(base + '/slow', timeout=6) as response:
                    response.read()
            except Exception as error:
                errors.append(error)

        first = threading.Thread(target=slow)
        first.start()
        try:
            self.assertTrue(entered.wait(2))
            with opener.open(base + '/asset.js', timeout=2) as response:
                self.assertEqual(response.read(), b'asset')
            self.assertFalse(release.is_set())
        finally:
            release.set()
            first.join(7)
            server.shutdown()
            server.server_close()
            worker.join(2)
        self.assertFalse(errors)


if __name__ == '__main__':
    unittest.main()
