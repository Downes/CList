// View-only zoom. All object geometry continues to use 1280 x 720 slide units.
export function mountCanvasZoom(root, isPresenting) {
  const control = name => root.querySelector('[data-control="' + name + '"]')
  const viewport = control('canvas-viewport'), slide = control('slide'), picker = control('canvas-zoom')
  const steps = [25, 50, 75, 100, 125, 150, 200]
  let mode = 'fit', percent = 100
  function update() {
    if (isPresenting() || !viewport.clientWidth || !viewport.clientHeight) return
    const availableWidth = Math.max(1, viewport.clientWidth - 48)
    const availableHeight = Math.max(1, viewport.clientHeight - 48)
    if (mode === 'fit') percent = Math.min(100, availableWidth / 1280 * 100, availableHeight / 720 * 100)
    const width = 1280 * percent / 100, height = 720 * percent / 100
    slide.style.setProperty('--canvas-slide-width', width + 'px')
    slide.style.setProperty('--slide-text-unit', width / 1280 + 'px')
    viewport.style.setProperty('--canvas-stage-width', width + 48 + 'px')
    viewport.style.setProperty('--canvas-stage-height', height + 48 + 'px')
    picker.options[0].textContent = 'Fit (' + Math.round(percent) + '%)'
    picker.value = mode
    control('zoom-out').disabled = percent <= 25
    control('zoom-in').disabled = percent >= 200
  }
  function choose(value) {
    mode = value
    if (mode !== 'fit') percent = Number(mode)
    update()
    if (mode === 'fit') { viewport.scrollLeft = 0; viewport.scrollTop = 0 }
  }
  picker.addEventListener('change', () => choose(picker.value))
  control('zoom-fit').addEventListener('click', () => choose('fit'))
  control('zoom-in').addEventListener('click', () => choose(String(steps.find(value => value > percent + 0.1) || 200)))
  control('zoom-out').addEventListener('click', () => choose(String([...steps].reverse().find(value => value < percent - 0.1) || 25)))
  const observer = new ResizeObserver(entries => {
    if (entries.some(entry => entry.target === viewport)) update()
    // Observe the slide too: fullscreen/presentation can size it independently.
    const width = slide.getBoundingClientRect().width
    if (width > 0) slide.style.setProperty('--slide-text-unit', width / 1280 + 'px')
  })
  observer.observe(viewport)
  observer.observe(slide)
  update()
  return { update, destroy() { observer.disconnect() } }
}
