const {test}=require('node:test'),assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
async function fixture(){
 const {mountSlideFormat}=await import('../slides/clist-slides-poc/src/slide-format.js'),document=menuShellDocument(),create=document.createElement
 document.createElement=tag=>{const node=create(tag);node.ownerDocument=document;const get=node.getAttribute.bind(node);node.getAttribute=key=>key.startsWith('data-')?node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??get(key):get(key);return node}
 document.createTextNode=text=>{const n=document.createElement('span');n.textContent=text;return n}
 const root=document.createElement('div');document.body.append(root)
 for(let i=0;i<2;i++){const bar=document.createElement('div');bar.className='slide-menu-bar';root.append(bar)}
 const panel=document.createElement('section');panel.dataset.panel='slide';const input=document.createElement('input');input.dataset.control='slide-background';panel.append(input);root.append(panel)
 let resets=0;const view=mountSlideFormat(root,()=>resets++),control=name=>root.querySelector('[data-control="'+name+'"]')
 return {root,view,control,resets:()=>resets}
}
test('Format Slide appears only without object selection and toggles the existing colour control',async()=>{
 const f=await fixture();f.view.update(true);assert.equal(f.control('format-slide').hidden,false);f.control('format-slide').dispatch('click');assert.equal(f.control('slide-format').hidden,false)
 f.control('reset-slide-colour').dispatch('click');assert.equal(f.resets(),1);assert.ok(f.control('slide-format').contains(f.control('slide-background')))
 f.control('format-slide').dispatch('click');assert.equal(f.control('slide-format').hidden,true);f.view.destroy()
})
test('object selection and disposal close slide formatting and reject stale controls',async()=>{
 const f=await fixture();f.view.update(true);f.control('format-slide').dispatch('click');const reset=f.control('reset-slide-colour');f.view.update(false);reset.dispatch('click');assert.equal(f.resets(),0);assert.equal(f.control('format-slide').hidden,true);f.view.destroy();reset.dispatch('click');assert.equal(f.resets(),0)
})
