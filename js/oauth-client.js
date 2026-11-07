//  oauth-client.js  -  OAuth 2.0 authorization code + PKCE client
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  Depends on: oauth-config.js, oauth-strategies.js
//
//  Multi-account design: each flow is identified by an accountKey (e.g. user@instance.social).
//  Flow state (state token, PKCE verifier, etc.) is stored in sessionStorage keyed by the
//  random OAuth state value, so N simultaneous flows from N instances don't collide.
//
//  Token storage is intentionally NOT owned by this module.  handleCallback() returns the
//  token to the caller, which is responsible for persisting it (e.g. to kvstore).

const OAuthClient = {

    // Start an OAuth authorization code flow.
    //
    // accountKey   — stable identifier for this account (e.g. user@instance.social)
    // providerType — key into OAuthProviders (e.g. 'Mastodon')
    // instanceUrl  — base URL of the provider instance (e.g. 'https://mastodon.social')
    // options      — { scope, forceLogin, extra: { title, permissions, ... } }
    async login(accountKey, providerType, instanceUrl, options = {}) {
        const provider = OAuthProviders[providerType];
        if (!provider) throw new Error(`Unknown OAuth provider: ${providerType}`);

        const mode = OAuthStrategies.detectRuntimeMode();
        if (mode === 'file') {
            throw new Error('OAuth is not supported when opening CList directly from a file. Use manual token entry instead.');
        }

        const redirectUri = window.location.origin + '/callback.html';

        const clientData = provider.dynamicRegistration
            ? await this._getOrRegisterClient(instanceUrl, provider, redirectUri)
            : { clientId: options.clientId || provider.clientId, clientSecret: null, redirectUri };

        const { codeVerifier, codeChallenge } = await this._generatePKCE();
        const state = this._randomState();

        sessionStorage.setItem('oauth_state_' + state, JSON.stringify({
            accountKey,
            providerType,
            instanceUrl,
            clientId:     clientData.clientId,
            clientSecret: clientData.clientSecret || null,
            redirectUri,
            codeVerifier,
            mode,
            extra:        options.extra || {},
        }));

        const authParams = new URLSearchParams({
            client_id:             clientData.clientId,
            redirect_uri:          redirectUri,
            response_type:         'code',
            scope:                 options.scope || provider.scopes,
            state,
            code_challenge:        codeChallenge,
            code_challenge_method: 'S256',
        });
        if (options.forceLogin) authParams.set('force_login', 'true');
        if (provider.extraAuthParams) {
            Object.entries(provider.extraAuthParams).forEach(([k, v]) => authParams.set(k, v));
        }

        const authUrl = provider.authorizationUrl || (instanceUrl + provider.authorizationPath);
        window.location.href = authUrl + '?' + authParams.toString();
    },

    // Process an OAuth callback URL.
    // Reads code + state from the current URL, validates state against sessionStorage,
    // exchanges the code for a token, and returns:
    //   { accountKey, providerType, instanceUrl, accessToken, tokenData, extra }
    // tokenData contains the full token response (including refresh_token when offline access was requested).
    // Returns null if the URL has no OAuth parameters (not a callback).
    async handleCallback() {
        const params = new URLSearchParams(window.location.search);
        const code   = params.get('code');
        const state  = params.get('state');
        const error  = params.get('error');

        if (error) throw new Error(`Authorization denied: ${params.get('error_description') || error}`);
        if (!code || !state) return null;

        const rawFlow = sessionStorage.getItem('oauth_state_' + state);
        if (!rawFlow) throw new Error('OAuth state not found — session may have expired or this is a CSRF attempt.');
        sessionStorage.removeItem('oauth_state_' + state);

        const flow     = JSON.parse(rawFlow);
        const provider = OAuthProviders[flow.providerType];
        if (!provider) throw new Error(`Unknown provider in saved flow state: ${flow.providerType}`);

        const tokenData = await OAuthStrategies.exchangeCode(code, {
            instanceUrl:  flow.instanceUrl,
            tokenPath:    provider.tokenPath,
            tokenUrl:     provider.tokenUrl || null,
            clientId:     flow.clientId,
            clientSecret: flow.clientSecret,
            redirectUri:  flow.redirectUri,
            codeVerifier: flow.codeVerifier,
            mode:         flow.mode,
        });

        // tokenData may be the full response object (preferred) or a bare string (legacy).
        const accessToken = (typeof tokenData === 'object') ? tokenData.access_token : tokenData;

        return {
            accountKey:   flow.accountKey,
            providerType: flow.providerType,
            instanceUrl:  flow.instanceUrl,
            accessToken,
            tokenData:    (typeof tokenData === 'object') ? tokenData : null,
            extra:        flow.extra || {},
        };
    },

    // Fetch a cached client registration for instanceUrl, or register a new app and cache the result.
    // Cache is keyed per provider + instance + redirectUri so that desktop and hosted-web flows
    // get separate registrations (Mastodon validates redirect_uri at code exchange time).
    async _getOrRegisterClient(instanceUrl, provider, redirectUri) {
        const cacheKey = 'oauth_client_' + provider.name + '_' + btoa(instanceUrl + '|' + redirectUri).replace(/=/g, '');
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached) return cached;

        const response = await fetch(`${instanceUrl}${provider.registrationEndpoint}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                client_name:   'CList',
                redirect_uris: redirectUri,
                scopes:        provider.scopes,
                website:       'https://clist.mooc.ca',
            }),
        });
        if (!response.ok) throw new Error(`App registration failed on ${instanceUrl}: ${response.status}`);
        const appData = await response.json();

        const clientData = {
            clientId:     appData.client_id,
            clientSecret: appData.client_secret || null,
            redirectUri,
        };
        localStorage.setItem(cacheKey, JSON.stringify(clientData));
        return clientData;
    },

    async _generatePKCE() {
        const verifierBytes = new Uint8Array(32);
        crypto.getRandomValues(verifierBytes);
        const codeVerifier = base64UrlEncode(verifierBytes);

        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
        const codeChallenge = base64UrlEncode(digest);

        return { codeVerifier, codeChallenge };
    },

    _randomState() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    },

    // Shared "pick up an OAuth redirect" boilerplate. callback.html stores its result in
    // localStorage under a single shared key regardless of provider; this reads it once per
    // page load, fires onResult(data) only for the matching provider, and clears the key either
    // way so a stale result can't be picked up twice or by the wrong provider's listener.
    // Used both for flows started via login() above (data has accessToken/extra/accountKey) and
    // for providers with their own non-standard callback shape (e.g. WordPress's siteUrl/
    // userLogin/password) — this only standardizes the parse/match/remove, not the payload shape.
    onCallback(providerType, onResult) {
        document.addEventListener('DOMContentLoaded', async function () {
            const raw = localStorage.getItem(window.CList.keys.OAUTH_CALLBACK_RESULT);
            if (!raw) return;
            let data;
            try { data = JSON.parse(raw); } catch (e) { console.error('Bad oauth_callback_result', e); return; }
            if (data.providerType !== providerType) return;
            localStorage.removeItem(window.CList.keys.OAUTH_CALLBACK_RESULT);
            await onResult(data);
        });
    },

    // Shared "finish OAuth flow" save: encrypts instanceData, stores it under accountKey in
    // kvstore, refreshes the in-memory account list/UI, and reports success/failure via the
    // standard modal/status helpers (see CLAUDE.md "Error Handling"). afterRefresh (optional,
    // async) runs any provider-specific UI refresh beyond the universal updateUIVisibility()
    // call (e.g. repopulating a reader/post-options list), before the "saved" status message.
    async saveAccount(providerLabel, accountKey, instanceData, { afterRefresh } = {}) {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) { showErrorModal('Encryption key missing — please log in again.', { title: 'Encryption key missing' }); return; }

        let encryptedValue;
        try {
            encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
        } catch (err) {
            console.error(`Failed to encrypt ${providerLabel} account data:`, err);
            showErrorModal(`Could not save ${providerLabel} account — encryption failed. Try logging in again.`, { title: 'Save failed' });
            return;
        }

        try {
            await window.CList.storage.kv.put(accountKey, encryptedValue);
        } catch (err) {
            if (err.code === 'NotAuthenticated') showErrorModal(`Please log in to kvstore before authorizing ${providerLabel}.`, { title: 'Not logged in' });
            else showErrorModal(`Failed to save ${providerLabel} account to kvstore.`, { title: 'Save failed' });
            return;
        }

        try {
            window.CList.accounts = await getAccounts(window.CList.config.flaskSiteUrl);
            if (window.CList.accounts) {
                updateUIVisibility();
                if (afterRefresh) await afterRefresh();
            }
            showStatusMessage(`${providerLabel} account authorized and saved.`);
        } catch (error) {
            showErrorModal(`Account saved — but could not refresh: ${error.message}`, { title: 'Refresh failed' });
        }
        if (typeof playAccounts === 'function') playAccounts();
    },
};
