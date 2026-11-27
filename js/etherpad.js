//  etherpad.js  -  helper and utility functions for Etherpad API
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
window.CList.schemas['Etherpad'] = {
    type: 'Etherpad',
    instanceFromKey: true,
    kvKey: { label: 'Etherpad API URL', placeholder: 'https://etherpad.example.com/api/1.2.15' },
    fields: [
        { key: 'title',       label: 'Title',           editable: true, inputType: 'text', placeholder: 'My Etherpad',                                default: '' },
        { key: 'permissions', label: 'Permissions',     editable: true, inputType: 'text', placeholder: 'e',                                          default: 'e' },
        { key: 'id',          label: 'Proxy Server URL',editable: true, inputType: 'text', placeholder: 'https://www.downes.ca/cgi-bin/proxyp.cgi',   default: '' },
    ]
};
// 


const proxyUrl = 'https://proxyp.mooc.ca';

// The specific Etherpad account (parsed kvstore entry) currently active in the editor,
// set by the handler's initialize() and used by callEtherpadApi() — so API calls target
// the account the user actually selected, not just "the first Etherpad account found".
let currentEtherpadAccount = null;

// The web origin of a third-party Etherpad server the user is connected to as a guest
// (no account, no API key) — e.g. "https://pad.gattini.ninja". Mutually exclusive with
// currentEtherpadAccount: exactly one of the two represents "where is this pad hosted".
let currentEtherpadGuestBase = null;

// Compatibility names retained for editor/chat callers; operations use captured controllers.
var padName = '', authorID = '', etherpadUsername = '';
function etherpadPadUrl(name) {
    const base = currentEtherpadGuestBase || currentEtherpadAccount?.instance?.replace(/\/api\/[^/]+\/?$/, '');
    if (!base) throw new Error('No Etherpad connection is active.');
    return etherpadDocumentUrl(base, name);
}
editorHandlers.etherpad = {
    getSharing(){const owner=_etherpadConnection,pad=padName;if(!owner?.controller.active()||!pad||(!currentEtherpadGuestBase&&!currentEtherpadAccount))return null;const link=etherpadPadUrl(pad);return {docId:pad,server:new URL(link).origin,title:pad,links:{edit:link},accessSettings:false,current:()=>_etherpadConnection===owner&&owner.controller.active()&&padName===pad};},
    label: 'Etherpad', icon: 'group', contentTypes: ['text/html', 'text/plain'], requiresAccount: true,
    isActive: () => !!_etherpadConnection?.controller.active(),
    initialize: account => mountEtherpadConnection(account),
    getContent: () => etherpadDocuments().read('html'),
    loadContent: (content, itemId) => etherpadDocuments().append(content, itemId),
};
function callEtherpadApi(method, params) {
    if (!currentEtherpadAccount) return Promise.reject(new Error('No Etherpad account selected.'));
    const { instance, id: apiKey } = currentEtherpadAccount;
    return requestEtherpadDocument({ instance, apiKey, proxy: proxyUrl, headers: { ...kvstoreAuthHeader() } }, method, params, { fetch });
}
function isEtherpadConnectionError(error) { return /can't connect to/i.test(error.message); }
function setUserName() { return runEtherpadInputAction('author'); }
function getAuthorId(username) { return etherpadDocuments().author(username); }
function initializeEtherpad() { return etherpadDocuments().open(padName, false); }
function createAndLoadEtherpad(name) {
    return etherpadDocuments().open(name ?? document.getElementById('newPadName')?.value ?? '', true);
}
function connectToThirdPartyEtherpad(base, pad) { return _etherpadConnection?.controller.guest(base, pad) || false; }
function connectToThirdPartyEtherpadFromForm() {
    return _etherpadConnection?.controller.guest(document.getElementById('thirdPartyEtherpadUrl')?.value || '',
        document.getElementById('thirdPartyEtherpadPad')?.value || '', true) || false;
}
function fetchGuestPadHtml(base, pad) {
    return readEtherpadGuestDocument({ webBase: base, pad, proxy: proxyUrl, headers: { ...kvstoreAuthHeader() } }, { fetch });
}
function importPadViaRelay(base, pad, html) {
    return writeEtherpadGuestDocument({ webBase: base, pad, proxy: proxyUrl, headers: { ...kvstoreAuthHeader() } }, html, { fetch });
}
function showPadList() { return _etherpadConnection?.controller.showList() || false; }
function listAllEtherpads() { return _etherpadConnection?.controller.list() || Promise.resolve(false); }
function appendEtherpadContent() { return runEtherpadInputAction('append'); }
function extractEtherpadContent(format) { return etherpadDocuments().read(format); }
function handleExtractContent() { return displayEtherpadExtract(); }
function sharePad() { return etherpadDocuments().share(); }
let _etherpadSharedOpening = 0;
async function showPadShare(link) {
    const intent = ++_etherpadSharedOpening, source = captureEtherpadConnectionSource();
    try {
        const url = new URL(link), match = url.pathname.match(/^\/p\/([^/]+)\/?$/);
        if (!match) throw new Error('Could not parse the shared Etherpad link.');
        const target = normalizeEtherpadGuest(url.origin, decodeURIComponent(match[1]));
        if (url.username || url.password) throw new Error('The shared pad URL must not contain credentials.');
        const initialized = await initializeEditor('etherpad', null);
        if (initialized === false || !source() || intent !== _etherpadSharedOpening || currentEditor !== 'etherpad') return false;
        return connectToThirdPartyEtherpad(target.base, target.pad);
    } catch (error) {
        console.error('[Etherpad shared link]', error);
        if (source() && intent === _etherpadSharedOpening) showErrorModal(error.message, { title: 'Etherpad session failed' });
        return false;
    }
}
