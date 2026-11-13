# Deployment configurations

Client/bundled-backend integration status checked against this checkout,
2026-11-13. These are supported code paths and known constraints, not a live
health or CORS audit of remote installations.

## Independent choices

CList's static files can be hosted over HTTPS, served by the desktop launcher,
or opened through `file://`. Account storage can independently use the built-in
Local account store or a selected remote kvstore. The Local store uses IndexedDB;
browser/session storage also holds configuration and session information. See
[storage-model.md](storage-model.md) for the storage boundary.

Feed data is a separate choice. `js/localrss.js` integrates a LocalRSS database
through its APIs; it is not the old `rss.js`/opml2json IndexedDB feed reader.
`js/public-feeds.js` additionally reads anonymous public collections. A local
CList login and a locally running LocalRSS service are different things.

| Files | Account store | Client path / constraint |
|---|---|---|
| Hosted HTTPS | Local | Browser IndexedDB account store; no remote kvstore login |
| Hosted HTTPS | Remote kvstore | Selected server, with its HTTPS/CORS configuration |
| Desktop launcher | Local | Browser IndexedDB account store on the launcher's origin |
| Desktop launcher | Remote kvstore | Launcher's same-origin kvstore relay |
| `file://` | Local | Browser storage availability and origin behaviour must support this mode |
| `file://` | Remote kvstore | Subject to null-origin/CORS restrictions; no blanket support is asserted |

The launcher uses a fixed default port to preserve the browser origin and its
stored data. Running `python launcher.py` serves the current source directory;
a packaged executable serves its bundled snapshot. Updating source does not
change an already built executable. Close an existing instance before switching
between builds, otherwise the launcher can reopen the already running server.

## LocalRSS resolution and authentication

A LOCALRSS account supplies `serviceUrl` and `database`. On activation, the reader
probes `http://localhost:8787`, prefers it if reachable, and otherwise uses the
configured service. Under the desktop launcher, remote fallback can use the
launcher's generic relay. The configured URL is retained separately from the
transient `_effectiveServiceUrl`.

If `localrss_bundled/app.py` is included, the launcher can start that backend when
the conventional LocalRSS port is free. The bundled backend implements loopback
CORS handling, including preflight requests. The hosted deployment still relies
on its reverse proxy configuration. A remote service may run a different version
from the bundled snapshot.

Personal LocalRSS APIs receive a Bearer token and `X-Kvstore-Url` identifying its
issuer. They verify a server-backed CList identity, including when LocalRSS itself
runs on the user's machine. A Local-only browser account does not issue a token
that this backend can verify. The relay changes request routing; it does not
bypass authentication or create a remotely verifiable identity.

## Public and personal feed collections

Anonymous collection discovery and items use `/api/collections` and
`/api/collections/{slug}/items`. Their base URL is `CList.defaults.LOCALRSS`.
The unmodified combined CList Changelog instead aggregates the documented GitHub
commit APIs in the browser. When copied for personal editing, its sources are
represented as Atom feeds harvested by LocalRSS.

Registration seeds the available public collections as ordinary PublicFeed
accounts. Their first Edit Feed Collection action makes an owned LocalRSS copy;
LOCALRSS accounts edit their existing database. Both use the shared Collections
editor and its registered save capability. A local-only user can read anonymous
public collections and manage account records, but personal feed editing still
requires a server-backed identity. Discovery/network failures are reported; the
client does not silently authenticate a local-only account to a remote service.

Read > Collections combines saved content collections and account-backed feed
collections. Ordinary collection records use the selected local/remote KV store.
Feed memberships, harvested entries, and read state belong to LocalRSS. See
[collection-publishing.md](collection-publishing.md) for the binding, save request,
registry operations, and public-versus-personal boundaries.

## Publication

Platform accounts and page/bin publishers still require their own services,
credentials, permissions, and network access. Local account storage does not
make external publication available offline. `CListBin` and LocalRSS integrations
that verify kvstore identity need a server-backed session. See
[publish_structure.md](publish_structure.md) for platform posting and
[collection-publishing.md](collection-publishing.md) for bin publication.
