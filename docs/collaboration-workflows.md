# Collaboration Workflows — Analysis and Opportunities

*Generated 2026-06-04. Working document — update in place as opportunities are implemented.*

---

## The four systems

**Collections** — private, encrypted lists of items (URL + metadata) stored in kvstore. Collected from feeds, edited in the collection editor, exported as RSS/OPML/JSON/HTML/MD/text, published to blog or bin services, shared to chat, or opened in Collab to seed a document.

**Annotations** — W3C-compatible notes anchored to a URL. Written on items in the feed, readable by followers (federated via DID documents), "flowed" (copied) from others, count badges on feed items. Discovery via DID → AnnotationService endpoint.

**Collab** — real-time co-editing via Hocuspocus/TipTap. User-namespaced documents. Shared via link (co-edit or read-only), invited via chat card, or seeded from a collection or recent chat messages. Live presence / cursors.

**Chat** — WebRTC P2P via PeerJS, mediated by `discussions.mooc.ca` for peer discovery. Text messages, share cards (items, collections, annotations), collab invite cards. DID-signed messages. Peers exchange annotation store URLs on connect. Chat context can be promoted to a collab doc.

---

## Cross-system connections already wired

| From | To | Mechanism |
|---|---|---|
| Feed item | Collection | `library_add` button everywhere |
| Feed item | Chat | Share-to-chat button |
| Feed item | Annotation write | `arrow_forward` button |
| Feed item (collection editor open) | Collection editor | Same `arrow_forward` button |
| Annotation (after posting) | Collection | Offer prompt in `#post-result` |
| Annotation | Chat | Chat share button |
| Collection | Chat | Share card with item list |
| Collection | Collab | "Open in Collab" seeds doc with item links |
| Chat (recent messages) | Collab | "Collab from chat" seeds doc with message context |
| Collab | Chat | Send invite card, auto-broadcast on open |
| Chat invite card | Collab | "Open in Collab" button |
| Chat share card | Editor | "Load to editor" button |
| Followed user DID | Federated annotations | DID doc → AnnotationService endpoint |
| Chat peer connect | Peer annotation store | `service-announce` message |
| Feed author | Follow | `person_add` button via `/feed_meta` DID lookup |

---

## Multi-person workflows

### 1. Study group building a reading list
- A browses feeds, collects items → shares collection to chat
- B joins, views the card, opens items
- A promotes collection to collab doc → both co-edit shared notes
- Notes published to blog or bin

**Mostly works.** B can't add items to A's collection — they get a read-only card. No live joint collection.

### 2. Annotation-based learning group
- Everyone reads the same article and annotates
- Members follow each other via DID
- Each person's annotation view shows annotations from their follows

**Works for the follow-based case.** Gaps: no way to see annotations from non-followed people; no direct link to an annotation thread for pointing someone to a specific discussion.

### 3. Real-time discussion → collaborative notes
- Host starts a chat discussion; others join
- Chat → "Collab from chat" → doc seeded with last 15 messages, invite auto-broadcast
- Everyone co-edits, then publishes

**Works well.** Weak link: only the person who calls "Collab from chat" initiates the collab; peers can't initiate without having a doc open already.

### 4. Teacher-student: assigned readings with annotation
- Teacher makes a collection, publishes to URL
- Students import from URL → each gets their own copy
- Students annotate; teacher follows students, sees their annotations

**Works.** Missing: teacher can't push to students; no reading progress signal; students can't see each other without prior follows.

### 5. Live event / workshop
- Host shares collection to chat as reading list
- Attendees open items, annotate
- Host promotes to collab doc; everyone co-edits notes
- Doc published, link shared back to chat

**Largely works.** Gap: no "add all these items to my collection" action on chat share cards; attendees' annotations invisible to each other without prior follow setup.

### 6. Asynchronous collaborative curation
- A publishes collection to bin/URL, shares to B via chat
- B imports → adds items → re-publishes → shares new URL back

**Works but clunky.** "Pass the baton" — not live joint editing.

---

## Gaps

**Gap 1: No shared / collaborative collections**
Collections are private per user. Sharing is export → URL → import (snapshot copy). No live jointly-maintained item list.

**Gap 2: No "follow someone from chat"**
When someone joins with a DID ("(DID)" in join message), there's no Follow button. Compare: annotation thread view has a Follow button on every annotator.

**Gap 3: Chat share card → collection import is missing**
Received collection card in chat shows items and lets you open them individually. No "Add all to my collection" / "Import this collection" action.

**Gap 4: Collab doc → collection round trip doesn't close**
Collection → Collab works (seeded with item links). Collab → Collection doesn't exist. If a group refines a reading list in a collab doc, there's no way to extract it back as a structured collection.

**Gap 5: No annotation of a specific section in the collab editor**
Annotation system targets URLs. A collab document has no per-section URLs. No way to leave a note on a specific paragraph without editing the doc itself.

**Gap 6: No group annotation view**
Annotation thread is filtered to "my follows." No public/unfiltered view of all annotations on a URL from anyone. Limits discovery and group use without pre-existing follow relationships.

**Gap 7: No async notification or @-mention**
No way to flag someone's attention when they're offline. No @-mentions in annotations or chat. Everything is synchronous or passive pull.

**Gap 8: Chat history is ephemeral**
Messages don't persist. Joining after the start shows nothing prior. "Collab from chat" snapshots last 15 messages — useful but manual.

**Gap 9: Collections not advertised in DID documents**
DID documents advertise AnnotationService endpoints. They don't advertise published collections. Following someone gives you their annotations but not their reading lists.

**Gap 10: No "reading together" / shared browsing context**
No way for A and B to signal "I'm looking at this article right now." Share-to-chat is manual; no presence signal tied to what someone is currently reading.

**Gap 11: Annotations on a live collab document not possible**
While a doc is being collaboratively edited, there's no per-section annotation layer. After publishing to a URL, that URL could be annotated, but not during live editing.

**Gap 12: No aggregate group annotations**
If 10 people in a workshop all annotate an article, each person only sees the subset from their own follow graph. No "class view" of all annotations on an article without a shared store or prior follow setup.

---

## Seven opportunities (ordered by effort vs. impact)

### Opportunity 1: "Import to my collection" on chat share cards
**What:** Add an "Add to my collection" button to the collection share card in chat. One click opens the collection picker (existing UI) pre-populated with the shared items.
**Where:** `dynamicp2p.js` → `appendShareCard()`, `kind === 'collection'` branch.
**Status:** Not started.

### Opportunity 2: Follow button in chat panel
**What:** When a peer joins with a DID, show a Follow button next to their name in the chat panel (or in the "who's here" presence list). Calls the existing `_followUser()` from annotate.js.
**Where:** `dynamicp2p.js` → `appendMessage()` (join event) or `updateWhoList()` in collab.js. `_followUser()` is in annotate.js.
**Status:** Not started.

### Opportunity 3: Public/unfiltered annotations toggle
**Status:** Dropped — showing only annotations from followed users is the intended behaviour. The follow graph is the privacy boundary; surfacing annotations from strangers is not desired.

### Opportunity 4: Collab doc → collection export
**What:** After editing a collab doc, extract linked items back into a collection. Parse `<a href>` elements with surrounding text from TipTap HTML, map to `{title, url}` entries, open collection editor pre-populated.
**Where:** `collab.js` — add a "Save as collection" button in the collab toolbar. Calls `_activeCollection` / `initializeEditor('collection')` path.
**Status:** Not started.

### Opportunity 5: Collection published URL in DID document
**What:** When a user publishes a collection to a bin/URL, optionally advertise that URL as a `CollectionService` in their DID document. Followers can discover their public reading lists automatically.
**Where:** `kvstore.js` or a new DID management panel. Server-side: kvstore `/users/{user}/did.json` update.
**Status:** Not started. Requires DID document edit flow.

### Opportunity 6: Persistent chat log
**What:** Persist chat messages to a store (collab server SQLite, or a kvstore key) so late joiners can fetch recent history. Requires server-side change to `discussions.mooc.ca` or `collab.mooc.ca`.
**Where:** the discussions server (`app.py`, add a message store endpoint) or the collab server (`server.js`). Client: `dynamicp2p.js` fetches history on join.
**Status:** Not started. Server-side work required.

### Opportunity 7: Annotations on collab documents
**What:** Use the collab share page URL (`/doc/{id}/read`) as the annotation target. Add an "Annotate this doc" button in the collab toolbar that loads the share URL into the annotation write flow.
**Where:** `collab.js` — toolbar button calls `clistAnnotate()` with the share page URL as the target. The URL is already generated by `getCollabShareLink('read')`.
**Status:** Not started. Simplest of the structural gaps.

---

*Next step: implement opportunities in order, starting with Opportunity 1.*
