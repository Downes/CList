const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')

function helper() {
    const source=readFileSync('js/publish.js','utf8'),start=source.indexOf('async function _getWebPageEditorContent(')
    const context=vm.createContext({})
    vm.runInContext(source.slice(start,source.indexOf('async function postToWebPage()',start)),context)
    return context._getWebPageEditorContent
}
test('web publishing uses the HTML view while native slide saves remain unchanged',async()=>{
    const get=helper(), handler={contentTypes:['application/vnd.clist.slides+json'],getContent:()=>'{"update":"editable"}',getPublishContent:async()=>({type:'text/html',value:'<!doctype html><html>slides</html>'})}
    const output=await get(handler)
    assert.equal(output.type,'text/html');assert.ok(output.value.startsWith('<!doctype html>'))
    assert.equal(handler.getContent(),'{"update":"editable"}')
    assert.equal((await get(handler,'application/vnd.clist.slides+json')).type,'text/html','republish can use the viewable output')
})
test('existing editors retain content and MIME type; preparation failures propagate',async()=>{
    const get=helper(), handler={contentTypes:['text/plain'],getContent:async()=>'original'}
    assert.equal((await get(handler)).type,'text/plain')
    assert.equal((await get(handler,'text/html')).type,'text/html')
    assert.equal((await get(handler)).value,'original')
    await assert.rejects(get({getPublishContent:()=>({value:1,type:'text/html'})}),/invalid/)
    await assert.rejects(get({getPublishContent:()=>Promise.reject(new Error('Broken image'))}),/Broken image/)
})
