# Shared JavaScript data contracts

`js/clist-types.js` contains shared JSDoc typedefs for accounts, collections,
collection saves, references, and publishing. Read it before changing those
structures. Relevant functions reference the definitions with `@param` and
`@returns`; triple-slash reference comments make the shared file discoverable
when a JavaScript editor opens an individual consumer file.

This file contains comments only. It does not need a runtime script tag, a
TypeScript conversion, or a build step. Annotations document contracts; they do
not validate network responses or stored data at runtime.

## Maintaining the contracts

- Update the typedef and affected function annotations in the same change as
  any change to a field, optionality, nullability, or return shape.
- Verify shapes against producers and consumers, including legacy readers.
  Describe normalized output separately from unvalidated input.
- Preserve extra properties on account data and collection members. These are
  extensible objects, not closed schemas.
- Keep ciphertext KV values distinct from decrypted JSON text and parsed data.
- Keep stored collection `title` distinct from editor/save `name`; member `url`
  is the website/resource URL and `feed` is the subscription URL.
- Keep credentials in the transient save session, outside request snapshots
  and persisted collection data.
- Reuse shared types instead of duplicating field descriptions. Add types for
  other core structures when their contracts are established in code.

These contracts describe the current implementation. They do not replace the
conceptual collection model or introduce a storage migration. Native local page
records and published page metadata are separate structures and are outside
this first set of definitions.


Account setup also uses `CListAccountFlowContext` and `CListAccountFlow`.
These describe panel-scoped UI callbacks and factory results, rather than
persisted account data. See `adding-a-service.md` for registration and loading.


Generic account management uses `CListAccountSession`, `CListAccountSaveRequest`,
`CListAccountSchema`, `CListAccountForm`, and `CListAccountHooks`. Account state
functions accept explicit credentials and plain data. They return results or
throw; form rendering and feedback are in `account-form.js` / `account-panel.js`.
`prepareSave` returns properties, not a wrapper or ciphertext. Saving preserves
unrecognized properties and separates the storage key from a service's `id`.
