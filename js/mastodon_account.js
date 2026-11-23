/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Mastodon = {
    reauthorize: ({ key, data }, options = {}) => mastodonOAuthStart(data.title || key, key, data.permissions || 'rw', { ...options, reauthorization: { maxlength: data.maxlength, public: data.public } }),
};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Mastodon'] = function (context) {
    let controller;
    return { open() {
        controller ||= createMastodonSetupController(mastodonSetupDependencies(context));
        controller.mount(createMastodonSetupView(context.container));
    } };
};
