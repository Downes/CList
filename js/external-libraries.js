// Shared on-demand external dependencies. Callers own visible feedback.
(function () {
    const pending = new Map();
    function load(name, url, ready, attributes = {}) {
        if (ready()) return Promise.resolve();
        if (pending.has(name)) return pending.get(name);
        const promise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.referrerPolicy = 'origin';
            Object.assign(script, attributes);
            let settled = false;
            const finish = error => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                script.onload = script.onerror = null;
                if (error) { script.remove(); reject(error); }
                else resolve();
            };
            const timer = setTimeout(() => finish(new Error(name + ' took too long to load. Please try again.')), 30000);
            script.onload = () => finish(ready() ? null : new Error(name + ' loaded without its required API. Please try again.'));
            script.onerror = () => finish(new Error('Could not load ' + name + '. Check your connection and try again.'));
            try { document.head.appendChild(script); } catch (error) { finish(error); }
        }).catch(error => { pending.delete(name); throw error; });
        pending.set(name, promise);
        return promise;
    }
    const tinyBase = 'https://www.downes.ca/assets/tinymce';
    const tinyReady = () => {
        const api = window.tinymce;
        if (typeof api?.init !== 'function' || typeof api.overrideDefaults !== 'function') return false;
        // Dynamic loading can defeat TinyMCE's script-location autodetection.
        // Its supported defaults API sets baseURL/baseURI and the asset suffix.
        api.overrideDefaults({ ...api.defaultOptions, base_url: tinyBase, suffix: '.min' });
        return true;
    };
    window.ensureTinyMCE = () => load('TinyMCE', tinyBase + '/tinymce.min.js', tinyReady);
    window.ensurePeerJS = () => load('PeerJS', 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', () => typeof window.Peer === 'function', { integrity: 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR', crossOrigin: 'anonymous' });
    window.ensureGoogleIdentity = () => load('Google authorization', 'https://accounts.google.com/gsi/client', () => typeof window.google?.accounts?.oauth2?.initTokenClient === 'function');
})();
