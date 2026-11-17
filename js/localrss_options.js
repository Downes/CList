/// <reference path="./reader-types.js" />
// Transient Options bindings keep credentials outside shared UI state.
let _localrssOptionsTarget = null;
function localrssOptionsOverlay(context = _readerContext) {
    if (!context?.isCurrent() || context.account.type !== 'LOCALRSS' || readerState().status !== 'ready') return;
    const target = {
        account: structuredClone(localrssCurrentAccount), accountKey: context.accountKey,
        headers: { ..._localrssAuthHeaders() }, filter: localrssReadState().filter,
        root: null, closed: false, pending: false, statsId: 0,
    };
    target.current = () => _localrssOptionsTarget === target && !target.closed
        && context.isAccountCurrent() && !!target.root?.parentNode;
    target.close = () => { target.closed = true; };
    target.show = filter => {
        if (!target.current()) return;
        return localrssLoad(false, null, { filter, kind: 'items' }).catch(error => {
            if (target.current()) localrssOptionsError(target, 'load', error);
        });
    };
    target.reconnect = async () => {
        if (!target.current()) return;
        try {
            await _localrssReconnect();
            if (target.current()) await localrssOptionsOverlay();
        } catch (error) { if (target.current()) localrssOptionsError(target, 'reconnect', error); }
    };
    target.switchAccount = async key => {
        if (!target.current()) return;
        target.close();
        try {
            await switchReaderAccount(key);
            if (_localrssOptionsTarget === target && target.root?.parentNode
                && _readerContext?.isCurrent() && _readerContext.accountKey === key
                && readerState().status === 'ready') await localrssOptionsOverlay();
        } catch (error) { localrssOptionsError(target, 'account switch', error); }
    };
    target.confirmMarkAll = button => {
        if (!target.current() || target.pending) return;
        let confirmed = false;
        _localrssConfirm('Mark all unread entries in this database as read?', 'Mark all as read',
            () => {
                if (confirmed) return;
                confirmed = true;
                return markAllLocalrssRead(target, button);
            });
    };
    _localrssOptionsTarget = target;
    renderLocalrssOptions(target);
    return refreshLocalrssOptionsStats(target);
}
async function refreshLocalrssOptionsStats(target) {
    if (!target?.current()) return;
    const id = ++target.statsId;
    try {
        const data = await fetchLocalrssStatistics(target.account, { fetch, headers: target.headers });
        if (target.current() && id === target.statsId) localrssOptionsStats(target, data);
    } catch (error) {
        if (target.current() && id === target.statsId) localrssOptionsError(target, 'statistics', error);
    }
}
// Compatibility for legacy feed/import actions; the panel binding still owns stats.
function _localrssRefreshStats() { return refreshLocalrssOptionsStats(_localrssOptionsTarget); }
async function markAllLocalrssRead(target, button) {
    if (!target.current() || target.pending) return;
    target.pending = true; button.disabled = true;
    try {
        await markLocalrssDatabaseRead(target.account, { fetch, headers: target.headers });
    } catch (error) {
        if (target.current()) localrssOptionsError(target, 'mark all as read', error);
        target.pending = false; button.disabled = false;
        return;
    }
    // A successful write is separate from any subsequent read/refresh failure.
    if (target.current()) {
        showStatusMessage('All entries marked read.');
        await refreshLocalrssOptionsStats(target);
        if (target.current() && localrssReadState().kind === 'items' && localrssReadState().filter === 'unread') {
            await target.show('unread');
        }
    }
    target.pending = false; button.disabled = false;
}
