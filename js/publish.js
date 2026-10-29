//  publish.js  -  Functions to publish content to various platforms
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//

//
// Define handlers for each publisher
//
// Definition:
//
//      The publishers registry maps account types to publisher objects.
//      Each publisher must implement:
//
//          publish: async (accountData, title, content) => publishedURL | null
//
//      accountData — the full parsed account object (type, instance, id, permissions, title, …)
//      title       — the write-pane title (may contain HTML; strip if the service requires plain text)
//      content     — the post body (may contain HTML; handler is responsible for any stripping)
//      returns     — the URL of the published post as a string, or null if not applicable
//
//      Register a publisher in the relevant service .js file:
//
//          (function () {
//              window.CList.publishers = window.CList.publishers || {};
//              window.CList.publishers['ServiceType'] = {
//                  publish: async (accountData, title, content) => {
//                      // call the service API …
//                      return publishedURL; // or null
//                  }
//              };
//          })();
//

window.CList.publishers = window.CList.publishers || {};

//
// Define handlers for each save destination
//
//      The savers registry is an ordered array of saver objects displayed
//      in the right-pane Save list. Each saver must have:
//
//          label  {string}   Display name shown in the list
//          icon   {string}   Material Icons name (or logoSrc for a masked SVG)
//          save   async () => void
//
//      Register a saver from any service .js file:
//
//          (function () {
//              window.CList.savers = window.CList.savers || [];
//              window.CList.savers.push({
//                  label: 'Save to My Service',
//                  icon:  'cloud_upload',
//                  save:  async () => { /* save logic here */ }
//              });
//          })();
//

window.CList.savers = window.CList.savers || [];

async function playPost() {

    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.playCollectionPublish === 'function') {
            await window.playCollectionPublish();
            return;
        }
    }

    if (!Array.isArray(window.CList.accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    if (window.CList.accounts.length === 0) {
        try {
            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        } catch (error) {
            showErrorModal('Error getting accounts: ' + error.message, { title: 'Could not load accounts' });
        }
    }

    populatePostOptions(window.CList.accounts);
    openRightInterface('post-instructions');

}

async function playSave() {
    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.playCollectionSave === 'function') {
            await window.playCollectionSave();
            return;
        }
    }
    populateSaveOptions();
    openRightInterface('save-instructions');
}


// Function to populate the post panel with account options
function populatePostOptions(accounts) {
    const postOptionsDiv = document.getElementById('post-options');
    postOptionsDiv.innerHTML = '';

    postOptionsDiv.appendChild(makeAccountList(
        'Select accounts to publish to',
        accounts,
        v => v.permissions.includes('w'),
        (key, parsedValue, btn) => {
            const isSelected = btn.getAttribute('data-selected') === 'true';
            btn.setAttribute('data-selected', isSelected ? 'false' : 'true');
            btn.classList.toggle('selected', !isSelected);
            if (parsedValue.type === 'Annotate') {
                btn.classList.toggle('annotate-glow', !isSelected);
            }
        }
    ));

    const finalPostOption = document.createElement('button');
    finalPostOption.textContent = 'Publish';
    finalPostOption.id = 'final-post-button';
    finalPostOption.className = 'final-save-button btn';
    postOptionsDiv.appendChild(finalPostOption);

    finalPostOption.onclick = async function() {
        await postAll();
    };

    postOptionsDiv.appendChild(makeWebPageOption());
}

// Builds the "To Web Page" option — publishes the editor's raw content, unwrapped and
// untruncated, to the account's CListBin destination (pastebin.mooc.ca by default).
// Deliberately separate from the account checklist above: that flow runs content through
// packagePost() (wraps title/content/references in divs) and truncates to each target's
// character limit, neither of which is right for "publish this page as-is".
function makeWebPageOption() {
    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Or publish the editor content directly';
    list.appendChild(tip);

    const btn = document.createElement('button');
    btn.className = 'account-button';

    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = 'public';

    const nameEl = document.createElement('span');
    nameEl.textContent = 'To Web Page';

    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', postToWebPage);
    list.appendChild(btn);

    return list;
}

// Publishes the active editor's raw content, in its own content type (text/html for
// TinyMCE/Quill/CKEditor, text/plain for the plain-text editor), to the logged-in user's
// CListBin account. The account is auto-seeded at login (kvstore.js's autoSeedCListBin) —
// a stale session that predates that code won't have one yet.
// Standalone-page content from the editor (TinyMCE's getContent() returns a bare
// HTML fragment; the plain-text editor returns bare text) has no <head> or
// metadata slot of its own to carry an identity marker. Wrap it with one at
// publish time, using the Dublin Core meta/link identifier pair used by
// EPUB/Portable Web Publications. Plain text has no invisible metadata slot
// to use instead, so identity for text/plain pages is tracked only in the
// kvstore `page:<uuid>` index record (see _saveWebPageRecord) — not embedded
// as a visible line in the file, which would be an unwanted insertion into
// the user's own text and would double up on every republish.
function _embedWebPageIdentity(content, mimeType, title, id) {
    if (!id) return content;
    if (mimeType === 'text/html') {
        return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="dcterms.identifier" content="${escapeHtml(id)}">\n<link rel="identifier" href="${escapeHtml(id)}">\n<title>${escapeHtml(title)}</title>\n</head>\n<body>\n${content}\n</body>\n</html>`;
    }
    return content;
}

// Computes the current session's own DID the same way annotate.js/hypothesis.js/
// kvstore.js already do — a did:web string is always mechanically derivable from
// the logged-in username, whether or not that user has gone through the "Me"
// panel's DID key-generation flow. Returns null when nobody is logged in.
function _currentAuthorDid() {
    if (!window.CList.state || !window.CList.state.username) return null;
    const kvDomain = (window.CList.config.flaskSiteUrl || '').replace(/^https?:\/\//, '');
    return `did:web:${kvDomain}:users:${window.CList.state.username}`;
}

// Decides whether `existingAuthorDid` (already stored on a page record) and
// `currentDid` (whoever is about to touch that record) are the same real-world
// identity. Equal strings settle it. Otherwise, resolves existingAuthorDid's own
// did.json and checks its alsoKnownAs list for currentDid — the same cross-
// identity linking kvstore.js already writes there on account/server migration
// (js/kvstore.js:2603-2725). Unresolvable (bad DID shape, fetch failure, no match)
// defaults to "different author" — safer than silently attributing someone else's
// record to the current user.
async function _isSameAuthor(existingAuthorDid, currentDid) {
    if (!existingAuthorDid || !currentDid) return true; // nothing to compare against
    if (existingAuthorDid === currentDid) return true;

    const m = existingAuthorDid.match(/^did:web:([^:]+):users:(.+)$/);
    if (!m) return false;
    try {
        const res = await fetch(`https://${m[1]}/users/${m[2]}/did.json`);
        if (!res.ok) return false;
        const doc = await res.json();
        return Array.isArray(doc.alsoKnownAs) && doc.alsoKnownAs.includes(currentDid);
    } catch (e) {
        console.error('[_isSameAuthor] could not resolve existing author DID', e);
        return false;
    }
}

async function postToWebPage() {
    const resultDiv = window.CList.ui.view.postResult;
    resultDiv.innerHTML = '';

    const handler = editorHandlers[currentEditor];
    const rawContent = (handler && typeof handler.getContent === 'function') ? await handler.getContent() : '';
    if (!rawContent || !rawContent.trim()) {
        showErrorModal('Nothing to publish — the editor is empty.', { title: 'Nothing to publish' });
        return;
    }
    const mimeType = (handler.contentTypes && handler.contentTypes[0]) || 'text/plain';

    const adapter = window.CList.binPublishers?.['CListBin'];
    if (!adapter) {
        showErrorModal('Web-page publishing is not available.', { title: 'Publishing unavailable' });
        return;
    }

    let accounts = window.CList.accounts;
    if (!Array.isArray(accounts) || accounts.length === 0) {
        try {
            accounts = window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        } catch (e) {
            showErrorModal('Error getting accounts: ' + e.message, { title: 'Could not load accounts' });
            return;
        }
    }
    const binAccount = accounts.map(parseAccountValue).filter(Boolean)
        .find(v => v.type === 'CListBin' && (v.permissions || '').includes('b'));
    if (!binAccount) {
        showErrorModal('No web-page destination set up yet — log out and back in to add one.', { title: 'No destination set up' });
        return;
    }

    const title = window.CList.ui.view.writeTitle.innerText.trim();

    // If this editor's content is a previously-loaded page, ask whether to
    // overwrite it in place or publish an independent new version. Otherwise
    // (no loaded page) there's nothing to decide — publish as a new page.
    if (currentLoadedPage && currentLoadedPage.kind === 'page') {
        _offerOverwriteOrNewVersion(resultDiv, adapter, rawContent, mimeType, title, binAccount);
        return;
    }

    const id = `urn:uuid:${crypto.randomUUID()}`;
    const content = _embedWebPageIdentity(rawContent, mimeType, title, id);
    await _performWebPagePublish(adapter, content, mimeType, title, binAccount, false, resultDiv, id);
}

// Renders the Overwrite / Save as new version / Cancel choice for a web page
// that was loaded from My Pages — mirrors the .published-page-confirm pattern
// used by offerReplaceOrInsert() in editors.js.
function _offerOverwriteOrNewVersion(resultDiv, adapter, rawContent, mimeType, title, binAccount) {
    resultDiv.innerHTML = '';

    const msg = document.createElement('p');
    msg.className = 'list-tip';
    msg.textContent = 'This page was loaded from My Pages. Overwrite it, or publish a new version?';
    resultDiv.appendChild(msg);

    const row = document.createElement('div');
    row.className = 'published-page-confirm';

    const overwriteBtn = document.createElement('button');
    overwriteBtn.className = 'btn';
    overwriteBtn.textContent = 'Overwrite';
    overwriteBtn.onclick = () => {
        // Overwrite replaces this exact resource in place — reuse its own
        // identity. A legacy record saved before identity embedding existed
        // gets one minted now, same rule collections use on Save/Publish.
        const id = currentLoadedPage.id || `urn:uuid:${crypto.randomUUID()}`;
        const content = _embedWebPageIdentity(rawContent, mimeType, title, id);
        _performWebPagePublish(adapter, content, mimeType, title, binAccount, true, resultDiv, id);
    };
    row.appendChild(overwriteBtn);

    const newVersionBtn = document.createElement('button');
    newVersionBtn.className = 'btn';
    newVersionBtn.textContent = 'Save as new version';
    newVersionBtn.onclick = () => {
        // An independent new page/record — gets its own fresh identity, never
        // the identity of the page it was loaded from.
        const id = `urn:uuid:${crypto.randomUUID()}`;
        const content = _embedWebPageIdentity(rawContent, mimeType, title, id);
        _performWebPagePublish(adapter, content, mimeType, title, binAccount, false, resultDiv, id);
    };
    row.appendChild(newVersionBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = () => { resultDiv.innerHTML = ''; };
    row.appendChild(cancelBtn);

    resultDiv.appendChild(row);
}

// Publishes to the web-page destination, either overwriting the currently
// loaded page (isOverwrite) or creating an independent new page.
async function _performWebPagePublish(adapter, content, mimeType, title, binAccount, isOverwrite, resultDiv, id) {
    resultDiv.innerHTML = '';

    if (isOverwrite) {
        try {
            const result = await adapter.update(currentLoadedPage.serviceId, content, mimeType, binAccount);
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.innerHTML = `Republished: <a href="${(result && result.url) || currentLoadedPage.url}" target="_blank">${(result && result.url) || currentLoadedPage.url}</a>`;
            resultDiv.appendChild(p);
        } catch (e) {
            console.error('[postToWebPage] overwrite failed', e);
            showPostMessage(resultDiv, `Failed to publish to web page: ${e.message}`);
            return;
        }

        try {
            const touched = await _touchOrForkWebPageRecord(currentLoadedPage.pageKey, id);
            currentLoadedPage.id = touched.id;
            currentLoadedPage.pageKey = touched.pageKey;
            if (touched.forked) {
                showStatusMessage('This page was authored by someone else — saved as a new, derived copy in My Pages.');
            }
        } catch (e) {
            console.error('[postToWebPage] failed to update page record', e);
            showErrorModal('Published, but could not update My Pages: ' + e.message, { title: 'My Pages update failed' });
        }
        return;
    }

    let result;
    try {
        result = await adapter.publish(content, mimeType, title, binAccount);
        const p = document.createElement('p');
        p.className = 'feed-status-message';
        p.innerHTML = `Published: <a href="${result.url}" target="_blank">${result.url}</a>`;
        resultDiv.appendChild(p);
    } catch (e) {
        console.error('[postToWebPage] publish failed', e);
        showPostMessage(resultDiv, `Failed to publish to web page: ${e.message}`);
        return;
    }

    // A local-page keeps its local identity when published — annotate the existing
    // PageStore record (docs/storage-model.md "recordPublication") instead of
    // forking a My Pages record. Every other case (no loaded page, or a page
    // loaded from My Pages but published under a fresh id) keeps the My Pages
    // behavior below unchanged.
    if (currentLoadedPage && currentLoadedPage.kind === 'local-page') {
        try {
            await window.CList.pageStore.recordPublication(currentLoadedPage.id, {
                service: 'CListBin',
                accountId: binAccount.instance || null,
                url: result.url,
            });
            // Mirror the new publication onto the live pointer too — recordPublication
            // only wrote it into the persisted PageRecord, and local-page records (unlike
            // 'page'-kind ones) don't otherwise carry a url/format for the editor's
            // running-state indicator (updateLoadedPageUI()) to show.
            currentLoadedPage.publicationUrl = result.url;
            currentLoadedPage.format = (mimeType.split('/')[1] || '').toUpperCase();
        } catch (e) {
            console.error('[postToWebPage] failed to record publication', e);
            showErrorModal("Published, but could not update the local page's publication status: " + e.message, { title: 'Publication status update failed' });
        }
        return;
    }

    // Record the page in kvstore so it shows up in Load → My Pages. The page is
    // already live even if this fails, so a failure here is reported separately
    // rather than made to look like the publish itself failed.
    const publishedAt = new Date().toISOString();
    const authorDid = _currentAuthorDid();
    try {
        const pageKey = await _saveWebPageRecord({
            id,
            title,
            url: result.url,
            serviceId: result.serviceId,
            service: 'CListBin',
            mimeType,
            accountInstance: binAccount.instance,
            publishedAt,
            authorDid,
        });
        // The editor now represents the newly created page, not whatever was
        // loaded before (if anything) — the old record, if any, is untouched.
        setLoadedPage({
            kind: 'page',
            pageKey,
            id,
            format: (mimeType.split('/')[1] || '').toUpperCase(),
            title,
            url: result.url,
            serviceId: result.serviceId,
            service: 'CListBin',
            mimeType,
            accountInstance: binAccount.instance,
            publishedAt,
            authorDid,
        });
    } catch (e) {
        console.error('[postToWebPage] failed to save page record', e);
        showErrorModal('Published, but could not save to My Pages: ' + e.message, { title: 'My Pages save failed' });
    }
}

// Encrypt and upsert a page record to kvstore (via storage.kv.put) — same pattern
// as collections.js's _kvSaveItems, under a separate `page:*` key
// namespace so standalone pages can't collide with `collection:*` entries.
// Returns the kvstore key the record was saved under, so the caller can track it
// (e.g. via setLoadedPage) for later Republish/overwrite calls. The key is always
// derived from record.id (minting one if the caller omitted it) so the kvstore
// key and the record's own identity share the same uuid, mirroring collections.
async function _saveWebPageRecord(record) {
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    if (!encKey) throw new Error('Encryption key not available');

    if (!record.id) record.id = `urn:uuid:${crypto.randomUUID()}`;
    const key = `page:${record.id.replace(/^urn:uuid:/, '')}`;
    const encrypted = await encryptWithKey(encKey, JSON.stringify(record));
    try {
        await window.CList.storage.kv.put(key, encrypted);
    } catch (err) {
        throw new Error(err.code === 'NotAuthenticated' ? 'Not logged in' : `kvstore error: ${err.message}`);
    }
    return key;
}

// Republish: push the editor's current content to the page/collection destination
// it was originally loaded from, without going through the Post panel. Dispatches
// to the collection path when the loaded page is a collection, mirroring the
// currentEditor === 'collection' dispatch already used by playPost()/playSave().
async function playRepublish() {
    if (!currentLoadedPage) return;
    if (currentLoadedPage.kind === 'collection') {
        if (typeof window.republishCollection === 'function') await window.republishCollection();
        return;
    }
    await _republishStandalonePage();
}

// Shows transient success/failure feedback next to the Republish button, inside
// #loaded-page-indicator — Republish-specific, unlike the generic identity-bar
// showStatusMessage().
function showRepublishStatus(message, isError) {
    const el = document.getElementById('republish-status');
    if (!el) {
        if (isError) showErrorModal(message, { title: 'Republish failed' });
        else showStatusMessage(message);
        return;
    }
    el.textContent = message;
    el.setAttribute('data-state', isError ? 'error' : 'success');
}

async function _republishStandalonePage() {
    const page = currentLoadedPage;
    const adapter = window.CList.binPublishers?.[page.service];
    if (!adapter) {
        showRepublishStatus('Republish is not available for this service.', true);
        return;
    }

    const account = await _findAccountForPage(page);
    if (!account) return;

    const handler = editorHandlers[currentEditor];
    const rawContent = (handler && typeof handler.getContent === 'function') ? await handler.getContent() : '';
    if (!rawContent || !rawContent.trim()) {
        showRepublishStatus('Nothing to republish — the editor is empty.', true);
        return;
    }

    // Republish replaces this exact resource in place — reuse its own identity.
    // A legacy record saved before identity embedding existed gets one minted
    // now, same rule as the Post-panel overwrite path.
    const id = page.id || `urn:uuid:${crypto.randomUUID()}`;
    const content = _embedWebPageIdentity(rawContent, page.mimeType, page.title, id);

    try {
        await adapter.update(page.serviceId, content, page.mimeType, account);
        const touched = await _touchOrForkWebPageRecord(page.pageKey, id);
        page.id = touched.id;
        page.pageKey = touched.pageKey;
        showRepublishStatus(touched.forked
            ? 'Republished — different author detected, saved as a new, derived copy in My Pages.'
            : 'Republished.', false);
    } catch (e) {
        console.error('[playRepublish] failed', e);
        showRepublishStatus('Republish failed: ' + e.message, true);
    }
}

// Shared by _republishStandalonePage and republishCollection: finds the account
// that originally published a given My Pages row, by service + instance.
async function _findAccountForPage(page) {
    let accounts = window.CList.accounts;
    if (!Array.isArray(accounts) || !accounts.length) {
        try {
            accounts = window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
        } catch (e) {
            showRepublishStatus('Error getting accounts: ' + e.message, true);
            return null;
        }
    }
    const account = accounts.map(parseAccountValue).filter(Boolean)
        .find(v => v.type === page.service && v.instance === page.accountInstance);
    if (!account) showRepublishStatus('Could not find the account this page was published with.', true);
    return account || null;
}

// Patches the page's own kvstore record in place — same list/decrypt/patch/
// re-encrypt/update shape as _saveWebPageRecord — when the current session
// is the same author (or a verified alias of the record's authorDid via
// alsoKnownAs). When it's a different, unverified author, forks instead:
// mints a new urn:uuid, writes a brand-new `page:<uuid>` record carrying
// `derivedFrom` (the old id) and the current session's authorDid, and leaves
// the original record untouched. `extra` fields (e.g. savedLocally/
// savedLocallyAt) are merged into whichever record ends up being written.
// Returns { pageKey, id, forked } so callers can repoint currentLoadedPage/
// page at the record that actually got written.
async function _touchOrForkWebPageRecord(pageKey, id, extra = {}) {
    const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
    const kvs = await window.CList.storage.kv.list();
    const kv = (kvs || []).find(k => k.key === pageKey);
    if (!kv) return { pageKey, id, forked: false };
    const rec = JSON.parse(await decryptWithKey(encKey, kv.value));

    const currentDid = _currentAuthorDid();
    const sameAuthor = await _isSameAuthor(rec.authorDid, currentDid);

    if (!sameAuthor) {
        const newId = `urn:uuid:${crypto.randomUUID()}`;
        const forkedRecord = {
            ...rec,
            id: newId,
            derivedFrom: rec.id,
            authorDid: currentDid,
            publishedAt: new Date().toISOString(),
            ...extra,
        };
        const newPageKey = await _saveWebPageRecord(forkedRecord);
        return { pageKey: newPageKey, id: newId, forked: true };
    }

    rec.publishedAt = new Date().toISOString();
    // Backfill id on a legacy record that predates identity embedding.
    if (id) rec.id = id;
    if (currentDid) rec.authorDid = currentDid;
    Object.assign(rec, extra);
    const encrypted = await encryptWithKey(encKey, JSON.stringify(rec));
    await window.CList.storage.kv.update(pageKey, encrypted);
    return { pageKey, id: rec.id, forked: false };
}

function populateSaveOptions() {
    const saveOptionsDiv = document.getElementById('save-options');
    saveOptionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Select a destination to save to';
    list.appendChild(tip);

    window.CList.savers.forEach(handler => {
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        if (handler.logoSrc) {
            iconEl.className = 'service-icon-img';
            iconEl.style.webkitMask = `url('${handler.logoSrc}') no-repeat center / contain`;
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'save';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);

        btn.addEventListener('click', async () => {
            const result = await handler.save();
            if (!result?.keepOpen) closeRightPane();
        });

        list.appendChild(btn);
    });

    saveOptionsDiv.appendChild(list);
}


async function postAll() {

    const post = await packagePost();
    if (!post) return; // packagePost() already displayed the error (e.g. missing title)
    const writeColumnTitle = window.CList.ui.view.writeTitle.innerText.trim();
    const resultDiv = window.CList.ui.view.postResult;
    resultDiv.innerHTML = '';

    const allAccounts = await getAccounts(window.CList.config.flaskSiteUrl);

    // Collect selected accounts with char limits, sorted highest-first so the
    // fullest version is published first and its URL is available for short-form posts
    const selectedButtons = document.querySelectorAll('#post-options .account-button[data-selected="true"]');
    const selectedAccounts = Array.from(selectedButtons)
        .map(btn => {
            const key = btn.getAttribute('data-key');
            const account = allAccounts.find(acc => acc.key === key);
            if (!account) return null;
            const accountData = parseAccountValue(account);
            if (!accountData) return null;
            const maxLen = parseInt(accountData.maxlength, 10);
            const charLimit = (!isNaN(maxLen) && maxLen > 0) ? maxLen : 1000000;
            return { key, charLimit };
        })
        .filter(Boolean)
        .sort((a, b) => b.charLimit - a.charLimit);

    let publishedURL = null;

    for (const selected of selectedAccounts) {
        const account = allAccounts.find(acc => acc.key === selected.key);
        if (!account) continue;

        const accountData = parseAccountValue(account);
        if (!accountData) continue;
        const charLimit = selected.charLimit;
        const handler = window.CList.publishers[accountData.type];
        if (!handler || typeof handler.publish !== 'function') {
            showPostMessage(resultDiv, `No publish handler registered for account type: ${accountData.type}`);
            continue;
        }

        // Build candidate text: use handler.construct() if defined, otherwise raw post HTML
        const candidateText = (typeof handler.construct === 'function')
            ? handler.construct(writeColumnTitle, post)
            : post;

        let contentToPost;
        if (candidateText.length <= charLimit) {
            // Fits: publish as-is
            contentToPost = candidateText;
        } else if (publishedURL) {
            // Too long but we have a URL: assemble "title/opening + see [url]" within limit
            const ref = `see ${publishedURL}`;
            const baseText = writeColumnTitle ? removeHtml(writeColumnTitle) : removeHtml(post);
            const maxBaseLen = charLimit - ref.length - 1; // -1 for the space separator
            const prefix = maxBaseLen > 0 ? baseText.substring(0, maxBaseLen) : '';
            contentToPost = (prefix ? prefix + ' ' : '') + ref;
        } else {
            // Too long and no URL to reference: warn and truncate
            showPostMessage(resultDiv,
                `Post exceeds the ${charLimit}-character limit for "${accountData.title || accountData.type}" and will be truncated.`
            );
            contentToPost = candidateText.substring(0, charLimit);
        }

        const refs = getReferences();
        const url = await handler.publish(accountData, writeColumnTitle, contentToPost, refs);
        if (url) {
            if (!publishedURL) publishedURL = url;
            const p = document.createElement('p');
            p.className = 'feed-status-message';
            p.innerHTML = `Published to ${accountData.title || accountData.type}: <a href="${url}" target="_blank">${url}</a>`;
            resultDiv.appendChild(p);

            // A local-page keeps its local identity when published to a social
            // account too — annotate the existing PageStore record instead of
            // forking it (docs/storage-model.md "recordPublication").
            if (currentLoadedPage && currentLoadedPage.kind === 'local-page') {
                try {
                    await window.CList.pageStore.recordPublication(currentLoadedPage.id, {
                        service: accountData.type,
                        accountId: accountData.id || null,
                        url,
                    });
                    // See postToWebPage()'s matching comment — mirror onto the live
                    // pointer for the running-state indicator. No file format here
                    // (a social status post, not a published file), so format is left
                    // whatever it already was.
                    currentLoadedPage.publicationUrl = url;
                } catch (e) {
                    console.error('[postAll] failed to record publication', e);
                    showPostMessage(resultDiv, "Published, but could not update the local page's publication status: " + e.message);
                }
            }
        }
    }

    // Send WebMentions if the user has opted in
    if (publishedURL && typeof sendWebMentions === 'function') {
        sendWebMentions(publishedURL, getReferences());
    }

    if (typeof window._onPostAllComplete === 'function') {
        const cb = window._onPostAllComplete;
        window._onPostAllComplete = null;
        cb();
    }
}

function showPostMessage(div, text) {
    const p = document.createElement('p');
    p.className = 'feed-status-message';
    p.textContent = text;
    div.appendChild(p);
}

// Dispatch publishing to the registered handler for the account type
async function postContentByType(accountData, title, content) {
    const handler = window.CList.publishers[accountData.type];
    if (!handler || typeof handler.publish !== 'function') {
        showErrorModal('No publish handler registered for account type: ' + accountData.type, { title: 'No publish handler found' });
        return null;
    }
    return await handler.publish(accountData, title, content);
}


    // Makes sure posts that need a title get one
    function checkTitleAndProceed(title) {
        if (title === "Title (Optional)") {
            const userResponse = confirm("Would you like to add a proper title?");
            if (userResponse) {
                // User clicked "Yes"
                alert("Please enter a title (top of the 'write' pane) and then click 'Publish' again.");
                return; // Stop function execution
            }
            // If user clicked "No", continue execution
        }
    }

