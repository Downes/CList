function latexPreparationGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function latexPreparationFlush() { for (let i = 0; i < 15; i++) await Promise.resolve(); }
function latexPreparationFixture() {
    const host = document.createElement('div'); document.body.appendChild(host);
    function node(id, tag = 'div', parent = host) { const value = document.createElement(tag); value.id = id; parent.appendChild(value); return value; }
    const root = node('latexDiv'), element = node('cm-editor', 'div', root), input = node('latex-doc-id', 'input'), status = node('latex-status'), title = node('write-title');
    title.textContent = 'Draft'; input.value = 'Draft';
    window.CList.state = { username: 'Alice', authEpoch: 1, editorSwitching: { id: 1 }, editorLoading: { id: 1 } };
    window.CList.config = { flaskSiteUrl: 'https://identity.invalid' }; window.CList.keys = { ACCESS_TOKEN: 'access_token' }; window.CList.ui.view = { writeTitle: title };
    const calls = [], states = [], behavior = {}, modules = { editor: 'mock-module' }; let token = 'private-token';
    Object.assign(globalThis, { currentEditor: 'latex', currentEditorAccount: null, getSiteSpecificCookie: () => token });
    const preparation = createLatexConnectionPreparation({
        capture: captureLatexConnectionTarget, current: currentLatexConnectionTarget,
        server: async () => { calls.push('server'); return behavior.server ? await behavior.server() : 'wss://selected.invalid'; },
        load: async () => { calls.push('load'); return behavior.load ? await behavior.load() : modules; },
        expand: async name => { calls.push(['expand', name]); return behavior.expand ? await behavior.expand(name) : 'did:example/latex/' + name; },
        state: value => { states.push(structuredClone(value)); window.CList.state.latexConnection = value; },
    });
    return { host, root, element, input, title, status, preparation, modules, behavior, calls, states, token(value) { token = value; }, dispose() { host.remove(); } };
}
const latexPreparationCases = [
    ['shared preparation captures credentials, source nodes and selected server before awaiting modules', async check => {
        const f = latexPreparationFixture(), gate = latexPreparationGate(); f.behavior.server = () => gate.promise;
        const pending = f.preparation.prepare({ docId: 'did:example/latex/notes' }); await latexPreparationFlush();
        gate.resolve('wss://selected.invalid'); const target = await pending;
        check(target.docId === 'did:example/latex/notes' && target.wsUrl === 'wss://selected.invalid' && target.token === 'private-token' && target.storeUrl === 'https://identity.invalid', 'captured configuration');
        check(target.element === f.element && target.status === f.status && target.modules === f.modules && target.username === 'Alice', 'captured targets and dependencies');
        check(!JSON.stringify(f.states).includes('private-') && Object.keys(f.states.at(-1)).sort().join() === 'pending,phase', 'secret-free state'); target.assertCurrent(); f.dispose();
    }],
    ['explicit server/read-only and anonymous defaults preserve existing shared contracts', async check => {
        const f = latexPreparationFixture(); f.token(''); window.CList.state.username = 'none';
        const target = await f.preparation.prepare({ docId: 'public/latex/notes', mode: 'read', wsUrl: 'wss://override.invalid' });
        check(target.token === 'anonymous' && target.username === 'Anonymous' && target.mode === 'read' && target.wsUrl === 'wss://override.invalid', 'anonymous override');
        check(!f.calls.includes('server'), 'override skips account lookup'); f.dispose();
    }],
    ['session changes during server lookup expire before dependency loading', async check => {
        const f = latexPreparationFixture(), gate = latexPreparationGate(); f.behavior.server = () => gate.promise;
        const pending = f.preparation.prepare({ docId: 'old' }).catch(error => error); await latexPreparationFlush(); f.token('new'); gate.resolve('wss://old.invalid');
        check((await pending).code === 'ExpiredCollabPreparation' && !f.calls.includes('load'), 'old session never loads/commits'); f.dispose();
    }],
    ['replaced editor/root/status and newer title input invalidate prepared commits', async check => {
        const f = latexPreparationFixture(); const target = await f.preparation.prepare({ docId: 'notes' }); f.title.textContent = 'Newer';
        let expired = false; try { target.assertCurrent(); } catch { expired = true; } check(expired, 'newer title protected');
        f.title.textContent = 'Draft'; f.status.remove(); expired = false; try { target.assertCurrent(); } catch { expired = true; } check(expired, 'rebuilt status protected'); f.dispose();
        const g = latexPreparationFixture(), ready = await g.preparation.prepare({ docId: 'notes' }); g.element.remove();
        expired = false; try { ready.assertCurrent(); } catch { expired = true; } check(expired, 'detached editor cannot commit'); g.dispose();
    }],
    ['new connection supersedes old module loading while preserving newest guard', async check => {
        const f = latexPreparationFixture(), gate = latexPreparationGate(); f.behavior.load = () => gate.promise;
        const old = f.preparation.prepare({ docId: 'old' }).catch(error => error); await latexPreparationFlush(); f.behavior.load = null;
        const newest = await f.preparation.prepare({ docId: 'new' }); gate.resolve(f.modules);
        check((await old).code === 'ExpiredCollabPreparation', 'older modules rejected'); newest.assertCurrent();
        check(newest.docId === 'new' && window.CList.state.latexConnection.phase === 'ready', 'newer target remains valid'); f.dispose();
    }],
    ['namespace resolution captures original input and expired results cannot supersede preparation', async check => {
        const f = latexPreparationFixture(), gate = latexPreparationGate(); f.behavior.expand = () => gate.promise;
        const old = f.preparation.resolve('old').catch(error => error); f.behavior.expand = null;
        const named = await f.preparation.resolve('new'), prepared = await f.preparation.prepare(named); gate.resolve('did:example/latex/old');
        check((await old).code === 'ExpiredCollabPreparation' && prepared.docId === 'did:example/latex/new', 'namespace supersession');
        prepared.assertCurrent(); const count = f.calls.length;
        await f.preparation.prepare({ docId: 'stale', current: () => false }).catch(() => {}); prepared.assertCurrent();
        check(f.calls.length === count, 'expired caller does not invalidate newest preparation'); f.dispose();
    }],
    ['server and library errors propagate while stale failures become expiry', async check => {
        const f = latexPreparationFixture(); f.behavior.server = async () => { throw new Error('Lookup failed'); };
        let message; await f.preparation.prepare({ docId: 'notes' }).catch(error => { message = error.message; }); check(message === 'Lookup failed' && !f.calls.includes('load'), 'lookup failure not defaulted');
        f.behavior.server = null; f.behavior.load = async () => { throw new Error('Library failed'); };
        await f.preparation.prepare({ docId: 'notes' }).catch(error => { message = error.message; }); check(message === 'Library failed', 'library failure propagates');
        const gate = latexPreparationGate(); f.behavior.load = () => gate.promise;
        const pending = f.preparation.prepare({ docId: 'old' }).catch(error => error); await latexPreparationFlush(); globalThis.currentEditor = 'texteditor'; gate.reject(new Error('Late failure'));
        check((await pending).code === 'ExpiredCollabPreparation', 'late failure classified as expired'); f.dispose();
    }],
    ['account/load/switch/auth identities expire prepared ownership', async check => {
        const f = latexPreparationFixture();
        for (const change of [() => { window.CList.state.authEpoch++; }, () => { window.CList.state.editorLoading.id++; }, () => { window.CList.state.editorSwitching.id++; }, () => { globalThis.currentEditorAccount = {}; }]) {
            const target = await f.preparation.prepare({ docId: 'notes' }); change(); let expired = false;
            try { target.assertCurrent(); } catch { expired = true; } check(expired, 'changed source identity rejected');
        }
        f.dispose();
    }],
];
