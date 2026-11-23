/// <reference path="./clist-types.js" />
// Exact captured identity removal. Each accepted step has its own receipt.
function didRemovalIdentity(doc){return doc?JSON.stringify({id:doc.id||'',verificationMethod:doc.verificationMethod||[]}):null;}
async function readRemovalDocument(session,deps){
    deps.assertCurrent();if(session.local)return null;
    const response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/users/'+encodeURIComponent(session.username)+'/did.json',{cache:'no-store'});deps.assertCurrent();
    if(response.status===404)return null;if(!response.ok)throw new Error('Could not check DID removal (HTTP '+response.status+').');
    const doc=await response.json();deps.assertCurrent();if(!doc||typeof doc!=='object'||Array.isArray(doc))throw new Error('The DID document could not be identified safely.');return doc;
}
async function readRemovalKey(deps){const row=await deps.getIdentityKey();deps.assertCurrent();return row;}
/** @param {CListDidIdentitySession} session @returns {Promise<CListDidRemovalPlan>} */
async function prepareDidRemoval(session,deps){
    deps.assertCurrent();if(!session.token||!session.username)throw new Error('Please log in before removing identity.');
    const row=await readRemovalKey(deps),doc=await readRemovalDocument(session,deps);return {storedValue:row?.value??null,documentIdentity:didRemovalIdentity(doc),keyRemoved:!row,documentRemoved:session.local||!doc};
}
async function checkDidRemoval(plan,session,deps){
    const row=await readRemovalKey(deps),doc=await readRemovalDocument(session,deps);
    if(row&&row.value!==plan.storedValue)throw new Error('The stored identity changed. Refresh identity and confirm the new target.');
    if(doc&&didRemovalIdentity(doc)!==plan.documentIdentity)throw new Error('The public identity changed. Refresh identity and confirm the new target.');
    return {keyRemoved:!row,documentRemoved:session.local||!doc};
}
/** @param {CListDidRemovalPlan} plan @param {CListDidIdentitySession} session */
async function removeCapturedDid(plan,session,deps){
    const checked=await checkDidRemoval(plan,session,deps);deps.checked(checked);const errors=[];
    if(!plan.keyRemoved&&!checked.keyRemoved){
        deps.assertCurrent();deps.progress('removing-key');
        try{await deps.removeKey();deps.keyRemoved();}
        catch(error){errors.push('Stored key removal could not be confirmed.');}
    }
    deps.assertCurrent();
    if(!plan.documentRemoved&&!checked.documentRemoved){
        // Recheck both targets after a failed/accepted private-key operation; never delete a new identity.
        const latest=await checkDidRemoval(plan,session,deps);deps.checked(latest);
        if(!latest.documentRemoved){
            deps.assertCurrent();deps.progress('removing-document');
            try{const response=await deps.fetch(session.storeUrl.replace(/\/$/,'')+'/auth/did',{method:'DELETE',headers:{Authorization:'Bearer '+session.token}});
                if(response.ok)deps.documentRemoved();else if(response.status===404&&!await readRemovalDocument(session,deps))deps.documentRemoved();else errors.push('Public DID removal was rejected (HTTP '+response.status+').');
            }catch(error){errors.push('Public DID removal could not be confirmed.');}
        }
    }
    return {errors};
}
