// Public identity capture/reconciliation for migration. Reuses DID read/one-shot transport.
function migrationStable(value) {
    if (Array.isArray(value)) return '[' + value.map(migrationStable).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key)+':'+migrationStable(value[key])).join(',') + '}';
    return JSON.stringify(value);
}
function migrationPublicKey(key) { return key ? {kty:key.kty, crv:key.crv, x:key.x} : null; }
function migrationDocumentMatches(doc, payload) {
    if (!doc) return false;
    const key = doc.verificationMethod?.some(method => migrationStable(migrationPublicKey(method.publicKeyJwk)) === migrationStable(migrationPublicKey(payload.publicKeyJwk)));
    const sort = values => values.map(migrationStable).sort();
    return !!key && migrationStable(sort(doc.alsoKnownAs || [])) === migrationStable(sort([...payload.alsoKnownAs, payload.didKey])) &&
        migrationStable(sort((doc.service || []).filter(service => service.type !== 'KVStore'))) === migrationStable(sort(payload.service));
}
async function migrationReadDocument(session, deps) {
    const doc = await readRemovalDocument(session, deps);
    if (doc && (!Array.isArray(doc.verificationMethod) || !doc.verificationMethod.length ||
        (doc.alsoKnownAs !== undefined && (!Array.isArray(doc.alsoKnownAs) || doc.alsoKnownAs.some(alias => typeof alias !== 'string'))) ||
        (doc.service !== undefined && (!Array.isArray(doc.service) || doc.service.some(service => !service || typeof service !== 'object')))))
        throw new Error('A public identity document is malformed. Migration stopped.');
    return doc;
}
function migrationDidWeb(url, username) {
    const parsed = new URL(url);
    return 'did:web:' + parsed.host.replace(/:/g, '%3A') + parsed.pathname.split('/').filter(Boolean).map(encodeURIComponent).map(part => ':'+part).join('') + ':users:' + encodeURIComponent(username);
}
async function prepareMigrationIdentity(plan, session, deps) {
    if (!plan.hasDid) return [];
    const row = plan.kvs.find(record => record.key === deps.didKey);
    const derived = await deps.derive(row.value, plan.oldEncKey); deps.assertCurrent();
    const publicKeyJwk = migrationPublicKey(derived.publicKeyJwk), didKey = derived.didKey;
    if (!publicKeyJwk?.x || !didKey) throw new Error('The source public identity could not be derived.');
    const destinationSession = {...session, storeUrl:plan.newUrl, username:plan.newUsername, token:plan.newToken, mode:'remote', local:false};
    const sourceDoc = session.local ? null : await migrationReadDocument(session, deps);
    if (!session.local && (!sourceDoc || !sourceDoc.verificationMethod.some(method => migrationStable(migrationPublicKey(method.publicKeyJwk)) === migrationStable(publicKeyJwk)) || !(sourceDoc.alsoKnownAs || []).includes(didKey)))
        throw new Error('Publish the matching source identity before migrating. No records have been copied.');
    const destinationDoc = await migrationReadDocument(destinationSession, deps);
    const destinationMatches = destinationDoc?.verificationMethod.some(method => migrationStable(migrationPublicKey(method.publicKeyJwk)) === migrationStable(publicKeyJwk));
    if (destinationDoc && !destinationMatches && !plan.didConflict)
        throw new Error('A different public identity exists at the destination without an approved identity-key conflict. Migration stopped.');
    const aliases = doc => (doc?.alsoKnownAs || []).filter(alias => !alias.startsWith('did:key:'));
    const services = doc => (doc?.service || []).filter(service => service.type !== 'KVStore');
    const sourceAliases = aliases(sourceDoc), destinationAliases = aliases(destinationDoc);
    const sourceWeb = session.local ? null : migrationDidWeb(plan.oldUrl, plan.oldUsername), destinationWeb = migrationDidWeb(plan.newUrl, plan.newUsername);
    const mergedServices = [...services(sourceDoc)];
    for (const service of services(destinationDoc)) {
        const prior = mergedServices.find(item => item.id === service.id);
        if (prior && migrationStable(prior) !== migrationStable(service)) throw new Error('Conflicting public service metadata needs review before migration.');
        if (!prior) mergedServices.push(service);
    }
    const destinationPayload = {publicKeyJwk, didKey, service:mergedServices,
        alsoKnownAs:[...new Set([...sourceAliases, ...destinationAliases, ...(sourceWeb ? [sourceWeb] : [])])]};
    const targets = [{name:'destination', session:destinationSession, before:migrationStable(destinationDoc), payload:destinationPayload, status:'ready'}];
    if (!session.local) targets.push({name:'source', session, before:migrationStable(sourceDoc),
        payload:{publicKeyJwk, didKey, service:services(sourceDoc), alsoKnownAs:[...new Set([...sourceAliases, destinationWeb])]}, status:'ready'});
    return targets;
}
async function inspectMigrationIdentities(operation, deps) {
    for (const target of operation.identities) {
        const doc = await migrationReadDocument(target.session, deps);
        const matches = migrationDocumentMatches(doc, target.payload);
        if (target.status === 'accepted') {
            if (!matches) throw new Error('An accepted public identity changed. Migration stopped; no publication will be repeated.');
        } else if (matches) target.status = 'accepted';
        else if (migrationStable(doc) === target.before) target.status = 'ready';
        else throw new Error('A public identity changed after capture. Migration stopped; review it before continuing.');
    }
}
