/// <reference path="./clist-types.js" />
// Public account choices and DID metadata, with explicit captured dependencies.
function didUpdateCanonical(value){if(Array.isArray(value))return value.map(didUpdateCanonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,didUpdateCanonical(value[key])]));return value;}
function didUpdateFingerprint(payload){const metadata=rotationMetadata(payload);return JSON.stringify(didUpdateCanonical({service:metadata.service.sort((a,b)=>String(a.id).localeCompare(String(b.id))),alsoKnownAs:metadata.alsoKnownAs.slice().sort()}));}
async function readDidUpdateProfile(session,deps){
    deps.assertCurrent();const response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/users/'+encodeURIComponent(session.username)+'/did.json',{cache:'no-store'});deps.assertCurrent();
    if(!response.ok)throw new Error('Could not read the published DID (HTTP '+response.status+').');const doc=await response.json();deps.assertCurrent();rotationMetadata(doc);return doc;
}
function assertDidUpdateKey(doc,identity){const key=doc.verificationMethod?.[0]?.publicKeyJwk;if(!key||key.kty!==identity.publicKeyJwk.kty||key.crv!==identity.publicKeyJwk.crv||key.x!==identity.publicKeyJwk.x||!Array.isArray(doc.alsoKnownAs)||!doc.alsoKnownAs.includes(identity.didKey))throw new Error('The stored and published identity keys differ. Finish identity recovery before updating accounts.');}
/** @param {CListDidAccountSelectionSnapshot} snapshot @param {CListDidIdentitySession} session */
async function prepareDidAccountUpdate(snapshot,session,deps){
    deps.assertCurrent();if(session.local)throw new Error('A local account has no public DID to update.');if(!session.token||!session.username)throw new Error('Please log in before updating the DID.');
    const profile=await readDidUpdateProfile(session,deps);if(typeof profile.id!=='string'||!profile.id)throw new Error('The public DID identifier is missing. Refresh identity.');const records=await deps.list();deps.assertCurrent();
    const encKey=await deps.getKey();deps.assertCurrent();if(!encKey)throw new Error('Encryption key unavailable. Log in again.');
    const stored=await deps.getIdentityKey();deps.assertCurrent();if(!stored)throw new Error('No stored identity key. Refresh identity.');
    const identity=await deps.derive(stored.value,encKey);deps.assertCurrent();assertDidUpdateKey(profile,identity);
    const metadata=rotationMetadata(profile),entries=[],managedIds=new Set([profile.id+'#pages-opml',profile.id+'#pages-outbox']),managedAliases=new Set(),selectedServices=[],selectedAliases=[];
    const typeMap={Mastodon:'SocialWebAccount',WordPress:'Blog',Blogger:'Blog',Annotate:'AnnotationService',Hypothesis:'AnnotationService'},eligible=new Set([...Object.keys(typeMap),'Bluesky']);
    for(const choice of snapshot.items){
        const record=records.find(record=>record.key===choice.key);if(!record||record.value!==choice.sourceValue)throw new Error('An account changed. Refresh accounts before retrying.');
        let data;try{data=JSON.parse(await deps.decrypt(encKey,record.value));}catch(error){deps.assertCurrent();throw new Error('An account could not be read. Refresh accounts before updating.');}deps.assertCurrent();if(!eligible.has(data?.type))throw new Error('An account type changed. Refresh accounts.');
        const desired={...data,public:choice.public};const newValue=data.public===choice.public?record.value:await deps.encrypt(encKey,JSON.stringify(desired));deps.assertCurrent();
        entries.push({key:choice.key,originalValue:record.value,newValue,saved:newValue===record.value});
        if(data.type==='Bluesky'){const alias='at://'+(data.instance||choice.key);managedAliases.add(alias);if(choice.public)selectedAliases.push(alias);continue;}
        const id=profile.id+'#'+choice.key.replace(/[^a-zA-Z0-9]/g,'-');if(managedIds.has(id))throw new Error('Account service identifiers conflict. Rename the conflicting accounts before updating.');managedIds.add(id);
        if(choice.public)selectedServices.push({...metadata.service.find(item=>item.id===id),id,type:typeMap[data.type],serviceEndpoint:data.type==='Hypothesis'&&data.username?data.instance+'/users/'+data.username:data.instance||choice.key});
    }
    const catalog=records.find(record=>record.key===deps.catalogKey);
    if(catalog){let meta;try{meta=JSON.parse(await deps.decrypt(encKey,catalog.value));}catch(error){deps.assertCurrent();throw new Error('The pages catalog could not be read. Retry after checking it.');}deps.assertCurrent();for(const [field,suffix,type]of [['opmlUrl','pages-opml','CListPages'],['apUrl','pages-outbox','OrderedCollection']])if(meta[field]){const id=profile.id+'#'+suffix;selectedServices.push({...metadata.service.find(item=>item.id===id),id,type,serviceEndpoint:meta[field]});}}
    const payload={publicKeyJwk:identity.publicKeyJwk,didKey:identity.didKey,service:[...metadata.service.filter(item=>!managedIds.has(item.id)),...selectedServices],alsoKnownAs:[...new Set([...metadata.alsoKnownAs.filter(alias=>!managedAliases.has(alias)),...selectedAliases])]};
    const originalFingerprint=didUpdateFingerprint(profile);return {snapshot,entries,payload,storedValue:stored.value,catalogValue:catalog?.value??null,originalFingerprint,published:originalFingerprint===didUpdateFingerprint(payload),warnings:[]};
}
async function validateDidUpdateSources(plan,deps){
    const stored=await deps.getIdentityKey();deps.assertCurrent();if(stored?.value!==plan.storedValue)throw new Error('The identity key changed. Refresh identity before continuing.');
    for(const entry of plan.entries){const record=await deps.get(entry.key);deps.assertCurrent();if(record?.value===entry.newValue)entry.saved=true;else if(record?.value!==entry.originalValue)throw new Error('An account changed during this update. Refresh accounts before continuing.');}
    const catalog=await deps.get(deps.catalogKey);deps.assertCurrent();if((catalog?.value??null)!==plan.catalogValue)throw new Error('The pages catalog changed. Refresh before updating the DID.');
}
async function checkDidAccountUpdate(plan,session,deps){
    await validateDidUpdateSources(plan,deps);const profile=await readDidUpdateProfile(session,deps);assertDidUpdateKey(profile,plan.payload);
    const fingerprint=didUpdateFingerprint(profile);if(fingerprint===didUpdateFingerprint(plan.payload))plan.published=true;
    else if(!plan.published&&fingerprint!==plan.originalFingerprint)throw new Error('The public DID metadata changed. Refresh before retrying.');
    else if(plan.published&&fingerprint!==didUpdateFingerprint(plan.payload)&&!plan.warnings.includes('Newer DID metadata was preserved after the accepted update.'))plan.warnings.push('Newer DID metadata was preserved after the accepted update.');
    if(plan.entries.every(entry=>entry.saved))plan.warnings=plan.warnings.filter(warning=>warning!=='An account visibility save could not be confirmed.');
}
async function applyDidAccountUpdate(plan,session,deps){
    await checkDidAccountUpdate(plan,session,deps);plan.warnings=[];
    for(const entry of plan.entries){
        if(entry.saved)continue;const latest=await deps.get(entry.key);deps.assertCurrent();
        if(latest?.value===entry.newValue){entry.saved=true;continue;}if(latest?.value!==entry.originalValue)throw new Error('An account changed. Refresh before retrying.');
        try{await deps.update(entry.key,entry.newValue);entry.saved=true;}catch(error){plan.warnings.push('An account visibility save could not be confirmed.');}
        deps.assertCurrent();
    }
    await checkDidAccountUpdate(plan,session,deps);
    if(!plan.published){const receipt=await deps.publish(plan.payload);plan.published=true;if(receipt.warning)plan.warnings.push(receipt.warning);}
    return plan;
}
