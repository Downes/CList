// Explicit preference persistence; display failure is distinct from a rejected save.
async function savePersonalOption(name, value, deps) {
    deps.assert(); await deps.persist(name, value);
    if (!deps.current()) return { saved: true, expired: true, errors: [] };
    try { return { saved: true, errors: name === 'dark' ? deps.applyTheme(value) : [] }; }
    catch (error) { return { saved: true, errors: [error] }; }
}
