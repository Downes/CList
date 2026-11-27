const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const root = new Element(), errors = [], notices = [], bodies = {}, stored = new Map();
    for (const id of ['editor-instructions', 'write-format', 'write-tags', 'write-title-row', 'editor-menu', 'editor-status', 'mount']) {
        const el = new Element(); el.id = id; root.appendChild(el);
    }
    let references = [], page = null, draft;
    const ctx = vm.createContext({ structuredClone, console: { log() {}, error() {} },
        currentEditor: 'texteditor', currentEditorAccount: null, currentLoadedPage: null, pendingContent: null,
        EDITOR_TEST_VERSION: 'fixture', editorHandlers: {},
        window: { CList: { state: {}, accounts: [], keys: {EDITOR_DRAFT_PREFIX: 'clist_draft_'}, ui: {view: {writePaneContent: root.querySelector('#mount')}} } },
        document: {getElementById: id => root.querySelector('#' + id), createElement: tag => new Element(tag)},
        getReferences: () => references, setReferences: value => references = value,
        setLoadedPage: value => { page = value; ctx.currentLoadedPage = value; },
        closeReferencesPanel() {}, setupEditorButtons() {}, closeRightPane() {}, openRightInterface() {},
        showErrorModal: message => errors.push(message), showStatusMessage: message => notices.push(message),
        parseAccountValue: account => { try { return JSON.parse(account.value); } catch { return null; } },
        sessionStorage: {getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key)},
        makeEditorButton(label, icon, select) { const button = new Element('button'); button.textContent = label; button.onclick = select; return button; },
        buildDialogModal(title, message, buttons) { draft = buttons; },
    });
    for (const name of ['editor-state', 'editor-switch-view', 'editor-switch']) vm.runInContext(fs.readFileSync(`js/${name}.js`, 'utf8'), ctx);
    function handler(key, extra = {}) {
        bodies[key] = '';
        return ctx.editorHandlers[key] = {label: key, contentTypes: ['text/plain'],
            initialize: async () => { ctx.currentEditor = key; await ctx.loadPredefinedContent(key); },
            getContent: () => bodies[key], setContent: value => { bodies[key] = value; },
            loadContent: content => { bodies[key] += content.value; }, ...extra};
    }
    handler('texteditor'); handler('tinymce');
    const choose = label => {
        const button = root.querySelector('#editor-switch-options').querySelectorAll('button').find(el => el.textContent === label);
        assert.ok(button, 'button ' + label); return button.onclick();
    };
    return { ctx, root, errors, notices, bodies, stored, handler, choose,
        refs: () => references, page: () => page, draft: () => draft,
        seed(page, refs) { ctx.setLoadedPage(page); ctx.setReferences(refs); } };
}

test('pure switch state snapshots metadata without DOM, account credentials or input mutation', () => {
    const ctx = vm.createContext({structuredClone}); vm.runInContext(fs.readFileSync('js/editor-state.js', 'utf8'), ctx);
    const first = ctx.beginEditorSwitch(null, 'texteditor'), refs = [{url:'a', replyToken:{id:'1'}}];
    const parked = ctx.parkEditorMetadata(first, 'texteditor', {kind:'file',title:'A'}, refs);
    refs[0].replyToken.id = 'changed';
    assert.equal(first.parked.texteditor, undefined);
    assert.equal(parked.parked.texteditor.references[0].replyToken.id, '1');
    const next = ctx.beginEditorSwitch(parked, 'tinymce');
    assert.equal(ctx.transitionEditorSwitch(next, first.id, 'complete'), next);
    const restored = ctx.restoredEditorMetadata(next, 'texteditor'); restored.references.length = 0;
    assert.equal(next.parked.texteditor.references.length, 1);
});

test('two accounts on one editor retain separate pages/references and live docs resync', async () => {
    const f = fixture(), a = {key:'a',value:'{"type":"Etherpad","secret":"private"}'}, b = {...a,key:'b'};
    f.handler('etherpad', {requiresAccount:true});
    await f.ctx.switchToEditor('etherpad', null, a); f.seed({title:'A'}, [{url:'a'}]);
    await f.ctx.switchToEditor('etherpad', null, b); assert.deepEqual(plain(f.refs()), []); f.seed({title:'B'}, [{url:'b'}]);
    await f.ctx.switchToEditor('etherpad', null, a);
    assert.equal(f.page().title,'A'); assert.equal(f.refs()[0].url,'a');
    let resynced = 0;
    f.handler('collab', {getDocId:()=> 'live', resyncReferences:()=>{resynced++;f.ctx.setReferences([{url:'live'}]);}});
    await f.ctx.switchToEditor('collab'); assert.equal(resynced,1); assert.equal(f.refs()[0].url,'live');
    assert.equal(JSON.stringify(f.ctx.window.CList.state).includes('private'),false);
});

for (const mode of ['Overwrite', 'Insert', "Don't transfer", 'Cancel']) {
    test('real transfer view/controller: ' + mode, async () => {
        const f = fixture();
        await f.ctx.switchToEditor('tinymce'); f.seed({title:'Destination'}, [{url:'shared'}, {url:'dest'}]); f.bodies.tinymce = 'Destination';
        await f.ctx.switchToEditor('texteditor'); f.seed({title:'Source'}, [{url:'shared',replyToken:{id:'reply'}}, {url:'source'}]); f.bodies.texteditor = 'Source';
        await f.ctx._switchToEditorFromPicker('tinymce');
        const button = f.root.querySelector('#editor-switch-options').querySelectorAll('button').find(el=>el.textContent===mode);
        await button.onclick(); await button.onclick();
        assert.equal(f.ctx.currentEditor,mode==='Cancel'?'texteditor':'tinymce');
        assert.equal(f.bodies.tinymce,mode==='Overwrite'?'Source':mode==='Insert'?'DestinationSource':'Destination');
        if (mode==='Overwrite') assert.deepEqual(plain(f.refs()),[{url:'shared',replyToken:{id:'reply'}},{url:'source'}]);
        if (mode==='Insert') assert.deepEqual(plain(f.refs()).map(ref=>ref.url),['shared','dest','source']);
        if (mode==="Don't transfer") assert.deepEqual(plain(f.refs()),[{url:'shared'},{url:'dest'}]);
        assert.equal(f.page().title,mode==='Cancel'?'Source':'Destination');
    });
}

test('old transfer buttons and delayed account lists are invalidated by newer navigation', async () => {
    const f = fixture(); f.bodies.texteditor='Source'; await f.ctx._switchToEditorFromPicker('tinymce');
    const old = f.root.querySelector('#editor-switch-options').querySelectorAll('button')[0];
    await f.ctx.switchToEditor('texteditor'); await old.onclick(); assert.equal(f.ctx.currentEditor,'texteditor');
    let finish; f.ctx.isRegistered=()=>true; f.ctx.ensureAccountsLoaded=()=>new Promise(resolve=>finish=resolve);
    f.handler('etherpad',{requiresAccount:true});
    f.ctx.window.CList.accounts=[{key:'a',value:'{"type":"Etherpad","title":"Old","permissions":["e"]}'}];
    const opening=f.ctx.playEditorSwitch(); f.ctx.closeEditorSwitchOverlay(); finish(); await opening;
    assert.equal(f.root.querySelector('#editor-switch-account-options').children.length,0);
});

test('serialized mounts cannot consume another target body or park source metadata under the wrong editor', async () => {
    const f = fixture(); let finish, started = false;
    f.seed({title:'Source'},[{url:'source'}]);
    f.handler('slow',{initialize:async()=>{started=true; f.ctx.currentEditor='slow'; if (!finish) await new Promise(resolve=>finish=resolve); await f.ctx.loadPredefinedContent('slow');}});
    f.handler('last');
    const slow=f.ctx.switchToEditor('slow',{type:'text/plain',value:'Slow body'}); await tick(); assert.equal(started,true);
    const last=f.ctx.switchToEditor('last',{type:'text/plain',value:'Last body'});
    assert.equal(f.bodies.last,''); finish(); assert.equal(await slow,false); assert.equal(await last,true);
    assert.equal(f.bodies.slow,'Slow body'); assert.equal(f.bodies.last,'Last body');
    assert.equal(f.ctx.currentEditor,'last'); assert.deepEqual(plain(f.refs()),[]);
    await f.ctx.switchToEditor('slow'); assert.deepEqual(plain(f.refs()),[]);
    await f.ctx.switchToEditor('texteditor'); assert.equal(f.page().title,'Source'); assert.equal(f.refs()[0].url,'source');
});

test('mount failures preserve source identity and retained content is only delivered to its intended target', async () => {
    const f = fixture(); f.handler('broken',{initialize:()=>{f.ctx.currentEditor='broken'; throw Error('Mount failed');}});
    assert.equal(await f.ctx.switchToEditor('broken',{type:'text/plain',value:'Private body'}),false);
    assert.equal(f.ctx.currentEditor,'texteditor'); assert.equal(f.errors[0],'Mount failed');
    assert.equal(f.ctx.pendingContent.value,'Private body');
    await f.ctx.switchToEditor('tinymce'); assert.equal(f.bodies.tinymce,''); assert.equal(f.ctx.pendingContent,null);
    assert.equal(JSON.stringify(f.ctx.window.CList.state).includes('Private body'),false);
});

test('draft restore uses captured editor and references, applies once and discard removes both records', async () => {
    const f=fixture(); f.seed(null,[{url:'draft',replyToken:{id:'1'}}]); f.ctx.saveDraft('texteditor','Saved');
    await f.ctx.offerDraftRestore('texteditor','text/plain'); const restore=f.draft()[1];
    await restore.onClick(()=>{}); await restore.onClick(()=>{});
    assert.equal(f.bodies.texteditor,'Saved'); assert.equal(f.refs()[0].replyToken.id,'1');
    await f.ctx.offerDraftRestore('texteditor','text/plain'); await f.draft()[0].onClick(()=>{});
    assert.equal(f.stored.size,0);
});

test('draft choices cannot overwrite a newer body, switch or saved record; corrupt references are visible', async () => {
    const f=fixture(); f.ctx.saveDraft('texteditor','Saved');
    await f.ctx.offerDraftRestore('texteditor','text/plain'); f.bodies.texteditor='New'; await f.draft()[1].onClick(()=>{});
    assert.equal(f.bodies.texteditor,'New'); assert.equal(f.notices.length,1);
    await f.ctx.offerDraftRestore('texteditor','text/plain'); const old=f.draft()[1]; await f.ctx.switchToEditor('tinymce'); await old.onClick(()=>{});
    assert.equal(f.bodies.tinymce,'');
    await f.ctx.switchToEditor('texteditor'); await f.ctx.offerDraftRestore('texteditor','text/plain');
    f.ctx.saveDraft('texteditor','New saved'); await f.draft()[1].onClick(()=>{}); assert.equal(f.bodies.texteditor,'New');
    f.stored.set('clist_draft_texteditor_refs','{bad'); await f.ctx.offerDraftRestore('texteditor','text/plain'); await f.draft()[1].onClick(()=>{});
    assert.equal(f.errors.length,1); assert.equal(f.bodies.texteditor,'New');
});

test('queued body capture is detached and rejected delivery cannot complete initialization', async () => {
    const f=fixture(); let fail=true;
    f.handler('target',{loadContent:content=>{if(fail)throw Error('Delivery failed');f.bodies.target=content.value;}});
    const content={type:'text/plain',value:'Captured'};
    const result=f.ctx.switchToEditor('target',content); content.value='Mutated';
    assert.equal(await result,false); assert.equal(f.ctx.window.CList.state.editorSwitching.phase,'failed');
    assert.equal(f.ctx.currentEditor,'texteditor'); assert.equal(f.ctx.pendingContent.value,'Captured');
    assert.deepEqual(f.errors,['Delivery failed']); fail=false;
    assert.equal(await f.ctx.switchToEditor('target'),true); assert.equal(f.bodies.target,'Captured');
});

test('account reinitialization retains its identity and corrupt accounts never reach a handler', async () => {
    const f=fixture(), seen=[];
    f.handler('account',{requiresAccount:true, initialize: data=>{seen.push(data);f.ctx.currentEditor='account';}});
    const account={key:'a',value:'{"type":"Account","permissions":["e"]}'};
    await f.ctx.switchToEditor('account',null,account); await f.ctx.initializeEditor('account');
    assert.equal(f.ctx.currentEditorAccount.key,'a'); assert.equal(seen.length,2);
    assert.equal(await f.ctx.switchToEditor('account',null,{key:'bad',value:'bad'}),false);
    assert.equal(seen.length,2); assert.equal(f.ctx.currentEditorAccount.key,'a'); assert.equal(f.errors.length,1);
});

test('service targets offer only supported transfer actions and a new file load expires draft choices', async () => {
    const f=fixture(); delete f.ctx.editorHandlers.tinymce.setContent;
    f.bodies.texteditor='Source'; await f.ctx._switchToEditorFromPicker('tinymce');
    assert.deepEqual(f.root.querySelector('#editor-switch-options').querySelectorAll('button').map(el=>el.textContent),['Insert',"Don't transfer",'Cancel']);
    f.ctx.saveDraft('texteditor','Saved'); await f.ctx.offerDraftRestore('texteditor','text/plain');
    f.ctx.window.CList.state.editorLoading={id:1}; await f.draft()[1].onClick(()=>{});
    assert.equal(f.bodies.texteditor,'Source');
});

test('failed mounting restores source visibility and toolbar controls with their callbacks', async () => {
    const f=fixture(), mount=f.root.querySelector('#mount'), menu=f.root.querySelector('#editor-menu');
    const source=new Element(), control=new Element('button'); source.style.display='block'; mount.appendChild(source);
    let clicked=false; control.onclick=()=>clicked=true; menu.appendChild(control); menu.style.display='block';
    f.root.querySelector('#write-tags').style.display='none';
    const partial=new Element();
    f.handler('broken',{initialize:()=>{partial.style.display='block';mount.appendChild(partial);throw Error('Mount failed');}});
    await f.ctx.switchToEditor('broken');
    assert.equal(source.style.display,'block'); assert.equal(partial.style.display,'none');
    assert.equal(f.root.querySelector('#write-tags').style.display,'none');
    assert.equal(menu.style.display,'block'); menu.children[0].onclick(); assert.equal(clicked,true);
});

test('Load blank does not clear another editor after a failed or superseded switch', async () => {
    const f=fixture();
    for(const name of ['editor-controls-state','editor-controls-view','editor-controls']) vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),f.ctx);
    f.seed({title:'Source'},[{url:'source'}]); f.bodies.texteditor='Keep';
    f.ctx.switchToEditor=async()=>false;
    f.ctx.clearReferences=()=>{throw Error('Must not clear references');};
    await f.ctx._doLoadBlank('tinymce');
    assert.equal(f.bodies.texteditor,'Keep'); assert.equal(f.ctx.currentLoadedPage.title,'Source'); assert.equal(f.refs()[0].url,'source');
});

test('a switch superseded during account-list refresh reports false to its loading caller', async () => {
    const f=fixture(); let finish, count=0;
    f.ctx.isRegistered=()=>true;
    f.ctx.ensureAccountsLoaded=()=> ++count===1 ? new Promise(resolve=>finish=resolve) : Promise.resolve();
    const first=f.ctx.switchToEditor('tinymce'); await tick(); assert.equal(count,1);
    const second=f.ctx.switchToEditor('texteditor'); finish();
    assert.equal(await first,false); assert.equal(await second,true);
    assert.equal(f.ctx.currentEditor,'texteditor'); assert.equal(f.ctx.window.CList.state.editorSwitching.phase,'complete');
});


test('library dependency resolves before mount; a changed session rejects a pending mount', async () => {
    for (const expire of [false, true]) {
        const f = fixture(); f.ctx.window.CList.config = {flaskSiteUrl:'https://store.invalid'};
        let finish, mounted = 0;
        f.handler('rich', {loadDependencies: () => new Promise(resolve => {finish = resolve;}), initialize: () => {mounted++; f.ctx.currentEditor = 'rich';}});
        const pending = f.ctx.mountEditor('rich', null);
        assert.equal(mounted, 0);
        if (expire) f.ctx.window.CList.state.authEpoch = 1;
        finish();
        assert.equal(await pending, !expire);
        assert.equal(mounted, expire ? 0 : 1);
    }
});
test('failed library load gives visible error without changing source and can be retried', async () => {
    const f = fixture(); f.ctx.window.CList.config = {flaskSiteUrl:'https://store.invalid'};
    const target = f.handler('rich', {loadDependencies: async () => {throw Error('Library unavailable');}});
    assert.equal(await f.ctx.mountEditor('rich', null), false);
    assert.equal(f.ctx.currentEditor, 'texteditor'); assert.match(String(f.errors[0]), /Library unavailable/);
    target.loadDependencies = async () => {};
    assert.equal(await f.ctx.mountEditor('rich', null), true);
});
