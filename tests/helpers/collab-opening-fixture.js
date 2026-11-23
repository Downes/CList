function openingGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function openingFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function openingFixture() {
    let source = 1, selection = 1;
    const calls = [], states = [], errors = [], behavior = {}, root = document.createElement('div'); document.body.appendChild(root);
    const label = document.createElement('input'), title = document.createElement('p'); root.append(label, title);
    globalThis.showErrorModal = (message, options) => errors.push({ message, options });
    const controller = createCollabOpeningController({
        capture: () => source, current: captured => captured === source,
        async select(current) {
            calls.push(['select']); const captured = selection;
            if (behavior.select) await behavior.select();
            return behavior.cancel ? null : () => current() && captured === selection && root.isConnected;
        },
        async connect(target, current) {
            calls.push(['connect', { ...target }, current]);
            if (behavior.connect) await behavior.connect(target, current);
            if (!current()) throw Error('Expired connection');
        }, state: state => states.push(structuredClone(state))
    }, createCollabOpeningView((value, metadata) => { label.value = value; title.textContent = metadata; }));
    return { controller, calls, states, errors, behavior, label, title,
        expire() { source++; }, switch() { selection++; }, dispose() { controller.dispose(); root.remove(); } };
}
const collabOpeningCases = [
    ['link parsing preserves namespace/mode/server and default edit', async check => {
        const read = normalizeCollabOpening('url', 'https://host.invalid/doc/did%3Akey%3Atest/My%20notes/read?ignored=yes');
        check(read.docId === 'did:key:test/My notes' && read.mode === 'read' && read.server === 'wss://host.invalid', 'decoded ID and origin routing');
        const edit = normalizeCollabOpening('url', 'http://host.invalid:8080/doc/ns/name');
        check(edit.mode === 'edit' && edit.server === 'ws://host.invalid:8080' && edit.label === 'name', 'legacy default edit and HTTP routing');
    }],
    ['invites capture only supported fields with default routing', async check => {
        const f = openingFixture(), invite = { docId: 'ns/original', title: '<b>literal</b>', token: 'excluded', extension: { secret: true } };
        const pending = f.controller.open('invite', invite); invite.docId = 'changed'; invite.title = 'changed'; check(await pending, 'invite opened');
        const target = f.calls.find(call => call[0] === 'connect')[1];
        check(target.docId === 'ns/original' && target.mode === 'edit' && target.server === null && !JSON.stringify(target).includes('excluded'), 'captured input and public fields only');
        check(f.title.textContent === '<b>literal</b>' && !f.title.querySelector('b') && f.label.value === 'original', 'literal metadata displayed after connection');
        check(f.states.every(state => Object.keys(state).sort().join() === 'busy,phase'), 'secret-free presentation state'); f.dispose();
    }],
    ['invalid requests fail before editor effects', async check => {
        const f = openingFixture();
        for (const [kind, input] of [['url','javascript:/doc/name'],['url','https://host.invalid/other/name'],['url','https://host.invalid/doc/read'],['url','https://host.invalid/doc/%ZZ'],['invite',{docId:'x',mode:'admin'}],['invite',{docId:'x',server:'https://host.invalid'}],['invite',{docId:'x',server:'wss://user:password@host.invalid'}],['invite',{docId:''}]]) {
            check(await f.controller.open(kind, input) === false, 'invalid request rejected');
        }
        check(f.calls.length === 0 && f.errors.length === 8, 'visible validation without selection/connection'); f.dispose();
    }],
    ['duplicate opening coalesces and superseded link cannot complete', async check => {
        const f = openingFixture(), gate = openingGate(); f.behavior.connect = () => gate.promise;
        const old = f.controller.open('invite', { docId:'old' }), duplicate = f.controller.open('invite', { docId:'old' });
        check(old === duplicate, 'duplicate returns owned pending promise'); await openingFlush(); delete f.behavior.connect;
        check(await f.controller.open('url','https://new.invalid/doc/new/read'), 'newer open completes'); gate.resolve();
        check(await old === false && f.label.value === 'new' && f.errors.length === 0, 'old connection guard rejects without overwriting title or error');
        check(f.calls.filter(call => call[0] === 'select').length === 2, 'one selection per intent'); f.dispose();
    }],
    ['session expiry during selection prevents connection and feedback', async check => {
        const f = openingFixture(), gate = openingGate(); f.behavior.select = () => gate.promise;
        const pending = f.controller.open('invite',{docId:'old'}); await openingFlush(); f.expire(); gate.resolve();
        check(await pending === false && f.calls.length === 1 && f.errors.length === 0, 'expired selection cannot connect'); f.dispose();
    }],
    ['newer selection or detached surface rejects connection completion', async check => {
        const f = openingFixture(), gate = openingGate(); f.behavior.connect = () => gate.promise;
        const pending = f.controller.open('invite',{docId:'old'}); await openingFlush(); f.switch(); gate.resolve();
        check(await pending === false && !f.label.value && f.errors.length === 0, 'newer editor blocks old titles/errors'); f.dispose();
        const g = openingFixture(), wait = openingGate(); g.behavior.connect = () => wait.promise;
        const detached = g.controller.open('invite',{docId:'old'}); await openingFlush(); g.label.parentNode.remove(); wait.resolve();
        check(await detached === false && g.errors.length === 0, 'removed editor blocks completion'); g.dispose();
    }],
    ['cancelled mounting and visible failure permit explicit retry', async check => {
        const f = openingFixture(); f.behavior.cancel = true;
        check(await f.controller.open('invite',{docId:'same'}) === false && f.calls.length === 1 && f.states.at(-1).phase === 'cancelled', 'cancel stops before connect');
        delete f.behavior.cancel; f.behavior.connect = () => { throw Error('fixture connection failed'); };
        check(await f.controller.open('invite',{docId:'same'}) === false && f.errors.length === 1 && f.states.at(-1).phase === 'error', 'owned failure visible');
        delete f.behavior.connect; check(await f.controller.open('invite',{docId:'same'}) && f.states.at(-1).phase === 'ready', 'explicit retry succeeds'); f.dispose();
    }],
    ['superseded shared preparation is cancellation rather than failure', async check => {
        const f = openingFixture(); f.behavior.connect = () => { throw Object.assign(Error('expired preparation'), { code:'ExpiredCollabPreparation' }); };
        check(await f.controller.open('invite',{docId:'old'}) === false && f.errors.length === 0 && f.states.at(-1).phase === 'cancelled', 'newer shared connection suppresses old failure'); f.dispose();
    }],
    ['disposed controller rejects late work without touching newer UI', async check => {
        const f = openingFixture(), gate = openingGate(); f.behavior.connect = () => gate.promise;
        const pending = f.controller.open('invite',{docId:'old'}); await openingFlush(); f.controller.dispose(); gate.reject(Error('late failure'));
        check(await pending === false && f.errors.length === 0 && !f.label.value, 'disposed request has no late effects'); f.dispose();
    }]
];
