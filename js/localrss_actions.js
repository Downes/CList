/// <reference path="./reader-types.js" />
// LocalRSS row actions: transient captured targets, never shared current-account reads.
let _localrssActionSequence = 0;
const _localrssActions = new Map();
function resetLocalrssActions() { _localrssActions.clear(); }
function bindLocalrssActions(entryId, request, context, headers = _localrssAuthHeaders()) {
    const id = ++_localrssActionSequence;
    _localrssActions.set(id, { entryId, account: structuredClone(request.account),
        headers: { ...headers }, filter: request.filter,
        isCurrent: context.isAccountCurrent, pending: new Set() });
    return id;
}
function localrssToggleRead(id, button) { return runLocalrssToggle(id, 'read', button); }
function localrssToggleBookmark(id, button) { return runLocalrssToggle(id, 'bookmark', button); }
async function runLocalrssToggle(id, action, button) {
    const target = _localrssActions.get(id);
    const current = () => _localrssActions.get(id) === target && target.isCurrent() && button?.isConnected !== false;
    if (!target || !current() || target.pending.has(action)) return;
    target.pending.add(action);
    const view = window.CList.ui.localrssReader;
    view.actionBusy(button, true);
    try {
        const result = await toggleLocalrssEntry({ account: target.account, entryId: target.entryId, action },
            { fetch, headers: target.headers });
        if (current()) view.actionResult(button, action, result.value, target.filter);
    } catch (error) {
        if (current()) view.actionError(action, error);
    } finally {
        target.pending.delete(action);
        // Restore the original control only; never look up a replacement row by entry ID.
        view.actionBusy(button, false);
    }
}
