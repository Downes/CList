const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(){const ctx=vm.createContext({structuredClone});vm.runInContext(fs.readFileSync('js/editor-load-state.js','utf8'),ctx);return ctx;}
const plain=value=>JSON.parse(JSON.stringify(value));
test('editor loading transitions are immutable and reject superseded completion without DOM or globals',()=>{
 const ctx=fixture(),first=ctx.beginEditorLoad(),second=ctx.beginEditorLoad(first);
 assert.equal(first.phase,'recognizing');assert.equal(second.id,first.id+1);
 assert.equal(ctx.transitionEditorLoad(second,first.id,'complete'),second);
 const selected=ctx.transitionEditorLoad(second,second.id,'reviewing','texteditor');
 assert.equal(second.target,null);assert.deepEqual(plain(selected),{id:2,phase:'reviewing',target:'texteditor',error:null});
 assert.equal('window' in ctx,false);assert.equal('document' in ctx,false);
});
test('representation rules preserve native annotations, exact source text and detached primary-target inputs',()=>{
 const ctx=fixture(),data={format:'clist-annotation-v1',body:'<p>Note</p>',target:{title:'Target'},references:[]};
 const content={type:'application/vnd.clist.annotation+json',value:data,sourceText:'original JSON'};
 const capabilities=[{key:'annotate-edit',contentTypes:[content.type]},{key:'texteditor',contentTypes:['text/plain']},{key:'tinymce',contentTypes:['text/html']}];
 const before=JSON.stringify(content),choices=ctx.editorLoadRepresentations(content,null,capabilities);
 assert.equal(choices.texteditor.value,'original JSON');assert.equal(choices.tinymce.value,data.body);
 assert.equal(choices['annotate-edit'].value,data);assert.equal(JSON.stringify(content),before);
 const html={type:'text/html',value:'<p>Quoted</p>'},page={documentTitle:'Saved title',references:[{url:'https://source',author_name:'Author'}]};
 const available=capabilities.map(item=>({...item,contentTypes:item.key==='annotate-edit'?['text/html']:item.contentTypes}));
 const native=ctx.editorLoadRepresentations(html,page,available)['annotate-edit'].value;
 assert.equal(native.target.author_name,'Author');native.references[0].author_name='Changed copy';assert.equal(page.references[0].author_name,'Author');
});
test('plain XML draft text remains nonempty while rich editor placeholder markup can be empty',()=>{
 const ctx=fixture();assert.equal(ctx.editorLoadIsEmpty(['text/plain'],'<existing/>',''),false);
 assert.equal(ctx.editorLoadIsEmpty(['text/html'],'<p><br></p>',''),true);
 assert.equal(ctx.editorLoadIsEmpty(['text/html'],'<p>Work</p>','Work'),false);
});
