//  webmention.js  —  WebMention sender for CList
//
//  WebMention (https://www.w3.org/TR/webmention/) notifies a source URL that
//  you have published something that references it. The receiving server can
//  display your post as a response or incoming link.
//
//  This feature is opt-in and disabled by default. Enable it in CList Options.
//  When enabled, sendWebMentions() is called by postAll() after a successful
//  publish, for every reference in the current reference list that has a URL.
//
//  Failures are logged to the console but never block or error the publish flow.
//

// Whether WebMentions are enabled. Persisted in localStorage.
let webmentionEnabled = false;
try { webmentionEnabled = localStorage.getItem(window.CList.keys.WEBMENTION_ENABLED) === 'true'; }
catch (error) { console.error('Could not read WebMention preference.', error); if (typeof showStatusMessage === 'function') showStatusMessage('Could not read WebMention preference. Check Options to retry.'); }

function setWebmentionEnabled(val) {
    const next = !!val;
    localStorage.setItem(window.CList.keys.WEBMENTION_ENABLED, next ? 'true' : 'false');
    webmentionEnabled = next;
}

function isWebmentionEnabled() {
    return webmentionEnabled;
}

// Discover the WebMention endpoint for a target URL by fetching its headers/body.
// Returns the endpoint URL string, or null if none found.
async function discoverWebmentionEndpoint(targetUrl) {
    try {
        const resp = await fetch(targetUrl, { method: 'GET', mode: 'cors' });
        // Check Link header first (most efficient)
        const linkHeader = resp.headers.get('Link') || '';
        const match = linkHeader.match(/<([^>]+)>\s*;\s*rel="webmention"/i)
                   || linkHeader.match(/<([^>]+)>\s*;\s*rel=webmention\b/i);
        if (match) return new URL(match[1], targetUrl).href;

        // Fall back to scanning <link> and <a> elements in the HTML body
        const html = await resp.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const el = doc.querySelector('link[rel~="webmention"], a[rel~="webmention"]');
        if (el) {
            const href = el.getAttribute('href');
            if (href) return new URL(href, targetUrl).href;
        }
    } catch (e) {
        console.error('[webmention] endpoint discovery failed for', targetUrl, e);
    }
    return null;
}

// Send a WebMention from sourceUrl to targetUrl via the discovered endpoint.
async function sendWebMention(sourceUrl, targetUrl) {
    const endpoint = await discoverWebmentionEndpoint(targetUrl);
    if (!endpoint) return; // target doesn't support WebMentions — silently skip

    try {
        const body = new URLSearchParams({ source: sourceUrl, target: targetUrl });
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        if (resp.ok) {
            console.log('[webmention] sent:', sourceUrl, '→', targetUrl);
        } else {
            console.warn('[webmention] server returned', resp.status, 'for', targetUrl);
        }
    } catch (e) {
        console.error('[webmention] send failed for', targetUrl, e);
    }
}

// Called by postAll() after a successful publish.
// sourceUrl — the URL of the just-published post.
// refs      — the current reference list from getReferences().
async function sendWebMentions(sourceUrl, refs) {
    if (!webmentionEnabled) return;
    if (!sourceUrl || !refs?.length) return;

    for (const ref of refs) {
        if (ref.url && ref.url.startsWith('http')) {
            sendWebMention(sourceUrl, ref.url).catch(e =>
                console.error('[webmention] unhandled error for', ref.url, e)
            );
        }
    }
}
