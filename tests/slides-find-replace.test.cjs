const { test } = require('node:test')
const assert = require('node:assert/strict')
const Y = require('../slides/clist-slides-poc/node_modules/yjs')

async function setup(delta) {
    const api = await import('../slides/clist-slides-poc/src/find-replace.js')
    const doc = new Y.Doc(), fragment = doc.getXmlFragment('text'), paragraph = new Y.XmlElement('paragraph'), text = new Y.XmlText()
    fragment.insert(0,[paragraph]);paragraph.insert(0,[text]);text.applyDelta(delta)
    const entry = { id:'box', slideId:'first', slideNumber:1, fragment }
    return { ...api,doc,fragment,text,entry,find:(query,options)=>api.findSlideText(Y,[entry],query,options) }
}

test('literal matching, Unicode whole words, case options and UTF-16 selection positions', async () => {
    const s=await setup([{insert:'😀 Cat cat scatter catalogue café CAFÉ a.b aXb [x] path\\file'}])
    assert.equal(s.find('cat').length,4)
    assert.equal(s.find('cat',{wholeWord:true}).length,2)
    assert.equal(s.find('cat',{matchCase:true,wholeWord:true}).length,1)
    assert.equal(s.find('café',{wholeWord:true}).length,2)
    assert.equal(s.find('a.b').length,1)
    assert.equal(s.find('[x]').length,1)
    assert.equal(s.find('path\\file').length,1)
    assert.equal(s.find('').length,0)
    assert.equal(s.find('Cat')[0].from,4)
    assert.equal(s.find('Cat')[0].to,7)
})

test('replacement crosses rich-text marks while preserving surrounding text, links and structure', async () => {
    const s=await setup([{insert:'Hello ',attributes:{bold:{}}},{insert:'world',attributes:{italic:{}}},{insert:' link',attributes:{link:{href:'https://example.org/'}}}])
    const history=new Y.UndoManager(s.fragment)
    s.doc.transact(()=>s.replaceSlideText(s.find('Hello world'),'Hi'))
    assert.equal(s.text.toDelta().map(p=>p.insert).join(''),'Hi link')
    assert.ok(s.text.toDelta()[0].attributes.bold)
    assert.equal(s.text.toDelta().at(-1).attributes.link.href,'https://example.org/')
    assert.equal(s.fragment.get(0).nodeName,'paragraph')
    history.undo()
    assert.equal(s.text.toDelta().map(p=>p.insert).join(''),'Hello world link')
    assert.ok(s.text.toDelta().some(p=>p.attributes?.italic))
})

test('replace-all is finite, inserts replacement literally and supports deletion', async () => {
    const s=await setup([{insert:'cat cat cat'}])
    s.doc.transact(()=>s.replaceSlideText(s.find('cat'),'cat$&'))
    assert.equal(s.text.toDelta().map(p=>p.insert).join(''),'cat$& cat$& cat$&')
    s.doc.transact(()=>s.replaceSlideText(s.find('cat$&'),''))
    assert.equal(s.text.toDelta().map(p=>p.insert).join(''),'  ')
})

test('nested lists use ProseMirror positions and searches stay within text runs', async () => {
    const s=await setup([{insert:'first'}]), list=new Y.XmlElement('bulletList'), item=new Y.XmlElement('listItem'), paragraph=new Y.XmlElement('paragraph'), text=new Y.XmlText()
    s.fragment.insert(1,[list]);list.insert(0,[item]);item.insert(0,[paragraph]);paragraph.insert(0,[text]);text.insert(0,'second')
    assert.equal(s.find('second')[0].from,10)
    assert.equal(s.find('firstsecond').length,0)
})
