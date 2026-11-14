const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
function fixture(ui = false) {
    const CList = { config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token' },
        state: {}, publishers: {}, ui: {}, readers: {} };
    const events = [], calls = [], errors = [], messages = [];
    let token = 'secret';
    const ctx = vm.createContext({ window: { CList }, structuredClone, URL,
        console: { error() {}, log() {} }, getSiteSpecificCookie: () => token,
        fetch: async (url, options) => { calls.push({ url, ...options }); return { ok: true, json: async () => ({ id: 'opaque' }) }; },
        showErrorModal: message => errors.push(message), showStatusMessage: message => messages.push(message) });
    const load = name => vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx, { filename: name });
    for (const name of ['annotation-workflow', 'annotation-publishing', 'annotate_publish', 'hypothesis_publish']) load(name);
    if (ui) {
        const container = new Element('div');
        ctx.document = { createElement: tag => { const el = new Element(tag);
            el.append = (...items) => items.forEach(item => typeof item === 'string' ? el.textContent += item : el.appendChild(item));
            return el; }, body: { contains: () => true } };
        CList.ui.view = { postResult: container };
        load('annotation-view');
    } else CList.ui.annotations = { show: outcome => events.push(outcome) };
    const account = { type: 'Annotate', instance: 'https://anno.test', title: 'Store', permissions: 'w' };
    const request = ctx.captureAnnotationRequest({ body: '<p>Note</p>', references: [{ url: 'https://source.test' }], tags: ['tag'] });
    return { ctx, CList, calls, errors, messages, events, account, request, load, setToken: value => token = value,
        session: ctx.captureAnnotationSession() };
}

test('annotation workflow runs without DOM/global state and snapshots unique valid targets and selectors', async () => {
    const ctx = vm.createContext({ structuredClone });
    vm.runInContext(fs.readFileSync('js/annotation-workflow.js', 'utf8'), ctx);
    const refs = [{ url: 'https://a', title: 'A' }, { url: 'https://a' }, { url: '' }, { url: '(no URL provided)' }, { url: 'https://b' }];
    const request = ctx.captureAnnotationRequest({ body: '<p>HTML</p>', references: refs, tags: ['one'], selectors: true });
    refs[0].url = 'https://changed';
    const calls = [];
    const result = await ctx.runAnnotationWorkflow(request, { create: async payload => {
        calls.push(structuredClone(payload)); payload.tags.push('mutation'); return { id: 'opaque' };
    } });
    assert.equal('window' in ctx, false); assert.equal('document' in ctx, false);
    assert.equal(result.created, 2); assert.equal(result.url, null);
    assert.equal(calls[0].target_selector.title, 'A'); assert.equal(calls[0].body, '<p>HTML</p>');
    assert.deepEqual(Array.from(calls[1].tags), ['one']);
    assert.throws(() => ctx.captureAnnotationRequest({ body: '', references: refs }), /text is required/);
    assert.throws(() => ctx.captureAnnotationRequest({ body: 'note', references: [] }), /No target/);
});

test('per-target receipts distinguish creation, rejection, and uncertain writes without inventing links', async () => {
    const f = fixture();
    const request = f.ctx.captureAnnotationRequest({ body: 'note', references: ['a', 'b', 'c'].map(url => ({ url })) });
    const receipts = [];
    const result = await f.ctx.runAnnotationWorkflow(request, { create: async p => {
        if (p.target_url === 'a') return { id: 'opaque' };
        throw Object.assign(Error(p.target_url), p.target_url === 'c' ? { outcome: 'uncertain' } : {});
    }, onTargetResult: r => receipts.push(r) });
    assert.equal(result.created, 1); assert.equal(result.failed, 1); assert.equal(result.uncertain, 1);
    assert.equal(result.results[0].annotationUrl, null);
    assert.deepEqual(receipts.map(r => r.outcome), ['created', 'failed', 'uncertain']);
});

test('Annotate adapter uses the explicit token/payload, rejects HTTP failures, and marks network uncertainty', async () => {
    const f = fixture();
    await f.ctx.createStoreAnnotation(f.account, { body: 'note' }, f.session);
    assert.equal(f.calls[0].headers.Authorization, 'Bearer secret');
    assert.equal(f.calls[0].url, 'https://anno.test/annotations');
    f.ctx.fetch = async () => ({ ok: false, status: 403, json: async () => ({ detail: 'Not registered' }) });
    await assert.rejects(f.ctx.createStoreAnnotation(f.account, {}, f.session), /re-add the account/);
    f.ctx.fetch = async () => { throw Error('offline'); };
    await assert.rejects(f.ctx.createStoreAnnotation(f.account, {}, f.session), e => e.outcome === 'uncertain');
    assert.equal(f.errors.length, 0);
});

test('accepted writes without JSON remain confirmed creations without a browser link', async () => {
    const f = fixture();
    f.ctx.fetch = async () => ({ ok: true, json: async () => { throw Error('no JSON'); } });
    const outcome = await f.ctx.runAnnotationOperation(f.account, f.request, f.session);
    assert.equal(outcome.created, 1); assert.equal(outcome.url, null);
});

test('Post uses supplied references/tags; Hypothesis Post preserves empty tags', async () => {
    const f = fixture(), refs = [{ url: 'https://captured.test', title: 'Captured' }];
    f.ctx.getReferences = () => { throw Error('live references read'); };
    const receipts = [];
    const url = await f.CList.publishers.Annotate.publish(f.account, '', 'body', refs,
        { annotationSession: f.session, tags: ['captured'], onTargetResult: r => receipts.push(r) });
    const payload = JSON.parse(f.calls[0].body);
    assert.equal(payload.target_url, refs[0].url); assert.deepEqual(payload.tags, ['captured']);
    assert.equal(payload.target_selector.title, 'Captured'); assert.equal(url, null);
    let sent;
    f.ctx.window.hypothesisCreate = async (account, payload) => { sent = payload; return { id: 'https://hypothes.is/a/1' }; };
    const link = await f.CList.publishers.Hypothesis.publish({ type: 'Hypothesis' }, '', 'body', refs, { tags: ['ignored'] });
    assert.equal(link, 'https://hypothes.is/a/1'); assert.deepEqual(Array.from(sent.tags), []);
    assert.equal(receipts[0].outcome, 'created');
});

test('cross-entry-point locks prevent overlapping sends, then release after completion without retaining credentials', async () => {
    const f = fixture(); let resolve;
    f.ctx.fetch = () => new Promise(r => resolve = r);
    const first = f.ctx.runAnnotationOperation(f.account, f.request, f.session);
    await assert.rejects(f.ctx.runAnnotationOperation(f.account, f.request, f.session), /already being sent/);
    resolve({ ok: true, json: async () => ({ id: 'opaque' }) });
    await first;
    assert.equal(f.CList.state.annotationPublishing.active.length, 0);
    assert.equal(JSON.stringify(f.CList.state).includes('secret'), false);
    assert.equal(JSON.stringify(f.CList.state).includes('<p>Note'), false);
});

test('session switches block new writes and subsequent targets without redirecting the captured account', async () => {
    const f = fixture();
    f.setToken('new');
    const result = await f.ctx.runAnnotationOperation(f.account, f.request, f.session);
    assert.equal(result.failed, 1); assert.equal(f.calls.length, 0);
    f.setToken('secret');
    const request = f.ctx.captureAnnotationRequest({ body: 'note', references: [{ url: 'a' }, { url: 'b' }] });
    f.ctx.fetch = async () => { f.setToken('changed'); return { ok: true, json: async () => ({}) }; };
    const next = await f.ctx.runAnnotationOperation(f.account, request, f.session);
    assert.equal(next.created, 1); assert.equal(next.failed, 1);
});

test('Flow preserves attribution/motivation and falls back only after explicit rejection', async () => {
    const f = fixture(); const calls = [];
    f.ctx.fetch = async (url, opts) => { calls.push({ url, payload: JSON.parse(opts.body) });
        return { ok: calls.length > 1, status: 403, json: async () => ({ id: 'opaque', detail: 'rejected' }) }; };
    const accounts = [f.account, { ...f.account, instance: 'https://second.test' }];
    const result = await f.ctx.flowAnnotation({ id: 'original', creator: { id: 'author' }, body: { value: 'note' }, tag: ['flow'] }, 'target', accounts, 'secret');
    assert.equal(result.created, 1); assert.equal(calls.length, 2);
    assert.equal(calls[1].payload.motivation, 'flowing');
    assert.deepEqual(calls[1].payload.target_selector, { via: 'author', via_annotation_id: 'original' });
    calls.length = 0; f.ctx.fetch = async () => { calls.push({}); throw Error('offline'); };
    const uncertain = await f.ctx.flowAnnotation({ body: 'note' }, 'target', accounts, 'secret');
    assert.equal(uncertain.uncertain, 1); assert.equal(calls.length, 1);
});

test('inline and Send compatibility controller presents all-failure once and respects captured token', async () => {
    const f = fixture(true);
    f.ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({ detail: 'denied' }) });
    assert.equal(await f.ctx._submitAnnotation(null, 'id', 'target', 'body', ['tag'], 'private', f.account, 'secret'), false);
    assert.equal(f.errors.length, 1);
    f.setToken('changed');
    assert.equal(await f.ctx._submitAnnotation(null, 'id', 'target', 'body', [], 'public', f.account, 'secret'), false);
    assert.equal(f.errors.length, 2);
});

test('ordinary publishing stores per-target receipts and confirms accepted writes even without URLs', async () => {
    const f = fixture(); f.load('publishing-workflow');
    f.CList.publishers.Annotate.construct = undefined;
    const result = await f.ctx.runPublishingWorkflow({ title: '', content: 'body', references: [{ url: 'target' }], selectedAccountKeys: ['a'], tags: [] }, {
        accounts: [{ key: 'a', value: JSON.stringify(f.account) }], publishers: f.CList.publishers,
        parseAccount: r => JSON.parse(r.value), toText: s => s, annotationSession: f.session,
    });
    assert.equal(result.destinations[0].status, 'published');
    assert.equal(result.destinations[0].targetResults[0].outcome, 'created');
    assert.equal(result.primaryUrl, null);
});

test('result view labels failures accurately, links only created receipt URLs, and summarizes partial success', () => {
    const f = fixture(true), view = f.CList.ui.annotations;
    view.target({ targetUrl: 'https://failed', outcome: 'failed', error: 'denied' });
    view.target({ targetUrl: 'https://created', outcome: 'created', annotationUrl: 'https://anno/1' });
    const rows = f.CList.ui.view.postResult.children;
    assert.match(rows[0].textContent, /^failed:/); assert.match(rows[1].textContent, /^Annotated:/);
    assert.equal(rows[0].querySelectorAll('a').length, 0); assert.equal(rows[1].querySelector('a').href, 'https://anno/1');
    view.show({ created: 1, failed: 1, uncertain: 0, results: [] });
    assert.equal(f.errors.length, 0); assert.match(f.messages[0], /1 created, 1 failed/);
});


test('Hypothesis transport retains private permissions and selected account credentials without DOM', async () => {
    const f = fixture(); f.load('hypothesis');
    f.ctx.fetch = async (url, opts) => { f.calls.push({ url, ...opts });
        return { ok: true, json: async () => ({ id: 'abc', user: 'acct:stephen@hypothes.is' }) }; };
    const account = { type: 'Hypothesis', instance: 'https://hypothes.is', username: 'stephen', apiKey: 'hyp-secret' };
    const result = await f.ctx.window.hypothesisCreate(account, { target_url: 'source', body: '<b>note</b>', tags: ['tag'], visibility: 'private' });
    const body = JSON.parse(f.calls[0].body);
    assert.equal(f.calls[0].headers.Authorization, 'Bearer hyp-secret');
    assert.deepEqual(body.permissions.read, ['acct:stephen@hypothes.is']);
    assert.equal(body.text, '<b>note</b>'); assert.equal(result.id, 'https://hypothes.is/a/abc');
    assert.equal('document' in f.ctx, false);
    f.ctx.fetch = async () => { throw Error('offline'); };
    await assert.rejects(f.ctx.window.hypothesisCreate(account, {}), e => e.outcome === 'uncertain');
});

function editorFixture() {
    const f = fixture(true), refs = [{ url: 'https://primary', id: 'primary' }], switched = [];
    let html = '<p>Original HTML</p>';
    const textarea = new Element('textarea'); textarea.value = 'stale textarea';
    f.ctx.document.getElementById = id => id === 'annotate-edit-body' ? textarea : null;
    f.ctx.tinymce = { get: () => ({ getContent: () => html, setContent: value => html = value }) };
    f.ctx.editorHandlers = {}; f.ctx.currentEditor = 'annotate-edit';
    f.ctx.getReferences = () => refs;
    f.ctx.ensureAccountsLoaded = async () => [{ value: JSON.stringify(f.account) }];
    f.ctx.parseAccountValue = record => JSON.parse(record.value);
    f.ctx.buildAccountSelect = () => { const el = new Element('select'); el.value = '0'; return el; };
    f.ctx.buildVisibilitySelect = () => { const el = new Element('select'); el.value = 'private'; return el; };
    f.ctx.window.getWriteTags = () => ['editor-tag'];
    f.ctx.switchToEditor = async name => { switched.push(name); f.ctx.currentEditor = name; };
    f.ctx.cleanHTMLContent = s => s; f.ctx.escapeHtml = s => s;
    f.ctx.pushAndDisplayReference = ref => { if (!refs.includes(ref)) refs.push(ref); };
    f.load('annotate-editor');
    // The field renderer is outside these tests; retain its reference/editing logic.
    vm.runInContext('_refreshAnnotateRefFields = () => {}; _annotateReturnEditor = "tinymce";', f.ctx);
    const section = new Element('div');
    return { ...f, refs, switched, section, setHTML: value => html = value, getHTML: () => html,
        async sendButton() { await f.ctx._renderSendControls(section); return section.querySelector('button'); } };
}

test('Send reads TinyMCE HTML via the editor API, sends only primary target and selected tags/visibility, then returns', async () => {
    const f = editorFixture(); f.refs.push({ url: 'https://additional' });
    const button = await f.sendButton(); await button.listeners.click();
    const body = JSON.parse(f.calls[0].body);
    assert.equal(body.body, '<p>Original HTML</p>'); assert.equal(body.target_url, 'https://primary');
    assert.deepEqual(body.tags, ['editor-tag']); assert.equal(body.visibility, 'private');
    assert.equal(f.calls.length, 1); assert.deepEqual(f.switched, ['tinymce']); assert.equal(button.disabled, false);
});

test('Send preserves newer draft body and editor while a write is pending', async () => {
    const f = editorFixture(); let resolve;
    f.ctx.fetch = () => new Promise(r => resolve = r);
    const button = await f.sendButton(); const pending = button.listeners.click();
    await new Promise(r => setImmediate(r));
    f.setHTML('<p>Newer draft</p>');
    resolve({ ok: true, json: async () => ({ id: 'created' }) }); await pending;
    assert.deepEqual(f.switched, []); assert.equal(f.getHTML(), '<p>Newer draft</p>');
    assert.equal(button.disabled, false);
});

test('Send captures target/account/session before awaiting an asynchronous editor getter', async () => {
    const f = editorFixture(); let resolve;
    f.ctx.editorHandlers['annotate-edit'].getContent = () => new Promise(r => resolve = r);
    const button = await f.sendButton(); const pending = button.listeners.click();
    f.refs[0].url = 'https://new-target'; f.setToken('new-session');
    resolve('captured body'); await pending;
    assert.equal(f.calls.length, 0); assert.deepEqual(f.switched, []); assert.equal(f.errors.length, 1);
    assert.equal(button.disabled, false);
});

test('incoming HTML keeps append-only description behaviour and additional references preserve the primary target', () => {
    const f = editorFixture();
    f.ctx.editorHandlers['annotate-edit'].insertLink({ content: { type: 'text/html', value: '<strong>Incoming</strong>' },
        entryUrl: 'https://additional', feedTitle: 'Feed', reference: { url: 'https://additional', title: 'Additional' } });
    assert.match(f.getHTML(), /^<p>Original HTML<\/p><p><strong>Incoming<\/strong>/);
    assert.equal(f.refs[0].url, 'https://primary'); assert.equal(f.refs[1].url, 'https://additional');
});

test('collection eligibility uses the successful target rather than the first reference and performs no write', async () => {
    const f = fixture(true), offered = [];
    f.CList.ui.annotations.offerCollect = id => offered.push(id);
    f.ctx.getEncKey = async () => 'key';
    f.ctx.fetchDecryptedKvRecordsByPrefix = async () => [];
    await f.ctx.offerCollectionForAnnotation({ url: 'https://success', id: 'success' }, f.session);
    assert.deepEqual(offered, ['success']); assert.equal(f.calls.length, 0);
    f.ctx.fetchDecryptedKvRecordsByPrefix = async () => [{ value: 'collection' }];
    f.ctx._parseCollectionData = () => ({ items: [{ url: 'https://already-collected' }] });
    await f.ctx.offerCollectionForAnnotation({ url: 'https://already-collected', id: 'already' }, f.session);
    assert.deepEqual(offered, ['success']);
});


test('ordinary annotation batches retain only genuine successes, report partial failures, and reject all-target failure', async () => {
    const f = fixture(); f.load('publishing-workflow'); f.CList.publishers.Annotate.construct = undefined;
    const events = [];
    const request = { title: '', content: 'note', references: [{ url: 'a' }, { url: 'b' }], selectedAccountKeys: ['store'] };
    const deps = { accounts: [{ key: 'store', value: JSON.stringify(f.account) }], publishers: f.CList.publishers,
        parseAccount: r => JSON.parse(r.value), toText: s => s, annotationSession: f.session, onUpdate: e => events.push(e) };
    f.ctx.fetch = async (_, options) => JSON.parse(options.body).target_url === 'b'
        ? { ok: true, json: async () => ({ id: 'https://anno/created' }) }
        : { ok: false, status: 403, json: async () => ({ detail: 'denied' }) };
    const partial = await f.ctx.runPublishingWorkflow(request, deps);
    assert.equal(partial.destinations[0].status, 'published'); assert.equal(partial.primaryUrl, 'https://anno/created');
    assert.deepEqual(Array.from(partial.destinations[0].targetResults, r => r.outcome), ['failed', 'created']);
    assert.equal(events.filter(e => e.type === 'target-result').length, 2);
    f.ctx.fetch = async () => ({ ok: false, status: 401, json: async () => ({ detail: 'denied' }) });
    const failed = await f.ctx.runPublishingWorkflow(request, deps);
    assert.equal(failed.destinations[0].status, 'failed'); assert.equal(failed.primaryUrl, null);
    assert.ok(failed.destinations[0].targetResults.every(r => r.outcome === 'failed'));
});

test('two accounts can annotate the same target independently and retain their captured credentials', async () => {
    const f = fixture(); const pending = [];
    f.ctx.fetch = (url, opts) => new Promise(resolve => pending.push({ url, opts, resolve }));
    const first = f.ctx.runAnnotationOperation(f.account, f.request, f.session);
    const second = f.ctx.runAnnotationOperation({ ...f.account, instance: 'https://other.test' }, f.request, f.session);
    f.account.instance = 'https://changed.test'; f.request.body = 'changed';
    assert.equal(pending.length, 2);
    assert.equal(pending[0].url, 'https://anno.test/annotations'); assert.equal(pending[1].url, 'https://other.test/annotations');
    assert.equal(JSON.parse(pending[0].opts.body).body, '<p>Note</p>');
    pending.forEach(p => p.resolve({ ok: true, json: async () => ({}) })); await Promise.all([first, second]);
    assert.equal(f.CList.state.annotationPublishing.active.length, 0);
});

test('Send guards stale rendered controls and retains changed targets/editor context', async () => {
    const stale = editorFixture(); const button = await stale.sendButton(); stale.setToken('other-login');
    await button.listeners.click(); assert.equal(stale.calls.length, 0); assert.equal(stale.errors.length, 1);
    const f = editorFixture(); let resolve;
    f.ctx.fetch = () => new Promise(r => resolve = r);
    const send = await f.sendButton(); const pending = send.listeners.click();
    await new Promise(r => setImmediate(r)); f.refs[0].url = 'https://newer'; f.ctx.currentEditor = 'other';
    resolve({ ok: true, json: async () => ({}) }); await pending;
    assert.deepEqual(f.switched, []); assert.equal(f.ctx.currentEditor, 'other'); assert.equal(f.refs[0].url, 'https://newer');
});

test('Hypothesis accepted response without a usable ID never fabricates an undefined annotation URL', async () => {
    const f = fixture(); f.load('hypothesis');
    f.ctx.fetch = async () => ({ ok: true, json: async () => ({}) });
    const result = await f.ctx.runAnnotationOperation({ type: 'Hypothesis', instance: 'https://hypothes.is', username: 'stephen', apiKey: 'key' }, f.request, f.session);
    assert.equal(result.created, 1); assert.equal(result.url, null);
});

test('annotation scripts exist, parse, and load before their consumers; interface remains last', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const files = ['annotation-workflow', 'annotation-view', 'annotation-publishing', 'annotate_publish', 'hypothesis_publish'];
    for (const file of files) {
        assert.ok(html.includes('js/' + file + '.js')); new vm.Script(fs.readFileSync('js/' + file + '.js', 'utf8'));
        assert.ok(fs.readFileSync('js/' + file + '.js', 'utf8').split('\n').length < 500);
    }
    assert.ok(html.indexOf('js/annotation-workflow.js') < html.indexOf('js/annotate-editor.js'));
    assert.ok(html.indexOf('js/hypothesis.js') < html.indexOf('js/hypothesis_publish.js'));
    assert.ok(html.lastIndexOf('js/interface.js') > html.indexOf('js/hypothesis_publish.js'));
});
