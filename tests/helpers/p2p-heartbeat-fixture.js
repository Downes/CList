function heartbeatGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function heartbeatFlush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function heartbeatFixture(bridge = false) {
    let valid = true, timer = null, controller;
    const callbacks = [], cleared = [], calls = [], states = [], errors = [], expired = [], behavior = {};
    const owner = { id: 'captured-peer' };
    const target = { owner, peerId: owner.id, name: 'Captured discussion', service: 'https://service.invalid',
        url: 'https://captured.invalid/api/discussions', token: 'private-fixture-token', current: () => valid };
    const fetchMock = async (url, options) => { calls.push({ url, options: structuredClone(options) }); return behavior.fetch ? behavior.fetch() : { ok: true, status: 204 }; };
    const every = (callback, delay) => { callbacks.push({ callback, delay }); return callbacks.length; };
    const clear = id => cleared.push(id);
    if (bridge) {
        _p2pHeartbeat?.stop(); _p2pHeartbeat = null;
        peer = owner; activeDiscussionName = target.name;
        window.CList.defaults.DISCUSSIONS = target.service;
        Object.assign(globalThis, { fetch: fetchMock, setInterval: every, clearInterval: clear,
            captureP2pSessionGuard: () => () => valid, getSiteSpecificCookie: () => target.token,
            showErrorModal: message => expired.push(message), appendMessage: message => errors.push(message) });
    } else controller = createP2pHeartbeatController({
        current: value => value.current(), send: value => sendP2pHeartbeat(value, { fetch: fetchMock }),
        every, clear, timer: value => { timer = value; }, state: value => states.push(structuredClone(value))
    }, { error: error => errors.push(error.message), expired: () => expired.push('expired') });
    const f = { callbacks, cleared, calls, states, errors, expired, behavior, target,
        start: value => bridge ? startHeartbeat(value || { url: target.url, token: target.token }) : controller.start(value || target),
        stop: () => bridge ? stopHeartbeat() : controller.stop(),
        timer: () => bridge ? heartbeatInterval : timer,
        tick: index => callbacks[index ?? callbacks.length - 1].callback(),
        expire: () => { valid = false; } };
    return f;
}
const p2pHeartbeatCases = [
    ['captured transport, interval and secret-free state', async check => {
        const f = heartbeatFixture(); f.start(); f.target.name = 'New draft'; f.target.token = 'new-token';
        check(f.callbacks[0].delay === 60000 && f.calls.length === 0, 'one-minute timer does not send immediately');
        await f.tick(); const call = f.calls[0];
        check(call.url === 'https://captured.invalid/api/discussions' && call.options.headers.Authorization === 'Bearer private-fixture-token', 'captured endpoint and token');
        check(call.options.method === 'POST' && JSON.parse(call.options.body).name === 'Captured discussion' && JSON.parse(call.options.body).peerId === 'captured-peer', 'captured payload');
        check(f.states.at(-1).phase === 'waiting' && !f.states.at(-1).busy, 'accepted response needs no JSON');
        check(!JSON.stringify(f.states).includes('private-fixture-token') && Object.keys(f.states.at(-1)).length === 2, 'public state contains no target or credentials'); f.stop();
    }],
    ['overlap prevention and periodic continuation', async check => {
        const f = heartbeatFixture(), gate = heartbeatGate(); f.behavior.fetch = () => gate.promise; f.start();
        const first = f.tick(); await f.tick(); check(f.calls.length === 1 && f.states.at(-1).busy, 'pending heartbeat skips overlapping tick');
        gate.resolve({ ok: true, status: 200 }); await first; delete f.behavior.fetch; await f.tick();
        check(f.calls.length === 2 && !f.states.at(-1).busy, 'next scheduled tick can send after completion'); f.stop();
    }],
    ['replacement and stopped callbacks cannot affect a newer timer', async check => {
        const f = heartbeatFixture(), gate = heartbeatGate(); f.behavior.fetch = () => gate.promise; f.start(); const pending = f.tick();
        f.start(); check(f.cleared.includes(1) && f.timer() === 2, 'replacement clears original timer');
        gate.resolve({ ok: false, status: 401 }); await pending; await f.tick(0);
        check(f.timer() === 2 && f.expired.length === 0 && f.calls.length === 1, 'old response and callback cannot stop or report against replacement');
        f.stop(); f.stop(); await f.tick(1); check(f.timer() === null && f.calls.length === 1, 'stop is repeatable and expires saved callback');
    }],
    ['expiry before send and during failures suppresses stale effects', async check => {
        const f = heartbeatFixture(); f.start(); f.expire(); await f.tick();
        check(f.calls.length === 0 && f.timer() === null, 'expired source stops before network');
        const g = heartbeatFixture(), gate = heartbeatGate(); g.behavior.fetch = () => gate.promise; g.start(); const pending = g.tick();
        g.expire(); gate.reject(Error('late private failure')); await pending;
        check(g.errors.length === 0 && g.timer() === null, 'stale failure stops owned timer without feedback');
    }],
    ['401 stops with one expiry notice; HTTP and network failures stay visible', async check => {
        const f = heartbeatFixture(); f.behavior.fetch = () => ({ ok: false, status: 401 }); f.start(); await f.tick(); await f.tick();
        check(f.expired.length === 1 && f.calls.length === 1 && f.states.at(-1).phase === 'expired', '401 expires once without another send');
        const g = heartbeatFixture(); g.behavior.fetch = () => ({ ok: false, status: 503 }); g.start(); await g.tick();
        check(g.errors[0].includes('503') && g.calls.length === 1, 'HTTP error visible without immediate retry');
        g.behavior.fetch = () => { throw Error('network down'); }; await g.tick();
        check(g.errors[1] === 'network down' && g.timer() === 1, 'network error visible and scheduled timer retained');
        delete g.behavior.fetch; await g.tick(); check(g.calls.length === 3 && !g.states.at(-1).busy, 'later periodic tick recovers'); g.stop();
    }],
    ['real wrappers capture target and reject changed discussion/service/peer', async check => {
        const f = heartbeatFixture(true); f.start(); await f.tick();
        check(f.calls[0].url === f.target.url && heartbeatInterval === 1, 'legacy wrappers use real workflow/controller');
        activeDiscussionName = 'different'; await f.tick(); check(f.calls.length === 1 && heartbeatInterval === null, 'discussion replacement stops old timer');
        activeDiscussionName = f.target.name; f.start(); window.CList.defaults.DISCUSSIONS = 'https://other.invalid'; await f.tick();
        check(f.calls.length === 1 && heartbeatInterval === null, 'service change stops old timer');
        window.CList.defaults.DISCUSSIONS = f.target.service; f.start(); peer.id = 'changed-peer'; await f.tick();
        check(f.calls.length === 1 && heartbeatInterval === null, 'peer identity change stops old timer');
        peer.id = f.target.peerId; f.start(); f.expire(); await f.tick();
        check(f.calls.length === 1 && heartbeatInterval === null, 'source expiry stops old timer'); f.stop();
    }],
    ['real feedback and no-discussion compatibility', async check => {
        const f = heartbeatFixture(true); activeDiscussionName = null; f.start(); check(f.callbacks.length === 0, 'no discussion creates no timer');
        activeDiscussionName = f.target.name; f.behavior.fetch = () => ({ ok: false, status: 401 }); f.start(); await f.tick();
        check(f.expired.length === 1 && f.timer() === null, 'real view shows session expiry');
        f.behavior.fetch = () => { throw Error('offline'); }; f.start(); await f.tick();
        check(f.errors.length === 1 && f.errors[0].includes('may expire'), 'real view reports visible failure');
        check(!JSON.stringify(window.CList.state.chatHeartbeat).includes('private-fixture-token'), 'bridge state excludes credential'); f.stop();
    }]
];
