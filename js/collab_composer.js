function createCollabComposerController(target, deps, view) {
    let closed = false, phase = 'editing', busy = false, posting = false, timer = null, rich = null, initializing = null, initVersion = 0, revision = 0, snapshot = null, completion = null, stop = () => {};
    let plain = target.title + ': ' + target.link;
    const resources = new Map(), removed = new Set();
    const owned = () => !closed && target.current() && deps.owns(handler) && view.alive();
    const state = () => {
        /** @type {CListCollabComposerState} */
        const value = { phase, busy }; if (owned()) deps.state(value);
    };
    const content = () => {
        if (!owned()) throw Error('The share composer expired.');
        return rich ? rich.getContent() : view.seedHtml(plain, false);
    };
    const handler = { label:'Share Post',contentTypes:['text/html'],getContent:async()=>content(),getPostContent:async()=>{
        const value = content(); if (!snapshot) snapshot = { revision, value }; return value;
    } };
    function releaseEditor(editor, report = false) {
        if (!editor || removed.has(editor)) return; removed.add(editor);
        const errors = [], listeners = resources.get(editor) || []; resources.delete(editor);
        for (const [name,callback] of listeners) { try { editor.off(name,callback); } catch(error) { errors.push(error); } }
        try { editor.remove(); } catch(error) { errors.push(error); }
        if (errors.length) { const error = new AggregateError(errors,'Could not release share editor resources.'); if (report) view.cleanupError(error); else console.error('Expired share editor cleanup failed:',error); }
    }
    function listen(editor,name,callback) { editor.on(name,callback); resources.get(editor).push([name,callback]); }
    function close() {
        if (closed) return; const report = owned();
        if (report) { phase = 'closed'; busy = false; state(); }
        closed = true; initVersion++;
        if (timer != null) { deps.clear(timer); timer = null; } stop();
        if (deps.getCompletion() === completion) deps.setCompletion(null);
        deps.release(handler);
        for (const editor of [...resources.keys()]) releaseEditor(editor,report); rich = null; view.remove();
        phase = 'closed'; busy = false; // No stale presentation writes after ownership ends.
    }
    function ready(editor, attempt) {
        if (!owned() || attempt !== initVersion || removed.has(editor)) { releaseEditor(editor); return; }
        if (rich === editor) return;
        try {
            editor.setContent(view.seedHtml(plain, revision === 0)); rich = editor;
            const edited = () => { if (owned() && rich === editor) revision++; };
            for (const name of ['change','input','undo','redo']) listen(editor,name,edited);
            phase = posting ? 'posting' : 'editing'; busy = posting; view.ready(plain,true); view.busy(busy); state();
        } catch(error) { rich = null; releaseEditor(editor,true); if (owned()) { phase = posting ? 'posting' : 'error'; busy = posting; view.ready(plain,false); view.error(error); view.busy(busy); state(); } }
    }
    function initialize() {
        if (!owned()) { close(); return Promise.resolve(false); } if (initializing || rich) return initializing || Promise.resolve(true);
        if (timer != null) { deps.clear(timer); timer = null; }
        if (!deps.ensureRich && !deps.hasRich()) { view.ready(plain,false); return Promise.resolve(true); }
        const attempt = ++initVersion, attemptEditors = new Set();
        phase = 'mounting'; busy = true; view.starting(view.seedHtml(plain,revision === 0)); state();
        initializing = Promise.resolve().then(() => deps.ensureRich?.()).then(() => {
            if (!owned()) return [];
            return deps.init({ target:view.element,height:200,menubar:false,plugins:'link',toolbar:'bold italic link | undo redo',statusbar:false,
                ...tinymceDarkOptions(),
                setup(editor) {
                    attemptEditors.add(editor); resources.set(editor,[]);
                    if (!owned() || attempt !== initVersion) { releaseEditor(editor); return; }
                    listen(editor,'init',()=>ready(editor,attempt));
                } });
        }).then(editors => {
            for (const editor of editors || []) {
                if (!resources.has(editor) && !removed.has(editor)) resources.set(editor,[]);
                attemptEditors.add(editor);
                if (!owned() || attempt !== initVersion) releaseEditor(editor); else if (!rich) ready(editor,attempt); else if (rich !== editor) releaseEditor(editor,true);
            }
            if (owned() && attempt === initVersion && !rich) throw Error('Rich editor initialization did not return an editor.');
            return owned();
        }).catch(error => {
            for (const editor of attemptEditors) releaseEditor(editor,owned());
            if (attempt === initVersion) rich = null;
            if (owned() && attempt === initVersion) { phase = posting ? 'posting' : 'error'; busy = posting; view.ready(plain,false); view.error(error); view.busy(busy); state(); } return false;
        }).finally(()=>{initializing = null;});
        return initializing;
    }
    async function post() {
        if (!owned() || busy || deps.publishing()) return false;
        posting = true; busy = true; phase = 'posting'; view.busy(true); state(); snapshot = null;
        let consumed = false;
        const callback = () => {
            if (consumed) return; consumed = true;
            if (!owned() || completion !== callback || !snapshot) return;
            if (snapshot.revision !== revision || snapshot.value !== content()) { view.notice('Publication finished. Newer draft edits were kept.'); return; }
            close();
        };
        completion = callback; deps.setCompletion(callback);
        try { await deps.post(); return owned(); }
        catch(error) { if (owned()) view.error(error); return false; }
        finally { posting = false; if (owned()) { busy = phase === 'mounting' && !rich; phase = busy ? 'mounting' : 'editing'; view.busy(busy); state(); } }
    }
    const controller = { owned, close, initialize, post, handler, edit(value) { if (owned() && !rich) { plain = value; revision++; } } };
    try {
        view.mount(controller,plain); deps.install(handler); view.ready(plain,false); state();
        stop = view.watch(()=>{if (!owned()) close();}); timer = deps.schedule(()=>{timer=null;initialize();},50);
    } catch(error) { close(); throw error; }
    return controller;
}
let _collabComposer = null;
function openCollabComposer(target, deps) {
    const url = new URL(target.link); if (!['http:','https:'].includes(url.protocol) || !['edit','read'].includes(target.mode)) throw Error('Invalid collaboration share link.');
    _collabComposer?.close();
    if (!target.current()) throw Error('The share document expired.');
    _collabComposer = createCollabComposerController(target,deps,createCollabComposerView(target));
    return _collabComposer;
}
