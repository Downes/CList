const {test}=require('node:test'),assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
const Y=require('../slides/clist-slides-poc/node_modules/yjs')
async function fixture(){
 const {mountFindReplace}=await import('../slides/clist-slides-poc/src/find-replace.js')
 const document=menuShellDocument(),create=document.createElement
 document.createElement=tag=>{const n=create(tag);n.ownerDocument=document;n.select=()=>{};n.replaceChildren=(...children)=>{for(const child of [...n.children])child.remove();n.text='';n.append(...children)};const get=n.getAttribute.bind(n);n.getAttribute=key=>key.startsWith('data-')?n.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]:get(key);return n}
 document.createTextNode=text=>{const node=document.createElement('span');node.textContent=text;return node}
 const root=document.createElement('div');document.body.append(root)
 for(let i=0;i<2;i++){const bar=document.createElement('div');bar.className='slide-menu-bar tools';root.append(bar)}
 const lower=root.querySelectorAll('.slide-menu-bar')[1],themes=document.createElement('div');themes.className='slide-theme-controls';lower.append(themes)
 const doc=new Y.Doc(),fragment=doc.getXmlFragment('text'),paragraph=new Y.XmlElement('paragraph'),text=new Y.XmlText();fragment.insert(0,[paragraph]);paragraph.insert(0,[text]);text.insert(0,'Find this word')
 let enabled=true,jumps=0;const errors=[]
 const api=mountFindReplace({root,Y,getDocument:()=>doc,getEntries:()=>[{id:'text',slideId:'first',slideNumber:1,fragment}],jump:()=>jumps++,transact:(matches,fn)=>doc.transact(fn),canEdit:()=>enabled,selectedText:()=>'',report:()=>{},onError:error=>errors.push(error)})
 const control=name=>root.querySelector('[data-control="'+name+'"]')
 return {root,lower,api,doc,control,errors,panel:root.querySelector('[data-panel="find"]'),jumps:()=>jumps,disable:()=>enabled=false}
}
test('Find mounts in lower menu with placeholder labels and Done restores the menu state',async()=>{
 const f=await fixture();assert.ok(f.lower.contains(f.panel));assert.equal(f.panel.hidden,true)
 f.control('open-find').dispatch('click');assert.equal(f.lower.dataset.searchOpen,'true');assert.equal(f.panel.hidden,false)
 for(const name of ['find-query','find-replacement']){const input=f.control(name);assert.ok(input.placeholder);assert.ok(input.getAttribute('aria-label'));assert.equal(input.title,undefined);assert.equal(input.parentNode.textContent,'')}
 f.control('find-done').dispatch('click');assert.equal(f.lower.dataset.searchOpen,'false');assert.equal(f.api.isOpen(),false)
 f.api.destroy();f.doc.destroy();assert.deepEqual(f.errors,[])
})
test('lower-menu search retains navigation and rejects destroyed controls',async()=>{
 const f=await fixture();f.control('open-find').dispatch('click');f.control('find-query').value='word';assert.equal(f.control('find-next').disabled,true);f.root.listeners.keydown({key:'Enter',target:f.control('find-query'),preventDefault(){},stopImmediatePropagation(){}})
 assert.equal(f.jumps(),1);assert.equal(f.api.isOpen(),true)
 const old=f.control('open-find');f.api.destroy();old.dispatch('click');assert.equal(f.lower.dataset.searchOpen,'false');assert.equal(f.api.isOpen(),false)
 f.doc.destroy();assert.deepEqual(f.errors,[])
})
