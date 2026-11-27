/// <reference path="./clist-types.js" />
//  blogger.js  -  helper and utility functions for Blogger API
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
window.CList.schemas['Blogger'] = {
    type: 'Blogger',
    instanceFromKey: true,
    kvKey: { label: 'Blog ID', placeholder: '1234567890' },
    fields: [
        { key: 'title',       label: 'Blog Title', editable: true, inputType: 'text',     placeholder: 'My Blog', default: '' },
        { key: 'permissions', label: 'Permissions',editable: true, inputType: 'text',     placeholder: 'w',       default: 'w' },
        { key: 'id',          label: 'Client ID',  editable: true, inputType: 'text',     placeholder: '123456.apps.googleusercontent.com', default: '' },
    ]
};

(function () {
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['Blogger'] = {
        acceptedFormats: ['html', 'md', 'text'],
        publish: async (accountData, title, content) => {
            const plainTitle = derivePlainTitle(title, content);
            return await publishBloggerPost(
                accountData.instance,
                accountData.id,
                plainTitle,
                content
            );
        }
    };
})();

/**
 * Publish using the existing Google token flow. Data/errors only; the caller
 * presents failures. A successful response without a URL remains unconfirmed.
 * @param {string} blogid
 * @param {string} clientid
 * @param {string} bloggerTitle
 * @param {string} bloggerContent
 * @returns {Promise<CListPublisherResult>}
 */
async function publishBloggerPost(blogid, clientid, bloggerTitle, bloggerContent) {
    if (!bloggerContent) throw new Error('There is no content to publish to Blogger.');
    if (!blogid || !clientid) throw new Error('The Blogger account needs a Blog ID and Client ID. Check it under Accounts.');
    const accessToken = await requestBloggerAccessToken(clientid);
    let response;
    try {
        response = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogid}/posts/`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'blogger#post', title: bloggerTitle, content: bloggerContent }),
        });
    } catch (error) {
        throw new Error('Could not confirm Blogger publication: ' + error.message + '. Check your blog before retrying.');
    }
    let data;
    try { data = await response.json(); }
    catch {
        if (response.ok) throw new Error('Blogger returned success, but its response could not be read. Check your blog before retrying.');
        throw new Error(`Failed to publish to Blogger (HTTP ${response.status}). The error response could not be read.`);
    }
    if (!response.ok) {
        throw new Error(`Failed to publish to Blogger (HTTP ${response.status}): ${data?.error?.message || response.statusText || 'Unknown error'}`);
    }
    return typeof data?.url === 'string' && data.url ? data.url : null;
}

/**
 * Google Identity Services reports OAuth errors in callback and popup errors in
 * error_callback: https://developers.google.com/identity/oauth2/web/reference/js-reference
 * @param {string} clientid
 * @returns {Promise<string>} Transient access token; never persisted.
 */
async function requestBloggerAccessToken(clientid) {
    if (typeof window.ensureGoogleIdentity === 'function') await window.ensureGoogleIdentity();
    return new Promise((resolve, reject) => {
        if (typeof google === 'undefined' || !google.accounts?.oauth2?.initTokenClient) {
            reject(new Error('Google authorization is unavailable. Reload CList and try again.'));
            return;
        }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientid,
            scope: 'https://www.googleapis.com/auth/blogger',
            callback: response => {
                if (response?.error || !response?.access_token) {
                    const detail = response?.error_description || response?.error || 'No access token returned';
                    reject(new Error('Failed to authorize with Blogger: ' + detail));
                } else {
                    resolve(response.access_token);
                }
            },
            error_callback: error => {
                const detail = error?.type === 'popup_closed' ? 'The authorization window was closed.'
                    : error?.type === 'popup_failed_to_open' ? 'The authorization window could not open. Allow pop-ups and try again.'
                    : 'The authorization window failed.';
                reject(new Error('Failed to authorize with Blogger: ' + detail));
            },
        });
        client.requestAccessToken();
    });
}

// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Blogger'] = function (context) {
    let controller;
    return { open() {
        controller ||= createBloggerSetupController(accountSetupDependencies(context, { label: 'Blogger', stateKey: 'bloggerSetup' }));
        controller.mount(createBloggerSetupView(context.container));
    } };
};
