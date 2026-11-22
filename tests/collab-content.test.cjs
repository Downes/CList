const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['js/references-state.js','js/collab_content_workflow.js','js/collab_content_view.js','js/collab_content.js','tests/helpers/collab-content-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('collabContentCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
