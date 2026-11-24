// Resize in object-local axes and keep the opposite edge fixed, including rotation.
export function resizeObjectEdge(original, edge, dx, dy, rotation = 0, limits = {}) {
  const angle = rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle)
  const localX = dx * c + dy * s, localY = -dx * s + dy * c
  const horizontal = edge === 'left' || edge === 'right', negative = edge === 'left' || edge === 'top'
  const axis = horizontal ? 'width' : 'height', delta = horizontal ? localX : localY
  const min = horizontal ? limits.minWidth ?? 1 : limits.minHeight ?? 1
  const max = horizontal ? limits.maxWidth ?? Infinity : limits.maxHeight ?? Infinity
  const size = Math.max(min, Math.min(max, original[axis] + (negative ? -delta : delta)))
  const shift = (size - original[axis]) * (negative ? -1 : 1) / 2
  const cx = horizontal ? shift * c : -shift * s, cy = horizontal ? shift * s : shift * c
  const width = horizontal ? size : original.width, height = horizontal ? original.height : size
  return { x: original.x + (original.width - width) / 2 + cx,
    y: original.y + (original.height - height) / 2 + cy, width, height }
}
