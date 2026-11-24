const colourFields = [['background', 'Background'], ['textColour', 'Text'], ['fillColour', 'Fill'], ['borderColour', 'Border']]
export function customTheme(base, name, colours, id) {
  const label = String(name || '').trim()
  if (!label || label.length > 120) throw new Error('Enter a theme name of 1–120 characters.')
  for (const [key] of colourFields) if (!/^#[0-9a-f]{6}$/i.test(colours[key] || '')) throw new Error('Choose a valid colour for each swatch.')
  return { ...base, id, label, ...Object.fromEntries(colourFields.map(([key]) => [key, colours[key]])) }
}
export function mountThemePicker(deps) {
  const {root} = deps, document = root.ownerDocument
  const node = (tag, text, cls) => { const value = document.createElement(tag); if(text !== undefined)value.textContent=text; if(cls)value.className=cls; return value }
  const select = root.querySelector('[data-control="theme"]'), panel = root.querySelector('[data-panel="themes"]')
  const group = node('div', undefined, 'slide-menu-options slide-theme-controls'), button = node('button', 'Themes', 'btn-small')
  button.title = 'Choose and customise presentation themes'; button.dataset.control = 'open-themes'
  group.append(button, select); panel?.remove(); root.querySelectorAll('.slide-menu-bar')[1].append(group)
  let disposed = false, opened = null, generation = 0
  function open() {
    if (disposed || !deps.current()) return
    try {
      opened?.close()
      const serial = ++generation, captured = deps.capture(), body = node('div',undefined,'clist-slides slide-insert-picker slide-theme-picker')
      const heading = node('h2','Themes'), themeLabel=node('label','Presentation theme'), chooser=node('select'), swatches=node('div',undefined,'theme-preview')
      chooser.dataset.control='modal-theme'; themeLabel.append(chooser)
      const feedback=node('p');feedback.setAttribute('role','status');feedback.dataset.control='theme-feedback'
      const layout=node('button','Save current slide as a new design','btn-small'); layout.disabled=!deps.canSaveLayout();layout.title='Save the current slide as a new slide design';layout.dataset.control='save-slide-design'
      const title=node('h3','Save a new colour theme'), nameLabel=node('label','Theme name'), name=node('input');name.type='text';name.maxLength=120;name.dataset.control='theme-name';nameLabel.append(name)
      const colours=node('div',undefined,'slide-theme-colours'), inputs={}
      for(const [key,label] of colourFields){const field=node('label',label),input=node('input');input.type='color';input.dataset.themeColour=key;field.append(input);colours.append(field);inputs[key]=input}
      const actions=node('div',undefined,'slide-picker-actions'), save=node('button','Save as new theme','btn-small'), close=node('button','Close','btn-small btn-secondary')
      save.title='Save and apply a new colour theme in this presentation';save.dataset.control='save-theme';close.title='Close Themes';actions.append(close)
      const columns=node('div',undefined,'slide-theme-columns'),palette=node('section'),designs=node('section')
      palette.dataset.control='colour-themes';designs.dataset.control='slide-designs'
      const designNames=node('ul');designNames.dataset.control='slide-design-list'
      for(const design of deps.designs()){const item=node('li',design.label);designNames.append(item)}
      palette.append(node('h3','Colour Themes'),themeLabel,swatches,title,nameLabel,colours,save)
      designs.append(node('h3','Slide designs'),designNames,node('p','Slide designs can be selected when creating a new slide.'),layout)
      columns.append(palette,designs);body.append(heading,columns,feedback,actions)
      let base=deps.theme(), baseline=JSON.stringify(base)
      function choices() {chooser.replaceChildren();for(const theme of deps.themes()){const option=node('option',theme.label);option.value=theme.id;chooser.append(option)}chooser.value=deps.theme().id}
      function preview(){swatches.replaceChildren();for(const [key,label] of colourFields){const swatch=node('span');swatch.style.backgroundColor=inputs[key].value;swatch.title=label;swatches.append(swatch)}}
      function reset(){base=deps.theme();baseline=JSON.stringify(base);for(const [key]of colourFields)inputs[key].value=base[key];choices();preview()}
      reset()
      const modal=deps.openModal(body);opened=modal
      const current=()=>!disposed&&serial===generation&&captured()&&modal.current()
      const report=error=>{console.error('Slides themes:',error);if(modal.current())feedback.textContent=error.message||String(error)}
      const requireCurrent=()=>{if(!current())throw new Error('The presentation changed. Close and reopen Themes.');if(JSON.stringify(deps.theme())!==baseline)throw new Error('The theme changed elsewhere. Close and reopen Themes before saving.')}
      for(const input of Object.values(inputs))input.addEventListener('input',()=>{if(current())preview()})
      chooser.addEventListener('change',()=>{try{requireCurrent();deps.apply(chooser.value);reset();feedback.textContent='Theme applied.'}catch(error){report(error)}})
      save.addEventListener('click',()=>{try{requireCurrent();deps.save(customTheme(base,name.value,Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value])), 'custom-'+crypto.randomUUID()));reset();name.value='';feedback.textContent='Theme saved in this presentation.'}catch(error){report(error)}})
      layout.addEventListener('click',()=>{try{requireCurrent();modal.close();deps.saveLayout()}catch(error){report(error)}})
      close.addEventListener('click',()=>{if(serial===generation){generation++;modal.close()}})
    } catch(error){console.error('Slides themes:',error);deps.error(error)}
  }
  button.addEventListener('click',open)
  return {destroy(){disposed=true;generation++;opened?.close();group.remove()}}
}
