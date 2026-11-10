// Read-only rich text rendering for presenter previews. No editor instance or Yjs writes.
export function renderPresenterText(fragment, targetDocument) {
  const blocks = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', codeBlock: 'pre', horizontalRule: 'hr', hardBreak: 'br' }
  const marks = { bold: 'strong', italic: 'em', strike: 's', code: 'code', underline: 'u' }
  function node(source) {
    if (typeof source.toDelta === 'function') {
      const result = targetDocument.createDocumentFragment()
      for (const part of source.toDelta()) {
        if (typeof part.insert !== 'string') continue
        let content = targetDocument.createTextNode(part.insert)
        for (const [name, value] of Object.entries(part.attributes || {})) {
          let wrapper
          if (marks[name]) wrapper = targetDocument.createElement(marks[name])
          else if (name === 'link' && typeof value?.href === 'string' && /^(https?:|mailto:|tel:)/i.test(value.href)) {
            wrapper = targetDocument.createElement('a')
            wrapper.href = value.href
            wrapper.target = '_blank'
            wrapper.rel = 'noopener noreferrer'
          }
          if (wrapper) { wrapper.append(content); content = wrapper }
        }
        result.append(content)
      }
      return result
    }
    const attributes = source.getAttributes?.() || {}
    const tag = source.nodeName === 'heading' ? 'h' + Math.max(1, Math.min(6, Number(attributes.level) || 1)) : blocks[source.nodeName] || 'div'
    const element = targetDocument.createElement(tag)
    if (source.nodeName === 'orderedList' && Number.isInteger(attributes.start)) element.start = attributes.start
    for (const child of source.toArray?.() || []) element.append(node(child))
    return element
  }
  const result = targetDocument.createDocumentFragment()
  for (const child of fragment.toArray()) result.append(node(child))
  return result
}

export function createPresenterWindow({ renderSlide, navigate, jump, present, end }) {
  const popup = window.open('', '_blank', 'popup,width=1200,height=850')
  if (!popup) throw new Error('Allow pop-up windows for CList to open Presenter view.')
  const page = popup.document
  page.title = 'CList Slides — Presenter view'
  page.documentElement.lang = 'en'
  for (const style of document.querySelectorAll('link[rel="stylesheet"], style')) page.head.append(style.cloneNode(true))
  page.body.className = 'clist-presenter-page'
  const root = page.createElement('main')
  root.className = 'clist-slides presenter-console'
  page.body.replaceChildren(root)
  const header = page.createElement('header')
  header.className = 'presenter-header'
  const heading = page.createElement('h1')
  heading.textContent = 'Presenter view'
  const position = page.createElement('span'), timer = page.createElement('span'), feedback = page.createElement('p')
  position.dataset.control = 'presenter-position'
  timer.dataset.control = 'presenter-timer'
  timer.setAttribute('aria-label', 'Elapsed presentation time')
  feedback.setAttribute('role', 'status')
  header.append(heading, position, timer)
  function report(error) { console.error('Presenter view failed:', error); feedback.textContent = error.message }
  function button(label, control, action) {
    const button = page.createElement('button')
    button.className = 'btn-small'
    button.textContent = label
    button.title = label
    button.dataset.control = control
    button.addEventListener('click', () => { try { Promise.resolve(action()).catch(report) } catch (error) { report(error) } })
    header.append(button)
    return button
  }
  const previous = button('Previous', 'presenter-previous', () => navigate(-1))
  const next = button('Next', 'presenter-next', () => navigate(1))
  const start = button('Present', 'presenter-start', present)
  const stop = button('End presentation', 'presenter-end', end)
  let elapsed = 0, runningSince = null
  function tick() {
    const seconds = Math.floor((elapsed + (runningSince === null ? 0 : Date.now() - runningSince)) / 1000)
    timer.textContent = 'Elapsed ' + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
  }
  button('Reset timer', 'presenter-reset-timer', () => { elapsed = 0; if (runningSince !== null) runningSince = Date.now(); tick() })
  const grid = page.createElement('div')
  grid.className = 'presenter-grid'
  function panel(label, control) {
    const section = page.createElement('section'), title = page.createElement('h2'), content = page.createElement('div')
    title.textContent = label
    content.dataset.control = control
    section.append(title, content)
    grid.append(section)
    return content
  }
  const current = panel('Current slide', 'presenter-current'), upcoming = panel('Next slide', 'presenter-upcoming')
  const notesTitle = page.createElement('h2'), notes = page.createElement('div'), instruction = page.createElement('p')
  notesTitle.textContent = 'Speaker notes'
  notes.className = 'presenter-notes'
  notes.dataset.control = 'presenter-notes'
  instruction.className = 'helper'
  instruction.textContent = 'Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.'
  root.append(header, instruction, feedback, grid, notesTitle, notes)
  popup.addEventListener('keydown', event => {
    if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return
    if (event.key === ' ' && event.target?.tagName === 'BUTTON') return
    const keys = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Home', 'End', 'Escape']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    try {
      if (event.key === 'Escape') Promise.resolve(end()).catch(report)
      else if (event.key === 'Home' || event.key === 'End') jump(event.key === 'Home' ? 'first' : 'last')
      else navigate(['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ? -1 : 1)
    } catch (error) { report(error) }
  })
  const interval = window.setInterval(() => { if (popup.closed) window.clearInterval(interval); else tick() }, 250)
  function close() { window.clearInterval(interval); if (!popup.closed) popup.close(); window.removeEventListener('beforeunload', close) }
  popup.addEventListener('unload', () => { window.clearInterval(interval); window.removeEventListener('beforeunload', close) })
  window.addEventListener('beforeunload', close)
  tick()
  return {
    get closed() { return popup.closed },
    focus() { popup.focus() }, close,
    update({ id, nextId, index, total, notes: text, presenting }) {
      if (popup.closed) return
      position.textContent = 'Slide ' + (index + 1) + ' of ' + total
      notes.textContent = text || 'No speaker notes for this slide.'
      current.replaceChildren(renderSlide(id, page))
      if (nextId) upcoming.replaceChildren(renderSlide(nextId, page))
      else { const message = page.createElement('p'); message.textContent = 'End of presentation'; upcoming.replaceChildren(message) }
      previous.disabled = index === 0
      next.disabled = index === total - 1
      start.disabled = presenting
      stop.disabled = !presenting
      if (presenting && runningSince === null) runningSince = Date.now()
      else if (!presenting && runningSince !== null) { elapsed += Date.now() - runningSince; runningSince = null }
      tick()
    },
  }
}
