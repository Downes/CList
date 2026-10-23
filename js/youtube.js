//  youtube.js  -  YouTube-specific helpers
//  Part of CList, the next generation of learning and connecting with your community
//
//  Not a reader handler (YouTube videos arrive via RSS/public-feed collections) —
//  just shared, service-specific logic (video-embed detection, and future
//  YouTube-specific features) kept out of the generic rendering code in ui.js.
//
//  Copyright Stephen Downes 2025, downes.ca
//  Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
//  This software carries NO WARRANTY OF ANY KIND.
//  This software is provided "AS IS," and you, its user, assume all risks when using it.

(function () {
    window.CList.video = window.CList.video || {};

    // Detects a YouTube video page (watch, shorts, or youtu.be short-link) and
    // returns an embeddable player URL, or null if link isn't a YouTube video.
    window.CList.video.youtube = {
        getEmbedUrl: (link) => {
            if (!link || typeof link !== 'string') return null;
            let u;
            try { u = new URL(link); } catch (_) { return null; }

            if (/(^|\.)youtube\.com$/.test(u.hostname)) {
                const v = u.searchParams.get('v');
                if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
                const shortsMatch = u.pathname.match(/^\/shorts\/([^/?]+)/);
                if (shortsMatch) return `https://www.youtube.com/embed/${encodeURIComponent(shortsMatch[1])}`;
                return null;
            }
            if (u.hostname === 'youtu.be') {
                const id = u.pathname.slice(1).split('/')[0];
                if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
            }
            return null;
        }
    };
})();
