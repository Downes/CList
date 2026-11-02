//  opml.js  -  Shared audio-playback machinery for CList's feed readers
//  Part of CList, the next generation of learning and connecting with your community
//
//  Version version 0.1 created by Stephen Downes on January 27, 2025
//
//  Copyright Stephen Downes 2025
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

// Shared audio state — used by the LOCALRSS reader (localrss.js)

const audioFiles = [];

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
    // Make the player visible, hiding any other overlay section (chat, feed
    // options) that currently occupies the same region.
    showLeftOverlaySection('audio-section');

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