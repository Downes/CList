const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const ctx = vm.createContext({ window: { CList: { state: {}, config: { flaskSiteUrl: 'https://store.invalid' }, keys: { USERNAME: 'fixture-user', ACCESS_TOKEN: 'fixture-token', DID_IDENTITY_KEY: 'fixture-identity' } } }, structuredClone, console: { error() {} } });
for (const name of ['dynamicp2p_session_bridge', 'dynamicp2p_identity_workflow', 'dynamicp2p_identity_view', 'dynamicp2p_identity', 'dynamicp2p']) vm.runInContext(fs.readFileSync('js/' + name + '.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('tests/helpers/p2p-identity-fixture.js', 'utf8'), ctx);
for (const [name, run] of vm.runInContext('p2pIdentityCases', ctx)) test(name, () => run((condition, message) => assert.ok(condition, message)));
test('actual shared Ed25519 helpers retain chat codec bytes with mocked WebCrypto', async () => {
    const calls = [], cryptoContext = vm.createContext({ TextEncoder, Uint8Array, atob, btoa, structuredClone,
        crypto: { subtle: { sign: async (algorithm, key, bytes) => { calls.push({ algorithm, key, bytes: [...bytes] }); return new Uint8Array([1, 2, 62, 255]).buffer; },
            importKey: async () => 'imported-public', verify: async (algorithm, key, signature, bytes) => { calls.push({ algorithm, key, signature: [...signature], bytes: [...bytes] }); return false; } } } });
    vm.runInContext(fs.readFileSync('js/crypto_utils.js', 'utf8') + '\n' + fs.readFileSync('js/dynamicp2p_identity_workflow.js', 'utf8'), cryptoContext);
    const signature = await cryptoContext.signP2pChatText('Ω', 'private', { sign: cryptoContext.signWithIdentityKey });
    assert.equal(signature, 'AQI-_w'); assert.equal(await cryptoContext.verifyP2pChatText('Ω', signature, { kty: 'OKP' }, { verify: cryptoContext.verifyIdentitySignature }), false);
    assert.equal(calls[0].algorithm.name, 'Ed25519'); assert.deepEqual(calls[1].signature, [1, 2, 62, 255]); assert.deepEqual(calls[0].bytes, calls[1].bytes);
});
