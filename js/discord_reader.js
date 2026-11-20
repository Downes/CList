// Discord reads use a selected account and captured bridge headers, not a module channel.
async function requestDiscordMessages(channel, headers, signal, fetcher) {
    if (!channel) return [];
    const response = await fetcher(`${DISCORD_BRIDGE_URL}/messages?channel=${encodeURIComponent(channel)}`, { headers, signal });
    if (!response.ok) throw new Error(`Bridge request failed: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Discord returned an invalid message list.');
    return data;
}
function normalizeDiscordMessage(raw, channel) {
    return { service: 'Discord', url: `discord-msg-${raw.id}`, title: raw.content ? raw.content.slice(0, 80) : '',
        desc: raw.content || '', feed: channel, author: raw.author, date: raw.posted_at, guid: `discord-${raw.id}` };
}
async function loadDiscordMessages(context) {
    if (!context?.isCurrent()) return;
    const channel = context.account.channel || null;
    const headers = { ...kvstoreAuthHeader() };
    const data = await requestDiscordMessages(channel, headers, context.signal, fetch);
    if (!context.isCurrent()) return;
    await context.render(data, { title: 'Channel', typevalue: channel,
        normalize: raw => normalizeDiscordMessage(raw, channel) });
    context.commit(() => {
        if (!data.length) showDiscordReadNotice(channel);
    });
}
window.CList.readers.Discord = { supportsRequestContext: true,
    initialize: (account, context) => loadDiscordMessages(context),
    feedFunctions: { Channel: context => loadDiscordMessages(context) }, onFeedClick: null, onAuthorClick: null, statusActions: () => '' };
