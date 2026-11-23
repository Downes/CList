// Shared mocked environment for Node cases and the user-run browser fixture.
let migrationFixtureSequence = 0;
function migrationExecutionFixture({local = false, identity = true, realPreparation = false} = {}) {
    const number = ++migrationFixtureSequence, originalToken = 'source-secret-' + number;
    let token = originalToken, sourceDoc, destinationDoc = null, root, preparations = 0;
    const source = new Map([['a','source-a'], ['b','source-b']]);
    if (identity) source.set('_did_identity_key', 'source-identity');
    const destination = new Map(), copies = [], publications = [], reads = [], encryptions = [], behavior = {};
    const publicKey = {kty:'OKP', crv:'Ed25519', x:'public-x'};
    const publicDoc = payload => ({id:'did:web:fixture', verificationMethod:[{publicKeyJwk:payload.publicKeyJwk}],
        alsoKnownAs:[...payload.alsoKnownAs, payload.didKey], service:[{id:'#kv', type:'KVStore'}, ...payload.service]});
    sourceDoc = publicDoc({publicKeyJwk:publicKey,didKey:'did:key:fixture',alsoKnownAs:['https://alias.invalid'],service:[{id:'#social',type:'Social',serviceEndpoint:'https://social.invalid'}]});
    const CList = window.CList;
    CList.config = {flaskSiteUrl:'https://source.invalid'}; CList.state = {username:'alice'};
    CList.keys = {ACCESS_TOKEN:'access_token',DID_IDENTITY_KEY:'_did_identity_key'};
    CList.isLocalMode = () => local;
    CList.storage = {mode:local?'local':'remote',kv:{list:async()=>[...source].map(([key,value])=>({key,value}))}};
    globalThis.getSiteSpecificCookie = () => token;
    globalThis.showStatusMessage = text => { throw Error('Unexpected status: '+text); };
    globalThis.getEncKey = async()=> 'source-key';
    globalThis.deriveEncKey = async()=> 'destination-key';
    globalThis.deriveAuthHash = async()=> 'destination-hash';
    globalThis.decryptWithKey = async (key,value) => value;
    globalThis.encryptWithKey = async (key,value) => {
        encryptions.push(value);
        if (behavior.encrypt) return behavior.encrypt(key,value);
        return 'encrypted-'+encryptions.length+'-'+value;
    };
    globalThis.derivePublicKeyJwkAndDidKey = async()=>({publicKeyJwk:publicKey,didKey:'did:key:fixture'});
    const response = (ok=true,status=200) => ({ok,status,json:async()=>({})});
    globalThis.fetch = async (url,options={}) => {
        if (url.endsWith('/auth/login')) return {ok:true,json:async()=>({token:'destination-secret'})};
        if (options.method==='POST') {
            const body=JSON.parse(options.body);copies.push({url,body,options});
            if (behavior.copy) return behavior.copy(body,url,options);
            destination.set(body.key,body.value);return response();
        }
        if (options.method==='PUT') {
            const payload=JSON.parse(options.body);publications.push({url,payload,options});
            if (behavior.publish) return behavior.publish(payload,url,options);
            if (url.startsWith('https://source.invalid')) sourceDoc=publicDoc(payload);else destinationDoc=publicDoc(payload);
            return response();
        }
        reads.push(url);
        if (url.endsWith('/get_kvs/')) return {ok:true,json:async()=>[...destination].map(([key,value])=>({key,value}))};
        if (url.endsWith('/did.json')) {const doc=url.startsWith('https://source.invalid')?sourceDoc:destinationDoc;return {ok:!!doc,status:doc?200:404,json:async()=>doc};}
        throw Error('Unexpected request '+url);
    };
    const open=()=>{
        root=document.createElement('section');root.innerHTML='<div id="migrate-step-1"><input id="migrate-new-url"><input id="migrate-new-username"><input id="migrate-new-password" type="password"><input id="migrate-register" type="checkbox"><button id="migrate-prepare-btn">Preview Migration</button></div><div id="migrate-step-2"><div id="migrate-preview"></div><button id="migrate-cancel-btn">Cancel</button><button id="migrate-run-btn">Run Migration</button></div><div id="migrate-progress"></div>';
        root.querySelector('#migrate-new-url').value='https://destination.invalid';root.querySelector('#migrate-new-username').value='bob';root.querySelector('#migrate-new-password').value='fixture-password';
        fixtureAttach(root);
        const plan={oldUrl:'https://source.invalid',oldUsername:'alice',oldToken:originalToken,oldEncKey:'source-key',newUrl:'https://destination.invalid',newUsername:'bob',newToken:'destination-secret',newEncKey:'destination-key',
            kvs:[...source].map(([key,value])=>({key,value})),hasDid:identity,accountCount:2,conflictCount:[...source.keys()].filter(key=>destination.has(key)).length,didConflict:identity&&destination.has('_did_identity_key'),
            sourceFingerprint:migrationFingerprint([...source].map(([key,value])=>({key,value}))),destinationFingerprint:migrationFingerprint([...destination].map(([key,value])=>({key,value})))};
        const preparation=realPreparation?createMigrationPreparation(root):{beginRun:async()=>++preparations===1?plan:null,hold(){},finished(){}};
        const controller=createMigrationExecution(root,preparation);
        return {root,controller,start:async()=>{if(realPreparation)await root.querySelector('#migrate-prepare-btn').onclick();return controller.start();},action:()=>root.querySelector('#migrate-recovery-btn')?.onclick()};
    };
    return {open,source,destination,copies,publications,reads,encryptions,behavior,publicDoc,response,
        state:()=>CList.state.migrationExecution,token:value=>token=value,originalToken,
        sourceDoc:value=>sourceDoc=value,destinationDoc:value=>destinationDoc=value,
        setPublished:(url,payload)=>{if(url.startsWith('https://source.invalid'))sourceDoc=publicDoc(payload);else destinationDoc=publicDoc(payload);},
        docs:()=>({source:sourceDoc,destination:destinationDoc})};
}
function migrationTestGate(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};}
const migrationExecutionCases = [
 ['hosted copies and links captured targets without deleting source or exposing secrets',async check=>{
    const f=migrationExecutionFixture({realPreparation:true}),p=f.open();await p.start();
    check(f.state().complete&&f.copies.length===3&&f.publications.length===2,'complete copy/link receipts');
    check(f.source.get('a')==='source-a'&&f.destination.get('a').startsWith('encrypted-'),'source retained and destination re-encrypted');
    check(f.copies.every(call=>call.options.headers.Authorization==='Bearer destination-secret'),'captured destination auth');
    check(f.publications[1].options.headers.Authorization==='Bearer '+f.originalToken,'captured source auth');
    check(f.docs().destination.alsoKnownAs.includes('did:web:source.invalid:users:alice')&&f.docs().source.alsoKnownAs.includes('did:web:destination.invalid:users:bob'),'two-way linking');
    check(f.docs().destination.service.some(service=>service.id==='#social'),'public metadata retained');
    const safe=JSON.stringify(f.state())+p.root.textContent;check(![f.originalToken,'destination-secret','source-identity','source-key','destination-key'].some(value=>safe.includes(value)),'secret-free state/view');
    await p.start();check(f.copies.length===3&&f.publications.length===2,'completed runner cannot replay');
 }],
 ['approved existing records use update and preserve destination public metadata',async check=>{
    const f=migrationExecutionFixture({local:true});f.destination.set('a','old-a');f.destination.set('_did_identity_key','old-identity');f.destination.set('keep','destination-only');
    f.destinationDoc(f.publicDoc({publicKeyJwk:{kty:'OKP',crv:'Ed25519',x:'other-public'},didKey:'did:key:other',alsoKnownAs:['https://destination-alias.invalid'],service:[{id:'#other',type:'Social',serviceEndpoint:'https://destination-social.invalid'}]}));
    const p=f.open();await p.start();
    check(f.state().complete&&f.copies.filter(call=>call.url.endsWith('/update_kv/')).length===2,'approved existing records update directly');
    check(f.destination.get('keep')==='destination-only','unrelated destination record retained');
    check(f.docs().destination.alsoKnownAs.includes('https://destination-alias.invalid')&&f.docs().destination.service.some(service=>service.id==='#other')&&!f.docs().destination.alsoKnownAs.includes('did:key:other'),'destination public metadata retained with new identity');
 }],
 ['local source publishes only destination identity',async check=>{
    const f=migrationExecutionFixture({local:true}),p=f.open();await p.start();
    check(f.state().complete&&f.publications.length===1&&f.publications[0].url.startsWith('https://destination.invalid'),'local destination publication');
    check(!f.reads.some(url=>url.startsWith('https://source.invalid')),'no hosted identity read for local source');
 }],
 ['partial copy is checked read-only then retries only remaining records',async check=>{
    const f=migrationExecutionFixture(),p=f.open();let failed=false;
    f.behavior.copy=async body=>{if(body.key==='b'&&!failed){failed=true;return f.response(false,503);}f.destination.set(body.key,body.value);return f.response();};
    await p.start();check(!f.state().complete&&f.state().copied===1&&f.publications.length===0,'partial copy visible without linking');
    const writes=f.copies.length;await p.action();check(f.copies.length===writes&&!f.state().checkRequired,'check performs no write');
    await p.action();check(f.state().complete&&f.copies.filter(call=>call.body.key==='a').length===1,'retry skips accepted record');
    check(f.encryptions.length===3,'ciphertexts retained across retry');
 }],
 ['lost copy reply is reconciled without re-encrypting or repeating accepted write',async check=>{
    const f=migrationExecutionFixture({identity:false}),p=f.open();let lost=false;
    f.behavior.copy=async body=>{f.destination.set(body.key,body.value);if(!lost){lost=true;throw Error('Lost response');}return f.response();};
    await p.start();check(f.state().checkRequired,'uncertain copy pauses');const writes=f.copies.length;await p.action();
    check(f.copies.length===writes&&f.state().copied===1,'read-only reconciliation recognizes copied ciphertext');await p.action();
    check(f.state().complete&&f.copies.filter(call=>call.body.key==='a').length===1&&f.encryptions.length===2,'no duplicate write or fresh ciphertext');
 }],
 ['add conflict never falls through to overwrite and changed source stops recovery',async check=>{
    const f=migrationExecutionFixture({identity:false}),p=f.open();
    f.behavior.copy=async body=>{f.destination.set(body.key,'newer-destination');return f.response(false,409);};
    await p.start();await p.action();check(f.state().checkRequired&&f.copies.length===1&&!f.copies.some(call=>call.url.includes('update_kv')),'409 does not overwrite new destination');
    check(f.destination.get('a')==='newer-destination','new destination preserved');
    const g=migrationExecutionFixture({identity:false}),q=g.open();g.behavior.copy=async()=>g.response(false,503);await q.start();g.source.set('a','newer-source');await q.action();
    check(g.state().checkRequired&&g.copies.length===1&&g.state().error.includes('Source records changed'),'changed source blocks retry');
 }],
 ['partial identity linking retains destination receipt and retries only source link',async check=>{
    const f=migrationExecutionFixture(),p=f.open();let failed=false;
    f.behavior.publish=async(payload,url)=>{if(url.startsWith('https://source.invalid')&&!failed){failed=true;return f.response(false,503);}f.setPublished(url,payload);return f.response();};
    await p.start();check(!f.state().complete&&f.state().identities===1,'partial DID result is not success');
    const writes=f.publications.length;await p.action();check(f.publications.length===writes,'DID recovery check is read-only');await p.action();
    check(f.state().complete&&f.publications.filter(call=>call.url.startsWith('https://destination.invalid')).length===1&&f.copies.length===3,'accepted copies/destination DID not replayed');
 }],
 ['lost publication reply is reconciled before explicit continuation',async check=>{
    const f=migrationExecutionFixture({local:true}),p=f.open();f.behavior.publish=async(payload,url)=>{f.setPublished(url,payload);throw Error('Lost publication reply');};
    await p.start();check(f.state().checkRequired&&!f.state().complete,'uncertain publication remains partial');await p.action();await p.action();
    check(f.state().complete&&f.publications.length===1,'matching public document prevents duplicate publication');
 }],
 ['session change during encryption prevents all writes',async check=>{
    const f=migrationExecutionFixture({identity:false}),wait=migrationTestGate(),p=f.open();f.behavior.encrypt=()=>wait.promise;
    const running=p.start();await new Promise(resolve=>setTimeout(resolve,0));f.token('replacement-login');wait.resolve('captured-cipher');await running;
    check(f.copies.length===0&&f.publications.length===0,'no stale-session writes');
    f.token(f.originalToken);const next=f.open();check(next.root.textContent.includes('Check migration'),'captured recovery survives return to source session');
 }],
 ['panel rebuild retains late accepted write and rejects duplicate/expired actions',async check=>{
    const f=migrationExecutionFixture({identity:false}),wait=migrationTestGate(),p=f.open();let first=true;
    f.behavior.copy=async body=>{if(first){first=false;await wait.promise;}f.destination.set(body.key,body.value);return f.response();};
    const running=p.start();await new Promise(resolve=>setTimeout(resolve,0));await p.start();const next=f.open();await next.start();wait.resolve();await running;
    check(f.copies.length===1&&f.state().copied===1,'late accepted copy retained across rebuilt panel');
    const expired=next.root.querySelector('#migrate-recovery-btn').onclick;await next.action();await expired();
    check(f.copies.length===1,'check and expired callback cannot copy');await next.action();
    check(f.state().complete&&f.copies.filter(call=>call.body.key==='a').length===1,'rebuilt panel resumes only remaining copies');
 }],
 ['unmatched source identity fails before copying and newer accepted destination is preserved',async check=>{
    const f=migrationExecutionFixture(),p=f.open();f.sourceDoc(null);await p.start();check(f.copies.length===0&&f.state().checkRequired,'unpublished hosted source fails before copy');
    const g=migrationExecutionFixture({identity:false}),q=g.open();g.behavior.copy=async body=>{if(body.key==='b')return g.response(false,503);g.destination.set(body.key,body.value);return g.response();};
    await q.start();g.destination.set('a','newer-after-copy');await q.action();
    check(g.state().checkRequired&&g.destination.get('a')==='newer-after-copy'&&g.copies.length===2,'newer accepted destination cannot be overwritten on retry');
 }]
];
