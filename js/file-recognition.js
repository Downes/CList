/// <reference path="./clist-types.js" />
// Content recognition only. Filename and MIME claims never override a recognized shape.
// Collection parsing remains in collection-formats.js; this module performs no UI writes.
function recognizeSavedContent(content, mimeType = '', filename = '') {
    const decoded = _recognitionDecode(content);
    if (decoded.binary) return { type: decoded.type, value: decoded.bytes };
    const text = decoded.text;
    const trimmed = text.replace(/^\uFEFF/, '').trimStart();
    const json = _recognitionJSON(trimmed);
    if (json !== undefined) {
        const native = _recognitionNativeJSON(json, text);
        if (native) return { ...native, sourceText: text };
        if (_recognitionCollectionJSON(json)) {
            const wrapped = Array.isArray(json)
                ? { title: 'Imported collection', items: json }
                : { ...json, title: json.title || json.name || 'Imported collection' };
            const parsed = _recognitionCollection(JSON.stringify(wrapped), 'json');
            // Old JSON exports can legitimately have an empty items list.
            const collection = parsed || (wrapped.items.length === 0 ? {
                title: wrapped.title || wrapped.name || 'Imported collection', items: [],
                id: typeof _validUrnUuid === 'function' ? _validUrnUuid(wrapped.id) : undefined,
            } : null);
            if (collection) return { sourceText: text, type: 'application/json', value: text, collection, format: 'json',
                ...(json.format === 'clist-collection-v1' ? { explicitCollection: true } : {}) };
        }
        return { type: 'text/plain', value: text };
    }

    const markedCollection = _recognitionMarkedCollectionText(text);
    if (markedCollection) return { ...markedCollection, sourceText: text };

    if (trimmed.startsWith('<') && typeof DOMParser !== 'undefined') {
        const xml = new DOMParser().parseFromString(trimmed, 'application/xml');
        const validXML = !!xml.documentElement && !xml.querySelector('parsererror');
        if (validXML) {
            const root = xml.documentElement;
            const name = root.localName.toLowerCase();
            const children = [...root.children].map(child => child.localName.toLowerCase());
            let format;
            if (name === 'rss' && children.includes('channel')) format = 'rss';
            else if (name === 'feed' && (!root.namespaceURI || root.namespaceURI === 'http://www.w3.org/2005/Atom')
                && (children.includes('title') || children.includes('entry'))) format = 'rss';
            else if (name === 'opml' && children.includes('body')) format = 'opml';
            if (format) {
                const collection = _recognitionCollection(text, format);
                if (collection) return { sourceText: text, type: format === 'opml' ? 'text/x-opml' : 'application/rss+xml', value: text, collection, format };
            }
            // XML is not automatically RSS. Preserve unknown XML verbatim in Text.
            if (!['html', 'div', 'article', 'section', 'p', 'ul', 'ol', 'table', 'blockquote', 'pre'].includes(name)
                && !/^h[1-6]$/.test(name) && !_recognitionAnnotationMarkup(trimmed)) return { type: 'text/plain', value: text };
        }
        if (_recognitionLooksHTML(trimmed)) return _recognitionHTML(text);
    }
    return { type: 'text/plain', value: text };
}

function _recognitionJSON(text) {
    if (!/^[\[{]/.test(text)) return undefined;
    try { return JSON.parse(text); }
    catch { return undefined; } // Unrecognized or malformed text must remain editable, not become an object.
}
function _recognitionObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function _recognitionReferences(value) {
    return Array.isArray(value) && value.every(_recognitionObject) ? value : [];
}
function _recognitionEditor(value) {
    return ['texteditor', 'tinymce', 'annotate-edit'].includes(value) ? value : undefined;
}
function _recognitionNativeJSON(data, original) {
    if (!_recognitionObject(data)) return null;
    if (data.format === 'clist-slides-yjs-v1' || data.format === 'clist-slide-layout-v1') {
        if (typeof data.update !== 'string') throw new Error('Invalid CList slides file: missing document update.');
        if (data.format === 'clist-slide-layout-v1' && (typeof data.id !== 'string' || typeof data.label !== 'string')) {
            throw new Error('Invalid CList slide layout.');
        }
        return { type: data.format === 'clist-slide-layout-v1'
            ? 'application/vnd.clist.slide-layout+json' : 'application/vnd.clist.slides+json', value: original.replace(/^\uFEFF/, '') };
    }
    if (data.format === 'clist-annotation-v1') {
        if (typeof data.body !== 'string' || !_recognitionObject(data.target)
            || !Array.isArray(data.references) || !data.references.every(_recognitionObject)) {
            throw new Error('Invalid CList annotation file.');
        }
        return { type: 'application/vnd.clist.annotation+json', value: data,
            editor: 'annotate-edit', page: { references: _recognitionAnnotationReferences(data),
                ...(typeof data.title === 'string' ? { title: data.title } : {}) } };
    }
    if (data.format === 'clist-document-v1') {
        if (!_recognitionObject(data.content) || typeof data.content.value !== 'string'
            || !['text/plain', 'text/html'].includes(data.content.type)) throw new Error('Invalid CList document file.');
        return { type: data.content.type, value: data.content.value, editor: _recognitionEditor(data.editor),
            page: { references: _recognitionReferences(data.references),
                ...(typeof data.title === 'string' ? { title: data.title } : {}) } };
    }
    return null;
}
function _recognitionAnnotationReferences(data) {
    const sources = data.target.url ? [data.target, ...data.references] : data.references;
    const references = [], byUrl = new Map();
    for (const reference of sources) {
        const url = typeof reference.url === 'string' ? reference.url : '';
        if (url && byUrl.has(url)) {
            const index = byUrl.get(url);
            // First occurrence (the annotation target) owns overlapping fields.
            references[index] = { ...reference, ...references[index] };
        } else {
            if (url) byUrl.set(url, references.length);
            references.push({ ...reference });
        }
    }
    return references;
}
function _recognitionCollectionJSON(data) {
    const items = Array.isArray(data) ? data : _recognitionObject(data) ? data.items : null;
    if (!Array.isArray(items) || !items.every(item => _recognitionObject(item) && typeof item.url === 'string')) return false;
    if (Array.isArray(data)) return items.length > 0;
    return typeof data.title === 'string' || typeof data.name === 'string' || data.format === 'clist-collection-v1';
}
function _recognitionCollection(text, format) {
    return typeof _collectionShape === 'function' ? _collectionShape(text, format) : null;
}
function _recognitionLooksHTML(text) {
    const start = text.replace(/^<\?xml[^>]*>\s*/i, '').replace(/^(?:<!--[\s\S]*?-->\s*)+/, '');
    return /^<!doctype\s+html\b/i.test(start) || /^<html(?:\s|>)/i.test(start)
        || /^<(?:div|article|section|p|h[1-6]|ul|ol|table|blockquote|pre)(?:\s|>)/i.test(start)
        || /<[^>]+\bid\s*=\s*["']post-content["']/i.test(start)
        || _recognitionAnnotationMarkup(start);
}
function _recognitionAnnotationMarkup(text) {
    return /\b(?:id\s*=\s*["']clist-annotation["']|data-clist-kind\s*=\s*["']annotation["'])/i.test(text)
        || /\bid\s*=\s*["']annotation-(?:body|description)["']/i.test(text)
            && /\bid\s*=\s*["']annotation-title["']/i.test(text)
            && /\bid\s*=\s*["']annotation-url["']/i.test(text);
}
function _recognitionHTMLAnnotation(doc, sourceText) {
    const root = doc.querySelector('#clist-annotation, [data-clist-kind="annotation"]');
    const container = root || doc;
    const body = container.querySelector('#annotation-body, #annotation-description');
    if (!body || (!root && (!container.querySelector('#annotation-title') || !container.querySelector('#annotation-url')))) return null;
    const target = {};
    const fields = { title: 'title', url: 'url', author: 'author_name', 'author-id': 'author_id',
        feed: 'feed', image: 'image', summary: 'summary', service: 'service' };
    for (const [field, property] of Object.entries(fields)) {
        const element = container.querySelector('#annotation-' + field);
        if (!element) continue;
        const value = field === 'url' && element.localName?.toLowerCase() === 'a'
            ? element.getAttribute('href') || element.textContent
            : typeof element.value === 'string' ? element.value : element.textContent;
        target[property] = (value || '').trim();
    }
    const value = { format: 'clist-annotation-v1', body: body.innerHTML, target,
        references: target.url ? [{ ...target }] : [] };
    return { type: 'application/vnd.clist.annotation+json', value, editor: 'annotate-edit',
        page: { references: value.references, ...(target.title ? { documentTitle: target.title } : {}) }, sourceText };
}
// Recover only the app's legacy quoted-citation pattern, not arbitrary body links.
// A feed name is deliberately not inferred from the URL, author or current feed.
function _recognitionLegacyCitations(post, title) {
    const references = [];
    for (const paragraph of post.querySelectorAll('p')) {
        const text = paragraph.textContent.replace(/\s+/g, ' ').trim();
        const author = text.match(/^(.+?) wrote:\s*["“]/)?.[1]?.trim();
        const anchors = [...paragraph.querySelectorAll('a[href]')];
        const anchor = anchors.at(-1);
        const label = anchor?.textContent.replace(/\s+/g, ' ').trim();
        const url = anchor?.getAttribute('href') || '';
        if (!author || !label || !text.endsWith('[' + label + ']') || !/^https?:\/\//i.test(url)) continue;
        if (!references.some(reference => reference.url === url)) references.push({ title: title || '', url, author_name: author });
    }
    return references;
}

function _recognitionHTML(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const annotation = _recognitionHTMLAnnotation(doc, text);
    if (annotation) return annotation;
    const post = doc.querySelector('#post-content');
    if (post) {
        const marker = doc.querySelector('#clist-file-metadata');
        let metadata = {};
        if (marker?.getAttribute('type')?.toLowerCase() === 'application/json') {
            try {
                const parsed = JSON.parse(marker.textContent);
                if (_recognitionObject(parsed)) metadata = parsed;
            } catch { /* A damaged optional marker must not discard the document body. */ }
        }
        const title = typeof metadata.title === 'string' ? metadata.title
            : doc.querySelector('#post-title')?.textContent?.trim();
        const nativeContent = metadata.format === 'clist-post-v1' && _recognitionObject(metadata.content)
            && ['text/plain', 'text/html'].includes(metadata.content.type) && typeof metadata.content.value === 'string'
            ? metadata.content : null;
        const references = Array.isArray(metadata.references) ? _recognitionReferences(metadata.references)
            : [...doc.querySelectorAll('#post-references a[href]')]
                .filter(link => /^https?:\/\//i.test(link.getAttribute('href') || ''))
                .map(link => ({ url: link.getAttribute('href'), title: link.textContent.trim() }));
        for (const citation of _recognitionLegacyCitations(post, title)) {
            const existing = references.find(reference => reference.url === citation.url);
            if (existing) { if (!existing.author_name) existing.author_name = citation.author_name; }
            else references.push(citation);
        }
        return { type: nativeContent?.type || 'text/html', value: nativeContent?.value ?? post.innerHTML, editor: _recognitionEditor(metadata.editor),
            page: { ...(title ? { documentTitle: title } : {}), references } };

    }
    const marked = doc.querySelector('meta[name="clist.kind"]')?.getAttribute('content') === 'collection';
    const collection = (marked || doc.querySelector('ul li a')) ? _recognitionCollection(text, 'html') : null;
    const empty = marked && doc.querySelector('ul') && !doc.querySelector('ul li')
        ? { title: doc.querySelector('h1')?.textContent?.trim() || doc.querySelector('title')?.textContent?.trim() || 'Imported collection',
            items: [], id: typeof _validUrnUuid === 'function'
                ? _validUrnUuid(doc.querySelector('meta[name="dcterms.identifier"]')?.getAttribute('content')) : undefined } : null;
    if (marked && collection && collection.items.length !== doc.querySelectorAll('ul li').length) {
        return { type: 'text/html', value: text };
    }
    const parsed = collection || empty;
    return { sourceText: text, type: 'text/html', value: text, ...(parsed ? { collection: parsed, format: 'html',
        ...(marked ? { explicitCollection: true } : {}) } : {}) };

}

function _recognitionMarkedCollectionText(text) {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (normalized.startsWith('---\nclist: collection\n')) {
        const front = normalized.match(/^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/);
        if (!front) return null;
        const fields = front[1].split('\n');
        if (!fields.every(line => /^(?:clist: collection|id: .+|title: .*)$/.test(line))) return null;
        const body = front[2].match(/^# ([^\n]*)\n\n([\s\S]*)$/);
        if (!body) return null;
        const rows = body[2].trim() ? body[2].trimEnd().split('\n') : [];
        const items = [];
        for (const row of rows) {
            const match = row.match(/^- \[(.*)\]\((.+?)\)(?: — (.*))?$/);
            if (!match) return null;
            items.push({ title: match[1], url: match[2], ...(match[3] ? { author_name: match[3] } : {}) });
        }
        const id = fields.find(line => line.startsWith('id: '))?.slice(4);
        return { type: 'text/plain', value: text, format: 'md', explicitCollection: true,
            collection: { title: body[1] || 'Imported collection', items,
                id: typeof _validUrnUuid === 'function' ? _validUrnUuid(id) : undefined } };
    }
    if (normalized.startsWith('CList-Type: collection\n')) {
        const body = normalized.slice('CList-Type: collection\n'.length)
            .match(/^(?:ID: ([^\n]+)\n\n)?([^\n]*)\n=+\n\n([\s\S]*)$/);
        if (!body) return null;
        const blocks = body[3].trim() ? body[3].trimEnd().split(/\n{2,}/) : [];
        const items = [];
        for (const block of blocks) {
            const match = block.match(/^([^\n]+)\n([^\n]+)$/);
            if (!match) return null;
            const name = match[1].match(/^(.*) \((.*)\)$/);
            items.push({ title: name ? name[1] : match[1], url: match[2],
                ...(name?.[2] ? { author_name: name[2] } : {}) });
        }
        return { type: 'text/plain', value: text, format: 'text', explicitCollection: true,
            collection: { title: body[2] || 'Imported collection', items,
                id: typeof _validUrnUuid === 'function' ? _validUrnUuid(body[1]) : undefined } };
    }
    return null;
}

function _recognitionDecode(content) {
    if (typeof content === 'string') return { text: content };
    let bytes;
    if (Object.prototype.toString.call(content) === '[object ArrayBuffer]') bytes = new Uint8Array(content);
    else if (ArrayBuffer.isView(content)) bytes = new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    else throw new Error('Unsupported saved-file content.');
    const value = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const starts = signature => signature.every((byte, index) => bytes[index] === byte);
    let type;
    if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) type = 'application/pdf';
    else if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) type = 'image/png';
    else if (starts([0xff, 0xd8, 0xff])) type = 'image/jpeg';
    else if (starts([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || starts([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) type = 'image/gif';
    else if (starts([0x50, 0x4b, 0x03, 0x04])) {
        // ZIP member names are visible in the central directory even when payloads are compressed.
        const names = new TextDecoder('latin1').decode(bytes);
        type = names.includes('ppt/presentation.xml')
            ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/zip';
    }
    if (type) return { binary: true, type, bytes: value };
    try {
        const encoding = starts([0xff, 0xfe]) ? 'utf-16le' : starts([0xfe, 0xff]) ? 'utf-16be' : 'utf-8';
        const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
        // TextDecoder can decode control-filled binary as UTF-8; do not feed that to editors.
        if (/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text)) return { binary: true, type: 'application/octet-stream', bytes: value };
        return { text };
    } catch {
        return { binary: true, type: 'application/octet-stream', bytes: value };
    }
}
