//  wordpress.js  -  Publishes a post to a WordPress site using the REST API
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
window.CList.schemas['WordPress'] = {
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
    window.CList.publishers = window.CList.publishers || {};
    window.CList.publishers['WordPress'] = {
        acceptedFormats: ['html', 'md', 'text'],
        publish: async (accountData, title, content) => {
            const plainTitle = derivePlainTitle(title, content);
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


async function _wordpressThrowApiError(response, context, suffix = '') {
    const raw = await response.text();
    const plain = text => new DOMParser().parseFromString(text,'text/html').body.textContent.replace(/\s+/g,' ').trim().slice(0,1600);
    let detail = plain(raw);
    if (raw.trim().startsWith('{')) {
        try {
            const error = JSON.parse(raw);
            detail = [error.code,error.message].filter(value=>typeof value==='string' && value).map(plain).join(': ') || detail;
        } catch (error) {
            throw new Error(context+' (HTTP '+response.status+'): '+(detail || 'The server returned unreadable error details.')+suffix);
        }
    }
    throw new Error(context+' (HTTP '+response.status+'): '+(detail || 'WordPress returned no error details.')+suffix);
}

async function _wordpressUploadEmbeddedImages(instance, authorization, content) {
    const page = new DOMParser().parseFromString(content,'text/html');
    const images = [...page.querySelectorAll('img')].filter(image=>(image.getAttribute('src') || '').startsWith('data:'));
    if (!images.length) return content;
    const uploads = new Map();
    const total = new Set(images.map(image => image.getAttribute('src'))).size;
    // Validate all embedded formats before beginning uploads.
    for (const image of images) {
        if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(image.getAttribute('src'))) throw new Error('An embedded image is not a supported PNG, JPEG, GIF or WebP image.');
    }
    for (const image of images) {
        const source = image.getAttribute('src');
        if (!uploads.has(source)) {
            const match = source.match(/^data:(image\/(png|jpeg|gif|webp));base64,([\s\S]+)$/i);
            const binary = atob(match[3]), bytes = new Uint8Array(binary.length);
            for (let index=0;index<binary.length;index++) bytes[index]=binary.charCodeAt(index);
            const form = new FormData();
            const filename = 'clist-image-'+(uploads.size+1)+'.'+(match[2].toLowerCase()==='jpeg'?'jpg':match[2].toLowerCase());
            form.append('file',new Blob([bytes],{type:match[1].toLowerCase()}),filename);
            if (image.alt) form.append('alt_text',image.alt);
            if (typeof updatePostProgress === 'function') updatePostProgress('WordPress: uploading image '+(uploads.size+1)+' of '+total+'…');
            const response = await _wordpressRequest(instance.replace(/\/$/,'')+'/wp-json/wp/v2/media',{method:'POST',headers:{Authorization:authorization},body:form});
            if (!response.ok) await _wordpressThrowApiError(response,'Image upload failed for '+filename,'. The post was not sent.');
            const media = await response.json();
            if (typeof media.source_url !== 'string' || !/^https?:\/\//i.test(media.source_url)) throw new Error('WordPress did not return a valid URL for an uploaded image.');
            uploads.set(source,media.source_url);
        }
        image.setAttribute('src',uploads.get(source));
    }
    return page.body.innerHTML;
}

async function _wordpressRequest(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        // Read the body under the same timeout, including a stalled server response.
        const body = await response.text();
        return { ok: response.ok, status: response.status, text: async () => body, json: async () => JSON.parse(body) };
    } catch (error) {
        if (controller.signal.aborted) throw new Error('WordPress did not finish responding within two minutes. Check WordPress posts and media before retrying; the last request may have been accepted.');
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function publishPost(instance,username,password,title,content) {
    //const contentWindow = document.getElementById('content-window').innerHTML; // Get the content of the editable div
   // const title = "New Post from Content Window"; // You can change this dynamically if needed

    const url = instance+'/wp-json/wp/v2/posts'; // WordPress REST API endpoint for posts

    // Create the Basic Auth header
    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + btoa(username + ':' + password));
    headers.set('Content-Type', 'application/json');

    try {
      const preparedContent = await _wordpressUploadEmbeddedImages(instance,headers.get('Authorization'),content);
      const postData = { title, content:preparedContent, status:'publish' };
      if (typeof updatePostProgress === 'function') updatePostProgress('WordPress: images uploaded; creating the article…');
      const response = await _wordpressRequest(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(postData)
      });

      if (response.ok) {
        const post = await response.json();
        const postURL = post.link; // Retrieve the URL of the published post
        if (typeof postURL !== 'string' || !/^https?:\/\//i.test(postURL)) {
          throw new Error('WordPress accepted the post request but returned no valid post link'+(post.id ? ' (post ID '+post.id+')' : '')+'. Check WordPress Posts before retrying.');
        }
        console.log('Post published successfully at URL:', postURL);
        return postURL; // Return the URL
      } else {
        await _wordpressThrowApiError(response,'WordPress post request failed');
      }
    } catch (error) {
      console.error('Failed to publish Wordpress post:', error);
      showErrorModal(`WordPress publish failed: ${error.message}`, { title: 'WordPress Publish Failed' });
      return null; // Return null on failure
    }
  }

// ── WordPress Application Passwords OAuth ─────────────────────────────────────

// Redirect the top-level page to the WordPress authorization screen.
//
// WordPress enforces HTTPS on success_url. When running locally over HTTPS
// (mkcert, Windows/macOS) we can use window.location.origin directly.
// On Linux we fall back to plain HTTP; in that case we bounce through the
// production callback URL so WordPress accepts it (HACK — see comment below).
function wpAuthStart(siteUrl) {
    const mode = OAuthStrategies.detectRuntimeMode();
    let callbackUrl;
    if (mode === 'desktop-local' && window.location.protocol === 'http:' && window._launcherConfig) {
        // HACK: http://localhost is rejected by WordPress. Use the production
        // callback URL with local_port so it can bounce credentials back here.
        // Only needed on Linux where mkcert is not bundled. On Windows/macOS
        // the launcher serves HTTPS and the branch above handles it cleanly.
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
// callback.html stores the result in localStorage; OAuthClient.onCallback picks it up and
// saves to kvstore via OAuthClient.saveAccount. (WordPress's own callback flow doesn't go
// through OAuthClient.login() — its result shape is siteUrl/userLogin/password rather than
// accessToken/extra — but it's stored under the same shared key, so onCallback still applies.)
OAuthClient.onCallback('WordPress', async data => {
    const host = new URL(data.siteUrl).host;
    const accountKey = `${data.userLogin}@${host}`;
    const instanceData = { type: 'WordPress', id: data.password, title: host, permissions: 'w' };
    await OAuthClient.saveAccount('WordPress', accountKey, instanceData, {
        afterRefresh: () => populatePostOptions(window.CList.accounts),
    });
});
