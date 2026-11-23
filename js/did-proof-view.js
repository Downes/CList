// Controls and feedback for the proof section in the existing DID panel.
window.CList.ui.didProof={
    bind(root,prove,edit){root.querySelector('#prove-identity-btn').onclick=prove;for(const id of ['prove-other-url','prove-other-username'])root.querySelector('#'+id).oninput=edit;},
    values(root){return {server:root.querySelector('#prove-other-url').value,username:root.querySelector('#prove-other-username').value};},
    busy(root,busy){root.querySelector('#prove-identity-btn').disabled=busy;},
    progress(root,phase){const target=root.querySelector('#prove-identity-result');target.className='me-status';target.textContent={idle:'',fetching:"Fetching the other account's public key…",signing:'Signing a challenge with your private key…',verifying:'Verifying the signature…'}[phase]||'';},
    result(root,result){
        const target=root.querySelector('#prove-identity-result');target.className='me-status';target.textContent='';
        const title=document.createElement('strong');title.textContent=result.verified?'Proven.':'Not the same key.';
        const text=document.createElement('span');text.textContent=result.verified?" This account's key signed a challenge that verifies against "+result.otherLabel+"'s published public key — same key, same identity.":" The signature did not verify against "+result.otherLabel+"'s published public key.";
        target.append(title,text);if(result.verified&&result.didKey){const code=document.createElement('code');code.textContent=result.didKey;target.append(document.createElement('br'),code);}
    },
    error(root,error){console.error('[Identity proof]',error);const target=root.querySelector('#prove-identity-result');target.className='error-message';target.textContent=error?.message||String(error);},
};
