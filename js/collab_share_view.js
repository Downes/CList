function createCollabShareView(doc = document, show = showModal) {
    const root = doc.createElement('div'); let modal = null;
    const heading = doc.createElement('h3'), label = doc.createElement('label'), check = doc.createElement('input'); check.type = 'checkbox'; check.id = 'collab-anon-check';
    const text = doc.createElement('span'); text.textContent = 'Allow anyone to read (no login required)'; label.append(check,text);
    const review = doc.createElement('button'); review.className = 'btn btn-small'; review.textContent = 'Check current settings';
    const settings = doc.createElement('p'), feedback = doc.createElement('p'); root.append(heading,label,review,settings,feedback);
    const alive = () => !!root.isConnected && doc.getElementById('generic-modal') === modal && !!modal?.contains(root);
    const message = (node, value, error = false) => { node.className = error ? 'error-message' : 'feed-status-message'; node.textContent = value; };
    return {
        alive,
        mount(target, actions) {
            heading.textContent = 'Share “' + target.title + '”';
            check.onchange = () => { if (alive()) actions.save(check.checked); }; review.onclick = () => { if (alive()) return actions.load(); };
            for (const [mode,caption] of [['edit','Co-edit link'],['read','Read-only link']]) {
                const row = doc.createElement('div'), title = doc.createElement('h4'), link = doc.createElement('code'); title.textContent = caption; link.className = 'share-link-code'; link.textContent = target.links[mode]; row.append(title,link);
                for (const [name,run] of [['Copy',()=>actions.copy(mode)],...(target.discussion ? [['Chat',()=>actions.chat(mode)]] : []),['Post',()=>actions.post(mode)]]) {
                    const button = doc.createElement('button'); button.className = 'btn btn-small'; button.textContent = name; button.onclick = () => { if (alive() && button.parentNode === row) return run(); }; row.appendChild(button);
                }
                root.appendChild(row);
            }
            show(root,{wide:true}); modal = doc.getElementById('generic-modal');
        },
        render(model) { if (alive()) { check.checked = model.confirmed ?? false; check.indeterminate = model.confirmed === null || model.blocked; check.disabled = model.busy || model.blocked || model.confirmed === null; review.disabled = model.busy; } },
        message: (value,error) => message(settings,value,error),
        error(error) { console.error('Collab sharing settings failed:',error); message(settings,error.message || String(error),true); },
        feedback: {
            status: value => { if (alive()) message(feedback,value); },
            error(error) { if (alive()) { console.error('Collab share action failed:',error); message(feedback,error.message || String(error),true); } }
        },
        close() { if (alive()) modal.remove(); }
    };
}
