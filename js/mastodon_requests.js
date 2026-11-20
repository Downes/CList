// Explicit Mastodon transport and feed selection. No controls or active-account globals.
function mastodonRequestTarget(account, path) {
    const base = extractBaseUrl(account.instance);
    if (!base || !account.id) throw new Error('Select a Mastodon account with an instance and access token.');
    const url = new URL(path, base + '/');
    if (url.origin !== new URL(base).origin || !/^https?:$/.test(url.protocol)) throw new Error('Mastodon returned an invalid pagination destination.');
    return url.href;
}
async function requestMastodon(account, path, { signal, method = 'GET', fetcher = fetch } = {}) {
    let response;
    try { response = await fetcher(mastodonRequestTarget(account, path), {
        method, signal, headers: { Authorization: 'Bearer ' + account.id, 'Content-Type': 'application/json' },
    }); } catch (error) {
        if (method === 'GET') throw error;
        throw new Error('The Mastodon action could not be confirmed. Check its state before retrying. ' + (error?.message || String(error)));
    }
    if (!response.ok) throw new Error(`Mastodon request failed (HTTP ${response.status}).`);
    let data;
    try { data = await response.json(); } catch (error) {
        if (method === 'GET') throw error;
        throw new Error('Mastodon accepted the action, but its receipt could not be read. Check its state before retrying.');
    }
    const next = response.headers?.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
    if (next) mastodonRequestTarget(account, next);
    return { data, next };
}
async function readMastodonPage(account, selection, pageUrl = null, options = {}) {
    if (pageUrl) {
        const page = await requestMastodon(account, pageUrl, options);
        if (!Array.isArray(page.data)) throw new Error('Mastodon returned an invalid feed.');
        return { items: page.data, next: page.next };
    }
    const { kind, value } = selection;
    let path;
    if (kind === 'home') path = '/api/v1/timelines/home';
    else if (kind === 'local') path = '/api/v1/timelines/public?local=true';
    else if (kind === 'bookmarks') path = '/api/v1/bookmarks';
    else if (kind === 'notifications') path = '/api/v1/notifications';
    else if (kind === 'lists') path = '/api/v1/lists';
    else if (kind === 'list') {
        if (!value) throw new Error('Select a Mastodon list.');
        path = '/api/v1/timelines/list/' + encodeURIComponent(value);
    } else if (kind === 'hashtag') {
        if (!value?.trim()) throw new Error('Please enter a hashtag.');
        path = '/api/v1/timelines/tag/' + encodeURIComponent(value.replace(/^#/, '').trim());
    } else if (kind === 'user') {
        const name = String(value || '').trim().replace(/^@/, '');
        if (!name) throw new Error('Please enter a username.');
        const lookup = await requestMastodon(account, '/api/v1/accounts/lookup?acct=' + encodeURIComponent(name), options);
        if (!lookup.data?.id) throw new Error('Mastodon user not found.');
        path = '/api/v1/accounts/' + encodeURIComponent(lookup.data.id) + '/statuses';
    } else if (kind === 'thread') {
        if (!value) throw new Error('This status has no thread identifier.');
        const [thread, status] = await Promise.all([
            requestMastodon(account, '/api/v1/statuses/' + encodeURIComponent(value) + '/context', options),
            requestMastodon(account, '/api/v1/statuses/' + encodeURIComponent(value), options),
        ]);
        return { items: [...(thread.data.ancestors || []), status.data, ...(thread.data.descendants || [])], next: null };
    } else throw new Error('Unknown Mastodon feed.');
    const page = await requestMastodon(account, path, options);
    if (!Array.isArray(page.data)) throw new Error('Mastodon returned an invalid feed.');
    return { items: page.data, next: page.next };
}
async function toggleMastodonStatus(account, statusId, action, active, fetcher = fetch) {
    const names = { boost: ['reblog', 'unreblog'], favorite: ['favourite', 'unfavourite'], bookmark: ['bookmark', 'unbookmark'] };
    if (!names[action] || !statusId) throw new Error('This Mastodon action is unavailable.');
    const endpoint = names[action][active ? 1 : 0];
    // An uncertain response is not replayed. The controller retains its original state.
    const result = await requestMastodon(account, `/api/v1/statuses/${encodeURIComponent(statusId)}/${endpoint}`, { method: 'POST', fetcher });
    return { active: !active, status: result.data };
}
