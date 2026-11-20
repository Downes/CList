// All migration-preparation controls and safe preview presentation live here.
window.CList.ui = window.CList.ui || {};
window.CList.ui.migrationPreparation = {
    bind(root, actions) {
        const find = id => root.querySelector('#migrate-' + id);
        find('prepare-btn').onclick = actions.prepare;
        find('cancel-btn').onclick = actions.cancel;
        for (const id of ['new-url', 'new-username', 'new-password', 'register']) {
            find(id).oninput = actions.changed;
            find(id).onchange = actions.changed;
        }
        const note = document.createElement('p');
        note.textContent = 'Register creates the destination account during preview. No records are copied until Run Migration.';
        find('step-1').appendChild(note);
        const cancel = document.createElement('button');
        cancel.className = 'btn-small btn-secondary'; cancel.textContent = 'Cancel preview'; cancel.onclick = actions.cancel;
        find('step-1').appendChild(cancel);
        const retry = document.createElement('button');
        retry.id = 'migrate-retry-registration'; retry.className = 'btn-small'; retry.textContent = 'Retry registration'; retry.onclick = actions.retryRegistration;
        retry.style.display = 'none'; find('step-1').appendChild(retry);
        return {
            input: () => ({url: find('new-url').value, username: find('new-username').value,
                password: find('new-password').value, register: !!find('register').checked}),
            clearPassword() { find('new-password').value = ''; },
            state(state, approve) {
                find('step-1').style.display = state.phase === 'ready' || state.phase === 'checking' || state.phase === 'executing' ? 'none' : 'block';
                find('step-2').style.display = state.phase === 'ready' || state.phase === 'checking' ? 'block' : 'none';
                find('prepare-btn').disabled = state.phase === 'preparing';
                find('run-btn').disabled = state.phase !== 'ready' || (state.preview.conflictCount > 0 && !state.overwrite);
                retry.style.display = ['uncertain', 'rejected'].includes(state.registration) ? 'inline-block' : 'none';
                retry.disabled = state.phase === 'preparing';
                const progress = find('progress');
                progress.style.display = state.message ? 'block' : 'none'; progress.textContent = state.message || '';
                if (state.phase !== 'ready') return;
                const preview = find('preview'); preview.textContent = '';
                const line = text => { const p = document.createElement('p'); p.textContent = text; preview.appendChild(p); };
                const model = state.preview;
                line('Source: ' + model.source + ' — ' + model.accountCount + ' non-system records, ' + model.systemCount + ' system records. All records were decrypted successfully.');
                line('Destination: ' + model.destination + ' as ' + model.username);
                if (model.hasDid) line(model.local ? 'Your DID identity will be registered on the destination.' : 'Your DID identity will be linked between servers.');
                if (model.conflictCount) {
                    line(model.conflictCount + ' destination records will be overwritten' + (model.didConflict ? ', including its DID identity.' : '.'));
                    const label = document.createElement('label'), box = document.createElement('input');
                    box.type = 'checkbox'; box.id = 'migrate-overwrite-confirm'; box.checked = state.overwrite;
                    box.onchange = () => approve(!!box.checked);
                    label.appendChild(box); const text = document.createElement('span');
                    text.textContent = 'I understand this will overwrite existing destination data.'; label.appendChild(text); preview.appendChild(label);
                }
                line('Your source account is retained. After migration, log out and switch servers using Change on the login screen.');
            }
        };
    }
};
