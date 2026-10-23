//  peertube.js  -  PeerTube-specific helpers
//  Part of CList, the next generation of learning and connecting with your community
//
//  Not a reader handler (PeerTube videos arrive via RSS/public-feed collections) —
//  just shared, service-specific logic (video-embed detection, and future
//  PeerTube-specific features) kept out of the generic rendering code in ui.js.
//  PeerTube is federated — any instance works, so detection is by URL path
//  convention only, never a hardcoded instance list.
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

(function () {
    window.CList.video = window.CList.video || {};

    // Detects a PeerTube "watch" page on any instance and returns that
    // instance's embeddable player URL, or null if link isn't a PeerTube video.
    window.CList.video.peertube = {
        getEmbedUrl: (link) => {
            if (!link || typeof link !== 'string') return null;
            let u;
            try { u = new URL(link); } catch (_) { return null; }

            const m = u.pathname.match(/^\/videos\/watch\/([^/?]+)/);
            if (m) return `${u.origin}/videos/embed/${encodeURIComponent(m[1])}`;
            return null;
        }
    };
})();
