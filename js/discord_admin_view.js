function createDiscordAdminView(controls) {
    const { panelEl: panel, botTokenEl: token, statusEl: status } = controls;
    panel.style.display = 'block';
    const root = document.createElement('div'); panel.innerHTML = ''; panel.appendChild(root);
    const current = () => discordSetupSurfaceCurrent(panel) && discordSetupSurfaceCurrent(token) && status.isConnected && root.parentNode === panel;
    const feedback = discordSetupFeedback(status, current);
    const field = (parent, id, placeholder) => { const input = document.createElement('input'); input.id = id; input.type = 'text'; input.value = ''; input.placeholder = placeholder; parent.appendChild(input); return input; };
    return { current, token: () => token.value || '', ...feedback,
        captureDraft() { const fields = Array.from(root.querySelectorAll('input,select')).map(node => [node, node.value]); return () => current() && fields.every(([node, value]) => node.isConnected && node.value === value); },
        render(data, commands, guard) {
            if (!current()) return; root.innerHTML = '';
            const heading = document.createElement('h4'); heading.textContent = 'Manage Channels'; root.appendChild(heading);
            for (const row of data.channels) {
                const item = document.createElement('div'), label = document.createElement('span'); label.textContent = row.name; item.appendChild(label); root.appendChild(item);
                const remove = discordSetupButton(item, '', 'Delete', true); remove.onclick = () => current() && root.contains(remove) && guard() && commands.remove(row.id);
            }
            if (!data.channels.length) { const empty = document.createElement('p'); empty.textContent = 'No channels registered yet.'; root.appendChild(empty); }
            if (data.guilds.length) {
                const title = document.createElement('h5'); title.textContent = 'Create New Channel'; root.appendChild(title);
                const guild = document.createElement('select'); guild.id = 'discord-new-guild-select'; root.appendChild(guild);
                for (const row of data.guilds) { const option = document.createElement('option'); option.value = row.id; option.textContent = row.name; guild.appendChild(option); } guild.value = data.guilds[0].id;
                const name = field(root, 'discord-new-channel-name', 'Channel name'), create = discordSetupButton(root, 'discord-create-channel-btn', 'Create Channel');
                create.onclick = () => current() && root.contains(create) && guard() && commands.create({ guild_id: guild.value, name: name.value.trim() });
            } else { const help = document.createElement('p'); help.textContent = data.warning ? 'Guild choices are unavailable. Retry Manage Channels to refresh them.' : 'No eligible guilds. Grant the bot Manage Channels and Manage Webhooks permissions in Discord.'; root.appendChild(help); }
            const title = document.createElement('h5'); title.textContent = 'Register Existing Channel'; root.appendChild(title);
            const guildId = field(root, 'discord-new-guild', 'Guild ID'), channelId = field(root, 'discord-new-channel-id', 'Channel ID'), webhook = field(root, 'discord-new-webhook', 'Webhook URL');
            const add = discordSetupButton(root, 'discord-new-channel-btn', 'Add Channel');
            add.onclick = () => current() && root.contains(add) && guard() && commands.register({ guild_id: guildId.value.trim(), channel_id: channelId.value.trim(), webhook_url: webhook.value.trim() });
            if (data.warning) feedback.message(data.warning);
        },
        busy(value) { if (current()) root.querySelectorAll('button').forEach(button => { button.disabled = value; }); },
    };
}
