function oauthAccountGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function oauthAccountFlush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
function oauthAccountFixture() {
    _oauthAccountSaver = null;
    const records = new Map(), writes = [], reads = [], messages = [], effects = [], keys = [], behavior = {}; let token = 'private-kv-token', username = 'User';
    window.CList.state = { username: 'none', authEpoch: 1, reader: { requestId: 0 } }; window.CList.config = { flaskSiteUrl: 'https://identity.invalid' };
    window.CList.keys = { ACCESS_TOKEN: 'access_token', USERNAME: 'username' }; window.CList.schemas = { Dropbox: {}, Mastodon: {}, WordPress: {} }; window.CList.accountHooks = {}; window.CList.accounts = [];
    window.CList.storage = { kv: {
        async put(key, value) { writes.push([key, value]); if (behavior.put) await behavior.put(); records.set(key, value); if (behavior.afterPut) await behavior.afterPut(); },
        async get(key) { reads.push(key); if (behavior.get) await behavior.get(); return records.has(key) ? { value: records.get(key) } : null; },
        async list() { if (behavior.list) await behavior.list(); return [...records].map(([key, value]) => ({ key, value })); },
    } };
    Object.assign(globalThis, { currentEditor: 'texteditor', getSiteSpecificCookie: (store, key) => key === 'username' ? username : token,
        getEncKey: async store => { keys.push(store); if (behavior.key) return await behavior.key(); return 'private-encryption-key'; },
        encryptWithKey: async (key, text) => { if (behavior.encrypt) await behavior.encrypt(); return 'encrypted:' + text; },
        decryptWithKey: async (key, text) => text.slice(10), updateUIVisibility: () => effects.push('visibility'),
        playAccounts: async () => { effects.push('navigate'); if (behavior.navigate) await behavior.navigate(); },
        showStatusMessage: message => messages.push(message),
        showModal(body) { document.getElementById('generic-modal')?.remove(); const modal = document.createElement('div'); modal.id = 'generic-modal'; modal.appendChild(body); document.body.appendChild(modal); },
    });
    const data = { type: 'Dropbox', appKey: 'private-app-key', id: 'private-service-token', refresh: 'private-refresh', permissions: 'b', folder: '/Captured', extension: { kept: true } };
    return { records, writes, reads, messages, effects, keys, behavior, data,
        save(options) { return OAuthClient.saveAccount('Dropbox', 'Files', data, options); },
        button(label) { return Array.from(document.getElementById('generic-modal')?.querySelectorAll('button') || []).find(button => button.textContent === label); },
        text: () => document.getElementById('generic-modal')?.textContent || '', token(value) { token = value; }, user(value) { username = value; },
        dispose() { document.getElementById('generic-modal')?.remove(); },
    };
}
const oauthAccountCases = [
    ['superseded provider refresh hooks cannot navigate or report over newer completion', async check => {
        const f = oauthAccountFixture(), provider = oauthAccountGate();
        const first = f.save({ afterRefresh: () => provider.promise }); await oauthAccountFlush();
        await OAuthClient.saveAccount('Dropbox', 'Newer', { ...f.data, title: 'Newer' });
        const effects = [...f.effects], messages = [...f.messages]; provider.resolve(); const result = await first;
        check(!result.refreshed && JSON.stringify(f.effects) === JSON.stringify(effects), 'superseded provider hook has no later navigation');
        check(JSON.stringify(f.messages) === JSON.stringify(messages) && window.CList.state.oauthAccountSave.phase === 'complete', 'newer success/state retained'); f.dispose();
    }],
    ['older account-list refreshes cannot replace a newer accepted save', async check => {
        const f = oauthAccountFixture(), firstList = oauthAccountGate(); let listings = 0;
        window.CList.storage.kv.list = async () => {
            const snapshot = [...f.records].map(([key, value]) => ({ key, value }));
            return ++listings === 1 ? firstList.promise : snapshot;
        };
        const first = f.save(); await oauthAccountFlush();
        const oldSnapshot = [...f.records].map(([key, value]) => ({ key, value }));
        await OAuthClient.saveAccount('Dropbox', 'Newer', { ...f.data, title: 'Newer' });
        const before = [...f.effects]; firstList.resolve(oldSnapshot); const result = await first;
        check(window.CList.accounts.length === 2 && window.CList.accounts.some(account => account.key === 'Newer'), 'older list cannot discard the newer account');
        check(!result.refreshed && JSON.stringify(f.effects) === JSON.stringify(before), 'superseded refresh has no navigation/visibility effects');
        await f.save();
        check(f.writes.length === 2 && window.CList.accounts.length === 2, 'explicit refresh of accepted receipt never repeats a write'); f.dispose();
    }],
    ['superseded refresh failures cannot replace newer success feedback', async check => {
        const f = oauthAccountFixture(), firstList = oauthAccountGate(); let listings = 0;
        window.CList.storage.kv.list = async () => ++listings === 1 ? firstList.promise : [...f.records].map(([key, value]) => ({ key, value }));
        const first = f.save(); await oauthAccountFlush();
        await OAuthClient.saveAccount('Dropbox', 'Newer', { ...f.data, title: 'Newer' });
        const messages = [...f.messages]; firstList.reject(new Error('Older list unavailable')); await first;
        check(!document.getElementById('generic-modal') && JSON.stringify(f.messages) === JSON.stringify(messages), 'older failure cannot replace newer success');
        check(window.CList.state.oauthAccountSave.phase === 'complete' && f.writes.length === 2, 'newer operation state and writes retained'); f.dispose();
    }],
    ['real shared account writer captures callback data/session and normalizes title without losing extensions', async check => {
        const f = oauthAccountFixture(), gate = oauthAccountGate(); f.behavior.key = () => gate.promise; const pending = f.save(); f.data.id = 'newer-token'; await oauthAccountFlush();
        window.CList.state.username = 'User'; gate.resolve('captured-key'); const result = await pending, data = JSON.parse(f.records.get('Files').slice(10));
        check(result.status === 'saved' && result.refreshed && data.id === 'private-service-token' && data.title === 'Files' && data.extension.kept, 'detached payload and shared title normalization');
        check(f.keys.every(key => key === 'https://identity.invalid') && window.CList.accounts[0].key === 'Files' && f.effects.includes('visibility'), 'captured key target and real account loader');
        check(Object.keys(window.CList.state.oauthAccountSave).sort().join() === 'busy,phase,receipt' && !JSON.stringify(window.CList.state.oauthAccountSave).includes('private-'), 'safe state'); f.dispose();
    }],
    ['pending duplicates and completed callbacks do not write the same captured account again', async check => {
        const f = oauthAccountFixture(), gate = oauthAccountGate(); f.behavior.put = () => gate.promise;
        const first = f.save(), duplicate = f.save(); check(first === duplicate, 'same pending promise'); await oauthAccountFlush(); gate.resolve(); await first; await f.save();
        check(f.writes.length === 1 && f.effects.filter(value => value === 'navigate').length === 1, 'accepted receipt reused without navigation/write replay');
        window.CList.storage.kv = { ...window.CList.storage.kv }; await f.save();
        check(f.writes.length === 2, 'replaced storage context cannot inherit an older accepted receipt'); f.dispose();
    }],
    ['key/encryption errors fail before persistence and permit explicit account-only retry', async check => {
        const f = oauthAccountFixture(); f.behavior.encrypt = async () => { throw new Error('Encryption failed'); }; const result = await f.save();
        check(result.status === 'failed' && !f.writes.length && f.text().includes('Encryption failed'), 'pre-write failure visible');
        f.behavior.encrypt = null; await f.button('Retry account save').click(); await oauthAccountFlush(); check(f.writes.length === 1 && f.records.has('Files'), 'explicit retry uses shared writer'); f.dispose();
    }],
    ['accepted write and refresh failure are separate with read-only refresh retry', async check => {
        const f = oauthAccountFixture(); f.behavior.list = async () => { throw new Error('List unavailable'); }; const result = await f.save();
        check(result.status === 'saved' && !result.refreshed && f.text().includes('Account saved, but refresh failed') && f.writes.length === 1, 'accepted write remains accepted');
        f.behavior.list = null; await f.button('Retry refresh').click(); await oauthAccountFlush();
        check(f.writes.length === 1 && window.CList.accounts[0].key === 'Files', 'refresh retry never encrypts/writes account again'); f.dispose();
    }],
    ['uncertain post-write response requires read-only confirmation without rewriting', async check => {
        const f = oauthAccountFixture(); f.behavior.afterPut = async () => { throw new Error('Response lost'); }; const result = await f.save();
        check(result.status === 'uncertain' && f.button('Check saved account') && !window.CList.accounts.length, 'uncertain receipt shown'); await f.save();
        check(f.writes.length === 1, 'duplicate uncertain callback cannot retry write'); f.behavior.afterPut = null; await f.button('Check saved account').click(); await oauthAccountFlush();
        check(f.writes.length === 1 && f.reads.length === 1 && window.CList.accounts[0].key === 'Files', 'ciphertext confirmation and refresh are read-only'); f.dispose();
    }],
    ['unconfirmed storage remains a reviewed explicit retry, never an automatic account write', async check => {
        const f = oauthAccountFixture(); f.behavior.put = async () => { throw new Error('Write unavailable'); }; await f.save(); f.behavior.put = null;
        await f.button('Check saved account').click(); await oauthAccountFlush(); check(f.writes.length === 1 && f.text().includes('does not confirm'), 'check does not resend');
        await f.button('Retry account save').click(); await oauthAccountFlush(); check(f.writes.length === 2 && f.records.has('Files'), 'only explicit retry resends original account'); f.dispose();
    }],
    ['session changes during encryption cancel before dispatch and late accepted writes do not install accounts', async check => {
        const f = oauthAccountFixture(), gate = oauthAccountGate(); f.behavior.encrypt = () => gate.promise; const pending = f.save(); await oauthAccountFlush(); f.token('new-token'); gate.resolve(); await pending;
        check(!f.writes.length && !f.effects.length && !document.getElementById('generic-modal'), 'expired encryption has no write/UI effects'); f.dispose();
        const g = oauthAccountFixture(), write = oauthAccountGate(); g.behavior.put = () => write.promise; const accepted = g.save(); await oauthAccountFlush(); g.user('Different'); write.resolve(); const result = await accepted;
        check(result.status === 'saved' && !result.refreshed && !g.effects.length && !window.CList.accounts.length, 'accepted original write has no new-session effects'); g.dispose();
    }],
    ['newer reader/modal surfaces are not navigated or replaced by callback completion', async check => {
        const f = oauthAccountFixture(), gate = oauthAccountGate(); let after = 0; f.behavior.put = () => gate.promise; const pending = f.save({ afterRefresh: () => { after++; } }); await oauthAccountFlush(); window.CList.state.reader.requestId++;
        gate.resolve(); await pending; check(after === 0 && !f.effects.includes('navigate') && window.CList.accounts.length === 1, 'newer reader preserved while account data refreshes'); f.dispose();
        const g = oauthAccountFixture(), other = oauthAccountGate(); g.behavior.list = () => other.promise; const delayed = g.save(); await oauthAccountFlush(); const body = document.createElement('p'); body.textContent = 'Newer dialog'; showModal(body); other.reject(new Error('Old refresh failed')); await delayed;
        check(g.text() === 'Newer dialog' && g.messages.at(-1).includes('refresh failed'), 'newer modal retained'); g.dispose();
    }],
    ['provider refresh failure and expired recovery callbacks never repeat a stored write', async check => {
        const f = oauthAccountFixture(); await f.save({ afterRefresh: async () => { throw new Error('Provider refresh failed'); } });
        check(f.writes.length === 1 && f.button('Retry refresh'), 'provider refresh separated'); const retry = f.button('Retry refresh'); f.token('expired'); await retry.click(); await oauthAccountFlush();
        check(f.writes.length === 1 && f.text().includes('Provider refresh failed'), 'expired recovery control inert'); f.dispose();
    }],
];
