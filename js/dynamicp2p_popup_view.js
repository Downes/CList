// Popup DOM and existing message/card rendering; communication is owned by the client.
function createP2pPopupView(doc = document) {
    const messagesEl = doc.getElementById('chat-messages'), noConnectionEl = doc.getElementById('no-connection');
    const input = doc.getElementById('messageInput'), send = doc.getElementById('sendButton'), collab = doc.getElementById('startDocButton');
    function appendMessage({ html, isOwn, isEvent }) {
      const div = doc.createElement('div');
      div.innerHTML = html; // already sanitized by main window
      if (isEvent) div.classList.add('chat-event');
      else div.style.textAlign = isOwn ? 'right' : 'left';
      messagesEl.appendChild(div);
      div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    function escText(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function appendCard({ sender, kind, title, url, excerpt, items, isOwn }) {
      const kindLabel = { item: 'an item', collection: 'a collection', annotation: 'an annotation' }[kind] || 'something';
      const wrapper = doc.createElement('div');
      wrapper.style.textAlign = isOwn ? 'right' : 'left';

      const card = doc.createElement('div');
      card.style.cssText = 'display:inline-block;border:1px solid #ccc;border-radius:6px;padding:8px 12px;margin:4px 0;background:#f9f9f9;max-width:300px;font-size:13px;text-align:left';

      const hdr = doc.createElement('div');
      hdr.style.cssText = 'color:#555;margin-bottom:4px';
      hdr.innerHTML = `<strong>${escText(sender)}</strong> shared ${kindLabel}:`;
      card.appendChild(hdr);

      if ((title || url) && kind !== 'collection') {
        const titleEl = doc.createElement('div');
        titleEl.style.cssText = 'font-weight:500;margin-bottom:4px';
        titleEl.innerHTML = url
          ? `<a href="${escText(url)}" target="_blank" rel="noopener noreferrer">${escText(title || url)}</a>`
          : escText(title || '');
        card.appendChild(titleEl);
      }

      if (kind === 'collection' && Array.isArray(items) && items.length) {
        const details = doc.createElement('details');
        details.style.cssText = 'margin-top:2px';
        const summary = doc.createElement('summary');
        summary.style.cssText = 'font-weight:500;cursor:pointer;font-size:13px';
        summary.textContent = title || 'Untitled collection';
        details.appendChild(summary);

        const ul = doc.createElement('ul');
        ul.style.cssText = 'list-style:none;padding:0;margin:4px 0';
        items.forEach(item => {
          const li = doc.createElement('li');
          li.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:6px;margin:2px 0;font-size:12px';
          const nameSpan = doc.createElement('span');
          nameSpan.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
          nameSpan.textContent = item.title || item.url || '';
          li.appendChild(nameSpan);
          if (item.url) {
            const btn = doc.createElement('button');
            btn.title = 'Open in new window';
            btn.style.cssText = 'background:none;border:none;cursor:pointer;padding:2px;color:rgb(81,177,88);font-size:16px;flex-shrink:0';
            btn.textContent = '↗';
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              window.open(item.url, '_blank', 'width=800,height=600,scrollbars=yes');
            });
            li.appendChild(btn);
          }
          ul.appendChild(li);
        });
        details.appendChild(ul);
        card.appendChild(details);
      }

      if (excerpt && kind !== 'collection') {
        const ex = doc.createElement('div');
        ex.style.cssText = 'color:#666;font-size:12px;margin-top:4px;word-break:break-word';
        ex.textContent = excerpt;
        card.appendChild(ex);
      }

      wrapper.appendChild(card);
      messagesEl.appendChild(wrapper);
      wrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    return {
        text: () => input.value,
        clear(text) { if (input.value.trim() === text) input.value = ''; },
        discussion(name) { const title = name ? 'CList Chat — ' + name : 'CList Chat'; doc.title = title; doc.getElementById('chat-title').textContent = title; },
        message: appendMessage, card: appendCard,
        status(state) {
            send.disabled = state.phase !== 'ready' || state.sending;
            collab.disabled = state.phase !== 'ready' || state.collaborating;
            noConnectionEl.textContent = state.error || (state.phase === 'opening' ? 'Waiting for the main chat window…' : state.phase === 'closed' ? 'Chat popup is disconnected.' : '');
            noConnectionEl.style.display = noConnectionEl.textContent ? 'block' : 'none';
        },
        bind(actions) {
            const sendText = () => actions.send(), startDoc = () => actions.collaborate();
            const key = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); actions.send(); } };
            send.addEventListener('click', sendText); collab.addEventListener('click', startDoc); input.addEventListener('keydown', key);
            return () => { send.removeEventListener('click', sendText); collab.removeEventListener('click', startDoc); input.removeEventListener('keydown', key); };
        }
    };
}
