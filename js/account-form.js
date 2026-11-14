/// <reference path="./clist-types.js" />
// Schema-based account form view. Persistence belongs to account-state.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

/**
 * @param {HTMLElement} root
 * @param {CListAccountFormCallbacks} callbacks
 * @returns {CListAccountForm}
 */
function createAccountForm(root, callbacks) {
    let schema = null;
    let baseData = {};
    let dirty = false;
    const fields = root.querySelector('#form-fields');
    const control = key => root.querySelector('#' + key + 'Input');

    function read(validate = true) {
        if (!schema) throw new Error('No account type selected.');
        const key = (control('_key')?.value || '').trim();
        const data = { ...structuredClone(baseData), type: schema.type };
        if (schema.instanceFromKey) data.instance = key;
        for (const field of schema.fields) data[field.key] = control(field.key)?.value ?? field.default ?? '';
        const publicControl = root.querySelector('#publicCheckbox');
        if (publicControl) data.public = publicControl.checked;
        if (validate && !key) throw new Error('Please enter a value for "' + schema.kvKey.label + '".');
        if (validate && !data.title) throw new Error('Please enter a Title.');
        return { key, data };
    }

    function makeFieldRow(field, mode, value) {
        const input = document.createElement('input');
        input.id = field.key + 'Input';
        input.value = value || '';
        if (field.inputType === 'hidden') { input.type = 'hidden'; return input; }
        const row = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = field.label;
        row.appendChild(label);
        const editable = mode === 'create' || field.editable;
        if (field.inputType === 'oauth' || !editable) {
            const display = document.createElement('div');
            display.className = 'field-display';
            display.textContent = field.inputType === 'oauth'
                ? (value ? '(token stored)' : '(no token)') : (value || '');
            row.appendChild(display);
            input.type = 'hidden';
            row.appendChild(input);
            if (field.inputType === 'oauth' && mode === 'edit') {
                const reauthorize = window.CList.accountHooks?.[schema.type]?.reauthorize;
                if (reauthorize) {
                    const button = document.createElement('button');
                    button.type = 'button'; button.className = 'btn btn-small';
                    button.textContent = 'Re-authorize';
                    button.onclick = async () => {
                        try { await reauthorize(read(false)); }
                        catch (error) { showErrorModal(error.message, { title: 'Account authorization failed' }); }
                    };
                    row.appendChild(button);
                }
                const manual = document.createElement('button');
                manual.type = 'button'; manual.className = 'btn btn-small';
                manual.textContent = 'Enter manually';
                manual.onclick = () => {
                    display.style.display = 'none'; manual.style.display = 'none';
                    input.type = 'password'; input.placeholder = 'Paste access token';
                    input.focus();
                };
                row.appendChild(manual);
            }
        } else {
            input.type = field.inputType === 'password' ? 'password' : 'text';
            input.placeholder = field.placeholder || '';
            row.appendChild(input);
        }
        return row;
    }

    function build(nextSchema, mode, data) {
        schema = nextSchema;
        baseData = structuredClone(data);
        delete baseData._key;
        fields.innerHTML = '';
        fields.appendChild(makeFieldRow({ ...schema.kvKey, key: '_key', inputType: 'text', editable: false }, mode, data._key || ''));
        for (const field of schema.fields) {
            fields.appendChild(makeFieldRow(field, mode, data[field.key] ?? field.default ?? ''));
        }
        const publicCapable = new Set(['Mastodon', 'Bluesky', 'WordPress', 'Blogger', 'Annotate', 'Hypothesis']);
        if (publicCapable.has(schema.type)) {
            const row = document.createElement('div'); row.className = 'public-toggle';
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox';
            checkbox.id = 'publicCheckbox'; checkbox.checked = data.public || false;
            const label = document.createElement('label'); label.htmlFor = checkbox.id;
            label.textContent = 'Make public (include in your DID document)';
            row.append(checkbox, label); fields.appendChild(row);
        }
        window.CList.accountHooks?.[schema.type]?.decorateForm?.({
            root, container: fields, mode, key: data._key || '', data: structuredClone(baseData),
            isDirty: () => dirty, close: callbacks.close,
            getAccountFlow: callbacks.getAccountFlow,
            updateAccount: updated => {
                baseData = structuredClone(updated);
                callbacks.updateAccount(data._key, updated);
            },
        });
        dirty = false;
    }

    const markDirty = () => { dirty = true; };
    root.querySelector('#addKvForm').addEventListener('input', markDirty);
    root.querySelector('#addKvForm').addEventListener('change', markDirty);
    return { build, read, isDirty: () => dirty, setDirty: value => { dirty = value; } };
}
