const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const gate = () => {let resolve, reject; const promise = new Promise((a,b) => {resolve=a; reject=b;}); return {promise,resolve,reject};};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(overrides = {}) {
    const calls = [], states = [], errors = []; let retry;
    const ctx = vm.createContext({document: {getElementById: () => null}});
    vm.runInContext(fs.readFileSync('js/app-startup.js', 'utf8'), ctx);
    let controller;
    const deps = {scripts: ['a.js', 'b.js', 'c.js'],
        state: state => states.push(state), lock: () => calls.push('lock'), unlock: () => calls.push('unlock'),
        mark: name => calls.push(name), yield: async () => {},
        restoreSession: () => {calls.push('identity'); controller.sessionKnown(); return controller.whenFeaturesReady().then(() => calls.push('accounts'));},
        restoreLayout: () => calls.push('layout'), paint: async () => calls.push('paint'),
        loadScript: async url => calls.push(url), complete: () => calls.push('complete'),
        callbackError: error => errors.push(error), failure(error, action) {errors.push(error); retry=action;}, ...overrides};
    controller = ctx.createAppStartup(deps);
    return {controller, deps, calls, states, errors, retry: () => retry?.()};
}
test('identity and shell paint precede ordered feature loads; accounts and callbacks wait for registries', async () => {
    const f = fixture(); f.controller.afterFeatures(() => f.calls.push('callback'));
    assert.equal(await f.controller.start(), true);
    assert.deepEqual(f.calls, ['lock','identity','layout','shellReady','paint','a.js','b.js','c.js','accounts','unlock','featuresReady','callback','complete']);
    assert.equal(await f.controller.start(), false);
});
test('slow identity or paint cannot start background requests prematurely', async () => {
    const identity = gate(), paint = gate(); let f;
    f = fixture({restoreSession: () => identity.promise.then(() => f.controller.sessionKnown()), paint: () => paint.promise});
    const run = f.controller.start(); await tick(); assert.ok(!f.calls.includes('a.js'));
    identity.resolve(); await tick(); assert.ok(!f.calls.includes('a.js'));
    paint.resolve(); await run; assert.ok(f.calls.includes('a.js'));
});
test('retry skips accepted scripts, stays locked during failure, and settles waiting accounts once', async () => {
    const attempts = []; let fail = true;
    const f = fixture({loadScript: async url => {attempts.push(url); if(url === 'b.js' && fail) throw Error('download failed');}});
    assert.equal(await f.controller.start(), false);
    assert.equal(f.controller.phase(), 'failed'); assert.ok(!f.calls.includes('accounts')); assert.ok(!f.calls.includes('unlock'));
    fail = false; assert.equal(await f.retry(), true);
    assert.deepEqual(attempts, ['a.js','b.js','b.js','c.js']);
    assert.equal(f.calls.filter(x => x === 'accounts').length, 1);
});
test('partial evaluation errors offer reload rather than replaying declarations', async () => {
    const f = fixture({loadScript: async () => {const error=Error('evaluation failed'); error.reloadRequired=true; throw error;}});
    await f.controller.start(); assert.equal(f.retry(), undefined); assert.equal(f.controller.phase(), 'failed');
});
test('duplicate loading requests coalesce and late startup callbacks execute once', async () => {
    const loading = gate(), f = fixture({loadScript: () => loading.promise});
    const run=f.controller.start(); await tick(); const retry=f.controller.retry(); loading.resolve();
    await run; await retry; f.controller.afterFeatures(() => f.calls.push('late'));
    assert.equal(f.calls.filter(x => x === 'complete').length, 1); assert.equal(f.calls.filter(x => x === 'late').length, 1);
});
test('manifest separates core and feature modules, preserves registry prerequisites and includes real files', () => {
    const html=fs.readFileSync('index.html','utf8');
    const features=JSON.parse(html.match(/id="app-feature-scripts" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const core=[...html.matchAll(/<script[^>]*src="(js\/[^"?]+)[^"]*"/g)].map(match=>match[1]);
    assert.equal(new Set(features.map(url=>url.split('?')[0])).size, features.length);
    for(const url of features) {assert.ok(fs.existsSync(url.split('?')[0]), url); assert.ok(!core.includes(url.split('?')[0]), url);}
    assert.ok(core.includes('js/kvstore.js')); assert.ok(!core.includes('js/editors.js'));
    const index=name=>features.findIndex(url=>url.split('?')[0]==='js/'+name+'.js');
    for(const [a,b] of [['crypto_utils','account-state'],['storage','kvstore-remote'],['editors','editor-switch'],['oauth-client','blogger'],['reader','mastodon']]) assert.ok(index(a)<index(b), a+' before '+b);
});

function scriptFixture() {
    let appended, timer, errorListener;
    const ctx=vm.createContext({URL,location:{href:'https://app.invalid/'},
        document:{getElementById:()=>null,createElement:()=>({remove(){this.removed=true;}}),head:{appendChild(script){appended=script;script.src=new URL(script.src,'https://app.invalid/').href;}}},
        window:{addEventListener(name,fn){errorListener=fn;},removeEventListener(){errorListener=null;}},
        setTimeout(fn){timer=fn;return 1;},clearTimeout(){timer=null;}
    });
    vm.runInContext(fs.readFileSync('js/app-startup.js','utf8'),ctx);
    return {ctx,script:()=>appended,timer:()=>timer,error:()=>errorListener};
}
test('real feature script loader cleans up successful loads and retryable network errors',async()=>{
    const f=scriptFixture();let run=f.ctx.loadStartupScript('js/test.js');f.script().onload();await run;
    assert.equal(f.timer(),null);assert.equal(f.error(),null);
    run=f.ctx.loadStartupScript('js/fail.js');const rejected=assert.rejects(run,error=>!error.reloadRequired);
    f.script().onerror();await rejected;assert.equal(f.script().removed,true);assert.equal(f.timer(),null);
});
test('real feature script loader marks evaluation failures and timeout unsafe to replay',async()=>{
    for(const mode of ['evaluation','timeout']){
        const f=scriptFixture(),run=f.ctx.loadStartupScript('js/test.js');
        const rejected=assert.rejects(run,error=>error.reloadRequired===true);
        if(mode==='evaluation'){f.error()({filename:'https://app.invalid/js/test.js'});f.script().onload();}
        else f.timer()();
        await rejected;assert.equal(f.error(),null);assert.equal(f.script().removed,true);
    }
});

test('actual installer waits for core DOM startup and two frames, then unlocks only after accounts',async()=>{
    const events={}, frames=[], controls=[{id:'openFindButton',disabled:false},{id:'existingDisabled',disabled:true},{id:'logoutButton',disabled:false}];
    for(const control of controls){control.isConnected=true;control.getAttribute=()=>null;}
    const status={style:{}},accounts=gate();let script;
    const window={CList:{state:{}},addEventListener(){},removeEventListener(){}};
    const ctx=vm.createContext({window,URL,location:{href:'https://app.invalid/'},console,performance:{mark(){}},
        document:{readyState:'interactive',getElementById:id=>id==='app-feature-scripts'?{textContent:'["a.js"]'}:status,
            querySelectorAll:()=>controls,addEventListener:(name,fn)=>{events[name]=fn;},createElement:()=>({remove(){}}),head:{appendChild:value=>{script=value;}}},
        initializeSessionControls(){window.CList.startup.sessionKnown();return window.CList.startup.whenFeaturesReady().then(()=>accounts.promise);},
        paneController:()=>({restore(){}}),requestAnimationFrame:callback=>frames.push(callback),
        setTimeout,clearTimeout,isRegistered:()=>true,queueMicrotask
    });
    vm.runInContext(fs.readFileSync('js/app-startup.js','utf8'),ctx);
    assert.equal(script,undefined);events.DOMContentLoaded();await tick();
    assert.equal(controls[0].disabled,true);assert.equal(controls[2].disabled,false);
    assert.equal(script,undefined);frames.shift()();assert.equal(script,undefined);frames.shift()();await tick();
    assert.equal(script.src,'a.js');script.onload();await tick();
    assert.equal(window.CList.state.appStartup.phase,'loading-accounts');assert.equal(controls[0].disabled,true);
    assert.equal(status.style.display,'');
    accounts.resolve();await tick();assert.equal(controls[0].disabled,false);assert.equal(controls[1].disabled,true);
    assert.equal(window.CList.state.appStartup.phase,'ready');assert.equal(status.textContent,'');
    assert.equal(status.style.display,'none');
});
