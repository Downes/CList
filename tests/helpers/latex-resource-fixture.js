function latexResourceFixture() {
    const host = document.createElement('div'); document.body.appendChild(host);
    const root = document.createElement('div'); root.id = 'latexDiv'; host.appendChild(root);
    const element = document.createElement('div'); element.id = 'cm-editor'; root.appendChild(element);
    function chrome(id) { const node = document.createElement('div'); node.id = id; host.appendChild(node); return node; }
    const status = chrome('latex-status'), who = chrome('latex-who');
    window.CList.state = { username: 'Alice', authEpoch: 1 }; window.CList.config = { flaskSiteUrl: 'https://identity.invalid' }; window.CList.keys = { ACCESS_TOKEN: 'access_token' };
    let token = 'private-token', installed = null, serial = 0;
    Object.assign(globalThis, { currentEditor: 'latex', getSiteSpecificCookie: () => token });
    const calls = [], providers = [], editors = [], documents = [], states = [], references = [], timers = new Map(), behavior = {};
    const noop = () => ({});
    const modules = {
        Y: { Doc: class {
            constructor() { this.id = documents.length; documents.push(this); this.values = new Map(); this.map = { get: key => this.values.get(key),
                observe: callback => { this.observer = callback; }, unobserve: callback => { calls.push(['unobserve', callback]); } }; }
            getText() { return { toString: () => 'Source' }; } getMap() { return this.map; }
            destroy() { calls.push(['doc-destroy', this.id]); if (behavior.docDestroy) throw new Error('Document cleanup failed'); }
        } },
        HocuspocusProvider: class {
            constructor(options) { this.options = options; providers.push(this); this.awareness = {
                setLocalStateField: (key, value) => { this.local = value; }, on: (name, callback) => { this.observer = callback; },
                off: (name, callback) => { calls.push(['off', callback]); }, getStates: () => new Map([[0, { user: { name: '<Alice>', color: 'bad-color' } }]]) };
                if (behavior.provider) behavior.provider(options);
            }
            destroy() { calls.push(['provider-destroy', providers.indexOf(this)]); this.options.onStatus({ status: 'closed-during-cleanup' }); if (behavior.providerDestroy) throw new Error('Provider cleanup failed'); }
        },
        EditorView: class {
            static editable = { of: value => ({ editable: value }) }; static lineWrapping = {};
            constructor(options) { if (behavior.editor) throw new Error('Editor failed'); this.options = options; editors.push(this); }
            destroy() { calls.push(['editor-destroy', editors.indexOf(this)]); if (behavior.editorDestroy) throw new Error('Editor cleanup failed'); }
        },
        EditorState: { create: value => value }, keymap: { of: noop }, lineNumbers: noop, highlightActiveLine: noop,
        syntaxHighlighting: noop, StreamLanguage: { define: noop }, defaultKeymap: [], yUndoManagerKeymap: [], yCollab: noop,
    };
    const lifecycle = createLatexResourceLifecycle({ current: currentLatexResourceTarget, visible: () => currentEditor === 'latex', view: createLatexResourceView,
        state: value => { states.push(value); window.CList.state.latexResource = value; }, clearReferences: () => references.splice(0), pushReference: reference => references.push(reference),
        install: value => { installed = value; }, schedule: callback => { const id = ++serial; timers.set(id, callback); return id; }, clear: id => { calls.push(['clear', id]); timers.delete(id); }, log: error => calls.push(['error', error.message]) });
    const target = (docId = 'did:example/latex/one', mode = 'edit') => ({ docId, mode, modules, root, element, token: 'private-token',
        username: 'Alice', epoch: 1, storeUrl: 'https://identity.invalid', wsUrl: 'wss://selected.invalid', color: '#123456',
        assertCurrent() { if (!currentLatexResourceTarget(this) || currentEditor !== 'latex') throw new Error('Expired target'); } });
    return { host, root, element, status, who, lifecycle, target, calls, providers, editors, documents, states, references, timers, behavior, chrome,
        get installed() { return installed; }, token(value) { token = value; },
        dispose() { lifecycle.dispose(); host.remove(); },
    };
}
const latexResourceCases = [
    ['captured constructors retain document/auth/read-only settings and safe presentation state', async check => {
        const f = latexResourceFixture(); const op = f.lifecycle.start(f.target('did:example/latex/read', 'read'));
        check(f.providers[0].options.token === 'private-token' && f.providers[0].options.parameters.kvstoreUrl === 'https://identity.invalid' && f.providers[0].options.parameters.mode === 'read', 'captured provider fields');
        check(f.editors[0].options.parent === f.element && f.editors[0].options.state.extensions.some(value => value.editable === false) && f.installed === op, 'captured read-only editor');
        check(Object.keys(window.CList.state.latexResource).join() === 'phase' && !JSON.stringify(f.states).includes('private-'), 'safe state'); f.dispose();
    }],
    ['old provider/reference/timer callbacks cannot affect a replacement resource', async check => {
        const f = latexResourceFixture(); const first = f.lifecycle.start(f.target()), provider = f.providers[0], observer = f.documents[0].observer, timer = [...f.timers.values()][0];
        f.documents[0].values.set('old', JSON.stringify({ url: 'https://old.invalid' })); f.lifecycle.start(f.target('did:example/latex/new'));
        provider.options.onStatus({ status: 'old-status' }); provider.options.onAuthenticationFailed(); observer({ keysChanged: new Set(['old']) }); timer();
        check(f.status.textContent === 'connecting…' && f.references.length === 0 && !f.root.textContent.includes('authentication'), 'retired callbacks rejected');
        check(first.closed && f.calls.some(call => call[0] === 'unobserve') && f.calls.some(call => call[0] === 'off') && f.calls.some(call => call[0] === 'doc-destroy'), 'observers and full resource set released'); f.dispose();
    }],
    ['hidden documents retain resources without changing another editor references or chrome', async check => {
        const f = latexResourceFixture(); f.lifecycle.start(f.target()); const doc = f.documents[0], provider = f.providers[0];
        globalThis.currentEditor = 'texteditor'; doc.values.set('hidden', JSON.stringify({ url: 'https://hidden.invalid' })); doc.observer({ keysChanged: new Set(['hidden']) }); provider.options.onStatus({ status: 'connected' }); provider.observer();
        check(f.lifecycle.owned() && !f.references.length && f.status.textContent === 'connecting…' && !f.calls.some(call => call[0] === 'provider-destroy'), 'background resource retained and isolated');
        globalThis.currentEditor = 'latex'; f.lifecycle.rebind(); check(f.status.textContent === 'connected' && f.who.textContent.includes('<Alice>') && !f.who.querySelector('Alice'), 'literal presence/status restored');
        const expected = document.createElement('span'); expected.style.color = '#888';
        check(f.who.querySelector('span').style.color === expected.style.color, 'untrusted presence color constrained'); f.dispose();
    }],
    ['rebuilt chrome receives current callbacks while retired chrome stays unchanged', async check => {
        const f = latexResourceFixture(); f.lifecycle.start(f.target()); f.status.remove(); f.who.remove();
        const status = f.chrome('latex-status'), who = f.chrome('latex-who'); f.lifecycle.rebind(); f.providers[0].options.onStatus({ status: 'connected' });
        check(status.textContent === 'connected' && f.status.textContent === 'connecting…' && who.textContent.includes('<Alice>'), 'new status/presence binding'); f.dispose();
    }],
    ['authentication/reference errors are visible without losing valid shared records', async check => {
        const f = latexResourceFixture(); f.lifecycle.start(f.target()); const doc = f.documents[0]; doc.values.set('bad', '{'); doc.values.set('good', JSON.stringify({ url: 'https://good.invalid' }));
        doc.observer({ keysChanged: new Set(['bad', 'good']) });
        check(f.root.textContent.includes('reference update') && f.references[0].url === 'https://good.invalid' && doc.values.get('bad') === '{', 'corrupt entry reported and retained, good entry processed');
        f.providers[0].options.onAuthenticationFailed(); check(f.root.textContent.includes('authentication failed'), 'owned authentication feedback'); f.dispose();
    }],
    ['partial construction cleans created resources and leaves no active resource', async check => {
        const f = latexResourceFixture(); f.behavior.editor = true; let failed = false;
        try { f.lifecycle.start(f.target()); } catch { failed = true; }
        check(failed && !f.installed && !f.lifecycle.owned(), 'failed construction not installed');
        check(f.calls.some(call => call[0] === 'provider-destroy') && f.calls.some(call => call[0] === 'doc-destroy') && !f.timers.size, 'partial resources released'); f.dispose();
    }],
    ['cleanup attempts every resource after failures and remains idempotent', async check => {
        const f = latexResourceFixture(); f.lifecycle.start(f.target()); f.behavior.editorDestroy = true; f.behavior.providerDestroy = true; f.lifecycle.dispose(); const count = f.calls.length; f.lifecycle.dispose();
        check(f.calls.length === count && f.calls.some(call => call[0] === 'doc-destroy') && !f.installed && !f.timers.size, 'idempotent complete cleanup attempts');
        check(f.root.textContent.includes('cleanup'), 'cleanup failure visible'); f.host.remove();
    }],
    ['session/DOM expiry disposes old resources before accepting more activity', async check => {
        const f = latexResourceFixture(); f.lifecycle.start(f.target()); f.token('new-token'); f.providers[0].options.onStatus({ status: 'stale' });
        check(!f.lifecycle.owned() && !f.installed && f.status.textContent !== 'stale' && f.calls.some(call => call[0] === 'provider-destroy'), 'expired session disposed'); f.host.remove();
        const g = latexResourceFixture(); g.lifecycle.start(g.target()); g.element.remove(); g.providers[0].observer();
        check(!g.lifecycle.owned() && !g.installed, 'detached target expires'); g.host.remove();
    }],
    ['synchronous provider source expiry releases resources returned after invalidation', async check => {
        const f = latexResourceFixture(); f.behavior.provider = options => { f.token('expired'); options.onStatus({ status: 'stale-construction' }); };
        let failed = false; try { f.lifecycle.start(f.target()); } catch { failed = true; }
        check(failed && !f.installed && !f.editors.length, 'expired construction cannot install editor');
        check(f.calls.filter(call => call[0] === 'doc-destroy').length === 1 && f.calls.filter(call => call[0] === 'provider-destroy').length === 1, 'late-returned provider and document released once'); f.host.remove();
    }],
];
