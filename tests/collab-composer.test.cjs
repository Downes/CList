const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');const ctx=vm.createContext({document:menuShellDocument(),structuredClone,AggregateError,URL,console:{error(){}},
    tinymceDarkOptions:()=>({skin:'oxide',content_style:'body { font-size:14px; }'})});
for(const name of ['collab_composer_view','collab_composer'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('tests/helpers/collab-composer-fixture.js','utf8'),ctx);
for(const[name,run]of vm.runInContext('collabComposerCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
