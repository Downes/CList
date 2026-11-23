function createP2pShareView(doc = document) {
    return {
        capture(itemId) {
            const node = doc.getElementById(itemId), row = node?.closest?.('.status-box');
            if (!node?.isConnected || !node.reference || (row?.isCListRowCurrent && !row.isCListRowCurrent())) throw Error('Could not find a current item to share.');
            return { key: node, reference: structuredClone(node.reference), text: node.textContent, itemId,
                public: !!doc.getElementById('discussionPublicCheckbox')?.checked,
                current: () => node.isConnected && doc.getElementById(itemId) === node && (!row?.isCListRowCurrent || row.isCListRowCurrent()) };
        },
        notice(message) { showStatusMessage(message); },
        error(error) { console.error('Chat sharing failed:', error); showErrorModal(error.message || String(error), { title: 'Could not share to chat' }); }
    };
}
