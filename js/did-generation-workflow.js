/// <reference path="./clist-types.js" />
// First-time identity creation only. Add-if-absent; never rotate an existing key.
async function readGenerationStoredKey(deps){try{const row=await deps.getIdentityKey();deps.assertCurrent();return row;}catch(error){deps.assertCurrent();if(error.code==='NotFound')return null;throw error;}}
/** @returns {Promise<CListDidKeyReceipt|null>} */
async function inspectDidGeneration(deps){
    deps.assertCurrent();const row=await readGenerationStoredKey(deps);if(!row)return null;
    const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key not available — please log in again.');
    const identity=await deps.derive(row.value,key);deps.assertCurrent();return {didKey:identity.didKey,existing:true};
}
/** @param {CListDidIdentitySession} session @returns {Promise<CListDidKeyReceipt>} */
async function generateFirstDid(session,deps){
    deps.assertCurrent();if(!session.token||!session.username)throw new Error('Not logged in — please log in before generating an identity.');
    const existing=await inspectDidGeneration(deps);if(existing)return existing;
    const key=await deps.getKey();deps.assertCurrent();if(!key)throw new Error('Encryption key not available — please log in again.');
    deps.progress('generating');const identity=await deps.generate();deps.assertCurrent();
    const encrypted=await deps.encrypt(identity.keyPair.privateKey,key);deps.assertCurrent();
    const concurrent=await inspectDidGeneration(deps);if(concurrent)return concurrent;
    deps.progress('storing');
    try{await deps.add(encrypted);}
    catch(error){
        if(error.code==='AlreadyExists'){const saved=await inspectDidGeneration(deps);if(saved)return saved;throw new Error('The identity key changed. Reopen the identity panel.');}
        const failure=new Error(['NotAuthenticated','NotAuthorized','InvalidData','NotFound'].includes(error.code)?'The identity key could not be stored. Check your login and retry.':'Key storage could not be confirmed. Check stored identity before retrying.');
        failure.uncertain=!['NotAuthenticated','NotAuthorized','InvalidData','NotFound'].includes(error.code);throw failure;
    }
    const receipt={didKey:identity.didKey,existing:false};deps.stored(receipt);return receipt;
}
