const {test}=require('node:test'),assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
async function fixture(){
 const {mountSlideLinkPicker}=await import('../slides/clist-slides-poc/src/link-picker.js')
 const document=menuShellDocument(),create=document.createElement
 document.createElement=tag=>{const n=create(tag);n.ownerDocument=document;const get=n.getAttribute.bind(n);n.getAttribute=key=>key.startsWith('data-')?n.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??get(key):get(key);return n}
 document.createTextNode=text=>{const n=document.createElement('span');n.textContent=text;return n}
 const root=document.createElement('div');document.body.append(root)
 let active=null,current=true,restores=0,focus=0;const applied=[],errors=[]
 const picker=mountSlideLinkPicker({root,capture:()=>({values:{href:'https://example.invalid/',text:'Selected text',title:'Old title',newTab:true},current:()=>current,restore:()=>restores++,focus:()=>focus++,apply:value=>applied.push(value)}),closed:()=>{},error:error=>errors.push(error),openModal:body=>{active=body;document.body.append(body);return {current:()=>body===active&&body.isConnected,close:()=>body.remove()}}})
 return {picker,applied,errors,body:()=>active,field:key=>active.querySelector('[data-link-field="'+key+'"]'),submit:()=>active.listeners.submit({preventDefault(){}}),expire:()=>current=false,restores:()=>restores,focus:()=>focus}
}
test('link fields validate allowed URLs and retain literal text/title',async()=>{
 const {readLinkFields:f}=await import('../slides/clist-slides-poc/src/link-picker.js')
 assert.throws(()=>f({href:'javascript:alert(1)',text:'Text'}),/URL/)
 assert.throws(()=>f({href:'https://example.invalid/',text:''}),/text/)
 const value=f({href:' https://example.invalid/ ',text:'<b>literal</b>',title:'Tooltip',alt:'Accessible link description',newTab:false});assert.equal(value.text,'<b>literal</b>');assert.equal(value.title,'Tooltip');assert.equal(value.alt,'Accessible link description');assert.equal(value.newTab,false)
})
test('modal captures fields, applies once and returns focus; Cancel restores selection',async()=>{
 const f=await fixture();f.picker.open();assert.equal(f.field('text').value,'Selected text');f.field('title').value='New title';f.field('alt').value='Alt description';const old=f.body();f.submit();assert.equal(f.applied.length,1);assert.equal(f.applied[0].title,'New title');assert.equal(f.applied[0].alt,'Alt description');assert.equal(f.focus(),1)
 old.listeners.submit({preventDefault(){}});assert.equal(f.applied.length,1)
 f.picker.open();f.body().querySelector('[data-control="cancel-link-dialog"]').dispatch('click');assert.equal(f.restores(),1);f.picker.destroy()
})
test('expired selection keeps visible feedback and never applies link',async()=>{
 const f=await fixture();f.picker.open();f.expire();f.submit();assert.equal(f.applied.length,0);assert.match(f.body().querySelector('[data-control="link-feedback"]').textContent,/changed/);f.picker.destroy()
})
