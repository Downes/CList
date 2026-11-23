const personalOptionsRealParser = parseLocalAccountExportFile;
function personalOptionsGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function personalOptionsFixture(initial = {}) {
    const account = oauthAccountFixture(), oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'), oldHistory = Object.getOwnPropertyDescriptor(globalThis, 'history'), oldDark = document.documentElement.classList.contains('dark-mode'), oldTiny = window.tinymce;
    const records = new Map(), writes = [], confirmations = [], calls = [], behavior = { ...initial }; let picks = 0, back = 0;
    window.CList.keys.DARK_MODE = 'clist-dark-mode'; window.CList.keys.WEBMENTION_ENABLED = 'clist_webmention_enabled'; window.CList.state.username = 'User'; webmentionEnabled = false;
    document.documentElement.classList.remove('dark-mode'); window.tinymce = null;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem(key) { if (behavior.get) return behavior.get(key); return records.get(key) ?? null; },
        setItem(key, value) { if (behavior.set) behavior.set(key, value); writes.push([key, value]); records.set(key, value); },
    } });
    Object.defineProperty(globalThis, 'history', { configurable: true, value: { back: () => { back++; } } });
    Object.assign(globalThis, {
        escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
        confirmWithPassword: (...args) => confirmations.push(args), parseLocalAccountExportFile: personalOptionsRealParser,
        exportAccountData: async password => { calls.push(['export', password]); if (behavior.export) await behavior.export(); },
        verifyExportPassword: async () => true,
        unlockAndImportAccountData: async (payload, password) => { calls.push(['import', payload, password]); if (behavior.import) return await behavior.import(); return { imported: 2, skipped: ['<existing>'] }; },
        getAccounts: async () => { calls.push(['accounts']); if (behavior.accounts) await behavior.accounts(); return []; },
        populatePostOptions: () => calls.push(['post']), populateReadAccountList: () => calls.push(['read']),
    });
    const root = createPersonalOptionsPanel(); document.body.appendChild(root);
    const input = root.querySelector('#optionsImportLocalAccountInput'); input.click = () => { picks++; };
    function button(id) { return root.querySelector('#options-' + id); }
    return { account, root, records, writes, confirmations, calls, behavior, get picks() { return picks; }, get back() { return back; },
        button, click(id) { return button(id).onclick(); }, text: () => root.textContent,
        retry() { return Array.from(root.querySelectorAll('button')).find(node => node.textContent.startsWith('Retry')); },
        async file(payload) {
            const files = payload === null ? [] : [{ text: async () => { if (behavior.file) return await behavior.file(); return JSON.stringify(payload); } }];
            Object.defineProperty(input, 'files', { configurable: true, value: files }); return input.onchange();
        },
        dispose() { root.remove(); account.dispose(); window.tinymce = oldTiny; document.documentElement.classList.toggle('dark-mode', oldDark); if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage; if (oldHistory) Object.defineProperty(globalThis, 'history', oldHistory); else delete globalThis.history; },
    };
}
const personalOptionsPayload = () => ({ clistLocalAccountExport: 1, username: '<b>Source</b>', authHashDigest: 'digest', kv: [] });
const personalOptionsCases = [
    ['real panel renders host literally and initializes both toggles without storage writes', async check => {
        const f = personalOptionsFixture();
        check(f.button('current-location').textContent === window.location.host && f.writes.length === 0, 'literal host/no initialization writes');
        check(f.button('dark-mode-toggle').getAttribute('aria-pressed') === 'false' && f.button('webmention-toggle').textContent === 'WebMention: Off', 'initial state and accessible toggle');
        f.click('back-btn'); check(f.back === 1, 'Back routed'); f.dispose();
    }],
    ['dark mode persists before display and synchronizes existing TinyMCE content styles', async check => {
        const f = personalOptionsFixture(), head = document.createElement('div');
        const frame = { head, createElement: tag => document.createElement(tag), getElementById: id => head.querySelector('#' + id) };
        window.tinymce = { editors: [{ getDoc: () => frame }, { getDoc: () => null }] };
        await f.click('dark-mode-toggle');
        check(f.records.get('clist-dark-mode') === '1' && document.documentElement.classList.contains('dark-mode') && !!head.querySelector('#clist-dm'), 'persisted theme and editor injection');
        await f.click('dark-mode-toggle'); check(f.records.get('clist-dark-mode') === '0' && !head.querySelector('#clist-dm'), 'theme/style removal'); f.dispose();
    }],
    ['storage failure preserves visible/runtime preferences and supports explicit retry', async check => {
        const f = personalOptionsFixture(); f.behavior.set = () => { throw new Error('Storage denied'); };
        await f.click('dark-mode-toggle'); check(!document.documentElement.classList.contains('dark-mode') && f.text().includes('could not be saved'), 'no unpersisted theme change');
        await f.click('webmention-toggle'); check(!isWebmentionEnabled() && f.button('webmention-toggle').textContent === 'WebMention: Off', 'WebMention runtime unchanged after failed save');
        f.behavior.set = null; await f.click('webmention-toggle'); check(isWebmentionEnabled() && f.records.get('clist_webmention_enabled') === 'true', 'existing WebMention helper and format retained'); f.dispose();
    }],
    ['partial editor display failure has display-only retry without rewriting preference', async check => {
        const f = personalOptionsFixture(); let failed = true;
        window.tinymce = { editors: [{ getDoc() { if (failed) throw new Error('Editor unavailable'); return null; } }] };
        await f.click('dark-mode-toggle'); check(f.text().includes('Preference saved') && f.writes.length === 1 && !!f.retry(), 'display failure separated from persistence');
        failed = false; f.retry().onclick(); check(f.writes.length === 1 && f.text().includes('Display updated'), 'display-only retry'); f.dispose();
    }],
    ['duplicates coalesce and replaced/hidden controls cannot change preferences', async check => {
        const f = personalOptionsFixture(); const first = f.click('dark-mode-toggle'); check(first === f.click('dark-mode-toggle'), 'duplicate toggle coalesced'); await first;
        check(f.writes.length === 1, 'one persisted toggle');
        const replacement = createPersonalOptionsPanel(); document.body.appendChild(replacement); const before = f.writes.length;
        await f.click('webmention-toggle'); check(f.writes.length === before, 'old connected panel rejected after replacement'); replacement.remove(); f.dispose();
        const g = personalOptionsFixture(); g.root.style.display = 'none'; await g.click('dark-mode-toggle'); check(!g.writes.length, 'hidden controls rejected'); g.dispose();
    }],
    ['preference read errors are visible without initialization writes', async check => {
        const f = personalOptionsFixture({ get() { throw new Error('Read denied'); } });
        check(f.text().includes('Could not read preferences') && !f.writes.length, 'read failure feedback'); f.dispose();
    }],
    ['export handoff captures source/password callback and rejects expired callbacks', async check => {
        const f = personalOptionsFixture(); f.click('export-local-account'); f.click('export-local-account');
        check(f.confirmations.length === 1 && f.confirmations[0][2].confirmLabel === 'Export', 'single confirmation with compatible label');
        await f.confirmations[0][1]('private-password'); check(f.calls.filter(call => call[0] === 'export').length === 1 && f.text().includes('Account exported'), 'existing exporter handoff');
        f.click('export-local-account'); f.account.token('new-session'); await f.confirmations[1][1]('expired-password');
        check(f.calls.filter(call => call[0] === 'export').length === 1, 'expired source cannot dispatch export'); f.dispose();
    }],
    ['import file routing, real parser, escaped metadata and accepted refresh-only retry', async check => {
        const f = personalOptionsFixture(); f.click('import-local-account'); check(f.picks === 1, 'picker handoff');
        await f.file(null); check(!f.confirmations.length, 'picker cancellation');
        await f.file(personalOptionsPayload()); check(f.confirmations[0][0].includes('&lt;b&gt;Source&lt;/b&gt;') && await f.confirmations[0][2].verify('password'), 'escaped confirmation and verifier contract');
        f.behavior.accounts = async () => { throw new Error('Refresh unavailable'); }; await f.confirmations[0][1]('private-password');
        check(!!f.retry() && f.calls.filter(call => call[0] === 'import').length === 1, 'import acceptance distinct from refresh failure');
        f.behavior.accounts = null; await f.retry().onclick(); check(f.calls.filter(call => call[0] === 'import').length === 1 && f.text().includes('Skipped existing keys: <existing>'), 'read-only refresh and literal skipped keys'); f.dispose();
    }],
    ['bad files fail visibly and superseded parse/password callbacks cannot import', async check => {
        const f = personalOptionsFixture(); await f.file(null); await f.file({ invalid: true });
        check(f.text().includes('not a recognized') && !f.confirmations.length, 'real parser failure owned by panel');
        const gate = personalOptionsGate(); f.behavior.file = () => gate.promise; const pending = f.file(personalOptionsPayload()); await oauthAccountFlush();
        const next = createPersonalOptionsPanel(); document.body.appendChild(next); gate.resolve(JSON.stringify(personalOptionsPayload())); await pending;
        check(!f.confirmations.length, 'late parse cannot open confirmation on replacement'); next.remove(); f.dispose();
        const g = personalOptionsFixture(); await g.file(personalOptionsPayload()); g.account.token('new-session'); await g.confirmations[0][1]('expired-password');
        check(!g.calls.some(call => call[0] === 'import'), 'expired source cannot dispatch import'); g.dispose();
    }],
];
