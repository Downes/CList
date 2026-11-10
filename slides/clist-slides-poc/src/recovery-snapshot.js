// Mirror Yjs changes in a worker, keeping repeated full encodes off the UI thread.
export function createRecoverySnapshot({ getDocument, encode, getName, onError = () => {}, createWorker = () => new Worker(new URL('./recovery-worker.js', import.meta.url), { type: 'module' }) }) {
  let worker = null, mirroredDocument = null, serial = 0, destroyed = false
  const requests = new Map()
  function fail(error) {
    const notify = !requests.size && !destroyed
    worker?.terminate()
    worker = null; mirroredDocument = null
    for (const request of requests.values()) request.reject(error)
    requests.clear()
    if (notify) onError(error)
  }
  function changed(update) {
    if (!worker || mirroredDocument !== getDocument()) return
    if (update instanceof Uint8Array) {
      // Other Yjs observers still use this buffer; do not transfer/detach it.
      try { worker.postMessage({ type: 'update', update }) }
      catch (error) { fail(error) }
    }
  }
  function snapshot() {
    return new Promise((resolve, reject) => {
      try {
        if (destroyed) throw new Error('The recovery snapshot worker is closed.')
        if (!worker) {
          worker = createWorker()
          worker.onmessage = ({ data }) => {
            if (data.error) { fail(new Error(data.error)); return }
            const request = requests.get(data.id)
            if (request) { requests.delete(data.id); request.resolve(data.content) }
          }
          worker.onerror = () => fail(new Error('The background recovery worker could not run. Reload CList and use Save to protect your presentation.'))
          worker.onmessageerror = () => fail(new Error('The background recovery snapshot could not be read.'))
        }
        const current = getDocument()
        if (mirroredDocument !== current) {
          worker.postMessage({ type: 'reset', update: encode(current) })
          mirroredDocument = current
        }
        const id = ++serial
        requests.set(id, { resolve, reject })
        worker.postMessage({ type: 'snapshot', id, name: getName() })
      } catch (error) { fail(error); reject(error) }
    })
  }
  return { changed, snapshot, destroy() { destroyed = true; fail(new Error('The slide editor closed before recovery finished.')) } }
}
