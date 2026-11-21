const {Element}=require('./account-fixture.cjs');
// Extend the existing small DOM fixture only for selectors used by navigation.
class NavigationElement extends Element{
 matches(selector){
  const parts=selector.trim().split(/\s+/),last=parts.pop();if(!last)return false;
  const tag=last.match(/^[\w-]+/);if(tag&&this.tagName.toLowerCase()!==tag[0].toLowerCase())return false;
  for(const [,id] of last.matchAll(/#([\w-]+)/g))if(this.id!==id)return false;
  for(const [,name] of last.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(name))return false;
  for(const [,name,value] of last.matchAll(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/g)){const actual=this.getAttribute(name);if(actual==null||(value!==undefined&&String(actual)!==value))return false;}
  if(!parts.length)return true;let parent=this.parentNode;while(parent){if(parent.matches(parts.join(' ')))return true;parent=parent.parentNode;}return false;
 }
 querySelectorAll(selectors){const result=[];const visit=node=>{for(const child of node.children){if(selectors.split(',').some(selector=>child.matches(selector)))result.push(child);visit(child);}};visit(this);return result;}
 closest(selectors){let node=this;while(node){if(selectors.split(',').some(selector=>node.matches(selector)))return node;node=node.parentNode;}return null;}
 contains(node){while(node){if(node===this)return true;node=node.parentNode;}return false;}
 get isContentEditable(){const value=this.getAttribute('contenteditable');return value==='true'||(value!=='false'&&!!this.parentNode?.isContentEditable);}
 get classList(){const set=()=>new Set((this.className||'').split(/\s+/).filter(Boolean));return{contains:value=>set().has(value),add:value=>{const values=set();values.add(value);this.className=[...values].join(' ');},remove:value=>{const values=set();values.delete(value);this.className=[...values].join(' ');},toggle:(value,on)=>{const values=set(),next=on===undefined?!values.has(value):on;if(next)values.add(value);else values.delete(value);this.className=[...values].join(' ');return next;}};}
 removeEventListener(name,fn){if(this.listeners[name]===fn)delete this.listeners[name];}
}
module.exports={NavigationElement};
