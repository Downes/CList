# CList Slides — collaborative proof of concept

A standalone single-slide, freeform WYSIWYG prototype using **Tiptap**, **Yjs**, and **Hocuspocus**. Two text boxes can be edited concurrently, moved and resized. Source is MIT licensed (see LICENSE).

## Run

```sh
npm install
npm run collab          # terminal 1: demo WebSocket server, port 1234
npm run dev             # terminal 2: Vite dev server
```

Open the Vite URL in two tabs using the same document name, and enter `ws://localhost:1234` then click **Connect** in each. Alternatively, open:

`http://localhost:5173/?ws=ws://localhost:1234&doc=demo-1`

Both tabs should share edits, movement, and resizing. The demo Hocuspocus server has **no authentication or persistent storage**; it is not production-ready. Do not expose it publicly.

`npm run build` produces static assets under `dist/` for self-hosting or vendoring. The resulting browser app needs no external CDN services.

## CList / iframe contract

Embed the built page at your chosen path, optionally with `?ws=wss://YOUR-HOCUSPOCUS&doc=YOUR-DOC-ID&origin=https://YOUR-CLIST-ORIGIN`.

When loaded inside an iframe, it sends `{ app: 'clist-slides', kind: 'ready', version: 1 }` to the parent. The parent can post:

- `{ app: 'clist-slides', kind: 'get-snapshot', requestId: '123' }` → response `kind: 'snapshot'` with a `snapshot` object.
- `{ app: 'clist-slides', kind: 'load-snapshot', snapshot: {...}, requestId: '124' }` → response `kind: 'loaded'`.

For security, the editor accepts messages **only from the configured `origin`**, and replies to that origin. Parent apps must verify the `event.origin` and `event.source` before processing responses. Prefer an explicit `origin` value; without one it defaults to the iframe's own origin, which is suitable for same-origin embedding.

The snapshot is a base64-encoded Yjs state update (`clist-slides-yjs-v1`), **not** editable presentation JSON. It preserves CRDT history for import/export. Importing **merges**, rather than replaces, existing Yjs state; create a fresh document for independent imports. Production persistence should be managed by CList/Hocuspocus, with binary Yjs updates or server-managed snapshots.

## Scope and limitations

This is a proof of concept, not a complete slide editor. It has one 1280×720 slide, collaborative rich text, synced geometry, box creation/deletion, duplication, simple formatting, and Yjs export/import. No slide creation, image handling, PPTX conversion, awareness cursors, authorization, conflict-resolution UI, persistent demo server, or connection to CList's actual endpoints yet.

It deliberately avoids Moveable/Selecto for this first test; pointer-driven dragging and resizing are sufficient to test whether collaborative geometry and rich text can share one Y.Doc.

Concurrent drag operations on the same box currently resolve property-by-property via Yjs; ownership/advisory-lock UX would be needed before production. Text editing uses Tiptap's Collaboration extension and a separate `Y.XmlFragment` for each box. The `doc` query parameter is used verbatim as the Hocuspocus document name; align it to CList's authorization conventions before deployment.
