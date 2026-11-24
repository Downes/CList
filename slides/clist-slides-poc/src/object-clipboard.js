// Position the selection's bounding box at the slide pointer, keeping it on canvas.
export function objectPasteOffset(bounds, point, width, height, fallback = 0) {
  const positioned = point && Number.isFinite(point.x) && Number.isFinite(point.y)
  const dx = positioned ? point.x - bounds.x : fallback
  const dy = positioned ? point.y - bounds.y : fallback
  return { x: Math.max(-bounds.x, Math.min(width - bounds.x - bounds.width, dx)),
    y: Math.max(-bounds.y, Math.min(height - bounds.y - bounds.height, dy)) }
}

// Native copy/cut may target the page or an old text selection. The focused
// editor surface owns object commands; focused text fields retain native editing.
export function ownsObjectClipboard(root, target, active, document) {
  if (!active || !root.contains(active)) return false
  if (active.isContentEditable || active.closest?.('input, textarea, select, [contenteditable="true"]')) return false
  return root.contains(target) || target === document || target === document.body || target === document.documentElement
}
