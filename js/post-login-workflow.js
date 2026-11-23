// Explicit onboarding writes and read-only reconciliation. No DOM or global account reads.
/** @param {CListPostLoginDescriptor} descriptor @returns {CListPostLoginStep} */
function postLoginStep(descriptor) {
    return {...descriptor,registration:descriptor.registerUrl?'ready':'accepted',record:'ready',ciphertext:null,error:null};
}
function postLoginRows(rows) {
    if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.key!=='string'||typeof row.value!=='string'))throw new Error('Setup could not read stored accounts safely.');
    return new Map(rows.map(row=>[row.key,row.value]));
}
/** @param {CListPostLoginPlan} plan @param {Object} deps */
async function checkPostLoginSetup(plan,deps) {
    deps.assertCurrent();const rows=postLoginRows(await deps.list());deps.assertCurrent();
    for(const step of plan.steps) {
        if(['accepted','existing'].includes(step.record))continue; // Never recreate a subsequently removed accepted seed.
        if(rows.has(step.key)){step.record=step.ciphertext!==null&&rows.get(step.key)===step.ciphertext?'accepted':'existing';step.error=null;}
        else if(step.record==='uncertain')step.record='ready';
    }
}
async function applyPostLoginStep(step,plan,deps) {
    if(['accepted','existing'].includes(step.record))return;
    deps.assertCurrent();const rows=postLoginRows(await deps.list());deps.assertCurrent();
    if(rows.has(step.key)){step.record=step.ciphertext!==null&&rows.get(step.key)===step.ciphertext?'accepted':'existing';step.error=null;return;}
    if(step.record==='uncertain')throw new Error('Check account setup before retrying an unconfirmed account save.');
    if(step.registration==='uncertain')throw new Error('Service registration is unconfirmed. Use the explicit service retry only after checking the service.');
    if(step.registration!=='accepted') {
        deps.assertCurrent();step.registration='uncertain';let response;
        try{response=await deps.fetch(step.registerUrl,{method:'POST',headers:{Authorization:'Bearer '+plan.session.token,'Content-Type':'application/json'}});}
        catch{throw new Error('Service registration could not be confirmed.');}
        if(!response.ok){if(response.status>=400&&response.status<500)step.registration='ready';throw new Error('Service registration returned HTTP '+response.status+'.');}
        step.registration='accepted';deps.assertCurrent();
    }
    if(step.ciphertext===null){step.ciphertext=await deps.encrypt(plan.session.encKey,JSON.stringify(step.data));deps.assertCurrent();}
    // Recheck after encryption, then add only. Never replace a concurrent account.
    const latest=postLoginRows(await deps.list());deps.assertCurrent();
    if(latest.has(step.key)){step.record='existing';step.error=null;return;}
    step.record='uncertain';
    try{await deps.add(step.key,step.ciphertext);step.record='accepted';step.error=null;}
    catch(error){if(error.code==='AlreadyExists'){step.record='existing';step.error=null;}else throw new Error('Account save could not be confirmed. Check setup before retrying.');}
    deps.assertCurrent();
}
/** @param {CListPostLoginPlan} plan @param {Object} deps @param {string|null} onlyKey */
async function runPostLoginSetup(plan,deps,onlyKey=null) {
    await checkPostLoginSetup(plan,deps);
    let firstAttempted=null;
    if(plan.discover&&!plan.discovered&&!onlyKey) {
        // Retain the changelog even if collection discovery fails.
        const first=firstAttempted=plan.steps[0];
        if(first){try{await applyPostLoginStep(first,plan,deps);}catch(error){deps.assertCurrent();deps.failed(error);first.error=error.message;}}
        try {
            const descriptors=await deps.discover();deps.assertCurrent();
            for(const descriptor of descriptors)if(!plan.steps.some(step=>step.key===descriptor.key))plan.steps.push(postLoginStep(descriptor));
            plan.discovered=true;plan.discoveryError=null;
        }catch(error){deps.assertCurrent();deps.failed(error);plan.discoveryError=error.message;}
    }
    for(const step of plan.steps) {
        if(step===firstAttempted||(onlyKey&&step.key!==onlyKey))continue;
        try{await applyPostLoginStep(step,plan,deps);}catch(error){deps.assertCurrent();deps.failed(error);step.error=error.message;}
    }
}
