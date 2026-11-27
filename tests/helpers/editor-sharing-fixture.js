// Synthetic editor resources and external boundaries; never use real services.
var currentEditor='text',currentEditorAccount='account-one',editorHandlers={};
var sharingDoc='namespace/document',sharingValid=true,sharingRequests=[],sharingCopies=[],sharingPosts=[];
window.CList=window.CList||{};window.CList.state={authEpoch:1,editorSwitching:{id:1}};
function readerSession(){return {server:'https://store.invalid',token:'synthetic-private-token'}}
function getRealtimeDocShareLink(server,id,mode){return server.replace('wss://','https://')+'/doc/'+id.split('/').map(encodeURIComponent).join('/')+'/'+mode}
function wsUrlToRestBase(server){return server.replace('wss://','https://')}
async function fetch(url,options){sharingRequests.push({url,options});if(options?.method)throw Error('Unexpected write');return {ok:true,json:async()=>({allow_anonymous:false})}}
async function copyToClipboard(link){sharingCopies.push(link)}
function showStatusMessage(){}
function showErrorModal(message){throw Error(message)}
function showModal(body){document.getElementById('generic-modal')?.remove();const modal=document.createElement('div');modal.id='generic-modal';modal.appendChild(body);document.body.appendChild(modal)}
window.openCollabSharePost=(mode,target)=>{sharingPosts.push(target);return true};
for(const [type,label]of [['collab','Collab'],['latex','LaTeX'],['slides','Slides'],['etherpad','Etherpad']])editorHandlers[type]={label,getSharing(){const id=sharingDoc;return {docId:id,server:'wss://shared.invalid',title:'<literal> '+id,current:()=>sharingValid&&sharingDoc===id,...(type==='etherpad'?{links:{edit:'https://pad.invalid/p/one'},accessSettings:false}:{})}}};
async function runEditorSharingChecks(check){
 refreshEditorShareButton();const button=document.getElementById('editor-share-button');check(button.hidden,'plain editor hides Share')
 for(const type of ['collab','latex','slides']){
  currentEditor=type;refreshEditorShareButton();check(!button.hidden,type+' exposes Share capability')
  await shareActiveEditor();const modal=document.getElementById('generic-modal')
  check(modal.querySelector('h3').textContent==='Share this '+editorHandlers[type].label&&modal.querySelectorAll('code').length===2,type+' uses shared modal with edit/read links')
  const before=sharingCopies.length;await [...modal.querySelectorAll('button')].find(node=>node.textContent==='Copy').onclick()
  check(sharingCopies.length===before+1&&sharingCopies.at(-1).endsWith('/edit'),type+' uses captured shared Copy')
  ;[...modal.querySelectorAll('button')].find(node=>node.textContent==='Post').onclick()
 }
 check(sharingPosts.length===3&&sharingPosts.at(-1).editorType==='slides','shared Post captures source editor')
 currentEditor='etherpad';refreshEditorShareButton();const requests=sharingRequests.length;await shareActiveEditor();let modal=document.getElementById('generic-modal')
 check(!button.hidden&&modal.querySelector('h3').textContent==='Share this Etherpad'&&modal.querySelectorAll('code').length===1,'Etherpad shares existing public pad URL')
 check(sharingRequests.length===requests&&modal.querySelector('label').hidden,'unsupported access API is hidden and never requested')
 const oldCopy=[...modal.querySelectorAll('button')].find(node=>node.textContent==='Copy'),copies=sharingCopies.length;currentEditor='text';refreshEditorShareButton();await oldCopy.onclick()
 check(button.hidden&&sharingCopies.length===copies,'editor switch rejects old share controls')
 const post=sharingPosts.at(-1);window.CList.state.authEpoch++
 check(!post.current(),'old Post expires with session')
 currentEditor='slides';sharingValid=false;refreshEditorShareButton();check(button.hidden,'expired collaborative resource hides Share')
 sharingValid=true;notifyEditorSharingChanged();await Promise.resolve();check(!button.hidden,'resource notification refreshes Share without a DOM mutation')
 check(!JSON.stringify(window.CList.state.collabSharing).includes('synthetic-private-token'),'presentation state excludes credentials')
}
