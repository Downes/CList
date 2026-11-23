const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({window:{CList:{state:{},config:{}}},document:menuShellDocument(),editorHandlers:{},structuredClone,console:{error(){}}});
for(const name of ['tests/helpers/annotation-tiny-fixture.js','js/references-state.js','js/annotate_draft_state.js','js/annotate_draft_view.js','js/annotate_draft.js','js/annotate_body_view.js','js/annotate_body.js','js/annotate_send_view.js','js/annotate_send.js','js/annotate-editor.js','tests/helpers/annotation-draft-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('annotationDraftCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
