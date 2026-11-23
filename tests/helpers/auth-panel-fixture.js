// Shared real-controller/view cases; preference writes and authentication are mocked.
function authPanelFixture() {
    const CList=window.CList;CList.config={flaskSiteUrl:'https://kvstore.mooc.ca'};CList.state={};
    let root=null;const writes=[],changes=[],messages=[],behavior={};
    const open=()=>{
        if(root)fixtureDetach(root);
        const holder=document.createElement('div');holder.innerHTML=AUTH_PANEL_HTML;root=holder.querySelector('#authModal');fixtureAttach(root);
        const deps={root:()=>root,server:()=>CList.config.flaskSiteUrl,localUrl:'http://local.clist',
            persist:url=>{if(behavior.storage)throw Error('Storage unavailable');writes.push(url);},select:url=>{CList.config.flaskSiteUrl=url;},
            changed:()=>{changes.push(CList.config.flaskSiteUrl);if(behavior.reader)throw Error('Reader unavailable');},status:text=>messages.push(text),beforeOpen(){}};
        const controller=createAuthPanel(root,deps);_authPanelController=controller;
        const get=id=>root.querySelector('#'+id),fill=(username=' Alice ',password='strong-password',confirm=password)=>{get('authUsername').value=username;get('authPassword').value=password;get('authConfirm').value=confirm;};
        return{root,controller,get,fill};
    };
    return{open,writes,changes,messages,behavior,state:()=>CList.state.authPanel,server:()=>CList.config.flaskSiteUrl,setServer:value=>{CList.config.flaskSiteUrl=value;}};
}
const authPanelCases=[
 ['mode and password visibility are owned by the controller/view with secret-free state',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('register');p.fill();
    p.root.dataset.mode='login';p.get('authPassword').value='weak';check(p.controller.begin()===null&&f.state().mode==='register','DOM cannot override registration rules');
    p.controller.toggle('authPassword',p.get('authPasswordToggle'));check(p.get('authPassword').type==='text','password can be revealed');
    p.controller.open('login');check(p.get('authPassword').type==='password'&&p.get('authPassword').value===''&&p.get('authUsername').value==='','reopen resets credentials and visibility');
    check(p.get('authConfirmWrap').style.display==='none'&&!JSON.stringify(f.state()).includes('strong-password'),'safe login presentation');p.controller.close();
 }],
 ['validation and captured submission prevent duplicate/change/close races',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('register');p.fill('alice','abcdefgh','wrong');check(p.controller.begin()===null&&f.state().error.includes('match'),'confirmation validation');
    p.fill('x!','abcdefgh');check(p.controller.begin()===null&&f.state().error.includes('Username'),'registration username validation');
    p.fill();const attempt=p.controller.begin();check(attempt.input.username==='alice'&&p.controller.begin()===null,'normalized snapshot and duplicate guard');
    p.controller.close();p.controller.openServers();p.controller.open('login');check(f.state().panel==='main'&&f.state().mode==='register'&&f.state().busy,'pending submit prevents UI target change');
    p.controller.authenticated(attempt);check(f.state().panel==='closed'&&p.get('authPassword').value==='','accepted login clears visible secrets');p.controller.settled(attempt);check(attempt.input.password===''&&!f.state().busy,'settle clears captured secret');
 }],
 ['server picker owns drafts, Cancel and Local selection without DOM authority',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('login');p.controller.openServers();p.get('serverSelect').value='http://local.clist';p.controller.selectServer();
    check(f.server()==='https://kvstore.mooc.ca'&&f.changes.length===0,'DOM-only selection does not change captured choice');
    p.controller.openServers();p.get('serverSelect').value='http://local.clist';p.get('serverSelect').onchange();p.controller.closeServers();check(f.server()==='https://kvstore.mooc.ca','Cancel discards draft');
    p.controller.openServers();p.get('serverSelect').value='http://local.clist';p.get('serverSelect').onchange();p.controller.selectServer();
    check(f.server()==='http://local.clist'&&f.changes.length===1&&p.get('authServerUrl').textContent==='Local (this device only)','Local selection and one invalidation');p.controller.close();
 }],
 ['preference failures preserve active server and refresh failure reports accepted selection',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('login');p.controller.openServers();p.get('serverSelect').value='https://kvstore.downes.ca';p.get('serverSelect').onchange();f.behavior.storage=true;p.controller.selectServer();
    check(f.server()==='https://kvstore.mooc.ca'&&f.changes.length===0&&f.state().error.includes('Storage unavailable'),'failed persistence leaves server unchanged');
    f.behavior.storage=false;f.behavior.reader=true;p.controller.selectServer();check(f.server()==='https://kvstore.downes.ca'&&f.state().panel==='main'&&f.state().error.includes('server changed'),'refresh failure differs from preference failure');p.controller.close();
 }],
 ['expired picker callbacks and changed configuration cannot redirect submissions',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('login');p.controller.openServers();const old=p.get('serverSelect').onchange;p.controller.closeServers();p.controller.openServers();p.get('serverSelect').value='http://local.clist';old();p.controller.selectServer();check(f.server()==='https://kvstore.mooc.ca','old picker callback expired');
    p.fill();f.setServer('https://changed.invalid');check(p.controller.begin()===null&&f.state().error.includes('server changed'),'external server change rejects submit');p.controller.close();
 }],
 ['rebuilt modal shares submission lock and ignores stale completion presentation',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('login');p.fill();const attempt=p.controller.begin(),next=f.open();next.controller.open('register');check(f.messages.length===1,'rebuild cannot start another authentication');
    p.controller.failed(attempt,Error('old failure'));p.controller.settled(attempt);next.controller.open('register');check(f.state().mode==='register'&&!f.state().error&&attempt.input.password==='','late completion releases lock without replacing new presentation');next.controller.close();
 }],
 ['credential failure and accepted-login follow-up failure use separate feedback',check=>{
    const f=authPanelFixture(),p=f.open();p.controller.open('login');p.fill();let attempt=p.controller.begin();p.controller.failed(attempt,Error('Rejected'));p.controller.settled(attempt);
    check(f.state().error==='Login failed: Rejected'&&!f.state().busy,'credential failure allows explicit retry');
    attempt=p.controller.begin();p.controller.authenticated(attempt);p.controller.failed(attempt,Error('Accounts unavailable'));p.controller.settled(attempt);
    check(f.state().panel==='closed'&&f.messages[0].includes('Logged in, but account setup'),'accepted login is not reported as failed credentials');
 }]
];
