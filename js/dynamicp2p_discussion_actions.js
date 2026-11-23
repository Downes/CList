/// <reference path="./clist-types.js" />
function createP2pDiscussionActionsController(deps, initialView) {
    const source = deps.source(); let view = initialView, operation = null, phase = 'idle', message = '', disposed = false, revision = 0;
    const current = () => !disposed && deps.source() === source;
    const valid = op => current() && operation === op;
    const render = () => {
        if (!current()) return;
        /** @type {CListDiscussionActionState} */
        const state = { phase, kind: operation?.kind || null, receipt: operation?.receipt || null };
        deps.state(state);
        if (!view.alive()) return;
        const id = ++revision, op = operation;
        const guarded = fn => () => { if (current() && id === revision && operation === op && view.alive()) return fn(); };
        const callbacks = {};
        if (phase === 'uncertain' || phase === 'review') callbacks.check = guarded(() => controller.check());
        if ((phase === 'review' || phase === 'rejected') && deps.owns(op)) callbacks.retry = guarded(() => dispatch(op));
        if (phase === 'effects-error') callbacks.effects = guarded(() => apply(op));
        if (['review', 'rejected', 'complete', 'stale'].includes(phase)) callbacks.dismiss = guarded(() => { operation = null; phase = 'idle'; message = ''; render(); });
        const target = operation ? (operation.kind === 'create' ? 'Create ' : 'Leave ') + operation.name
            + (operation.kind === 'create' ? (operation.public ? ' (public). ' : ' (private). ') : '. ') : '';
        view.render({ ...state, message: target + message }, callbacks);
    };
    const apply = async op => {
        if (!valid(op)) return;
        if (!deps.owns(op)) { phase = 'stale'; message = 'The request was accepted, but the conversation changed. Current chat was preserved.'; render(); return; }
        phase = 'pending'; message = 'Updating local chat…'; render();
        try {
            await deps.apply(op);
            if (!valid(op)) return;
            if (!deps.owns(op)) { phase = 'stale'; message = 'The request was accepted. Current chat was preserved.'; render(); return; }
            if (view.alive()) view.active(op.kind === 'create');
            phase = 'complete'; message = (op.kind === 'create' ? 'Created discussion: ' : 'Left discussion: ') + op.name; render();
        } catch (error) {
            if (valid(op)) { console.error('Discussion local updates failed:', error); phase = 'effects-error'; message = 'The service accepted the request. Local updates failed: ' + (error.message || String(error)); render(); }
        }
    };
    const dispatch = async op => {
        if (!valid(op) || !deps.owns(op) || phase === 'pending') return;
        phase = 'pending'; message = (op.kind === 'create' ? 'Creating ' : 'Leaving ') + op.name + '…'; render();
        let result;
        try { result = await deps.write(op); }
        catch (error) { result = { status: 'uncertain', message: error.message || String(error) }; }
        op.receipt = result.status;
        if (!valid(op)) return;
        if (result.status === 'accepted') {
            await apply(op);
            return { status: op.receipt, phase, name: op.name, kind: op.kind };
        }
        console.error('Discussion request was not confirmed:', result.message);
        phase = result.status === 'rejected' ? 'rejected' : 'uncertain';
        message = result.status === 'rejected' ? result.message : 'Could not confirm the original request for ' + op.name + '. Check the discussion list before retrying. ' + result.message;
        if (op.effects.heartbeatPaused) message += ' Heartbeat is paused; local connections are retained.';
        render();
        return { status: op.receipt, phase, name: op.name, kind: op.kind };
    };
    const controller = {
        sameSource: current,
        attach(next) { if (view !== next) { view.dispose(); view = next; revision++; } render(); },
        present: render,
        async begin(kind, origin, capturedValues) {
            if (!current() || !view.alive() || !view.accepts(origin, kind)) return;
            if (['pending', 'uncertain', 'checking', 'review', 'effects-error'].includes(phase)) { render(); return { status: 'blocked', phase }; }
            let captured;
            try { captured = deps.capture(kind, capturedValues || view.values()); }
            catch (error) { phase = 'rejected'; message = error.message || String(error); operation = null; console.error('Discussion validation failed:', error); render(); return; }
            if (operation?.receipt === 'accepted' && operation.kind === kind && operation.name === captured.name
                && (kind === 'leave' || (operation.peerId === captured.peerId && operation.public === captured.public))) { render(); return { status: 'accepted', phase, name: operation.name, kind }; }
            operation = { ...captured, kind, receipt: null }; phase = 'idle'; return dispatch(operation);
        },
        async check() {
            const op = operation;
            if (!valid(op) || !['uncertain', 'review'].includes(phase)) return;
            phase = 'checking'; message = 'Checking the captured discussion service…'; render();
            try {
                const data = await deps.read(op);
                if (!valid(op)) return;
                if (data.kind === 'login') throw Error('Log in to review this request.');
                const present = data.items.some(item => item.name === op.name && (op.kind === 'leave' || item.peerId === op.peerId));
                phase = 'review'; message = (present ? 'A matching listing is visible. ' : 'No matching listing is visible. ')
                    + 'This does not confirm the original write or its visibility setting. Retry only if needed: ' + op.name; render();
            } catch (error) { if (valid(op)) { console.error('Discussion review failed:', error); phase = 'uncertain'; message = 'Could not check the original request: ' + (error.message || String(error)); render(); } }
        },
        dispose() { if (disposed) return; disposed = true; revision++; view.dispose(); }
    };
    return controller;
}
