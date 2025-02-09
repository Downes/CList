// dynamicp2p.js  -  helper and utility functions for dynamic P2P connections
// Part of CList, the next generation of learning and connecting with your community
//
// Version 0.1 created by Stephen Downes on January 27, 2025
//
// Copyright National Research Council of Canada 2025
// Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
// This software carries NO WARRANTY OF ANY KIND.
// This software is provided "AS IS," and you, its user, assume all risks when using it.

// Global variables
let heartbeatInterval; // Stores the heartbeat interval ID (keeps discussions active)
let p2pInitialized = false; // Flag to ensure the P2P system is initialized only once

// These globals will be set when initializeP2PSystem() is called.
let peer, connections, knownPeers, processedPeerLists, usernames, API_URL;
let usernameInput, setUsernameButton, peerIdInput, connectButton, messageInput, sendButton;
let activeDiscussionName = null; // Tracks the currently advertised discussion name
let myUsername = ''; // Global username (updated via setUsername())

/**
 * playChat()
 *
 * Called when the user clicks “Chat.” It makes the chat section visible,
 * opens the left pane, initializes the P2P system (if not already initialized),
 * and then sets the username.
 */
function playChat() {
  // Open chat window: make sure the chat section is visible.
  const chatSection = document.getElementById('chat-section');
  if (chatSection.style.display === "none") {
    chatSection.style.display = "block";
  }

  // Open the left pane so the reader knows where the player is.
  openLeftPane();

  // Initialize the P2P system (if not already initialized).
  if (!p2pInitialized) {
    const initObj = initializeP2PSystem();
    // Assign the returned objects and DOM elements to our global variables.
    peer = initObj.peer;
    connections = initObj.connections;
    knownPeers = initObj.knownPeers;
    processedPeerLists = initObj.processedPeerLists;
    usernames = initObj.usernames;
    API_URL = initObj.API_URL;
    usernameInput = initObj.usernameInput;
    setUsernameButton = initObj.setUsernameButton;
    peerIdInput = initObj.peerIdInput;
    connectButton = initObj.connectButton;
    messageInput = initObj.messageInput;
    sendButton = initObj.sendButton;

    p2pInitialized = true; // Mark as initialized.

    // Attach DOM event listeners for sending messages and manual connection.
    sendButton.addEventListener('click', () => {
      const message = messageInput.value.trim();
      if (message) sendMessage(message);
      messageInput.value = '';
    });

    connectButton.addEventListener('click', () => {
      const peerIdVal = peerIdInput.value.trim();
      if (peerIdVal) connectToPeer(peerIdVal);
    });

    // Attach PeerJS event listeners.

    // When the PeerJS connection opens, display the Peer ID and set the username.
    peer.on('open', (id) => {
      console.log('Your Peer ID:', id);
      appendMessage(`Your Peer ID: ${id}`);
      const myPeerIdDiv = document.getElementById('my-peer-id');
      if (myPeerIdDiv) { myPeerIdDiv.textContent = id; }
      knownPeers.add(id); // Add self to known peers.
      // If myUsername has been set, propagate it; otherwise, use default.
      if (myUsername && myUsername.trim()) {
        setUsername(myUsername);
      } else {
        setUsername('Anon');
      }
    });

    // Handle incoming connections.
    peer.on('connection', (conn) => {
      connections[conn.peer] = conn;
      knownPeers.add(conn.peer);
      usernames[conn.peer] = "Anonymous"; // Default username for new peers.
      // appendMessage(`Connected to: ${conn.peer}`);

      conn.on('data', (data) => {
        // Handle incoming data.
        if (data.type === 'message') {
            const sender = usernames[conn.peer] || conn.peer;
            // Sanitize the incoming message without adding the sender’s name
            let sanitizedMsg = sanitizeHTML(data.message);
            sanitizedMsg = chatOptions(sanitizedMsg, sender); // Process incoming message
            console.log(sanitizedMsg);
            appendMessage(`${sender}: ${sanitizedMsg}`);        
        } else if (data.type === 'peer-list' && !processedPeerLists.has(data.id)) {
          processedPeerLists.add(data.id);
          data.peers.forEach((peerId) => {
            if (!connections[peerId] && peerId !== peer.id) {
              appendMessage(`Discovered new peer: ${peerId}`);
              connectToPeer(peerId);
            }
          });
          propagatePeerList(conn.peer);
        } else if (data.type === 'username-update') {
          usernames[conn.peer] = data.username;
          appendMessage(`${data.username} has joined the discussion`);
        } else if (data.type === 'request-username') {
            // When a peer requests your username, send it immediately.
            conn.send({ type: 'username-update', username: myUsername });
        }
      });

      conn.on('close', () => {
        appendMessage(`Connection closed: ${conn.peer}`);
        delete connections[conn.peer];
        knownPeers.delete(conn.peer);
        delete usernames[conn.peer];
        propagatePeerList();
      });

      // Send the initial username update and propagate the peer list.
      conn.send({ type: 'username-update', username: myUsername });
      propagatePeerList(conn.peer);
    });

    // Handle PeerJS errors.
    peer.on('error', (err) => {
      appendMessage(`Error: ${err.message}`);
      // console.error('PeerJS Error:', err);
    });
  }

  // Now that the P2P system is initialized, adopt the global username.
  let usernameCookie = getSiteSpecificCookie(flaskSiteUrl, 'username');
  if (!usernameCookie) { usernameCookie = 'Anonymous'; }
  setUsername(usernameCookie);
}

/**
 * initializeP2PSystem()
 *
 * Creates the PeerJS peer and sets up objects and DOM element references.
 * Returns an object containing all variables needed by the rest of the script.
 */
function initializeP2PSystem() {
  // Initialize PeerJS.
  const peer = new Peer();

  // Initialize variables and objects.
  const connections = {};
  const knownPeers = new Set();
  const processedPeerLists = new Set(); // Track processed peer list messages.
  const usernames = {}; // Map of peer IDs to usernames.

  // API URL for advertising discussions (replace with your actual endpoint).
  const API_URL = 'https://datastore.downes.ca/api/discussions';

  // Initialize DOM elements.
  const usernameInput = document.getElementById('usernameInput');
  const setUsernameButton = document.getElementById('setUsernameButton');
  const peerIdInput = document.getElementById('peerIdInput');
  const connectButton = document.getElementById('connectButton');
  const messageInput = document.getElementById('messageInput');
  const sendButton = document.getElementById('sendButton');

  return {
    peer,
    connections,
    knownPeers,
    processedPeerLists,
    usernames,
    API_URL,
    usernameInput,
    setUsernameButton,
    peerIdInput,
    connectButton,
    messageInput,
    sendButton,
  };
}

/**
 * appendMessage(message, isOwn)
 *
 * Appends messages and logs to the chat window (with sanitized HTML).
 */
function appendMessage(message, isOwn = false) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHTML(message);
  div.style.textAlign = isOwn ? 'right' : 'left';
  document.getElementById('chat-messages').appendChild(div);
}

/**
 * setUsername(newUsername)
 *
 * Updates the username and propagates the change to all connected peers.
 */
function setUsername(newUsername) {
  if (newUsername && typeof newUsername === 'string' && newUsername.trim()) {
    const trimmedUsername = newUsername.trim();
    myUsername = trimmedUsername; // Update the global username.
    // In CList chat usernames map to the CList username
    // appendMessage(`Your username is now: ${myUsername}`);

    // Propagate the username update to all connected peers.
    // (At this point, connections is defined because the P2P system is already initialized.)
    Object.values(connections).forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'username-update', username: myUsername });
      }
    });
  } else {
    appendMessage("Invalid username. Please enter a valid username.");
  }
}

/**
 * propagatePeerList(senderId)
 *
 * Sends the current list of known peers to all connected peers.
 */
function propagatePeerList(senderId = null) {
  const peerList = Array.from(knownPeers);
  const messageId = `peer-list-${Date.now()}`;
  processedPeerLists.add(messageId);

  Object.values(connections).forEach((conn) => {
    if (conn.open && conn.peer !== senderId) {
      conn.send({ type: 'peer-list', peers: peerList, id: messageId });
    }
  });
}

/**
 * connectToPeer(peerId, discussionName)
 *
 * Attempts to connect to another peer and sets up the necessary listeners.
 */
function connectToPeer(peerId, discussionName) {
  // alert('Connecting to peer: ' + peerId + ' Discussion Name: ' + discussionName);
  if (connections[peerId]) return;

  //appendMessage(`Attempting to connect to: ${peerId}`);
  appendMessage(`Discussion Name: ${discussionName}`);
  const conn = peer.connect(peerId);
  connections[peerId] = conn;
  if (discussionName) { activeDiscussionName = discussionName; }  // Set the active discussion name

  conn.on('open', () => {
    // appendMessage(`Successfully connected to: ${peerId}`);
    knownPeers.add(peerId);
    usernames[peerId] = "Anonymous"; // Default until updated
    
    // Send your own username to the remote peer.
    conn.send({ type: 'username-update', username: myUsername });
    // Request the remote peer's username.
    conn.send({ type: 'request-username' });
    
    toggleDiv('discussion-button-div');
    toggleDiv('end-discussion-div');
    startHeartbeat(); // Start the heartbeat to keep the discussion alive
    propagatePeerList();
  });
  

  conn.on('data', (data) => {
    if (data.type === 'message') {
        const sender = usernames[conn.peer] || conn.peer;
        // Sanitize the incoming message without adding the sender’s name
        let sanitizedMsg = sanitizeHTML(data.message);
        sanitizedMsg = chatOptions(sanitizedMsg, sender); // Process incoming message
        console.log(sanitizedMsg);
        appendMessage(`${sender}: ${sanitizedMsg}`);
    } else if (data.type === 'peer-list' && !processedPeerLists.has(data.id)) {
      processedPeerLists.add(data.id);
      data.peers.forEach((peerId) => {
        if (!connections[peerId] && peerId !== peer.id) {
          appendMessage(`Discovered new peer: ${peerId}`);
          connectToPeer(peerId);
        }
      });
      propagatePeerList(conn.peer);
    } else if (data.type === 'username-update') {
      usernames[conn.peer] = data.username;
      appendMessage(`${data.username} has joined the discussion`);
    } else if (data.type === 'request-username') {
        // When a peer requests your username, send it immediately.
        conn.send({ type: 'username-update', username: myUsername });
    }
  });

  conn.on('close', () => {
    appendMessage(`Connection closed: ${peerId}`);
    delete connections[peerId];
    knownPeers.delete(peerId);
    delete usernames[peerId];
    propagatePeerList();
  });

  // Move the chat-section to the top of the left pane.
  const leftContent = document.getElementById('left-content');
  if (leftContent) {
    leftContent.prepend(document.getElementById('chat-section'));
  }
}

/**
 * sendMessage(message)
 *
 * Sends a message to all connected peers.
 */
function sendMessage(message) {
  const sanitizedMessage = sanitizeHTML(`You (${myUsername}): ${message}`);
  appendMessage(sanitizedMessage, true); // Display locally
  Object.values(connections).forEach((conn) => {
    if (conn.open) {
      conn.send({ type: 'message', message }); // Send raw message
    }
  });
}

/**
 * sanitizeHTML(input)
 *
 * Sanitizes input to allow only a specific set of tags (i, b, em, a).
 */
function sanitizeHTML(input) {
  const allowedTags = ['i', 'b', 'em', 'a'];
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  const elements = doc.body.querySelectorAll('*');

  // Remove disallowed tags.
  elements.forEach((el) => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
    } else if (el.tagName.toLowerCase() === 'a') {
      // Validate href attribute.
      const href = el.getAttribute('href');
      if (!href || !href.startsWith('http')) {
        el.removeAttribute('href');
      }
    }
  });

  return doc.body.innerHTML;
}

/**
 * advertiseDiscussion()
 *
 * Posts discussion details to an external server to advertise a new discussion.
 */
function advertiseDiscussion() {
  const discussionNameInput = document.getElementById('discussionNameInput');
  const discussionName = discussionNameInput.value.trim();

  if (!peer || !peer.id) {
    alert('Peer ID is not available yet. Please wait for the Peer connection to establish.');
    return;
  }

  const peerId = peer.id;

  if (!discussionName) {
    alert('Please enter a discussion name.');
    return;
  }

  console.log(`Advertising discussion: ${discussionName} (ID: ${peerId})`);

  // Post discussion details to the external API endpoint.
  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: discussionName, peerId })
  })
  .then((response) => {
    if (response.ok) {
      console.log('Discussion advertised successfully!');
      appendMessage(`Created discussion: ${discussionName}`);
      if (discussionName) { activeDiscussionName = discussionName; }
      toggleDiv('discussion-button-div');
      toggleDiv('end-discussion-div');
      startHeartbeat();
    } else {
      return response.json().then((data) => {
        throw new Error(data.error || 'Failed to advertise discussion');
      });
    }
  })
  .catch((error) => {
    console.error('Error advertising discussion:', error.message);
    alert(`Error: ${error.message}`);
  });
}

/**
 * startHeartbeat()
 *
 * Starts an interval that periodically sends a heartbeat to keep the discussion active.
 */
function startHeartbeat() {
  if (!activeDiscussionName || !peer || !peer.id) {
    return;
  }

  // Clear any existing heartbeat interval.
  stopHeartbeat();

  heartbeatInterval = setInterval(() => {
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: activeDiscussionName, peerId: peer.id })
    })
    .then((response) => {
      return response.text().then((text) => {
        return { status: response.status, body: text };
      });
    })
    .catch((error) => {
      alert(`Error sending heartbeat: ${error.message}`);
      console.error('Error sending heartbeat:', error);
    });
  }, 60000); // Every 60 seconds.
}

/**
 * stopHeartbeat()
 *
 * Stops the heartbeat interval.
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * refreshDiscussions()
 *
 * Fetches available discussions from the server and populates the discussion list.
 */
function refreshDiscussions() {
  fetch(API_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then((response) => response.json())
  .then((discussions) => {
    const discussionList = document.getElementById('discussion-list');
    discussionList.innerHTML = ''; // Clear previous list.
    discussionList.style.margin = '5px'; // Optional styling.

    if (discussions.length === 0) {
      // If no discussions, add a note.
      const noDiscussionsMessage = document.createElement('p');
      noDiscussionsMessage.textContent = 'No discussions available. Why not create one yourself?';
      discussionList.appendChild(noDiscussionsMessage);
    } else {
      discussions.forEach((discussion) => {
        const li = document.createElement('li');
        li.style.listStyleType = 'none'; // Remove bullet point.
        const button = document.createElement('button');
        button.textContent = `Join ${discussion.name}`;
        button.onclick = () => connectToPeer(discussion.peerId, discussion.name);
        li.appendChild(button);
        discussionList.appendChild(li);
      });
    }
  })
  .catch((error) => {
    console.error('Error fetching discussions:', error);
    alert('Failed to fetch discussions.');
  });
}

/**
 * endDiscussion()
 *
 * Ends the current discussion by sending a DELETE request and closing all peer connections.
 */
function endDiscussion() {
  // Use the active discussion name or the name from the input field.
  const discussionName = activeDiscussionName || document.getElementById('discussionNameInput').value.trim();
  if (!discussionName) {
    alert('Error: No discussion name found.');
    return;
  }

  fetch(API_URL, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: discussionName })
  })
  .then((response) => {
    if (response.ok) {
      stopHeartbeat(); // Stop the heartbeat.
      // Close all peer connections.
      Object.values(connections).forEach((conn) => {
        if (conn.open) {
          conn.close();
        }
      });
      connections = {}; // Clear the connections object.
      knownPeers.clear(); // Clear the known peers list.
      usernames = {}; // Clear stored usernames.
      console.log('Discussion ended successfully!');
      appendMessage(`Ended discussion: ${discussionName}`);
      activeDiscussionName = null; // Clear the active discussion name.
      toggleDiv('discussion-button-div');
      toggleDiv('end-discussion-div');
      refreshDiscussions(); // Refresh available discussions.
    } else {
      throw new Error('Failed to end discussion');
    }
  })
  .catch((error) => {
    console.error('Error ending discussion:', error);
    alert('Failed to end discussion.');
  });
}

/**
 * chatOptions(content, sender)
 *
 * Processes incoming chat messages for additional options (e.g., Etherpad links).
 */
function chatOptions(content, sender) {
  content = findEtherpadLink(content, sender);
  return content;
}

/**
 * findEtherpadLink(content, sender)
 *
 * Searches for an Etherpad link in the message content and returns a formatted message if found.
 */
function findEtherpadLink(content, sender) {
  // Look for a link using a regular expression.
  const regex = /['"<](https:\/\/[^\s'"><]+)[>\s'"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const link = match[1]; // Extract the link.
    if (link.includes('etherpad')) {
      console.log(`${sender} shared ${link}`);
      return `${sender} shared an Etherpad link (Click on the link to open): <em><i><a onClick="showPadShare('${link}')">${link}</a></i></em>`;
    } else {
      return content;
    }
  }
  return content;
}
