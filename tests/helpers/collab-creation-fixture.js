function creationGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function creationFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function creationFixture() {
    let source = 1, selection = 1, intent = 0, resource = null;
    const calls = [], states = [], errors = [], timers = [], cleared = [], behavior = {}, events = new Set();
    const root = document.createElement('div'), label = document.createElement('input'), title = document.createElement('p'); root.append(label, title); document.body.appendChild(root);
    const content = [], editor = { isEmpty: true,
        on(name, callback) { if (name === 'update') events.add(callback); }, off(name, callback) { events.delete(callback); },
        commands: { setContent(html) { if (behavior.seedError) throw Error('seed failed'); content.push(html); editor.isEmpty = false; }, focus(position) { calls.push(['focus', position]); } } };
    globalThis.escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    globalThis.sanitizeHtml = html => { calls.push(['sanitize', html]); return html; };
    globalThis.showErrorModal = message => errors.push(message);
    const controller = createCollabCreationController({
        prepare: (kind,input) => prepareCollabCreation(kind,input,{ slug: name => name ? 'collection-slug' : 'fallback', now: () => new Date('2026-11-21T12:34:56Z') }),
        before() { calls.push(['cancel-opening']); }, capture: () => source, current: value => value === source,
        async select(current) { const captured = selection; calls.push(['select']); if (behavior.select) await behavior.select(); return behavior.cancel ? null : () => current() && selection === captured && root.isConnected; },
        intent: () => intent, async expand(slug) { calls.push(['expand', slug]); return behavior.expand ? await behavior.expand() : 'namespace/' + slug; },
        async connect(docId,current) {
            intent++; calls.push(['connect',docId]); if (behavior.connect) await behavior.connect();
            if (!current()) throw Object.assign(Error('expired'),{code:'ExpiredCollabPreparation'});
            resource = {editor,docId,server:'wss://captured.invalid'}; return resource;
        }, resourceCurrent: target => target === resource,
        invite(captured, packet) { calls.push(['invite', packet]); if (behavior.inviteError) throw Error('invite failed'); },
        schedule(callback,delay) { timers.push({callback,delay}); return timers.length; }, clear: timer => cleared.push(timer), state: value => states.push(structuredClone(value))
    }, createCollabCreationView((slug,name) => { label.value = slug; title.textContent = name; }));
    return {controller,calls,states,errors,timers,cleared,behavior,events,content,editor,label,title,
        fire: () => timers.at(-1).callback(), expire() { source++; }, switch() { selection++; }, replace() { resource = null; intent++; },
        edit() { for (const callback of [...events]) callback(); }, dispose() { controller.dispose(); root.remove(); } };
}
const collabCreationCases = [
    ['collection snapshots and safe seed output target only the created editor', async check => {
        const f = creationFixture(), items = [{url:'https://saved.invalid/?a=1&b=2', title:'<literal>'},{url:''}];
        const pending = f.controller.create('collection',{name:'<Collection>',items}); items[0].url = 'https://changed.invalid'; items.push({url:'https://later.invalid'});
        check(await pending, 'document opened');
        check(f.timers[0].delay === 800 && f.states.at(-1).phase === 'waiting' && f.content.length === 0, 'legacy delay with explicit waiting state');
        f.fire(); f.fire();
        check(f.content.length === 1 && f.content[0].includes('&lt;Collection&gt;') && f.content[0].includes('&lt;literal&gt;') && !f.content[0].includes('changed.invalid') && !f.content[0].includes('later.invalid'), 'captured escaped content seeded once');
        check(f.events.size === 0 && f.calls.some(call => call[0] === 'sanitize') && f.states.at(-1).phase === 'ready', 'shared sanitizer boundary and listener cleanup');
        check(Object.keys(f.states[0]).sort().join() === 'busy,phase', 'safe presentation state'); f.dispose();
    }],
    ['chat title/slug/context and captured invite retain legacy contracts', async check => {
        const f = creationFixture(); await f.controller.create('chat',{name:'<Discussion>',html:'<p>Captured context</p>'}); f.fire();
        check(f.calls.find(call => call[0] === 'expand')[1] === 'discussion-2026-11-21-12-34-56', 'captured UTC slug');
        check(f.title.textContent === 'Discussion: <Discussion>' && !f.title.querySelector('Discussion'), 'literal title metadata');
        check(f.content[0].includes('<blockquote><p>Captured context</p></blockquote>') && f.calls.some(call => call[0] === 'focus' && call[1] === 'end'), 'chat formatting and captured editor focus');
        const packet = f.calls.find(call => call[0] === 'invite')[1];
        check(packet.docId === 'namespace/discussion-2026-11-21-12-34-56' && packet.server === 'wss://captured.invalid' && packet.mode === 'edit', 'invite uses captured connection target'); f.dispose();
    }],
    ['duplicate creates coalesce through the pending seed', async check => {
        const f = creationFixture(), input = {name:'Collection',items:[{url:'https://saved.invalid'}]};
        const first = f.controller.create('collection',input), second = f.controller.create('collection',input);
        check(first === second && await first, 'pending opening shared');
        check(f.controller.create('collection',input) === first && f.calls.filter(call => call[0] === 'invite').length === 1, 'waiting seed also holds duplicate lock'); f.fire(); f.dispose();
    }],
    ['newer edits including edits back to empty prevent seeding', async check => {
        const f = creationFixture(); await f.controller.create('chat',{html:'<p>old</p>'}); f.edit(); f.editor.isEmpty = true; f.fire();
        check(f.content.length === 0 && f.states.at(-1).phase === 'skipped' && f.events.size === 0, 'update history protects an empty newer draft'); f.dispose();
        const g = creationFixture(); await g.controller.create('chat',{html:'<p>old</p>'}); g.editor.isEmpty = false; g.fire();
        check(g.content.length === 0 && g.states.at(-1).phase === 'skipped', 'existing synchronized body preserved'); g.dispose();
    }],
    ['resource/editor/session replacement rejects delayed callbacks', async check => {
        for (const change of ['replace','switch','expire']) {
            const f = creationFixture(); await f.controller.create('chat',{html:'<p>old</p>'}); f[change](); f.fire();
            check(f.content.length === 0 && f.events.size === 0 && f.errors.length === 0, change + ' prevents old seed'); f.dispose();
        }
    }],
    ['namespace expansion cannot override a newer direct connection', async check => {
        const f = creationFixture(), gate = creationGate(); f.behavior.expand = () => gate.promise;
        const pending = f.controller.create('chat',{html:'old'}); await creationFlush(); f.replace(); gate.resolve('old/doc');
        check(await pending === false && !f.calls.some(call => call[0] === 'connect') && f.states.at(-1).phase === 'cancelled', 'captured connection intent rejects stale expansion'); f.dispose();
    }],
    ['new creation and disposal cancel timers and detach observers', async check => {
        const f = creationFixture(); await f.controller.create('chat',{html:'old'}); const old = f.timers[0].callback;
        await f.controller.create('collection',{name:'New',items:[{url:'https://new.invalid'}]}); old(); f.fire();
        check(f.content.length === 1 && f.content[0].includes('new.invalid') && f.cleared.includes(1), 'new creation cancels and rejects old seed'); f.dispose();
        const g = creationFixture(); await g.controller.create('chat',{html:'old'}); g.dispose(); g.fire();
        check(g.content.length === 0 && g.events.size === 0 && g.cleared.includes(1), 'disposed timer remains inert');
    }],
    ['cancelled and expired selection cannot create or invite', async check => {
        const f = creationFixture(); f.behavior.cancel = true;
        check(await f.controller.create('chat',{html:'old'}) === false && f.calls.length === 2, 'Cancel stops before expansion'); f.dispose();
        const g = creationFixture(), gate = creationGate(); g.behavior.select = () => gate.promise;
        const pending = g.controller.create('chat',{html:'old'}); await creationFlush(); g.expire(); gate.resolve();
        check(await pending === false && !g.calls.some(call => call[0] === 'invite') && g.errors.length === 0, 'expired source has no creation effects'); g.dispose();
    }],
    ['visible failures keep created documents and never automatically resend', async check => {
        const f = creationFixture(); f.behavior.connect = () => { throw Error('connect failed'); };
        check(await f.controller.create('chat',{html:'old'}) === false && f.errors.length === 1 && f.timers.length === 0, 'connection failure visible');
        delete f.behavior.connect; f.behavior.inviteError = true; check(await f.controller.create('chat',{html:'old'}), 'explicit retry opens document despite invite failure');
        f.behavior.seedError = true; f.fire(); check(f.errors.length === 3 && f.events.size === 0 && f.states.at(-1).phase === 'error', 'invite and seed errors separate with cleanup');
        check(f.calls.filter(call => call[0] === 'invite').length === 1, 'no automatic invitation retry'); f.dispose();
    }],
    ['empty inputs preserve title defaults without scheduling content writes', async check => {
        const f = creationFixture(); await f.controller.create('chat',{});
        check(f.title.textContent === 'Discussion — 2026-11-21' && f.timers.length === 0 && f.states.at(-1).phase === 'ready', 'chat date fallback without seed');
        await f.controller.create('collection',{}); check(f.title.textContent === 'fallback' && f.content.length === 0, 'collection slug fallback'); f.dispose();
    }]
];
