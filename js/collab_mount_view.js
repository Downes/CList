function ensureCollabMountStyles(doc = document) {
        if (doc.getElementById('collab-styles')) return
        const s = doc.createElement('style')
        s.id = 'collab-styles'
        s.textContent = `
            #collabDiv { display: flex; flex-direction: column; height: 100%; position: relative; }
            #collab-share-post-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                z-index: 20; display: flex; flex-direction: column;
                padding: 12px; border: 1px solid; border-radius: 4px; }
            #collab-share-post-overlay .overlay-instructions { font-size: 0.85em;
                margin: 0 0 8px; }
            #collab-share-post-overlay .overlay-toolbar { display: flex; gap: 6px; margin-top: 8px;
                justify-content: flex-end; }
            #collab-doc-picker { display: flex; gap: 6px; align-items: center; }
            #collab-doc-id { font-size: 0.85em; padding: 4px 6px; border: 1px solid;
                             border-radius: 4px; width: 200px; }
            #collab-doc-warning { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 0.8em; color: #a00; padding: 2px 0; }
            #collab-doc-warning button { font-size: 0.8em; padding: 1px 7px; border: 1px solid;
                border-radius: 3px; cursor: pointer; }
            #collab-format-toolbar { display: flex; gap: 3px; }
            #collab-who { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; flex: 1; padding: 0 4px; }
            .collab-user { font-size: 0.75em; white-space: nowrap; }
            #collab-status { font-size: 0.75em; }
            #collab-editor-container { flex: 1; overflow-y: auto; border: 1px solid;
                                       border-radius: 4px; }
            #tiptap-editor .ProseMirror { outline: none; min-height: 200px; padding: 10px; }
            #tiptap-editor .ProseMirror p { margin: 0.5em 0; }
            #tiptap-editor .ProseMirror h1 { font-size: 1.6em; margin: 0.8em 0 0.3em; }
            #tiptap-editor .ProseMirror h2 { font-size: 1.3em; margin: 0.7em 0 0.3em; }
            #tiptap-editor .ProseMirror h3 { font-size: 1.1em; margin: 0.6em 0 0.3em; }
            #tiptap-editor .ProseMirror ul, #tiptap-editor .ProseMirror ol { padding-left: 1.5em; }
            #tiptap-editor .ProseMirror blockquote { border-left: 3px solid; margin: 0.5em 0;
                padding-left: 1em; }
            /* Collaboration cursors */
            .collaboration-cursor__caret { border-left: 2px solid; border-right: 2px solid;
                margin-left: -1px; margin-right: -1px; position: relative; }
            .collaboration-cursor__label { border-radius: 3px 3px 3px 0; color: #fff;
                font-size: 0.7em; font-weight: 600; left: -1px; line-height: normal;
                padding: 1px 4px; position: absolute; top: -1.5em;
                user-select: none; white-space: nowrap; }
        `
        doc.head.appendChild(s)
    }

function createCollabMountView(pane, doc = document) {
    let root = null, zone = null, element = null;
    return {
        mount() {
            ensureCollabMountStyles(doc);
            root = doc.getElementById('collabDiv');
            if (!root) {
                root = doc.createElement('div'); root.id = 'collabDiv';
                zone = doc.createElement('div'); zone.id = 'collab-editor-container';
                element = doc.createElement('div'); element.id = 'tiptap-editor';
                zone.appendChild(element); root.appendChild(zone); pane.appendChild(root);
            } else { zone = root.querySelector('#collab-editor-container'); element = root.querySelector('#tiptap-editor'); }
            if (!zone || !element) throw Error('The collaboration editor surface is incomplete.');
            root.style.display = 'block';
        },
        alive: () => !!pane?.isConnected && !!root && doc.getElementById('collabDiv') === root &&
            doc.getElementById('collab-editor-container') === zone && doc.getElementById('tiptap-editor') === element && pane.contains(root),
        bindDrop(callback) {
            zone.addEventListener('drop', callback, true);
            return () => zone.removeEventListener('drop', callback, true);
        },
        titleVersion: () => JSON.stringify([doc.getElementById('collab-doc-id')?.value || '', doc.getElementById('write-title')?.textContent || '']),
        title(value) {
            const input = doc.getElementById('collab-doc-id'); if (input) input.value = value;
            const title = doc.getElementById('write-title'); if (title) title.textContent = value;
        },
        error(stage, error) {
            console.error('Collab ' + stage + ' failed:', error);
            showErrorModal(error.message || String(error), { title: 'Could not start collaboration editor' });
        }
    };
}
