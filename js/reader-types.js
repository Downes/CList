/// <reference path="./clist-types.js" />
// Reader contracts; comments only, no runtime script tag required.
/**
 * Safe UI/controller state. Keep accounts, tokens and service sessions outside it.
 * @typedef {Object} CListReaderState
 * @property {number} requestId Monotonic request/invalidation generation.
 * @property {'idle'|'account'|'public'|'annotations'|'collections'|'external'|'find'} mode
 * @property {string|null} accountKey
 * @property {string|null} accountType
 * @property {string|null} feedName Refresh retains the logical selected feed.
 * @property {'idle'|'loading'|'ready'|'failed'} status
 * @property {string|null} error
 */
/**
 * Transient reader operation context, optional second initialize argument.
 * Context-aware feed functions receive it when supportsRequestContext is true.
 * @typedef {Object} CListReaderContext
 * @property {number} requestId
 * @property {string} accountKey
 * @property {function(function(CListReaderContext): Promise<void>): Promise<void|undefined>} next Start a guarded continuation, e.g. pagination.
 * @property {function(CListAccountRecord): void} updateAccount Reconcile an owned metadata-only account update.
 * @property {CListAccountData} account Detached selected account, including credentials.
 * @property {string|null} feedName
 * @property {AbortSignal} signal Services may pass it to fetch; cancellation is cooperative.
 * @property {function(): boolean} isAccountCurrent Checks selected account/session independently of pagination.
 * @property {function(): boolean} isCurrent Checks generation, account record and session.
 * @property {function(function(): void): void} commit Synchronous guarded UI commit.
 * @property {function(Array, Object=): Promise<void>} render Shared feed renderer with a current-request guard.
 */

/**
 * @typedef {Object} CListLocalrssRequest
 * @property {CListAccountData} account Detached account with resolved endpoint.
 * @property {'items'|'feeds'|'stats'} kind
 * @property {string} filter
 * @property {number} offset
 * @property {number} limit
 * @property {CListLocalrssSelection} [selection]
 */

/** @typedef {{items: Object[], offset: number, hasMore: boolean}} CListLocalrssPage */
/** @typedef {{mode: 'search', query: string}|{mode: 'feed', feedId: number|string, title: string}} CListLocalrssSelection */

/**
 * Plain Find state; credentials, provider objects and feed elements are transient.
 * @typedef {Object} CListFindState
 * @property {number} panelId
 * @property {number} requestId
 * @property {string} query Current input draft.
 * @property {string|null} providerKey
 * @property {string|null} requestQuery Captured query, independent of later typing.
 * @property {'idle'|'loading'|'ready'|'failed'|'cancelled'} status
 * @property {string|null} error
 */
/**
 * Opt-in search(query, context) contract for supportsFindContext providers.
 * @typedef {Object} CListFindContext
 * @property {number} requestId
 * @property {string} query Captured query.
 * @property {AbortSignal} signal
 * @property {function():boolean} isCurrent
 * @property {function(Array,Object=):Promise<void>} render Guarded shared feed renderer.
 * @property {function(string):void} empty Literal first-page empty feedback.
 * @property {function(string,*):void} fail Owned provider failure.
 * @property {function(function(CListFindContext):Promise<void>):Promise<void>} next Guarded pagination and explicit failed-page retry.
 */
/** @typedef {{kind: 'items'|'feeds', filter: string, offset: number, selection?: CListLocalrssSelection}} CListLocalrssReadState */

/** @typedef {{account: CListAccountData, entryId: (number|string), action: ('read'|'bookmark')}} CListLocalrssToggleRequest */
