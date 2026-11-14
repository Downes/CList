/// <reference path="./clist-types.js" />
// Service-specific account setup extracted from kvstore.js.
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.
window.CList.accountFlows = window.CList.accountFlows || {};
window.CList.accountHooks = window.CList.accountHooks || {};
window.CList.accountHooks.Discord = {
    /** @param {CListAccountFormContext} context */
    decorateForm(context) {
        if (context.mode !== 'edit') return;
        const panel = document.createElement('div');
        panel.style.marginTop = '10px';
        panel.innerHTML = `
            <div id="discord-edit-status" class="feed-status-message"></div>
            <div class="kv-action-buttons">
                <button class="btn btn-small" id="discord-edit-manage-btn" type="button">Manage Channels</button>
            </div>
            <div id="discord-edit-admin-panel" style="display:none;margin-top:10px;"></div>`;
        context.container.appendChild(panel);
        const controls = {
            statusEl: panel.querySelector('#discord-edit-status'),
            botTokenEl: context.root.querySelector('#bot_tokenInput'),
            panelEl: panel.querySelector('#discord-edit-admin-panel'),
        };
        panel.querySelector('#discord-edit-manage-btn').onclick = () => context.getAccountFlow('Discord').manageChannels(controls);
    },
};

/**
 * @param {CListAccountFlowContext} context
 * @returns {CListAccountFlow}
 */
window.CList.accountFlows['Discord'] = function (context) {
    const div = context.container;
    const showTypePicker = context.back;
    const getSite = context.refreshList;

    function open() {
        const flow = div;
        const inputStyle = 'display:block;width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0 8px;';
        const labelStyle = 'font-variant:small-caps;font-size:0.8rem;color:#555;display:block;margin-top:6px;';
        flow.innerHTML = `
            <h3 style="margin:0 0 8px;">Select Channels</h3>
            <div id="discord-select-status" style="font-size:0.8rem;color:#555;margin-bottom:6px;min-height:1.2em;"></div>
            <div id="discord-channel-list" class="account-list"></div>
            <div class="kv-action-buttons" style="margin-top:10px;">
                <button class="kv-action-btn kv-cancel-btn" id="discord-back-btn">Back</button>
            </div>
            <details style="margin-top:14px;">
                <summary style="cursor:pointer;font-size:0.8rem;color:#888;">Manage channels (admin)</summary>
                <div style="margin-top:8px;">
                    <label style="${labelStyle}">Bot Token</label>
                    <input type="password" id="discord-bot-token" placeholder="" style="${inputStyle}">
                    <div class="kv-action-buttons">
                        <button class="kv-action-btn kv-save-btn" id="discord-manage-btn" type="button">Manage Channels</button>
                    </div>
                    <div id="discord-admin-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #ccc;"></div>
                </div>
            </details>`;
        flow.querySelector('#discord-back-btn').onclick = () => showTypePicker();
        flow.querySelector('#discord-manage-btn').onclick = () => discordManageChannels({
            statusEl: flow.querySelector('#discord-select-status'),
            botTokenEl: flow.querySelector('#discord-bot-token'),
            panelEl: flow.querySelector('#discord-admin-panel'),
    });
    renderDiscordChannelPicker(flow);
    }

    function findDiscordAccountKey(channelName) {
        const match = context.getAccounts().find(a => {
            const v = parseAccountValue(a);
            return v && v.type === 'Discord' && v.channel === channelName;
        });
        return match ? match.key : null;
    }

    async function renderDiscordChannelPicker(flow) {
        const listEl = flow.querySelector('#discord-channel-list');
        listEl.innerHTML = '<p class="feed-status-message">Loading channels…</p>';
        try {
            const resp = await fetch('https://discord.mooc.ca/channels', {
                headers: kvstoreAuthHeader()
            });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const channels = await resp.json();
            if (!listEl.isConnected) return;
            if (!channels.length) {
                listEl.innerHTML = '<p class="feed-status-message">No channels registered yet — ask your admin to add one under Manage Channels below.</p>';
                return;
            }
            listEl.innerHTML = channels.map(c => `
                <div class="account-list-item">
                    <button type="button" class="account-button${findDiscordAccountKey(c.name) ? ' selected' : ''}" data-channel-name="${escapeHtml(c.name)}">
                        <span class="material-icons">forum</span>
                        <span>${escapeHtml(c.name)}</span>
                    </button>
                </div>`).join('');
            listEl.querySelectorAll('[data-channel-name]').forEach(btn => {
                btn.onclick = () => toggleDiscordChannel(btn.getAttribute('data-channel-name'), flow);
            });
        } catch (e) {
            console.error('Could not load Discord channels:', e);
            listEl.innerHTML = `<p class="feed-status-message">Could not load channels: ${escapeHtml(e.message)}</p>`;
        }
    }

    async function refreshDiscordChannelPickerIfVisible() {
        const flow = div;
        if (flow && flow.querySelector('#discord-channel-list')) {
            await renderDiscordChannelPicker(flow);
        }
    }

    async function toggleDiscordChannel(channelName, flow) {
        const statusEl = flow.querySelector('#discord-select-status');
        statusEl.style.color = '#555';
        try {
            const existingKey = findDiscordAccountKey(channelName);
            if (existingKey) {
                await window.CList.storage.kv.remove(existingKey);
                statusEl.textContent = `Unsubscribed from "${channelName}".`;
            } else {
                const instanceData = { type: 'Discord', title: channelName, permissions: 'rw', channel: channelName, bot_token: '' };
                const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
                if (!encKey) throw new Error('Encryption key not found — please log in again.');
                const encryptedValue = await encryptWithKey(encKey, JSON.stringify(instanceData));
                await window.CList.storage.kv.add(channelName, encryptedValue);
                statusEl.textContent = `Subscribed to "${channelName}".`;
            }
            const accounts = await context.reloadAccounts();
            window.CList.accounts = accounts;
            populatePostOptions(accounts);
            populateReadAccountList(accounts);
            updateUIVisibility();
            await renderDiscordChannelPicker(flow);
            getSite(window.CList.config.flaskSiteUrl);
        } catch (e) {
            console.error('Discord channel toggle failed:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Error: ' + e.message;
        }
    }

    async function discordManageChannels(ctx) {
        const { statusEl, botTokenEl, panelEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        if (!botToken) { statusEl.textContent = 'Enter the bot token above first.'; return; }
        panelEl.style.display = 'block';
        panelEl.innerHTML = '<p class="feed-status-message">Checking bot token…</p>';
        try {
            const [channelsResp, guildsResp] = await Promise.all([
                fetch(`https://discord.mooc.ca/admin/channels?bot_token=${encodeURIComponent(botToken)}`),
                fetch(`https://discord.mooc.ca/admin/guilds?bot_token=${encodeURIComponent(botToken)}`),
            ]);
            if (!channelsResp.ok) {
                const err = await channelsResp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${channelsResp.status}`);
            }
            const channelsList = await channelsResp.json();
            const guildsList = guildsResp.ok ? await guildsResp.json() : [];
            renderDiscordAdminPanel(panelEl, channelsList, guildsList, ctx);
        } catch (e) {
            console.error('Discord admin channel list failed:', e);
            panelEl.innerHTML = `<p class="feed-status-message">Could not load channels: ${escapeHtml(e.message)}</p>`;
        }
    }

    function renderDiscordAdminPanel(panel, channelsList, guildsList, ctx) {
        const rows = channelsList.map(c => `
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee;">
                <span class="account-button" style="width:auto;flex:1 1 auto;border:none;padding:var(--pad-v) 0;cursor:default;">
                    <span class="material-icons">forum</span>
                    <span>${escapeHtml(c.name)}</span>
                </span>
                <button class="kv-action-btn kv-cancel-btn" data-channel-id="${c.id}" style="padding:2px 8px;margin-left:8px;flex-shrink:0;">Delete</button>
            </div>`).join('') || '<p class="feed-status-message">No channels registered yet.</p>';

        const guildOptions = guildsList.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

        panel.innerHTML = `
            <h4 style="margin:0 0 6px;">Manage Channels</h4>
            ${rows}
            <div style="margin-top:10px;">
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">Create New Channel</label>
                ${guildsList.length ? `
                <select id="discord-new-guild-select" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                    ${guildOptions}
                </select>
                <input type="text" id="discord-new-channel-name" placeholder="Channel name" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <button class="kv-action-btn kv-save-btn" id="discord-create-channel-btn" style="margin-top:4px;">Create Channel</button>
                ` : `<p class="feed-status-message">No eligible guilds — grant the bot's role "Manage Channels" + "Manage Webhooks" in Discord's Server Settings → Roles.</p>`}
            </div>
            <div style="margin-top:14px;">
                <label style="font-variant:small-caps;font-size:0.8rem;color:#555;display:block;">Register Existing Channel</label>
                <input type="text" id="discord-new-guild" placeholder="Guild ID" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <input type="text" id="discord-new-channel-id" placeholder="Channel ID" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <input type="text" id="discord-new-webhook" placeholder="Webhook URL" style="width:100%;box-sizing:border-box;padding:0.2rem;font-size:0.8rem;margin:2px 0;">
                <button class="kv-action-btn kv-save-btn" id="discord-new-channel-btn" style="margin-top:4px;">Add Channel</button>
            </div>`;

        panel.querySelectorAll('[data-channel-id]').forEach(btn => {
            btn.onclick = () => discordDeleteChannel(btn.getAttribute('data-channel-id'), ctx);
        });
        panel.querySelector('#discord-new-channel-btn').onclick = () => discordAddChannel(panel, ctx);
        const createBtn = panel.querySelector('#discord-create-channel-btn');
        if (createBtn) createBtn.onclick = () => discordCreateChannel(panel, ctx);
    }

    async function discordCreateChannel(panel, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        const guild_id = panel.querySelector('#discord-new-guild-select').value;
        const name = (panel.querySelector('#discord-new-channel-name').value || '').trim();
        if (!guild_id || !name) {
            statusEl.textContent = 'Choose a guild and enter a channel name.';
            return;
        }
        statusEl.style.color = '#555';
        statusEl.textContent = 'Creating channel…';
        try {
            const resp = await fetch(`https://discord.mooc.ca/admin/guilds/${guild_id}/channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken, name })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const result = await resp.json();
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = result.name ? `✓ Created "${result.name}".` : '✓ Channel created.';
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord create channel failed:', e);
            statusEl.style.color = '#c00';
            statusEl.textContent = 'Could not create channel: ' + e.message;
        }
    }

    async function discordAddChannel(panel, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        const guild_id = (panel.querySelector('#discord-new-guild').value || '').trim();
        const channel_id = (panel.querySelector('#discord-new-channel-id').value || '').trim();
        const webhook_url = (panel.querySelector('#discord-new-webhook').value || '').trim();
        if (!guild_id || !channel_id || !webhook_url) {
            statusEl.textContent = 'Please fill in all fields to add a channel.';
            return;
        }
        statusEl.textContent = 'Looking up guild and channel names…';
        try {
            const resp = await fetch('https://discord.mooc.ca/admin/channels', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken, guild_id, channel_id, webhook_url })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            const result = await resp.json();
            statusEl.style.color = '#2a7a2a';
            statusEl.textContent = result.name ? `✓ Added "${result.name}".` : '✓ Channel added.';
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord add channel failed:', e);
            statusEl.textContent = 'Could not add channel: ' + e.message;
        }
    }

    async function discordDeleteChannel(id, ctx) {
        const { statusEl, botTokenEl } = ctx;
        const botToken = (botTokenEl.value || '').trim();
        try {
            const resp = await fetch(`https://discord.mooc.ca/admin/channels/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: botToken })
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${resp.status}`);
            }
            await discordManageChannels(ctx);
            await refreshDiscordChannelPickerIfVisible();
        } catch (e) {
            console.error('Discord delete channel failed:', e);
            statusEl.textContent = 'Could not delete channel: ' + e.message;
        }
    }
    return { open, manageChannels: discordManageChannels };
};
