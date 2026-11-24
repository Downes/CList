// New Slide and Insert are the explicitly requested menu groups. Other toolbar
// controls retain their original order, handlers and icons.
export function mountSlideMenu(root, canChange = () => true, openShapes = null) {
  const document = root.ownerDocument, toolbar = root.querySelector('.toolbar'), lower = root.querySelector('.tools')
  const top = document.createElement('div'); top.className = 'slide-menu-bar tools'; lower.className = 'slide-menu-bar tools'
  top.setAttribute('aria-label', 'Slide menu'); lower.setAttribute('aria-label', 'Slide menu options')
  toolbar.insertBefore(top, lower)
  let disposed = false, active = 'new'
  const insertGroup = document.createElement('div'); insertGroup.className = 'slide-menu-options'; insertGroup.dataset.menuGroup = 'insert'
  const insertButton = document.createElement('button'); insertButton.className = 'btn-small'; insertButton.textContent = 'Insert'; insertButton.title = 'Insert options'; insertButton.dataset.menu = 'insert'
  const group = document.createElement('div'); group.className = 'slide-menu-options'; group.dataset.menuGroup = 'new'
  for (const name of ['add-slide','duplicate-slide']) {
    const control = root.querySelector('[data-control="' + name + '"]'); if (control) { if (name === 'add-slide') { control.textContent = 'Blank Slide'; control.title = 'Blank Slide' } group.append(control) }
  }
  const button = document.createElement('button'); button.className = 'btn-small'; button.textContent = 'New Slide'; button.title = 'New Slide options'; button.dataset.menu = 'new'
  const choose = id => {
    if (disposed || !canChange() || !['new','insert'].includes(id)) return false
    active = id; group.hidden = id !== 'new'; insertGroup.hidden = id !== 'insert'
    button.setAttribute('aria-pressed', String(id === 'new')); insertButton.setAttribute('aria-pressed', String(id === 'insert'))
    root.dataset.slideMenu = id; return true
  }
  button.addEventListener('click', () => choose('new')); top.append(button)
  // Move existing controls intact rather than replacing or hiding them.
  for (const control of [...lower.children]) top.append(control)
  lower.append(group, insertGroup)
  insertButton.addEventListener('click', () => choose('insert')); top.insertBefore(insertButton, button.nextSibling)
  const shape = document.createElement('button'); shape.className = 'btn-small'; shape.textContent = 'Shape'; shape.title = 'Choose a shape'; shape.dataset.control = 'choose-shape'
  insertGroup.append(shape)
  for (const [name, label] of [['add-image','Image'],['add-text','Text']]) {
    const control = root.querySelector('[data-control="' + name + '"]')
    if (control) { control.className = 'btn-small'; control.textContent = label; insertGroup.append(control) }
  }
  const shapes = root.querySelector('[data-control="shape-tools"]')
  if (shapes) { shapes.hidden = true; insertGroup.append(shapes) }
  shape.addEventListener('click', () => { if (!disposed && canChange() && active === 'insert') openShapes?.() })
  const template = document.createElement('button'); template.className = 'btn-small'; template.textContent = 'Slide Design'; template.title = 'Choose a design for the next slide'; template.dataset.control = 'choose-template'
  const layouts = root.querySelector('[data-control="slide-layout"]'), oldLabel = layouts?.parentNode
  group.append(template)
  if (layouts) { layouts.hidden = true; group.append(layouts); if (oldLabel?.classList.contains('slide-layout-label')) oldLabel.remove() }
  template.addEventListener('click', () => { if (!disposed && canChange() && layouts) { layouts.hidden = !layouts.hidden; if (!layouts.hidden) { layouts.selectedIndex = -1; layouts.focus() } } })
  const insertTemplate = () => {
    if (disposed || !canChange() || active !== 'new' || layouts.hidden || !layouts.value) return
    root.querySelector('[data-control="add-slide"]')?.click()
    layouts.hidden = true
  }
  layouts?.addEventListener('change', insertTemplate)
  root.querySelector('.slide-create-actions')?.remove()
  const zoom = root.querySelector('.canvas-zoom'); if (zoom) top.append(zoom)
  const divider = [...top.children].filter(node => node.classList.contains('rule')).at(-1)
  if (divider) {
    const right = document.createElement('div'); right.className = 'slide-menu-right'
    let control = divider.nextElementSibling
    while (control) { const next = control.nextElementSibling; right.append(control); control = next }
    top.append(right)
  }
  const status = root.querySelector('[data-control="connection-status"]'); if (status) root.querySelector('.slide-editor-info')?.append(status)
  choose('new')
  return { choose, get active() { return active }, destroy() { disposed = true; layouts?.removeEventListener('change', insertTemplate) } }
}
