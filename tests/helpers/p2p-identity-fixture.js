function identityGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function identityFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
let previousChatIdentity = null;
function chatIdentityFixture(bridge = false) {
    previousChatIdentity?.dispose();
    const states = [], installed = [], errors = [], trace = [], behavior = {}, peers = { remote: { kty: 'OKP', crv: 'Ed25519', x: 'peer' } };
    const privateKey = { secret: 'private-key' }; let current = true, reads = 0, announced = 0, controller;
    const capture = () => ({ storeUrl: 'https://captured.invalid/', username: behavior.anonymous ? '' : 'user/name', local: !!behavior.local });
    const fetchMock = async (url, options) => {
        trace.push({ operation: 'fetch', url, options });
        if (behavior.fetch) return behavior.fetch();
        return { ok: true, status: 200, json: async () => ({ id: 'did:web:captured', alsoKnownAs: [4, 'did:key:captured'], verificationMethod: [{ publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'public', d: 'must-not-announce' } }] }) };
    };
    const getKey = async url => { trace.push({ operation: 'getKey', url }); return behavior.getKey ? behavior.getKey() : 'encryption-key'; };
    const getRecord = async key => {
        trace.push({ operation: 'getRecord', key });
        if (behavior.missing) throw Object.assign(Error('Not found'), { code: 'NotFound' });
        const values = behavior.records || ['cipher']; return { value: values[Math.min(reads++, values.length - 1)] };
    };
    const decrypt = async (cipher, key) => { trace.push({ operation: 'decrypt', cipher, key }); return behavior.decrypt ? behavior.decrypt() : privateKey; };
    const derive = async (cipher, key) => { trace.push({ operation: 'derive', cipher, key }); return { didKey: 'did:key:local', publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'local' } }; };
    const sign = async (key, text) => { trace.push({ operation: 'sign', key, text }); return behavior.sign ? behavior.sign() : 'AQI+/w=='; };
    const verify = async (key, text, signature) => { trace.push({ operation: 'verify', key, text, signature }); return behavior.verify ? behavior.verify() : true; };
    const keyDeps = check => ({ assertCurrent: check, getKey: () => getKey(capture().storeUrl), getRecord, decrypt });
    if (bridge) {
        _p2pSession = { isCurrent: () => current, resources: { peerPublicKeyJwks: peers } };
        Object.assign(globalThis, { p2pSessionSource: () => current ? 'captured-source' : 'changed-source', captureP2pSessionGuard: () => () => current,
            getSiteSpecificCookie: (_url, key) => key === window.CList.keys.USERNAME ? capture().username : 'synthetic-token', fetch: fetchMock,
            getEncKey: getKey, decryptIdentityPrivateKey: decrypt, derivePublicKeyJwkAndDidKey: derive, signWithIdentityKey: sign, verifyIdentitySignature: verify,
            showStatusMessage: message => errors.push(message) });
        window.CList.config.flaskSiteUrl = capture().storeUrl; window.CList.isLocalMode = () => !!behavior.local;
        window.CList.storage = { kv: { get: getRecord } }; controller = getP2pIdentity();
    } else {
        controller = createP2pIdentityController({ current: () => current, capture, state: state => states.push(structuredClone(state)),
            install: value => installed.push(value), announce: () => { announced++; if (behavior.announce) behavior.announce(); },
            read: (target, check) => readP2pChatIdentity(target, { ...keyDeps(check), fetch: fetchMock, derive,
                loadKey: async () => (await readP2pPrivateKeyMaterial(keyDeps(check)))?.key || null }),
            readKey: (_target, check) => readP2pPrivateKeyMaterial(keyDeps(check)), sign, verify, peerKey: id => peers[id]
        }, { error: (operation, error) => errors.push(operation + ': ' + error.message) });
    }
    const f = { states, installed, errors, trace, behavior, peers, privateKey,
        load: () => bridge ? initializeDid(() => current) : controller.load(),
        key: () => bridge ? loadIdentityKey(() => current) : controller.key(),
        sign: text => bridge ? signMessage(text) : controller.sign(text), verify: (text, signature) => bridge ? verifySignature(text, signature, 'remote') : controller.verify(text, signature, 'remote'),
        state: () => bridge ? window.CList.state.chatIdentity : states.at(-1), announced: () => announced,
        current: () => { current = false; }, installedIdentity: () => bridge ? { key: myIdentityKey, did: myDid, publicKeyJwk: myPublicKeyJwk } : installed.at(-1),
        dispose() { controller.dispose(); }
    };
    previousChatIdentity = f; return f;
}
const p2pIdentityCases = [
    ['hosted reads capture encoded account URL and exact encrypted key version', async check => {
        const f = chatIdentityFixture(); await f.load();
        check(f.trace[0].url === 'https://captured.invalid/users/user%2Fname/did.json' && !f.trace[0].options.headers, 'captured public DID URL without credential headers');
        check(f.trace.filter(entry => entry.operation === 'getRecord').length === 2 && f.installedIdentity().key === f.privateKey, 'key read/decrypted and version revalidated');
        check(!f.installedIdentity().publicKeyJwk.d && f.installedIdentity().didKey === 'did:key:captured', 'public projection strips private component and tolerates legacy aliases');
        check(f.state().canSign && !JSON.stringify(f.states).includes('private-key') && !JSON.stringify(f.states).includes('captured.invalid'), 'safe availability summary');
    }],
    ['anonymous/missing identities are normal and Local mode avoids DID HTTP', async check => {
        const f = chatIdentityFixture(); f.behavior.anonymous = true; await f.load(); check(!f.trace.length && f.state().phase === 'absent', 'anonymous identity does not read services or storage');
        const g = chatIdentityFixture(); g.behavior.fetch = () => ({ ok: false, status: 404 }); await g.load(); check(g.state().phase === 'absent' && !g.errors.length, '404 is normal absence');
        const h = chatIdentityFixture(); h.behavior.local = true; await h.load();
        check(!h.trace.some(entry => entry.operation === 'fetch') && h.installedIdentity().didKey === 'did:key:local' && h.state().canSign, 'Local identity derives from captured stored key without HTTP');
        const i = chatIdentityFixture(); i.behavior.missing = true; await i.load(); check(!i.state().canSign && await i.sign('unsigned') === null, 'missing stored key retains unsigned compatibility');
    }],
    ['coalesced loads show errors/retry and separate announcement failure', async check => {
        const f = chatIdentityFixture(), gate = identityGate(); f.behavior.fetch = () => gate.promise; const first = f.load(), second = f.load();
        await identityFlush(); check(f.trace.filter(entry => entry.operation === 'fetch').length === 1, 'one pending identity read');
        gate.resolve({ ok: false, status: 503 }); await first; await second;
        check(f.state().phase === 'failed' && f.errors[0].includes('HTTP 503'), 'HTTP failure visible');
        delete f.behavior.fetch; f.behavior.announce = () => { throw Error('announce failed'); }; await f.load();
        check(f.state().phase === 'ready' && f.state().canSign && f.errors.at(-1).includes('announce failed'), 'announcement failure preserves accepted identity load');
    }],
    ['expired reads and rotated ciphertext cannot install stale private keys', async check => {
        const f = chatIdentityFixture(), gate = identityGate(); f.behavior.getKey = () => gate.promise; const reading = f.load(); await identityFlush(); f.current(); gate.resolve('old-encryption-key'); await reading;
        check(!f.trace.some(entry => entry.operation === 'getRecord') && !f.installed.some(value => value?.key), 'expiry stops before storage read or key install');
        const g = chatIdentityFixture(); g.behavior.records = ['old-cipher', 'new-cipher']; await g.load();
        check(!g.installedIdentity() && g.errors.some(message => message.includes('key changed')), 'rotation between decrypt and install is rejected');
    }],
    ['URL-safe chat signatures retain shared helper Base64 wire compatibility', async check => {
        const f = chatIdentityFixture(); await f.load(); const signature = await f.sign('message Ω');
        check(signature === 'AQI-_w' && f.trace.find(entry => entry.operation === 'sign').text === 'message Ω', 'shared signing converted to unpadded URL-safe wire bytes');
        check(await f.verify('message Ω', signature) === true && f.trace.find(entry => entry.operation === 'verify').signature === 'AQI+/w==', 'wire signature converted back for shared verifier');
        f.behavior.verify = () => false; check(await f.verify('invalid', signature) === false, 'invalid signature remains false');
        delete f.peers.remote; check(await f.verify('unknown', signature) === null, 'missing peer key remains unknown');
    }],
    ['identity reload and changed peer claims reject late crypto results', async check => {
        const f = chatIdentityFixture(); await f.load(); const gate = identityGate(); f.behavior.sign = () => gate.promise; const pending = f.sign('old key'); await f.load(); gate.resolve('AQI+/w=='); let stale = false;
        try { await pending; } catch (error) { stale = error.code === 'StaleChatIdentity'; }
        check(stale && f.state().signing === 0, 'reload rejects old signing result');
        const verify = identityGate(); f.behavior.verify = () => verify.promise; const checking = f.verify('body', 'AQI-_w'); f.peers.remote = { kty: 'OKP', x: 'replacement' }; verify.resolve(true); stale = false;
        try { await checking; } catch (error) { stale = error.code === 'StaleChatIdentity'; }
        check(stale && f.state().verifying === 0, 'new peer claim rejects old verification result');
    }],
    ['crypto errors are visible and preserve unsigned/unknown fallbacks', async check => {
        const f = chatIdentityFixture(); await f.load(); f.behavior.sign = () => { throw Error('sign failed'); };
        check(await f.sign('body') === null && f.errors.some(value => value.includes('sign failed')), 'sign failure visibly falls back unsigned');
        f.behavior.verify = () => { throw Error('verify failed'); };
        check(await f.verify('body', 'AQI-_w') === null && f.errors.some(value => value.includes('verify failed')), 'verify failure is visibly unknown, not invalid');
    }],
    ['real compatibility wrappers use captured KV constant and shared helper contracts', async check => {
        const f = chatIdentityFixture(true); await f.load();
        check(f.installedIdentity().did === 'did:web:captured' && f.installedIdentity().key === f.privateKey, 'legacy initializer installs owned metadata/key');
        check(f.trace.filter(entry => entry.operation === 'getRecord').every(entry => entry.key === window.CList.keys.DID_IDENTITY_KEY), 'shared storage-key constant used');
        check(await f.sign('body') === 'AQI-_w' && await f.verify('body', 'AQI-_w') === true, 'legacy sign/verify retain wire contract');
        f.current(); check(await f.key() === null && !f.state().did, 'expired key wrapper returns no key and exposes no identity details');
    }]
];
