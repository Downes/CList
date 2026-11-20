/// <reference path="./clist-types.js" />
// My Pages presentation transitions. No DOM, credentials, or storage operations.
/** @returns {CListMyPagesState} */
function createMyPagesState(generation = 0) {
    return { generation, phase: 'loading', sortKey: 'date', sortDir: 'desc', pageSize: 40, pageIndex: 0, busy: null, error: null };
}
function sortMyPages(state, key) {
    if (!['date', 'title', 'format'].includes(key)) return state;
    return { ...state, sortKey: key, sortDir: state.sortKey === key && state.sortDir === 'asc' ? 'desc' : 'asc', pageIndex: 0 };
}
function sliceMyPages(pages, state) {
    const value = page => String(state.sortKey === 'date' ? page.publishedAt || page.savedLocallyAt || ''
        : state.sortKey === 'title' ? page.title || page.url || '' : page.format || '').toLowerCase();
    const sorted = [...pages].sort((a, b) => value(a).localeCompare(value(b)) * (state.sortDir === 'desc' ? -1 : 1));
    const size = state.pageSize === 'All' ? sorted.length || 1 : state.pageSize;
    const maxIndex = Math.max(0, Math.ceil(sorted.length / size) - 1);
    const pageIndex = Math.max(0, Math.min(state.pageIndex, maxIndex));
    const start = pageIndex * size, end = Math.min(start + size, sorted.length);
    return { rows: sorted.slice(start, end), total: sorted.length, start, end, pageIndex, maxIndex };
}
