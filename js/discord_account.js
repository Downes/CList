/// <reference path="./clist-types.js" />
// Registry/integration bridge. Requests, subscription/admin state and views are separate.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Discord = { decorateForm: context => decorateDiscordAccountForm(context) };
/** @param {CListAccountFlowContext} context @returns {CListAccountFlow} */
window.CList.accountFlows.Discord = function (context) {
    let controller; const admins = new WeakMap(), adminJobs = new Map();
    function capture() {
        const source = captureOAuthAccountSaveSource(), kv = source.kv;
        return { ...source, headers: { ...kvstoreAuthHeader() }, add: kv.add.bind(kv), remove: kv.remove.bind(kv) };
    }
    const fetcher = (...args) => fetch(...args), current = currentOAuthAccountSaveSource;
    function manageChannels(controls) {
        let entry = admins.get(controls.panelEl);
        if (!entry || entry.token !== controls.botTokenEl || entry.status !== controls.statusEl) {
            const admin = createDiscordAdminController({ capture, current, jobs: adminJobs,
                read: token => readDiscordAdminChannels(token, fetcher),
                write: (command, token, values, accepted) => writeDiscordAdminChannel(command, token, values, fetcher, accepted),
                changed: () => controller?.load(), state: value => { window.CList.state.discordAdminSetup = value; },
                log: error => console.error('[Discord admin]', error),
            }, createDiscordAdminView(controls)); entry = { admin, token: controls.botTokenEl, status: controls.statusEl }; admins.set(controls.panelEl, entry);
        }
        return entry.admin.load();
    }
    return { open() {
        controller ||= createDiscordSetupController({ capture, current, accounts: context.getAccounts, parse: parseAccountValue,
            read: source => readDiscordSetupChannels(source.headers, fetcher), key: source => getEncKey(source.storeUrl), save: saveAccount,
            async confirmRemoval(job, key) {
                const stored = await job.source.get(job.key);
                const data = stored ? JSON.parse(await decryptWithKey(key, stored.value)) : null;
                if (!data || accountRecordFromData(job.key, data).value !== job.original) throw Object.assign(new Error('The saved account changed. Reload channels before removing it.'), { definite: true });
            },
            reload: context.reloadAccounts, refresh: context.refreshList, back: context.back,
            install(accounts, source) { window.CList.accounts = accounts; if (oauthAccountSaveSurfaceCurrent(source)) { populatePostOptions(accounts); populateReadAccountList(accounts); updateUIVisibility(); } },
            state: value => { window.CList.state.discordAccountSetup = value; }, log: error => console.error('[Discord setup]', error),
        });
        return controller.mount(createDiscordSetupView(context.container), manageChannels);
    }, manageChannels };
};
