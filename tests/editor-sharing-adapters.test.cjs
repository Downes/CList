const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
function getter(path,context,method=false){const line=fs.readFileSync(path,'utf8').split(/\r?\n/).find(line=>line.includes(method?'getSharing()':'getSharing:'));const code=method?line.trim().replace(/^getSharing/,'function').replace(/,$/,''):line.trim().slice('getSharing: '.length).replace(/,$/,'');return vm.runInNewContext('('+code+')',context)}
test('actual Collab sharing adapter exposes owned documents and rejects local resources',()=>{
 let owned=false;const target={docId:'namespace/one',server:'wss://shared.invalid',title:'Title'},context={connectionLifecycle:{owned:()=>owned},currentDocId:target.docId,captureShareTarget:()=>target,shareDependencies:()=>({contextCurrent:()=>owned})}
 const get=getter('js/collab.js',context);assert.equal(get(),null);owned=true;const shared=get();assert.equal(shared.docId,target.docId);assert.equal(shared.current(),true);owned=false;assert.equal(shared.current(),false)
})
test('actual Etherpad adapter exposes selected pads and expires replacements',()=>{
 const owner={controller:{active:()=>true}},context={_etherpadConnection:owner,padName:'one',currentEtherpadGuestBase:'https://pad.invalid',currentEtherpadAccount:null,etherpadPadUrl:pad=>'https://pad.invalid/p/'+pad,URL}
 const get=getter('js/etherpad.js',context,true),source=get();assert.equal(source.links.edit,'https://pad.invalid/p/one');context.padName='two';assert.equal(source.current(),false);context.padName='';assert.equal(get(),null)
})
test('actual Slides resource shares known remote identity before first sync and checks session',()=>{
 const provider={},doc={},source={docId:'namespace/slides',server:'wss://shared.invalid',owner:provider,document:doc,session:{}},context={sharingResource:source,provider,doc,connected:false,options:{sessionCurrent:()=>true}}
 const get=getter('slides/clist-slides-poc/src/editor.js',context,true),target=get();assert.ok(target);assert.equal(target.docId,source.docId);assert.equal(target.current(),true)
 context.options.sessionCurrent=()=>false;assert.equal(target.current(),false);assert.equal(get(),null)
})
