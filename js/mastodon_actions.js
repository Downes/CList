// Row-owned toggle state and captured Post/Reply forms. Never infer action state from HTML.
function showMastodonPost(context, replyId = null, rowGuard = () => true) {
    if (!context?.isAccountCurrent() || !rowGuard()) return;
    const account = structuredClone(context.account), view = window.CList.ui.mastodon;
    const current = () => context.isAccountCurrent() && rowGuard();
    openLeftInterface(view.postForm(replyId, async form => {
        if (form.busy || !form.root.isConnected || !current()) return;
        const text = form.input.value;
        if (!text.trim()) { view.postStatus(form, 'Please enter a status.', true); return; }
        form.busy = true; form.button.disabled = true;
        try {
            const url = await publishMastodonStatus(account.id, extractBaseUrl(account.instance), text, replyId, {
                assertCurrent: () => { if (!current() || !form.root.isConnected) throw new Error('This Mastodon form is no longer current.'); },
                onWarning: message => { if (current()) view.postStatus(form, message); },
            });
            if (!current() || !form.root.isConnected) { view.status('An earlier Mastodon publication completed.'); return; }
            view.postStatus(form, url ? 'Published: ' + url : 'Mastodon returned no post link. Check your posts before retrying.');
            if (form.input.value === text) form.input.value = '';
        } catch (error) {
            console.error('[Mastodon post]', error);
            if (current()) view.postStatus(form, error?.message || String(error), true);
            else view.status('An earlier Mastodon publication failed.');
        } finally { form.busy = false; if (form.root.isConnected) form.button.disabled = false; }
    }, current));
}
function bindMastodonRow(item, row, context) {
    if (!context?.account || context.account.type !== 'Mastodon') return;
    const account = structuredClone(context.account), target = structuredClone(item.mastodon || {});
    const current = () => row.isConnected && context.isAccountCurrent();
    const view = window.CList.ui.mastodon;
    const state = { boost: !!target.isReblogged, favorite: !!target.isFavourited, bookmark: !!target.isBookmarked, busy: false };
    let buttons;
    const toggle = async action => {
        if (!current() || state.busy) return;
        state.busy = true; buttons.forEach(button => { button.disabled = true; });
        try {
            const result = await toggleMastodonStatus(account, target.statusId, action, state[action]);
            if (!current()) return;
            state[action] = result.active; view.active(buttons.get(action), result.active); view.status('Mastodon action completed.');
        } catch (error) {
            console.error('[Mastodon action]', error);
            if (current()) view.error(error); else view.status('An earlier Mastodon action failed.');
        } finally { state.busy = false; if (current()) buttons.forEach(button => { button.disabled = false; }); }
    };
    const definitions = [];
    if (item._hasExpandableContent) definitions.push({ key: 'expand', title: 'Expand', icon: 'zoom_out_map', click: () => { if (current()) toggleEntryExpanded(row.querySelector('.statusSpecific')?.id || item.id); } });
    if (target.statusId) {
        definitions.push({ key: 'reply', title: 'Reply', icon: 'reply', click: () => { if (current()) showMastodonPost(context, target.statusId, current); } });
        for (const [key, title, icon] of [['boost', 'Boost', 'autorenew'], ['favorite', 'Favourite', 'favorite'], ['bookmark', 'Bookmark', 'star']]) {
            definitions.push({ key, title, icon, click: () => toggle(key) });
        }
        if (target.inThread) definitions.push({ key: 'thread', title: 'View thread', icon: 'dynamic_feed', click: () => current() ? navigateMastodonFeed(context, 'thread', target.statusId) : undefined });
    }
    if (/^https?:\/\//i.test(item.url || '')) definitions.push({ key: 'open', title: 'Open in browser', icon: 'launch', click: () => { if (current()) openInBrowser(item.url, row.querySelector('.statusSpecific')?.id); } });
    buttons = view.buttons(row, definitions);
    if (target.translationWarning) {
        const note = document.createElement('p'); note.className = 'feed-status-message';
        note.textContent = 'Translation was unavailable; original Mastodon content is shown.'; row.appendChild(note);
    }
    for (const action of ['boost', 'favorite', 'bookmark']) view.active(buttons.get(action), state[action]);
    const header = row.querySelector('.reblog-info');
    if (header && target.headerActor?.acct) {
        const link = document.createElement('a'); link.href = '#'; link.textContent = target.headerActor.label;
        link.onclick = event => { event.preventDefault(); if (current()) return navigateMastodonFeed(context, 'user', '@' + target.headerActor.acct); };
        header.replaceChildren(link);
    }
    row.querySelectorAll('a.mention.hashtag').forEach(link => {
        const match = link.getAttribute('href')?.match(/\/tags\/([^?#/]+)/);
        if (!match) return;
        link.href = '#'; link.removeAttribute('target');
        link.onclick = event => { event.preventDefault(); if (current()) return navigateMastodonFeed(context, 'hashtag', decodeURIComponent(match[1])); };
    });
}
