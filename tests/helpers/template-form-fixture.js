function templateFormGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function templateFormFlush() { for (let i = 0; i < 16; i++) await Promise.resolve(); }
function templateFormFixture(bridge = false) {
    let source = 'original', controller, watcher = () => {}, returned = 0;
    const outer = document.createElement('div'), options = document.createElement('div'), indicator = document.createElement('div');
    indicator.style.display = 'flex'; outer.append(options, indicator); document.body.appendChild(outer);
    const ui = { loadOptions: options, loadingIndicator: indicator }, calls = [], states = [], behavior = {};
    const account = { apiUrl: 'https://ai.invalid/template', apiKey: 'private-fixture-key' };
    const fetchMock = async (url, init) => { calls.push({ url, init: structuredClone(init) }); return behavior.fetch ? behavior.fetch() : { ok: true, json: async () => ({ choices: [{ message: { content: '```html\n<p>Generated</p>\n```' }, finish_reason: 'stop' }] }) }; };
    window.CList.ui = { view: ui };
    if (bridge) {
        _templateForm?.cancel(); _templateForm = null; _chatGptTemplateRequests = null;
        Object.assign(globalThis, { currentEditor: 'text', currentEditorAccount: 'original-account', readerSession: () => ({ source }),
            ensureAccountsLoaded: async () => {}, requireAccountWithPermission: () => account, fetch: fetchMock,
            populateLoadOptions: () => { returned++; }, showStatusMessage: () => {} });
        const result = generateTemplateContent(); controller = _templateForm; controller.fixtureResult = result;
    } else {
        const view = createTemplateFormView(document, ui), originalWatch = view.watch;
        view.watch = expire => { watcher = expire; return originalWatch(expire); };
        const requests = createChatGptTemplateRequests({ source: () => source, accounts: async () => {}, account: () => account,
            fetch: fetchMock, state: () => {} });
        controller = createTemplateFormController({ current: () => source === 'original',
            generate: (type, format, current) => requests.generate(type, format, current), extract: extractCodeContent,
            state: value => states.push(structuredClone(value)), back: () => { returned++; } }, view);
    }
    const node = id => options.querySelector('#' + id);
    return { controller, result: controller.fixtureResult || controller.result, options, indicator, calls, states, behavior, node,
        edit(id, value) { const input = node(id); input.value = value; input.oninput(); },
        expire: () => { source = 'changed'; }, watch: () => watcher(), returned: () => returned,
        dispose() { controller.cancel(); outer.remove(); } };
}
const templateFormCases = [
    ['captured choices, custom override and generated content contract', async check => {
        const f = templateFormFixture(); f.edit('customTemplateType', '  Personal plan  '); f.edit('outputFormat','html');
        const pending = f.controller.submit(); check(f.node('generateTemplateButton').disabled && f.options.textContent.includes('Generating template'), 'form owns busy/progress feedback');
        await pending; const result = await f.result, prompt = JSON.parse(f.calls[0].init.body).messages[1].content;
        check(prompt.includes('in html, for a Personal plan') && result.type === 'text/html' && result.value === '<p>Generated</p>', 'captured trimmed choices and fence extraction');
        check(f.indicator.style.display === 'flex', 'unrelated shared loader untouched');
        check(f.states.at(-1).phase === 'complete' && !JSON.stringify(f.states).includes('private-fixture-key'), 'safe completion state'); f.dispose();
    }],
    ['duplicate submit and changed-input supersession', async check => {
        const f = templateFormFixture(), gate = templateFormGate(); f.behavior.fetch = () => gate.promise;
        const first = f.controller.submit(), duplicate = f.controller.submit(); check(first === duplicate, 'pending duplicate coalesced'); await templateFormFlush();
        check(f.calls.length === 1, 'one request for duplicate'); f.edit('customTemplateType','New draft');
        check(!f.node('generateTemplateButton').disabled, 'editing invalidates attempt and re-enables explicit Generate');
        delete f.behavior.fetch; await f.controller.submit(); gate.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'old' }, finish_reason: 'length' }] }) }); await first;
        check((await f.result).value === '<p>Generated</p>' && f.calls.length === 2, 'old continuation cannot override or request another chunk'); f.dispose();
    }],
    ['Back settles null and expires pending continuation', async check => {
        const f = templateFormFixture(), gate = templateFormGate(); f.behavior.fetch = () => gate.promise; const pending = f.controller.submit(); await templateFormFlush();
        const savedSubmit = f.controller.submit; f.node('generateTemplateBackBtn').onclick({ preventDefault() {} });
        check(await f.result === null && f.returned() === 1, 'Back settles loader with no content and navigates once');
        gate.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'partial' }, finish_reason: 'length' }] }) }); await pending; await savedSubmit();
        check(f.calls.length === 1 && f.indicator.style.display === 'flex', 'cancel blocks later chunks/saved callbacks without touching shared loader'); f.dispose();
    }],
    ['visible failure and explicit retry preserve draft choices', async check => {
        const f = templateFormFixture(); f.edit('customTemplateType','Retry draft'); f.behavior.fetch = () => ({ ok: false, status: 503 });
        await f.controller.submit(); check(f.node('generateTemplateButton').disabled === false && f.options.querySelector('.template-error').textContent.includes('503'), 'failure visible with Generate enabled');
        check(f.node('customTemplateType').value === 'Retry draft' && f.calls.length === 1, 'failed request preserves draft and does not retry');
        delete f.behavior.fetch; await f.controller.submit(); check((await f.result).type === 'text/plain' && f.calls.length === 2, 'explicit retry returns plain-text representation'); f.dispose();
    }],
    ['expired session and replaced panel settle without stale feedback', async check => {
        const f = templateFormFixture(), gate = templateFormGate(); f.behavior.fetch = () => gate.promise; const pending = f.controller.submit(); await templateFormFlush(); f.expire();
        gate.resolve({ ok: false, status: 503 }); await pending;
        check(await f.result === null && !f.options.querySelector('.template-error'), 'expired request settles without stale error'); f.dispose();
        const g = templateFormFixture(); g.node('generate-template-form').remove(); const newer = document.createElement('p'); newer.textContent = 'New panel'; g.options.appendChild(newer); g.watch();
        check(await g.result === null && g.options.textContent.includes('New panel'), 'detached/replaced panel cleanup preserves new content'); g.dispose();
    }],
    ['saved controls reject detached or closed forms', async check => {
        const f = templateFormFixture(), submit = f.node('generateTemplateButton').onclick;
        f.controller.cancel(); submit({ preventDefault() {} }); await templateFormFlush();
        check(await f.result === null && f.calls.length === 0, 'saved Generate cannot revive closed form'); f.controller.cancel(true);
        check(f.returned() === 0, 'repeated stale Back does not navigate'); f.dispose();
    }],
    ['real loader wrapper and editor ownership guard', async check => {
        const f = templateFormFixture(true); f.edit('templateType','resume'); f.node('generateTemplateButton').onclick({ preventDefault() {} });
        const result = await f.result; check(result.value === '<p>Generated</p>' && f.calls.length === 1, 'real loader/controller/view/request path returns generated record');
        check(Object.keys(window.CList.state.templateForm).sort().join() === 'busy,phase', 'bridge state excludes choices/content'); f.dispose();
        const g = templateFormFixture(true), gate = templateFormGate(); g.behavior.fetch = () => gate.promise; const pending = g.controller.submit(); await templateFormFlush();
        currentEditor = 'another-editor'; gate.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'late' }, finish_reason: 'stop' }] }) }); await pending;
        check(await g.result === null && g.indicator.style.display === 'flex', 'editor switch prevents late transfer/shared loader mutation'); g.dispose();
    }]
];
