// Keep resizing a cropped image distinct from changing its viewport.
export function imageHandleProperties(original, next, mode, crop) {
  if (mode === 'crop') return { imageFit: 'cover', cropImageWidth: crop.width, cropImageHeight: crop.height }
  return { imageFit: 'cover', cropImageWidth: crop.width * next.width / original.width,
    cropImageHeight: crop.height * next.height / original.height, aspectRatio: next.width / next.height }
}
export function mountImageHandleMode(root, canChange, changed) {
  const document = root.ownerDocument, group = document.createElement('div')
  group.className = 'slide-menu-options'; group.dataset.control = 'image-handle-mode'; group.hidden = true
  group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Image handle behavior')
  let mode = 'resize', disposed = false
  const buttons = ['resize', 'crop'].map(value => {
    const button = document.createElement('button'); button.className = 'btn-small'
    button.textContent = value === 'resize' ? 'Resize' : 'Crop'; button.dataset.imageHandleMode = value
    button.title = value === 'resize' ? 'Handles resize the image' : 'Handles crop the image'
    button.addEventListener('click', () => {
      if (disposed || group.hidden || !canChange()) return
      mode = value; render(); changed()
    })
    group.append(button); return button
  })
  function render() {
    root.dataset.imageHandleMode = mode
    buttons.forEach(button => { const selected = button.dataset.imageHandleMode === mode
      button.setAttribute('aria-pressed', String(selected)); button.className = selected ? 'btn-small' : 'btn-small btn-secondary'
    })
  }
  root.querySelectorAll('.slide-menu-bar')[1].append(group); render()
  return { get mode() { return mode }, update(visible, enabled) { group.hidden = !visible; buttons.forEach(button => button.disabled = !enabled) },
    destroy() { disposed = true; group.remove() } }
}
