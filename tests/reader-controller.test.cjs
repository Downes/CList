const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const { fixture } = require('./helpers/reader-fixture.cjs');

test('reader state transitions are DOM-free and obsolete completion cannot overwrite a newer request', () => {
    const ctx = vm.createContext({}); vm.runInContext(source('reader-state'), ctx);
    const first = ctx.beginReaderRequest(ctx.createReaderState(), 'a', 'Test', 'Timeline');
    const second = ctx.beginReaderRequest(first, 'b', 'Test', 'Timeline');
    assert.equal(first.accountKey, 'a'); assert.equal(second.accountKey, 'b');
    assert.equal(ctx.finishReaderRequest(second, first.requestId, 'old error'), second);
    assert.equal(ctx.resetReaderState(second, 'public').accountKey, null);
    assert.equal('window' in ctx, false); assert.equal('document' in ctx, false);
});

test('selection captures account inputs, keeps credentials out of state and supports the existing registry signature', async () => {
    const f = fixture(); await f.ctx.switchReaderAccount('a');
    assert.equal(f.contexts[0].account.title, 'a'); assert.equal(f.contexts[0].account.id, 'private-credential');
    f.contexts[0].account.title = 'mutated'; assert.equal(JSON.parse(f.CList.accounts[0].value).title, 'a');
    assert.equal(f.CList.state.reader.accountKey, 'a'); assert.equal(f.CList.state.reader.feedName, 'Timeline');
    assert.equal(f.CList.state.reader.status, 'ready');
    assert.equal(JSON.stringify(f.CList.state.reader).includes('private-'), false);
});

test('late initialization success/error and its cleanup timer cannot change the newly selected account', async () => {
    const f = fixture(); const gates = [];
    f.CList.readers.Test.initialize = (account, context) => new Promise((resolve, reject) => gates.push({ account, context, resolve, reject }));
    const a = f.ctx.switchReaderAccount('a'), b = f.ctx.switchReaderAccount('b');
    assert.equal(gates[0].context.signal.aborted, true); gates[1].resolve(); await b;
    gates[0].context.commit(() => f.commits.push('old')); gates[0].reject(Error('old error')); await a;
    assert.equal(f.CList.state.reader.accountKey, 'b'); assert.equal(f.CList.state.reader.status, 'ready');
    assert.deepEqual(f.errors, []); assert.deepEqual(f.commits, []);
    const c = f.ctx.switchReaderAccount('a'); f.timers[0]();
    assert.equal(f.events.filter(e => e.type === 'clear').length, 0);
    gates[2].resolve(); await c;
});

test('context-aware feed loads capture a new generation and suppress late feed commits', async () => {
    const f = fixture(); const gates = [];
    f.CList.readers.Test.supportsRequestContext = true;
    f.CList.readers.Test.feedFunctions = { First: ctx => new Promise(resolve => gates.push({ ctx, resolve })),
        Second: ctx => new Promise(resolve => gates.push({ ctx, resolve })), Refresh() {} };
    await f.ctx.switchReaderAccount('a');
    const run = f.events.find(e => e.type === 'begin').run;
    const first = run('First'), second = run('Second');
    gates[1].ctx.commit(() => f.commits.push('second')); gates[1].resolve(); await second;
    await gates[0].ctx.render(['old'], {}); gates[0].ctx.commit(() => f.commits.push('first')); gates[0].resolve(); await first;
    assert.deepEqual(f.commits, ['second']); assert.equal(f.CList.state.reader.feedName, 'Second');
    await run('Refresh'); assert.equal(f.CList.state.reader.feedName, 'Second');
});

test('legacy feed actions still receive zero arguments; removed accounts and session changes invalidate requests', async () => {
    const f = fixture(); let args;
    f.CList.readers.Test.feedFunctions.Timeline = function() { args = arguments.length; };
    await f.ctx.switchReaderAccount('a'); await f.events.find(e => e.type === 'begin').run('Timeline'); assert.equal(args, 0);
    let finish; f.CList.readers.Test.initialize = () => new Promise(resolve => finish = resolve);
    const pending = f.ctx.switchReaderAccount('a'); f.setToken('different'); finish(); await pending;
    assert.equal(f.CList.state.reader.mode, 'idle'); assert.equal(f.CList.state.reader.accountKey, null);
    f.CList.accounts = []; await f.ctx.switchReaderAccount('a'); assert.equal(f.errors.at(-1), 'invalid');
});

test('current initialization errors settle state once; explicit invalidation and public selection cancel ownership', async () => {
    const f = fixture(); f.CList.readers.Test.initialize = async () => { throw Error('denied'); };
    await f.ctx.switchReaderAccount('a'); assert.equal(f.CList.state.reader.status, 'failed'); assert.deepEqual(f.errors, ['denied']);
    f.ctx.invalidateReader('collections'); assert.equal(f.CList.state.reader.mode, 'collections');
    f.ctx.isRegistered = () => false; await f.ctx.playRead(); assert.equal(f.CList.state.reader.mode, 'public');
});

test('shared renderer checks ownership after awaited normalization so late items cannot enter a new feed', async () => {
    const container = new Element('div'), CList = { ui: {}, checkAnnotationsBatch() {} }; let current = true, release;
    const ctx = vm.createContext({ window: { CList }, document: { createElement: tag => new Element(tag) },
        createFeedHeader: () => new Element('header'), makeListing: () => new Element('article') });
    const text = source('ui'); const start = text.indexOf('window.CList.ui.renderFeed = async function');
    vm.runInContext(text.slice(start, text.indexOf('// ============================================================================', start)), ctx);
    CList.ui.renderLoadMoreButton = () => { throw Error('stale load-more rendering'); };
    const pending = CList.ui.renderFeed(['old'], container, { normalize: () => new Promise(r => release = r), isCurrent: () => current });
    current = false; container.innerHTML = ''; container.appendChild(new Element('new-feed')); release({}); await pending;
    assert.deepEqual(container.children.map(c => c.tagName), ['new-feed']);
});

test('reader account view preserves special-entry ordering and optional handler-independent visibility', () => {
    const container = new Element('div'), list = new Element('div'); list.appendChild(new Element('account'));
    const CList = { ui: { view: {} } }; const ctx = vm.createContext({ window: { CList },
        document: { getElementById: () => container, createElement: tag => new Element(tag) }, makeAccountList: () => list });
    vm.runInContext(source('reader-view'), ctx);
    CList.ui.reader.accounts([], { annotations: true, collections: true, onAccount() {}, onAnnotations() {}, onCollections() {} });
    const labels = list.children.slice(1).map(button => button.children[1].textContent);
    assert.deepEqual(labels, ['Annotations', 'Collections']);
    assert.equal('fetch' in ctx, false);
});


test('a non-Error initializer rejection still leaves failed state and useful feedback', async () => {
    const f = fixture(); f.CList.readers.Test.initialize = async () => { throw 'service rejected'; };
    await f.ctx.switchReaderAccount('a');
    assert.equal(f.CList.state.reader.status, 'failed'); assert.equal(f.CList.state.reader.error, 'service rejected');
    assert.deepEqual(f.errors, ['service rejected']);
});


test('captured row navigation survives pagination but cannot navigate a different account or session', async () => {
    const f=fixture();await f.ctx.switchReaderAccount('a');const context=f.contexts[0].context;
    await context.next(async()=>{});assert.equal(context.isCurrent(),false);assert.equal(context.isAccountCurrent(),true);
    let calls=0;await context.navigate(async next=>{calls++;assert.equal(next.account.id,'private-credential');},'Thread');
    assert.equal(calls,1);assert.equal(f.CList.state.reader.feedName,'Thread');
    await f.ctx.switchReaderAccount('b');await context.navigate(async()=>{calls++;});assert.equal(calls,1);
});

test('external reader surfaces share invalidation, capture session and do not restore after another reader starts', async () => {
    const f=fixture();f.CList.ui.view={feedContainer:{}};
    const first=f.ctx.captureReaderSurface('public');await first.render(['public'],{});assert.equal(first.isCurrent(),true);
    await f.ctx.switchReaderAccount('a');assert.equal(first.isCurrent(),false);assert.equal(first.signal.aborted,true);
    const second=f.ctx.captureReaderSurface('annotations');f.setToken('another-session');assert.equal(second.isCurrent(),false);
});


test('initial account selection chooses a reading feed instead of a registry UI action', async () => {
 const f=fixture();f.CList.readers.Test.uiActions=['Post','Search'];f.CList.readers.Test.feedFunctions={Post(){},Timeline(){},Search(){}};
 await f.ctx.switchReaderAccount('a');assert.equal(f.CList.state.reader.feedName,'Timeline');
});
