/// <reference path="./clist-types.js" />
/** @param {CListNativePageSaveRequest} request
 * @param {string} content
 * @param {{assertCurrent:function():void,write:function(CListNativePageSaveRequest):Promise<CListNativePageSaveResult>}} deps
 * @returns {Promise<CListNativePageSaveResult>}
 */
async function writeLocalPageSnapshot(request, content, deps) {
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(Error('Nothing to save — the editor is empty.'), { code:'EmptyContent' });
    deps.assertCurrent();
    return await deps.write({ ...request, content });
}
