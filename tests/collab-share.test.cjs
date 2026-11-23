const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');const ctx=vm.createContext({document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['collab_share_requests','collab_share_view','collab_share'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-share-fixture.js','utf8'),ctx);
for(const[name,run]of vm.runInContext('collabShareCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
test('shared clipboard helper keeps default feedback and suppresses expired completion',async()=>{
    const events=[];let resolve,reject,current=true;const gate=()=>new Promise((yes,no)=>{resolve=yes;reject=no;});
    const context=vm.createContext({window:{CList:{ui:{}}},navigator:{clipboard:{writeText:()=>gate()}},showStatusMessage:value=>events.push(value),showErrorModal:value=>events.push(value)});
    const source=fs.readFileSync('js/ui.js','utf8'),start=source.indexOf('window.CList.ui.copyToClipboard ='),end=source.indexOf('window.copyToClipboard =',start);
    vm.runInContext(source.slice(start,end),context);const copy=context.window.CList.ui.copyToClipboard;
    const first=copy('captured',{isCurrent:()=>current});current=false;resolve();await first;assert.equal(events.length,0);
    const failed=copy('captured',{isCurrent:()=>false});reject(Error('clipboard failed'));await failed;assert.equal(events.length,0);
    const normal=copy('captured');resolve();await normal;assert.equal(events[0],'Copied to clipboard.');
});
