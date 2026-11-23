function discordSetupSurfaceCurrent(node) {
    if (!node?.isConnected) return false;
    for (let parent = node; parent; parent = parent.parentNode) if (parent.style?.display === 'none' || parent.hidden) return false;
    return true;
}
function discordSetupButton(parent, id, label, secondary = false) {
    const button = document.createElement('button'); button.type = 'button'; button.id = id; button.className = 'btn-small' + (secondary ? ' btn-secondary' : ''); button.textContent = label; parent.appendChild(button); return button;
}
function discordSetupFeedback(status, current) {
    function message(text, error = false) { if (current()) { status.innerHTML = ''; status.className = error ? 'error-message' : 'feed-status-message'; status.textContent = text; } }
    return {
        message, recovery(text, choices, guard) {
            message(text, true); if (!current()) return;
            for (const [label, action] of choices) {
                const button = discordSetupButton(status, '', label);
                button.onclick = async () => {
                    if (!current() || !status.contains(button) || button.disabled || !guard()) return;
                    button.disabled = true;
                    try { await action(); } catch (error) { console.error('[Discord recovery]', error); if (current() && guard()) message(error.message, true); }
                    finally { button.disabled = false; }
                };
            }
        },
    };
}
function createDiscordSetupView(container) {
    container.innerHTML = ''; container.style.display = 'block'; const root = document.createElement('div'); container.appendChild(root);
    const heading = document.createElement('h3'); heading.textContent = 'Select Channels'; root.appendChild(heading);
    const status = document.createElement('div'); status.id = 'discord-select-status'; root.appendChild(status);
    const list = document.createElement('div'); list.id = 'discord-channel-list'; list.className = 'account-list'; root.appendChild(list);
    const back = discordSetupButton(root, 'discord-back-btn', 'Back', true);
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Manage channels (admin)'; details.appendChild(summary); root.appendChild(details);
    const caption = document.createElement('label'); caption.textContent = 'Bot Token'; caption.setAttribute('for', 'discord-bot-token'); details.appendChild(caption);
    const token = document.createElement('input'); token.id = 'discord-bot-token'; token.type = 'password'; token.value = ''; details.appendChild(token);
    const manage = discordSetupButton(details, 'discord-manage-btn', 'Manage Channels');
    const panel = document.createElement('div'); panel.id = 'discord-admin-panel'; panel.style.display = 'none'; details.appendChild(panel);
    const current = () => discordSetupSurfaceCurrent(root) && root.parentNode === container;
    const feedback = discordSetupFeedback(status, current);
    return { current, ...feedback,
        bind(controller, admin) { back.onclick = () => current() && controller.back(); manage.onclick = () => current() && admin({ statusEl: status, botTokenEl: token, panelEl: panel }); },
        channels(rows, choose, guard) {
            if (!current()) return; list.innerHTML = '';
            if (!rows.length) { const empty = document.createElement('p'); empty.textContent = 'No channels registered yet — ask your admin to add one under Manage channels.'; list.appendChild(empty); }
            for (const row of rows) {
                const item = document.createElement('div'); item.className = 'account-list-item';
                const button = document.createElement('button'); button.type = 'button'; button.className = 'account-button' + (row.key ? ' selected' : ''); button.textContent = row.name; item.appendChild(button); list.appendChild(item);
                button.onclick = () => current() && list.contains(button) && guard() && choose(row);
            }
        },
    };
}
function decorateDiscordAccountForm(context) {
    if (context.mode !== 'edit') return;
    const root = document.createElement('div'), status = document.createElement('div'), panel = document.createElement('div');
    status.id = 'discord-edit-status'; panel.id = 'discord-edit-admin-panel'; panel.style.display = 'none'; root.appendChild(status);
    const button = discordSetupButton(root, 'discord-edit-manage-btn', 'Manage Channels'); root.appendChild(panel); context.container.appendChild(root);
    const token = context.root.querySelector('#bot_tokenInput');
    button.onclick = () => root.isConnected && token?.isConnected && context.getAccountFlow('Discord').manageChannels({ statusEl: status, botTokenEl: token, panelEl: panel });
}
