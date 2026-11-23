// Layout dialog state/receipts stay private; native PageStore and embedded APIs are reused.
function createSlidesLayoutController(deps) {
    let active = null, pending = null;
    function state(op, phase, busy) {
        if (active !== op) return;
        /** @type {CListSlidesLayoutState} */
        const value = { kind: op.kind, phase, busy, receipt: op.receipt || 'none' }; deps.state(value);
    }
    function owned(op) { return active === op && !op.done && deps.current(op.source) && op.view.current(); }
    function settle(op, value, close = true) {
        if (op.done) return; op.done = true; op.stop?.(); if (close) op.view.close();
        if (active === op) { state(op, 'closed', false); active = null; } op.resolve(value);
    }
    async function finish(op) {
        if (!owned(op)) { settle(op, null); return false; }
        if (op.kind === 'save' && !op.reconciled) { await deps.register(op.source, op.result.value); op.reconciled = true; }
        if (!owned(op)) { settle(op, null); return false; }
        if (op.kind !== 'delete' && op.view.title().trim() !== op.request.title) {
            state(op, 'saved', false); op.view.message('Saved as “' + op.request.title + '”. Your newer name text has been kept. Close when ready.'); op.view.action('Close'); op.finishOnly = true; return true;
        }
        const value = op.kind === 'delete' ? true : op.result.value;
        if (pending === op) pending = null;
        settle(op, value);
        deps.status(op.kind === 'save' ? 'Slide layout saved. Choose it under New slide layout.' : op.kind === 'delete' ? 'Saved layout deleted.' : 'Saved layout renamed.');
        if (op.kind === 'save') deps.complete?.(op.source);
        return true;
    }
    async function submit(op) {
        if (!owned(op)) { if (active === op) settle(op, null); return false; }
        if (pending) return false;
        if (op.finishOnly) { settle(op, op.result.value); return true; }
        const title = op.kind === 'delete' ? op.layout.label : op.view.title().trim();
        if (op.kind !== 'delete' && (!title || title.length > 120)) { op.view.error(new Error('Enter a layout name of 1–120 characters.')); return false; }
        pending = op; state(op, 'working', true); op.view.busy(true);
        const assert = () => { if (!owned(op)) throw Object.assign(new Error('This layout dialog expired. Reopen it to continue.'), { code: 'ExpiredLayout' }); };
        const store = op.source.store;
        const io = { assert, get: store.get.bind(store), save: store.save.bind(store), remove: store.remove.bind(store) };
        try {
            if (op.result) return await finish(op);
            if (op.receipt === 'uncertain') {
                const check = await checkSlideLayoutWrite(op.request, op.attempted, io);
                if (check.confirmed) { op.receipt = 'accepted'; op.result = { value: op.kind === 'delete' ? true : op.attempted.value, page: check.record }; return await finish(op); }
                op.receipt = 'none'; op.view.action(op.label); op.view.message('Current storage does not confirm the earlier write' + (check.record ? ' (current title: ' + check.record.title + ')' : '') + '. Review before submitting again.');
                state(op, 'review', false); return false;
            }
            op.request = { kind: op.kind, layout: op.layout, title }; op.attempted = null;
            await writeSlideLayout(op.request, { ...io,
                writing: attempted => { op.attempted = attempted; }, accepted: result => { op.result = result; op.receipt = 'accepted'; } });
            return await finish(op);
        } catch (error) {
            deps.log(error);
            if (op.attempted && !op.result && !['RevisionConflict', 'InvalidData', 'ExpiredLayout'].includes(error.code)) op.receipt = 'uncertain';
            if (owned(op)) {
                state(op, 'failed', false);
                op.view.error(new Error((op.result ? 'The layout was saved, but the editor update failed. ' : '') + error.message));
                op.view.action(op.result ? 'Retry editor update' : op.receipt === 'uncertain' ? 'Check saved layout' : op.label);
            } else settle(op, null);
            return false;
        } finally { if (pending === op) pending = null; if (owned(op)) { op.view.busy(false); state(op, op.result ? 'saved' : op.receipt === 'uncertain' ? 'review' : 'ready', false); } }
    }
    return {
        open(kind, layout) {
            if (pending) { deps.status('Wait for the current layout operation to finish.'); return Promise.resolve(null); }
            if (active) settle(active, null);
            const source = deps.capture();
            const op = active = { kind, layout: structuredClone(layout), source, receipt: 'none', done: false,
                label: kind === 'save' ? 'Save layout' : kind === 'delete' ? 'Delete layout' : 'Rename layout' };
            const promise = new Promise(resolve => { op.resolve = resolve; });
            try { op.view = deps.view(kind, op.layout, { submit: () => submit(op), cancel: () => { if (!pending) settle(op, op.result ? op.result.value : null); } }); }
            catch (error) { deps.log(error); deps.status('Could not open the layout dialog: ' + error.message); active = null; op.resolve(null); return promise; }
            op.stop = op.view.watch(() => { if (!op.view.current()) settle(op, null, false); });
            state(op, 'ready', false); return promise;
        },
    };
}
