// Local password check with explicit snapshot/crypto dependencies; no DOM or server.
async function verifyPasswordSnapshot(password,snapshot,deps){
    if(!snapshot.username||!snapshot.storedKey)return false;
    deps.assertCurrent();const candidate=await deps.derive(password,snapshot.username);deps.assertCurrent();
    const raw=await deps.exportKey(candidate);deps.assertCurrent();return deps.encode(raw)===snapshot.storedKey;
}
