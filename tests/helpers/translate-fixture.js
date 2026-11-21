function translateGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function translateFlush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function translateFixture(options = {}, bridge = false) {
    let key = 'private&fixture', source = 'original', formText = 'Original text', formAlive = true;
    const calls = [], errors = [], states = [], writes = [], labels = [], results = [], behavior = { ...options }, output = {};
    const read = () => { if (behavior.readError) throw Error('read failed'); return behavior.stored || 'false'; };
    const write = value => { writes.push(value); if (behavior.writeError) throw Error('write failed'); };
    const fetchMock = async (url, init) => {
        const detect = url.includes('/detect?'); calls.push({ url, init: structuredClone(init), detect });
        if (behavior.fetch) return behavior.fetch(detect);
        return { ok: true, json: async () => ({ data: detect ? { detections: [[{ language: behavior.language || 'fr' }]] } : { translations: [{ translatedText: '<b>Translated</b>' }] } }) };
    };
    const timeout = (work, ms) => { if (ms !== 5000) throw Error('Wrong deadline'); return behavior.timeout ? behavior.timeout(work) : work; };
    const view = { enabled: value => labels.push(value), error: (operation, error) => errors.push({ operation, message: error.message }),
        form: () => { const text = formText; return { text, output, current: () => formAlive && formText === text, show: result => results.push(result) }; } };
    let controller, root;
    if (bridge) {
        root = document.createElement('div'); document.body.appendChild(root);
        for (const [tag, id] of [['input','inputText'],['div','translated-text'],['button','translation-toggle-btn']]) { const node = document.createElement(tag); node.id = id; root.appendChild(node); }
        document.getElementById('inputText').value = formText;
        Object.assign(globalThis, { localStorage: { getItem: read, setItem: (name, value) => { if (name !== window.CList.keys.TRANSLATION_ENABLED) throw Error('Wrong preference key'); write(value); } },
            findAccountByPermission: permission => { if (permission !== 't') throw Error('Wrong permission'); return key ? { parsedValue: { id: key } } : null; },
            readerSession: () => ({ source }), readerState: () => ({ requestId: 1 }), fetch: fetchMock, withTimeout: timeout,
            showStatusMessage: message => errors.push({ message }) });
        controller = _translationController;
    } else controller = createTranslationController({ read, write, key: () => key, source: () => source,
        run: (text, captured, assertCurrent) => runTranslationWorkflow(text, captured, { assertCurrent, fetch: fetchMock }),
        timeout, state: value => states.push(structuredClone(value)) }, view);
    return { controller, calls, errors, states, writes, labels, results, behavior,
        key: value => { key = value; }, source: value => { source = value; }, text: value => { formText = value; }, detach: () => { formAlive = false; },
        dispose: () => root?.remove() };
}
const translateCases = [
    ['preference restoration, canonical toggle and failed-write preservation', async check => {
        const f = translateFixture({ stored: 'true' }); check(f.states[0].enabled && f.writes.length === 0, 'restoration reads without writes');
        f.controller.toggle(); check(f.writes[0] === 'false' && !f.states.at(-1).enabled && f.labels.at(-1) === false, 'toggle persists and renders controller value');
        f.behavior.writeError = true; f.controller.toggle(); check(!f.states.at(-1).enabled && f.errors[0].operation === 'preference saving', 'failed write preserves preference');
        const g = translateFixture({ readError: true }); check(!g.states[0].enabled && g.errors[0].operation === 'preference loading' && g.writes.length === 0, 'read failure visible without writing default');
    }],
    ['disabled/missing-key and English/undefined-language fallbacks', async check => {
        const f = translateFixture(); check(await f.controller.run('Original', true) === 'Original' && f.calls.length === 0, 'disabled timed wrapper skips service');
        f.key(null); check(await f.controller.run('Original') === 'Original' && f.calls.length === 0, 'missing key skips service');
        f.key('restored'); for (const language of ['en', 'und']) { f.behavior.language = language; const count = f.calls.length;
            check(await f.controller.run('Original') === 'Original' && f.calls.length === count + 1, language + ' skips translation after detection'); }
    }],
    ['captured key, explicit HTML payload and independent concurrent rows', async check => {
        const f = translateFixture(), first = f.controller.run('<p>Bonjour</p>'), second = f.controller.run('Salut'); await Promise.all([first, second]);
        check(f.calls.length === 4 && f.calls.every(call => call.url.includes('key=private%26fixture')), 'concurrent rows retain encoded captured credentials');
        const translate = f.calls.find(call => !call.detect), payload = JSON.parse(translate.init.body);
        check(payload.target === 'en' && payload.source === 'fr' && payload.format === 'html' && translate.init.method === 'POST', 'existing translation payload preserved');
        check(f.states.at(-1).pending === 0 && !JSON.stringify(f.states).includes('private&fixture'), 'pending count drains without exposing credentials');
    }],
    ['source/key/toggle expiry blocks second step and retains original', async check => {
        for (const change of ['source','key','toggle']) {
            const f = translateFixture(), gate = translateGate(); f.behavior.fetch = () => gate.promise;
            const pending = f.controller.run('Original'); await translateFlush();
            if (change === 'toggle') f.controller.toggle(); else f[change]('replacement');
            gate.resolve({ ok: true, json: async () => ({ data: { detections: [[{ language: 'fr' }]] } }) });
            check(await pending === 'Original' && f.calls.length === 1 && f.errors.length === 0, change + ' prevents follow-up request');
        }
    }],
    ['timeout rejects timed callers and expires late detection', async check => {
        const f = translateFixture({ stored: 'true' }), detection = translateGate(), deadline = translateGate();
        f.behavior.fetch = () => detection.promise; f.behavior.timeout = () => deadline.promise;
        const pending = f.controller.run('Original', true); await translateFlush(); deadline.reject(Error('Timeout exceeded'));
        let rejected = false; try { await pending; } catch (error) { rejected = error.message === 'Timeout exceeded'; }
        check(rejected && f.errors.length === 1 && f.states.at(-1).pending === 0, 'timeout visible and preserves reader rejection contract');
        detection.resolve({ ok: true, json: async () => ({ data: { detections: [[{ language: 'fr' }]] } }) }); await translateFlush();
        check(f.calls.length === 1 && f.errors.length === 1, 'late detection cannot translate or repeat feedback');
    }],
    ['HTTP/malformed/network failures are visible without automatic retry', async check => {
        const f = translateFixture(); f.behavior.fetch = () => ({ ok: false, status: 403 });
        check(await f.controller.run('Original') === 'Original' && f.errors[0].message.includes('403') && f.calls.length === 1, 'HTTP failure keeps original');
        f.behavior.fetch = () => ({ ok: true, json: async () => ({ data: { detections: [[{ language: {} }]] } }) }); await f.controller.run('Original');
        check(f.errors[1].message.includes('invalid response'), 'malformed detection rejected');
        f.behavior.fetch = () => { throw Error('offline'); }; await f.controller.run('Original'); check(f.errors[2].message === 'offline', 'network failure visible');
        delete f.behavior.fetch; check(await f.controller.run('Original') === '<b>Translated</b>', 'explicit later attempt recovers');
    }],
    ['form duplicates, newer text and changed account isolation', async check => {
        const f = translateFixture(), gate = translateGate(); f.behavior.fetch = () => gate.promise;
        const pending = f.controller.handle(), duplicate = f.controller.handle(); check(pending === duplicate, 'form duplicates coalesced'); await translateFlush(); f.text('New input');
        gate.resolve({ ok: true, json: async () => ({ data: { detections: [[{ language: 'en' }]] } }) });
        check(await pending === false && f.results.length === 0, 'newer input protected');
        delete f.behavior.fetch; await f.controller.handle(); check(f.results[0] === '<b>Translated</b>', 'current form receives result');
        const accountGate = translateGate(); f.behavior.fetch = () => accountGate.promise; const old = f.controller.handle(); await translateFlush(); f.key('new-account');
        accountGate.resolve({ ok: true, json: async () => ({ data: { detections: [[{ language: 'en' }]] } }) });
        check(await old === false && f.results.length === 1, 'account replacement cannot overwrite form');
        const toggleGate = translateGate(); f.behavior.fetch = () => toggleGate.promise; const toggled = f.controller.handle(); await translateFlush(); f.controller.toggle();
        toggleGate.resolve({ ok: true, json: async () => ({ data: { detections: [[{ language: 'en' }]] } }) });
        check(await toggled === false && f.results.length === 1, 'preference change expires pending form output');
    }],
    ['real wrappers, key constant and literal form view', async check => {
        const f = translateFixture({}, true); if (translationEnabled) toggleTranslation(); toggleTranslation();
        check(translationEnabled && document.getElementById('translation-toggle-btn').textContent === 'Translate: ON' && f.writes.at(-1) === 'true', 'real alias/view/key-constant toggle');
        check(await processTranslationWithTimeout('Bonjour') === '<b>Translated</b>' && await detectLanguage('Bonjour') === 'fr', 'legacy timed and detection APIs');
        check(await translateToEnglish('Bonjour', 'fr') === '<b>Translated</b>', 'legacy explicit translation API');
        await handleTranslation(); check(document.getElementById('translated-text').textContent === '<b>Translated</b>', 'real form outputs literal text');
        f.key(null); check(await detectLanguage('Original') === 'en' && await translateToEnglish('Original','fr') === 'Original', 'direct missing-key contracts');
        check(Object.keys(window.CList.state.translation).sort().join() === 'enabled,pending', 'bridge has safe state only'); f.dispose();
    }]
];
