// tour.js — step-by-step onboarding tours

const TOUR_SEEN_KEY = 'clist_tour_seen';

// Tour 1: auto-triggered for first-time unregistered visitors
const _registrationSteps = [
    {
        targetId: 'registerButton',
        text: 'Welcome to CList! Start here — create a free account in seconds.',
    },
    {
        targetId: 'openFindButton',
        text: 'Not ready to register? Click Find to read stuff right now — no account needed.',
    },
];

// Tour 2: interface overview, triggered from the welcome panel
const _interfaceSteps = [
    {
        targetId: 'read-pane',
        fullHeight: true,
        text: 'This is the <strong>Read pane</strong>. Use Read, Find, and Chat to browse your feeds, search for content, or start a conversation.',
    },
    {
        targetId: 'write-pane',
        fullHeight: true,
        text: 'This is the <strong>Write pane</strong>. Load content to edit, then Save or Post when you\'re ready.',
    },
    {
        targetId: 'snapLeftBtn',
        text: 'This &#9664; button snaps the Read pane. Watch:',
        onEnter() {
            _demoAfter(800,  () => _flashButton('snapLeftBtn', true));
            _demoAfter(1400, () => {
                _flashButton('snapLeftBtn', false);
                _hideTourChrome();
            });
            _demoAfter(1700, () => typeof snapPanes === 'function' && snapPanes('left'));
        },
        onLeave() {
            _flashButton('snapLeftBtn', false);
            _showTourChrome();
            _restorePanes();
        },
    },
    {
        targetId: 'openFindButton',
        preDelay: 350,
        text: 'Find stuff to read.',
    },
    {
        targetId: 'left-pane',
        fullHeight: true,
        preOpen: 'left',
        text: 'This is where your reading material appears — feeds, search results, and more.',
        onEnter() {
            if (typeof playFind === 'function') playFind();
        },
        // intentionally no onLeave — keep pane open for the search demo step
    },
    {
        targetId: 'left-pane',
        fullHeight: true,
        text: 'Type a search term and pick a service — like this:',
        onEnter() {
            if (typeof playFind === 'function') playFind(); // ensure Find panel is present
            _demoAfter(600, () => {
                const inp = document.getElementById('find-input');
                if (inp) inp.value = 'duck';
            });
            _demoAfter(1400, () => {
                const btn = [...document.querySelectorAll('#find-section .account-button')]
                    .find(b => b.textContent.includes('DuckDuckGo'));
                _flashEl(btn, true);
            });
            _demoAfter(2100, () => {
                const btn = [...document.querySelectorAll('#find-section .account-button')]
                    .find(b => b.textContent.includes('DuckDuckGo'));
                _flashEl(btn, false);
                if (btn) btn.click();
            });
            _demoAfter(2600, () => {
                _hideTourChrome();
                if (typeof closeLeftPane === 'function') closeLeftPane();
            });
        },
        onLeave() {
            if (typeof closeLeftPane === 'function') closeLeftPane();
        },
    },
    {
        targetId: 'read-pane',
        fullHeight: true,
        text: 'Click &#9654; on any item to load it into the Write pane. Watch:',
        onEnter() {
            _demoAfter(600, () => {
                const btn = document.querySelector('button[title="Load in editor"]');
                _flashEl(btn, true);
            });
            _demoAfter(1400, () => {
                const btn = document.querySelector('button[title="Load in editor"]');
                _flashEl(btn, false);
                _hideTourChrome();
            });
            _demoAfter(1700, () => {
                const btn = document.querySelector('button[title="Load in editor"]');
                if (btn) btn.click();
            });
        },
        onLeave() { _showTourChrome(); },
    },
    {
        targetId: 'read-pane',
        fullHeight: true,
        text: 'You can keep adding — let\'s load a second item too. Watch:',
        onEnter() {
            _demoAfter(600, () => {
                const btns = document.querySelectorAll('button[title="Load in editor"]');
                _flashEl(btns[1] || btns[0], true);
            });
            _demoAfter(1400, () => {
                const btns = document.querySelectorAll('button[title="Load in editor"]');
                _flashEl(btns[1] || btns[0], false);
                _hideTourChrome();
            });
            _demoAfter(1700, () => {
                const btns = document.querySelectorAll('button[title="Load in editor"]');
                const btn  = btns[1] || btns[0];
                if (btn) btn.click();
            });
        },
        onLeave() { _showTourChrome(); },
    },
    {
        targetId: 'write-pane',
        fullHeight: true,
        text: 'Load as many items as you like, add your own text, and mix it all together. This is the <em>convergent</em> C of CList.',
    },
    {
        targetId: 'save-button',
        text: 'Save what you\'ve created.',
    },
    {
        targetId: 'right-pane',
        fullHeight: true,
        preOpen: 'right',
        text: 'This is where you save and post your content.',
        onLeave() { if (typeof closeRightPane === 'function') closeRightPane(); },
    },
    {
        targetId: 'registerButton',
        preOpen: 'left',
        text: 'Ready to get started? Create a free account here — it only takes a moment.',
    },
    {
        targetId: 'divider',
        text: 'That\'s what CList can do without an account. Register to connect Mastodon, Bluesky, RSS feeds, and more — read from all of them, write, and publish to your open networks from one place.',
    },
];

function _restorePanes() {
    const rp = document.getElementById('read-pane');
    const wp = document.getElementById('write-pane');
    if (rp) rp.style.flex = '0.5';
    if (wp) wp.style.flex = '0.5';
}

function _flashEl(el, on) {
    if (!el) return;
    if (on) {
        el.style.background  = 'rgba(76,175,80,0.35)';
        el.style.boxShadow   = '0 0 0 3px rgba(76,175,80,0.6)';
        el.style.transition  = 'background 0.15s, box-shadow 0.15s';
    } else {
        el.style.background  = '';
        el.style.boxShadow   = '';
        el.style.transition  = '';
    }
}

function _flashButton(id, on) {
    _flashEl(document.getElementById(id), on);
}

function _hideTourChrome() {
    if (_tourHighlight) _tourHighlight.style.visibility = 'hidden';
    _tourOverlay.forEach(el => { if (el) el.style.visibility = 'hidden'; });
}

function _showTourChrome() {
    if (_tourHighlight) _tourHighlight.style.visibility = '';
    _tourOverlay.forEach(el => { if (el) el.style.visibility = ''; });
}

// Reposition the highlight ring and overlays onto a different element mid-demo.
function _moveHighlightTo(targetId) {
    const target = document.getElementById(targetId);
    if (!target || !_tourHighlight) return;
    const r = target.getBoundingClientRect();
    _setOverlayRects(r);
    const pad = 6;
    _tourHighlight.style.top    = (r.top    - pad) + 'px';
    _tourHighlight.style.left   = (r.left   - pad) + 'px';
    _tourHighlight.style.width  = (r.width  + pad * 2) + 'px';
    _tourHighlight.style.height = (r.height + pad * 2) + 'px';
    requestAnimationFrame(() => _positionTooltip(r));
}

// ── state ─────────────────────────────────────────────────────────────────────

let _tourSteps       = [];
let _tourStep        = 0;
let _tourMarkSeen    = false;
let _tourDemoTimeouts = [];
let _preOpenedSteps  = new Set();
let _preDelayedSteps = new Set();
let _tourOverlay     = [null, null, null, null];
let _tourHighlight   = null;
let _tourTooltip     = null;

function _demoAfter(ms, fn) {
    _tourDemoTimeouts.push(setTimeout(fn, ms));
}

function _clearDemoTimeouts() {
    _tourDemoTimeouts.forEach(id => clearTimeout(id));
    _tourDemoTimeouts = [];
}

// ── public entry points ───────────────────────────────────────────────────────

function startTour() {
    if (localStorage.getItem(TOUR_SEEN_KEY)) return;
    setTimeout(() => _buildTour(_registrationSteps, true), 550);
}

function startInterfaceTour() {
    if (typeof closeLeftPane  === 'function') closeLeftPane();
    if (typeof closeRightPane === 'function') closeRightPane();
    setTimeout(() => _buildTour(_interfaceSteps, false), 600);
}

// ── internals ────────────────────────────────────────────────────────────────

function _buildTour(steps, markSeen) {
    if (_tourHighlight) endTour();
    _tourSteps    = steps;
    _tourMarkSeen = markSeen;
    _tourStep     = 0;
    _preOpenedSteps.clear();
    _preDelayedSteps.clear();

    _tourOverlay = ['top', 'bottom', 'left', 'right'].map(() => {
        const d = document.createElement('div');
        d.style.cssText =
            'position:fixed;background:rgba(0,0,0,0.55);z-index:9000;pointer-events:none;';
        document.body.appendChild(d);
        return d;
    });

    _tourHighlight = document.createElement('div');
    _tourHighlight.style.cssText =
        'position:fixed;z-index:9001;pointer-events:none;' +
        'border:3px solid #4CAF50;border-radius:8px;' +
        'box-shadow:0 0 0 4px rgba(76,175,80,0.25);' +
        'transition:top .2s,left .2s,width .2s,height .2s;';

    _tourTooltip = document.createElement('div');
    _tourTooltip.style.cssText =
        'position:fixed;z-index:9002;background:#fff;border-radius:18px;' +
        'padding:24px 28px;max-width:320px;' +
        'border:3px solid rgba(76,175,80,0.4);' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.15);' +
        'font-size:14px;line-height:1.7;color:#333;';

    document.body.appendChild(_tourHighlight);
    document.body.appendChild(_tourTooltip);

    _showTourStep(0);
}

function _computeRect(step) {
    const target = document.getElementById(step.targetId);
    if (!target) return null;
    const r = target.getBoundingClientRect();
    if (!step.fullHeight) return r;
    return { top: 0, bottom: window.innerHeight, left: r.left, right: r.right,
             width: r.width, height: window.innerHeight };
}

function _setOverlayRects(r) {
    const [top, bot, left, right] = _tourOverlay;
    top.style.cssText   = `position:fixed;top:0;left:0;right:0;height:${r.top}px;background:rgba(0,0,0,0.55);z-index:9000;pointer-events:none;`;
    bot.style.cssText   = `position:fixed;top:${r.bottom}px;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9000;pointer-events:none;`;
    left.style.cssText  = `position:fixed;top:${r.top}px;left:0;width:${r.left}px;height:${r.height}px;background:rgba(0,0,0,0.55);z-index:9000;pointer-events:none;`;
    right.style.cssText = `position:fixed;top:${r.top}px;left:${r.right}px;right:0;height:${r.height}px;background:rgba(0,0,0,0.55);z-index:9000;pointer-events:none;`;
}

function _showTourStep(index) {
    _showTourChrome(); // restore visibility in case previous step hid it

    const step = _tourSteps[index];

    if (step.preDelay && !_preDelayedSteps.has(index)) {
        _preDelayedSteps.add(index);
        setTimeout(() => _showTourStep(index), step.preDelay);
        return;
    }

    if (step.preOpen && !_preOpenedSteps.has(index)) {
        _preOpenedSteps.add(index);
        if (step.preOpen === 'left'  && typeof openLeftPane  === 'function') openLeftPane();
        if (step.preOpen === 'right' && typeof openRightPane === 'function') openRightPane();
        setTimeout(() => _showTourStep(index), 600);
        return;
    }

    const r = _computeRect(step);
    if (!r) { endTour(); return; }

    _setOverlayRects(r);

    const pad = 6;
    _tourHighlight.style.top    = (r.top    - pad) + 'px';
    _tourHighlight.style.left   = (r.left   - pad) + 'px';
    _tourHighlight.style.width  = (r.width  + pad * 2) + 'px';
    _tourHighlight.style.height = (r.height + pad * 2) + 'px';

    const isLast  = index === _tourSteps.length - 1;
    const skipBtn = `<button onclick="endTour()" style="font-size:13px;padding:6px 12px;background:none;border:1px solid #ccc;border-radius:8px;cursor:pointer;color:#555">Skip</button>`;
    const doneBtn = `<button onclick="endTour()" style="font-size:13px;padding:6px 16px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer">Done</button>`;
    const nextBtn = `<button onclick="_nextTourStep()" style="font-size:13px;padding:6px 16px;background:#4CAF50;color:#fff;border:none;border-radius:8px;cursor:pointer">Next &rarr;</button>`;

    _tourTooltip.innerHTML =
        `<p style="margin:0 0 18px">${step.text}</p>` +
        `<div style="display:flex;justify-content:space-between;align-items:center">` +
          `<span style="font-size:12px;color:#aaa">${index + 1} / ${_tourSteps.length}</span>` +
          `<div style="display:flex;gap:8px">` +
            skipBtn + (isLast ? doneBtn : nextBtn) +
          `</div>` +
        `</div>`;

    requestAnimationFrame(() => _positionTooltip(r));

    if (step.onEnter) step.onEnter();
}

function _positionTooltip(targetRect) {
    const tt      = _tourTooltip;
    const ttH     = tt.offsetHeight;
    const ttW     = tt.offsetWidth;
    const margin  = 16;
    const edgePad = 28;
    const vw      = window.innerWidth;
    const vh      = window.innerHeight;

    let top, left;
    const isFullHeight = targetRect.height >= vh * 0.8;

    if (isFullHeight) {
        // Tall element — place tooltip inside it, roughly 35% down
        top = Math.round(vh * 0.35);
        const elementCentreX = targetRect.left + targetRect.width / 2;
        if (elementCentreX < vw / 2) {
            // Left-side element: offset from left edge
            left = targetRect.left + edgePad;
        } else {
            // Right-side element: offset from right edge
            left = targetRect.right - ttW - edgePad;
        }
    } else {
        // Regular element — try below, fall back to above
        top  = targetRect.bottom + margin;
        left = targetRect.left + Math.round(targetRect.width / 4);
        if (top + ttH > vh - edgePad) {
            top = targetRect.top - ttH - margin;
        }
    }

    // Clamp to viewport with generous padding
    if (left + ttW > vw - edgePad) left = vw - ttW - edgePad;
    if (left < edgePad) left = edgePad;
    top = Math.max(edgePad, Math.min(top, vh - ttH - edgePad));

    tt.style.top  = top  + 'px';
    tt.style.left = left + 'px';
}

function _nextTourStep() {
    const leaving = _tourSteps[_tourStep];
    _clearDemoTimeouts();
    if (leaving && leaving.onLeave) leaving.onLeave();
    _tourStep++;
    if (_tourStep >= _tourSteps.length) {
        endTour();
    } else {
        _showTourStep(_tourStep);
    }
}

function endTour() {
    _clearDemoTimeouts();
    const leaving = _tourSteps[_tourStep];
    if (leaving && leaving.onLeave) leaving.onLeave();
    if (_tourMarkSeen) localStorage.setItem(TOUR_SEEN_KEY, '1');
    _tourOverlay.forEach(el => el && el.remove());
    _tourOverlay = [null, null, null, null];
    if (_tourHighlight) { _tourHighlight.remove(); _tourHighlight = null; }
    if (_tourTooltip)   { _tourTooltip.remove();   _tourTooltip   = null; }
}
