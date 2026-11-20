/// <reference path="./clist-types.js" />
// Collection opening/export preparation. Explicit inputs; no live editor or DOM reads.
async function prepareCollectionText(collection, html, deps) {
    deps.assertCurrent();
    const items = await deps.flatten(collection.items, collection.id);
    deps.assertCurrent();
    const references = items.filter(item => item.url && !item.url.startsWith('blob:'))
        .map(item => ({ ...item, statusID: item.id }));
    const paragraphs = references.map(item => {
        const author = item.author_name && !item.author_name.startsWith('(') ? item.author_name
            : item.feed && item.feed !== '(no feed specified)' ? item.feed : item.service || 'Unknown';
        const body = item.summary || item.title || '';
        return html ? `<p><strong>${deps.escape(author)}</strong> wrote: ${deps.escape(body)}</p>`
            : `${deps.escape(author)} wrote: ${deps.escape(body)}`;
    });
    return { content: { type: html ? 'text/html' : 'text/plain', value: paragraphs.join(html ? '<p><br></p>' : '\n\n') }, references };
}

async function fetchCollectionMember(item, savedPage, deps) {
    deps.assertCurrent();
    if (item.role === 'contains' && item.collectionId) {
        if (!deps.canResolve) throw new Error('Please log in to open nested collections.');
        const nested = await deps.resolve(item.collectionId);
        deps.assertCurrent();
        if (!nested) throw new Error('Nested collection not found.');
        return { collection: { ...nested, name: nested.name || nested.title || '' } };
    }
    if (!item.url) throw new Error('This entry has no content to open yet.');
    const local = item.localOnly && item.url.startsWith('blob:');
    if (!savedPage && !local) throw new Error('This resource is not one of your editable pages.');
    if (!local && !/^https?:\/\//i.test(item.url)) throw new Error('This resource has no loadable web address.');
    const response = await deps.fetch(item.url);
    if (!response.ok) throw new Error(`Fetch error ${response.status}`);
    const text = await response.text();
    deps.assertCurrent();
    return { content: { type: savedPage?.mimeType || item.mimeType || 'text/plain', value: text }, page: savedPage };
}
