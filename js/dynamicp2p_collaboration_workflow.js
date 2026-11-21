// Preserve the existing last-15 non-card transcript representation.
function prepareP2pCollaboration(rows, discussion) {
    const html = rows.filter(row => !row.shared && row.text.trim()).slice(-15)
        .map(row => '<p>' + row.html + '</p>').join('');
    return { html: html || null, discussion };
}
