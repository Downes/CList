const DISCORD_SETUP_SERVER = 'https://discord.mooc.ca';
async function discordSetupResponse(path, options, fetcher) {
    let response;
    try { response = await fetcher(DISCORD_SETUP_SERVER + path, options); }
    catch (_) { throw new Error('Discord relay request could not be confirmed.'); }
    if (!response.ok) {
        let data; try { data = await response.json(); } catch (_) { data = null; }
        throw Object.assign(new Error(typeof data?.error === 'string' ? data.error : 'Discord relay returned HTTP ' + response.status),
            { definite: response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status) });
    }
    return response;
}
function discordSetupRows(data, requireId = false) {
    if (!Array.isArray(data) || data.some(row => !row || typeof row.name !== 'string' || (requireId && !['string', 'number'].includes(typeof row.id)))) throw new Error('Discord relay returned an invalid channel list.');
    return data.map(row => ({ name: row.name, id: row.id == null ? '' : String(row.id) }));
}
async function readDiscordSetupChannels(headers, fetcher) {
    const response = await discordSetupResponse('/channels', { headers }, fetcher);
    return discordSetupRows(await response.json());
}
async function readDiscordAdminChannels(token, fetcher) {
    const query = '?bot_token=' + encodeURIComponent(token);
    const results = await Promise.allSettled([
        discordSetupResponse('/admin/channels' + query, undefined, fetcher).then(async response => discordSetupRows(await response.json(), true)),
        discordSetupResponse('/admin/guilds' + query, undefined, fetcher).then(async response => discordSetupRows(await response.json(), true)),
    ]);
    if (results[0].status === 'rejected') throw results[0].reason;
    return { channels: results[0].value, guilds: results[1].status === 'fulfilled' ? results[1].value : [], warning: results[1].status === 'rejected' ? 'Guilds could not be loaded. Retry Manage Channels to refresh them.' : '' };
}
async function writeDiscordAdminChannel(command, token, values, fetcher, accepted) {
    let path, payload;
    if (command === 'create') {
        if (!values.guild_id || !values.name) throw Object.assign(new Error('Choose a guild and enter a channel name.'), { definite: true });
        path = '/admin/guilds/' + encodeURIComponent(values.guild_id) + '/channels'; payload = { bot_token: token, name: values.name };
    } else if (command === 'register') {
        if (!values.guild_id || !values.channel_id || !values.webhook_url) throw Object.assign(new Error('Please fill in all fields to add a channel.'), { definite: true });
        path = '/admin/channels'; payload = { bot_token: token, guild_id: values.guild_id, channel_id: values.channel_id, webhook_url: values.webhook_url };
    } else {
        if (!values.id) throw Object.assign(new Error('The channel ID is missing. Reload channels.'), { definite: true });
        path = '/admin/channels/' + encodeURIComponent(values.id); payload = { bot_token: token };
    }
    await discordSetupResponse(path, { method: command === 'delete' ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, fetcher);
    accepted(); // A 2xx is accepted even if the relay has no readable JSON body.
}
