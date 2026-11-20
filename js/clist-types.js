/// <reference path="./reader-types.js" />
// Shared JSDoc contracts for CList's plain JavaScript. No runtime code.
// Read docs/data-contracts.md before extending these definitions.

/**
 * Transient collection storage session, outside all presentation state.
 * @typedef {Object} CListCollectionSession
 * @property {string} storeUrl
 * @property {string|null} username
 * @property {string|null} token
 * @property {CryptoKey|null} encKey
 * @property {(function():boolean)|null} [isCurrent]
 */
/**
 * Normalized stored/legacy collection with storage identity and UI name alias.
 * Unknown record/member extensions remain open; credentials are not record fields.
 * @typedef {Object.<string, *> & {key:string,id:(string|null),title:string,name:string,
 * items:CListCollectionMember[],publishedUrls:CListPublishedCollectionUrl[]}} CListCollectionBrowseRecord
 */
/**
 * @typedef {Object} CListCollectionBrowseState
 * @property {number} generation
 * @property {string} phase
 * @property {string|null} selectedKey
 * @property {string|null} confirmKey
 * @property {boolean} busy
 * @property {string|null} error
 */
/**
 * @typedef {Object} CListCollectionImportState
 * @property {number} generation
 * @property {string} phase
 * @property {boolean} busy
 * @property {string|null} error
 */
/**
 * @typedef {Object} CListCollectionOpeningState
 * @property {number} id
 * @property {string} phase
 * @property {boolean} busy
 * @property {string|null} error
 */
/**
 * @typedef {Object} CListCollectionMembershipState
 * @property {boolean} busy
 * @property {string} phase
 * @property {string|null} error
 */

/**
 * Private capture for one Dropbox file operation. Never store in CList.state.
 * @typedef {Object} CListDropboxSession
 * @property {string} username
 * @property {string} storeUrl
 * @property {string} token Storage-session token; distinct from data.id (Dropbox access token).
 * @property {string} key Original account key.
 * @property {string} expectedValue Original decrypted account JSON; advanced only by this operation's refresh.
 * @property {CListAccountData} data Detached account including service extensions.
 * @property {string|null} permission
 */
/**
 * Safe Dropbox upload receipt, independent of later panel/session changes.
 * @typedef {Object} CListDropboxSaveReceipt
 * @property {string} name
 * @property {string} path
 * @property {string|null} id
 * @property {string|null} rev
 */
/**
 * @typedef {Object} CListDropboxSaveState
 * @property {boolean} busy
 * @property {string} phase
 * @property {string|null} error
 * @property {CListDropboxSaveReceipt|null} receipt
 */
/**
 * Dropbox picker presentation. Bodies, accounts and tokens stay in private captures.
 * @typedef {Object} CListDropboxLoadState
 * @property {number} generation
 * @property {string} phase
 * @property {boolean} busy
 * @property {number} count
 * @property {string|null} selected Selected filename only.
 * @property {string|null} error
 */

/**
 * Prepared local file export. Never contains editor APIs, handles or credentials.
 * @typedef {Object} CListLocalFileOutput
 * @property {string} value Exact serialized file contents.
 * @property {string|undefined} name Suggested original/native filename.
 * @property {boolean} raw Native or unwrapped loaded file.
 * @property {string} mimeType
 * @property {string|undefined} title
 */
/**
 * @typedef {Object} CListLocalFileReceipt
 * @property {'saved'|'downloaded'|'cancelled'} status Downloaded means browser handoff only.
 * @property {string} [name]
 */
/**
 * Local-save progress only; transient captures and session credentials stay private.
 * @typedef {Object} CListLocalFileSaveState
 * @property {boolean} busy
 * @property {string} status
 * @property {{status:string,receipt:(CListLocalFileReceipt|null),metadataError:(string|null)}|null} [result]
 * @property {string|null} [error]
 */
/**
 * My Pages presentation state. Page records, encryption keys and delete receipts are private captures.
 * @typedef {Object} CListMyPagesState
 * @property {number} generation
 * @property {string} phase
 * @property {'date'|'title'|'format'} sortKey
 * @property {'asc'|'desc'} sortDir
 * @property {number|'All'} pageSize
 * @property {number} pageIndex
 * @property {'load'|'delete'|null} busy
 * @property {string|null} error
 */

/**
 * Global write-pane tags and session-scoped collection suggestions. No credentials/keys.
 * @typedef {Object} CListWriteTagsState
 * @property {string[]} selected Exact, case-preserving selected tags.
 * @property {string[]|null} collections Null until a successful read; reset on storage/session changes.
 * @property {string} query Unsubmitted global input draft.
 * @property {boolean} dropdown
 * @property {string|null} offer Captured candidate for optional collection creation.
 * @property {number} version Control lifetime; replaced input/offer callbacks expire.
 * @property {number} requestId Collection-read lifetime.
 * @property {boolean} loading
 * @property {boolean} creating
 * @property {{name:string,status:('pending'|'created'|'exists'|'failed'),error:(string|null)}|null} creation
 * @property {string|null} error
 */

/**
 * Reference panel lifecycle, separate from CList.state.references data.
 * @typedef {Object} CListReferencesPanelState
 * @property {number} generation Render/control lifetime; old rows cannot mutate a replacement list.
 * @property {boolean} open Controller-owned visibility, not inferred from DOM classes.
 * @property {boolean} busy One controller Annotate/collection-helper dispatch at a time.
 * @property {number} actionId Monotonic asynchronous action identity.
 */

/**
 * Generic Save destination panel state. Saver/account/content captures are transient.
 * @typedef {Object} CListSavePanelState
 * @property {number} panelId Monotonic destination-list generation.
 * @property {number} operationId Monotonic save-dispatch generation.
 * @property {boolean} busy Retained across list rebuilds until the dispatched saver settles.
 * @property {'ready'|'saving'|'complete'|'failed'} phase Saver settlement, not proof of a remote write.
 * @property {string|null} destination Selected destination label, never credentials or body content.
 * @property {string|null} error
 */

/**
 * Captured loaded-page properties used by page/collection publication; extensible.
 * @typedef {Object.<string, *> & {kind: string, id?: string, pageKey?: string,
 * service?: string, accountInstance?: string, serviceId?: string, url?: string,
 * title?: string, mimeType?: string, collectionKey?: string, format?: string}} CListWebPageSource
 */

/**
 * @typedef {Object} CListWebPageRequest
 * @property {string} title
 * @property {string} content Captured viewable editor output.
 * @property {string} mimeType
 * @property {CListWebPageSource|null} page Captured before awaiting the editor.
 * @property {string|null} authorDid
 * @property {string} service
 */

/** @typedef {CListAccountSession & {authorDid: (string|null)}} CListWebPageSession */

/**
 * Encrypted page:* payload, separate from native PageStore documents.
 * @typedef {Object} CListPublishedPageRecord
 * @property {string} id
 * @property {string} title
 * @property {string} url
 * @property {string} service
 * @property {string} mimeType
 * @property {string} accountInstance
 * @property {string} publishedAt
 * @property {string|null} authorDid
 * @property {string} [serviceId]
 * @property {string} [derivedFrom]
 */

/**
 * Successful publication is separate from the subsequent metadata write.
 * @typedef {Object} CListWebPageOutcome
 * @property {'published'|'unconfirmed'} status
 * @property {string|null} url
 * @property {string} id
 * @property {CListWebPageSource|null} loadedPage
 * @property {{publicationUrl: string, format: string}|null} localPublication
 * @property {string|null} metadataError
 * @property {boolean} forked
 */

/**
 * @typedef {Object} CListWebPageDependencies
 * @property {{publish?: Function, update?: Function}} adapter Existing bin adapter.
 * @property {CListAccountData} account Transient account properties, outside operation state.
 * @property {function(): string} createId
 * @property {function(): string} now
 * @property {function(string, string, string, string): string} embedIdentity
 * @property {function(CListPublishedPageRecord): Promise<string>} saveRecord
 * @property {function(string, string, Object): Promise<{id: string, pageKey: string, forked: boolean}>} touchRecord
 * @property {function(string, Object): Promise<void>} recordLocalPublication
 * @property {function(): void} assertSession
 */

/**
 * Transient AT Protocol session; selected-account publishing does not reuse reader credentials.
 * @typedef {Object} CListBlueskySession
 * @property {string} accessToken
 * @property {string} did
 * @property {string} pds
 */

/**
 * Credentials captured by the panel before data operations. Never persisted.
 * @typedef {Object} CListAccountSession
 * @property {string} storeUrl
 * @property {string} token
 * @property {CryptoKey} encKey
 * @property {function(): boolean} [isCurrent] Optional owner-lifetime guard, checked before encryption and persistence.
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
 * @property {string[]} [tags] Captured before awaiting editor output.
 * @property {string[]} selectedAccountKeys
 * @property {string} accountStoreUrl
 * @property {string|null} [localPageId] Local page captured before awaiting editor content.
 */

/**
 * One ordinary-post destination, with no credentials or UI controls.
 * @typedef {Object} CListPublishingDestination
 * @property {string} key
 * @property {string} destination Display title or service name.
 * @property {string} service
 * @property {'pending'|'publishing'|'published'|'failed'|'skipped'|'unconfirmed'} status
 * @property {string[]} warnings
 * @property {string} [url]
 * @property {string} [error]
 * @property {CListAnnotationReceipt[]} [targetResults]
 * @property {CListPublisherProgress} [progress]
 */

/**
 * @typedef {{stage: string, completed?: number, total?: number}} CListPublisherProgress
 */

/**
 * @typedef {{type: 'started', destinations: CListPublishingDestination[]} |
 * {type: 'destination', result: CListPublishingDestination} |
 * {type: 'target-result', key: string, destination: string, receipt: CListAnnotationReceipt} |
 * {type: 'warning', key: string, destination: string, message: string} |
 * {type: 'progress', key: string, destination: string, progress: CListPublisherProgress}} CListPublishingUpdate
 */

/**
 * Complete means every destination was attempted; inspect individual statuses.
 * @typedef {Object} CListPublishingOutcome
 * @property {string|null} primaryUrl First confirmed publication URL.
 * @property {CListPublishingDestination[]} destinations Ordered results.
 */

/**
 * Safe operation summary stored at CList.state.publishing.operation.
 * @typedef {CListPublishingOutcome & {
 * status: 'capturing'|'publishing'|'complete'|'failed'|'cancelled', error?: string
 * }} CListPublishingOperation
 */

/**
 * Existing publisher registry entry, passed into the ordinary-post workflow.
 * @typedef {Object} CListPostPublisher
 * @property {function(string, string): string} [construct]
 * @property {function(CListAccountData, string, string, CListReference[], CListPublisherOptions): Promise<CListPublisherResult>} publish
 */

/**
 * Optional data notifications; service operations never display them directly.
 * @typedef {Object} CListPublisherOptions
 * @property {string[]} [tags]
 * @property {function():void} [assertCurrent] Optional Mastodon captured-form guard, checked after preparation and before POST; throws when expired.
 * @property {CListAnnotationSession} [annotationSession] Transient; never stored in operation summaries.
 * @property {function(CListAnnotationReceipt): void} [onTargetResult]
 * @property {function(CListPublisherProgress): void} [onProgress]
 * @property {function(string): void} [onWarning]
 */

/**
 * @typedef {{parent: {uri: string, cid: string}, root: {uri: string, cid: string}}} CListBlueskyReply
 */

/**
 * Dependencies of the workflow. The HTML text converter is an output conversion,
 * not a control reader. onUpdate receives detached summaries without credentials.
 * @typedef {Object} CListPublishingDependencies
 * @property {CListAccountRecord[]} accounts
 * @property {Object.<string, CListPostPublisher>} publishers
 * @property {function(CListAccountRecord): (CListAccountData|null)} parseAccount
 * @property {function(string): string} toText
 * @property {CListAnnotationSession} [annotationSession]
 * @property {function(CListPublishingUpdate): void} [onUpdate]
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

/**
 * @typedef {{storeUrl: string, token: string}} CListAnnotationSession
 * Transient credentials; never include in operation summaries or receipts.
 */
/**
 * @typedef {Object} CListAnnotationRequest
 * @property {string} body Captured editor HTML/text, obtained through its API.
 * @property {Array<{url: string, selector?: Object}>} targets Unique valid references.
 * @property {string[]} tags
 * @property {string} visibility
 * @property {string} motivation
 */
/**
 * @typedef {Object} CListAnnotationReceipt
 * @property {string} targetUrl
 * @property {'created'|'failed'|'uncertain'} outcome
 * @property {string|null} annotationId May be opaque; never assume it is a link.
 * @property {string|null} annotationUrl HTTP(S) browser link, if supplied.
 * @property {string} [error]
 */
/**
 * @typedef {Object} CListAnnotationOutcome
 * @property {CListAnnotationReceipt[]} results
 * @property {number} created Confirmed writes, including accepted responses without links.
 * @property {number} failed Explicit failures.
 * @property {number} uncertain Writes that may have reached the server.
 * @property {string|null} url First available annotation link.
 */

/**
 * @typedef {Object} CListAnnotationDependencies
 * @property {function(Object): Promise<Object>} create Explicit service transport.
 * @property {function(): void} [assertSession] Check before each write.
 * @property {function(CListAnnotationReceipt): void} [onTargetResult] Detached data only.
 */


/**
 * Shared by collection Post and To Web Page; account loading follows draft capture.
 * @typedef {Object} CListCollectionPublicationRequest
 * @property {string} name
 * @property {string} formatId
 * @property {CListCollectionIdentity} identity
 * @property {CListCollectionMember[]} items Raw membership snapshot; flatten only for export.
 * @property {CListPublishedCollectionUrl[]} publishedUrls
 * @property {CListWebPageSource|null} page Captured loaded collection publication.
 * @property {Array<{key: string, account: CListAccountData}>} targets Transient accounts; never put in operation summaries.
 * @property {boolean} [republish] Direct update uses the original format and touches metadata only.
 * @property {string|null} overwriteKey Only the matching captured destination, after a choice.
 */
/**
 * @typedef {Object} CListCollectionPublicationOutcome
 * @property {string|null} primaryUrl First full-content destination URL.
 * @property {CListPublishingDestination[]} destinations
 * @property {CListPublishedCollectionUrl[]} publishedUrls
 * @property {boolean} metadataSaved
 * @property {string|null} metadataError External publication is retained if recording fails.
 */
/**
 * @typedef {Object} CListCollectionPublishingDependencies
 * @property {Object.<string, CListPostPublisher>} publishers
 * @property {Object} bins Existing bin adapters; preserve their separate signatures.
 * @property {Object} formats Existing collection serializers.
 * @property {function(CListCollectionMember[], string): Promise<CListCollectionMember[]>} flatten
 * @property {function(): void} assertSession Before each external or metadata write.
 * @property {function(CListCollectionPublicationRequest, CListPublishedCollectionUrl[]): Promise<void>} save
 * @property {function(CListCollectionPublicationRequest): Promise<void>} [touch] Required for direct Republish; preserves saved membership.
 * @property {function(): string} now
 * @property {function(Object): void} [onUpdate] Detached destination/warning/progress data.
 */

/**
 * Collection publication capture can precede encryption-key loading.
 * @typedef {{storeUrl: string, token: string, encKey?: CryptoKey|null}} CListCollectionPublicationSession
 */

/**
 * Retained per-entry result, scoped to the captured public account-store identity.
 * No credentials; a WeakMap keys these receipts by the original member object.
 * @typedef {{owner: string, sourceUrl: string, result: CListWebPageOutcome}} CListLocalEntryReceipt
 */

/**
 * @typedef {Object} CListPublishingPanelOptions
 * @property {string[]} selectedKeys Detached controller selection.
 * @property {boolean} busy
 * @property {function(string): string[]} onToggle Return the updated controller selection.
 * @property {function(): *} onPublish
 * @property {function(): *} onWebPage
 */

/**
 * Native annotation file; publishable editor content remains the HTML body alone.
 * @typedef {Object} CListAnnotationFile
 * @property {'clist-annotation-v1'} format
 * @property {string} body
 * @property {CListReference} target Standalone draft fields are retained even without a URL.
 * @property {CListReference[]} references Convergent targets, with the primary URL first.
 */
/**
 * Optional editor local-file export, separate from publication/native getContent.
 * @typedef {{type: string, value: string}} CListEditorFileContent
 */

/**
 * Safe editor-file loading state. File bodies, page records and callbacks are transient.
 * @typedef {Object} CListEditorLoadState
 * @property {number} id Monotonic operation generation.
 * @property {'recognizing'|'choosing-editor'|'choosing-collection'|'reviewing'|'loading'|'complete'|'cancelled'|'failed'} phase
 * @property {string|null} target Selected editor key, or collection.
 * @property {string|null} error
 */

/**
 * Load source/blank control state. Handler, account and body captures are transient.
 * @typedef {Object} CListEditorControlsState
 * @property {number} id Monotonic panel generation.
 * @property {'sources'|'loading-source'|'routing'|'template'|'blank-choices'|'blank-check'|'blank-review'|'blanking'|'complete'|'cancelled'|'failed'} phase
 * @property {string|null} target Selected blank editor key, if any.
 * @property {string|null} error
 */
/**
 * Display values for the existing loaded-page/publication controls.
 * @typedef {Object} CListLoadedPagePresentation
 * @property {string|undefined} documentTitle
 * @property {string} label
 * @property {string} url
 * @property {boolean} hasPublicationLocation
 * @property {string|null} notice Transient load confirmation, emitted by the controller.
 */

/**
 * In-memory switch state. Credentials and queued/transferred bodies remain transient.
 * @typedef {Object} CListEditorSwitchState
 * @property {number} id Monotonic mount request generation.
 * @property {'idle'|'pending'|'mounting'|'complete'|'failed'} phase
 * @property {string|null} target Editor/account identity key requested.
 * @property {string|null} active Last successfully mounted editor/account identity key.
 * @property {Object.<string, {page: CListWebPageSource|null, references: CListReference[]}>} parked Detached metadata; never editor bodies.
 * @property {string|null} error
 */

/** @typedef {{key:string,did:string}} CListFollowingEntry Exact stored key, separate from displayed decrypted DID. */
/**
 * @typedef {Object} CListFollowingState
 * @property {number} panelId
 * @property {number} requestId
 * @property {'idle'|'loading'|'ready'|'failed'} phase
 * @property {string|null} error
 * @property {number} pendingCount
 */

/** @typedef {CListAnnotationSession & {username:string,local:boolean,mode:string}} CListDidIdentitySession Transient read-only owner capture. */
/** @typedef {{key:string,title:string,type:string,public:boolean}} CListDidPublicAccount Safe account-list projection; never credentials. */
/** @typedef {{requestId:number,phase:('idle'|'loading'|'ready'|'failed'),error:(string|null)}} CListIdentityReadLane */
/** @typedef {{panelId:number,identity:CListIdentityReadLane,accounts:CListIdentityReadLane}} CListIdentityDisplayState */

/** @typedef {{panelId:number,requestId:number,phase:('idle'|'fetching'|'signing'|'verifying'|'complete'|'failed'),error:(string|null)}} CListIdentityProofState Safe UI summary; no keys, signatures or tokens. */

/** @typedef {{panelId:number,phase:('preparing'|'publishing'|'confirmed'|'uncertain'|'failed'),error:(string|null)}} CListIdentityPublicationState Safe summary; no credentials or receipts. */
/** @typedef {{publicKeyJwk:JsonWebKey,didKey:string,service:Object[],alsoKnownAs:string[]}} CListDidPublicationPayload Public identity transport; no private key. */
/** @typedef {{didKey:string,existing:boolean,warning?:string}} CListDidPublicationReceipt Public accepted/reconciled identity information. */

/** @typedef {{id:number,phase:('ready'|'verifying'|'rejected'|'confirmed'|'cancelled'|'expired'|'failed'|'action-failed'),error:(string|null)}} CListPasswordConfirmationState Generic UI summary; never passwords or verifier/session keys. */

/** @typedef {{panelId:number,phase:('preparing'|'generating'|'storing'|'stored'|'uncertain'|'failed'),error:(string|null)}} CListDidGenerationState Safe first-time generation summary. */
/** @typedef {{didKey:string,existing:boolean}} CListDidKeyReceipt Accepted or reconciled stored identity; no key material. */

/** @typedef {{panelId:number,phase:('idle'|'preparing'|'confirming'|'generating'|'storing'|'publishing'|'stored'|'uncertain-storage'|'complete'|'failed'),error:(string|null)}} CListDidRotationState Safe UI summary; no keys/plans. */
/** @typedef {{storedValue:string,doc:(Object|null)}} CListDidRotationSnapshot Transient original ciphertext and parsed public DID, never plaintext keys. */
/** @typedef {{storedValue:string,didKey:string,publicKeyJwk:JsonWebKey}} CListDidRotationPrepared Transient replacement ciphertext and public identity. */

/** @typedef {{panelId:number,phase:('idle'|'preparing'|'confirming'|'removing-key'|'removing-document'|'partial'|'complete'|'failed'),error:(string|null)}} CListDidRemovalState Safe UI summary; no target material. */
/** @typedef {{storedValue:(string|null),documentIdentity:(string|null),keyRemoved:boolean,documentRemoved:boolean}} CListDidRemovalPlan Transient ciphertext/public fingerprint plus accepted/absence receipts. */

/** @typedef {{panelId:number,revision:number,selected:Object.<string,boolean>}} CListDidIdentitySelection Safe public checkbox state, no source records. */
/** @typedef {{panelId:number,revision:number,items:Array<{key:string,public:boolean,sourceValue:string}>}} CListDidAccountSelectionSnapshot Transient source ciphertext binding, never persisted or placed in UI state. */
/** @typedef {{panelId:number,phase:('saving'|'checking'|'publishing'|'partial'|'complete'|'failed'),error:(string|null)}} CListDidAccountUpdateState Safe operation summary. */

/** @typedef {{url:string,username:string,password:string,register:boolean}} CListMigrationInput Transient captured form values; password cleared after preparation. */
/** @typedef {{source:string,destination:string,username:string,local:boolean,accountCount:number,systemCount:number,hasDid:boolean,conflictCount:number,didConflict:boolean}} CListMigrationPreview Public labels/counts only. */
/** @typedef {{panelId:number,phase:('idle'|'preparing'|'ready'|'checking'|'executing'|'failed'|'finished'),message:string,preview:(CListMigrationPreview|null),overwrite:boolean,registration:('created'|'uncertain'|'rejected'|null)}} CListMigrationPreparationState Safe UI projection, no secrets or record bodies. */
/**
 * Private prepared execution handoff. Never persist or place in UI state.
 * Record values/fingerprints are encrypted; keys/tokens remain transient.
 * @typedef {Object} CListMigrationPlan
 * @property {string} oldUrl
 * @property {string} oldUsername
 * @property {string} oldToken
 * @property {CryptoKey} oldEncKey
 * @property {string} newUrl
 * @property {string} newUsername
 * @property {string} newToken
 * @property {CryptoKey} newEncKey
 * @property {CListEncryptedKVRecord[]} kvs
 * @property {boolean} hasDid
 * @property {number} accountCount Non-system record count, not a claim that each is a social account.
 * @property {number} conflictCount
 * @property {boolean} didConflict
 * @property {string} sourceFingerprint Sorted key/ciphertext snapshot, not a cryptographic digest.
 * @property {string} destinationFingerprint Sorted key/ciphertext snapshot.
 */

/** @typedef {{key:string,sourceValue:string,before:(string|null),value:(string|null),status:('ready'|'uncertain'|'accepted')}} CListMigrationCopyStep Private ciphertexts and copy receipt; no plaintext. */
/** @typedef {{name:string,session:CListDidIdentitySession,before:string,payload:CListDidPublicationPayload,status:('ready'|'uncertain'|'accepted')}} CListMigrationIdentityStep Private captured target, public metadata fingerprint/payload and receipt. */
/**
 * Private tab/session-lifetime execution and recovery. Destination credentials/keys cleared on completion.
 * @typedef {Object} CListMigrationExecutionPlan
 * @property {CListMigrationPlan|null} plan
 * @property {CListDidIdentitySession} session
 * @property {CListMigrationCopyStep[]} rows
 * @property {CListMigrationIdentityStep[]} identities
 * @property {Map<string,string>} expected Expected destination ciphertexts after accepted copies.
 * @property {boolean} prepared
 * @property {boolean} pending
 * @property {boolean} complete
 * @property {boolean} checkRequired
 * @property {number} total
 * @property {string} destination
 * @property {string|null} [error]
 * @property {number} [copied] Final safe count after clearing private steps.
 * @property {number} [identityCount]
 * @property {number} [identityTotal]
 */
/** @typedef {{panelId:number,pending:boolean,complete:boolean,checkRequired:boolean,copied:number,total:number,identities:number,identityTotal:number,destination:string,error:(string|null)}} CListMigrationExecutionState Public progress only; never credentials, ciphertext or private plans. */

/** @typedef {{generation:number,mode:('login'|'register'),panel:('closed'|'main'|'server'),busy:boolean,error:(string|null),registration:('created'|'uncertain'|'rejected'|null),serverUrl:string,draftServer:(string|null)}} CListAuthPanelState Public form/navigation state only; no passwords or session material. */
/** @typedef {{mode:('login'|'register'),username:string,password:string}} CListAuthInput Private captured form submission; password cleared on settlement. */
/** @typedef {{owner:number,generation:number,epoch:number,serverUrl:string,input:CListAuthInput,authenticated:boolean}} CListAuthAttempt Private dispatch capture, never persisted or placed in UI state. */

/** @typedef {{serverUrl:string,local:boolean,epoch:number,keys:Object.<string,string>,sourceToken:(string|null),source:string,snapshot:function():string,adapter:(Object|undefined)}} CListAuthCredentialTarget Private captured transport/storage target and source-session version; never UI state. */
/** @typedef {{username:string,authHash:string,encKey:(CryptoKey|null)}} CListPreparedAuthCredentials Transient derived values; never persisted together or rendered. */
/** @typedef {{token:string,username:string,expires:string}} CListVerifiedAuthSession Private verified response with future ISO/parseable expiry; never UI state. */

/** @typedef {{key:string,label:string,data:CListAccountData,registerUrl?:string}} CListPostLoginDescriptor Captured default account and optional service registration endpoint. */
/** @typedef {CListPostLoginDescriptor & {registration:('ready'|'uncertain'|'accepted'),record:('ready'|'uncertain'|'accepted'|'existing'),ciphertext:(string|null),error:(string|null)}} CListPostLoginStep Private per-service registration and encrypted-account receipts. */
/** @typedef {Omit<CListAccountSession,'encKey'> & {encKey:(CryptoKey|null)}} CListPostLoginSession Private session while its key is being loaded. */
/** @typedef {{session:CListPostLoginSession,steps:CListPostLoginStep[],discover:boolean,discovered:boolean,discoveryError:(string|null)}} CListPostLoginPlan Private captured setup, never presentation state or persistent storage. */
/** @typedef {{operationId:number,pending:boolean,done:number,total:number,errors:string[],uncertainServices:Array<{key:string,label:string}>}} CListPostLoginState Safe counts/feedback/action labels; no accounts, keys, tokens or ciphertext. */

/** @typedef {{serverUrl:string,local:boolean,epoch:number,username:(string|null),token:(string|null),expires:(string|null),key:(string|null)}} CListSessionSnapshot Private cookie/tab-key capture; never presentation state. */
/** @typedef {{generation:number,phase:('restoring'|'guest'|'ready'|'logging-out'|'logged-out'|'failed'),error:(string|null)}} CListSessionLifecycleState Safe lifetime/feedback only. */

/** @typedef {{label:string,baseUrl:string,description?:string,requiresKvstoreUrlHeader?:boolean}} CListAdminApp Captured public metadata, never credentials. */
/** @typedef {{key:string,label:string,type:string,sensitive:boolean,help:string}} CListAdminField Normalized schema field. */
/** @typedef {{schema:CListAdminField[],values:Object.<string,string>}} CListAdminSettingsData Private normalized values, including sensitive/masked fields. */
/** @typedef {{storeUrl:string,token:(string|null),username:(string|null),epoch:number,local:boolean}} CListAdminSession Private source-session capture. */
/** @typedef {{owner:number,payload:Object.<string,string>,versions:Map<string,number>,schema:CListAdminField[],pending:boolean,accepted:boolean,reviewed:boolean,uncertain?:boolean,rejected?:boolean}} CListAdminWrite Private PUT and receipt; never UI state or persistent storage. */
/** @typedef {{panelId:number,app:string,phase:('loading'|'failed'|'saving'|'check-required'|'ready'|'editing'),error:(string|null),dirtyCount:number,busy:boolean}} CListAdminSettingsState Safe progress/counts only; no field values, drafts or tokens. */
