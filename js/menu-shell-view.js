// Reuse the application stacked-modal shell; move the same menu node between surfaces.
function createMenuShellView(container, { title, popoutTitle, trigger: suppliedTrigger, backTitle = 'Back to reader' }, deps = {}) {
    const doc = deps.document || document;
    const show = deps.show || ((content, options) => showStackedModal(content, options));
    const observe = deps.observe || (callback => {
        const observer = new MutationObserver(callback);
        observer.observe(doc.body, { childList: true, subtree: true });
        return () => observer.disconnect();
    });
    const iconButton = (label, icon) => {
        const button = doc.createElement('button'); button.type = 'button';
        button.className = 'clist-action-btn'; button.title = label;
        const symbol = doc.createElement('span'); symbol.className = 'material-icons md-18 md-light';
        symbol.textContent = icon; button.appendChild(symbol); return button;
    };
    const trigger = suppliedTrigger || iconButton(popoutTitle, 'open_in_new');
    if (!suppliedTrigger) container.appendChild(trigger);
    const featureCurrent = deps.isCurrent || (() => true);
    let actions, modal = null, content = null, parent = null, placeholder = null, stop = null, keydown = null;
    const current = () => featureCurrent() && !!modal?.isConnected && doc.getElementById('generic-modal-stacked') === modal
        && content?.parentNode && modal.contains(content) && container.parentNode === content;
    const usable = node => !node.disabled && !node.hidden && node.tabIndex >= 0 && node.getClientRects().length;
    const focusable = () => Array.from(modal.querySelectorAll('button,a[href],input,textarea,select,[tabindex]')).filter(usable);
    const restore = () => {
        stop?.(); stop = null;
        if (modal && keydown) modal.removeEventListener('keydown', keydown);
        if (parent?.isConnected && placeholder?.parentNode === parent) parent.insertBefore(container, placeholder);
        placeholder?.remove();
        // Only the captured shell may be removed; never a replacement modal with the same ID.
        modal?.remove(); modal = null; content = null; placeholder = null; parent = null;
        trigger.hidden = false;
        container.classList.remove('menu-shell-surface');
    };
    return {
        alive: () => featureCurrent() && container.isConnected && container.contains(trigger),
        current,
        bind(callbacks) { actions = callbacks; trigger.onclick = () => actions.popout(); },
        open() {
            if (doc.getElementById('generic-modal-stacked')) throw Error('Close the current pop-out before opening this menu.');
            parent = container.parentNode; placeholder = doc.createElement('span'); placeholder.hidden = true;
            parent.insertBefore(placeholder, container);
            content = doc.createElement('div');
            const surface = content;
            const owned = () => content === surface && current();
            const header = doc.createElement('div'); header.className = 'left-pane-overlay-header';
            const heading = doc.createElement('h2'); heading.textContent = title; header.appendChild(heading);
            const back = iconButton(backTitle, 'arrow_back'); back.onclick = () => { if (owned()) actions.back(); };
            const close = iconButton('Close pop-out', 'close'); close.onclick = () => { if (owned()) actions.close(); };
            header.append(back, close); content.append(header, container); trigger.hidden = true;
            container.classList.add('menu-shell-surface');
            show(content, { wide: true, hideDefaultClose: true });
            modal = doc.getElementById('generic-modal-stacked');
            if (!modal || !modal.contains(content)) throw Error('Could not display the menu pop-out.');
            modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', title);
            keydown = event => {
                if (!owned() || event.defaultPrevented || event.isComposing) return;
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); actions.close(); }
                else if (event.key === 'Tab') {
                    const nodes = focusable(); if (!nodes.length) return;
                    const first = nodes[0], last = nodes.at(-1), active = doc.activeElement;
                    if (event.shiftKey && (active === first || !nodes.includes(active))) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && (active === last || !nodes.includes(active))) { event.preventDefault(); first.focus(); }
                }
            };
            modal.addEventListener('keydown', keydown);
            stop = observe(() => { if (content === surface && !current()) actions.expired(); });
            const initial = Array.from(container.querySelectorAll('button')).find(usable);
            (initial || back).focus(); return true;
        },
        returnInline(restoreFocus) {
            const ownedFocus = current() && modal.contains(doc.activeElement);
            restore();
            if (restoreFocus && ownedFocus && trigger.isConnected && trigger.getClientRects().length) trigger.focus();
        },
        dispose() { restore(); trigger.onclick = null; trigger.remove(); }
    };
}
