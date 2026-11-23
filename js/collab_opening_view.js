function createCollabOpeningView(setTitle) {
    return {
        title: target => setTitle(target.label, target.title),
        error(error) {
            console.error('Could not open collaboration document:', error);
            showErrorModal('Could not open collab document: ' + error.message, { title: 'Could not open collab document' });
        }
    };
}
