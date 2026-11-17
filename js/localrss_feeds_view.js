// LocalRSS feed-management controls and feedback. All lookups stay inside the captured panel.
function _localrssFeedsSection(div, target) {
    const newFeedRow = document.createElement('div');
    newFeedRow.className = 'localrss-options-row localrss-feed-box';
    div.appendChild(newFeedRow);

    const newFeedInput = document.createElement('input');
    newFeedInput.type = 'text';
    newFeedInput.id = 'localrss-new-feed-url';
    newFeedInput.placeholder = 'Add new feed';
    newFeedRow.appendChild(newFeedInput);

    const createBtn = document.createElement('button');
    createBtn.className = 'btn btn-small';
    createBtn.textContent = 'Create / Discover';
    createBtn.onclick = () => _localrssCreateFeed(target);
    newFeedRow.appendChild(createBtn);

    const hint = document.createElement('p');
    hint.className = 'list-tip';
    hint.textContent = 'If you paste a website URL, the reader will look for an RSS/Atom link in the page header.';
    div.appendChild(hint);

    const createStatus = document.createElement('p');
    createStatus.id = 'localrss-create-feed-status';
    createStatus.className = 'list-tip';
    createStatus.style.display = 'none';
    div.appendChild(createStatus);

    const feedSearchInput = document.createElement('input');
    feedSearchInput.type = 'text';
    feedSearchInput.id = 'localrss-feed-search-input';
    feedSearchInput.placeholder = 'Find / update feed';
    feedSearchInput.addEventListener('input', () => _localrssSearchFeeds(target));
    div.appendChild(feedSearchInput);

    const feedResults = document.createElement('div');
    feedResults.id = 'localrss-feed-results';
    feedResults.className = 'account-list';
    div.appendChild(feedResults);

    div.appendChild(_localrssFeedEditor(target));
}

function _localrssLabeledInput(id, labelText) {
    const row = document.createElement('div');
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    row.appendChild(label);
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    row.appendChild(input);
    return row;
}

function _localrssFeedEditor(target) {
    const div = document.createElement('div');
    div.id = 'localrss-feed-editor';
    div.className = 'localrss-feed-box';
    div.style.display = 'none';

    div.appendChild(_localrssLabeledInput('localrss-edit-feed-url', 'Feed URL'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-title', 'Title'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-author', 'Author'));
    div.appendChild(_localrssLabeledInput('localrss-edit-feed-image', 'Image URL'));

    const errorMsg = document.createElement('p');
    errorMsg.id = 'localrss-feed-editor-error';
    errorMsg.className = 'error-message';
    errorMsg.style.display = 'none';
    div.appendChild(errorMsg);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-small';
    saveBtn.textContent = 'Save';
    saveBtn.onclick = () => _localrssSaveFeed(target);
    div.appendChild(saveBtn);

    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-small';
    retryBtn.textContent = 'Retry';
    retryBtn.onclick = () => _localrssRetryFeed(target);
    div.appendChild(retryBtn);

    const showPostsBtn = document.createElement('button');
    showPostsBtn.className = 'btn btn-small';
    showPostsBtn.textContent = 'Show posts';
    showPostsBtn.onclick = () => _localrssShowFeedPosts(target);
    div.appendChild(showPostsBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-small btn-secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => _localrssDeleteFeed(target);
    div.appendChild(deleteBtn);

    const status = document.createElement('p');
    status.id = 'localrss-feed-editor-status';
    status.className = 'list-tip';
    div.appendChild(status);

    return div;
}


window.CList.ui.localrssFeeds = {
    input(target, id) {
        return (target.root?.querySelector('#' + id)?.value || '').trim();
    },
    snapshot(target) {
        return Object.fromEntries(['url', 'title', 'author', 'image'].map(field =>
            [field, this.input(target, 'localrss-edit-feed-' + field)]));
    },
    status(target, area, text) {
        const id = area === 'create' ? 'localrss-create-feed-status' : 'localrss-feed-editor-status';
        const status = target.root?.querySelector('#' + id);
        if (status) { status.style.display = ''; status.textContent = text; }
    },
    error(target, area, error) {
        console.error('LocalRSS feed ' + area + ' failed:', error);
        if (area === 'search') {
            const results = target.root?.querySelector('#localrss-feed-results');
            if (results) {
                results.innerHTML = '';
                const message = document.createElement('p');
                message.className = 'feed-status-message';
                message.textContent = 'Could not search feeds: ' + (error.message || String(error));
                results.appendChild(message);
            }
        } else {
            if (area === 'editor') {
                const editor = target.root?.querySelector('#localrss-feed-editor');
                if (editor) editor.style.display = 'block';
            }
            this.status(target, area, error.message || String(error));
        }
    },
    busy(target, area, value) {
        const root = area === 'create' ? target.root : target.root?.querySelector('#localrss-feed-editor');
        for (const button of root?.querySelectorAll('button') || []) {
            if (area === 'create' ? button.textContent === 'Create / Discover'
                : ['Save', 'Retry', 'Delete'].includes(button.textContent)) button.disabled = value;
        }
    },
    editor(target, feed) {
        const editor = target.root?.querySelector('#localrss-feed-editor');
        if (!editor) return;
        for (const field of ['url', 'title', 'author', 'image']) {
            const input = editor.querySelector('#localrss-edit-feed-' + field);
            if (input) input.value = feed[field] || '';
        }
        this.feedError(target, feed);
        this.status(target, 'editor', '');
        editor.style.display = 'block';
        editor.scrollIntoView({ block: 'nearest' });
        editor.querySelector('#localrss-edit-feed-url')?.focus();
    },
    feedError(target, feed) {
        const message = target.root?.querySelector('#localrss-feed-editor-error');
        if (!message) return;
        const failed = feed.fail_count > 0 && feed.error_msg;
        message.textContent = failed
            ? `${feed.fail_count} failed attempt${feed.fail_count !== 1 ? 's' : ''}: ${feed.error_msg}` : '';
        message.style.display = failed ? 'block' : 'none';
    },
    results(target, feeds, onOpen) {
        const results = target.root?.querySelector('#localrss-feed-results');
        if (!results) return;
        results.innerHTML = '';
        for (const feed of feeds.slice(0, 50)) {
            const button = document.createElement('button');
            button.className = 'btn btn-small';
            button.textContent = feed.title || feed.url || '';
            button.onclick = () => onOpen(feed);
            results.appendChild(button);
        }
    },
    deleted(target) {
        const editor = target.root?.querySelector('#localrss-feed-editor');
        if (editor) editor.style.display = 'none';
        const results = target.root?.querySelector('#localrss-feed-results');
        if (results) results.innerHTML = '';
        const search = target.root?.querySelector('#localrss-feed-search-input');
        if (search) search.value = '';
        this.status(target, 'editor', '');
    },
    clearCreate(target, originalUrl) {
        const input = target.root?.querySelector('#localrss-new-feed-url');
        if (input?.value.trim() === originalUrl) input.value = '';
    },
};
