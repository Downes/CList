const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs');const document=menuShellDocument();document.createTextNode=text=>{const node=document.createElement('span');node.textContent=text;return node;};
const ctx=vm.createContext({document,structuredClone,AggregateError,console:{error(){}}});
for(const name of ['collab_connection_view','collab_connection'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-lifecycle-fixture.js','utf8'),ctx);
for(const [name,run]of vm.runInContext('collabLifecycleCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
