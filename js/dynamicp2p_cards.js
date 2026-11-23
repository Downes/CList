/// <reference path="./clist-types.js" />
// Card state/action ownership. Service/editor APIs remain supplied by their existing modules.
function safeP2pCardUrl(value) {
    if (typeof value !== 'string') return '';
    try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) ? value : ''; } catch (_) { return ''; }
}
function createP2pCardsController(deps, view) {
    let disposed = false; const records = new Set();
    const alive = () => !disposed && deps.current() && view.alive();
    const current = record => alive() && records.has(record) && view.current(record.row);
    const publish = () => {
        for (const record of records) if (!view.current(record.row)) { view.disposeRow(record.row); records.delete(record); }
        /** @type {CListChatCardsState} */
        const summary = { count: records.size, busy: [...records].filter(record => record.pending).length };
        if (alive()) deps.state(summary);
    };
    const perform = async (record, run) => {
        if (!current(record) || record.pending) return;
        record.pending = true; view.busy(record.row, true); publish();
        try { await run(() => current(record)); }
        catch (error) { if (current(record)) { console.error('Chat card action failed:', error); view.error(record.row, error); } }
        finally { record.pending = false; if (current(record)) view.busy(record.row, false); publish(); }
    };
    const add = render => {
        if (!alive()) return null;
        const record = { row: null, pending: false };
        try { record.row = render(record); records.add(record); publish(); return record.row; }
        catch (error) { console.error('Could not render chat card:', error); if (alive()) view.error(null, error); return null; }
    };
    const relay = (row, packet) => {
        try { deps.relay(packet); }
        catch (error) { console.error('Could not relay chat card:', error); if (alive()) view.error(row, error); }
    };
    return {
        alive,
        share(data, sender) {
            return add(record => {
                const snapshot = structuredClone(data), displaySender = sender === null ? 'You (' + deps.username() + ')' : String(sender || 'A peer');
                const model = { kind: snapshot.kind, sender: displaySender, isOwn: sender === null,
                    title: String(snapshot.title || ''), displayUrl: String(snapshot.url || ''), url: safeP2pCardUrl(snapshot.url), excerpt: String(snapshot.excerpt || ''),
                    items: (Array.isArray(snapshot.items) ? snapshot.items : []).map(item => ({ title: String(item.title || ''), displayUrl: String(item.url || ''), url: safeP2pCardUrl(item.url) })) };
                const row = view.share(model, {
                    open: url => perform(record, () => deps.open(url)),
                    import: anchor => perform(record, () => deps.import(structuredClone(snapshot.items), anchor)),
                    load: () => perform(record, async valid => {
                        const target = deps.editor();
                        const escaped = deps.escape;
                        const content = '<p><strong><a href="' + escaped(model.url) + '">' + escaped(model.title || model.url) + '</a></strong></p>'
                            + (model.excerpt ? '<p>' + escaped(model.excerpt) + '</p>' : '');
                        await deps.load({ type: 'text/html', value: content }, target);
                        if (valid() && deps.editorCurrent(target)) {
                            /** @type {CListReference} */
                            const reference = { url: model.url, title: model.title || model.url, author_name: displaySender,
                                feed: 'Chat share', created_at: '', cited_at: deps.now(), id: model.url, guid: model.url };
                            deps.reference(reference);
                        }
                    })
                });
                relay(row, { type: 'chat-card', sender: displaySender, kind: model.kind, title: model.title, url: model.url || null, excerpt: model.excerpt,
                    items: model.items.map(item => ({ title: item.title || item.displayUrl, url: item.url || null })), isOwn: model.isOwn });
                return row;
            });
        },
        invite(invite, sender) {
            return add(record => {
                const snapshot = structuredClone(invite), name = String(sender || 'A peer');
                const title = String(snapshot.title || deps.localTitle(snapshot.docId) || snapshot.docId || 'a document');
                const row = view.invite({ sender: name, title, mode: snapshot.mode }, { open: () => perform(record, () => deps.invite(structuredClone(snapshot))) });
                relay(row, { type: 'chat-msg', html: '<em>' + deps.escape(name + ' shared a collab document: ' + title) + '</em>', isOwn: false, isEvent: false });
                return row;
            });
        },
        dispose() { if (disposed) return; disposed = true; for (const record of records) view.disposeRow(record.row); records.clear(); }
    };
}
let _p2pCards = null;
function getP2pCards() {
    if (!_p2pCards?.alive()) {
        _p2pCards?.dispose(); const guard = captureP2pSessionGuard();
        const controller = createP2pCardsController({
            current: guard, username: () => myUsername, escape: escapeHtml, now: () => new Date().toISOString(),
            localTitle: id => typeof localPartOf === 'function' ? localPartOf(id) : id,
            state: state => { if (_p2pCards === controller) window.CList.state.chatCards = state; },
            relay: packet => { if (chatBc) chatBc.postMessage(packet); }, open: url => openInBrowser(url),
            import: (items, anchor) => { if (typeof window.importCollectionFromChat !== 'function') throw Error('Collection import not available.'); return window.importCollectionFromChat(items, anchor); },
            invite: invite => { if (typeof window.openCollabInvite !== 'function') throw Error('Collab editor not available.'); return window.openCollabInvite(invite); },
            editor: () => ({ id: currentEditor, generation: window.CList.state.editorSwitching?.id, handler: editorHandlers[currentEditor] }),
            editorCurrent: target => currentEditor === target.id && window.CList.state.editorSwitching?.id === target.generation && editorHandlers[currentEditor] === target.handler,
            load: (content, target) => { if (typeof target.handler?.loadContent !== 'function') throw Error('The selected editor cannot load this content.'); return target.handler.loadContent(content); },
            reference: value => pushReference(value)
        }, createP2pCardsView());
        _p2pCards = controller;
    }
    return _p2pCards;
}
