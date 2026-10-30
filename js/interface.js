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

const mainContent = document.getElementById('main-content');
const leftPane = document.getElementById('left-pane');
const rightPane = document.getElementById('right-pane');
const mainWindow = document.getElementById('main-window');
const leftMainCmd = document.getElementById('left-main-command');
const rightMainCmd = document.getElementById('right-main-command');

const divider = document.getElementById("divider");
const readPane = document.getElementById("read-pane");
const writePane = document.getElementById("write-pane");

let isDragging = false;
let isLeftPaneOpen  = false;
let isRightPaneOpen = false;

const PANE_STATE_KEY_LOGGEDOUT = 'clist_pane_state';
const PANE_STATE_KEY_LOGGEDIN  = 'clist_pane_state_loggedin';

function activePaneStateKey() {
    return (typeof hasValidSession === 'function' && hasValidSession())
        ? PANE_STATE_KEY_LOGGEDIN : PANE_STATE_KEY_LOGGEDOUT;
}

function getSavedPaneState(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
        return null;
    }
}

function applyPaneState(state) {
    if (state.readFlex  !== undefined) readPane.style.flex  = state.readFlex;
    if (state.writeFlex !== undefined) writePane.style.flex = state.writeFlex;
    if (state.leftOpen)  openLeftPane();  else closeLeftPane();
    if (state.rightOpen) openRightPane(); else closeRightPane();
}

function savePaneState() {
    try {
        localStorage.setItem(activePaneStateKey(), JSON.stringify({
            leftOpen:  isLeftPaneOpen,
            rightOpen: isRightPaneOpen,
            readFlex:  readPane.style.flex,
            writeFlex: writePane.style.flex
        }));
    } catch (e) {}
}

function restoreLoggedInPaneState() {
    const saved = getSavedPaneState(PANE_STATE_KEY_LOGGEDIN);
    if (saved) {
        applyPaneState(saved);
    } else {
        openLeftPane();
        snapPanes('right');
    }
}

function restoreLoggedOutPaneState() {
    const saved = getSavedPaneState(PANE_STATE_KEY_LOGGEDOUT);
    if (saved) {
        applyPaneState(saved);
    } else {
        openLeftPane();
        snapPanes('right');
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const elementIds = [
        'main-content',
        'left-pane',
        'right-pane',
        'main-window',
        'left-main-command',
        'right-main-command',
        'divider',
        'read-pane',
        'write-pane'
    ];

    const missingElements = elementIds.filter(id => !document.getElementById(id));
    if (missingElements.length > 0) {
        console.warn('The following elements are missing:', missingElements);
    }

    if (typeof hasValidSession === 'function' && hasValidSession()) {
        restoreLoggedInPaneState();
    } else {
        restoreLoggedOutPaneState();
    }
});

let initialReadRight = 0;
let endX = 0;

function openLeftPane() {
    const isMobile = window.innerWidth <= 768;
    const paneWidth = isMobile ? '100%' : '300px';

    if (!isLeftPaneOpen) {
        if (leftPane.offsetWidth > 0) {
            leftPane.classList.add('pane-open');
        } else {
            const onTransitionEnd = (e) => {
                if (e.propertyName === 'width') {
                    leftPane.classList.add('pane-open');
                    leftPane.removeEventListener('transitionend', onTransitionEnd);
                }
            };
            leftPane.addEventListener('transitionend', onTransitionEnd);
        }
        leftPane.style.width = paneWidth;
    }

    isLeftPaneOpen = true;
    currentPane = 'left-pane';
    savePaneState();
    return leftPane;
}

function toggleLeftPane() {
    if (isLeftPaneOpen) {
        closeLeftPane();
    } else {
        openLeftPane();
    }
}

function openRightPane() {
    const isMobile = window.innerWidth <= 768;
    const paneWidth = isMobile ? '100vw' : '300px';
    rightPane.style.width = paneWidth;
    mainWindow.style.right = paneWidth;
    isRightPaneOpen = true;
    currentPane = 'right-pane';
    savePaneState();
}

function closeLeftPane() {
    leftPane.classList.remove('pane-open');
    leftPane.style.width = '0';
    currentPane = 'read-pane';
    isLeftPaneOpen = false;
    savePaneState();
}

function closeRightPane() {
    rightPane.style.width = '0';
    mainWindow.style.right = '0';
    currentPane = 'write-pane';
    isRightPaneOpen = false;
    savePaneState();
}

divider.addEventListener("mousedown", (e) => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const mainContent = document.getElementById("main-content");
    const mainContentRect = mainContent.getBoundingClientRect();
    const offsetX = e.clientX - mainContentRect.left;

    const totalWidth = mainContentRect.width;
    const readFlex = offsetX / totalWidth;
    const writeFlex = 1 - readFlex;

    readPane.style.flex = readFlex;
    writePane.style.flex = writeFlex;
});

document.addEventListener("mouseup", () => {
    if (isDragging) savePaneState();
    isDragging = false;
    document.body.style.cursor = "";
});

function snapPanes(direction) {
    const mainContentRect = mainContent.getBoundingClientRect();
    const readPaneRect = readPane.getBoundingClientRect();
    const ratio = readPaneRect.width / mainContentRect.width;

    if (direction === 'left') {
        if (ratio > 0.65) {
            readPane.style.flex = '0.5';
            writePane.style.flex = '0.5';
        } else {
            readPane.style.flex = '0';
            writePane.style.flex = '1';
        }
    } else {
        if (ratio < 0.35) {
            readPane.style.flex = '0.5';
            writePane.style.flex = '0.5';
        } else {
            readPane.style.flex = '1';
            writePane.style.flex = '0';
        }
    }
    savePaneState();
}

function setupFeedButtons(instanceType) {
    const buttonsContainer = window.CList.ui.view.feedMenu;
    if (!buttonsContainer) {
        console.error('Error: The element with ID "feed-menu" does not exist, so there is no place to put the feed buttons.');
        showErrorModal('Error loading feed — feed menu element not found.', { title: 'Feed load failed' });
        return;
    }
    buttonsContainer.innerHTML = '';

    const handler = window.CList.readers[instanceType];
    if (!handler || !handler.feedFunctions || Object.keys(handler.feedFunctions).length === 0) {
        console.error(`No feed functions defined for instance type: ${instanceType}`);
        return;
    }
    const feedFunctions = handler.feedFunctions;

    for (const [feedType, feedAction] of Object.entries(feedFunctions)) {
        const button = document.createElement('button');
        button.className = 'btn btn-small';
        button.textContent = feedType;
        button.onclick = feedAction;
        buttonsContainer.appendChild(button);
    }

    const translateBtn = document.createElement('button');
    translateBtn.id = 'translation-toggle-btn';
    translateBtn.className = 'btn btn-small';
    translateBtn.textContent = 'Translate: ' + (translationEnabled ? 'ON' : 'OFF');
    translateBtn.onclick = toggleTranslation;
    buttonsContainer.appendChild(translateBtn);
}

function openLeftInterface(content) {
    openLeftPane();
    document.getElementById('audio-section').style.display = 'none';
    document.getElementById('chat-section').style.display  = 'none';
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

let currentEntryEl = null;

function _feedEntries() {
    const fc = document.getElementById('feed-container');
    return fc ? Array.from(fc.querySelectorAll('.status-box')) : [];
}

function setCurrentEntry(el) {
    if (!el) return;
    document.querySelectorAll('.status-box.current-entry').forEach(b => {
        if (b !== el) b.classList.remove('current-entry');
    });
    el.classList.add('current-entry');
    currentEntryEl = el;
    el.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function navigateEntry(direction) {
    const entries = _feedEntries();
    if (!entries.length) return;
    const currentContent = currentEntryEl?.querySelector('.entry-full-content');
    const wasExpanded = currentContent && currentContent.style.display === 'block';
    let idx = currentEntryEl ? entries.indexOf(currentEntryEl) : -1;
    idx = Math.min(Math.max(idx + direction, 0), entries.length - 1);
    const nextEl = entries[idx];

    if (wasExpanded) {
        const specific = nextEl.querySelector('.statusSpecific');
        if (specific && expandEntry(specific.id)) return;
        collapseAllEntries();
    }
    setCurrentEntry(nextEl);
}

function collapseAllEntries() {
    document.querySelectorAll('.entry-full-content').forEach(content => {
        if (content.style.display === 'block') {
            content.style.display = 'none';
            const summary = document.getElementById(content.id.replace(/-content$/, '-summary'));
            if (summary) summary.style.display = 'block';
        }
    });
}

function expandEntry(itemID) {
    const content = document.getElementById(`${itemID}-content`);
    if (!content) return false;
    const summary = document.getElementById(`${itemID}-summary`);

    collapseAllEntries();
    content.style.display = 'block';
    if (summary) summary.style.display = 'none';

    const box = content.closest('.status-box');
    if (box) setCurrentEntry(box);
    else content.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
}

function toggleEntryExpanded(itemID) {
    const content = document.getElementById(`${itemID}-content`);
    if (!content) return;
    if (content.style.display === 'block') {
        content.style.display = 'none';
        const summary = document.getElementById(`${itemID}-summary`);
        if (summary) summary.style.display = 'block';
        return;
    }
    expandEntry(itemID);
}

function toggleCurrentEntry() {
    if (!currentEntryEl) {
        const entries = _feedEntries();
        if (!entries.length) return;
        currentEntryEl = entries[0];
    }
    const specific = currentEntryEl.querySelector('.statusSpecific');
    if (specific) toggleEntryExpanded(specific.id);
}

function _typingInField() {
    const ae = document.activeElement;
    return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' ||
        ae.tagName === 'SELECT' || ae.isContentEditable);
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || _typingInField()) return;
    const key = e.key.toLowerCase();
    if (key === 'j') { e.preventDefault(); navigateEntry(1); }
    else if (key === 'k') { e.preventDefault(); navigateEntry(-1); }
    else if (key === 'x') { e.preventDefault(); toggleCurrentEntry(); }
});

document.getElementById('feed-container')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('a, button, img')) return;
    const box = e.target.closest('.status-box');
    if (!box) return;
    const specific = box.querySelector('.statusSpecific');
    if (specific) toggleEntryExpanded(specific.id);
});

let _feedTouchStartY = 0;
let _feedTouchStartT = 0;
document.getElementById('feed-container')?.addEventListener('touchstart', (e) => {
    _feedTouchStartY = e.touches[0].clientY;
    _feedTouchStartT = Date.now();
});
document.getElementById('feed-container')?.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - _feedTouchStartY;
    const dt = Date.now() - _feedTouchStartT;
    if (dt > 250) return;
    if (dy > 30 && dy < 120) navigateEntry(1);
    else if (dy < -30 && dy > -120) navigateEntry(-1);
});

window.toggleEntryExpanded = toggleEntryExpanded;

let startX = 0;
let currentPane = 'read-pane';

const swipeActions = {
    'left-pane': {
        'right-to-left': 'mobShowRead',
    },
    'read-pane': {
        'left-to-right': 'mobShowLeft',
        'right-to-left': 'mobShowWrite',
    },
    'write-pane': {
        'left-to-right': 'mobShowRead',
        'right-to-left': 'mobShowRight',
    },
    'right-pane': {
        'left-to-right': 'mobShowWrite',
    },
};

document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
});

document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const direction = startX - endX > 50 ? 'right-to-left' : startX - endX < -50 ? 'left-to-right' : null;

    if (direction) {
        const action = swipeActions[currentPane]?.[direction];
        if (action && typeof window[action] === 'function') {
            window[action]();
        }
    }
});

function mobShowRead() {
    mainWindow.style.transform = 'translateX(-0vw)';
    mainWindow.style.transition = 'transform 0.5s ease';
    closeLeftPane();
}

function mobShowWrite() {
    mainWindow.style.transform = 'translateX(-100vw)';
    mainWindow.style.transition = 'transform 0.5s ease';
    closeRightPane();
}

function mobShowLeft() {
    openLeftPane();
}

function mobShowRight() {
    openRightPane();
}

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

function showLoader() {
    const loader = window.CList.ui.view.loadingIndicator;
    if (loader) {
        loader.style.display = 'flex';
        loader.offsetHeight;
    }
}
