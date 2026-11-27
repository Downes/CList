const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
test('shared editor header/button/modal actions and ownership guards',async()=>{
 const document=menuShellDocument(),button=document.createElement('button');button.id='editor-share-button';document.body.appendChild(button)
 const context=vm.createContext({document,window:{},console:{error(){}},Promise,Map,JSON,URL,queueMicrotask})
 for(const path of ['tests/helpers/editor-sharing-fixture.js','js/collab_share_requests.js','js/collab_share_view.js','js/collab_share.js','js/editor-sharing.js'])vm.runInContext(fs.readFileSync(path,'utf8'),context)
 let count=0;await vm.runInContext('runEditorSharingChecks',context)((value,label)=>{assert.ok(value,label);count++});assert.equal(count,18)
})
