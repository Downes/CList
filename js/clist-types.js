// Shared JSDoc contracts for CList's plain JavaScript. No runtime code.
// Read docs/data-contracts.md before extending these definitions.

/**
 * Credentials captured by the panel before data operations. Never persisted.
 * @typedef {Object} CListAccountSession
 * @property {string} storeUrl
 * @property {string} token
 * @property {CryptoKey} encKey
 */

/**
 * @typedef {Object} CListAccountSaveRequest
 * @property {string} key Storage key, separate from the service's credential id.
 * @property {CListAccountData} data Parsed properties, retaining service extensions.
 */

/**
 * @typedef {Object} CListAccountSchema
 * @property {string} type
 * @property {boolean} [instanceFromKey]
 * @property {{label: string, placeholder?: string, default?: string}} kvKey
 * @property {Array<{key: string, label: string, editable?: boolean,
 * inputType?: string, placeholder?: string, default?: string}>} fields
 */

/**
 * @typedef {Object} CListAccountFormCallbacks
 * @property {function(): void} close
 * @property {function(string): (CListAccountFlow|null)} getAccountFlow
 * @property {function(string, CListAccountData): void} updateAccount
 */

/**
 * @typedef {Object} CListAccountForm
 * @property {function(CListAccountSchema, string, Object): void} build
 * @property {function(boolean=): CListAccountSaveRequest} read Capture form values; validates by default.
 * @property {function(): boolean} isDirty
 * @property {function(boolean): void} setDirty
 */

/**
 * Scoped interface for service-owned form controls. Includes no credentials.
 * @typedef {Object} CListAccountFormContext
 * @property {HTMLElement} root This panel, never the document.
 * @property {HTMLElement} container Schema fields container.
 * @property {'create'|'edit'} mode
 * @property {string} key
 * @property {CListAccountData} data Detached initial account properties.
 * @property {function(): boolean} isDirty
 * @property {function(): void} close
 * @property {function(string): (CListAccountFlow|null)} getAccountFlow
 * @property {function(CListAccountData): void} updateAccount Synchronize service-side changes into the form and panel data.
 */

/**
 * Optional extensions registered at CList.accountHooks[serviceType].
 * prepareSave has no DOM access; view hooks belong to the service's UI module.
 * @typedef {Object} CListAccountHooks
 * @property {function(CListAccountData): (CListAccountData|Promise<CListAccountData>)} [prepareSave]
 * @property {function(CListAccountFormContext): void} [decorateForm]
 * @property {function(CListAccountSaveRequest): (void|Promise<void>)} [reauthorize]
 */

/**
 * One mounted account panel's interface to service-specific account UI.
 * @typedef {Object} CListAccountFlowContext
 * @property {HTMLElement} container Service form container, scoped to this panel.
 * @property {function(): void} back Return to the account type picker.
 * @property {function(): void} finish Close the add-account flow.
 * @property {function(): CListAccountRecord[]} getAccounts Current panel accounts.
 * @property {function(): Promise<CListAccountRecord[]>} reloadAccounts Refresh panel accounts.
 * @property {function(string): Promise<void>} refreshList Refresh the account list for a store URL.
 */

/**
 * Factory result cached separately for each panel. Factories perform no I/O.
 * @typedef {Object} CListAccountFlow
 * @property {function(): void} open Render and wire the service's add form.
 * @property {function(Object): Promise<void>} [manageChannels] Discord's shared add/edit channel UI.
 */

/**
 * Ciphertext returned by the KV storage facade; decrypt before parsing.
 * @typedef {Object} CListEncryptedKVRecord
 * @property {string} key
 * @property {string} value Encrypted value, not JSON text.
 */

/**
 * Account wrapper used in CList.accounts and returned by getAccounts().
 * @typedef {Object} CListAccountRecord
 * @property {string} key
 * @property {string} value Decrypted JSON text; use parseAccountValue().
 */

/**
 * Parsed account properties. Service-specific properties remain open-ended.
 * Optional fields may be missing on older records. Parsing is not validation.
 * @typedef {Object.<string, *> & {type?: string, instance?: string,
 * title?: string, permissions?: string, id?: string, serviceUrl?: string,
 * database?: string, collectionSlug?: string, collectionId?: string,
 * collectionItems?: string}} CListAccountData
 */

/**
 * Known member properties plus arbitrary source-specific properties.
 * url is the website/resource URL; feed is the subscription URL.
 * A contains membership references a nested collection through collectionId.
 * This describes today's inline member representation, not a new storage model.
 * @typedef {Object.<string, *> & {title?: string, url?: string, feed?: string,
 * author_name?: string, summary?: string, membershipId?: string, role?: string,
 * collectionId?: string, localOnly?: boolean, mimeType?: string}} CListCollectionMember
 */

/**
 * @typedef {Object} CListCollectionIdentity
 * @property {string} key KV storage key.
 * @property {string} id Collection identifier.
 */

/**
 * @typedef {Object} CListPublishedCollectionUrl
 * @property {string} url
 * @property {string} format Collection format identifier.
 * @property {string} service
 * @property {string} accountInstance
 * @property {string} publishedAt ISO timestamp.
 * @property {string} [serviceId] Identifier used by the publishing service.
 * @property {string} [id] Associated published resource identifier.
 */

/**
 * User account backing a feed collection; never the shared public definition.
 * @typedef {Object} CListFeedBinding
 * @property {string} key
 * @property {string} type
 * @property {string} serviceUrl Configured service URL.
 * @property {string} database
 * @property {string} [requestBase] Effective request URL.
 */

/**
 * Editor input may not yet have a persistent identity.
 * @typedef {Object} CListEditorCollection
 * @property {string} name
 * @property {CListCollectionMember[]} items
 * @property {string|null} [key]
 * @property {string|null} [id]
 * @property {CListPublishedCollectionUrl[]} [publishedUrls]
 * @property {CListFeedBinding|null} [feedAccount]
 */

/**
 * Current decrypted collection payload; legacy bare arrays are also read.
 * The storage key belongs to the enclosing KV record.
 * @typedef {Object} CListStoredCollection
 * @property {string} id
 * @property {string} title Stored name (the editor calls this name).
 * @property {CListCollectionMember[]} items
 * @property {CListPublishedCollectionUrl[]} publishedUrls
 */

/**
 * @typedef {Object} CListCollectionSaveFields
 * @property {string} name
 * @property {string} formatId
 */

/**
 * Snapshot captured before saving; later editor changes do not change it.
 * @typedef {Object} CListCollectionSaveRequest
 * @property {string} name
 * @property {string} formatId
 * @property {CListCollectionIdentity} identity
 * @property {CListCollectionMember[]} items
 * @property {CListPublishedCollectionUrl[]} publishedUrls
 * @property {CListFeedBinding|null} feedAccount
 */

/**
 * Transient credentials passed separately from saved data and request state.
 * @typedef {Object} CListSaveSession
 * @property {string} token
 * @property {CryptoKey} encKey
 */

/**
 * @typedef {Object} CListCollectionSaveResult
 * @property {string} key
 * @property {string} id
 * @property {string} name
 * @property {CListCollectionMember[]} items
 * @property {CListPublishedCollectionUrl[]} publishedUrls
 * @property {CListFeedBinding|null} feedAccount
 */

/**
 * @typedef {CListCollectionSaveResult & {activeUpdated: boolean}} CListCollectionSaveOutcome
 */

/**
 * @typedef {{type: 'Mastodon', statusId: string} |
 * {type: 'Bluesky', uri: string, cid: string}} CListReplyToken
 */

/**
 * Source attribution captured when an item enters the editor.
 * @typedef {Object} CListReference
 * @property {string|null} service
 * @property {string} author_name
 * @property {string} author_id
 * @property {string} feed
 * @property {string} url
 * @property {string} title
 * @property {string} created_at Source ISO timestamp, or empty string.
 * @property {string} cited_at Capture ISO timestamp.
 * @property {string} id DOM item identifier.
 * @property {string} summary
 * @property {string} [image]
 * @property {CListReplyToken|null} replyToken
 */

/**
 * Captured after awaiting the active editor's content API.
 * @typedef {Object} CListPublicationRequest
 * @property {string} title
 * @property {string} content Packaged HTML, including references.
 * @property {CListReference[]} references
 * @property {string[]} selectedAccountKeys
 * @property {string} accountStoreUrl
 */

/**
 * Ordinary publisher return value; null means no published URL was returned.
 * @typedef {string|null} CListPublisherResult
 */

/**
 * Bin publisher result, distinct from an ordinary publisher's URL string.
 * @typedef {Object} CListBinPublisherResult
 * @property {string} url
 * @property {string} [serviceId]
 */
