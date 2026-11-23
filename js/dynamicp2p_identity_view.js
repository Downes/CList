function createP2pIdentityView() {
    return {
        error(operation, error) {
            console.error('Chat identity ' + operation + ' failed:', error);
            showStatusMessage('Chat ' + operation + ' failed: ' + (error.message || String(error)));
        }
    };
}
