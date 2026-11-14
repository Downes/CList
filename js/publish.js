/// <reference path="./clist-types.js" />
//  publish.js  -  Functions to publish content to various platforms
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.
//
//

//
// Define handlers for each publisher
//
// Definition:
//
//      The publishers registry maps account types to publisher objects.
//      Each publisher must implement:
//
//          publish: async (accountData, title, content) => publishedURL | null
//
//      accountData — the full parsed account object (type, instance, id, permissions, title, …)
//      title       — the write-pane title (may contain HTML; strip if the service requires plain text)
//      content     — the post body (may contain HTML; handler is responsible for any stripping)
//      returns     — the URL of the published post as a string, or null if not applicable
//
//      Register a publisher in the relevant service .js file:
//
//          (function () {
//              window.CList.publishers = window.CList.publishers || {};
//              window.CList.publishers['ServiceType'] = {
//                  publish: async (accountData, title, content) => {
//                      // call the service API …
//                      return publishedURL; // or null
//                  }
//              };
//          })();
//

window.CList.publishers = window.CList.publishers || {};

//
// Define handlers for each save destination
//
//      The savers registry is an ordered array of saver objects displayed
//      in the right-pane Save list. Each saver must have:
//
//          label  {string}   Display name shown in the list
//          icon   {string}   Material Icons name (or logoSrc for a masked SVG)
//          save   async () => void
//
//      Register a saver from any service .js file:
//
//          (function () {
//              window.CList.savers = window.CList.savers || [];
//              window.CList.savers.push({
//                  label: 'Save to My Service',
//                  icon:  'cloud_upload',
//                  save:  async () => { /* save logic here */ }
//              });
//          })();
//

window.CList.savers = window.CList.savers || [];

async function playPost() {
    if (window.CList.state?.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }

    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.playCollectionPublish === 'function') {
            await window.playCollectionPublish();
            return;
        }
    }

    if (!Array.isArray(window.CList.accounts)) {
        throw new Error('Error: Accounts array not found; maybe you need to log in.');
    }

    try {
        await ensureAccountsLoaded();
    } catch (error) {
        showErrorModal('Error getting accounts: ' + error.message, { title: 'Could not load accounts' });
    }

    populatePostOptions(window.CList.accounts);
    openRightInterface('post-instructions');

}

async function playSave() {
    if (window.CList.state?.collectionPublishing?.busy) { showStatusMessage('Wait for collection publication to finish.'); return; }
    if (typeof currentEditor !== 'undefined' && currentEditor === 'collection') {
        if (typeof window.playCollectionSave === 'function') {
            await window.playCollectionSave();
            return;
        }
    }
    populateSaveOptions();
    openRightInterface('save-instructions');
}


function reconcilePublishSelection(accounts) {
    const eligibleKeys = new Set(
        accounts.filter(account => {
            const value = parseAccountValue(account);
            return value && (value.permissions || '').includes('w');
        }).map(account => account.key)
    );

    const publishing = window.CList.state.publishing;
    publishing.selectedAccountKeys = publishing.selectedAccountKeys
        .filter(key => eligibleKeys.has(key));

    return [...publishing.selectedAccountKeys];
}

function togglePublishSelection(key) {
    const publishing = window.CList.state.publishing;
    const selected = publishing.selectedAccountKeys.includes(key);

    publishing.selectedAccountKeys = selected
        ? publishing.selectedAccountKeys.filter(value => value !== key)
        : [...publishing.selectedAccountKeys, key];
}

function renderPublishSelection(container) {
    const selectedKeys = new Set(
        window.CList.state.publishing.selectedAccountKeys
    );

    container.querySelectorAll('.account-button[data-key]').forEach(btn => {
        const selected = selectedKeys.has(btn.dataset.key);
        btn.dataset.selected = String(selected);
        btn.classList.toggle('selected', selected);
        btn.classList.toggle(
            'annotate-glow',
            selected && btn.dataset.accountType === 'Annotate'
        );
        btn.setAttribute('aria-pressed', String(selected));
    });
}

// Function to populate the post panel with account options
function populatePostOptions(accounts) {
    reconcilePublishSelection(accounts);
    const postOptionsDiv = document.getElementById('post-options');
    postOptionsDiv.innerHTML = '';

    postOptionsDiv.appendChild(makeAccountList(
        'Select accounts to publish to',
        accounts,
        v => v.permissions.includes('w'),
        key => {
            togglePublishSelection(key);
            renderPublishSelection(postOptionsDiv);
        }
    ));
    renderPublishSelection(postOptionsDiv);

    const finalPostOption = document.createElement('button');
    finalPostOption.textContent = 'Publish';
    finalPostOption.id = 'final-post-button';
    finalPostOption.className = 'final-save-button btn';
    postOptionsDiv.appendChild(finalPostOption);
    renderPublishingBusy(window.CList.state.publishing.busy);

    finalPostOption.onclick = async function() {
        await postAll();
    };

    postOptionsDiv.appendChild(makeWebPageOption());
}

// Builds the "To Web Page" option — publishes the editor's raw content, unwrapped and
// untruncated, to the account's CListBin destination (pastebin.mooc.ca by default).
// Deliberately separate from the account checklist above: that flow runs content through
// packagePost() (wraps title/content/references in divs) and truncates to each target's
// character limit, neither of which is right for "publish this page as-is".
function makeWebPageOption() {
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
    btn.addEventListener('click', postToWebPage);
    list.appendChild(btn);

    return list;
}

// Standalone web-page publishing is implemented by web-page-*.js.

function populateSaveOptions() {
    const saveOptionsDiv = document.getElementById('save-options');
    saveOptionsDiv.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'account-list';

    const tip = document.createElement('div');
    tip.className = 'list-tip';
    tip.textContent = 'Select a destination to save to';
    list.appendChild(tip);

    window.CList.savers.forEach(handler => {
        if (!window.CList.ui.isHandlerVisible(handler)) return;
        const btn = document.createElement('button');
        btn.className = 'account-button';

        const iconEl = document.createElement('span');
        if (handler.logoSrc) {
            iconEl.className = 'service-icon-img';
            iconEl.style.webkitMask = `url('${handler.logoSrc}') no-repeat center / contain`;
            iconEl.style.mask = `url('${handler.logoSrc}') no-repeat center / contain`;
        } else {
            iconEl.className = 'material-icons';
            iconEl.textContent = handler.icon || 'save';
        }

        const nameEl = document.createElement('span');
        nameEl.textContent = handler.label;

        btn.appendChild(iconEl);
        btn.appendChild(nameEl);

        btn.addEventListener('click', async () => {
            const result = await handler.save();
            if (!result?.keepOpen) closeRightPane();
        });

        list.appendChild(btn);
    });

    saveOptionsDiv.appendChild(list);
}


function reportPublisherError(accountData, error) {
    const destination = accountData.title || accountData.type;

    console.error('Publishing to ' + destination + ' failed:', error);
    showPublicationError(destination, error.message);
}

/** @returns {Promise<CListPublicationRequest|null>} */
async function capturePublicationRequest() {
    const fields = readPublicationFields();

    const request = {
        title: fields.title.trim(),
        references: structuredClone(getReferences()),
        tags: structuredClone(window.getWriteTags?.() || []),
        selectedAccountKeys: [
            ...window.CList.state.publishing.selectedAccountKeys
        ],
        accountStoreUrl: window.CList.config.flaskSiteUrl,
        localPageId: typeof currentLoadedPage !== 'undefined' && currentLoadedPage?.kind === 'local-page'
            ? currentLoadedPage.id : null,
    };

    const content = await packagePost({
        forPublishing: true,
        title: fields.title,
        referenceHtml: fields.referenceHtml
    });

    if (!content) return null;

    return { ...request, content };
}

/** @returns {Promise<CListPublishingOutcome|null|undefined>} */
async function postAll() {
    const publishing = window.CList.state.publishing;
    if (publishing.busy) return;
    const view = window.CList.ui.publishing;
    if (window.CList.state.webPagePublishing?.busy || window.CList.state.collectionPublishing?.busy) {
        view.fail(new Error('Finish or cancel the current publication before publishing to other destinations.'));
        return;
    }
    publishing.busy = true;
    publishing.operation = { status: 'capturing', primaryUrl: null, destinations: [] };
    try {
        view.setBusy(true);
        const annotationSession = typeof captureAnnotationSession === 'function' ? captureAnnotationSession() : undefined;
        const request = await capturePublicationRequest();
        if (request) return await _postAllSelected(request, annotationSession);
        publishing.operation = { ...publishing.operation, status: 'cancelled' };
        return null;
    } catch (error) {
        console.error('Publishing did not complete:', error);
        publishing.operation = { ...publishing.operation, status: 'failed', error: error.message };
        view.fail(error);
        return null;
    } finally {
        publishing.busy = false;
        view.setBusy(false);
        view.finish();
    }
}

/**
 * Controller: account loading and post-publication effects stay outside the workflow.
 * @param {CListPublicationRequest} request
 * @returns {Promise<CListPublishingOutcome>}
 */
async function _postAllSelected(request, annotationSession) {
    const view = window.CList.ui.publishing;
    const publishing = window.CList.state.publishing;
    view.begin();
    const loaded = await getAccounts(request.accountStoreUrl);
    if (!Array.isArray(loaded)) throw new Error('Could not load publishing accounts. Please log in again.');
    const accounts = structuredClone(loaded);
    const outcome = await runPublishingWorkflow(request, {
        accounts, publishers: window.CList.publishers, parseAccount: parseAccountValue, annotationSession,
        toText: html => removeHtml(html),
        onUpdate: update => {
            publishing.operation = applyPublishingUpdate(publishing.operation || {
                status: 'publishing', primaryUrl: null, destinations: [],
            }, update);
            view.update(update);
        },
    });
    publishing.operation = { ...structuredClone(outcome), status: 'complete' };

    // Record against the page captured before the editor API was awaited. A
    // different page opened during publication must not acquire its URL.
    if (request.localPageId) {
        for (const result of outcome.destinations.filter(result => result.status === 'published' && result.url)) {
            const account = parseAccountValue(accounts.find(record => record.key === result.key));
            try {
                await window.CList.pageStore.recordPublication(request.localPageId, {
                    service: result.service, accountId: account.id || null, url: result.url,
                });
                if (typeof currentLoadedPage !== 'undefined' && currentLoadedPage?.kind === 'local-page'
                    && currentLoadedPage.id === request.localPageId) {
                    currentLoadedPage.publicationUrl = result.url;
                }
            } catch (error) {
                console.error('[postAll] failed to record publication', error);
                view.notice("Published, but could not update the local page's publication status: " + error.message);
            }
        }
    }
    if (annotationSession && typeof offerCollectionForAnnotation === 'function') {
        for (const result of outcome.destinations.filter(r => r.service === 'Annotate')) {
            const created = (result.targetResults || []).filter(r => r.outcome === 'created');
            if (created.length === 1) await offerCollectionForAnnotation(
                request.references.find(ref => ref.url === created[0].targetUrl), annotationSession);
        }
    }
    if (outcome.primaryUrl && typeof sendWebMentions === 'function') {
        try { await sendWebMentions(outcome.primaryUrl, structuredClone(request.references)); }
        catch (error) { view.notice('Published, but could not send WebMentions: ' + error.message); }
    }
    if (typeof window._onPostAllComplete === 'function') {
        const callback = window._onPostAllComplete;
        window._onPostAllComplete = null;
        try { callback(); }
        catch (error) { view.notice('Publication finished, but its completion action failed: ' + error.message); }
    }
    return outcome;
}

// Dispatch publishing to the registered handler for the account type
async function postContentByType(accountData, title, content) {
    const handler = window.CList.publishers[accountData.type];
    if (!handler || typeof handler.publish !== 'function') {
        showErrorModal('No publish handler registered for account type: ' + accountData.type, { title: 'No publish handler found' });
        return null;
    }
    try {
        return await handler.publish(accountData, title, content, structuredClone(getReferences()), {
            tags: structuredClone(window.getWriteTags?.() || []),
            annotationSession: typeof captureAnnotationSession === 'function' ? captureAnnotationSession() : undefined,
            onTargetResult: receipt => window.CList.ui.annotations.target(receipt),
            onWarning: message => window.CList.ui.publishing.notice(message),
        });
    } catch (error) {
        reportPublisherError(accountData, error);
        return null;
    }
}


    // Makes sure posts that need a title get one
    function checkTitleAndProceed(title) {
        if (title === "Title (Optional)") {
            const userResponse = confirm("Would you like to add a proper title?");
            if (userResponse) {
                // User clicked "Yes"
                alert("Please enter a title (top of the 'write' pane) and then click 'Publish' again.");
                return; // Stop function execution
            }
            // If user clicked "No", continue execution
        }
    }

