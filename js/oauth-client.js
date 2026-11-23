//  oauth-client.js  -  OAuth 2.0 authorization code + PKCE client
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  Depends on: oauth-config.js, oauth-strategies.js, oauth_start_workflow.js
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
    // options      — { scope, forceLogin, isCurrent?, extra: { title, permissions, ... } }
    async login(accountKey, providerType, instanceUrl, options = {}) {
        const source = captureOAuthIssuerSource(), callerCurrent = options.isCurrent;
        options = { ...options, extra: structuredClone(options.extra || {}) };
        const current = () => currentOAuthIssuerSource(source) && (!callerCurrent || callerCurrent());
        if (!current()) throw new Error('Authorization session expired.');
        const issuer = await fingerprintOAuthIssuer(source);
        if (!current()) throw new Error('Authorization session expired.');
        options = { ...options, isCurrent: current };
        return startOAuthAuthorization({ accountKey, providerType, instanceUrl, options }, {
            issuer, now: Date.now, provider: type => OAuthProviders[type], mode: () => OAuthStrategies.detectRuntimeMode(), origin: () => window.location.origin,
            register: (url, provider, redirect) => this._getOrRegisterClient(url, provider, redirect),
            pkce: () => this._generatePKCE(), random: () => this._randomState(), prefix: window.CList.keys.OAUTH_STATE_PREFIX,
            persist: (key, value) => sessionStorage.setItem(key, value), remove: key => sessionStorage.removeItem(key),
            navigate: url => { window.location.href = url; },
        });
    },

    // Process an OAuth callback URL.
    // Reads code + state from the current URL, validates state against sessionStorage,
    // exchanges the code for a token, and returns:
    //   { accountKey, providerType, instanceUrl, accessToken, tokenData, extra }
    // tokenData contains the full token response (including refresh_token when offline access was requested).
    // Returns null if the URL has no OAuth parameters (not a callback).
    async handleCallback() {
        return exchangeOAuthCallback(window.location.search, {
            prefix: window.CList.keys.OAUTH_STATE_PREFIX, now: Date.now,
            read: key => sessionStorage.getItem(key), remove: key => sessionStorage.removeItem(key),
            write: (key, value) => sessionStorage.setItem(key, value), provider: type => OAuthProviders[type],
            exchange: (code, config) => OAuthStrategies.exchangeCode(code, config),
        });
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

    // One shared pickup owns parsing, receipt validation, duplicate locks and failures.
    onCallback(providerType, onResult) {
        const controller = oauthCallbackController();
        controller.register(providerType, onResult);
        if (!this._pickupRegistered) {
            this._pickupRegistered = true;
            const pickup = () => { void controller.pickup(); };
            // Deferred scripts run at "interactive"; wait for every provider to register.
            if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', pickup, { once: true });
            else queueMicrotask(pickup);
        }
    },

    // Captured callback account persistence; token exchange/pickup stay above.
    saveAccount(providerLabel, accountKey, instanceData, options = {}) {
        return saveOAuthCallbackAccount(providerLabel, accountKey, instanceData, options);
    },
};
