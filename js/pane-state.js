// DOM-free layout and legacy preference normalization.
/** @returns {CListPaneState} */
function initialPaneState(){return{leftOpen:false,rightOpen:false,readFlex:1,writeFlex:1,currentPane:'read-pane',surface:'read',dragging:false};}
function paneFlex(value,fallback){
    if(value===undefined||value==='')return fallback;
    const text=String(value).trim();
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:\s+\d+(?:\.\d+)?\s+(?:0(?:px|%)?|auto))?$/i.test(text))throw new Error('Invalid saved pane sizing.');
    const result=Number.parseFloat(text);if(!Number.isFinite(result)||result<0)throw new Error('Invalid saved pane sizing.');return result;
}
/** @param {Object} saved @param {CListPaneState} fallback @returns {CListPaneState} */
function normalizePaneState(saved,fallback=initialPaneState()){
    if(!saved||typeof saved!=='object'||Array.isArray(saved))throw new Error('Invalid saved pane layout.');
    for(const key of ['leftOpen','rightOpen'])if(saved[key]!==undefined&&typeof saved[key]!=='boolean')throw new Error('Invalid saved pane visibility.');
    const state={...fallback,leftOpen:saved.leftOpen??false,rightOpen:saved.rightOpen??false,readFlex:paneFlex(saved.readFlex,fallback.readFlex),writeFlex:paneFlex(saved.writeFlex,fallback.writeFlex),dragging:false};
    if(state.readFlex+state.writeFlex<=0)throw new Error('Saved layout hides both reading and writing panes.');
    state.currentPane=state.rightOpen?'right-pane':state.leftOpen?'left-pane':state.writeFlex>state.readFlex?'write-pane':'read-pane';
    state.surface=['write-pane','right-pane'].includes(state.currentPane)?'write':'read';return state;
}
/** @param {CListPaneState} state @returns {CListPanePreference} */
function paneSnapshot(state){return{leftOpen:state.leftOpen,rightOpen:state.rightOpen,readFlex:String(state.readFlex),writeFlex:String(state.writeFlex)};}
function snapPaneState(state,direction,ratio){
    if(!Number.isFinite(ratio))return state;
    if(direction==='left')return{...state,readFlex:ratio>0.65?0.5:0,writeFlex:ratio>0.65?0.5:1};
    if(direction==='right')return{...state,readFlex:ratio<0.35?0.5:1,writeFlex:ratio<0.35?0.5:0};
    return state;
}
