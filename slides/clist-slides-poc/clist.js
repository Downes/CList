import { createSlideEditor, loadSlideCatalogs } from './dist-embed/editor.js?v=2'

// Mount into any CList div. Caller owns the returned instance and its lifetime.
export async function mountCListSlides(container, options = {}) {
  try {
    const [dependencies, catalogs] = await Promise.all([
      import('../../js/vendor/collab-editor-bundle.js'),
      options.catalogs ? Promise.resolve(options.catalogs) : loadSlideCatalogs(new URL('./catalogs/', import.meta.url)),
    ])
    const clist = window.CList
    if (!clist?.config?.flaskSiteUrl) throw new Error('CList is not initialized')
    const accounts = clist.accounts?.length ? clist.accounts :
      (getSiteSpecificCookie(clist.config.flaskSiteUrl, clist.keys.ACCESS_TOKEN) ? await getAccounts(clist.config.flaskSiteUrl) : [])
    const account = findAccountByType('Collab', { accounts })
    const url = options.url || account?.parsedValue?.instance || clist.defaults.COLLAB.replace(/^http/, 'ws')
    const documentName = options.documentName || 'presentation'
    const cssUrl = new URL('./dist-embed/editor.css', import.meta.url).href
    if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === cssUrl)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssUrl
      document.head.append(link)
    }
    const editor = createSlideEditor(container, {
      ...options, dependencies, catalogs, documentName,
      url: options.autoConnect === false ? undefined : url,
      token: () => getSiteSpecificCookie(clist.config.flaskSiteUrl, clist.keys.ACCESS_TOKEN) || 'anonymous',
      parameters: () => ({ kvstoreUrl: clist.config.flaskSiteUrl }),
      resolveDocumentName: async name => {
        if (!getSiteSpecificCookie(clist.config.flaskSiteUrl, clist.keys.ACCESS_TOKEN)) throw new Error('Log in to CList before connecting Slides.')
        return await expandDocId(name, { namespace: 'slides' })
      },
    })
    // Local-only mode still has the configured server ready for Connect.
    container.querySelector('[data-control="server-url"]').value = url
    container.querySelector('[data-control="token"]').closest('label').hidden = true
    return editor
  } catch (error) {
    console.error('Slide editor initialization failed:', error)
    showServiceError(container, 'Slides could not open', error.message)
    throw error
  }
}
