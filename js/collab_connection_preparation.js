// Transient captured configuration only. Existing callers own resource replacement
// and UI feedback; this boundary never constructs/destroys editor or socket objects.
function createCollabConnectionPreparation(deps) {
    let generation = 0, pending = 0, latest = null;
    const state = () => {
        if (!latest || !deps.current(latest.snapshot)) return;
        /** @type {CListCollabPreparationState} */
        const value = { phase: latest.phase, pending }; deps.state(value);
    };
    return {
        async prepare(options = {}) {
            const id = ++generation, snapshot = deps.capture();
            const operation = latest = { snapshot, phase: 'preparing' };
            const current = () => generation === id && deps.current(snapshot) && (!options.current || options.current());
            const assertCurrent = () => {
                if (!current()) throw Object.assign(Error('The collaboration connection target expired.'), { code: 'ExpiredCollabPreparation' });
            };
            pending++; state();
            try {
                assertCurrent();
                const wsUrl = options.local ? null : (options.wsUrl || await deps.server()); assertCurrent();
                const modules = await deps.load(); assertCurrent();
                operation.phase = 'ready';
                return { ...snapshot, local: !!options.local, docId: options.docId, mode: options.mode || 'edit', wsUrl, modules,
                    token: snapshot.token || 'anonymous', username: snapshot.username && snapshot.username !== 'none' ? snapshot.username : 'Anonymous',
                    assertCurrent };
            } catch (error) { operation.phase = 'error'; throw error; }
            finally { pending--; state(); }
        }
    };
}
