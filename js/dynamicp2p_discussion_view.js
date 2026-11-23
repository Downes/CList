function createP2pDiscussionActionView(doc = document) {
    const root = doc.getElementById('chat-section'), input = doc.getElementById('discussionNameInput');
    const publicChoice = doc.getElementById('discussionPublicCheckbox');
    const create = doc.getElementById('advertiseDiscussionButton'), leave = doc.getElementById('endDiscussionButton');
    let controls = [];
    const alive = () => !!root?.isConnected && doc.getElementById('chat-section') === root
        && [input, publicChoice, create, leave].every(node => node && root.contains(node));
    return {
        alive,
        accepts: (origin, kind) => !origin || origin === (kind === 'create' ? create : leave),
        values: () => ({ name: input.value.trim(), public: !!publicChoice.checked }),
        render(state, callbacks) {
            if (!alive()) return;
            for (const button of controls) button.onclick = null; controls = [];
            let status = root.querySelector('#chat-discussion-status');
            if (!status) { status = doc.createElement('div'); status.id = 'chat-discussion-status'; status.setAttribute('role', 'status'); root.appendChild(status); }
            status.innerHTML = '';
            const text = doc.createElement('p'); text.className = ['rejected', 'uncertain', 'effects-error'].includes(state.phase) ? 'error-message' : 'feed-status-message';
            text.textContent = state.message; status.appendChild(text);
            create.disabled = leave.disabled = ['pending', 'uncertain', 'checking', 'review', 'effects-error'].includes(state.phase);
            for (const [key, label] of [['check', 'Check discussion list'], ['retry', 'Retry original request'], ['effects', 'Retry local updates'], ['dismiss', 'Done']]) {
                if (!callbacks[key]) continue;
                const button = doc.createElement('button'); button.type = 'button'; button.className = 'btn btn-small';
                button.textContent = label; button.onclick = callbacks[key]; controls.push(button); status.appendChild(button);
            }
        },
        active(value) {
            const start = doc.getElementById('discussion-button-div'), end = doc.getElementById('end-discussion-div');
            if (start) start.style.display = value ? 'none' : 'block';
            if (end) end.style.display = value ? 'block' : 'none';
            doc.body.classList.toggle('chat-active', value);
        },
        dispose() { for (const button of controls) button.onclick = null; controls = []; }
    };
}
