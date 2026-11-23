function accountTransferGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function transferCipher(key, plaintext) { return JSON.stringify({ key, plaintext }); }
function accountTransferFixture() {
    let username = 'Destination', token = 'private-token', version = 'key-v1', database = new Map();
    const original = database, attempts = [], accepted = [], downloads = [], messages = [], behavior = {}, calls = [];
    window.CList.state = { username, authEpoch: 1 }; window.CList.config = { flaskSiteUrl: 'https://destination.invalid' };
    window.CList.keys = { USERNAME: 'username', ACCESS_TOKEN: 'token' };
    Object.assign(globalThis, {
        getSiteSpecificCookie: (server, key) => key === 'username' ? username : token,
        passwordConfirmationSession: () => ({ storedKey: version }),
        getEncKey: async server => { if (behavior.key) await behavior.key(); calls.push(['key', server]); return 'destination-key'; },
        deriveAuthHash: async (password, user) => { if (behavior.auth) await behavior.auth(); return 'auth:' + user + ':' + password; },
        sha256Hex: async value => 'digest:' + value,
        deriveEncKey: async (password, user) => { if (behavior.derive) await behavior.derive(); return 'key:' + user + ':' + password; },
        decryptWithKey: async (key, value) => { if (behavior.decrypt) await behavior.decrypt(value); const record = JSON.parse(value); if (record.key !== key) throw new Error('Invalid source ciphertext'); return record.plaintext; },
        encryptWithKey: async (key, value) => { if (behavior.encrypt) await behavior.encrypt(value); return transferCipher(key, value); },
        downloadBlob: async (blob, name) => { downloads.push({ blob, name }); }, showErrorModal: message => messages.push(message),
    });
    window.CList.storage = { kv: {
        async list() { const target = database; if (behavior.list) await behavior.list(); return Array.from(target, ([key, value]) => ({ key, value })); },
        async get(key) { const target = database; if (behavior.get) await behavior.get(key); return target.has(key) ? { key, value: target.get(key) } : null; },
        async add(key, value) {
            const target = database; attempts.push([key, value, target]); if (behavior.beforeAdd) await behavior.beforeAdd(key, value);
            if (target.has(key)) throw Object.assign(new Error('Existing destination'), { code: 'AlreadyExists' });
            target.set(key, value); accepted.push(key); if (behavior.afterAdd) await behavior.afterAdd(key);
        },
        put() { throw new Error('Import must never upsert'); },
    } };
    const payload = (keys = ['a', 'b']) => ({ clistLocalAccountExport: 1, username: 'Original', authHashDigest: 'digest:auth:Original:pw',
        extension: { keep: true }, kv: keys.map(key => ({ key, value: transferCipher('key:Original:pw', 'opaque:' + key) })) });
    return { original, attempts, accepted, downloads, messages, behavior, calls, payload, records: () => database,
        async import(value = payload(), options) { try { return { result: await unlockAndImportAccountData(value, 'pw', options) }; } catch (error) { return { error, operation: error.operation }; } },
        switchAccount() { username = 'New user'; token = 'new-token'; window.CList.state.username = username; window.CList.state.authEpoch++; database = new Map(); },
        keyVersion(value) { version = value; },
    };
}
const accountTransferCases = [
    ['export captures exact ciphertext rows, cookie identity and native v1 download handoff', async check => {
        const f = accountTransferFixture(); f.original.set('record', 'original-ciphertext'); const gate = accountTransferGate(); f.behavior.auth = () => gate.promise;
        const pending = exportAccountData('pw'); await Promise.resolve(); await Promise.resolve(); f.original.set('record', 'newer-ciphertext'); window.CList.state.username = 'none';
        gate.resolve(); await pending; const payload = JSON.parse(await f.downloads[0].blob.text());
        check(payload.clistLocalAccountExport === 1 && payload.username === 'Destination' && payload.kv[0].value === 'original-ciphertext', 'detached encrypted snapshot/cookie identity');
        check(f.downloads[0].name === 'clist-account-Destination.json' && payload.authHashDigest === 'digest:auth:Destination:pw', 'unchanged native wire contract');
        check(!f.attempts.length, 'export never writes storage');
    }],
    ['export expiry rejects download after source change', async check => {
        const f = accountTransferFixture(), gate = accountTransferGate(); f.behavior.auth = () => gate.promise;
        const pending = exportAccountData('pw').catch(error => error); await Promise.resolve(); await Promise.resolve(); f.switchAccount(); gate.resolve(); await pending;
        check(!f.downloads.length && !f.attempts.length, 'expired export cannot hand off a download');
    }],
    ['import re-encrypts detached rows add-only while preserving existing records and empty bundles', async check => {
        const f = accountTransferFixture(); f.original.set('existing', 'keep-exactly'); const input = f.payload(['a', 'existing']), gate = accountTransferGate(); f.behavior.derive = () => gate.promise;
        const pending = f.import(input); await Promise.resolve(); await Promise.resolve(); input.kv[0].value = 'mutated'; input.username = 'Changed'; gate.resolve();
        const { result } = await pending;
        check(result.complete && result.imported === 1 && result.skipped[0] === 'existing' && f.original.get('existing') === 'keep-exactly', 'skip existing without replacement');
        check(f.original.get('a') === transferCipher('destination-key', 'opaque:a'), 'captured source decrypted and re-encrypted');
        const empty = await f.import(f.payload([])); check(empty.result.complete && empty.result.imported === 0, 'native empty bundle');
    }],
    ['invalid duplicate records and wrong passwords fail before writes', async check => {
        const f = accountTransferFixture(), invalid = f.payload(['a', 'a']); const first = await f.import(invalid);
        const wrong = f.payload(); wrong.authHashDigest = 'wrong'; const second = await f.import(wrong);
        check(!!first.error && !!second.error && !f.attempts.length, 'validation and password rejection');
        const legacy = f.payload([]); delete legacy.kv; check(validateAccountExport(legacy).kv.length === 0, 'legacy absent kv stays an empty bundle');
    }],
    ['concurrent destination creation is preserved by atomic add', async check => {
        const f = accountTransferFixture(); f.behavior.encrypt = async () => { f.original.set('a', 'concurrent-record'); };
        const { result } = await f.import(f.payload(['a']));
        check(result.complete && result.imported === 0 && result.skipped[0] === 'a' && f.original.get('a') === 'concurrent-record', 'race collision never overwrites');
    }],
    ['partial failure retains accepted steps; explicit retry writes only remaining records', async check => {
        const f = accountTransferFixture(); f.behavior.encrypt = async plaintext => { if (plaintext === 'opaque:b') throw new Error('Encryption unavailable'); };
        const { operation } = await f.import(); check(operation.result().imported === 1 && operation.result().remaining === 1 && f.attempts.length === 1, 'accepted receipt retained');
        f.original.delete('a'); f.behavior.encrypt = null; const retried = await operation.run();
        check(retried.complete && f.attempts.length === 2 && !f.original.has('a') && f.original.has('b'), 'accepted item not replayed even if subsequently removed');
        check(!JSON.stringify(window.CList.state.accountTransfer).includes('opaque'), 'safe count-only state');
    }],
    ['uncertain accepted writes require read-only confirmation before remaining-step retry', async check => {
        const f = accountTransferFixture(); f.behavior.afterAdd = async () => { throw new Error('Lost response'); };
        const { operation } = await f.import(); check(operation.result().uncertain === 1 && f.attempts.length === 1, 'uncertain write retained');
        await operation.run(); check(f.attempts.length === 1, 'no retry before review');
        const checked = await operation.check(); check(checked.imported === 1 && checked.remaining === 1 && f.attempts.length === 1, 'read-only exact ciphertext confirmation');
        f.behavior.afterAdd = null; await operation.run(); check(f.attempts.length === 2 && f.original.has('b'), 'only explicit remaining-step retry writes');
    }],
    ['unconfirmed absent writes and newer conflicting data are resolved without overwriting', async check => {
        for (const conflict of [false, true]) {
            const f = accountTransferFixture(); f.behavior.beforeAdd = async () => { throw new Error('Unconfirmed'); };
            const { operation } = await f.import(f.payload(['a'])); if (conflict) f.original.set('a', 'newer');
            const checked = await operation.check(); check(f.attempts.length === 1 && (conflict ? checked.skipped[0] === 'a' : checked.remaining === 1), 'read-only destination review');
            f.behavior.beforeAdd = null; await operation.run(); check(conflict ? f.original.get('a') === 'newer' && f.attempts.length === 1 : f.attempts.length === 2, 'preserved conflict or explicit retry');
        }
    }],
    ['source, key-version and caller expiry stop work before the next write', async check => {
        for (const mode of ['session', 'key', 'caller']) {
            const f = accountTransferFixture(), gate = accountTransferGate(); let active = true; f.behavior.encrypt = () => gate.promise;
            const pending = f.import(f.payload(['a']), { isCurrent: () => active }); for (let i = 0; i < 30; i++) await Promise.resolve();
            if (mode === 'session') f.switchAccount(); else if (mode === 'key') f.keyVersion('key-v2'); else active = false;
            gate.resolve(); await pending; check(!f.attempts.length && !f.records().size, 'expired ' + mode + ' cannot write');
        }
        const g = accountTransferFixture(); g.behavior.afterAdd = async key => { if (key === 'a') g.switchAccount(); };
        const { operation } = await g.import(); check(operation.result().imported === 1 && g.original.has('a') && !g.records().size, 'accepted original write cannot retarget next item');
        await operation.run(); check(g.attempts.length === 1, 'expired recovery cannot resume in new destination');
    }],
    ['real Options handoff exposes read-only review and explicit remaining retry without re-entering passwords', async check => {
        const f = accountTransferFixture(), reports = [], confirmations = []; let installed = 0;
        const view = { report: (text, choices = []) => reports.push({ text, choices }) };
        const transfer = createPersonalOptionsTransfer(() => true, view, {
            capture: captureOAuthAccountSaveSource, current: currentOAuthAccountSaveSource, logged: () => true,
            confirm: (...args) => confirmations.push(args), escape: value => value,
            parse: file => parseLocalAccountExportFile(file, { feedback: false }), verify: verifyExportPassword,
            import: unlockAndImportAccountData, export: exportAccountData, accounts: async () => [], install: () => { installed++; }, log() {},
        });
        f.behavior.afterAdd = async () => { throw new Error('Lost response'); };
        await transfer.import({ text: async () => JSON.stringify(f.payload()) }); const first = confirmations[0][1]('pw'), duplicate = confirmations[0][1]('pw'); await first; await duplicate;
        check(f.attempts.length === 1 && reports.at(-1).choices[0][0] === 'Check import status', 'one confirmation dispatch and recovery handoff');
        await reports.at(-1).choices[0][1](); check(f.attempts.length === 1 && reports.at(-1).choices[0][0] === 'Retry remaining imports', 'read-only review before retry');
        f.behavior.afterAdd = null; await reports.at(-1).choices[0][1](); check(f.attempts.length === 2 && installed === 1 && confirmations.length === 1, 'remaining import and refresh without repeating confirmation/write');
    }],
    ['ambiguous storage reads fail closed before download or import writes', async check => {
        const f = accountTransferFixture(); window.CList.storage.kv.list = async () => [{ key: 'duplicate', value: 'one' }, { key: 'duplicate', value: 'two' }];
        const exported = await exportAccountData('pw').catch(error => error), imported = await f.import();
        check(exported instanceof Error && !!imported.error && !f.downloads.length && !f.attempts.length, 'duplicate destination/source rows rejected');
    }],
];
