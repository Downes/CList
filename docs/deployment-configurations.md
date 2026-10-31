# Deployment Configurations

CList makes two choices independently of each other: where its **files** come from, and where
its **data** is stored. Neither choice depends on the other, so combining them gives six
configurations. This doc describes all six, what works today, and what's still planned.

## Where the files come from

1. **Hosted web** — served over HTTPS by a web server (the default: `clist.mooc.ca`, or your own
   domain).
2. **Local desktop app** — the prebuilt launcher (`launcher.py`, or a packaged `CList.exe` /
   `CList-macos` / `CList-linux` binary). It starts a local HTTP(S) server on `127.0.0.1` and
   proxies kvstore API calls through it, so no CORS configuration is needed for that path.
3. **`file://`** — the raw folder of `index.html` + `css/` + `js/` opened directly from disk, no
   server or script involved at all.

## Where data is stored

CList actually has two separate data axes that each follow this same local-vs-remote shape, and a
user can set them independently:

- **Credentials / identity** — a kvstore instance (e.g. `kvstore.mooc.ca`) or the built-in Local
  account mode (browser `localStorage`, no server). See [storage-model.md](storage-model.md).
- **Feed-reading data** (subscriptions, read/unread state, bookmarks) — browser `IndexedDB`
  (today's only option — see below) or a [LocalRSS](https://github.com/Downes/localrss_reader)
  instance, run locally (preferred) or remotely.

## The six configurations

| # | Files served from | Data target |
|---|---|---|
| 1 | Hosted web (`clist.mooc.ca`) | Local (IndexedDB / `localStorage`) |
| 2 | Hosted web (`clist.mooc.ca`) | Remote service (kvstore / LocalRSS instance) |
| 3 | Local desktop app (launcher) | Local (IndexedDB / `localStorage`) |
| 4 | Local desktop app (launcher) | Remote service (kvstore / LocalRSS instance) |
| 5 | `file://` | Local (IndexedDB / `localStorage`) |
| 6 | `file://` | Remote service (kvstore / LocalRSS instance) |

### Credentials / identity — status: all six work today

| # | Works? | Notes |
|---|---|---|
| 1 | Yes | Default hosted experience, real cookies |
| 2 | Yes | `localStorage`, no network call |
| 3 | Yes | Launcher proxies kvstore calls through `127.0.0.1`, no CORS needed |
| 4 | Yes | `localStorage`, no network call |
| 5 | Yes | `localStorage`, no network call |
| 6 | **No** — known, accepted gap | kvstore's CORS allow-list has no `file://`/`null`-origin entry. Deferred by explicit user decision; revisit as part of a future security-hardening pass. |

### Feed-reading data — status: not yet built

Today, **all six configurations behave identically**: CList's personal "RSS" reader always
fetches through the [opml2json](https://github.com/Downes/opml2json) proxy (stateless — it has no
storage of its own) and always caches entries, read state, and bookmarks in browser `IndexedDB`
(`js/rss.js`). There is currently no way to point personal feed data at LocalRSS, local or remote
— that integration doesn't exist yet in `rss.js`.

The one place LocalRSS is already wired into CList is the **public, anonymous "Collections"**
feature (`js/public-feeds.js`, reading `https://localrss.downes.ca/api/collections*`) — curated,
no-login feed lists. That works in all six configurations already, because those endpoints are
served with `Access-Control-Allow-Origin: *`. It's a different feature from a user's own
subscriptions, though, and doesn't help with personal harvesting.

**What "run LocalRSS locally" would need**, in order of what's blocking it — see
[localrss_reader](https://github.com/Downes/localrss_reader)'s own `CLAUDE.md` for the full
writeup:

1. LocalRSS's Flask app has no CORS handling of its own — only the Caddy proxy in front of the
   *hosted* instance (`localrss.downes.ca`) adds CORS headers. A plain local run (`run_localrss.sh`,
   the Windows tray app, or a bare `docker compose up`) answers with none at all, so no browser
   page — hosted, desktop-launcher, or `file://` — can currently `fetch()` it, regardless of which
   of the six configurations you're in. This is the first thing to fix.
2. CList's `rss.js` needs a real integration path to a LocalRSS instance's `/api/*` routes
   (feeds, items, mark_read, toggle_bookmark) as an alternative backing store to IndexedDB — most
   naturally a new account type with a configurable instance URL, the same pattern `OPML2JSON`
   already uses (`kvKey`/`instance`), so a user can point it at `http://localhost:8787` or a remote
   instance like `https://localrss.mooc.ca`.
3. Local-first-with-remote-fallback behavior (probe a local instance, prefer it, fall back to
   the configured remote one, fall back further to IndexedDB if neither is reachable) is new
   application logic that doesn't exist today in either codebase.
4. Configs 3/4 (desktop launcher origin) and 5/6 (`file://` origin) would additionally need either
   a CORS allow-list entry for those origins on any *remote* LocalRSS instance (same class of gap
   as credentials/case 6 above), or routing through the launcher's local proxy the way kvstore
   calls already are.

LocalRSS itself is already fully capable of running locally on all three major desktop platforms
— see its `README_DESKTOP.md` (Windows, with system-tray + SSH DB sync), `RUNNING_ON_MAC_LINUX.md`
(pre-alpha shell script), and its `Dockerfile`/`docker-compose.yml` (same image, run anywhere). The
gap is entirely on the integration side, not the "can LocalRSS run locally" side.
