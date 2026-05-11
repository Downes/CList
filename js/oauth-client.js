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
            : { clientId: provider.clientId, clientSecret: null, redirectUri };

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

        window.location.href = instanceUrl + provider.authorizationPath + '?' + authParams.toString();
    },

    // Process an OAuth callback URL.
    // Reads code + state from the current URL, validates state against sessionStorage,
    // exchanges the code for a token, and returns:
    //   { accountKey, providerType, instanceUrl, accessToken, extra }
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

        const accessToken = await OAuthStrategies.exchangeCode(code, {
            instanceUrl:  flow.instanceUrl,
            tokenPath:    provider.tokenPath,
            clientId:     flow.clientId,
            clientSecret: flow.clientSecret,
            redirectUri:  flow.redirectUri,
            codeVerifier: flow.codeVerifier,
            mode:         flow.mode,
        });

        return {
            accountKey:   flow.accountKey,
            providerType: flow.providerType,
            instanceUrl:  flow.instanceUrl,
            accessToken,
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
        const codeVerifier = btoa(String.fromCharCode(...verifierBytes))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

        return { codeVerifier, codeChallenge };
    },

    _randomState() {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    },
};
