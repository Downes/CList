/// <reference path="./clist-types.js" />
// Membership operation captures; no credentials or bodies in shared presentation state.
let _collectionMembershipPicker = null;
const _collectionMemberRows = new WeakMap();
const _collectionMemberRoots = new Set();
/** @returns {CListCollectionMembershipState} */
function collectionMembershipState() { return window.CList.state.collectionMemberships ||= { busy: false, phase: 'idle', error: null }; }
function currentMembershipOwner(owner) {
    if (owner.root.isConnected === false || (owner.guard && !owner.guard())) return false;
    try { assertCollectionSession(owner.session); return true; } catch { return false; }
}
function membershipOwner(root, token, encKey, guard) {
    const owner = { root, guard };
    owner.session = beginCollectionSession({ token, encKey, isCurrent: () => root.isConnected !== false && (!guard || guard()) });
    return owner;
}
async function runCollectionMembership(owner, operation) {
    const state = collectionMembershipState();
    if (state.busy || !currentMembershipOwner(owner)) return;
    state.busy = true; state.phase = 'saving'; state.error = null;
    window.CList.ui.collectionMembers.busy(owner.root, true);
    try {
        await prepareCollectionSession(owner.session);
        return await operation(collectionDependencies(owner.session));
    } catch (error) {
        state.phase = 'failed'; state.error = error?.message || String(error);
        if (currentMembershipOwner(owner)) window.CList.ui.collectionMembers.error(error);
        else { console.error('[collection membership] expired operation', error); window.CList.ui.collectionMembers.status('An earlier collection action stopped because its controls changed.'); }
    } finally {
        state.busy = false; if (state.phase === 'saving') state.phase = 'complete';
        if (currentMembershipOwner(owner)) window.CList.ui.collectionMembers.busy(owner.root, false);
        for (const root of _collectionMemberRoots) {
            if (root.isConnected === false) { _collectionMemberRoots.delete(root); continue; }
            const current = _collectionMemberRows.get(root);
            if (current && currentMembershipOwner(current)) window.CList.ui.collectionMembers.busy(root, false);
        }
    }
}
function _renderCollectionItems(col, token, encKey, countSpan, itemsDiv, isCurrent = () => true) {
    const owner = membershipOwner(itemsDiv, token, encKey, isCurrent);
    owner.col = col; owner.count = countSpan;
    _collectionMemberRows.set(itemsDiv, owner);
    _collectionMemberRoots.add(itemsDiv);
    owner.session.isCurrent = () => _collectionMemberRows.get(itemsDiv) === owner
        && itemsDiv.isConnected !== false && isCurrent();
    const valid = () => _collectionMemberRows.get(itemsDiv) === owner && currentMembershipOwner(owner);
    window.CList.ui.collectionMembers.rows(col, countSpan, itemsDiv, collectionMembershipState().busy, {
        remove: item => {
            if (!valid()) return;
            return runCollectionMembership(owner, async deps => {
                const saved = await removeCollectionMembership(col, item, deps);
                if (!valid()) return;
                Object.assign(col, saved);
                window.CList.ui.collectionMembers.status('Item removed.');
            }).then(() => {
                if (valid()) _renderCollectionItems(col, token, encKey, countSpan, itemsDiv, isCurrent);
            });
        },
        nested: async item => {
            if (!valid() || collectionMembershipState().busy) return;
            try {
                await prepareCollectionSession(owner.session);
                const result = await listCollectionRecords(collectionDependencies(owner.session));
                const nested = result.collections.find(record => record.id === item.collectionId);
                if (!valid()) return;
                if (!nested) throw new Error('That nested collection could not be found.');
                _showCollectionDetail(nested, token, encKey);
            } catch (error) { window.CList.ui.collectionMembers.error(error); }
        },
    });
    try {
        const annotations = window.checkAnnotationsBatch?.();
        if (annotations?.catch) annotations.catch(error => { if (valid()) window.CList.ui.collectionMembers.error(error); });
    } catch (error) { window.CList.ui.collectionMembers.error(error); }
}
// Existing callers may pass a selected legacy object with duplicate URL memberships.
async function _removeItemFromCollection(col, item, token, encKey, countSpan, itemsDiv) {
    const owner = _collectionMemberRows.get(itemsDiv) || membershipOwner(itemsDiv, token, encKey);
    const result = await runCollectionMembership(owner, async deps => {
        const saved = await removeCollectionMembership(col, item, deps);
        if (!currentMembershipOwner(owner)) return;
        Object.assign(col, saved);
        window.CList.ui.collectionMembers.status('Item removed.');
    });
    if (currentMembershipOwner(owner)) _renderCollectionItems(col, token, encKey, countSpan, itemsDiv, owner.guard);
    return result;
}
async function openCollectionMembershipPicker({ id, anchor, member, child, token, encKey, guard, glow, collectedId }) {
    const view = window.CList.ui.collectionMembers;
    let owner;
    try {
        const root = view.picker(id, anchor, glow); if (!root) return;
        owner = _collectionMembershipPicker = membershipOwner(root, token, encKey, guard);
        const current = () => _collectionMembershipPicker === owner && currentMembershipOwner(owner);
        await prepareCollectionSession(owner.session);
        const deps = collectionDependencies(owner.session);
        let source = child ? structuredClone(child) : null;
        if (source && !source.id) {
            // Persist a durable child identity before another collection references it.
            const latest = source.key ? await readCollectionSnapshot(source.key, deps) : null;
            if (latest) source = latest;
            const identity = deps.createIdentity();
            source = { ...source, key: source.key || identity.key, id: identity.id, title: source.title || source.name };
            source = await saveCollectionRecord(source.key, source, deps, { createOnly: !latest });
            if (current()) Object.assign(child, source);
        }
        const result = await listCollectionRecords(deps); if (!current()) return;
        const choices = source ? result.collections.filter(record => record.key !== source.key) : result.collections;
        root.replaceChildren();
        if (result.warnings.length) console.error('[collection membership] skipped unreadable records', result.warnings);
        _buildCollectionPickerContents(root, choices, async (title, target) => {
            if (!current()) return;
            return runCollectionMembership(owner, async nextDeps => {
                const entry = source ? { role: 'contains', collectionId: source.id, title: source.title || source.name } : member;
                const saved = await addCollectionMembership(target, title, entry, nextDeps);
                if (!current()) return;
                root.remove(); if (collectedId) view.collected(collectedId);
                view.status(saved.duplicate ? `Already in "${title}" — added again.` : `Added to "${title}".`);
            });
        }, anchor);
    } catch (error) {
        console.error('[collection membership] picker failed', error);
        if (owner?.root.isConnected !== false && owner) view.message(owner.root, 'Could not load collections: ' + (error?.message || String(error)), true);
        else view.error(error);
    }
}
async function _showCollectionPicker(itemId, opts = {}) {
    try {
        const el = document.getElementById(itemId), status = el?.closest('.status-box');
        if (!status?.parentElement) return;
        const reference = structuredClone(el.reference || {});
        return await openCollectionMembershipPicker({ id: `collection-picker-${itemId}`, anchor: status, glow: opts.glow,
            member: { id: itemId, title: reference.title || reference.url || itemId, url: reference.url || '', ...reference }, collectedId: itemId,
            guard: () => el.isConnected !== false && document.getElementById(itemId) === el });
    } catch (error) { window.CList.ui.collectionMembers.error(error); }
}
window.collectItem = (itemId, opts) => _showCollectionPicker(itemId, opts);
function _showAddToCollectionPicker(col, token, encKey, anchorEl, isCurrent = () => true) {
    return openCollectionMembershipPicker({ id: 'collection-nest-picker', anchor: anchorEl, child: col, token, encKey, guard: isCurrent });
}
