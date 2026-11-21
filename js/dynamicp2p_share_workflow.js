// Detached preparation and one-pass transport; no DOM, globals or visible feedback.
function prepareP2pItemShare(reference, text, itemId) {
    const ref = structuredClone(reference), title = typeof ref.title === 'string' ? ref.title : '';
    const descriptive = title && !['Mastodon', 'Bluesky'].includes(title);
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    return { discussion: descriptive ? (title.length > 60 ? title.slice(0, 57) + '…' : title)
        : ref.author_name ? ref.author_name + "'s post" : 'Discussion',
        kind: 'item', url: ref.url, title: descriptive ? title : ref.author_name || ref.url || itemId,
        excerpt: raw.length > 500 ? raw.slice(0, 497) + '…' : raw || null };
}
function broadcastP2pPacket(packet, recipients, deps) {
    const result = { sent: 0, failed: 0, stale: false, errors: [] };
    for (const channel of recipients) {
        if (!deps.current()) { result.stale = true; break; }
        if (!channel.open || !deps.channelCurrent(channel)) continue;
        try { deps.send(channel, structuredClone(packet)); result.sent++; }
        catch (error) { result.failed++; result.errors.push(error); }
    }
    return result;
}
