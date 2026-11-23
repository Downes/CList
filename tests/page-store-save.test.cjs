const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({window:{CList:{state:{},savers:[],loaders:[]}},document:menuShellDocument(),structuredClone,crypto:require('node:crypto').webcrypto,console:{error(){}}});
for(const name of ['js/page-store.js','js/save-panel.js','js/page-store-save-workflow.js','js/page-store-save-view.js','js/page-store-save.js','tests/helpers/page-store-save-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('localPageSaveCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
