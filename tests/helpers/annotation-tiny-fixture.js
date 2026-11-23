// Fake TinyMCE API only; resource/controller behavior remains real in consumers.
function createAnnotationTinyFake(options={}){
    const editors=[],behavior=options.behavior||{};
    return{editors,behavior,get:()=>editors.at(-1)||null,
        init(config){
            if(behavior.before)behavior.before();
            const events=new Map();let html='';
            const editor={events,removed:0,target:config.target,sets:[],
                on(name,callback){if(!events.has(name))events.set(name,new Set());events.get(name).add(callback);},
                off(name,callback){events.get(name)?.delete(callback);},
                getContent(){if(behavior.readError)throw Error('rich read failed');return options.read?options.read():html;},
                setContent(value){if(behavior.setError)throw Error('rich write failed');html=value;this.sets.push(value);options.write?.(value);},
                getContainer:()=>options.container||{classList:{add(){}}},
                remove(){this.removed++;if(behavior.removeError)throw Error('rich remove failed');},
                emit(name){for(const callback of [...(events.get(name)||[])])callback();},
                edit(value){html=value;options.write?.(value);this.emit('input');}
            };
            editors.push(editor);config.setup(editor);
            if(behavior.init)return behavior.init(config,editor);
            editor.emit('init');return Promise.resolve([editor]);
        }
    };
}
if(typeof module!=='undefined')module.exports={createAnnotationTinyFake};
