/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Annotate'] = function (context) {
    let controller;
    return { open() {
        if (!controller) {
            const deps = accountSetupDependencies(context, { label: 'Annotate', stateKey: 'annotateSetup' });
            controller = createAnnotateSetupController({ ...deps, key: source => getEncKey(source.storeUrl), fetch: (...args) => fetch(...args) });
        }
        controller.mount(createAnnotateSetupView(context.container, window.CList.defaults.ANNOTATIONS));
    } };
};

/** Compatibility data API. Registration/account receipts belong to the setup controller.
 * @param {{url:string,title:string,permissions:string}} account
 * @param {CListAccountSession} session
 * @param {function(string):void} onProgress
 * @returns {Promise<void>}
 */
async function registerAnnotateAccount(account, session, onProgress = () => {}) {
    const request = annotateSetupRequest(account), captured = { ...session, storeUrl: session.storeUrl || window.CList.config.flaskSiteUrl };
    const assert = () => assertAccountSession(captured), transport = (...args) => fetch(...args);
    await checkAnnotateSetupServer(request.key, { assert, fetch: transport });
    onProgress('Registering on ' + request.key + '…');
    await requestAnnotateRegistration({ url: request.key, token: captured.token }, { assert, fetch: transport, dispatched() {}, accepted() {}, rejected() {} });
    await saveAccount(request, captured);
}

function annotationSetupAccount(defaults) {
    if (!defaults.ANNOTATIONS) return null;
    const key=defaults.ANNOTATIONS;
    return {key,label:'Annotations',registerUrl:key.replace(/\/$/,'')+'/api/register',data:{type:'Annotate',instance:key,title:key.replace('https://',''),permissions:'rw'}};
}
