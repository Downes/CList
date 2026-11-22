function createCollabCreationView(setTitle) {
    return {
        title: model => setTitle(model.slug, model.title),
        seed(editor, model) {
            const heading = '<h2>' + escapeHtml(model.title) + '</h2>';
            const body = model.kind === 'chat' ? '<blockquote>' + model.html + '</blockquote><p></p>' :
                model.items.map(item => '<p><a href="' + escapeHtml(item.url) + '">' + escapeHtml(item.title || item.url) + '</a></p>').join('');
            editor.commands.setContent(sanitizeHtml(heading + body));
            if (model.kind === 'chat') editor.commands.focus('end');
        },
        error(error) {
            console.error('Collaboration document creation failed:', error);
            showErrorModal(error.message || String(error), { title: 'Could not complete collaboration document' });
        }
    };
}
