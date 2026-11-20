/// <reference path="./reader-types.js" />
window.CList.readers.duckduckgo = {
    label:'DuckDuckGo',logoSrc:'assets/icons/duckduckgo.svg',requiresLogin:false,requiresAccount:false,
    supportsFindContext:true,statusActions:()=>'',bindRow:(item,row,context)=>bindSearchProviderRow(item,row,context),
    search:(query,context)=>duckduckgoSearch(query,context),
};
async function requestDuckduckgoSearch(query,{fetch,signal}) {
    const url = new URL('https://api.duckduckgo.com/');
    url.search = new URLSearchParams({q:query,t:'h_',format:'json'});
    const response = await fetch(url.toString(),{signal});
    if (!response.ok) throw new Error(`DuckDuckGo returned HTTP ${response.status}.`);
    return response.json();
}
function duckduckgoSearchItems(data) {
    if (data.Abstract) return [{url:data.AbstractURL,title:data.Heading || 'No heading found',desc:data.Abstract,fullText:data.AbstractText}];
    const result = [];
    const visit = topics => { for (const topic of topics || []) {
        if (Array.isArray(topic.Topics)) visit(topic.Topics);
        else if (topic.FirstURL) {
            const parsed = getDDGTitleAndDescription(topic.FirstURL,topic.Result,topic.Text);
            result.push({url:topic.FirstURL,title:parsed.title,desc:parsed.description,fullText:topic.AbstractText});
        }
    }};
    visit(data.RelatedTopics); return result;
}
function normalizeDuckduckgoItem(item,source) {
    return {service:'duckduckgo',url:item.url,title:item.title,desc:item.desc,feed:source,date:new Date().toISOString(),
        full_content:item.fullText ? new SafeHtml(escapeHtml(item.fullText)) : null};
}
/** @param {CListFindContext} context */
async function duckduckgoSearch(query,context) {
    if (!context?.isCurrent()) return;
    try {
        const data = await requestDuckduckgoSearch(query,{fetch,signal:context.signal});
        if (!context.isCurrent()) return;
        const items = duckduckgoSearchItems(data);
        if (!items.length) { context.empty('DuckDuckGo: '+query); return; }
        await context.render(items,{title:data.Heading || 'DuckDuckGo: '+query,
            normalize:item=>normalizeDuckduckgoItem(item,data.AbstractSource)});
    } catch (error) { context.fail('DuckDuckGo search error',error); }
}
// HTML parsing is isolated from transport; no insertion of remote Result markup.
function getDDGTitleAndDescription(url,html,text='') {
    const doc = new DOMParser().parseFromString(html || '', 'text/html'), link = doc.querySelector('a');
    if (!link) return {title:text || url,description:text || ''};
    const title = link.textContent.trim(), all = doc.body.textContent.trim();
    return {title,description:all.startsWith(title)?all.slice(title.length).trim():all};
}
