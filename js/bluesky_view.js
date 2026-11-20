// Bluesky controls and feedback. Controllers own all requests and operation state.
window.CList.ui ||= {};
window.CList.ui.blueskyReader = {
    buttons(row, item, callbacks) {
        const root = row.querySelector('.service-status-actions') || row.querySelector('.status-actions');
        if (!root) return {};
        const buttons = {};
        const button = (key, title, icon, callback, active = false) => {
            const element = document.createElement('button'); element.className = 'clist-action-btn' + (active ? ' action-active' : ''); element.title = title;
            element.innerHTML = `<span class="material-icons md-18 md-light">${icon}</span>`;
            element.onclick = callback; root.appendChild(element); buttons[key] = element;
        };
        if (item.bluesky?.uri && item.bluesky?.cid) {
            button('reply', 'Reply', 'reply', callbacks.reply);
            button('favorite', 'Like', 'favorite', callbacks.favorite, !!item.bluesky?.isLiked);
            button('repost', 'Repost', 'autorenew', callbacks.repost, !!item.bluesky?.isReposted);
        }
        if (item.bluesky?.inThread) button('thread', 'View thread', 'dynamic_feed', callbacks.thread);
        if (item._hasExpandableContent) button('expand', 'Expand', 'zoom_out_map', callbacks.expand);
        button('browser', 'Open in browser', 'launch', callbacks.browser);
        row.querySelectorAll('a[title="View User Feed"]').forEach(link => { link.onclick = event => { event.preventDefault(); return callbacks.user(); }; });
        return buttons;
    },
    toggle(button, active, busy) {
        if (!button) return;
        button.disabled = busy; button.classList.toggle('action-active', active);
    },
    compose(reply, submit, current) {
        const root = document.createElement('div');
        const input = document.createElement('textarea'); input.rows = 4; input.placeholder = reply ? 'Write your reply…' : 'Write something…';
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = reply ? 'Submit Reply' : 'Post';
        const feedback = document.createElement('div'); feedback.className = 'reply-response'; root.append(input, button, feedback);
        let busy = false;
        button.onclick = async () => {
            if (busy || !current(root)) return;
            const text = input.value; if (!text.trim()) { showStatusMessage('Please enter a post.'); return; }
            busy = true; button.disabled = true; feedback.replaceChildren();
            try {
                const url = await submit(text, feedback);
                if (!current(root)) return;
                if (url) renderPublicationSuccess(feedback, 'Bluesky', url);
                else showPostMessage(feedback, 'Bluesky returned no post link. Check your posts before retrying.');
                if (input.value === text) input.value = '';
            } catch (error) {
                if (current(root)) { console.error('[Bluesky compose]', error); showServiceError(feedback, 'Bluesky post failed', error.message); }
                else { console.error('[Bluesky compose] expired owner', error); showStatusMessage('An earlier Bluesky post failed.'); }
            } finally { busy = false; if (current(root)) button.disabled = false; }
        };
        openLeftInterface(root); return root;
    },
    search(select, current) {
        const root = document.createElement('div');
        const query = document.createElement('input'); query.placeholder = 'Search Bluesky';
        const sort = document.createElement('select');
        for (const value of ['top', 'latest']) { const option = document.createElement('option'); option.value = value; option.textContent = value; sort.appendChild(option); }
        const button = document.createElement('button'); button.className = 'btn'; button.textContent = 'Search';
        button.onclick = () => current(root) && query.value.trim() && select(query.value.trim(), sort.value);
        root.append(query, sort, button); openLeftInterface(root); return root;
    },
    feeds(feeds, select, current) {
        const root = document.createElement('div'), input = document.createElement('select');
        const first = document.createElement('option'); first.value = ''; first.textContent = 'Select Feed'; input.appendChild(first);
        feeds.forEach(feed => { const option = document.createElement('option'); option.value = feed.uri; option.textContent = feed.title; input.appendChild(option); });
        input.onchange = () => { const feed = feeds.find(feed => feed.uri === input.value); if (feed && current(root)) return select(feed); };
        root.appendChild(input); openLeftInterface(root); return root;
    },
    error(error) { console.error('[Bluesky reader]', error); showStatusMessage(error?.message || String(error)); },
};
