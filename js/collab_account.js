/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Collab'] = function (context) {
    let controller;
    return { open() {
        if (!controller) {
            const deps = accountSetupDependencies(context, { label: 'Collab', stateKey: 'collabSetup' });
            controller = createCollabSetupController({ ...deps, key: source => getEncKey(source.storeUrl), fetch: (...args) => fetch(...args) });
        }
        controller.mount(createCollabSetupView(context.container));
    } };
};

/** Compatibility data API; the setup controller separately retains registration/write receipts.
 * @param {string} wsUrl
 * @param {string|null} did
 * @param {CListAccountSession} session
 * @returns {Promise<Object>}
 */
async function registerCollabAccount(wsUrl, did, session) {
    const request = collabSetupRequest(wsUrl), captured = { ...session, storeUrl: session.storeUrl || window.CList.config.flaskSiteUrl };
    const assert = () => assertAccountSession(captured);
    const data = await requestCollabRegistration({ url: request.key.replace(/^wss?:\/\//i, 'https://').replace(/\/$/, '') + '/api/register', token: captured.token, did }, {
        assert, fetch: (...args) => fetch(...args), dispatched() {}, accepted() {}, rejected() {},
    });
    await saveAccount(request, captured); return data;
}

// Captured default used by post-login setup; the generic workflow owns receipts/storage.
function collabSetupAccount(defaults) {
    if (!defaults.COLLAB) return null;
    const base=defaults.COLLAB;const key=base.replace(/^http/,'ws');
    return {key,label:'Collaborative editor',registerUrl:base.replace(/\/$/,'')+'/api/register',data:{type:'Collab',instance:key,title:'collab.mooc.ca',permissions:'e'}};
}
