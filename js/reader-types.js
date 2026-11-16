/// <reference path="./clist-types.js" />
// Reader contracts; comments only, no runtime script tag required.
/**
 * Safe UI/controller state. Keep accounts, tokens and service sessions outside it.
 * @typedef {Object} CListReaderState
 * @property {number} requestId Monotonic request/invalidation generation.
 * @property {'idle'|'account'|'public'|'annotations'|'collections'|'external'} mode
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
 */

/** @typedef {{items: Object[], offset: number, hasMore: boolean}} CListLocalrssPage */
/** @typedef {{kind: 'items'|'feeds', filter: string, offset: number}} CListLocalrssReadState */

/** @typedef {{account: CListAccountData, entryId: (number|string), action: ('read'|'bookmark')}} CListLocalrssToggleRequest */
