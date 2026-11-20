// Real credential/session workflows and form controller; all external effects are mocked.
let credentialFixtureSequence=0;
function authCredentialsFixture({local=false}={}) {
    const number=++credentialFixtureSequence,storeUrl='https://auth'+number+'.invalid',localUrl='http://local.clist';
    const CList=window.CList;CList.config={flaskSiteUrl:local?localUrl:storeUrl};CList.state={};
    CList.keys={ACCESS_TOKEN:'access_token',USERNAME:'username',TOKEN_EXPIRES:'token_expires'};
    CList.isLocalMode=()=>CList.config.flaskSiteUrl===localUrl;
    const cookies=new Map(),keys=new Map(),requests=[],localCalls=[],derived=[],writes=[],behavior={},panels=[];
    const cookieKey=(site,name)=>site+'|'+name,expires=()=>new Date(Date.now()+600000).toISOString();
    let root;
    globalThis.getSiteSpecificCookie=(site,name)=>cookies.get(cookieKey(site,name))??null;
    globalThis.setSiteSpecificCookie=(site,name,value)=>{
        writes.push(['cookie',site,name,value]);
        if(behavior.cookieThrow===name){behavior.cookieThrow=null;throw Error('Cookie write denied');}
        if(behavior.cookieSilent===name)return;
        cookies.set(cookieKey(site,name),String(value));
    };
    globalThis.deleteSiteSpecificCookie=(site,name)=>cookies.delete(cookieKey(site,name));
    Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:name=>keys.get(name)??null,setItem:(name,value)=>{writes.push(['key',name,value]);if(behavior.keyThrow){behavior.keyThrow=false;throw Error('Key write denied');}keys.set(name,value);},removeItem:name=>{if(behavior.removeThrow)throw Error('Rollback key removal denied');keys.delete(name);}}});
    globalThis.deriveAuthHash=async(password,username)=>{derived.push(['hash',password,username]);if(behavior.hash)return behavior.hash();return 'derived-hash';};
    globalThis.deriveEncKey=async(password,username)=>{derived.push(['key',password,username]);return {fixtureKey:true};};
    Object.defineProperty(window,'crypto',{configurable:true,value:{subtle:{exportKey:async()=>{if(behavior.export)return behavior.export();return new Uint8Array([1,2,3]).buffer;}}}});
    const login=()=>behavior.loginData||{token:'verified-token',username:'alice',expires:expires()};
    const response=(ok=true,status=200)=>({ok,status,json:async()=>login()});
    globalThis.fetch=async(url,options)=>{
        requests.push({url,options});if(behavior.fetch)return behavior.fetch(url,options);
        if(url.endsWith('/auth/register')){if(behavior.register)return behavior.register();return response();}
        if(url.endsWith('/auth/login')){if(behavior.login)return behavior.login();return response();}
        throw Error('Unexpected request');
    };
    CList._localKvStore={registerUser:async(...args)=>{localCalls.push(['register',...args]);if(behavior.register)return behavior.register();},loginUser:async(...args)=>{localCalls.push(['login',...args]);return login();}};
    const open=(mode='register')=>{
        if(root)fixtureDetach(root);const holder=document.createElement('div');holder.innerHTML=AUTH_PANEL_HTML;root=holder.querySelector('#authModal');fixtureAttach(root);
        const panel=createAuthPanel(root,{root:()=>root,server:()=>CList.config.flaskSiteUrl,localUrl,persist(){throw Error('Unexpected preference write');},select(){},changed(){},status(){},beforeOpen(){}});panels.push(panel);
        panel.open(mode);root.querySelector('#authUsername').value=' Alice ';root.querySelector('#authPassword').value='fixture-password';root.querySelector('#authConfirm').value='fixture-password';
        return panel;
    };
    const run=async(panel,retry=false)=>{
        const attempt=panel.begin(retry);if(!attempt)return {blocked:true};
        try{const result=await authenticateAuthAttempt(attempt,panel,retry);panel.authenticated(attempt);return{result};}
        catch(error){panel.failed(attempt,error);return{error};}finally{panel.settled(attempt);}
    };
    return{open,run,cookies,keys,requests,localCalls,derived,writes,behavior,response,expires,sourceUrl:()=>local?localUrl:storeUrl,
        state:()=>CList.state.authPanel,root:()=>root,setServer:url=>{CList.config.flaskSiteUrl=url;},cookie:(name,value)=>cookies.set(cookieKey(local?localUrl:storeUrl,name),value)};
}
function credentialTestGate(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
const authCredentialCases=[
 ['hosted registration/login installs captured session with token last and no plaintext request password',async check=>{
    const f=authCredentialsFixture(),p=f.open();const result=await f.run(p);
    check(!!result.result&&f.requests.length===2&&f.requests.every(row=>row.url.startsWith(f.sourceUrl())),'captured hosted endpoints');
    check(f.requests.every(row=>!row.options.body.includes('fixture-password')&&JSON.parse(row.options.body).username==='alice'),'only normalized username/hash transported');
    check(f.derived.length===2&&f.writes[0][0]==='key'&&f.writes.at(-1)[2]==='access_token','single key/hash derivation and token-last installation');
    check(f.keys.get(f.sourceUrl()+'_alice_encKey')==='AQID'&&f.cookies.get(f.sourceUrl()+'|access_token')==='verified-token','matching key and token saved');
    check(!JSON.stringify(f.state()).includes('verified-token')&&!JSON.stringify(f.state()).includes('fixture-password')&&!JSON.stringify(f.state()).includes('AQID'),'secret-free presentation state');
 }],
 ['Local registration/login uses captured local adapter without HTTP',async check=>{
    const f=authCredentialsFixture({local:true}),p=f.open();const result=await f.run(p);
    check(!!result.result&&f.requests.length===0&&f.localCalls.map(row=>row[0]).join(',')==='register,login','direct Local auth calls');
    check(f.localCalls.every(row=>row[1]==='alice'&&row[2]==='derived-hash'),'Local receives derived auth hash only');
 }],
 ['accepted registration survives failed login and rebuilt panel without another creation request',async check=>{
    const f=authCredentialsFixture(),p=f.open();f.behavior.login=async()=>f.response(false,401);await f.run(p);
    check(f.state().registration==='created'&&f.state().error.includes('Account created'),'accepted registration distinguished from failed login');
    delete f.behavior.login;const next=f.open();const result=await f.run(next);
    check(!!result.result&&f.requests.filter(row=>row.url.endsWith('/auth/register')).length===1,'registration receipt survives rebuild');
 }],
 ['uncertain registration checks login on ordinary retry and resends only after explicit choice',async check=>{
    const f=authCredentialsFixture(),p=f.open();f.behavior.register=async()=>{throw Error('Lost reply');};await f.run(p);
    check(f.state().registration==='uncertain'&&f.root().querySelector('#authRegistrationRetry').style.display!=='none','uncertainty exposes explicit retry');
    f.behavior.login=async()=>f.response(false,401);await f.run(p);check(f.requests.filter(row=>row.url.endsWith('/auth/register')).length===1,'ordinary retry does not repeat registration');
    delete f.behavior.register;delete f.behavior.login;const result=await f.run(p,true);
    check(!!result.result&&f.requests.filter(row=>row.url.endsWith('/auth/register')).length===2,'explicit retry can register once more');
 }],
 ['server/session changes during derivation or export prevent request/installation',async check=>{
    const f=authCredentialsFixture(),wait=credentialTestGate(),p=f.open('login');f.behavior.hash=()=>wait.promise;
    const running=f.run(p);f.setServer('https://replacement.invalid');wait.resolve('derived-hash');await running;
    check(f.requests.length===0&&f.writes.length===0,'stale derivation cannot send to changed server');
    const g=authCredentialsFixture(),exporting=credentialTestGate(),q=g.open('login');g.behavior.export=()=>exporting.promise;
    const pending=g.run(q);await new Promise(resolve=>setTimeout(resolve,0));g.cookie('access_token','newer-session');exporting.resolve(new Uint8Array([1,2,3]).buffer);await pending;
    check(g.writes.length===0&&g.cookies.get(g.sourceUrl()+'|access_token')==='newer-session','newer session protected before install');
 }],
 ['invalid username/session/expiry responses do not install any credentials',async check=>{
    for(const data of [{token:'',username:'alice',expires:'2099-01-01'},{token:'token',username:'other',expires:'2099-01-01'},{token:'token',username:'alice',expires:'2000-01-01'},{token:'token',username:'alice'}]){
        const f=authCredentialsFixture(),p=f.open('login');f.behavior.loginData=data;const result=await f.run(p);check(!!result.error&&f.writes.length===0,'invalid login result rejected before storage');
    }
 }],
 ['key failure and partial/silent cookie failure restore existing session values',async check=>{
    for(const failure of ['key','throw','silent']){
        const f=authCredentialsFixture(),p=f.open('login');f.cookie('access_token','old-token');f.cookie('username','old-user');f.cookie('token_expires','old-expiry');
        f.keys.set(f.sourceUrl()+'_alice_encKey','old-alice-key');f.keys.set(f.sourceUrl()+'_old-user_encKey','old-session-key');
        const beforeCookies=JSON.stringify([...f.cookies].sort()),beforeKeys=JSON.stringify([...f.keys].sort());
        if(failure==='key')f.behavior.keyThrow=true;if(failure==='throw')f.behavior.cookieThrow='token_expires';if(failure==='silent')f.behavior.cookieSilent='access_token';
        const result=await f.run(p);check(!!result.error&&JSON.stringify([...f.cookies].sort())===beforeCookies&&JSON.stringify([...f.keys].sort())===beforeKeys,'partial installation restores prior state: '+failure);
    }
    const g=authCredentialsFixture(),q=g.open('login');g.behavior.cookieThrow='token_expires';g.behavior.removeThrow=true;const result=await g.run(q);
    check(!!result.error&&g.state().error.includes('could not be restored')&&!g.cookies.has(g.sourceUrl()+'|access_token'),'incomplete rollback is visible without activating token');
 }],
 ['replaced panel retains late registration acceptance but performs no login/session writes',async check=>{
    const f=authCredentialsFixture(),wait=credentialTestGate(),p=f.open();f.behavior.register=()=>wait.promise;
    const running=f.run(p);await new Promise(resolve=>setTimeout(resolve,0));const next=f.open();wait.resolve(f.response());await running;
    check(f.requests.length===1&&f.writes.length===0,'late registration reply cannot install into replaced panel');
    delete f.behavior.register;next.open('register');f.root().querySelector('#authUsername').value='alice';f.root().querySelector('#authPassword').value='fixture-password';f.root().querySelector('#authConfirm').value='fixture-password';
    const result=await f.run(next);check(!!result.result&&f.requests.filter(row=>row.url.endsWith('/auth/register')).length===1,'late acceptance receipt prevents repeat creation');
 }],
 ['compatibility helpers keep direct login/register contracts and surface errors',async check=>{
    const f=authCredentialsFixture();await KVregisterWithCredentials(' ALICE ','fixture-password');await KVregisterWithCredentials('alice','fixture-password');
    const result=await KVloginWithCredentials('alice','fixture-password');check(result.username==='alice'&&result.token==='verified-token'&&f.requests.filter(row=>row.url.endsWith('/auth/register')).length===1,'two-argument helpers preserve contracts and receipts');
    const concurrent=authCredentialsFixture();await Promise.allSettled([KVregisterWithCredentials('alice','fixture-password'),KVregisterWithCredentials('alice','fixture-password')]);
    check(concurrent.requests.filter(row=>row.url.endsWith('/auth/register')).length===1,'concurrent direct registration creates at most once');
    const g=authCredentialsFixture();g.behavior.login=async()=>g.response(false,503);let error;try{await KVloginWithCredentials('alice','fixture-password');}catch(cause){error=cause;}
    check(!!error&&g.writes.length===0,'direct helper failures propagate without UI or storage');
 }]
];
