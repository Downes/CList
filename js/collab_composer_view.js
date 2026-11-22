let _collabComposerId = 0;
function createCollabComposerView(target, doc = document) {
    const container = doc.getElementById('collabDiv');
    if (!container?.isConnected) throw Error('The collaboration editor is no longer available.');
    const root = doc.createElement('div'); root.id = 'collab-share-post-overlay';
    const instructions = doc.createElement('p'); instructions.className = 'overlay-instructions'; instructions.textContent = "Create a message to share this link, then Post it to any of your accounts using 'Post'.";
    const textarea = doc.createElement('textarea'); textarea.id = 'collab-share-post-editor-' + ++_collabComposerId;
    const toolbar = doc.createElement('div'); toolbar.className = 'overlay-toolbar';
    const post = doc.createElement('button'); post.id = 'collab-share-post-btn'; post.className = 'btn btn-small'; post.textContent = 'Post';
    const cancel = doc.createElement('button'); cancel.id = 'collab-share-close-btn'; cancel.className = 'btn btn-small btn-secondary'; cancel.textContent = 'Cancel';
    const retry = doc.createElement('button'); retry.className = 'btn btn-small'; retry.textContent = 'Retry rich editor'; retry.hidden = true;
    const message = doc.createElement('p'); message.className = 'feed-status-message'; toolbar.append(post,cancel,retry); root.append(instructions,textarea,toolbar,message);
    const alive = () => root.isConnected && root.parentNode === container && doc.getElementById(root.id) === root;
    return {
        alive, element: textarea,
        mount(actions, plain) {
            doc.getElementById('generic-modal')?.remove(); container.appendChild(root); textarea.value = plain;
            textarea.oninput = () => { if (alive()) actions.edit(textarea.value); };
            post.onclick = () => { if (alive()) return actions.post(); }; cancel.onclick = () => { if (alive()) actions.close(); };
            retry.onclick = () => { if (alive()) return actions.initialize(); };
        },
        watch(expire) { if (typeof MutationObserver !== 'function') return () => {}; const observer = new MutationObserver(expire); observer.observe(doc.body,{childList:true,subtree:true}); return () => observer.disconnect(); },
        seedHtml(plain, initial) { return initial ? '<p><a href="' + escapeHtml(target.link) + '">' + escapeHtml(target.title) + (target.mode === 'read' ? ' (view only)' : '') + '</a></p>' : '<p>' + escapeHtml(plain).replace(/\n/g,'<br>') + '</p>'; },
        starting(html) { textarea.value = html; textarea.style.visibility = 'hidden'; post.disabled = true; message.textContent = 'Initializing editor…'; },
        ready(plain, rich) { if (!alive()) return; if (!rich) textarea.value = plain; textarea.style.visibility = ''; post.disabled = false; message.className = 'feed-status-message'; message.textContent = ''; retry.hidden = true; },
        busy(value) { if (alive()) post.disabled = value; },
        notice(value) { if (alive()) { message.className = 'feed-status-message'; message.textContent = value; } },
        error(error) { console.error('Collab share composer failed:',error); if (alive()) { message.className = 'error-message'; message.textContent = error.message || String(error); retry.hidden = false; post.disabled = false; } },
        cleanupError(error) { console.error('Collab share composer cleanup failed:',error); showStatusMessage('Could not fully close the share editor.'); },
        remove() { root.remove(); }
    };
}
