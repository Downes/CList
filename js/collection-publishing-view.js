/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
function _promptCollectionOverwriteChoice(postResultDiv, accountData) {
    return new Promise(resolve => {
        if (!postResultDiv) { resolve('new'); return; }
        postResultDiv.innerHTML = '';

        const msg = document.createElement('p');
        msg.className = 'list-tip';
        msg.textContent = `This collection was loaded from ${accountData.title || accountData.type}. Overwrite it there, or publish a new version?`;
        postResultDiv.appendChild(msg);

        const row = document.createElement('div');
        row.className = 'published-page-confirm';

        const overwriteBtn = document.createElement('button');
        overwriteBtn.className = 'btn';
        overwriteBtn.textContent = 'Overwrite';
        overwriteBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve('overwrite'); };
        row.appendChild(overwriteBtn);

        const newVersionBtn = document.createElement('button');
        newVersionBtn.className = 'btn';
        newVersionBtn.textContent = 'Save as new version';
        newVersionBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve('new'); };
        row.appendChild(newVersionBtn);

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => { postResultDiv.innerHTML = ''; resolve(null); };
        row.appendChild(cancelBtn);

        postResultDiv.appendChild(row);
    });
}


window.CList.ui.collectionPublishing = {
    fields: readCollectionSaveFields,
    mount(accounts, selectedKeys, toggle, publish) {
        const options = document.getElementById('post-options');
        const result = document.getElementById('post-result');
        options.innerHTML = ''; if (result) result.innerHTML = '';
        const list = makeAccountList('Select destinations to publish to', accounts,
            a => (a.permissions || '').includes('w') && !!window.CList.publishers?.[a.type]
                || (a.permissions || '').includes('b') && !!window.CList.binPublishers?.[a.type],
            (key, account, button) => {
                const selected = toggle(key);
                button.setAttribute('data-selected', String(selected));
                button.classList.toggle('selected', selected);
            });
        options.appendChild(list);
        this.button = document.createElement('button');
        this.button.textContent = 'Publish'; this.button.id = 'final-post-button'; this.button.className = 'final-save-button';
        this.button.addEventListener('click', publish); options.appendChild(this.button);
        options.appendChild(makeCollectionWebPageOption());
        if (typeof openRightInterface === 'function') openRightInterface('post-instructions');
    },
    begin() { const result = document.getElementById('post-result'); if (result) result.innerHTML = ''; },
    setBusy(busy) {
        if (this.button) { this.button.disabled = busy; this.button.textContent = busy ? 'Publishing…' : 'Publish'; }
        if (this.webPageButton) this.webPageButton.disabled = busy;
    },
    choose(account) { return _promptCollectionOverwriteChoice(document.getElementById('post-result'), account); },
    message(text, error = false) {
        const result = document.getElementById('post-result');
        if (!result) { if (error) showErrorModal(text, { title: 'Collection publication' }); else showStatusMessage(text); return; }
        const row = document.createElement('p'); row.className = error ? 'error-message' : 'feed-status-message';
        row.textContent = text; result.appendChild(row);
    },
    update(event) {
        if (event.type === 'warning') this.message(event.message);
        else if (event.type === 'progress') renderPublisherProgress(event.destination, event.progress);
        else if (event.type === 'destination') {
            const r = event.result;
            if (r.status === 'published') showPublicationSuccess(r.destination, r.url);
            else if (r.status === 'failed') this.message(`Failed: ${r.destination} - ${r.error}`, true);
            else if (r.status === 'unconfirmed') this.message(`${r.destination} returned no post link. Check its posts before retrying.`);
        }
    },
    localEntryResult(result, title, updated) {
        if (result.status !== 'published') {
            showErrorModal('No publication link returned. Check the destination before publishing this entry again.', { title: 'Publication unconfirmed' });
        } else if (result.metadataError || !updated) {
            const detail = result.metadataError ? 'Could not save My Pages metadata: ' + result.metadataError
                : 'The entry changed or is no longer active, so its local URL was kept.';
            showErrorModal(`Published "${title}" at ${result.url}. ${detail}`, { title: 'Publication result' });
        } else showStatusMessage(`Published "${title}".`);
    },
    localEntryFailed(error) {
        console.error('[collection entry] publish failed', error);
        showErrorModal('Could not publish: ' + error.message, { title: 'Publish failed' });
    },
    republished(outcome, active) {
        const result = outcome.destinations[0];
        const failed = result?.status === 'failed';
        const message = failed ? 'Republish failed: ' + result.error
            : result?.status === 'unconfirmed' ? 'No publication link returned. Check the destination before retrying.'
            : outcome.metadataError ? 'Republished, but could not update My Pages: ' + outcome.metadataError : 'Republished.';
        if (active) showRepublishStatus(message, failed || !!outcome.metadataError);
        else this.message(message, failed || !!outcome.metadataError);
    },
    republishFailed(error, active) {
        console.error('[collection republish]', error);
        if (active) showRepublishStatus('Republish failed: ' + error.message, true);
        else this.message('Republish failed: ' + error.message, true);
    },
    fail(error) { console.error('[collection publish]', error); this.message(error.message, true); },
};

// Builds the "To Web Page" option for the Collection Editor's Post panel — mirrors
// makeWebPageOption()/postToWebPage() in publish.js, but serializes the collection's
// draft items in the currently selected format instead of reading an editor handler.
function makeCollectionWebPageOption() {
    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Or publish the editor content directly';
    list.appendChild(tip);

    const btn = document.createElement('button');
    btn.className = 'account-button';

    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = 'public';

    const nameEl = document.createElement('span');
    nameEl.textContent = 'To Web Page';

    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', postCollectionToWebPage);
    window.CList.ui.collectionPublishing.webPageButton = btn;
    list.appendChild(btn);

    return list;
}

