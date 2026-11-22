/**
 * @param {{docId:string,title?:string,links:{read:string}}} target Captured public document fields.
 * @param {string} timestamp Captured ISO citation time.
 * @returns {CListReference}
 */
function prepareCollabAnnotation(target, timestamp) {
    return { url: target.links.read, title: target.title || target.docId, service: 'Collab', feed: 'Collab',
        author_name: '', created_at: '', cited_at: timestamp };
}
function createCollabHeaderController(deps, view) {
    let disposed = false, pending = null;
    const owned = () => !disposed && deps.current() && view.alive();
    const state = action => {
        /** @type {CListCollabHeaderState} */
        const value = { busy: !!action, action }; if (owned()) { view.busy(value.busy); deps.state(value); }
    };
    function run(action) {
        if (!owned()) return Promise.resolve(false);
        if (pending) return pending;
        let snapshot, timestamp;
        try { snapshot = deps.capture(); timestamp = deps.now(); }
        catch (error) { view.error(action, error); return Promise.resolve(false); }
        state(action);
        const job = Promise.resolve().then(async () => {
            const current = () => owned() && (!snapshot.target || deps.targetCurrent(snapshot.target));
            if (!current()) return false;
            let target = snapshot.target;
            try {
                if (action === 'share') {
                    if (!target) target = await deps.ensure(snapshot, current);
                    if (!current() || !target || !deps.targetCurrent(target)) return false;
                    await deps.share(target); return owned() && deps.targetCurrent(target);
                }
                if (!target) throw Error('Open a document first before annotating.');
                await deps.reference(prepareCollabAnnotation(target, timestamp));
                if (!current()) return false;
                await deps.load();
                if (!current()) return false;
                view.reveal(); return true;
            } catch (error) {
                if (current() && (!target || deps.targetCurrent(target)) && error.code !== 'ExpiredCollabPreparation') view.error(action, error);
                return false;
            }
        }).finally(() => { if (pending === job) { pending = null; state(null); } });
        pending = job; return job;
    }
    const controller = { owned, share: () => run('share'), annotate: () => run('annotate'),
        dispose() { disposed = true; view.dispose(); } };
    view.bind(controller); state(null); return controller;
}
