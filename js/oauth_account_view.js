function createOAuthAccountSaveView() {
    function dialog(label, text, choices, source) {
        if (!oauthAccountSaveSurfaceCurrent(source)) { showStatusMessage(label + ': ' + text); return; }
        const body = document.createElement('div'), message = document.createElement('p'); message.textContent = text; body.appendChild(message);
        let busy = false;
        const owned = () => currentOAuthAccountSaveSource(source) && body.isConnected && document.getElementById('generic-modal')?.contains(body);
        const specs = [{ label: 'Close', secondary: true, onClick: close => { if (owned() && !busy) close(); } }];
        for (const [title, action] of choices) specs.push({ label: title, onClick: async close => {
            if (!owned() || busy) return; busy = true; modal.buttons.forEach(button => { button.disabled = true; });
            try { close(); await action(); }
            catch (error) { console.error('[OAuth recovery]', error); if (currentOAuthAccountSaveSource(source)) showStatusMessage(label + ': ' + error.message); }
            finally { busy = false; }
        } });
        const modal = buildDialogModal(label + ' authorization', body, specs);
    }
    return {
        success: label => showStatusMessage(label + ' account authorized and saved.'),
        failure(label, error, receipt, actions, source) {
            dialog(label, (receipt === 'accepted' ? 'Account saved, but refresh failed. ' : receipt === 'uncertain' ? 'Account write could not be confirmed. ' : 'Account could not be saved. ') + error.message,
                [[receipt === 'accepted' ? 'Retry refresh' : receipt === 'uncertain' ? 'Check saved account' : 'Retry account save', receipt === 'accepted' ? actions.refresh : receipt === 'uncertain' ? actions.check : actions.retry]], source);
        },
        review(label, actions, source) { dialog(label, 'The current stored account does not confirm the earlier write. Review Accounts before explicitly retrying.', [['Retry account save', actions.retry]], source); },
    };
}
