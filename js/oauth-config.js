//  oauth-config.js  -  OAuth provider configuration for CList
//  Part of CList, the next generation of learning and connecting with your community
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/

// Each provider entry describes how to perform an OAuth 2.0 authorization code flow.
//
// dynamicRegistration: true  — provider requires per-instance app registration (Mastodon)
//   registrationEndpoint: path to POST to register a new app; response must include client_id
// dynamicRegistration: false — static client_id set in clientId field (GitHub, Google, etc.)
//
// authorizationPath, tokenPath: paths appended to instanceUrl (or a fixed baseUrl for non-instance providers)
// scopes: default scope string passed to the authorization request

window.OAuthProviders = window.OAuthProviders || {};

window.OAuthProviders['Mastodon'] = {
    name:                 'Mastodon',
    dynamicRegistration:  true,
    registrationEndpoint: '/api/v1/apps',
    authorizationPath:    '/oauth/authorize',
    tokenPath:            '/oauth/token',
    scopes:               'read write',
    requiresInstanceUrl:  true,
};
