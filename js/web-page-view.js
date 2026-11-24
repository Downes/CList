/// <reference path="./clist-types.js" />
// To Web Page / standalone Republish presentation using existing CList components.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.ui.webPagePublishing = {
    readTitle() { return window.CList.ui.view.writeTitle.innerText.trim(); },
    begin(republish) {
        if (republish) showRepublishStatus('Republishing…', false);
        else window.CList.ui.view.postResult.innerHTML = '';
    },
    setBusy(busy) {
        const button = document.getElementById('republish-button');
        if (button) button.disabled = busy;
    },
    chooseVersion(canOverwrite) {
        const container = window.CList.ui.view.postResult;
        container.innerHTML = '';
        const message = document.createElement('p'); message.className = 'list-tip';
        message.textContent = canOverwrite
            ? 'This page was loaded from My Pages. Overwrite it, or publish a new version?'
            : 'This page cannot be overwritten at this destination. Publish a new version, or Cancel and use Republish for its original destination.';
        container.appendChild(message);
        const row = document.createElement('div'); row.className = 'published-page-confirm';
        container.appendChild(row);
        return new Promise(resolve => {
            const buttons = [];
            for (const [label, mode] of [['Overwrite', 'overwrite'], ['Save as new version', 'new'], ['Cancel', 'cancel']]) {
                const button = document.createElement('button');
                button.className = 'btn-small' + (mode === 'cancel' ? ' btn-secondary' : ''); button.textContent = label;
                button.disabled = mode === 'overwrite' && !canOverwrite;
                button.onclick = () => { buttons.forEach(control => { control.disabled = true; }); container.innerHTML = ''; resolve(mode); };
                buttons.push(button); row.appendChild(button);
            }
        });
    },
    published(result, republish) {
        if (result.status === 'unconfirmed') {
            this.fail(new Error('No publication link was returned. Check the destination before retrying.'), republish); return;
        }
        if (republish) showRepublishStatus(result.forked ? 'Republished - saved as a new, derived copy in My Pages.' : 'Republished.', false);
        else renderPublicationSuccess(window.CList.ui.view.postResult, 'Web Page', result.url);
        if (result.forked && !republish) showStatusMessage('This page was authored by someone else - saved as a new, derived copy in My Pages.');
        if (result.metadataError) {
            showErrorModal('Published, but could not update publication metadata: ' + result.metadataError + '. Check My Pages before retrying publication.',
                { title: 'Published; metadata update failed' });
        }
    },
    fail(error, republish) {
        if (republish) showRepublishStatus('Republish failed: ' + error.message, true);
        else showErrorModal('Could not publish the web page: ' + error.message, { title: 'Web-page publishing failed' });
    },
};

function showRepublishStatus(message, isError) {
    const el = document.getElementById('republish-status');
    if (!el) {
        if (isError) showErrorModal(message, { title: 'Republish failed' });
        else showStatusMessage(message);
        return;
    }
    el.textContent = message;
    el.setAttribute('data-state', isError ? 'error' : 'success');
}

