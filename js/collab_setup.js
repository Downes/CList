// Collab protocol details; mounted registration/account-save lifetime is shared.
function createCollabSetupController(deps) {
    return createAccountRegistrationSetupController({
        label: 'Collab', request: values => collabSetupRequest(values.url),
        details: source => ({ did: source.username && source.username !== 'none' ? 'did:web:' + source.storeUrl.replace(/^https?:\/\//, '') + ':users:' + source.username : null }),
        register: (job, assert, receipts) => requestCollabRegistration({ url: job.request.key.replace(/^wss?:\/\//i, 'https://').replace(/\/$/, '') + '/api/register', token: job.source.token, did: job.did }, { assert, fetch: deps.fetch, ...receipts }),
    }, deps);
}
