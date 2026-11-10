// Search literal slide text without flattening or rewriting rich-text structure.
export function findSlideText(Y, entries, query, { matchCase = false, wholeWord = false } = {}) {
  if (!query) return []
  const literal = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(wholeWord ? '(?<![\\p{L}\\p{N}_])' + literal + '(?![\\p{L}\\p{N}_])' : literal, matchCase ? 'gu' : 'giu')
  const matches = []
  for (const [order,entry] of entries.entries()) {
    function visit(node, position) {
      if (node instanceof Y.XmlText) {
        const text = node.toDelta().map(part => typeof part.insert === 'string' ? part.insert : '\ufffc').join('')
        pattern.lastIndex = 0
        for (const match of text.matchAll(pattern)) matches.push({ entry, order, text:node, start:match.index, length:match[0].length,
          from:position+match.index, to:position+match.index+match[0].length,
          snippet:text.slice(Math.max(0,match.index-25),match.index+match[0].length+40).replace(/\s+/g,' ') })
        return node.length
      }
      if (['hardBreak','horizontalRule'].includes(node.nodeName)) return 1
      let size = 1
      for (const child of node.toArray()) size += visit(child,position+size)
      return size+1
    }
    let position = 0
    for (const node of entry.fragment.toArray()) position += visit(node,position)
  }
  return matches
}

export function replaceSlideText(matches, replacement) {
  const groups = new Map()
  for (const match of matches) {
    if (!groups.has(match.text)) groups.set(match.text,[])
    groups.get(match.text).push(match)
  }
  for (const [text,group] of groups) {
    for (const match of group.sort((a,b)=>b.start-a.start)) {
      let offset = 0, attributes = {}
      for (const part of text.toDelta()) {
        const length = typeof part.insert === 'string' ? part.insert.length : 1
        if (match.start < offset+length) { attributes = part.attributes || {}; break }
        offset += length
      }
      text.delete(match.start,match.length)
      if (replacement) text.insert(match.start,replacement,attributes)
    }
  }
}

export function mountFindReplace({ root, Y, getDocument, getEntries, jump, transact, canEdit, selectedText, report, onError }) {
  const inspector = root.querySelector('.inspector'), toolbar = root.querySelector('.tools')
  const button = document.createElement('button')
  button.className = 'clist-action-btn'; button.type = 'button'
  button.dataset.control = 'open-find'
  button.title = 'Find and replace across slides (Ctrl/Cmd+F)'
  button.setAttribute('aria-label',button.title)
  const icon = document.createElement('span'); icon.className = 'material-icons md-18 md-light'; icon.textContent = 'search'; button.append(icon)
  toolbar.append(button)
  const panel = document.createElement('details'); panel.className = 'control-section'; panel.dataset.panel = 'find'
  const summary = document.createElement('summary'); summary.textContent = 'Find and replace'
  const body = document.createElement('div'); body.className = 'control-section-body'
  panel.append(summary,body); inspector.prepend(panel)
  function field(labelText, type, name) {
    const label = document.createElement('label'), input = document.createElement('input')
    input.type = type; input.dataset.control = name; input.title = labelText
    if (type !== 'checkbox') { input.maxLength = 512; input.autocomplete = 'off' }
    label.append(document.createTextNode(labelText),input); body.append(label)
    return input
  }
  const query = field('Find in slide text','search','find-query')
  const replacement = field('Replace with','text','find-replacement')
  const matchCase = field('Match case','checkbox','find-case'), wholeWord = field('Whole words','checkbox','find-word')
  const actions = document.createElement('div'); actions.className = 'object-alignment'; body.append(actions)
  const feedback = document.createElement('p'); feedback.className = 'helper'; feedback.setAttribute('role','status'); body.append(feedback)
  const results = document.createElement('div'); results.className = 'object-list'; results.dataset.control = 'find-results'; results.setAttribute('aria-label','Matching slide text'); body.append(results)
  const hint = document.createElement('p'); hint.className = 'helper'; hint.textContent = 'Searches text boxes on all slides. Locked boxes can be found but are not replaced. Enter/F3 finds next; Shift+F3 finds previous.'; body.append(hint)
  let matches = [], current = -1, anchor = null, timer = null, destroyed = false
  function safe(action) { return () => { try { action() } catch (error) { onError(error) } } }
  function action(label,name,run) {
    const node = document.createElement('button'); node.type = 'button'; node.className = 'btn btn-small'; node.textContent = label; node.title = label; node.dataset.control = name
    node.addEventListener('click',safe(run)); actions.append(node); return node
  }
  function remember(match) { anchor = match ? Y.createRelativePositionFromTypeIndex(match.text,match.start) : null }
  function paint() {
    feedback.textContent = !query.value ? 'Enter text to search.' : !matches.length ? 'No matches.' : (current >= 0 ? (current+1)+' of ' : '')+matches.length+' matches' + (current>=0 ? ' · Slide '+matches[current].entry.slideNumber : '')
    previous.disabled = next.disabled = !matches.length || !canEdit()
    replace.disabled = current < 0 || !matches[current] || matches[current].entry.locked || !canEdit()
    replaceAll.disabled = !matches.some(match=>!match.entry.locked) || !canEdit()
    results.replaceChildren()
    for (const [index,match] of matches.slice(0,100).entries()) {
      const item = document.createElement('button'); item.type = 'button'; item.className = 'btn btn-small'
      item.textContent = 'Slide '+match.entry.slideNumber+(match.entry.locked ? ' (locked)' : '')+': '+match.snippet
      item.title = item.textContent; item.setAttribute('aria-pressed',String(index===current))
      item.addEventListener('click',safe(()=>{ refresh(); const found=matches.findIndex(m=>m.text===match.text && m.start===match.start); if(found>=0)go(found) }))
      results.append(item)
    }
    if (matches.length>100) feedback.textContent += '. First 100 results shown; Next/Previous visit all matches.'
  }
  function refresh(reset = false) {
    clearTimeout(timer); timer = null
    const position = !reset && anchor ? Y.createAbsolutePositionFromRelativePosition(anchor,getDocument()) : null
    matches = findSlideText(Y,getEntries(),query.value,{matchCase:matchCase.checked,wholeWord:wholeWord.checked})
    current = position ? matches.findIndex(match=>match.text===position.type && match.start===position.index) : -1
    if (current < 0) anchor = null
    paint()
  }
  function go(index) {
    if (!canEdit() || !matches.length) return
    current = (index+matches.length)%matches.length
    remember(matches[current]); jump(matches[current]); panel.open = true; paint()
  }
  function navigate(direction) { refresh(); go(current < 0 ? direction>0 ? 0 : matches.length-1 : current+direction) }
  function replaceCurrent() {
    refresh()
    if (!canEdit() || current<0 || matches[current].entry.locked) return
    const match = matches[current], offset = match.from+replacement.value.length
    transact([match],()=>replaceSlideText([match],replacement.value))
    refresh(true)
    const nextIndex = matches.findIndex(m=>m.order>match.order || m.order===match.order && m.from>=offset)
    if (matches.length) go(nextIndex<0 ? 0 : nextIndex)
    report('Replaced one match.')
  }
  function replaceEverywhere() {
    refresh()
    if (!canEdit()) return
    const editable = matches.filter(match=>!match.entry.locked), skipped = matches.length-editable.length
    if (!editable.length) return
    transact(editable,()=>replaceSlideText(editable,replacement.value))
    refresh(true)
    report('Replaced '+editable.length+' matches.'+(skipped ? ' Skipped '+skipped+' matches in locked text boxes.' : ''))
  }
  const previous = action('Previous','find-previous',()=>navigate(-1)), next = action('Next','find-next',()=>navigate(1))
  const replace = action('Replace','find-replace',replaceCurrent), replaceAll = action('Replace all','find-replace-all',replaceEverywhere)
  function open(focusReplacement = false) {
    if (!canEdit()) return
    for (const section of inspector.querySelectorAll(':scope > .control-section')) section.open = section===panel
    const selected = selectedText()
    if (selected && selected.length<=512 && !selected.includes('\n')) query.value = selected
    panel.open = true; refresh(true)
    panel.scrollIntoView({block:'nearest'}); (focusReplacement ? replacement : query).focus(); (focusReplacement ? replacement : query).select()
  }
  button.addEventListener('click',safe(()=>open()))
  panel.addEventListener('toggle',safe(()=>{if(panel.open)refresh()}))
  query.addEventListener('input',safe(()=>{ anchor=null; clearTimeout(timer); timer=setTimeout(safe(()=>refresh(true)),150) }))
  for (const option of [matchCase,wholeWord]) option.addEventListener('change',safe(()=>refresh(true)))
  function keyboard(event) {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && ['f','h'].includes(event.key.toLowerCase()) && canEdit()) {
      event.preventDefault(); event.stopImmediatePropagation(); safe(()=>open(event.key.toLowerCase()==='h'))()
    } else if (event.key==='F3' && panel.open && query.value && canEdit()) {
      event.preventDefault(); event.stopImmediatePropagation(); safe(()=>navigate(event.shiftKey?-1:1))()
    } else if (panel.contains(event.target)) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); panel.open=false; button.focus() }
      else if (event.key === 'Enter' && [query,replacement].includes(event.target)) {
        event.preventDefault(); event.stopImmediatePropagation(); safe(()=>event.target===query ? navigate(event.shiftKey?-1:1) : replaceCurrent())()
      }
    }
  }
  root.addEventListener('keydown',keyboard,true)
  paint()
  return {
    isOpen:()=>panel.open,
    changed() { if (!destroyed && panel.open && query.value) { clearTimeout(timer); timer=setTimeout(safe(()=>refresh()),150) } },
    presenting(value) { button.disabled=value; if(value)panel.open=false },
    destroy() { destroyed=true; clearTimeout(timer); root.removeEventListener('keydown',keyboard,true); panel.remove(); button.remove() },
  }
}
