// Dropbox save decisions and explicit operations. No DOM or live editor/account reads.
async function prepareDropboxFile(request, deps) {
    const output = await deps.prepareFile(request, { packagePost: deps.packagePost });
    if (!output) return null;
    const base = request.page?.kind === 'file' ? request.page.title.replace(/\.[^./]+$/, '')
        : request.page?.title || request.title;
    return { ...output, name: output.name || deps.slug(base) + '.html' };
}
async function runDropboxFileSave(file, deps) {
    deps.assertCurrent();
    if (typeof file?.name !== 'string' || !file.name.trim() || typeof file.value !== 'string') {
        throw new Error('The Dropbox file name or text content is unavailable.');
    }
    deps.progress('Checking Dropbox…');
    const exists = await deps.exists(file.name);
    deps.assertCurrent();
    const overwrite = async () => {
        const choice = await deps.choose(file.name);
        if (choice !== 'overwrite') return { status: 'cancelled', keepOpen: true };
        deps.assertCurrent();
        deps.progress('Saving…');
        return saved(await deps.upload(file.name, file.value, 'overwrite'));
    };
    const saved = receipt => ({ status: 'saved', keepOpen: true,
        receipt: { name: file.name, path: receipt?.path_display || receipt?.path_lower || file.name,
            id: receipt?.id || null, rev: receipt?.rev || null } });
    if (exists) return overwrite();
    deps.progress('Saving…');
    try { return saved(await deps.upload(file.name, file.value, 'add')); }
    catch (error) {
        if (error?.status !== 409 || !error.conflict) throw error;
        // A confirmed rejected add can lead to a new explicit choice, never an
        // automatic overwrite or a repeat after an uncertain upload result.
        return overwrite();
    }
}
