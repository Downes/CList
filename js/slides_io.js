// Captured embedded-editor dispatch and independent import/export/read lifetimes.
function createSlidesIOController(deps, view) {
    let importing = null, refreshId = 0;
    const exports = new Map();
    function state() {
        /** @type {CListSlidesIOState} */
        const value = { importing: !!importing, exports: exports.size }; deps.state(value);
    }
    function ownership(source) {
        return () => { if (!deps.current(source)) throw Object.assign(new Error('The earlier Slides operation expired.'), { code: 'ExpiredSlidesOperation' }); };
    }
    function importJob(acquire, propagate, key) {
        const source = deps.capture();
        if (importing) {
            if (deps.current(importing.source) && importing.key.kind === key.kind && (key.kind === 'picker' || (importing.key.data === key.data && importing.key.filename === key.filename))) return importing.promise;
            const error = new Error('An earlier PowerPoint import is still running. Retry after it finishes.');
            if (deps.current(source)) view.error('PowerPoint import', error);
            return propagate ? Promise.reject(error) : Promise.resolve(null);
        }
        const assert = ownership(source), job = importing = { source, key };
        state();
        job.promise = Promise.resolve().then(async () => {
            assert(); const request = await acquire(assert); assert(); if (!request) return null;
            view.progress('Reading PowerPoint presentation…'); assert();
            const result = await source.editor.importPowerPoint(request.data, request.filename);
            job.accepted = true; job.result = result;
            if (deps.current(source)) deps.sync(source);
            if (deps.current(source)) deps.closeLoad(source);
            if (deps.current(source)) deps.report(() => {
                if (!deps.current(source)) return;
                try { view.imported(result); }
                catch (error) { deps.log(error); if (deps.current(source)) view.error('PowerPoint imported; report', error); }
            });
            return result;
        }).catch(error => {
            deps.log(error);
            if (error.name !== 'AbortError' && error.code !== 'ExpiredSlidesOperation' && deps.current(source)) view.error(job.accepted ? 'PowerPoint imported; local refresh' : 'PowerPoint import', error);
            if (job.accepted) return job.result;
            if (propagate && error.code !== 'ExpiredSlidesOperation' && error.name !== 'AbortError') throw error;
            return null;
        }).finally(() => { if (importing === job) importing = null; state(); });
        return job.promise;
    }
    return {
        pickImport() { return importJob(async assert => { const file = await view.pick(); assert(); return readSlidesPowerPointFile(file, assert); }, false, { kind: 'picker' }); },
        importBytes(data, filename) { return importJob(async assert => { assert(); return { data, filename }; }, true, { kind: 'bytes', data, filename }); },
        export(format) {
            const source = deps.capture();
            if (exports.has(format)) {
                const old = exports.get(format); if (deps.current(old.source)) return old.promise;
                const error = new Error('An earlier slide export is still finishing. Retry afterwards.');
                if (deps.current(source)) view.error('Slides export', error); return Promise.reject(error);
            }
            const method = { html: 'exportHtml', powerpoint: 'exportPowerPoint', pdf: 'exportPdf' }[format];
            const assert = ownership(source), job = { source }; exports.set(format, job); state();
            job.promise = Promise.resolve().then(async () => {
                assert(); if (!method || typeof source.editor[method] !== 'function') throw new Error('This slide export is unavailable.');
                view.progress('Preparing slide export…'); assert(); const result = await source.editor[method]();
                if (deps.current(source)) view.exported(format, result); return result;
            }).catch(error => { deps.log(error); if (error.code !== 'ExpiredSlidesOperation' && deps.current(source)) view.error('Slides export', error); return null; })
                .finally(() => { if (exports.get(format) === job) exports.delete(format); state(); });
            return job.promise;
        },
        invalidateRefresh() { refreshId++; },
        async refresh() {
            const id = ++refreshId, source = deps.capture(); if (!source.store) return false;
            const assert = () => { ownership(source)(); if (id !== refreshId) throw Object.assign(new Error('A newer layout refresh started.'), { code: 'ExpiredSlidesOperation' }); };
            try {
                const store = { list: source.store.list.bind(source.store), get: source.store.get.bind(source.store) };
                const result = await readSavedSlideLayouts(store, assert);
                for (const value of result.layouts) {
                    assert(); try { source.editor.registerSavedLayout(value); } catch (error) { result.errors.push(error); }
                }
                assert(); if (result.errors.length) { result.errors.forEach(deps.log); view.layoutWarnings(result.errors); }
                return true;
            } catch (error) { deps.log(error); if (error.code !== 'ExpiredSlidesOperation' && deps.current(source)) view.error('Saved slide layouts', error); return false; }
        },
        content(content, references) {
            const source = deps.capture(), assert = ownership(source); assert();
            const result = source.editor.importContent(content, references); if (deps.current(source)) deps.sync(source); return result;
        },
        snapshot(value) {
            const source = deps.capture(), assert = ownership(source); assert();
            source.editor.loadSnapshot(typeof value === 'string' ? JSON.parse(value) : value);
            source.document = source.editor.document;
            deps.defer(() => { try { if (deps.current(source)) deps.sync(source, true); }
                catch (error) { deps.log(error); if (deps.current(source)) view.error('Slide reference refresh', error); } });
            if (deps.current(source)) view.progress('Slide snapshot loaded.');
        },
    };
}
