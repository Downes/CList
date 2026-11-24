// Horizontal screen movement is one degree per pixel, independent of canvas zoom.
export function rotationFromDrag(start, delta) {
  const value = Math.round((Number(start) || 0) + delta)
  return ((value + 180) % 360 + 360) % 360 - 180
}
