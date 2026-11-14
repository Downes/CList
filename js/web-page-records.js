/// <reference path="./clist-types.js" />
// Web-page identity and encrypted metadata operations; no interface access.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

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
// (the identity migration flow). Unresolvable (bad DID shape, fetch failure, no match)
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

/**
 * @param {CListPublishedPageRecord} record
 * @param {CListWebPageSession|null} [session] Omitted by legacy file-save callers.
 * @returns {Promise<string>}
 */
async function _saveWebPageRecord(record, session = null) {
    session ||= await _webPageRecordSession();
    assertAccountSession(session);
    const encKey = session.encKey;
    if (!encKey) throw new Error('Encryption key not available');

    if (!record.id) record.id = `urn:uuid:${crypto.randomUUID()}`;
    const key = `page:${record.id.replace(/^urn:uuid:/, '')}`;
    const encrypted = await encryptWithKey(encKey, JSON.stringify(record));
    try {
        assertAccountSession(session);
        await window.CList.storage.kv.put(key, encrypted);
    } catch (err) {
        throw new Error(kvErrorMessage(err));
    }
    return key;
}

/**
 * @param {string} pageKey
 * @param {string} id
 * @param {Object} [extra]
 * @param {CListWebPageSession|null} [session]
 * @returns {Promise<{pageKey: string, id: string, forked: boolean}>}
 */
async function _touchOrForkWebPageRecord(pageKey, id, extra = {}, session = null) {
    session ||= await _webPageRecordSession();
    assertAccountSession(session);
    const encKey = session.encKey;
    const kvs = await window.CList.storage.kv.list();
    const kv = (kvs || []).find(k => k.key === pageKey);
    if (!kv) return { pageKey, id, forked: false };
    const rec = await decryptKVJson(encKey, kv.value);

    const currentDid = session.authorDid;
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
        const newPageKey = await _saveWebPageRecord(forkedRecord, session);
        return { pageKey: newPageKey, id: newId, forked: true };
    }

    rec.publishedAt = new Date().toISOString();
    // Backfill id on a legacy record that predates identity embedding.
    if (id) rec.id = id;
    if (currentDid) rec.authorDid = currentDid;
    Object.assign(rec, extra);
    const encrypted = await encryptWithKey(encKey, JSON.stringify(rec));
    assertAccountSession(session);
    await window.CList.storage.kv.update(pageKey, encrypted);
    return { pageKey, id: rec.id, forked: false };
}


// Compatibility callers (file saving) capture their own transient session.
async function _webPageRecordSession() {
    const storeUrl = window.CList.config.flaskSiteUrl;
    const token = getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN);
    const authorDid = _currentAuthorDid();
    const session = { storeUrl, token, authorDid, encKey: await getEncKey(storeUrl) };
    assertAccountSession(session);
    return session;
}
