function summaryGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function summaryFlush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function summaryFixture(bridge = false) {
    let current = true, alive = true, text = '<p>Captured text</p>', account = { apiUrl: 'https://ai.invalid/chat', apiKey: 'private-fixture-key' };
    const states = [], results = [], calls = [], errors = [], loads = [], behavior = {}; let pendingCount = 0;
    const fetchMock = async (url, options) => { calls.push({ url, options: structuredClone(options) }); return behavior.fetch ? behavior.fetch() : { ok: true, json: async () => ({ choices: [{ message: { content: 'Literal <b>summary</b>' } }] }) }; };
    const view = { alive: () => alive, capture: () => text, pending: () => pendingCount++,
        show: (result, load) => results.push({ result, load }), error: error => errors.push(error.message) };
    const getAccount = () => { if (behavior.missing) throw Error('No AI account found.'); return account; };
    let controller; const realView = createSummaryView;
    if (bridge) {
        _summaryPanel?.controller.dispose(); _summaryPanel = null;
        Object.assign(globalThis, { createSummaryView: () => view, requireAccountWithPermission: (permission, message) => { if (permission !== 'z') throw Error('Wrong permission'); return getAccount(); },
            readerSession: () => ({ token: current ? 'first' : 'replacement' }), readerState: () => ({ requestId: 3 }),
            loadContentToEditor: id => loads.push(id), fetch: fetchMock });
    } else controller = createSummaryController({ current: () => current, account: getAccount,
        request: (content, kind, target) => requestSummary(content, kind, target, { fetch: fetchMock }),
        load: id => loads.push(id), state: value => states.push(structuredClone(value)) }, view);
    return { states, results, calls, errors, loads, behavior,
        start: type => bridge ? handleSummarize('feed-container', 'feed-summary', type) : controller.start(type),
        text: value => { text = value; }, account: value => { account = value; }, expire: () => { current = false; }, detach: () => { alive = false; },
        dispose() { if (bridge) { _summaryPanel?.controller.dispose(); globalThis.createSummaryView = realView; } else controller.dispose(); },
        pendingCount: () => pendingCount };
}
const summarizeCases = [
    ['captured account, legacy prompts and request controls', async check => {
        const f = summaryFixture(); await f.start('thread'); const call = f.calls[0], body = JSON.parse(call.options.body);
        check(call.url === 'https://ai.invalid/chat' && call.options.headers.Authorization === 'Bearer private-fixture-key', 'explicit endpoint/key');
        check(body.model === 'gpt-4' && body.temperature === 0.3 && body.max_tokens === 100 && body.messages[1].content.includes('discussion thread'), 'legacy model/prompt/limits');
        check(prepareSummaryRequest('x'.repeat(4000), 'text').max_tokens === 200 && prepareSummaryRequest('Text', 'text').messages[1].content.endsWith('"Text"'), 'ordinary prompt and token calculation');
        check(f.results[0].result === 'Literal <b>summary</b>' && f.states.at(-1).phase === 'ready' && !JSON.stringify(f.states).includes('private-fixture-key'), 'literal result and secret-free ready state'); f.dispose();
    }],
    ['HTTP, malformed response and empty fallback contracts', async check => {
        const f = summaryFixture(); f.behavior.fetch = () => ({ ok: false, status: 503, statusText: 'Unavailable' }); await f.start();
        check(f.errors[0].includes('503') && f.results.length === 0, 'HTTP failure visible');
        f.behavior.fetch = () => ({ ok: true, json: async () => ({ choices: [{ message: { content: {} } }] }) }); await f.start();
        check(f.errors[1].includes('invalid summary'), 'malformed content rejected');
        f.behavior.fetch = () => ({ ok: true, json: async () => ({ choices: [] }) }); await f.start();
        check(f.results[0].result === 'No summary available.', 'empty result retains fallback'); f.dispose();
    }],
    ['duplicate and superseded input requests keep only latest result', async check => {
        const f = summaryFixture(), gate = summaryGate(); f.behavior.fetch = () => gate.promise;
        const first = f.start('thread'), duplicate = f.start('thread'); check(first === duplicate, 'pending duplicate coalesced'); await summaryFlush();
        check(f.calls.length === 1, 'one request for duplicates'); f.text('New content'); delete f.behavior.fetch; await f.start('thread');
        gate.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'old' } }] }) }); await first;
        check(f.results.length === 1 && f.results[0].result !== 'old' && f.calls.length === 2, 'old completion cannot replace newer summary'); f.dispose();
    }],
    ['source, view and disposal reject queued or late work', async check => {
        for (const expire of ['expire', 'detach', 'dispose']) {
            const f = summaryFixture(), queued = f.start(); f[expire](); check(await queued === false && f.calls.length === 0, expire + ' blocks queued request'); f.dispose();
        }
        const f = summaryFixture(), gate = summaryGate(); f.behavior.fetch = () => gate.promise; const pending = f.start(); await summaryFlush(); f.expire();
        gate.reject(Error('old error')); check(await pending === false && f.errors.length === 0, 'stale errors suppressed'); f.dispose();
    }],
    ['changed AI account and stale Load controls cannot affect current content', async check => {
        const f = summaryFixture(), gate = summaryGate(); f.behavior.fetch = () => gate.promise; const pending = f.start(); await summaryFlush();
        f.account({ apiUrl: 'https://new.invalid/chat', apiKey: 'new-key' }); gate.resolve({ ok: true, json: async () => ({ choices: [] }) });
        check(await pending === false && f.results.length === 0 && f.calls[0].url === 'https://ai.invalid/chat', 'changed credentials suppress old result without redirecting request');
        delete f.behavior.fetch; await f.start(); f.results[0].load('original-content'); check(f.loads[0] === 'original-content', 'current Load dispatches');
        f.text('Newer text'); f.results[0].load('stale-content'); check(f.loads.length === 1, 'edited input expires old Load'); f.dispose();
    }],
    ['visible failures and explicit retry without automatic repeats', async check => {
        const f = summaryFixture(); f.behavior.missing = true; await f.start(); check(f.errors.length === 1 && f.calls.length === 0, 'missing account visible before request');
        delete f.behavior.missing; f.behavior.fetch = () => { throw Error('network down'); }; await f.start();
        check(f.errors[1] === 'network down' && f.calls.length === 1 && f.states.at(-1).phase === 'error', 'network failure visible without retry');
        delete f.behavior.fetch; check(await f.start() && f.calls.length === 2, 'explicit retry recovers'); f.dispose();
    }],
    ['legacy wrapper uses real workflow and preserves reader ownership', async check => {
        const f = summaryFixture(true); await f.start('thread');
        check(f.results.length === 1 && f.calls.length === 1 && f.pendingCount() === 1, 'real handleSummarize bridge delegates');
        f.results[0].load('feed-summary-content'); check(f.loads[0] === 'feed-summary-content', 'bound Load uses shared editor action');
        f.expire(); f.results[0].load('old'); check(f.loads.length === 1, 'reader/session change expires saved Load');
        check(Object.keys(window.CList.state.summarizing).sort().join() === 'busy,phase', 'bridge presentation excludes content and credentials');
        const result = await summarizeText('Standalone', 'text'); check(result === 'Literal <b>summary</b>' && f.calls.length === 2, 'standalone summarizeText contract retained'); f.dispose();
    }]
];
