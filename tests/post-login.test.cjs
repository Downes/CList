const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const ctx=vm.createContext({window:{CList:{ui:{},defaults:{LOCALRSS:'https://rss.invalid'}}},document:{createElement:tag=>new Element(tag)},setTimeout,console:{error(){}},fixtureAttach:r=>{r.isConnected=true;},fixtureDetach:r=>{r.isConnected=false;}});
for(const name of ['collab_account','annotate_account','clistbin','public-feeds','post-login-workflow','post-login-view','post-login'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/post-login-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('postLoginCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
