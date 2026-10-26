 CList Canonical Collection Model — Version 1.02

**Status:** Accepted conceptual model  
**Version:** 1.02  
**Date:** 2026-10-25  
**Scope:** Conceptual model; not a storage schema or migration plan

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

## Foundational relationship rules

1. Every collection has an identity independent of its physical location.
2. Every membership identifies one collection and one member.
3. Every member has an identity independent of its memberships.
4. Collections, memberships, and members support open-ended named properties.
5. Collections can themselves be members without a separate internal representation.

**Identity caveat:** Some imported resources do not provide reliable stable identifiers. How CList assigns or derives identifiers in such cases remains an implementation decision.

## Properties, capabilities, permissions, and functions

**Properties** are named values describing a collection, membership, or member. Properties are open-ended: there is no requirement that every resource share the same set of properties.

CList may provide an **optional registry of recognized property definitions**, including optional mappings from simple internal names to globally identified terms (for example, RDF vocabulary IRIs). The registry does not forbid unrecognized properties.

**Capabilities** describe operations that the resource or its supporting system actually supports. **Permissions** determine whether a particular actor is authorized to perform an operation. A descriptive property or capability flag alone does not confer authorization.

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
  "id": "collection:123",
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
  "members": [
    {
      "id": "membership:001",
      "resource": "https://example.org/article",
      "properties": {
        "position": 1,
        "addedAt": "2026-10-25T10:00:00Z"
      }
    }
  ]
}
```

This example demonstrates the concepts only. Property names, storage layout, identifier syntax, capability representation, and the embedding of membership records are not finalized.

## Deferred decisions

Version 1 deliberately leaves these matters open:

- Identity and identifier assignment across local, remote, and imported resources.
- Concrete serialization and storage schema, including migration from existing `items` representations.
- The property registry's format, namespaces, and resolution rules.
- Capability representation and verification; authorization enforcement.
- Function registry interfaces and dispatch conventions.
- Dynamic or synchronized membership derivation, caching, and conflict handling.
- Ordering and nested-collection traversal semantics, including cycles.
- How the read pane's existing entry/reference structures map to canonical resources and memberships.

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
