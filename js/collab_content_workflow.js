/** Mirror one captured reference into the captured shared document map.
 * @param {{set:function(string,string):unknown}|null} map Captured Y.Map-compatible target.
 * @param {CListReference} reference
 */
function mirrorCollabReference(map, reference) {
    if (map && reference?.url) map.set(reference.url, JSON.stringify(reference));
}
/**
 * @param {{forEach:function(function(string):void):void}|null} map Captured raw JSON map.
 * @returns {{references:CListReference[],errors:Error[]}}
 */
function readCollabReferences(map) {
    const references = [], errors = [];
    if (map) map.forEach(value => {
        try {
            const reference = JSON.parse(value);
            if (!reference || typeof reference !== 'object' || Array.isArray(reference)) throw Error('Invalid shared reference record.');
            references.push(reference);
        } catch (error) { errors.push(error); }
    });
    return { references, errors };
}
