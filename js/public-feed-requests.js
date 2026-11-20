// Public collection/changelog transport. No controls or live global account reads.
async function requestPublicFeedItems(request, deps) {
    if (request.database) {
        const response = await deps.fetch(`${request.accountBase}/api/items?${new URLSearchParams({ db: request.database, filter: 'all', limit: 200 })}`,
            { headers: request.headers, signal: request.signal });
        if (!response.ok) throw new Error(`LocalRSS returned HTTP ${response.status}`);
        let items = await response.json();
        if (!Array.isArray(items)) throw new Error('Unexpected feed response');
        if (request.slug === 'clist-changelog') items = items.map(item => ({ ...item, author: 'Stephen Downes' })).sort((a,b) => b.published-a.published);
        return { items, errors: [] };
    }
    if (request.slug !== 'clist-changelog') {
        const response = await deps.fetch(`${request.serviceUrl.replace(/\/$/, '')}/api/collections/${encodeURIComponent(request.slug)}/items?limit=200`,
            { signal: request.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const items = await response.json();
        if (!Array.isArray(items)) throw new Error('Unexpected feed response');
        return { items, errors: [] };
    }
    const results = await Promise.allSettled(request.feeds.map(async feed => {
        const response = await deps.fetch(`https://api.github.com/repos/Downes/${feed.repo}/commits`, { signal: request.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json(); if (!Array.isArray(data)) throw new Error('Unexpected feed response');
        return data.map(entry => {
            const message = entry.commit?.message || '';
            return { id: `${feed.repo}:${entry.sha}`, link: entry.html_url, title: message.split(/\r?\n/)[0],
                content_html: deps.escape(message).replace(/\r?\n/g,'<br>'), feed_title: feed.title, author: feed.author_name,
                published: Date.parse(entry.commit?.author?.date)/1000 || 0 };
        });
    }));
    const items = [], errors = [];
    results.forEach((result,index) => {
        if (result.status === 'fulfilled') items.push(...result.value);
        else errors.push({ title: request.feeds[index].title, error: result.reason });
    });
    return { items: items.sort((a,b)=>b.published-a.published), errors };
}
