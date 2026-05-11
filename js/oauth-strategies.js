//  oauth-strategies.js  -  Runtime mode detection and token exchange strategies
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/

// Three runtime modes:
//   hosted-web    — served from https://clist.mooc.ca; exchange tokens directly from the browser
//   desktop-local — served by the Python launcher on 127.0.0.1; exchange via the launcher's /oauth/token broker
//   file          — opened from a file:// URL; OAuth requires a redirect URI and cannot work here

const OAuthStrategies = {

    detectRuntimeMode() {
        if (window.location.protocol === 'file:') return 'file';
        const host = window.location.hostname;
        if (host === '127.0.0.1' || host === 'localhost') return 'desktop-local';
        return 'hosted-web';
    },

    async exchangeCode(code, { instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier, mode }) {
        if (mode === 'desktop-local') {
            return this._exchangeViaBroker(code, { instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier });
        }
        return this._exchangeDirect(code, { instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier });
    },

    async _exchangeDirect(code, { instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier }) {
        const params = {
            grant_type:   'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id:    clientId,
        };
        if (clientSecret)  params.client_secret  = clientSecret;
        if (codeVerifier)  params.code_verifier  = codeVerifier;

        const response = await fetch(`${instanceUrl}${tokenPath}`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body:    new URLSearchParams(params),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Token exchange failed (${response.status}): ${errText}`);
        }
        const data = await response.json();
        if (!data.access_token) throw new Error('No access_token in token response');
        return data.access_token;
    },

    // The desktop launcher exposes POST /oauth/token which proxies the exchange,
    // avoiding CORS restrictions on Mastodon instances.
    async _exchangeViaBroker(code, { instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier }) {
        const brokerUrl = window.location.origin + '/oauth/token';
        const response = await fetch(brokerUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ code, instanceUrl, tokenPath, clientId, clientSecret, redirectUri, codeVerifier }),
        });
        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            throw new Error(`Token broker failed (${response.status}): ${errText}`);
        }
        const data = await response.json();
        if (!data.access_token) throw new Error('No access_token from broker');
        return data.access_token;
    },
};
