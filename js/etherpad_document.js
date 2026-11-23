/// <reference path="./clist-types.js" />
// Private document captures, operation locks and transient receipts.
function createEtherpadDocumentController(deps, view) {
    let pending = null, disposed = false, generation = 0;
    const creates = new Map();
    const current = () => !disposed && deps.current();
    function summary(phase, busy, receipt = 'none') {
        /** @type {CListEtherpadDocumentState} */
        const state = { phase, busy, receipt }; deps.present(state);
    }
    function run(kind, key, operation, after) {
        if (!current()) return Promise.reject(new Error('This Etherpad connection expired. Reopen it to continue.'));
        if (pending) {
            if (pending.kind === kind && pending.key === key) return pending.promise;
            const error = new Error('Wait for the current Etherpad operation to finish.'); view.error(error); return Promise.reject(error);
        }
        const source = deps.capture(), revision = generation;
        const owned = () => current() && generation === revision && source.current();
        const assert = () => { if (!owned()) throw new Error('The Etherpad document changed before this operation finished.'); };
        const job = { kind, key, receipt: 'none' }; pending = job; summary(kind, true); view.busy(true);
        job.promise = Promise.resolve().then(() => { assert(); return operation(source, { assert, owned, job }); })
            .catch(error => {
                if (error.uncertain) job.receipt = 'uncertain';
                else if (job.receipt !== 'accepted') job.receipt = 'rejected';
                deps.log(error);
                if (owned()) view.error(new Error((job.receipt === 'accepted' ? 'The write was accepted, but setup did not finish. ' : '')
                    + error.message + (job.receipt === 'uncertain' ? ' The write could not be confirmed. Check the pad before trying again.' : '')));
                throw error;
            }).finally(() => {
                if (pending === job) pending = null;
                if (current()) { summary('ready', false, job.receipt); view.busy(false); }
            }).then(async result => { if (after && owned()) await after(result, source); return result; });
        return job.promise;
    }
    const api = {
        invalidate() { generation++; }, dispose() { disposed = true; generation++; },
        open(name, create = false) {
            const pad = String(name || '').trim();
            return run('opening', pad, async (source, ctx) => {
                if (!pad || (create && !/^[a-zA-Z0-9_-]+$/.test(pad))) throw new Error('Enter a pad name using letters, numbers, underscores and dashes.');
                if (source.target.guest || !source.target.instance) throw new Error('Select an Etherpad account to create or select an account pad.');
                const key = source.target.instance + '\n' + pad;
                if (create && creates.get(key)?.uncertain) throw new Error('Creation could not be confirmed. Refresh pads and select the pad if it exists; do not repeat Create.');
                const prior = creates.get(key);
                let creating = false;
                const result = await prepareEtherpadDocument({ pad, username: source.username, create: create && !prior?.accepted }, {
                    assert: ctx.assert, api: (method, params) => source.api(method, params),
                    creating: () => { creating = true; },
                    created: result => { creates.set(key, { accepted: true }); ctx.job.receipt = result.created ? 'accepted' : 'none'; },
                }).catch(error => { if (creating && error.uncertain && !creates.get(key)?.accepted) creates.set(key, { uncertain: true }); throw error; });
                ctx.assert(); deps.select(result); source.adopt?.(result); view.opened({ url: source.padUrl(pad), label: result.username + ': ' + pad });
                view.clearName(pad); return result;
            }, async () => { await deps.pendingContent(); });
        },
        read(format = 'html') { return run('reading', format, (source, ctx) => { source.assertPad(); return readEtherpadDocument(source.target, format, source.workflow(ctx.assert)); }); },
        append(content, itemId) {
            const value = content?.type === 'text/plain' ? deps.escape(content.value).replace(/\n/g, '<br>') : content?.value;
            return run('writing', String(itemId || '') + '\n' + value, async (source, ctx) => {
                source.assertPad(); if (typeof value !== 'string') throw new Error('Etherpad content must be text or HTML.');
                const result = await appendEtherpadDocument(source.target, value, source.workflow(ctx.assert)); ctx.job.receipt = result.receipt;
                if (ctx.owned() && itemId) {
                    try { deps.reference(itemId); }
                    catch (error) { deps.log(error); view.error(new Error('Content was accepted, but its reference could not be added. ' + error.message)); }
                }
                return result;
            });
        },
        appendText(text) { return run('writing', text, async (source, ctx) => {
            source.assertPad(); if (source.target.guest || !source.target.author || !text?.trim()) throw new Error('Select an account pad and enter text to append.');
            await source.api('appendText', { padID: source.target.pad, authorID: source.target.author, text }); ctx.job.receipt = 'accepted';
            return true;
        }); },
        author(username) { return run('author', username, async (source, ctx) => {
            if (!username?.trim() || source.target.guest) throw new Error('Select an account and enter an author name.');
            const result = await source.api('createAuthorIfNotExistsFor', { name: username.trim(), authorMapper: username.trim() }); ctx.assert();
            if (!result?.authorID) throw new Error('Etherpad returned no author ID.'); deps.author(username.trim(), result.authorID);
            source.adopt?.({ pad: source.target.pad, author: result.authorID }); return result.authorID;
        }); },
        share() {
            return run('sharing', '', async (source, ctx) => {
                source.assertPad(); const chat = deps.chat(), url = source.padUrl(source.target.pad);
                view.share(url, source.target.pad);
                if (chat.ready) { ctx.assert(); await chat.send('Hello from Etherpad. Your actual discussion is ' + chat.name + ' and the pad is ' + source.target.pad + " '" + url + "'"); }
                return url;
            });
        },
    };
    summary('ready', false);
    return api;
}

function captureEtherpadDocument(owner) {
    const account = currentEtherpadAccount ? structuredClone(currentEtherpadAccount) : null;
    const guest = currentEtherpadGuestBase; let selectedPad = padName, author = authorID;
    const target = { pad: selectedPad, author, guest: !!guest, webBase: guest || account?.instance?.replace(/\/api\/[^/]+\/?$/, ''),
        instance: account?.instance, apiKey: account?.id, proxy: proxyUrl, headers: { ...kvstoreAuthHeader() } };
    const fetchRequest = fetch;
    const api = (method, params) => requestEtherpadDocument(target, method, params, { fetch: fetchRequest });
    const same = () => _etherpadConnection === owner && owner.controller.active() && currentEditor === 'etherpad'
        && padName === selectedPad && currentEtherpadGuestBase === guest && authorID === author;
    return { target, api, current: same,
        adopt(result) { selectedPad = result.pad; author = result.author; },
        username: getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME) || 'user' + Math.floor(Math.random() * 1000),
        assertPad() { if (!selectedPad || (!guest && !account)) throw new Error('Select or create an Etherpad pad first.'); },
        padUrl: name => etherpadDocumentUrl(target.webBase, name),
        workflow: assert => ({ assert, api, plaintext: cleanHTMLContent,
            guestRead: () => readEtherpadGuestDocument(target, { fetch: fetchRequest }),
            guestWrite: html => writeEtherpadGuestDocument(target, html, { fetch: fetchRequest }) }),
    };
}
function bindEtherpadDocuments(owner, view) {
    owner.documents = createEtherpadDocumentController({
        current: () => _etherpadConnection === owner && owner.controller.active(),
        capture: () => captureEtherpadDocument(owner), present: state => { window.CList.state.etherpadDocument = state; },
        select: result => { padName = result.pad; authorID = result.author; etherpadUsername = result.username; },
        author: (name, id) => { etherpadUsername = name; authorID = id; },
        pendingContent: () => typeof loadPredefinedContent === 'function' ? loadPredefinedContent('etherpad') : undefined,
        reference: id => { createReference(id, document.getElementById('etherpadDiv')); displayReferences(document.getElementById('etherpadDiv')); },
        escape: escapeHtml,
        chat: () => { const discussion = typeof activeDiscussionName === 'undefined' ? '' : activeDiscussionName;
            const peers = typeof connections === 'undefined' ? null : connections;
            const recipients = peers ? Object.entries(peers) : [];
            return { name: discussion, ready: !!(document.getElementById('chat-messages') && discussion && recipients.length),
                send: message => {
                    if (discussion !== activeDiscussionName || peers !== connections || recipients.length !== Object.keys(connections).length
                        || recipients.some(([key, channel]) => connections[key] !== channel)) throw new Error('The discussion changed before sharing. Share again in the current discussion.');
                    return sendMessage(message);
                } }; },
        log: error => console.error('[Etherpad document]', error),
    }, view);
    return owner.documents;
}
function etherpadDocuments() {
    if (!_etherpadConnection?.documents) throw new Error('Open the Etherpad editor before using document controls.');
    return _etherpadConnection.documents;
}
