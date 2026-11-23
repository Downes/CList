function cardsGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let previousCardsFixture = null;
function cardsFixture(bridge = false) {
    previousCardsFixture?.dispose();
    const root = document.createElement('div'); root.id = 'chat-messages'; document.body.appendChild(root);
    const calls = [], packets = [], references = [], states = [], behavior = {}; let current = true, generation = 1, controller;
    const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    Object.assign(globalThis, { showServiceError(container, title, message) { const node = document.createElement('div'); node.className = 'error-message'; node.textContent = title + ': ' + message; container.appendChild(node); } });
    if (bridge) {
        myUsername = 'Me'; chatBc = { postMessage: packet => packets.push(structuredClone(packet)) };
        const handler = { loadContent(content) { calls.push({ kind: 'load', content, bound: this === handler }); return behavior.load?.(); } };
        Object.assign(globalThis, { captureP2pSessionGuard: () => () => current, currentEditor: 'fixture-editor', editorHandlers: { 'fixture-editor': handler }, escapeHtml: escape,
            pushReference: reference => references.push(structuredClone(reference)), localPartOf: id => id, openInBrowser: url => calls.push({ kind: 'open', url }) });
        window.CList.state.editorSwitching = { id: 1 };
        window.importCollectionFromChat = async (items, anchor) => { calls.push({ kind: 'import', items, anchor }); if (behavior.import) await behavior.import(); };
        window.openCollabInvite = async invite => { calls.push({ kind: 'invite', invite }); if (behavior.invite) await behavior.invite(); };
    } else {
        controller = createP2pCardsController({ current: () => current, username: () => 'Me', escape, now: () => '2026-11-21T12:00:00Z', localTitle: id => id,
            state: state => states.push(structuredClone(state)), relay: packet => { if (behavior.relay) behavior.relay(); packets.push(structuredClone(packet)); },
            open: url => calls.push({ kind: 'open', url }),
            import: async (items, anchor) => { calls.push({ kind: 'import', items, anchor }); if (behavior.import) await behavior.import(); },
            invite: async invite => { calls.push({ kind: 'invite', invite }); if (behavior.invite) await behavior.invite(); },
            editor: () => ({ generation }), editorCurrent: target => target.generation === generation,
            load: async (content, target) => { calls.push({ kind: 'load', content, target }); if (behavior.load) await behavior.load(); },
            reference: value => references.push(structuredClone(value))
        }, createP2pCardsView());
    }
    const f = { root, calls, packets, references, states, behavior,
        share: (data, sender = null) => bridge ? appendShareCard(data, sender) : controller.share(data, sender),
        invite: (data, sender) => bridge ? appendCollabInviteCard(data, sender) : controller.invite(data, sender),
        state: () => bridge ? window.CList.state.chatCards : states.at(-1),
        button: (row, label) => Array.from(row.querySelectorAll('button')).find(button => button.textContent === label),
        expire: () => { current = false; }, editor: () => { generation++; if (bridge) window.CList.state.editorSwitching.id++; },
        dispose() { if (bridge) _p2pCards?.dispose(); else controller.dispose(); root.remove(); }
    };
    previousCardsFixture = f; return f;
}
const p2pCardsCases = [
    ['literal share cards retain exact URL/reference fields and escaped editor content', async check => {
        const f = cardsFixture(), data = { kind: 'annotation', url: 'https://source.invalid/a?a=1&b=2', title: '<b>Title</b>', excerpt: '<img src=x>' };
        const row = f.share(data, 'Author <X>'); check(row.textContent.includes('<b>Title</b>') && row.querySelector('a').textContent === '<b>Title</b>', 'literal title/sender');
        await f.button(row, '→ Load to editor').onclick();
        check(f.calls[0].content.value.includes('&lt;img') && f.calls[0].content.value.includes('a=1&amp;b=2'), 'editor HTML escapes content and URL');
        const ref = f.references[0]; check(ref.url === data.url && ref.id === data.url && ref.guid === data.url && ref.author_name === 'Author <X>' && ref.feed === 'Chat share', 'exact structural reference retained');
        check(!JSON.stringify(f.state()).includes('source.invalid') && f.state().busy === 0, 'state contains counts only');
    }],
    ['collection import captures extensions and suppresses duplicate pending actions', async check => {
        const f = cardsFixture(), gate = cardsGate(), data = { kind: 'collection', title: 'Collection', items: [{ url: 'https://member.invalid', title: 'Member', custom: { retained: 1 } }] };
        const row = f.share(data); data.items[0].custom.retained = 9; f.behavior.import = () => gate.promise;
        const button = f.button(row, '↓ Add to my collection'), work = button.onclick(); await button.onclick();
        check(f.calls.length === 1 && f.calls[0].items[0].custom.retained === 1 && f.calls[0].anchor === button && button.disabled, 'original detached items/anchor and one pending import');
        gate.resolve(); await work; check(!button.disabled && f.state().busy === 0, 'completion releases lock');
    }],
    ['collaboration invite fields are literal/captured and popup relay is escaped', async check => {
        const f = cardsFixture(), invite = { docId: 'original-doc', title: '<img src=x>', mode: 'read', extension: { keep: true } };
        const row = f.invite(invite, '<b>Peer</b>'); invite.docId = 'changed';
        check(row.textContent.includes('<img src=x>') && row.textContent.includes('view'), 'invite title/mode are literal');
        check(f.packets[0].html.includes('&lt;img') && !f.packets[0].html.includes('<img'), 'popup collaboration text is escaped');
        await f.button(row, 'Open in Collab').onclick(); check(f.calls[0].invite.docId === 'original-doc' && f.calls[0].invite.extension.keep, 'captured full invitation reaches existing API');
    }],
    ['unsafe link schemes have no navigation/editor controls or popup hrefs', async check => {
        const f = cardsFixture();
        for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'not an absolute URL']) {
            const row = f.share({ kind: 'item', title: 'Unsafe', url });
            check(!row.querySelector('a') && !f.button(row, '→ Load to editor') && f.packets.at(-1).url === null, 'invalid scheme cannot become an action/link');
        }
        const row = f.share({ kind: 'item', url: 'https://safe.invalid', title: 'Safe' }); await row.querySelector('a').onclick({ preventDefault() {} });
        check(f.calls[0].url === 'https://safe.invalid', 'valid captured navigation dispatched');
    }],
    ['removed rows/session expiry reject saved callbacks and late action feedback', async check => {
        const f = cardsFixture(), row = f.share({ kind: 'item', url: 'https://source.invalid' }), old = f.button(row, '→ Load to editor').onclick;
        row.remove(); await old(); check(!f.calls.length, 'detached card cannot load');
        const invite = f.invite({ docId: 'doc' }, 'Peer'), gate = cardsGate(); f.behavior.invite = () => gate.promise;
        const button = f.button(invite, 'Open in Collab'), work = button.onclick(); f.expire(); gate.reject(Error('late failure')); await work;
        check(!invite.textContent.includes('late failure'), 'expired completion does not show feedback in another session');
        await button.onclick(); check(f.calls.length === 1, 'expired card never dispatches again');
    }],
    ['editor/row changes suppress post-load references and failures allow explicit retry', async check => {
        const f = cardsFixture(), row = f.share({ kind: 'item', url: 'https://source.invalid' }), gate = cardsGate(); f.behavior.load = () => gate.promise;
        const button = f.button(row, '→ Load to editor'), work = button.onclick(); f.editor(); gate.resolve(); await work;
        check(f.calls.length === 1 && !f.references.length, 'new editor generation prevents reference mutation');
        f.behavior.load = () => { throw Error('synthetic editor failure'); }; await button.onclick();
        check(row.textContent.includes('synthetic editor failure') && !button.disabled && f.calls.length === 2, 'visible failure releases without retry');
        delete f.behavior.load; await button.onclick(); check(f.calls.length === 3 && f.references.length === 1, 'explicit retry can complete');
    }],
    ['relay failure preserves local card and malformed input fails visibly', async check => {
        const f = cardsFixture(); f.behavior.relay = () => { throw Error('relay failed'); };
        const row = f.share({ kind: 'item', url: 'https://source.invalid' });
        check(!!row && row.textContent.includes('relay failed') && !!f.button(row, '→ Load to editor'), 'local card survives relay failure');
        check(f.share(null) === null && f.root.textContent.includes('Chat action failed'), 'malformed card returns visible failure');
    }],
    ['real compatibility wrappers retain method binding, metadata and missing-API feedback', async check => {
        const f = cardsFixture(true), row = f.share({ kind: 'item', url: 'https://exact.invalid/?x=1&y=2', title: 'Exact' });
        await f.button(row, '→ Load to editor').onclick(); check(f.calls[0].bound && f.references[0].url === 'https://exact.invalid/?x=1&y=2', 'captured handler keeps binding and exact reference');
        const invite = f.invite({ docId: 'doc' }, 'Peer'); delete window.openCollabInvite; await f.button(invite, 'Open in Collab').onclick();
        check(invite.textContent.includes('Collab editor not available'), 'unavailable integration gives visible error');
        const old = row.querySelector('a').onclick; f.expire(); await old({ preventDefault() {} }); check(f.calls.length === 1, 'legacy wrapper keeps source ownership');
    }]
];
