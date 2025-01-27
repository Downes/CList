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
// 



// Base URL is the URL of the OPML file
// accessToken is the URL of the OPML2JSON servcie

const summaryLimit = 500;
const audioFiles = [];
let opmlFile;
let opmlServer;
let cursor;


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
    if (!accessToken || !baseURL) {
        console.error('Error: Access token or baseURL is missing');
        return;
    }

    try {
        console.log('Attempting to initialize OPML client for', baseURL);

        opmlServer = accessToken;
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

    //const opmlServer = document.getElementById('accessToken').value;
    //const opmlFile = document.getElementById('baseURL').value;
    let OPMLitems = []; // Declare OPMLitems in the broader function scope

    try {
        // Clear previous error messages
       // errorDiv.innerHTML = '';

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
            throw new Error(`HTTP error! status: ${response.status}`);
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
            alert("No items to display");
            // contentDiv.innerHTML += '<p>No more items to display.</p>';
           // loadMoreButton.style.display = 'none';
            return;
        }
    } catch (error) {
        const accountStatusDiv = document.getElementById('account-status');
        accountStatusDiv.innerHTML = `<p>Error fetching OPML: ${error.message}</p>`;
        console.error('Error initializing OPML client:', error);
    }

    const feedContainer = document.getElementById('feed-container');
    if (OPMLtitle != null) {                                        // First page will have a title, but not subsequent pages
        feedContainer.innerHTML = '';                         // Clear previous content
        feedContainer.appendChild(createFeedHeader(OPMLtitle));   // Header
    }

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
            // currentAudio is set to the last added audio file’s index
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
    document.getElementById('audio-list').innerHTML += generatePlaylistHTML();

}

// Handle the Audio Functions
// Expects to find audio files in a list audioFiles = []

const player = document.getElementById('myAudioPlayer');
let currentAudioIndex = 0;      // Sets it once
function playAudio(index) {
    // If we specify an index, play that index
    currentAudioIndex = index;

    // Set the source and play
    player.src = audioFiles[currentAudioIndex].src;
    player.play();
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
        player.src = audioFiles[currentAudioIndex];
        player.play();
    } else {
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