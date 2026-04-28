//  opml.js  -  Contacts OPML2JSON service, hharvests links, displays
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright National Research Council of Canada 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.accountSchemas = window.accountSchemas || {};
window.accountSchemas['OPML'] = {
    type: 'OPML',
    instanceFromKey: true,
    kvKey: { label: 'OPML URL', placeholder: 'https://example.com/feeds.opml' },
    fields: [
        { key: 'title',       label: 'Title',       editable: true, inputType: 'text', placeholder: 'My OPML', default: '' },
        { key: 'permissions', label: 'Permissions', editable: true, inputType: 'text', placeholder: 'r',       default: 'r' },
        { key: 'id',          label: 'OPML URL',    editable: true, inputType: 'text', placeholder: 'https://example.com/feeds.opml', default: '' },
    ]
};
// 



// Base URL is the URL of the OPML file
// accessToken is the URL of the OPML2JSON servcie

const summaryLimit = 500;
const audioFiles = [];
let opmlFile;
let opmlServer;
let cursor;


// Handler

(function () {
    const opmlHandler = {
        name: 'OPML',
        display: 'OPML',
        icon: 'rss_feed',
        description: 'Harvests links from an OPML file and displays them.',
        type: 'feed',
        initialize: () => {
        },
        feedFunctions: {
            'Timeline': fetchAndDisplayOPMLData.bind(null, '')
            // Add more named functions as needed
        },
        statusActions: (item,opmlID,itemLink) => {
            let opmlstatusActions = ``;

            // Enlarge Content
            if (item.content) { opmlstatusActions += `<button class="material-icons md-18 md-light" onClick="toggleFormDisplay('${opmlID}-content');toggleFormDisplay('${opmlID}-summary');">zoom_out_map</button>`; }
//alert("Audio3?"+item.audioIcon);

            // Play audio
            if (item.audioIcon && item.audioIcon != '') { opmlstatusActions +=  `${item.audioIcon}`; }

            // Open link in a new window
            if (item.link) { opmlstatusActions += `<button class="material-icons md-18 md-light" onClick="window.open('${item.link}', '_blank', 'width=800,height=600,scrollbars=yes')">launch</button>`; }

            return opmlstatusActions;
        }
    };
    // Ensure readerHandlers exists
    if (typeof window.readerHandlers === 'undefined') {
    window.readerHandlers = {}; // Create it if it doesn't exist
    }

    // Add the handler
    window.readerHandlers['OPML'] = opmlHandler;
 })();

// -----------------------------------------------------
    

// Mastodon Feed Functions
// Ensure feedFunctions exists
window.feedFunctions = window.feedFunctions || {};

// Define  OPML Functions
window.OPMLFunctions = {
    'Timeline': fetchAndDisplayOPMLData.bind(null, '')
};

// Add  OPMLFunctions to feedFunctions
window.feedFunctions['OPML'] = window.OPMLFunctions;

// -----------------------------------------------------

// Function to initialize the Mastodon client with a specific account
async function initializeOPML(baseURL, accessToken, nextCursor) {
    if (!baseURL) {
        console.error('Error: OPML file URL is missing');
        return;
    }
    // opmlServer is always the shared opml2json service; accessToken is not used here

    try {
        console.log('Attempting to initialize OPML client for', baseURL);

        opmlServer = 'https://opml2json.downes.ca';
        opmlFile = baseURL;
        cursor = nextCursor;

        await fetchAndDisplayOPMLData();
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Successfully switched to the account on ${baseURL}</p>`;
        accountStatusDiv.innerHTML += `<p>Fetching data from ${accessToken}</p>`;

        

    } catch (error) {
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Error initializing OPML client: ${error.message}</p>`;
        console.error('Error initializing OPML client:', error);
    }

}

// Base URL is the URL of the OPML file
// accessToken is the URL of the OPML2JSON service

async function fetchAndDisplayOPMLData(cursor) {

    let OPMLitems = [];
    let OPMLtitle = null;

    const feedContainer = document.getElementById('feed-container');

    if (!opmlServer || !opmlFile) {
        if (feedContainer) feedContainer.innerHTML = `<p class="feed-status-message">No OPML account selected. Please select an account first.</p>`;
        return;
    }

    // Show elapsed-time loading indicator
    let elapsed = 0;
    if (feedContainer) feedContainer.innerHTML = `<p class="feed-status-message">Loading OPML feed… <span id="opml-timer">0</span>s</p>`;
    const timerInterval = setInterval(() => {
        elapsed++;
        const timerEl = document.getElementById('opml-timer');
        if (timerEl) timerEl.textContent = elapsed;
    }, 1000);

    try {
        // Construct the request payload
        const formData = new FormData();
        formData.append('url', opmlFile);
        if (cursor) {
            formData.append('cursor', cursor);
        }

        // Send the POST request to the server
        const requestURL =  opmlServer+"/upload_opml";

        const response = await fetch(requestURL, {
            method: 'POST',
            body: formData
        });

        // Check if the response is OK
        if (!response.ok) {
            let serverMsg = '';
            try { const errData = await response.json(); serverMsg = errData.error || ''; } catch(e) {}
            throw new Error(serverMsg || `HTTP error! status: ${response.status}`);
        }

        // Parse the JSON response
        const data = await response.json();

        // Validate the response structure
        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Invalid response format: Missing or invalid "items" array.');
        }

        
        // Process items and update the cursor
        OPMLtitle = data.title;
        OPMLitems = data.items;
        nextCursor = data.next_cursor || null;
        // console.log(OPMLitems);
        // Display the items
        if (OPMLitems.length === 0) {
            clearInterval(timerInterval);
            if (feedContainer) feedContainer.innerHTML = `<p class="feed-status-message">No items to display.</p>`;
            return;
        }
    } catch (error) {
        clearInterval(timerInterval);
        const accountStatusDiv = document.getElementById('account-status');
        if (accountStatusDiv) accountStatusDiv.innerHTML = `<p>Error fetching OPML: ${error.message}</p>`;
        console.error('Error initializing OPML client:', error);
        return;
    }

    clearInterval(timerInterval);
    feedContainer.innerHTML = '';
    feedContainer.appendChild(createFeedHeader(OPMLtitle || 'OPML Feed'));

    // Display the Harvested Posts
    //for (const item of OPMLitems) {
    let audioCount=0;
    OPMLitems.forEach(item => {


        // Create the listing object - align to main listing item fields
        // makeListing(service,url,title,desc,feed,author,date,full_content) 
        item.service = 'OPML';
        item.url = item.link || item.guid;
        item.desc = item.summary;
        item.feed = item.source;
        item.content = item.full_content;
        item.feed = item.source;
        item.date = item.published;



        // Extract audio files
        let audioIcon = '';
        if (Array.isArray(item.audio)) {
            // If item.audio is an array, push all the audio URLs as objects into audioFiles
            item.audio.forEach(audioURL => {
                console.log("Found audio file:", audioURL);
                audioFiles.push({ src: audioURL, title: item.title });
                audioCount++;
            });
        } else if (item.audio) {
            // If item.audio is just a single URL, push it as an object
            console.log("Found audio file:", item.audio);
            audioFiles.push({ src: item.audio, title: item.title });
            audioCount++;
        } else {
            console.log("No audio found for this item.");
        }
        
        // If we have one or more audio files, set the audioIcon
        if (audioFiles.length > 0) {
            // currentAudio is set to the last added audio file's index
            currentAudio = audioCount - 1;
            audioIcon = `<button class="material-icons md-18 md-light" onClick="playAudio(${currentAudio});">play_arrow</button>`;
        //    alert("Audio?"+audioIcon);
        } else {
            audioIcon = ``;
        }
        item.audioIcon = audioIcon;

        const listing = makeListing(item);
        feedContainer.appendChild(listing);
    });

    // Fill the audio list
    const audioList = document.getElementById('audio-list');
    if (audioList) audioList.innerHTML += generatePlaylistHTML();

}

// Handle the Audio Functions
// Expects to find audio files in a list audioFiles = []

const player = document.getElementById('myAudioPlayer');
let currentAudioIndex = 0;      // Sets it once
function playAudio(index) {
    currentAudioIndex = index;
    player.src = audioFiles[currentAudioIndex].src;
    player.play();

    // Highlight the active playlist item
    document.querySelectorAll('#audio-list p').forEach((p, i) => {
        p.classList.toggle('audio-playing', i === index);
    });
    const audioSection = document.getElementById('audio-section');
    
    // Make the player visible if it's hidden
    if (audioSection.style.display === "none") {
        audioSection.style.display = "block";
    }

    // Open the left pane so the reader knows where the player is
    openLeftPane();
}

// Audio Player listener
// When the current track ends, move to the next one
player.addEventListener('ended', () => {
    currentAudioIndex++;
    if (currentAudioIndex < audioFiles.length) {
        player.src = audioFiles[currentAudioIndex].src;
        player.play();
        document.querySelectorAll('#audio-list p').forEach((p, i) => {
            p.classList.toggle('audio-playing', i === currentAudioIndex);
        });
    } else {
        document.querySelectorAll('#audio-list p').forEach(p => p.classList.remove('audio-playing'));
        console.log("Playlist ended");
    }
});



// Genberate the full playlist as a string

function generatePlaylistHTML() {
    let masterPlaylistHTML = ""; 
    audioFiles.forEach((audioEntry, audioIndex) => {
        // Inline onclick and prevent default by returning false
        masterPlaylistHTML += `<p><a href="#" style="display:block;" onclick="playAudio(${audioIndex}); return false;">${audioEntry.title}</a></p>`;
    });
    return masterPlaylistHTML;
}