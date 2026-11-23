const optionsShellObservers = new Set();
class OptionsShellObserver {
    constructor(callback) { this.callback = callback; }
    observe() { optionsShellObservers.add(this); }
    disconnect() { optionsShellObservers.delete(this); }
}
let previousOptionsShell = null;
function optionsShellGate() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function optionsShellFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function optionsShellFixture() {
    previousOptionsShell?.dispose();
    const body = document.createElement('div'); body.id = 'left-pane-body'; document.body.appendChild(body);
    const errors = [], calls = [], messages = [], stats = []; let session = 1, key = 'a', gate = null, statsGate = null;
    const install = () => {
        const captured = session, accountKey = key;
        globalThis.localrssCurrentAccount = { type: 'LOCALRSS', database: 'db-' + key, serviceUrl: 'https://rss.invalid' };
        globalThis._readerContext = { account: localrssCurrentAccount, accountKey,
            isCurrent: () => session === captured && key === accountKey,
            isAccountCurrent: () => session === captured && key === accountKey };
    };
    install();
    Object.assign(globalThis, {
        readerState: () => ({ status: 'ready' }), localrssReadState: () => ({ filter: 'unread' }),
        _localrssAuthHeaders: () => ({ Authorization: 'Bearer synthetic' }),
        parseAccountValue: account => JSON.parse(account.value), openLeftPane() {},
        showLeftOverlaySection: () => { body.querySelector('#feed-options-section').style.display = 'block'; },
        showErrorModal: (message, options) => errors.push({ message, title: options?.title }),
        showStatusMessage: message => messages.push(message),
        _localrssConnectionStatusText: () => 'Synthetic connection',
        _localrssSectionHeading: text => { const h = document.createElement('h3'); h.textContent = text; return h; },
        _localrssFeedsSection() {}, _localrssImportExportSection() {},
        _localrssSearchPosts: target => { if (target.current()) calls.push(['search', localrssSearchInput(target)]); },
        _localrssConfirm: (_message, _title, accept) => accept(),
        fetchLocalrssStatistics: async (account, deps) => { stats.push({ account, headers: deps.headers }); return statsGate ? statsGate.promise : { feeds: 3, unread: 2 }; },
        markLocalrssDatabaseRead: async (account, deps) => { calls.push(['mark', account.database, deps.headers.Authorization]); if (gate) await gate.promise; },
        localrssLoad: async () => { calls.push(['load', key]); },
        _localrssReconnect: async () => { calls.push(['reconnect', key]); },
        switchReaderAccount: async next => { key = next; install(); },
        MutationObserver: OptionsShellObserver
    });
    window.CList.accounts = ['a', 'b'].map(name => ({ key: name, value: JSON.stringify({ type: 'LOCALRSS', database: 'db-' + name, title: name }) }));
    const f = { body, errors, calls, messages, stats,
        open: () => localrssOptionsOverlay(), target: () => _localrssOptionsTarget,
        root: () => _localrssOptionsTarget.root,
        trigger: () => Array.from(_localrssOptionsTarget.root.querySelectorAll('button')).find(button => button.title === 'Pop out feed options'),
        modal: () => document.getElementById('generic-modal-stacked'),
        modalButtons: () => Array.from(document.getElementById('generic-modal-stacked').querySelectorAll('button')),
        expire: () => { session++; },
        notify: () => { for (const observer of [...optionsShellObservers]) observer.callback(); },
        deferredStats: () => { statsGate = optionsShellGate(); return statsGate; },
        immediateStats: () => { statsGate = null; },
        deferredMark: () => { gate = optionsShellGate(); return gate; },
        dispose() { _localrssOptionsPresentation?.dispose(); body.remove(); }
    };
    previousOptionsShell = f; return f;
}
const optionsShellCases = [
    ['real Options panel/target survives pop-out and receives pending statistics', async check => {
        const f = optionsShellFixture(), stats = f.deferredStats(), opening = f.open(), target = f.target(), root = f.root();
        const input = root.querySelector('#localrss-search-input'); input.value = 'unfinished query';
        const trigger = f.trigger(); trigger.focus(); trigger.onclick();
        check(f.modal().contains(root) && target.current(), 'captured target remains current in modal');
        check(root.querySelector('#localrss-search-input') === input && input.value === 'unfinished query', 'same draft node retained');
        check(root.classList.contains('menu-shell-surface'), 'modal surface sizing enabled');
        if (document.defaultView) check(document.defaultView.getComputedStyle(root).position === 'static', 'real overlay CSS flows inside modal');
        stats.resolve({ feeds: 8, unread: 6 }); await opening;
        check(root.querySelector('#localrss-stats-pill').textContent.includes('feeds=8'), 'captured stats update moved panel');
        f.modalButtons()[0].onclick();
        check(root.parentNode === f.body && !root.classList.contains('menu-shell-surface') && target.current(), 'Back restores live overlay');
        check(document.activeElement === trigger && input.value === 'unfinished query', 'Back restores focus and draft');
    }],
    ['pending Mark all retains original account and duplicate guard across surfaces', async check => {
        const f = optionsShellFixture(); await f.open(); const target = f.target(), gate = f.deferredMark();
        const button = Array.from(f.root().querySelectorAll('button')).find(node => node.textContent === 'Mark all as read');
        button.onclick(); f.trigger().onclick(); button.onclick();
        check(f.calls.filter(call => call[0] === 'mark').length === 1 && button.disabled && target.pending, 'one pending write in modal');
        f.modalButtons()[0].onclick(); button.onclick(); check(target.pending && button.disabled, 'Back retains pending lock');
        gate.resolve(); await optionsShellFlush();
        check(!target.pending && !button.disabled && f.messages.length === 1, 'completion unlocks original control');
        check(f.calls[0][1] === 'db-a' && f.calls[0][2] === 'Bearer synthetic', 'write uses captured database/headers');
    }],
    ['closing Options disposes shell and suppresses late statistics and old triggers', async check => {
        const f = optionsShellFixture(), gate = f.deferredStats(), opening = f.open(), target = f.target();
        const root = f.root(), trigger = f.trigger(), oldOpen = trigger.onclick;
        trigger.onclick(); const close = root.querySelector('[title="Close"]'); close.onclick();
        check(target.closed && !target.current() && !f.modal() && !root.isConnected, 'Options close invalidates target and removes modal/overlay');
        oldOpen(); gate.resolve({ feeds: 99 }); await opening;
        check(!f.modal() && root.querySelector('#localrss-stats-pill').textContent === 'Loading stats…', 'old trigger and late stats are ignored');
    }],
    ['replacing Options closes old pop-out without overwriting newer focus or draft', async check => {
        const f = optionsShellFixture(), gate = f.deferredStats(), first = f.open(), oldTarget = f.target(); f.trigger().onclick();
        const oldRoot = f.root(), oldClose = f.modalButtons()[1].onclick;
        const outside = document.createElement('input'); f.body.appendChild(outside); outside.focus(); f.immediateStats(); await f.open();
        const next = f.target(); check(next !== oldTarget && oldTarget.closed && !oldRoot.isConnected && !f.modal(), 'replacement disposes original presentation');
        oldClose(); gate.resolve({ feeds: 99 }); await first;
        check(document.activeElement === outside && next.current() && next.root.querySelector('#localrss-stats-pill').textContent.includes('feeds=3'), 'late callbacks preserve newer panel and focus');
    }],
    ['expired session closes pop-out without allowing old target actions', async check => {
        const f = optionsShellFixture(); await f.open(); const target = f.target(); f.trigger().onclick(); f.expire(); f.notify();
        check(!f.modal() && f.root().parentNode === f.body && !target.current(), 'expired ownership returns overlay without modal');
        await target.show('read'); await target.reconnect(); target.confirmMarkAll(document.createElement('button')); f.trigger().onclick();
        check(!f.calls.length && !f.modal(), 'expired actions and trigger send nothing');
    }],
    ['database switch returns old overlay before mounting a fresh account target', async check => {
        const f = optionsShellFixture(); await f.open(); const old = f.target(); f.trigger().onclick();
        const select = f.root().querySelector('#localrss-db-select'); select.value = 'b'; await select.onchange();
        check(!f.modal() && old.closed && f.target().accountKey === 'b' && f.target().current(), 'switch installs fresh database target');
        check(f.stats.at(-1).account.database === 'db-b' && f.root().parentNode === f.body, 'new statistics target captured account');
    }],
    ['existing modal rejection remains visible and does not close either panel', async check => {
        const f = optionsShellFixture(); await f.open(); const content = document.createElement('input'); showStackedModal(content);
        f.trigger().onclick(); check(f.errors.length === 1 && f.modal().contains(content) && f.target().current(), 'existing modal preserved with visible error');
        f.modal().remove(); f.trigger().onclick(); check(f.modal().contains(f.root()), 'explicit pop-out retry succeeds');
    }]
];
