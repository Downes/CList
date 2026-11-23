function collabFormatDefinitions() {
    return [
        { label:'B',title:'Bold',run:e=>e.chain().focus().toggleBold().run(),active:e=>e.isActive('bold') },
        { label:'I',title:'Italic',run:e=>e.chain().focus().toggleItalic().run(),active:e=>e.isActive('italic') },
        ...[1,2,3].map(level=>({label:'H'+level,title:'Heading '+level,run:e=>e.chain().focus().toggleHeading({level}).run(),active:e=>e.isActive('heading',{level})})),
        { label:'•',title:'Bullet list',run:e=>e.chain().focus().toggleBulletList().run(),active:e=>e.isActive('bulletList') },
        { label:'1.',title:'Ordered list',run:e=>e.chain().focus().toggleOrderedList().run(),active:e=>e.isActive('orderedList') },
        { label:'❝',title:'Blockquote',run:e=>e.chain().focus().toggleBlockquote().run(),active:e=>e.isActive('blockquote') }
    ];
}
function createCollabFormatController(deps, view) {
    const editor = deps.editor, definitions = collabFormatDefinitions(); let disposed = false, busy = false;
    const owned = () => !disposed && deps.current() && view.alive();
    const publish = enabled => {
        /** @type {CListCollabFormattingState} */
        const value = { enabled, count: definitions.length }; if (owned()) deps.state(value);
    };
    function refresh() {
        if (!owned()) return;
        try { const enabled = editor.isEditable !== false && !busy; view.update(definitions.map(definition => definition.active(editor)), enabled); publish(enabled); }
        catch (error) { if (owned()) { view.update([], false); publish(false); view.error(error); } }
    }
    function select(index) {
        if (!owned() || busy || editor.isEditable === false || !definitions[index]) return false;
        busy = true;
        try { return definitions[index].run(editor); }
        catch (error) { if (owned()) view.error(error); return false; }
        finally { busy = false; refresh(); }
    }
    function dispose() {
        if (disposed) return; disposed = true;
        const failures = [];
        for (const event of ['selectionUpdate','transaction']) { try { editor.off(event, refresh); } catch (error) { failures.push(error); } }
        if (failures.length && deps.current() && view.alive()) view.error(new AggregateError(failures, 'Could not detach formatting listeners.'));
    }
    try { view.mount(definitions, select); editor.on('selectionUpdate', refresh); editor.on('transaction', refresh); refresh(); }
    catch (error) { dispose(); throw error; }
    return { owned, refresh, select, dispose };
}
