const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = name => fs.readFileSync('js/' + name, 'utf8');

function fixture() {
    const events = [], failures = [], notices = [], records = [], mentions = [], fields = { title: 'Original title', referenceHtml: '<p>Source</p>' };
    const accounts = [{ key: 'blog', value: JSON.stringify({ type: 'Blog', title: 'My blog', permissions: 'w', id: 'credential' }) }];
    const cList = { config: { flaskSiteUrl: 'https://kv.test' }, state: { publishing: { selectedAccountKeys: ['blog'], busy: false } },
        publishers: { Blog: { publish: async () => 'https://blog.test/post' } },
        ui: { publishing: {
            begin: () => events.push('begin'), setBusy: busy => events.push(['busy', busy]), finish: () => events.push('finish'),
            update: update => events.push(update), notice: text => notices.push(text), fail: error => failures.push(error.message),
        } }, pageStore: { recordPublication: async (...args) => records.push(args) } };
    const references = [{ url: 'https://source.test', metadata: { value: 1 } }];
    const context = vm.createContext({ window: { CList: cList }, structuredClone, console: { error() {} },
        readPublicationFields: () => ({ ...fields }), packagePost: async () => '<p>Article</p>',
        getReferences: () => references, getAccounts: async () => accounts,
        parseAccountValue: account => JSON.parse(account.value), removeHtml: text => text.replace(/<[^>]+>/g, ''),
        currentLoadedPage: { kind: 'local-page', id: 'page-a' },
        sendWebMentions: async (url, refs) => mentions.push({ url, refs }),
    });
    vm.runInContext(read('publishing-workflow.js'), context);
    vm.runInContext(read('publish.js'), context);
    return { context, cList, accounts, fields, references, events, failures, notices, records, mentions };
}

test('controller awaits content capture, guards duplicate submission, and records against the captured page', async () => {
    const f = fixture(); let release, complete = 0;
    f.context.packagePost = async options => { assert.equal(options.title, 'Original title'); return new Promise(resolve => { release = resolve; }); };
    f.context.window._onPostAllComplete = () => { complete++; };
    const first = f.context.postAll(); await f.context.postAll();
    assert.equal(f.cList.state.publishing.busy, true); assert.equal(f.cList.state.publishing.operation.status, 'capturing');
    f.context.currentLoadedPage = { kind: 'local-page', id: 'page-b' };
    f.fields.title = 'Later'; f.references[0].metadata.value = 2; f.cList.state.publishing.selectedAccountKeys = [];
    release('<p>Original article</p>'); const result = await first;
    assert.equal(result.primaryUrl, 'https://blog.test/post'); assert.equal(f.records[0][0], 'page-a');
    assert.equal(f.context.currentLoadedPage.publicationUrl, undefined);
    assert.equal(f.mentions[0].refs[0].metadata.value, 1); assert.equal(complete, 1);
    assert.equal(f.cList.state.publishing.operation.status, 'complete'); assert.equal(f.cList.state.publishing.busy, false);
    assert.deepEqual(f.events.at(-2), ['busy', false]); assert.equal(f.events.at(-1), 'finish');
    result.destinations[0].destination = 'Caller mutation';
    assert.equal(f.cList.state.publishing.operation.destinations[0].destination, 'My blog');
});

test('post-publication metadata and WebMention failures never repeat a write or turn a published result into a failed write', async () => {
    const f = fixture(); let writes = 0;
    f.cList.publishers.Blog.publish = async () => { writes++; return 'https://blog.test/post'; };
    f.cList.pageStore.recordPublication = async () => { throw Error('metadata offline'); };
    f.context.sendWebMentions = async () => { throw Error('mention offline'); };
    const result = await f.context.postAll();
    assert.equal(writes, 1); assert.equal(result.destinations[0].status, 'published');
    assert.equal(f.failures.length, 0); assert.equal(f.notices.length, 2);
    assert.match(f.notices[0], /Published, but/); assert.match(f.notices[1], /WebMentions/);
});

test('empty account selection fails once through the view, cleans busy state, and has no write', async () => {
    const f = fixture(); f.cList.state.publishing.selectedAccountKeys = [];
    const result = await f.context.postAll();
    assert.equal(result, null); assert.equal(f.failures.length, 1); assert.match(f.failures[0], /No valid publishing account/);
    assert.equal(f.cList.state.publishing.operation.status, 'failed'); assert.equal(f.cList.state.publishing.busy, false);
    assert.equal(f.events.at(-1), 'finish'); assert.equal(f.records.length, 0);
});

test('destination failure and a null link remain separate outcomes and each is presented once', async () => {
    const f = fixture();
    f.cList.publishers.Blog.publish = async () => { throw Error('write failed'); };
    const failed = await f.context.postAll();
    assert.equal(failed.destinations[0].status, 'failed'); assert.equal(f.failures.length, 0);
    assert.equal(f.events.filter(event => event.type === 'destination' && event.result.status === 'failed').length, 1);
    f.cList.publishers.Blog.publish = async () => null;
    const unconfirmed = await f.context.postAll();
    assert.equal(unconfirmed.destinations[0].status, 'unconfirmed'); assert.equal(f.records.length, 0);
});

test('capture obtains real editor API output through packagePost and preserves captured title/reference HTML', async () => {
    const f = fixture(); let release, postReads = 0;
    // Minimal content serialization nodes; the actual editor mounting DOM is absent.
    f.context.document = { createElement: () => ({ children: [], appendChild(child) { this.children.push(child); },
        get outerHTML() { return `<div id="${this.id}">${this.textContent || this.innerHTML || this.children.map(child => child.outerHTML).join('')}</div>`; } }) };
    f.context.editorHandlers = { rich: {
        getContent: () => assert.fail('publishing must prefer getPostContent'),
        getPostContent: async () => { postReads++; return new Promise(resolve => { release = resolve; }); },
    } };
    f.context.currentEditor = 'rich';
    const files = read('files.js'), start = files.indexOf('async function packagePost(');
    vm.runInContext(files.slice(start, files.indexOf('  function packageStatus(', start)), f.context);
    const pending = f.context.capturePublicationRequest();
    assert.equal(postReads, 1); f.fields.title = 'Later'; f.fields.referenceHtml = 'Later reference';
    release('<p>Rich editor HTML</p>'); const request = await pending;
    assert.match(request.content, /Original title/); assert.match(request.content, /Rich editor HTML/);
    assert.match(request.content, /<p>Source<\/p>/); assert.equal(request.localPageId, 'page-a');
});

test('content preparation returning null cancels without a second error presentation', async () => {
    const f = fixture(); f.context.packagePost = async () => null;
    assert.equal(await f.context.postAll(), null); assert.equal(f.failures.length, 0);
    assert.equal(f.cList.state.publishing.operation.status, 'cancelled'); assert.equal(f.events.at(-1), 'finish');
});

test('ordinary and direct controllers deliver optional service warnings through the view', async () => {
    const f = fixture();
    f.cList.publishers.Blog.publish = async (_, __, ___, ____, options) => {
        options.onWarning('Service limit warning'); return 'https://blog.test/post';
    };
    const result = await f.context.postAll();
    assert.equal(f.events.find(event => event.type === 'warning').message, 'Service limit warning');
    assert.equal(result.destinations[0].warnings[0], 'Service limit warning');
    assert.equal(f.cList.state.publishing.operation.destinations[0].warnings[0], 'Service limit warning');
    assert.equal(await f.context.postContentByType({ type: 'Blog' }, '', 'Text'), 'https://blog.test/post');
    assert.equal(f.notices.length, 1); assert.equal(f.notices[0], 'Service limit warning');
    assert.equal(f.failures.length, 0);
});

test('ordinary posting cannot remove an outstanding web-page version choice', async () => {
    const f = fixture(); f.cList.state.webPagePublishing = { busy: true, status: 'awaiting-choice' };
    await f.context.postAll();
    assert.equal(f.events.includes('begin'), false); assert.equal(f.records.length, 0);
    assert.match(f.failures[0], /Finish or cancel/); assert.equal(f.cList.state.publishing.busy, false);
});
