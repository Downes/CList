// dynamicp2p.js  -  helper and utility functions for dynamic P2P connections
// Part of CList, the next generation of learning and connecting with your community
//
// Version 0.1 created by Stephen Downes on January 27, 2025
//
// Copyright Stephen Downes 2025
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
let peer, connections, knownPeers, processedPeerLists, processedMsgIds, usernames;
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
let peerAnnotationStores = {}; // peerId → annotation store URL (announced on connect)

let chatBc = null; // BroadcastChannel to chat popup window, null when no popup is open

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
    processedMsgIds = initObj.processedMsgIds;
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
      appendMessage(`Your Peer ID: ${id}`, false, true);
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
        _sendServiceAnnounce(conn);
      });

      conn.on('data', async (data) => {
        if (data.type === 'message') {
            // Deduplicate relayed messages; assign an ID if the sender didn't include one.
            if (!data.msgId) data = { ...data, msgId: `${conn.peer}-${Date.now()}-${Math.random()}` };
            if (processedMsgIds.has(data.msgId)) return;
            processedMsgIds.add(data.msgId);
            const sender = data.username || usernames[conn.peer] || conn.peer;
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
            // Relay to all other connections so peers not directly linked receive the message.
            Object.values(connections).forEach((c) => {
              if (c.open && c.peer !== conn.peer) c.send(data);
            });
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
          _appendJoinCard(data);
        } else if (data.type === 'request-username') {
            conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
        } else if (data.type === 'collab-invite') {
            const sender = usernames[conn.peer] || conn.peer;
            appendCollabInviteCard(data, sender);
        } else if (data.type === 'share') {
            if (!data.msgId) data = { ...data, msgId: `${conn.peer}-${Date.now()}-${Math.random()}` };
            if (!processedMsgIds.has(data.msgId)) {
              processedMsgIds.add(data.msgId);
              const sender = data.username || usernames[conn.peer] || conn.peer;
              appendShareCard(data, sender);
              Object.values(connections).forEach(c => { if (c.open && c.peer !== conn.peer) c.send(data); });
            }
        } else if (data.type === 'service-announce') {
            if (data.annotationStore) peerAnnotationStores[conn.peer] = data.annotationStore;
        }
      });

      conn.on('close', () => {
        appendMessage(`Connection closed: ${conn.peer}`);
        delete connections[conn.peer];
        knownPeers.delete(conn.peer);
        delete usernames[conn.peer];
        delete peerDids[conn.peer];
        delete peerPublicKeyJwks[conn.peer];
        delete peerAnnotationStores[conn.peer];
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
          appendMessage('That peer is no longer available — they may have left the discussion.', false, true);
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
  let usernameCookie = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
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
  peer = new Peer();

  // Initialize variables and objects.
  connections = {};
  knownPeers = new Set();
  processedPeerLists = new Set(); // Track processed peer list messages.
  processedMsgIds = new Set(); // Track relayed message IDs to prevent loops.
  usernames = {}; // Map of peer IDs to usernames.

  // Initialize DOM elements.
  usernameInput = document.getElementById('usernameInput');
  setUsernameButton = document.getElementById('setUsernameButton');
  peerIdInput = document.getElementById('peerIdInput');
  connectButton = document.getElementById('connectButton');
  messageInput = document.getElementById('messageInput');
  sendButton = document.getElementById('sendButton');

  return {
    peer,
    connections,
    knownPeers,
    processedPeerLists,
    processedMsgIds,
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
  const user = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.USERNAME);
  if (!user) return;
  try {
    const res = await fetch(`${window.CList.config.flaskSiteUrl}/users/${user}/did.json`);
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
function appendMessage(message, isOwn = false, isEvent = false) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHTML(message);
  if (isEvent) {
    div.classList.add('chat-event');
  } else {
    div.style.textAlign = isOwn ? 'right' : 'left';
  }
  document.getElementById('chat-messages').appendChild(div);
  if (chatBc) chatBc.postMessage({ type: 'chat-msg', html: div.innerHTML, isOwn, isEvent });
}

// Render a join event with an optional Follow button for peers who have a DID.
function _appendJoinCard(data) {
  const wrapper = document.createElement('div');
  wrapper.className = 'chat-event';

  const text = document.createElement('span');
  text.textContent = `${data.did ? `${data.username} (DID)` : data.username} has joined the discussion`;
  wrapper.appendChild(text);

  const token = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
  if (data.didWeb && token && data.didWeb !== myDid) {
    const followBtn = document.createElement('button');
    followBtn.className = 'clist-action-btn';
    followBtn.title     = 'Follow this person';
    followBtn.style.marginLeft = '6px';
    followBtn.innerHTML = '<span class="material-icons md-18 md-light">person_add</span>';
    followBtn.addEventListener('click', () => {
      if (typeof window._followUser === 'function') {
        window._followUser(data.didWeb, token, followBtn).catch(e => {
          showStatusMessage('Follow error: ' + e.message);
          console.error('Follow error', e);
        });
      } else {
        showStatusMessage('Follow not available.');
      }
    });
    wrapper.appendChild(followBtn);
  }

  document.getElementById('chat-messages').appendChild(wrapper);
  if (chatBc) chatBc.postMessage({ type: 'chat-msg', html: text.textContent, isOwn: false, isEvent: true });
}

// Returns this user's annotation store URL from their configured Annotate account, or null.
function _getMyAnnotationStoreUrl() {
  const acct = (window.CList.accounts || [])
    .map(a => (typeof parseAccountValue === 'function' ? parseAccountValue(a) : null))
    .filter(Boolean)
    .find(d => d.type === 'Annotate' && d.instance);
  return acct ? acct.instance : null;
}

// Sends this user's annotation store URL to a newly connected peer.
function _sendServiceAnnounce(conn) {
  const storeUrl = _getMyAnnotationStoreUrl();
  if (storeUrl) conn.send({ type: 'service-announce', annotationStore: storeUrl });
}

// Returns the annotation store URLs currently announced by connected peers.
window.getPeerAnnotationStores = function() {
  return Object.values(peerAnnotationStores).filter(Boolean);
};

/**
 * startCollabFromChat()
 *
 * Collects recent plain-text chat messages (excluding share cards), then
 * calls openCollabFromChat() to create a new Collab document seeded with
 * that context. The collab invite is automatically broadcast to peers.
 */
function startCollabFromChat() {
  if (typeof window.openCollabFromChat !== 'function') {
    showStatusMessage('Collab editor not available.');
    return;
  }
  const msgs = document.getElementById('chat-messages');
  const contextHtml = msgs
    ? Array.from(msgs.children)
        .filter(el => !el.querySelector('.chat-share-card') && el.textContent.trim())
        .slice(-15)
        .map(el => `<p>${el.innerHTML}</p>`)
        .join('')
    : '';
  window.openCollabFromChat(contextHtml || null, activeDiscussionName);
}

/**
 * openChatPopup()
 *
 * Opens chat-popup.html in a separate browser window and wires it up via
 * BroadcastChannel. The main window retains the WebRTC peer connection;
 * the popup receives relayed messages and sends outgoing ones back through
 * the channel so the main window can forward them to peers.
 */
function openChatPopup() {
  window.open('chat-popup.html', 'clist-chat-popup', 'width=420,height=620,resizable=yes');

  if (chatBc) return; // already open — window.open will focus the existing one

  chatBc = new BroadcastChannel('clist-chat');
  chatBc.onmessage = (e) => {
    if (e.data.type === 'popup-ready') {
      chatBc.postMessage({ type: 'chat-state', discussionName: activeDiscussionName });
    } else if (e.data.type === 'send-msg') {
      if (e.data.message && p2pInitialized) sendMessage(e.data.message);
    } else if (e.data.type === 'start-collab-from-chat') {
      startCollabFromChat();
    } else if (e.data.type === 'popup-closed') {
      chatBc.close();
      chatBc = null;
    }
  };
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
    conn.send({ type: 'request-username' });
    _sendServiceAnnounce(conn);
    
    toggleDiv('discussion-button-div');
    toggleDiv('end-discussion-div');
    document.body.classList.add('chat-active');
    startHeartbeat(); // Start the heartbeat to keep the discussion alive
    propagatePeerList();
  });
  

  conn.on('data', async (data) => {
    if (data.type === 'message') {
        // Deduplicate relayed messages; assign an ID if the sender didn't include one.
        if (!data.msgId) data = { ...data, msgId: `${conn.peer}-${Date.now()}-${Math.random()}` };
        if (processedMsgIds.has(data.msgId)) return;
        processedMsgIds.add(data.msgId);
        const sender = data.username || usernames[conn.peer] || conn.peer;
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
        // Relay to all other connections so peers not directly linked receive the message.
        Object.values(connections).forEach((c) => {
          if (c.open && c.peer !== conn.peer) c.send(data);
        });
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
      _appendJoinCard(data);
    } else if (data.type === 'request-username') {
        conn.send({ type: 'username-update', username: myUsername, did: myDidKey, didWeb: myDid, publicKeyJwk: myPublicKeyJwk });
    } else if (data.type === 'collab-invite') {
        const sender = usernames[conn.peer] || conn.peer;
        appendCollabInviteCard(data, sender);
    } else if (data.type === 'share') {
        if (!data.msgId) data = { ...data, msgId: `${conn.peer}-${Date.now()}-${Math.random()}` };
        if (!processedMsgIds.has(data.msgId)) {
          processedMsgIds.add(data.msgId);
          const sender = data.username || usernames[conn.peer] || conn.peer;
          appendShareCard(data, sender);
          Object.values(connections).forEach(c => { if (c.open && c.peer !== conn.peer) c.send(data); });
        }
    } else if (data.type === 'service-announce') {
        if (data.annotationStore) peerAnnotationStores[conn.peer] = data.annotationStore;
    }
  });

  conn.on('close', () => {
    appendMessage(`Connection closed: ${peerId}`);
    delete connections[peerId];
    knownPeers.delete(peerId);
    delete usernames[peerId];
    delete peerDids[peerId];
    delete peerPublicKeyJwks[peerId];
    delete peerAnnotationStores[peerId];
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

  sendShareMessage('item', ref.url, displayText, excerpt || null);
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
  // Build card content via DOM so peer-supplied strings are always treated as text.
  const strong = document.createElement('strong');
  strong.textContent = sender;
  const em = document.createElement('em');
  em.textContent = invite.title || localPartOf(invite.docId) || invite.docId || 'a document';
  card.appendChild(strong);
  card.appendChild(document.createTextNode(` invites you to ${modeLabel} `));
  card.appendChild(em);
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = 'Open in Collab';
  btn.addEventListener('click', () => {
    if (typeof window.openCollabInvite === 'function') window.openCollabInvite(invite);
    else showStatusMessage('Collab editor not available.');
  });
  card.appendChild(btn);
  wrapper.appendChild(card);
  document.getElementById('chat-messages').appendChild(wrapper);
  if (chatBc) {
    const text = `${sender} shared a collab document: ${invite.title || invite.docId || 'a document'}`;
    chatBc.postMessage({ type: 'chat-msg', html: `<em>${text}</em>`, isOwn: false, isEvent: false });
  }
}

/**
 * appendShareCard(data, sender)
 *
 * Renders a structured share card in #chat-messages. sender = null means the
 * local user sent it (right-aligned). Also relays a simplified version to the
 * chat popup via BroadcastChannel.
 */
function appendShareCard(data, sender) {
  const isOwn = (sender === null);
  const displaySender = isOwn ? `You (${myUsername})` : (sender || 'A peer');
  const kindLabel = { item: 'an item', collection: 'a collection', annotation: 'an annotation' }[data.kind] || 'something';

  const wrapper = document.createElement('div');
  wrapper.style.textAlign = isOwn ? 'right' : 'left';

  const card = document.createElement('div');
  card.className = 'chat-share-card';

  const header = document.createElement('div');
  header.className = 'chat-share-header';
  const strong = document.createElement('strong');
  strong.textContent = displaySender;
  header.appendChild(strong);
  header.appendChild(document.createTextNode(` shared ${kindLabel}:`));
  card.appendChild(header);

  if ((data.title || data.url) && data.kind !== 'collection') {
    const titleEl = document.createElement('div');
    titleEl.className = 'chat-share-title';
    if (data.url) {
      const a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = data.title || data.url;
      titleEl.appendChild(a);
    } else {
      titleEl.textContent = data.title || '';
    }
    card.appendChild(titleEl);
  }

  if (data.kind === 'collection' && Array.isArray(data.items) && data.items.length) {
    const details = document.createElement('details');
    details.className = 'chat-share-collection';
    const summary = document.createElement('summary');
    summary.className = 'chat-share-title';
    summary.textContent = data.title || 'Untitled collection';
    details.appendChild(summary);

    const ul = document.createElement('ul');
    ul.className = 'chat-share-items';
    data.items.forEach(item => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.title || item.url || '';
      li.appendChild(nameSpan);
      if (item.url) {
        const btn = document.createElement('button');
        btn.className = 'clist-action-btn';
        btn.title = 'Open in new window';
        btn.innerHTML = '<span class="material-icons md-18 md-light">launch</span>';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openInBrowser(item.url);
        });
        li.appendChild(btn);
      }
      ul.appendChild(li);
    });
    details.appendChild(ul);
    card.appendChild(details);

    const actionsEl = document.createElement('div');
    actionsEl.className = 'chat-share-actions';
    const importBtn = document.createElement('button');
    importBtn.className = 'btn';
    importBtn.textContent = '↓ Add to my collection';
    importBtn.addEventListener('click', () => {
      if (typeof window.importCollectionFromChat === 'function') {
        window.importCollectionFromChat(data.items, importBtn);
      } else {
        showStatusMessage('Collection import not available.');
      }
    });
    actionsEl.appendChild(importBtn);
    card.appendChild(actionsEl);
  }

  if (data.excerpt && data.kind !== 'collection') {
    const excerptEl = document.createElement('div');
    excerptEl.className = 'chat-share-excerpt';
    excerptEl.textContent = data.excerpt;
    card.appendChild(excerptEl);
  }

  if ((data.kind === 'item' || data.kind === 'annotation') && data.url) {
    const actionsEl = document.createElement('div');
    actionsEl.className = 'chat-share-actions';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn';
    loadBtn.textContent = '→ Load to editor';
    loadBtn.addEventListener('click', () => {
      // Build a formatted HTML block: title as link + excerpt if present.
      const safeTitle   = escapeHtml(data.title || data.url || '');
      const safeUrl     = escapeHtml(data.url || '');
      const safeExcerpt = data.excerpt ? `<p>${escapeHtml(data.excerpt)}</p>` : '';
      const html = `<p><strong><a href="${safeUrl}">${safeTitle}</a></strong></p>${safeExcerpt}`;

      if (typeof loadContent === 'function') {
        loadContent({ type: 'text/html', value: html });
      }
      if (typeof pushReference === 'function') {
        pushReference({ url: data.url, title: data.title || data.url, author_name: displaySender,
          feed: 'Chat share', created_at: new Date().toISOString(), id: data.url, guid: data.url });
      }
    });
    actionsEl.appendChild(loadBtn);
    card.appendChild(actionsEl);
  }

  wrapper.appendChild(card);
  document.getElementById('chat-messages').appendChild(wrapper);

  if (chatBc) {
    chatBc.postMessage({ type: 'chat-card', sender: displaySender, kind: data.kind,
      title: data.title || null, url: data.url || null, excerpt: data.excerpt || null,
      items: data.items || null, isOwn });
  }
}

/**
 * sendShareMessage(kind, url, title, excerpt, extra)
 *
 * Sends a structured share card to all connected peers and renders it locally.
 * kind: 'item' | 'collection' | 'annotation'
 * extra: optional additional fields merged into the message (e.g. { items } for collections)
 */
function sendShareMessage(kind, url, title, excerpt, extra = {}) {
  if (!p2pInitialized || !peer || !peer.id) {
    showStatusMessage('Open chat first to share.');
    return;
  }
  const msgId = `${peer.id}-${Date.now()}-${Math.random()}`;
  processedMsgIds.add(msgId);
  const msg = { type: 'share', kind, url, title, excerpt, username: myUsername, msgId, ...extra };
  Object.values(connections).forEach(conn => {
    if (conn.open) conn.send(msg);
  });
  appendShareCard(msg, null);
}

async function sendMessage(message) {
  const sanitizedMessage = sanitizeHTML(`You (${myUsername}): ${message}`);
  appendMessage(sanitizedMessage, true); // Display locally
  const signature = await signMessage(message); // null until Layer 2
  const msgId = `${peer.id}-${Date.now()}-${Math.random()}`;
  processedMsgIds.add(msgId);
  Object.values(connections).forEach((conn) => {
    if (conn.open) {
      conn.send({ type: 'message', message, username: myUsername, did: myDidKey, signature, msgId });
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

  elements.forEach((el) => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
      return;
    }
    // Strip all attributes, then restore only the safe subset.
    const attrsToKeep = {};
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        attrsToKeep.href = href;
      }
      const target = el.getAttribute('target');
      if (target) attrsToKeep.target = '_blank'; // normalise to _blank
      attrsToKeep.rel = 'noopener noreferrer';
    }
    // Remove every attribute on the element.
    [...el.attributes].forEach(attr => el.removeAttribute(attr.name));
    // Re-apply only the vetted ones.
    Object.entries(attrsToKeep).forEach(([k, v]) => el.setAttribute(k, v));
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

  const isPublic = !!(document.getElementById('discussionPublicCheckbox')?.checked);
  console.log(`Advertising discussion: ${discussionName} (ID: ${peerId}, public: ${isPublic})`);

  // Post discussion details to the external API endpoint.
  const _advertiseToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
  fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + _advertiseToken,
    },
    body: JSON.stringify({ name: discussionName, peerId, public: isPublic })
  })
  .then((response) => {
    if (response.ok) {
      console.log('Discussion advertised successfully!');
      appendMessage(`Created discussion: ${discussionName}`, false, true);
      if (discussionName) { activeDiscussionName = discussionName; }
      toggleDiv('discussion-button-div');
      toggleDiv('end-discussion-div');
      document.body.classList.add('chat-active');
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
    const _heartbeatToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
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
  const _refreshToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
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
        button.className = 'btn';
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

  const _endToken = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
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
      Object.keys(peerAnnotationStores).forEach(k => delete peerAnnotationStores[k]);
      knownPeers.clear();
      console.log('Discussion ended successfully!');
      appendMessage(`Ended discussion: ${discussionName}`);
      activeDiscussionName = null; // Clear the active discussion name.
      toggleDiv('discussion-button-div');
      toggleDiv('end-discussion-div');
      document.body.classList.remove('chat-active');
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
  const regex = /['"<](https:\/\/[^\s'"><]+)[>\s'"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const link = match[1];
    if (link.includes('etherpad')) {
      console.log(`${sender} shared ${link}`);
      // Build the anchor safely via DOM instead of string interpolation.
      const a = document.createElement('a');
      a.href = link;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = link;
      a.addEventListener('click', (e) => { e.preventDefault(); showPadShare(link); });
      const em = document.createElement('em');
      const i  = document.createElement('i');
      i.appendChild(a);
      em.appendChild(i);
      const prefix = document.createTextNode(`${sender} shared an Etherpad link (Click on the link to open): `);
      const frag = document.createDocumentFragment();
      frag.appendChild(prefix);
      frag.appendChild(em);
      // appendMessage expects a string; serialise via a temp div.
      const tmp = document.createElement('div');
      tmp.appendChild(frag);
      return tmp.innerHTML;
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
  const token  = getSiteSpecificCookie(window.CList.config.flaskSiteUrl, window.CList.keys.ACCESS_TOKEN);
  const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
  if (!token || !encKey) return null;
  try {
    const res = await fetch(`${window.CList.config.flaskSiteUrl}/get_kvs/`, {
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
