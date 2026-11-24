const {test}=require('node:test')
const assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
async function fixture(){
 const {mountSlideMenu}=await import('../slides/clist-slides-poc/src/slide-menu.js')
 const doc=menuShellDocument(),root=doc.createElement('div');root.ownerDocument=doc
 const toolbar=doc.createElement('header'),tools=doc.createElement('div'),footer=doc.createElement('footer'),rail=doc.createElement('div')
 toolbar.className='toolbar';tools.className='tools';footer.className='slide-editor-info';rail.className='slide-create-actions'
 toolbar.append(tools);root.append(toolbar,rail,footer);doc.body.append(root)
 const control=name=>{const n=doc.createElement(name==='slide-layout'?'select':name==='shape-tools'?'span':'button');n.setAttribute('data-control',name);tools.append(n);return n}
 for(const id of ['add-slide','duplicate-slide','add-text','add-image','shape-tools','bold','duplicate','present','undo','redo','connection-status'])control(id)
 const layout=control('slide-layout'),original=root.querySelector('[data-control="add-slide"]');let enabled=true, shapeOpens=0
 const menu=mountSlideMenu(root,()=>enabled,()=>shapeOpens++)
 return {root,menu,layout,original,shapeOpens:()=>shapeOpens,enable:value=>enabled=value}
}
test('matching menu bars retain action nodes and start with three New Slide options',async()=>{
 const f=await fixture();assert.equal(f.root.querySelectorAll('.slide-menu-bar').length,2);assert.equal(f.menu.active,'new')
 const group=f.root.querySelectorAll('.slide-menu-options').find(node=>node.dataset.menuGroup==='new');assert.equal(group.hidden,false);assert.equal(group.children.filter(n=>n.tagName==='button').length,3)
 assert.equal(f.root.querySelector('[data-control="add-slide"]'),f.original)
 group.children.find(node=>node.dataset.control==='choose-template').dispatch('click');assert.equal(f.layout.hidden,false)
})
test('only requested New Slide and Insert are added and existing controls stay visible with stale-action guards',async()=>{
 const f=await fixture(),top=f.root.querySelector('.slide-menu-bar')
 assert.equal(top.children.filter(node=>node.dataset.menu).length,2)
 for(const name of ['bold','duplicate','present','undo','redo']) {
   const button=f.root.querySelector('[data-control="'+name+'"]');assert.equal(button.parentNode,top);assert.notEqual(button.hidden,true)
 }
 f.enable(false);assert.equal(f.menu.choose('new'),false);f.enable(true);f.menu.destroy();assert.equal(f.menu.choose('new'),false)
})

test('choosing a visible template inserts once through Add Slide and ignores stale/hidden changes',async()=>{
 const f=await fixture(),group=f.root.querySelectorAll('.slide-menu-options').find(node=>node.dataset.menuGroup==='new')
 const template=group.children.find(node=>node.dataset.control==='choose-template');let inserted=[]
 f.original.onclick=()=>inserted.push(f.layout.value)
 template.dispatch('click');f.layout.value='chosen-layout';f.layout.dispatch('change')
 assert.deepEqual(inserted,['chosen-layout']);assert.equal(f.layout.hidden,true)
 f.layout.dispatch('change');assert.equal(inserted.length,1)
 template.dispatch('click');f.enable(false);f.layout.dispatch('change');assert.equal(inserted.length,1)
 f.enable(true);f.menu.destroy();f.layout.dispatch('change');assert.equal(inserted.length,1)
})

test('Insert follows New Slide and shows Shape, Image, Text using existing controls',async()=>{
 const f=await fixture(),top=f.root.querySelector('.slide-menu-bar'),menus=top.children.filter(n=>n.dataset.menu)
 assert.deepEqual(menus.map(n=>n.textContent),['New Slide','Insert'])
 f.menu.choose('insert');const group=f.root.querySelectorAll('.slide-menu-options').find(n=>n.dataset.menuGroup==='insert')
 assert.equal(group.hidden,false);assert.deepEqual(group.children.filter(n=>n.tagName==='button').map(n=>n.textContent),['Shape','Image','Text'])
 const shapes=group.children.find(n=>n.getAttribute('data-control')==='shape-tools');assert.equal(shapes.hidden,true)
 group.children[0].dispatch('click');assert.equal(f.shapeOpens(),1);assert.equal(shapes.hidden,true)
 let clicked=0;const text=group.children.find(n=>n.getAttribute('data-control')==='add-text');text.onclick=()=>clicked++;text.click();assert.equal(clicked,1)
 f.menu.choose('new');assert.equal(group.hidden,true)
})
