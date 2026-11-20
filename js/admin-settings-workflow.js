// Explicit transport and normalization. No controls, navigation or global session reads.
/** @returns {CListAdminSettingsData} */
function normalizeAdminSettings(schema,values) {
    if(!Array.isArray(schema)||!values||typeof values!=='object'||Array.isArray(values))throw new Error('Invalid settings response.');
    const keys=new Set();
    const fields=schema.map(field=>{
        if(!field||typeof field.key!=='string'||!field.key||keys.has(field.key)||typeof field.label!=='string')throw new Error('Invalid settings schema.');
        keys.add(field.key);return {key:field.key,label:field.label,type:typeof field.type==='string'?field.type:'text',sensitive:!!field.sensitive,help:typeof field.help==='string'?field.help:''};
    });
    const normalized=Object.fromEntries(fields.map(field=>{
        const value=Object.prototype.hasOwnProperty.call(values,field.key)?values[field.key]:undefined;
        if(value!==undefined&&value!==null&&!['string','number','boolean'].includes(typeof value))throw new Error('Invalid settings value.');
        return [field.key,value==null?(field.type==='boolean'?'true':''):String(value)];
    }));
    return {schema:fields,values:normalized};
}
function adminSettingsHeaders(app,session) {
    if(session.local||!session.token)throw new Error('Administrative settings require a hosted account.');
    let url;try{url=new URL(app.baseUrl);}catch{throw new Error('Invalid settings server URL.');}
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Invalid settings server URL.');
    return {Authorization:'Bearer '+session.token,...(app.requiresKvstoreUrlHeader?{'X-Kvstore-Url':session.storeUrl}:{})};
}
/** @param {CListAdminApp} app @param {CListAdminSession} session @param {Object} deps @returns {Promise<CListAdminSettingsData>} */
async function readAdminSettings(app,session,deps) {
    deps.assertCurrent();const headers=adminSettingsHeaders(app,session);
    const response=await deps.fetch(app.baseUrl.replace(/\/$/,'')+'/admin/settings',{headers,cache:'no-store'});deps.assertCurrent();
    if(!response.ok)throw new Error('Could not load settings (HTTP '+response.status+').');
    const body=await response.json();deps.assertCurrent();return normalizeAdminSettings(body.schema,body.values);
}
/** @param {CListAdminApp} app @param {CListAdminSession} session @param {CListAdminWrite} operation @param {Object} deps @returns {Promise<CListAdminSettingsData>} */
async function writeAdminSettings(app,session,operation,deps) {
    deps.assertCurrent();const headers=adminSettingsHeaders(app,session);operation.pending=true;
    let response;
    try{response=await deps.fetch(app.baseUrl.replace(/\/$/,'')+'/admin/settings',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(operation.payload)});}
    catch{operation.uncertain=true;throw new Error('Save could not be confirmed. Check current settings before saving again.');}
    if(!response.ok){operation.uncertain=response.status>=500;operation.rejected=!operation.uncertain;throw new Error('Save returned HTTP '+response.status+'.');}
    operation.accepted=true; // Retain HTTP acceptance before reading a body or checking a replaced panel.
    let body;
    try{body=await response.json();}catch{throw new Error('Save was accepted, but its response could not be read. Check current settings.');}
    deps.assertCurrent();
    if(!body||!body.values||Object.keys(operation.payload).some(key=>!Object.prototype.hasOwnProperty.call(body.values,key)))throw new Error('Save was accepted, but its returned values were incomplete. Check current settings.');
    return normalizeAdminSettings(operation.schema,body.values);
}
function adminBooleanLabel(label,on) {return on||!/enabled$/i.test(label)?label:label.replace(/enabled$/i,word=>word[0]==='E'?'Disabled':'disabled');}
