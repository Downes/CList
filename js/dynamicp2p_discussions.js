/// <reference path="./clist-types.js" />
function createP2pDiscussionsController(deps, view) {
    let version = 0, source = '', disposed = false, abort = null, items = [], phase = 'empty';
    const pending = new Set(), accepted = new Set();
    const live = () => !disposed && view.alive();
    const current = id => live() && id === version && deps.source() === source;
    const publish = () => {
        /** @type {CListDiscussionListState} */
        const state = { phase, count: items.length, joiningCount: pending.size };
        if (live()) deps.state(state);
    };
    const indices = peerId => items.flatMap((item, index) => item.peerId === peerId ? [index] : []);
    const join = async (id, index) => {
        if (!current(id) || !view.current(index)) return;
        const item = items[index];
        if (!item || pending.has(item.peerId) || accepted.has(item.peerId)) return;
        pending.add(item.peerId); view.joining(indices(item.peerId), true); publish();
        try {
            const result = await deps.join({ ...item }, () => current(id) && view.current(index));
            if (!current(id) || !view.current(index)) return;
            if (!result) throw Error('Could not start the connection. Try joining again.');
            accepted.add(item.peerId); view.joined(index, result.existing);
        } catch (error) {
            if (current(id) && view.current(index)) { console.error('Could not join discussion:', error); view.joinFailed(index, error); }
        } finally {
            if (current(id)) { pending.delete(item.peerId); view.joining(indices(item.peerId), accepted.has(item.peerId)); publish(); }
        }
    };
    const controller = {
        alive: live,
        async refresh() {
            if (!live()) return;
            const id = ++version; abort?.abort(); abort = new AbortController();
            source = deps.source(); items = []; pending.clear(); accepted.clear(); phase = 'loading';
            view.loading(); publish();
            try {
                const request = deps.capture();
                const result = await deps.read(request, abort.signal);
                if (!current(id)) return;
                items = result.items.map(item => ({ ...item }));
                phase = result.kind === 'login' ? 'login' : items.length ? 'ready' : 'empty';
                if (phase === 'login') view.login(); else if (phase === 'empty') view.empty();
                else view.show(items, index => join(id, index));
                publish();
            } catch (error) {
                if (!current(id)) return;
                console.error('Could not load discussions:', error); phase = 'error'; publish();
                view.failed(error, () => { if (current(id)) return controller.refresh(); });
            }
        },
        dispose() { if (disposed) return; disposed = true; version++; abort?.abort(); pending.clear(); accepted.clear(); view.dispose(); }
    };
    return controller;
}
let _p2pDiscussionsController = null;
function refreshP2pDiscussions() {
    if (!_p2pDiscussionsController?.alive()) {
        _p2pDiscussionsController?.dispose();
        const controller = createP2pDiscussionsController({
            source: () => JSON.stringify([p2pSessionSource(), window.CList.defaults.DISCUSSIONS]),
            capture() {
                const url = window.CList.config.flaskSiteUrl;
                return { url: window.CList.defaults.DISCUSSIONS + '/api/discussions',
                    token: getSiteSpecificCookie(url, window.CList.keys.ACCESS_TOKEN) };
            },
            read: (request, signal) => fetchP2pDiscussions(request, { fetch, signal }),
            join(item, current) {
                const session = ensureP2pSession();
                if (!current() || !session?.isCurrent()) return null;
                if (session.resources.connections[item.peerId]) return { existing: true };
                return session.connect(item.peerId, item.name) ? { existing: false } : null;
            },
            state: state => { if (_p2pDiscussionsController === controller) window.CList.state.chatDiscussions = state; }
        }, createP2pDiscussionsView());
        _p2pDiscussionsController = controller;
    }
    return _p2pDiscussionsController.refresh();
}
