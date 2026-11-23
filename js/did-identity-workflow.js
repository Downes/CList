/// <reference path="./clist-types.js" />
// Identity display reads only; dependencies supply captured storage and crypto.
/** @param {CListDidIdentitySession} session */
async function readDidIdentity(session,deps) {
    deps.assertCurrent();
    const localKey=async()=>{try{const row=await deps.getIdentityKey();deps.assertCurrent();return row;}catch(error){deps.assertCurrent();if(error.code==='NotFound')return null;throw error;}};
    if(session.local){
        const row=await localKey();if(!row)return {kind:'missing',local:true};
        const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key not available — please log in again.');
        const identity=await deps.derive(row.value,key);deps.assertCurrent();
        return {kind:'local',didKey:identity.didKey};
    }
    const url=session.storeUrl.replace(/\/$/,'')+'/users/'+encodeURIComponent(session.username)+'/did.json';
    const response=await deps.fetch(url,{signal:deps.signal});deps.assertCurrent();
    if(response.ok){const doc=await response.json();deps.assertCurrent();return {kind:'published',id:String(doc.id||''),alsoKnownAs:Array.isArray(doc.alsoKnownAs)?doc.alsoKnownAs.map(String):[],url};}
    if(response.status!==404)throw new Error('Could not check DID (HTTP '+response.status+').');
    return {kind:(await localKey())?'unpublished':'missing',local:false};
}
/** @returns {Promise<{items:CListDidPublicAccount[],warnings:string[],versions:Map<string,string>}>} */
async function readDidPublicAccounts(deps) {
    deps.assertCurrent();const records=await deps.list();deps.assertCurrent();
    const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key not available — please log in again.');
    const types=new Set(['Mastodon','Bluesky','WordPress','Blogger','Annotate','Hypothesis']),items=[],warnings=[],versions=new Map();
    for(const record of records.filter(record=>!record.key.startsWith('_'))){
        try{
            const plain=await deps.decrypt(key,record.value);deps.assertCurrent();
            /** @type {CListAccountData} */
            const data=JSON.parse(plain);
            if(data&&types.has(data.type)){items.push({key:record.key,title:String(data.title||record.key),type:data.type,public:!!data.public});versions.set(record.key,record.value);}
        }catch(error){deps.assertCurrent();warnings.push('An unreadable account was skipped.');}
    }
    return {items,warnings,versions};
}
