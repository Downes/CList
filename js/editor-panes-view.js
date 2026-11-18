/// <reference path="./clist-types.js" />
// Pane visibility and the shared Upload-pane UI. Pure DOM — no registry access and no
// service calls; the Upload pane's thumbnail-pick/submit actions are reported through
// callbacks for the controller to act on.
window.CList.ui.editorPanes = {
    show(container) { container.style.display = 'block'; },
    hide(container) { container.style.display = 'none'; },

    /**
     * Builds the Upload pane UI: an editable Source URL field (prefilled from
     * candidates[0] when given), a thumbnail strip of any other candidate images
     * (click-to-upload, same convention as gRSShopper's own candidate-image picker,
     * api/hub_images.pl's render_image_picker/hubAttachImage) when there's more than
     * one, and a status line.
     * @param {HTMLElement} pane
     * @param {string[]} candidates
     * @param {{onPick(url: string): void, onSubmit(url: string): void}} handlers
     * @returns {{setUrl(value: string): void, setStatus(text: string): void}}
     */
    renderUpload(pane, candidates, { onPick, onSubmit }) {
        pane.innerHTML = '';
        candidates = candidates || [];

        const wrapper = document.createElement('div');
        wrapper.className = 'collection-editor-field';
        wrapper.style.cssText = 'border-top:1px solid #ccc;padding-top:8px;margin-top:8px;';

        const label = document.createElement('label');
        label.textContent = 'Upload Image';
        wrapper.appendChild(label);

        const status = document.createElement('div');
        status.className = 'feed-status-message';
        status.style.cssText = 'margin:4px 0;';

        if (candidates.length > 1) {
            const strip = document.createElement('div');
            strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;';
            candidates.forEach(url => {
                const thumbBtn = document.createElement('button');
                thumbBtn.type = 'button';
                thumbBtn.style.cssText = 'padding:0;border:2px solid transparent;background:none;cursor:pointer;';
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Candidate image';
                img.style.cssText = 'width:100px;height:75px;object-fit:cover;display:block;';
                img.onerror = () => thumbBtn.remove();
                thumbBtn.appendChild(img);
                thumbBtn.addEventListener('click', () => onPick(url));
                strip.appendChild(thumbBtn);
            });
            wrapper.appendChild(strip);
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;';
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.className = 'collection-editor-input';
        urlInput.placeholder = 'Image URL';
        urlInput.value = candidates[0] || '';
        urlInput.style.flex = '1';
        const uploadBtn = document.createElement('button');
        uploadBtn.className = 'btn btn-small';
        uploadBtn.textContent = 'Upload';
        uploadBtn.addEventListener('click', () => onSubmit(urlInput.value.trim()));
        urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') uploadBtn.click(); });
        row.appendChild(urlInput);
        row.appendChild(uploadBtn);
        wrapper.appendChild(row);
        wrapper.appendChild(status);

        pane.appendChild(wrapper);

        return {
            setUrl(value) { urlInput.value = value; },
            setStatus(text) { status.textContent = text; },
        };
    },
};
