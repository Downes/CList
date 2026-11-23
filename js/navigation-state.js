// Pure shortcut/gesture decisions; no DOM or credential state.
/** @param {CListNavigationKeyFacts} event */
function navigationKeyIntent(event){
    if(event.blocked||event.defaultPrevented||event.composing||event.ctrl||event.meta)return null;
    const key=String(event.key||'').toLowerCase();
    if(event.alt)return key==='a'&&!event.repeat?'annotate':null;
    if(key==='j')return'next';if(key==='k')return'previous';if(key==='x'&&!event.repeat)return'toggle';return null;
}
function navigationIndex(index,direction,count){return count?Math.min(Math.max(index+direction,0),count-1):-1;}
/** @param {CListNavigationTouchFacts} touch */
function navigationTouchIntent(touch){
    const dx=touch.endX-touch.x,dy=touch.endY-touch.y,duration=touch.duration;
    if(![dx,dy,duration].every(Number.isFinite)||duration<0)return null;
    if(touch.mobile&&Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)*1.5&&duration<=750){
        const routes={'left-pane':{left:'read'},'read-pane':{right:'left',left:'write'},'write-pane':{right:'read',left:'right'},'right-pane':{right:'write'}};
        const pane=routes[touch.pane]?.[dx<0?'left':'right'];return pane?{kind:'pane',pane}:null;
    }
    if(touch.feed&&duration<=250&&Math.abs(dy)>30&&Math.abs(dy)<120&&Math.abs(dy)>Math.abs(dx)*1.5)return{kind:'entry',direction:dy>0?1:-1};
    return null;
}
