const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { fixture, source } = require('./helpers/account-fixture.cjs');

test('account loading normalizes registered types, excludes other KV records, and retains corrupt keys without UI', async () => {
    const f = fixture(); f.schema('Example');
    f.add('account', { type: 'Example', extra: { nested: true } });
    f.add('collection:x', { title: 'Collection', items: [] });
    f.records.set('corrupt', 'not encrypted');
    const result = await f.ctx.loadAccountRecords(f.session);
    assert.deepEqual(Array.from(result, account => account.key), ['account', 'corrupt']);
    const data = JSON.parse(result[0].value);
    assert.equal(data.instance, 'account'); assert.equal(data.permissions, ''); assert.equal(data.public, false);
    assert.deepEqual(data.extra, { nested: true }); assert.equal(JSON.parse(result[1].value).type, 'bad');
    assert.equal('document' in f.ctx, false);
});

test('save uses a detached request, awaits normalization, and returns only after persistence completes', async () => {
    const f = fixture(); let release;
    f.cList.accountHooks.Example = { prepareSave: async data => {
        await new Promise(resolve => { release = resolve; }); return { ...data, title: 'Normalized' };
    } };
    const request = { key: 'account', data: { type: 'Example', title: 'Original', extra: { value: 1 } } };
    const pending = f.ctx.saveAccount(request, f.session);
    request.data.extra.value = 2;
    assert.equal(f.writes.length, 0); release();
    const saved = await pending;
    assert.equal(saved.data.title, 'Normalized'); assert.equal(saved.data.extra.value, 1);
    assert.equal(request.data.title, 'Original'); assert.equal(f.writes.length, 1);
    assert.equal(JSON.parse(f.records.get('account').slice(10)).extra.value, 1);
});

test('validation, encryption, and write failures propagate without refreshing or presenting UI', async () => {
    const f = fixture(), request = { key: 'account', data: { type: 'Example', title: 'Name' } };
    f.cList.accountHooks.Example = { prepareSave: async () => { throw Error('invalid credential'); } };
    await assert.rejects(f.ctx.saveAccount(request, f.session), /invalid credential/);
    delete f.cList.accountHooks.Example;
    f.ctx.encryptWithKey = async () => { throw Error('encryption failed'); };
    await assert.rejects(f.ctx.saveAccount(request, f.session), /encryption failed/);
    f.ctx.encryptWithKey = async (_, json) => json; f.failWrite(true);
    await assert.rejects(f.ctx.saveAccount(request, f.session), /write offline/);
    assert.equal(f.writes.length, 0);
});

test('a session switch during preparation or encryption cannot write to the newly selected account', async () => {
    for (const stage of ['prepare', 'encrypt']) {
        const f = fixture();
        const changeSession = () => { f.ctx.getSiteSpecificCookie = () => 'different-user'; };
        if (stage === 'prepare') f.cList.accountHooks.Example = { prepareSave: async data => { changeSession(); return data; } };
        else f.ctx.encryptWithKey = async () => { changeSession(); return 'encrypted'; };
        await assert.rejects(f.ctx.saveAccount({ key: 'account', data: { type: 'Example', title: 'Name' } }, f.session), /session changed/);
        assert.equal(f.writes.length, 0);
    }
});

test('load rejects stale data after a store switch; deletion needs a current session', async () => {
    const f = fixture(); f.schema('Example');
    f.cList.storage.kv.list = async () => { f.cList.config.flaskSiteUrl = 'https://other.test'; return []; };
    await assert.rejects(f.ctx.loadAccountRecords(f.session), /session changed/);
    await assert.rejects(f.ctx.deleteAccount('account', f.session), /session changed/);
    assert.equal(f.writes.length, 0);
    f.cList.config.flaskSiteUrl = f.session.storeUrl;
    await f.ctx.deleteAccount('account', f.session);
    assert.deepEqual(f.writes, [['remove', 'account']]);
});

test('Hypothesis hook normalizes the verified username and rejects mismatches before saving', async () => {
    const f = fixture();
    const text = source('hypothesis.js');
    vm.runInContext(text.slice(0, text.indexOf("window.CList.schemas['Hypothesis']")), f.ctx);
    f.ctx.fetch = async (url, init) => {
        assert.equal(url, 'https://api.hypothes.is/api/profile');
        assert.equal(init.headers.Authorization, 'Bearer secret');
        return { ok: true, json: async () => ({ userid: 'acct:Stephen@hypothes.is' }) };
    };
    const request = { key: 'https://hypothes.is', data: {
        type: 'Hypothesis', title: 'Notes', instance: 'https://hypothes.is', username: 'stephen', apiKey: 'secret',
    } };
    const result = await f.ctx.saveAccount(request, f.session);
    assert.equal(result.data.username, 'Stephen');
    request.data.username = 'someone-else';
    await assert.rejects(f.ctx.saveAccount(request, f.session), /Username mismatch/);
    assert.equal(f.writes.length, 1);
});

test('legacy getAccounts delegates to the same data loader while retaining its login feedback', async () => {
    const f = fixture(); f.schema('Example'); f.add('account', { type: 'Example', title: 'Name' });
    const text = source('kvstore.js');
    const start = text.indexOf('async function getAccounts(');
    vm.runInContext(text.slice(start, text.indexOf('// Event listener for changes in localStorage', start)), f.ctx);
    const result = await f.ctx.getAccounts();
    assert.equal(result.length, 1); assert.equal(result[0].key, 'account');
    let message; f.ctx.loginRequired = text => { message = text; };
    f.ctx.getSiteSpecificCookie = () => null;
    assert.equal(await f.ctx.getAccounts(undefined, 0), undefined);
    assert.match(message, /username/);
});
