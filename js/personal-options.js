function createPersonalOptionsController(deps, view) {
    let pending = null, revision = 0, model = { dark: deps.dark(), web: false, busy: false, phase: 'ready' };
    const current = () => deps.current() && view.current();
    function render() {
        /** @type {CListPersonalOptionsState} */
        const value = { ...model }; deps.state(value); view.render(value);
    }
    function displayFailure(errors, captured, version) {
        errors.forEach(deps.log);
        view.report('Preference saved, but some displays could not be updated.', [['Retry display', () => {
            if (!current() || revision !== version || model.dark !== captured) return;
            try { const remaining = deps.applyTheme(captured); if (remaining.length) displayFailure(remaining, captured, version); else view.report('Display updated.'); }
            catch (error) { displayFailure([error], captured, version); }
        }]], true);
    }
    const controller = {
        initialize() {
            try { model.web = deps.readWeb(); } catch (error) { deps.log(error); view.report('Could not read preferences. Changes can be retried here.', [], true); }
            view.bind(controller); render();
        },
        toggle(name) {
            if (pending) return pending;
            if (!current() || !['dark', 'web'].includes(name)) return Promise.resolve(false);
            const target = !model[name], version = ++revision;
            model.busy = true; model.phase = 'saving'; render();
            pending = Promise.resolve().then(() => savePersonalOption(name, target, {
                assert() { if (!current()) throw new Error('This Options panel expired.'); }, current,
                persist: deps.persist, applyTheme: deps.applyTheme,
            })).then(result => {
                if (!current()) return result;
                model[name] = target; model.phase = result.errors.length ? 'display-failed' : 'ready';
                if (result.errors.length) displayFailure(result.errors, target, version); else view.report('Preference saved.');
                return result;
            }).catch(error => {
                deps.log(error); if (current()) { model.phase = 'failed'; view.report('Preference could not be saved. ' + error.message, [], true); } return false;
            }).finally(() => { pending = null; if (current()) { model.busy = false; render(); } });
            return pending;
        },
        back() { if (current()) deps.back(); },
        export() { if (current()) { try { return deps.export(); } catch (error) { deps.log(error); view.report(error.message, [], true); } } },
        import() { if (current()) { try { view.pickFile(); } catch (error) { deps.log(error); view.report(error.message, [], true); } } },
        file(file) { if (current() && file) return Promise.resolve().then(() => deps.import(file)).catch(error => { deps.log(error); if (current()) view.report(error.message, [], true); }); },
    };
    return controller;
}
let _personalOptionsPanel = 0;
function createPersonalOptionsPanel() {
    const id = ++_personalOptionsPanel, view = createPersonalOptionsView(window.location.host);
    const owned = () => _personalOptionsPanel === id && view.current();
    const transfer = createPersonalOptionsTransfer(owned, view);
    const controller = createPersonalOptionsController({
        current: () => _personalOptionsPanel === id, dark: () => document.documentElement.classList.contains('dark-mode'),
        readWeb: () => localStorage.getItem(window.CList.keys.WEBMENTION_ENABLED) === 'true',
        persist(name, value) {
            if (name === 'dark') localStorage.setItem(window.CList.keys.DARK_MODE, value ? '1' : '0');
            else if (typeof setWebmentionEnabled === 'function') setWebmentionEnabled(value);
            else localStorage.setItem(window.CList.keys.WEBMENTION_ENABLED, value ? 'true' : 'false');
        },
        applyTheme: value => applyPersonalOptionsTheme(value), state: value => { window.CList.state.personalOptions = value; },
        log: error => console.error('[Personal Options]', error), back: () => history.back(), export: transfer.export, import: transfer.import,
    }, view);
    controller.initialize(); return view.element;
}
