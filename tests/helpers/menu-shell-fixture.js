let previousMenuShellFixture = null;
function menuShellFixture() {
    previousMenuShellFixture?.dispose();
    const area = document.createElement('div'); document.body.appendChild(area);
    const before = document.createElement('span'), menu = document.createElement('div'), after = document.createElement('span');
    area.append(before, menu, after);
    const errors = []; let checkMutation = null, observing = false;
    const view = createMenuShellView(menu, { title: '<b>Feed menu</b>', popoutTitle: 'Pop out feed menu' }, {
        observe: callback => { checkMutation = callback; observing = true; return () => { observing = false; }; }
    });
    const action = document.createElement('button'); action.textContent = 'Timeline'; menu.insertBefore(action, menu.children[0]);
    const shell = createMenuShell(view, error => errors.push(error.message));
    const trigger = menu.children[1]; trigger.focus();
    const modal = () => document.getElementById('generic-modal-stacked');
    const buttons = () => Array.from(modal().querySelectorAll('button'));
    const key = (value, options = {}) => {
        const event = { key: value, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
        if (typeof modal().dispatchEvent === 'function') {
            const native = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, shiftKey: !!options.shiftKey });
            (document.activeElement || modal()).dispatchEvent(native); event.prevented = native.defaultPrevented;
        } else modal().listeners.keydown?.(event);
        return event;
    };
    const f = { area, menu, before, after, action, trigger, shell, errors, modal, buttons, key,
        mutate: () => checkMutation?.(), observing: () => observing,
        dispose() { shell.dispose(); area.remove(); } };
    previousMenuShellFixture = f; return f;
}
const menuShellCases = [
    ['one live menu moves to the real shell and Back restores exact placement/focus', async check => {
        const f = menuShellFixture(); const edited = document.createElement('input'); edited.value = 'draft'; f.menu.appendChild(edited);
        f.trigger.onclick(); check(f.shell.phase() === 'popout' && f.modal().contains(f.menu), 'menu moves into app modal');
        check(f.menu.children[0] === f.action && edited.value === 'draft', 'existing command/input nodes survive');
        check(f.modal().getAttribute('role') === 'dialog' && f.modal().getAttribute('aria-label') === '<b>Feed menu</b>', 'dialog label is literal');
        check(document.activeElement === f.action && f.trigger.hidden, 'initial focus enters enabled command');
        f.buttons()[0].onclick();
        check(f.shell.phase() === 'inline' && f.area.children[1] === f.menu && f.area.children[2] === f.after, 'Back restores exact position');
        check(!f.modal() && document.activeElement === f.trigger && !f.observing(), 'Back restores trigger focus and removes observer');
    }],
    ['Close/Escape and tab boundaries stay inside the dialog', async check => {
        const f = menuShellFixture(); f.trigger.onclick();
        const first = f.buttons()[0], last = f.action; first.focus(); check(f.key('Tab', { shiftKey: true }).prevented && document.activeElement === last, 'Shift+Tab wraps to last');
        last.focus(); check(f.key('Tab').prevented && document.activeElement === first, 'Tab wraps to first');
        const oldClose = f.buttons()[1].onclick;
        f.key('Escape'); check(!f.modal() && document.activeElement === f.trigger, 'Escape closes and restores focus');
        f.trigger.onclick(); oldClose(); check(f.shell.phase() === 'popout' && !!f.modal(), 'old Close cannot dismiss a later pop-out');
        f.buttons()[1].focus(); f.buttons()[1].onclick(); check(!f.modal() && f.menu.parentNode === f.area, 'Close returns to reader');
    }],
    ['a replacement modal is retained and external removal returns menu without focus theft', async check => {
        const f = menuShellFixture(); f.trigger.onclick(); const oldBack = f.buttons()[0].onclick;
        const replacement = document.createElement('input'); showStackedModal(replacement, { hideDefaultClose: true }); replacement.focus();
        f.mutate(); check(f.menu.parentNode === f.area && f.modal().contains(replacement), 'replacement survives original shell cleanup');
        oldBack(); check(document.activeElement === replacement && f.modal().contains(replacement), 'stale Back cannot close or steal focus');
        f.modal().remove(); f.trigger.onclick(); f.modal().remove(); f.mutate();
        check(f.shell.phase() === 'inline' && f.menu.parentNode === f.area && !f.observing(), 'external removal returns original nodes');
    }],
    ['dispose closes only owned modal and never refocuses obsolete controls', async check => {
        const f = menuShellFixture(); f.trigger.onclick(); const oldOpen = f.trigger.onclick, oldClose = f.buttons()[1].onclick;
        const other = document.createElement('button'); f.area.appendChild(other); other.focus(); f.shell.dispose();
        oldOpen(); oldClose(); check(f.shell.phase() === 'disposed' && !f.modal() && !f.trigger.parentNode, 'captured controls expire on disposal');
        check(document.activeElement === other && f.menu.parentNode === f.area && !f.observing(), 'dispose preserves newer focus and original menu');
    }],
    ['existing dialog is not overwritten and opening failure is visible/retryable', async check => {
        const f = menuShellFixture(); const existing = document.createElement('input'); showStackedModal(existing);
        f.trigger.onclick(); check(f.shell.phase() === 'inline' && f.modal().contains(existing), 'existing dialog is preserved');
        check(f.errors.length === 1 && f.menu.parentNode === f.area, 'visible error leaves menu intact');
        f.modal().remove(); f.trigger.onclick(); check(f.shell.phase() === 'popout', 'explicit retry opens later');
    }],
    ['pending commands retain their lock across pop-out and return', async check => {
        const f = menuShellFixture(); const host = document.createElement('div'); f.menu.insertBefore(host, f.trigger);
        let resolve, calls = 0; const pending = new Promise(done => { resolve = done; });
        const commands = createActionMenu([{ id: 'refresh', label: 'Refresh', run() { calls++; return pending; } }], createActionMenuView(host), error => f.errors.push(error.message));
        const button = host.children[0], work = button.onclick(); f.trigger.onclick(); await button.onclick();
        check(calls === 1 && button.disabled, 'pop-out keeps pending lock and node'); f.buttons()[0].onclick(); await button.onclick();
        check(calls === 1 && button.disabled && f.menu.parentNode === f.area, 'Back retains the same lock');
        resolve(); await work; check(!button.disabled, 'completion releases original command'); commands.dispose();
    }],
    ['real reader rebuild disposes its pop-out and preserves newer focus', async check => {
        const f = menuShellFixture(); f.shell.dispose(); f.menu.innerHTML = ''; window.CList.ui.view.feedMenu = f.menu;
        const actions = []; window.CList.ui.reader.menu(['Timeline'], 'Timeline', name => actions.push(name), false);
        let buttons = Array.from(f.menu.children), oldAction = buttons[0].onclick; buttons.at(-1).onclick();
        check(f.modal()?.contains(f.menu), 'reader bridge opens shared shell');
        const outside = document.createElement('button'); f.area.appendChild(outside); outside.focus();
        window.CList.ui.reader.menu(['New'], 'New', name => actions.push(name), false); await oldAction();
        check(!f.modal() && f.menu.parentNode === f.area && !actions.length, 'rebuild returns menu and expires old command');
        check(document.activeElement === outside, 'rebuild does not restore obsolete focus');
        Array.from(f.menu.children).at(-1).onclick(); window.CList.ui.reader.reset();
        check(!f.modal() && f.menu.parentNode === f.area && !f.menu.children.length, 'reset closes pop-out before clearing menu');
    }]
];
