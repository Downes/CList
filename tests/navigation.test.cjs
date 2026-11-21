const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {NavigationElement}=require('./helpers/navigation-dom.cjs');
const ctx=vm.createContext({window:{CList:{state:{}}},document:{createElement:tag=>new NavigationElement(tag)},structuredClone,setTimeout,console:{error(){}},fixtureAttach(){}});
for(const name of ['navigation-state','navigation-view','navigation'])vm.runInContext(fs.readFileSync('js/'+name+'.js','utf8'),ctx,{filename:name+'.js'});
vm.runInContext(fs.readFileSync('tests/helpers/navigation-fixture.js','utf8'),ctx);
for(const [name,run] of vm.runInContext('navigationCases',ctx))test(name,()=>run((condition,message)=>assert.ok(condition,message)));
test('real annotation shortcut formatter preserves pre-switch selection and rejects superseded mount',async()=>{
 const source=fs.readFileSync('js/annotate.js','utf8');vm.runInContext(source.slice(source.indexOf('function _buildQuoteContent('),source.indexOf('window.clistAnnotate =')),ctx);
 let inserts=[];ctx.window.getSelection=()=>({toString:()=> 'later selection'});ctx.referenceDisplayName=()=> 'Author';ctx.escapeHtml=value=>value;ctx.currentEditor='source';ctx._annotateReturnEditor=null;ctx.window.CList.state.editorSwitching={id:0};ctx.editorHandlers={'annotate-edit':{contentTypes:['text/html'],insertLink:async payload=>inserts.push(payload)}};
 ctx.switchToEditor=async()=>{ctx.currentEditor='annotate-edit';ctx.window.CList.state.editorSwitching.id++;return true;};
 await ctx.annotateNavigationReference({url:'https://source.invalid',summary:'fallback'},'captured selection',()=>true);assert.match(inserts[0].content.value,/captured selection/);assert.equal(ctx._annotateReturnEditor,'source');
 let resolve;ctx.switchToEditor=()=>{ctx.window.CList.state.editorSwitching.id++;return new Promise(done=>resolve=done);};const old=ctx.annotateNavigationReference({url:'https://old.invalid'},'old',()=>true);ctx.window.CList.state.editorSwitching.id++;resolve(true);await old;assert.equal(inserts.length,1);
});
