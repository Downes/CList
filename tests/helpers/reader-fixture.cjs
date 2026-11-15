const fs = require('node:fs');
const vm = require('node:vm');
const source = name => fs.readFileSync('js/' + name + '.js', 'utf8');
function fixture() {
    const events = [], contexts = [], timers = [], errors = [], commits = [];
    let token = 'private-token';
    const account = (key, type = 'Test') => ({ key, value: JSON.stringify({ type, title: key, permissions: 'r', id: 'private-credential' }) });
    const CList = { config: { flaskSiteUrl: 'https://kv' }, keys: { ACCESS_TOKEN: 'access_token' },
        state: { username: 'stephen' }, accounts: [account('a'), account('b')], readers: {}, ui: { reader: {
            begin: (account, state, names, run) => events.push({ type: 'begin', title: account.title, state: structuredClone(state), run }),
            complete: account => events.push({ type: 'complete', title: account.title }), clearStatus: () => events.push({ type: 'clear' }),
            reset: () => events.push({ type: 'reset' }), busy() {}, failed: error => errors.push(error.message),
            invalidAccount: () => errors.push('invalid'), unsupported: type => errors.push('unsupported ' + type),
            open() {}, openPublic: () => events.push({ type: 'public' }), accounts() {}, accountsFailed: error => errors.push(error.message),
            menu: (names, selected, run) => events.push({ type: 'menu', names, selected, run }), render: async (items, options) => {
                if (options.isCurrent()) commits.push(items);
            },
        } } };
    const ctx = vm.createContext({ window: { CList }, structuredClone, AbortController,
        escapeHtml: x => String(x), parseAccountValue: record => JSON.parse(record.value),
        getSiteSpecificCookie: () => token, setTimeout: fn => timers.push(fn), isRegistered: () => true,
        ensureAccountsLoaded: async () => CList.accounts,
    });
    for (const name of ['reader-state', 'reader']) vm.runInContext(source(name), ctx);
    CList.readers.Test = { initialize: async (account, context) => contexts.push({ account, context }), feedFunctions: { Timeline() {}, Refresh() {} } };
    return { ctx, CList, events, contexts, timers, errors, commits, account, setToken: value => token = value };
}


module.exports = { fixture };
