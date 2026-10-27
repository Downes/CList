# CList Identification Model — Version 1.01

This proposal extends the accepted CList Collection Model v1.07 without changing its three canonical entities: **Collection, Membership, and Member (Entry)**.

The central principle is:

**Every resource has a persistent identity independent of its location, representation, contents, ownership, and membership in collections.**

Existing authoritative identifiers are preserved wherever possible. CList generates identifiers only when necessary. Content-addressed identifiers can be added later without replacing persistent identities.

## 1. Fundamental identification rules

I propose eight rules.

1. **Persistent identity.** Collections, memberships and members have stable identifiers that do not change when their properties or contents change.
2. **Preserve existing identifiers.** CList retains authoritative identifiers supplied by external sources, including UUIDs, URIs and other established identifiers.
3. **Generate identifiers when necessary.** When creating a resource without an identifier, CList defaults to a UUIDv4 expressed as a URN, according to RFC 9562. Other identifier schemes remain permissible.
4. **Separate identity from location.** A filename, URL, KV-store address or publishing endpoint is not inherently the resource's identity.
5. **Identify people with DIDs.** Authors, owners and other actors are identified using decentralized identifiers.
6. **Prefer `did:key` for authorship attribution**, falling back to `did:web` when a key-based DID is unavailable. Both can support cryptographic verification when appropriate keys and verification methods are available.
7. **Keep revisions separate from identity.** A collection can change without changing its identifier. Future Merkle DAG support may identify immutable revisions by content hash.
8. **Preserve provenance.** CList distinguishes an original resource, alternate identifiers, independently created copies and resources derived from others.

These principles align with RFC 9562 and W3C DID Core without requiring CList to implement a particular external publishing format internally.

## 2. Identity at the three canonical levels

| Entity | Identification rule | Example |
|---|---|---|
| Collection | Persistent identifier assigned or preserved when the collection is created or imported | `urn:uuid:...` |
| Membership | Independently identified occurrence linking one collection to one member | `urn:uuid:...` |
| Member (Entry) | Preserves authoritative external ID, or receives a CList-generated identifier | Article URI, feed GUID, UUID URN |

These identifiers have different lifecycles.

A collection retains its identity when members are added or removed. A membership retains its identity when its position changes. A member retains its identity when referenced from different collections.

An important qualification: a feed GUID, for example, may only be unique within the context of its feed. CList should preserve its original value and source context rather than assume it is globally unique.

## 3. A common identity description

I recommend that all three entities support the same basic identification properties.

| Property | Purpose |
|---|---|
| `id` | CList's persistent identifier for the entity |
| `identifiers` | Additional identifiers assigned by external authorities |
| `locations` | Places where the resource is stored, retrieved or published |
| `attribution` | Identifiers of authors, owners and other actors |
| `provenance` | Relationships to source, copied or derived resources |
| `revisions` | Optional references to immutable content states |

These are proposed property names, not mandatory fields or a closed schema. CList's open-ended property model remains intact.

I would treat `id` as the one required identity field. The other properties are available when applicable.

## 4. Proposed example representation

Here is a collection containing one membership that references an externally identified article.

```json
{
  "id": "urn:uuid:550e8400-e29b-41d4-a716-446655440000",

  "properties": {
    "title": "My Reading Collection",
    "type": "reading-list"
  },

  "attribution": {
    "author": "did:key:z6Mk...",
    "owner": "did:web:example.org:users:alice"
  },

  "locations": [
    {
      "uri": "https://example.org/collections/reading.json",
      "role": "primary"
    }
  ],

  "members": [
    {
      "id": "urn:uuid:6ba7b810-9dad-41d1-8d80-34d594eec001",
      "member": "https://publisher.example/articles/123",

      "properties": {
        "position": 1,
        "addedAt": "2026-10-25T10:00:00Z"
      }
    }
  ]
}
```

All example identifiers and addresses are illustrative.

The article's own resource record could separately retain an RSS GUID, a canonical URL, and other authoritative identifiers. It would not be necessary to duplicate those properties within every membership.

## 5. Authorship, ownership and signing

I recommend treating **authorship, ownership and cryptographic verification as related but distinct concepts**.

| Concept | Representation |
|---|---|
| Author | Prefer `did:key`, otherwise `did:web` |
| Owner | DID identifying the responsible actor |
| Controller | DID of the actor authorized to manage the resource |
| Signer | DID and verification method used for a particular signature |

There is one important qualification to your preference for `did:key`.

A `did:key` identifies a cryptographic key-derived DID, making it particularly suitable for signing. However, **`did:web` can also support document signing** through verification methods declared in its DID document. DID Core defines verification relationships including `assertionMethod`, which is relevant to asserting authorship.

I would therefore preserve both identifiers when available:

```json
{
  "attribution": {
    "author": "did:key:z6Mk...",
    "owner": "did:web:example.org:users:alice"
  }
}
```

An authorship declaration alone is not proof of authorship. When a document is signed, CList can additionally record its signature, verification method and the exact version signed.

This also avoids confusing a stable personal identity with a signing key that may eventually be rotated or replaced.

## 6. Identity and Merkle DAGs

I recommend leaving the core data model independent of Merkle DAGs while reserving an optional content-addressed revision mechanism.

```text
Persistent collection identity
(UUID URN or authoritative external ID)
                 |
                 v
         Revision references
(Optional immutable, content-addressed snapshots)
            /           \
           v             v
      Revision A      Revision B
      Content hash A  Content hash B
```

The persistent resource identity remains unchanged as immutable revisions accumulate.

A future revision description might look like:

```json
{
  "revisions": {
    "current": "cid:example-current",
    "previous": ["cid:example-previous"]
  }
}
```

The `cid:` strings above are conceptual placeholders, not valid IPFS CID URI syntax.

A future implementation would have to define how objects are serialized, hashed and linked, but **nothing in the current identity model requires content hashing or DAG storage**.

This approach could eventually support immutable snapshots, cryptographic verification, distributed synchronization and version history.

## 7. How imports, exports and copies behave

| Operation | Identity behaviour |
|---|---|
| Import a referenced external collection | Retain authoritative identity |
| Import entries from RSS | Preserve source IDs and source context |
| Export to RSS, OPML or JSON-LD | Preserve identity wherever the format supports it |
| Move between KV stores | Preserve identity |
| Create an independent copy | Assign a new identity; retain provenance |
| Synchronize an external collection | Preserve the referenced collection's identity |
| Modify a collection | Preserve its identity; optionally create a new revision |
| Add the same entry twice | Create distinct memberships referencing the same member |

One further rule is needed for federated systems: **CList must distinguish receiving an identifier from trusting the authority that asserts it.**

For example, an imported collection may claim an owner DID. That claim should not automatically grant the DID holder authority over locally stored data. Authorization must be established separately.

Similarly, CList should not merge two resources merely because their titles, URLs or content appear equivalent.

## 8. Relationship to standards

| Standard | Application in CList |
|---|---|
| [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562) | UUID generation and UUID-based URNs |
| [W3C DID Core](https://www.w3.org/TR/did-core/) | Actor identity and verification relationships |
| [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/) | Globally identified resources and properties |
| [PROV-O](https://www.w3.org/TR/prov-o/) | Source, derivation and provenance relationships |
| [Verifiable Credentials 2.0](https://www.w3.org/TR/vc-data-model-2.0/) | Possible future signed claims and attestations |
| [Content Identifiers (CID)](https://github.com/multiformats/cid) | Optional future content-addressed revisions |

These provide compatible conceptual foundations. CList need not implement all of these standards merely to use its proposed identification model.

## 9. Recommended status

I would distinguish the decisions we've made from implementation details that remain open.

**Agreed design principles**

- Persistent identifiers independent of location and contents.
- Existing authoritative IDs preserved wherever possible.
- UUIDv4 URNs generated by default when needed.
- DID-based actor identification, with `did:key` preferred for authorship.
- Independent identities for collections, memberships and members.
- Optional future content-addressed revisions.
- Open-ended identity and provenance properties.

**Still to define**

- How CList resolves an identifier to a local or remote resource.
- How it handles conflicting or equivalent external identifiers.
- How canonical identifiers and alternative identifiers are stored in the KV store.
- How ownership, authorization and cryptographic signatures are verified.
- Whether membership references can target specific immutable revisions as well as persistent resource identities.

### My recommendation

I would accept this as **CList Identification Model — Proposal 1.0**, extending Collection Model v1.07.

The next architectural question should be **identity resolution**: given an identifier—whether a UUID URN, URL or DID—how does CList find the corresponding resource?

This is particularly important because UUID-based URNs provide location-independent identity, but not automatic retrieval.


---

# Remark: Mathematical and Logical Foundations of the Identification Model

Yes. In fact, the CList Identification Model connects to several foundational ideas in mathematics, formal logic, and computer science.

Just as our collection model draws on set theory, graph theory, and relational algebra, **our identification model draws on identity theory, equivalence relations, graph theory, and the mathematical distinction between identity and state.**

I see six particularly important connections.

## 1. Identity and equality in formal logic

In first-order logic, identity is represented by equality:

\[
a=b
\]

This means that \(a\) and \(b\) denote the same object.

One of the fundamental principles is the *substitutivity of identicals*, often associated with Leibniz's Law:

\[
a=b \implies (P(a)\leftrightarrow P(b))
\]

If two things are identical, they share the same properties, appropriately understood.

In CList, this leads to an important distinction:

- Two collections with the same title and members are not necessarily the same collection.
- A collection whose contents have changed can remain the same collection.
- Two identifiers may refer to the same resource without being identical strings.

**Identity is therefore not determined by comparing properties.**

A UUID is a name assigned to an entity, not a mathematical proof of its identity.

## 2. Identity versus state: temporal logic

A resource can persist through changes in its properties.

We can represent a resource as having a stable identity \(r\) and a state that varies with time:

\[
S(r,t)
\]

Here, \(S(r,t)\) describes the state of resource \(r\) at time \(t\).

For example:

\[
S(r,t_1)\ne S(r,t_2)
\]

even though \(r\) remains the same resource.

This distinction is central to our proposed separation of UUIDs and content hashes.

| CList concept | Mathematical interpretation |
|---|---|
| Persistent resource ID | Identity of \(r\) |
| Resource properties | State \(S(r,t)\) |
| Revision | Recorded state at a particular point |
| Content hash | Fingerprint of a specified representation of state |
| Revision history | Relations between states |

This is compatible with models of evolving objects in temporal logic and formal state-transition systems.

It also explains why we should not use content hashes as the primary identifiers of mutable CList collections.

## 3. Equivalence relations and alternate identifiers

Mathematically, an equivalence relation has three properties:

- Reflexive: \(a\sim a\)
- Symmetric: \(a\sim b\Rightarrow b\sim a\)
- Transitive: \(a\sim b\land b\sim c\Rightarrow a\sim c\)

In CList, we might have:

```text
https://example.org/article/123
urn:uuid:550e8400-e29b-41d4-a716-446655440000
https://example.org/posts/original
```

These could be different identifiers for the same resource.

If CList can establish that they denote the same resource, it can treat them as an equivalence class for identity resolution.

However, this requires care.

Two resources having identical content does **not** establish identity. Nor does one being derived from another.

Thus we need to distinguish genuine identity equivalence from weaker relationships such as similarity, copying, redirection and derivation.

This is also why RDF's `owl:sameAs` is a stronger assertion than ordinary similarity or correspondence.

## 4. Graph theory and identity

Our identification model naturally forms a directed graph.

- Collections, memberships and members are identified nodes.
- Membership records establish relationships between nodes.
- Provenance establishes relationships between resources and their sources.
- Revisions establish relationships between successive states.

There is a useful distinction between **graph identity and graph position**.

A member's identity is independent of its position in the graph. Moving an article between collections doesn't change its identity.

A membership, however, identifies a particular relationship occurrence. Its identity can persist even when attributes such as position change.

This corresponds closely to an attributed directed multigraph, in which multiple distinct edges can connect the same nodes.

## 5. Merkle DAGs and functional programming

Merkle DAGs introduce a different mathematical principle: a node's identifier is derived from its contents, including links to other nodes.

Conceptually:

\[
h=H(\text{content},h_1,h_2,\ldots,h_n)
\]

where \(H\) is a cryptographic hash function and \(h_i\) are identifiers of referenced child nodes.

This resembles **immutable data structures in functional programming**.

Rather than modifying an existing state, an operation produces a new state. Unchanged components may be shared between versions.

For CList, this suggests two complementary layers:

| Layer | Mathematical character |
|---|---|
| Persistent resource identity | Stable reference to a logical entity |
| Immutable revision | Content-addressed value within a version graph |

The first identifies *what persists*. The second identifies *what was recorded*.

This also provides a foundation for branching histories, comparison, merging and verification without requiring those capabilities in Version 1.

## 6. Provenance and the logic of attribution

Our use of DIDs introduces another distinction: **a claim is not the same as evidence establishing that claim**.

For example:

```text
Resource R has author DID A.
```

This is an attribution statement.

A digital signature may provide cryptographic evidence that a particular key signed a representation of R.

But a valid signature does not, by itself, establish that the signer actually created the content. That requires additional evidence or trust assumptions.

This distinction is familiar in formal reasoning and epistemic logic, which study the relationship between propositions, evidence and knowledge.

CList can benefit from treating authorship, signatures, ownership and authorization as separate relationships.

The W3C [PROV-O](https://www.w3.org/TR/prov-o/) ontology provides useful established vocabulary for derivation, revisions and provenance.

## 7. Putting it together

| CList identification concept | Mathematical or logical foundation |
|---|---|
| Persistent identity | Equality and reference in formal logic |
| Changing resource properties | State-transition and temporal models |
| Alternate identifiers | Equivalence relations |
| Collection and membership identifiers | Attributed graph structures |
| Content-addressed revisions | Hash functions, immutable structures, Merkle DAGs |
| Copies and derivations | Provenance relations |
| Authorship and signatures | Claims, evidence and trust |

## My recommendation

These connections suggest a general principle worth adding as a remark to the Identification Model, just as we did for the Collection Model:

> The CList identification model can be understood as a system of persistent reference over changing resource states. It distinguishes logical identity from representation, location, equivalence, provenance and cryptographic evidence. This is grounded in formal notions of identity and equivalence, graph-based relationships, and immutable content-addressed structures.

The most important consequence is that **we should not collapse identity, equality of content, equivalence of identifiers, and provenance into a single relationship**.

These are mathematically and semantically different concepts. Keeping them distinct now will make future developments—especially Merkle DAG versioning, federation and cryptographic verification—much more reliable.
