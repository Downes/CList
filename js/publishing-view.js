/// <reference path="./clist-types.js" />
// Ordinary publishing feedback, reusing CList's existing UI helpers.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.ui.publishing = {
    // Plain selection/busy inputs and controller callbacks; no state writes here.
    /** @param {CListAccountRecord[]} accounts
     * @param {CListPublishingPanelOptions} options */
    mount(accounts, { selectedKeys, busy, onToggle, onPublish, onWebPage }) {
        const panel = document.getElementById('post-options');
        panel.innerHTML = '';
        panel.appendChild(makeAccountList('Select accounts to publish to', accounts,
            account => (account.permissions || '').includes('w'),
            key => this.selection(panel, onToggle(key))));
        this.selection(panel, selectedKeys);
        const button = document.createElement('button');
        button.textContent = 'Publish'; button.id = 'final-post-button'; button.className = 'btn-small final-save-button btn';
        button.onclick = onPublish; panel.appendChild(button);
        this.setBusy(busy);
        panel.appendChild(makeWebPageOption(onWebPage));
    },
    selection(container, selectedKeys) {
        const selected = new Set(selectedKeys);
        container.querySelectorAll('.account-button[data-key]').forEach(button => {
            const active = selected.has(button.dataset.key);
            button.dataset.selected = String(active);
            button.classList.toggle('selected', active);
            button.classList.toggle('annotate-glow', active && button.dataset.accountType === 'Annotate');
            button.setAttribute('aria-pressed', String(active));
        });
    },
    begin() {
        window.CList.ui.view.postResult.innerHTML = '';
        updatePostProgress('Preparing publication.');
    },
    setBusy(busy) { renderPublishingBusy(busy); },
    finish() { clearPostProgress(); },
    /** @param {CListPublishingUpdate} update */
    update(update) {
        if (update.type === 'target-result') {
            window.CList.ui.annotations.target(update.receipt);
        } else if (update.type === 'progress') {
            renderPublisherProgress(update.destination, update.progress);
        } else if (update.type === 'warning') {
            this.notice(update.message);
        } else if (update.type === 'destination') {
            const result = update.result;
            if (result.status === 'publishing') updatePostProgress('Publishing to ' + result.destination + '.');
            else if (result.targetResults?.length && result.status !== 'failed') {
                const count = type => result.targetResults.filter(r => r.outcome === type).length;
                this.notice(result.destination + ': ' + window.CList.ui.annotations.summary({
                    created: count('created'), failed: count('failed'), uncertain: count('uncertain') }));
            }
            else if (result.status === 'published') showPublicationSuccess(result.destination, result.url);
            else if (result.status === 'failed') showPublicationError(result.destination, result.error);
            else if (result.status === 'skipped') this.notice(result.error);
            else if (result.status === 'unconfirmed') {
                this.notice(result.destination + ' returned no post link. Check its posts before retrying; publication could not be confirmed.');
            }
        }
    },
    notice(message) { showPostMessage(window.CList.ui.view.postResult, message); },
    fail(error) {
        const message = 'Publishing did not complete: ' + error.message;
        this.notice(message);
        showErrorModal(message, { title: 'Publishing Failed' });
    },
};

// Builds the "To Web Page" option — publishes the editor's raw content, unwrapped and
// untruncated, to the account's CListBin destination (pastebin.mooc.ca by default).
// Deliberately separate from the account checklist above: that flow runs content through
// packagePost() (wraps title/content/references in divs) and truncates to each target's
// character limit, neither of which is right for "publish this page as-is".
function makeWebPageOption(publish = postToWebPage) {
    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Or publish the editor content directly';
    list.appendChild(tip);

    const btn = document.createElement('button');
    btn.className = 'btn-small account-button';

    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.textContent = 'public';

    const nameEl = document.createElement('span');
    nameEl.textContent = 'To Web Page';

    btn.appendChild(iconEl);
    btn.appendChild(nameEl);
    btn.addEventListener('click', publish);
    list.appendChild(btn);

    return list;
}
