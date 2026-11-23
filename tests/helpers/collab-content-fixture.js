function contentFixture() {
    let source = 1, selected = true, references = [], inserts = 0;
    const calls = [], states = [], errors = [], warnings = [], behavior = {};
    const container = document.createElement('div'), output = document.createElement('p'); container.appendChild(output); document.body.appendChild(container);
    const map = new Map(), editor = { isEditable: true, commands: { insertContent(html) {
        inserts++; calls.push(['insert',html]); if (behavior.insert) behavior.insert();
    } } };
    let currentMap = map;
    let row = { reference: { url:'https://source.invalid/a', title:'Original', replyToken:{type:'Mastodon',statusId:'42'}, extension:{kept:true} } };
    globalThis.escapeHtml = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    globalThis.showErrorModal = message => errors.push(message); globalThis.showStatusMessage = message => warnings.push(message);
    globalThis.displayReferences = node => { calls.push(['display',node]); output.textContent = references.map(ref=>ref.title).join(', '); if (behavior.display) behavior.display(); };
    const controller = createCollabContentController({
        capture: () => ({editor:behavior.missing?null:editor,map:currentMap,container,source}),
        current: target => selected && target.source === source && target.map === currentMap && container.isConnected,
        reference: id => id ? row?.reference : null,
        push(reference) { references = appendPanelReference(references, reference); calls.push(['push',reference]); if (behavior.push) behavior.push(); },
        replace(value) { references = value; calls.push(['replace']); }, state:value=>states.push(structuredClone(value))
    }, createCollabContentView());
    return {controller,map,editor,container,output,calls,states,errors,warnings,behavior,
        get row(){return row;},set row(value){row=value;},get references(){return references;},get inserts(){return inserts;},
        expire(){source++;},switch(){selected=false;},replaceMap(){currentMap=new Map();},dispose(){container.remove();} };
}
const collabContentCases = [
    ['plain text remains literal while HTML keeps existing formatting', check => {
        const f=contentFixture();check(f.controller.load({type:'text/plain',value:'<b>Literal & text</b>'}), 'plain load succeeds');
        check(f.calls[0][1]==='<p>&lt;b&gt;Literal &amp; text&lt;/b&gt;</p>', 'plain text encoded');
        check(f.controller.load({type:'text/html',value:'<p><em>HTML</em></p>'})&&f.calls.findLast(call=>call[0]==='insert')[1]==='<p><em>HTML</em></p>', 'HTML route preserved');f.dispose();
    }],
    ['source reference captured before row replacement retains identity and extensions', check => {
        const f=contentFixture(),reference=f.row.reference;f.behavior.insert=()=>{f.row={reference:{url:'https://replacement.invalid'}};};
        check(f.controller.load({type:'text/plain',value:'Quote'},'row'), 'source load succeeds');
        check(f.references[0]===reference&&f.calls.find(call=>call[0]==='push')[1]===reference, 'live reference identity retained');
        const wire=JSON.parse(f.map.get(reference.url));check(wire.replyToken.statusId==='42'&&wire.extension.kept&&!f.map.has('https://replacement.invalid'), 'structural reference and extensions mirrored into captured map');
        check(f.output.textContent==='Original'&&f.states.every(state=>Object.keys(state).sort().join()==='busy,phase'), 'view refresh and safe operation state');f.dispose();
    }],
    ['link and via exports escape plaintext/metadata and retain standalone references', check => {
        const f=contentFixture(),reference=f.row.reference;f.row=null;
        check(f.controller.link({content:{type:'text/plain',value:'<quote>'},entryUrl:'https://entry.invalid/?x="',feedTitle:'<Feed>',reference}), 'detached link quote succeeds');
        check(f.calls.find(call=>call[0]==='insert')[1]==='&lt;quote&gt; [<a href="https://entry.invalid/?x=&quot;">&lt;Feed&gt;</a>]', 'safe link serializer');
        check(f.controller.via({content:{type:'text/html',value:'<em>Quote</em>'},linkedUrl:'https://linked.invalid',linkedTitle:'<Linked>',entryUrl:'https://entry.invalid',authorOrFeedTitle:'A & B',reference}), 'via quote succeeds');
        check(f.calls.findLast(call=>call[0]==='insert')[1].includes('<em>Quote</em> [<a href="https://linked.invalid">&lt;Linked&gt;</a>, via <a href="https://entry.invalid">A &amp; B</a>]'), 'HTML and via metadata retained');
        const count=f.inserts;check(f.controller.link({content:{value:''},reference})&&f.inserts===count&&f.references.length===1, 'reference-only action and shared exact URL dedup');f.dispose();
    }],
    ['resource/source replacement during commands stops attribution and stale feedback', check => {
        for(const change of ['replaceMap','expire','switch']) {
            const f=contentFixture();f.behavior.insert=()=>f[change]();
            check(f.controller.load({value:'Old'},'row')===false&&f.references.length===0&&f.map.size===0&&f.errors.length===0, change+' rejects later effects');f.dispose();
        }
    }],
    ['reentrant callbacks cannot duplicate insertion', check => {
        const f=contentFixture();let nested;f.behavior.push=()=>{nested=f.controller.load({value:'Duplicate'},'row');};
        check(f.controller.load({value:'Once'},'row')&&nested===false&&f.inserts===1&&f.map.size===1, 'one owned insertion and reference mirror');f.dispose();
    }],
    ['missing/read-only editor prevents writes and missing source produces a warning', check => {
        const f=contentFixture();f.behavior.missing=true;check(f.controller.load({value:'No editor'})===false&&f.errors.length===1, 'missing editor visible');
        delete f.behavior.missing;f.editor.isEditable=false;check(f.controller.link({content:{value:'No write'}})===false&&f.inserts===0&&f.errors.length===2, 'read-only rejection visible');
        f.editor.isEditable=true;f.row=null;check(f.controller.load({value:'Body'},'gone')&&f.warnings.length===1&&f.inserts===1, 'missing source warns without undoing inserted body');f.dispose();
    }],
    ['map write failure reports attribution failure without reinserting content', check => {
        const f=contentFixture();f.map.set=()=>{throw Error('mirror failed');};
        check(f.controller.load({value:'Body'},'row')===false&&f.inserts===1&&f.references.length===1&&f.errors[0]==='mirror failed', 'partial operation remains visible');
        check(f.states.at(-1).phase==='error'&&!f.states.at(-1).busy&&f.calls.filter(call=>call[0]==='insert').length===1, 'error state unlocked without automatic retry');f.dispose();
    }],
    ['resync preserves valid metadata and warns without deleting corrupt shared records', check => {
        const f=contentFixture();f.map.set('good',JSON.stringify(f.row.reference));f.map.set('bad','not-json');f.map.set('null','null');
        f.controller.link({content:{value:''},reference:{url:'https://old.invalid',title:'Old'}});f.map.delete('https://old.invalid');
        check(f.controller.resync()&&f.references.length===1&&f.references[0].replyToken.statusId==='42'&&f.references[0].extension.kept, 'shared authoritative snapshot restores structural metadata');
        check(f.warnings.length===1&&f.warnings[0].includes('2 unreadable')&&f.map.size===3, 'corrupt entries retained with visible partial warning');f.dispose();
    }],
    ['failed map read preserves references and stale push stops remaining resync', check => {
        const f=contentFixture();f.controller.link({content:{value:''},reference:f.row.reference});const before=f.references;
        f.map.forEach=()=>{throw Error('read failed');};check(f.controller.resync()===false&&f.references===before&&f.errors[0]==='read failed', 'read failure before clear preserves current references');f.dispose();
        const g=contentFixture();g.map.set('one',JSON.stringify(g.row.reference));g.map.set('two',JSON.stringify({url:'https://two.invalid'}));g.behavior.push=()=>g.expire();
        check(g.controller.resync()===false&&g.references.length===1&&g.errors.length===0, 'ownership checked between pushes');g.dispose();
    }]
];
