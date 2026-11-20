/// <reference path="./clist-types.js" />
//  bluesky.js  -  helper and utility functions for Bluesky API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Bluesky'] = {
    type: 'Bluesky',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you.bsky.social' },
    fields: [
        { key: 'title',       label: 'Title',          editable: true,  inputType: 'text',     placeholder: 'My Bluesky', default: '' },
        { key: 'permissions', label: 'Permissions',    editable: true,  inputType: 'text',     placeholder: 'rw',         default: 'rw' },
        { key: 'id',          label: 'App Password',   editable: true,  inputType: 'password', placeholder: '',           default: '' },
        { key: 'maxlength',   label: 'Maximum Length', editable: true,  inputType: 'text',     placeholder: '300',        default: '300' },
    ]
};

let _bskyToken = null;
let _bskyDid   = null;
let _bskyPds   = null;

async function resolveBlueskyPds(handle) {
    const resolveResp = await fetch(
        `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    if (!resolveResp.ok) throw new Error(`Could not resolve handle ${handle}: ${resolveResp.statusText}`);
    const { did } = await resolveResp.json();

    const didResp = await fetch(`https://plc.directory/${did}`);
    if (!didResp.ok) throw new Error(`Could not fetch DID document for ${handle}: ${didResp.statusText}`);
    const didDoc = await didResp.json();

    const pdsService = didDoc.service?.find(s => s.id === '#atproto_pds');
    if (!pdsService) throw new Error(`No PDS found in DID document for ${handle}`);

    return { pdsUrl: pdsService.serviceEndpoint, did };
}

// Compatibility for standalone publishing callers. Reader UI uses captured sessions.
async function createBlueskySession() {
    if (typeof currentBlueskyReaderSession === 'function' && typeof _blueskyReaderOwner !== 'undefined' && _blueskyReaderOwner) {
        return currentBlueskyReaderSession();
    }
    if (_bskyToken && _bskyDid && _bskyPds) return { accessToken: _bskyToken, did: _bskyDid, pds: _bskyPds };
    throw new Error('Select a Bluesky reader account before using its standalone post form.');
}

async function normalizeBlueskyPost(post) {
    const authorName  = post.author.displayName || "Unknown Author";
    const handle      = post.author.handle;
    const postId      = post.uri.split('/').pop();
    const postUrl     = `https://bsky.app/profile/${handle}/post/${postId}`;
    const postContent = post.record.text || '';

    let desc;
    try   { desc = await processTranslationWithTimeout(postContent); }
    catch { desc = postContent; }

    const isLiked    = !!(post.viewer?.like);
    const isReposted = !!(post.viewer?.repost);
    const likeUri    = post.viewer?.like   || '';
    const repostUri  = post.viewer?.repost || '';
    const inThread   = !!(post.record.reply?.root?.uri) || post.replyCount > 0;
    const threadUri  = inThread ? (post.record.reply?.root?.uri || post.uri) : null;
    const parentUri  = post.uri;
    const parentCid  = post.cid;
    const rootUri    = post.record.reply?.root?.uri || post.uri;
    const rootCid    = post.record.reply?.root?.cid || post.cid;

    return {
        service:    'Bluesky',
        url:        postUrl,
        titleHtml:  window.CList.ui.socialPostLine(
                        `<a href="#" title="View User Feed">${_he(authorName)}</a>`,
                        handle, 'wrote', desc, postUrl, '@' + handle),
        title:      postContent.slice(0, 80),
        desc,
        noSummaryDesc: true,
        feed:       '@' + handle,
        author:     authorName,
        date:       post.record.createdAt || new Date().toISOString(),
        images:     (post.embed?.images || []).map(img => ({
                        preview_url: img.thumb,
                        url:         img.fullsize,
                        description: img.alt || ''
                    })),
        guid:       post.uri,
        author_id:  handle,
        replyToken: { type: 'Bluesky', uri: post.uri, cid: post.cid },
        bluesky:    { handle, postId, postUrl,
                      isLiked, isReposted, likeUri, repostUri,
                      inThread, threadUri,
                      parentUri, parentCid, rootUri, rootCid,
                      uri: post.uri, cid: post.cid },
    };
}

function parseThreadToPosts(thread) {
    const posts = [];

    function traverse(node) {
        if (!node || !node.post) return;
        posts.push({ post: node.post });
        if (node.replies && Array.isArray(node.replies)) {
            node.replies.forEach(reply => traverse(reply));
        }
    }

    traverse(thread);
    return posts;
}

async function submitBlueskyPostFromForm(replyContentId = null, responseDiv = 'blueskyPostResponse', parentUri = null, parentCid = null, rootUri = null, rootCid = null) {
    const input = replyContentId ? document.getElementById(replyContentId) : null;
    const text = input?.value || '';
    const submitted = await submitBlueskyPost(text, responseDiv, replyContentId, parentUri, parentCid, rootUri, rootCid);
    if (submitted && input?.value === text) input.value = '';
}

/**
 * Standalone form view/controller. Registered publishing uses bluesky_publish.js directly.
 * @param {string} content
 * @param {string} responseDiv
 * @param {string|null} [replyContentId]
 * @param {string|null} [parentUri]
 * @param {string|null} [parentCid]
 * @param {string|null} [rootUri]
 * @param {string|null} [rootCid]
 * @param {CListBlueskySession|null} [publishingSession]
 * @returns {Promise<boolean>} Whether the request completed, for input clearing.
 */
async function submitBlueskyPost(content, responseDiv, replyContentId = null, parentUri = null, parentCid = null, rootUri = null, rootCid = null, publishingSession = null) {
    const reply = parentUri && parentCid && rootUri && rootCid
        ? { parent: { uri: parentUri, cid: parentCid }, root: { uri: rootUri, cid: rootCid } } : null;
    if (reply && replyContentId?.includes('-')) responseDiv = `replyResponse-${replyContentId.split('-')[1]}`;
    const result = document.getElementById(responseDiv);
    if (result) result.innerHTML = '';
    try {
        const session = publishingSession || await createBlueskySession();
        const url = await publishBlueskyRecord(session, content, reply, {
            onWarning: message => { if (result) showPostMessage(result, message); },
        });
        if (result) {
            if (url) renderPublicationSuccess(result, 'Bluesky', url);
            else showPostMessage(result, 'Bluesky returned no post link. Check your posts before retrying.');
        }
        return true;
    } catch (error) {
        if (result) showServiceError(result, 'Bluesky post failed', error.message);
        else showErrorModal(error.message, { title: 'Bluesky post failed' });
        return false;
    }
}
