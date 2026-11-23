const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const{menuShellDocument}=require('./helpers/menu-shell-dom.cjs');
const context=vm.createContext({document:menuShellDocument(),structuredClone,console:{error(){}}});
for(const name of ['js/collab_mount_view.js','js/collab_mount.js','tests/helpers/collab-mount-fixture.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context);
for(const[name,run]of vm.runInContext('collabMountCases',context))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
