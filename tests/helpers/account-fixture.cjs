const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = name => fs.readFileSync(path.join(__dirname, '../../js', name), 'utf8');

// Small DOM fixture for account navigation and forms, not a rendering engine.
class Element {
    constructor(tagName = 'div') {
        this.tagName = tagName; this.children = []; this.parentNode = null;
        this.style = {}; this.dataset = {}; this.listeners = {}; this.value = '';
        this.disabled = false; this.isConnected = true;
    }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
    insertBefore(child, reference) {
        child.remove(); child.parentNode = this;
        const index = this.children.indexOf(reference);
        if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    }
    get nextSibling() {
        return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] || null;
    }
    set textContent(text) { this.text = String(text); this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    set innerHTML(html) {
        this.children.forEach(child => { child.parentNode = null; });
        this.children = []; this.text = ''; const stack = [this];
        for (const match of html.matchAll(/<\/?([\w-]+)\b([^>]*)>|([^<]+)/g)) {
            if (!match[1]) { stack.at(-1).text = (stack.at(-1).text || '') + match[3]; continue; }
            if (match[0].startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
            const node = new Element(match[1]);
            for (const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
                const [, key, value] = attribute;
                if (key === 'class') node.className = value;
                else if (key === 'style') value.split(';').forEach(part => {
                    const [name, content] = part.split(':'); if (name) node.style[name.trim()] = content?.trim();
                });
                else if (key.startsWith('data-')) node.dataset[key.slice(5)] = value;
                else node[key] = value;
            }
            stack.at(-1).appendChild(node);
            if (!['input', 'br', 'hr', 'img'].includes(node.tagName)) stack.push(node);
        }
    }
    querySelectorAll(selector) {
        const selectors = selector.split(','); const found = [];
        const matches = node => selectors.some(selector => selector.startsWith('#')
            ? node.id === selector.slice(1) : selector.startsWith('.')
                ? (node.className || '').split(' ').includes(selector.slice(1)) : node.tagName === selector);
        function visit(node) { for (const child of node.children) { if (matches(child)) found.push(child); visit(child); } }
        visit(this); return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    setAttribute(key, value) { this[key] = value; }
    getAttribute(key) { return this[key]; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    dispatch(name) { this.listeners[name]?.(); this.parentNode?.dispatch(name); }
    click() { return this.disabled ? undefined : this.onclick?.({ preventDefault() {} }); }
    focus() {}
    scrollIntoView() {}
}

function fixture({ panel = false } = {}) {
    const records = new Map(), writes = [], errors = [], messages = [], refreshErrors = [], history = [];
    let failList = false, failWrite = false;
    const cList = {
        config: { flaskSiteUrl: 'https://kv.test' }, keys: { ACCESS_TOKEN: 'access_token', USERNAME: 'username' },
        state: { username: 'stephen' }, schemas: {}, accountHooks: {}, accounts: [],
        storage: { kv: {
            list: async () => { if (failList) throw Error('refresh offline'); return [...records].map(([key, value]) => ({ key, value })); },
            put: async (key, value) => { if (failWrite) throw Error('write offline'); writes.push(['put', key]); records.set(key, value); },
            remove: async key => { if (failWrite) throw Error('delete offline'); writes.push(['remove', key]); records.delete(key); },
        } },
    };
    const sandbox = {
        window: { CList: cList }, console: { error() {}, log() {}, warn() {} }, structuredClone,
        getSiteSpecificCookie: () => 'token', getEncKey: async () => 'key',
        encryptWithKey: async (key, data) => 'encrypted:' + data,
        decryptWithKey: async (key, data) => { if (!data.startsWith('encrypted:')) throw Error('bad ciphertext'); return data.slice(10); },
        parseAccountValue: record => { try { return JSON.parse(record.value); } catch { return null; } },
        fetch: async () => { throw Error('unexpected network request'); },
    };
    if (panel) Object.assign(sandbox, {
        document: { createElement: tag => new Element(tag) },
        history: { pushState: value => history.push(value) }, confirm: () => true,
        showErrorModal: (message, options) => errors.push({ message, ...options }),
        showStatusMessage: message => messages.push(message),
        showServiceError: (container, title, message) => {
            refreshErrors.push({ title, message }); const node = new Element(); node.textContent = message; container.appendChild(node);
        },
        populatePostOptions() {}, populateReadAccountList() {}, updateUIVisibility() {},
    });
    const ctx = vm.createContext(sandbox);
    const load = name => vm.runInContext(source(name), ctx, { filename: name });
    load('account-state.js');
    if (panel) { load('account-form.js'); load('account-panel.js'); }
    const session = { storeUrl: cList.config.flaskSiteUrl, token: 'token', encKey: 'key' };
    const add = (key, data) => records.set(key, 'encrypted:' + JSON.stringify(data));
    const flush = () => new Promise(resolve => setImmediate(resolve));
    const schema = type => cList.schemas[type] = {
        type, instanceFromKey: true, kvKey: { label: 'Account' },
        fields: [{ key: 'title', label: 'Title', editable: true },
            { key: 'id', label: 'Token', inputType: 'oauth', editable: false },
            { key: 'permissions', label: 'Permissions', editable: true, default: 'rw' }],
    };
    return { ctx, cList, records, writes, errors, messages, refreshErrors, history, session, add, load, flush, schema,
        failList: value => { failList = value; }, failWrite: value => { failWrite = value; } };
}

module.exports = { fixture, Element, source };
