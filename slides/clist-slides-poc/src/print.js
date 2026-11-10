// Reuse the read-only presenter renderer; printing never edits the shared document.
export async function openSlidePrintView({ slideIds, renderSlide, title = 'CList presentation' }) {
  const popup = window.open('', '_blank')
  if (!popup) throw new Error('Allow pop-up windows for CList to export slides as PDF.')
  const page = popup.document
  page.title = title
  page.documentElement.lang = 'en'
  const controls = page.createElement('header')
  controls.className = 'slide-print-controls'
  const message = page.createElement('p')
  message.setAttribute('role', 'status')
  message.textContent = 'Preparing slides…'
  const print = page.createElement('button')
  print.className = 'btn'
  print.textContent = 'Print / Save as PDF'
  print.title = 'Open the print dialog to save this presentation as a PDF'
  print.disabled = true
  controls.append(message, print)
  const deck = page.createElement('main')
  deck.className = 'clist-slides slide-print-deck'
  page.body.replaceChildren(controls, deck)
  function report(error) {
    console.error('Slides PDF export failed:', error)
    message.className = 'error-message'
    message.textContent = 'Could not prepare PDF export: ' + error.message
  }
  print.addEventListener('click', () => {
    try { popup.focus(); popup.print() } catch (error) { report(error) }
  })
  try {
    const styles = []
    for (const source of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const copy = source.cloneNode(true)
      if (source.tagName === 'LINK') {
        copy.href = source.href // about:blank windows must not depend on relative URLs.
        styles.push(new Promise((resolve, reject) => {
          copy.addEventListener('load', resolve, { once: true })
          copy.addEventListener('error', () => reject(new Error('A presentation stylesheet could not load.')), { once: true })
        }))
      }
      page.head.append(copy)
    }
    const css = page.createElement('style')
    css.textContent = `
      @page { size: 1280px 720px; margin: 0; }
      html, body { display: block; width: auto; height: auto; min-height: 100%; overflow: visible; margin: 0; padding: 0; }
      body { background: #eee; }
      .slide-print-controls { padding: 12px; font: 14px system-ui, sans-serif; }
      .slide-print-deck { padding: 0; background: transparent; }
      .slide-print-page { width: min(1280px, 100%); aspect-ratio: 16 / 9; margin: 16px auto; overflow: hidden; }
      .slide-print-deck .slide { width: 100%; height: 100%; max-width: none; box-shadow: none; container-type: inline-size; }
      .slide-print-deck .slide-object { border: 0; min-height: 0; }
      .slide-print-deck .text-content .tiptap { font-size: var(--slide-font-size, 2.6cqw); }
      @media print {
        html, body { width: 1280px; background: transparent; }
        .slide-print-controls { display: none; }
        .slide-print-deck, .slide-print-deck * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .slide-print-page { width: 1280px; height: 720px; margin: 0; break-inside: avoid; break-after: page; }
        .slide-print-page:last-child { break-after: auto; }
      }
    `
    page.head.append(css)
    for (const id of slideIds) {
      const sheet = page.createElement('section')
      sheet.className = 'slide-print-page'
      sheet.append(renderSlide(id, page))
      deck.append(sheet)
    }
    await Promise.all(styles)
    await page.fonts.ready
    await Promise.all([...deck.querySelectorAll('img')].map(image => image.decode()))
    if (popup.closed) return
    message.textContent = 'Choose Save as PDF in the print dialog. Use all pages, no margins, no headers or footers, and enable background graphics. Each slide is one landscape page; speaker notes are excluded.'
    print.disabled = false
  } catch (error) {
    report(error)
    throw error
  }
}
