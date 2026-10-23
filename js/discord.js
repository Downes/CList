//  discord.js  -  Discord account type for CList (read + publish via discord_bridge)
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2026, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Discord'] = {
    type: 'Discord',
    instanceFromKey: false,
    kvKey: { label: 'Account label', placeholder: 'e.g. my-discord' },
    fields: [
        { key: 'title',       label: 'Title',                 editable: true, inputType: 'text',     placeholder: 'Discord', default: '' },
        { key: 'permissions', label: 'Permissions',            editable: true, inputType: 'text',     placeholder: 'rw',      default: 'rw' },
        { key: 'channel',     label: 'Channel',                 editable: true, inputType: 'text',     placeholder: '',        default: '' },
        { key: 'bot_token',   label: 'Bot Token (admin only)',  editable: true, inputType: 'password', placeholder: '',        default: '' },
    ]
};

const DISCORD_BRIDGE_URL = 'https://discord.mooc.ca';

// The bridge requires a valid kvstore Bearer token on every non-admin request —
// read it the same way every other service integration in this codebase does.
function discordAuthHeader() {
    const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// The currently selected Discord account (set by the reader handler's initialize()),
// used by loadDiscordMessages() so polling always targets the right channel.
let currentDiscordChannel = null;

async function loadDiscordMessages() {
    const fc = window.CList.ui.view.feedContainer;
    if (!currentDiscordChannel) {
        fc.innerHTML = '<p class="feed-status-message">No channel selected for this account.</p>';
        return;
    }

    let data;
    try {
        const resp = await fetch(
            `${DISCORD_BRIDGE_URL}/messages?channel=${encodeURIComponent(currentDiscordChannel)}`,
            { headers: discordAuthHeader() }
        );
        if (!resp.ok) throw new Error(`Bridge request failed: HTTP ${resp.status}`);
        data = await resp.json();
    } catch (err) {
        console.error('Discord message fetch failed:', err);
        showServiceError(fc, 'Discord error', err.message,
            'Check your bridge connection and the selected channel under <strong>Accounts</strong>.');
        return;
    }

    if (!Array.isArray(data) || data.length === 0) {
        fc.innerHTML = '<p class="feed-status-message">No recent messages found.</p>';
        return;
    }

    await window.CList.ui.renderFeed(data, fc, {
        normalize: normalizeDiscordMessage,
        title: 'Channel',
        typevalue: currentDiscordChannel,
    });
}

async function normalizeDiscordMessage(raw) {
    return {
        service: 'Discord',
        url: `discord-msg-${raw.id}`,
        title: raw.content ? raw.content.slice(0, 80) : '',
        desc: raw.content || '',
        feed: currentDiscordChannel,
        author: raw.author,
        date: raw.posted_at,
        guid: `discord-${raw.id}`,
    };
}

(function () {
    window.CList.readers['Discord'] = {
        initialize: async (accountData) => {
            currentDiscordChannel = accountData.channel || null;
        },
        feedFunctions: {
            'Channel': loadDiscordMessages,
        },
        onFeedClick: null,
        onAuthorClick: null,
        statusActions: null,
    };
})();

(function () {
    window.CList.publishers['Discord'] = {
        publish: async (accountData, title, content) => {
            if (!accountData.channel) {
                console.error('Discord publish failed: no channel configured on this account.');
                showStatusMessage('This Discord account has no channel configured.');
                return null;
            }
            try {
                const resp = await fetch(`${DISCORD_BRIDGE_URL}/send`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...discordAuthHeader() },
                    body: JSON.stringify({ channel: accountData.channel, content: removeHtml(content) }),
                });
                const result = await resp.json().catch(() => ({}));
                if (!resp.ok || !result.ok) {
                    throw new Error(result.error || `HTTP ${resp.status}`);
                }
                return result.url || null;
            } catch (err) {
                console.error('Discord publish failed:', err);
                showStatusMessage('Discord publish failed: ' + err.message);
                return null;
            }
        },
    };
})();
