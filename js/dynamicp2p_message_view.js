function renderP2pEtherpadLink(model, doc = document) {
    // Recognition sees serialized HTML after sanitization. Decode its entities
    // once before assigning a URL, so query separators do not become "&amp;".
    const decoded = doc.createElement('textarea'); decoded.innerHTML = model.link;
    const link = decoded.value;
    const a = doc.createElement('a');
    a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = link;
    const em = doc.createElement('em'), i = doc.createElement('i');
    i.appendChild(a); em.appendChild(i);
    const tmp = doc.createElement('div');
    tmp.appendChild(doc.createTextNode(model.sender + ' shared an Etherpad link (Click on the link to open): '));
    tmp.appendChild(em);
    // Serialized chat HTML retains ordinary safe-link navigation; DOM listeners
    // cannot survive this string boundary. The shared message sanitizer still runs.
    return tmp.innerHTML;
}

function createP2pMessageView(doc = document, deps = {}) {
    const root = doc.getElementById('chat-messages');
    const sanitize = deps.sanitize || (text => sanitizeHTML(text));
    const decorate = deps.decorate || ((html, sender) => chatOptions(html, sender));
    const relay = deps.relay || (packet => { if (chatBc) chatBc.postMessage(packet); });
    return {
        alive: () => !!root?.isConnected && doc.getElementById('chat-messages') === root,
        current: row => !!row?.isConnected && row.parentNode === root,
        show(model) {
            const row = doc.createElement('div'); row.style.textAlign = model.isOwn ? 'right' : 'left';
            const label = model.isOwn ? 'You (' + model.sender + '): ' : model.sender + (model.verification === true ? ' ✓' : model.verification === false ? ' ⚠' : '') + ': ';
            const prefix = doc.createElement('span'); prefix.textContent = label;
            const html = sanitize(decorate(sanitize(model.text), model.sender));
            const body = doc.createElement('span'); body.innerHTML = html;
            row.append(prefix, body); root.appendChild(row);
            try { relay({ type: 'chat-msg', html: (deps.escape || escapeHtml)(label) + html, isOwn: !!model.isOwn, isEvent: false }); }
            catch (error) { console.error('Could not relay chat text:', error); showServiceError(root, 'Chat popup relay failed', error.message || String(error)); }
            return row;
        },
        error(error) { showServiceError(root, 'Chat message failed', error.message || String(error)); }
    };
}

// Compatibility transcript/sanitizer helpers for remaining control/event paths.
function appendMessage(message, isOwn = false, isEvent = false) {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHTML(message);
  if (isEvent) {
    div.classList.add('chat-event');
  } else {
    div.style.textAlign = isOwn ? 'right' : 'left';
  }
  document.getElementById('chat-messages').appendChild(div);
  if (chatBc) chatBc.postMessage({ type: 'chat-msg', html: div.innerHTML, isOwn, isEvent });
}

function sanitizeHTML(input) {
  const allowedTags = ['i', 'b', 'em', 'a', 'br'];
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  const elements = doc.body.querySelectorAll('*');

  elements.forEach((el) => {
    if (!allowedTags.includes(el.tagName.toLowerCase())) {
      el.replaceWith(...el.childNodes);
      return;
    }
    // Strip all attributes, then restore only the safe subset.
    const attrsToKeep = {};
    if (el.tagName.toLowerCase() === 'a') {
      const href = el.getAttribute('href') || '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        attrsToKeep.href = href;
      }
      const target = el.getAttribute('target');
      if (target) attrsToKeep.target = '_blank'; // normalise to _blank
      attrsToKeep.rel = 'noopener noreferrer';
    }
    // Remove every attribute on the element.
    [...el.attributes].forEach(attr => el.removeAttribute(attr.name));
    // Re-apply only the vetted ones.
    Object.entries(attrsToKeep).forEach(([k, v]) => el.setAttribute(k, v));
  });

  return doc.body.innerHTML;
}
