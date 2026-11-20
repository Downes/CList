// Discord empty-result feedback; reader controller supplies the captured channel.
function showDiscordReadNotice(channel) {
    const p = document.createElement('p'); p.className = 'feed-status-message';
    p.textContent = channel ? 'No recent messages found.' : 'No channel selected for this account.';
    window.CList.ui.view.feedContainer.appendChild(p);
}
