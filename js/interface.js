//  interface.js  -  helper and utility functions for the user interface
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
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
        alert('The following elements are missing:', missingElements);
        console.warn('The following elements are missing:', missingElements);
    } else {
        console.log('All elements were found successfully.');
    }
});





let initialReadRight = 0;
// Handle swipe gestures to switch between Read and Write
let endX = 0;

function openLeftPane() {
    const isMobile = window.innerWidth <= 768; // Define mobile breakpoint
    const leftPane = document.getElementById('left-pane');
    const mainWindow = document.getElementById('main-window');

    // Calculate the new left border position
    const paneWidth = isMobile ? '100vw' : '300px';

    // Expand the left pane
    leftPane.style.width = paneWidth;

    // Apply transform to shift the main window
    mainWindow.style.left = paneWidth; // Shift only the right border
    isLeftPaneOpen = true;
    currentPane = 'left-pane';
    return leftPane;        
}


function openRightPane() {
    const isMobile = window.innerWidth <= 768; // Define mobile breakpoint
    const rightPane = document.getElementById('right-pane');
    const mainWindow = document.getElementById('main-window');

    // Calculate the new right border position
    const paneWidth = isMobile ? '100vw' : '300px';

    // Expand the right pane
    rightPane.style.width = paneWidth;

    // Adjust the right border of the main window
    mainWindow.style.right = paneWidth; // Shift only the right border
    isRightPaneOpen = true;
    currentPane = 'right-pane';
}


// Function to close the left pane



function closeLeftPane() {
    const leftPane = document.getElementById('left-pane');
    const mainWindow = document.getElementById('main-window');

    // Reset the left pane width and visibility
    leftPane.style.width = '0'; // Collapse the left pane

    // Reset the left border of the main window
    mainWindow.style.left = '0'; // Move the left border back to the starting position
    currentPane = 'read-pane';
    isLeftPaneOpen = false;
}

function closeRightPane() {
    const rightPane = document.getElementById('right-pane');
    const mainWindow = document.getElementById('main-window');

    // Reset the left pane width and visibility
    rightPane.style.width = '0'; // Collapse the left pane

    // Reset the left border of the main window
    mainWindow.style.right = '0'; // Move the left border back to the starting position
    currentPane = 'write-pane';
    isLeftPaneOpen = false;
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
    isDragging = false;
    document.body.style.cursor = ""; // Reset cursor
});


// Set up the feed menus differently for different services


    function createFeedHeader(type) {

        // Map feed types to their titles
        const titles = {
            home: "Home Feed",
            local: "Local Feed",
            bookmarks: "Bookmarks",
            hashtags: "Hashtag Feed",
            user: "User Feed"
        };
    
        // Create the container div
        const feedHeaderDiv = document.createElement("div");
        feedHeaderDiv.className = "feed-header";

    
        // Add the title based on type
        const title = titles[type] || type;
        const heading = document.createElement("h2");
        heading.textContent = title;
    
        // Optional description
        const description = document.createElement("p");
        description.textContent = `Viewing ${title.toLowerCase()}.`;

        // Append heading and description to the div
        feedHeaderDiv.appendChild(heading);
        feedHeaderDiv.appendChild(description);

        // Feed action buttons
        if (type === 'thread') {
            const actions = document.createElement("p");
            actions.className = "clist-actions";
            actions.innerHTML = `
                <button class="material-icons md-18 md-light" onClick="handleSummarize('feed-container','feed-summary','thread')">play_for_work</button>
                <button class="material-icons md-18 md-light" onClick="handleMastodonAction('thread', 'load',this.parentElement.parentElement)">arrow_right</button>
                `;
            feedHeaderDiv.appendChild(actions);
        } else if (type === 'Bluesky Thread') {
            const actions = document.createElement("p");
            actions.className = "clist-actions";
            actions.innerHTML = `
                <button class="material-icons md-18 md-light" onClick="handleSummarize('feed-container','feed-summary','thread')">play_for_work</button>
                <button class="material-icons md-18 md-light" onClick="loadContentToTinyMCE('feed-container')">arrow_right</button>
                `;
            feedHeaderDiv.appendChild(actions);
        }
        

        return feedHeaderDiv;
        
    }

    function setupFeedButtons(instanceType) {

        // Find the place to put the buttons
        const buttonsContainer = document.getElementById('feed-menu');
        if (!buttonsContainer) {
            console.error('Error: The element with ID "feed-menu" does not exist, so there is no place to put the feed buttons.');
            alert("Error loading feed; please see the console.");
            return;
        }
        buttonsContainer.innerHTML = ''; // Removes all child elements     

        // Access feed functions for the given instance type
        const handler = readerHandlers[instanceType];
        if (!handler) {alert('no handler for '+instanceType);}
        if (!handler.feedFunctions) {alert('no functions');}
        if (Object.keys(handler.feedFunctions).length === 0) {alert('length = 0');}

        if (!handler || !handler.feedFunctions || Object.keys(handler.feedFunctions).length === 0) {
            console.error(`No feed functions defined for instance type: ${instanceType}`);
            return;
        }
        const feedFunctions = handler.feedFunctions;

   
        // For each function, place a button
        for (const [feedType, feedAction] of Object.entries(feedFunctions)) {
            const button = document.createElement('button');
            button.textContent = feedType;
            button.onclick = feedAction; // Attach the feed function as the button's click handler
            buttonsContainer.appendChild(button); // Add the button to the container
        }

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
    

    function alternateDivs(divId1, divId2) {
        const div1 = document.getElementById(divId1);
        const div2 = document.getElementById(divId2);
    
        if (!div1 || !div2) {
            console.error("One or both of the specified divs do not exist.");
            return;
        }

        const div1Display = window.getComputedStyle(div1).display;
        const div2Display = window.getComputedStyle(div2).display;
    
        if (div1Display === 'none') {
            div1.style.display = 'block';
            div2.style.display = 'none';
        } else {
            div1.style.display = 'none';
            div2.style.display = 'block';
        }
    }


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

function showModal(content) {
    // Check if a modal already exists and remove it
    const existingModal = document.getElementById('genericModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'generic-modal';

    // Create modal content box
    const modalContent = document.createElement('div');
    modalContent.id = 'modal-content';
 

    // Add the content to the modal
    if (typeof content === 'string') {
        modalContent.innerHTML = content; // If content is a string, set as innerHTML
    } else {
        modalContent.appendChild(content); // If content is a DOM element, append it
    }

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.position = 'absolute';


    closeButton.addEventListener('click', () => {
        modal.remove();
    });

    // Append close button and content box to modal
    modalContent.appendChild(closeButton);
    modal.appendChild(modalContent);

    // Add modal to the document body
    document.body.appendChild(modal);
}

function showLoader() {
    const loader = document.getElementById('loading-indicator');
    if (loader) {
      loader.style.display = 'flex'; // Change display to flex
      // Force reflow
      loader.offsetHeight; // Access a layout property to trigger reflow
      console.log('Loader shown');
    }
  }