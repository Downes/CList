/// <reference path="./clist-types.js" />
// Private captured row/controller lifetime. No DOM or service transport here.
/** @param {CListEditorCollection} col */
function createCollectionDraftController(col, deps, view) {
    const state = createCollectionDraftState(col.items), pending = new Map();
    let disposed = false;
    const current = () => !disposed && deps.isCurrent() && view.isCurrent();
    const valid = ticket => current() && collectionDraftRowCurrent(state, ticket) && view.rowCurrent(ticket);
    /** @returns {CListCollectionDraftState} */
    const summary = () => ({ generation: state.generation, count: state.items.length, busy: pending.size > 0 });
    function refresh() {
        if (!current()) return false;
        state.generation++;
        deps.present(summary());
        view.render(state.items.map((item, index) => ({ item, index, generation: state.generation,
            expanded: state.expanded.has(item), busy: pending.has(item) })), api);
        return true;
    }
    function editTarget(item) {
        if (item.role === 'contains' && item.collectionId && deps.targets.collections.has(item.collectionId)) return { page: null };
        const page = deps.targets.pages.get(item.url);
        if (page && deps.hasEditor(page.mimeType)) return { page };
        if (item.localOnly && item.url?.startsWith('blob:') && deps.hasEditor(item.mimeType)) return { page: null };
        return null;
    }
    async function action(ticket, name, operation) {
        if (!valid(ticket) || pending.has(ticket.item)) return false;
        pending.set(ticket.item, name); deps.present(summary()); view.busy(ticket, true);
        try { await operation(); return true; }
        catch (error) { deps.log(error); if (valid(ticket)) view.error(error); return false; }
        finally {
            pending.delete(ticket.item);
            if (current()) { deps.present(summary()); if (valid(ticket)) view.busy(ticket, false); else refresh(); }
        }
    }
    const api = {
        items: state.items, refresh,
        dispose() { disposed = true; state.generation++; },
        toggle(ticket) {
            if (!valid(ticket)) return null;
            if (state.expanded.has(ticket.item)) state.expanded.delete(ticket.item); else state.expanded.add(ticket.item);
            return state.expanded.has(ticket.item);
        },
        move(ticket, offset) { if (!valid(ticket) || pending.has(ticket.item) || !moveCollectionDraftRow(state, ticket, offset)) return false; return refresh(); },
        remove(ticket) { if (!valid(ticket) || pending.has(ticket.item) || !removeCollectionDraftRow(state, ticket)) return false; return refresh(); },
        edit(ticket, key, value, baseline) {
            if (!valid(ticket) || !editCollectionDraftField(state, ticket, key, value, baseline)) return false;
            return true;
        },
        canEdit(ticket) { return !!(current() && collectionDraftRowCurrent(state, ticket) && editTarget(ticket.item)); },
        add() { if (!current()) return false; const item = { title: '', url: '' }; state.items.push(item); state.expanded.add(item); return refresh(); },
        open(ticket) {
            const target = valid(ticket) && editTarget(ticket.item);
            return target ? action(ticket, 'open', () => deps.open(ticket.item, target.page)) : Promise.resolve(false);
        },
        publish(ticket) {
            return ticket.item.localOnly && ticket.item.url?.startsWith('blob:')
                ? action(ticket, 'publish', () => deps.publish(ticket.item, refresh)) : Promise.resolve(false);
        },
        browse(ticket) { if (!valid(ticket) || !/^https?:\/\//i.test(ticket.item.url || '')) return false;
            try { deps.browse(ticket.item.url); return true; } catch (error) { deps.log(error); view.error(error); return false; } },
        file(file) { return current() && file ? actionForDraft(() => deps.file(file, state.items, refresh)) : Promise.resolve(false); },
        existing(anchor) { return current() ? actionForDraft(() => deps.existing(state.items, refresh, anchor)) : Promise.resolve(false); },
        current,
    };
    let draftPending = false;
    async function actionForDraft(operation) {
        if (draftPending) return false;
        draftPending = true;
        try { await operation(); return true; }
        catch (error) { deps.log(error); if (current()) view.error(error); return false; }
        finally { draftPending = false; }
    }
    return api;
}
