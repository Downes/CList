const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');const ctx=vm.createContext({window:{CList:{state:{}}},document:{createElement:tag=>new Element(tag)},console:{error(){}},fixtureAttach(){}});
for(const name of ['pane-state','pane-view','panes'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/panes-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('panesCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
test('real interface startup bridge restores once and preserves compatibility aliases',()=>{
 const f=ctx.panesFixture();f.controller.dispose();
 const mapping={'main-content':f.refs.main,'main-window':f.refs.mainWindow,'left-pane':f.refs.left,'right-pane':f.refs.right,'read-pane':f.refs.read,'write-pane':f.refs.write,'divider':f.refs.divider};
 ctx.document.getElementById=id=>mapping[id];ctx.document.body=f.refs.events.body;
 ctx.document.addEventListener=(name,fn)=>{if(name==='DOMContentLoaded')ctx.boot=fn;else f.refs.events.addEventListener(name,fn);};ctx.document.removeEventListener=f.refs.events.removeEventListener;
 ctx.window.CList.keys={PANE_STATE_LOGGED_IN:'in',PANE_STATE_LOGGED_OUT:'out'};ctx.window.CList.config={flaskSiteUrl:'https://store.invalid'};ctx.window.innerWidth=1024;ctx.hasValidSession=()=>false;
 ctx.localStorage={getItem:key=>f.storage.get(key)??null,setItem:(key,value)=>f.writes.push({key,value:JSON.parse(value)})};
 const source=fs.readFileSync('js/interface.js','utf8');vm.runInContext(source.slice(0,source.indexOf('// 4. Left/right panel content')),ctx);
 ctx.boot();assert.equal(f.writes.length,0);assert.equal(ctx.window.CList.state.panes.leftOpen,true);
 assert.equal(ctx.openLeftPane(),f.refs.left);assert.equal(f.writes.length,1);
 assert.equal(vm.runInContext('mainContent',ctx),f.refs.main);assert.equal(vm.runInContext('readPane',ctx),f.refs.read);
});
