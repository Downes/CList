// Mastodon controls and feedback. Transport and lifecycle decisions are callbacks.
window.CList.ui ||= {};
window.CList.ui.mastodon = {
    message(context, text) { context.commit(() => {
        const root = window.CList.ui.view.feedContainer; root.replaceChildren();
        const p = document.createElement('p'); p.className = 'feed-status-message'; p.textContent = text; root.appendChild(p);
    }); },
    error(error) { console.error('[Mastodon]', error); showStatusMessage(error?.message || String(error)); },
    form(label, submit, isCurrent) {
        const root = document.createElement('div'), input = document.createElement('input');
        input.type = 'text'; input.placeholder = label;
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Show ' + label;
        const status = document.createElement('p'); status.className = 'feed-status-message';
        button.onclick = async () => {
            if (!root.isConnected || !isCurrent() || button.disabled) return;
            const value = input.value.trim(); if (!value) { status.textContent = 'Please enter ' + label + '.'; return; }
            button.disabled = true;
            try { await submit(value); } catch (error) { console.error('[Mastodon form]', error); if (root.isConnected) status.textContent = error.message; }
            finally { if (root.isConnected) button.disabled = false; }
        };
        root.append(input, button, status); return root;
    },
    lists(lists, select, isCurrent) {
        const root = document.createElement('div');
        if (!lists.length) { root.textContent = 'No Mastodon lists found.'; return root; }
        for (const list of lists) {
            const button = document.createElement('button'); button.className = 'btn'; button.textContent = list.title || 'Untitled list';
            button.onclick = async () => {
                if (!root.isConnected || !isCurrent() || button.disabled) return;
                button.disabled = true;
                try { await select(list.id); } catch (error) { this.error(error); }
                finally { if (root.isConnected) button.disabled = false; }
            };
            root.appendChild(button);
        }
        return root;
    },
    postForm(replyId, submit, isCurrent) {
        const root = document.createElement('div'), input = document.createElement('textarea');
        input.placeholder = replyId ? 'Write a reply' : 'Write a Mastodon post'; input.rows = 4;
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = replyId ? 'Send reply' : 'Post status';
        const status = document.createElement('p'); status.className = 'feed-status-message';
        const form = { root, input, button, status, busy: false };
        button.onclick = () => submit(form);
        root.append(input, button, status); return root;
    },
    postStatus(form, text, error = false) {
        if (!form.root.isConnected) return;
        form.status.className = error ? 'error-message' : 'feed-status-message'; form.status.textContent = text;
    },
    buttons(row, definitions) {
        const root = row.querySelector('.service-status-actions') || row.querySelector('.status-actions'); if (!root) return new Map();
        root.querySelector('.mastodon-status-actions')?.remove();
        const host = document.createElement('span'); host.className = 'mastodon-status-actions';
        root.insertBefore(host, root.firstChild || root.children[0] || null);
        const buttons = new Map();
        for (const definition of definitions) {
            const button = document.createElement('button'); button.className = 'clist-action-btn'; button.title = definition.title;
            const icon = document.createElement('span'); icon.className = 'material-icons md-18 md-light'; icon.textContent = definition.icon;
            button.appendChild(icon); button.onclick = definition.click; host.appendChild(button); buttons.set(definition.key, button);
        }
        return buttons;
    },
    active(button, active) { button?.classList.toggle('action-active', active); },
    status(text) { showStatusMessage(text); },
    threadHeader(context) {
        const root = window.CList.ui.view.feedContainer;
        const button = root.querySelector('[title="Load thread into editor"]');
        if (button) {
            button.removeAttribute('onclick');
            button.onclick = () => { if (button.isConnected && context.isCurrent()) loadContentToEditor('thread'); };
        }
    },
};
