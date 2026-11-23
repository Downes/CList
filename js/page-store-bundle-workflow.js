/** @param {string} text @param {'skip'|'replace'|'duplicate'} policy */
function parseLocalPageBundle(text, policy) {
    if (!['skip','replace','duplicate'].includes(policy)) throw Error('Choose a valid import conflict policy.');
    try { return JSON.parse(text); }
    catch { throw Error('That file is not valid JSON.'); }
}
/** @param {CListNativePageImportResult} result */
function localPageImportSummary(result) {
    const parts=[];
    for(const [key,label] of [['imported','imported'],['replaced','replaced'],['duplicated','duplicated'],['skipped','skipped']]) if(result[key])parts.push(result[key]+' '+label);
    if(result.errors.length)parts.push(result.errors.length+' failed');
    return {text:parts.length?parts.join(', '):'Nothing to import.',problems:!!(result.errors.length||result.danglingReferences.length)};
}
