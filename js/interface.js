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

// Remembers which panes are open and how the read/write split is set, so a returning
// visitor comes back to the layout they left rather than a default every time. Logged-in
// and logged-out visitors are tracked under separate keys, restored by separate functions
// below — kept apart because the logged-in case is likely to grow its own rules later.
const PANE_STATE_KEY_LOGGEDOUT = 'clist_pane_state';
const PANE_STATE_KEY_LOGGEDIN  = 'clist_pane_state_loggedin';

// hasValidSession() (kvstore.js) checks the actual cookie/token/session-key state
// directly, so this works even before kvstore.js's own boot handler has run.
function activePaneStateKey() {
    return (typeof hasValidSession === 'function' && hasValidSession())
        ? PANE_STATE_KEY_LOGGEDIN : PANE_STATE_KEY_LOGGEDOUT;
}

// Shared by both the logged-in and logged-out paths — reads+parses a saved pane state.
function getSavedPaneState(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
        return null; // corrupt/old value — treat as no saved state
    }
}

// Shared by both the logged-in and logged-out paths — applies a saved pane state to the DOM.
function applyPaneState(state) {
    // Set flex first so the savePaneState() calls inside open/close (below)
    // persist the correct values instead of overwriting them with whatever
    // was on the DOM before this restore ran.
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
    } catch (e) { /* localStorage unavailable — layout just won't persist */ }
}

// Returning logged-in visitor → their last layout. First time logged in (nothing saved
// yet under this key) → same first-time default as the logged-out case.
function restoreLoggedInPaneState() {
    const saved = getSavedPaneState(PANE_STATE_KEY_LOGGEDIN);
    if (saved) {
        applyPaneState(saved);
    } else {
        openLeftPane();
        snapPanes('right');
    }
}

// Returning not-logged-in visitor → their last layout. First-ever visit (nothing saved
// yet under this key) → left-pane-open + read-pane-maximized, nothing to configure.
function restoreLoggedOutPaneState() {
    const saved = getSavedPaneState(PANE_STATE_KEY_LOGGEDOUT);
    if (saved) {
        applyPaneState(saved);
    } else {
        openLeftPane();
        snapPanes('right');
    }
}

// Make sure we have a full interface defined
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
    } else {
        console.log('All elements were found successfully.');
    }

    if (typeof hasValidSession === 'function' && hasValidSession()) {
        restoreLoggedInPaneState();
    } else {
        restoreLoggedOutPaneState();
    }
});





let initialReadRight = 0;
// Handle swipe gestures to switch between Read and Write
let endX = 0;

function openLeftPane() {
    const isMobile = window.innerWidth <= 768; // Define mobile breakpoint

    const paneWidth = isMobile ? '100vw' : '300px';

    if (!isLeftPaneOpen) {
        if (leftPane.offsetWidth > 0) {
            // Already visually open (e.g. pre-set by the boot-state style in index.html)
            // — no width transition will fire, so add the wrap class immediately.
            leftPane.classList.add('pane-open');
        } else {
            // Starting from closed: add wrap class only after the width transition completes,
            // so buttons don't stack during the 0→300px animation.
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

    mainWindow.style.left = paneWidth;
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
    const isMobile = window.innerWidth <= 768; // Define mobile breakpoint

    // Calculate the new right border position
    const paneWidth = isMobile ? '100vw' : '300px';

    // Expand the right pane
    rightPane.style.width = paneWidth;

    // Adjust the right border of the main window
    mainWindow.style.right = paneWidth; // Shift only the right border
    isRightPaneOpen = true;
    currentPane = 'right-pane';
    savePaneState();
}


// Function to close the left pane



function closeLeftPane() {
    leftPane.classList.remove('pane-open'); // disable wrap before collapsing
    leftPane.style.width = '0';
    mainWindow.style.left = '0';
    currentPane = 'read-pane';
    isLeftPaneOpen = false;
    savePaneState();
}

function closeRightPane() {
    // Reset the right pane width and visibility
    rightPane.style.width = '0'; // Collapse the right pane

    // Reset the right border of the main window
    mainWindow.style.right = '0'; // Move the right border back to the starting position
    currentPane = 'write-pane';
    isRightPaneOpen = false;
    savePaneState();
}











// Draggable resizing of read and write panes

divider.addEventListener("mousedown", (e) => {
    isDragging = true;
    document.body.style.cursor = "col-resize"; // Change cursor while dragging
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const mainContent = document.getElementById("main-content");
    const mainContentRect = mainContent.getBoundingClientRect();
    const offsetX = e.clientX - mainContentRect.left;

    // Adjust flex-grow based on the drag position
    const totalWidth = mainContentRect.width;
    const readFlex = offsetX / totalWidth;
    const writeFlex = 1 - readFlex;

    readPane.style.flex = readFlex;
    writePane.style.flex = writeFlex;
});

document.addEventListener("mouseup", () => {
    if (isDragging) savePaneState();
    isDragging = false;
    document.body.style.cursor = ""; // Reset cursor
});

// Snap the read/write pane split to a preset position.
// direction='left'  → collapse read pane (or equalize if read is already large)
// direction='right' → collapse write pane / maximize read (or equalize if write is already large)
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

// Set up the feed menus differently for different services

function setupFeedButtons(instanceType) {

    // Find the place to put the buttons
    const buttonsContainer = window.CList.ui.view.feedMenu;
    if (!buttonsContainer) {
        console.error('Error: The element with ID "feed-menu" does not exist, so there is no place to put the feed buttons.');
        showStatusMessage('Error loading feed — feed menu element not found.');
        return;
    }
    buttonsContainer.innerHTML = ''; // Removes all child elements

    // Access feed functions for the given instance type
    const handler = window.CList.readers[instanceType];
    if (!handler || !handler.feedFunctions || Object.keys(handler.feedFunctions).length === 0) {
        console.error(`No feed functions defined for instance type: ${instanceType}`);
        return;
    }
    const feedFunctions = handler.feedFunctions;


    // For each function, place a button
    for (const [feedType, feedAction] of Object.entries(feedFunctions)) {
        const button = document.createElement('button');
        button.className = 'btn';
        button.textContent = feedType;
        button.onclick = feedAction;
        buttonsContainer.appendChild(button);
    }

    // Translation toggle — persists across account switches
    const translateBtn = document.createElement('button');
    translateBtn.id = 'translation-toggle-btn';
    translateBtn.className = 'btn btn-small';
    translateBtn.textContent = 'Translate: ' + (translationEnabled ? 'ON' : 'OFF');
    translateBtn.onclick = toggleTranslation;
    buttonsContainer.appendChild(translateBtn);


}

// Open the left pane, clear it, and display content in a standard container.
// content may be a DOM Element or an HTML string.
function openLeftInterface(content) {
    openLeftPane();
    // Hide overlay sections that float above left-content (audio, chat).
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

// Acceping a div or an ID, toggle the display style
// (Got tired of always checking)
function toggleDiv(divOrId,column,on) {
    // Check if the argument is a string (ID) or a DOM element (object)
    const div = typeof divOrId === 'string' ? document.getElementById(divOrId) : divOrId;
    if (column === 'left') { openLeftPane(); }
    else if (column === 'right') { openRightPane(); }
    // If the div exists, toggle its display style
    if (div) {
        const currentDisplay = window.getComputedStyle(div).display;
        div.style.display = currentDisplay === 'none' ? 'block' : 'none';
        if (on) { div.style.display = 'block'; }
    } else {
        console.error('Div not found');
    }

}


// ---- Feed entry expand/collapse + j/k/x navigation ----
//
// Single source of truth for expanding/collapsing a feed entry's full
// content (replaces the old pattern of toggling '-content'/'-summary'
// separately from each service's Expand/Collapse button and from the
// entry title). Centralizing it here is what makes "collapse every
// other entry" and "scroll the headline to the top" work no matter
// which of those three triggers (button, title click, 'x' key) fired.

let currentEntryEl = null; // the .status-box currently selected via j/k/x

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

// j/k: move the current-entry highlight. If the entry being left was
// expanded, collapse it and expand the destination in its place
// (positioning it at its headline, same as any other expand).
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
        if (specific && expandEntry(specific.id)) return; // already positioned
        collapseAllEntries(); // destination has nothing to expand — just collapse the old one
    }
    setCurrentEntry(nextEl);
}

// Collapses every expanded entry's full content back to its summary.
function collapseAllEntries() {
    document.querySelectorAll('.entry-full-content').forEach(content => {
        if (content.style.display === 'block') {
            content.style.display = 'none';
            const summary = document.getElementById(content.id.replace(/-content$/, '-summary'));
            if (summary) summary.style.display = 'block';
        }
    });
}

// Expands itemID's full content, collapsing all other entries first.
// Returns false (no-op) if this item has no full content to expand.
function expandEntry(itemID) {
    const content = document.getElementById(`${itemID}-content`);
    if (!content) return false; // no full_content for this item — nothing to expand
    const summary = document.getElementById(`${itemID}-summary`);

    collapseAllEntries();
    content.style.display = 'block';
    if (summary) summary.style.display = 'none';

    const box = content.closest('.status-box');
    if (box) setCurrentEntry(box);
    else content.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
}

// Expands itemID's full content if it isn't already expanded; collapses
// it back to the summary if it is.
function toggleEntryExpanded(itemID) {
    const content = document.getElementById(`${itemID}-content`);
    if (!content) return; // no full_content for this item — nothing to expand
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

// j = next entry, k = previous entry, x = toggle expand on the current entry.
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || _typingInField()) return;
    const key = e.key.toLowerCase();
    if (key === 'j') { e.preventDefault(); navigateEntry(1); }
    else if (key === 'k') { e.preventDefault(); navigateEntry(-1); }
    else if (key === 'x') { e.preventDefault(); toggleCurrentEntry(); }
});

// Mobile: double-tap an entry to expand/collapse it (native dblclick,
// which browsers synthesize from two quick taps on touch devices too).
document.getElementById('feed-container')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('a, button, img')) return; // let links/buttons/images handle their own taps
    const box = e.target.closest('.status-box');
    if (!box) return;
    const specific = box.querySelector('.statusSpecific');
    if (specific) toggleEntryExpanded(specific.id);
});

// Mobile: short vertical swipe over the feed = j/k (down = next, up = previous).
// Distinguished from an ordinary scroll drag by requiring both a short
// distance and a short duration (a quick flick, not a sustained drag).
let _feedTouchStartY = 0;
let _feedTouchStartT = 0;
document.getElementById('feed-container')?.addEventListener('touchstart', (e) => {
    _feedTouchStartY = e.touches[0].clientY;
    _feedTouchStartT = Date.now();
});
document.getElementById('feed-container')?.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - _feedTouchStartY;
    const dt = Date.now() - _feedTouchStartT;
    if (dt > 250) return; // not a quick flick
    if (dy > 30 && dy < 120) navigateEntry(1);       // short downswipe -> j
    else if (dy < -30 && dy > -120) navigateEntry(-1); // short upswipe -> k
});

window.toggleEntryExpanded = toggleEntryExpanded;



// Swipe gesture detection for mobile devices


// Function to switch panes
//function switchPane(index) {
//const contentArea = document.getElementById('content-area');
// contentArea.style.transform = `translateX(-${index * 100}vw)`;
//currentPane = index;
//}


let startX = 0; // Track the starting X position of the swipe
let currentPane = 'read-pane'; // Track the currently active pane

// Map swipe behaviors for each pane
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

// Handle swipe start
document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
});

// Handle swipe end
document.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    const direction = startX - endX > 50 ? 'right-to-left' : startX - endX < -50 ? 'left-to-right' : null;

    if (direction) {
        const action = swipeActions[currentPane]?.[direction];
        if (action && typeof window[action] === 'function') {
            window[action](); // Call the appropriate function
        }
    }
});

// Stub functions for pane switching
function mobShowRead() {

    mainWindow.style.transform = 'translateX(-0vw)';
    mainWindow.style.transition = 'transform 0.5s ease'; // Smooth transition
    closeLeftPane();
}

function mobShowWrite() {

    mainWindow.style.transform = 'translateX(-100vw)';
    mainWindow.style.transition = 'transform 0.5s ease'; // Smooth transition
    closeRightPane();
}

function mobShowLeft() {

    openLeftPane();
}

function mobShowRight() {

    openRightPane();

}


// Generic Modal for messages too large to just use an alert button for

function showModal(content, opts = {}) {
    // Check if a modal already exists and remove it
    const existingModal = document.getElementById('generic-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'generic-modal';

    // Create modal content box
    const modalContent = document.createElement('div');
    modalContent.id = 'modal-content';
    if (opts.wide) modalContent.classList.add('modal-content--wide');

    // Add the content to the modal
    if (typeof content === 'string') {
        modalContent.innerHTML = content; // If content is a string, set as innerHTML
    } else {
        modalContent.appendChild(content); // If content is a DOM element, append it
    }

    // Create close button — callers that render their own header/close UI
    // (e.g. the My Pages modal) pass hideDefaultClose to skip this one.
    if (!opts.hideDefaultClose) {
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.position = 'absolute';

        closeButton.addEventListener('click', () => {
            modal.remove();
        });

        modalContent.appendChild(closeButton);
    }

    modal.appendChild(modalContent);

    // Add modal to the document body
    document.body.appendChild(modal);
}

function showLoader() {
    const loader = window.CList.ui.view.loadingIndicator;
    if (loader) {
        loader.style.display = 'flex'; // Change display to flex
        // Force reflow
        loader.offsetHeight; // Access a layout property to trigger reflow
        console.log('Loader shown');
    }
}
