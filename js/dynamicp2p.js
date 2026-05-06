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

// TODO (federation): make this user-selectable from kvstore account settings.
const API_URL = 'https://discussions.mooc.ca/api/discussions';

// These globals will be set when initializeP2PSystem() is called.
let peer, connections, knownPeers, processedPeerLists, usernames;
let usernameInput, setUsernameButton, peerIdInput, connectButton, messageInput, sendButton;
let activeDiscussionName = null; // Tracks the currently advertised discussion name
let pendingShare = null;         // itemID to share once peer.id is ready
let myUsername = ''; // Global username (updated via setUsername())

// DID identity state — null if user has no DID
let myDid          = null; // full did:web URL, e.g. did:web:kvstore.mooc.ca:users:alice
let myDidKey       = null; // did:key derived from Ed25519 public key
let myPublicKeyJwk = null; // Ed25519 public key JWK (from DID document)
let myIdentityKey  = null; // Ed25519 CryptoKey for signing (private, decrypted from kvstore)
let peerDids          = {}; // peerId → did:key
let peerPublicKeyJwks = {}; // peerId → publicKeyJwk (for signature verification)

/**
 * playChat()
 *
 * Called when the user clicks "Chat." It makes the chat section visible,
 * opens the left pane, initializes the P2P system (if not already initialized),
 * and then sets the username.
 */
function playChat() {
  // #chat-section is a sibling of #left-content (not inside it), so it is never
  // cleared by openLeftInterface(). Show it directly, the same way audio-section works.
  document.getElementById('chat-section').style.display = 'block';

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
    usernameInput = initObj.usernameInput;
    setUsernameButton = initObj.setUsernameButton;
    peerIdInput = initObj.peerIdInput;
    connectButton = initObj.connectButton;
    messageInput = initObj.messageInput;
    sendButton = initObj.sendButton;

    p2pInitialized = true; // Mark as initialized.

    // Reveal the Chat button in the left-pane command bar (mirrors audioButton).
    document.getElementById('chatButton').style.display = 'inline-block';

    // Load DID identity once — falls back gracefully if absent.
    initializeDid().catch(err => console.error('DID initialization failed:', err));

    // Attach DOM event listeners for sending messages and manual connection.
    const _doSend = () => {
      const message = messageInput.value.trim();
      if (!message) return;
      messageInput.value = '';
      sendMessage(message).catch(err => {
        console.error('sendMessage failed:', err);
        showStatusMessage('Failed to send message — check your connection and try again.');
      });
    };
    sendButton.addEventListener('click', _doSend);
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _doSend(); }
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
      if (myUsername && myUsername.trim()) {
        setUsername(myUsername);
      } else {
        setUsername('Anon');
      }
      // Execute any share that was triggered before the peer ID was ready.
      if (pendingShare) {
        _executeShareToChat(pendingShare);
        pendingShare = null;
      }
    });

    // Handle incoming connections.
    peer.on('connection', (conn) => {
      connections[conn.peer] = conn;
      usernames[conn.peer] = "Anonymous"; // Default username for new peers.

      // Wait for the data channel to open before sending — PeerJS does not guarantee
      // the channel is ready when peer.on('connection') fires.
      conn.on('open', () => {
        knownPeers.add(conn.peer);
        conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
        propagatePeerList(conn.peer);
      });

      conn.on('data', async (data) => {
        if (data.type === 'message') {
            const sender = usernames[conn.peer] || conn.peer;
            let sanitizedMsg = sanitizeHTML(data.message);
            sanitizedMsg = chatOptions(sanitizedMsg, sender);
            let verifiedMark = '';
            if (data.signature) {
              const verified = await verifySignature(data.message, data.signature, conn.peer);
              if (verified === true) verifiedMark = ' ✓';
              else if (verified === false) {
                console.warn('Signature verification FAILED for', sender, conn.peer);
                verifiedMark = ' ⚠';
              }
            }
            appendMessage(`${sender}${verifiedMark}: ${sanitizedMsg}`);
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
          if (data.did) peerDids[conn.peer] = data.did;
          if (data.publicKeyJwk) peerPublicKeyJwks[conn.peer] = data.publicKeyJwk;
          if (data.didWeb && data.username) {
            const didUsername = data.didWeb.split(':').pop();
            if (didUsername !== data.username)
              console.warn(`Peer identity mismatch: claimed "${data.username}" but DID says "${didUsername}"`);
          }
          const joinLabel = data.did ? `${data.username} (DID)` : data.username;
          appendMessage(`${joinLabel} has joined the discussion`);
        } else if (data.type === 'request-username') {
            conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
        } else if (data.type === 'collab-invite') {
            const sender = usernames[conn.peer] || conn.peer;
            appendCollabInviteCard(data, sender);
        }
      });

      conn.on('close', () => {
        appendMessage(`Connection closed: ${conn.peer}`);
        delete connections[conn.peer];
        knownPeers.delete(conn.peer);
        delete usernames[conn.peer];
        delete peerDids[conn.peer];
        delete peerPublicKeyJwks[conn.peer];
        propagatePeerList();
      });

      conn.on('error', (err) => {
        console.error('Inbound connection error:', conn.peer, err);
        appendMessage(`Connection error with ${usernames[conn.peer] || conn.peer}: ${err.message} — they may have lost their connection. Try rejoining the discussion.`);
      });
    });

    // Handle PeerJS errors — different types need different responses.
    peer.on('error', (err) => {
      console.error('PeerJS error:', err.type, err);
      switch (err.type) {
        case 'disconnected':
          appendMessage('Lost connection to signaling server — reconnecting…');
          peer.reconnect();
          break;
        case 'peer-unavailable':
          appendMessage('That peer is no longer available — they may have left the discussion.');
          break;
        case 'browser-incompatible':
          showStatusMessage('Your browser does not support WebRTC. Try a modern browser such as Chrome or Firefox.');
          break;
        default:
          appendMessage(`Connection error (${err.type}): ${err.message}`);
      }
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
    usernameInput,
    setUsernameButton,
    peerIdInput,
    connectButton,
    messageInput,
    sendButton,
  };
}

/**
 * initializeDid()
 *
 * Fetches the logged-in user's DID document from kvstore. If found, populates
 * myDid and myDidKey so they are included in connection handshakes. If the user
 * has no DID the globals stay null and everything works without DID features.
 */
async function initializeDid() {
  const user = getSiteSpecificCookie(flaskSiteUrl, 'username');
  if (!user) return;
  try {
    const res = await fetch(`${flaskSiteUrl}/users/${user}/did.json`);
    if (!res.ok) return;
    const doc = await res.json();
    myDid          = doc.id ?? null;
    myDidKey       = doc.alsoKnownAs?.find(a => a.startsWith('did:key:')) ?? null;
    myPublicKeyJwk = doc.verificationMethod?.[0]?.publicKeyJwk ?? null;
    myIdentityKey  = await loadIdentityKey();
    if (myIdentityKey) console.log('DID identity ready — message signing enabled.');
  } catch (err) {
    console.error('initializeDid failed:', err);
    /* no DID — graceful fallback */
  }
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
        conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
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
  if (processedPeerLists.size > 500) processedPeerLists.clear();
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

  if (discussionName) appendMessage(`Joining: ${discussionName}`);
  const conn = peer.connect(peerId);
  connections[peerId] = conn;
  if (discussionName) { activeDiscussionName = discussionName; }  // Set the active discussion name

  conn.on('open', () => {
    // appendMessage(`Successfully connected to: ${peerId}`);
    knownPeers.add(peerId);
    usernames[peerId] = "Anonymous"; // Default until updated
    
    // Send your own username to the remote peer.
    conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
    // Request the remote peer's username.
    conn.send({ type: 'request-username' });
    
    toggleDiv('discussion-button-div');
    toggleDiv('end-discussion-div');
    startHeartbeat(); // Start the heartbeat to keep the discussion alive
    propagatePeerList();
  });
  

  conn.on('data', async (data) => {
    if (data.type === 'message') {
        const sender = usernames[conn.peer] || conn.peer;
        let sanitizedMsg = sanitizeHTML(data.message);
        sanitizedMsg = chatOptions(sanitizedMsg, sender);
        let verifiedMark = '';
        if (data.signature) {
          const verified = await verifySignature(data.message, data.signature, conn.peer);
          if (verified === true) verifiedMark = ' ✓';
          else if (verified === false) {
            console.warn('Signature verification FAILED for', sender, conn.peer);
            verifiedMark = ' ⚠';
          }
        }
        appendMessage(`${sender}${verifiedMark}: ${sanitizedMsg}`);
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
      if (data.did) peerDids[conn.peer] = data.did;
      if (data.publicKeyJwk) peerPublicKeyJwks[conn.peer] = data.publicKeyJwk;
      if (data.didWeb && data.username) {
        const didUsername = data.didWeb.split(':').pop();
        if (didUsername !== data.username)
          console.warn(`Peer identity mismatch: claimed "${data.username}" but DID says "${didUsername}"`);
      }
      const joinLabel = data.did ? `${data.username} (DID)` : data.username;
      appendMessage(`${joinLabel} has joined the discussion`);
    } else if (data.type === 'request-username') {
        conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
    }
  });

  conn.on('close', () => {
    appendMessage(`Connection closed: ${peerId}`);
    delete connections[peerId];
    knownPeers.delete(peerId);
    delete usernames[peerId];
    delete peerDids[peerId];
    delete peerPublicKeyJwks[peerId];
    propagatePeerList();
  });

  conn.on('error', (err) => {
    console.error('Outbound connection error:', peerId, err);
    appendMessage(`Connection error with ${usernames[peerId] || peerId}: ${err.message} — they may have lost their connection. Try rejoining the discussion.`);
  });

}

/**
 * shareToChat(itemID)
 *
 * Opens chat if needed, creates a discussion named after the item, and shares
 * the item link as the opening message. If peer.id is not yet assigned (PeerJS
 * handshake still in flight), stores the itemID in pendingShare and lets
 * peer.on('open') complete the action.
 */
function shareToChat(itemID) {
  const el = document.getElementById(itemID);
  if (!el || !el.reference) {
    showStatusMessage('Could not find item to share.');
    return;
  }
  if (!p2pInitialized) {
    playChat();
    pendingShare = itemID;
    return;
  }
  if (!peer || !peer.id) {
    pendingShare = itemID;
    return;
  }
  _executeShareToChat(itemID);
}

// Returns a human-readable discussion title from a feed item reference.
// Falls back to author_name for social posts whose title field is just the platform name.
function _shareTitleFromReference(ref) {
  if (ref.title && ref.title !== 'Mastodon' && ref.title !== 'Bluesky') {
    return ref.title.length > 60 ? ref.title.slice(0, 57) + '…' : ref.title;
  }
  return ref.author_name ? ref.author_name + "'s post" : 'Discussion';
}

// Creates a discussion named after the item (if none active) and sends text + link.
function _executeShareToChat(itemID) {
  const el = document.getElementById(itemID);
  if (!el || !el.reference) { showStatusMessage('Could not find item to share.'); return; }
  const ref = el.reference;

  if (!activeDiscussionName) {
    const nameInput = document.getElementById('discussionNameInput');
    if (nameInput) nameInput.value = _shareTitleFromReference(ref);
    advertiseDiscussion();
  }

  // Extract plain text from the rendered element, collapse whitespace, truncate to 500 chars.
  const rawText = el.textContent.replace(/\s+/g, ' ').trim();
  const excerpt = rawText.length > 500 ? rawText.slice(0, 497) + '…' : rawText;

  const displayText = (ref.title && ref.title !== 'Mastodon' && ref.title !== 'Bluesky')
    ? ref.title : (ref.author_name || ref.url || itemID);
  const link = ref.url
    ? `<a href="${ref.url}" target="_blank" rel="noopener noreferrer">${displayText}</a>`
    : displayText;

  const message = excerpt ? `${excerpt}<br><br>${link}` : link;
  sendMessage(message).catch(err => {
    console.error('shareToChat failed:', err);
    showStatusMessage('Failed to share to chat.');
  });
}

/**
 * sendMessage(message)
 *
 * Sends a message to all connected peers.
 */
/**
 * Send a collab document invite to all connected peers.
 * Returns true if at least one connection was open, false if no peers are connected.
 */
window.sendCollabInvite = function(invite) {
  if (!connections || Object.keys(connections).length === 0) return false;
  let sent = false;
  Object.values(connections).forEach(conn => {
    if (conn.open) { conn.send({ type: 'collab-invite', ...invite }); sent = true; }
  });
  if (sent) appendCollabInviteCard(invite, `You (${myUsername})`);
  return sent;
};

/**
 * Render a collab invite as a card in the chat panel.
 */
function appendCollabInviteCard(invite, sender) {
  const wrapper = document.createElement('div');
  wrapper.style.textAlign = 'left';
  const card = document.createElement('div');
  card.style.cssText = 'display:inline-block;border:1px solid #ccc;border-radius:6px;padding:8px 12px;margin:4px 0;background:#f9f9f9;max-width:320px';
  const modeLabel = invite.mode === 'read' ? 'view' : 'co-edit';
  const docLabel  = sanitizeHTML(invite.title || invite.docId || 'a document');
  const senderLabel = sanitizeHTML(sender);
  card.innerHTML = `<strong>${senderLabel}</strong> invites you to ${modeLabel} <em>${docLabel}</em>`;
  const btn = document.createElement('button');
  btn.textContent = 'Open in Collab';
  btn.style.cssText = 'display:block;margin-top:6px;padding:3px 10px;cursor:pointer';
  btn.addEventListener('click', () => {
    if (typeof window.openCollabInvite === 'function') window.openCollabInvite(invite);
    else showStatusMessage('Collab editor not available.');
  });
  card.appendChild(btn);
  wrapper.appendChild(card);
  document.getElementById('chat-messages').appendChild(wrapper);
}

async function sendMessage(message) {
  const sanitizedMessage = sanitizeHTML(`You (${myUsername}): ${message}`);
  appendMessage(sanitizedMessage, true); // Display locally
  const signature = await signMessage(message); // null until Layer 2
  Object.values(connections).forEach((conn) => {
    if (conn.open) {
      conn.send({ type: 'message', message, did: myDidKey, signature }); // Send raw message
    }
  });
}

/**
 * sanitizeHTML(input)
 *
 * Sanitizes input to allow only a specific set of tags (i, b, em, a).
 */
function sanitizeHTML(input) {
  const allowedTags = ['i', 'b', 'em', 'a', 'br'];
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
    showStatusMessage('Peer ID not available yet — please wait for the connection to establish.');
    return;
  }

  const peerId = peer.id;

  if (!discussionName) {
    showStatusMessage('Please enter a discussion name.');
    return;
  }

  console.log(`Advertising discussion: ${discussionName} (ID: ${peerId})`);

  // Post discussion details to the external API endpoint.
  const _advertiseToken = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _advertiseToken,
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
    showStatusMessage('Error advertising discussion: ' + error.message);
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
    const _heartbeatToken = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + _heartbeatToken,
      },
      body: JSON.stringify({ name: activeDiscussionName, peerId: peer.id })
    })
    .then((response) => {
      if (response.status === 401) {
        console.warn('Heartbeat: session expired — discussion may expire soon.');
        showStatusMessage('Your session has expired. Log in again to keep the discussion alive.');
        stopHeartbeat();
      } else if (!response.ok) {
        console.warn('Heartbeat: server returned', response.status);
      }
    })
    .catch((error) => {
      console.error('Heartbeat failed — discussion may expire if this continues:', error);
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
  const _refreshToken = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
  fetch(API_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _refreshToken,
    },
  })
  .then((response) => {
    const discussionList = document.getElementById('discussion-list');
    discussionList.innerHTML = '';
    discussionList.style.margin = '5px';
    if (response.status === 401) {
      const msg = document.createElement('p');
      msg.textContent = 'Please log in to view or join discussions.';
      discussionList.appendChild(msg);
      return null;
    }
    return response.json();
  })
  .then((discussions) => {
    if (!discussions) return;
    const discussionList = document.getElementById('discussion-list');

    if (discussions.length === 0) {
      const noDiscussionsMessage = document.createElement('p');
      noDiscussionsMessage.textContent = 'No discussions available. Why not create one yourself?';
      discussionList.appendChild(noDiscussionsMessage);
    } else {
      discussions.forEach((discussion) => {
        const li = document.createElement('li');
        li.style.listStyleType = 'none';
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
    const discussionList = document.getElementById('discussion-list');
    if (discussionList) {
      const msg = document.createElement('p');
      msg.textContent = 'Could not load discussions — check your connection and try again.';
      discussionList.appendChild(msg);
    }
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
    showStatusMessage('No discussion name found.');
    return;
  }

  const _endToken = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
  fetch(API_URL, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _endToken,
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
      // Clear in-place — do not reassign globals; pending close handlers still reference them.
      Object.keys(connections).forEach(k => delete connections[k]);
      Object.keys(usernames).forEach(k => delete usernames[k]);
      Object.keys(peerDids).forEach(k => delete peerDids[k]);
      knownPeers.clear();
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
    showStatusMessage('Failed to end discussion: ' + error.message);
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

// ── DID signing: key loading, signing, and verification ──────────────────────
//
// loadIdentityKey()  — fetches and decrypts _did_identity_key from kvstore
// signMessage()      — signs outgoing messages with the Ed25519 private key
// verifySignature()  — verifies a signature against the sender's stored publicKeyJwk
//
// All three return null gracefully if no DID is present, keeping chat functional
// for users who have not generated an identity key.

async function loadIdentityKey() {
  const token  = getSiteSpecificCookie(flaskSiteUrl, 'access_token');
  const encKey = await getEncKey(flaskSiteUrl);
  if (!token || !encKey) return null;
  try {
    const res = await fetch(`${flaskSiteUrl}/get_kvs/`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return null;
    const kvs   = await res.json();
    const entry = kvs.find(kv => kv.key === '_did_identity_key');
    if (!entry) return null;
    return await decryptIdentityPrivateKey(entry.value, encKey);
  } catch (err) {
    console.error('loadIdentityKey failed:', err);
    return null;
  }
}

async function signMessage(message) {
  if (!myIdentityKey) return null;
  try {
    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = await crypto.subtle.sign('Ed25519', myIdentityKey, msgBytes);
    return btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (err) {
    console.error('signMessage failed:', err);
    return null;
  }
}

// peerId is used to look up the stored publicKeyJwk for that peer.
// Returns true (valid), false (invalid — treat as suspicious), or null (can't verify).
async function verifySignature(message, signature, peerId) {
  const jwk = peerPublicKeyJwks[peerId];
  if (!jwk || !signature) return null;
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'Ed25519' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    const msgBytes = new TextEncoder().encode(message);
    return await crypto.subtle.verify('Ed25519', publicKey, sigBytes, msgBytes);
  } catch (err) {
    console.error('verifySignature failed:', err);
    return null;
  }
}
