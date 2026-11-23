/// <reference path="./clist-types.js" />
/** Convert a native record into the existing shared saved-content loader input.
 * @param {CListNativePageRecord} record
 * @param {string} expectedId
 */
function prepareLocalPageOpening(record, expectedId) {
    if (!record) throw Object.assign(Error('That page no longer exists. Reload the list before trying again.'), {code:'PageNotFound'});
    if (record.id !== expectedId || typeof record.content !== 'string') throw Error('The saved page has invalid content or identity.');
    /** @type {CListWebPageSource} */
    const page = {kind:'local-page',id:record.id,title:record.title,revision:record.revision,
        references:structuredClone(Array.isArray(record.references) ? record.references : [])};
    const publications = Array.isArray(record.publications) ? record.publications.filter(item => item && typeof item === 'object') : [];
    if (publications.length) {
        const latest = publications.reduce((a,b) => a.publishedAt > b.publishedAt ? a : b);
        page.service = latest.service; page.accountInstance = latest.accountId; page.publicationUrl = latest.url;
    }
    return {content:{type:record.contentType,value:record.content},page};
}
