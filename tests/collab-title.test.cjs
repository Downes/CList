const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');const ctx=vm.createContext({document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['collab_title_requests','collab_title_view','collab_title'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-title-fixture.js','utf8'),ctx);
for(const[name,run]of vm.runInContext('collabTitleCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
