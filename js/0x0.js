// 0x0.js — Publishes content to 0x0.st (anonymous, no update/delete)
// Part of CList, the next generation of learning and connecting with your community

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['0x0'] = {
    type: '0x0',
    instanceFromKey: true,
    kvKey: { label: 'Label', placeholder: 'My 0x0' },
    fields: [
        { key: 'title',       label: 'Label',       editable: false, inputType: 'text', placeholder: 'My 0x0', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true,  inputType: 'text', placeholder: 'b',      default: 'b' },
    ]
};

(function () {
    window.CList.binPublishers = window.CList.binPublishers || {};
    window.CList.binPublishers['0x0'] = {
        acceptedFormats: null, // any format

        async publish(content, mimeType, title, _accountData) {
            const blob = new Blob([content], { type: mimeType });
            const form = new FormData();
            form.append('file', blob, (title || 'clist-export').replace(/\s+/g, '-'));

            const resp = await fetch('https://0x0.st', { method: 'POST', body: form });
            await assertOk(resp, '0x0.st error');
            const url = (await resp.text()).trim();
            return { url, serviceId: url };
        },

        async update(_serviceId, _content, _mimeType, _accountData) {
            throw new Error('0x0.st does not support updating existing uploads.');
        },

        async delete(_serviceId, _accountData) {
            throw new Error('0x0.st does not support deleting uploads.');
        },
    };
})();
