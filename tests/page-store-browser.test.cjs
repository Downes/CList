const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({window:{CList:{state:{},savers:[],loaders:[]}},document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['js/page-store.js','js/save-panel.js','js/page-store-browser-workflow.js','js/page-store-browser-view.js','js/page-store-browser.js','tests/helpers/page-store-browser-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('localPageBrowserCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
