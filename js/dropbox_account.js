/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Dropbox = {
    reauthorize: ({ key, data }, options = {}) => dropboxOAuthStart(data.appKey || '', key, data.permissions || 'b', data.folder || '/CList', options),
};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Dropbox'] = function (context) {
    let controller = null;
    return { open() {
        controller?.dispose();
        const source = captureDropboxSetupSource(), view = createDropboxSetupView(context.container);
        controller = createDropboxSetupController({
            current: source, back: context.back,
            state: value => { window.CList.state.dropboxSetup = value; },
            start: (request, isCurrent) => dropboxOAuthStart(request.appKey, request.title, request.permissions, request.folder, { isCurrent, feedback: false }),
            log: error => console.error('[Dropbox setup]', error),
        }, view);
        view.bind(controller);
        window.CList.state.dropboxSetup = { phase: 'ready', busy: false };
    } };
};
