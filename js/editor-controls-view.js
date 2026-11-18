/// <reference path="./clist-types.js" />
// Load controls and loaded-page presentation. Controllers supply values and callbacks.
function editorControlsOption(option, fallbackIcon) {
    if (!option.logoSrc) return makeEditorButton(option.label, option.icon || fallbackIcon, option.select);
    const button = document.createElement('button');
    button.className = 'account-button';
    const icon = document.createElement('span');
    icon.className = 'service-icon-img';
    icon.style.webkitMask = `url('${option.logoSrc}') no-repeat center / contain`;
    icon.style.mask = `url('${option.logoSrc}') no-repeat center / contain`;
    const label = document.createElement('span'); label.textContent = option.label;
    button.appendChild(icon); button.appendChild(label);
    button.onclick = () => option.select();
    return button;
}
window.CList.ui.editorControls = {
    sources(options) {
        const root = window.CList.ui.view.loadOptions;
        if (!root) return;
        root.innerHTML = '';
        const list = document.createElement('div'); list.className = 'account-list';
        const tip = document.createElement('div'); tip.className = 'list-tip';
        tip.textContent = 'Select a source to load from'; list.appendChild(tip);
        for (const option of options) list.appendChild(editorControlsOption(option, 'upload'));
        root.appendChild(list);
    },
    blank(options, back) {
        const root = window.CList.ui.view.loadOptions;
        if (!root) return;
        root.innerHTML = '';
        const tip = document.createElement('p'); tip.className = 'list-tip';
        tip.textContent = 'Load a blank editor — choose which type:'; root.appendChild(tip);
        const list = document.createElement('div'); list.className = 'account-list';
        for (const option of options) list.appendChild(editorControlsOption(option, 'note_add'));
        root.appendChild(list);
        this.back(root, back);
    },
    confirmBlank(sourceLabel, targetLabel, discard, cancel) {
        const root = window.CList.ui.view.loadOptions;
        if (!root) return;
        root.innerHTML = '';
        const title = document.createElement('p'); title.className = 'list-tip-title';
        title.textContent = 'Discard unsaved content?'; root.appendChild(title);
        const message = document.createElement('p'); message.className = 'list-tip';
        message.textContent = `The current ${sourceLabel} editor has unsaved content. ` +
            `Loading a blank ${targetLabel} editor will discard it.`;
        root.appendChild(message);
        const row = document.createElement('div'); row.className = 'published-page-confirm';
        for (const [label, select, secondary] of [
            ['Discard and continue', discard, false], ['Cancel', cancel, true],
        ]) {
            const button = document.createElement('button');
            button.className = secondary ? 'btn btn-secondary' : 'btn';
            button.textContent = label; button.onclick = () => select(); row.appendChild(button);
        }
        root.appendChild(row);
    },
    template(back) {
        const root = window.CList.ui.view.loadOptions;
        if (!root) return;
        root.innerHTML = '';
        const message = document.createElement('p'); message.className = 'list-tip';
        message.textContent = 'Template loading is not yet implemented.'; root.appendChild(message);
        this.back(root, back);
    },
    back(container, onClick) {
        const button = document.createElement('button');
        button.className = 'btn btn-secondary back-button'; button.textContent = 'Back';
        button.onclick = () => onClick(); container.appendChild(button);
        return button;
    },
    /** @param {CListLoadedPagePresentation} model */
    loadedPage(model) {
        if (model.documentTitle && window.CList.ui.view.writeTitle) {
            window.CList.ui.view.writeTitle.textContent = model.documentTitle;
        }
        const indicator = document.getElementById('loaded-page-indicator');
        const filename = document.getElementById('loaded-page-filename');
        const republish = document.getElementById('republish-button');
        const status = document.getElementById('republish-status');
        if (filename) { filename.textContent = model.label; filename.title = model.url; }
        if (indicator) indicator.style.display = model.hasPublicationLocation ? '' : 'none';
        if (republish) republish.style.display = model.hasPublicationLocation ? '' : 'none';
        if (status) { status.textContent = ''; status.removeAttribute('data-state'); }
    },
    menu(actions) {
        const root = document.getElementById('editor-menu');
        if (!root || !actions.length) return;
        for (const action of actions) {
            const button = document.createElement('button'); button.className = 'btn btn-small editor-menu-btn';
            button.textContent = action.label; button.onclick = () => action.select(); root.appendChild(button);
        }
        root.style.display = '';
    },
    close() {
        closeRightPane();
        document.getElementById('generic-modal')?.remove();
    },
    error(error) {
        console.error('Editor controls failed:', error);
        showErrorModal(error.message || String(error), { title: 'Editor controls failed' });
    },
};
