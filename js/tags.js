(function () {
    let _selected = [];
    let _collections = null; // null = not yet fetched

    window.getWriteTags  = () => [..._selected];
    window.clearWriteTags = _clearAll;

    function _init() {
        const container = window.CList.ui.view.writeTags;
        if (!container) return;
        _render(container);
    }

    function _render(container) {
        container.innerHTML = '';

        const label = document.createElement('span');
        label.className = 'write-tags-label';
        label.textContent = 'Tags:';
        container.appendChild(label);

        const row = document.createElement('div');
        row.id = 'write-tags-row';

        for (const tag of _selected) row.appendChild(_makeChip(tag));

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'write-tag-input';
        input.placeholder = _selected.length ? '' : 'Add tag…';
        input.autocomplete = 'off';
        input.addEventListener('focus', _onFocus);
        input.addEventListener('input', _onInput);
        input.addEventListener('keydown', _onKeydown);
        input.addEventListener('blur', () => setTimeout(_closeDropdown, 150));
        row.appendChild(input);

        container.appendChild(row);
    }

    function _makeChip(tag) {
        const chip = document.createElement('span');
        chip.className = 'write-tag-chip';
        chip.appendChild(document.createTextNode(tag));
        const x = document.createElement('button');
        x.className = 'write-tag-chip-remove';
        x.innerHTML = '&times;';
        x.title = 'Remove tag';
        x.addEventListener('click', () => _removeTag(tag));
        chip.appendChild(x);
        return chip;
    }

    async function _onFocus() {
        if (_collections === null) await _fetchCollections();
    }

    function _onInput(e) {
        if (e.target.value.trim()) _openDropdown(); else _closeDropdown();
    }

    function _onKeydown(e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const val = e.target.value.trim().replace(/,$/, '');
            if (!val) return;
            _addTag(val);
        } else if (e.key === 'Backspace' && e.target.value === '' && _selected.length) {
            _removeTag(_selected[_selected.length - 1]);
        }
    }

    async function _addTag(name) {
        if (!name || _selected.includes(name)) return;
        _selected.push(name);
        _render(window.CList.ui.view.writeTags);
        _closeDropdown();
        if (_collections !== null && !_collections.some(n => n.toLowerCase() === name.toLowerCase()))
            _offerCreateCollection(name);
        requestAnimationFrame(() => document.getElementById('write-tag-input')?.focus());
    }

    function _offerCreateCollection(name) {
        document.getElementById('write-tags-col-offer')?.remove();
        const container = window.CList.ui.view.writeTags;
        if (!container) return;
        const offer = document.createElement('div');
        offer.id = 'write-tags-col-offer';
        offer.className = 'write-tags-col-offer';
        const msg = document.createElement('span');
        msg.textContent = `Create collection "${name}"?`;
        const yes = document.createElement('button');
        yes.className = 'btn';
        yes.textContent = 'Yes';
        yes.style.cssText = 'font-size:0.75rem;padding:2px 8px;';
        yes.addEventListener('click', async () => { offer.remove(); await _createCollection(name); });
        const no = document.createElement('button');
        no.className = 'btn btn-secondary';
        no.textContent = 'No';
        no.style.cssText = 'font-size:0.75rem;padding:2px 8px;';
        no.addEventListener('click', () => offer.remove());
        offer.append(msg, yes, no);
        container.appendChild(offer);
    }

    function _removeTag(name) {
        _selected = _selected.filter(t => t !== name);
        _render(window.CList.ui.view.writeTags);
        requestAnimationFrame(() => document.getElementById('write-tag-input')?.focus());
    }

    function _clearAll() {
        _selected = [];
        const container = window.CList.ui.view.writeTags;
        if (container) _render(container);
    }

    async function _fetchCollections() {
        try {
            const kvs = await window.CList.storage.kv.list();
            _collections = (kvs || [])
                .filter(kv => kv.key.startsWith('collection:'))
                .map(kv => kv.key.replace(/^collection:/, ''));
        } catch { _collections = []; }
    }

    async function _createCollection(name) {
        const encKey = await getEncKey(window.CList.config.flaskSiteUrl);
        if (!encKey) return;
        try {
            const encrypted = await encryptWithKey(encKey, JSON.stringify([]));
            await window.CList.storage.kv.add(`collection:${name}`, encrypted);
            if (_collections !== null && !_collections.includes(name)) _collections.push(name);
        } catch (err) {
            // Already exists, or not logged in — both fine, matches pre-migration behavior
            if (err.code === 'AlreadyExists' || err.code === 'NotAuthenticated') return;
            console.error('[tags] create collection error', err);
        }
    }

    function _openDropdown() {
        _closeDropdown();
        const container = window.CList.ui.view.writeTags;
        const input = document.getElementById('write-tag-input');
        if (!container || !input) return;

        const query = input.value.trim().toLowerCase();
        const available = (_collections || []).filter(n =>
            !_selected.includes(n) && (!query || n.toLowerCase().startsWith(query))
        );
        if (!available.length) return;

        const dropdown = document.createElement('div');
        dropdown.id = 'write-tags-dropdown';

        for (const name of available) {
            const btn = document.createElement('button');
            btn.className = 'write-tags-dropdown-item';
            btn.textContent = name;
            btn.addEventListener('mousedown', e => { e.preventDefault(); _addTag(name); });
            dropdown.appendChild(btn);
        }

        // Position using fixed coords so overflow:hidden ancestors don't clip it
        const containerRect = container.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.left     = containerRect.left + 'px';
        const spaceBelow = window.innerHeight - inputRect.bottom;
        if (spaceBelow < 180) {
            dropdown.style.bottom = (window.innerHeight - inputRect.top) + 'px';
            dropdown.style.top    = 'auto';
        } else {
            dropdown.style.top    = inputRect.bottom + 'px';
            dropdown.style.bottom = 'auto';
        }
        document.body.appendChild(dropdown);
    }

    function _closeDropdown() {
        document.getElementById('write-tags-dropdown')?.remove();
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', _init);
    else
        _init();
})();
