/// <reference path="./clist-types.js" />
// Local export/write/index operations. Explicit inputs; no controls or live editor reads.
/** @returns {Promise<CListLocalFileOutput|null>} */
async function prepareLocalFile(request, deps) {
    const { handler, page, references, title, editor } = request;
    const raw = typeof handler?.getFileContent === 'function' || !!handler?.fileExtension || (page?.kind === 'file' && !references.length);
    let value, nativeType = null;
    if (typeof handler?.getFileContent === 'function') {
        const native = await handler.getFileContent();
        value = native.value; nativeType = native.type;
    } else if (raw) value = await handler.getContent();
    else {
        const content = await handler.getContent();
        if (typeof content !== 'string') throw new Error('The editor did not return text content.');
        value = await deps.packagePost({ title, content, referenceHtml: request.referenceHtml, editorHandler: handler,
            fileMetadata: { format: 'clist-post-v1', editor, title, references } });
    }
    if (value == null) return null;
    if (typeof value !== 'string') throw new Error('The editor did not return text content.');
    const name = nativeType ? (page?.kind === 'file' ? page.title : 'annotation.json')
        : handler?.fileExtension ? (page?.kind === 'file' ? page.title : 'presentation.' + handler.fileExtension)
            : raw ? page.title : undefined;
    const mimeType = nativeType || (raw ? handler?.contentTypes?.[0] || 'text/plain' : 'text/html');
    return { value, name, raw, mimeType, title: raw ? name : title };
}

// A download receipt means handed to the browser, not confirmed filesystem persistence.
/** @param {CListLocalFileOutput} output */
async function runLocalFileSave(request, output, deps) {
    deps.assertCurrent();
    const receipt = await deps.write(output.value, request.id, output.name);
    if (!receipt || receipt.status === 'cancelled') return { status: 'cancelled' };
    const result = { status: receipt.status, receipt, loadedPage: null, metadataError: null };
    if (!request.loggedIn) return result;
    try {
        deps.assertCurrent();
        const now = deps.now();
        if (request.page?.id && request.page.pageKey) {
            const touched = await deps.touch(request.page.pageKey, request.page.id,
                { savedLocally: true, savedLocallyAt: now });
            result.loadedPage = { ...request.page, id: touched.id, pageKey: touched.pageKey,
                savedLocally: true, savedLocallyAt: now };
            result.forked = touched.forked;
            deps.aliasHandle(request.id, touched.id);
        } else {
            const record = { id: request.id, title: output.title, mimeType: output.mimeType,
                authorDid: request.authorDid, savedLocally: true, savedLocallyAt: now };
            const pageKey = await deps.saveRecord(record);
            result.loadedPage = { kind: output.raw ? 'file' : 'page', ...record, pageKey,
                format: output.raw ? (output.mimeType.split('/')[1] || '').toUpperCase() : 'HTML' };
        }
    } catch (error) {
        result.metadataError = error;
    }
    return result;
}

// Browser file API transport. UI (including filename choice) is supplied by the caller.
/** @returns {Promise<CListLocalFileReceipt>} */
async function writeLocalFileTransport(content, id, name, deps) {
    if (!deps.pickFile) return deps.download(content, name || 'content.txt');
    let handle = id ? deps.handles[id] : null;
    try {
        if (handle) {
            const granted = await handle.queryPermission({ mode: 'readwrite' }) === 'granted'
                || await handle.requestPermission({ mode: 'readwrite' }) === 'granted';
            if (!granted) handle = null;
        }
        deps.assertCurrent();
        if (!handle) {
            const filename = name || 'content.txt';
            const ext = (filename.match(/\.([^./]+)$/)?.[1] || 'txt').toLowerCase();
            handle = await deps.pickFile({ suggestedName: filename,
                types: [{ description: 'Text Files', accept: { 'text/plain': ['.' + ext] } }] });
        }
        deps.assertCurrent();
        const stream = await handle.createWritable();
        try {
            deps.assertCurrent();
            await stream.write(content);
            deps.assertCurrent();
            await stream.close();
        } catch (error) {
            if (typeof stream.abort === 'function') await stream.abort().catch(() => {});
            throw error;
        }
        if (id) deps.handles[id] = handle;
        return { status: 'saved', name: handle.name || name || 'content.txt' };
    } catch (error) {
        if (error.name === 'AbortError') return { status: 'cancelled' };
        throw error;
    }
}
