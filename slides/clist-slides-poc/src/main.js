import './style.css'
import * as Y from 'yjs'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Collaboration from '@tiptap/extension-collaboration'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { createSlideEditor } from './editor.js'
import { loadSlideCatalogs } from './catalogs.js'
async function start() {
  const catalogs = await loadSlideCatalogs(new URL(/* @vite-ignore */ '../catalogs/', import.meta.url))
  const params = new URLSearchParams(location.search)
  const editor = createSlideEditor(document.getElementById('slide-editor'), {
    catalogs,
    dependencies: { Y, Editor, StarterKit, Collaboration, HocuspocusProvider, Link },
    url: params.get('ws'), documentName: params.get('doc'),
  })
  window.addEventListener('beforeunload', () => editor.destroy(), { once: true })
}
start().catch(error => {
  console.error('Slides could not open:', error)
  document.getElementById('slide-editor').textContent = 'Slides could not open: ' + error.message
})
