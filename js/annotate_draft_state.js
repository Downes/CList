/// <reference path="./clist-types.js" />
const ANNOTATION_TARGET_FIELDS=[['Title','title'],['URL','url'],['Author','author_name'],['Feed','feed'],['Image','image']];
const ANNOTATION_ADOPTED_FIELDS=['title','url','author_name','author_id','feed','image','service','created_at','cited_at','replyToken','id','summary'];
/** @param {{standalone:CListReference|null}} state @param {CListReference[]} references @param {function():string} now
 * @returns {CListReference} */
function resolveAnnotationDraftTarget(state,references,now){
    if(references[0])return references[0];
    return state.standalone ||= {service:null,author_name:'',author_id:'',feed:'',url:'',title:'',created_at:'',cited_at:now(),id:null,summary:'',image:'',replyToken:null};
}
/** @param {CListReference} target @param {CListReference} incoming @param {CListReference[]} references
 * @returns {CListReference[]} Live objects to register through the shared reference helper. */
function receiveAnnotationDraftReference(target,incoming,references){
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))return [];
    if(!target.url){
        // Retain truthy-field adoption while preserving service extensions safely.
        for(const key of Object.keys(incoming))if(incoming[key]||!ANNOTATION_ADOPTED_FIELDS.includes(key))Object.defineProperty(target,key,{value:incoming[key],writable:true,enumerable:true,configurable:true});
        return [target];
    }
    return references.includes(target)?[incoming]:[target,incoming];
}
function annotationDraftFieldValue(target,key){return String(target[key]||'');}
/** @param {CListReference} target @param {string} key @param {string} value */
function writeAnnotationDraftField(target,key,value){
    if(!ANNOTATION_TARGET_FIELDS.some(([,field])=>field===key))return false;
    target[key]=value;return true;
}
