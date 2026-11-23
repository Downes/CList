// Normalize public link/invite input before switching editors or connecting.
function normalizeCollabOpening(kind, input) {
    const socket = value => {
        const url = new URL(value);
        if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Invalid collaboration server.');
        return url.href.replace(/\/$/, '');
    };
    let docId, mode, server, title = '';
    if (kind === 'url') {
        const url = new URL(input);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.pathname.startsWith('/doc/')) throw Error('Invalid collaboration link.');
        const parts = url.pathname.slice(5).split('/').filter(Boolean).map(decodeURIComponent);
        mode = ['read', 'edit'].includes(parts.at(-1)) ? parts.pop() : 'edit';
        docId = parts.join('/'); server = socket(url.origin.replace(/^http/, 'ws'));
    } else if (kind === 'invite') {
        if (!input || typeof input !== 'object') throw Error('Invalid collaboration invite.');
        docId = input.docId; mode = input.mode || 'edit';
        server = input.server ? socket(input.server) : null;
        title = typeof input.title === 'string' ? input.title : '';
    } else throw Error('Unknown collaboration opening request.');
    if (typeof docId !== 'string' || !docId.trim() || /[\u0000-\u001f\u007f]/.test(docId)) throw Error('Missing or invalid collaboration document ID.');
    if (!['edit', 'read'].includes(mode)) throw Error('Invalid collaboration access mode.');
    return { docId, mode, server, title, label: docId.slice(docId.lastIndexOf('/') + 1) };
}
