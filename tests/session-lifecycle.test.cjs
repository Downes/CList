const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const ctx=vm.createContext({window:{CList:{ui:{}},addEventListener(){}},document:{createElement:tag=>new Element(tag)},setTimeout,Date,console:{error(){}},fixtureAttach:r=>{r.isConnected=true;},fixtureDetach:r=>{r.isConnected=false;}});
for(const name of ['session-lifecycle-workflow','session-lifecycle-view','session-lifecycle'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/session-lifecycle-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('lifecycleCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
