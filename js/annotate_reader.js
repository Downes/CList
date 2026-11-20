// Annotation feed/thread/batch lifetimes. Session and row captures stay private.
let _annotationFeedOwner = null, _annotationThreadOwner = null, _annotationBatchId = 0;
const _annotationFollowLocks = new Set();
function annotationReadState() { return window.CList.state.annotationReading ||= { generation: 0, phase: 'idle', error: null }; }
function annotationReaderDid(session) { return session.username ? `did:web:${session.storeUrl.replace(/^https?:\/\//, '')}:users:${session.username}` : ''; }
function capturedAnnotationAccounts() {
    return (window.CList.accounts || []).map(parseAccountValue).filter(Boolean).map(value => structuredClone(value));
}
function annotationOwnerCurrent(owner) {
    return annotationSessionCurrent(owner.session) && (!owner.surface || owner.surface.isCurrent())
        && owner.readerId === window.CList.state.reader?.requestId
        && owner.accounts === JSON.stringify(window.CList.accounts || []);
}
async function annotationReaderInputs(owner) {
    const discovery = await readAnnotationDiscovery();
    if (!annotationOwnerCurrent(owner)) return null;
    const accounts = await _allAnnotationAccounts();
    if (!annotationOwnerCurrent(owner)) return null;
    return { accounts, followed: discovery.dids, warnings: discovery.warnings,
        write: capturedAnnotationAccounts().filter(account => account.type === 'Annotate' && account.instance && (account.permissions || 'rw').includes('w')) };
}
window.showAnnotations = async function(filter = 'all') {
    const surface = captureReaderSurface('annotations'), session = annotationSessionSnapshot();
    const owner = _annotationFeedOwner = { surface, session, readerId: window.CList.state.reader?.requestId, accounts: JSON.stringify(window.CList.accounts || []) };
    const state = window.CList.state.annotationReading = { generation: annotationReadState().generation + 1, phase: 'loading', error: null };
    const root = window.CList.ui.view.feedContainer, view = window.CList.ui.annotationReading;
    const current = () => _annotationFeedOwner === owner && annotationOwnerCurrent(owner);
    view.message(root, 'Loading annotations…');
    try {
        const inputs = await annotationReaderInputs(owner); if (!inputs || !current()) return;
        const result = await collectAnnotationRecords(inputs.accounts, { since: new Date(Date.now() - 14 * 86400000).toISOString(), creatorDid: annotationReaderDid(session) });
        if (!current()) return;
        const myDid = annotationReaderDid(session);
        const items = result.items.filter(item => filter !== 'my' || (item.creator?.id || item.creator) === myDid)
            .sort((a, b) => new Date(b.created) - new Date(a.created));
        view.feed(root, { items, warnings: [...inputs.warnings, ...result.warnings],
            emptyText: 'No annotations in the last 14 days.',
            rowOptions: { myDid, token: session.token, writeAccts: inputs.write, followedDids: inputs.followed, isCurrent: current } });
        state.phase = 'ready'; await window.checkAnnotationsBatch();
    } catch (error) { if (current()) { state.phase = 'failed'; state.error = error.message; view.message(root, error.message, true); console.error('[annotation reader]', error); } }
};
window.showAnnotationsForItem = async function(itemId) {
    const source = document.getElementById(itemId); if (!source?.reference) return;
    const reference = structuredClone(source.reference), session = annotationSessionSnapshot(), root = window.CList.ui.view.feedContainer;
    const owner = { session, source, reference, readerId: window.CList.state.reader?.requestId, accounts: JSON.stringify(window.CList.accounts || []), thread: null,
        previous: _annotationThreadOwner };
    _annotationThreadOwner = owner;
    const current = () => _annotationThreadOwner === owner && annotationOwnerCurrent(owner)
        && (owner.thread ? owner.thread.root.isConnected : source.isConnected && document.getElementById(itemId) === source);
    try {
        const inputs = await annotationReaderInputs(owner); if (!inputs || !current()) return;
        const urls = [...new Set([reference.url, reference.guid].filter(Boolean))];
        const results = await Promise.all(urls.map(url => collectAnnotationRecords(inputs.accounts, { url })));
        if (!current()) return;
        const myDid = annotationReaderDid(session), seen = new Set();
        const annotations = results.flatMap(result => result.items).filter(anno => {
            const id = anno.id || JSON.stringify(anno), creator = anno.creator?.id || anno.creator || '';
            if (seen.has(id)) return false; seen.add(id);
            return !session.token || creator === myDid || inputs.followed.has(creator) || creator.startsWith('acct:');
        });
        const view = window.CList.ui.annotationReading;
        view.count(source, annotations.length, () => {
            if (annotationOwnerCurrent(owner) && source.isConnected && document.getElementById(itemId) === source) return window.showAnnotationsForItem(itemId);
        });
        owner.thread = view.thread(root, source, annotations.length, () => closeCapturedAnnotationThread(owner), !!session.token);
        if (owner.previous?.popstate) window.removeEventListener('popstate', owner.previous.popstate);
        view.warnings(owner.thread.root, [...inputs.warnings, ...results.flatMap(result => result.warnings)]);
        view.rows(owner.thread.root, annotations, { showUrl: false,
            myDid, token: session.token, writeAccts: inputs.write, followedDids: inputs.followed, url: reference.url, isCurrent: current });
        if (reference.feedUrl && session.token) {
            _getAuthorDidFromFeed(reference.feedUrl).then(did => {
                if (!current() || !did || did === myDid || inputs.followed.has(did)) return;
                view.feedAuthor(owner.thread.root, did, async (button, label) => {
                    if (!current() || button.disabled) return;
                    try {
                        const followed = await _followUser(did, session.token, button, current);
                        if (followed && current()) label.textContent = 'Following ' + did.replace(/^did:web:[^:]+:users:/, '');
                    } catch (error) { if (current()) view.error(error); }
                });
            }).catch(error => { if (current()) view.error(error); });
        }
        owner.popstate = () => closeCapturedAnnotationThread(owner); history.pushState({ annotationThread: true, itemId }, ''); window.addEventListener('popstate', owner.popstate);
        await window.checkAnnotationsBatch();
    } catch (error) { if (current()) window.CList.ui.annotationReading.error(error); }
};
function closeCapturedAnnotationThread(owner) {
    if (owner.popstate) { window.removeEventListener('popstate', owner.popstate); owner.popstate = null; }
    if (_annotationThreadOwner !== owner) return;
    _annotationThreadOwner = null;
    if (owner.thread?.root.isConnected && annotationOwnerCurrent(owner)) {
        window.CList.ui.annotationReading.restore(window.CList.ui.view.feedContainer, owner.thread.saved);
        if (owner.previous?.thread?.root.isConnected && annotationOwnerCurrent(owner.previous)) {
            _annotationThreadOwner = owner.previous;
            if (owner.previous.popstate) window.addEventListener('popstate', owner.previous.popstate);
        }
    }
}
window.closeAnnotationThread = () => { if (_annotationThreadOwner) closeCapturedAnnotationThread(_annotationThreadOwner); };
function annotationFollowSession(token, guard = () => true) {
    const session = annotationSessionSnapshot();
    const assert = () => { if (!annotationSessionCurrent(session) || token !== session.token || !guard()) throw new Error('The annotation follow controls are no longer current.'); };
    return { session, deps: { assertCurrent: assert, getKey: getEncKey, encrypt: encryptWithKey,
        put: (key, value) => window.CList.storage.kv.put(key, value), remove: key => window.CList.storage.kv.remove(key) } };
}
async function _followUser(did, token, button, guard = () => button.isConnected) {
    const capture = annotationFollowSession(token, guard), key = JSON.stringify([capture.session, did]);
    if (_annotationFollowLocks.has(key)) return false;
    _annotationFollowLocks.add(key); window.CList.ui.annotationReading.followBusy(button, true);
    try {
        await persistAnnotationFollow(did, true, capture.session, capture.deps);
        invalidateAnnotationDiscovery();
        if (annotationSessionCurrent(capture.session) && guard()) {
            window.CList.ui.annotationReading.followed(button, did); window._clistRefreshFollowingPanel?.();
        }
        return true;
    } finally { _annotationFollowLocks.delete(key); if (guard()) window.CList.ui.annotationReading.followBusy(button, false); }
}
window._followUser = _followUser;
async function _kvFollowDid(did) { const capture = annotationFollowSession(annotationSessionSnapshot().token); const result = await persistAnnotationFollow(did, true, capture.session, capture.deps); invalidateAnnotationDiscovery(); return result; }
async function _kvUnfollowDid(did) { const capture = annotationFollowSession(annotationSessionSnapshot().token); const result = await persistAnnotationFollow(did, false, capture.session, capture.deps); invalidateAnnotationDiscovery(); return result; }

window.checkAnnotationsBatch = async function() {
    const batchId = ++_annotationBatchId, session = annotationSessionSnapshot(), readerId = window.CList.state.reader?.requestId;
    const readerKey = window.CList.state.reader?.accountKey, readerMode = window.CList.state.reader?.mode;
    const accountValues = JSON.stringify(window.CList.accounts || []);
    // Capture both the node and its reference before the first async discovery step.
    const items = [...document.querySelectorAll('.statusSpecific')].filter(node => node.reference?.url && node.reference.url !== '(no URL provided)')
        .map(node => ({ node, reference: structuredClone(node.reference) }));
    const current = () => batchId === _annotationBatchId && annotationSessionCurrent(session) && readerId === window.CList.state.reader?.requestId;
    const rowCurrent = entry => current() && entry.node.isConnected && document.getElementById(entry.node.id) === entry.node;
    const actionCurrent = entry => annotationSessionCurrent(session)
        && readerKey === window.CList.state.reader?.accountKey && readerMode === window.CList.state.reader?.mode
        && accountValues === JSON.stringify(window.CList.accounts || [])
        && entry.node.isConnected && document.getElementById(entry.node.id) === entry.node;
    const warnings = [];
    try {
        if (!items.length) return;
        const accounts = await _allAnnotationAccounts(); if (!current()) return;
        const urls = [...new Set(items.flatMap(entry => entry.reference.isAnnotation ? [entry.reference.guid] : [entry.reference.url, entry.reference.guid]).filter(Boolean))];
        const counts = {};
        await Promise.all(accounts.map(async account => {
            try {
                let data;
                if (account.type === 'Hypothesis') data = await window.hypothesisBatchCheck(account, urls);
                else {
                    const response = await fetch(`${account.instance}/annotations/batch-check`, { method: 'POST',
                        headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ urls }) });
                    if (!response.ok) throw new Error('An annotation count source returned HTTP ' + response.status + '.');
                    data = (await response.json()).results;
                }
                for (const [url, count] of Object.entries(data || {})) counts[url] = (counts[url] || 0) + Number(count || 0);
            } catch (error) { warnings.push(error?.message || String(error)); }
        }));
        if (!current()) return;
        const view = window.CList.ui.annotationReading;
        for (const entry of items) if (rowCurrent(entry)) {
            const ref = entry.reference, count = ref.isAnnotation ? counts[ref.guid] || 0 : counts[ref.url] || counts[ref.guid] || 0;
            view.count(entry.node, count, () => actionCurrent(entry) ? window.showAnnotationsForItem(entry.node.id) : undefined);
        }
        if (session.token) {
            const followed = await _getFollowedDids(); if (!current()) return;
            const authors = new Map();
            const feeds = new Map(); for (const entry of items) if (entry.reference.feedUrl) {
                const list = feeds.get(entry.reference.feedUrl) || []; list.push(entry); feeds.set(entry.reference.feedUrl, list);
            }
            await Promise.all([...feeds].map(async ([url, entries]) => {
                const did = await _getAuthorDidFromFeed(url); if (!did || did === annotationReaderDid(session) || !current()) return;
                const shared = authors.get(did) || { following: followed.has(did), busy: false, buttons: [] };
                authors.set(did, shared);
                for (const entry of entries) if (rowCurrent(entry)) {
                    let button;
                    const choose = async () => {
                        if (!actionCurrent(entry) || shared.busy) return;
                        shared.busy = true; shared.buttons.forEach(control => view.followBusy(control.button, true));
                        try {
                            const captured = annotationFollowSession(session.token, () => actionCurrent(entry));
                            const result = await persistAnnotationFollow(did, !shared.following, captured.session, captured.deps);
                            invalidateAnnotationDiscovery(); if (!actionCurrent(entry)) return;
                            shared.following = result.following;
                            for (const control of shared.buttons) if (actionCurrent(control.entry)) view.followState(control.button, shared.following, did.replace(/^did:web:[^:]+:users:/, ''));
                            showStatusMessage(shared.following ? 'Now following feed author.' : 'Unfollowed feed author.'); window._clistRefreshFollowingPanel?.();
                        } catch (error) { if (actionCurrent(entry)) view.error(error); }
                        finally { shared.busy = false; shared.buttons.forEach(control => { if (actionCurrent(control.entry)) view.followBusy(control.button, false); }); }
                    };
                    button = view.followButton(entry.node, did, shared.following, choose);
                    if (button) shared.buttons.push({ button, entry });
                }
            }));
        }
        if (current() && warnings.length) { console.error('[annotation batch] partial failures', warnings); showStatusMessage(warnings.join(' ')); }
    } catch (error) { if (current()) window.CList.ui.annotationReading.error(error); }
};
