function slidesIOGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function slidesIOFlush() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function slidesIOFixture() {
    const native = slidesLayoutFixture(), calls = [], statuses = [], errors = [], states = [], registered = [], deferred = [], reports = [], behavior = {}; let epoch = 1, closed = 0, synced = 0, picked = 0;
    const root = document.createElement('div'); root.id = 'slidesDiv'; document.body.appendChild(root);
    const file = { name: 'test.pptx', size: 4, async arrayBuffer() { calls.push(['bytes']); if (behavior.bytes) return await behavior.bytes(); return new Uint8Array([1, 2, 3]).buffer; } };
    const editor = { document: {}, async importPowerPoint(data, filename) { calls.push(['import', this, data, filename]); if (behavior.import) return await behavior.import(); return { count: 2, warnings: ['<Literal warning>'] }; },
        async exportHtml() { calls.push(['html', this]); if (behavior.export) return await behavior.export(); },
        async exportPowerPoint() { calls.push(['powerpoint', this]); if (behavior.export) return await behavior.export(); return ['Approximation']; },
        async exportPdf() { calls.push(['pdf', this]); },
        registerSavedLayout(value) { if (behavior.register) throw new Error('Invalid embedded layout'); registered.push(value); },
        importContent(content, refs) { calls.push(['content', content, refs]); return 'slide-id'; }, loadSnapshot(value) { calls.push(['snapshot', value]); this.document = {}; },
        addReferences() {}, getReferences() { return []; } };
    Object.assign(globalThis, { currentEditor: 'slides',
        showStatusMessage: text => statuses.push(text), showErrorModal: (message, options) => errors.push([message, options]),
    });
    window.showOpenFilePicker = async () => { picked++; if (behavior.picker) return await behavior.picker(); return [{ getFile: async () => file }]; };
    const capture = () => ({ editor, document: editor.document, store: window.CList.pageStore, epoch });
    const current = source => currentEditor === 'slides' && source.editor === editor && source.document === editor.document && source.epoch === epoch;
    const api = createSlidesIOController({ capture, current, state: value => states.push(value), log() {},
        sync: () => { synced++; if (behavior.sync) throw new Error('Reference refresh failed'); }, closeLoad: () => { closed++; }, defer: callback => deferred.push(callback), report: callback => reports.push(callback),
    }, createSlidesIOView());
    return { native, editor, api, calls, statuses, errors, states, registered, deferred, reports, behavior, file, root,
        get closed() { return closed; }, get synced() { return synced; }, get picked() { return picked; },
        expire() { epoch++; }, replace() { editor.document = {}; }, dispose() { native.dispose(); root.remove(); delete window.showOpenFilePicker; } };
}
const slidesIOCases = [
    ['picker import captures bytes/editor and deduplicates before acquisition with literal warnings', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.behavior.picker = () => gate.promise;
        const first = f.api.pickImport(), second = f.api.pickImport(); check(first === second, 'one pending picker import'); await slidesIOFlush();
        gate.resolve([{ getFile: async () => f.file }]); await first; f.reports.shift()();
        const call = f.calls.find(call => call[0] === 'import'); check(f.picked === 1 && call[1] === f.editor && call[3] === 'test.pptx' && new Uint8Array(call[2])[2] === 3, 'captured bound editor/file bytes');
        check(document.getElementById('generic-modal').textContent.includes('<Literal warning>') && !document.getElementById('generic-modal').querySelector('Literal') && f.closed === 1 && f.synced === 1, 'safe report and owned completion');
        check(Object.keys(f.states[0]).sort().join() === 'exports,importing', 'safe busy summary'); f.dispose();
    }],
    ['cancel, filename and size validation do not dispatch embedded imports', async check => {
        const f = slidesIOFixture(); f.behavior.picker = async () => { throw Object.assign(new Error('Cancelled'), { name: 'AbortError' }); }; await f.api.pickImport();
        check(!f.errors.length && !f.calls.length, 'picker Cancel is silent'); f.behavior.picker = null; f.file.name = 'legacy.ppt'; await f.api.pickImport();
        check(f.errors.at(-1)[0].includes('.pptx') && !f.calls.some(call => call[0] === 'import'), 'legacy extension rejected');
        f.file.name = 'big.pptx'; f.file.size = 101 * 1024 * 1024; await f.api.pickImport(); check(f.errors.at(-1)[0].includes('100 MB') && !f.calls.some(call => call[0] === 'bytes'), 'oversized file not read'); f.dispose();
    }],
    ['source changes during picker or file read prevent import dispatch', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.behavior.bytes = () => gate.promise; const pending = f.api.pickImport(); await slidesIOFlush(); f.replace(); gate.resolve(new ArrayBuffer(1)); await pending;
        check(!f.calls.some(call => call[0] === 'import') && !f.closed && !f.errors.length, 'old file bytes cannot modify a new document'); f.dispose();
    }],
    ['started imports retain original effects and suppress late UI, incompatible requests do not share success', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.behavior.import = () => gate.promise; const data = new ArrayBuffer(1), old = f.api.importBytes(data, 'original'); await slidesIOFlush(); f.replace();
        let rejected = false; await f.api.importBytes(new ArrayBuffer(2), 'new').catch(() => { rejected = true; }); check(rejected && f.calls.filter(call => call[0] === 'import').length === 1, 'different source/import blocked explicitly');
        const notices = f.statuses.length; gate.resolve({ count: 1, warnings: [] }); await old;
        check(f.statuses.length === notices && !f.closed && !f.synced && !document.getElementById('generic-modal'), 'late import cannot close or report another surface'); f.dispose();
    }],
    ['byte-route errors propagate while accepted imports never replay after local feedback failure', async check => {
        const f = slidesIOFixture(); f.behavior.import = async () => { throw new Error('Embedded parser failed'); }; let rejected = false;
        await f.api.importBytes(new ArrayBuffer(1)).catch(() => { rejected = true; }); check(rejected && f.errors.at(-1)[0].includes('parser failed') && !f.closed, 'failure propagated without success effects');
        f.behavior.import = null; f.behavior.sync = true; const result = await f.api.importBytes(new ArrayBuffer(1));
        check(result.count === 2 && f.errors.at(-1)[0].includes('imported; local refresh') && f.calls.filter(call => call[0] === 'import').length === 2, 'accepted import not reported as needing reinsertion'); f.dispose();
    }],
    ['exports preserve method binding and duplicate locks, PDF means print-view handoff', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.behavior.export = () => gate.promise; const first = f.api.export('powerpoint'), second = f.api.export('powerpoint'); check(first === second, 'duplicate export shared'); await slidesIOFlush(); gate.resolve(['Warning']); await first;
        check(f.calls.filter(call => call[0] === 'powerpoint').length === 1 && f.calls[0][1] === f.editor && f.statuses.at(-1).includes('Warning'), 'captured bound export and warnings');
        f.behavior.export = null; await f.api.export('html'); await f.api.export('pdf'); check(f.statuses.at(-1).includes('print view opened') && f.calls.some(call => call[0] === 'html'), 'HTML and PDF adapter contracts'); f.dispose();
    }],
    ['stale export failures do not report against newer sources and locks release', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.behavior.export = () => gate.promise; const pending = f.api.export('html'); await slidesIOFlush(); f.expire();
        let blocked = false; await f.api.export('html').catch(() => { blocked = true; }); check(blocked, 'new source does not inherit old export completion'); const errors = f.errors.length;
        gate.reject(new Error('Old export failed')); await pending; check(f.errors.length === errors && f.states.at(-1).exports === 0, 'stale failure suppressed and busy released'); f.dispose();
    }],
    ['real PageStore refresh skips changed/malformed records and preserves other valid layouts', async check => {
        const f = slidesIOFixture(); f.native.seed(); f.native.records.set('corrupt', { id: 'corrupt', contentType: SLIDES_LAYOUT_TYPE, content: '{', title: 'Bad' });
        const changed = { id: 'changed', contentType: SLIDES_LAYOUT_TYPE, content: '{}', title: 'Changed' }; f.native.records.set('changed', changed);
        f.native.behavior.read = async id => { if (id === 'changed') changed.contentType = 'text/plain'; };
        await f.api.refresh(); check(f.registered.length === 1 && f.registered[0].extension.kept && !f.native.writes.length, 'captured read-only PageStore refresh');
        check(f.statuses.at(-1).includes('could not load'), 'partial failure visible'); f.dispose();
    }],
    ['superseded refresh and layout mutations reject old registry updates', async check => {
        const f = slidesIOFixture(), gate = slidesIOGate(); f.native.seed(); f.native.behavior.read = () => gate.promise; const old = f.api.refresh(); await slidesIOFlush(); f.api.invalidateRefresh(); gate.resolve(); await old;
        check(!f.registered.length && !f.errors.length, 'layout write invalidates old refresh'); f.native.behavior.read = null; await f.api.refresh(); check(f.registered.length === 1, 'explicit current refresh works'); f.dispose();
    }],
    ['snapshot deferred reference merges and direct imports retain original editor context', async check => {
        const f = slidesIOFixture(); f.api.snapshot({ format: 'mock' }); f.expire(); f.deferred.shift()(); check(f.synced === 0, 'stale snapshot reference callback rejected');
        const id = f.api.content({ type: 'text/plain', value: 'Captured' }, [{ url: 'https://exact.invalid' }]); check(id === 'slide-id' && f.calls.at(-1)[2][0].url === 'https://exact.invalid' && f.synced === 1, 'direct content and refs captured'); f.dispose();
    }],
    ['import reports survive caller cleanup and cannot replace a newer modal or source', async check => {
        const f = slidesIOFixture(); await f.api.importBytes(new ArrayBuffer(1));
        check(!document.getElementById('generic-modal') && f.reports.length === 1, 'report scheduled after caller cleanup');
        const newer = document.createElement('div'); newer.textContent = 'Newer dialog'; showModal(newer); f.reports.shift()();
        check(document.getElementById('generic-modal').textContent === 'Newer dialog' && f.statuses.at(-1).includes('Literal warning'), 'newer modal retained with status report');
        document.getElementById('generic-modal').remove(); await f.api.importBytes(new ArrayBuffer(1)); f.expire(); f.reports.shift()();
        check(!document.getElementById('generic-modal'), 'expired report suppressed'); f.dispose();
    }],
];
