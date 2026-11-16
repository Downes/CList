"""Run with python -m unittest discover -s tests -p 'localrss_backend_test.py'.
Execute real backend functions in isolation; no Flask startup, network or user DB.
"""
import ast
import asyncio
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace


BACKEND_SOURCE = Path('localrss_bundled/app.py').read_text(encoding='utf-8')


class Session:
    def __init__(self, **kwargs): pass
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass


class HarvestConcurrencyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        path = str(Path(self.temp.name) / 'rss.db')
        def connect():
            db = sqlite3.connect(path, timeout=0.5)
            if threading.current_thread() is threading.main_thread():
                self.addCleanup(db.close)
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA journal_mode=WAL')
            return db
        self.connect = connect
        with connect() as db:
            db.executescript('''
                CREATE TABLE feeds(id INTEGER PRIMARY KEY, url TEXT, month_count INTEGER,
                    last_fetch INTEGER, fail_count INTEGER, next_fetch INTEGER, error_msg TEXT);
                CREATE TABLE entries(id INTEGER PRIMARY KEY, published INTEGER);
                CREATE TABLE entry_status(database_id INTEGER, entry_id INTEGER, read_at INTEGER,
                    bookmarked INTEGER, UNIQUE(database_id,entry_id));
                INSERT INTO feeds VALUES(1,'https://first.invalid',0,0,0,0,NULL);
                INSERT INTO feeds VALUES(2,'https://slow.invalid',0,0,0,0,NULL);
                INSERT INTO entries VALUES(7,1000);
                INSERT INTO entries VALUES(8,0);
                INSERT INTO entries VALUES(9,0);
                INSERT INTO entry_status VALUES(1,9,NULL,1);
            ''')
        self.started = threading.Event()
        self.release = threading.Event()
        self.errors = []
        async def fetch_one(session, sem, feed):
            if feed['id'] == 2:
                while not self.release.is_set():
                    await asyncio.sleep(0.005)
            return (feed['id'], 'not_modified', None, None, None)
        def progress(**values):
            if values['checked'] == 1:
                self.started.set()
        self.ns = dict(asyncio=asyncio, threading=threading, connect_global=connect,
            cutoff_ts=lambda:100, now_ts=lambda:1000, MAX_FEED_FAIL_COUNT=10,
            MAX_CONCURRENCY=2, LIMIT_PER_HOST=1, choose_interval=lambda n:60,
            aiohttp=SimpleNamespace(TCPConnector=lambda **kw:None, ClientSession=Session),
            DB_WRITE_LOCK=threading.Lock(), HARVEST_LOCK=threading.Lock(),
            fetch_one=fetch_one, request=SimpleNamespace(json={'id':7}),
            g={}, jsonify=lambda data:data, _requested_db_slug=lambda:'test',
            resolve_database=lambda *args,**kw:({'id':1},None),
            _entry_in_database=lambda *args:True, get_db=lambda:self.action_db)
        tree = ast.parse(BACKEND_SOURCE)
        names = {'update_feeds_async','api_toggle_read','api_toggle_bookmark','_update_one_feed_now'}
        nodes = [n for n in tree.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in names]
        for node in nodes: node.decorator_list = []
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'localrss_bundled/app.py','exec'),self.ns)
        def harvest():
            try:
                with self.ns['HARVEST_LOCK']:
                    asyncio.run(self.ns['update_feeds_async'](only_due=False,progress_cb=progress))
            except BaseException as error: self.errors.append(error)
        self.worker = threading.Thread(target=harvest)
        self.worker.start()
        self.addCleanup(self.stop)
        self.assertTrue(self.started.wait(2), 'First feed did not finish')

    def stop(self):
        self.release.set()
        self.worker.join(3)

    def test_read_unread_and_bookmark_complete_while_feed_fetch_waits(self):
        self.assertTrue(self.worker.is_alive())
        # A different connection sees the first feed committed before the next fetch.
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT last_fetch FROM feeds WHERE id=1').fetchone()[0],1000)
        self.action_db = self.connect()
        self.addCleanup(self.action_db.close)
        self.assertTrue(self.ns['api_toggle_read']()['read'])
        self.assertFalse(self.ns['api_toggle_read']()['read'])
        self.assertEqual(self.ns['api_toggle_bookmark']()['bookmarked'],1)
        self.assertTrue(self.worker.is_alive(), 'Writes must finish before releasing the slow feed')
        self.stop()
        self.assertFalse(self.worker.is_alive())
        self.assertEqual(self.errors,[])
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT bookmarked FROM entry_status WHERE entry_id=7').fetchone()[0],1)
            self.assertIsNone(db.execute('SELECT id FROM entries WHERE id=8').fetchone())
            self.assertIsNotNone(db.execute('SELECT id FROM entries WHERE id=9').fetchone())

    def test_failed_feed_rolls_back_without_losing_completed_feed(self):
        self.stop()
        with self.connect() as db:
            for column in ['title','feed_author','feed_author_did','feed_image','description','etag','last_modified','last_ok']:
                db.execute('ALTER TABLE feeds ADD COLUMN ' + column)
            db.execute('UPDATE feeds SET last_fetch=0')
        async def fetch_one(session, sem, feed):
            if feed['id'] == 1:
                return (1,'not_modified',None,None,None)
            return (2,'ok','fixture','etag','last-modified')
        def fail_after_update(*args): raise ValueError('Bad feed metadata')
        self.ns.update(fetch_one=fetch_one,
            feedparser=SimpleNamespace(parse=lambda payload:SimpleNamespace(feed={'title':'Changed'},entries=[])),
            feed_level_author=lambda feed:None, feed_level_author_did=lambda parsed:None,
            feed_level_image=lambda feed:None, feed_level_description=lambda feed:None,
            recompute_month_count=fail_after_update)
        result = asyncio.run(self.ns['update_feeds_async'](only_due=False))
        self.assertEqual(result['errors'],1)
        with self.connect() as db:
            self.assertEqual(db.execute('SELECT last_fetch FROM feeds WHERE id=1').fetchone()[0],1000)
            row = db.execute('SELECT last_fetch,title FROM feeds WHERE id=2').fetchone()
            self.assertEqual(row['last_fetch'],0)
            self.assertIsNone(row['title'])

    def test_completion_releases_harvest_and_database_locks(self):
        # Release the pending network work and check completion leaves both locks free.
        self.stop()
        self.assertEqual(self.errors,[])
        for name in ['DB_WRITE_LOCK','HARVEST_LOCK']:
            lock = self.ns[name]
            self.assertTrue(lock.acquire(blocking=False))
            lock.release()


if __name__ == '__main__': unittest.main()
