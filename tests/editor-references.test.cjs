const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');

function fixture() {
    function element(tag = 'div') {
        const el = new Element(tag);
        el.classList = {
            add(name) { el.className = [...new Set((el.className || '').split(' ').concat(name))].join(' '); },
            remove(name) { el.className = (el.className || '').split(' ').filter(x => x !== name).join(' '); },
            contains(name) { return (el.className || '').split(' ').includes(name); },
            toggle(name) { this.contains(name) ? this.remove(name) : this.add(name); },
        };
        el.setSelectionRange = (start, end) => { el.selectionStart = start; el.selectionEnd = end; };
        el.selectionStart = 0;
        return el;
    }
    const root = element(), textarea = element('textarea'), backing = element('textarea'), refsButton = element('button');
    backing.id = 'write-column'; root.appendChild(backing);
    for (const id of ['textEditorDiv', 'tinymceEditorDiv', 'collabDiv', 'latexDiv', 'etherpadDiv']) {
        const el = element(); el.id = id; root.appendChild(el);
    }
    const refs = [{ url: 'https://source/a', title: 'First', author_name: 'Author', feed: 'Feed',
        service: 'Mastodon', cited_at: '2026-11-16', replyToken: { type: 'Mastodon', statusId: '123' } },
        { url: 'https://source/b', title: 'Second', author_name: 'Other', feed: 'Feed',
            service: 'Bluesky', replyToken: { type: 'Bluesky', uri: 'at://post', cid: 'cid' } }];
    refs.forEach((ref, i) => { const el = element(); el.id = 'item-' + i; el.reference = ref; root.appendChild(el); });
    let html = '';
    const tinymceEditor = { focus() {}, getContent: () => html, setContent: value => html = value,
        selection: { getContent: () => '', setContent: value => html += value,
            getRng: () => ({collapse() {}}), setRng() {} } };
    const CList = { state: {}, schemas: {}, defaults: {COLLAB:'https://collab.test', TEXCOMPILE:'https://tex.test'},
        ui: {view: {textColumn:textarea, writeEditorArea:root, referencesButton:refsButton}} };
    const ctx = vm.createContext({ window:{CList}, console, URL, structuredClone,
        document: { getElementById: id => root.querySelector('#' + id), createElement:element,
            createTextNode: text => { const el = element('span'); el.textContent = text; return el; },
            documentElement:element('html'), addEventListener() {} },
        cleanHTMLContent: value => value.replace(/<[^>]*>/g, ''), escapeHtml: value => String(value),
        authorID:'fixture-author', referenceDisplayName: ref => ref.author_name || 'Author',
        showErrorModal: message => { throw Error(message); }, tinymce: {get:()=>tinymceEditor},
    });
    for (const name of ['references', 'editors', 'tinymce', 'etherpad']) vm.runInContext(source(name), ctx);
    const maps = {};
    // Inject editor API/shared-map fakes into the real collaborative handlers' closures.
    for (const [name, variable, api] of [['collab', 'tiptapEditor', { commands: {insertContent() {}} }],
        ['latex', 'cmView', {state:{selection:{main:{from:0,to:0}}},dispatch() {},focus() {}}]]) {
        maps[name] = new Map(); ctx.testAPI = api; ctx.testMap = maps[name];
        let code = source(name);
        const registration = `editorHandlers.${name} = ${name}Handler`;
        assert.ok(code.includes(registration));
        code = code.replace(registration, registration + `; ${variable} = testAPI; sharedRefs = testMap`);
        vm.runInContext(code, ctx);
    }
    return { ctx, CList, root, refs, maps, handlers:vm.runInContext('editorHandlers',ctx),
        references:()=>ctx.getReferences(), getHTML:()=>html, textarea };
}

test('loading sources into text/HTML editors still collects deduplicated document references and reply tokens', () => {
    const f = fixture();
    f.handlers.texteditor.loadContent({type:'text/plain',value:'Text'},'item-0');
    f.handlers.tinymce.loadContent({type:'text/html',value:'<p>HTML</p>'},'item-1');
    f.handlers.tinymce.loadContent({type:'text/html',value:'<p>Again</p>'},'item-0');
    assert.equal(f.references().length,2);
    assert.deepEqual(JSON.parse(JSON.stringify(f.references())), f.refs);
    assert.match(f.root.querySelector('#clist-references-panel').textContent,/First/);
    assert.equal(f.CList.ui.view.referencesButton.style.display,'');
    assert.equal(f.root.querySelector('.currentReference'),null);
    assert.equal(f.root.querySelector('.currentReferences'),null);
    assert.equal(typeof f.ctx.displayCurrentReference,'undefined');
    assert.match(f.getHTML(),/<p>HTML<\/p>/);
});

test('insertLink and insertLinkVia retain resolved references after source rows leave the reader', () => {
    const f = fixture();
    f.root.querySelector('#item-0').remove(); f.root.querySelector('#item-1').remove();
    for (const name of ['texteditor','tinymce']) {
        f.handlers[name].insertLink({content:{type:'text/plain',value:'Quote'},entryUrl:f.refs[0].url,feedTitle:'Feed',reference:f.refs[0]});
        f.handlers[name].insertLinkVia({content:{type:'text/plain',value:'Linked quote'},linkedUrl:'https://link',linkedTitle:'Linked',entryUrl:f.refs[1].url,authorOrFeedTitle:'Author',reference:f.refs[1]});
    }
    assert.equal(f.references().length,2);
    assert.equal(f.references()[1].replyToken.cid,'cid');
    assert.equal(f.root.querySelector('.currentReference'),null);
});

test('collaborative loading/link insertion still mirrors attribution into each shared document map', () => {
    const f = fixture();
    for (const name of ['collab','latex']) {
        f.handlers[name].loadContent({type:'text/plain',value:'Quote'},'item-0');
        f.handlers[name].insertLink({content:{type:'text/plain',value:'More'},entryUrl:f.refs[1].url,feedTitle:'Feed',reference:f.refs[1]});
        assert.equal(f.maps[name].size,2);
        assert.deepEqual(JSON.parse(f.maps[name].get(f.refs[0].url)).replyToken,f.refs[0].replyToken);
        f.ctx.setReferences([]); f.handlers[name].resyncReferences();
        assert.equal(f.references().length,2);
    }
    assert.equal(f.root.querySelector('.currentReference'),null);
});

test('Etherpad guest/API loads retain document references without editor attribution blocks', async () => {
    const f = fixture();
    vm.runInContext('padName = "pad"; currentEtherpadGuestBase = "https://pad.test";',f.ctx);
    f.ctx.fetchGuestPadHtml = async () => '<p>Existing</p>';
    f.ctx.importPadViaRelay = async () => {};
    await f.handlers.etherpad.loadContent({type:'text/html',value:'<p>Quote</p>'},'item-0');
    vm.runInContext('currentEtherpadGuestBase = null;',f.ctx);
    f.ctx.callEtherpadApi = async method => method === 'getHTML' ? {html:'<p>Existing</p>'} : {};
    await f.handlers.etherpad.loadContent({type:'text/html',value:'<p>More</p>'},'item-1');
    assert.equal(f.references().length,2);
    assert.equal(f.root.querySelector('.currentReference'),null);
});


test('Write about this targets the active text/HTML editor after visiting Annotations', async () => {
    const f = fixture();
    f.ctx.window.innerWidth = 1000;
    f.ctx.window.getSelection = () => ({toString:()=>''});
    f.ctx.switchToEditor = () => { throw Error('Arrow must not switch editors'); };
    // Load the real annotation module; registration does not contact services.
    vm.runInContext(source('annotate'),f.ctx);
    f.refs[0].summary = 'Source quote';
    const annotation = {insertLink:()=>{throw Error('Inactive annotation draft must not receive text');}};
    f.handlers['annotate-edit'] = annotation;
    vm.runInContext('currentEditor = "annotate-edit";',f.ctx);
    for (const name of ['texteditor','tinymce']) {
        f.ctx.selectedEditor = name;
        vm.runInContext('currentEditor = selectedEditor;',f.ctx);
        await f.ctx.window.clistAnnotate('item-0');
        assert.equal(vm.runInContext('currentEditor',f.ctx),name);
    }
    assert.equal(f.references().length,1);
    assert.equal(f.references()[0].url,f.refs[0].url);
    assert.match(f.textarea.value,/Source quote/);
    assert.match(f.getHTML(),/Source quote/);
});

test('Write about this uses any active insertion handler, including Annotations, and reports unsupported editors', async () => {
    const f = fixture(), inserted = [], errors = [];
    f.ctx.window.innerWidth=1000;
    f.ctx.window.getSelection=()=>({toString:()=> 'Selected quote'});
    vm.runInContext(source('annotate'),f.ctx);
    f.ctx.showErrorModal=message=>errors.push(message);
    for (const name of ['annotate-edit','custom']) {
        f.handlers[name]={contentTypes:['text/html'],insertLink:input=>inserted.push({name,input})};
        f.ctx.selectedEditor=name;vm.runInContext('currentEditor = selectedEditor;',f.ctx);
        await f.ctx.window.clistAnnotate('item-0');
    }
    assert.deepEqual(inserted.map(x=>x.name),['annotate-edit','custom']);
    assert.match(inserted[0].input.content.value,/Selected quote/);
    assert.equal(inserted[0].input.reference.replyToken.statusId,'123');
    f.handlers.custom={};await f.ctx.window.clistAnnotate('item-0');
    assert.equal(errors.length,1);
});
