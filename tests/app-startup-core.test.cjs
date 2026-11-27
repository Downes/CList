const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
test('actual core modules render identity before service schemas or account APIs exist', async()=>{
    for(const authenticated of [false,true]){
        const doc=menuShellDocument(), html=fs.readFileSync('index.html','utf8');
        for(const match of html.matchAll(/id="([^"]+)"/g)){
            if(doc.getElementById(match[1]))continue;
            const el=doc.createElement('div');el.id=match[1];doc.body.appendChild(el);
        }
        const elements=new Map(doc.body.children.map(el=>[el.id,el]));
        doc.getElementById=id=>elements.get(id)||null;
        const calls=[],store=new Map(), site='https://store.invalid';
        const C={config:{flaskSiteUrl:site},state:{publishing:{selectedAccountKeys:[]}},ui:{},schemas:{},readers:{},accounts:[],keys:{USERNAME:'user',ACCESS_TOKEN:'token',TOKEN_EXPIRES:'expires',EDITOR_DRAFT_PREFIX:'draft',LOGOUT_MESSAGE:'notice'}};
        let release;
        const features=new Promise(resolve=>{release=resolve;});
        C.startup={phase:()=> 'loading-features',whenFeaturesReady:()=>features,sessionKnown:()=>calls.push('identity'),afterFeatures() {}};
        const fetch=()=>{throw Error('Unexpected network');};
        const ctx=vm.createContext({window:{CList:C,location:{protocol:'https:',href:'https://app.invalid/'},fetch,addEventListener(){},crypto:{subtle:{importKey:async()=>({})}}},
            document:doc,location:{href:'https://app.invalid/'},URL,console:{log(){},error:console.error,warn(){}},setTimeout,clearTimeout,fetch,
            sessionStorage:{getItem:key=>store.get(key)??null},localStorage:{getItem:()=>null},atob:()=> 'key'});
        const core=['local-kvstore','utilities','ui','kvstore','session-lifecycle-workflow','session-lifecycle-view','session-lifecycle','pane-state','pane-view','panes','interface'];
        for(const name of core){vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx,{filename:name+'.js'});Object.assign(ctx,ctx.window);}
        const expires=new Date(Date.now()+60000).toISOString();
        ctx.getSiteSpecificCookie=(_site,key)=>!authenticated?null:({user:'alice',token:'test-token',expires}[key]);
        if(authenticated)store.set(site+'_alice_encKey','test-key');
        const pending=ctx.initializeSessionControls();
        await new Promise(resolve=>setImmediate(resolve));
        assert.ok(calls.includes('identity'));
        assert.equal(doc.getElementById('logoutButton').style.display,authenticated?'block':'none');
        assert.equal(doc.getElementById('loginButton').style.display,authenticated?'none':'inline-block');
        assert.equal(ctx.loadAccountRecords,undefined);
        ctx.loadAccountRecords=async()=>{calls.push('accounts');return [];};
        ctx.populateReadAccountList=()=>{};ctx.populatePostOptions=()=>{};
        release();await pending;
        assert.equal(calls.includes('accounts'),authenticated);
    }
});
