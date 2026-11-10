// Preserve deck order within a selection, including disjoint selections.
export function moveSelectedSlides(order, selected, direction) {
  const next = [...order], members = new Set(selected)
  const indices = direction < 0 ? next.map((_, i) => i) : next.map((_, i) => i).reverse()
  for (const i of indices) {
    const neighbour = i + direction
    if (neighbour >= 0 && neighbour < next.length && members.has(next[i]) && !members.has(next[neighbour])) {
      ;[next[i], next[neighbour]] = [next[neighbour], next[i]]
    }
  }
  return next
}

export function dropSelectedSlides(order, selected, before) {
  const members = new Set(selected)
  if (before && (!order.includes(before) || members.has(before))) return [...order]
  const moved = order.filter(id => members.has(id)), next = order.filter(id => !members.has(id))
  next.splice(before ? next.indexOf(before) : next.length, 0, ...moved)
  return next
}
