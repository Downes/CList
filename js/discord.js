/// <reference path="./clist-types.js" />
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

(function () {
    window.CList.publishers['Discord'] = {
        /** @param {CListAccountData} accountData
         * @param {string} title
         * @param {string} content
         * @returns {Promise<CListPublisherResult>} */
        publish: async (accountData, title, content) => {
            if (!accountData.channel) throw new Error('This Discord account has no channel configured.');
            const resp = await fetch(`${DISCORD_BRIDGE_URL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...kvstoreAuthHeader() },
                body: JSON.stringify({ channel: accountData.channel, content: removeHtml(content) }),
            });
            const result = await resp.json().catch(() => ({}));
            if (!resp.ok || !result.ok) throw new Error(result.error || `Discord bridge request failed: HTTP ${resp.status}`);
            return result.url || null;
        },
    };
})();
