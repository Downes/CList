function createTranslationView(doc = document) {
    return {
        enabled(value) { const button = doc.getElementById('translation-toggle-btn'); if (button) button.textContent = 'Translate: ' + (value ? 'ON' : 'OFF'); },
        error(operation, error) {
            console.error('Translation ' + operation + ' failed:', error);
            showStatusMessage('Translation ' + operation + ' failed. ' + (operation === 'request' ? 'Original text retained.' : 'Please try again.'));
        },
        form() {
            const input = doc.getElementById('inputText'), output = doc.getElementById('translated-text');
            if (!input || !output) throw Error('The translation form is no longer available.');
            const text = input.value;
            return { text, output, current: () => input.isConnected && output.isConnected && input.value === text && doc.getElementById(input.id) === input && doc.getElementById(output.id) === output,
                show: result => { output.textContent = result; } };
        }
    };
}
