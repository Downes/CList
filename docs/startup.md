# Startup sequence

`index.html` declares the configuration, CSS, static shell, core script tags and
an ordered `app-feature-scripts` JSON manifest. `app-startup.js` coordinates two
phases without a bundler or changes to stored data.

## Core shell

The coordinator and eleven existing modules load first: local storage routing,
utilities, shared UI, kvstore helpers, the three session lifecycle modules,
the three pane modules and `interface.js` (last in this core list).

After core scripts and DOM parsing finish, `initializeSessionControls()` reads
the captured session and imports its saved encryption key. The session view
signals when it has rendered the correct authenticated/guest controls. No service
registry, remote account read or feature download is needed for this step.
Pane layout restores, then two animation frames allow the shell to paint.

## Background features

Only then does the coordinator request feature modules, sequentially in manifest
order, yielding periodically. Successful files are remembered for this page load.
This preserves the global registries and plain JavaScript declaration order.

The account workflow waits for every schema to register before reading/decrypting
and filtering account records. Captured session checks still apply after that
wait. The coordinator enables feature controls after account initialization has
settled, retaining their original disabled state. Logout and basic pane controls
remain available while tools load.

Navigation, editor indicators, tags and OAuth callback pickup use
`CList.startup.afterFeatures(callback)` instead of relying on an already-fired
DOMContentLoaded event. Callback failures receive visible feedback. Guest public
feed choices render after registration. TinyMCE, Google Identity and PeerJS
remain on demand even after the local feature files have loaded.

## Failures and maintenance

Network failures offer Retry, resuming without reexecuting successful scripts.
Evaluation failures or timeout offer Reload because partially executed or late
scripts cannot safely be replayed. Failed background loading keeps feature
controls gated and account interpretation waiting; it does not clear storage or
claim that missing schemas mean missing accounts.

Add feature scripts to the JSON manifest in dependency order. Add to the core
list only when required to render the shell or restore session identity.
Background files must not install startup work solely through DOMContentLoaded.
Do not put account bodies, credentials or callbacks in `CList.state.appStartup`.

Lightweight performance marks record `clist:shellReady` and `clist:featuresReady`; session timings
separately distinguish key import, waiting for features and account loading.
Browser evidence and live authentication remain separate from mocked Node tests.
