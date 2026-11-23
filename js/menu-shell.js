// Private presentation lifetime; command state remains in its existing menu instance.
function createMenuShell(view, onError) {
    let phase = 'inline';
    const leave = restoreFocus => {
        if (phase !== 'popout') return;
        phase = 'inline'; view.returnInline(restoreFocus);
    };
    const actions = {
        popout() {
            if (phase !== 'inline' || !view.alive()) return;
            try {
                if (view.open()) phase = 'popout';
            } catch (error) {
                view.returnInline(false);
                console.error('Could not open menu:', error); onError(error);
            }
        },
        back() { if (phase === 'popout') leave(view.current()); },
        close() { if (phase === 'popout') leave(view.current()); },
        expired() { leave(false); }
    };
    view.bind(actions);
    return {
        phase: () => phase,
        dispose() {
            if (phase === 'disposed') return;
            leave(false); phase = 'disposed'; view.dispose();
        }
    };
}
