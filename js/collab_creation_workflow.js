/**
 * Capture a presentation seed, without changing collection membership records.
 * @param {'collection'|'chat'} kind
 * @param {{name?:string,items?:CListCollectionMember[],html?:string}} input
 * @param {{slug:function(string):string,now:function():Date}} deps
 */
function prepareCollabCreation(kind, input, deps) {
    if (kind === 'collection') {
        const name = typeof input.name === 'string' ? input.name : '';
        const slug = deps.slug(name);
        return { kind, slug, title: name || slug, items: Array.from(input.items || [], item => ({
            url: typeof item?.url === 'string' ? item.url : '', title: typeof item?.title === 'string' ? item.title : ''
        })).filter(item => item.url), html: '' };
    }
    if (kind === 'chat') {
        const iso = deps.now().toISOString();
        return { kind, slug: 'discussion-' + iso.slice(0, 19).replace(/[T:]/g, '-'),
            title: input.name ? 'Discussion: ' + input.name : 'Discussion — ' + iso.slice(0, 10),
            html: typeof input.html === 'string' ? input.html : '', items: [] };
    }
    throw Error('Unknown collaboration creation request.');
}
