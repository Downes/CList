# OAuth Desktop Launcher — Feasibility Assessment and Plan

## Summary

The proposed architecture is sound and feasible for CList. The dependency-free
constraint, PKCE requirement, and strategy-pattern design all fit the existing
codebase well. Four issues need to be designed before implementation begins;
they are not blockers, but they require decisions.

---

## Feasibility

**Frontend OAuth module** — Straightforward. CList already has no build step.
Three new vanilla JS files (`oauth-config.js`, `oauth-client.js`,
`oauth-strategies.js`) load as ordinary `<script>` tags. No changes to the
build process or deployment.

**Python launcher** — Standard library only is sufficient. `http.server` +
`socketserver` handles static serving and `/callback`; `urllib.request` handles
the token exchange. `webbrowser.open()` works on Windows, macOS, and Linux.
PyInstaller bundles `sys._MEIPASS` path resolution correctly for this pattern.
Expected binary size: 8–20 MB.

**PKCE** — The browser has `crypto.subtle` (SubtleCrypto), which provides
`SHA-256` natively. `code_verifier` and `code_challenge` can be generated with
a few lines of vanilla JS. No library needed.

**Strategy pattern** — `detectRuntimeMode()` based on `window.location.protocol`
and hostname is reliable. The three modes map cleanly to CList's actual
deployment scenarios.

---

## Security Assessment

The plan is a net improvement over the current implementation. Specific gains:

| Issue in current code | Fixed by plan |
|---|---|
| `state` hardcoded to the string `'Mastodon'` (not random) | Random `state` with sessionStorage validation |
| No PKCE — code interception possible | PKCE S256 required |
| `client_secret` stored in `sessionStorage` and sent to token endpoint | No client secret; PKCE replaces it |
| Dead code in `redirect.html` (`getAccessToken()`) calls `document.write(access_token)` — would log token to page | Addressed by "do not log tokens" requirement |

Remaining security notes:
- Mastodon dynamic app registration does produce a `client_secret`, but since
  the app is registered fresh per flow, it is effectively a one-time value.
  The plan's no-secret design is correct: the secret should be discarded after
  the token exchange, not stored.
- `127.0.0.1` binding (not `0.0.0.0`) is correct for the launcher.
- Token storage destination (sessionStorage vs. kvstore) needs to be specified
  — see Issue 3 below.

---

## Compatibility

### What redirect.html currently does

`redirect.html` is a shared callback page for three separate flows:

1. **kvstore login** — receives `?token=&username=` from kvstore, sets cookies,
   closes the window.
2. **Mastodon OAuth** — receives `?code=&state=Mastodon`, exchanges code for
   token, stores result in `localStorage`, redirects to `/`.
3. **Reddit** — stub only, not implemented.

A new `/callback` page must absorb flows 1 and 2, or the two flows must be
separated. The simplest path: keep `redirect.html` for the kvstore login flow
(it has nothing to do with OAuth) and route Mastodon OAuth to a new
`/callback` handler.

Because Mastodon apps are **dynamically registered** on each OAuth flow, the
redirect URI is set at registration time — changing it from `/redirect.html`
to `/callback` does not break any stored accounts.

---

## Issues Requiring Design Decisions

### Issue 1 — Mastodon requires dynamic app registration; `clientId` is not static

The proposed `oauth.config.example.json` has a static `clientId` field. This
works for providers like GitHub or Google where you register once and get a
permanent client ID.

Mastodon works differently: the client calls `POST /api/v1/apps` to register a
new OAuth application on each instance it connects to, receiving a fresh
`client_id` and `client_secret` pair. These vary per instance and must either be
re-generated each time or cached per instance.

**Options:**
- A. Cache `client_id` per instance in `localStorage` (keyed by instance URL)
  after first registration. Reuse on subsequent flows to the same instance.
- B. Re-register on every OAuth flow (current behavior). Simple but wasteful.
- C. Add a `dynamicRegistration: true` flag to `oauth.config.json` so the module
  knows to call the registration endpoint before starting the flow.

Recommendation: Option A + C. Cache per-instance, add the flag to config.

### Issue 2 — Multi-account model does not fit a single-instance OAuth API

CList supports N Mastodon accounts from N different instances simultaneously.
The proposed `login()` / `getAccessToken()` API is single-session.

The module needs to accept an instance/account identifier so that:
- `login(instanceUrl, username)` starts the flow for a specific account
- `getAccessToken(instanceUrl)` retrieves the token for a specific instance
- State and PKCE values in sessionStorage are keyed per flow (already handled
  by random `state`, but needs to be explicit in the API)

### Issue 3 — Token storage is kvstore, not sessionStorage

The spec says tokens are stored in `sessionStorage`. In CList, Mastodon access
tokens are stored encrypted in kvstore (via `saveMastodonAccount()` in
`mastodon.js`). `getAccessToken()` would need to decrypt from kvstore, not read
from sessionStorage.

PKCE temporaries (`code_verifier`, `state`) belong in `sessionStorage` (correct
as specified). The final access token belongs in kvstore.

The OAuth module needs a `tokenStorage` abstraction or the `getAccessToken()`
function needs to call into kvstore. The simplest approach: after the callback,
`handleCallback()` returns the token to the caller (`saveMastodonAccount()`),
which does the kvstore write. The module does not own persistence.

### Issue 4 — Existing `redirect.html` dead code

`redirect.html` contains a dead `getAccessToken()` function (lines 144–168)
with undefined constants (`CLIENT_ID`, `CLIENT_SECRET`) and a
`document.write(access_token)` call that would print the token to the page if
it ever ran. This should be removed before or during the OAuth refactor.

---

## Efficiency

The plan is efficient. Specific notes:

- Three JS files vs. one is fine for a no-build app. Load order: `oauth-config.js`
  → `oauth-strategies.js` → `oauth-client.js`.
- The strategy abstraction is not over-engineered given the stated mobile roadmap.
- The Python launcher binary will be 8–20 MB, acceptable for a standalone desktop
  tool that removes the Python install requirement.
- PyInstaller `--onefile` mode is correct. Use `--noconsole` on Windows to avoid
  a terminal window appearing.

---

## Implementation Plan

### Phase 1 — Cleanup (prerequisite)
- Remove dead `getAccessToken()` function from `redirect.html`
- Separate kvstore login callback from Mastodon OAuth callback in `redirect.html`
  (kvstore stays at `/redirect.html`; Mastodon moves to `/callback`)

### Phase 2 — Frontend OAuth module
- Create `js/oauth-config.js` — config loader, supports `dynamicRegistration`
- Create `js/oauth-strategies.js` — `hosted-web`, `desktop-local`, `file` strategies
  plus `mobile-native` placeholder
- Create `js/oauth-client.js` — `login()`, `handleCallback()`, `getAccessToken()`,
  `logout()`, `detectRuntimeMode()`
- Refactor `mastodon.js`: `mastodonOAuthStart()` delegates to `oauth-client.js`;
  `handleMastodonCallback()` in `redirect.html` delegates to `handleCallback()`
- Add random `state`, PKCE S256 to the Mastodon flow
- Add per-instance `client_id` caching in `localStorage`

### Phase 3 — Python launcher
- Create `launcher.py` (stdlib only)
- Static file server on `127.0.0.1`, random port
- `/callback` returns `index.html` (JS handles the OAuth response)
- `/oauth/token` proxies code exchange to provider token endpoint
- `webbrowser.open()` on startup
- No token logging

### Phase 4 — Packaging
- Create `build-windows.ps1`, `build-macos.sh`, `build-linux.sh`
- Create `oauth.config.example.json`
- Create `callback.html` (or reuse `index.html` for `/callback`)

### Phase 5 — Documentation
- Update wiki page B1 (Add Mastodon to CList) with desktop launcher section
- Add `docs/oauth-desktop-readme.md`

---

## Files Affected

| File | Change |
|---|---|
| `redirect.html` | Remove dead code; split kvstore vs Mastodon handling |
| `js/mastodon.js` | Delegate OAuth to new module; add PKCE; cache client_id |
| `js/oauth-config.js` | New |
| `js/oauth-strategies.js` | New |
| `js/oauth-client.js` | New |
| `launcher.py` | New |
| `oauth.config.example.json` | New |
| `build-windows.ps1` | New |
| `build-macos.sh` | New |
| `build-linux.sh` | New |
| `index.html` | Add three new script tags |

---

*Recorded 2026-05-11. Not yet started.*
