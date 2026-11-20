/// <reference path="./reader-types.js" />
window.CList.readers.oasis = {
    label:'OASIS OERs',icon:'school',requiresLogin:false,requiresAccount:false,
    supportsFindContext:true,statusActions:()=>'',bindRow:(item,row,context)=>bindSearchProviderRow(item,row,context),
    search:(query,context)=>oasisSearch(query,0,context),
};
/** Explicit transport; proxy credentials are supplied by the captured controller. */
async function requestOasisSearch(query,start,{fetch,signal,headers}) {
    const url = new URL('http://oasis.geneseo.edu/basic_search.php'); url.searchParams.set('search_query',query);
    if (start) url.searchParams.set('start',String(start));
    const response = await fetch('https://proxyp.mooc.ca',{method:'POST',signal,
        headers:{'Content-Type':'application/x-www-form-urlencoded',...headers},body:new URLSearchParams({url:url.toString()})});
    if (!response.ok) throw new Error(`OASIS returned HTTP ${response.status}.`);
    return response.text();
}
function normalizeOasisItem(item) {
    return {...item,service:'oasis',desc:`${item.itemType} ${item.description}`,content:`${item.itemType} ${item.description}`,feed:item.source};
}
/** @param {CListFindContext} context */
async function oasisSearch(query,start=0,context) {
    if (!context?.isCurrent()) return;
    try {
        const headers = {...kvstoreAuthHeader()};
        const html = await requestOasisSearch(query,start,{fetch,signal:context.signal,headers});
        if (!context.isCurrent()) return;
        const items = parseOasisHtml(html);
        if (!items.length && !start) {context.empty('OASIS Search: '+query);return;}
        await context.render(items,{title:start?null:'OASIS Search: '+query,append:!!start,normalize:normalizeOasisItem});
    } catch (error) { context.fail('OASIS search error',error); }
}

function parseOasisHtml(htmlString) {
    // 1) Parse the HTML string into a Document

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
  
    // 2) Select all "cards" (each search result) by their CSS class
    const results = doc.querySelectorAll('.row.sources.results');
    
    const items = [];
  
    results.forEach((resultEl) => {
      const item = {};
  
      // TITLE + URL
      // The anchor under <b><a rel="external" href="...">Some Title</a></b>
      const titleAnchor = resultEl.querySelector('b > a[rel="external"]');
      if (titleAnchor) {
        item.title = titleAnchor.textContent.trim();
        item.url   = titleAnchor.getAttribute('href');
      } else {
        item.title = '';
        item.url   = '';
      }
  
      // AUTHOR
      // Author line often looks like: <b>Author</b>: Name<br/>
      // We can match it with a small regex on the entire element's HTML:
      const authorMatch = resultEl.innerHTML.match(/<b>Author<\/b>:\s?(.*?)<br\s*\/?>/i);
      item.author = authorMatch ? authorMatch[1].trim() : '';
  
      // SOURCE
      // Source line looks like: <b>Source</b>: <a ...>OAPEN</a>
      const sourceMatch = resultEl.innerHTML.match(/<b>Source<\/b>:\s?<a.*?>(.*?)<\/a>/);
      item.source = sourceMatch ? sourceMatch[1].trim() : '';
  
      // TYPE
      // Type line looks like: <b>Type</b>: Open Access Book<br>
      const typeMatch = resultEl.innerHTML.match(/<b>Type<\/b>:\s?(.*?)<br/);
      item.itemType = typeMatch ? typeMatch[1].replace(/<.*?>/g, '').trim() : ''; 
      // (Replace any stray HTML tags.)
  
      // DESCRIPTION
      // Descriptions usually appear inside the associated "Detailed Item View" modal (class="modal-body").
      // We'll look for the modal tied to this row (it's usually right next to it).
      // But to simplify, we can also just do a regex on resultEl's HTML (if it includes the modal):
      const descMatch = resultEl.innerHTML.match(/<strong>Description<br><\/strong>(.*?)<\/div>/);
      item.description = descMatch
        ? descMatch[1].replace(/<br\s*\/?>/g, '\n').trim()
        : '';
  
      items.push(item);
    });
  
    return items;
  }
  
