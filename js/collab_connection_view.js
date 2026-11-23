function createCollabConnectionView(target, doc = document) {
    const status = target.statusElement, who = doc.getElementById('collab-who');
    const currentNode = (node, id) => !!node?.isConnected && doc.getElementById(id) === node;
    return {
        status(value) { if (currentNode(status, 'collab-status')) status.textContent = value; },
        awareness(states) {
            if (!currentNode(who, 'collab-who')) return;
            who.textContent = '';
            states.filter(state => state?.user).forEach((state, index) => {
                if (index) who.appendChild(doc.createTextNode(' '));
                const span = doc.createElement('span'); span.className = 'collab-user';
                span.style.color = /^#[0-9a-f]{3,6}$/i.test(state.user.color || '') ? state.user.color : '#888';
                span.textContent = '● ' + (typeof state.user.name === 'string' && state.user.name ? state.user.name : 'Anonymous'); who.appendChild(span);
            });
        },
        authenticationFailed() {
            console.error('Collaboration authentication failed.');
            showErrorModal('Collaboration: authentication failed — make sure you are logged in.', { title: 'Collab authentication failed' });
        },
        error(operation, error) {
            console.error('Collaboration ' + operation + ' failed:', error);
            showStatusMessage('Collaboration ' + operation + ' failed.');
        }
    };
}
