/// <reference path="./clist-types.js" />
const SLIDES_LAYOUT_TYPE = 'application/vnd.clist.slide-layout+json';
function slideLayoutValue(value, id) {
    if (!value || value.format !== 'clist-slide-layout-v1' || typeof value.id !== 'string' || !value.id
        || (id && value.id !== id) || typeof value.update !== 'string') throw new Error('This saved layout is invalid.');
    return value;
}
/** @param {{kind:string,layout:CListSlideLayout,title:string}} request */
async function writeSlideLayout(request, deps) {
    deps.assert();
    const record = await deps.get(request.layout.id); deps.assert();
    let value, page;
    if (request.kind === 'save') {
        if (record) throw new Error('A saved layout with this ID already exists. Start a new layout save.');
        value = { ...slideLayoutValue(request.layout), label: request.title };
        page = { id: value.id, title: request.title, content: JSON.stringify(value), contentType: SLIDES_LAYOUT_TYPE, editorType: 'slides', references: [], revision: 0 };
    } else {
        if (!record || record.contentType !== SLIDES_LAYOUT_TYPE) throw new Error('This saved layout is no longer available.');
        if (request.kind === 'delete') { value = request.layout; page = null; }
        else {
            value = { ...slideLayoutValue(JSON.parse(record.content), request.layout.id), label: request.title };
            page = { ...record, title: request.title, content: JSON.stringify(value), revision: record.revision };
        }
    }
    deps.assert(); deps.writing({ value, page });
    if (request.kind === 'delete') { await deps.remove(request.layout.id); const result = { value: true, page: null }; deps.accepted(result); return result; }
    const saved = await deps.save(page); const result = { value, page: saved }; deps.accepted(result); return result;
}
async function checkSlideLayoutWrite(request, attempted, deps) {
    deps.assert(); const record = await deps.get(request.layout.id); deps.assert();
    return { confirmed: request.kind === 'delete' ? !record : !!record && record.contentType === SLIDES_LAYOUT_TYPE && record.content === attempted.page.content, record };
}
