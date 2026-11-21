function createChatGptTemplateRequests(deps) {
    let pending = 0;
    const state = () => {
        /** @type {CListTemplateRequestState} */
        const value = { pending }; deps.state(value);
    };
    return {
        async generate(templateType, outputFormat, caller = () => true) {
            const source = deps.source(); let account = null;
            const assertCurrent = () => {
                if (!caller() || deps.source() !== source || (account && JSON.stringify(deps.account()) !== JSON.stringify(account)))
                    throw Object.assign(Error('The template generation account or session changed.'), { code: 'ExpiredTemplateRequest' });
            };
            pending++; state();
            try {
                assertCurrent();
                await deps.accounts(); assertCurrent();
                account = { ...deps.account() }; assertCurrent();
                return await requestChatGptTemplate(templateType, outputFormat, account, { assertCurrent, fetch: deps.fetch });
            } finally { pending--; state(); }
        }
    };
}
let _chatGptTemplateRequests = null;
function getChatGptTemplateRequests() {
    if (!_chatGptTemplateRequests) _chatGptTemplateRequests = createChatGptTemplateRequests({
        source: () => JSON.stringify([readerSession(), window.CList.state.authEpoch || 0]),
        accounts: () => ensureAccountsLoaded(),
        account: () => requireAccountWithPermission('g', 'No ChatGPT account found. Open Accounts and add an account with permission "g".'),
        fetch: (...args) => fetch(...args),
        state: value => { window.CList.state.templateRequests = value; }
    });
    return _chatGptTemplateRequests;
}
