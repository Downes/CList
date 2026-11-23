/// <reference path="./clist-types.js" />
// One menu instance owns captured commands; replacing its view expires old controls.
/** @param {CListActionDefinition[]} definitions */
function createActionMenu(definitions, view, onError) {
    const items = definitions.map(item => ({ id: String(item.id), label: String(item.label),
        selected: !!item.selected, disabled: !!item.disabled || typeof item.run !== 'function', run: item.run }));
    let disposed = false, busy = false, focused = items.findIndex(item => item.selected && !item.disabled);
    const pending = new Set();
    const alive = () => !disposed && view.alive();
    const disabled = () => items.map((item, index) => busy || item.disabled || pending.has(index));
    const render = () => {
        const unavailable = disabled();
        const first = unavailable.findIndex(value => !value);
        if ((focused < 0 || unavailable[focused]) && first >= 0) focused = first;
        if (alive()) view.update(unavailable, unavailable[focused] ? -1 : focused);
    };
    const fail = (error, index) => {
        if (alive() && view.current(index)) {
            console.error('Menu action failed:', error);
            onError(error instanceof Error ? error : new Error(String(error)));
        }
    };
    const activate = index => {
        if (!alive() || !items[index] || !view.current(index) || disabled()[index]) return;
        focused = index;
        pending.add(index); render();
        try {
            const result = items[index].run();
            if (result && typeof result.then === 'function') {
                return Promise.resolve(result).catch(error => fail(error, index)).finally(() => { pending.delete(index); render(); });
            }
        } catch (error) { fail(error, index); }
        pending.delete(index);
        render();
    };
    const navigate = (index, key) => {
        if (!alive() || !view.current(index)) return false;
        const enabled = items.map((_, i) => i).filter(i => !disabled()[i]);
        if (!enabled.length) return false;
        const position = enabled.indexOf(index), backward = key === 'ArrowLeft' || key === 'ArrowUp';
        focused = key === 'Home' ? enabled[0] : key === 'End' ? enabled.at(-1)
            : enabled[(position + (backward ? -1 : 1) + enabled.length) % enabled.length];
        render(); view.focus(focused); return true;
    };
    view.mount(items, activate, navigate); render();
    return {
        setBusy(value) { if (alive()) { busy = !!value; render(); } },
        dispose() { if (!disposed) { disposed = true; view.dispose(); } }
    };
}
