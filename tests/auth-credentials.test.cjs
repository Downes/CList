const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const index=fs.readFileSync('index.html','utf8'),shell=index.slice(index.indexOf('<div id="authModal"'),index.lastIndexOf('</body>'));
const ctx=vm.createContext({window:{CList:{ui:{}}},URL,Date,setTimeout,Uint8Array,btoa:value=>Buffer.from(value,'binary').toString('base64'),console:{error(){}},AUTH_PANEL_HTML:shell,document:{createElement:tag=>new Element(tag)},fixtureAttach:root=>{root.isConnected=true;},fixtureDetach:root=>{root.isConnected=false;}});
for(const name of ['auth-panel-state','auth-panel-view','auth-panel','auth-credentials-workflow','auth-session-workflow','auth-credentials'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx,{filename:name+'.js'});
vm.runInContext(fs.readFileSync('tests/helpers/auth-credentials-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('authCredentialCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
test('logout epoch rejects a pending direct login even when source cookies were already empty',async()=>{
 const f=ctx.authCredentialsFixture();let release;f.behavior.export=()=>new Promise(resolve=>release=resolve);
 const running=ctx.KVloginWithCredentials('alice','fixture-password').then(()=>null,error=>error);
 await new Promise(resolve=>setImmediate(resolve));ctx.window.CList.state.authEpoch=(ctx.window.CList.state.authEpoch||0)+1;
 release(new Uint8Array([1,2,3]).buffer);const error=await running;
 assert.match(error.message,/session changed/);assert.equal(f.writes.length,0);
});
