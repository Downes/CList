const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Worker } = require('node:worker_threads')
const { readFileSync, readdirSync } = require('node:fs')
const path = require('node:path')
const Y = require('../slides/clist-slides-poc/node_modules/yjs')

test('real recovery worker snapshots large documents using incremental updates and resets', async () => {
    const { createRecoverySnapshot } = await import('../slides/clist-slides-poc/src/recovery-snapshot.js')
    const directory = path.resolve('slides/clist-slides-poc/dist-embed/assets')
    const source = readFileSync(path.join(directory, readdirSync(directory).find(name => name.startsWith('recovery-worker-'))), 'utf8')
    let worker, doc = new Y.Doc(), encodes = 0, ticks = 0
    const snapshots = createRecoverySnapshot({
        getDocument: () => doc,
        encode: document => { encodes++; return Y.encodeStateAsUpdate(document) },
        getName: () => 'Large presentation',
        createWorker: () => {
            const adapter = {}
            worker = new Worker(`const {parentPort}=require('node:worker_threads');global.self={postMessage:data=>parentPort.postMessage(data)};${source};parentPort.on('message',data=>self.onmessage({data}));`, { eval: true })
            worker.on('message', data => adapter.onmessage?.({ data }))
            worker.on('error', error => adapter.onerror?.(error))
            adapter.postMessage = data => worker.postMessage(data)
            adapter.terminate = () => worker.terminate()
            return adapter
        },
    })
    const attach = document => document.on('update', update => snapshots.changed(update))
    const restore = content => {
        const snapshot = JSON.parse(content), result = new Y.Doc()
        Y.applyUpdate(result, Buffer.from(snapshot.update, 'base64'))
        assert.equal(snapshot.document, 'Large presentation')
        return result
    }
    const heartbeat = setInterval(() => ticks++, 1)
    try {
        const payload = 'abcdefgh'.repeat(1024 * 1024)
        doc.getMap('data').set('image', payload); attach(doc)
        const first = restore(await snapshots.snapshot())
        assert.equal(first.getMap('data').get('image'), payload)
        assert.equal(encodes, 1)
        ticks = 0
        const start = performance.now(), pending = snapshots.snapshot(), callMs = performance.now() - start
        doc.getMap('data').set('edit', 'new text')
        await pending
        assert.ok(ticks > 0, 'main-thread timers run while the worker serializes')
        const latest = restore(await snapshots.snapshot())
        assert.equal(latest.getMap('data').get('edit'), 'new text')
        assert.equal(latest.getMap('data').get('image'), payload)
        assert.equal(encodes, 1, 'warm saves never encode the full main-thread document')
        doc.destroy(); doc = new Y.Doc(); attach(doc)
        doc.getMap('data').set('replacement', true)
        const replacement = restore(await snapshots.snapshot())
        assert.equal(replacement.getMap('data').get('replacement'), true)
        assert.equal(replacement.getMap('data').has('image'), false)
        assert.equal(encodes, 2, 'one initialization per replacement document')
        console.log('8 MB document: warm snapshot dispatch ' + callMs.toFixed(2) + ' ms')
        snapshots.destroy()
        await assert.rejects(snapshots.snapshot(), /closed/)
    } finally { clearInterval(heartbeat); snapshots.destroy(); doc.destroy() }
})
