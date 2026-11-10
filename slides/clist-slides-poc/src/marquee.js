// Selection is local view state; it never changes the shared document.
export function mountMarquee(root, slide, options) {
  const overlay = document.createElement('div')
  overlay.className = 'selection-marquee'
  overlay.hidden = true
  overlay.setAttribute('aria-hidden', 'true')
  slide.append(overlay)
  let drag = null
  function point(event) {
    const rect = slide.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1280, (event.clientX - rect.left) * 1280 / rect.width)), y: Math.max(0, Math.min(720, (event.clientY - rect.top) * 720 / rect.height)) }
  }
  function clear() {
    const previous = drag
    drag = null
    overlay.hidden = true
    if (previous && slide.hasPointerCapture(previous.pointer)) slide.releasePointerCapture(previous.pointer)
  }
  function cancel() {
    if (!drag) return
    const original = drag.original
    clear()
    options.select(original)
  }
  function begin(event) {
    if (event.button !== 0 || event.isPrimary === false) return
    cancel()
    drag = { start: point(event), clientX: event.clientX, clientY: event.clientY, pointer: event.pointerId, original: options.selected(), additive: event.shiftKey, slide: options.slideId(), moved: false }
    slide.setPointerCapture(event.pointerId)
  }
  function move(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    if (options.slideId() !== drag.slide) { cancel(); return }
    if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return
    drag.moved = true
    event.preventDefault()
    const end = point(event), x = Math.min(drag.start.x, end.x), y = Math.min(drag.start.y, end.y), width = Math.abs(end.x - drag.start.x), height = Math.abs(end.y - drag.start.y)
    Object.assign(overlay.style, { left: x / 12.8 + '%', top: y / 7.2 + '%', width: width / 12.8 + '%', height: height / 7.2 + '%' })
    overlay.hidden = false
    const selected = new Set(drag.additive ? drag.original : [])
    for (const object of options.objects()) {
      if (object.x < x + width && object.x + object.width > x && object.y < y + height && object.y + object.height > y) selected.add(object.id)
    }
    options.select([...selected])
  }
  function end(event) {
    if (!drag || event.pointerId !== drag.pointer) return
    move(event)
    clear()
  }
  function escape(event) {
    if (drag && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel() }
  }
  slide.addEventListener('pointermove', move)
  slide.addEventListener('pointerup', end)
  slide.addEventListener('pointercancel', cancel)
  slide.addEventListener('lostpointercapture', cancel)
  root.addEventListener('keydown', escape, true)
  return { begin, cancel, destroy() {
    clear()
    slide.removeEventListener('pointermove', move)
    slide.removeEventListener('pointerup', end)
    slide.removeEventListener('pointercancel', cancel)
    slide.removeEventListener('lostpointercapture', cancel)
    root.removeEventListener('keydown', escape, true)
    overlay.remove()
  } }
}
