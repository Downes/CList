const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {Element}=require('./helpers/account-fixture.cjs');
class RowElement extends Element {
 get classList(){const self=this;return{add(...names){self.className=[...(self.className||'').split(' '),...names].filter(Boolean).join(' ');},contains(name){return(self.className||'').split(' ').includes(name);}};}
}
class SafeHtml {constructor(value){this.value=value;}toString(){return this.value;}}
function fixture(){
 const calls=[],bound=[],root=new RowElement();let account=true,page=true;
 const context={account:{id:'private-reader-token'},isAccountCurrent:()=>account,isCurrent:()=>page};
 const CList={ui:{},readers:{Test:{statusActions:()=>'',onFeedClick:(item,ctx)=>calls.push(['feed',item.url,ctx]),bindRow:(item,row,ctx)=>{
  const bar=row.querySelector('.service-status-actions');bound.push({item,row,ctx,bar});bar.innerHTML='';
  const button=new RowElement('button');button.title='Service action';bar.appendChild(button);
 }}}};
 const ctx=vm.createContext({window:{CList},SafeHtml,summaryLimit:200,createUniqueIdFromUrl:()=> 'original-row',_he:value=>String(value),
  getVideoEmbedUrl:()=>null,document:{createElement:tag=>new RowElement(tag),createTextNode:text=>{const el=new RowElement('text');el.textContent=text;return el;}},
  linkifyBareUrls:text=>{const el=new RowElement('span');el.textContent=text;return el;},showStatusMessage:message=>calls.push(['error',message]),
  collectItem:id=>calls.push(['collect',id]),shareToChat:id=>calls.push(['share',id]),clistAnnotate:id=>calls.push(['annotate',id]),
  console:{error(){}},toggleEntryExpanded:id=>calls.push(['expand',id]),openInBrowser:url=>calls.push(['browser',url]),
 });
 const source=fs.readFileSync('js/ui.js','utf8'),start=source.indexOf('window.CList.ui.listing ='),end=source.indexOf('// ── feedHeader',start);
 vm.runInContext(source.slice(start,end),ctx);
 const item={service:'Test',url:'https://original.invalid',title:'Original',titleHtml:'<span>Original</span>',desc:'Summary',full_content:new SafeHtml('<p>Full article content</p>')};
 const row=ctx.window.makeListing(item,{rowContext:context});root.appendChild(row);
 return{ctx,context,item,row,bound,calls,page:value=>{page=value;},account:value=>{account=value;}};
}
test('shared rows pass private context outside item/reference data and preserve common controls after service binding',async()=>{
 const f=fixture(),binding=f.bound[0];assert.equal(binding.ctx,f.context);assert.equal(binding.bar.classList.contains('service-status-actions'),true);
 assert.equal(f.row.querySelectorAll('button').filter(button=>button.title==='Add to collection').length,1);
 assert.ok(f.row.querySelectorAll('button').find(button=>button.title==='Share to chat'));
 assert.ok(f.row.querySelectorAll('button').find(button=>button.title==='Write about this'));
 assert.equal(JSON.stringify(f.row.querySelector('.statusSpecific').reference).includes('private-reader-token'),false);
 assert.equal(JSON.stringify(f.item).includes('private-reader-token'),false);
 const collect=f.row.querySelectorAll('button').find(button=>button.title==='Add to collection');assert.equal(typeof collect.onclick,'function');
 f.page(false);await collect.onclick();assert.deepEqual(f.calls,[['collect','original-row']]);
 f.account(false);await collect.onclick();assert.equal(f.calls.length,1);f.account(true);f.row.isConnected=false;await collect.onclick();assert.equal(f.calls.length,1);
});
test('source callbacks get captured context and expire even between click and queued dispatch',async()=>{
 const f=fixture(),source=f.row.querySelector('.entry-summary').querySelector('a');
 f.page(false);await source.onclick({preventDefault(){}});assert.equal(f.calls[0][0],'feed');assert.equal(f.calls[0][2],f.context);
 const pending=source.onclick({preventDefault(){}});f.account(false);await pending;assert.equal(f.calls.length,1);
});


test('thread and summary editor controls retain their shared loading action after Mastodon extraction',async()=>{
 const calls=[],output=new RowElement('div');
 const ctx=vm.createContext({window:{CList:{ui:{}}},document:{createElement:tag=>new RowElement(tag),getElementById:()=>output},
  loadContentToEditor:id=>calls.push(id),getInputText:()=> 'Thread',summarizeText:async()=> 'Summary',console});
 const ui=fs.readFileSync('js/ui.js','utf8'),start=ui.indexOf('window.CList.ui.feedHeader ='),end=ui.indexOf('// ──',start);
 vm.runInContext(ui.slice(start,end),ctx);
 const header=ctx.window.CList.ui.feedHeader('thread');
 const load=header.querySelectorAll('button').find(button=>button.title==='Load thread into editor');
 vm.runInContext(load.onClick,ctx);assert.deepEqual(calls,['thread']);
 const source=fs.readFileSync('js/summarize.js','utf8'),handler=source.indexOf('async function handleSummarize(');
 vm.runInContext(source.slice(handler,source.indexOf('function getInputText',handler)),ctx);await ctx.handleSummarize('feed-container','feed-summary','thread');
 const button=output.querySelectorAll('button').find(button=>button.title==='Load into editor');
 vm.runInContext(button.onClick,ctx);assert.deepEqual(calls,['thread','summary']);
});
