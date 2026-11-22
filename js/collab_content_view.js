function createCollabContentView() {
    const body = (content, wrap = false) => {
        const value = content?.value || '';
        if (content?.type === 'text/html') return value;
        const text = escapeHtml(value);
        return wrap ? '<p>' + text + '</p>' : text;
    };
    return {
        html(kind, input) {
            if (kind === 'load') return body(input, true);
            if (!input.content?.value) return '';
            const quote = body(input.content);
            if (kind === 'link') return quote + ' [<a href="' + escapeHtml(input.entryUrl) + '">' + escapeHtml(input.feedTitle) + '</a>]';
            return quote + ' [<a href="' + escapeHtml(input.linkedUrl) + '">' + escapeHtml(input.linkedTitle) + '</a>, via <a href="' + escapeHtml(input.entryUrl) + '">' + escapeHtml(input.authorOrFeedTitle) + '</a>]';
        },
        insert: (target, html) => target.editor.commands.insertContent(html),
        references: target => displayReferences(target.container),
        error(error) {
            console.error('Collab content operation failed:', error);
            showErrorModal(error.message || String(error), { title: 'Could not complete Collab content operation' });
        },
        warning(message, errors = []) {
            for (const error of errors) console.error('Collab reference warning:', error);
            showStatusMessage(message);
        }
    };
}
