// Mastodon-specific setup validation and OAuth delegation; lifecycle/persistence are shared.
function normalizeMastodonSetupUsername(value) {
    const result = value.trim().replace(/^@/, ''), parts = result.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1] || /[\s/?#]/.test(result)) throw new Error('Enter your username as you@instance.social.');
    const url = new URL('https://' + parts[1]);
    if (url.host !== parts[1].toLowerCase()) throw new Error('Enter a valid Mastodon instance hostname.');
    return result;
}
function createMastodonSetupController(deps) {
    return createServiceAccountSetupController({
        label: 'Mastodon', authorizationKey: values => normalizeMastodonSetupUsername(values.username),
        request(values) {
            const key = normalizeMastodonSetupUsername(values.username), token = values.token.trim();
            if (!token) throw new Error('Please paste an access token.');
            return { key, data: { type: 'Mastodon', instance: key, id: token,
                title: values.title.trim() || key, permissions: values.permissions.trim() || 'rw' } };
        },
    }, deps);
}
function mastodonSetupDependencies(context) {
    return accountSetupDependencies(context, { label: 'Mastodon', stateKey: 'mastodonSetup', reader: true,
        authorize: (key, isCurrent) => mastodonOAuthStart(key, key, 'rw', { isCurrent, feedback: false }) });
}
