// Popup-side command state, acknowledgements and teardown; renderer supplied separately.
function createP2pPopupClient(deps, view) {
    let channel = null, disposed = false, phase = 'opening', error = '';
    const pending = new Map(), clientId = deps.id();
    const render = () => view.status({ phase, error, sending: [...pending.values()].some(item => item.kind === 'send-msg'),
        collaborating: [...pending.values()].some(item => item.kind === 'start-collab-from-chat') });
    const report = failure => { console.error('Chat popup communication failed:', failure); error = failure.message || String(failure); render(); };
    const request = kind => {
        if (disposed || phase !== 'ready' || [...pending.values()].some(item => item.kind === kind)) return;
        const text = kind === 'send-msg' ? view.text().trim() : '';
        if (kind === 'send-msg' && !text) return;
        const id = deps.id(); pending.set(id, { kind, text }); error = ''; render();
        try { channel.postMessage({ type: kind, id, clientId, ...(kind === 'send-msg' ? { message: text } : {}) }); }
        catch (failure) { pending.delete(id); report(failure); }
    };
    const actions = { send: () => request('send-msg'), collaborate: () => request('start-collab-from-chat') };
    const unbind = view.bind(actions), unload = deps.onUnload(() => controller.dispose(true));
    const controller = {
        start(name) {
            if (channel || disposed) return;
            if (!/^clist-chat-[\w-]{1,100}$/.test(name)) { phase = 'closed'; error = 'Open this popup from the main CList window.'; render(); return; }
            try {
                channel = deps.channel(name); const captured = channel;
                channel.onmessage = event => {
                    if (disposed || channel !== captured || !event.data || event.data.clientId !== clientId) return;
                    const packet = event.data;
                    try {
                        if (packet.type === 'main-closed') { error = 'The main chat session ended. Reopen the popup from CList.'; controller.dispose(false); return; }
                        if (packet.type === 'chat-state') { phase = 'ready'; view.discussion(typeof packet.discussionName === 'string' ? packet.discussionName : ''); render(); }
                        else if (packet.type === 'chat-msg' && typeof packet.html === 'string') view.message(packet);
                        else if (packet.type === 'chat-card') view.card(packet);
                        else if (packet.type === 'action-result' && typeof packet.ok === 'boolean') {
                            const item = pending.get(packet.id); if (!item) return;
                            pending.delete(packet.id);
                            if (packet.ok && item.kind === 'send-msg') view.clear(item.text);
                            if (!packet.ok) error = packet.message || 'Chat action failed. Your draft was retained.';
                            render();
                        }
                    } catch (failure) { report(failure); }
                };
                render(); channel.postMessage({ type: 'popup-ready', clientId });
            } catch (failure) { controller.dispose(false); report(failure); }
        },
        dispose(notify = false) {
            if (disposed) return;
            disposed = true;
            if (channel) {
                if (notify) { try { channel.postMessage({ type: 'popup-closed', clientId }); } catch (failure) { report(failure); } }
                channel.onmessage = null; try { channel.close(); } catch (failure) { report(failure); }
            }
            phase = 'closed'; pending.clear(); unbind(); unload(); render();
        }
    };
    return controller;
}
function startP2pPopupClient() {
    const client = createP2pPopupClient({ id: () => crypto.randomUUID(), channel: name => new BroadcastChannel(name),
        onUnload(callback) { window.addEventListener('beforeunload', callback); return () => window.removeEventListener('beforeunload', callback); }
    }, createP2pPopupView());
    let name = ''; try { name = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { name = ''; }
    client.start(name); return client;
}
