function etherpadDocumentGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function etherpadDocumentFlush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function etherpadDocumentFixture() {
    _etherpadConnection?.documents?.dispose(); _etherpadConnection?.controller.dispose(); _etherpadConnection = null;
    const host = document.createElement('div'); document.body.appendChild(host);
    const chat = document.createElement('div'); chat.id = 'chat-messages'; document.body.appendChild(chat);
    const calls = [], references = [], cards = [], messages = [], behavior = {}; let token = 'private-token', consumed = 0;
    window.CList.state = { username: 'Alice', authEpoch: 1 }; window.CList.config = { flaskSiteUrl: 'https://identity.invalid' };
    window.CList.keys = { ACCESS_TOKEN: 'access_token', USERNAME: 'username' }; window.CList.ui.view = { writePaneContent: host };
    const account = { type: 'Etherpad', instance: 'https://pad.invalid/api/1.2.15', id: 'private-key' };
    Object.assign(globalThis, { currentEditor: 'etherpad', connections: { peer: {} }, activeDiscussionName: 'Room',
        getSiteSpecificCookie: (store, key) => key === 'username' ? 'Alice' : token,
        kvstoreAuthHeader: () => ({ Authorization: 'Bearer ' + token }),
        escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        cleanHTMLContent: html => html.replace(/<[^>]*>/g, ''),
        createReference: id => { if (behavior.reference) throw new Error('Reference failed'); references.push(id); }, displayReferences() {},
        loadPredefinedContent: async () => { consumed++; if (behavior.pending) return await behavior.pending(); },
        showModal: card => { cards.push(card); document.body.appendChild(card); },
        showErrorModal: message => { throw new Error(message); },
        sendMessage: async message => { messages.push(message); if (behavior.send) return await behavior.send(); },
        fetch: async (url, options = {}) => {
            let method, params = options.body;
            if (options.body instanceof FormData) method = 'import';
            else if (!options.body) method = 'guestRead';
            else { params = new URLSearchParams(options.body); method = params.get('url').split('/').at(-1); }
            const call = { method, url, options, params }; calls.push(call);
            if (behavior[method]) return await behavior[method](call);
            if (method === 'guestRead') return { ok: true, text: async () => '<p>Guest</p>' };
            const data = method === 'listAllPads' ? { padIDs: ['Existing'] } : method === 'createAuthorIfNotExistsFor' ? { authorID: 'author-Alice' }
                : method === 'getText' ? { text: '' } : method === 'getHTML' ? { html: '<p>Existing</p>' } : null;
            return { ok: true, json: async () => ({ code: 0, data }) };
        },
    });
    return { host, account, calls, references, cards, messages, behavior,
        mount(value = account) { return editorHandlers.etherpad.initialize(value); },
        node(id) { return host.querySelector('#' + id); },
        button(text) { return Array.from(host.querySelectorAll('button')).find(node => node.textContent === text); },
        api() { return etherpadDocuments(); }, get consumed() { return consumed; }, token(value) { token = value; },
        dispose() { _etherpadConnection?.documents?.dispose(); _etherpadConnection?.controller.dispose(); _etherpadConnection = null; host.remove(); chat.remove(); cards.forEach(card => card.remove()); },
    };
}
const etherpadDocumentCases = [
    ['Create captures request, seeds only new empty pads and consumes pending content once', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); const gate = etherpadDocumentGate();
        f.behavior.createAuthorIfNotExistsFor = () => gate.promise;
        f.behavior.pending = () => editorHandlers.etherpad.loadContent({ type: 'text/html', value: '<p>Queued</p>' });
        f.node('newPadName').value = 'New'; f.button('Create and Load').click();
        const first = f.api().open('New', true), duplicate = f.api().open('New', true); check(first === duplicate, 'duplicate Create shares promise');
        f.node('newPadName').value = 'Newer draft';
        await etherpadDocumentFlush(); gate.resolve({ ok: true, json: async () => ({ code: 0, data: { authorID: 'captured-author' } }) }); await first;
        check(f.calls.filter(call => call.method === 'createPad').length === 1 && f.calls.find(call => call.method === 'setText').params.get('text') === ETHERPAD_WELCOME, 'one Create and welcome seed');
        check(padName === 'New' && authorID === 'captured-author' && f.node('padIframe').src === 'https://pad.invalid/p/New' && f.consumed === 1, 'owned commit and queued content');
        check(f.node('newPadName').value === 'Newer draft' && f.calls.filter(call => call.method === 'setHTML').length === 1, 'newer input retained and nested queued append completes once');
        check(!JSON.stringify(window.CList.state.etherpadDocument).includes('private-') && Object.keys(window.CList.state.etherpadDocument).sort().join() === 'busy,phase,receipt', 'secret-free state'); f.dispose();
    }],
    ['existing/nonempty pads are never welcome-seeded and selection performs no Create', async check => {
        const f = etherpadDocumentFixture(); await f.mount();
        f.behavior.createPad = async () => ({ ok: true, json: async () => ({ code: 1, message: 'padID does already exist', data: null }) }); await f.api().open('Existing', true);
        check(!f.calls.some(call => call.method === 'setText'), 'existing pad not seeded');
        const count = f.calls.length; await f.api().open('<Literal>', false);
        check(!f.calls.slice(count).some(call => call.method === 'createPad') && f.node('currentPadName').textContent === 'Alice: <Literal>', 'selection is read-only apart from author mapping, literal title');
        f.behavior.createPad = null; f.behavior.getText = async () => ({ ok: true, json: async () => ({ code: 0, data: { text: 'Newer remote content' } }) }); await f.api().open('Nonempty', true);
        check(!f.calls.some(call => call.method === 'setText'), 'newer remote content preserved'); f.dispose();
    }],
    ['uncertain Create blocks replay and partial seed recovery does not recreate or reseed', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); f.behavior.createPad = async () => { throw new Error('Lost response'); };
        await f.api().open('Unknown', true).catch(() => {}); const count = f.calls.length; await f.api().open('Unknown', true).catch(() => {});
        check(f.calls.length === count && f.host.textContent.includes('Refresh pads'), 'unconfirmed Create not replayed');
        f.behavior.createPad = null; f.behavior.setText = async () => ({ ok: false, status: 503 }); await f.api().open('Partial', true).catch(() => {});
        const before = f.calls.length; await f.api().open('Partial', true);
        check(!f.calls.slice(before).some(call => ['createPad', 'setText'].includes(call.method)) && padName === 'Partial', 'accepted Create resumes without writes'); f.dispose();
    }],
    ['source/session changes during preparation stop subsequent writes and late UI', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); const gate = etherpadDocumentGate(); f.behavior.createAuthorIfNotExistsFor = () => gate.promise;
        const pending = f.api().open('Obsolete', true).catch(() => {}); await etherpadDocumentFlush(); f.token('other');
        gate.resolve({ ok: true, json: async () => ({ code: 0, data: { authorID: 'old' } }) }); await pending;
        check(!f.calls.some(call => call.method === 'createPad') && !f.node('padIframe').src, 'expired source cannot Create or navigate'); f.dispose();
    }],
    ['account append uses captured body/target/auth and exact reference only after acceptance', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('Existing');
        await editorHandlers.etherpad.loadContent({ type: 'text/plain', value: '<quote>\nLine' }, 'item-0');
        const call = f.calls.find(call => call.method === 'setHTML');
        check(call.params.get('html') === '<body><p>Existing</p>&lt;quote&gt;<br>Line</body>' && call.params.get('padID') === 'Existing', 'plaintext escaped and captured pad');
        check(call.params.get('apikey') === 'private-key' && call.options.headers.Authorization === 'Bearer private-token' && f.references.join() === 'item-0', 'captured credentials and accepted reference'); f.dispose();
    }],
    ['read-then-write guards reject changed pads and accepted old writes do not add references', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('Existing'); const gate = etherpadDocumentGate(); f.behavior.getHTML = () => gate.promise;
        const first = f.api().append({ type: 'text/html', value: '<p>One</p>' }, 'one').catch(() => {}); await etherpadDocumentFlush(); connectToThirdPartyEtherpad('https://guest.invalid', 'Other');
        gate.resolve({ ok: true, json: async () => ({ code: 0, data: { html: 'Old' } }) }); await first;
        check(!f.calls.some(call => call.method === 'setHTML') && !f.references.length, 'stale read cannot dispatch write');
        f.dispose(); const g = etherpadDocumentFixture(); await g.mount(); await g.api().open('Existing'); const write = etherpadDocumentGate(); g.behavior.setHTML = () => write.promise;
        const second = g.api().append({ type: 'text/html', value: 'Two' }, 'two'); await etherpadDocumentFlush(); connectToThirdPartyEtherpad('https://guest.invalid', 'Other');
        write.resolve({ ok: true, json: async () => ({ code: 0, data: null }) }); await second;
        check(!g.references.length && g.node('padIframe').src === 'https://guest.invalid/p/Other', 'accepted old write has no new-pad effects'); g.dispose();
    }],
    ['guest export/import uses captured relay/form bytes and no account API', async check => {
        const f = etherpadDocumentFixture(); await f.mount(null); connectToThirdPartyEtherpad('https://guest.invalid', 'team');
        check(await editorHandlers.etherpad.getContent() === '<p>Guest</p>', 'guest HTML export');
        await editorHandlers.etherpad.loadContent({ type: 'text/html', value: '<p>Append</p>' }, 'guest-item');
        const call = f.calls.find(call => call.method === 'import');
        check(call.params.get('url') === 'https://guest.invalid/p/team/import' && await call.params.get('file').text() === '<body><p>Guest</p><p>Append</p></body>', 'captured relay file');
        check(f.references[0] === 'guest-item' && !f.calls.some(call => call.params?.get?.('apikey')), 'guest reference and no account key'); f.dispose();
    }],
    ['failures propagate, uncertain writes are visible and never add success references', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('Existing'); f.behavior.setHTML = async () => ({ ok: false, status: 503 });
        let rejected = false; await f.api().append({ type: 'text/html', value: 'Quote' }, 'bad').catch(() => { rejected = true; });
        check(rejected && !f.references.length && window.CList.state.etherpadDocument.receipt === 'uncertain' && f.host.textContent.includes('Check the pad'), 'uncertain failure visible and propagates');
        f.behavior.setHTML = null; f.behavior.reference = true; await f.api().append({ type: 'text/html', value: 'Accepted' }, 'ref-fail');
        check(window.CList.state.etherpadDocument.receipt === 'accepted' && f.host.textContent.includes('reference could not be added'), 'reference failure retains write acceptance'); f.dispose();
    }],
    ['empty exports, explicit format checks and author/text compatibility paths', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('Existing');
        check(await extractEtherpadContent('text') === '', 'empty string is a valid export');
        let rejected = false; await extractEtherpadContent('invalid').catch(() => { rejected = true; }); check(rejected, 'invalid format rejected');
        await getAuthorId('Other author'); await f.api().appendText('Exact text');
        const call = f.calls.find(call => call.method === 'appendText'); check(call.params.get('text') === 'Exact text' && call.params.get('authorID') === 'author-Alice', 'captured appendText author contract'); f.dispose();
    }],
    ['safe Share card and captured chat send with duplicate/stale guards', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('<Literal>'); const gate = etherpadDocumentGate(); f.behavior.send = () => gate.promise;
        f.button('Share').click(); const first = sharePad(), second = sharePad(); check(first === second, 'duplicate Share shares pending promise'); await etherpadDocumentFlush();
        check(f.cards.length === 1 && f.cards[0].textContent.includes('<Literal>') && !f.cards[0].querySelector('Literal') && f.cards[0].querySelector('a').href.includes('%3CLiteral%3E'), 'literal share card with encoded link');
        check(f.messages.length === 1 && f.messages[0].includes("Room") && !f.messages[0].includes('private-'), 'one captured chat dispatch'); gate.resolve(); await first;
        globalThis.currentEditor = 'texteditor'; await sharePad().catch(() => {}); check(f.messages.length === 1, 'hidden source cannot share'); f.dispose();
    }],
    ['guest relay rejection and malformed export propagate without reference success', async check => {
        const f = etherpadDocumentFixture(); await f.mount(null); connectToThirdPartyEtherpad('https://guest.invalid', 'team');
        f.behavior.import = async () => ({ ok: true, json: async () => ({ error: 'Relay failed' }) });
        let rejected = false; await f.api().append({ type: 'text/html', value: 'Quote' }, 'bad').catch(() => { rejected = true; });
        check(rejected && !f.references.length && window.CList.state.etherpadDocument.receipt === 'uncertain', 'relay uncertainty is not reference success'); f.dispose();
        const g = etherpadDocumentFixture(); await g.mount(); await g.api().open('Existing'); g.behavior.getHTML = async () => ({ ok: true, json: async () => ({ code: 0, data: {} }) });
        rejected = false; await g.api().read().catch(() => { rejected = true; }); check(rejected && g.host.textContent.includes('invalid document content'), 'malformed export rejected'); g.dispose();
    }],
    ['duplicate content writes coalesce and rejected author mapping permits explicit Create retry', async check => {
        const f = etherpadDocumentFixture(); await f.mount(); await f.api().open('Existing'); const gate = etherpadDocumentGate(); f.behavior.setHTML = () => gate.promise;
        const first = f.api().append({ type: 'text/html', value: 'Quote' }, 'same'), second = f.api().append({ type: 'text/html', value: 'Quote' }, 'same');
        check(first === second, 'duplicate append shares pending promise'); await etherpadDocumentFlush(); gate.resolve({ ok: true, json: async () => ({ code: 0, data: null }) }); await first;
        check(f.references.length === 1 && f.calls.filter(call => call.method === 'setHTML').length === 1, 'one write and reference');
        f.behavior.createAuthorIfNotExistsFor = async () => { throw new Error('Author response lost'); }; await f.api().open('Retry', true).catch(() => {});
        f.behavior.createAuthorIfNotExistsFor = null; await f.api().open('Retry', true);
        check(f.calls.filter(call => call.method === 'createPad' && call.params.get('padID') === 'Retry').length === 1, 'author failure did not mark an undispatched Create uncertain'); f.dispose();
    }],
];
