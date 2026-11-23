function slidesLayoutGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function slidesLayoutFlush() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
function slidesLayoutFixture() {
    const records = new Map(), writes = [], registrations = [], notices = [], states = [], behavior = {}; let owner = 1, notify = null;
    const store = window.CList.pageStore;
    Object.assign(globalThis, {
        _pageStoreGet: async id => { if (behavior.read) await behavior.read(id); return records.has(id) ? structuredClone(records.get(id)) : null; },
        _pageStoreGetAll: async () => [...records.values()].map(value => structuredClone(value)),
        _pageStoreReadThenWrite: async (id, decide) => {
            if (behavior.before) await behavior.before(id);
            const result = decide(records.has(id) ? structuredClone(records.get(id)) : null);
            if (result.write) writes.push({ id, write: result.write });
            if (result.write === 'put') records.set(id, structuredClone(result.record));
            if (result.write === 'delete') records.delete(id);
            if (behavior.after) await behavior.after(id);
            return result.result;
        },
        showModal(body) { document.getElementById('generic-modal')?.remove(); const modal = document.createElement('div'); modal.id = 'generic-modal'; modal.appendChild(body); document.body.appendChild(modal); },
    });
    let view;
    const api = createSlidesLayoutController({
        capture: () => ({ owner, store }), current: source => source.owner === owner,
        state: value => states.push(value), status: value => notices.push(value), log() {},
        register: async (source, value) => { registrations.push(structuredClone(value)); if (behavior.register) throw new Error('Editor update failed'); },
        complete: () => notices.push('completed'),
        view: (...args) => {
            view = createSlidesLayoutView(...args); const watch = view.watch;
            view.watch = callback => { notify = callback; const stop = watch(callback); return () => { notify = null; stop(); }; }; return view;
        },
    });
    const layout = { format: 'clist-slide-layout-v1', id: 'saved-layout', label: '<Literal>', update: 'AQID', extension: { kept: true } };
    return { records, writes, registrations, notices, states, behavior, api, layout,
        button(text) { return Array.from(document.getElementById('generic-modal').querySelectorAll('button')).find(node => node.textContent === text); },
        title(value) { document.getElementById('generic-modal').querySelector('input').value = value; },
        text: () => document.getElementById('generic-modal')?.textContent || '',
        seed(value = layout) { records.set(value.id, { id: value.id, title: value.label, content: JSON.stringify(value), contentType: SLIDES_LAYOUT_TYPE, editorType: 'slides', revision: 3, references: [{ url: 'https://ref.invalid' }], publications: [{ url: 'https://published.invalid' }], extension: 'record' }); },
        expire() { owner++; }, notify() { notify?.(); },
        closeExternally() { document.getElementById('generic-modal')?.remove(); notify?.(); },
        dispose() { document.getElementById('generic-modal')?.remove(); notify?.(); },
    };
}
const slidesLayoutCases = [
    ['Save uses real PageStore and literal modal, preserves extensions and reconciles original editor', async check => {
        const f = slidesLayoutFixture(); const result = f.api.open('save', f.layout); f.title('Saved'); f.button('Save layout').click();
        const value = await result, record = f.records.get(f.layout.id);
        check(value.label === 'Saved' && value.extension.kept && record.revision === 1 && record.contentType === SLIDES_LAYOUT_TYPE, 'native saved shape and extensions');
        check(f.registrations.length === 1 && f.writes.length === 1 && f.notices.includes('completed'), 'one write and editor update');
        check(Object.keys(f.states[0]).sort().join() === 'busy,kind,phase,receipt' && !JSON.stringify(f.states).includes('AQID'), 'safe state'); f.dispose();
    }],
    ['Rename uses latest stored data/revision and leaves unrelated metadata intact', async check => {
        const f = slidesLayoutFixture(); f.seed(); const latest = JSON.parse(f.records.get(f.layout.id).content); latest.update = 'NEW'; latest.other = false; f.records.get(f.layout.id).content = JSON.stringify(latest);
        const promise = f.api.open('rename', f.layout); f.title('Renamed'); f.button('Rename layout').click(); const result = await promise, record = f.records.get(f.layout.id);
        check(result.update === 'NEW' && result.other === false && result.extension.kept && record.revision === 4, 'latest payload/conditional revision');
        check(record.publications[0].url === 'https://published.invalid' && record.references[0].url === 'https://ref.invalid' && record.extension === 'record', 'record metadata retained'); f.dispose();
    }],
    ['Delete Cancel is read-free, confirmation removes only captured record', async check => {
        const f = slidesLayoutFixture(); f.seed(); let reads = 0; f.behavior.read = async () => { reads++; };
        let pending = f.api.open('delete', f.layout); check(f.text().includes('<Literal>') && !document.getElementById('generic-modal').querySelector('Literal'), 'literal delete label');
        f.button('Cancel').click(); check(await pending === null && reads === 0 && f.records.has(f.layout.id), 'Cancel has no reads/writes');
        f.records.set('other', { id: 'other' }); f.records.get(f.layout.id).content = '{corrupt'; pending = f.api.open('delete', f.layout); f.button('Delete layout').click();
        check(await pending === true && !f.records.has(f.layout.id) && f.records.has('other'), 'captured delete only'); f.dispose();
    }],
    ['validation and duplicates prevent invalid or repeated writes', async check => {
        const f = slidesLayoutFixture(), gate = slidesLayoutGate(); const pending = f.api.open('save', f.layout); f.title(' '); f.button('Save layout').click();
        check(!f.writes.length && f.text().includes('1–120'), 'empty title rejected'); f.title('Captured'); f.behavior.before = () => gate.promise;
        const button = f.button('Save layout'); button.click(); button.click(); await slidesLayoutFlush();
        check(await f.api.open('delete', f.layout) === null, 'pending dialog cannot be replaced by another write'); gate.resolve(); await pending;
        check(f.writes.length === 1, 'duplicate write blocked'); f.dispose();
    }],
    ['failed editor update retries reconciliation without another storage write', async check => {
        const f = slidesLayoutFixture(); f.behavior.register = true; const pending = f.api.open('save', f.layout); f.button('Save layout').click(); await slidesLayoutFlush();
        check(f.writes.length === 1 && f.text().includes('editor update failed') && f.button('Retry editor update'), 'accepted storage separated from local failure');
        f.behavior.register = false; f.button('Retry editor update').click(); await pending;
        check(f.writes.length === 1 && f.registrations.length === 2, 'metadata-only retry'); f.dispose();
    }],
    ['uncertain storage receipt is checked read-only before completing or another explicit attempt', async check => {
        const f = slidesLayoutFixture(); f.behavior.after = async () => { throw new Error('Response lost'); }; const pending = f.api.open('save', f.layout); f.button('Save layout').click(); await slidesLayoutFlush();
        check(f.writes.length === 1 && f.button('Check saved layout') && !f.registrations.length, 'uncertain write waits for check');
        f.behavior.after = null; f.button('Check saved layout').click(); const result = await pending;
        check(f.writes.length === 1 && result.id === f.layout.id && f.registrations.length === 1, 'read confirmation has no second write'); f.dispose();
    }],
    ['unconfirmed record requires explicit reviewed retry and existing Save IDs cannot overwrite', async check => {
        const f = slidesLayoutFixture(); f.behavior.before = async () => { throw new Error('Storage unavailable'); }; const pending = f.api.open('save', f.layout); f.button('Save layout').click(); await slidesLayoutFlush();
        f.behavior.before = null; f.button('Check saved layout').click(); await slidesLayoutFlush();
        check(!f.writes.length && f.text().includes('does not confirm') && f.button('Save layout'), 'failed confirmation does not write');
        f.button('Save layout').click(); await pending; const count = f.writes.length; const other = f.api.open('save', f.layout); f.button('Save layout').click(); await slidesLayoutFlush();
        check(f.writes.length === count && f.text().includes('already exists'), 'existing ID preserved'); f.button('Cancel').click(); await other; f.dispose();
    }],
    ['source expiry or replaced/closed modal settles callbacks without changing newer UI', async check => {
        const f = slidesLayoutFixture(), gate = slidesLayoutGate(); f.seed(); f.behavior.read = () => gate.promise; const pending = f.api.open('rename', f.layout); f.title('Old'); f.button('Rename layout').click(); await slidesLayoutFlush(); f.expire(); gate.resolve(); await slidesLayoutFlush();
        check(await pending === null && !f.writes.length, 'expired preparation cannot write'); f.behavior.read = null;
        const idle = f.api.open('rename', f.layout); f.expire(); f.button('Rename layout').click(); check(await idle === null && !f.writes.length, 'idle expired dialog settles without writes');
        const closed = f.api.open('delete', f.layout); f.closeExternally(); check(await closed === null, 'external close settles picker promise');
        const old = f.api.open('rename', f.layout), oldButton = f.button('Rename layout'); const next = f.api.open('delete', f.layout); oldButton.click();
        check(await old === null && !f.writes.length && f.text().includes('Delete saved layout'), 'retired callback cannot replace new dialog'); f.button('Cancel').click(); await next; f.dispose();
    }],
    ['newer name draft survives an accepted write and revision conflicts do not force overwrite', async check => {
        const f = slidesLayoutFixture(), gate = slidesLayoutGate(); f.behavior.before = () => gate.promise; const pending = f.api.open('save', f.layout); f.title('Captured'); f.button('Save layout').click(); await slidesLayoutFlush(); f.title('Newer'); gate.resolve(); await slidesLayoutFlush();
        check(f.text().includes('newer name') && document.getElementById('generic-modal').querySelector('input').value === 'Newer' && f.records.get(f.layout.id).title === 'Captured', 'newer draft preserved'); f.button('Close').click(); await pending; f.dispose();
        const g = slidesLayoutFixture(); g.seed(); g.behavior.before = async () => { g.records.get(g.layout.id).revision++; }; const conflict = g.api.open('rename', g.layout); g.title('Conflict'); g.button('Rename layout').click(); await slidesLayoutFlush();
        check(!g.writes.length && g.text().includes('saved elsewhere') && !g.button('Check saved layout'), 'revision conflict is definite and does not overwrite'); g.button('Cancel').click(); await conflict; g.dispose();
    }],
];
