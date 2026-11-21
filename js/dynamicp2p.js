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

// TODO (federation): make this user-selectable from kvstore account settings
// (currently admin-configurable only, via window.CList.defaults -- see defaults.js).
// Each discussion operation captures its own configured service endpoint.

// Compatibility aliases installed by the owned chat-session bridge.
let peer, connections, knownPeers, processedPeerLists, processedMsgIds, usernames;
let activeDiscussionName = null; // Tracks the currently advertised discussion name
let myUsername = ''; // Global username (updated via setUsername())

// DID identity state — null if user has no DID
let myDid          = null; // full did:web URL, e.g. did:web:kvstore.mooc.ca:users:alice
let myDidKey       = null; // did:key derived from Ed25519 public key
let myPublicKeyJwk = null; // Ed25519 public key JWK (from DID document)
let myIdentityKey  = null; // Ed25519 CryptoKey for signing (private, decrypted from kvstore)
let peerDids          = {}; // peerId → did:key
let peerPublicKeyJwks = {}; // peerId → publicKeyJwk (for signature verification)
let peerAnnotationStores = {}; // peerId → annotation store URL (announced on connect)

let chatBc = null; // Guarded compatibility forwarder, never a raw BroadcastChannel.

function playChat() { return openP2pChat(); }
function initializeP2PSystem() { return ensureP2pSession()?.resources; }

async function handleP2pData(conn, data, isCurrent) {
  if (!isCurrent()) return;
  if (!data || typeof data !== 'object') throw Error('Received an invalid chat packet.');
  if (data.type === 'message') {
    return getP2pMessages().receive(conn, data, isCurrent);
  } else if (['peer-list', 'username-update', 'request-username', 'service-announce'].includes(data.type)) {
    return getP2pControl().receive(conn, data);
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
  }
}

/**
 * initializeDid()
 *
 * Fetches the logged-in user's DID document from kvstore. If found, populates
 * myDid and myDidKey so they are included in connection handshakes. If the user
 * has no DID the globals stay null and everything works without DID features.
 */
function initializeDid(isCurrent = captureP2pSessionGuard()) { return getP2pIdentity().load(isCurrent); }

/**
 * appendMessage(message, isOwn)
 *
 * Appends messages and logs to the chat window (with sanitized HTML).
 */
// Render a join event with an optional Follow button for peers who have a DID.
function _appendJoinCard(data) { return getP2pControl().join(data); }

// Returns this user's annotation store URL from their configured Annotate account, or null.
function _getMyAnnotationStoreUrl() {
  const acct = (window.CList.accounts || [])
    .map(a => (typeof parseAccountValue === 'function' ? parseAccountValue(a) : null))
    .filter(Boolean)
    .find(d => d.type === 'Annotate' && d.instance);
  return acct ? acct.instance : null;
}

// Sends this user's annotation store URL to a newly connected peer.
function _sendServiceAnnounce(conn) { return getP2pControl().announce(conn); }

// Returns the annotation store URLs currently announced by connected peers.
window.getPeerAnnotationStores = function() { return _p2pSession?.isCurrent() ? getP2pControl().stores() : []; };

/**
 * startCollabFromChat()
 *
 * Collects recent plain-text chat messages (excluding share cards), then
 * calls openCollabFromChat() to create a new Collab document seeded with
 * that context. The collab invite is automatically broadcast to peers.
 */
function startCollabFromChat() {
  if (typeof window.openCollabFromChat !== 'function') {
    showErrorModal('Collab editor not available.', { title: 'Collab unavailable' });
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
function openChatPopup() { return openOwnedP2pPopup(); }

/**
 * setUsername(newUsername)
 *
 * Updates the username and propagates the change to all connected peers.
 */
function setUsername(newUsername) { return getP2pControl().setName(newUsername); }

/**
 * propagatePeerList(senderId)
 *
 * Sends the current list of known peers to all connected peers.
 */
function propagatePeerList(senderId = null) { return getP2pControl().propagate(senderId); }

/**
 * connectToPeer(peerId, discussionName)
 *
 * Attempts to connect to another peer and sets up the necessary listeners.
 */
function connectToPeer(peerId, discussionName) { return ensureP2pSession()?.connect(peerId, discussionName); }

/**
 * shareToChat(itemID)
 *
 * Opens chat if needed, creates a discussion named after the item, and shares
 * the item link as the opening message. If peer.id is not yet assigned (PeerJS
 * handshake still in flight), captures the source in the share controller and lets
 * peer.on('open') complete the action.
 */
function shareToChat(itemID) { return getP2pShare().enqueue(itemID); }
function _executeShareToChat(itemID) { return shareToChat(itemID); }
function _shareTitleFromReference(ref) { return prepareP2pItemShare(ref, '', '').discussion; }

/**
 * sendMessage(message)
 *
 * Sends a message to all connected peers.
 */
/**
 * Send a collab document invite to all connected peers.
 * Returns true if at least one connection was open, false if no peers are connected.
 */
window.sendCollabInvite = function(invite) { return getP2pShare().invite(invite); };

/**
 * Render a collab invite as a card in the chat panel.
 */
function appendCollabInviteCard(invite, sender) { return getP2pCards().invite(invite, sender); }

/**
 * appendShareCard(data, sender)
 *
 * Renders a structured share card in #chat-messages. sender = null means the
 * local user sent it (right-aligned). Also relays a simplified version to the
 * chat popup via BroadcastChannel.
 */
function appendShareCard(data, sender) { return getP2pCards().share(data, sender); }

/**
 * sendShareMessage(kind, url, title, excerpt, extra)
 *
 * Sends a structured share card to all connected peers and renders it locally.
 * kind: 'item' | 'collection' | 'annotation'
 * extra: optional additional fields merged into the message (e.g. { items } for collections)
 */
function sendShareMessage(kind, url, title, excerpt, extra = {}) { return getP2pShare().share(kind, url, title, excerpt, extra); }

async function sendMessage(message, isCurrent = captureP2pSessionGuard()) { return getP2pMessages().send(message, isCurrent); }

/**
 * sanitizeHTML(input)
 *
 * Sanitizes input to allow only a specific set of tags (i, b, em, a).
 */
/**
 * advertiseDiscussion()
 *
 * Posts discussion details to an external server to advertise a new discussion.
 */
function advertiseDiscussion(origin) { return getP2pDiscussionActions().begin('create', origin); }

/**
 * startHeartbeat()
 *
 * Starts an interval that periodically sends a heartbeat to keep the discussion active.
 */
function startHeartbeat(target = {}) { return startP2pHeartbeat(target); }
function stopHeartbeat() { return getP2pHeartbeat().stop(); }

/**
 * refreshDiscussions()
 *
 * Fetches available discussions from the server and populates the discussion list.
 */
function refreshDiscussions() { return refreshP2pDiscussions(); }

/**
 * endDiscussion()
 *
 * Ends the current discussion by sending a DELETE request and closing all peer connections.
 */
function endDiscussion(origin) { return getP2pDiscussionActions().begin('leave', origin); }

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

function loadIdentityKey(isCurrent = captureP2pSessionGuard()) { return getP2pIdentity().key(isCurrent); }
function signMessage(message) { return getP2pIdentity().sign(message); }
function verifySignature(message, signature, peerId) { return getP2pIdentity().verify(message, signature, peerId); }
