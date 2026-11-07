// jsonbin.js — Publishes content to JSONBin.io
// Part of CList, the next generation of learning and connecting with your community

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['JSONBin'] = {
    type: 'JSONBin',
    instanceFromKey: true,
    kvKey: { label: 'Label', placeholder: 'My JSONBin' },
    fields: [
        { key: 'title',       label: 'Label',       editable: false, inputType: 'text',     placeholder: 'My JSONBin',               default: '' },
        { key: 'permissions', label: 'Permissions', editable: true,  inputType: 'text',     placeholder: 'b',                        default: 'b' },
        { key: 'id',          label: 'API Key',     editable: true,  inputType: 'password', placeholder: 'X-Master-Key from JSONBin', default: '' },
    ]
};

(function () {
    const API = 'https://api.jsonbin.io/v3/b';

    window.CList.binPublishers = window.CList.binPublishers || {};
    window.CList.binPublishers['JSONBin'] = {
        acceptedFormats: ['json'],

        async publish(content, mimeType, title, accountData) {
            const resp = await fetch(API, {
                method: 'POST',
                headers: {
                    'Content-Type':  mimeType,
                    'X-Master-Key':  accountData.id,
                    'X-Bin-Name':    title || 'CList export',
                    'X-Bin-Private': 'false',
                },
                body: content,
            });
            await assertOk(resp, 'JSONBin error');
            const data = await resp.json();
            const id = data.metadata?.id;
            if (!id) throw new Error('JSONBin returned no bin ID');
            return { url: `${API}/${id}?meta=false`, serviceId: id };
        },

        async update(serviceId, content, mimeType, accountData) {
            const resp = await fetch(`${API}/${serviceId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': mimeType,
                    'X-Master-Key': accountData.id,
                },
                body: content,
            });
            await assertOk(resp, 'JSONBin update error');
            return { url: `${API}/${serviceId}?meta=false` };
        },

        async delete(serviceId, accountData) {
            const resp = await fetch(`${API}/${serviceId}`, {
                method: 'DELETE',
                headers: { 'X-Master-Key': accountData.id },
            });
            await assertOk(resp, 'JSONBin delete error');
        },
    };
})();
