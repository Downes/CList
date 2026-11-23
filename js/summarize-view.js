function summaryInputHtml(input, output) {
    if (!input) throw Error('The text to summarize is no longer available.');
    const copy = input.cloneNode(true);
    copy.querySelector('.feed-header')?.remove();
    copy.querySelectorAll('.status-actions, .clist-actions').forEach(node => node.remove());
    // Summary progress/results can live inside the input feed. They are not input.
    if (output?.id) copy.querySelectorAll('[id]').forEach(node => { if (node.id === output.id) node.remove(); });
    return copy.innerHTML;
}
function createSummaryView(inputId, outputId, doc = document) {
    const input = doc.getElementById(inputId), output = doc.getElementById(outputId);
    const alive = () => !!input?.isConnected && !!output?.isConnected && doc.getElementById(inputId) === input && doc.getElementById(outputId) === output;
    return {
        alive, capture: () => summaryInputHtml(input, output),
        pending() { output.textContent = 'Summarizing... Please wait.'; output.className = ''; },
        show(text, load) {
            output.textContent = ''; output.className = 'status-box';
            const body = doc.createElement('div'); body.className = 'status-content'; body.id = outputId + '-content'; body.textContent = text;
            const actions = doc.createElement('div'); actions.className = 'clist-actions';
            const button = doc.createElement('button'); button.className = 'clist-action-btn'; button.title = 'Load into editor';
            const icon = doc.createElement('span'); icon.className = 'material-icons md-18 md-light'; icon.textContent = 'arrow_right'; button.appendChild(icon);
            button.onclick = () => { if (alive() && body.parentNode === output && doc.getElementById(body.id) === body) load(body.id); };
            actions.appendChild(button); output.appendChild(body); output.appendChild(actions);
        },
        error(error) {
            console.error('Failed to summarize:', error);
            output.className = 'error-message'; output.textContent = 'Could not summarize: ' + (error.message || String(error));
        }
    };
}
