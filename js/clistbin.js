// clistbin.js — Publishes content to a CListBin instance (pastebin.mooc.ca or self-hosted)
// Part of CList, the next generation of learning and connecting with your community

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['CListBin'] = {
    type: 'CListBin',
    instanceFromKey: true,
    kvKey: { label: 'Instance URL', placeholder: 'https://pastebin.mooc.ca' },
    fields: [
        { key: 'title',       label: 'Label',       editable: true, inputType: 'text', placeholder: 'My CListBin', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'b',           default: 'b' },
    ]
};

(function () {
    function _token() {
        return getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN) || '';
    }

    window.CList.binPublishers = window.CList.binPublishers || {};
    window.CList.binPublishers['CListBin'] = {
        acceptedFormats: null, // any format

        async publish(content, mimeType, title, accountData) {
            const base = (accountData.instance || '').replace(/\/$/, '');
            const resp = await fetch(`${base}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${_token()}`,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify({ content, mime_type: mimeType, title }),
            });
            await assertOk(resp, 'CListBin error');
            const data = await resp.json();
            return { url: data.url, serviceId: data.id };
        },

        async update(serviceId, content, mimeType, accountData) {
            const base = (accountData.instance || '').replace(/\/$/, '');
            const resp = await fetch(`${base}/${serviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${_token()}`,
                    'Content-Type':  'application/json',
                },
                body: JSON.stringify({ content, mime_type: mimeType }),
            });
            await assertOk(resp, 'CListBin update error');
            const data = await resp.json();
            return { url: data.url };
        },

        async delete(serviceId, accountData) {
            const base = (accountData.instance || '').replace(/\/$/, '');
            const resp = await fetch(`${base}/${serviceId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${_token()}` },
            });
            await assertOk(resp, 'CListBin delete error');
        },
    };
})();
