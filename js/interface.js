//  interface.js  -  helper and utility functions for the user interface
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
//  Contents (existing section numbering retained):
//    1. Shared pane bridge — state/persistence/open/close/resize are in pane-* modules
//    4. Left/right panel content & overlay sections
//    5. Feed menu
//    6–7. Navigation module startup and mobile compatibility helpers
//    8. Modal dialogs
//
//  Function declarations are hoisted and event-listener callbacks only run
//  after the whole script has loaded, so the order of the sections below is
//  purely for readability — nothing here depends on file position.

// ============================================================================
// 1. Pane layout — DOM refs & state
// ============================================================================

// Integration aliases retained for existing annotation/collab reveal paths and delegated clicks.
const mainContent = document.getElementById('main-content');
const leftPane = document.getElementById('left-pane');
const readPane = document.getElementById("read-pane");

// Layout commands, storage and drag sizing are owned by pane-state.js,
// pane-view.js and panes.js. Gesture interpretation remains below.
document.addEventListener('DOMContentLoaded',()=>paneController().restore());

// ============================================================================
// 4. Left/right panel content & overlay sections
// ============================================================================

function openLeftInterface(content) {
    if(content?.id!=='find-section'&&typeof invalidateFindPanel==='function')invalidateFindPanel();
    openLeftPane();
    hideLeftOverlaySections();
    const leftContent = document.getElementById('left-content');
    leftContent.innerHTML = '';

    const panel = document.createElement('div');
    panel.id = 'left-interface';
    panel.className = 'left-interface';

    if (typeof content === 'string') {
        panel.innerHTML = content;
    } else if (content instanceof Element) {
        panel.appendChild(content);
    }

    leftContent.appendChild(panel);
}

function openRightInterface(panelId) {
    if (panelId !== 'save-instructions' && typeof invalidateSavePanel === 'function') invalidateSavePanel();
    if (panelId !== 'load-instructions' && typeof invalidateEditorControls === 'function') invalidateEditorControls();
    if (panelId !== 'editor-instructions' && typeof invalidateEditorPicker === 'function') invalidateEditorPicker();
    openRightPane();
    const rightContent = document.getElementById('right-content');
    Array.from(rightContent.children).forEach(child => { child.style.display = 'none'; });
    const panel = document.getElementById(panelId);
    if (panel) panel.style.display = 'block';
}

function toggleFormDisplay(formId,column,on) {
    const form = document.getElementById(formId);
    if (column === 'left') { openLeftPane(); }
    form.style.display = form.style.display === 'block' ? 'none' : 'block';
    if (on) { form.style.display = 'block'; }
}

function toggleDiv(divOrId,column,on) {
    const div = typeof divOrId === 'string' ? document.getElementById(divOrId) : divOrId;
    if (column === 'left') { openLeftPane(); }
    else if (column === 'right') { openRightPane(); }
    if (div) {
        const currentDisplay = window.getComputedStyle(div).display;
        div.style.display = currentDisplay === 'none' ? 'block' : 'none';
        if (on) { div.style.display = 'block'; }
    } else {
        console.error('Div not found');
    }
}

// Chat, audio, and feed options all overlay the same absolutely-positioned
// region of #left-pane-body, so only one may be visible at a time.
function hideLeftOverlaySections() {
    document.querySelectorAll('.left-pane-overlay-section').forEach(el => {
        el.style.display = 'none';
    });
}

function showLeftOverlaySection(id) {
    hideLeftOverlaySections();
    const el = document.getElementById(id);
    if (el) { el.style.display = 'block'; }
    else { console.error('Div not found: ' + id); }
}

function toggleLeftOverlaySection(id) {
    const el = document.getElementById(id);
    if (!el) { console.error('Div not found: ' + id); return; }
    if (window.getComputedStyle(el).display === 'none') {
        showLeftOverlaySection(id);
    } else {
        el.style.display = 'none';
    }
}

// ============================================================================
// 5. Feed menu
// ============================================================================
// Rendering/dispatch now live in reader-view.js and reader.js.

// Keyboard/feed-entry/touch navigation now uses navigation-{state,view}.js
// and navigation.js. Public pane helpers remain compatible.
document.addEventListener('DOMContentLoaded',()=>navigationController());
function mobShowRead(){return paneController().show('read');}
function mobShowWrite(){return paneController().show('write');}
function mobShowLeft(){return openLeftPane();}
function mobShowRight(){return openRightPane();}

// ============================================================================
// 8. Modal dialogs
// ============================================================================

function showModal(content, opts = {}) {
    const existingModal = document.getElementById('generic-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'generic-modal';

    const modalContent = document.createElement('div');
    modalContent.id = 'modal-content';
    if (opts.wide) modalContent.classList.add('modal-content--wide');

    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.appendChild(content);
    }

    if (!opts.hideDefaultClose) {
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.addEventListener('click', () => modal.remove());
        modalContent.appendChild(closeButton);
    }

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Secondary modal layered above #generic-modal — for help/info popups opened
// from within an already-open modal, where showModal() would otherwise
// destroy whatever's underneath it (it only ever keeps one #generic-modal
// alive at a time). Only removes any existing *stacked* modal, leaving the
// base #generic-modal (and anything in it, like unsaved form input) intact.
function showStackedModal(content, opts = {}) {
    const existingModal = document.getElementById('generic-modal-stacked');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'generic-modal-stacked';

    const modalContent = document.createElement('div');
    modalContent.id = 'modal-content-stacked';
    if (opts.wide) modalContent.classList.add('modal-content--wide');

    if (typeof content === 'string') {
        modalContent.innerHTML = content;
    } else {
        modalContent.appendChild(content);
    }

    if (!opts.hideDefaultClose) {
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';
        closeButton.addEventListener('click', () => modal.remove());
        modalContent.appendChild(closeButton);
    }

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

function closeStackedModal() {
    document.getElementById('generic-modal-stacked')?.remove();
}

function showLoader() {
    const loader = window.CList.ui.view.loadingIndicator;
    if (loader) {
        loader.style.display = 'flex';
        loader.offsetHeight;
    }
}
