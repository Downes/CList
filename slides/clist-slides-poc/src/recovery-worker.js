import * as Y from 'yjs'

let document = new Y.Doc()
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'reset') {
      document.destroy()
      document = new Y.Doc()
      Y.applyUpdate(document, data.update)
    } else if (data.type === 'update') Y.applyUpdate(document, data.update)
    else if (data.type === 'snapshot') {
      const bytes = Y.encodeStateAsUpdate(document), chunks = []
      for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)))
      const content = JSON.stringify({ format: 'clist-slides-yjs-v1', document: data.name, update: btoa(chunks.join('')) })
      self.postMessage({ id: data.id, content })
    }
  } catch (error) { self.postMessage({ error: error.message }) }
}
