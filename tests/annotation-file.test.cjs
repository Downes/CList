const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { NavigationElement: Element } = require('./helpers/navigation-dom.cjs');
const {createAnnotationTinyFake}=require('./helpers/annotation-tiny-fixture.js');
const source = fs.readFileSync('js/annotate-editor.js', 'utf8');
const nativeType = 'application/vnd.clist.annotation+json';
const plain = value => JSON.parse(JSON.stringify(value));

// Loads the actual handler with simulated controls and editor/reference APIs.
// This verifies capture/restoration decisions, not TinyMCE or browser rendering.
function fixture({ liveEditor = true, sanitizer = true } = {}) {
    const root = new Element(), textarea = new Element('textarea'), fields = new Element();
    root.id='annotateEditDiv';textarea.id = 'annotate-edit-body'; fields.id = 'annotate-ref-fields'; root.append(textarea, fields);
    let html = '', references = [];
    const sanitized = [];
    const editor = { getContent: () => html, setContent: value => { html = value; } };
    const ctx = vm.createContext({
        editorHandlers: {}, currentEditor:'annotate-edit', structuredClone, console,
        window: sanitizer ? { sanitizeHtml(value) { sanitized.push(value); return {toString: () => value.replace(/<script[\s\S]*?<\/script>/gi, '')}; } } : {},
        document: { getElementById: id => id===root.id?root:root.querySelector('#' + id), createElement: tag => new Element(tag) },
        tinymce: { get: () => liveEditor ? editor : null },
        getReferences: () => references, setReferences: list => { references = list; },
        clearReferences: () => { references = []; }, hasValidSession: () => true,
        escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        cleanHTMLContent: value => value.replace(/<[^>]+>/g, ''),
    });
    ctx.window.CList={state:{},config:{}};
    for(const name of ['annotate_draft_state', 'annotate_draft_view', 'annotate_draft', 'annotate_body_view', 'annotate_body', 'annotate_send_view', 'annotate_send'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
    vm.runInContext(source, ctx);
    if(liveEditor){ctx.tinymce=createAnnotationTinyFake({read:()=>html,write:value=>{html=value;}});vm.runInContext('_initAnnotateTinyMCE()',ctx);}
    return { ctx, handler: ctx.editorHandlers['annotate-edit'], textarea, fields, sanitized,
        body: () => liveEditor ? html : textarea.value,
        refs: () => plain(references),
        target: () => plain(vm.runInContext('_annotateTarget()', ctx)),
        seedTarget(target) { ctx.seedTarget = target; vm.runInContext('_annotationDraft.standalone = structuredClone(seedTarget)', ctx); },
        seedRefs(list) { references = list; },
    };
}
const annotation = (body, target = {url: 'https://source/a', title: 'Source A'}, references = []) =>
    ({format: 'clist-annotation-v1', body, target, references});

test('annotation native capture preserves rich body, complete standalone target and publication-body API', () => {
    const f = fixture();
    const target = {url: '', title: 'An unfinished target', author_name: 'Writer', feed: 'Feed',
        image: 'https://source/image', summary: 'Draft summary', service: null, replyToken: null};
    const body = '<p>My <strong>annotation</strong> and <a href="https://source">link</a>.</p>';
    f.seedTarget(target); f.handler.setContent(body);
    const file = f.handler.getFileContent(), saved = JSON.parse(file.value);
    assert.equal(file.type, nativeType); assert.equal(saved.format, 'clist-annotation-v1');
    assert.equal(saved.body, body); assert.deepEqual(saved.target, target); assert.deepEqual(saved.references, []);
    assert.equal(f.handler.getContent(), body, 'publication still receives only HTML body');
    saved.target.title = 'Changed copy';
    assert.equal(f.target().title, target.title, 'file capture is detached from the editor target');
    assert.ok(f.handler.contentTypes.includes(nativeType));
});

test('annotation native load restores standalone target fields and rich body into the real reference-field renderer', () => {
    const f = fixture();
    const target = {url: '', title: 'Standalone title', author_name: 'Standalone writer', feed: 'Journal', image: 'https://source/image'};
    const body = '<p>A <em>formatted</em> note.</p>';
    f.handler.loadContent({type: nativeType, value: JSON.stringify(annotation(body, target))});
    assert.equal(f.body(), body); assert.deepEqual(f.target(), target); assert.deepEqual(f.refs(), []);
    assert.deepEqual(f.fields.querySelectorAll('input').map(input => input.value),
        ['Standalone title', '', 'Standalone writer', 'Journal', 'https://source/image']);
    assert.deepEqual(f.sanitized, [body], 'native body goes through the HTML sanitizer instead of plain-text conversion');
});

test('annotation Replace restores explicit target first, convergent references and reply tokens without mutating input', () => {
    const f = fixture(); f.handler.setContent('<p>Old body</p>'); f.seedRefs([{url: 'https://old', title: 'Old target'}]);
    const target = {url: 'https://source/a', title: 'Updated target', replyToken: {type: 'Mastodon', statusId: '123'}};
    const data = annotation('<p>New body</p>', target,
        [{url: 'https://source/b', title: 'Convergent target'}, {url: target.url, title: 'Outdated duplicate'}]);
    const original = plain(data);
    f.handler.setContent(data);
    assert.equal(f.body(), '<p>New body</p>');
    assert.deepEqual(f.refs(), [target, {url: 'https://source/b', title: 'Convergent target'}]);
    assert.deepEqual(f.target(), target); assert.deepEqual(data, original);
    assert.equal(JSON.parse(f.handler.getFileContent().value).references[0].replyToken.statusId, '123');
});

test('annotation Insert appends body and merges references while retaining its existing target', () => {
    const f = fixture();
    const original = {url: 'https://source/a', title: 'Keep this target'};
    f.handler.setContent('<p>Existing note</p>'); f.seedRefs([original]);
    f.handler.loadContent({type: nativeType, value: annotation('<p>Added note</p>',
        {url: 'https://source/b', title: 'Added target'}, [{url: original.url, title: 'Duplicate'}])});
    assert.equal(f.body(), '<p>Existing note</p><p>Added note</p>');
    assert.deepEqual(f.refs(), [original, {url: 'https://source/b', title: 'Added target'}]);
    assert.deepEqual(f.target(), original);
});

test('annotation New restores incoming target even when body was cleared before previous references were reset', () => {
    const f = fixture();
    f.handler.setContent('<p>Previous</p>'); f.seedRefs([{url: 'https://old', title: 'Old'}]);
    f.handler.setContent('');
    const data = annotation('<p>Fresh</p>', {url: 'https://new', title: 'New'});
    f.handler.loadContent({type: nativeType, value: data});
    assert.equal(f.body(), '<p>Fresh</p>'); assert.deepEqual(f.refs(), [data.target]);
    assert.equal(f.fields.querySelectorAll('input')[0].value, 'New');
});

test('annotation native restoration supports the backing textarea and safe fallback when sanitizer is unavailable', () => {
    const f = fixture({liveEditor: false, sanitizer: false});
    f.handler.setContent(annotation('<p>Markup</p><script>unsafe()</script>', {url: '', title: 'Draft'}));
    assert.equal(f.textarea.value, '&lt;p&gt;Markup&lt;/p&gt;&lt;script&gt;unsafe()&lt;/script&gt;');
    assert.equal(f.handler.getContent(), f.textarea.value);
    f.handler.setContent('Normal string body');
    assert.equal(f.handler.getContent(), 'Normal string body', 'normal string setContent behavior is unchanged');
});

test('malformed native annotations fail before changing existing body, target or references', () => {
    const f = fixture(); const target = {url: 'https://keep', title: 'Preserved'};
    f.handler.setContent('<p>Preserved body</p>'); f.seedRefs([target]);
    for (const value of [null, {format:'other'}, {...annotation('bad'),body:[]},
        {...annotation('bad'),target:[]}, {...annotation('bad'),references:{}}, '{bad JSON']) {
        assert.throws(() => f.handler.loadContent({type: nativeType, value}));
        assert.equal(f.body(), '<p>Preserved body</p>'); assert.deepEqual(f.refs(), [target]);
    }
    const data = annotation('<p>Safe</p><script>unsafe()</script>');
    f.handler.setContent(data); assert.equal(f.body(), '<p>Safe</p>');
});


function switchingFixture() {
    const f=fixture(), root=f.textarea.parentNode, errors=[], initializers=[];
    root.innerHTML='';root.id='write-pane';
    let html='';
    Object.assign(f.ctx,{
        currentEditor:'texteditor',currentEditorAccount:null,pendingContent:null,
        captureAnnotationSession:()=>({token:null}),parseAccountValue:()=>null,ensureAccountsLoaded:async()=>[],
        _parkCurrentEditorState(){},_restoreEditorState(){},closeReferencesPanel(){},closeRightPane(){},
        updateEditorIndicator(){},populateEditorList:async()=>{},setupEditorButtons(){},registerEditorPanes(){},
        showErrorModal:message=>errors.push(message),console:{log(){},error(){}},
        tinymce:createAnnotationTinyFake({read:()=>html,write:value=>{html=value;},behavior:{init:(_config,editor)=>{
            return new Promise((resolve,reject)=>initializers.push({resolve:()=>{editor.emit('init');resolve([editor]);},reject}));
        }}}),
    });
    f.ctx.window.CList={ui:{view:{writePaneContent:root}}};
    f.ctx.document.documentElement={classList:{contains:()=>false}};
    f.ctx.window.CList.state = {};
    f.ctx.window.CList.ui.editorSwitch = {
        prepare: () => () => {}, close() {}, indicator() {}, choices() {},
        error: error => errors.push(error.message),
    };
    f.ctx.EDITOR_TEST_VERSION = 'fixture';
    for (const name of ['editor-state', 'editor-switch']) {
        vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), f.ctx);
    }
    // Use the real mount/controller, suppress only picker rendering and metadata DOM.
    f.ctx.populateEditorList = async () => {};
    f.ctx._parkCurrentEditorState = () => {};
    f.ctx._restoreEditorState = () => {};
    return {...f,root,errors,initializers,html:()=>f.ctx.editorHandlers['annotate-edit'].getContent(),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('real editor switch waits for annotation TinyMCE readiness and consumes carried HTML exactly once',async()=>{
    const f=switchingFixture();
    const content={type:'text/html',value:'<p>Stephen Downes wrote: "Saved quote"</p>'};
    const switched=f.ctx.switchToEditor('annotate-edit',content);await f.flush();
    assert.equal(f.initializers.length,1);assert.equal(f.html(),'');assert.deepEqual(plain(f.ctx.pendingContent),content);
    f.initializers[0].resolve();await switched;
    assert.match(f.html(),/Stephen Downes wrote/);assert.match(f.html(),/<p>/);
    assert.equal(f.ctx.pendingContent,null);const loaded=f.html();
    await f.ctx.switchToEditor('annotate-edit');assert.equal(f.html(),loaded);assert.equal(f.initializers.length,1);
    assert.deepEqual(f.errors,[]);
});

test('annotation rich initialization failure delivers carried file to fallback and explicit retry preserves it',async()=>{
    const f=switchingFixture(),content={type:nativeType,value:annotation('<p>Retained file</p>',{url:'',title:'File title'})};
    const first=f.ctx.switchToEditor('annotate-edit',content);await f.flush();
    f.initializers[0].reject(Error('startup failed'));await first;
    assert.equal(f.ctx.pendingContent,null);assert.equal(f.html(),'<p>Retained file</p>');assert.ok(f.root.textContent.includes('Rich editor unavailable'));
    const retry=f.ctx._initAnnotateTinyMCE();await f.flush();assert.equal(f.initializers.length,2);
    f.initializers[1].resolve();await retry;
    assert.equal(f.html(),'<p>Retained file</p>');assert.equal(f.ctx.pendingContent,null);
    assert.equal(f.target().title,'File title');
});
