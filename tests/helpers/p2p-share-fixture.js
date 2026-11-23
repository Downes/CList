function outgoingGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let previousOutgoingFixture = null;
function outgoingFixture(bridge = false) {
    previousOutgoingFixture?.dispose();
    const root = document.createElement('div'); document.body.appendChild(root);
    const sourceRow = document.createElement('div'); sourceRow.className = 'status-box'; root.appendChild(sourceRow);
    let rowCurrent = true, source = 'synthetic-token', discussion = null, sessionCurrent = true, sequence = 0, controller, callbacks = {};
    sourceRow.isCListRowCurrent = () => rowCurrent;
    const item = document.createElement('div'); item.id = 'share-source'; item.reference = { title: 'Original title', url: 'https://original.invalid', author_name: 'Author' }; item.textContent = 'Original   excerpt'; sourceRow.appendChild(item);
    const input = document.createElement('input'); input.id = 'discussionNameInput'; input.value = 'Untouched draft'; root.appendChild(input);
    const checkbox = document.createElement('input'); checkbox.id = 'discussionPublicCheckbox'; checkbox.checked = true; root.appendChild(checkbox);
    const states = [], packets = [], previews = [], notices = [], errors = [], creates = [], behavior = {};
    const resources = { peer: { id: null }, connections: {}, processedMsgIds: new Set() };
    const sessionSource = source;
    const session = { resources, isCurrent: () => sessionCurrent && source === sessionSource };
    const channel = id => {
        const value = { peer: id, open: true, send(packet) { if (behavior.send) behavior.send(value, packet); packets.push({ peer: id, packet: structuredClone(packet) }); } };
        resources.connections[id] = value; return value;
    };
    const actions = createP2pDiscussionActionsController({ source: () => source, state() {},
        capture: (_kind, values) => ({ ...values, peerId: resources.peer.id, before: discussion, effects: {} }),
        owns: op => !!op && sessionCurrent && (discussion === op.before || (op.effects.active && discussion === op.name)),
        async write(op) { creates.push({ name: op.name, public: op.public }); if (behavior.creating) await behavior.creating(); return { status: behavior.receipt || 'accepted', message: 'synthetic receipt' }; },
        read: async () => ({ kind: 'ready', items: [] }),
        apply: async op => { discussion = op.name; op.effects.active = true; }
    }, { alive: () => root.isConnected, accepts: () => true, values: () => ({ name: input.value, public: checkbox.checked }),
        render: (_state, actions) => { callbacks = actions; }, active() {}, dispose() {} });
    Object.assign(globalThis, { showStatusMessage: text => notices.push(text), showErrorModal: text => errors.push(text) });
    if (bridge) {
        _p2pSession = session; myUsername = 'Sender';
        Object.assign(globalThis, { getSiteSpecificCookie: (_url, key) => key === window.CList.keys.USERNAME ? 'user' : source,
            openP2pChat: () => { activeDiscussionName = discussion; return session; }, getP2pDiscussionActions: () => ({ begin: async (...args) => { const result = await actions.begin(...args); activeDiscussionName = discussion; return result; } }),
            appendShareCard: packet => { if (behavior.preview) behavior.preview(); previews.push(structuredClone(packet)); },
            appendCollabInviteCard: packet => previews.push(structuredClone(packet)) });
        activeDiscussionName = discussion;
    } else {
        controller = createP2pShareController({ source: () => source, session: () => session, discussion: () => discussion, username: () => 'Sender', id: () => 'packet-' + ++sequence,
            create: values => actions.begin('create', undefined, values), state: state => states.push(structuredClone(state)),
            preview: packet => { if (behavior.preview) behavior.preview(); previews.push(structuredClone(packet)); }
        }, createP2pShareView());
    }
    const f = { root, item, sourceRow, input, checkbox, session, resources, channel, states, packets, previews, notices, errors, creates, behavior,
        queue: id => bridge ? shareToChat(id || item.id) : controller.enqueue(id || item.id),
        ready: () => bridge ? resumeP2pShare(session) : controller.ready(session),
        share: (kind, url, title, excerpt, extra) => bridge ? sendShareMessage(kind, url, title, excerpt, extra) : controller.share(kind, url, title, excerpt, extra),
        invite: invite => bridge ? window.sendCollabInvite(invite) : controller.invite(invite),
        state: () => bridge ? window.CList.state.chatShare : states.at(-1),
        expire: () => { source += '-new'; }, expireSession: () => { sessionCurrent = false; }, expireRow: () => { rowCurrent = false; },
        discussion: value => { discussion = value; if (bridge) activeDiscussionName = value; }, actions: () => callbacks,
        cancel: () => bridge ? cancelP2pShare(session) : controller.cancel(session),
        dispose() { if (bridge) _p2pShare?.dispose(); else controller.dispose(); actions.dispose(); root.remove(); }
    };
    previousOutgoingFixture = f; return f;
}
const outgoingShareCases = [
    ['pure item preparation retains title/author fallback and bounded excerpt', async check => {
        const reference = { title: 'Mastodon', author_name: 'Author', url: 'https://exact.invalid/?a=1&b=2' };
        const data = prepareP2pItemShare(reference, 'x'.repeat(600), 'id');
        check(data.discussion === "Author's post" && data.title === 'Author' && data.excerpt.length <= 500 && data.excerpt.endsWith('…') && data.url === reference.url, 'captured title fallback/excerpt/exact URL');
        const limited = prepareP2pItemShare({ title: 'z'.repeat(90) }, 'a   b', 'id').discussion;
        check(limited.length <= 60 && limited.endsWith('…') && prepareP2pItemShare({}, 'a   b', 'id').excerpt === 'a b', 'discussion limit and whitespace');
    }],
    ['queued source is captured before peer readiness and reuses real Create controller', async check => {
        const f = outgoingFixture(); f.channel('peer'); await f.queue(); await f.queue();
        f.item.reference.title = 'Changed title'; f.item.reference.url = 'https://changed.invalid'; f.item.textContent = 'Changed excerpt';
        check(!f.creates.length && !f.packets.length && f.state().phase === 'waiting-peer', 'one deferred share without publication');
        const gate = outgoingGate(); f.behavior.creating = () => gate.promise; f.resources.peer.id = 'local'; const ready = f.ready(); await f.ready();
        check(f.creates.length === 1 && f.creates[0].name === 'Original title' && f.input.value === 'Untouched draft', 'captured automatic Create leaves newer input alone');
        gate.resolve(); await ready;
        check(f.packets.length === 1 && f.packets[0].packet.url === 'https://original.invalid' && f.packets[0].packet.excerpt === 'Original excerpt', 'one original packet after confirmed Create');
        check(!JSON.stringify(f.states).includes('original.invalid') && f.previews.length === 1, 'safe state and local preview');
    }],
    ['last waiting selection wins and stale row/source/session never resumes', async check => {
        const f = outgoingFixture(); await f.queue();
        const second = document.createElement('div'); second.id = 'second-source'; second.reference = { title: 'Second', url: 'https://second.invalid' }; second.textContent = 'Second'; f.sourceRow.appendChild(second);
        await f.queue(second.id); f.resources.peer.id = 'local'; await f.ready();
        check(f.creates[0].name === 'Second' && f.previews[0].url === 'https://second.invalid', 'last queued selection replaces first');
        for (const change of ['expireRow', 'expire', 'expireSession', 'cancel']) {
            const g = outgoingFixture(); await g.queue(); g[change](); g.resources.peer.id = 'local'; await g.ready();
            check(!g.creates.length && !g.packets.length && !g.previews.length, 'stale/cancelled pending share sends nothing: ' + change);
        }
    }],
    ['uncertain Create never broadcasts or automatically retries; explicit recovery is separate', async check => {
        const f = outgoingFixture(); f.resources.peer.id = 'local'; f.channel('peer'); f.behavior.receipt = 'uncertain'; await f.queue(); await f.queue();
        check(f.creates.length === 1 && !f.packets.length && f.errors.length >= 1, 'unknown Create blocks share and another write');
        await f.actions().check(); f.behavior.receipt = 'accepted'; await f.actions().retry();
        check(f.creates.length === 2 && !f.packets.length, 'explicit Create recovery does not implicitly broadcast');
        await f.queue(); check(f.packets.length === 1 && f.creates.length === 2, 'explicit Share after recovery broadcasts once');
        const g = outgoingFixture(); await g.queue(); g.discussion('New conversation'); g.resources.peer.id = 'local'; await g.ready();
        check(!g.creates.length && !g.packets.length, 'new discussion suppresses old automatic Create/share');
    }],
    ['direct collection shares preserve extensions and protect protocol identity', async check => {
        const f = outgoingFixture(); f.resources.peer.id = 'local'; f.channel('one'); f.channel('two');
        const extra = { items: [{ url: 'https://member.invalid', extension: { keep: true } }], extension: 'kept', type: 'wrong', username: 'wrong', msgId: 'wrong', kind: 'wrong' };
        const result = f.share('collection', null, 'Collection', null, extra); extra.items[0].extension.keep = false;
        const packet = f.packets[0].packet;
        check(result.sent === 2 && f.packets.length === 2 && packet.items[0].extension.keep && packet.extension === 'kept', 'detached extensions sent to captured recipients');
        check(packet.type === 'share' && packet.kind === 'collection' && packet.username === 'Sender' && packet.msgId !== 'wrong' && f.resources.processedMsgIds.has(packet.msgId), 'reserved fields and dedup ID cannot be overridden');
        check(!f.creates.length && f.previews.length === 1, 'direct API keeps local preview and does not auto-create');
    }],
    ['partial/uncertain transport attempts each owned recipient once without retry', async check => {
        const f = outgoingFixture(); f.resources.peer.id = 'local'; f.channel('first'); f.channel('replaced'); f.channel('failing');
        f.behavior.send = channel => { if (channel.peer === 'first') f.channel('replaced'); if (channel.peer === 'failing') throw Error('transport result lost'); };
        const result = f.share('item', 'https://source.invalid', 'Title', null);
        check(result.sent === 1 && result.failed === 1 && f.packets.length === 1, 'replacement skipped and uncertain recipient not retried');
        check(f.notices.some(text => text.includes('uncertain')) && f.previews.length === 1, 'partial dispatch visible with one local preview');
        const g = outgoingFixture(); g.resources.peer.id = 'local'; g.channel('peer'); g.behavior.preview = () => { throw Error('preview failed'); };
        g.share('item', 'https://source.invalid', 'Title', null); check(g.packets.length === 1 && g.errors[0].includes('preview failed'), 'preview failure never resends accepted dispatch');
    }],
    ['collaboration invite API remains synchronous boolean with captured extensions', async check => {
        const f = outgoingFixture(); f.resources.peer.id = 'local';
        check(f.invite({ docId: 'doc' }) === false && !f.previews.length, 'no open peers returns false without a preview');
        f.channel('peer'); const invite = { docId: 'doc', mode: 'read', server: 'https://collab.invalid', custom: { keep: 1 }, type: 'wrong' };
        check(f.invite(invite) === true && f.packets[0].packet.type === 'collab-invite' && f.packets[0].packet.custom.keep === 1, 'sync boolean/protected type and extension contract');
        f.expire(); check(f.invite(invite) === false && f.packets.length === 1, 'expired session cannot invite');
    }],
    ['real wrappers/ready hook keep captured item, direct share and invite contracts', async check => {
        const f = outgoingFixture(true); f.channel('peer'); await f.queue(); f.item.reference.url = 'https://new.invalid'; f.resources.peer.id = 'local'; await f.ready();
        check(f.packets[0].packet.url === 'https://original.invalid' && f.input.value === 'Untouched draft', 'legacy Share/ready forwards captured source without rewriting form');
        const result = f.share('annotation', 'https://annotation.invalid', 'Annotation', 'Excerpt');
        check(result.sent === 1 && f.previews.at(-1).kind === 'annotation', 'direct compatibility API retained');
        check(f.invite({ docId: 'doc', mode: 'edit' }) === true, 'legacy collaboration boolean retained');
        f.expire(); f.share('item', 'https://expired.invalid', 'Expired', null); check(f.packets.length === 3, 'old account direct broadcasts rejected');
    }]
];
