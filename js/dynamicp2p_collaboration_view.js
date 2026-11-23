function createP2pCollaborationView(doc = document) {
    const root = doc.getElementById('chat-messages');
    return {
        alive: () => !!root?.isConnected && doc.getElementById('chat-messages') === root,
        capture: () => Array.from(root?.children || [], row => ({
            html: row.innerHTML, text: row.textContent || '', shared: !!row.querySelector('.chat-share-card')
        })),
        error(error) {
            console.error('Could not start document from chat:', error);
            showErrorModal(error.message || String(error), { title: 'Could not start document' });
        }
    };
}
