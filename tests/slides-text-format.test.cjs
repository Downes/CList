const {test}=require('node:test'),assert=require('node:assert/strict')
test('selected text formatting whitelists fonts, size and colours without injecting CSS',async()=>{
 const {cleanTextFormat:f,textFormatAttributes:a}=await import('../slides/clist-slides-poc/src/text-format.js')
 assert.deepEqual(f({fontFamily:'georgia',fontSize:'40',textColour:'#123456',highlightColour:'#ffff00'}),{fontFamily:'georgia',fontSize:40,textColour:'#123456',highlightColour:'#ffff00'})
 assert.deepEqual(f({fontFamily:'evil;url(x)',fontSize:900,textColour:'red',highlightColour:'url(x)'}),{})
 const attrs=a({fontFamily:'georgia',fontSize:40,textColour:'#123456'});assert.equal(attrs['data-font-size'],'40');assert.match(attrs.style,/font-family:Georgia/)
})
test('text style mark uses the actual shared vendor Mark runtime and safe round-trip attributes',async()=>{
 const {Link}=await import('../js/vendor/collab-editor-bundle.js'),{createSlideTextStyle}=await import('../slides/clist-slides-poc/src/text-format.js')
 const mark=createSlideTextStyle(Link.constructor);assert.equal(mark.type,'mark');assert.equal(mark.name,'slideTextStyle')
 assert.equal(mark.config.renderHTML({mark:{attrs:{fontSize:30,highlightColour:'#ffcc00'}}})[1]['data-highlight-colour'],'#ffcc00')
 const attrs=mark.config.addAttributes();assert.equal(attrs.fontSize.parseHTML({getAttribute:()=> '999'}),null);assert.equal(attrs.fontSize.parseHTML({getAttribute:()=> '30'}),30)
})
test('presenter rendering and PowerPoint runs preserve inline font, size, colour and highlight',async()=>{
 const {renderPresenterText}=await import('../slides/clist-slides-poc/src/presenter.js'),{textRuns}=await import('../slides/clist-slides-poc/src/powerpoint.js')
 const element=(name,type=1,text='')=>({nodeName:name.toUpperCase(),nodeType:type,textContent:text,childNodes:[],attrs:{},get children(){return this.childNodes},append(...nodes){for(const node of nodes){if(node.nodeType===11)this.childNodes.push(...node.childNodes);else this.childNodes.push(node)}},setAttribute(key,value){this.attrs[key]=value},getAttribute(key){return this.attrs[key]??null},hasAttribute(key){return Object.hasOwn(this.attrs,key)}})
 const document={createElement:name=>element(name),createTextNode:text=>element('#text',3,text),createDocumentFragment:()=>element('#fragment',11)}
 const {Y}=await import('../js/vendor/collab-editor-bundle.js')
 const doc=new Y.Doc(),fragment=doc.getXmlFragment('text'),p=new Y.XmlElement('paragraph'),text=new Y.XmlText();fragment.insert(0,[p]);p.insert(0,[text]);text.insert(0,'Styled',{slideTextStyle:{fontFamily:'georgia',fontSize:40,textColour:'#123456',highlightColour:'#abcdef'}})
 const rendered=renderPresenterText(fragment,document),runs=textRuns(rendered,32)
 assert.equal(runs[0].text,'Styled');assert.equal(runs[0].options.fontFace,'Georgia');assert.equal(runs[0].options.fontSize,30);assert.equal(runs[0].options.color,'123456');assert.equal(runs[0].options.highlight,'abcdef');doc.destroy()
})


test('contextual toolbar moves existing rich-text icons after colours and retains handlers',async()=>{
 const {mountTextFormat}=await import('../slides/clist-slides-poc/src/text-format.js'),{menuShellDocument}=require('./helpers/menu-shell-dom.cjs')
 const document=menuShellDocument(),create=document.createElement
 document.createElement=tag=>{const node=create(tag);node.ownerDocument=document;const get=node.getAttribute.bind(node);node.getAttribute=key=>key.startsWith('data-')?node.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??get(key):get(key);return node}
 const root=document.createElement('div');document.body.append(root);const top=document.createElement('div'),lower=document.createElement('div');top.className=lower.className='slide-menu-bar';root.append(top,lower)
 for(const name of ['font-family','font-size','text-colour']){const label=document.createElement('label'),field=document.createElement(name==='font-family'?'select':'input');field.dataset.control=name;label.append(field);root.append(label)}
 const names=['bold','italic','edit-link','remove-link','ordered-list','bullet-list'],icons=names.map(name=>{const button=document.createElement('button');button.dataset.control=name;top.append(button);return button})
 let clicks=0;icons[0].addEventListener('click',()=>clicks++)
 const calls=[];const toolbar=mountTextFormat(root,(key,value)=>calls.push([key,value])),group=root.querySelector('[data-control="text-format"]')
 assert.deepEqual(group.children.slice(-6),icons);assert.equal(top.children.length,0)
 toolbar.update(true,{family:'arial',size:32,colour:'#123456'},true);icons[0].dispatch('click');assert.equal(clicks,1)
 group.querySelector('[data-control="clear-highlight"]').dispatch('click');assert.deepEqual(calls,[['highlightColour',null]])
 toolbar.update(true,{family:'arial',size:32,colour:'#123456'},false);assert.ok(icons.every(button=>button.disabled))
 toolbar.destroy()
})
