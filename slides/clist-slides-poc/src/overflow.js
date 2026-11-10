export function mountTextOverflow(root, slide, options) {
  let frame = null, destroyed = false
  const badges = new WeakMap()
  const button = root.querySelector('[data-control="fit-text"]')
  const message = root.querySelector('[data-control="text-overflow-status"]')
  function overflows(view) {
    const text = view.content.querySelector('.tiptap')
    return !!text && text.clientHeight > 0 && (text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1)
  }
  function check() {
    frame = null
    if (destroyed) return
    let count = 0
    const selected = options.selected()
    for (const view of options.views()) {
      if (!view.editor) continue
      const overflow = overflows(view)
      if (selected.includes(view)) count += Number(overflow)
      let badge = badges.get(view.node)
      if (!badge && overflow) {
        badge = document.createElement('span'); badge.className = 'text-overflow-badge'
        badge.textContent = 'Text overflow'; badge.title = 'Text does not fit in this box. Use Fit text or enlarge the box.'
        view.node.append(badge); badges.set(view.node, badge)
      }
      if (badge && badge.hidden === overflow) badge.hidden = !overflow
    }
    const disabled = options.presenting() || !selected.length || selected.some(view => view.box.get('locked') === true) || !selected.some(view => view.editor)
    if (button.disabled !== disabled) button.disabled = disabled
    const text = count ? count + ' selected text box' + (count === 1 ? ' overflows.' : 'es overflow.') + ' Use Fit text or enlarge the box.' : selected.some(view => view.editor) ? 'Selected text fits.' : 'Select a text box to check its fit.'
    if (message.textContent !== text) message.textContent = text
  }
  function schedule() { if (!destroyed && frame === null) frame = requestAnimationFrame(check) }
  function fit() {
    const selected = options.selected()
    if (options.presenting() || selected.some(view => view.box.get('locked') === true)) return
    const changes = []
    for (const view of selected) {
      if (!view.editor || !overflows(view)) continue
      const previous = view.node.style.getPropertyValue('--slide-font-size')
      const current = options.size(view.box)
      let size = 8
      try {
        let low = 8, high = Math.floor(current)
        while (low <= high) {
          const candidate = Math.floor((low + high) / 2)
          view.node.style.setProperty('--slide-font-size', candidate / 12.8 + 'cqw')
          if (overflows(view)) high = candidate - 1
          else { size = candidate; low = candidate + 1 }
        }
      } finally { view.node.style.setProperty('--slide-font-size', previous) }
      if (size < current) changes.push({ box: view.box, size })
    }
    options.apply(changes)
    check()
  }
  button.addEventListener('click', fit)
  const mutations = new MutationObserver(schedule)
  mutations.observe(slide, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class'] })
  const resize = new ResizeObserver(schedule)
  resize.observe(slide)
  document.fonts?.addEventListener('loadingdone', schedule)
  schedule()
  return { schedule, destroy() {
    destroyed = true
    if (frame !== null) cancelAnimationFrame(frame)
    mutations.disconnect(); resize.disconnect()
    document.fonts?.removeEventListener('loadingdone', schedule)
    button.removeEventListener('click', fit)
  } }
}
