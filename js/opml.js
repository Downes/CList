//  opml.js  -  Contacts OPML2JSON service, hharvests links, displays
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

window.CList.schemas = window.CList.schemas || {};
window.CList.schemas['OPML'] = {
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



// Shared audio state — used by both the OPML adapter and the RSS reader

const audioFiles = [];

// ---- OPML handler ----
// Display is delegated to the RSS reader pipeline; feedFunctions mirror RSS.

(function () {
    window.CList.readers = window.CList.readers || {};
    window.CList.readers['OPML'] = {
        name: 'OPML',
        display: 'OPML',
        icon: 'rss_feed',
        description: 'Reads feeds listed in an OPML file via the RSS reader.',
        type: 'feed',
        initialize: async (accountData) => { await initializeOPML(accountData.instance); },
        feedFunctions: {
            'Unread':     () => { rssActiveFeedFilter = null; rssFilter = 'unread';     rssDisplayEntries().catch(e => { console.error(e); showStatusMessage('Could not display entries: ' + e.message); }); },
            'All':        () => { rssActiveFeedFilter = null; rssFilter = 'all';        rssDisplayEntries().catch(e => { console.error(e); showStatusMessage('Could not display entries: ' + e.message); }); },
            'Bookmarked': () => { rssActiveFeedFilter = null; rssFilter = 'bookmarked'; rssDisplayEntries().catch(e => { console.error(e); showStatusMessage('Could not display entries: ' + e.message); }); },
            'Refresh':    () => rssRefresh().catch(e => { console.error(e); showStatusMessage('Refresh failed: ' + e.message); }),
        },
        onFeedClick:   (item) => rssFilterByFeed(item.feedUrl),
        onAuthorClick: null,
        statusActions: null,
    };
})();

// ---- OPML initializer — thin adapter over the RSS reader ----

async function initializeOPML(opmlUrl) {
    if (!opmlUrl) {
        showServiceError('feed-container', 'OPML error', 'No OPML URL provided.');
        return;
    }
    const fc = window.CList.ui.view.feedContainer;
    if (fc) {
        fc.innerHTML = '';
        const msg = document.createElement('p');
        msg.className = 'feed-status-message';
        msg.id = 'rss-fetch-status';
        msg.textContent = 'Reading OPML file…';
        fc.appendChild(msg);
    }
    try {
        const serviceUrl = (typeof getOpml2jsonUrl === 'function')
            ? await getOpml2jsonUrl()
            : 'https://opml2json.downes.ca';

        const formData = new FormData();
        formData.append('url', opmlUrl);
        const resp = await fetch(`${serviceUrl}/list_feeds`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'list_feeds failed');
        const feedCount = (data.feeds || []).length;
        if (fc) {
            const el = document.getElementById('rss-fetch-status');
            if (el) el.textContent = `Found ${feedCount} feed${feedCount !== 1 ? 's' : ''} — fetching…`;
        }

        await initializeRSS({
            type:     'OPML',
            instance: opmlUrl,
            title:    data.title || opmlUrl,
            feeds:    data.feeds || [],
        });
    } catch (err) {
        console.error('OPML: failed to initialize:', err);
        showServiceError('feed-container', 'OPML error', err.message);
    }
}

// ---- Audio player ----
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