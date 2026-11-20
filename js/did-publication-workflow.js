/// <reference path="./clist-types.js" />
// Publish only an existing stored Ed25519 identity. No key generation or KV writes.
async function checkExistingDidPublication(session,prepared,deps){
    deps.assertCurrent();if(!prepared.publicKeyJwk?.x||!prepared.didKey)throw new Error('The stored identity public key could not be derived.');
    const response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/users/'+encodeURIComponent(session.username)+'/did.json',{cache:'no-store'});deps.assertCurrent();
    if(response.status===404)return false;
    if(!response.ok)throw new Error('Could not check existing DID publication (HTTP '+response.status+').');
    const doc=await response.json();deps.assertCurrent();
    const key=doc.verificationMethod?.find(method=>{const jwk=method.publicKeyJwk;return jwk?.kty===prepared.publicKeyJwk.kty&&jwk.crv===prepared.publicKeyJwk.crv&&jwk.x===prepared.publicKeyJwk.x;});
    if(!key||!(Array.isArray(doc.alsoKnownAs)&&doc.alsoKnownAs.includes(prepared.didKey)))throw new Error('A different identity is already published. Refresh the identity panel before continuing.');
    return true;
}
/** @param {CListDidIdentitySession} session @returns {Promise<CListDidPublicationReceipt>} */
async function publishStoredDid(session,deps){
    deps.assertCurrent();if(session.local)throw new Error('A local account has no server to publish a DID document.');
    if(!session.token||!session.username)throw new Error('Not logged in — please log in before publishing a DID.');
    const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key not available — please log in again.');
    const stored=await deps.getIdentityKey();deps.assertCurrent();if(!stored)throw new Error('No identity key found on this account to publish.');
    const derived=await deps.derive(stored.value,key);deps.assertCurrent();
    if(deps.expectedDidKey&&derived.didKey!==deps.expectedDidKey)throw new Error('The stored identity key changed. Reopen the identity panel.');
    const prepared={publicKeyJwk:derived.publicKeyJwk,didKey:derived.didKey,storedValue:stored.value};deps.prepared(prepared);
    if(await checkExistingDidPublication(session,prepared,deps))return {didKey:derived.didKey,existing:true};
    const latest=await deps.getIdentityKey();deps.assertCurrent();if(latest?.value!==stored.value)throw new Error('The stored identity key changed. Reopen the identity panel.');
    return sendDidPublication(session,{publicKeyJwk:derived.publicKeyJwk,didKey:derived.didKey,service:[],alsoKnownAs:[]},deps);
}
// Shared one-shot transport; callers own authorization, key/metadata checks and receipts.
async function sendDidPublication(session,payload,deps){
    deps.assertCurrent();
    deps.sending();let response;
    try{response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/auth/did',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(payload)});}
    catch(cause){const error=new Error('Publication could not be confirmed. Check publication before retrying.');error.uncertain=true;throw error;}
    if(!response.ok)throw new Error('DID publication was rejected (HTTP '+response.status+').');
    // HTTP acceptance is retained even if its optional response body cannot be read.
    const receipt={didKey:payload.didKey,existing:false};deps.accepted(receipt);
    try{await response.json();}catch(error){receipt.warning='The server accepted publication, but its response body could not be read.';}
    return receipt;
}
