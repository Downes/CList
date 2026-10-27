 CList Canonical Collection Model — Version 1.07

**Status:** Accepted conceptual model  
**Version:** 1.07  
**Date:** 2026-10-26  
**Scope:** Conceptual model; not a storage schema or migration plan

**Changes from 1.06:**
- Closed three gaps found during a post-implementation code review: "Share to chat", "Open in Collab", and "Insert as text" (all in `collections.js`, reachable from the collection detail view) read a collection's items expecting flat leaf items, same as the export/publish formats, but weren't included in the original four-phase implementation. Share-to-chat had no `url` guard at all (would have sent a broken card for a nested-collection membership); the other two silently dropped nested branches. All three now call `_flattenForExport` the same way Save/Publish/Republish do — the design in "Nesting and cycle-guard rules" is unchanged, this just extends its code coverage to every surface that reads `col.items`.

**Changes from 1.05:**
- Implemented nesting/cycle-guard support in `collections.js` (all four phases: foundation lookups + cycle check, add-to-another-collection UI + nested-row rendering, export/publish traversal flattening, Collection Editor support for a nested entry). See "Nesting and cycle-guard rules" below — the design is unchanged, this just records that it's now real code, not just design. Untested in a browser (no automated or manual UI test was run as part of this change).

**Changes from 1.04:**
- Implemented the duplicate-membership decision in `collections.js`: removed the hard dedupe-by-URL block in `_showCollectionPicker` (replaced with a soft "already in — added again" notice), and gave each pushed item a `membershipId`. `_removeItemFromCollection` now keys removal by `membershipId` (falling back to object identity for pre-existing items that predate this field) instead of by `url`, since a url-keyed removal would otherwise delete every duplicate sharing that url at once.
- Added a "Nesting and cycle-guard rules" section, designed alongside the embedded/referential storage split: distinguishes containment ("contains") from mere display/mention membership roles, scopes the cycle-guard to referential containment, and specifies both a write-time preventive check and a read-time defensive ancestor-stack check.

**Changes from 1.03:**
- Added an "Ephemeral and persisted collections" subsection: every rendered list (search results, feeds, activity streams) is itself a Collection; only persisted collections and members receive a durable identifier.
- Updated the illustrative representation to show the default embedded storage shape, with `member` and `membership` split into separate objects.
- Restructured "Deferred decisions" into **Decisions and deferred matters**, moving most items to resolved status (identity assignment, read-pane mapping, storage schema default, duplicate memberships, function registry, authorization scope, nesting as a core feature) and keeping only the property registry and dynamic/synchronized membership derivation genuinely deferred.

**Changes from 1.02:**
- Added a terminology note distinguishing "reference" and "entry" from their existing, unrelated CList meanings.
- Cross-referenced the existing account-level permission system in the capabilities/permissions section.
- Added an explicit deferred-decision item noting that current duplicate-prevention behavior contradicts the duplicate-membership rule below.

## Purpose

CList uses **collection** as its user-facing concept for organizing resources. This document defines a single internal conceptual model capable of representing curated collections, feeds, playlists, bibliographies, outlines, and collections of collections. The word *list* describes related external structures and standards but need not appear in the CList user interface.

All collection kinds share one structural model. Behaviours are composable and determined by properties, actual capabilities, and permissions—not by a mandatory collection type.

## The three canonical entities

### 1. Collection

A **collection** is an independently identified resource that organizes other resources through memberships.

- It has an identity independent of its physical storage or retrieval location.
- It has an open-ended set of named properties, such as `title`, `description`, `type`, `author`, `owner`, `created`, and `modified`.
- It may have locations such as a filename, URL, or KV-store key. Identity and location are distinct.
- Its `type`, if supplied (for example, `playlist`), is a descriptive label, not an internal class that dictates its structure or behaviour.
- It may support capabilities such as ordering, nesting, synchronization, or collaborative editing, subject to implementation and authorization.
- It references members through memberships rather than requiring embedded copies of member resources.
- A collection is also a resource and may therefore be a member of another collection.

### 2. Membership

A **membership** is an explicitly represented, independently identified relationship connecting one collection to one member resource.

- It identifies the containing collection and the referenced member.
- It has its own open-ended properties, such as `position`, `addedAt`, `addedBy`, `role`, or a contextual annotation.
- It represents *participation in a particular collection*, not an intrinsic attribute of the member.
- The same resource can participate in multiple collections with different membership properties.
- Multiple distinct memberships may reference the same resource within the same collection (for example, a repeated song in a playlist).
- Operations such as remove or reorder act on membership without deleting or modifying the underlying resource.

### 3. Member (Entry)

A **member** is an independently identified resource referred to by a membership. It can be an article, song, image, document, person, feed, or another collection.

- It has an identity independent of collection membership.
- It has open-ended properties describing the resource, such as `title`, `author`, `url`, `content`, `published`, or `type`.
- It may be locally stored, remotely accessed, or represented by cached metadata; a membership does not require the complete resource to be embedded.
- In CList's read pane, an **entry** is the presentation of a member within a particular membership and collection context.
- Since a collection is itself a resource, collections can be members of other collections.

### Terminology note

This model reuses two words that already have different, established meanings elsewhere in CList:

- **"Reference"** here means *a membership referencing a member*. It is unrelated to the editor's existing reference system (`references.js`, `window.CList.state.references`) — the items pulled in as writing context for a composition, independent of any collection.
- **"Entry"** here means *the read-pane presentation of a member within a particular membership*. Elsewhere (e.g. `collection-publishing.md`, `accounts-structure.md`) "entry" is used loosely for any stored kvstore record (`page:{uuid}`, an account entry). The two senses are unrelated.

### Ephemeral and persisted collections

Every rendered list in CList — search results, an RSS feed, an activity stream in the read pane — is itself a Collection under this model, not a separate thing: its rows are Memberships, and the underlying API objects are Members. This holds whether or not anything is ever saved.

Identity, however, is assigned **lazily**, only at the point something is actually persisted. An ephemeral collection rendered for the lifetime of a session — a feed view, a set of search results — needs no durable identifier, and neither do its memberships or members. A durable identifier (see `docs/identification-model-v1.01.md`) is assigned only when a collection, membership, or member is actually saved. This is one rule applied uniformly to all three entities, not a special case for saved collections.

## Foundational relationship rules

1. Every collection has an identity independent of its physical location, once persisted.
2. Every membership identifies one collection and one member.
3. Every member has an identity independent of its memberships, once persisted.
4. Collections, memberships, and members support open-ended named properties.
5. Collections can themselves be members without a separate internal representation.

**Identity caveat:** Some imported resources do not provide reliable stable identifiers. Identifier assignment and derivation — including the lazy, persistence-triggered rule above — is addressed in detail in `docs/identification-model-v1.01.md`.

## Properties, capabilities, permissions, and functions

**Properties** are named values describing a collection, membership, or member. Properties are open-ended: there is no requirement that every resource share the same set of properties.

CList may provide an **optional registry of recognized property definitions**, including optional mappings from simple internal names to globally identified terms (for example, RDF vocabulary IRIs). The registry does not forbid unrecognized properties.

**Capabilities** describe operations that the resource or its supporting system actually supports. **Permissions** determine whether a particular actor is authorized to perform an operation. A descriptive property or capability flag alone does not confer authorization.

CList already has an account-level permission mechanism — the flag string (`r`/`w`/`p`/`e`/`t`/`g`/`z`/`s`/`b`) documented in `docs/accounts-structure.md`. Collection-, membership-, and member-level permissions under this model are a separate, finer-grained layer and will need to compose with, not replace, that existing scheme.

**Functions** are registered operations that act on collections, memberships, or members. Function applicability depends on relevant properties, capabilities, operational context, and permissions. This is **capability-based duck typing over a common structural model**: operations are not dictated solely by labels such as `playlist` or `feed`.

| Target | Illustrative functions |
| --- | --- |
| Collection | Refresh, sort, export, summarize |
| Membership | Remove, reorder, move, annotate in context |
| Member / Entry | Edit, reply, play, annotate, publish |

Functions may be defined separately from the UI controls that invoke them. The precise function registry API is **not** part of Version 1.

## Internal model versus publishing formats

CList maintains one canonical conceptual model irrespective of external publishing standards. RSS, Atom, OPML, JSON-LD, XSPF, HTML, and similar representations belong to **import/export and publishing adapters**, not to separate internal collection models.

The model is conceptually compatible with ideas from RDF (resource identity and open-ended properties), Linked Data Platform (containers and membership), ActivityStreams (collections and ordered feeds), and SHACL (optional property definitions). Version 1 does **not** require CList to store RDF triples or implement any of these specifications.

## Illustrative representation (not a normative schema)

```json
{
  "id": "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
  "properties": {
    "title": "My Reading Collection",
    "type": "reading-list",
    "author": "did:web:example.org:alice"
  },
  "locations": [
    { "uri": "https://example.org/collections/reading.json", "role": "primary" }
  ],
  "capabilities": {
    "ordered": true
  },
  "entries": [
    {
      "membership": {
        "id": "urn:uuid:6ba7b810-9dad-41d1-8d80-34d594eec001",
        "properties": {
          "position": 1,
          "addedAt": "2026-10-25T10:00:00Z"
        }
      },
      "member": {
        "id": "https://example.org/article",
        "properties": {
          "title": "An Example Article",
          "author": "Jane Example"
        }
      }
    }
  ]
}
```

This default shape is **embedded**: the collection document carries a cached copy of each member's display properties alongside its own membership record, so the collection remains self-contained and exportable even if a member later changes or disappears. A member's cached properties can drift from its live source — that's an accepted tradeoff of embedding, not an oversight. **Referential** storage — where a member is itself a separately stored document (for example, a "book" collection whose "section" members are their own files or pages) — is an additive capability for specific collection kinds, not a universal requirement; a referential member still has its own `locations`, dereferenced rather than cached.

This example demonstrates the concepts only. Property names, storage layout, identifier syntax, and capability representation are not finalized.

## Nesting and cycle-guard rules

A collection may be a member of another collection (Foundational rule 5). Nesting is a planned core feature — this section designs the cycle-guard rules for it, scoped deliberately to **referential** containment, which is why it belongs alongside the embedded/referential split above.

### Containment is a referential-storage concern

Embedding caches a member's *display* properties (title, author, …) as an inert snapshot — there is nothing further to dereference, so an embedded copy of a collection inside another cannot recurse and cannot form a live cycle. It can be stale or pointless (e.g. a collection embedding a snapshot of itself), but that's the same degenerate case the soft duplicate-membership nudge already covers at the UI level, not a structural hazard.

A **referential** membership is different: its member is resolved live, by dereferencing another collection's identity. Only referential memberships can form a containment graph that needs guarding.

### Containment vs. mention

Not every membership whose member happens to be a collection means "contains." A membership's existing `role` property (see Membership properties, above) distinguishes:

- **`role: "contains"`** — a true containment edge (e.g. a book's membership pointing at one of its section-collections). Traversal (rendering, export, summarize, search) follows these.
- any other role, or no role (e.g. a "related collections" listing) — a flat mention. Traversal does not recurse through it.

Only `"contains"` edges are part of the containment graph the rules below apply to.

### The rule

A collection must not contain itself, directly or transitively, through `"contains"` edges. Direct self-containment (a collection added as its own member) is just the depth-0 case of this same rule, not a special case.

### Write-time check (preventive)

When a `"contains"` membership would be added linking parent collection *A* to child collection *B*, walk *B*'s existing containment graph looking for *A*'s id. If found, adding the membership would close a cycle — refuse the write and surface it as a blocking error (`showErrorModal`, per `docs/error-handling.md` — this blocks a save, same category as other save-blocking validation).

The walk needs its own ancestor-guard (below) so that a malformed graph already containing a cycle can't make the *check itself* loop forever.

### Read-time check (defensive)

Traversal code must guard independently, even with the write-time check in place, because:
- collections can be edited directly (kvstore, another tool, a future import), bypassing CList's own write path;
- imported collections (per the identity caveat) may already contain cycles or unstable ids the write-time check can't reliably reason about.

Maintain the current traversal **path**, not a global visited set, as a `Set` of ancestor collection ids pushed on entering a collection and popped on leaving. A DAG — the same sub-collection reached from two different branches — is legitimate and must still render both times; only reaching an id that is on the *current* ancestor stack is a cycle. On hitting one: stop recursing into that branch, render it as a terminal stub/link instead of expanding it, and log it (`console.error`) rather than silently dropping it.

### Scale

Collections are personal-scale, not web-scale, so a plain recursive walk with an ancestor-guard is sufficient for both checks — no precomputed reachability index is needed.

## Decisions and deferred matters

### Resolved in this revision (v1.04)

- **Identity and identifier assignment** across local, remote, and imported resources is addressed in detail in `docs/identification-model-v1.01.md`. Identity is assigned lazily — only at the point something is persisted (see "Ephemeral and persisted collections" above).
- **How the read pane's entry/reference structures map to canonical resources and memberships** — resolved by treating every rendered list (search results, feeds, activity streams) as an ephemeral Collection in its own right; no separate mapping is required.
- **Concrete serialization and storage schema** — default is embedded (see "Illustrative representation" above): each entry splits into a cached `member` object and a `membership` object carrying its own id and relationship properties. Referential storage (a collection whose members are themselves separately stored documents) is an additive capability for specific collection kinds, not a universal requirement. Concrete migration from the current flat `items` array in `collections.js` is still to be scheduled.
- **Duplicate memberships** are allowed, per the Membership rules above. Implemented in `collections.js`: the dedupe-by-URL block in `_showCollectionPicker` is removed (replaced by a soft "already in — added again" notice), each pushed item now carries its own `membershipId`, and `_removeItemFromCollection` keys removal by `membershipId` rather than `url` so removing one duplicate no longer deletes every copy sharing that url.
- **Function registry interfaces and dispatch conventions** — to be generalized from the per-type dispatch pattern CList already uses for reader and publisher accounts (`window.CList.readers`, `window.CList.binPublishers`), extended to cover Collection/Membership/Member-level functions (refresh, reorder, remove, etc.), rather than designed from scratch.
- **Capability representation and authorization enforcement** — narrower in scope than originally framed. CList has no shared-collection permission model to design here: collaborative editing (`collab.js`/Hocuspocus) is access-controlled at the editing surface itself — anyone with access to that editor may edit — and that authorization is managed separately, in the server apps, outside this model. Once content leaves a collaborative session it is saved as an individually owned collection, at which point ordinary single-owner semantics apply: only that individual is authorized to edit it. This model does not need its own authorization layer for sharing.
- **Ordering and nested-collection traversal semantics, including cycles** — elevated from "defer until needed" to a planned core feature (nested collections, e.g. book → sections, are a first-class use case). Traversal and cycle-prevention rules are designed in "Nesting and cycle-guard rules" above, alongside the storage schema work: cycle-guarding is scoped to referential `"contains"` memberships, with both a write-time preventive check and a read-time ancestor-stack check. Implemented in `collections.js`: `_wouldCreateCycle` (write-time, global-visited reachability search) and `_flattenForExport` (read-time export/publish traversal, ancestor-stack) — see that file for the current call sites. Not yet browser-tested.

### Still deferred — no current need

- The property registry's format, namespaces, and resolution rules (e.g. RDF vocabulary IRIs). Nothing in CList currently requires this.
- Dynamic or synchronized membership derivation (e.g. a saved search, or an auto-updating feed treated as a collection), caching, and conflict handling. No such feature currently exists; revisit if one is proposed.

## Guiding statement

> A collection is an identified resource whose explicitly represented memberships associate it with other independently identified resources. Collections, memberships, and members have open-ended properties. Their properties, actual capabilities, context, and permissions determine which registered functions apply. Different collection uses share one internal model; external formats are publishing and interchange representations.

## Remark: Relationship to set theory and related mathematics

We're building an information model on top of set theory, with elements of graph theory and relational algebra.

Here's how the concepts correspond:

| CList concept | Mathematical analogue |
| --- | --- |
| Collection | Set |
| Member | Element |
| Membership | Set membership relation (\(x \in A\)) |
| Collection properties | Attributes of a set |
| Member properties | Attributes of an element |
| Membership properties | Attributes of the relationship |
| Collections of collections | Sets containing sets |
| Ordered collections | Sequences |
| Duplicate memberships | Multisets |
| Functions | Operations on sets, elements or relationships |

There's one significant distinction.

In classical set theory, membership is simply a binary relation: either an element belongs to a set or it doesn't.

In CList, membership is itself an identified entity with properties. That moves us closer to a property graph or a reified relationship in RDF.

Also, classical sets are unordered and contain no duplicates. Our model supports both ordering and repeated membership through distinct membership records.

So we're not reinventing set theory itself. We're developing a practical model for collections that combines:

- Set theory for membership.
- Graph theory for relationships and nested collections.
- Relational algebra for manipulating collections.
- RDF for open-ended properties and semantic interoperability.

The interesting consequence is that we may eventually be able to define CList functions using established mathematical operations—union, intersection, difference, filtering, mapping and composition—rather than inventing an entirely new vocabulary of operations.
