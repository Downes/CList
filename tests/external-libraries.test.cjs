const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
function tinyAPI() {return {init() {},defaultOptions:{existing:true},overrideDefaults(options){this.defaultOptions=options;}};}
function fixture() {
    const scripts = [], timers = new Map(); let id = 0;
    const ctx = vm.createContext({window: {},
        document: {createElement: () => ({remove() {this.removed = true;}}), head: {appendChild(script) {scripts.push(script);}}},
        setTimeout(fn) {timers.set(++id, fn); return id;}, clearTimeout(id) {timers.delete(id);}
    });
    vm.runInContext(fs.readFileSync('js/external-libraries.js', 'utf8'), ctx);
    return {ctx, scripts, timers, tiny: () => ctx.window.ensureTinyMCE(), google: () => ctx.window.ensureGoogleIdentity()};
}
test('no startup loads; concurrent TinyMCE requests coalesce and existing API is reused', async () => {
    const f = fixture(); assert.equal(f.scripts.length, 0);
    const a = f.tiny(), b = f.tiny(); assert.equal(a, b); assert.equal(f.scripts.length, 1);
    f.ctx.window.tinymce = tinyAPI(); f.scripts[0].onload();
    await a; await b; await f.tiny();
    assert.equal(f.ctx.window.tinymce.defaultOptions.base_url, 'https://www.downes.ca/assets/tinymce');
    assert.equal(f.ctx.window.tinymce.defaultOptions.suffix, '.min');
    assert.equal(f.ctx.window.tinymce.defaultOptions.existing, true);
    assert.equal(f.scripts.length, 1); assert.equal(f.timers.size, 0);
});
test('Google is independent, loads only on request, and validates its API', async () => {
    const f = fixture(), pending = f.google();
    assert.equal(f.scripts[0].src, 'https://accounts.google.com/gsi/client');
    f.ctx.window.google = {accounts: {oauth2: {initTokenClient() {}}}};
    f.scripts[0].onload(); await pending;
    assert.equal(f.timers.size, 0);
});

test('PeerJS loads once on demand with its original integrity and crossorigin attributes', async () => {
    const f = fixture();
    const a = f.ctx.window.ensurePeerJS(), b = f.ctx.window.ensurePeerJS();
    assert.equal(a, b); assert.equal(f.scripts.length, 1);
    assert.equal(f.scripts[0].src, 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js');
    assert.equal(f.scripts[0].integrity, 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR');
    assert.equal(f.scripts[0].crossOrigin, 'anonymous');
    f.ctx.window.Peer = function () {};
    f.scripts[0].onload(); await a;
    await f.ctx.window.ensurePeerJS(); assert.equal(f.scripts.length, 1);
});
for (const failure of ['network', 'timeout', 'missing API']) test(failure + ' rejects and allows an explicit retry', async () => {
    const f = fixture(), pending = f.tiny(), rejected = assert.rejects(pending);
    if (failure === 'network') f.scripts[0].onerror();
    else if (failure === 'timeout') [...f.timers.values()][0]();
    else f.scripts[0].onload();
    await rejected;
    assert.equal(f.scripts[0].removed, true); assert.equal(f.timers.size, 0);
    assert.equal(f.scripts.length, 1); // No automatic retries.
    const retry = f.tiny(); assert.equal(f.scripts.length, 2);
    f.ctx.window.tinymce = tinyAPI(); f.scripts[1].onload(); await retry;
});


test('already-loaded TinyMCE is configured before use without another download', async () => {
    const f=fixture();f.ctx.window.tinymce=tinyAPI();await f.tiny();
    assert.equal(f.scripts.length,0);
    const defaults=f.ctx.window.tinymce.defaultOptions;
    for(const asset of ['themes/silver/theme','models/dom/model','icons/default/icons','plugins/link/plugin','plugins/image/plugin','plugins/code/plugin']){
        const url=defaults.base_url+'/'+asset+defaults.suffix+'.js';
        assert.ok(url.startsWith('https://www.downes.ca/assets/tinymce/'));
        assert.ok(url.endsWith('.min.js'));
    }
});
