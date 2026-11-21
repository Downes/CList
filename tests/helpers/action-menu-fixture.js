function actionMenuFixture(definitions) {
    const root = document.createElement('div'); fixtureAttach(root);
    const errors = [], focus = [], view = createActionMenuView(root);
    const nativeFocus = view.focus; view.focus = index => { focus.push(index); nativeFocus(index); };
    const menu = createActionMenu(definitions, view, error => errors.push(error.message));
    const buttons = () => Array.from(root.children);
    return { root, menu, errors, focus, buttons,
        click: index => buttons()[index].onclick?.(),
        key(index, key, options = {}) {
            const event = { key, preventDefault() { this.prevented = true; }, ...options };
            buttons()[index].onkeydown?.(event); return event;
        }
    };
}
function actionMenuGate() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const actionMenuCases = [
    ['literal definitions, selected state and unavailable commands', async check => {
        let calls = 0;
        const f = actionMenuFixture([{ id: 'one', label: '<img src=x onerror=bad()>', run: () => calls++ },
            { id: 'two', label: 'Selected', selected: true, run() {} },
            { id: 'off', label: 'Disabled', disabled: true, run: () => calls++ },
            { id: 'unknown', label: 'Unsupported' }]);
        check(f.buttons()[0].textContent === '<img src=x onerror=bad()>' && !f.buttons()[0].children.length, 'labels remain literal text');
        check(f.buttons()[1].tabIndex === 0 && f.buttons()[1].getAttribute('aria-pressed') === 'true', 'selected command owns initial tab stop');
        await f.click(2); await f.click(3); check(calls === 0 && f.buttons()[3].disabled, 'disabled and unsupported commands never run');
        await f.click(0); check(calls === 1, 'captured supported callback runs');
    }],
    ['arrow and endpoint keys use enabled commands only', async check => {
        const f = actionMenuFixture([{ id: 'a', label: 'A', run() {} }, { id: 'b', label: 'B', disabled: true, run() {} }, { id: 'c', label: 'C', run() {} }]);
        check(f.key(0, 'ArrowRight').prevented && f.focus.at(-1) === 2, 'right skips disabled');
        f.key(2, 'ArrowDown'); check(f.focus.at(-1) === 0, 'down wraps');
        f.key(0, 'End'); check(f.focus.at(-1) === 2, 'End'); f.key(2, 'Home'); check(f.focus.at(-1) === 0, 'Home');
        check(!f.key(0, 'ArrowLeft', { ctrlKey: true }).prevented && !f.key(0, 'Home', { defaultPrevented: true }).prevented, 'modified or consumed keys untouched');
    }],
    ['busy and duplicate pending dispatch guards with explicit retry', async check => {
        const gate = actionMenuGate(); let calls = 0;
        const f = actionMenuFixture([{ id: 'a', label: 'A', run: () => { calls++; return gate.promise; } }]);
        f.menu.setBusy(true); await f.click(0); check(calls === 0 && f.buttons()[0].tabIndex === -1, 'busy blocks dispatch and tab stop');
        f.menu.setBusy(false); const pending = f.click(0); await f.click(0); check(calls === 1 && f.buttons()[0].disabled, 'pending command dispatches once');
        gate.reject(Error('synthetic failure')); await pending;
        check(f.errors[0] === 'synthetic failure' && !f.buttons()[0].disabled && calls === 1, 'visible failure releases lock without retry');
        await f.click(0); check(calls === 2, 'later explicit click retries');
    }],
    ['replaced controls and stale failures are inert', async check => {
        const gate = actionMenuGate(); let calls = 0;
        const f = actionMenuFixture([{ id: 'a', label: 'A', run: () => { calls++; return gate.promise; } }]);
        const click = f.buttons()[0].onclick, pending = click(); f.root.innerHTML = '';
        await click(); gate.reject(Error('expired failure')); await pending;
        check(calls === 1 && f.errors.length === 0, 'detached old row cannot dispatch or show late error');
        const g = actionMenuFixture([{ id: 'b', label: 'B', run: () => calls++ }]); const old = g.buttons()[0].onclick;
        g.menu.dispose(); await old(); check(calls === 1 && g.buttons()[0].onclick === null, 'disposed closure and listener are inert');
    }],
    ['synchronous failures are visible and definitions are captured', async check => {
        const definition = { id: 'a', label: 'Original', run() { throw 'denied'; } };
        const f = actionMenuFixture([definition]); definition.label = 'Changed'; definition.run = () => { throw Error('wrong command'); };
        await f.click(0); check(f.errors[0] === 'denied' && f.buttons()[0].textContent === 'Original', 'captured label/callback and normalized failure');
        check(!f.buttons()[0].disabled, 'synchronous failure releases lock');
    }],
    ['real reader menu bridge preserves dispatch, translation and reset', async check => {
        const root = document.createElement('div'); fixtureAttach(root); window.CList.ui.view.feedMenu = root;
        const actions = []; window.CList.ui.reader.menu(['Timeline', '<b>Options</b>'], 'Timeline', name => actions.push(name), true);
        let buttons = Array.from(root.children); check(buttons[0].disabled && buttons[1].disabled && !buttons[2].disabled, 'busy excludes Translate');
        window.CList.ui.reader.busy(false); await buttons[1].onclick(); check(actions[0] === '<b>Options</b>', 'legacy callback receives exact name');
        const old = buttons[0].onclick; window.CList.ui.reader.menu(['New'], 'New', name => actions.push(name), false); await old();
        check(actions.length === 1 && root.children.length === 3, 'rebuild expires old callback and includes pop-out control');
        window.CList.ui.reader.reset(); check(root.children.length === 0, 'reset clears controls');
        window.CList.ui.reader.menu([], '', () => {}, false); check(root.children.length === 0, 'empty menu has no Translate control');
    }]
];
