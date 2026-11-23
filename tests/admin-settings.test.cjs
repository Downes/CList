const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const ctx=vm.createContext({window:{CList:{ui:{}}},document:{createElement:tag=>new Element(tag)},URL,setTimeout,console:{error(){}},fixtureAttach:r=>{r.isConnected=true;},fixtureDetach:r=>{r.isConnected=false;}});
for(const name of ['admin-settings-apps','admin-settings-workflow','admin-settings-view','admin-settings'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx,{filename:name+'.js'});
vm.runInContext(fs.readFileSync('tests/helpers/admin-settings-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('adminSettingsCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
