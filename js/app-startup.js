// The shell restores identity before downloading the feature registry.
function createAppStartup(deps) {
    const loaded = new Set(), callbacks = [];
    let phase = 'shell', running = null, started = false, featuresResolved = false;
    let resolveFeatures, resolveIdentity, session;
    const features = new Promise(resolve => { resolveFeatures = resolve; });
    const identity = new Promise(resolve => { resolveIdentity = resolve; });
    /** @param {CListAppStartupState["phase"]} next */
    const state = (next, error = null) => { phase = next; deps.state({phase, loaded: loaded.size, total: deps.scripts.length, error}); };
    const invoke = callback => {
        try { Promise.resolve(callback()).catch(deps.callbackError); }
        catch (error) { deps.callbackError(error); }
    };
    async function loadFeatures() {
        if (phase === 'ready') return true;
        if (running) return running;
        running = (async () => {
            state('loading-features');
            try {
                for (const url of deps.scripts) {
                    if (loaded.has(url)) continue;
                    await deps.loadScript(url);
                    loaded.add(url); state('loading-features');
                    if (loaded.size % 8 === 0) await deps.yield();
                }
                if (!featuresResolved) { featuresResolved = true; resolveFeatures(); }
                state('loading-accounts');
                await session;
                deps.unlock();
                state('ready'); deps.mark('featuresReady');
                for (const callback of callbacks.splice(0)) invoke(callback);
                deps.complete();
                return true;
            } catch (error) {
                state('failed', error.message);
                deps.failure(error, error.reloadRequired ? null : () => loadFeatures());
                return false;
            } finally { running = null; }
        })();
        return running;
    }
    return {
        phase: () => phase,
        whenFeaturesReady: () => features,
        sessionKnown: () => resolveIdentity(),
        afterFeatures(callback) { if (phase === 'ready') invoke(callback); else callbacks.push(callback); },
        retry: loadFeatures,
        async start() {
            if (started) return false;
            started = true; deps.lock();
            try {
                session = Promise.resolve(deps.restoreSession());
                // A failure before the session view can render must not strand startup.
                session.catch(error => { resolveIdentity(); deps.callbackError(error); });
                await identity;
                deps.restoreLayout();
                state('shell-ready'); deps.mark('shellReady');
                await deps.paint();
                return await loadFeatures();
            } catch (error) { state('failed', error.message); deps.failure(error, null); return false; }
        }
    };
}

// Explicit script ordering preserves the existing plain-script registries.
function loadStartupScript(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url; script.async = false;
        let evaluationError = null, done = false;
        const onError = event => {
            if (event.filename && new URL(event.filename, location.href).href === script.src) {
                evaluationError = new Error('A tool could not initialize. Reload to try again.');
                evaluationError.reloadRequired = true;
            }
        };
        const finish = error => {
            if (done) return; done = true;
            clearTimeout(timer); window.removeEventListener('error', onError);
            script.onload = script.onerror = null;
            if (error) { script.remove(); reject(error); } else resolve();
        };
        window.addEventListener('error', onError);
        const timer = setTimeout(() => {
            const error = new Error('A tool took too long to load. Reload to try again.');
            error.reloadRequired = true; finish(error);
        }, 30000);
        script.onload = () => finish(evaluationError);
        script.onerror = () => finish(evaluationError || new Error('A tool could not be downloaded. Check your connection and retry.'));
        try { document.head.appendChild(script); } catch (error) { finish(error); }
    });
}

function installAppStartup() {
    const manifest = document.getElementById('app-feature-scripts');
    if (!manifest) return; // Standalone test pages retain their own initialization.
    const scripts = JSON.parse(manifest.textContent), disabled = new Map();
    const status = document.getElementById('startup-tools-status');
    const mark = name => performance.mark?.('clist:' + name);
    const startup = createAppStartup({
        scripts, loadScript: loadStartupScript, mark,
        state(value) {
            window.CList.state.appStartup = value;
            if (!status) return;
            status.textContent = value.phase === 'ready' ? '' : value.phase === 'failed' ? 'Tools could not load.' :
                value.phase === 'loading-accounts' ? 'Loading accounts…' : 'Loading tools…';
        },
        lock() {
            for (const control of document.querySelectorAll('#main-container button, #main-container input, #main-container select, #main-container textarea')) {
                if (control.id === 'logoutButton' || control.id === 'snapLeftBtn' || control.id === 'snapRightBtn' || control.getAttribute('onclick') === 'toggleLeftPane();') continue;
                disabled.set(control, control.disabled); control.disabled = true;
            }
        },
        unlock() { for (const [control, value] of disabled) if (control.isConnected) control.disabled = value; disabled.clear(); },
        restoreSession: () => initializeSessionControls(),
        restoreLayout: () => paneController().restore(),
        paint: () => new Promise(resolve => {
            // Two frames allow the resolved session controls to paint before requests begin.
            if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(resolve));
            else setTimeout(resolve, 0);
        }),
        yield: () => new Promise(resolve => setTimeout(resolve, 0)),
        callbackError(error) { console.error('Startup initialization failed:', error); showErrorModal(error.message || String(error), {title: 'Initialization failed'}); },
        failure(error, retry) {
            console.error('Application startup failed:', error);
            if (typeof buildDialogModal !== 'function') { if (status) status.textContent = 'Startup failed. Reload to try again.'; return; }
            buildDialogModal('Tools could not load', error.message, [
                ...(retry ? [{label: 'Retry', onClick(close) { close(); void retry(); }}] : []),
                {label: 'Reload', onClick() { window.location.reload(); }}
            ]);
        },
        complete() {
            // Guest feeds depend on the now-complete reader/collection registries.
            if (!isRegistered()) setLoggedOutUI();
        }
    });
    window.CList.startup = startup;
    if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', () => { void startup.start(); }, {once:true});
    else queueMicrotask(() => { void startup.start(); });
}
installAppStartup();
