/// <reference path="./clist-types.js" />
function createLocalPageSaveController(deps, view) {
    let pending = null;
    const recovery = [];
    const state = (phase, receipt = 'none') => {
        /** @type {CListNativePageSaveState} */
        const value = { phase, receipt, busy:['capturing','writing','reconciling'].includes(phase) }; deps.state(value);
    };
    return {
        save() {
            let snapshot;
            try { snapshot = deps.capture(); }
            catch (error) { view.error(error); return Promise.resolve({status:'failed',keepOpen:true}); }
            if (pending) {
                if (deps.same(pending.snapshot, snapshot)) return pending.promise;
                view.busy(); return Promise.resolve({status:'busy',keepOpen:true});
            }
            const job = { snapshot, promise:null };
            pending = job;
            job.promise = Promise.resolve().then(async () => {
                const current = () => deps.current(snapshot);
                const receipt = recovery.find(entry => deps.recoveryMatches(entry.snapshot, snapshot, entry.saved));
                let saved = receipt?.saved || null;
                try {
                    if (!current()) { state('cancelled'); return {status:'cancelled'}; }
                    if (!saved) {
                        state('capturing');
                        const content = await snapshot.read();
                        if (!current()) { state('cancelled'); return {status:'cancelled'}; }
                        state('writing');
                        saved = await writeLocalPageSnapshot(snapshot.request, content, {
                            assertCurrent() { if (!current()) throw Object.assign(Error('The local save source expired.'), {code:'ExpiredLocalSave'}); },
                            write:snapshot.write
                        });
                    }
                    if (!current()) { state('saved','accepted'); return {status:'saved',receipt:'accepted'}; }
                    state('reconciling','accepted');
                    try {
                        deps.reconcile(snapshot, saved);
                        if (receipt) recovery.splice(recovery.indexOf(receipt),1);
                    } catch (error) {
                        if (!receipt) recovery.push({snapshot,saved:{id:saved.id,title:saved.title,revision:saved.revision}});
                        state('metadata-failed','accepted'); if (current() || deps.completed(snapshot,saved)) view.metadataError(error);
                        return {status:'metadata-failed',receipt:'accepted',keepOpen:true};
                    }
                    state('saved','accepted'); if (deps.completed(snapshot,saved)) view.saved(); return {status:'saved',receipt:'accepted'};
                } catch (error) {
                    state(saved ? 'metadata-failed' : (current() ? 'error' : 'cancelled'),saved ? 'accepted' : 'none');
                    if (current()) { if (saved) view.metadataError(error); else view.error(error); }
                    return {status:current() ? 'failed' : 'cancelled',keepOpen:current()};
                } finally { if (pending === job) pending = null; }
            });
            return job.promise;
        }
    };
}
let _localPageSaveController = null;
function saveLocalPage() {
    if (!_localPageSaveController) {
        const view = createLocalPageSaveView();
        const owner = () => ({...captureSavePanelOwner(),controlsId:window.CList.state.editorControls?.id,
            epoch:window.CList.state.authEpoch || 0,session:JSON.stringify(readerSession())});
        const sameSource = (a,b) => a.handler === b.handler && a.store === b.store && a.docId === b.docId &&
            Object.keys(a.owner).every(key => a.owner[key] === b.owner[key]);
        const same = (a,b) => a.page === b.page && sameSource(a,b);
        const now = () => ({page:currentLoadedPage,handler:editorHandlers[currentEditor],store:window.CList.pageStore,
            owner:owner(),docId:editorHandlers[currentEditor]?.getDocId?.() || null});
        _localPageSaveController = createLocalPageSaveController({
            capture() {
                const handler = editorHandlers[currentEditor], page = currentLoadedPage, store = window.CList.pageStore;
                if (typeof handler?.getContent !== 'function') throw Error('This editor cannot provide content for a local save.');
                const captured = {page,handler,store,owner:owner(),docId:handler.getDocId?.() || null,
                    read:handler.getContent.bind(handler),write:store.save.bind(store)};
                /** @type {CListNativePageSaveRequest} */
                captured.request = {id:page?.kind === 'local-page' ? page.id : undefined,
                    revision:page?.kind === 'local-page' ? page.revision : undefined,
                    title:view.title(),editorType:currentEditor,contentType:handler.contentTypes?.[0] || 'text/plain',
                    references:structuredClone(getReferences())};
                return captured;
            }, same,
            current:snapshot=>same(snapshot,now()),
            completed:(snapshot,saved)=>sameSource(snapshot,now())&&currentLoadedPage?.kind==='local-page'&&currentLoadedPage.id===saved.id&&currentLoadedPage.revision===saved.revision,
            recoveryMatches:(before,after,saved)=>sameSource(before,after)&&(before.page===after.page||
                (after.page?.kind==='local-page'&&after.page.id===saved.id&&after.page.revision===saved.revision)),
            reconcile(snapshot,saved) {
                setLoadedPage({kind:'local-page',id:saved.id,revision:saved.revision,title:view.title(),references:structuredClone(getReferences())});
            },
            state:value=>{window.CList.state.localPageSave=value;}
        },view);
    }
    return _localPageSaveController.save();
}
window.CList.savers ||= [];
window.CList.savers.push({label:'Save to CList (local)',icon:'save',requiresLogin:true,requiresAccount:false,save:saveLocalPage});
