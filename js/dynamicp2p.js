//  dynamicp2p.js  -  helper and utility functions for dynamic P2P connections
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.


function playChat() {


    // Open chat window
    const chatSection = document.getElementById('chat-section');
    
    // Make the player visible if it's hidden
    if (chatSection.style.display === "none") {
        chatSection.style.display = "block";
    }

    // Adopt global username
    username = getSiteSpecificCookie(flaskSiteUrl, 'username');
    if (!username) { username = 'Anonymous'; }
    setUsername(username);
               
    // Open the left pane so the reader knows where the player is
    openLeftPane();
}



        // Initialize the P2P system
        let {
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
        } = initializeP2PSystem();
        let activeDiscussionName = null; // Track the currently advertised discussion name

        // Relevant div names
        // 'myPeerId' = place to display your Peer ID
        // 'chat-messages' = place to display chat messages

        // Global vars expected
        // 'username' = the username of the user


        function initializeP2PSystem() {
            // Initialize PeerJS
            const peer = new Peer();

            // Initialize variables and objects
            const connections = {};
            const knownPeers = new Set();
            const processedPeerLists = new Set(); // Track processed peer list messages
            const usernames = {}; // Map of peer IDs to usernames

            // API URL for advertising discussions
            const API_URL = 'https://datastore.downes.ca/api/discussions'; // Replace with your actual API endpoint

            // Initialize DOM elements
            const usernameInput = document.getElementById('usernameInput');
            const setUsernameButton = document.getElementById('setUsernameButton');
            const peerIdInput = document.getElementById('peerIdInput');
            const connectButton = document.getElementById('connectButton');
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');

            // Return all initialized variables and elements as an object
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



        // Append messages and logs to the chat window, allowing limited HTML
        function appendMessage(message, isOwn = false) {
            const div = document.createElement('div');
            div.innerHTML = sanitizeHTML(message); // Use sanitized HTML
            div.style.textAlign = isOwn ? 'right' : 'left';
            document.getElementById('chat-messages').appendChild(div);
        }

        // Initialize PeerJS and get a unique ID
        peer.on('open', (id) => {
            console.log('Your Peer ID:', id);
            appendMessage(`Your Peer ID: ${id}`);
            const myPeerIdDiv = document.getElementById('my-peer-id');
            if (myPeerIdDiv) { myPeerIdDiv.textContent = id; }
            knownPeers.add(id); // Add self to known peers
            if (typeof username !== 'undefined' && username) {
                setUsername(username); // Set the username if it exists and is truthy
            } else {
                setUsername('Anon'); // Set default username
            }
        });

        function setUsername(newUsername) {
            if (newUsername && typeof newUsername === 'string' && newUsername.trim()) {
                const trimmedUsername = newUsername.trim();
                myUsername = trimmedUsername; // Update the global or relevant scope variable
                appendMessage(`Your username is now: ${myUsername}`);
                
                // Propagate the username update to all connected peers
                Object.values(connections).forEach((conn) => {
                    if (conn.open) {
                        conn.send({ type: 'username-update', username: myUsername });
                    }
                });
            } else {
                appendMessage("Invalid username. Please enter a valid username.");
            }
        }

        // Propagate the peer list to all connected peers
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

        // Handle incoming connections
        peer.on('connection', (conn) => {
            connections[conn.peer] = conn;
            knownPeers.add(conn.peer);
            usernames[conn.peer] = "Anonymous"; // Default username for new peers
            appendMessage(`Connected to: ${conn.peer}`);

            conn.on('data', (data) => {

                // messages from connector to connectee
                if (data.type === 'message') {
                    const sender = usernames[conn.peer] || conn.peer;
                    data.message = sanitizeHTML(`${sender}: ${data.message}`);
                    data.message = chatOptions(data.message,sender);           // Process incoming message
                    console.log(data);
                    appendMessage(`${sender}: ${data.message}`);
                } else if (data.type === 'peer-list' && !processedPeerLists.has(data.id)) {
                    processedPeerLists.add(data.id);
                    // appendMessage(`Received peer list from ${conn.peer}: ${data.peers.join(', ')}`);
                    data.peers.forEach((peerId) => {
                        if (!connections[peerId] && peerId !== peer.id) {
                            appendMessage(`Discovered new peer: ${peerId}`);
                            connectToPeer(peerId);
                        }
                    });
                    propagatePeerList(conn.peer);
                } else if (data.type === 'username-update') {
                    usernames[conn.peer] = data.username;
                    appendMessage(`${conn.peer} is now known as ${data.username}`);
                }
            });

            conn.on('close', () => {
                appendMessage(`Connection closed: ${conn.peer}`);
                delete connections[conn.peer];
                knownPeers.delete(conn.peer);
                delete usernames[conn.peer];
                propagatePeerList();
            });

            // Send initial data to the new connection
            conn.send({ type: 'username-update', username: myUsername });
            propagatePeerList(conn.peer);
        });

        // Function to connect to a peer
        function connectToPeer(peerId,discussionName) {
            alert('Connecting to peer: ' + peerId+' Discussion Name: '+discussionName);
            if (connections[peerId]) return;

            appendMessage(`Attempting to connect to: ${peerId}`);
            appendMessage(`Discussion Name: ${discussionName}`);
            const conn = peer.connect(peerId);
            connections[peerId] = conn;
            if (discussionName) { activeDiscussionName = discussionName; }  // Set the active discussion name

            conn.on('open', () => {
                appendMessage(`Successfully connected to: ${peerId}`);
                knownPeers.add(peerId);
                usernames[peerId] = "Anonymous"; // Default username for the new peer
                conn.send({ type: 'username-update', username: myUsername });
                toggleDiv('discussion-button-div');
                toggleDiv('end-discussion-div');
                startHeartbeat(); // Start the heartbeat to keep the discussion alive
                propagatePeerList();
            });

            conn.on('data', (data) => {

                // Messages from connectee to connector
                if (data.type === 'message') {
                    const sender = usernames[conn.peer] || conn.peer;
                    data.message = sanitizeHTML(`${sender}: ${data.message}`);
                    data.message = chatOptions(data.message,sender);           // Process incoming message
                    console.log(data);                  
                    appendMessage(`${sender}: ${data.message}`);
                } else if (data.type === 'peer-list' && !processedPeerLists.has(data.id)) {
                    processedPeerLists.add(data.id);
                    // appendMessage(`Received peer list from ${conn.peer}: ${data.peers.join(', ')}`);
                    data.peers.forEach((peerId) => {
                        if (!connections[peerId] && peerId !== peer.id) {
                            appendMessage(`Discovered new peer: ${peerId}`);
                            connectToPeer(peerId);
                        }
                    });
                    propagatePeerList(conn.peer);
                } else if (data.type === 'username-update') {
                    usernames[conn.peer] = data.username;
                    appendMessage(`${conn.peer} is now known as ${data.username}`);
                }
            });

            conn.on('close', () => {
                appendMessage(`Connection closed: ${peerId}`);
                delete connections[peerId];
                knownPeers.delete(peerId);
                delete usernames[peerId];
                propagatePeerList();
            });

            const leftContent = getElementById('left-content');
            leftContent.prepend(chatSection);  // Move the div to the top
        }


        // Send a message to all connected peers
        function sendMessage(message) {
            const sanitizedMessage = sanitizeHTML(`You (${myUsername}): ${message}`);
            appendMessage(sanitizedMessage, true); // Display locally
            Object.values(connections).forEach((conn) => {
                if (conn.open) {
                    conn.send({ type: 'message', message }); // Send raw message
                }
            });
        }



        // UI for sending messages
        sendButton.addEventListener('click', () => {
            const message = messageInput.value.trim();
            if (message) sendMessage(message);
            messageInput.value = '';
        });

        // Manual connection
        connectButton.addEventListener('click', () => {
            const peerId = peerIdInput.value.trim();
            if (peerId) connectToPeer(peerId);
        });

        // Handle PeerJS errors
        peer.on('error', (err) => {
            appendMessage(`Error: ${err.message}`);
            // console.error('PeerJS Error:', err);
        });

        // Sanitize input to allow only specific tags
        function sanitizeHTML(input) {
            const allowedTags = ['i', 'b', 'em', 'a'];
            const parser = new DOMParser();
            const doc = parser.parseFromString(input, 'text/html');
            const elements = doc.body.querySelectorAll('*');

            // Remove disallowed tags
            elements.forEach((el) => {
                if (!allowedTags.includes(el.tagName.toLowerCase())) {
                    el.replaceWith(...el.childNodes);
                } else if (el.tagName.toLowerCase() === 'a') {
                    // Validate href attribute
                    const href = el.getAttribute('href');
                    if (!href || !href.startsWith('http')) {
                        el.removeAttribute('href');
                    }
                }
            });

            return doc.body.innerHTML;
        }


        // Function to advertise a discussion
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

            // Post discussion details to the external page
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
                    if (discussionName) { activeDiscussionName = discussionName; } // Set the active discussion name
                    toggleDiv('discussion-button-div');
                    toggleDiv('end-discussion-div');
                    startHeartbeat(); // Start the heartbeat to keep the discussion alive
                } else {
                    // Parse the server's error message and throw it as an error
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


        function startHeartbeat() {

            if (!activeDiscussionName || !peer || !peer.id) {
                return;
            }

            setInterval(() => {
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
            }, 60000); // Every 60 seconds
        }
        

        // Function to fetch available discussions from the server
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
                discussionList.innerHTML = ''; // Clear previous list
                discussionList.style.margin = '5px'; // Optional styling

                if (discussions.length === 0) {
                    // If no discussions, add a note to the list
                    const noDiscussionsMessage = document.createElement('p');
                    noDiscussionsMessage.textContent = 'No discussions available. Why not create one yourself?';

                    discussionList.appendChild(noDiscussionsMessage);
                } else {
                    discussions.forEach((discussion) => {
                        const li = document.createElement('li');
                        li.style.listStyleType = 'none'; // Remove bullet point
                        const button = document.createElement('button');
                        button.textContent = `Join ${discussion.name}`;
                        button.onclick = () => connectToPeer(discussion.peerId,discussion.name);
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


        // Function to end a discussion
        function endDiscussion() {
            const discussionNameInput = document.getElementById('discussionNameInput');
            const discussionName = discussionNameInput.value.trim();

            if (!discussionName) {
                alert('Please enter your discussion name to end it.');
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
                    console.log('Discussion ended successfully!');
                    alert('Discussion ended successfully!');
                    activeDiscussionName = null; // Clear the active discussion name
                    toggleDiv('discussion-button-div');
                    toggleDiv('end-discussion-div');
                    refreshDiscussions(); // Refresh available discussions
                } else {
                    throw new Error('Failed to end discussion');
                }
            })
            .catch((error) => {
                console.error('Error ending discussion:', error);
                alert('Failed to end discussion.');
            });

        }

function chatOptions(content,sender) {
    //callIfAvailable(showPadShare(),sender);
    content = findEtherpadLink(content,sender);
    return content;
} 

function findEtherpadLink(content,sender) {

    // Look for a link
    const regex = /['"<](https:\/\/[^\s'"><]+)[>\s'"]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const link = match[1]; // Extract the actual link (without surrounding chars)

           // Check if the link contains "etherpad"
        if (link.includes('etherpad')) {
            console.log(`${sender} shared ${link}`);
        return `${sender} shared an Etherpad link (Click on the link to open): <em><i><a onClick="showPadShare('`+link+`')">${link}</a></i></em>`; // Send or return the link
      } else {
        return content;
      }
    }
    return content;
}
