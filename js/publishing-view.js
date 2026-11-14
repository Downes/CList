/// <reference path="./clist-types.js" />
// Ordinary publishing feedback, reusing CList's existing UI helpers.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

window.CList.ui.publishing = {
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
