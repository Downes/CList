const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs');const ctx=vm.createContext({document:menuShellDocument(),structuredClone,AggregateError,console:{error(){}}});
for(const name of ['collab_format_view','collab_format'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-format-fixture.js','utf8'),ctx);
for(const[name,run]of vm.runInContext('collabFormatCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
