const {test}=require('node:test'),assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
async function fixture(){
 const {mountObjectFormat}=await import('../slides/clist-slides-poc/src/object-format.js'),doc=menuShellDocument(),root=doc.createElement('div');root.ownerDocument=doc;doc.body.append(root)
 for(let i=0;i<2;i++){const bar=doc.createElement('div');bar.className='slide-menu-bar';root.append(bar)}
 for(const name of ['appearance','arrange']){const panel=doc.createElement('section'),body=doc.createElement('div');panel.setAttribute('data-panel',name);body.className='control-section-body';panel.append(body);root.append(panel)}
 const view=mountObjectFormat(root),top=root.querySelector('.slide-menu-bar'),button=top.children.at(-1),lower=root.querySelectorAll('.slide-menu-bar')[1],commands=root.querySelector('.slide-arrange-controls')
 return {view,button,lower,commands}
}
test('Arrange opens explicitly and remains while its owner stays selected',async()=>{
 const f=await fixture(),one={},two={};assert.equal(f.button.hidden,true);f.view.update([one],true);assert.equal(f.button.hidden,false);assert.equal(f.commands.hidden,true)
 f.button.dispatch('click');assert.equal(f.commands.hidden,false);assert.equal(f.lower.dataset.arrangeOpen,'true')
 f.view.update([one],true);f.view.update([one,two],false);assert.equal(f.commands.hidden,false)
 f.view.update([two],false);assert.equal(f.commands.hidden,true);assert.equal(f.lower.dataset.arrangeOpen,'false');f.view.destroy()
})
test('deselection and disposal reject stale Arrange clicks',async()=>{
 const f=await fixture();f.view.update([{}],true);f.button.dispatch('click');f.view.update([],false);assert.equal(f.button.hidden,true);assert.equal(f.commands.hidden,true)
 f.view.destroy();f.button.dispatch('click');assert.equal(f.lower.dataset.arrangeOpen,undefined)
})
