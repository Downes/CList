/// <reference path="./clist-types.js" />
/** @returns {CListFindState} */
function createFindState() { return {panelId:0,requestId:0,query:'',providerKey:null,requestQuery:null,status:'idle',error:null}; }
function openFindState(state) { return {...state,panelId:state.panelId+1,query:''}; }
function beginFindRequest(state,key,query) {
    return {...state,requestId:state.requestId+1,providerKey:key,requestQuery:query,status:'loading',error:null};
}
function finishFindRequest(state,id,error=null) {
    return state.requestId!==id?state:{...state,status:error===null?'ready':'failed',error};
}
