function createOAuthCallbackView() {
    return { failure() { showStatusMessage('Authorization could not be completed. Return to Accounts and start authorization again.'); } };
}
