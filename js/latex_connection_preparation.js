// Reuse the shared collaboration preparation boundary without owning editor/provider resources.
function createLatexConnectionPreparation(deps) {
    const preparation = createCollabConnectionPreparation(deps);
    let intentId = 0;
    const expired = () => Object.assign(new Error('The LaTeX connection target expired.'), { code: 'ExpiredCollabPreparation' });
    function intent() {
        const id = ++intentId, snapshot = deps.capture();
        return () => id === intentId && deps.current(snapshot);
    }
    return {
        intent,
        async resolve(name) {
            const current = intent();
            let docId;
            try { docId = await deps.expand(name); }
            catch (error) { if (!current()) throw expired(); throw error; }
            if (!current()) throw expired();
            return { docId, current };
        },
        async prepare(options) {
            // An expired namespace lookup must not invalidate a newer shared preparation.
            if (options.current && !options.current()) throw expired();
            if (typeof options.docId !== 'string' || !options.docId.trim()) throw new Error('Enter a LaTeX document name.');
            const current = options.current || intent();
            try { return await preparation.prepare({ ...options, current }); }
            catch (error) { if (!current()) throw expired(); throw error; }
        },
    };
}
function captureLatexConnectionTarget() {
    const storeUrl = window.CList.config.flaskSiteUrl, state = window.CList.state;
    const input = document.getElementById('latex-doc-id'), title = window.CList.ui.view.writeTitle;
    return { storeUrl, token: getSiteSpecificCookie(storeUrl, window.CList.keys.ACCESS_TOKEN), username: state.username,
        epoch: state.authEpoch, root: document.getElementById('latexDiv'), element: document.getElementById('cm-editor'),
        status: document.getElementById('latex-status'), input, title, inputValue: input?.value, titleValue: title?.textContent,
        account: typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount,
        switchId: state.editorSwitching?.id, loadId: state.editorLoading?.id };
}
function currentLatexConnectionTarget(source) {
    const state = window.CList.state;
    return currentEditor === 'latex' && source.storeUrl === window.CList.config.flaskSiteUrl
        && source.token === getSiteSpecificCookie(source.storeUrl, window.CList.keys.ACCESS_TOKEN)
        && source.username === state.username && source.epoch === state.authEpoch
        && source.account === (typeof currentEditorAccount === 'undefined' ? null : currentEditorAccount)
        && source.switchId === state.editorSwitching?.id && source.loadId === state.editorLoading?.id
        && source.root?.isConnected && source.element?.isConnected && source.root.contains(source.element)
        && source.root === document.getElementById('latexDiv') && source.element === document.getElementById('cm-editor')
        && source.status === document.getElementById('latex-status') && source.input === document.getElementById('latex-doc-id')
        && source.title === window.CList.ui.view.writeTitle && source.inputValue === source.input?.value && source.titleValue === source.title?.textContent;
}
