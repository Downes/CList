//  wordpress.js  -  Publishes a post to a WordPress site using the REST API
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['WordPress'] = {
    type: 'WordPress',
    instanceFromKey: true,
    kvKey: { label: 'Username', placeholder: 'you@your-wordpress.site' },
    fields: [
        { key: 'title',       label: 'Blog Title',  editable: true, inputType: 'text',     placeholder: 'My Blog', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text',     placeholder: 'w',       default: 'w' },
        { key: 'id',          label: 'API Key',     editable: true, inputType: 'password', placeholder: '',        default: '' },
    ]
};

(function () {
    window.publishHandlers = window.publishHandlers || {};
    window.publishHandlers['WordPress'] = {
        publish: async (accountData, title, content) => {
            const plainTitle = removeHtml(title).trim()
                || content.replace(/<[^>]+>/g, '').trim().substring(0, 70).replace(/\s\S*$/, '') + '…';
            return await publishPost(
                extractBaseUrl(accountData.instance),
                extractAccountName(accountData.instance),
                accountData.id,
                plainTitle,
                content
            );
        }
    };
})();


async function publishPost(instance,username,password,title,content) {
    //const contentWindow = document.getElementById('content-window').innerHTML; // Get the content of the editable div
   // const title = "New Post from Content Window"; // You can change this dynamically if needed

    const url = instance+'/wp-json/wp/v2/posts'; // WordPress REST API endpoint for posts

    const postData = {
      title: title,
      content: content,
      status: 'publish' // This will publish the post immediately; use 'draft' if you want it saved as a draft
    };

    // Create the Basic Auth header
    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));
    headers.set('Content-Type', 'application/json');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const post = await response.json();
        const postURL = post.link; // Retrieve the URL of the published post
        console.log('Post published successfully at URL:', postURL);
        return postURL; // Return the URL
      } else {
        throw new Error('Error publishing Wordpress post: ' + response.statusText);
      }
    } catch (error) {
      console.error('Failed to publish Wordpress post:', error);
      showStatusMessage(`WordPress publish failed: ${error.message}`);
      return null; // Return null on failure
    }
  }

// ── WordPress Application Passwords OAuth ─────────────────────────────────────

// Redirect the top-level page to the WordPress authorization screen.
//
// HACK: WordPress enforces HTTPS on success_url, so http://localhost:PORT is
// rejected even though RFC 8252 allows plain-HTTP loopback for native apps.
// Workaround: in desktop-local mode we use the production callback URL and
// append local_port so callback.html can bounce the credentials back to the
// local launcher. If this pattern is ever needed for more OAuth providers,
// the right fix is to revert the launcher to HTTPS (mkcert) instead of
// extending this bounce approach.
function wpAuthStart(siteUrl) {
    const mode = OAuthStrategies.detectRuntimeMode();
    let callbackUrl;
    if (mode === 'desktop-local' && window._launcherConfig) {
        callbackUrl = 'https://clist.mooc.ca/callback.html?local_port=' + window._launcherConfig.port;
    } else {
        callbackUrl = window.location.origin + '/callback.html';
    }
    const appId = crypto.randomUUID ? crypto.randomUUID()
                                    : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const params = new URLSearchParams({
        app_name:    'CList',
        app_id:      appId,
        success_url: callbackUrl,
        reject_url:  callbackUrl,
    });
    window.location.href = siteUrl.replace(/\/$/, '') + '/wp-admin/authorize-application.php?' + params;
}

// On page load, check whether we're returning from a WordPress authorization.
// callback.html stores the result in localStorage; we pick it up here and save to kvstore.
document.addEventListener('DOMContentLoaded', async function () {
    const raw = localStorage.getItem('oauth_callback_result');
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (data.providerType !== 'WordPress') return;
    localStorage.removeItem('oauth_callback_result');
    await saveWordPressAccount(data.siteUrl, data.userLogin, data.password);
});

async function saveWordPressAccount(siteUrl, userLogin, password) {
    const token = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
    if (!token) { showStatusMessage('Please log in to kvstore before authorizing WordPress.'); return; }

    const encKey = await getEncKey(flaskSiteUrl);
    if (!encKey) { showStatusMessage('Encryption key missing — please log in again.'); return; }

    const host = new URL(siteUrl).host;
    const accountKey = `${userLogin}@${host}`;
    const instanceData = { type: 'WordPress', id: password, title: host, permissions: 'w' };

    let encryptedValue;
    try {
        encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
    } catch (err) {
        console.error('Failed to encrypt WordPress account data:', err);
        showStatusMessage('Could not save WordPress account — encryption failed. Try logging in again.');
        return;
    }

    const existing = Array.isArray(accounts) && accounts.find(a => a.key === accountKey);
    const endpoint = existing ? 'update_kv/' : 'add_kv/';

    const response = await fetch(`${flaskSiteUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ key: accountKey, value: encryptedValue }),
    });

    if (!response.ok) { showStatusMessage('Failed to save WordPress account to kvstore.'); return; }

    try {
        accounts = await getAccounts(flaskSiteUrl);
        if (accounts) {
            updateUIVisibility();
            populatePostOptions(accounts);
        }
        showStatusMessage('WordPress account authorized and saved.');
    } catch (error) {
        showStatusMessage('Account saved — but could not refresh. Try reloading: ' + error.message);
    }
    playAccounts();
}
