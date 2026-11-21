function collaborationGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function collaborationFlush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
function collaborationFixture(bridge = false) {
    let current = true, alive = true, discussion = 'Captured discussion';
    const rows = [{ html: '<b>Initial</b>', text: 'Initial', shared: false }], states = [], calls = [], errors = [], behavior = {};
    const open = async (html, title) => { calls.push({ html, title }); if (behavior.open) await behavior.open(); };
    const root = { isConnected: true, children: [] }, doc = { getElementById: () => root };
    const refreshRows = () => { root.children = rows.map(row => ({ innerHTML: row.html, textContent: row.text, querySelector: () => row.shared ? {} : null })); };
    refreshRows();
    Object.assign(globalThis, { showErrorModal: message => errors.push(message) });
    let controller; const originalView = createP2pCollaborationView;
    if (bridge) {
        _p2pCollaboration?.dispose(); _p2pCollaboration = null;
        activeDiscussionName = discussion; window.openCollabFromChat = open;
        Object.assign(globalThis, { createP2pCollaborationView: () => originalView(doc), captureP2pSessionGuard: () => () => current });
    } else controller = createP2pCollaborationController({ current: () => current,
        discussion: () => discussion, open: () => behavior.missing ? null : open,
        state: value => states.push(structuredClone(value))
    }, { alive: () => alive, capture: () => { if (behavior.capture) behavior.capture(); return rows; }, error: error => errors.push(error.message) });
    return { rows, states, calls, errors, behavior, root, doc, refreshRows,
        start: () => bridge ? startCollabFromChat() : controller.start(),
        expire: () => { current = false; }, detach: () => { alive = false; root.isConnected = false; },
        discussion: value => { discussion = value; if (bridge) activeDiscussionName = value; },
        dispose: () => { if (bridge) { _p2pCollaboration?.dispose(); globalThis.createP2pCollaborationView = originalView; } else controller.dispose(); } };
}
const p2pCollaborationCases = [
    ['last fifteen nonempty non-card rows preserve HTML and discussion', async check => {
        const f = collaborationFixture(); f.rows.length = 0;
        f.rows.push({ html: 'excluded-card', text: 'Card', shared: true }, { html: 'empty-row', text: '  ', shared: false });
        for (let i = 0; i < 18; i++) f.rows.push({ html: '<b>Row ' + i + '</b>', text: 'Row ' + i, shared: false });
        const pending = f.start(); f.rows[3].html = 'newer content'; f.discussion('New discussion');
        check(await pending, 'current dispatch resolves successfully');
        check(f.calls[0].html.startsWith('<p><b>Row 3</b></p>') && f.calls[0].html.endsWith('<p><b>Row 17</b></p>'), 'captured last fifteen ordered rows');
        check(!f.calls[0].html.includes('excluded-card') && !f.calls[0].html.includes('empty-row') && !f.calls[0].html.includes('newer content'), 'cards, blanks and subsequent edits excluded');
        check(f.calls[0].title === 'Captured discussion', 'discussion captured before deferred dispatch');
        check(JSON.stringify(f.states) === '[{"busy":true},{"busy":false}]', 'safe busy-only state'); f.dispose();
    }],
    ['duplicate commands share pending dispatch and empty context stays null', async check => {
        const f = collaborationFixture(), gate = collaborationGate(); f.rows.length = 0; f.behavior.open = () => gate.promise;
        const first = f.start(), second = f.start(); check(first === second, 'duplicate returns same operation'); await collaborationFlush();
        check(f.calls.length === 1 && f.calls[0].html === null, 'one existing API call with null empty context');
        gate.resolve(); await first; delete f.behavior.open; await f.start(); check(f.calls.length === 2, 'explicit later command can start another document'); f.dispose();
    }],
    ['source, transcript and disposed ownership reject queued dispatch', async check => {
        for (const expire of ['expire', 'detach', 'dispose']) {
            const f = collaborationFixture(), pending = f.start(); f[expire]();
            check(await pending === false && f.calls.length === 0 && f.errors.length === 0, expire + ' blocks queued API call'); f.dispose();
        }
    }],
    ['missing API, capture failures and rejected dispatch are visible with explicit retry', async check => {
        const f = collaborationFixture(); f.behavior.missing = true; check(await f.start() === false && f.errors[0].includes('not available'), 'missing API visible');
        delete f.behavior.missing; f.behavior.capture = () => { throw Error('capture failed'); }; await f.start(); check(f.errors[1] === 'capture failed', 'capture failure visible');
        delete f.behavior.capture; f.behavior.open = () => { throw Error('dispatch failed'); }; await f.start();
        check(f.errors[2] === 'dispatch failed' && f.states.at(-1).busy === false, 'dispatch rejection visible and busy cleared');
        delete f.behavior.open; check(await f.start() && f.calls.length === 2, 'explicit retry after failure'); f.dispose();
    }],
    ['stale completion does not report or update a newer source', async check => {
        const f = collaborationFixture(), gate = collaborationGate(); f.behavior.open = () => gate.promise;
        const pending = f.start(); await collaborationFlush(); const count = f.states.length; f.expire(); gate.reject(Error('late failure'));
        check(await pending === false && f.errors.length === 0 && f.states.length === count, 'late failure has no stale effects');
        check(f.calls.length === 1, 'already dispatched legacy API is not cancelled or retried'); f.dispose();
    }],
    ['real view, wrapper, captured API and discussion guards', async check => {
        const f = collaborationFixture(true); f.rows.push({ html: 'card', text: 'Card', shared: true }); f.refreshRows();
        const pending = f.start(); window.openCollabFromChat = () => { throw Error('new API must not run'); };
        check(await pending && f.calls[0].html === '<p><b>Initial</b></p>', 'real view snapshot reaches captured API through wrapper');
        const queued = f.start(); f.discussion('Replaced discussion'); check(await queued === false && f.errors.length === 0, 'discussion change expires queued command');
        check(Object.keys(window.CList.state.chatCollaboration).join() === 'busy', 'bridge state has no transcript or discussion'); f.dispose();
    }]
];
