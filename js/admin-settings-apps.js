// Resolve the selected KVStore and service defaults when the picker opens.
/** @returns {CListAdminApp[]} */
function adminSettingsApps(){
return [
    {
        // baseUrl resolves to whichever kvstore instance this CList install is
        // actually pointed at (not a fixed domain like the other entries below) --
        // kvstore is the one app every CList install depends on, and it's the
        // selectable/multi-instance piece (see window.CList.keys.KVSTORE_URL).
        label: 'KVStore', baseUrl: window.CList.config.flaskSiteUrl,
        description: 'Credential storage and identity provider for CList — this kvstore instance.',
    },
    {
        label: 'Pastebin', baseUrl: window.CList.defaults.PASTEBIN,
        description: 'Stores arbitrary text content (JSON, OPML, HTML) at a short public URL — used by CList to publish collections and other structured content.',
    },
    {
        label: 'Survey', baseUrl: window.CList.defaults.SURVEY,
        description: 'Lets any kvstore user build simple surveys; anyone with the link can respond anonymously, no account needed.',
    },
    {
        label: 'LocalRSS Reader', baseUrl: window.CList.defaults.LOCALRSS,
        description: 'Server-side RSS/podcast reader with a scheduler that fetches feeds in the background.',
        // Unlike pastebin/survey, this app's auth gate also requires an
        // X-Kvstore-Url header naming the issuing kvstore instance (same
        // pattern localrss.js uses for its /fetch_feed calls).
        requiresKvstoreUrlHeader: true,
    },
    {
        label: 'Annotations', baseUrl: window.CList.defaults.ANNOTATIONS,
        description: 'W3C-style annotation server for CList — lets users attach public/private notes to any URL.',
    },
    {
        label: 'Collab', baseUrl: window.CList.defaults.COLLAB,
        description: 'Hocuspocus/Yjs real-time collaborative document editing server for CList.',
    },
    {
        label: 'Discussions', baseUrl: window.CList.defaults.DISCUSSIONS,
        description: 'Peer discovery / signaling service for CList P2P chat — stores ephemeral PeerJS peer IDs so users can find and join each other\'s discussions.',
    },
    {
        label: 'Proxyp', baseUrl: window.CList.defaults.PROXYP,
        description: 'Cross-domain HTTP relay — lets CList fetch external URLs ("Load from URL", Etherpad/OASIS bridges) without browser CORS restrictions.',
    },
].filter(app=>typeof app.baseUrl==='string'&&app.baseUrl);
}
