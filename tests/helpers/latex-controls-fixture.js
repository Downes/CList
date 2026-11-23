function latexControlsGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function latexControlsFlush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function latexControlsFixture() {
    const menu = document.createElement('div'); document.body.appendChild(menu); globalThis.currentEditor = 'latex';
    let body = 'Before text', docId = 'latex/doc', token = 'private-token', epoch = 1, mode = 'edit', serial = 0, active = true;
    const calls = [], revoked = [], urls = [], clipboard = [], refs = [], changes = [], states = [], behavior = {}, cards = [], shared = new Map();
    const selection = Object.create({ get from() { return 7; }, get to() { return 7; } });
    const editor = { state: { doc: { toString: () => body }, selection: { main: selection } },
        dispatch(update) { changes.push(update); const { from, to, insert } = update.changes; body = body.slice(0, from) + insert + body.slice(to); if (behavior.dispatch) behavior.dispatch(); }, focus() { if (behavior.focus) throw new Error('Focus failed'); } };
    const reference = { url: 'https://source.invalid/exact', title: '<Title>', author_name: 'A&B', feed: 'Feed_name', created_at: '2026-11-22', extension: { retained: true } };
    const capture = () => ({ editor, map: shared, docId, text: body, token, epoch, mode, title: '<Draft>', wsUrl: 'wss://selected.invalid' });
    const current = (source, text = false) => active && currentEditor === 'latex' && source.editor === editor && source.docId === docId && source.token === token && source.epoch === epoch && (!text || source.text === body);
    Object.assign(globalThis, { showModal(card) { cards.forEach(old => old.remove()); cards.push(card); document.body.appendChild(card); } });
    const api = createLatexControlsController({ capture, current, state: value => states.push(value),
        compile: source => compileLatexSource({ url: 'https://compile.invalid', token: source.token, source: source.text }, { fetch: async (url, options) => { calls.push({ url, options }); return behavior.fetch ? await behavior.fetch() : { ok: true, blob: async () => new Blob(['PDF'], { type: 'application/pdf' }) }; } }),
        url: blob => { const value = 'blob:pdf-' + (++serial); urls.push(value); return value; }, revoke: url => revoked.push(url),
        link: (source, kind) => 'https://share.invalid/?doc=' + encodeURIComponent(source.docId) + '&mode=' + kind,
        copy: async (url, owned) => { clipboard.push({ url, owned }); if (behavior.copy) await behavior.copy(); }, log() {},
    });
    let view;
    const content = createLatexContentController({ capture, current, plaintext: text => text.replace(/<[^>]*>/g, ''), displayName: ref => ref.author_name || 'Unknown',
        resolve: () => reference, references: () => refs, replace: values => { refs.splice(0, refs.length, ...values); }, push: ref => { if (!refs.some(value => value.url === ref.url)) refs.push(ref); }, display() {},
        error: error => view.error(error), log() {},
    });
    function render() { view = createLatexControlsView(menu); api.bind(view); view.bind({ compile: api.compile, share: api.share, bibliography: content.bibliography, connect() {} }); return view; }
    render();
    return { menu, api, content, editor, reference, refs, shared, changes, calls, urls, revoked, states, clipboard, cards, behavior, render,
        button(label, root = menu) { return Array.from(root.querySelectorAll('button')).find(node => node.textContent === label); },
        node(id) { return menu.querySelector('#' + id); }, get body() { return body; }, set body(value) { body = value; },
        mode(value) { mode = value; }, token(value) { token = value; }, expire() { epoch++; }, replace() { docId = 'latex/new'; api.invalidate(); },
        dispose() { api.invalidate(); active = false; menu.remove(); cards.forEach(card => card.remove()); },
    };
}
const latexControlsCases = [
    ['real toolbar Compile captures source/token and duplicate clicks share one request', async check => {
        const f = latexControlsFixture(), gate = latexControlsGate(); f.behavior.fetch = () => gate.promise;
        f.button('Compile').click(); const first = f.api.compile(), second = f.api.compile(); check(first === second, 'pending compile shared'); await latexControlsFlush();
        check(f.calls.length === 1 && JSON.parse(f.calls[0].options.body).source === 'Before text' && f.calls[0].options.headers.Authorization === 'Bearer private-token', 'captured request');
        gate.resolve({ ok: true, blob: async () => new Blob(['PDF']) }); await first;
        check(f.node('latex-download-link').href === 'blob:pdf-1' && f.node('latex-action-status').textContent === 'compiled' && !f.button('Compile').disabled, 'owned PDF and idle controls');
        check(Object.keys(f.states.at(-1)).sort().join() === 'busy,phase' && !JSON.stringify(f.states).includes('private-'), 'safe state'); f.dispose();
    }],
    ['changed source/session suppresses old PDFs without creating URLs', async check => {
        const f = latexControlsFixture(), gate = latexControlsGate(); f.behavior.fetch = () => gate.promise; const pending = f.api.compile(); await latexControlsFlush(); f.body = 'Newer source';
        gate.resolve({ ok: true, blob: async () => new Blob(['OLD']) }); await pending;
        check(!f.urls.length && f.node('latex-download-link').style.display === 'none' && !f.button('Compile').disabled, 'newer source preserved');
        const other = latexControlsGate(); f.behavior.fetch = () => other.promise; const next = f.api.compile(); await latexControlsFlush(); f.expire(); other.resolve({ ok: false, status: 504 }); await next;
        check(!f.menu.textContent.includes('timed out'), 'stale failure suppressed'); f.dispose();
    }],
    ['rebuilt toolbar preserves pending lock but expires old completion/control callbacks', async check => {
        const f = latexControlsFixture(), gate = latexControlsGate(); f.behavior.fetch = () => gate.promise; const old = f.button('Compile'); old.click(); const pending = f.api.compile(); await latexControlsFlush(); f.render();
        check(f.button('Compile').disabled && f.api.compile() === pending, 'pending lock across rebuild'); old.click(); gate.resolve({ ok: true, blob: async () => new Blob(['OLD']) }); await pending;
        check(!f.urls.length && !f.button('Compile').disabled && f.node('latex-action-status').textContent !== 'compiling…', 'old PDF discarded and rebuilt controls released'); f.dispose();
    }],
    ['PDF replacement/disposal revokes owned URLs and compile errors are literal with explicit retry', async check => {
        const f = latexControlsFixture(); await f.api.compile(); await f.api.compile(); check(f.revoked[0] === 'blob:pdf-1', 'previous PDF released');
        f.behavior.fetch = async () => ({ ok: false, status: 422, json: async () => ({ log: '<Compile error>' }) }); await f.api.compile();
        check(f.menu.textContent.includes('<Compile error>') && !f.menu.querySelector('Compile') && f.revoked.includes('blob:pdf-2'), 'literal service log, old URL revoked');
        const count = f.calls.length; await latexControlsFlush(); check(f.calls.length === count, 'no automatic retry'); f.behavior.fetch = null; await f.api.compile(); f.replace(); check(f.revoked.includes('blob:pdf-3'), 'resource switch releases PDF'); f.dispose();
    }],
    ['login and service failures remain visible and allow explicit retry', async check => {
        const f = latexControlsFixture(); f.token(''); await f.api.compile(); check(!f.calls.length && f.menu.textContent.includes('Log in'), 'login validation'); f.token('token');
        for (const [status, expected] of [[413, 'too large'], [504, 'timed out'], [500, '500']]) {
            f.behavior.fetch = async () => ({ ok: false, status }); await f.api.compile(); check(f.menu.textContent.includes(expected), 'HTTP error feedback');
        } f.dispose();
    }],
    ['Share uses literal captured metadata, bound Copy locks and stale modal guards', async check => {
        const f = latexControlsFixture(); f.button('Share').click(); const card = f.cards[0], gate = latexControlsGate(); f.behavior.copy = () => gate.promise;
        const button = f.button('Copy', card); button.click(); button.click(); await latexControlsFlush();
        check(card.textContent.includes('<Draft>') && !card.querySelector('Draft') && f.clipboard.length === 1 && f.clipboard[0].url.includes('mode=edit'), 'literal metadata and captured copy');
        f.button('Share').click(); gate.resolve(); await latexControlsFlush(); check(!f.clipboard[0].owned(), 'replaced modal feedback expired');
        f.replace(); f.button('Copy', f.cards.at(-1)).click(); check(f.clipboard.length === 1, 'old source cannot copy'); f.dispose();
    }],
    ['content uses CodeMirror range accessors and retains exact live reference extensions', async check => {
        const f = latexControlsFixture(); f.content.insert({ type: 'text/html', value: '<p>Quote</p>' }, f.reference, null, true);
        check(f.changes[0].changes.from === 7 && f.changes[0].changes.to === 7 && f.body.includes('Quote (A\\&B, 2026)'), 'selection getters and escaped citation');
        check(f.refs[0] === f.reference && JSON.parse(f.shared.get(f.reference.url)).extension.retained, 'live structural reference retained'); f.dispose();
    }],
    ['read-only and reentrant/stale content commands cannot insert', async check => {
        const f = latexControlsFixture(); f.mode('read'); let rejected = false; try { f.content.insert({ type: 'text/plain', value: 'No' }); } catch { rejected = true; }
        check(rejected && !f.changes.length, 'read-only rejected'); f.mode('edit');
        f.behavior.dispatch = () => f.content.insert({ type: 'text/plain', value: 'Duplicate' }); f.content.insert({ type: 'text/plain', value: 'Once' });
        check(f.changes.length === 1, 'synchronous duplicate rejected'); globalThis.currentEditor = 'texteditor'; try { f.content.insert({ type: 'text/plain', value: 'Old' }); } catch {}
        check(f.changes.length === 1, 'hidden editor rejected'); f.dispose();
    }],
    ['bibliography refreshes one existing block and partial insertion errors do not request reinsert', async check => {
        const f = latexControlsFixture(); f.refs.push(f.reference); f.button('Insert bibliography').click(); const block = latexBibliography(f.refs); f.body = 'Start\n' + block + '\nEnd';
        f.content.bibliography(); check(f.body.split('\\begin{thebibliography}').length === 2 && f.body.includes('Feed\\_name'), 'escaped single bibliography refresh');
        f.behavior.focus = true; const count = f.changes.length; const result = f.content.insert({ type: 'text/plain', value: 'Accepted' });
        check(result === false && f.changes.length === count + 1 && f.menu.textContent.includes('Do not insert it again'), 'partial insertion visible without replay'); f.dispose();
    }],
    ['reference resync retains corrupt records and failed map reads preserve current references', async check => {
        const f = latexControlsFixture(); f.shared.set('good', JSON.stringify(f.reference)); f.shared.set('bad', '{'); f.content.resync();
        check(f.refs[0].url === f.reference.url && f.shared.get('bad') === '{' && f.menu.textContent.includes('retained'), 'corrupt record retained and warned');
        const previous = f.refs[0]; f.shared.forEach = () => { throw new Error('Map unavailable'); }; f.content.resync(); check(f.refs[0] === previous && f.menu.textContent.includes('Map unavailable'), 'failed snapshot does not clear references'); f.dispose();
    }],
];
