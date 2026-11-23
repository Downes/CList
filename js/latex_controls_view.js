// Toolbar/modal DOM only. Async operations stay in captured controllers.
function createLatexControlsView(menu) {
    menu.innerHTML = ''; const root = document.createElement('div'); menu.appendChild(root); menu.style.display = '';
    const picker = document.createElement('div'); picker.id = 'latex-doc-picker'; root.appendChild(picker);
    const input = document.createElement('input'); input.id = 'latex-doc-id'; input.type = 'hidden'; picker.appendChild(input);
    const controls = {};
    for (const [id, label, title] of [['latex-invite-btn', 'Share', 'Share this document'], ['latex-insert-bib-btn', 'Insert bibliography', 'Insert bibliography from references'], ['latex-compile-btn', 'Compile', 'Compile to PDF']]) {
        const node = document.createElement('button'); node.id = id; node.className = 'btn-small'; node.textContent = label; node.title = title; picker.appendChild(node); controls[id] = node;
    }
    const download = document.createElement('a'); download.id = 'latex-download-link'; download.className = 'btn-small'; download.textContent = 'Download PDF'; download.title = 'Download compiled PDF'; download.target = '_blank'; download.rel = 'noopener noreferrer'; download.style.display = 'none'; picker.appendChild(download);
    const who = document.createElement('div'); who.id = 'latex-who'; root.appendChild(who);
    const status = document.createElement('div'); status.id = 'latex-status'; root.appendChild(status);
    const actionStatus = document.createElement('div'); actionStatus.id = 'latex-action-status'; root.appendChild(actionStatus);
    const feedback = document.createElement('div'); feedback.setAttribute('role', 'status'); root.appendChild(feedback);
    const current = () => currentEditor === 'latex' && root.parentNode === menu && root.isConnected;
    function error(problem) { if (current()) { console.error('[LaTeX controls]', problem); feedback.className = 'error-message'; feedback.textContent = problem.message || String(problem); actionStatus.textContent = 'action failed'; } }
    function invoke(action) { if (!current()) return; try { const result = action(); if (result?.catch) result.catch(error); return result; } catch (problem) { error(problem); } }
    return {
        current, input,
        bind(actions) {
            for (const [id, action] of [['latex-invite-btn', actions.share], ['latex-insert-bib-btn', actions.bibliography], ['latex-compile-btn', actions.compile]]) {
                const node = controls[id]; node.onclick = () => { if (node.parentNode === picker) return invoke(action); };
            }
            input.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); return invoke(actions.connect); } };
        },
        busy(value) { if (current()) { controls['latex-compile-btn'].disabled = value; if (value) { actionStatus.textContent = 'compiling…'; feedback.textContent = ''; } else if (actionStatus.textContent === 'compiling…') actionStatus.textContent = 'ready'; } },
        hideDownload() { download.style.display = 'none'; download.removeAttribute('href'); },
        compiled(url) { if (current()) { download.href = url; download.style.display = ''; actionStatus.textContent = 'compiled'; } },
        error,
        share(title, links, sourceCurrent, copy) {
            const card = document.createElement('div'), heading = document.createElement('h3'); heading.textContent = 'Share “' + title + '”'; card.appendChild(heading);
            links.forEach(link => {
                const row = document.createElement('div'), label = document.createElement('p'), code = document.createElement('code'), button = document.createElement('button');
                label.textContent = link.label; code.textContent = link.url; button.className = 'btn-small'; button.textContent = 'Copy'; row.appendChild(label); row.appendChild(code); row.appendChild(button); card.appendChild(row);
                const owned = () => current() && sourceCurrent() && card.isConnected && button.parentNode === row && row.parentNode === card;
                button.onclick = () => { if (!owned() || button.disabled) return; button.disabled = true;
                    try { return Promise.resolve(copy(link.url, owned)).catch(problem => { if (owned()) error(problem); }).finally(() => { if (owned()) button.disabled = false; }); }
                    catch (problem) { if (owned()) { error(problem); button.disabled = false; } }
                };
            }); showModal(card);
        },
    };
}
