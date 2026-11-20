// Real administrative settings modules. Sessions, HTTP and modal/navigation shells are mocked.
let adminFixtureSequence=0;
function adminSettingsFixture(){
 const C=window.CList;C.config={flaskSiteUrl:'https://store.invalid'};C.defaults={LOCALRSS:'https://rss.invalid',PASTEBIN:'https://bin.invalid'};C.state={authEpoch:++adminFixtureSequence};C.keys={ACCESS_TOKEN:'token',USERNAME:'user'};
 let token='private-token',local=false,root=null,modal=null;
 const schema=[{key:'enabled',label:'Service enabled',type:'boolean'},{key:'title',label:'<b>Title</b>',type:'string',help:'<script>literal</script>'},{key:'api_key',label:'API key',type:'string',sensitive:true}];
 let values={enabled:'true',title:'Original',api_key:'server-secret'},requests=[];const behavior={};
 globalThis.getSiteSpecificCookie=(url,key)=>key==='user'?'alice':token;C.isLocalMode=()=>local;
 globalThis.fetch=async(url,options={})=>{
  requests.push({url,options});if(options.method==='PUT'){
   const payload=JSON.parse(options.body);if(behavior.put)return behavior.put(payload);
   values={...values,...payload};return{ok:true,status:200,json:async()=>({values:{...values,api_key:'masked'}})};
  }
  if(behavior.get)return behavior.get();return{ok:true,json:async()=>({schema,values:{...values}})};
 };
 globalThis.showStackedModal=node=>{modal=node;fixtureAttach(node);};globalThis.closeStackedModal=()=>{if(modal)fixtureDetach(modal);};
 globalThis.showModal=node=>{modal=node;fixtureAttach(node);};
 const app=()=>adminSettingsApps().find(app=>app.label==='LocalRSS Reader');
 const open=async()=>{if(root)fixtureDetach(root);root=document.createElement('div');fixtureAttach(root);const controller=createAdminSettings(root,app());await controller.load();return{root,controller};};
 const input=key=>root.querySelector('#admin-field-'+schema.findIndex(field=>field.key===key));
 const edit=(key,value)=>{const node=input(key);node.value=value;node.oninput();};
 const button=label=>Array.from(root.querySelectorAll('button')).find(button=>button.textContent===label);
 const click=label=>{const node=button(label);if(!node)throw Error('Missing button '+label);return node.onclick();};
 return{open,input,edit,click,button,behavior,requests,schema,root:()=>root,app,modal:()=>modal,values:()=>values,setValues:next=>{values={...values,...next};},token:value=>{token=value;},local:()=>{local=true;},state:()=>C.state.adminSettings};
}
function adminTestGate(){let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};}
const adminSettingsCases=[
 ['mobile and desktop picker callbacks keep their source account',async check=>{
  for(const desktop of [false,true]){const f=adminSettingsFixture(),picker=createAdminSettingsPicker({desktop,back(){}});fixtureAttach(picker);f.token('replacement');const button=Array.from(picker.querySelectorAll('button')).find(button=>button.textContent==='LocalRSS Reader');await button.onclick();check(f.requests.length===0&&picker.textContent.includes('account changed'),'stale picker cannot send replacement credentials');}
 }],
 ['newer secret input survives acceptance and masked uncertainty needs review',async check=>{
  const f=adminSettingsFixture();await f.open();await f.click('Change');f.edit('api_key','first-private');const gate=adminTestGate();f.behavior.put=()=>gate.promise;const pending=f.click('Save');f.edit('api_key','newer-private');gate.resolve({ok:true,json:async()=>({values:{enabled:'true',title:'Original',api_key:'masked'}})});await pending;
  check(f.input('api_key').value==='newer-private'&&!JSON.stringify(f.state()).includes('private'),'newer secret stays private and intact');
  f.behavior.put=async()=>{throw Error('Lost secret reply');};await f.click('Save');const count=f.requests.filter(row=>row.options.method==='PUT').length;await f.click('Check current settings');check(f.input('api_key').value==='newer-private'&&f.button('Save reviewed changes')&&f.requests.filter(row=>row.options.method==='PUT').length===count,'masked read cannot confirm or automatically resend a secret');
 }],
 ['captured apps and safe schema/help presentation',async check=>{
  const f=adminSettingsFixture();await f.open();check(f.requests[0].options.headers.Authorization==='Bearer private-token'&&f.requests[0].options.headers['X-Kvstore-Url']==='https://store.invalid','LocalRSS auth headers captured');
  check(!('X-Kvstore-Url' in adminSettingsHeaders({baseUrl:'https://bin.invalid'},{local:false,token:'private-token',storeUrl:'https://store.invalid'})),'extra header isolated to LocalRSS');
  check(f.root().textContent.includes('<b>Title</b>')&&!f.root().querySelector('b')&&!f.root().textContent.includes('server-secret'),'literal labels and hidden secrets');await f.click('Help');check(f.modal().textContent.includes('<script>literal</script>')&&!f.modal().querySelector('script'),'safe stacked Help');
  window.CList.config.flaskSiteUrl='https://changed.invalid';check(adminSettingsApps()[0].baseUrl==='https://changed.invalid','KVStore target resolved at open');check(!JSON.stringify(f.state()).includes('private-token')&&!JSON.stringify(f.state()).includes('server-secret'),'safe state');
 }],
 ['changed-only save, blank secrets and newer drafts',async check=>{
  const f=adminSettingsFixture();await f.open();await f.click('Change');f.edit('title','Saved title');const gate=adminTestGate();f.behavior.put=payload=>gate.promise;
  const saving=f.click('Save');f.edit('title','Newer draft');await f.click('Save');const sent=f.requests.filter(row=>row.options.method==='PUT');check(sent.length===1&&JSON.stringify(JSON.parse(sent[0].options.body))==='{"title":"Saved title"}','changed-only payload and duplicate guard');
  gate.resolve({ok:true,json:async()=>({values:{enabled:'true',title:'Saved title',api_key:'masked'}})});await saving;check(f.input('title').value==='Newer draft'&&f.state().dirtyCount===2,'newer text and unfinished secret edit retained');
 }],
 ['boolean autosave sends one key and definite rejection restores old value',async check=>{
  const f=adminSettingsFixture();await f.open();f.behavior.put=async()=>({ok:false,status:403});const node=f.input('enabled');node.checked=false;await node.onchange();check(f.input('enabled').checked&&f.state().error.includes('403'),'rejected toggle restored');check(f.requests.filter(row=>row.options.method==='PUT').length===1&&f.requests.at(-1).options.body==='{"enabled":"false"}','single-key toggle');
 }],
 ['uncertain save requires read-only check and explicit reviewed save',async check=>{
  const f=adminSettingsFixture();await f.open();f.edit('title','Wanted');f.behavior.put=async()=>{throw Error('Lost reply');};await f.click('Save');const writes=f.requests.filter(row=>row.options.method==='PUT').length;await f.click('Save');check(f.requests.filter(row=>row.options.method==='PUT').length===writes,'uncertain save cannot repeat');
  await f.click('Check current settings');check(f.requests.filter(row=>row.options.method==='PUT').length===writes&&f.input('title').value==='Wanted','check preserves intent without writes');delete f.behavior.put;await f.click('Save reviewed changes');check(f.values().title==='Wanted'&&!f.state().error,'explicit reviewed changes saved');
 }],
 ['accepted unreadable reply never becomes a repeated write',async check=>{
  const f=adminSettingsFixture();await f.open();f.edit('title','Accepted');f.behavior.put=async payload=>{f.setValues(payload);return{ok:true,json:async()=>{throw Error('Body lost');}};};await f.click('Save');check(f.state().error.includes('accepted'),'accepted response distinguished');await f.click('Check current settings');check(f.requests.filter(row=>row.options.method==='PUT').length===1&&f.input('title').value==='Accepted','accepted save recovered by read');
 }],
 ['source changes and replaced rows suppress old reads/callbacks',async check=>{
  const f=adminSettingsFixture(),gate=adminTestGate();f.behavior.get=()=>gate.promise;const opening=f.open();await new Promise(resolve=>setTimeout(resolve,0));f.token('replacement');gate.resolve({ok:true,json:async()=>({schema:f.schema,values:f.values()})});await opening;check(!f.root().querySelector('#admin-settings-save-btn'),'old-session read not rendered');
  const g=adminSettingsFixture();await g.open();const old=g.button('Save').onclick;await g.click('Check current settings');await old();check(!g.requests.some(row=>row.options.method==='PUT'),'expired row callback cannot save');
 }],
 ['rebuilding while saving retains receipt and blocks overlapping write',async check=>{
  const f=adminSettingsFixture();await f.open();f.edit('title','Captured');const gate=adminTestGate();f.behavior.put=()=>gate.promise;const pending=f.click('Save');await f.open();check(f.button('Save').disabled,'rebuilt form blocked while earlier save pending');
  f.setValues({title:'Captured'});gate.resolve({ok:true,json:async()=>({values:f.values()})});await pending;f.edit('title','New form draft');await f.click('Check current settings');check(f.input('title').value==='New form draft'&&f.requests.filter(row=>row.options.method==='PUT').length===1,'late acceptance cannot erase new form draft');
 }],
 ['Local settings and malformed schema fail closed',async check=>{
  const f=adminSettingsFixture();f.local();await f.open();check(f.requests.length===0&&f.root().textContent.includes('hosted'),'Local does not send token to admin services');
  const g=adminSettingsFixture();g.behavior.get=async()=>({ok:true,json:async()=>({schema:[{key:'x'}],values:{}})});await g.open();check(!g.root().querySelector('#admin-settings-save-btn')&&g.root().textContent.includes('Invalid'),'invalid schema has no save controls');
 }]
];
