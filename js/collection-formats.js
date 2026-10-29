// collection-formats.js — Format interpreters for collection import/export
// Part of CList, the next generation of learning and connecting with your community
//
// Pure parse/serialize functions — no kvstore, token, or app-DOM dependencies.
// Depends on: utilities.js (escapeHtml)
// Used by: collections.js, collection-editor.js
//
// Version version 0.1 created by Stephen Downes
//
// Copyright Stephen Downes 2025
// Licensed under Creative Commons Attribution 4.0 International https://creativecommons.org/licenses/by/4.0/
//
// This software carries NO WARRANTY OF ANY KIND.
// This software is provided "AS IS," and you, its user, assume all risks when using it.

// Returns a human-readable display title for a collection item.
// Social platform items (Mastodon, Bluesky) show "Platform (@handle)" instead
// of the bare service name stored in item.title.
function _collectionItemDisplayTitle(item) {
    const isSocial = item.service === 'Mastodon' || item.service === 'Bluesky'
                  || item.title   === 'Mastodon' || item.title   === 'Bluesky';
    if (!isSocial) return item.title || item.url || '';
    const platform = item.title || item.service || 'Social';
    if (item.author_id)   return `${platform} (@${item.author_id})`;
    if (item.author_name) return `${platform} (${item.author_name})`;
    return platform;
}

// Format registry — add an entry here to expose a new output format in the collection editor.
// Each entry: { label, ext, mimeType, serialize(name, items, id) → string }
// `id` is the collection's own urn:uuid identity (see docs/identification-model-v1.01.md) —
// embedded per format using the most standard mechanism each one supports, so a page keeps
// its identity when read back without CList's own kvstore record (see _collectionFormatParsers
// below for the matching read side). Falsy id → identity field/element is simply omitted.
const collectionFormats = {
    rss: {
        label: 'RSS', ext: 'xml', mimeType: 'application/rss+xml',
        serialize(name, items, id) {
            const safe = items.filter(i => i.url);
            const itemsXml = safe.map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const l = escapeHtml(item.url);
                const d = item.summary    ? `\n    <description>${escapeHtml(item.summary)}</description>`       : '';
                const a = item.author_name ? `\n    <author>${escapeHtml(item.author_name)}</author>`            : '';
                return `  <item>\n    <title>${t}</title>\n    <link>${l}</link>${d}${a}\n  </item>`;
            }).join('\n');
            // Dublin Core RSS extension — dc:identifier is the standard way to carry a
            // persistent identifier on an RSS channel.
            const idXml = id ? `\n    <dc:identifier>${escapeHtml(id)}</dc:identifier>` : '';
            return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n    <title>${escapeHtml(name)}</title>\n    <link></link>\n    <description>${escapeHtml(name)}</description>${idXml}\n${itemsXml}\n  </channel>\n</rss>`;
        },
    },
    opml: {
        label: 'OPML', ext: 'opml', mimeType: 'text/x-opml',
        serialize(name, items, id) {
            const safe = items.filter(i => i.url);
            const outlines = safe.map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const u = escapeHtml(item.url);
                return `    <outline text="${t}" type="rss" xmlUrl="${u}" htmlUrl="${u}"/>`;
            }).join('\n');
            // OPML 2.0 has no native document-identity field. <id> is a documented
            // CList-specific extension inside <head> — unknown elements are ignored by
            // conforming OPML parsers, so this is safe to add.
            const idXml = id ? `\n    <id>${escapeHtml(id)}</id>` : '';
            return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head>\n    <title>${escapeHtml(name)}</title>\n    <dateCreated>${new Date().toUTCString()}</dateCreated>${idXml}\n  </head>\n  <body>\n${outlines}\n  </body>\n</opml>`;
        },
    },
    json: {
        label: 'JSON', ext: 'json', mimeType: 'application/json',
        serialize(name, items, id) {
            return JSON.stringify({
                ...(id ? { id } : {}),
                title: name,
                publishedAt: new Date().toISOString(),
                items: items.filter(i => i.url).map(item => ({
                    title:      _collectionItemDisplayTitle(item) || '',
                    url:        item.url,
                    author:     item.author_name || '',
                    summary:    item.summary     || '',
                    created_at: item.created_at  || '',
                })),
            }, null, 2);
        },
    },
    html: {
        label: 'HTML', ext: 'html', mimeType: 'text/html',
        serialize(name, items, id) {
            const rows = items.filter(i => i.url).map(item => {
                const t = escapeHtml(_collectionItemDisplayTitle(item) || item.url);
                const u = escapeHtml(item.url);
                const a = item.author_name ? ` — ${escapeHtml(item.author_name)}` : '';
                return `  <li><a href="${u}">${t}</a>${a}</li>`;
            }).join('\n');
            // Dublin Core meta + link rel="identifier" — the convention EPUB/Portable
            // Web Publications use for a document's own persistent identifier.
            const idHtml = id
                ? `\n  <meta name="dcterms.identifier" content="${escapeHtml(id)}">\n  <link rel="identifier" href="${escapeHtml(id)}">`
                : '';
            return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${escapeHtml(name)}</title>${idHtml}\n</head>\n<body>\n<h1>${escapeHtml(name)}</h1>\n<ul>\n${rows}\n</ul>\n</body>\n</html>`;
        },
    },
    md: {
        label: 'Markdown', ext: 'md', mimeType: 'text/markdown',
        serialize(name, items, id) {
            const lines = items.filter(i => i.url).map(item => {
                const t = _collectionItemDisplayTitle(item) || item.url;
                const a = item.author_name ? ` — ${item.author_name}` : '';
                return `- [${t}](${item.url})${a}`;
            });
            // YAML front matter — the de facto standard for Markdown document metadata
            // (Jekyll/Hugo/etc.).
            const front = id ? `---\nid: ${id}\ntitle: ${name}\n---\n\n` : '';
            return `${front}# ${name}\n\n${lines.join('\n')}\n`;
        },
    },
    text: {
        label: 'Text', ext: 'txt', mimeType: 'text/plain',
        serialize(name, items, id) {
            const lines = items.filter(i => i.url).map(item => {
                const t = _collectionItemDisplayTitle(item) || item.url;
                const a = item.author_name ? ` (${item.author_name})` : '';
                return `${t}${a}\n${item.url}`;
            });
            // Plain text has no metadata standard at all — this leading line is an
            // acknowledged CList-specific convention, not a real standard.
            const idLine = id ? `ID: ${id}\n\n` : '';
            return `${idLine}${name}\n${'='.repeat(name.length || 10)}\n\n${lines.join('\n\n')}\n`;
        },
    },
};

// Only a well-formed urn:uuid identifier is trusted as an identity — anything else
// (missing, malformed, someone else's unrelated scheme) is ignored and a fresh
// identity is minted instead, same as a page with no id at all.
const _URN_UUID_RE = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function _validUrnUuid(value) {
    return typeof value === 'string' && _URN_UUID_RE.test(value) ? value : undefined;
}

function _parseCollectionJSON(text) {
    const data  = JSON.parse(text);
    const items = (data.items || [])
        .map(i => ({ title: i.title || i.url || '', url: i.url || '', author_name: i.author || '', summary: i.summary || '' }))
        .filter(i => i.url);
    return { title: data.title || 'Imported collection', items, id: _validUrnUuid(data.id) };
}

function _parseCollectionOPML(text) {
    const doc      = new DOMParser().parseFromString(text, 'text/xml');
    const titleEl  = doc.querySelector('head > title');
    const title    = titleEl?.textContent?.trim() || 'Imported collection';
    const id       = _validUrnUuid(doc.querySelector('head > id')?.textContent?.trim());
    const items    = [...doc.querySelectorAll('body > outline')]
        .map(o => ({
            title: o.getAttribute('text') || o.getAttribute('title') || '',
            url:   o.getAttribute('xmlUrl') || o.getAttribute('htmlUrl') || '',
        }))
        .filter(i => i.url);
    return { title, items, id };
}

function _parseCollectionHTML(text) {
    const doc   = new DOMParser().parseFromString(text, 'text/html');
    const title = doc.querySelector('h1')?.textContent?.trim()
               || doc.querySelector('title')?.textContent?.trim()
               || 'Imported collection';
    const id    = _validUrnUuid(doc.querySelector('link[rel="identifier"]')?.getAttribute('href')?.trim())
               || _validUrnUuid(doc.querySelector('meta[name="dcterms.identifier"]')?.getAttribute('content')?.trim());
    const items = [...doc.querySelectorAll('ul li a')]
        .map(a => ({ title: a.textContent.trim(), url: a.href }))
        .filter(i => i.url && !i.url.startsWith('javascript'));
    return { title, items, id };
}

function _parseCollectionRSS(text) {
    const doc   = new DOMParser().parseFromString(text, 'text/xml');
    const titleEl = doc.querySelector('channel > title, feed > title');
    const title   = titleEl?.textContent?.trim() || 'Imported feed';
    const id      = _validUrnUuid(
        doc.querySelector('channel > dc\\:identifier, feed > dc\\:identifier')?.textContent?.trim()
    );
    const rssItems  = [...doc.querySelectorAll('item')].map(item => ({
        title:       item.querySelector('title')?.textContent?.trim() || '',
        url:         item.querySelector('link')?.textContent?.trim() || '',
        author_name: item.querySelector('author')?.textContent?.trim()
                  || item.querySelector('dc\\:creator')?.textContent?.trim() || '',
        summary:     item.querySelector('description')?.textContent?.trim() || '',
    }));
    const atomItems = [...doc.querySelectorAll('entry')].map(entry => ({
        title:       entry.querySelector('title')?.textContent?.trim() || '',
        url:         entry.querySelector('link')?.getAttribute('href') || '',
        author_name: entry.querySelector('author > name')?.textContent?.trim() || '',
        summary:     entry.querySelector('summary, content')?.textContent?.trim() || '',
    }));
    const items = (rssItems.length ? rssItems : atomItems).filter(i => i.url);
    return { title, items, id };
}

// Formats that round-trip back into collection items — used by My Pages' "Load into
// collection editor" action. md/text are export-only (no parser), so they're left out.
const _collectionFormatParsers = {
    rss:  _parseCollectionRSS,
    opml: _parseCollectionOPML,
    json: _parseCollectionJSON,
    html: _parseCollectionHTML,
};

function _detectFormat(contentType, url) {
    if (contentType?.includes('json'))                         return 'json';
    if (contentType?.includes('opml'))                         return 'opml';
    if (contentType?.includes('html'))                         return 'html';
    if (contentType?.includes('rss') || contentType?.includes('atom') || contentType?.includes('xml'))
                                                               return 'rss';
    const lower = (url || '').toLowerCase().split('?')[0];
    if (lower.endsWith('.json'))                               return 'json';
    if (lower.endsWith('.opml'))                               return 'opml';
    if (lower.endsWith('.rss') || lower.endsWith('.atom') || lower.endsWith('.xml')) return 'rss';
    if (lower.endsWith('.html') || lower.endsWith('.htm'))     return 'html';
    if (lower.endsWith('.md') || lower.endsWith('.txt'))       return 'text';
    return 'json'; // default guess
}

// Formats whose identity alone already says "this is a collection" — an RSS or
// OPML file is a feed/outline by definition, even an empty one, so it's always
// classified as a collection. Add future unambiguous formats here as needed.
// HTML/JSON are NOT in this set: both are also used for perfectly ordinary
// non-collection content, so being that format isn't enough — see _collectionShape.
const _unambiguousCollectionFormats = new Set(['rss', 'opml']);

// A format being collection-parseable doesn't mean a given file actually IS a
// collection — an ordinary HTML page or a JSON blob with no `items` in it should
// never be offered a Collection editor just because its format happens to be one
// that CAN carry a list. For those ambiguous formats, only a successful parse
// with at least one item counts. Unambiguous formats (see
// _unambiguousCollectionFormats above) skip that items check — their format
// alone already identifies them as a collection, empty or not.
function _collectionShape(text, format) {
    const parser = _collectionFormatParsers[format];
    if (!parser) return null;
    try {
        const parsed = parser(text);
        if (!parsed) return null;
        if (_unambiguousCollectionFormats.has(format)) return parsed;
        return (parsed.items && parsed.items.length) ? parsed : null;
    } catch (e) {
        console.error('[_collectionShape] parse failed', e);
        return null;
    }
}

// Shared "Collection vs. native format" choice UI, used by every loader that
// might receive collection-shaped content (Dropbox, "From URL", "Load from
// file") so each isn't reimplementing its own detect-and-route logic. Mirrors
// _offerEditorChoice()'s (editors.js) .list-tip/.account-list/.account-button
// styling. `onNative` is supplied by the caller and runs its own pre-existing
// native-format handling unchanged — this only inserts the extra decision point
// ahead of it, for the genuine-collection case.
function _offerCollectionChoice(parsed, format, { renderTarget, onCancel, onNative } = {}) {
    const optionsDiv = renderTarget || window.CList.ui.view.loadOptions;
    if (!optionsDiv) return onNative?.();
    optionsDiv.innerHTML = '';

    const count = parsed.items.length;
    const nativeLabel = format === 'html' ? 'HTML' : (format === 'json' ? 'JSON' : 'plain text');
    const tip = document.createElement('p');
    tip.className = 'list-tip';
    tip.textContent = `"${parsed.title || 'Untitled'}" contains ${count} item${count === 1 ? '' : 's'} — open as a collection, or as ${nativeLabel}?`;
    optionsDiv.appendChild(tip);

    const list = document.createElement('div');
    list.className = 'account-list';

    function makeButton(icon, label, onClick) {
        const btn = document.createElement('button');
        btn.className = 'account-button';
        const iconEl = document.createElement('span');
        iconEl.className = 'material-icons';
        iconEl.textContent = icon;
        const labelEl = document.createElement('span');
        labelEl.textContent = label;
        btn.appendChild(iconEl);
        btn.appendChild(labelEl);
        btn.addEventListener('click', onClick);
        return btn;
    }

    list.appendChild(makeButton('list_alt', 'Open as Collection', async () => {
        document.getElementById('generic-modal')?.remove();
        if (typeof window.openParsedAsCollection === 'function') await window.openParsedAsCollection(parsed);
    }));

    list.appendChild(makeButton(format === 'html' ? 'article' : 'description', `Open as ${nativeLabel}`, async () => {
        document.getElementById('generic-modal')?.remove();
        await onNative?.();
    }));

    optionsDiv.appendChild(list);

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = onCancel || (() => populateLoadOptions());
    optionsDiv.appendChild(cancelBtn);
}
