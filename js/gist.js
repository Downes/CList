// gist.js — Publishes content to GitHub Gist
// Part of CList, the next generation of learning and connecting with your community

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['Gist'] = {
    type: 'Gist',
    instanceFromKey: true,
    kvKey: { label: 'Label', placeholder: 'My GitHub Gists' },
    fields: [
        { key: 'title',       label: 'Label',                editable: false, inputType: 'text',     placeholder: 'My GitHub Gists',           default: '' },
        { key: 'permissions', label: 'Permissions',          editable: true,  inputType: 'text',     placeholder: 'b',                         default: 'b' },
        { key: 'id',          label: 'Personal Access Token', editable: true, inputType: 'password', placeholder: 'GitHub PAT with gist scope', default: '' },
    ]
};

(function () {
    const API = 'https://api.github.com/gists';

    function mimeToExt(mimeType) {
        if (mimeType.includes('json'))       return 'json';
        if (mimeType.includes('opml'))       return 'opml';
        if (mimeType.includes('html'))       return 'html';
        if (mimeType.includes('xml'))        return 'xml';
        if (mimeType.includes('rss'))        return 'xml';
        return 'txt';
    }

    function makeFilename(title, mimeType) {
        const slug = slugify(title, { maxLength: 50, fallback: 'clist-export' });
        return `${slug}.${mimeToExt(mimeType)}`;
    }

    window.CList.binPublishers = window.CList.binPublishers || {};
    window.CList.binPublishers['Gist'] = {
        acceptedFormats: null, // any format

        async publish(content, mimeType, title, accountData) {
            const filename = makeFilename(title, mimeType);
            const resp = await fetch(API, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${accountData.id}`,
                    'Content-Type':  'application/json',
                    'Accept':        'application/vnd.github+json',
                },
                body: JSON.stringify({
                    description: title || 'CList export',
                    public: true,
                    files: { [filename]: { content } },
                }),
            });
            await assertOk(resp, 'Gist error');
            const data = await resp.json();
            // raw URL lets other tools consume the file directly
            const rawUrl = data.files?.[filename]?.raw_url;
            return { url: rawUrl || data.html_url, serviceId: data.id };
        },

        async update(serviceId, content, mimeType, accountData) {
            // fetch existing gist to discover the filename
            const getResp = await fetch(`${API}/${serviceId}`, {
                headers: {
                    'Authorization': `token ${accountData.id}`,
                    'Accept':        'application/vnd.github+json',
                },
            });
            if (!getResp.ok) throw new Error(`Gist fetch error ${getResp.status}`);
            const existing = await getResp.json();
            const filename = Object.keys(existing.files)[0];

            const resp = await fetch(`${API}/${serviceId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${accountData.id}`,
                    'Content-Type':  'application/json',
                    'Accept':        'application/vnd.github+json',
                },
                body: JSON.stringify({ files: { [filename]: { content } } }),
            });
            await assertOk(resp, 'Gist update error');
            const data = await resp.json();
            const rawUrl = data.files?.[filename]?.raw_url;
            return { url: rawUrl || data.html_url };
        },

        async delete(serviceId, accountData) {
            const resp = await fetch(`${API}/${serviceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${accountData.id}`,
                    'Accept':        'application/vnd.github+json',
                },
            });
            await assertOk(resp, 'Gist delete error');
        },
    };
})();
