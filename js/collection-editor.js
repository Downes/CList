// collection-editor.js — Collection editor for the write-pane
// Part of CList, the next generation of learning and connecting with your community

(function () {
    if (typeof editorHandlers === 'undefined') {
        console.error('editorHandlers is not defined — collection-editor.js must load after editors.js');
        return;
    }

    editorHandlers['collection'] = {
        label:          'Collection',
        icon:           'playlist_add',
        contentTypes:   [],
        requiresAccount: false,
        visible:        () => typeof isRegistered === 'function' && isRegistered(),
        formats: Object.entries(collectionFormats).map(([id, f]) => ({ id, label: f.label })),

        initialize: async () => {
            currentEditor = 'collection';

            const writeTagsEl = document.getElementById('write-tags');
            if (writeTagsEl) writeTagsEl.style.display = 'none';

            const writePaneContent = window.CList.ui.view.writePaneContent;
            let div = document.getElementById('collectionEditorDiv');
            if (!div) {
                div = document.createElement('div');
                div.id = 'collectionEditorDiv';
                writePaneContent.appendChild(div);
            }
            div.style.display = 'block';

            if (typeof window.showCollectionEditorPanel === 'function') {
                await window.showCollectionEditorPanel(div);
            } else {
                div.innerHTML = '<p class="feed-status-message">Collection editor not available.</p>';
            }
        },

        // Reflects the live draft so editorHasActiveContent() (editors.js) can
        // correctly detect unsaved collection items — _draftItems is the global
        // set by _renderCollectionEditor (collections.js).
        getContent: () => (typeof _draftItems !== 'undefined' && _draftItems && _draftItems.length)
            ? JSON.stringify(_draftItems)
            : '',

        loadContent: () => {},
    };
})();
