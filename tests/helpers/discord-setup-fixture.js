const discordSetupAccountHook = window.CList.accountHooks.Discord;
function discordSetupGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function discordSetupFixture() {
    const account = oauthAccountFixture(), root = document.createElement('div'); document.body.appendChild(root);
    window.CList.schemas.Discord = {}; window.CList.accountHooks.Discord = discordSetupAccountHook;
    const requests = [], deletes = [], effects = [], behavior = {};
    const channels = [{ id: '10', name: '<b>News</b>' }, { id: '20', name: 'Second' }], guilds = [{ id: 'guild/a', name: '<Guild>' }]; let accounts = [];
    const kv = window.CList.storage.kv;
    kv.add = async (key, value) => { if (account.records.has(key)) throw Object.assign(new Error('Account already exists'), { code: 'AlreadyExists' }); await kv.put(key, value); };
    kv.remove = async key => { deletes.push(key); if (behavior.remove) await behavior.remove(); account.records.delete(key); if (behavior.afterRemove) await behavior.afterRemove(); };
    globalThis.kvstoreAuthHeader = () => ({ Authorization: 'Bearer ' + getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) });
    globalThis.parseAccountValue = record => { try { return JSON.parse(record.value); } catch (_) { return null; } };
    globalThis.populateReadAccountList = () => effects.push('read'); globalThis.populatePostOptions = () => effects.push('post');
    globalThis.fetch = async (url, options) => {
        requests.push([url, options]); const parsed = new URL(url), path = parsed.pathname;
        if (options?.method === 'POST' || options?.method === 'DELETE') {
            if (behavior.adminWrite) return await behavior.adminWrite(url, options);
            const payload = JSON.parse(options.body);
            if (options.method === 'DELETE') { const id = decodeURIComponent(path.split('/').at(-1)); const index = channels.findIndex(row => row.id === id); if (index >= 0) channels.splice(index, 1); }
            else channels.push({ id: payload.channel_id || '30', name: payload.name || 'Registered channel' });
            if (behavior.afterAdmin) await behavior.afterAdmin(); return { ok: true, status: 204 };
        }
        if (path === '/channels') { if (behavior.publicRead) return await behavior.publicRead(); return { ok: true, json: async () => structuredClone(channels) }; }
        if (path === '/admin/channels') { if (behavior.adminRead) return await behavior.adminRead(); return { ok: true, json: async () => structuredClone(channels) }; }
        if (path === '/admin/guilds') { if (behavior.guilds) return await behavior.guilds(); return { ok: true, json: async () => structuredClone(guilds) }; }
        throw new Error('Unexpected request');
    };
    const source = captureOAuthAccountSaveSource();
    const flow = window.CList.accountFlows.Discord({ container: root,
        back() { root.innerHTML = ''; }, getAccounts: () => accounts,
        async reloadAccounts() { if (behavior.reload) await behavior.reload(); accounts = await loadAccountRecords({ storeUrl: source.storeUrl, token: source.token, encKey: 'key', isCurrent: () => currentOAuthAccountSaveSource(source) }); return accounts; },
        async refreshList() { effects.push('refresh'); },
    });
    const ready = flow.open();
    function button(text, parent = root) { return Array.from(parent.querySelectorAll('button')).find(node => node.textContent === text); }
    return { account, root, requests, deletes, effects, behavior, channels, guilds, flow, ready, button,
        writes: () => requests.filter(call => ['POST', 'DELETE'].includes(call[1]?.method)),
        async seed(key, data) { account.records.set(key, 'encrypted:' + JSON.stringify(data)); accounts = [accountRecordFromData(key, data)]; await flow.open(); },
        async manage(token = 'private-bot+token/') { root.querySelector('#discord-bot-token').value = token; return root.querySelector('#discord-manage-btn').onclick(); },
        field(id, value) { root.querySelector('#' + id).value = value; },
        text: () => root.textContent, dispose() { root.remove(); account.dispose(); },
    };
}
const discordSetupCases = [
    ['directory reads capture KV auth and render literal channel labels', async check => {
        const f = discordSetupFixture(); await f.ready;
        check(f.requests[0][0] === 'https://discord.mooc.ca/channels' && f.requests[0][1].headers.Authorization === 'Bearer private-kv-token', 'captured directory transport');
        check(!!f.button('<b>News</b>') && !f.root.querySelector('b'), 'literal channel names'); f.dispose();
    }],
    ['subscription writes use add-only shared account persistence and captured original removal keys', async check => {
        const f = discordSetupFixture(); await f.ready; await f.button('<b>News</b>').onclick();
        const data = JSON.parse(f.account.records.get('<b>News</b>').slice(10));
        check(data.type === 'Discord' && data.channel === '<b>News</b>' && data.bot_token === '' && data.permissions === 'rw', 'original subscription shape');
        await f.seed('legacy-key', { type: 'Discord', title: 'Saved', channel: 'Second', permissions: 'rw', extension: true });
        await f.button('Second').onclick(); check(f.deletes[0] === 'legacy-key' && !f.account.records.has('legacy-key'), 'remove exact captured account key');
        check(f.effects.includes('read') && f.effects.includes('post'), 'owned subscription refresh'); f.dispose();
    }],
    ['duplicates, replaced rows and session expiry reject stale subscription commands', async check => {
        const f = discordSetupFixture(); await f.ready; const gate = discordSetupGate(); f.account.behavior.put = () => gate.promise;
        const row = f.button('<b>News</b>'), pending = row.onclick(); check(pending === row.onclick(), 'duplicate subscription shares pending write');
        await oauthAccountFlush(); gate.resolve(); await pending; await row.onclick(); check(f.account.writes.length === 1 && !f.deletes.length, 'old row cannot toggle refreshed account'); f.dispose();
        const g = discordSetupFixture(); await g.ready; const key = discordSetupGate(); g.account.behavior.key = () => key.promise;
        const old = g.button('Second').onclick(); await oauthAccountFlush(); g.account.token('new-session'); key.resolve('key'); await old;
        check(!g.account.writes.length, 'changed session stops pre-write work'); g.dispose();
    }],
    ['subscription refresh failures and unknown writes recover without write replay', async check => {
        const f = discordSetupFixture(); await f.ready; f.behavior.reload = async () => { throw new Error('List unavailable'); }; await f.button('Second').onclick();
        check(!!f.button('Retry refresh') && f.account.writes.length === 1, 'accepted subscription retained'); f.behavior.reload = null; await f.button('Retry refresh').onclick();
        check(f.account.writes.length === 1, 'refresh-only retry'); f.dispose();
        const g = discordSetupFixture(); await g.ready; g.account.behavior.afterPut = async () => { throw new Error('Lost response'); }; await g.button('Second').onclick();
        await g.button('Check subscription').onclick(); check(g.account.writes.length === 1 && !g.deletes.length, 'read-only confirmation'); g.dispose();
    }],
    ['directory failure/retry and empty/malformed lists have visible feedback', async check => {
        const f = discordSetupFixture(); await f.ready; f.behavior.publicRead = async () => ({ ok: true, json: async () => ({ invalid: true }) }); await f.flow.open();
        check(!!f.button('Retry load') && f.text().includes('invalid channel list'), 'malformed directory visible');
        f.behavior.publicRead = null; f.channels.length = 0; await f.button('Retry load').onclick(); check(f.text().includes('No channels registered'), 'empty directory feedback'); f.dispose();
    }],
    ['admin reads capture bot token, safe guild labels and partial guild failure', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage();
        const calls = f.requests.filter(call => call[0].includes('/admin/')); check(calls.length === 2 && calls.every(call => new URL(call[0]).searchParams.get('bot_token') === 'private-bot+token/'), 'captured admin query contract');
        check(f.root.querySelector('#discord-new-guild-select').querySelector('option').textContent === '<Guild>' && !f.root.querySelector('Guild'), 'literal guild labels');
        f.behavior.guilds = async () => { throw new Error('Guild unavailable'); }; await f.manage();
        check(f.text().includes('Guilds could not be loaded') && !!f.button('Delete'), 'partial guild failure retains channels'); f.dispose();
    }],
    ['create/register/delete use captured payloads and never infer action state from DOM attributes', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage();
        f.field('discord-new-channel-name', 'Created'); await f.button('Create Channel').onclick();
        let call = f.writes()[0]; check(call[0].endsWith('/admin/guilds/guild%2Fa/channels') && JSON.parse(call[1].body).name === 'Created', 'encoded captured Create target');
        f.field('discord-new-guild', 'g'); f.field('discord-new-channel-id', '40'); f.field('discord-new-webhook', 'https://webhook.invalid/private'); await f.button('Add Channel').onclick();
        call = f.writes()[1]; check(call[0].endsWith('/admin/channels') && JSON.parse(call[1].body).webhook_url === 'https://webhook.invalid/private', 'captured Register payload');
        await f.button('Delete').onclick(); call = f.writes()[2]; check(call[1].method === 'DELETE' && call[0].endsWith('/10'), 'captured delete ID');
        check(!JSON.stringify(window.CList.state.discordAdminSetup).includes('private'), 'secret-free admin state'); f.dispose();
    }],
    ['duplicate admin commands and token/row/source expiry cannot dispatch stale writes', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage(); const gate = discordSetupGate();
        f.behavior.adminWrite = () => gate.promise; f.field('discord-new-channel-name', 'One'); const create = f.button('Create Channel'), pending = create.onclick();
        check(pending === create.onclick(), 'duplicate admin command coalesced'); await oauthAccountFlush(); gate.resolve({ ok: true, status: 204 }); await pending; await create.onclick();
        check(f.writes().length === 1, 'detached admin row cannot write');
        const stale = f.button('Delete'); f.field('discord-bot-token', 'different-token'); await stale.onclick(); check(f.writes().length === 1, 'changed token rejects old row'); f.dispose();
    }],
    ['accepted admin changes retry refresh only and unknown outcomes require review', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage(); f.behavior.adminRead = async () => { throw new Error('Refresh failed'); };
        f.field('discord-new-channel-name', 'Accepted'); await f.button('Create Channel').onclick(); check(!!f.button('Retry refresh') && f.writes().length === 1, 'accepted admin receipt');
        f.behavior.adminRead = null; await f.button('Retry refresh').onclick(); check(f.writes().length === 1, 'admin refresh does not repeat Create'); f.dispose();
        const g = discordSetupFixture(); await g.ready; await g.manage(); g.behavior.afterAdmin = async () => { throw new Error('Lost write response'); };
        g.field('discord-new-channel-name', 'Uncertain'); await g.button('Create Channel').onclick(); check(!!g.button('Review channels') && g.writes().length === 1, 'unknown command requires read-only review');
        await g.button('Review channels').onclick(); check(g.writes().length === 1 && !!g.button('Keep listed result'), 'review never writes');
        await g.button('Keep listed result').onclick(); check(g.writes().length === 1, 'explicit keep result does not replay'); g.dispose();
    }],
    ['edit-account controls share the real admin path and expire when hidden', async check => {
        const f = discordSetupFixture(); await f.ready;
        const edit = document.createElement('div'), token = document.createElement('input'); token.id = 'bot_tokenInput'; token.value = 'edit-token'; edit.appendChild(token); document.body.appendChild(edit);
        window.CList.accountHooks.Discord.decorateForm({ mode: 'edit', container: edit, root: edit, getAccountFlow: () => f.flow });
        const button = edit.querySelector('#discord-edit-manage-btn'); await button.onclick();
        check(f.requests.some(call => call[0].includes('/admin/') && new URL(call[0]).searchParams.get('bot_token') === 'edit-token'), 'real edit decorator routes captured token');
        edit.style.display = 'none'; const before = f.writes().length; const remove = f.button('Delete', edit); await remove.onclick(); check(f.writes().length === before, 'hidden edit surface rejects commands');
        edit.remove(); f.dispose();
    }],
    ['newer admin drafts survive acceptance and failed review cannot authorize a retry', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage(); const gate = discordSetupGate(); f.behavior.adminWrite = () => gate.promise;
        f.field('discord-new-channel-name', 'Captured'); const pending = f.button('Create Channel').onclick(); await oauthAccountFlush(); f.field('discord-new-channel-name', 'Newer draft');
        gate.resolve({ ok: true, status: 204 }); await pending;
        check(JSON.parse(f.writes()[0][1].body).name === 'Captured' && f.root.querySelector('#discord-new-channel-name').value === 'Newer draft', 'captured request and preserved newer form'); f.dispose();
        const g = discordSetupFixture(); await g.ready; await g.manage(); g.behavior.adminWrite = async () => { throw new Error('Lost response'); };
        g.field('discord-new-channel-name', 'Unknown'); await g.button('Create Channel').onclick(); g.behavior.adminRead = async () => { throw new Error('Review failed'); };
        await g.button('Review channels').onclick(); check(!g.button('Retry original change') && g.writes().length === 1 && !!g.button('Retry load'), 'failed review exposes read-only retry'); g.dispose();
    }],
    ['unsubscribe rechecks stored metadata and preserves a replaced account', async check => {
        const f = discordSetupFixture(); await f.ready; await f.seed('original-key', { type: 'Discord', title: 'Saved', channel: 'Second', permissions: 'rw', bot_token: '' });
        f.account.records.set('original-key', 'encrypted:' + JSON.stringify({ type: 'Discord', title: 'Newer account', channel: 'Second', permissions: 'rw', bot_token: 'newer-secret' }));
        await f.button('Second').onclick(); check(!f.deletes.length && f.text().includes('saved account changed'), 'replaced remote metadata prevents removal'); f.dispose();
    }],
    ['rebuilt add-account panels retain the original admin write receipt', async check => {
        const f = discordSetupFixture(); await f.ready; await f.manage(); const gate = discordSetupGate(); f.behavior.adminWrite = () => gate.promise;
        f.field('discord-new-channel-name', 'Captured'); const pending = f.button('Create Channel').onclick(); await oauthAccountFlush();
        await f.flow.open(); const restored = f.manage(); gate.resolve({ ok: true, status: 204 }); await pending; await restored;
        check(f.writes().length === 1 && !!f.button('Retry refresh'), 'rebuilt panel preserves accepted receipt after the pending write');
        f.field('discord-new-channel-name', 'Another'); await f.button('Create Channel').onclick();
        check(f.writes().length === 1, 'new panel cannot bypass outstanding admin receipt'); f.dispose();
    }],
];
