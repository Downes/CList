const _collabShareWrites = new Map(); // Transient per-target locks/uncertainty, including rebuilt panels.
function createCollabShareActions(target, deps, feedback) {
    const copies = new Set(), valid = mode => ['edit','read'].includes(mode) && deps.current();
    return {
        async copy(mode) {
            if (!valid(mode) || copies.has(mode)) return false; copies.add(mode);
            try { await deps.copy(deps.link(mode), deps.current); return deps.current(); }
            catch (error) { if (deps.current()) feedback.error(error); return false; }
            finally { copies.delete(mode); }
        },
        chat(mode) {
            if (!valid(mode)) return false;
            try {
                if (!deps.chatCurrent()) throw Error('The chat discussion changed. Reopen Share to send an invite.');
                const sent = deps.chat({ type:'collab-invite',docId:target.docId,server:target.server,mode,title:target.inviteTitle || target.title,link:deps.link(mode) });
                if (!sent) throw Error('No connected peers to send to.');
                feedback.status('Invite sent to chat discussion.'); return true;
            } catch (error) { if (deps.current()) feedback.error(error); return false; }
        },
        post(mode) {
            if (!valid(mode)) return false;
            try { deps.post({ docId:target.docId,server:target.server,title:target.title,mode,link:deps.link(mode),current:deps.contextCurrent }); return true; }
            catch (error) { if (deps.current()) feedback.error(error); return false; }
        }
    };
}
function createCollabShareController(target, deps, view) {
    const writes = deps.writes || _collabShareWrites, key = deps.writeKey;
    let disposed = false, confirmed = null, busy = false, blocked = false, phase = 'loading', receipt = 'none', readJob = null;
    const owned = () => !disposed && deps.current() && view.alive();
    const render = () => {
        if (!owned()) return;
        /** @type {CListCollabShareState} */
        const value = { phase, busy, receipt }; deps.state(value);
        view.render({ confirmed, busy, blocked });
    };
    const assertCurrent = () => { if (!owned()) throw Error('The sharing panel expired.'); };
    const actions = createCollabShareActions(target, { ...deps, current: owned }, view.feedback);
    function load() {
        if (!owned()) return Promise.resolve(false); if (readJob) return readJob;
        if (busy) return Promise.resolve(false);
        if (writes.get(key)?.pending) { blocked = true; receipt = 'pending'; phase = 'pending'; render(); view.message('A sharing update is still pending. Check current settings when it completes.', true); return Promise.resolve(false); }
        busy = true; phase = 'loading'; render(); view.message('Loading sharing settings…');
        readJob = Promise.resolve().then(async () => {
            const value = await deps.read(target, assertCurrent); assertCurrent();
            if (writes.get(key)?.pending) { blocked = true; receipt = 'pending'; phase = 'pending'; view.message('A sharing update is still pending. Check current settings when it completes.', true); return false; }
            writes.delete(key); confirmed = value; blocked = false; receipt = 'none'; phase = 'ready'; view.message(''); return true;
        }).catch(error => { if (owned()) { phase = 'error'; blocked = true; view.error(error); } return false; })
            .finally(() => { readJob = null; busy = false; render(); });
        return readJob;
    }
    async function save(value) {
        if (!owned() || busy) return false;
        if (blocked || confirmed === null || writes.has(key)) { blocked = true; render(); view.message('Check current settings before changing access.', true); return false; }
        if (value === confirmed) return true;
        const operation = { pending:true, receipt:'pending' }; writes.set(key, operation); busy = true; phase = 'writing'; receipt = 'pending'; render(); view.message('Updating sharing settings…');
        try {
            await deps.write(target, !!value, operation, assertCurrent);
            if (owned()) { confirmed = !!value; blocked = false; phase = 'ready'; receipt = operation.receipt; view.message('Sharing update accepted.'); }
            return true;
        } catch (error) {
            if (operation.receipt === 'pending') operation.receipt = 'rejected'; // Failure before dispatch.
            if (owned()) { receipt = operation.receipt; blocked = receipt === 'uncertain'; phase = blocked ? 'uncertain' : 'error'; view.error(error); }
            return false;
        } finally {
            operation.pending = false;
            if (writes.get(key) === operation && operation.receipt !== 'uncertain') writes.delete(key);
            busy = false; render();
        }
    }
    view.mount(target, { ...actions, load, save }); render();
    return { load, save, actions, owned, dispose() { disposed = true; view.close(); } };
}
let _collabSharePanel = null;
function openCollabSharePanel(target, deps) {
    _collabSharePanel?.dispose();
    _collabSharePanel = createCollabShareController(target, deps, createCollabShareView());
    return _collabSharePanel.load();
}
