// https://www.reddit.com/prefs/apps

// Reddit OAuth2 Connection Script in JavaScript

// Reddit OAuth2 Connection Script in JavaScript

// Step 1: Set up your credentials
const CLIENT_ID = 'oH0xp_-mgjuqE0bmwwviCg';
const REDIRECT_URI = 'https://www.downes.ca/CList/redirect.html';
const SCOPES = 'identity read';

// Step 2: Generate the authorization URL
const AUTHORIZATION_BASE_URL = 'https://www.reddit.com/api/v1/authorize';

function getAuthorizationUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    state: 'Reddit', // A random string to prevent CSRF attacks
    redirect_uri: REDIRECT_URI,
    duration: 'temporary',
    scope: SCOPES
  });

  return `${AUTHORIZATION_BASE_URL}?${params.toString()}`;
}

// Step 3: Redirect the user for authorization
function authorizeUser() {
  const authorizationUrl = getAuthorizationUrl();
  window.open(authorizationUrl, '_blank', 'width=800,height=600');
}

// Step 4: Handle the redirect and extract the access token
function handleRedirect() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  if (params.has('access_token')) {
    const accessToken = params.get('access_token');
    console.log('Access Token:', accessToken);
    // You can now use this access token to make API requests
  } else {
    console.error('No access token found in the URL');
  }
}

// Example usage
if (window.location.pathname.includes('redirect.html')) {
  // Step 4: Handle the redirect to extract the access token
  // https://www.downes.ca/CList/redirect.html?state=random_string&code=GSfhw_eeZU5f3DyI2p7sSGjtWKSqgg#_
  handleRedirect();
} else {
  console.log('Click a button to authorize with Reddit');
}

