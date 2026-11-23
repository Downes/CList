// Shared inline save feedback only; operation ownership and writes remain controller-owned.
function createAccountSetupFeedback(feedback, current, button) {
    function message(text, error = false) { if (!current()) return; feedback.innerHTML = ''; feedback.className = error ? 'error-message' : 'feed-status-message'; feedback.textContent = text; }
    function recover(text, title, action, guard) {
        message(text, true); if (!current()) return;
        const retry = button(feedback, '', title);
        retry.onclick = async () => {
            if (!current() || !retry.isConnected || !feedback.contains(retry) || retry.disabled || !guard()) return;
            retry.disabled = true;
            try { await action(); } catch (error) { console.error('[Account setup recovery]', error); if (current()) message(error.message, true); }
            finally { retry.disabled = false; }
        };
    }
    return { message, error: error => message(error.message, true),
        recovery(error, receipt, actions) {
            recover((receipt === 'accepted' ? 'Account saved; refresh failed. ' : receipt === 'uncertain' ? 'Account write could not be confirmed. ' : 'Account could not be saved. ') + error.message,
                receipt === 'accepted' ? 'Retry refresh' : receipt === 'uncertain' ? 'Check saved account' : 'Retry account save',
                receipt === 'accepted' ? actions.refresh : receipt === 'uncertain' ? actions.check : actions.retry, actions.current);
        },
        review(actions) { recover('The stored account does not confirm the earlier write. Review Accounts before retrying.', 'Retry original account save', actions.retry, actions.current); },
    };
}
