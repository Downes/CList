// Layout styles, geometry and event binding only. Editor/reader DOM nodes stay mounted.
function createPaneView(refs,mobile){
    let transition=null,version=0;
    const clearTransition=()=>{if(transition){refs.left.removeEventListener('transitionend',transition);transition=null;}};
    return{
        left:refs.left,
        render(state){
            const current=++version;clearTransition();
            if(state.leftOpen){
                if(refs.left.offsetWidth>0)refs.left.classList.add('pane-open');
                else{transition=event=>{if(event.target===refs.left&&event.propertyName==='width'&&version===current){refs.left.classList.add('pane-open');clearTransition();}};refs.left.addEventListener('transitionend',transition);}
            }else refs.left.classList.remove('pane-open');
            refs.left.style.width=state.leftOpen?(mobile()?'100%':'300px'):'0';
            refs.right.style.width=state.rightOpen?(mobile()?'100vw':'300px'):'0';refs.mainWindow.style.right=refs.right.style.width;
            refs.read.style.flex=String(state.readFlex);refs.write.style.flex=String(state.writeFlex);
            if(mobile()){refs.mainWindow.style.transform=state.surface==='write'?'translateX(-100vw)':'translateX(0vw)';refs.mainWindow.style.transition='transform 0.5s ease';}
            refs.events.body.style.cursor=state.dragging?'col-resize':'';
        },
        measure(){const main=refs.main.getBoundingClientRect();return{left:main.left,width:main.width,readWidth:refs.read.getBoundingClientRect().width,writeWidth:refs.write.getBoundingClientRect().width};},
        bind(actions){
            const down=()=>actions.beginDrag(),move=event=>actions.drag(event.clientX),up=()=>actions.endDrag();
            refs.divider.addEventListener('mousedown',down);refs.events.addEventListener('mousemove',move);refs.events.addEventListener('mouseup',up);
            return()=>{refs.divider.removeEventListener('mousedown',down);refs.events.removeEventListener('mousemove',move);refs.events.removeEventListener('mouseup',up);clearTransition();version++;refs.events.body.style.cursor='';};
        }
    };
}
