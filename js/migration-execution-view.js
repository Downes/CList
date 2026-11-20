window.CList.ui = window.CList.ui || {};
window.CList.ui.migrationExecution = {
    render(root, state, actions) {
        root.querySelector('#migrate-step-1').style.display = 'none';
        root.querySelector('#migrate-step-2').style.display = 'none';
        const container = root.querySelector('#migrate-progress'); container.style.display = 'block'; container.textContent = '';
        const line = text => { const p = document.createElement('p'); p.textContent = text; container.appendChild(p); };
        line(state.complete ? 'Migration complete.' : state.pending ? 'Migration in progress…' : 'Migration needs review.');
        line(state.copied + ' of ' + state.total + ' records accepted at ' + state.destination + '.');
        if (state.identityTotal) line(state.identities + ' of ' + state.identityTotal + ' identity publications accepted.');
        if (state.error) { const p = document.createElement('p'); p.className = 'error-message'; p.textContent = state.error; container.appendChild(p); }
        if (state.complete) line('Your source account has been kept. Log out and use Change on the login screen to switch servers.');
        else {
            line('Accepted steps are retained in this tab. Check migration reads the captured targets; retry sends only remaining steps. Keep this tab open for recovery.');
            const button = document.createElement('button'); button.className = 'btn-small'; button.id = 'migrate-recovery-btn';
            button.textContent = state.checkRequired ? 'Check migration' : 'Retry remaining steps'; button.disabled = state.pending;
            button.onclick = state.checkRequired ? actions.check : actions.retry; container.appendChild(button);
        }
    }
};
