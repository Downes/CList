const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
const ctx=vm.createContext({window:{CList:{ui:{}}},document:{createElement:tag=>new Element(tag)},URL,AbortController,setTimeout,console:{error(){}},fixtureAttach:root=>{if(ctx.previousRoot)ctx.previousRoot.isConnected=false;ctx.previousRoot=root;root.isConnected=true;}});
for(const name of ['did-identity','did-removal-workflow','did-publication-workflow','migration-preparation-workflow','migration-preparation-view','migration-preparation','migration-identity-workflow','migration-execution-workflow','migration-execution-view','migration-execution'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx,{filename:name+'.js'});
vm.runInContext(fs.readFileSync('tests/helpers/migration-execution-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('migrationExecutionCases',ctx))test(name,async()=>run((condition,message)=>assert.ok(condition,message)));
