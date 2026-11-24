// A quick text press remains native; holding still arms whole-box movement.
export function bindObjectPointer(node, resize, deps) {
  const surface = node.ownerDocument || node
  const schedule = deps.schedule || setTimeout, unschedule = deps.unschedule || clearTimeout
  let pending = null
  const cancel = () => {
    if (pending) unschedule(pending.timer)
    pending = null
    surface.removeEventListener('pointermove', moved, true)
    surface.removeEventListener('pointerup', ended, true)
    surface.removeEventListener('pointercancel', ended, true)
    surface.removeEventListener('pointerdown', cancel, true)
    surface.removeEventListener('visibilitychange', cancel)
    node.ownerDocument?.defaultView?.removeEventListener('blur', cancel)
  }
  const moved = event => {
    if (pending && event.pointerId === pending.pointerId && Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY) > 5) cancel()
  }
  const ended = event => { if (event.pointerId === pending?.pointerId) cancel() }
  const down = event => {
    cancel()
    if (!deps.current() || event.button !== 0 || event.isPrimary === false || event.target === resize) return
    if (deps.text() && event.target.closest?.('.text-content')) {
      deps.select(false)
      // Event.currentTarget is cleared after dispatch: capture the drag inputs now.
      const press = { button: 0, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY,
        currentTarget: node, preventDefault() {}, stopPropagation() {} }
      pending = { ...press, timer: schedule(() => {
        cancel()
        if (!deps.current() || !node.isConnected) return
        deps.move(press)
      }, 450) }
      surface.addEventListener('pointermove', moved, true)
      surface.addEventListener('pointerup', ended, true)
      surface.addEventListener('pointercancel', ended, true)
      surface.addEventListener('pointerdown', cancel, true)
      surface.addEventListener('visibilitychange', cancel)
      node.ownerDocument?.defaultView?.addEventListener('blur', cancel)
      return
    }
    if (event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); deps.select(true); deps.focus()
      return
    }
    deps.move(event)
  }
  node.addEventListener('pointerdown', down)
  return () => { cancel(); node.removeEventListener('pointerdown', down) }
}
