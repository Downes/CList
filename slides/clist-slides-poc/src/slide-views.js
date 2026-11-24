export const slideViewModes = [
  ['slide', 'View slide only'], ['notes', 'Slide + notes'], ['outline', 'Outline'], ['sorter', 'Slide sorter'],
]

// View preferences are local UI state, never part of the collaborative deck.
export function mountSlideViews({ root, getSlides, selectSlide, canChange = () => true }) {
  const document = root.ownerDocument
  let mode = 'slide', disposed = false
  const label = document.createElement('label'), picker = document.createElement('select')
  label.className = 'slide-view-picker'
  picker.dataset.control = 'slide-view'; picker.title = 'Choose slide editor view'; picker.setAttribute('aria-label', 'Slide editor view')
  for (const [value, name] of slideViewModes) {
    const option = document.createElement('option'); option.value = value; option.textContent = name; picker.append(option)
  }
  label.append(picker); const tools = root.querySelector('.tools'); tools.insertBefore(label, tools.firstElementChild || null)
  const outline = document.createElement('section')
  outline.className = 'slide-outline'; outline.setAttribute('aria-label', 'Presentation outline')
  root.querySelector('.workspace').append(outline)
  const list = root.querySelector('[data-control="slide-list"]'), rows = new Map()
  function refresh() {
    if (disposed || mode !== 'outline') return
    const slides = getSlides(), ids = new Set(slides.map(slide => slide.id))
    for (const [id, row] of rows) if (!ids.has(id)) { row.section.remove(); rows.delete(id) }
    let cursor = outline.firstElementChild
    slides.forEach((slide, index) => {
      let row = rows.get(slide.id)
      if (!row) {
        const section = document.createElement('section'), button = document.createElement('button'), text = document.createElement('div')
        button.className = 'btn-small'; button.title = 'Select this slide'; text.className = 'slide-outline-text'
        button.addEventListener('click', () => { if (!disposed && canChange()) selectSlide(slide.id) })
        section.append(button, text); row = { section, button, text }; rows.set(slide.id, row)
      }
      row.button.textContent = 'Slide ' + (index + 1)
      row.button.setAttribute('aria-current', String(slide.active))
      const text = slide.text || '(No text on this slide)'
      if (row.text.textContent !== text) row.text.textContent = text
      if (cursor === row.section) cursor = cursor.nextElementSibling
      else outline.insertBefore(row.section, cursor)
    })
  }
  function choose(next) {
    if (disposed || !canChange() || !slideViewModes.some(([id]) => id === next)) { picker.value = mode; return false }
    mode = next; root.dataset.slideView = mode; picker.value = mode
    list.title = mode === 'sorter' ? 'Drag to reorder. Double-click a slide or press Enter to edit it.' : 'Slides'
    refresh(); return true
  }
  const change = () => choose(picker.value)
  const edit = event => {
    if (mode !== 'sorter' || !canChange() || (event.type === 'keydown' && event.key !== 'Enter')) return
    const button = event.target.closest('[data-slide-id]')
    if (!button || !list.contains(button)) return
    event.preventDefault(); event.stopPropagation()
    selectSlide(button.dataset.slideId); choose('slide')
    picker.focus()
  }
  picker.addEventListener('change', change)
  list.addEventListener('dblclick', edit)
  list.addEventListener('keydown', edit, true)
  choose(mode)
  return {
    refresh, setMode: choose, get mode() { return mode },
    focus(id) { rows.get(id)?.button.focus({ preventScroll: true }) },
    destroy() {
      disposed = true; picker.removeEventListener('change', change); list.removeEventListener('dblclick', edit); list.removeEventListener('keydown', edit, true)
      label.remove(); outline.remove(); rows.clear(); delete root.dataset.slideView
    },
  }
}

// Shared hit testing for a vertical filmstrip and row-major sorter grid.
export function slideDropBeforeIndex(rects, x, y, grid = false) {
  return rects.findIndex(rect => grid
    ? y < rect.top || (y <= rect.bottom && x < rect.left + rect.width / 2)
    : y < rect.top + rect.height / 2)
}
