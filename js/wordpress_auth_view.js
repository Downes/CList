function createWordPressAuthView() {
    return { failure(error) { showStatusMessage(error.message); } };
}
