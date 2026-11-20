/// <reference path="./clist-types.js" />
// Confirmed key rotation only; preparation, key update and publication are distinct.
function rotationKey(doc){return JSON.stringify((doc?.verificationMethod||[]).map(method=>{const key=method.publicKeyJwk||{};return [key.kty,key.crv,key.x];}));}
function rotationMetadata(doc){
    if((doc?.service!==undefined&&!Array.isArray(doc.service))||(doc?.alsoKnownAs!==undefined&&!Array.isArray(doc.alsoKnownAs)))throw new Error('The DID metadata cannot be preserved. Refresh the identity panel.');
    const services=doc?.service||[],aliases=doc?.alsoKnownAs||[];
    if(services.some(service=>!service||typeof service!=='object')||aliases.some(alias=>typeof alias!=='string'))throw new Error('The DID metadata cannot be preserved.');
    return {service:services.filter(service=>service.type!=='KVStore'),alsoKnownAs:aliases.filter(alias=>!alias.startsWith('did:key:'))};
}
async function readRotationDocument(session,deps){
    deps.assertCurrent();if(session.local)return null;
    const response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/users/'+encodeURIComponent(session.username)+'/did.json',{cache:'no-store'});deps.assertCurrent();
    if(response.status===404)return null;if(!response.ok)throw new Error('Could not read the DID before rotation (HTTP '+response.status+').');
    const doc=await response.json();deps.assertCurrent();rotationMetadata(doc);return doc;
}
/** @param {CListDidIdentitySession} session @returns {Promise<CListDidRotationSnapshot>} */
async function prepareDidRotation(session,deps){
    deps.assertCurrent();if(!session.token||!session.username)throw new Error('Please log in before regenerating an identity.');
    const row=await deps.getIdentityKey();deps.assertCurrent();if(!row)throw new Error('No stored identity key to regenerate. Refresh identity first.');
    return {storedValue:row.value,doc:await readRotationDocument(session,deps)};
}
async function assertRotationTarget(snapshot,session,deps){
    const row=await deps.getIdentityKey();deps.assertCurrent();if(row?.value!==snapshot.storedValue)throw new Error('The confirmed identity key changed. Refresh identity before retrying.');
    const doc=await readRotationDocument(session,deps);if(rotationKey(doc)!==rotationKey(snapshot.doc))throw new Error('The published identity changed after confirmation. Refresh identity before retrying.');
}
/** @param {CListDidRotationSnapshot} snapshot @param {CListDidIdentitySession} session @returns {Promise<CListDidRotationPrepared>} */
async function storeRotatedDid(snapshot,session,deps){
    await assertRotationTarget(snapshot,session,deps);const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key unavailable. Log in again.');
    deps.progress('generating');const generated=await deps.generate();deps.assertCurrent();
    const value=await deps.encrypt(generated.keyPair.privateKey,key);deps.assertCurrent();await assertRotationTarget(snapshot,session,deps);
    const prepared={storedValue:value,didKey:generated.didKey,publicKeyJwk:generated.publicKeyJwk};deps.prepared(prepared);deps.progress('storing');
    try{deps.assertCurrent();await deps.update(value);}catch(cause){
        const error=new Error('The new key could not be confirmed as stored.');error.storageUnknown=!['NotAuthenticated','NotAuthorized','InvalidData','NotFound'].includes(cause.code);throw error;
    }
    deps.stored();return prepared;
}
function rotationConflict(message){const error=new Error(message);error.conflict=true;return error;}
async function inspectRotatedDid(snapshot,prepared,session,deps){
    const row=await deps.getIdentityKey();deps.assertCurrent();
    if(row?.value!==prepared.storedValue)throw rotationConflict('The rotated key changed. Refresh identity before continuing.');
    if(session.local)return {confirmed:true,doc:null};const doc=await readRotationDocument(session,deps);
    const matching=doc?.verificationMethod?.some(method=>{const key=method.publicKeyJwk;return key?.kty===prepared.publicKeyJwk.kty&&key.crv===prepared.publicKeyJwk.crv&&key.x===prepared.publicKeyJwk.x;})&&doc?.alsoKnownAs?.includes(prepared.didKey);
    if(matching)return {confirmed:true,doc};
    if(rotationKey(doc)!==rotationKey(snapshot.doc))throw rotationConflict('Another identity is now published. Refresh identity before continuing.');
    return {confirmed:false,doc};
}
async function publishRotatedDid(snapshot,prepared,session,deps){
    const checked=await inspectRotatedDid(snapshot,prepared,session,deps);if(checked.confirmed)return {didKey:prepared.didKey,existing:true};
    const row=await deps.getIdentityKey();deps.assertCurrent();if(row?.value!==prepared.storedValue)throw new Error('The rotated key changed. Refresh identity.');
    return deps.publish({publicKeyJwk:prepared.publicKeyJwk,didKey:prepared.didKey,...rotationMetadata(checked.doc)});
}
