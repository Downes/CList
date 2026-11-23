// Captured synchronous CodeMirror/reference commands, with no DOM access.
function createLatexContentController(deps) {
    let busy = false;
    function action(prepare) {
        if (busy) return false;
        let source, inserted = false;
        const assert = () => { if (!deps.current(source)) throw new Error('The LaTeX document is no longer current.'); };
        busy = true;
        try {
            source = deps.capture();
            assert(); if (source.mode === 'read' || source.editor.state.readOnly) throw new Error('This LaTeX document is read-only.');
            const { change, reference } = prepare(source);
            assert();
            if (change?.insert) { source.editor.dispatch({ changes: change, selection: { anchor: change.from + change.insert.length } }); inserted = true; }
            if (!deps.current(source)) return false;
            if (reference) {
                deps.push(reference); if (!deps.current(source)) return false;
                if (source.map && reference.url) source.map.set(reference.url, JSON.stringify(reference));
                if (!deps.current(source)) return false; deps.display();
            }
            if (inserted) source.editor.focus(); return true;
        } catch (error) {
            deps.log(error); if (!source || deps.current(source)) deps.error(new Error((inserted ? 'Content was inserted, but a later action failed. Do not insert it again. ' : '') + error.message));
            if (!inserted) throw error; return false;
        } finally { busy = false; }
    }
    return {
        insert(content, reference, itemId, cite = false) {
            return action(source => {
                const captured = reference || (itemId ? deps.resolve(itemId) : null);
                const text = content.type === 'text/html' ? deps.plaintext(content.value) : content.value;
                const citation = cite ? latexCitation(captured, deps.displayName) : '';
                const insert = text ? String(text) + (citation ? ' ' + citation : '') : '';
                const range = source.editor.state.selection.main;
                return { change: { from: range.from, to: range.to, insert }, reference: captured };
            });
        },
        bibliography() { return action(source => {
            const block = latexBibliography(deps.references()); if (!block) throw new Error('No references to insert yet.');
            return { change: latexBibliographyChange(source.editor.state.doc.toString(), source.editor.state.selection.main, block) };
        }); },
        resync() {
            const source = deps.capture(); if (!deps.current(source) || !source.map) return false;
            const references = []; let warning;
            try { source.map.forEach(json => { try { references.push(JSON.parse(json)); } catch (error) { warning = error; } }); }
            catch (error) { deps.log(error); deps.error(error); return false; }
            if (!deps.current(source)) return false;
            deps.replace([]); for (const reference of references) { if (!deps.current(source)) return false; deps.push(reference); }
            if (warning) { deps.log(warning); deps.error(new Error('Some shared references could not be read; their records were retained.')); }
            return true;
        },
    };
}
