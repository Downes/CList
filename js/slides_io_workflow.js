// Explicit file/layout reads. Embedded conversion/download APIs are unchanged.
async function readSlidesPowerPointFile(file, assert) {
    assert();
    if (!file) return null;
    if (!/\.pptx$/i.test(file.name)) throw new Error('Choose a .pptx file. Legacy .ppt files are not supported.');
    if (file.size > 100 * 1024 * 1024) throw new Error('Choose a .pptx file smaller than 100 MB.');
    const data = await file.arrayBuffer(); assert(); return { data, filename: file.name };
}
async function readSavedSlideLayouts(store, assert) {
    assert(); const records = await store.list(); assert();
    const layouts = [], errors = [];
    for (const entry of records.filter(record => record.contentType === SLIDES_LAYOUT_TYPE)) {
        try {
            assert(); const record = await store.get(entry.id); assert();
            if (!record) continue;
            if (record.contentType !== SLIDES_LAYOUT_TYPE) throw new Error('The saved record is no longer a slide layout.');
            layouts.push(slideLayoutValue(JSON.parse(record.content), entry.id));
        } catch (error) { if (error.code === 'ExpiredSlidesOperation') throw error; errors.push(error); }
    }
    return { layouts, errors };
}
