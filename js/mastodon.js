/// <reference path="./clist-types.js" />
//  mastodon.js  -  helper and utility functions for Mastodon API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Mastodon'] = {
    type: 'Mastodon',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you@mastodon.social' },
    fields: [
        { key: 'title',       label: 'Title',        editable: true,  inputType: 'text',     placeholder: 'My Mastodon', default: '' },
        { key: 'permissions', label: 'Permissions',  editable: true,  inputType: 'text',     placeholder: 'rw',          default: 'rw' },
        { key: 'id',          label: 'Access Token',   editable: false, inputType: 'oauth', placeholder: '',            default: '' },
        { key: 'maxlength',   label: 'Maximum Length', editable: true,  inputType: 'text',  placeholder: '500',         default: '500' },
    ]
};
// 


// Key functions

//    initializeMasto: Verifies the credentials of the selected Mastodon account. Note that the credential provided is the Mastodon access token 

//    loadMastodonFeed: Fetches various types of timelines (home, local, bookmarks, hashtag, user) and paginates the results.

//    handleMastodonAction: Allows users to perform actions like replying, boosting, favoriting, or bookmarking a status.

//    postMastodonStatus: Posts a new status or replies to an existing one.


// Reader, controls and row actions are registered by the mastodon_* modules.

async function normalizeMastodonPost(status, headerHtml = null) {
    const acct    = status.account.acct;
    const display = status.account.display_name || acct;

    let translatedContent, translationFailed = false;
    try {
        translatedContent = await processTranslationWithTimeout(status.content);
    } catch (e) {
        console.error(`Error translating status ${status.id}:`, e);
        translationFailed = true;
        translatedContent = status.content;
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = translatedContent;
    const plainText = (tempDiv.textContent || tempDiv.innerText || '').replace(/\s+/g, ' ').trim();

    const viewUserFeedLink = `<span>${_he(display)}</span>`;
    const authorLink = window.CList.ui.socialPostLine(viewUserFeedLink, acct, 'wrote', plainText, status.url, '@' + acct);
    const titleHtml  = headerHtml
        ? `<div class="reblog-info">${headerHtml}</div>${authorLink}`
        : authorLink;

    return {
        service:      'Mastodon',
        url:          status.url,
        titleHtml,
        title:        plainText.slice(0, 80),
        desc:         plainText,
        noSummaryDesc: true,
        full_content: new SafeHtml(translatedContent),
        feed:         '@' + acct,
        author:       display,
        author_id:    acct,
        date:         status.created_at,
        images:       getMastodonImageAttachments(status),
        guid:         status.url,
        replyToken:   { type: 'Mastodon', statusId: status.id },
        mastodon: {
            translationWarning: translationFailed,
            acct,
            statusId:     status.id,
            isReblogged:  !!status.reblogged,
            isFavourited: !!status.favourited,
            isBookmarked: !!status.bookmarked,
            inThread:     !!(status.in_reply_to_id || status.replies_count > 0),
        },
    };
}

function getMastodonImageAttachments(status) {
    return (status.media_attachments || []).filter(attachment => attachment.type === 'image').map(image => ({
        url: image.url, preview_url: image.preview_url, description: image.description || 'No description available',
    }));
}

    async function postMastodonStatus(accessToken, baseURL, responseDiv, statusText, replyToId) {
        responseDiv.innerHTML = '';
        try {
            const url = await publishMastodonStatus(accessToken, baseURL, statusText, replyToId, {
                onWarning: message => showPostMessage(responseDiv, message),
            });
            if (url) renderPublicationSuccess(responseDiv, 'Mastodon', url);
            else showPostMessage(responseDiv, 'Mastodon returned no post link. Check your posts before retrying.');
            return true;
        } catch (error) {
            showServiceError(responseDiv, 'Mastodon post failed', error.message);
            return false;
        }
    }

// -----------------------------------------------------

async function mastodonOAuthStart(title, username, permissions, options = {}) {
    const parts = username.split('@').filter(Boolean);
    if (parts.length < 2) {
        if (options.feedback === false) throw new Error('Please enter your Mastodon username as user@instance.social');
        showErrorModal('Please enter your Mastodon username as user@instance.social', { title: 'Invalid username' });
        return;
    }
    const instanceUrl = 'https://' + parts[parts.length - 1];

    try {
        await OAuthClient.login(username, 'Mastodon', instanceUrl, {
            forceLogin: true, isCurrent: options.isCurrent,
            extra: { title: title || username, permissions: permissions || 'rw' },
        });
    } catch (e) {
        if (options.feedback === false) throw e;
        console.error('[Mastodon authorization]', e);
        showErrorModal('Could not start Mastodon authorization: ' + e.message, { title: 'Authorization failed' });
    }
}

// On page load, check whether we're returning from a Mastodon OAuth callback.
// callback.html stores the result in localStorage; OAuthClient.onCallback picks it up and
// saves to kvstore via OAuthClient.saveAccount.
OAuthClient.onCallback('Mastodon', async (data, context) => {
    const instanceData = { type: 'Mastodon', id: data.accessToken, title: data.extra.title || data.accountKey, permissions: data.extra.permissions || 'rw' };
    await OAuthClient.saveAccount('Mastodon', data.accountKey, instanceData, {
        isCurrent: context.isCurrent,
        afterRefresh: async () => {
            await playRead();
            populateReadAccountList(window.CList.accounts);
        },
    });
});
