/// <reference path="./reader-types.js" />
// Google search: captured Find requests; credentials never enter normalized items.
let _googleFindOwner = null;
window.CList.readers.google = {
    label: 'Google', logoSrc: 'assets/icons/google.svg', requiresLogin: true, requiresAccount: true,
    supportsFindContext: true, statusActions: () => '', bindRow: (item,row,context) => bindSearchProviderRow(item,row,context),
    feedFunctions: { Web: () => navigateGoogleSearch(), Images: () => navigateGoogleSearch('image') },
    search: (query,context) => googleSearch(query,undefined,1,context),
};
function captureGoogleSearchAccount() {
    /** @type {{record:CListAccountRecord, account:CListAccountData}|undefined} */
    let selected;
    for (const record of window.CList.accounts || []) {
        const account = parseAccountValue(record);
        if (account && String(account.title || '').includes('Google Search')) selected = {record: {...record}, account: structuredClone(account)};
    }
    if (!selected?.account.id || !selected.account.instance) throw new Error('No Google Search account found. Open Accounts and add its API key and Search Engine ID.');
    return selected;
}
function googleSearchAccountCurrent(capture) {
    return (window.CList.accounts || []).some(record => record.key === capture.record.key && record.value === capture.record.value);
}
/** Explicit transport; no controls, shared state or account lookup.
 * @param {string} query @param {string|undefined} type @param {number} start
 * @param {CListAccountData} account @param {{fetch:Function,signal?:AbortSignal}} dependencies
 */
async function requestGoogleSearch(query,type,start,account,{fetch,signal}) {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.search = new URLSearchParams({key:account.id,cx:account.instance,q:query,start:String(start)});
    if (type) url.searchParams.set('searchType',type);
    const response = await fetch(url.toString(),{signal}), data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error?.message || `Google Search returned HTTP ${response.status}.`);
    return data;
}
function normalizeGoogleSearchItem(raw,type) {
    const tags = raw.pagemap?.metatags?.[0];
    return { ...raw, service:'google', url:raw.link, desc:raw.snippet, content:raw.htmlSnippet,
        feed:tags?.['og:site_name'] || tags?.['twitter:site'] || tags?.['application:name'] || raw.displayLink || '',
        author:extractAuthorFromGoogle(raw),
        ...(type === 'image' ? {images:[{url:raw.link,preview_url:raw.image?.thumbnailLink,description:raw.snippet}]} : {}) };
}
function navigateGoogleSearch(type,owner = _googleFindOwner) {
    if (!owner?.context.isAccountCurrent() || !googleSearchAccountCurrent(owner.capture)) return Promise.resolve();
    if (owner.pending) return Promise.resolve();
    owner.pending = true;
    return owner.context.navigate(next => googleSearch(owner.query,type,1,next,owner.capture)).finally(()=>{owner.pending=false;});
}
/** @param {CListFindContext} context */
async function googleSearch(query,type,start=1,context,capture) {
    if (!context?.isCurrent()) return;
    try {
        if (!capture) {
            await ensureAccountsLoaded(); if (!context.isCurrent()) return;
            capture = captureGoogleSearchAccount();
        }
        const assertAccount = () => { if (!googleSearchAccountCurrent(capture)) throw new Error('The Google Search account changed. Select Google again.'); };
        assertAccount();
        const data = await requestGoogleSearch(query,type,start,capture.account,{fetch,signal:context.signal});
        if (!context.isCurrent()) return; assertAccount();
        const owner = _googleFindOwner = {context,capture,query};
        window.CList.ui.searchProvider.modes(['Web','Images'],type === 'image' ? 'Images':'Web',name=>navigateGoogleSearch(name==='Images'?'image':undefined,owner));
        const items = data.items || [];
        if (!items.length && start === 1) {context.empty('Google Search: '+query);return;}
        const candidate = Number(data.queries?.nextPage?.[0]?.startIndex ?? (items.length === 10 ? start+10 : 0));
        const nextStart = Number.isInteger(candidate) && candidate > start && candidate <= 100 ? candidate : null;
        await context.render(items,{title:start===1?'Google Search: '+query:null,append:start!==1,
            normalize:item=>normalizeGoogleSearchItem(item,type),loadMoreBtnId:'google-load-more',
            onLoadMore:nextStart?()=>context.next(next=>googleSearch(query,type,nextStart,next,capture)):null});
    } catch (error) { context.fail('Google Search error',error); }
}

function extractAuthorFromGoogle(item) {
    if (!item.pagemap) {
      return "";
    }
  
    const { pagemap } = item;
  
    // 1. Check the metatags array
    if (pagemap.metatags && pagemap.metatags.length > 0) {
      for (const tagObject of pagemap.metatags) {

        // LinkedIn profiles
        const tagObject = item.pagemap.metatags[0];
        const firstName = tagObject["profile:first_name"];
        const lastName = tagObject["profile:last_name"];
        if (firstName || lastName) {
          return `${firstName} ${lastName}`;
        }

        // hcard
        if (item.pagemap.hcard && item.pagemap.hcard.length > 0) {
            const fn = item.pagemap.hcard[0].fn; 
            if (fn) {
              return fn;
            }
        }

        // Some possible keys we might look for:
        const potentialKeys = [
          "author",
          "fediverse:creator",
          "twitter:creator",
          "twitter:title",
          "article:author",
          "og:article:author",
          "og:author",
        ];
  
        for (const key of potentialKeys) {
          if (tagObject[key]) {
            return tagObject[key];
          }
        }
      }
    }
  
    // 2. Check if there's a 'person' array with names (schema.org style)
    if (pagemap.person && pagemap.person.length > 0) {
      if (pagemap.person[0].name) {
        return pagemap.person[0].name;
      }
    }
  
    // 3. Add any other fallback logic here, e.g. checking "pagemap.review" or custom fields
  
    return "";
  }

