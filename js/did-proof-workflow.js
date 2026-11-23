// Identity proof uses explicit reads and crypto; no publishing or storage writes.
function didProofTarget(server,username){
    const name=String(username||'').trim().toLowerCase();if(!server?.trim()||!name)throw new Error("Enter the other account's server URL and username.");
    let url;try{url=new URL(server.trim());}catch{throw new Error('Enter a valid HTTP or HTTPS account server URL.');}
    if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Enter an HTTP or HTTPS account server URL without credentials, query or fragment.');
    return {url:url.toString().replace(/\/$/,''),username:name,label:name+'@'+url.hostname};
}
async function runDidIdentityProof(target,deps){
    deps.assertCurrent();deps.progress('fetching');
    const response=await deps.fetch(target.url+'/users/'+encodeURIComponent(target.username)+'/did.json',{signal:deps.signal});deps.assertCurrent();
    if(!response.ok)throw new Error('Could not fetch the other account’s DID document (HTTP '+response.status+').');
    const doc=await response.json();deps.assertCurrent();const publicKey=doc.verificationMethod?.[0]?.publicKeyJwk;
    if(!publicKey)throw new Error('That account has no public key on file.');
    const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Not logged in — please log in first.');
    const stored=await deps.getIdentityKey();deps.assertCurrent();if(!stored)throw new Error('No identity key stored for this account.');
    const privateKey=await deps.decrypt(stored.value,key);deps.assertCurrent();deps.progress('signing');
    const challenge=deps.challenge(),signature=await deps.sign(privateKey,challenge);deps.assertCurrent();deps.progress('verifying');
    const verified=await deps.verify(publicKey,challenge,signature);deps.assertCurrent();
    const latest=await deps.getIdentityKey();deps.assertCurrent();if(latest?.value!==stored.value)throw new Error('The identity key changed while proving it. Retry the proof.');
    return {verified:!!verified,otherLabel:target.label,didKey:Array.isArray(doc.alsoKnownAs)?doc.alsoKnownAs.find(value=>typeof value==='string'&&value.startsWith('did:key:'))||'':''};
}
