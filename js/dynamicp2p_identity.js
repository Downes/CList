/// <reference path="./clist-types.js" />
function createP2pIdentityController(deps, view) {
    let disposed = false, generation = 0, record = null, pending = null, phase = 'idle', signing = 0, verifying = 0;
    const owned = () => !disposed && deps.current();
    const stale = () => Object.assign(Error('Chat identity changed before the operation completed.'), { code: 'StaleChatIdentity' });
    const assert = (caller = () => true) => { if (!owned() || !caller()) throw stale(); };
    const state = () => {
        /** @type {CListChatIdentityState} */
        const summary = { phase, canSign: !!record?.key, signing, verifying }; if (owned()) deps.state(summary);
    };
    const controller = {
        owned,
        load(caller = () => true) {
            if (!owned() || !caller()) return Promise.resolve(null);
            if (pending) return pending;
            const version = ++generation; record = null; deps.install(null); phase = 'loading'; state();
            const check = () => { assert(caller); if (version !== generation) throw stale(); };
            const job = Promise.resolve().then(async () => {
                check(); const result = await deps.read(deps.capture(), check); check();
                record = result; deps.install(result); phase = result ? 'ready' : 'absent'; state();
                try { deps.announce(); } catch (error) { if (owned()) view.error('identity announcement', error); }
                return result;
            }).catch(error => {
                if (owned() && caller() && version === generation) { phase = 'failed'; state(); view.error('identity loading', error); }
                return null;
            }).finally(() => { if (pending === job) pending = null; });
            pending = job; return job;
        },
        async key(caller = () => true) {
            try { assert(caller); const target = deps.capture(); const material = await deps.readKey(target, () => assert(caller)); assert(caller); return material?.key || null; }
            catch (error) { if (owned() && caller()) view.error('key loading', error); return null; }
        },
        async sign(text) {
            if (!owned() || !record?.key) return null;
            const version = generation, key = record.key; signing++; state();
            try {
                const signature = await signP2pChatText(text, key, { sign: deps.sign });
                if (!owned() || version !== generation || record?.key !== key) throw stale(); return signature;
            } catch (error) { if (error.code === 'StaleChatIdentity') throw error; if (owned()) view.error('message signing (continuing unsigned)', error); return null; }
            finally { signing--; state(); }
        },
        async verify(text, signature, peerId) {
            if (!owned()) return null;
            const key = deps.peerKey(peerId); if (!key || !signature) return null;
            const captured = structuredClone(key), fingerprint = JSON.stringify(captured); verifying++; state();
            try {
                const result = await verifyP2pChatText(text, signature, captured, { verify: deps.verify });
                if (!owned() || JSON.stringify(deps.peerKey(peerId)) !== fingerprint) throw stale(); return result;
            } catch (error) { if (error.code === 'StaleChatIdentity') throw error; if (owned()) view.error('signature verification (unverified)', error); return null; }
            finally { verifying--; state(); }
        },
        dispose() { if (disposed) return; disposed = true; generation++; record = null; }
    };
    return controller;
}
let _p2pIdentity = null;
function getP2pIdentity() {
    if (!_p2pIdentity?.owned()) {
        _p2pIdentity?.dispose(); const session = _p2pSession, guard = captureP2pSessionGuard();
        const source = JSON.stringify([p2pSessionSource(), !!window.CList.isLocalMode?.()]);
        const current = () => guard() && _p2pSession === session && source === JSON.stringify([p2pSessionSource(), !!window.CList.isLocalMode?.()]);
        const keyDeps = (target, assertCurrent) => {
            assertCurrent(); const kv = window.CList.storage.kv, keyName = window.CList.keys.DID_IDENTITY_KEY;
            return { assertCurrent, getKey: () => getEncKey(target.storeUrl), getRecord: () => kv.get(keyName),
                decrypt: (encrypted, key) => decryptIdentityPrivateKey(encrypted, key) };
        };
        const controller = createP2pIdentityController({ current,
            capture() { const storeUrl = window.CList.config.flaskSiteUrl; return { storeUrl, username: getSiteSpecificCookie(storeUrl, window.CList.keys.USERNAME), local: !!window.CList.isLocalMode?.() }; },
            read(target, assertCurrent) { return readP2pChatIdentity(target, { ...(target.local ? keyDeps(target, assertCurrent) : {}), assertCurrent, fetch,
                loadKey: () => loadIdentityKey(() => { assertCurrent(); return true; }), derive: (encrypted, key) => derivePublicKeyJwkAndDidKey(encrypted, key) }); },
            readKey: (target, assertCurrent) => readP2pPrivateKeyMaterial(keyDeps(target, assertCurrent)),
            sign: (key, text) => signWithIdentityKey(key, text), verify: (key, text, signature) => verifyIdentitySignature(key, text, signature),
            peerKey: id => session.resources.peerPublicKeyJwks[id],
            install(value) { myDid = value?.did || null; myDidKey = value?.didKey || null; myPublicKeyJwk = value?.publicKeyJwk || null; myIdentityKey = value?.key || null; },
            announce() { if (typeof getP2pControl === 'function') getP2pControl().setName(myUsername || 'Anonymous'); },
            state: state => { if (_p2pIdentity === controller) window.CList.state.chatIdentity = state; }
        }, createP2pIdentityView());
        _p2pIdentity = controller;
    }
    return _p2pIdentity;
}
