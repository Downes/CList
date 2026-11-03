# Vendored snapshot of /srv/apps/localrss_reader/app.py, copied 2026-11-03
# (that app is not a git repo, so no commit SHA to pin -- resync by diffing
# against the live file). Bundled into CList's desktop launcher so a
# "CList + LocalRSS" build gives a working local LocalRSS backend out of the
# box. One deliberate deviation from the source file: `import fcntl` was
# moved from module level (line 3 there) into _acquire_scheduler_leadership(),
# the only function that uses it, and that function now short-circuits on
# Windows (os.name == "nt") before touching fcntl at all -- the module-level
# import crashes on Windows (no fcntl there), and gunicorn multi-worker
# leader election is moot anyway in this single-process desktop context. Do
# not apply this change to the live app.py; production always runs on Linux
# under gunicorn.
import asyncio
import calendar
import hashlib
import re
import os
import sys
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from math import exp
import io
import json
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
from urllib.parse import urljoin
from html.parser import HTMLParser

import aiohttp
import feedparser
from flask import Flask, g, jsonify, request, send_from_directory, Response

from clist_server_admin.sqlite import (
    SettingField,
    init_settings_table,
    get_setting,
    register_admin_settings_routes,
)
from clist_kvstore_auth.sync import verify_token as _kv_verify_token

# -----------------------
# Config
# -----------------------
# RSS_DB now points at the single global harvest-store DB file (see
# "Architecture: Global Harvest Store + Per-Database Views" in CLAUDE.md).
# There is no more per-request DB switching -- every identity's personal
# feed lists ("databases") and the public collections all live as rows in
# this one file.
GLOBAL_DB_PATH = os.path.abspath(os.environ.get("RSS_DB", "data/global.db"))
DB_DIR = os.path.dirname(GLOBAL_DB_PATH) or os.path.abspath(".")

PORT = int(os.environ.get("RSS_PORT", "8787"))
APP_VERSION = "0.5.0"
USER_AGENT = os.environ.get("RSS_UA", f"LocalRSSReader/{APP_VERSION} (+Windows; local)")
MAX_CONCURRENCY = int(os.environ.get("RSS_CONCURRENCY", "40"))
LIMIT_PER_HOST = int(os.environ.get("RSS_LIMIT_PER_HOST", "4"))

RETENTION_DAYS = int(os.environ.get("RSS_RETENTION_DAYS", "30"))

# Feeds this broken are almost certainly dead/misconfigured - stop burning
# scheduler cycles on them until a human edits or manually retries the feed.
MAX_FEED_FAIL_COUNT = int(os.environ.get("RSS_MAX_FEED_FAIL_COUNT", "50"))

SCHEDULER_TICK_SECONDS = int(os.environ.get("RSS_TICK", "60"))
SQLITE_TIMEOUT = float(os.environ.get("RSS_SQLITE_TIMEOUT", "30"))

INTERVAL_LOW = int(os.environ.get("RSS_INTERVAL_LOW", str(20 * 60)))
INTERVAL_MED = int(os.environ.get("RSS_INTERVAL_MED", str(60 * 60)))
INTERVAL_HIGH = int(os.environ.get("RSS_INTERVAL_HIGH", str(2 * 60 * 60)))

# kvstore login gate: every route except "/", "/static/*", and "/api/collections*"
# requires a Bearer token, verified locally via JWT/JWKS ("Pattern B", see
# verify_identity() below) -- open to any issuer named in the token's own
# `iss` claim, no allowlist. RSS_ALLOWED_KVSTORE_URLS (.env, overridable via
# /admin/settings, see _allowed_kvstore_urls()) now only matters for (a) the
# opaque/legacy-token fallback target (named by the client's X-Kvstore-Url
# header) and (b) which issuer(s) are trusted to vouch for an ADMIN_USERNAMES
# admin -- it no longer gates ordinary verification.
RSS_ALLOWED_KVSTORE_URLS_DEFAULT = os.environ.get(
    "RSS_ALLOWED_KVSTORE_URLS", "https://kvstore.mooc.ca,https://kvstore.downes.ca"
)
ADMIN_USERNAMES = {u.strip() for u in os.environ.get("ADMIN_USERNAMES", "").split(",") if u.strip()}

# Collections: predefined bundles of feeds, defined by manifest files on disk,
# harvested into the same global store as everyone's personal feeds and
# exposed read-only, unauthenticated, under /api/collections. A collection is
# simply a `databases` row with owner_kvkey IS NULL.
COLLECTIONS_DIR = os.path.join(DB_DIR, "collections")
COLLECTIONS_MANIFEST_DIR = os.path.join(COLLECTIONS_DIR, "manifests")

# Admin-editable runtime settings live in their own DB file, independent of
# the global harvest store.
ADMIN_SETTINGS_DB_PATH = os.path.join(DB_DIR, "admin_settings.db")

# -----------------------
# App
# -----------------------
app = Flask(__name__, static_folder="static")

def now_ts() -> int:
    return int(time.time())

def cutoff_ts(days: int = RETENTION_DAYS) -> int:
    return int((datetime.now(timezone.utc) - timedelta(days=days)).timestamp())

# Serialize *all* write operations to avoid "database is locked"
DB_WRITE_LOCK = threading.Lock()

def connect_global() -> sqlite3.Connection:
    """Connect to the single global harvest-store DB."""
    parent = os.path.dirname(GLOBAL_DB_PATH)
    if parent and not os.path.exists(parent):
        try:
            os.makedirs(parent, exist_ok=True)
        except Exception as e:
            print(f"[WARN] Could not create DB directory '{parent}': {e}", file=sys.stderr)
    con = sqlite3.connect(GLOBAL_DB_PATH, timeout=SQLITE_TIMEOUT)
    con.row_factory = sqlite3.Row
    # WAL: readers never block behind the harvester's long-running write
    # transaction (update_feeds_async holds one open for an entire fetch
    # cycle). Without this, the default rollback-journal mode made every
    # read -- Find, the feed list, mark-read/bookmark -- stall for up to
    # SQLITE_TIMEOUT seconds whenever it landed during a harvest run.
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=NORMAL")
    return con


def connect_db_at(db_path: str) -> sqlite3.Connection:
    """Connect directly to an explicit DB path. Used only for the
    independent admin-settings DB file."""
    db_abs = os.path.abspath(db_path)
    parent = os.path.dirname(db_abs)
    if parent and not os.path.exists(parent):
        os.makedirs(parent, exist_ok=True)
    con = sqlite3.connect(db_abs, timeout=SQLITE_TIMEOUT)
    con.row_factory = sqlite3.Row
    return con


def _apply_schema(con: sqlite3.Connection) -> None:
    """Global Harvest Store + Per-Database Views schema (see CLAUDE.md).
    `feeds`/`entries` are deduplicated globally; `databases` are named feed
    lists (owned, or owner=NULL for public collections); `database_feeds` is
    membership; `entry_status` is per-(database, entry) read/bookmark state;
    `user_prefs` is each identity's "current database" (used when a request
    omits ?db=)."""
    con.executescript("""
    CREATE TABLE IF NOT EXISTS feeds (
      id INTEGER PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      title TEXT,
      etag TEXT,
      last_modified TEXT,
      last_fetch INTEGER,
      fail_count INTEGER DEFAULT 0,
      next_fetch INTEGER DEFAULT 0,
      month_count INTEGER DEFAULT 0,
      last_ok INTEGER DEFAULT 0,
      error_msg TEXT,
      feed_author TEXT,
      feed_image TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY,
      feed_id INTEGER NOT NULL REFERENCES feeds(id),
      guid TEXT NOT NULL,
      title TEXT,
      link TEXT,
      author TEXT,
      published INTEGER,
      content_html TEXT,
      thumbnail TEXT,
      audio_url TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(feed_id, guid)
    );
    CREATE INDEX IF NOT EXISTS idx_entries_feed_pub ON entries(feed_id, published);

    CREATE TABLE IF NOT EXISTS databases (
      id INTEGER PRIMARY KEY,
      slug TEXT NOT NULL,
      title TEXT,
      owner_kvstore_url TEXT,
      owner_kvkey TEXT,
      created_at INTEGER NOT NULL,
      CHECK ((owner_kvstore_url IS NULL) = (owner_kvkey IS NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_public_slug
        ON databases(slug) WHERE owner_kvkey IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_owner_slug
        ON databases(owner_kvstore_url, owner_kvkey, slug) WHERE owner_kvkey IS NOT NULL;

    CREATE TABLE IF NOT EXISTS database_feeds (
      database_id INTEGER NOT NULL REFERENCES databases(id),
      feed_id     INTEGER NOT NULL REFERENCES feeds(id),
      added_at    INTEGER NOT NULL,
      PRIMARY KEY (database_id, feed_id)
    );

    CREATE TABLE IF NOT EXISTS entry_status (
      database_id INTEGER NOT NULL REFERENCES databases(id),
      entry_id    INTEGER NOT NULL REFERENCES entries(id),
      read_at     INTEGER,
      bookmarked  INTEGER DEFAULT 0,
      PRIMARY KEY (database_id, entry_id)
    );
    CREATE INDEX IF NOT EXISTS idx_entry_status_db_read ON entry_status(database_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_entry_status_db_bookmarked ON entry_status(database_id, bookmarked);

    CREATE TABLE IF NOT EXISTS user_prefs (
      owner_kvstore_url TEXT NOT NULL,
      owner_kvkey       TEXT NOT NULL,
      database_id       INTEGER NOT NULL REFERENCES databases(id),
      PRIMARY KEY (owner_kvstore_url, owner_kvkey)
    );
    """)
    con.commit()


def _ensure_column(con: sqlite3.Connection, table: str, column: str, coltype: str) -> None:
    """Idempotent ALTER TABLE ADD COLUMN, for additive schema changes to an
    already-deployed DB file (CREATE TABLE IF NOT EXISTS above only helps on
    a fresh DB)."""
    try:
        con.execute(f"ALTER TABLE {table} ADD COLUMN {column} {coltype}")
        con.commit()
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e).lower():
            raise

def init_db():
    con = connect_global()
    _apply_schema(con)
    _ensure_column(con, "entries", "audio_url", "TEXT")
    _ensure_column(con, "feeds", "feed_author_did", "TEXT")
    _ensure_column(con, "feeds", "description", "TEXT")
    con.close()
    settings_con = connect_db_at(ADMIN_SETTINGS_DB_PATH)
    init_settings_table(settings_con)
    settings_con.close()

def _sanitize_slug(name: str) -> str:
    name = (name or "").strip()
    name = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return name


def _looks_like_feed(content_type: str | None, body: bytes) -> bool:
    """Best-effort check: does this response look like RSS/Atom XML?"""
    ct = (content_type or "").lower()
    if any(t in ct for t in ("application/rss+xml", "application/atom+xml", "application/xml", "text/xml")):
        return True
    # Sniff body
    head = body[:4096].lstrip()
    # XML declaration or feed tags
    if head.startswith(b"<?xml"):
        return True
    lower = head.lower()
    return (b"<rss" in lower) or (b"<feed" in lower and b"xmlns" in lower)


class _HeadLinkFinder(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_head = False
        self.candidates: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "head":
            self.in_head = True
            return
        if not self.in_head:
            return
        if tag.lower() != "link":
            return
        d = {k.lower(): (v or "") for (k, v) in attrs}
        rel = d.get("rel", "").lower()
        typ = d.get("type", "").lower()
        href = d.get("href", "")
        if not href:
            return
        if "alternate" not in rel:
            return
        if "rss" in typ or "atom" in typ or "xml" in typ:
            self.candidates.append(href)

    def handle_endtag(self, tag):
        if tag.lower() == "head":
            self.in_head = False


def _fetch_url_bytes(url: str, timeout: int = 12) -> tuple[bytes, str | None]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        ct = resp.headers.get("Content-Type")
        body = resp.read()
        return body, ct


def discover_feed_url(input_url: str) -> tuple[str, str]:
    """Return (feed_url, kind) where kind is 'direct' or 'discovered'. Raises ValueError."""
    url = (input_url or "").strip()
    if not url:
        raise ValueError("URL is required")
    if not re.match(r"^https?://", url, re.I):
        raise ValueError("URL must start with http:// or https://")

    body, ct = _fetch_url_bytes(url)
    if _looks_like_feed(ct, body):
        return url, "direct"

    # Parse HTML head for RSS/Atom link
    try:
        text = body.decode("utf-8", errors="ignore")
    except Exception:
        text = ""
    parser = _HeadLinkFinder()
    parser.feed(text)
    if not parser.candidates:
        raise ValueError("No RSS/Atom link tag found in the page header.")

    # Choose first candidate (site may expose multiple)
    feed_url = urljoin(url, parser.candidates[0])
    return feed_url, "discovered"

def _parse_opml(xml_bytes: bytes):
    """Return list of (url, title) from an OPML file."""
    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:
        raise ValueError(f"Invalid OPML/XML: {e}")

    pairs = []
    seen = set()
    for el in root.findall(".//outline"):
        url = el.attrib.get("xmlUrl") or el.attrib.get("xmlurl") or el.attrib.get("url")
        if not url:
            continue
        url = url.strip()
        if not url or url in seen:
            continue
        title = (el.attrib.get("title") or el.attrib.get("text") or "").strip() or None
        pairs.append((url, title))
        seen.add(url)
    return pairs

def _build_opml(feeds):
    now_iso = datetime.now().strftime("%a, %d %b %Y %H:%M:%S")
    parts = []
    parts.append('<?xml version="1.0" encoding="UTF-8"?>')
    parts.append('<opml version="2.0">')
    parts.append('  <head>')
    parts.append('    <title>LocalRSSReader Feeds</title>')
    parts.append(f'    <dateCreated>{now_iso}</dateCreated>')
    parts.append('  </head>')
    parts.append('  <body>')
    for f in feeds:
        url = (f["url"] if isinstance(f, dict) else f[0]) or ""
        title = (f["title"] if isinstance(f, dict) else (f[1] if len(f) > 1 else None)) or url
        # minimal XML escaping
        def esc(s):
            return (s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace('"',"&quot;"))
        parts.append(f'    <outline type="rss" text="{esc(title)}" title="{esc(title)}" xmlUrl="{esc(url)}" />')
    parts.append('  </body>')
    parts.append('</opml>')
    return "\n".join(parts).encode("utf-8")


def get_db():
    if "db" not in g:
        g.db = connect_global()
    return g.db

def get_admin_settings_db() -> sqlite3.Connection:
    if "admin_settings_db" not in g:
        g.admin_settings_db = connect_db_at(ADMIN_SETTINGS_DB_PATH)
    return g.admin_settings_db

@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()
    admin_settings_db = g.pop("admin_settings_db", None)
    if admin_settings_db is not None:
        admin_settings_db.close()

def ensure_feed(db, url: str):
    db.execute("INSERT OR IGNORE INTO feeds(url, next_fetch) VALUES(?, ?)", (url, 0))

def _ensure_global_feed(db, url: str, title: str | None = None) -> int:
    """Dedupe-by-url lookup-or-create against the global feeds table."""
    row = db.execute("SELECT id FROM feeds WHERE url=?", (url,)).fetchone()
    if row:
        return row["id"]
    cur = db.execute("INSERT INTO feeds(url, title, next_fetch) VALUES(?, ?, 0)", (url, title))
    return cur.lastrowid

# -----------------------
# Collections (public, unauthenticated, read-only feed bundles)
# -----------------------
# Serializes collection-membership writes (ensure_collections). Separate
# from DB_WRITE_LOCK only to keep manifest-sync concerns distinct; both
# ultimately touch the same global DB file.
COLLECTIONS_WRITE_LOCK = threading.Lock()

def _load_collection_manifests() -> list[dict]:
    """Scan COLLECTIONS_MANIFEST_DIR for {"slug", "title", "feeds"} JSON files.
    Skips and logs malformed manifests rather than failing the whole scan."""
    manifests = []
    try:
        os.makedirs(COLLECTIONS_MANIFEST_DIR, exist_ok=True)
        names = sorted(os.listdir(COLLECTIONS_MANIFEST_DIR))
    except Exception as e:
        print(f"[WARN] Could not scan collections manifest dir: {e}", file=sys.stderr)
        return manifests

    for name in names:
        if not name.lower().endswith(".json"):
            continue
        path = os.path.join(COLLECTIONS_MANIFEST_DIR, name)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            slug = (data.get("slug") or "").strip()
            title = (data.get("title") or "").strip()
            feeds = data.get("feeds") or []
            if not re.match(r"^[A-Za-z0-9_-]+$", slug):
                print(f"[WARN] Collection manifest '{name}' has invalid/missing slug, skipping.", file=sys.stderr)
                continue
            if not title or not isinstance(feeds, list):
                print(f"[WARN] Collection manifest '{name}' missing title or feeds list, skipping.", file=sys.stderr)
                continue
            manifests.append({
                "slug": slug,
                "title": title,
                "feeds": [str(u).strip() for u in feeds if str(u).strip()],
            })
        except Exception as e:
            print(f"[WARN] Could not load collection manifest '{name}': {e}", file=sys.stderr)
    return manifests

def ensure_collections() -> list[dict]:
    """Idempotent: ensures each collection's `databases` row (owner=NULL)
    exists and its feed list is synced, add-only (never removes a feed from
    a collection, so a manifest temporarily dropping a URL doesn't discard
    that feed's harvested history). Caller is responsible for holding
    COLLECTIONS_WRITE_LOCK."""
    manifests = _load_collection_manifests()
    db = connect_global()
    try:
        for m in manifests:
            row = db.execute(
                "SELECT id FROM databases WHERE owner_kvkey IS NULL AND slug=?", (m["slug"],)
            ).fetchone()
            if row:
                database_id = row["id"]
                db.execute("UPDATE databases SET title=? WHERE id=?", (m["title"], database_id))
            else:
                cur = db.execute(
                    "INSERT INTO databases (slug, title, owner_kvstore_url, owner_kvkey, created_at) "
                    "VALUES (?, ?, NULL, NULL, ?)",
                    (m["slug"], m["title"], now_ts()),
                )
                database_id = cur.lastrowid
            for url in m["feeds"]:
                feed_id = _ensure_global_feed(db, url)
                db.execute(
                    "INSERT OR IGNORE INTO database_feeds (database_id, feed_id, added_at) VALUES (?, ?, ?)",
                    (database_id, feed_id, now_ts()),
                )
        db.commit()
    finally:
        db.close()
    return manifests

def stable_guid(entry) -> str:
    gid = entry.get("id") or entry.get("guid")
    if gid:
        return str(gid)
    link = entry.get("link", "")
    title = entry.get("title", "")
    published = str(entry.get("published", "")) or str(entry.get("updated", ""))
    raw = f"{link}\n{title}\n{published}".encode("utf-8", "ignore")
    return hashlib.sha256(raw).hexdigest()

def safe_struct_time_to_ts(st) -> int:
    """
    Convert a time.struct_time-like object to epoch seconds safely on Windows.
    Some feeds contain absurd years (e.g. 0001 or 9999), which can crash time.mktime().
    """
    try:
        y = int(st.tm_year)
        # Windows mktime often fails outside ~1970-2038; clamp aggressively.
        now_year = datetime.now(timezone.utc).year
        if y < 1971 or y > now_year + 5:
            return now_ts()
    except Exception:
        return now_ts()

    # Prefer UTC conversion if possible (avoids local DST issues)
    try:
        return int(calendar.timegm(st))
    except Exception:
        pass

    # Fallback to local mktime (can still fail)
    try:
        return int(time.mktime(st))
    except Exception:
        return now_ts()

def entry_published_ts(entry) -> int:
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            return safe_struct_time_to_ts(st)
    return now_ts()

def entry_content_html(entry) -> str:
    if entry.get("content"):
        try:
            return entry["content"][0].get("value") or ""
        except Exception:
            pass
    return entry.get("summary", "") or ""

def entry_thumbnail(entry) -> str | None:
    """Best-effort feed-supplied thumbnail: media:thumbnail, media:content
    (image), an image enclosure, or itunes:image - in that order. Only looks
    at data feedparser already parsed from the feed, no extra fetch."""
    media_thumb = entry.get("media_thumbnail")
    if media_thumb:
        url = media_thumb[0].get("url")
        if url:
            return url
    for m in (entry.get("media_content") or []):
        if m.get("medium") == "image" or (m.get("type") or "").startswith("image/"):
            if m.get("url"):
                return m.get("url")
    for enc in (entry.get("enclosures") or []):
        if (enc.get("type") or "").startswith("image/") and enc.get("href"):
            return enc.get("href")
    image = entry.get("image")
    if image and image.get("href"):
        return image.get("href")
    return None

def entry_audio(entry) -> str | None:
    """First audio enclosure on this entry (podcast episode media), or None
    for a plain article. Only looks at data feedparser already parsed from
    the feed, no extra fetch -- mirrors entry_thumbnail() above."""
    for enc in (entry.get("enclosures") or []):
        if (enc.get("type") or "").startswith("audio/") and enc.get("href"):
            return enc.get("href")
    return None

def feed_level_author(feed) -> str | None:
    """Best-effort feed-supplied author name: Atom/RSS author, iTunes
    podcast author, or publisher - in that order."""
    author = (feed.get("author") or "").strip()
    if author:
        return author
    name = ((feed.get("author_detail") or {}).get("name") or "").strip()
    if name:
        return name
    publisher = (feed.get("publisher") or "").strip()
    if publisher:
        return publisher
    return None

def feed_level_author_did(parsed) -> str | None:
    """Best-effort did:web DID advertised by the feed: an entry-level
    rel="author" link or Atom author URI (checked across entries first --
    more specific, correct for multi-author feeds), falling back to the
    same at channel level. Takes the full feedparser.parse() result (needs
    both .entries and .feed)."""
    for entry in parsed.entries:
        for link in (entry.get("links") or []):
            href = link.get("href", "")
            if link.get("rel") == "author" and href.startswith("did:"):
                return href
        detail = entry.get("author_detail") or {}
        href = detail.get("href", "")
        if href.startswith("did:"):
            return href
    for link in (parsed.feed.get("links") or []):
        href = link.get("href", "")
        if link.get("rel") == "author" and href.startswith("did:"):
            return href
    detail = parsed.feed.get("author_detail") or {}
    href = detail.get("href", "")
    if href.startswith("did:"):
        return href
    return None

def feed_level_image(feed) -> str | None:
    """Best-effort feed-supplied image/thumbnail: RSS <image>, iTunes
    podcast artwork, or Atom logo/icon - in that order."""
    href = ((feed.get("image") or {}).get("href") or "").strip()
    if href:
        return href
    logo = (feed.get("logo") or "").strip()
    if logo:
        return logo
    icon = (feed.get("icon") or "").strip()
    if icon:
        return icon
    return None

def feed_level_description(feed) -> str | None:
    """Best-effort feed-supplied description: RSS <description>, Atom
    <subtitle>, or <summary> - in that order."""
    desc = (feed.get("description") or "").strip()
    if desc:
        return desc
    subtitle = (feed.get("subtitle") or "").strip()
    if subtitle:
        return subtitle
    summary = (feed.get("summary") or "").strip()
    if summary:
        return summary
    return None

def recompute_month_count(db, feed_id: int, cutoff: int):
    row = db.execute(
        "SELECT COUNT(*) AS c FROM entries WHERE feed_id=? AND published>=?",
        (feed_id, cutoff)
    ).fetchone()
    c = int(row["c"])
    db.execute("UPDATE feeds SET month_count=? WHERE id=?", (c, feed_id))

def post_score(published_ts: int, month_count: int, now: int) -> float:
    """Rank score for a post: favours infrequent feeds and recent posts.
    Higher score = show first. Uses feed's 30-day post count and exponential
    freshness decay so low-volume feeds aren't buried by high-volume ones."""
    r = max(float(month_count or 0), 0.25)   # posts per ~30 days, floor 0.25
    age_days = max((now - published_ts) / 86400.0, 0.0)
    feed_weight = 1.0 / ((r + 1.0) ** 0.7)
    freshness = exp(-0.22 * age_days)
    return feed_weight * freshness


def choose_interval(month_count: int) -> int:
    if month_count <= 10:
        return INTERVAL_LOW
    if month_count <= 200:
        return INTERVAL_MED
    return INTERVAL_HIGH

# -----------------------
# Update core (async)
# -----------------------
async def fetch_one(session: aiohttp.ClientSession, sem: asyncio.Semaphore, feed_row):
    feed_id = feed_row["id"]
    url = feed_row["url"]
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if feed_row["etag"]:
        headers["If-None-Match"] = feed_row["etag"]
    if feed_row["last_modified"]:
        headers["If-Modified-Since"] = feed_row["last_modified"]

    async with sem:
        try:
            async with session.get(url, headers=headers, timeout=aiohttp.ClientTimeout(total=25)) as resp:
                status = resp.status
                if status == 304:
                    return (feed_id, "not_modified", None, None, None)
                if status != 200:
                    return (feed_id, "http_error", status, None, None)
                text = await resp.text(errors="ignore")
                etag = resp.headers.get("ETag")
                last_mod = resp.headers.get("Last-Modified")
                return (feed_id, "ok", text, etag, last_mod)
        except Exception as e:
            return (feed_id, "exception", str(e), None, None)

async def update_feeds_async(feed_ids=None, only_due=True, progress_cb=None, cancel_event: threading.Event | None = None):
    # IMPORTANT: callers should hold DB_WRITE_LOCK before calling this.
    db = connect_global()
    cutoff = cutoff_ts()

    if feed_ids:
        q = "SELECT * FROM feeds WHERE id IN (%s)" % ",".join("?" * len(feed_ids))
        feeds = db.execute(q, feed_ids).fetchall()
    else:
        if only_due:
            feeds = db.execute(
                "SELECT * FROM feeds WHERE next_fetch <= ? AND fail_count < ?",
                (now_ts(), MAX_FEED_FAIL_COUNT)
            ).fetchall()
        else:
            feeds = db.execute("SELECT * FROM feeds").fetchall()

    total = len(feeds)
    checked = updated = errors = 0

    if progress_cb:
        progress_cb(total=total, checked=0, updated=0, errors=0, state="running", current_url=None)

    if total == 0:
        db.close()
        return {"checked": 0, "updated": 0, "errors": 0, "total": 0}

    sem = asyncio.Semaphore(MAX_CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENCY, limit_per_host=LIMIT_PER_HOST, ttl_dns_cache=300)

    db.execute("BEGIN")
    try:
        async with aiohttp.ClientSession(connector=connector) as session:
            tasks = []
            for f in feeds:
                if cancel_event and cancel_event.is_set():
                    break
                tasks.append(asyncio.create_task(fetch_one(session, sem, f)))

            for coro in asyncio.as_completed(tasks):
                if cancel_event and cancel_event.is_set():
                    break

                (feed_id, kind, payload, etag, last_mod) = await coro
                checked += 1

                urow = db.execute("SELECT url FROM feeds WHERE id=?", (feed_id,)).fetchone()
                cur_url = urow["url"] if urow else None

                try:
                    if kind == "not_modified":
                        mcrow = db.execute("SELECT month_count FROM feeds WHERE id=?", (feed_id,)).fetchone()
                        mc = int(mcrow["month_count"] or 0) if mcrow else 0
                        db.execute(
                            "UPDATE feeds SET last_fetch=?, fail_count=0, next_fetch=?, error_msg=NULL WHERE id=?",
                            (now_ts(), now_ts() + choose_interval(mc), feed_id)
                        )
                    elif kind != "ok":
                        errors += 1
                        row = db.execute("SELECT fail_count FROM feeds WHERE id=?", (feed_id,)).fetchone()
                        fail = int(row["fail_count"] or 0) + 1
                        backoff = min(6 * 3600, (2 ** min(fail, 8)) * 60)
                        if kind == "http_error":
                            error_msg = f"HTTP {payload}"
                        else:
                            error_msg = (str(payload) or "Connection error")[:500]
                        db.execute(
                            "UPDATE feeds SET last_fetch=?, fail_count=?, next_fetch=?, error_msg=? WHERE id=?",
                            (now_ts(), fail, now_ts() + backoff, error_msg, feed_id)
                        )
                    else:
                        # Parse & insert. Any weird entry dates should not crash the whole job.
                        parsed = feedparser.parse(payload)
                        feed_title = (parsed.feed.get("title") or "").strip() or None
                        f_author = feed_level_author(parsed.feed)
                        f_author_did = feed_level_author_did(parsed)
                        f_image = feed_level_image(parsed.feed)
                        f_description = feed_level_description(parsed.feed)
                        db.execute(
                            """UPDATE feeds SET title=COALESCE(?, title),
                                 feed_author=COALESCE(feed_author, ?),
                                 feed_author_did=COALESCE(feed_author_did, ?),
                                 feed_image=COALESCE(feed_image, ?),
                                 description=COALESCE(description, ?),
                                 etag=?, last_modified=?, last_fetch=?, last_ok=?, fail_count=0, error_msg=NULL
                               WHERE id=?""",
                            (feed_title, f_author, f_author_did, f_image, f_description, etag, last_mod, now_ts(), now_ts(), feed_id)
                        )

                        added_any = False
                        for e in parsed.entries:
                            if cancel_event and cancel_event.is_set():
                                break
                            try:
                                guid = stable_guid(e)
                                title = (e.get("title") or "").strip()
                                link = e.get("link")
                                author = (e.get("author") or "").strip() or None
                                pub_ts = entry_published_ts(e)
                                if pub_ts < cutoff:
                                    continue
                                html = entry_content_html(e)
                                thumb = entry_thumbnail(e)
                                audio = entry_audio(e)
                                cur_ins = db.execute("""
                                  INSERT OR IGNORE INTO entries(feed_id,guid,title,link,author,published,content_html,thumbnail,audio_url,created_at)
                                  VALUES(?,?,?,?,?,?,?,?,?,?)
                                """, (feed_id, guid, title, link, author, pub_ts, html, thumb, audio, now_ts()))
                                if cur_ins.rowcount:
                                    added_any = True
                            except Exception:
                                errors += 1
                                continue

                        if added_any:
                            updated += 1

                        recompute_month_count(db, feed_id, cutoff)
                        mcrow = db.execute("SELECT month_count FROM feeds WHERE id=?", (feed_id,)).fetchone()
                        mc = int(mcrow["month_count"] or 0) if mcrow else 0
                        db.execute("UPDATE feeds SET next_fetch=? WHERE id=?", (now_ts() + choose_interval(mc), feed_id))
                except Exception:
                    # Treat any per-feed crash as an error, keep going.
                    errors += 1

                if progress_cb:
                    progress_cb(total=total, checked=checked, updated=updated, errors=errors, state="running", current_url=cur_url)

        # Retention: an entry is purged once past cutoff, unless some database
        # has it bookmarked. Drop its entry_status rows too so none orphan.
        to_delete = [r["id"] for r in db.execute(
            "SELECT id FROM entries WHERE published < ? AND id NOT IN "
            "(SELECT entry_id FROM entry_status WHERE bookmarked = 1)",
            (cutoff,),
        ).fetchall()]
        if to_delete:
            placeholders = ",".join("?" * len(to_delete))
            db.execute(f"DELETE FROM entry_status WHERE entry_id IN ({placeholders})", to_delete)
            db.execute(f"DELETE FROM entries WHERE id IN ({placeholders})", to_delete)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    return {"checked": checked, "updated": updated, "errors": errors, "total": total}

# -----------------------
# Job manager
# -----------------------
_jobs_lock = threading.Lock()
_jobs = {}
_active_job_id = None

def _new_job_id() -> str:
    return f"job_{now_ts()}_{os.getpid()}"

def _progress_updater(job_id: str, **kwargs):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.update(kwargs)
        job["last_change_ts"] = now_ts()

def start_update_job(full_sweep: bool = True) -> str:
    global _active_job_id
    with _jobs_lock:
        if _active_job_id and _jobs.get(_active_job_id, {}).get("state") == "running":
            return _active_job_id

        job_id = _new_job_id()
        cancel_event = threading.Event()
        _jobs[job_id] = {
            "state": "running",
            "checked": 0,
            "updated": 0,
            "errors": 0,
            "total": 0,
            "current_url": None,
            "started_ts": now_ts(),
            "last_change_ts": now_ts(),
            "_cancel_event": cancel_event,
        }
        _active_job_id = job_id

    def runner():
        try:
            def cb(**k):
                _progress_updater(job_id, **k)

            with DB_WRITE_LOCK:
                stats = asyncio.run(update_feeds_async(only_due=not full_sweep, progress_cb=cb, cancel_event=cancel_event))

            with _jobs_lock:
                job = _jobs.get(job_id)
                if job:
                    job.update(stats)
                    job["state"] = "cancelled" if cancel_event.is_set() else "done"
                    job["ended_ts"] = now_ts()
        except Exception as e:
            with _jobs_lock:
                job = _jobs.get(job_id)
                if job:
                    job["state"] = "error"
                    job["error"] = str(e)
                    job["ended_ts"] = now_ts()

    threading.Thread(target=runner, daemon=True).start()
    return job_id

def cancel_update_job(job_id: str) -> bool:
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return False
        ev = job.get("_cancel_event")
        if ev and hasattr(ev, "set"):
            ev.set()
            job["state"] = "cancelling"
            job["last_change_ts"] = now_ts()
            return True
        return False

def get_job(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if not job:
            return None
        out = {k: v for k, v in job.items() if k != "_cancel_event"}
        out["job_id"] = job_id
        return out


def _any_update_job_running() -> bool:
    """True if an update job is currently running (manual or scheduler)."""
    with _jobs_lock:
        if not _active_job_id:
            return False
        job = _jobs.get(_active_job_id)
        return bool(job and job.get("state") == "running")

# -----------------------
# Background scheduler
# -----------------------
# One unified loop over the global, deduplicated feeds table -- a feed is
# harvested once regardless of how many personal databases or collections
# reference it. Replaces the old scheduler_loop()/collections_scheduler_loop()
# split, which existed only because collections used to live in separate DB
# files.
_scheduler_enabled = True

async def harvest_loop():
    while True:
        await asyncio.sleep(SCHEDULER_TICK_SECONDS)
        if not _scheduler_enabled:
            continue
        acquired = DB_WRITE_LOCK.acquire(blocking=False)
        if not acquired:
            continue
        try:
            with COLLECTIONS_WRITE_LOCK:
                ensure_collections()
            await update_feeds_async(only_due=True)
        except Exception:
            pass
        finally:
            DB_WRITE_LOCK.release()

# With more than one gunicorn worker process, module-level code (including this
# function) runs once per worker. An flock on a sentinel file in the bind-mounted
# data dir elects exactly one worker as the harvester -- the others skip starting
# it entirely, so feeds are never fetched twice in parallel. The fd is kept open
# in a module global for the life of the process; the OS releases the lock
# automatically if that worker dies, letting another worker pick it up.
_scheduler_leader_fh = None

def _acquire_scheduler_leadership() -> bool:
    global _scheduler_leader_fh
    # os.name == "nt" (Windows) has no fcntl -- irrelevant anyway, since this
    # desktop bundle is always a single process with no other worker to race.
    if os.name == "nt":
        return True
    lock_path = os.path.join(os.path.dirname(GLOBAL_DB_PATH), ".harvester.lock")
    fh = open(lock_path, "w")
    try:
        import fcntl
        fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        fh.close()
        return False
    _scheduler_leader_fh = fh  # keep open/locked for process lifetime
    return True

def start_background_scheduler():
    if not _acquire_scheduler_leadership():
        print("[INFO] Another worker already owns the harvester; not starting it here.", file=sys.stderr)
        return
    def runner():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.create_task(harvest_loop())
        loop.run_forever()
    threading.Thread(target=runner, daemon=True).start()

# -----------------------
# Auth (kvstore login gate)
# -----------------------
_PUBLIC_PATHS = {"/", "/feed_meta"}
_PUBLIC_PATH_PREFIXES = ("/static/", "/api/collections")

def _allowed_kvstore_urls() -> list[str]:
    # Read fresh on every call so an admin override saved via /admin/settings
    # takes effect immediately, no restart.
    raw = get_setting(
        get_admin_settings_db(), "RSS_ALLOWED_KVSTORE_URLS",
        default=RSS_ALLOWED_KVSTORE_URLS_DEFAULT,
    )
    return [u.strip() for u in raw.split(",") if u.strip()]

def is_admin(identity) -> bool:
    # Reimplemented locally rather than clist_kvstore_auth.sync.is_admin,
    # because RSS_ALLOWED_KVSTORE_URLS is DB-overridable via /admin/settings
    # (_allowed_kvstore_urls() below reads get_setting()), not just a static
    # env var -- the package's own is_admin() only ever sees the env value.
    return bool(identity) and identity.username in ADMIN_USERNAMES and identity.iss in _allowed_kvstore_urls()


def verify_identity(req):
    """Verify Bearer token via local JWT/JWKS ("Pattern B"), open to any
    issuer named in the token's own `iss` claim -- no allowlist gates
    whether a real JWT is accepted (clist_kvstore_auth.sync). Opaque/legacy
    tokens carry no `iss`, so they still need the client's X-Kvstore-Url
    header to say which instance to call back to verify against, and that
    header must still be one of _allowed_kvstore_urls().
    Returns (Identity, None) on success or (None, (body, status)) on failure."""
    auth = req.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.startswith("Bearer ") else ""
    if token.count(".") != 2:
        kvstore_url = (req.headers.get("X-Kvstore-Url") or "").strip().rstrip("/")
        if not kvstore_url or kvstore_url not in _allowed_kvstore_urls():
            return None, ({"error": "Missing or disallowed X-Kvstore-Url header"}, 401)
        return _kv_verify_token(auth, kvstore_url)
    return _kv_verify_token(auth, "")

# -----------------------
# CORS for local runs
# -----------------------
# The *hosted* instance never needs any of this -- its CORS headers all come
# from the Caddy block in front of it. A bare local run (run_localrss.sh/.bat,
# the tray app, or `docker compose up` with nothing in front) has no reverse
# proxy adding those headers at all, so without this, no browser page --
# hosted CList, the desktop launcher, or file:// -- could ever fetch() it.
def _is_local_host_request() -> bool:
    host = (request.host or "").split(":")[0]
    return host in ("localhost", "127.0.0.1")

@app.before_request
def _local_cors_preflight():
    # Must run before _enabled_gate/_require_auth below: a preflight OPTIONS
    # carries no Authorization header, and browsers require a 2xx preflight
    # response before they'll even send the real request.
    if request.method == "OPTIONS" and _is_local_host_request():
        resp = Response(status=204)
        origin = request.headers.get("Origin")
        if origin:
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Access-Control-Allow-Credentials"] = "true"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Kvstore-Url"
        return resp
    return None

@app.after_request
def _local_cors_headers(response):
    if _is_local_host_request():
        origin = request.headers.get("Origin")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.before_request
def _enabled_gate():
    # Runs before _require_auth below (Flask runs before_request hooks in
    # registration order), so a disabled app answers 503 without first
    # paying for a token-verify round trip to kvstore.
    if request.path == "/admin/settings":
        return None
    if get_setting(get_admin_settings_db(), "ENABLED", default="true") == "false":
        return jsonify({"error": "Service temporarily disabled by administrator"}), 503

@app.before_request
def _require_auth():
    path = request.path
    if path in _PUBLIC_PATHS or path.startswith(_PUBLIC_PATH_PREFIXES):
        return None
    identity, err = verify_identity(request)
    if err:
        body, status = err
        return jsonify(body), status
    g.identity = identity
    g.username = identity.username
    return None

# -----------------------
# Admin settings
# -----------------------
# The global _require_auth before_request hook above already verifies the
# Bearer token for every non-public path, /admin/settings included, and
# stashes the result on g.identity. The callable handed to
# register_admin_settings_routes reuses that identity but additionally
# gates on issuer-aware is_admin() itself -- not clist_server_admin.sqlite's
# own bare is_admin(username) -- otherwise any issuer's JWT naming sub=<an
# admin username> would bypass the issuer-trust requirement entirely, since
# ordinary verification above is intentionally open to any issuer.
def _admin_verify_token():
    identity = g.get("identity")
    if not identity:
        return None, ({"error": "Missing or invalid Authorization header"}, 401)
    if not is_admin(identity):
        return None, ({"error": "Forbidden"}, 403)
    return identity.username, None

SETTINGS_SCHEMA = [
    SettingField(
        "ENABLED", "Enabled", "boolean", False, None,
        "When off, this app's functional endpoints return 503. /admin/settings "
        "stays reachable so you can turn it back on.",
    ),
    SettingField(
        "RSS_ALLOWED_KVSTORE_URLS", "Allowed KVStore URLs", "text", False, None,
        "Comma-separated kvstore instances trusted to vouch for an admin, and used "
        "as the opaque/legacy-token fallback target named by a client's "
        "X-Kvstore-Url header. Does NOT gate ordinary token verification, which is "
        "open to any issuer.",
    ),
]
SETTINGS_DEFAULTS = {
    "ENABLED": "true",
    "RSS_ALLOWED_KVSTORE_URLS": RSS_ALLOWED_KVSTORE_URLS_DEFAULT,
}

register_admin_settings_routes(
    app, SETTINGS_SCHEMA, get_admin_settings_db, _admin_verify_token, SETTINGS_DEFAULTS
)

# -----------------------
# Database resolution (ownership, slugs, per-identity preference)
# -----------------------
# A "database" row is a named feed list: owned (owner_kvstore_url +
# owner_kvkey set) or public/collection-style (both NULL). Reads and writes
# against an owned database both require the caller's identity to match the
# owner -- a mismatch resolves as "not found" (get_database_by_slug only
# ever looks up *this* caller's own owned rows), not a 403 that would leak
# the database's existence to a non-owner.

def _requested_db_slug() -> str | None:
    slug = (request.args.get("db") or "").strip()
    if slug:
        return slug
    body = request.get_json(silent=True) or {}
    slug = (body.get("db") or "").strip()
    return slug or None


def get_database_by_slug(db, slug: str, identity):
    """A caller's own owned database wins over a public/collection one of
    the same slug, so an identity's personal list always takes priority
    over a same-named public collection."""
    if identity:
        row = db.execute(
            "SELECT * FROM databases WHERE owner_kvstore_url=? AND owner_kvkey=? AND slug=?",
            (identity.iss, identity.username, slug),
        ).fetchone()
        if row:
            return row
    return db.execute(
        "SELECT * FROM databases WHERE owner_kvkey IS NULL AND slug=?", (slug,)
    ).fetchone()


def resolve_database(db, identity, slug: str | None = None, for_write: bool = False):
    """Returns (database_row, None) or (None, (response, status)).
    No slug: falls back to the identity's user_prefs row, or -- if that
    identity owns exactly one database and has never picked one -- that
    single database (so a fresh identity with one personal feed list
    doesn't have to explicitly select it first)."""
    if slug:
        row = get_database_by_slug(db, slug, identity)
        if not row:
            return None, (jsonify({"ok": False, "error": f"Unknown database: {slug}"}), 404)
    else:
        if not identity:
            return None, (jsonify({"ok": False, "error": "db required"}), 400)
        pref = db.execute(
            "SELECT database_id FROM user_prefs WHERE owner_kvstore_url=? AND owner_kvkey=?",
            (identity.iss, identity.username),
        ).fetchone()
        if pref:
            row = db.execute("SELECT * FROM databases WHERE id=?", (pref["database_id"],)).fetchone()
            if not row:
                return None, (jsonify({"ok": False, "error": "Current database no longer exists."}), 404)
        else:
            owned = db.execute(
                "SELECT * FROM databases WHERE owner_kvstore_url=? AND owner_kvkey=?",
                (identity.iss, identity.username),
            ).fetchall()
            if len(owned) == 1:
                row = owned[0]
            elif len(owned) == 0:
                return None, (jsonify({"ok": False, "error": "No databases yet. Import an OPML file to create one."}), 400)
            else:
                return None, (jsonify({"ok": False, "error": "Multiple databases exist; pass ?db=<slug> or select one."}), 400)

    if for_write and row["owner_kvkey"] is None:
        return None, (jsonify({"ok": False, "error": "This database is read-only."}), 403)
    return row, None


def _entry_in_database(db, database_id: int, entry_id: int) -> bool:
    return db.execute(
        "SELECT 1 FROM entries e JOIN database_feeds df "
        "ON df.feed_id = e.feed_id AND df.database_id = ? WHERE e.id = ?",
        (database_id, entry_id),
    ).fetchone() is not None


def _load_statuses(db, database_id: int, entry_ids: list[int]) -> dict:
    if not entry_ids:
        return {}
    placeholders = ",".join("?" * len(entry_ids))
    rows = db.execute(
        f"SELECT entry_id, read_at, bookmarked FROM entry_status "
        f"WHERE database_id=? AND entry_id IN ({placeholders})",
        (database_id, *entry_ids),
    ).fetchall()
    return {r["entry_id"]: (r["read_at"], r["bookmarked"]) for r in rows}


def _item_dict(r, status) -> dict:
    read_at, bookmarked = status or (None, 0)
    return {
        "id": r["id"],
        "feed_title": r["feed_title"] or "(untitled feed)",
        "month_count": int(r["month_count"] or 0),
        "feed_author": r["feed_author"] or None,
        "feed_image": r["feed_image"] or None,
        "feed_url": r["feed_url"] or None,
        "title": r["title"] or "(no title)",
        "link": r["link"],
        "author": r["author"] or "",
        "published": int(r["published"] or now_ts()),
        "content_html": r["content_html"] or "",
        "thumbnail": r["thumbnail"] or None,
        "audio_url": r["audio_url"] or None,
        "bookmarked": int(bookmarked or 0),
        "read_at": read_at,
    }

# -----------------------
# Routes
# -----------------------
@app.route("/")
def index():
    return send_from_directory("static", "index.html")

@app.route("/fetch_feed", methods=["GET"])
def fetch_feed():
    """Proxy endpoint for CList rss.js: fetch a single RSS/Atom feed and return items as JSON.
    Compatible with the opml2json /fetch_feed response format."""
    url = (request.args.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url required"}), 400
    try:
        parsed = feedparser.parse(url)
        feed_title = (parsed.feed.get("title") or "").strip()
        items = []
        for entry in parsed.entries:
            item = {
                "guid":         entry.get("id") or entry.get("link") or "",
                "title":        entry.get("title"),
                "link":         entry.get("link"),
                "author":       (entry.get("author") or "").strip(),
                "published":    entry.get("published"),
                "summary":      entry.get("summary", ""),
                "source":       feed_title or url,
                "full_content": None,
            }
            if entry.get("content"):
                item["full_content"] = entry.content[0].get("value")
            elif entry.get("description"):
                item["full_content"] = entry.get("description")
            if entry.get("published_parsed"):
                item["published_ts"] = safe_struct_time_to_ts(entry.published_parsed)
            else:
                item["published_ts"] = now_ts()
            if entry.get("enclosures"):
                audio = [e["href"] for e in entry.enclosures
                         if (e.get("type") or "").startswith("audio/")]
                if audio:
                    item["audio"] = audio
            items.append(item)
        return jsonify({"ok": True, "title": feed_title, "feed_url": url, "items": items})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/feed_meta", methods=["GET"])
def feed_meta():
    """Public, no auth: return a feed's title and author_did without its
    items. Used by CList's Annotations "follow this author" feature
    (js/annotate.js) to resolve a DID from a feed URL, whether or not this
    instance already tracks that feed.
    Fast path: already-harvested feeds return their stored feed_author_did
    (computed at harvest time, see feed_level_author_did() above) with no
    live fetch. Otherwise falls back to a live parse, same as /fetch_feed."""
    url = (request.args.get("url") or "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url required"}), 400

    db = connect_global()
    row = db.execute("SELECT title, feed_author_did FROM feeds WHERE url=?", (url,)).fetchone()
    db.close()
    if row and row["feed_author_did"]:
        return jsonify({"ok": True, "title": row["title"], "author_did": row["feed_author_did"]})

    try:
        parsed = feedparser.parse(url)
        title = (parsed.feed.get("title") or "").strip() or (row["title"] if row else None)
        author_did = feed_level_author_did(parsed)
        return jsonify({"ok": True, "title": title, "author_did": author_did})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/collections")
def api_collections():
    """Public, unauthenticated: list available collections with feed counts."""
    db = get_db()
    out = []
    for m in _load_collection_manifests():
        row = db.execute(
            "SELECT id FROM databases WHERE owner_kvkey IS NULL AND slug=?", (m["slug"],)
        ).fetchone()
        feed_count = 0
        if row:
            feed_count = db.execute(
                "SELECT COUNT(*) AS c FROM database_feeds WHERE database_id=?", (row["id"],)
            ).fetchone()["c"]
        out.append({"slug": m["slug"], "title": m["title"], "feed_count": feed_count})
    return jsonify(out)

@app.route("/api/collections/<slug>/items")
def api_collection_items(slug: str):
    """Public, unauthenticated: items for one collection. Same shape as
    /api/items but without bookmarked/read_at, since collections are
    anonymous/shared with no personal read-state concept."""
    if not re.match(r"^[A-Za-z0-9_-]+$", slug):
        return jsonify({"error": "invalid slug"}), 404

    db = get_db()
    row = db.execute("SELECT id FROM databases WHERE owner_kvkey IS NULL AND slug=?", (slug,)).fetchone()
    if not row:
        return jsonify({"error": "collection not found"}), 404
    database_id = row["id"]

    limit = int(request.args.get("limit", "200"))
    feed_ids = [r["feed_id"] for r in db.execute(
        "SELECT feed_id FROM database_feeds WHERE database_id=?", (database_id,)
    ).fetchall()]
    if not feed_ids:
        return jsonify([])
    placeholders = ",".join("?" * len(feed_ids))
    cutoff = cutoff_ts()
    rows = db.execute(f"""
      SELECT e.id, e.title, e.link, e.author, e.published, e.content_html, e.thumbnail, e.audio_url,
             f.title AS feed_title, f.month_count, f.feed_author, f.feed_image, f.url AS feed_url
      FROM entries e
      JOIN feeds f ON f.id = e.feed_id
      WHERE e.feed_id IN ({placeholders}) AND e.published >= ?
    """, (*feed_ids, cutoff)).fetchall()

    now = now_ts()
    items = []
    for r in rows:
        pub = int(r["published"] or now)
        mc = int(r["month_count"] or 0)
        items.append({
            "id": r["id"],
            "feed_title": r["feed_title"] or "(untitled feed)",
            "month_count": mc,
            "feed_author": r["feed_author"] or None,
            "feed_image": r["feed_image"] or None,
            "feed_url": r["feed_url"] or None,
            "title": r["title"] or "(no title)",
            "link": r["link"],
            "author": r["author"] or "",
            "published": pub,
            "content_html": r["content_html"] or "",
            "thumbnail": r["thumbnail"] or None,
            "audio_url": r["audio_url"] or None,
            "_score": post_score(pub, mc, now),
        })
    items.sort(key=lambda x: x["_score"], reverse=True)
    items = items[:limit]
    for item in items:
        del item["_score"]
    return jsonify(items)

@app.route("/api/items")
def api_items():
    limit = int(request.args.get("limit", "1600"))
    offset = int(request.args.get("offset", "0"))
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    database_id = database["id"]

    feed_ids = [r["feed_id"] for r in db.execute(
        "SELECT feed_id FROM database_feeds WHERE database_id=?", (database_id,)
    ).fetchall()]
    if not feed_ids:
        return jsonify([])
    feed_id_placeholders = ",".join("?" * len(feed_ids))

    feed_id_param = request.args.get("feed_id")
    if feed_id_param:
        # Full history for one feed - ignores retention cutoff and read state,
        # since the point is to see everything stored, not the reading queue.
        fid = int(feed_id_param)
        if fid not in feed_ids:
            return jsonify({"ok": False, "error": "Feed is not in this database"}), 404
        rows = db.execute("""
          SELECT e.id, e.title, e.link, e.author, e.published, e.content_html, e.thumbnail, e.audio_url,
                 f.title AS feed_title, f.month_count, f.feed_author, f.feed_image, f.url AS feed_url
          FROM entries e JOIN feeds f ON f.id = e.feed_id
          WHERE e.feed_id = ?
          ORDER BY e.published DESC LIMIT ?
        """, (fid, limit)).fetchall()
        statuses = _load_statuses(db, database_id, [r["id"] for r in rows])
        return jsonify([_item_dict(r, statuses.get(r["id"])) for r in rows])

    q = request.args.get("q", "").strip()
    if q:
        # Search across all stored posts in this database regardless of read
        # state or retention cutoff - the point is to find something you
        # remember, not to browse the current reading queue.
        like = f"%{q}%"
        rows = db.execute(f"""
          SELECT e.id, e.title, e.link, e.author, e.published, e.content_html, e.thumbnail, e.audio_url,
                 f.title AS feed_title, f.month_count, f.feed_author, f.feed_image, f.url AS feed_url
          FROM entries e JOIN feeds f ON f.id = e.feed_id
          WHERE e.feed_id IN ({feed_id_placeholders})
            AND (e.title LIKE ? OR e.author LIKE ? OR e.content_html LIKE ?)
          ORDER BY e.published DESC LIMIT ?
        """, (*feed_ids, like, like, like, limit)).fetchall()
        statuses = _load_statuses(db, database_id, [r["id"] for r in rows])
        return jsonify([_item_dict(r, statuses.get(r["id"])) for r in rows])

    filter_mode = request.args.get("filter", "unread").lower()
    cutoff = cutoff_ts()

    if filter_mode == "bookmarked":
        candidate_ids = [r["entry_id"] for r in db.execute(
            "SELECT entry_id FROM entry_status WHERE database_id=? AND bookmarked=1", (database_id,)
        ).fetchall()]
        if not candidate_ids:
            return jsonify([])
        id_placeholders = ",".join("?" * len(candidate_ids))
        rows = db.execute(f"""
          SELECT e.id, e.title, e.link, e.author, e.published, e.content_html, e.thumbnail, e.audio_url,
                 f.title AS feed_title, f.month_count, f.feed_author, f.feed_image, f.url AS feed_url
          FROM entries e JOIN feeds f ON f.id = e.feed_id
          WHERE e.id IN ({id_placeholders})
        """, candidate_ids).fetchall()
        statuses = _load_statuses(db, database_id, [r["id"] for r in rows])
    else:
        rows = db.execute(f"""
          SELECT e.id, e.title, e.link, e.author, e.published, e.content_html, e.thumbnail, e.audio_url,
                 f.title AS feed_title, f.month_count, f.feed_author, f.feed_image, f.url AS feed_url
          FROM entries e JOIN feeds f ON f.id = e.feed_id
          WHERE e.feed_id IN ({feed_id_placeholders}) AND e.published >= ?
        """, (*feed_ids, cutoff)).fetchall()
        statuses = _load_statuses(db, database_id, [r["id"] for r in rows])
        if filter_mode == "read":
            rows = [r for r in rows if statuses.get(r["id"], (None, 0))[0] is not None]
        elif filter_mode == "unread":
            rows = [r for r in rows if statuses.get(r["id"], (None, 0))[0] is None]
        # filter_mode == "all": no further filtering

    now = now_ts()
    items = []
    for r in rows:
        pub = int(r["published"] or now)
        mc = int(r["month_count"] or 0)
        items.append({**_item_dict(r, statuses.get(r["id"])), "_score": post_score(pub, mc, now)})

    items.sort(key=lambda x: x["_score"], reverse=True)
    items = items[offset:offset + limit]

    # Remove internal scoring field before sending to client
    for item in items:
        del item["_score"]

    return jsonify(items)

@app.route("/api/mark_read", methods=["POST"])
def api_mark_read():
    entry_id = int(request.json["id"])
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    if not _entry_in_database(db, database["id"], entry_id):
        return jsonify({"ok": False, "error": "Entry not in this database"}), 404
    with DB_WRITE_LOCK:
        db.execute(
            "INSERT INTO entry_status (database_id, entry_id, read_at, bookmarked) VALUES (?, ?, ?, 0) "
            "ON CONFLICT(database_id, entry_id) DO UPDATE SET read_at=excluded.read_at",
            (database["id"], entry_id, now_ts()),
        )
        db.commit()
    return jsonify({"ok": True})

@app.route("/api/mark_all_read", methods=["POST"])
def api_mark_all_read():
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    database_id = database["id"]
    cutoff = cutoff_ts()
    feed_ids = [r["feed_id"] for r in db.execute(
        "SELECT feed_id FROM database_feeds WHERE database_id=?", (database_id,)
    ).fetchall()]
    if feed_ids:
        placeholders = ",".join("?" * len(feed_ids))
        candidate_ids = [r["id"] for r in db.execute(
            f"SELECT id FROM entries WHERE feed_id IN ({placeholders}) AND published >= ?",
            (*feed_ids, cutoff),
        ).fetchall()]
        if candidate_ids:
            with DB_WRITE_LOCK:
                now = now_ts()
                # COALESCE keeps an already-read entry's original read_at,
                # mirroring the old "WHERE read_at IS NULL" - only entries
                # with no status row yet actually get stamped with `now`.
                db.executemany(
                    "INSERT INTO entry_status (database_id, entry_id, read_at, bookmarked) VALUES (?, ?, ?, 0) "
                    "ON CONFLICT(database_id, entry_id) DO UPDATE SET "
                    "read_at=COALESCE(entry_status.read_at, excluded.read_at)",
                    [(database_id, eid, now) for eid in candidate_ids],
                )
                db.commit()
    return jsonify({"ok": True})

@app.route("/api/toggle_read", methods=["POST"])
def api_toggle_read():
    entry_id = int(request.json["id"])
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    if not _entry_in_database(db, database["id"], entry_id):
        return jsonify({"ok": False, "error": "Entry not in this database"}), 404
    with DB_WRITE_LOCK:
        row = db.execute(
            "SELECT read_at FROM entry_status WHERE database_id=? AND entry_id=?",
            (database["id"], entry_id),
        ).fetchone()
        cur = row["read_at"] if row else None
        new = None if cur else now_ts()
        db.execute(
            "INSERT INTO entry_status (database_id, entry_id, read_at, bookmarked) VALUES (?, ?, ?, 0) "
            "ON CONFLICT(database_id, entry_id) DO UPDATE SET read_at=excluded.read_at",
            (database["id"], entry_id, new),
        )
        db.commit()
    return jsonify({"ok": True, "read": new is not None, "read_at": new})

@app.route("/api/toggle_bookmark", methods=["POST"])
def api_toggle_bookmark():
    entry_id = int(request.json["id"])
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    if not _entry_in_database(db, database["id"], entry_id):
        return jsonify({"ok": False, "error": "Entry not in this database"}), 404
    with DB_WRITE_LOCK:
        row = db.execute(
            "SELECT bookmarked FROM entry_status WHERE database_id=? AND entry_id=?",
            (database["id"], entry_id),
        ).fetchone()
        cur = int(row["bookmarked"] or 0) if row else 0
        new = 0 if cur else 1
        db.execute(
            "INSERT INTO entry_status (database_id, entry_id, read_at, bookmarked) VALUES (?, ?, NULL, ?) "
            "ON CONFLICT(database_id, entry_id) DO UPDATE SET bookmarked=excluded.bookmarked",
            (database["id"], entry_id, new),
        )
        db.commit()
    return jsonify({"ok": True, "bookmarked": new})


@app.route("/api/config")
def api_config():
    return jsonify({
        "db_path": GLOBAL_DB_PATH,
        "db_exists": os.path.exists(GLOBAL_DB_PATH),
        "port": PORT,
        "retention_days": RETENTION_DAYS,
        "user_agent": USER_AGENT,
    })

@app.route("/api/db_list")
def api_db_list():
    db = get_db()
    identity = g.get("identity")
    dbs = []
    current = None
    if identity:
        dbs = [r["slug"] for r in db.execute(
            "SELECT slug FROM databases WHERE owner_kvstore_url=? AND owner_kvkey=? ORDER BY slug",
            (identity.iss, identity.username),
        ).fetchall()]
        pref = db.execute(
            "SELECT database_id FROM user_prefs WHERE owner_kvstore_url=? AND owner_kvkey=?",
            (identity.iss, identity.username),
        ).fetchone()
        if pref:
            d = db.execute("SELECT slug FROM databases WHERE id=?", (pref["database_id"],)).fetchone()
            current = d["slug"] if d else None
    return jsonify({"ok": True, "current": current, "dbs": dbs})

@app.route("/api/db_select", methods=["POST"])
def api_db_select():
    identity = g.get("identity")
    if not identity:
        return jsonify({"ok": False, "error": "Login required"}), 401
    data = request.get_json(silent=True) or {}
    name = (data.get("db") or data.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "error": "db required"}), 400

    db = get_db()
    row = db.execute(
        "SELECT id FROM databases WHERE owner_kvstore_url=? AND owner_kvkey=? AND slug=?",
        (identity.iss, identity.username, name),
    ).fetchone()
    if not row:
        return jsonify({"ok": False, "error": f"Unknown db: {name}"}), 404

    # Unlike the old file-switching model, this only changes which database
    # *this identity's* future requests default to -- it's per-caller state,
    # not a process-global pointer, so it can't race the harvester or any
    # other identity's requests. No "update running" guard needed.
    with DB_WRITE_LOCK:
        db.execute(
            "INSERT INTO user_prefs (owner_kvstore_url, owner_kvkey, database_id) VALUES (?, ?, ?) "
            "ON CONFLICT(owner_kvstore_url, owner_kvkey) DO UPDATE SET database_id=excluded.database_id",
            (identity.iss, identity.username, row["id"]),
        )
        db.commit()

    return jsonify({"ok": True, "current": name, "db_path": GLOBAL_DB_PATH})


def _require_no_running_update():
    if _any_update_job_running():
        return jsonify({"ok": False, "error": "Cannot modify feeds while an update is running."}), 409
    return None


@app.route("/api/feeds")
def api_feeds():
    q = (request.args.get("q") or "").strip()
    limit = int(request.args.get("limit") or "200")
    limit = max(1, min(limit, 1000))

    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    feed_ids = [r["feed_id"] for r in db.execute(
        "SELECT feed_id FROM database_feeds WHERE database_id=?", (database["id"],)
    ).fetchall()]
    if not feed_ids:
        return jsonify({"ok": True, "feeds": []})
    placeholders = ",".join("?" * len(feed_ids))
    if q:
        like = f"%{q}%"
        rows = db.execute(
            f"SELECT id, url, title, feed_author, feed_image, description FROM feeds "
            f"WHERE id IN ({placeholders}) AND (url LIKE ? OR title LIKE ?) "
            f"ORDER BY COALESCE(title, url) LIMIT ?",
            (*feed_ids, like, like, limit),
        ).fetchall()
    else:
        rows = db.execute(
            f"SELECT id, url, title, feed_author, feed_image, description FROM feeds "
            f"WHERE id IN ({placeholders}) ORDER BY COALESCE(title, url) LIMIT ?",
            (*feed_ids, limit),
        ).fetchall()

    return jsonify({"ok": True, "feeds": [
        {
            "id": r["id"], "url": r["url"], "title": r["title"],
            "author": r["feed_author"] or None, "image": r["feed_image"] or None,
            "description": r["description"] or None,
        } for r in rows
    ]})


@app.route("/api/feed/<int:feed_id>")
def api_feed_get(feed_id: int):
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    if not db.execute(
        "SELECT 1 FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
    ).fetchone():
        return jsonify({"ok": False, "error": "Unknown feed"}), 404
    r = db.execute("SELECT id, url, title, fail_count, error_msg, feed_author, feed_image, description FROM feeds WHERE id=?", (feed_id,)).fetchone()
    if not r:
        return jsonify({"ok": False, "error": "Unknown feed"}), 404
    return jsonify({"ok": True, "feed": {
        "id": r["id"], "url": r["url"], "title": r["title"],
        "fail_count": int(r["fail_count"] or 0), "error_msg": r["error_msg"],
        "author": r["feed_author"], "image": r["feed_image"], "description": r["description"],
    }})


def _update_one_feed_now(feed_id: int):
    # Caller should already hold DB_WRITE_LOCK.
    try:
        asyncio.run(update_feeds_async(feed_ids=[feed_id], only_due=False))
    except RuntimeError:
        # If an event loop is already running in this thread (unlikely in Flask), skip.
        pass


@app.route("/api/feed_discover", methods=["POST"])
def api_feed_discover():
    """Discover the RSS/Atom URL for a given website URL without creating a feed."""
    data = request.get_json(silent=True) or {}
    input_url = (data.get("url") or "").strip()
    if not input_url:
        return jsonify({"ok": False, "error": "url required"}), 400
    try:
        feed_url, kind = discover_feed_url(input_url)
        title = None
        try:
            feed_bytes, ct = _fetch_url_bytes(feed_url)
            parsed = feedparser.parse(feed_bytes)
            title = (parsed.feed.get("title") or "").strip() or None
        except Exception:
            pass
        return jsonify({"ok": True, "feed_url": feed_url, "kind": kind, "title": title})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.route("/api/feed_create", methods=["POST"])
def api_feed_create():
    block = _require_no_running_update()
    if block:
        return block

    data = request.get_json(silent=True) or {}
    input_url = (data.get("url") or "").strip()
    if not input_url:
        return jsonify({"ok": False, "error": "url required"}), 400

    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err

    try:
        feed_url, kind = discover_feed_url(input_url)
        feed_bytes, ct = _fetch_url_bytes(feed_url)
        if not _looks_like_feed(ct, feed_bytes):
            return jsonify({"ok": False, "error": "The discovered URL did not look like an RSS/Atom feed."}), 400
        parsed = feedparser.parse(feed_bytes)
        title = (parsed.feed.get("title") or "").strip() or None
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    with DB_WRITE_LOCK:
        existing = db.execute("SELECT id, title FROM feeds WHERE url=?", (feed_url,)).fetchone()
        if existing:
            feed_id = existing["id"]
            if title and not existing["title"]:
                db.execute("UPDATE feeds SET title=? WHERE id=?", (title, feed_id))
            out_title = title or existing["title"]
        else:
            cur = db.execute("INSERT INTO feeds(url,title,next_fetch) VALUES(?,?,?)", (feed_url, title, 0))
            feed_id = cur.lastrowid
            out_title = title

        already_in_db = db.execute(
            "SELECT 1 FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
        ).fetchone() is not None
        db.execute(
            "INSERT OR IGNORE INTO database_feeds (database_id, feed_id, added_at) VALUES (?, ?, ?)",
            (database["id"], feed_id, now_ts()),
        )
        db.commit()

        if not already_in_db:
            # Fetch immediately so the right pane can refresh with new entries.
            _update_one_feed_now(feed_id)

    out = {"id": feed_id, "url": feed_url, "title": out_title}
    return jsonify({"ok": True, "kind": kind, "feed": out, "existing": already_in_db})


@app.route("/api/feed_update", methods=["POST"])
def api_feed_update():
    block = _require_no_running_update()
    if block:
        return block

    data = request.get_json(silent=True) or {}
    feed_id = int(data.get("id") or 0)
    url = (data.get("url") or "").strip()
    title = (data.get("title") or "").strip() or None
    # Manually cleared to blank means "let the harvester fill this back in",
    # so store NULL rather than "" - COALESCE(feed_author, ...) only fills a
    # NULL, never a value someone deliberately typed and saved as empty vs blank.
    author = (data.get("author") or "").strip() or None
    image = (data.get("image") or "").strip() or None
    description = (data.get("description") or "").strip() or None
    if not feed_id:
        return jsonify({"ok": False, "error": "id required"}), 400
    if not url:
        return jsonify({"ok": False, "error": "url required"}), 400
    if not re.match(r"^https?://", url, re.I):
        return jsonify({"ok": False, "error": "URL must start with http:// or https://"}), 400

    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    if not db.execute(
        "SELECT 1 FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
    ).fetchone():
        return jsonify({"ok": False, "error": "Unknown feed"}), 404

    with DB_WRITE_LOCK:
        row = db.execute("SELECT id, url FROM feeds WHERE id=?", (feed_id,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Unknown feed"}), 404

        try:
            # NOTE: editing shared metadata (url/title/author/image) here
            # affects every other database that also references this feed.
            if url != row["url"]:
                db.execute(
                    "UPDATE feeds SET url=?, title=?, feed_author=?, feed_image=?, description=?, etag=NULL, last_modified=NULL, fail_count=0, next_fetch=0 WHERE id=?",
                    (url, title, author, image, description, feed_id),
                )
            else:
                db.execute(
                    "UPDATE feeds SET title=?, feed_author=?, feed_image=?, description=? WHERE id=?",
                    (title, author, image, description, feed_id),
                )
            db.commit()
        except sqlite3.IntegrityError:
            return jsonify({"ok": False, "error": "A feed with that URL already exists."}), 409

        # Refresh entries after update.
        _update_one_feed_now(feed_id)
        out = {"id": feed_id, "url": url, "title": title, "author": author, "image": image}
        return jsonify({"ok": True, "feed": out})


@app.route("/api/feed_delete", methods=["POST"])
def api_feed_delete():
    block = _require_no_running_update()
    if block:
        return block

    data = request.get_json(silent=True) or {}
    feed_id = int(data.get("id") or 0)
    if not feed_id:
        return jsonify({"ok": False, "error": "id required"}), 400

    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err

    with DB_WRITE_LOCK:
        if not db.execute(
            "SELECT 1 FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
        ).fetchone():
            return jsonify({"ok": False, "error": "Unknown feed"}), 404

        # Membership-only delete: removing a feed from one database must
        # never blow away the entries/history another database still shares
        # it with. Only reclaim the feed globally once nothing lists it.
        db.execute(
            "DELETE FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
        )
        db.execute(
            "DELETE FROM entry_status WHERE database_id=? AND entry_id IN "
            "(SELECT id FROM entries WHERE feed_id=?)",
            (database["id"], feed_id),
        )

        still_referenced = db.execute(
            "SELECT 1 FROM database_feeds WHERE feed_id=?", (feed_id,)
        ).fetchone()
        if not still_referenced:
            db.execute(
                "DELETE FROM entry_status WHERE entry_id IN (SELECT id FROM entries WHERE feed_id=?)",
                (feed_id,),
            )
            db.execute("DELETE FROM entries WHERE feed_id=?", (feed_id,))
            db.execute("DELETE FROM feeds WHERE id=?", (feed_id,))
        db.commit()

    return jsonify({"ok": True})

@app.route("/api/feeds_errors")
def api_feeds_errors():
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    rows = db.execute(
        "SELECT f.id, f.url, f.title, f.fail_count, f.error_msg, f.last_fetch, f.last_ok "
        "FROM feeds f JOIN database_feeds df ON df.feed_id = f.id "
        "WHERE df.database_id=? AND f.fail_count > 0 ORDER BY f.fail_count DESC, COALESCE(f.title, f.url)",
        (database["id"],),
    ).fetchall()
    return jsonify({"ok": True, "feeds": [{
        "id": r["id"], "url": r["url"], "title": r["title"],
        "fail_count": int(r["fail_count"] or 0), "error_msg": r["error_msg"],
        "last_fetch": r["last_fetch"], "last_ok": r["last_ok"],
    } for r in rows]})


@app.route("/api/feed_retry", methods=["POST"])
def api_feed_retry():
    block = _require_no_running_update()
    if block:
        return block

    data = request.get_json(silent=True) or {}
    feed_id = int(data.get("id") or 0)
    if not feed_id:
        return jsonify({"ok": False, "error": "id required"}), 400

    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug(), for_write=True)
    if err:
        return err
    if not db.execute(
        "SELECT 1 FROM database_feeds WHERE database_id=? AND feed_id=?", (database["id"], feed_id)
    ).fetchone():
        return jsonify({"ok": False, "error": "Unknown feed"}), 404

    with DB_WRITE_LOCK:
        db.execute(
            "UPDATE feeds SET fail_count=0, next_fetch=0, error_msg=NULL WHERE id=?",
            (feed_id,)
        )
        db.commit()
        _update_one_feed_now(feed_id)

        r = db.execute(
            "SELECT id, url, title, fail_count, error_msg, last_ok FROM feeds WHERE id=?",
            (feed_id,)
        ).fetchone()

    return jsonify({"ok": True, "feed": {
        "id": r["id"], "url": r["url"], "title": r["title"],
        "fail_count": int(r["fail_count"] or 0), "error_msg": r["error_msg"],
        "last_ok": r["last_ok"],
    }})


@app.route("/api/stats")
def api_stats():
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    database_id = database["id"]
    feed_ids = [r["feed_id"] for r in db.execute(
        "SELECT feed_id FROM database_feeds WHERE database_id=?", (database_id,)
    ).fetchall()]
    feeds = len(feed_ids)
    bookmarked = db.execute(
        "SELECT COUNT(*) AS c FROM entry_status WHERE database_id=? AND bookmarked=1", (database_id,)
    ).fetchone()["c"]
    # Podcast icon (CList's accountIcon()) should reflect the database as a whole,
    # not flip on permanently the first time any single enclosure is seen -- so
    # count audio vs. total entries across every feed in this database here.
    audio_entries = total_entries = 0
    if feed_ids:
        placeholders = ",".join("?" * len(feed_ids))
        row = db.execute(
            f"SELECT COUNT(*) AS total, "
            f"SUM(CASE WHEN audio_url IS NOT NULL AND audio_url != '' THEN 1 ELSE 0 END) AS audio "
            f"FROM entries WHERE feed_id IN ({placeholders})",
            feed_ids,
        ).fetchone()
        total_entries = row["total"] or 0
        audio_entries = row["audio"] or 0
    has_audio_majority = total_entries > 0 and audio_entries > total_entries / 2
    unread = 0
    if feed_ids:
        placeholders = ",".join("?" * len(feed_ids))
        candidate_ids = [r["id"] for r in db.execute(
            f"SELECT id FROM entries WHERE feed_id IN ({placeholders}) AND published >= ?",
            (*feed_ids, cutoff_ts()),
        ).fetchall()]
        if candidate_ids:
            id_placeholders = ",".join("?" * len(candidate_ids))
            read_count = db.execute(
                f"SELECT COUNT(*) AS c FROM entry_status WHERE database_id=? AND entry_id IN ({id_placeholders}) AND read_at IS NOT NULL",
                (database_id, *candidate_ids),
            ).fetchone()["c"]
            unread = len(candidate_ids) - read_count
    return jsonify({
        "feeds": feeds,
        "unread": unread,
        "bookmarked": bookmarked,
        "retention_days": RETENTION_DAYS,
        "scheduler_enabled": _scheduler_enabled,
        "has_audio_majority": has_audio_majority,
    })

@app.route("/api/update_start", methods=["POST"])
def api_update_start():
    job_id = start_update_job(full_sweep=True)
    return jsonify({"ok": True, "job_id": job_id})

@app.route("/api/update_progress")
def api_update_progress():
    job_id = request.args.get("job_id")
    if not job_id:
        return jsonify({"ok": False, "error": "job_id required"}), 400
    job = get_job(job_id)
    if not job:
        return jsonify({"ok": False, "error": "unknown job_id"}), 404
    return jsonify({"ok": True, "job": job})

@app.route("/api/update_cancel", methods=["POST"])
def api_update_cancel():
    job_id = (request.json or {}).get("job_id")
    if not job_id:
        return jsonify({"ok": False, "error": "job_id required"}), 400
    ok = cancel_update_job(job_id)
    return jsonify({"ok": ok})

@app.route("/api/scheduler", methods=["POST"])
def api_scheduler():
    global _scheduler_enabled
    enabled = bool((request.json or {}).get("enabled"))
    _scheduler_enabled = enabled
    return jsonify({"ok": True, "scheduler_enabled": _scheduler_enabled})


@app.route("/api/opml_export")
def api_opml_export():
    db = get_db()
    database, err = resolve_database(db, g.get("identity"), slug=_requested_db_slug())
    if err:
        return err
    feeds = db.execute(
        "SELECT f.url, f.title FROM feeds f JOIN database_feeds df ON df.feed_id=f.id "
        "WHERE df.database_id=? ORDER BY COALESCE(f.title, f.url)",
        (database["id"],),
    ).fetchall()
    data = _build_opml([{"url": r["url"], "title": r["title"]} for r in feeds])
    return Response(
        data,
        mimetype="text/xml",
        headers={"Content-Disposition": "attachment; filename=feeds.opml"},
    )

@app.route("/api/opml_import", methods=["POST"])
def api_opml_import():
    f = request.files.get("opml")
    if not f:
        return jsonify({"ok": False, "error": "Missing file field 'opml'."}), 400

    mode = (request.form.get("mode") or "merge").strip().lower()
    new_db_name = (request.form.get("new_db_name") or "").strip()

    try:
        pairs = _parse_opml(f.read())
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if mode not in ("merge", "replace", "newdb"):
        return jsonify({"ok": False, "error": f"Unknown mode: {mode}"}), 400

    identity = g.get("identity")
    db = get_db()
    imported = 0
    skipped = 0

    with DB_WRITE_LOCK:
        if mode == "newdb":
            if not identity:
                return jsonify({"ok": False, "error": "Login required"}), 401
            slug = _sanitize_slug(new_db_name) or ("rss_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
            existing = db.execute(
                "SELECT 1 FROM databases WHERE owner_kvstore_url=? AND owner_kvkey=? AND slug=?",
                (identity.iss, identity.username, slug),
            ).fetchone()
            if existing:
                return jsonify({"ok": False, "error": f"Database already exists: {slug}"}), 400

            cur = db.execute(
                "INSERT INTO databases (slug, title, owner_kvstore_url, owner_kvkey, created_at) VALUES (?, ?, ?, ?, ?)",
                (slug, new_db_name or slug, identity.iss, identity.username, now_ts()),
            )
            database_id = cur.lastrowid

            for url, title in pairs:
                feed_id = _ensure_global_feed(db, url, title)
                cur2 = db.execute(
                    "INSERT OR IGNORE INTO database_feeds (database_id, feed_id, added_at) VALUES (?, ?, ?)",
                    (database_id, feed_id, now_ts()),
                )
                if cur2.rowcount == 1:
                    imported += 1
                else:
                    skipped += 1
            db.commit()
            return jsonify({"ok": True, "mode": mode, "imported": imported, "skipped": skipped, "db": slug})

        # merge/replace operate on the resolved database
        database, err = resolve_database(db, identity, slug=_requested_db_slug(), for_write=True)
        if err:
            return err
        database_id = database["id"]

        if mode == "replace":
            old_feed_ids = [r["feed_id"] for r in db.execute(
                "SELECT feed_id FROM database_feeds WHERE database_id=?", (database_id,)
            ).fetchall()]
            db.execute(
                "DELETE FROM entry_status WHERE database_id=? AND entry_id IN "
                "(SELECT id FROM entries WHERE feed_id IN (SELECT feed_id FROM database_feeds WHERE database_id=?))",
                (database_id, database_id),
            )
            db.execute("DELETE FROM database_feeds WHERE database_id=?", (database_id,))
            for feed_id in old_feed_ids:
                still_referenced = db.execute(
                    "SELECT 1 FROM database_feeds WHERE feed_id=?", (feed_id,)
                ).fetchone()
                if not still_referenced:
                    db.execute(
                        "DELETE FROM entry_status WHERE entry_id IN (SELECT id FROM entries WHERE feed_id=?)",
                        (feed_id,),
                    )
                    db.execute("DELETE FROM entries WHERE feed_id=?", (feed_id,))
                    db.execute("DELETE FROM feeds WHERE id=?", (feed_id,))

        for url, title in pairs:
            feed_id = _ensure_global_feed(db, url, title)
            cur = db.execute(
                "INSERT OR IGNORE INTO database_feeds (database_id, feed_id, added_at) VALUES (?, ?, ?)",
                (database_id, feed_id, now_ts()),
            )
            if cur.rowcount == 1:
                imported += 1
            else:
                skipped += 1

        db.commit()

    return jsonify({"ok": True, "mode": mode, "imported": imported, "skipped": skipped})

# Run schema creation + migrations, collections setup, and the background
# scheduler at import time (covers gunicorn and direct invocation). This is
# the real production startup path: under gunicorn, `if __name__ == "__main__"`
# below never executes, since gunicorn imports this module rather than
# running it as a script.
try:
    init_db()
except Exception as _e:
    print(f"[WARN] init_db failed at startup: {_e}", file=sys.stderr)

try:
    with COLLECTIONS_WRITE_LOCK:
        ensure_collections()
except Exception as _e:
    print(f"[WARN] ensure_collections failed at startup: {_e}", file=sys.stderr)

start_background_scheduler()


def import_feeds_txt(path: str = "feeds.txt"):
    if not os.path.exists(path):
        return 0
    con = connect_global()
    n = 0
    with open(path, "r", encoding="utf-8") as f:
        con.execute("BEGIN")
        try:
            for line in f:
                u = line.strip()
                if not u or u.startswith("#"):
                    continue
                ensure_feed(con, u)
                n += 1
            con.commit()
        except Exception:
            con.rollback()
            raise
    con.close()
    return n

def _is_server_running(host: str, port: int, timeout: float = 0.25) -> bool:
    import socket
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def acquire_single_instance_lock(lockfile: str = ".localrss.lock") -> object | None:
    """
    Cross-platform best-effort single-instance lock.
    - Windows: msvcrt.locking
    - POSIX: fcntl.flock
    Returns an open file handle if lock acquired, else None.
    Keep the returned handle alive for the lifetime of the process.
    """
    try:
        f = open(lockfile, "a+b")
    except Exception:
        return None

    try:
        if os.name == "nt":
            import msvcrt
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
                return f
            except OSError:
                try:
                    f.close()
                except Exception:
                    pass
                return None
        else:
            import fcntl
            try:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                return f
            except OSError:
                try:
                    f.close()
                except Exception:
                    pass
                return None
    except Exception:
        try:
            f.close()
        except Exception:
            pass
        return None



def import_default_opml_if_needed(path: str = "feeds.opml") -> int:
    """If the feeds table is empty and an OPML file exists, import it (no
    duplicates). Desktop/local bootstrap only -- these feeds land in the
    global table with no `database_feeds` membership yet, since there is no
    identity to own a database at this point in startup. A first-run desktop
    user still needs to create/select a personal database (e.g. via OPML
    import mode=newdb through the UI) to see them."""
    if not os.path.exists(path):
        return 0
    con = connect_global()
    try:
        cur = con.execute("SELECT COUNT(*) FROM feeds")
        count = int(cur.fetchone()[0] or 0)
        if count > 0:
            return 0
        xml_bytes = open(path, "rb").read()
        pairs = _parse_opml(xml_bytes)  # list of (url, title)
        n = 0
        con.execute("BEGIN")
        try:
            for url, title in pairs:
                if not url:
                    continue
                con.execute(
                    "INSERT OR IGNORE INTO feeds(url, title, next_fetch) VALUES(?, ?, 0)",
                    (url, title or None),
                )
                n += 1
            con.commit()
        except Exception:
            con.rollback()
            raise
        return n
    finally:
        con.close()


if __name__ == "__main__":
    init_db()

    print(f"[INFO] LocalRSSReader v{APP_VERSION} starting…")
    print(f"[INFO] Using database: {GLOBAL_DB_PATH}")

    try:
        imported = import_default_opml_if_needed("feeds.opml")
        if imported:
            print(f"[INFO] Imported {imported} feeds from feeds.opml (empty DB).")
    except Exception as e:
        print(f"[WARN] Could not import default feeds.opml: {e}", file=sys.stderr)

    # Prevent accidental double-launch (common when double-clicking the .bat twice)
    lock_handle = acquire_single_instance_lock(".localrss.lock")
    if lock_handle is None:
        # Another instance likely running; just exit quietly.
        # (The .bat file will open the browser.)
        raise SystemExit(0)

    # If port already has a server, exit (avoids a second python process)
    if _is_server_running("127.0.0.1", PORT):
        raise SystemExit(0)

    # start_background_scheduler() already ran at module import time above.
    app.run(host="127.0.0.1", port=PORT, debug=False, threaded=True)
