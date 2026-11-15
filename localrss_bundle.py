"""Build/startup diagnostics for the optional LocalRSS bundle; no DB or server startup."""
import importlib
from pathlib import Path

DEPENDENCIES = ('aiohttp', 'feedparser', 'flask', 'clist_server_admin.sqlite', 'clist_kvstore_auth.sync')


def check_localrss_bundle(base_dir):
    base = Path(base_dir) / 'localrss_bundled'
    for name in ('app.py', 'feeds.opml'):
        if not (base / name).is_file():
            raise RuntimeError('Missing LocalRSS bundle file: ' + name)
    for name in DEPENDENCIES:
        importlib.import_module(name)
    compile((base / 'app.py').read_text(encoding='utf-8'), str(base / 'app.py'), 'exec')


if __name__ == '__main__':
    check_localrss_bundle(Path(__file__).resolve().parent)
    print('LocalRSS bundle dependencies and source: OK')
