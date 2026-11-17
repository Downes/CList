const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { Element } = require('./helpers/account-fixture.cjs');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function recognitionFixture(extra = {}) {
    const ctx = vm.createContext({TextDecoder, TextEncoder, ArrayBuffer, Uint8Array, structuredClone,
        console: {error() {}, warn() {}, log() {}}, ...extra});
    vm.runInContext(source('collection-formats'), ctx);
    vm.runInContext(source('file-recognition'), ctx);
    return ctx;
}
const annotation = () => ({format:'clist-annotation-v1', body:'<p>A note</p>',
    target:{url:'https://source',title:'Target'}, references:[{url:'https://other',title:'Other'}]});

test('collection JSON content wins over missing or deliberately wrong filename/MIME claims, including empty exports', () => {
    const ctx = recognitionFixture();
    for (const items of [[], [{url:'https://item',title:'Item',author:'Author',summary:'Summary'}]]) {
        const text = JSON.stringify({id:'urn:uuid:12345678-1234-1234-1234-123456789abc', title:'Collection', items});
        for (const [type,name] of [['','renamed'], ['application/pdf','document.xml'], ['text/plain','picture.png']]) {
            const result = ctx.recognizeSavedContent(text,type,name);
            assert.equal(result.format,'json'); assert.equal(result.collection.title,'Collection');
            assert.equal(result.collection.items.length,items.length); assert.equal(result.value,text);
            assert.equal(result.collection.id,'urn:uuid:12345678-1234-1234-1234-123456789abc');
        }
    }
});

test('unknown JSON and malformed markup stay editable as exact text, never coerced to objects or empty collections', () => {
    const ctx = recognitionFixture();
    for (const text of ['{"message":"ordinary JSON"}', '{"title":"Not a collection","items":"bad"}',
        '[1,2,3]', '{"title":"Broken","items":[', '<document><paragraph>Text</paragraph></document>',
        '<rss><channel>', 'A <tag> in a literal sentence', '']) {
        const result = ctx.recognizeSavedContent(text,'application/json','collection.xml');
        assert.equal(result.type,'text/plain'); assert.equal(result.value,text); assert.equal(result.collection,undefined);
    }
});

test('UTF-8 and UTF-16 BOM text is recognized from bytes independently of MIME claims', () => {
    const ctx = recognitionFixture();
    const text = JSON.stringify({title:'Über collection',items:[]});
    const little = Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(text,'utf16le')]);
    const big = Buffer.from(little); for (let i=0;i<big.length;i+=2) [big[i],big[i+1]]=[big[i+1],big[i]];
    const variants = [Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(text)]),little,big];
    for (const bytes of variants) {
        const result = ctx.recognizeSavedContent(bytes,'application/octet-stream','saved.bin');
        assert.equal(result.collection.title,'Über collection');
    }
});

test('binary signatures override incorrect text claims and preserve the original bytes', () => {
    const ctx = recognitionFixture();
    const cases = [
        [Buffer.from('%PDF-1.7\n'),'application/pdf'],
        [Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),'image/png'],
        [Buffer.from([0xff,0xd8,0xff,1]),'image/jpeg'],
        [Buffer.from('GIF89a\0\0'),'image/gif'],
        [Buffer.concat([Buffer.from([0x50,0x4b,3,4]),Buffer.from('ppt/presentation.xml')]),'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        [Buffer.from([0,1,2,3]),'application/octet-stream'],
    ];
    for (const [bytes,type] of cases) {
        const result = ctx.recognizeSavedContent(bytes,'text/plain','document.json');
        assert.equal(result.type,type); assert.deepEqual(Buffer.from(result.value),bytes);
    }
    assert.equal(ctx.recognizeSavedContent(Buffer.from('Actual text'),'image/png','image.png').type,'text/plain');
});

test('native slide snapshots/layouts and annotation documents use their embedded formats under arbitrary names', () => {
    const ctx = recognitionFixture();
    for (const [data,type] of [
        [{format:'clist-slides-yjs-v1',update:'AQID'},'application/vnd.clist.slides+json'],
        [{format:'clist-slide-layout-v1',id:'layout',label:'Layout',update:'AQID'},'application/vnd.clist.slide-layout+json'],
        [annotation(),'application/vnd.clist.annotation+json'],
    ]) {
        const text = JSON.stringify(data), result = ctx.recognizeSavedContent(new TextEncoder().encode(text),'application/xml','notes.txt');
        assert.equal(result.type,type);
        if (data.format==='clist-annotation-v1') {
            assert.equal(result.editor,'annotate-edit'); assert.equal(result.value.body,data.body);
            assert.deepEqual(plain(result.page.references).map(ref=>ref.url),['https://source','https://other']);
        } else assert.equal(result.value,text);
    }
});

test('recognized malformed native files reject explicitly instead of silently becoming unrelated content', () => {
    const ctx=recognitionFixture();
    for(const data of [{format:'clist-slides-yjs-v1'}, {format:'clist-slide-layout-v1',update:'AQID'},
        {...annotation(),body:42}, {...annotation(),references:[null]},
        {format:'clist-document-v1',content:{type:'image/png',value:'bad'}}]) {
        assert.throws(()=>ctx.recognizeSavedContent(JSON.stringify(data),'text/plain','file'),/Invalid CList/);
    }
});

test('native document envelope retains exact source and permits only known editor preferences', () => {
    const ctx=recognitionFixture(), value='Literal <xml> and {json}';
    const data={format:'clist-document-v1',editor:'texteditor',title:'Draft',content:{type:'text/plain',value},references:[{url:'https://ref'}]};
    const result=ctx.recognizeSavedContent(JSON.stringify(data),'application/pdf','wrong.pdf');
    assert.equal(result.editor,'texteditor');assert.equal(result.type,'text/plain');assert.equal(result.value,value);assert.equal(result.page.title,'Draft');
    assert.equal(ctx.recognizeSavedContent(JSON.stringify({...data,editor:'untrusted-account-editor'})).editor,undefined);
});

function filesFixture(extra={}) {
    const ctx=recognitionFixture({window:{CList:{state:{},ui:{view:{}},loaders:[],savers:[]}},...extra});
    vm.runInContext(source('files'),ctx);
    return ctx;
}
test('local files always read bytes before classification and carry their actual filename', async()=>{
    const ctx=filesFixture();let reads=0;
    const text=JSON.stringify(annotation()),bytes=new TextEncoder().encode(text);
    const result=await ctx.readLocalFileContent({name:'renamed.xml',type:'application/octet-stream',
        arrayBuffer:async()=>{reads++;return bytes.buffer;},text:()=>{throw Error('MIME-gated text read must not happen');}});
    assert.equal(reads,1);assert.equal(result.type,'application/vnd.clist.annotation+json');
    assert.equal(result.page.kind,'file');assert.equal(result.page.title,'renamed.xml');assert.equal(result.recognized,true);
});

function routingFixture(existing='',extra={}) {
    const events=[], choiceRoot=new Element('div'), handlers={
        texteditor:{initialize(){},contentTypes:['text/plain'],requiresAccount:false,getContent:()=>existing,loadContent:content=>events.push({loaded:'texteditor',content})},
        tinymce:{initialize(){},contentTypes:['text/html'],requiresAccount:false,getContent:()=>existing,loadContent:content=>events.push({loaded:'tinymce',content})},
        'annotate-edit':{initialize(){},contentTypes:['text/plain','text/html','application/vnd.clist.annotation+json'],requiresAccount:false,getContent:()=>existing,loadContent:content=>events.push({loaded:'annotate-edit',content})},
    };
    const ctx=recognitionFixture({window:{CList:{ui:{view:{writeTitle:{textContent:''},loadOptions:choiceRoot}}},openParsedAsCollection:async collection=>events.push({collection})},
        editorHandlers:handlers,currentEditor:'tinymce',document:{getElementById:()=>null,createElement:tag=>new Element(tag)},removeHtml:value=>String(value).replace(/<[^>]*>/g,''),
        setLoadedPage:page=>events.push({page}),setReferences:refs=>events.push({refs}),closeLoadSurfaces:()=>events.push({closed:true}),
        offerReplaceOrInsert:(key,handler,content)=>events.push({replace:key,content}),
        openRightPane(){},showErrorModal:message=>{throw Error(message);},confirm:()=>{throw Error('unexpected fallback confirmation');},...extra,
    });
    ctx.switchToEditor=async(key,content)=>{ctx.currentEditor=key;events.push({switched:key,content});};
    const file=source('editors');const start=file.indexOf('function _savedEditorIsEmpty('),end=file.indexOf('// Rendered into renderTarget',start);
    vm.runInContext(file.slice(start,end),ctx);
    const choiceStart=file.indexOf('function _offerEditorChoice('),choiceEnd=file.indexOf('// Register built-in load handlers',choiceStart);
    vm.runInContext(file.slice(choiceStart,choiceEnd),ctx);
    const offer=ctx._offerEditorChoice;
    ctx._offerEditorChoice=(keys,content,page,renderTarget,onCancel)=>{events.push({choice:keys,content,page});return offer(keys,content,page,renderTarget,onCancel);};
    const collectionOffer=ctx._offerCollectionChoice;
    ctx._offerCollectionChoice=(parsed,format,options)=>{events.push({collectionChoice:format,options});return collectionOffer(parsed,format,options);};
    const choose=async label=>{const button=choiceRoot.querySelectorAll('button').find(button=>button.textContent===label||button.textContent.endsWith(label));assert.ok(button,'choice '+label+' exists');return button.listeners.click?button.listeners.click():button.onclick();};
    return {ctx,events,handlers,choiceRoot,choose};
}
test('shared routing offers native annotation representations before using the selected editor',async()=>{
    const f=routingFixture();
    await f.ctx.loadSavedPage({type:'application/xml',value:JSON.stringify(annotation())},{kind:'file',title:'changed.xml'});
    assert.equal(f.events.some(event=>event.switched),false);
    assert.deepEqual(plain(f.events.find(event=>event.choice).choice),['annotate-edit','texteditor','tinymce']);
    await f.choose('annotate-edit');
    assert.equal(f.events.find(event=>event.switched).switched,'annotate-edit');
    assert.equal(f.events.find(event=>event.switched).content.value.body,'<p>A note</p>');
    assert.equal(f.events.find(event=>event.page).page.title,'changed.xml');
});

test('shared routing opens collection content while logged out and never asks for a MIME-matched editor',async()=>{
    const f=routingFixture();await f.ctx.loadSavedPage({type:'text/plain',value:JSON.stringify({title:'Empty saved collection',items:[]})},{kind:'file',title:'renamed'});
    assert.equal(f.events[0].collectionChoice,'json');assert.equal(f.events.some(event=>event.collection),false);
    await f.choose('list_altOpen as Collection');
    assert.equal(f.events.find(event=>event.collection).collection.title,'Empty saved collection');assert.equal(f.events.some(event=>event.choice),false);
});

test('editor representation choice precedes existing-content review and unknown JSON stays text',async()=>{
    const f=routingFixture('Existing work');
    await f.ctx.loadSavedPage({type:'application/json',value:JSON.stringify({format:'clist-document-v1',editor:'texteditor',content:{type:'text/plain',value:'New text'}})},null);
    assert.equal(f.events.some(event=>event.replace),false);await f.choose('texteditor');
    assert.equal(f.events.find(event=>event.switched).content,null);assert.equal(f.events.find(event=>event.replace).replace,'texteditor');
    const g=routingFixture();g.ctx.currentEditor='texteditor';const text='{"key":"ordinary JSON"}';
    await g.ctx.loadSavedPage({type:'application/json',value:text},null);
    await g.choose('texteditor');
    const loaded=g.events.find(event=>event.loaded);assert.equal(loaded.content.type,'text/plain');assert.equal(loaded.content.value,text);
});

test('logged-out native annotation save uses the native snapshot without KV indexing or publication packaging',async()=>{
    const writes=[],snapshot=JSON.stringify(annotation());
    const ctx=filesFixture({editorHandlers:{'annotate-edit':{getFileContent:async()=>({type:'application/vnd.clist.annotation+json',value:snapshot}),
        getContent:()=>{throw Error('body-only publication content must not replace native save');}}},
        currentEditor:'annotate-edit',currentLoadedPage:null,getReferences:()=>[],
        _saveWebPageRecord:()=>{throw Error('anonymous save must not index accounts');},
    });
    ctx._writeLocalFile=async(...args)=>writes.push(args);
    await ctx.saveContent();assert.deepEqual(writes,[[snapshot,null,'annotation.json']]);
});

class SavedNode {
    constructor(tag){this.tag=tag;this.children=[];this.text='';this.html='';}
    appendChild(child){this.children.push(child);return child;}
    set textContent(value){this.text=String(value);this.html='';}
    get textContent(){return this.text;}
    set innerHTML(value){this.html=String(value);this.text='';}
    get innerHTML(){return this.html;}
    get outerHTML(){const attrs=(this.id?' id="'+this.id+'"':'')+(this.type?' type="'+this.type+'"':'');return '<'+this.tag+attrs+'>'+(this.children.length?this.children.map(child=>child.outerHTML).join(''):this.html||this.text)+'</'+this.tag+'>';}
}
test('local document packaging embeds inert JSON metadata and publication packaging keeps its prior body structure',async()=>{
    const nodes=[],content='<p>Document</p>',refs=[{url:'https://ref',title:'</script><img onerror=bad>'}];
    const ctx=filesFixture({document:{createElement:tag=>{const node=new SavedNode(tag);nodes.push(node);return node;},getElementById:()=>({innerHTML:'<p>Reference</p>'})},
        editorHandlers:{tinymce:{getContent:async()=>content}},currentEditor:'tinymce'});
    const metadata={format:'clist-post-v1',editor:'tinymce',title:'Draft',references:refs};
    const output=await ctx.packagePost({title:'Draft',fileMetadata:metadata});
    const marker=nodes.find(node=>node.id==='clist-file-metadata');assert.ok(marker);assert.equal(marker.type,'application/json');
    assert.equal(marker.textContent.includes('<'),false);assert.deepEqual(JSON.parse(marker.textContent),{...metadata,content:{type:'text/html',value:content}});assert.match(output,/post-content/);
    nodes.length=0;await ctx.packagePost({title:'Draft',forPublishing:true});
    assert.equal(nodes.some(node=>node.id==='clist-file-metadata'),false);
});

test('both native and fallback pickers classify byte content without trusting file type',async()=>{
    const payload=JSON.stringify(annotation()),bytes=new TextEncoder().encode(payload);
    const file={name:'notes.bin',type:'',arrayBuffer:async()=>bytes.buffer};
    const modern=filesFixture({window:{CList:{state:{},ui:{view:{}},loaders:[],savers:[]},showOpenFilePicker:async()=>[{getFile:async()=>file}]}});
    assert.equal((await modern.loadFile()).type,'application/vnd.clist.annotation+json');
    const input={files:[file],click(){this.onchange();}};
    const fallback=filesFixture({document:{getElementById:()=>input}});
    assert.equal((await fallback.loadFile()).type,'application/vnd.clist.annotation+json');
});

test('actual annotation native-file API round-trips body, target and convergent references without publication calls',()=>{
    let body='<p>Original</p>',references=[{url:'https://first',title:'First',author_name:'Author'}, {url:'https://second',title:'Second'}];
    const textarea={value:body};
    const handlers={};
    const ctx=vm.createContext({window:{CList:{state:{}},sanitizeHtml:html=>html},editorHandlers:handlers,structuredClone,
        console:{error(){}},document:{getElementById:id=>id==='annotate-edit-body'?textarea:null},
        tinymce:{get:()=>({getContent:()=>body,setContent:value=>{body=value;}})},
        getReferences:()=>references,setReferences:value=>{references=value;},
        escapeHtml:value=>String(value).replaceAll('<','&lt;'),cleanHTMLContent:value=>value,
    });
    vm.runInContext(source('annotate-editor'),ctx);
    const saved=handlers['annotate-edit'].getFileContent();
    assert.equal(saved.type,'application/vnd.clist.annotation+json');
    const snapshot=JSON.parse(saved.value);assert.equal(snapshot.body,'<p>Original</p>');
    assert.equal(snapshot.target.url,'https://first');assert.equal(snapshot.references.length,2);
    body='newer body';references=[];
    handlers['annotate-edit'].setContent(snapshot);
    assert.equal(body,'<p>Original</p>');assert.equal(textarea.value,body);
    assert.deepEqual(plain(references).map(ref=>ref.url),['https://first','https://second']);
    assert.equal(handlers['annotate-edit'].getContent(),'<p>Original</p>');
    handlers['annotate-edit'].setContent({...snapshot,body:'<p>Standalone</p>',target:{title:'No URL'},references:[]});
    const standalone=JSON.parse(handlers['annotate-edit'].getFileContent().value);
    assert.equal(standalone.target.title,'No URL');assert.equal(standalone.references.length,0);
});

test('parked collection drafts require explicit Open collection approval and Cancel leaves them intact',async()=>{
    const f=routingFixture(),dialogs=[];
    let draft='[{"title":"Unsaved work","url":"https://draft"}]', closed=0;
    f.handlers.collection={getContent:async()=>draft};
    f.ctx.document.createElement=tag=>new Element(tag);
    f.ctx.buildDialogModal=(title,message,buttons)=>dialogs.push({title,message,buttons});
    const content={type:'application/json',value:JSON.stringify({title:'Incoming',items:[]})};
    await f.ctx.loadSavedPage(content,{kind:'file',title:'incoming.xml'});
    assert.equal(f.ctx.currentEditor,'tinymce');assert.equal(dialogs.length,0);
    await f.choose('list_altOpen as Collection');assert.equal(dialogs.length,1);
    assert.equal(f.events.some(event=>event.collection),false);
    dialogs[0].buttons.find(button=>button.label==='Cancel').onClick(()=>closed++);
    assert.equal(closed,1);assert.equal(draft,'[{"title":"Unsaved work","url":"https://draft"}]');
    assert.equal(f.events.some(event=>event.collection),false);
    await f.ctx.loadSavedPage(content,{kind:'file',title:'incoming.xml'});
    await f.choose('list_altOpen as Collection');
    await dialogs[1].buttons.find(button=>button.label==='Open collection').onClick(()=>closed++);
    assert.equal(closed,2);assert.equal(f.events.filter(event=>event.collection).length,1);
    assert.equal(f.events.find(event=>event.collection).collection.title,'Incoming');
});

test('empty parked collection editor opens recognized collections without a replacement dialog',async()=>{
    const f=routingFixture();f.handlers.collection={getContent:()=>''};
    f.ctx.buildDialogModal=()=>{throw Error('empty collection must not need replacement approval');};
    await f.ctx.loadSavedPage({type:'application/octet-stream',value:JSON.stringify({title:'Empty incoming',items:[]})},null);
    assert.equal(f.events.some(event=>event.collection),false);await f.choose('list_altOpen as Collection');
    assert.equal(f.events.find(event=>event.collection).collection.title,'Empty incoming');
});

test('marked Markdown and text collection exports round-trip empty/nonempty collections under misleading names',()=>{
    const ctx=recognitionFixture(),formats=vm.runInContext('collectionFormats',ctx);
    const id='urn:uuid:12345678-1234-1234-1234-123456789abc';
    for(const format of ['md','text']) for(const items of [[],[{title:'Saved item',url:'https://item/path',author_name:'An Author'}]]) {
        const text=formats[format].serialize('Saved collection',items,id);
        const result=ctx.recognizeSavedContent(new TextEncoder().encode(text),'image/png','renamed.xml');
        assert.equal(result.format,format);assert.equal(result.explicitCollection,true);
        assert.equal(result.collection.title,'Saved collection');assert.equal(result.collection.id,id);
        assert.deepEqual(plain(result.collection.items),items);assert.equal(result.value,text);
    }
});

test('unmarked Markdown and plain link lists remain documents rather than guessed collections',()=>{
    const ctx=recognitionFixture();
    for(const text of ['# My document\n\n- [A link](https://item)\n','A document\n==========\n\nA link\nhttps://item\n']) {
        const result=ctx.recognizeSavedContent(text,'text/x-opml','collection.opml');
        assert.equal(result.collection,undefined);assert.equal(result.value,text);assert.equal(result.type,'text/plain');
    }
});

test('choosing Collection for ambiguous HTML still reviews a parked draft before opening it',async()=>{
    const f=routingFixture(),choices=[],dialogs=[];
    const parked='[{"title":"Parked draft","url":"https://draft"}]';
    f.handlers.collection={getContent:()=>parked};
    f.ctx.document.createElement=tag=>new Element(tag);
    f.ctx._offerCollectionChoice=(parsed,format,options)=>choices.push({parsed,format,options});
    f.ctx.buildDialogModal=(title,message,buttons)=>dialogs.push({title,message,buttons});
    const incoming={title:'HTML list',items:[{url:'https://incoming',title:'Incoming'}]};
    const content={recognized:true,type:'text/html',value:'<ul><li><a href="https://incoming">Incoming</a></li></ul>',collection:incoming,format:'html'};
    await f.ctx.loadSavedPage(content,{kind:'file',title:'renamed.json'});
    assert.equal(choices.length,1);assert.equal(dialogs.length,0);assert.equal(f.events.some(event=>event.collection),false);
    await choices[0].options.onNative();
    assert.equal(f.events.find(event=>event.loaded).loaded,'tinymce');
    assert.equal(f.handlers.collection.getContent(),parked);assert.equal(f.events.some(event=>event.collection),false);
    await choices[0].options.onCollection();
    assert.equal(dialogs.length,1);assert.equal(f.events.some(event=>event.collection),false);
    dialogs[0].buttons.find(button=>button.label==='Cancel').onClick(()=>{});
    assert.equal(f.handlers.collection.getContent(),parked);assert.equal(f.events.some(event=>event.collection),false);
    await choices[0].options.onCollection();
    await dialogs[1].buttons.find(button=>button.label==='Open collection').onClick(()=>{});
    assert.equal(f.events.filter(event=>event.collection).length,1);
    assert.equal(f.events.find(event=>event.collection).collection.title,'HTML list');
});


test('RSS identity and creator use namespace/local name and ignore nested item identities', () => {
    const id='urn:uuid:11111111-1111-4111-8111-111111111111';
    for (const prefix of ['dc','metadata']) {
        const identifier={localName:'identifier',namespaceURI:'http://purl.org/dc/elements/1.1/',prefix,textContent:id};
        const channel={localName:'channel',children:[identifier]};
        const item={children:[{localName:'creator',namespaceURI:identifier.namespaceURI,prefix,textContent:'Author'}],
            querySelector:selector=>selector==='title'?{textContent:'Item'}:selector==='link'?{textContent:'https://item'}:null};
        const ctx=recognitionFixture({DOMParser:class { parseFromString(){return {
            documentElement:{localName:'rss'},querySelector:selector=>selector==='channel'?channel:null,
            querySelectorAll:selector=>selector==='item'?[item]:[],
        };} }});
        const parsed=ctx._parseCollectionRSS('<rss/>');
        assert.equal(parsed.id,id);assert.equal(parsed.items[0].author_name,'Author');
        identifier.namespaceURI='https://unrelated.invalid/';
        assert.equal(ctx._parseCollectionRSS('<rss/>').id,undefined);
    }
});

// A deliberately small DOM adapter for routing fixtures; XML/HTML parser validity
// is covered by the real-browser fixture, not by this simulated tree.
class RoutingFixtureDOMParser {
    parseFromString(markup) {
        const tree=new Element('document');tree.innerHTML=markup;
        const namespace=(markup.match(/xmlns:dc="([^"]+)"/)||[])[1];
        function decorate(node) {
            node.localName=node.tagName.split(':').at(-1);
            node.namespaceURI=node.tagName.startsWith('dc:')?namespace:null;
            for(const child of node.children)decorate(child);
            if(node.id){const match=markup.match(new RegExp('<div id="'+node.id+'">([\\s\\S]*?)</div>'));if(match)Object.defineProperty(node,'innerHTML',{get:()=>match[1]});}
        }
        decorate(tree);
        const select=selector=>{
            for(const branch of selector.split(',')){
                const parts=branch.trim().split('>').map(part=>part.trim());
                let nodes=tree.querySelectorAll(parts[0]);
                for(const part of parts.slice(1))nodes=nodes.flatMap(node=>node.children.filter(child=>child.tagName===part));
                if(nodes[0])return nodes[0];
            }
            return null;
        };
        return {documentElement:tree.children[0],querySelector:select,querySelectorAll:selector=>tree.querySelectorAll(selector)};
    }
}

test('legacy annotation fixture always offers Text/HTML/Annotation before asking about an existing draft',async()=>{
    const raw=fs.readFileSync('tests/fixtures/legacy-annotation.html','utf8');
    const f=routingFixture('Existing draft',{DOMParser:RoutingFixtureDOMParser});
    for(const chosen of ['annotate-edit','tinymce','texteditor']){
        const start=f.events.length;
        await f.ctx.loadSavedPage({type:'text/plain',value:raw},{kind:'file',title:'content(9).txt'});
        const events=f.events.slice(start),choice=events.find(event=>event.choice);
        assert.ok(choice,'representation choice is shown on each load');
        assert.deepEqual(new Set(plain(choice.choice)),new Set(['texteditor','tinymce','annotate-edit']));
        assert.equal(events.some(event=>event.replace),false,'editor draft question follows representation choice');
        await f.choose(chosen);
        assert.equal(f.events.filter(event=>event.replace).at(-1).replace,chosen);
        assert.equal(f.events.filter(event=>event.replace).at(-1).content.type,chosen==='texteditor'?'text/plain':chosen==='annotate-edit'?'application/vnd.clist.annotation+json':'text/html');
        if(chosen==='annotate-edit'){
            const native=f.events.filter(event=>event.replace).at(-1).content.value;
            assert.equal(native.target.title,'OK');assert.match(native.body,/Stephen Downes wrote/);
        }
    }
});

test('RSS fixture repeatedly offers Collection or plain text and text preserves the whole XML outside the collection editor',async()=>{
    const raw=fs.readFileSync('tests/fixtures/saved-collection.xml','utf8');
    const f=routingFixture('',{DOMParser:RoutingFixtureDOMParser});
    f.handlers.collection={initialize(){},contentTypes:[],requiresAccount:false,getContent:()=>''};
    f.ctx.currentEditor='collection';
    for(let attempt=0;attempt<2;attempt++){
        const start=f.events.length;
        await f.ctx.loadSavedPage({type:'application/xml',value:raw},{kind:'file',title:'OK.xml'});
        assert.equal(f.events.slice(start).find(event=>event.collectionChoice).collectionChoice,'rss');
        const labels=f.choiceRoot.querySelectorAll('button').map(button=>button.textContent);
        assert.ok(labels.some(label=>label.includes('Open as Collection')));assert.ok(labels.some(label=>label.includes('Open as plain text')));
        await f.choose('Open as plain text');
        const result=f.events.slice(start).find(event=>event.switched?.length&&event.content)||f.events.slice(start).find(event=>event.loaded);
        assert.ok(result,'text content loads into a working text editor');assert.equal(result.content.type,'text/plain');assert.equal(result.content.value,raw);
        assert.equal(f.ctx.currentEditor,'texteditor');assert.equal(f.events.some(event=>event.collection),false);
    }
});

test('literal XML-only text drafts are reviewed after Text is chosen, never treated as empty HTML',async()=>{
    const f=routingFixture('<existing/>');f.ctx.currentEditor='texteditor';
    await f.ctx.loadSavedPage({type:'text/plain',value:'New literal text'},null);
    assert.ok(f.events.find(event=>event.choice));assert.equal(f.events.some(event=>event.replace),false);
    await f.choose('texteditor');
    assert.equal(f.events.find(event=>event.replace).replace,'texteditor');
    assert.equal(f.events.some(event=>event.loaded),false);
});


test('legacy quoted citations recover source URL and author but do not invent missing feed names',()=>{
    const ctx=recognitionFixture();
    const url='https://github.com/Downes/CList/commit/acb80ebc20103a90face67fb7fb2fb6fc741ef6f';
    const anchor={textContent:'Stephen Downes',getAttribute:()=>url};
    const paragraph={textContent:'Stephen Downes wrote: "Saved quote" [Stephen Downes]',querySelectorAll:()=>[anchor]};
    const post={querySelectorAll:()=>[paragraph]};
    const refs=ctx._recognitionLegacyCitations(post,'OK');
    assert.deepEqual(plain(refs),[{title:'OK',url,author_name:'Stephen Downes'}]);
    assert.equal(refs[0].feed,undefined,'file contains no feed name to recover');
    paragraph.textContent='An ordinary paragraph with a link to Stephen Downes';
    assert.equal(ctx._recognitionLegacyCitations(post,'OK').length,0);
    paragraph.textContent='Stephen Downes wrote: "Quote" [Stephen Downes]';
    anchor.getAttribute=()=> 'javascript:bad()';assert.equal(ctx._recognitionLegacyCitations(post,'OK').length,0);
});
