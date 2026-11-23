const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const document=menuShellDocument(),create=document.createElement;
// Exercise native-style dispatch rather than reading the small DOM fixture's listener table.
document.createElement=tag=>{const node=create(tag),listeners=node.listeners;node.addEventListener=(type,callback)=>{listeners[type]=callback;};node.dispatchEvent=event=>{listeners[event.type]?.(event);return true;};delete node.listeners;return node;};
const context=vm.createContext({window:{CList:{state:{},config:{},ui:{},publishers:{}}},document,editorHandlers:{},structuredClone,Event,console:{error(){}}});
for(const name of ['annotation-workflow','annotation-publishing','annotation-view','annotate_publish','annotate_draft_state','annotate_draft_view','annotate_draft','annotate_body_view','annotate_body','annotate_send_view','annotate_send','annotate-editor'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),context);
vm.runInContext(fs.readFileSync('tests/helpers/annotation-send-fixture.js','utf8'),context);
for(const[name,run]of vm.runInContext('annotationSendCases',context))test(name,{timeout:2000},()=>run((condition,message)=>assert.ok(condition,message)));
