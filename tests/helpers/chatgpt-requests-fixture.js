function templateGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function templateFlush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
function templateResponse(content, reason = 'stop') { return { ok: true, json: async () => ({ choices: [{ message: { content }, finish_reason: reason }] }) }; }
function templateRequestFixture(bridge = false) {
    let source = 'session-one', account = { apiUrl: 'https://captured.invalid/chat', apiKey: 'private-fixture-key' };
    const calls = [], states = [], behavior = {}, accountReads = [];
    const fetchMock = async (url, options) => { calls.push({ url, options: structuredClone(options) }); return behavior.fetch ? behavior.fetch(calls.length) : templateResponse('Generated template'); };
    const accounts = async () => { accountReads.push('load'); if (behavior.accounts) await behavior.accounts(); };
    const getAccount = () => { if (behavior.missing) throw Error('No template account.'); return account; };
    let controller;
    if (bridge) {
        _chatGptTemplateRequests = null;
        Object.assign(globalThis, { readerSession: () => ({ source }), ensureAccountsLoaded: accounts,
            requireAccountWithPermission: permission => { if (permission !== 'g') throw Error('Wrong permission'); return getAccount(); }, fetch: fetchMock });
    } else controller = createChatGptTemplateRequests({ source: () => source, accounts, account: getAccount, fetch: fetchMock,
        state: value => states.push(structuredClone(value)) });
    return { calls, states, behavior, accountReads,
        generate: (type = 'lab report', format = 'text') => bridge ? generateNewTemplateFromChatGPT(type, format) : controller.generate(type, format),
        source: value => { source = value; }, account: value => { account = value; } };
}
async function templateRejects(action, check, expected) {
    let failure; try { await action(); } catch (error) { failure = error; }
    check(!!failure && (failure.code === expected || failure.message.includes(expected)), 'rejected with ' + expected);
}
const chatGptRequestCases = [
    ['captured request contract and literal raw result', async check => {
        const f = templateRequestFixture(); const result = await f.generate('case study', 'html'), call = f.calls[0], body = JSON.parse(call.options.body);
        check(result === 'Generated template' && f.accountReads.length === 1, 'account loading precedes generation');
        check(call.url === 'https://captured.invalid/chat' && call.options.method === 'POST' && call.options.headers.Authorization === 'Bearer private-fixture-key', 'captured URL/header');
        check(body.model === 'gpt-4' && body.max_tokens === 2000 && body.messages.length === 2 && body.messages[1].content.includes('in html, for a case study'), 'legacy model/limits/prompt retained');
        check(f.states.at(-1).pending === 0 && !JSON.stringify(f.states).includes('private-fixture-key'), 'safe count drains');
    }],
    ['length continuation reuses captured endpoint and exact assistant history', async check => {
        const f = templateRequestFixture(); f.behavior.fetch = count => templateResponse(count === 1 ? 'First ' : 'second', count === 1 ? 'length' : 'stop');
        check(await f.generate() === 'First second' && f.calls.length === 2, 'chunks concatenate exactly');
        const second = JSON.parse(f.calls[1].options.body);
        check(second.messages.length === 3 && second.messages[2].role === 'assistant' && second.messages[2].content === 'First ', 'legacy assistant continuation retained');
        check(f.calls.every(call => call.url === f.calls[0].url && call.options.headers.Authorization === f.calls[0].options.headers.Authorization), 'one target for all chunks');
    }],
    ['account loading/missing account failures stop before transport', async check => {
        const f = templateRequestFixture(); f.behavior.accounts = () => { throw Error('account load failed'); };
        await templateRejects(() => f.generate(), check, 'account load failed'); check(f.calls.length === 0 && f.states.at(-1).pending === 0, 'failed loading performs no request');
        delete f.behavior.accounts; f.behavior.missing = true; await templateRejects(() => f.generate(), check, 'No template account');
        check(f.calls.length === 0, 'missing credentials perform no request');
    }],
    ['session expiry during loading and account expiry during continuation', async check => {
        const f = templateRequestFixture(), gate = templateGate(); f.behavior.accounts = () => gate.promise;
        const pending = f.generate(); f.source('replacement'); gate.resolve(); await templateRejects(() => pending, check, 'ExpiredTemplateRequest');
        check(f.calls.length === 0, 'expired loading cannot select/request another account');
        const g = templateRequestFixture(); g.behavior.fetch = () => { g.account({ apiUrl: 'https://new.invalid', apiKey: 'new-key' }); return templateResponse('partial', 'length'); };
        await templateRejects(() => g.generate(), check, 'ExpiredTemplateRequest'); check(g.calls.length === 1 && g.calls[0].url === 'https://captured.invalid/chat', 'account change blocks continuation without redirecting');
    }],
    ['expiry while parsing prevents late result and further chunks', async check => {
        const f = templateRequestFixture(), gate = templateGate(); f.behavior.fetch = () => ({ ok: true, json: () => gate.promise });
        const pending = f.generate(); await templateFlush(); f.source('changed'); gate.resolve({ choices: [{ message: { content: 'late' }, finish_reason: 'length' }] });
        await templateRejects(() => pending, check, 'ExpiredTemplateRequest'); check(f.calls.length === 1 && f.states.at(-1).pending === 0, 'late JSON cannot continue or return stale content');
    }],
    ['HTTP, malformed and nonprogressing responses reject without retry', async check => {
        for (const [response, expected] of [
            [{ ok: false, status: 503 }, '503'], [{ ok: true, json: async () => ({}) }, 'invalid template'],
            [templateResponse({}, 'stop'), 'invalid template'], [templateResponse('content', 'content_filter'), 'Unexpected finish'],
            [templateResponse('', 'length'), 'no content']
        ]) { const f = templateRequestFixture(); f.behavior.fetch = () => response; await templateRejects(() => f.generate(), check, expected); check(f.calls.length === 1, 'no automatic retry after failure'); }
        const f = templateRequestFixture(); f.behavior.fetch = () => { throw Error('offline'); }; await templateRejects(() => f.generate(), check, 'offline');
        delete f.behavior.fetch; check(await f.generate() === 'Generated template', 'explicit later attempt recovers');
    }],
    ['independent calls and real wrapper/schema/fence compatibility', async check => {
        const f = templateRequestFixture(); await Promise.all([f.generate('resume'), f.generate('newsletter')]);
        check(f.calls.length === 2 && f.states.some(value => value.pending === 2) && f.states.at(-1).pending === 0, 'independent requests keep private histories/counts');
        const g = templateRequestFixture(true); check(await g.generate() === 'Generated template' && g.calls.length === 1, 'legacy generation wrapper uses real request boundary');
        check(window.CList.schemas.AI.fields.some(field => field.key === 'id' && field.inputType === 'password') && window.CList.loaders.some(loader => loader.label === 'Generate template'), 'existing schema/loader registration retained');
        check(extractCodeContent('```html\n<p>Template</p>\n```') === '<p>Template</p>' && extractCodeContent('Plain') === 'Plain', 'existing fence helper retained');
        check(Object.keys(window.CList.state.templateRequests).join() === 'pending', 'bridge state excludes prompt/account/content');
    }]
];
