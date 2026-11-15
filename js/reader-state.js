/// <reference path="./reader-types.js" />
// Copyright Stephen Downes 2026. CC BY 4.0; provided AS IS, without warranty.

// Plain-data transitions; credentials, service sessions and DOM stay outside state.
/** @returns {CListReaderState} */
function createReaderState() {
    return { requestId: 0, mode: 'idle', accountKey: null, accountType: null,
        feedName: null, status: 'idle', error: null };
}
/** @param {CListReaderState} state
 * @returns {CListReaderState} */
function beginReaderRequest(state, accountKey, accountType, feedName) {
    return { requestId: state.requestId + 1, mode: 'account', accountKey, accountType,
        feedName, status: 'loading', error: null };
}
function finishReaderRequest(state, requestId, error = null) {
    if (state.requestId !== requestId) return state;
    return { ...state, status: error !== null ? 'failed' : 'ready', error };
}
function resetReaderState(state, mode = 'idle') {
    return { ...createReaderState(), requestId: state.requestId + 1, mode };
}
