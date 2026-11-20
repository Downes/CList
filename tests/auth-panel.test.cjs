const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const index=fs.readFileSync('index.html','utf8'),shell=index.slice(index.indexOf('<div id="authModal"'),index.lastIndexOf('</body>'));
const ctx=vm.createContext({window:{CList:{ui:{}}},URL,console:{error(){}},AUTH_PANEL_HTML:shell,document:{createElement:tag=>new Element(tag)},fixtureAttach:root=>{root.isConnected=true;},fixtureDetach:root=>{root.isConnected=false;}});
for(const name of ['auth-panel-state','auth-panel-view','auth-panel'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/auth-panel-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('authPanelCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
const source=fs.readFileSync('js/kvstore.js','utf8');vm.runInContext(source.slice(source.indexOf('        async function submitAuthModal('),source.indexOf('        function displayUsername()')),ctx);
function legacyFixture(){
 const f=ctx.authPanelFixture(),p=f.open(),events=[];
 Object.assign(ctx,{KVregisterWithCredentials:async(u,p)=>events.push(['register',u,p]),KVloginWithCredentials:async(u,p)=>events.push(['login',u,p]),updateIdentityDiv:()=>events.push(['identity']),acceptLogin:()=>events.push(['accept']),seedPublicFeedAccounts:async()=>events.push(['seed']),getAccounts:async()=>[],autoRegisterCollab:async()=>{},autoRegisterAnnotations:async()=>{},autoSeedCListBin:async()=>{},updateUIVisibility(){},playRead:async()=>{},populateReadAccountList(){},showOnboardingNudge(){},showErrorModal(){}});
 ctx.authenticateAuthAttempt=async attempt=>{const {mode,username,password}=attempt.input;if(mode==='register')await ctx.KVregisterWithCredentials(username,password);await ctx.KVloginWithCredentials(username,password);};
 ctx.finishAuthSetup=async attempt=>{if(attempt.input.mode==='register')await ctx.seedPublicFeedAccounts();await ctx.getAccounts();};
 ctx.authPanelController=()=>p.controller;return{f,p,events};
}
test('real submit bridge captures registration input and preserves completion order',async()=>{
 const {f,p,events}=legacyFixture();p.controller.open('register');p.fill();await ctx.submitAuthModal();
 assert.deepEqual(events.map(event=>event[0]),['register','login','identity','accept','seed']);assert.equal(events[0][1],'alice');assert.equal(f.state().panel,'closed');assert.equal(f.state().busy,false);
});
test('real submit bridge suppresses duplicates and separates post-login failure',async()=>{
 const {f,p,events}=legacyFixture();let resolve;ctx.KVloginWithCredentials=()=>new Promise(done=>resolve=done);ctx.getAccounts=async()=>{throw Error('Account listing failed');};
 p.controller.open('login');p.fill();const running=ctx.submitAuthModal();await ctx.submitAuthModal();p.controller.openServers();resolve();await running;
 assert.equal(events.filter(event=>event[0]==='accept').length,1);assert.match(f.messages.at(-1),/Logged in, but account setup/);assert.equal(f.state().panel,'closed');assert.equal(f.state().busy,false);
});
