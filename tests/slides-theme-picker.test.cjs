const {test}=require('node:test'),assert=require('node:assert/strict')
const {menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
const base={id:'basic',label:'Basic',fontFamily:'system',fontSize:32,background:'#ffffff',textColour:'#111111',fillColour:'#dddddd',borderColour:'#222222'}
async function fixture(){
 const {mountThemePicker}=await import('../slides/clist-slides-poc/src/theme-picker.js')
 const document=menuShellDocument(),create=document.createElement
 document.createElement=tag=>{const node=create(tag);node.ownerDocument=document;node.replaceChildren=(...children)=>{for(const child of [...node.children])child.remove();node.text="";node.append(...children)};const get=node.getAttribute.bind(node);node.getAttribute=key=>key.startsWith('data-')?node.dataset[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]:get(key);return node}
 const root=document.createElement('div');root.ownerDocument=document;document.body.append(root)
 for(let i=0;i<2;i++){const bar=document.createElement('div');bar.className='slide-menu-bar';root.append(bar)}
 const panel=document.createElement('div');panel.dataset.panel='themes'
 const select=document.createElement('select');select.dataset.control='theme';panel.append(select);root.append(panel)
 let theme={...base},active=null,valid=true,saved=[],layouts=0
 const themes=[theme,{...base,id:'dark',label:'Dark',background:'#000000'}]
 const picker=mountThemePicker({root,current:()=>valid,capture:()=>()=>valid,theme:()=>theme,themes:()=>themes,
 designs:()=>[{label:'Blank'},{label:'Saved <b>design</b>'}],apply:id=>theme=themes.find(value=>value.id===id),save:value=>{saved.push(value);themes.push(value);theme=value},canSaveLayout:()=>true,saveLayout:()=>layouts++,error:error=>{throw error},
 openModal:body=>{active=body;document.body.append(body);return {current:()=>active===body&&body.isConnected,close:()=>body.remove()}}})
 return {root,picker,select,open:()=>root.querySelector('[data-control="open-themes"]').dispatch('click'),body:()=>active,saved,layouts:()=>layouts,expire:()=>valid=false,replace:()=>theme={...base,label:'Newer'}}
}
test('custom theme captures four colours and typography, validating names and swatches',async()=>{
 const {customTheme:f}=await import('../slides/clist-slides-poc/src/theme-picker.js')
 const value=f(base,'  My theme  ',base,'custom-one');assert.equal(value.label,'My theme');assert.equal(value.fontSize,32);assert.equal(value.id,'custom-one')
 assert.throws(()=>f(base,'',base,'custom-two'),/name/)
 assert.throws(()=>f(base,'Name',{...base,fillColour:'red'},'custom-two'),/colour/)
})
test('theme dialog reuses toolbar selector, applies themes and saves a named palette once',async()=>{
 const f=await fixture();assert.equal(f.select.parentNode.className,'slide-menu-options slide-theme-controls');assert.equal(f.root.querySelector('[data-panel="themes"]'),null)
 f.open();const body=f.body();assert.equal(body.querySelector('[data-control="slide-design-list"]').children[1].textContent,'Saved <b>design</b>');assert.ok(body.querySelector('[data-control="colour-themes"]').contains(body.querySelector('[data-control="save-theme"]')));assert.ok(body.querySelector('[data-control="slide-designs"]').contains(body.querySelector('[data-control="save-slide-design"]')));const chooser=body.querySelector('[data-control="modal-theme"]');chooser.value='dark';chooser.dispatch('change')
 body.querySelector('[data-control="theme-name"]').value='Custom'
 body.querySelector('[data-theme-colour="fillColour"]').value='#abcdef'
 body.querySelector('[data-control="save-theme"]').dispatch('click');assert.equal(f.saved.length,1);assert.equal(f.saved[0].background,'#000000');assert.equal(f.saved[0].fillColour,'#abcdef')
 body.querySelector('[data-control="save-theme"]').dispatch('click');assert.equal(f.saved.length,1)
})
test('stale or newer themes reject saving; layout uses the existing handoff',async()=>{
 for(const expire of [f=>f.expire(),f=>f.replace(),f=>f.picker.destroy()]){
  const f=await fixture();f.open();const body=f.body();body.querySelector('[data-control="theme-name"]').value='Old';expire(f)
  body.querySelector('[data-control="save-theme"]').dispatch('click');assert.equal(f.saved.length,0)
 }
 const f=await fixture();f.open();f.body().querySelectorAll('button').find(button=>button.textContent==='Save current slide as a new design').dispatch('click');assert.equal(f.layouts(),1)
})
