const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['js/collab_header_view.js','js/collab_header.js','tests/helpers/collab-header-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('collabHeaderCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
