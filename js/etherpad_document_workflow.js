// Document operations with explicit immutable targets and stage ownership checks.
const ETHERPAD_WELCOME = 'Welcome to your new Etherpad document!\n\nThis content was dynamically added via the API.';
function etherpadDocumentUrl(base, pad) {
    const url = new URL(base);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('The Etherpad server URL must use HTTP or HTTPS without credentials.');
    url.pathname = url.pathname.replace(/\/+$/, '') + '/p/' + encodeURIComponent(pad); url.search = ''; url.hash = '';
    return url.href;
}
async function prepareEtherpadDocument(request, deps) {
    deps.assert();
    const author = await deps.api('createAuthorIfNotExistsFor', { name: request.username, authorMapper: request.username });
    deps.assert();
    if (typeof author?.authorID !== 'string' || !author.authorID) throw new Error('Etherpad returned no author ID.');
    let created = false;
    if (request.create) {
        deps.creating();
        const result = await deps.api('createPad', { padID: request.pad });
        created = !!result.created; deps.created(result); deps.assert();
    }
    if (created) {
        const current = await deps.api('getText', { padID: request.pad }); deps.assert();
        if (typeof current?.text !== 'string') throw new Error('Etherpad returned invalid pad text.');
        if (!current.text.trim()) { await deps.api('setText', { padID: request.pad, text: ETHERPAD_WELCOME }); deps.assert(); }
    } else {
        const current = await deps.api('getHTML', { padID: request.pad }); deps.assert();
        if (typeof current?.html !== 'string') throw new Error('Etherpad returned invalid pad HTML.');
    }
    return { author: author.authorID, username: request.username, pad: request.pad, created };
}
async function readEtherpadDocument(target, format, deps) {
    deps.assert();
    if (!['html', 'text'].includes(format)) throw new Error('Choose HTML or text for Etherpad export.');
    let value;
    if (target.guest) {
        const html = await deps.guestRead(); value = format === 'html' ? html : deps.plaintext(html);
    } else { const result = await deps.api(format === 'html' ? 'getHTML' : 'getText', { padID: target.pad }); value = result?.[format]; }
    deps.assert();
    if (typeof value !== 'string') throw new Error('Etherpad returned invalid document content.');
    return value;
}
async function appendEtherpadDocument(target, content, deps) {
    const existing = await readEtherpadDocument(target, 'html', deps); deps.assert();
    const html = '<body>' + existing + content + '</body>';
    await (target.guest ? deps.guestWrite(html) : deps.api('setHTML', { padID: target.pad, html }));
    // The accepted write remains accepted even if ownership changes after dispatch.
    return { receipt: 'accepted' };
}
