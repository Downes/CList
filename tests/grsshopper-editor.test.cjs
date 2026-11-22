const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');

const grsshopperSource = fs.readFileSync('js/grsshopper-editor.js', 'utf8');

// Runs the real pane-switcher (editor-panes-state.js/editor-panes-view.js/editor-panes.js)
// instead of re-implementing it, so pane show/hide/render behavior is the genuine article,
// not a stand-in that could silently drift from it.
function _paneSwitcherSource() {
    return ['js/editor-panes-state.js', 'js/editor-panes-view.js', 'js/editor-panes.js']
        .map(path => fs.readFileSync(path, 'utf8')).join('\n');
}

// Loads the real handler with a simulated DOM, two fake TinyMCE instances (post body + edit-pane
// description), and the real pane-switcher. Verifies capture/field-population decisions, not
// TinyMCE or browser rendering.
function fixture() {
    const root = new Element();
    const writePaneContent = new Element();
    root.appendChild(writePaneContent);

    const editors = {}; // selector id -> fake tinymce editor instance
    const tinymce = {
        get: id => editors[id] || null,
        init: config => {
            const selector = config.selector.replace('#', '');
            let content = '';
            const callbacks = {};
            const editor = {
                getContent: () => content,
                setContent: value => { content = value; callbacks.change?.(); },
                on: (name, fn) => { callbacks[name] = fn; },
            };
            config.setup?.(editor);
            editors[selector] = editor;
        },
    };

    let accounts = [{ value: JSON.stringify({ type: 'gRSShopper', title: 'My gRSShopper', instance: 'https://ghub.test', permissions: 'rw' }) }];
    const errors = [];
    const ctx = vm.createContext({
        editorHandlers: {}, console, structuredClone, currentEditor: null,
        document: {
            getElementById: id => root.querySelector('#' + id),
            createElement: tag => new Element(tag),
            documentElement: Object.assign(new Element('html'), { classList: { contains: () => false } }),
        },
        window: {
            CList: {
                ui: { view: { writePaneContent } },
                uploaders: { gRSShopper: { uploadForPost: async () => { throw new Error('uploadForPost not mocked'); } } },
            },
            grsshopperSavePost: async () => { throw new Error('grsshopperSavePost not mocked'); },
        },
        tinymce,
        tinymceDarkOptions: () => ({ skin: 'oxide', content_style: 'body { font-size:14px; }' }),
        escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        cleanHTMLContent: value => String(value).replace(/<[^>]+>/g, ''),
        showErrorModal: (message) => errors.push(message),
        showStatusMessage: () => {},
        isRegistered: () => true,
        findAccountByType: () => ({ type: 'gRSShopper' }),
        ensureAccountsLoaded: async () => accounts,
        parseAccountValue: record => JSON.parse(record.value),
        buildAccountSelect: () => { const el = new Element('select'); el.value = '0'; return el; },
    });
    vm.runInContext(_paneSwitcherSource(), ctx);
    vm.runInContext(grsshopperSource, ctx);

    return {
        ctx, root, errors,
        handler: ctx.editorHandlers['grsshopper-post'],
        editPane: () => root.querySelector('#grsshopper-edit-pane'),
        description: () => ctx.tinymce.get('grsshopper-post-description')?.getContent()
            ?? root.querySelector('#grsshopper-post-description')?.value ?? '',
        fieldValue: key => {
            const labels = { title: 'Title', link: 'Link URL', author: 'Author', feed: 'Feed' };
            const wrapper = root.querySelectorAll('.collection-editor-field')
                .find(w => w.querySelector('label')?.textContent === labels[key]);
            return wrapper?.querySelector('input')?.value;
        },
        setAccounts(list) { accounts = list; },
        flush: () => new Promise(resolve => setImmediate(resolve)),
        uploadPane: () => root.querySelector('#grsshopper-upload-pane'),
        uploadStatus: () => root.querySelector('#grsshopper-upload-pane')?.querySelector('.feed-status-message')?.textContent,
    };
}

// Drives the Publish pane to a successful save, so _grsshopperPost.id exists — the trigger
// that flips the Upload pane's selection mechanisms from "queue silently" to "send immediately".
async function publishSuccessfully(f, { id = '42', url = 'https://ghub.test/42' } = {}) {
    f.ctx.window.grsshopperSavePost = async () => ({ id, url });
    for (const input of f.root.querySelectorAll('input')) { input.value = input.value || 'x'; input.dispatch('change'); }
    f.ctx.tinymce.get('grsshopper-post-description')?.setContent('x');
    f.handler.editorFunctions['Publish']();
    await f.flush();
    f.root.querySelector('#grsshopper-publish-pane').querySelector('button').dispatch('click');
    await f.flush();
    await f.flush(); // second tick: lets the fire-and-forget _grsshopperSendPendingUpload() settle too
}

const reference = (overrides = {}) => ({
    url: 'https://source/a', title: 'Source title', author_name: 'Source author', feed: 'Source feed', ...overrides,
});

test('the editor opens directly on the Edit pane, not Write', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    assert.equal(f.editPane().style.display, 'block');
    assert.equal(f.root.querySelector('#grsshopper-write-pane').style.display, 'none');
});

test('insertLink appends quoted text with a citation link to the Description field, not the post body', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.insertLink({ content: { type: 'text/html', value: 'Quoted text' }, entryUrl: 'https://source/a', feedTitle: 'Author', reference: reference() });
    assert.match(f.description(), /Quoted text/);
    assert.match(f.description(), /href="https:\/\/source\/a"/);
    assert.match(f.description(), />Author</);
    assert.equal(f.handler.getContent(), '', 'post body is left untouched');
});

test('insertLinkVia appends quoted text with both the linked-page and entry citations to the Description field', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.insertLinkVia({
        content: { type: 'text/html', value: 'Quoted text' }, linkedUrl: 'https://linked', linkedTitle: 'Linked Page',
        entryUrl: 'https://source/a', authorOrFeedTitle: 'Author', reference: reference(),
    });
    assert.match(f.description(), /Quoted text/);
    assert.match(f.description(), /href="https:\/\/linked"/);
    assert.match(f.description(), /via <a href="https:\/\/source\/a"/);
    assert.equal(f.handler.getContent(), '', 'post body is left untouched');
});

test('insertLink fills empty Title/Link/Author/Feed from the source entry', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush(); // Edit pane is open by default

    f.handler.insertLink({ content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'Source author', reference: reference() });
    await f.flush();

    assert.equal(f.fieldValue('title'), 'Source title');
    assert.equal(f.fieldValue('link'), 'https://source/a');
    assert.equal(f.fieldValue('author'), 'Source author');
    assert.equal(f.fieldValue('feed'), 'Source feed');
});

test('insertLink never overwrites Title/Link/Author/Feed the user already typed', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    // Simulate the user having already typed into every field before quoting anything.
    for (const input of f.root.querySelectorAll('input')) input.value = 'Existing ' + input.value;
    for (const input of f.root.querySelectorAll('input')) input.dispatch('change');

    f.handler.insertLink({ content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x', reference: reference() });
    await f.flush();

    assert.ok(f.fieldValue('title').startsWith('Existing'));
    assert.ok(f.fieldValue('link').startsWith('Existing'));
    assert.ok(f.fieldValue('author').startsWith('Existing'));
    assert.ok(f.fieldValue('feed').startsWith('Existing'));
});

test('insertLink fills fields silently without a visible Edit pane, picked up next time it opens', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.editorFunctions['Write'](); // switch away, hiding the Edit pane
    await f.flush();

    f.handler.insertLink({ content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x', reference: reference() });
    await f.flush();

    f.handler.editorFunctions['Edit']();
    await f.flush();
    assert.equal(f.fieldValue('title'), 'Source title');
    assert.equal(f.fieldValue('link'), 'https://source/a');
});

test('a reference with no title/author/feed leaves those fields untouched', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    f.handler.insertLink({ content: { type: 'text/html', value: 'Quote' }, entryUrl: 'https://bare', feedTitle: 'x', reference: { url: 'https://bare' } });
    await f.flush();

    assert.equal(f.fieldValue('title'), '');
    assert.equal(f.fieldValue('author'), '');
    assert.equal(f.fieldValue('feed'), '');
    assert.equal(f.fieldValue('link'), 'https://bare');
});

test('Clear resets the post record so the next quote fills every field again', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    f.handler.insertLink({ content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x', reference: reference() });
    await f.flush();
    assert.equal(f.fieldValue('title'), 'Source title');

    f.handler.editorFunctions['Clear']();
    await f.flush();
    assert.equal(f.fieldValue('title'), '');
    assert.equal(f.description(), '');

    f.handler.insertLink({ content: { type: 'text/html', value: 'Second quote' }, entryUrl: 'https://source/b', feedTitle: 'x', reference: reference({ url: 'https://source/b', title: 'Second title' }) });
    await f.flush();
    assert.equal(f.fieldValue('title'), 'Second title');
});

test('Upload pane shows one thumbnail per image carried by the quoted entry reference', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    f.handler.insertLink({
        content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x',
        reference: reference({ images: ['https://img/1.jpg', 'https://img/2.jpg'] }),
    });
    await f.flush();

    f.handler.editorFunctions['Upload']();
    await f.flush();

    const thumbs = f.uploadPane().querySelectorAll('img');
    assert.equal(thumbs.length, 2);
    assert.deepEqual(thumbs.map(img => img.src), ['https://img/1.jpg', 'https://img/2.jpg']);
});

test('Upload pane falls back to a single-image reference (.image instead of .images)', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    f.handler.insertLink({
        content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x',
        reference: reference({ image: 'https://img/solo.jpg' }),
    });
    await f.flush();

    f.handler.editorFunctions['Upload']();
    await f.flush();

    const thumbs = f.uploadPane().querySelectorAll('img');
    assert.equal(thumbs.length, 1);
    assert.equal(thumbs[0].src, 'https://img/solo.jpg');
});

test('Upload pane: clicking a candidate thumbnail with no post yet queues the upload silently', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.insertLink({
        content: { type: 'text/html', value: 'Quote' }, entryUrl: reference().url, feedTitle: 'x',
        reference: reference({ images: ['https://img/1.jpg'] }),
    });
    await f.flush();
    f.handler.editorFunctions['Upload']();
    await f.flush();

    f.uploadPane().querySelector('img').parentNode.dispatch('click'); // the thumbnail <button>
    await f.flush();

    assert.match(f.uploadStatus(), /Queued "https:\/\/img\/1\.jpg"/);
    assert.match(f.uploadStatus(), /once the post is published/);
    assert.equal(f.errors.length, 0);
});

test('Upload pane: entering a URL and clicking Upload queues when no post exists yet', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.editorFunctions['Upload']();
    await f.flush();

    const pane = f.uploadPane();
    const urlInput = pane.querySelectorAll('input').find(el => el.type === 'text');
    urlInput.value = 'https://example.com/photo.jpg';
    pane.querySelectorAll('button').find(btn => btn.textContent === 'Upload').dispatch('click');
    await f.flush();

    assert.match(f.uploadStatus(), /Queued "https:\/\/example\.com\/photo\.jpg"/);
});

test('Upload pane: the Upload button requires a non-empty URL', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.editorFunctions['Upload']();
    await f.flush();

    const pane = f.uploadPane();
    pane.querySelectorAll('button').find(btn => btn.textContent === 'Upload').dispatch('click');
    await f.flush();

    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0], /Enter a URL/);
});

test('Upload pane: choosing a local file queues when no post exists yet', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.editorFunctions['Upload']();
    await f.flush();

    const fileInput = f.uploadPane().querySelectorAll('input').find(el => el.type === 'file');
    fileInput.files = [{ name: 'photo.png' }];
    fileInput.dispatch('change');
    await f.flush();

    assert.match(f.uploadStatus(), /Queued "photo\.png"/);
});

test('Upload pane: the CList image library selector is a disabled placeholder', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    f.handler.editorFunctions['Upload']();
    await f.flush();

    const libraryBtn = f.uploadPane().querySelectorAll('button').find(btn => btn.textContent === 'Coming Soon');
    assert.ok(libraryBtn, 'placeholder button must exist');
    assert.equal(libraryBtn.disabled, true);
});

test('Upload pane: selecting a file after a post already exists sends immediately instead of queuing', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    await publishSuccessfully(f);

    let uploadCall = null;
    f.ctx.window.CList.uploaders.gRSShopper.uploadForPost = async (account, selection) => {
        uploadCall = selection;
        return { url: 'https://ghub.test/files/photo.png', fileId: '7' };
    };

    f.handler.editorFunctions['Upload']();
    await f.flush();
    const fileInput = f.uploadPane().querySelectorAll('input').find(el => el.type === 'file');
    fileInput.files = [{ name: 'photo.png' }];
    fileInput.dispatch('change');
    await f.flush();
    await f.flush();

    assert.ok(uploadCall, 'uploadForPost must have been called immediately, not queued');
    assert.equal(uploadCall.postId, '42');
    assert.equal(uploadCall.file.name, 'photo.png');
    assert.match(f.uploadStatus(), /Uploaded: https:\/\/ghub\.test\/files\/photo\.png/);
});

test('A queued upload auto-sends once Publish succeeds and a post id is assigned', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();

    f.handler.editorFunctions['Upload']();
    await f.flush();
    const urlInput = f.uploadPane().querySelectorAll('input').find(el => el.type === 'text');
    urlInput.value = 'https://example.com/queued.jpg';
    f.uploadPane().querySelectorAll('button').find(btn => btn.textContent === 'Upload').dispatch('click');
    await f.flush();
    assert.match(f.uploadStatus(), /Queued/);

    let uploadCall = null;
    f.ctx.window.CList.uploaders.gRSShopper.uploadForPost = async (account, selection) => {
        uploadCall = selection;
        return { url: 'https://ghub.test/files/queued.jpg', fileId: '9' };
    };

    await publishSuccessfully(f);

    assert.ok(uploadCall, 'the queued upload must have been sent once the post was published');
    assert.equal(uploadCall.postId, '42');
    assert.equal(uploadCall.sourceUrl, 'https://example.com/queued.jpg');
});

test('A failed upload surfaces the error via showErrorModal and leaves a failure status', async () => {
    const f = fixture();
    await f.handler.initialize();
    await f.flush();
    await publishSuccessfully(f);

    f.ctx.window.CList.uploaders.gRSShopper.uploadForPost = async () => { throw new Error('gRSShopper upload failed: 500'); };

    f.handler.editorFunctions['Upload']();
    await f.flush();
    const fileInput = f.uploadPane().querySelectorAll('input').find(el => el.type === 'file');
    fileInput.files = [{ name: 'bad.png' }];
    fileInput.dispatch('change');
    await f.flush();
    await f.flush();

    assert.equal(f.errors.length, 1);
    assert.match(f.errors[0], /gRSShopper upload failed/);
    assert.match(f.uploadStatus(), /Upload failed/);
});
