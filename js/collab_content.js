function createCollabContentController(deps, view) {
    let busy = false;
    function run(phase, work, editable = false) {
        if (busy) return false;
        let target;
        try {
            target = deps.capture();
            if (!target?.editor) throw Error('Join a document first, then load content into it.');
            if (!deps.current(target)) return false;
            if (editable && target.editor.isEditable === false) throw Error('This collaboration document is read-only.');
            busy = true;
            let lastPhase = phase;
            const current = () => deps.current(target);
            const state = value => {
                lastPhase = value;
                /** @type {CListCollabContentState} */
                const summary = { phase: value, busy }; if (current()) deps.state(summary);
            };
            try { state(phase); const result = work(target, current); if (current()) state('ready'); return result; }
            catch (error) { if (current()) { state('error'); view.error(error); } return false; }
            finally { busy = false; if (current()) deps.state({ phase: lastPhase, busy: false }); }
        } catch (error) { view.error(error); return false; }
    }
    function insert(kind, input, itemId) {
        return run('inserting', (target, current) => {
            // Source attribution is captured before editor/UI callbacks can replace rows.
            const reference = kind === 'load' ? deps.reference(itemId) : input.reference;
            const html = view.html(kind, input);
            if (!current()) return false;
            if (html) view.insert(target, html);
            if (!current()) return false;
            if (reference) {
                deps.push(reference);
                if (!current()) return false;
                view.references(target);
                if (!current()) return false;
                mirrorCollabReference(target.map, reference);
            } else if (kind === 'load' && itemId) view.warning('Content inserted, but source attribution is unavailable.');
            return current();
        }, true);
    }
    return {
        load: (content, itemId) => insert('load', content, itemId),
        link: input => insert('link', input), via: input => insert('via', input),
        resync() {
            return run('syncing', (target, current) => {
                const result = readCollabReferences(target.map);
                if (!current()) return false;
                deps.replace([]);
                for (const reference of result.references) { if (!current()) return false; deps.push(reference); }
                if (!current()) return false;
                if (result.errors.length) view.warning(result.errors.length + ' unreadable shared reference(s) were skipped.', result.errors);
                return current();
            });
        }
    };
}
