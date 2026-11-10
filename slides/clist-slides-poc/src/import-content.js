export function sourceUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
export function normalizedReference(value) {
  if (!value || typeof value.url !== 'string') return null
  const url = sourceUrl(value.url)
  if (!url) return null
  return { ...JSON.parse(JSON.stringify(value)), url }
}
export function importedHtml(content, references) {
  if (!content || !['text/html', 'text/plain'].includes(content.type) || typeof content.value !== 'string') throw new Error('Import HTML or plain text into Slides.')
  const container = document.createElement('div')
  if (content.type === 'text/html') {
    const parsed = new DOMParser().parseFromString(content.value, 'text/html')
    parsed.querySelectorAll('script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons').forEach(node => node.remove())
    for (const image of parsed.querySelectorAll('img')) image.replaceWith(parsed.createTextNode(image.alt || ''))
    for (const element of parsed.body.querySelectorAll('*')) {
      for (const attribute of [...element.attributes]) if (attribute.name !== 'href') element.removeAttribute(attribute.name)
      if (element.hasAttribute('href')) {
        const url = sourceUrl(element.getAttribute('href'))
        if (url) element.setAttribute('href', url); else element.removeAttribute('href')
      }
    }
    container.innerHTML = parsed.body.innerHTML
  } else {
    for (const line of content.value.split(/\r?\n/)) { const p = document.createElement('p'); p.textContent = line; container.append(p) }
  }
  for (const reference of references) {
    const p = document.createElement('p'), link = document.createElement('a')
    link.href = reference.url; link.textContent = reference.title || reference.url
    p.append(document.createTextNode('Source: '), link); container.append(p)
  }
  if (!container.textContent.trim()) throw new Error('There is no readable text to import.')
  return container.innerHTML
}
