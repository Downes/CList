// Shared JSDoc contracts for CList's plain JavaScript. No runtime code.
// Read docs/data-contracts.md before extending these definitions.

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
