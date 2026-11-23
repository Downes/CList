function popupGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
let previousPopupFixture = null;
function popupFixture() {
    previousPopupFixture?.dispose();
    const root = document.createElement('div'); document.body.appendChild(root);
    const add = (tag, id) => { const node = document.createElement(tag); node.id = id; root.appendChild(node); return node; };
    add('h1', 'chat-title'); add('div', 'no-connection'); const messages = add('div', 'chat-messages');
    const input = add('input', 'messageInput'), send = add('button', 'sendButton'); add('button', 'startDocButton');
    const channels = [], queue = [], timers = [], errors = [], states = [], sent = [], docs = [], windows = [], behavior = {};
    let current = true, sequence = 0, client = null, unload = null, discussion = 'Original';
    class Channel {
        constructor(name) { this.name = name; this.closed = false; this.onmessage = null; this.packets = []; channels.push(this); }
        postMessage(packet) {
            if (this.closed || behavior.postFail) throw Error('synthetic channel failure');
            this.packets.push(structuredClone(packet));
            for (const other of channels) if (other !== this && !other.closed && other.name === this.name) queue.push(() => other.onmessage?.({ data: structuredClone(packet) }));
        }
        close() { this.closed = true; }
    }
    const main = createP2pPopupController({ current: () => current, id: () => 'owner-' + ++sequence, channel: name => new Channel(name),
        open(url, name) { if (behavior.blocked) return null; const value = { url, name, closed: false, focused: 0, focus() { value.focused++; } }; windows.push(value); return value; },
        schedule: callback => timers.push(callback), discussion: () => discussion,
        state: state => states.push(structuredClone(state)), error: error => errors.push(error.message), closed() {},
        async send(text, valid) { if (behavior.send) await behavior.send(); if (valid()) sent.push(text); },
        async collaborate(valid) { if (behavior.collab) await behavior.collab(); if (valid()) docs.push('requested'); }
    });
    const flush = async () => { for (let i = 0; i < 20; i++) { while (queue.length) await queue.shift()(); await Promise.resolve(); } };
    const createClient = name => {
        client = createP2pPopupClient({ id: () => 'client-' + ++sequence, channel: value => new Channel(value),
            onUnload: callback => { unload = callback; return () => { unload = null; }; }
        }, createP2pPopupView());
        client.start(name || decodeURIComponent(windows.at(-1).url.split('#')[1])); return client;
    };
    const click = async node => { if (node.dispatchEvent) node.dispatchEvent(new MouseEvent('click')); else node.listeners.click?.(); await flush(); };
    const f = { root, input, send, messages, channels, queue, timers, errors, states, sent, docs, windows, behavior, main, createClient, flush, click,
        client: () => client, status: () => root.querySelector('#no-connection'),
        expired: () => { current = false; }, discussion: value => { discussion = value; },
        unload: () => unload?.(),
        installBridge() {
            main.dispose(); activeDiscussionName = 'Bridge';
            Object.assign(globalThis, { ensureP2pSession: () => ({ isCurrent: () => current, resources: { peer: { id: 'bridge-peer' } } }),
                BroadcastChannel: Channel, setTimeout: callback => timers.push(callback), showStatusMessage: message => errors.push(message),
                sendMessage: async (text, valid) => { if (behavior.send) await behavior.send(); if (valid()) sent.push(text); }, startCollabFromChat: () => docs.push('requested') });
            window.open = (url, name) => { const value = { url, name, closed: false, focus() {} }; windows.push(value); return value; };
        },
        dispose() { client?.dispose(); main.dispose(); if (typeof _p2pPopup !== 'undefined') _p2pPopup?.dispose(); root.remove(); }
    };
    previousPopupFixture = f; return f;
}
const p2pPopupCases = [
    ['isolated popup handshake, focus reuse and safe summaries', async check => {
        const f = popupFixture(); f.main.open(); f.main.open(); check(f.windows.length === 1 && f.windows[0].focused === 1, 'reopen focuses the existing window');
        check(f.windows[0].url.includes('#clist-chat-owner-') && !f.windows[0].url.includes('Original'), 'URL contains opaque channel only');
        f.createClient(); await f.flush(); check(!f.send.disabled && document.title === 'CList Chat — Original', 'ready handshake enables controls/title');
        check(f.states.at(-1).phase === 'ready' && !JSON.stringify(f.states).includes('owner-'), 'safe state has no channel metadata');
    }],
    ['Send acknowledgements preserve newer drafts and duplicate requests dispatch once', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush(); const gate = popupGate(); f.behavior.send = () => gate.promise;
        f.input.value = 'captured'; await f.click(f.send); const command = f.channels[1].packets.find(packet => packet.type === 'send-msg');
        f.channels[1].postMessage(command); await f.flush(); check(f.states.at(-1).pending === 1 && f.send.disabled, 'pending request and duplicate are locked');
        f.input.value = 'newer draft'; gate.resolve(); await f.flush();
        check(f.sent.length === 1 && f.sent[0] === 'captured' && f.input.value === 'newer draft' && !f.send.disabled, 'one dispatch and newer draft retained');
        f.channels[1].postMessage(command); await f.flush(); check(f.sent.length === 1, 'completed duplicate returns receipt without resend');
    }],
    ['message relay, title reset and collaboration dispatch use the current client', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush();
        f.main.publish({ type: 'chat-msg', html: 'safe message', isEvent: true }); await f.flush(); check(f.messages.textContent.includes('safe message'), 'message reaches popup view');
        f.discussion(null); f.main.publish({ type: 'chat-msg', html: 'next' }); await f.flush(); check(document.title === 'CList Chat', 'empty discussion resets old title');
        await f.click(f.root.querySelector('#startDocButton')); check(f.docs.length === 1, 'collaboration request dispatched once');
        f.channels[1].postMessage({ type: 'send-msg', clientId: 'wrong-client', id: 'wrong', message: 'ignored' }); await f.flush(); check(!f.sent.length, 'other client cannot dispatch');
    }],
    ['expired main session rejects pending sends and disconnects popup controls', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush(); const gate = popupGate(); f.behavior.send = () => gate.promise;
        f.input.value = 'old session'; await f.click(f.send); f.expired(); f.main.publish({ type: 'chat-msg', html: 'never' }); gate.resolve(); await f.flush();
        check(!f.sent.length && f.send.disabled && f.input.value === 'old session', 'old send rejected and draft retained');
        check(f.status().textContent.includes('main chat session ended') && f.channels.every(channel => channel.closed), 'closed notice and resource cleanup');
    }],
    ['popup reload identity expires old acknowledgements and old close packets', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush(); const gate = popupGate(); f.behavior.send = () => gate.promise;
        f.input.value = 'old client'; await f.click(f.send); const old = f.channels[1], close = { type: 'popup-closed', clientId: old.packets[0].clientId };
        f.client().dispose(true); await f.flush(); f.createClient(); await f.flush();
        const packets = f.channels[0].packets.length; gate.resolve(); old.closed = false; old.postMessage(close); await f.flush();
        check(!f.sent.length && !f.send.disabled && f.channels[0].packets.length === packets, 'old completion/close cannot affect reloaded client');
    }],
    ['blocked popup, invalid URL and channel/send failures are visible with no automatic repeat', async check => {
        const f = popupFixture(); f.behavior.blocked = true; f.main.open(); check(f.errors[0].includes('blocked') && f.channels[0].closed, 'blocked popup closes channel and reports');
        f.createClient('bad-name'); check(f.send.disabled && f.status().textContent.includes('Open this popup'), 'direct/invalid popup URL fails closed');
        f.client().dispose(); f.behavior.blocked = false; f.main.open(); f.createClient(); await f.flush();
        f.behavior.send = () => { throw Error('send failed'); }; f.input.value = 'retry draft'; await f.click(f.send);
        check(f.status().textContent.includes('send failed') && f.input.value === 'retry draft' && !f.send.disabled, 'failed action visibly retains draft');
        check(!f.sent.length, 'failure does not repeat itself');
    }],
    ['popup keyboard controls and transport errors retain drafts without resending', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush(); f.input.value = 'typing';
        const key = (options = {}) => {
            if (f.input.dispatchEvent) f.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options }));
            else f.input.listeners.keydown({ key: 'Enter', preventDefault() {}, ...options });
        };
        key({ shiftKey: true }); key({ isComposing: true }); await f.flush(); check(!f.sent.length && f.input.value === 'typing', 'Shift/IME Enter retain typing');
        key(); await f.flush(); check(f.sent[0] === 'typing' && f.input.value === '', 'plain Enter sends and acknowledgement clears captured draft');
        f.behavior.postFail = true; f.input.value = 'unsent'; await f.click(f.send);
        check(f.input.value === 'unsent' && f.status().textContent.includes('channel failure') && !f.send.disabled && f.sent.length === 1, 'post failure retains draft and never retries automatically');
        f.behavior.postFail = false;
    }],
    ['closed window cleanup cannot close a later popup generation', async check => {
        const f = popupFixture(); f.main.open(); f.createClient(); await f.flush(); f.unload(); await f.flush();
        const oldHandler = f.channels[0].onmessage; f.windows[0].closed = true; f.main.open();
        const newest = f.channels.at(-1); for (const callback of f.timers) callback();
        oldHandler({ data: { type: 'popup-ready', clientId: 'old' } }); await f.flush();
        check(!newest.closed && f.windows.length === 2, 'old timer/callback cannot close new popup channel');
    }],
    ['real compatibility entry point and guarded relay close with their owner', async check => {
        const f = popupFixture(); f.installBridge(); openChatPopup(); f.createClient(); await f.flush();
        check(window.CList.state.chatPopup.phase === 'ready' && !f.send.disabled, 'legacy open uses owned bridge/client');
        chatBc.postMessage({ type: 'chat-msg', html: 'bridged content' }); await f.flush();
        check(f.messages.textContent.includes('bridged content'), 'legacy message forwarding uses guarded controller');
        closeOwnedP2pPopup(); await f.flush();
        check(f.send.disabled && chatBc === null && window.CList.state.chatPopup.phase === 'closed', 'owner close clears facade, client and safe state');
    }]
];
