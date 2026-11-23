function collabPreparationGate() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
async function collabPreparationFlush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function collabPreparationFixture() {
    let source = 'original', element = { name: 'original-editor' }, token = 'private-token';
    const calls = [], states = [], behavior = {}, modules = { fixture: 'modules' };
    const controller = createCollabConnectionPreparation({
        capture: () => ({ source, element, statusElement: { name: 'status' }, storeUrl: 'https://captured.invalid', token,
            username: behavior.username ?? 'Captured user', color: '#123456' }),
        current: snapshot => snapshot.source === source && snapshot.element === element,
        server: async () => { calls.push('server'); return behavior.server ? behavior.server() : 'wss://captured.invalid'; },
        load: async () => { calls.push('load'); return behavior.load ? behavior.load() : modules; },
        state: value => states.push(structuredClone(value))
    });
    return { controller, calls, states, behavior, modules, expire: () => { source = 'changed'; }, replace: () => { element = {}; }, token: value => { token = value; } };
}
async function collabPreparationRejects(action, check, expected = 'ExpiredCollabPreparation') {
    let failure; try { await action(); } catch (error) { failure = error; }
    check(!!failure && (failure.code === expected || failure.message.includes(expected)), 'rejected with ' + expected);
}
const collabPreparationCases = [
    ['captured connection configuration and private state', async check => {
        const f = collabPreparationFixture(), target = await f.controller.prepare({ docId:'namespace/notes',mode:'read' });
        check(target.docId==='namespace/notes'&&target.mode==='read'&&target.wsUrl==='wss://captured.invalid','captured document/mode/server');
        check(target.token==='private-token'&&target.storeUrl==='https://captured.invalid'&&target.username==='Captured user','captured credentials and identity');
        check(target.modules===f.modules&&f.calls.join()==='server,load','existing dependencies returned without resource operations');
        check(f.states.at(-1).phase==='ready'&&f.states.at(-1).pending===0&&!JSON.stringify(f.states).includes('private-token'),'safe ready/count state');
    }],
    ['override and local preparation preserve routing and anonymous defaults', async check => {
        const f = collabPreparationFixture(); f.token(''); f.behavior.username='none';
        const target=await f.controller.prepare({docId:'document',wsUrl:'wss://override.invalid'});
        check(target.wsUrl==='wss://override.invalid'&&target.token==='anonymous'&&target.username==='Anonymous','captured override and legacy anonymous fallback');
        check(f.calls.join()==='load','explicit server skips lookup');
        const local=await f.controller.prepare({local:true}); check(local.wsUrl===null&&f.calls.join()==='load,load','local editor uses same preparation without server lookup');
    }],
    ['source expiry during server lookup stops dependency loading', async check => {
        const f=collabPreparationFixture(),gate=collabPreparationGate();f.behavior.server=()=>gate.promise;
        const pending=f.controller.prepare({docId:'old'});f.expire();gate.resolve('wss://old.invalid');
        await collabPreparationRejects(()=>pending,check);check(f.calls.join()==='server','expired lookup cannot load or return configuration');
    }],
    ['replaced editor during dependency loading rejects stale target', async check => {
        const f=collabPreparationFixture(),gate=collabPreparationGate();f.behavior.load=()=>gate.promise;
        const pending=f.controller.prepare({docId:'old'});await collabPreparationFlush();f.replace();gate.resolve(f.modules);
        await collabPreparationRejects(()=>pending,check);check(!f.states.some(value=>value.phase==='ready'),'replaced DOM target never becomes ready');
    }],
    ['new local/remote preparation supersedes old pending work', async check => {
        const f=collabPreparationFixture(),gate=collabPreparationGate();f.behavior.load=()=>gate.promise;
        const old=f.controller.prepare({docId:'old'});await collabPreparationFlush();delete f.behavior.load;
        const newer=await f.controller.prepare({local:true});gate.resolve(f.modules);
        await collabPreparationRejects(()=>old,check);newer.assertCurrent();check(f.states.at(-1).phase==='ready'&&f.states.at(-1).pending===0,'old completion drains count without replacing newer readiness');
    }],
    ['server/dependency failures propagate with explicit later recovery', async check => {
        const f=collabPreparationFixture();f.behavior.server=()=>{throw Error('lookup failed');};
        await collabPreparationRejects(()=>f.controller.prepare(),check,'lookup failed');check(f.calls.join()==='server'&&f.states.at(-1).phase==='error','lookup failure stops before loading');
        delete f.behavior.server;f.behavior.load=()=>{throw Error('bundle failed');};await collabPreparationRejects(()=>f.controller.prepare(),check,'bundle failed');
        check(f.states.at(-1).pending===0,'failed preparation drains pending count');delete f.behavior.load;
        check((await f.controller.prepare()).modules===f.modules,'explicit later preparation recovers');
    }],
    ['returned commit guard rechecks expiry and supersession', async check => {
        const f=collabPreparationFixture(),target=await f.controller.prepare({docId:'captured'});f.expire();
        await collabPreparationRejects(()=>target.assertCurrent(),check);
        const g=collabPreparationFixture(),first=await g.controller.prepare();await g.controller.prepare({local:true});
        await collabPreparationRejects(()=>first.assertCurrent(),check);
        const h=collabPreparationFixture();let caller=true;const guarded=await h.controller.prepare({current:()=>caller});caller=false;
        await collabPreparationRejects(()=>guarded.assertCurrent(),check);
    }]
];
