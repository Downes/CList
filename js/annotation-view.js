/// <reference path="./clist-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.ui.annotations = {
    summary(outcome) {
        return `Annotations: ${outcome.created} created, ${outcome.failed} failed, ${outcome.uncertain} uncertain.`
            + (outcome.uncertain ? ' Check the server before retrying.' : '');
    },
    show(outcome) {
        if (outcome.created) showStatusMessage(this.summary(outcome));
        else showErrorModal(this.summary(outcome) + ' ' + (outcome.results[0]?.error || ''), { title: 'Annotation result' });
    },
    target(receipt) {
        const container = window.CList.ui.view.postResult;
        if (!container) return;
        const row = document.createElement('p');
        row.className = 'feed-status-message';
        row.textContent = `${receipt.outcome === 'created' ? 'Annotated' : receipt.outcome}: ${receipt.targetUrl}`;
        if (receipt.error) row.append(' - ' + receipt.error);
        if (/^https?:\/\//i.test(receipt.annotationUrl || '')) {
            const link = document.createElement('a');
            link.href = receipt.annotationUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
            link.textContent = ' Open annotation'; row.appendChild(link);
        }
        container.appendChild(row);
    },
    flowButton(button, busy, created = false) {
        button.disabled = busy || created;
        if (created) button.innerHTML = '<span class="material-icons md-18 md-light">check</span>';
    },
    offerCollect(itemId) {
        const container = window.CList.ui.view.postResult;
        if (!container || !document.body.contains(container)) return;
        const prompt = document.createElement('div');
        prompt.textContent = 'Add this item to a collection? ';
        const button = document.createElement('button');
        button.className = 'btn'; button.textContent = 'Add';
        button.addEventListener('click', () => { prompt.remove(); window.collectItem?.(itemId, { glow: true }); });
        prompt.appendChild(button); container.appendChild(prompt);
    },
};
