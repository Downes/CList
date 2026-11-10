const jo = `
    <header class="toolbar">
      <div class="tools">
        <button class="btn-small" data-control="undo" title="Undo (Ctrl+Z)">Undo</button>
        <button class="btn-small" data-control="redo" title="Redo (Ctrl+Y or Ctrl+Shift+Z)">Redo</button>
        <button class="btn-small" data-control="add-text" title="Add a text box">+ Text box</button>
        <span data-control="shape-tools" class="shape-tools"></span>
        <button class="btn-small" data-control="add-image" title="Add an image to this slide">+ Image</button><input data-control="image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden />
        <button class="btn-small" data-control="cut-objects" title="Cut selected objects (Ctrl+X outside text editing)">Cut objects</button><button class="btn-small" data-control="copy-objects" title="Copy selected objects (Ctrl+C outside text editing)">Copy objects</button><button class="btn-small" data-control="paste-objects" title="Paste copied objects on this slide (Ctrl+V outside text editing)">Paste objects</button>
        <button class="btn-small" data-control="duplicate" title="Duplicate selected box">Duplicate</button>
        <button class="btn-small" data-control="delete" title="Delete selected objects">Delete</button>
        <button class="btn-small" data-control="bring-forward" title="Move selected object forward one layer">Bring forward</button>
        <button class="btn-small" data-control="send-backward" title="Move selected object backward one layer">Send backward</button>
        <button data-control="copy-format" title="Copy formatting from the selected text box or shape">Copy formatting</button><button data-control="paste-format" title="Apply copied formatting to selected text boxes or shapes">Apply formatting</button><span class="rule"></span>
        <button class="btn-small" data-control="bold" title="Bold selected text"><b>B</b></button>
        <button class="btn-small" data-control="italic" title="Italic selected text"><i>I</i></button>
        <button class="btn-small" data-control="edit-link" title="Add or edit a link on selected text">Link</button><button class="btn-small" data-control="remove-link" title="Remove link from selected text">Remove link</button>
        <button class="btn-small" data-control="bullet-list" title="Toggle bullet list">Bullets</button>
        <button class="btn-small" data-control="ordered-list" title="Toggle numbered list">Numbered list</button>
        <span class="rule"></span>
        <button class="btn-small" data-control="presenter-view" title="Open presenter view with previews, notes and timer">Presenter view</button><button class="btn-small" data-control="present" title="Present slides full screen">Present</button>
      </div>
<div class="canvas-zoom" role="group" aria-label="Canvas zoom"><button class="btn btn-secondary" data-control="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><select data-control="canvas-zoom" title="Canvas zoom" aria-label="Canvas zoom"><option value="fit">Fit</option><option value="25">25%</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select><button class="btn btn-secondary" data-control="zoom-in" title="Zoom in" aria-label="Zoom in">+</button><button class="btn btn-secondary" data-control="zoom-fit" title="Fit the whole slide in the canvas">Fit slide</button></div>
      <span data-control="connection-status" class="status">Local only</span>
    </header>
    <div class="link-controls" data-control="link-controls" hidden><label>Link URL <input data-control="link-url" type="url" placeholder="https://example.com" title="Link destination" /></label><button class="btn-small" data-control="apply-link" title="Apply link to selected text">Apply link</button><button class="btn-small btn-secondary" data-control="cancel-link" title="Cancel editing link">Cancel</button></div>
    <section class="workspace">
      <aside class="rail"><div class="rail-title">SLIDES</div><div class="slide-create-actions"><button class="btn" data-control="add-slide" title="Add a slide">Add slide</button><button class="btn" data-control="duplicate-slide" title="Duplicate the current slide">Duplicate</button></div><div class="slide-order-actions" data-control="slide-order-actions"><button class="btn" data-control="slide-up" title="Move slide earlier" aria-label="Move slide earlier">↑</button><button class="btn" data-control="slide-down" title="Move slide later" aria-label="Move slide later">↓</button></div><div data-control="slide-list" class="slide-list" aria-label="Slides"></div><div class="slide-actions"><button class="btn" data-control="delete-slide" title="Delete selected slide">Delete</button></div></aside>
      <div class="canvas-space">
        <div class="canvas-top"><span data-control="slide-label">Slide 1</span><span class="hint">Drag empty slide space to select. Shift adds. Alt bypasses snapping.</span></div>
        <div class="canvas-viewport" data-control="canvas-viewport" tabindex="0" aria-label="Scrollable slide canvas"><div class="canvas-stage"><div data-control="slide" class="slide" aria-label="Editable 16:9 slide"></div></div></div>
        <label class="speaker-notes">Speaker notes<textarea data-control="speaker-notes" rows="4" title="Speaker notes for the current slide" placeholder="Notes for this slide"></textarea></label><div class="canvas-bottom"><span>1280 × 720</span><span data-control="count">2 text boxes</span></div>
      </div>
      <aside class="inspector" aria-label="Slide controls" tabindex="0"><details class="control-section" data-panel="themes"><summary>Themes</summary><div class="control-section-body"><label>Presentation theme<select data-control="theme" title="Theme defaults for the whole presentation"></select></label><div data-control="theme-preview" class="theme-preview" aria-hidden="true"></div><p class="helper">Applies to every slide. Individual font, colour and background choices are preserved.</p></div></details><details class="control-section" data-panel="layouts"><summary>Layouts</summary><div class="control-section-body"><label class="slide-layout-label">New slide layout<select data-control="slide-layout" title="Layout for the next slide"></select></label><div class="saved-layout-actions"><button class="btn-small" data-control="rename-layout" title="Rename selected saved layout">Rename layout</button><button class="btn-small btn-secondary" data-control="delete-layout" title="Delete selected saved layout">Delete layout</button></div><p data-control="saved-layout-hint" class="helper" role="status"></p><button class="btn" data-control="save-layout" title="Save the current slide design as a layout">Save design as layout</button></div></details><details class="control-section" data-panel="objects" open><summary>Objects</summary><div class="control-section-body"><p class="helper">Objects (front to back). Shift-click to select several.</p><div data-control="object-list" class="object-list" role="group" aria-label="Objects on current slide"></div><div data-control="selection-details" class="selection-details">Select an object</div></div></details><details class="control-section" data-panel="geometry"><summary>Position and size</summary><div class="control-section-body"><div class="geometry-controls"><label>Rotation (degrees)<input data-control="object-rotation" type="number" min="-180" max="180" step="1" value="0" title="Object rotation in degrees" /></label><label>X (px)<input data-control="object-x" type="number" min="0" max="1279" step="1" title="Object horizontal position" /></label><label>Y (px)<input data-control="object-y" type="number" min="0" max="719" step="1" title="Object vertical position" /></label><label>Width (px)<input data-control="object-width" type="number" min="1" max="1280" step="1" title="Object width" /></label><label>Height (px)<input data-control="object-height" type="number" min="1" max="720" step="1" title="Object height" /></label></div></div></details><details class="control-section" data-panel="text"><summary>Text</summary><div class="control-section-body"><button class="btn" data-control="fit-text" title="Reduce the selected text boxes’ font size until their text fits">Fit text</button><p class="helper" data-control="text-overflow-status" role="status" aria-live="polite"></p><div class="text-format-controls"><label>Font family<select data-control="font-family" title="Font family for the selected text box"><option value="system">System default</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="georgia">Georgia</option><option value="times">Times New Roman</option><option value="courier">Courier New</option></select></label><label>Font size (px)<input data-control="font-size" type="number" min="8" max="200" step="1" value="33" title="Font size for the selected text box" /></label><label>Text colour<input data-control="text-colour" type="color" value="#202b3d" title="Text colour for the selected text box" /></label><label>Alignment<select data-control="text-align" title="Alignment for the selected text box"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option></select></label></div></div></details><details class="control-section" data-panel="appearance"><summary>Fill and border</summary><div class="control-section-body"><div class="text-format-controls"><label><input data-control="fill-enabled" type="checkbox" title="Enable text box fill" /> Fill</label><label>Fill colour<input data-control="fill-colour" type="color" value="#ffffff" title="Text box fill colour" /></label><label><input data-control="border-enabled" type="checkbox" title="Enable text box border" /> Border</label><label>Border colour<input data-control="border-colour" type="color" value="#202b3d" title="Text box border colour" /></label><label>Border width (px)<input data-control="border-width" type="number" min="1" max="20" step="1" value="2" title="Text box border width" /></label></div></div></details><details class="control-section" data-panel="images"><summary>Image</summary><div class="control-section-body"><label><input data-control="keep-aspect-ratio" type="checkbox" title="Keep image proportions when resizing" checked /> Keep aspect ratio (images)</label><label>Image description (alt text)<textarea data-control="image-description" rows="3" maxlength="2000" title="Description of the selected image" aria-describedby="slide-image-description-help"></textarea></label><p class="helper" id="slide-image-description-help">Describe the image for someone who cannot see it. Leave blank for a decorative image.</p><div class="image-crop-controls"><button class="btn-small" data-control="replace-image" title="Replace selected image while preserving its frame and position">Replace image</button><input data-control="replace-image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden /><label>Image mode<select data-control="image-fit" title="Show the whole image or crop to fill the frame"><option value="contain">Fit (whole image)</option><option value="cover">Fill (crop)</option></select></label><label>Crop horizontal (%)<input data-control="crop-x" type="range" min="0" max="100" step="1" value="50" title="Horizontal crop position: left to right" /></label><label>Crop vertical (%)<input data-control="crop-y" type="range" min="0" max="100" step="1" value="50" title="Vertical crop position: top to bottom" /></label><p class="helper">For cropping, turn off Keep aspect ratio and resize the frame. Crop positioning applies in Fill mode.</p></div></div></details><details class="control-section" data-panel="arrange"><summary>Arrange</summary><div class="control-section-body"><div class="object-group-controls"><button class="btn-small" data-control="group-objects" title="Group selected objects so they select and move together">Group</button><button class="btn-small" data-control="ungroup-objects" title="Ungroup selected objects">Ungroup</button></div><div class="object-lock-controls"><button class="btn-small" data-control="lock-objects" title="Lock selected objects against movement, resizing and deletion">Lock</button><button class="btn-small" data-control="unlock-objects" title="Unlock selected objects">Unlock</button></div><div class="object-alignment"><p>Align selected objects</p><button class="btn-small" data-control="align-left" title="Align selected objects: left">Left</button><button class="btn-small" data-control="align-center" title="Align selected objects: centre">Centre</button><button class="btn-small" data-control="align-right" title="Align selected objects: right">Right</button><button class="btn-small" data-control="align-top" title="Align selected objects: top">Top</button><button class="btn-small" data-control="align-middle" title="Align selected objects: middle">Middle</button><button class="btn-small" data-control="align-bottom" title="Align selected objects: bottom">Bottom</button></div><div class="object-distribution"><p>Equal spacing (select 3 or more)</p><button class="btn-small" data-control="distribute-horizontal" title="Equal horizontal gaps; keep outermost objects in place">Distribute horizontally</button><button class="btn-small" data-control="distribute-vertical" title="Equal vertical gaps; keep outermost objects in place">Distribute vertically</button><p data-control="distribution-status" class="helper" role="status" aria-live="polite"></p></div></div></details><details class="control-section" data-panel="slide"><summary>Slide</summary><div class="control-section-body"><label>Background colour<input data-control="slide-background" type="color" value="#ffffff" title="Background colour for the current slide" /></label></div></details><details class="control-section" data-panel="collaboration"><summary>Collaboration</summary><div class="control-section-body"><label>Hocuspocus WebSocket URL<input data-control="server-url" placeholder="ws://localhost:1234" autocomplete="off" /></label><label>Document name<input data-control="doc-name" autocomplete="off" /></label><label>Auth token (optional)<input data-control="token" type="password" autocomplete="off" /></label><button class="btn-small" data-control="connect">Connect</button><p class="helper">Open this page in two tabs with the same URL and document name to test live collaboration.</p></div></details></aside>
    </section>
<div class="presentation-controls" data-control="presentation-controls" hidden><button class="btn-small" data-control="previous-slide" title="Previous slide">Previous</button><span data-control="presentation-position" aria-live="polite"></span><button class="btn-small" data-control="next-slide" title="Next slide">Next</button><button class="btn-small" data-control="presentation-presenter-view" title="Open presenter view">Presenter view</button><button class="btn-small btn-secondary" data-control="exit-presentation" title="Return to editing">Exit presentation</button><span data-control="presentation-status" role="status"></span></div>`;
function co(s) {
  try {
    const p = new URL(s);
    return ["http:", "https:"].includes(p.protocol) ? p.href : "";
  } catch {
    return "";
  }
}
function vt(s) {
  if (!s || typeof s.url != "string") return null;
  const p = co(s.url);
  return p ? { ...JSON.parse(JSON.stringify(s)), url: p } : null;
}
function Ao(s, p) {
  if (!s || !["text/html", "text/plain"].includes(s.type) || typeof s.value != "string") throw new Error("Import HTML or plain text into Slides.");
  const u = document.createElement("div");
  if (s.type === "text/html") {
    const d = new DOMParser().parseFromString(s.value, "text/html");
    d.querySelectorAll("script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons").forEach((g) => g.remove());
    for (const g of d.querySelectorAll("img")) g.replaceWith(d.createTextNode(g.alt || ""));
    for (const g of d.body.querySelectorAll("*")) {
      for (const S of [...g.attributes]) S.name !== "href" && g.removeAttribute(S.name);
      if (g.hasAttribute("href")) {
        const S = co(g.getAttribute("href"));
        S ? g.setAttribute("href", S) : g.removeAttribute("href");
      }
    }
    u.innerHTML = d.body.innerHTML;
  } else
    for (const d of s.value.split(/\r?\n/)) {
      const g = document.createElement("p");
      g.textContent = d, u.append(g);
    }
  for (const d of p) {
    const g = document.createElement("p"), S = document.createElement("a");
    S.href = d.url, S.textContent = d.title || d.url, g.append(document.createTextNode("Source: "), S), u.append(g);
  }
  if (!u.textContent.trim()) throw new Error("There is no readable text to import.");
  return u.innerHTML;
}
function zo(s, p, u) {
  let d = null, g = !1;
  const S = /* @__PURE__ */ new WeakMap(), N = s.querySelector('[data-control="fit-text"]'), T = s.querySelector('[data-control="text-overflow-status"]');
  function O(y) {
    const C = y.content.querySelector(".tiptap");
    return !!C && C.clientHeight > 0 && (C.scrollHeight > C.clientHeight + 1 || C.scrollWidth > C.clientWidth + 1);
  }
  function K() {
    if (d = null, g) return;
    let y = 0;
    const C = u.selected();
    for (const V of u.views()) {
      if (!V.editor) continue;
      const H = O(V);
      C.includes(V) && (y += Number(H));
      let B = S.get(V.node);
      !B && H && (B = document.createElement("span"), B.className = "text-overflow-badge", B.textContent = "Text overflow", B.title = "Text does not fit in this box. Use Fit text or enlarge the box.", V.node.append(B), S.set(V.node, B)), B && B.hidden === H && (B.hidden = !H);
    }
    const D = u.presenting() || !C.length || C.some((V) => V.box.get("locked") === !0) || !C.some((V) => V.editor);
    N.disabled !== D && (N.disabled = D);
    const a = y ? y + " selected text box" + (y === 1 ? " overflows." : "es overflow.") + " Use Fit text or enlarge the box." : C.some((V) => V.editor) ? "Selected text fits." : "Select a text box to check its fit.";
    T.textContent !== a && (T.textContent = a);
  }
  function q() {
    !g && d === null && (d = requestAnimationFrame(K));
  }
  function _() {
    const y = u.selected();
    if (u.presenting() || y.some((D) => D.box.get("locked") === !0)) return;
    const C = [];
    for (const D of y) {
      if (!D.editor || !O(D)) continue;
      const a = D.node.style.getPropertyValue("--slide-font-size"), V = u.size(D.box);
      let H = 8;
      try {
        let B = 8, te = Math.floor(V);
        for (; B <= te; ) {
          const v = Math.floor((B + te) / 2);
          D.node.style.setProperty("--slide-font-size", v / 12.8 + "cqw"), O(D) ? te = v - 1 : (H = v, B = v + 1);
        }
      } finally {
        D.node.style.setProperty("--slide-font-size", a);
      }
      H < V && C.push({ box: D.box, size: H });
    }
    u.apply(C), K();
  }
  N.addEventListener("click", _);
  const j = new MutationObserver(q);
  j.observe(p, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["style", "class"] });
  const U = new ResizeObserver(q);
  return U.observe(p), document.fonts?.addEventListener("loadingdone", q), q(), { schedule: q, destroy() {
    g = !0, d !== null && cancelAnimationFrame(d), j.disconnect(), U.disconnect(), document.fonts?.removeEventListener("loadingdone", q), N.removeEventListener("click", _);
  } };
}
function No(s, p, u) {
  const d = document.createElement("div");
  d.className = "selection-marquee", d.hidden = !0, d.setAttribute("aria-hidden", "true"), p.append(d);
  let g = null;
  function S(j) {
    const U = p.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (j.clientX - U.left) * 1280 / U.width)), y: Math.max(0, Math.min(720, (j.clientY - U.top) * 720 / U.height)) };
  }
  function N() {
    const j = g;
    g = null, d.hidden = !0, j && p.hasPointerCapture(j.pointer) && p.releasePointerCapture(j.pointer);
  }
  function T() {
    if (!g) return;
    const j = g.original;
    N(), u.select(j);
  }
  function O(j) {
    j.button !== 0 || j.isPrimary === !1 || (T(), g = { start: S(j), clientX: j.clientX, clientY: j.clientY, pointer: j.pointerId, original: u.selected(), additive: j.shiftKey, slide: u.slideId(), moved: !1 }, p.setPointerCapture(j.pointerId));
  }
  function K(j) {
    if (!g || j.pointerId !== g.pointer) return;
    if (u.slideId() !== g.slide) {
      T();
      return;
    }
    if (!g.moved && Math.hypot(j.clientX - g.clientX, j.clientY - g.clientY) < 4) return;
    g.moved = !0, j.preventDefault();
    const U = S(j), y = Math.min(g.start.x, U.x), C = Math.min(g.start.y, U.y), D = Math.abs(U.x - g.start.x), a = Math.abs(U.y - g.start.y);
    Object.assign(d.style, { left: y / 12.8 + "%", top: C / 7.2 + "%", width: D / 12.8 + "%", height: a / 7.2 + "%" }), d.hidden = !1;
    const V = new Set(g.additive ? g.original : []);
    for (const H of u.objects())
      H.x < y + D && H.x + H.width > y && H.y < C + a && H.y + H.height > C && V.add(H.id);
    u.select([...V]);
  }
  function q(j) {
    !g || j.pointerId !== g.pointer || (K(j), N());
  }
  function _(j) {
    g && j.key === "Escape" && (j.preventDefault(), j.stopPropagation(), T());
  }
  return p.addEventListener("pointermove", K), p.addEventListener("pointerup", q), p.addEventListener("pointercancel", T), p.addEventListener("lostpointercapture", T), s.addEventListener("keydown", _, !0), { begin: O, cancel: T, destroy() {
    N(), p.removeEventListener("pointermove", K), p.removeEventListener("pointerup", q), p.removeEventListener("pointercancel", T), p.removeEventListener("lostpointercapture", T), s.removeEventListener("keydown", _, !0), d.remove();
  } };
}
function Io(s, p) {
  const u = (j) => s.querySelector('[data-control="' + j + '"]'), d = u("canvas-viewport"), g = u("slide"), S = u("canvas-zoom"), N = [25, 50, 75, 100, 125, 150, 200];
  let T = "fit", O = 100;
  function K() {
    if (p() || !d.clientWidth || !d.clientHeight) return;
    const j = Math.max(1, d.clientWidth - 48), U = Math.max(1, d.clientHeight - 48);
    T === "fit" && (O = Math.min(100, j / 1280 * 100, U / 720 * 100));
    const y = 1280 * O / 100, C = 720 * O / 100;
    g.style.setProperty("--canvas-slide-width", y + "px"), d.style.setProperty("--canvas-stage-width", y + 48 + "px"), d.style.setProperty("--canvas-stage-height", C + 48 + "px"), S.options[0].textContent = "Fit (" + Math.round(O) + "%)", S.value = T, u("zoom-out").disabled = O <= 25, u("zoom-in").disabled = O >= 200;
  }
  function q(j) {
    T = j, T !== "fit" && (O = Number(T)), K(), T === "fit" && (d.scrollLeft = 0, d.scrollTop = 0);
  }
  S.addEventListener("change", () => q(S.value)), u("zoom-fit").addEventListener("click", () => q("fit")), u("zoom-in").addEventListener("click", () => q(String(N.find((j) => j > O + 0.1) || 200))), u("zoom-out").addEventListener("click", () => q(String([...N].reverse().find((j) => j < O - 0.1) || 25)));
  const _ = new ResizeObserver(K);
  return _.observe(d), K(), { update: K, destroy() {
    _.disconnect();
  } };
}
const Do = {
  "copy-format": '<path d="M3 3h12v7H3zM15 6h4v8h-8v7H8v-9h8V8M6 3v7M10 3v7"/>',
  "paste-format": '<path d="M3 3h12v7H3zM15 6h4v7h-8v8H8v-9h8V8M18 17h5m-2.5-2.5v5"/>',
  undo: '<path d="M9 5 4 10l5 5M4 10h10a6 6 0 0 1 0 12"/>',
  redo: '<path d="m15 5 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/>',
  "add-text": '<path d="M4 5h16M12 5v14M8 19h8"/>',
  "add-image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  "cut-objects": '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',
  "copy-objects": '<rect x="8" y="8" width="13" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
  "paste-objects": '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="8" y="2" width="8" height="5" rx="1"/><path d="M9 12h6M9 16h6"/>',
  duplicate: '<rect x="8" y="8" width="13" height="13" rx="1"/><path d="M16 8V3H3v13h5M11 14h7m-3.5-3.5v7"/>',
  delete: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  "bring-forward": '<rect x="3" y="9" width="12" height="12" rx="1"/><path d="M9 9V3h12v12h-6M9 3l6 6m0-5v5h-5"/>',
  "send-backward": '<rect x="9" y="3" width="12" height="12" rx="1"/><path d="M9 9H3v12h12v-6M3 21l6-6m-5 0h5v5"/>',
  bold: '<path d="M7 3h6a4.5 4.5 0 0 1 0 9H7zm0 9h7a4.5 4.5 0 0 1 0 9H7z"/>',
  italic: '<path d="M10 3h9M5 21h9M15 3 9 21"/>',
  "edit-link": '<path d="m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0m2 2 2-2a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0" transform="translate(1 0)"/>',
  "remove-link": '<path d="m10 13 4-4M7 16l-1 1a3.5 3.5 0 0 1-5-5l4-4m9-2 1-1a3.5 3.5 0 0 1 5 5l-4 4M3 3l18 18"/>',
  "bullet-list": '<circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/><path d="M9 6h12M9 12h12M9 18h12"/>',
  "ordered-list": '<path d="M3 3h1v5M2 8h4M2 13c0-3 4-3 4 0 0 2-4 2-4 5h4M10 5h11M10 12h11M10 19h11"/>',
  "presenter-view": '<rect x="2" y="4" width="20" height="14" rx="1"/><path d="M15 4v14M3 14h11M8 22l4-4 4 4M18 8h2m-2 4h2"/>',
  present: '<rect x="2" y="3" width="20" height="15" rx="1"/><path d="m10 7 6 4-6 4zM12 18v4M8 22h8"/>'
};
function To() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return s.setAttribute("viewBox", "0 0 24 24"), s.setAttribute("aria-hidden", "true"), s.setAttribute("focusable", "false"), s.setAttribute("fill", "none"), s.setAttribute("stroke", "currentColor"), s.setAttribute("stroke-width", "1.8"), s.setAttribute("stroke-linecap", "round"), s.setAttribute("stroke-linejoin", "round"), s;
}
function so(s, p = null) {
  const u = To();
  if (p) {
    u.setAttribute("viewBox", p.viewBox.join(" ")), u.setAttribute("stroke-width", String(Math.max(p.viewBox[2], p.viewBox[3]) / 12));
    for (const d of p.elements) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", d.tag);
      for (const [S, N] of Object.entries(d.attributes)) g.setAttribute(S, String(N));
      u.append(g);
    }
  } else
    u.innerHTML = Do[s.dataset.control] || '<circle cx="12" cy="12" r="8"/>';
  s.className = "clist-action-btn", s.type = "button", s.setAttribute("aria-label", s.title), s.replaceChildren(u);
}
function Fo(s, p) {
  const u = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" }, d = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u" };
  function g(N) {
    if (typeof N.toDelta == "function") {
      const q = p.createDocumentFragment();
      for (const _ of N.toDelta()) {
        if (typeof _.insert != "string") continue;
        let j = p.createTextNode(_.insert);
        for (const [U, y] of Object.entries(_.attributes || {})) {
          let C;
          d[U] ? C = p.createElement(d[U]) : U === "link" && typeof y?.href == "string" && /^(https?:|mailto:|tel:)/i.test(y.href) && (C = p.createElement("a"), C.href = y.href, C.target = "_blank", C.rel = "noopener noreferrer"), C && (C.append(j), j = C);
        }
        q.append(j);
      }
      return q;
    }
    const T = N.getAttributes?.() || {}, O = N.nodeName === "heading" ? "h" + Math.max(1, Math.min(6, Number(T.level) || 1)) : u[N.nodeName] || "div", K = p.createElement(O);
    N.nodeName === "orderedList" && Number.isInteger(T.start) && (K.start = T.start);
    for (const q of N.toArray?.() || []) K.append(g(q));
    return K;
  }
  const S = p.createDocumentFragment();
  for (const N of s.toArray()) S.append(g(N));
  return S;
}
function Po({ renderSlide: s, navigate: p, jump: u, present: d, end: g }) {
  const S = window.open("", "_blank", "popup,width=1200,height=850");
  if (!S) throw new Error("Allow pop-up windows for CList to open Presenter view.");
  const N = S.document;
  N.title = "CList Slides — Presenter view", N.documentElement.lang = "en";
  for (const R of document.querySelectorAll('link[rel="stylesheet"], style')) N.head.append(R.cloneNode(!0));
  N.body.className = "clist-presenter-page";
  const T = N.createElement("main");
  T.className = "clist-slides presenter-console", N.body.replaceChildren(T);
  const O = N.createElement("header");
  O.className = "presenter-header";
  const K = N.createElement("h1");
  K.textContent = "Presenter view";
  const q = N.createElement("span"), _ = N.createElement("span"), j = N.createElement("p");
  q.dataset.control = "presenter-position", _.dataset.control = "presenter-timer", _.setAttribute("aria-label", "Elapsed presentation time"), j.setAttribute("role", "status"), O.append(K, q, _);
  function U(R) {
    console.error("Presenter view failed:", R), j.textContent = R.message;
  }
  function y(R, ae, re) {
    const f = N.createElement("button");
    return f.className = "btn-small", f.textContent = R, f.title = R, f.dataset.control = ae, f.addEventListener("click", () => {
      try {
        Promise.resolve(re()).catch(U);
      } catch (x) {
        U(x);
      }
    }), O.append(f), f;
  }
  const C = y("Previous", "presenter-previous", () => p(-1)), D = y("Next", "presenter-next", () => p(1)), a = y("Present", "presenter-start", d), V = y("End presentation", "presenter-end", g);
  let H = 0, B = null;
  function te() {
    const R = Math.floor((H + (B === null ? 0 : Date.now() - B)) / 1e3);
    _.textContent = "Elapsed " + String(Math.floor(R / 60)).padStart(2, "0") + ":" + String(R % 60).padStart(2, "0");
  }
  y("Reset timer", "presenter-reset-timer", () => {
    H = 0, B !== null && (B = Date.now()), te();
  });
  const v = N.createElement("div");
  v.className = "presenter-grid";
  function m(R, ae) {
    const re = N.createElement("section"), f = N.createElement("h2"), x = N.createElement("div");
    return f.textContent = R, x.dataset.control = ae, re.append(f, x), v.append(re), x;
  }
  const Y = m("Current slide", "presenter-current"), oe = m("Next slide", "presenter-upcoming"), Z = N.createElement("h2"), ie = N.createElement("div"), ne = N.createElement("p");
  Z.textContent = "Speaker notes", ie.className = "presenter-notes", ie.dataset.control = "presenter-notes", ne.className = "helper", ne.textContent = "Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.", T.append(O, ne, j, v, Z, ie), S.addEventListener("keydown", (R) => {
    if (!(R.ctrlKey || R.altKey || R.metaKey || R.isComposing || R.key === " " && R.target?.tagName === "BUTTON" || !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", "Escape"].includes(R.key))) {
      R.preventDefault();
      try {
        R.key === "Escape" ? Promise.resolve(g()).catch(U) : R.key === "Home" || R.key === "End" ? u(R.key === "Home" ? "first" : "last") : p(["ArrowLeft", "ArrowUp", "PageUp"].includes(R.key) ? -1 : 1);
      } catch (re) {
        U(re);
      }
    }
  });
  const I = window.setInterval(() => {
    S.closed ? window.clearInterval(I) : te();
  }, 250);
  function M() {
    window.clearInterval(I), S.closed || S.close(), window.removeEventListener("beforeunload", M);
  }
  return S.addEventListener("unload", () => {
    window.clearInterval(I), window.removeEventListener("beforeunload", M);
  }), window.addEventListener("beforeunload", M), te(), {
    get closed() {
      return S.closed;
    },
    focus() {
      S.focus();
    },
    close: M,
    update({ id: R, nextId: ae, index: re, total: f, notes: x, presenting: le }) {
      if (!S.closed) {
        if (q.textContent = "Slide " + (re + 1) + " of " + f, ie.textContent = x || "No speaker notes for this slide.", Y.replaceChildren(s(R, N)), ae) oe.replaceChildren(s(ae, N));
        else {
          const we = N.createElement("p");
          we.textContent = "End of presentation", oe.replaceChildren(we);
        }
        C.disabled = re === 0, D.disabled = re === f - 1, a.disabled = le, V.disabled = !le, le && B === null ? B = Date.now() : !le && B !== null && (H += Date.now() - B, B = null), te();
      }
    }
  };
}
const Oo = [{ id: "rectangle", label: "Rectangle", width: 320, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } }] }, { id: "circle", label: "Circle", width: 220, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } }] }, { id: "line", label: "Line", width: 360, height: 4, defaults: { fillEnabled: !1, borderEnabled: !0, borderColour: "#202b3d", borderWidth: 4 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } }] }], Ro = {
  shapes: Oo
}, Uo = [{ id: "blank", label: "Blank", objects: [] }, { id: "title", label: "Title", objects: [{ kind: "text", x: 100, y: 260, width: 1080, height: 140, text: "Presentation title", fontSize: 64, textAlign: "center" }] }, { id: "title-body", label: "Title and body", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 1080, height: 400, text: "Add your content here.", fontSize: 32, textAlign: "left" }] }, { id: "two-columns", label: "Two columns", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 500, height: 400, text: "Left column", fontSize: 32, textAlign: "left" }, { kind: "text", x: 680, y: 220, width: 500, height: 400, text: "Right column", fontSize: 32, textAlign: "left" }] }], Bo = {
  layouts: Uo
}, Ho = [{ id: "classic", label: "Classic", fontFamily: "system", fontSize: 33.28, textColour: "#202b3d", background: "#ffffff", fillColour: "#51b158", borderColour: "#202b3d" }, { id: "midnight", label: "Midnight", fontFamily: "arial", fontSize: 33.28, textColour: "#f1f5f9", background: "#142033", fillColour: "#397ab8", borderColour: "#a6caed" }, { id: "paper", label: "Paper", fontFamily: "georgia", fontSize: 33.28, textColour: "#392f28", background: "#fff8e8", fillColour: "#dbb571", borderColour: "#76573a" }, { id: "ocean", label: "Ocean", fontFamily: "verdana", fontSize: 33.28, textColour: "#13354b", background: "#edf8fc", fillColour: "#56b6bd", borderColour: "#216479" }], qo = {
  themes: Ho
}, lo = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"]
}, kt = (s) => typeof s == "string" && /^#[0-9a-f]{6}$/i.test(s), xe = (s) => typeof s == "number" && Number.isFinite(s);
function P(s, p) {
  if (!s) throw new Error("Slide catalog: " + p);
}
function Et(s) {
  P(s && typeof s.id == "string" && /^[a-z][a-z0-9-]{0,79}$/.test(s.id), "invalid entry ID"), P(typeof s.label == "string" && s.label.trim().length > 0 && s.label.length <= 120, s.id + " needs a label");
}
function uo(s, p) {
  const u = {};
  for (const d of ["fillEnabled", "borderEnabled", "keepAspectRatio", "locked"])
    s[d] !== void 0 && (P(typeof s[d] == "boolean", p + ": invalid " + d), u[d] = s[d]);
  for (const d of ["fillColour", "borderColour", "textColour"])
    s[d] !== void 0 && (P(kt(s[d]), p + ": invalid " + d), u[d] = s[d]);
  for (const [d, g, S] of [["fontSize", 8, 200], ["borderWidth", 1, 20], ["rotation", -180, 180], ["cropX", 0, 100], ["cropY", 0, 100]])
    s[d] !== void 0 && (P(xe(s[d]) && s[d] >= g && s[d] <= S, p + ": invalid " + d), u[d] = s[d]);
  for (const [d, g] of [["textAlign", ["left", "center", "right", "justify"]], ["fontFamily", ["system", "arial", "verdana", "georgia", "times", "courier"]], ["imageFit", ["contain", "cover"]]])
    s[d] !== void 0 && (P(g.includes(s[d]), p + ": invalid " + d), u[d] = s[d]);
  return u;
}
function xt(s) {
  Et(s), P(xe(s.width) && s.width > 0 && s.width <= 1280 && xe(s.height) && s.height > 0 && s.height <= 720, s.id + ": invalid default dimensions"), P(Array.isArray(s.viewBox) && s.viewBox.length === 4 && s.viewBox.every(xe) && s.viewBox[2] > 0 && s.viewBox[3] > 0, s.id + ": invalid SVG viewBox"), P(Array.isArray(s.elements) && s.elements.length > 0 && s.elements.length <= 64, s.id + ": needs 1–64 SVG elements");
  const p = s.elements.map((u) => {
    P(u && Object.hasOwn(lo, u.tag), s.id + ": unsupported SVG element"), P(u.attributes && typeof u.attributes == "object", s.id + ": missing SVG attributes");
    const d = {};
    for (const [g, S] of Object.entries(u.attributes))
      P(lo[u.tag].includes(g), s.id + ": unsupported SVG attribute " + g), g === "d" ? P(typeof S == "string" && S.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(S), s.id + ": invalid path") : g === "points" ? P(typeof S == "string" && S.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(S), s.id + ": invalid points") : P(xe(S), s.id + ": invalid SVG coordinate"), d[g] = S;
    return { tag: u.tag, attributes: d };
  });
  return { id: s.id, label: s.label, width: s.width, height: s.height, defaults: uo(s.defaults || {}, s.id), viewBox: [...s.viewBox], elements: p };
}
function Wo(s, p) {
  Et(s), P(Array.isArray(s.objects) && s.objects.length <= 100, s.id + ": invalid objects array"), s.background !== void 0 && P(kt(s.background), s.id + ": invalid background"), s.notes !== void 0 && P(typeof s.notes == "string", s.id + ": invalid notes");
  const u = s.objects.map((d) => {
    P(d && ["text", "shape", "image"].includes(d.kind), s.id + ": unsupported object kind"), P(["x", "y", "width", "height"].every((S) => xe(d[S])) && d.x >= 0 && d.y >= 0 && d.width > 0 && d.height > 0 && d.x + d.width <= 1280 && d.y + d.height <= 720, s.id + ": object is outside the slide");
    const g = { kind: d.kind, x: d.x, y: d.y, width: d.width, height: d.height, ...uo(d, s.id) };
    return d.kind === "text" && (P(typeof d.text == "string", s.id + ": text object needs text"), g.text = d.text), d.kind === "shape" && (P(p.has(d.shapeId), s.id + ": unknown shape " + d.shapeId), g.shapeId = d.shapeId), d.kind === "image" && (P(typeof d.source == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(d.source), s.id + ": image needs embedded image data"), g.source = d.source, g.alt = typeof d.alt == "string" ? d.alt : ""), d.group !== void 0 && (P(typeof d.group == "string" && d.group.length <= 80, s.id + ": invalid group"), g.group = d.group), g;
  });
  return { id: s.id, label: s.label, objects: u, ...s.background !== void 0 ? { background: s.background } : {}, ...s.notes !== void 0 ? { notes: s.notes } : {} };
}
function po(s) {
  Et(s), P(["system", "arial", "verdana", "georgia", "times", "courier"].includes(s.fontFamily), s.id + ": invalid theme font"), P(xe(s.fontSize) && s.fontSize >= 8 && s.fontSize <= 200, s.id + ": invalid theme font size");
  const p = { id: s.id, label: s.label, fontFamily: s.fontFamily, fontSize: s.fontSize };
  for (const u of ["textColour", "background", "fillColour", "borderColour"])
    P(kt(s[u]), s.id + ": invalid theme " + u), p[u] = s[u];
  return p;
}
function wt(s = {}) {
  const p = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), g = s.shapes === void 0 ? Ro.shapes : s.shapes, S = s.layouts === void 0 ? Bo.layouts : s.layouts;
  P(Array.isArray(g) && g.length > 0, "shapes must be a nonempty array"), P(Array.isArray(S) && S.length > 0, "layouts must be a nonempty array");
  for (const T of g) {
    const O = xt(T);
    P(!p.has(T.id), "duplicate shape ID " + T.id), p.set(T.id, O);
  }
  for (const T of S) {
    const O = Wo(T, p);
    P(!u.has(T.id), "duplicate layout ID " + T.id), u.set(T.id, O);
  }
  const N = s.themes === void 0 ? qo.themes : s.themes;
  P(Array.isArray(N) && N.length > 0, "themes must be a nonempty array");
  for (const T of N) {
    const O = po(T);
    P(!d.has(T.id), "duplicate theme ID " + T.id), d.set(T.id, O);
  }
  return { shapes: p, layouts: u, themes: d };
}
async function $o(s) {
  const p = await Promise.all(["shapes", "layouts", "themes"].map(async (d) => {
    const g = await fetch(new URL(d + ".json", s), { cache: "no-cache" });
    if (!g.ok) throw new Error("Could not load slide " + d + " catalog (HTTP " + g.status + ").");
    const S = await g.json();
    return P(S && S.version === 1, "unsupported " + d + " catalog version"), P(Array.isArray(S[d]), d + " catalog needs a " + d + " array"), S[d];
  })), u = { shapes: p[0], layouts: p[1], themes: p[2] };
  return wt(u), u;
}
function Xo(s, p = {}) {
  if (!(s instanceof HTMLElement)) throw new TypeError("A container element is required");
  const { Y: u, Editor: d, StarterKit: g, Collaboration: S, HocuspocusProvider: N, Link: T } = p.dependencies, { shapes: O, layouts: K, themes: q } = wt(p.catalogs), _ = wt().shapes.values().next().value, j = /* @__PURE__ */ new WeakMap(), U = /* @__PURE__ */ new Map(), y = document.createElement("div");
  y.className = "clist-slides app", y.innerHTML = jo, s.append(y);
  const C = 1280, D = 720, a = (e) => y.querySelector(`[data-control="${e}"]`), V = a("slide-order-actions");
  for (const e of y.querySelectorAll(".tools button")) so(e);
  for (const e of O.values()) {
    const t = document.createElement("button");
    t.className = "btn-small", t.dataset.control = "add-" + e.id, t.title = "Add " + e.label, so(t, e), t.addEventListener("click", () => vo(e.id)), a("shape-tools").append(t);
  }
  for (const e of K.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, a("slide-layout").append(t);
  }
  const H = a("slide"), B = document.createElement("div"), te = document.createElement("div");
  B.className = "alignment-guide vertical", te.className = "alignment-guide horizontal", B.hidden = te.hidden = !0, H.append(B, te);
  let v = new u.Doc(), m = v.getMap("slide-objects"), Y = v.getMap("slide-pages"), oe = v.getMap("slide-backgrounds"), Z = v.getMap("slide-notes"), ie = v.getMap("clist_refs"), ne = v.getMap("slide-design"), I = "first";
  const M = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Map();
  let ae = null, re = !1;
  const f = /* @__PURE__ */ new Set();
  let x = null, le = null, we = !1, de = null, he = 0, _e = null, Ct = !1, Ze = null, G = null, ke = null, Ie = null, L = null, Ue = !1, k = !1, Qe = null, ue = null, et = null, Be = null, St = null, Ee = !1;
  const Mt = Io(y, () => k);
  let be = null, tt = null;
  a("server-url").value = p.url || "", a("doc-name").value = p.documentName || "clist-slide-demo";
  function z(e, t = "") {
    a("connection-status").textContent = e, a("connection-status").className = `status ${t}`;
  }
  function Ce(e, t, o, n, r, i = null, c = "") {
    const l = new u.Map();
    l.set("x", t), l.set("y", o), l.set("width", n), l.set("height", r), l.set("rotation", 0), l.set("slide", I), l.set("layer", Math.max(-1, ...Q().map((b) => ge(m.get(b)))) + 1), i && (l.set("kind", "image"), l.set("source", i), l.set("alt", c), l.set("imageRatio", n / r), l.set("aspectRatio", n / r), l.set("keepAspectRatio", !0)), m.set(e, l);
  }
  function Lt() {
    m.size || we || (we = !0, v.transact(() => {
      m.size || (ne.has("theme") || ne.set("theme", structuredClone(Se())), Ce("title", 105, 98, 820, 135), Ce("body", 108, 296, 690, 240));
    }, "init"), M.get("title")?.editor.commands.setContent("<h1>Collaborative slides</h1>"), M.get("body")?.editor.commands.setContent("<p>Click here to edit together.</p><p>Drag the blue handle to move this box, or resize it from the lower-right corner.</p>"));
  }
  function fo(e, t) {
    const o = document.createElement("div");
    o.className = t.get("kind") === "shape" ? "slide-object shape-object" : "slide-object", o.dataset.id = e, o.tabIndex = 0, o.setAttribute("aria-label", t.get("kind") === "shape" ? "Shape object. Arrow keys move; Delete removes." : t.get("kind") === "image" ? "Image object. Arrow keys move; Delete removes." : "Text object. Arrow keys move; Enter edits.");
    const n = document.createElement("div");
    n.className = "object-grip", n.textContent = "Move";
    const r = document.createElement("div");
    r.className = t.get("kind") === "shape" ? "shape-content" : t.get("kind") === "image" ? "image-content" : "text-content";
    const i = document.createElement("div");
    i.className = "resize-handle", o.append(n, r, i), H.append(o);
    let c = null;
    if (t.get("kind") === "shape")
      r.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    else if (t.get("kind") === "image") {
      const l = document.createElement("img");
      l.src = Oe(t.get("source")), l.alt = typeof t.get("alt") == "string" ? t.get("alt") : "", l.draggable = !1, l.addEventListener("load", () => {
        M.has(e) && at(e);
      }), r.append(l);
    } else {
      const l = v.getXmlFragment(`slide-text-${e}`);
      L?.addToScope(l), Ue = !0;
      try {
        c = new d({
          element: r,
          editable: !k,
          extensions: [
            g.configure({ undoRedo: !1, history: !1, link: !1 }),
            T.configure({ openOnClick: !1, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
            S.configure({ document: v, field: `slide-text-${e}` })
          ],
          editorProps: {
            attributes: { "aria-label": `Edit text in ${e}` }
          },
          onFocus: () => {
            le = e, J(e, !1, f.has(e));
          },
          onBlur: () => {
            le === e && (le = null), L?.stopCapturing();
          }
        });
      } finally {
        Ue = !1;
      }
    }
    o.addEventListener("pointerdown", (l) => {
      if (!k) {
        if (l.shiftKey && l.target !== i && l.target !== n) {
          l.preventDefault(), l.stopPropagation(), J(e, !0, !1, !0), y.tabIndex = -1, y.focus({ preventScroll: !0 });
          return;
        }
        l.target !== i && l.target !== n && J(e, !1, !1, !0), c || o.focus({ preventScroll: !0 });
      }
    }), o.addEventListener("focus", () => J(e, !1, f.has(e))), n.addEventListener("pointerdown", (l) => It(l, e, "move")), i.addEventListener("pointerdown", (l) => It(l, e, "resize")), M.set(e, { node: o, editor: c, box: t, content: r }), at(e), x === e && o.classList.add("selected");
  }
  const De = {
    system: "system-ui, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    georgia: "Georgia, serif",
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace'
  };
  function Se() {
    const e = ne.get("theme");
    if (e)
      try {
        return po(e);
      } catch {
      }
    return q.values().next().value;
  }
  for (const e of q.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, a("theme").append(t);
  }
  a("theme").addEventListener("change", (e) => {
    const t = q.get(e.target.value);
    !t || k || (L?.stopCapturing(), ne.set("theme", structuredClone(t)), L?.stopCapturing(), z("Theme applied: " + t.label));
  });
  function go() {
    const e = Se();
    let t = a("theme").querySelector("[data-document-theme]");
    q.has(e.id) ? t?.remove() : (t || (t = document.createElement("option"), t.dataset.documentTheme = "", a("theme").append(t)), t.value = e.id, t.textContent = e.label + " (saved in presentation)"), a("theme").value = e.id;
    const o = a("theme-preview");
    o.replaceChildren();
    for (const n of [e.background, e.textColour, e.fillColour, e.borderColour]) {
      const r = document.createElement("span");
      r.style.backgroundColor = n, o.append(r);
    }
  }
  function Me(e) {
    const t = Se(), o = (r, i) => /^#[0-9a-f]{6}$/i.test(e.get(r) || "") ? e.get(r) : i, n = Number(e.get("borderWidth"));
    return {
      fill: e.get("fillEnabled") === !0,
      fillColour: o("fillColour", e.get("kind") === "shape" ? t.fillColour : t.background),
      border: e.get("borderEnabled") === !0,
      borderColour: o("borderColour", t.borderColour),
      width: Number.isFinite(n) && n >= 1 && n <= 20 ? n : 2
    };
  }
  function ye(e) {
    const t = Se(), o = Number(e.get("fontSize")), n = e.get("textColour"), r = e.get("textAlign");
    return {
      size: Number.isFinite(o) && o >= 8 && o <= 200 ? o : t.fontSize,
      colour: typeof n == "string" && /^#[0-9a-f]{6}$/i.test(n) ? n : t.textColour,
      align: ["left", "center", "right", "justify"].includes(r) ? r : "left",
      family: Object.prototype.hasOwnProperty.call(De, e.get("fontFamily")) ? e.get("fontFamily") : t.fontFamily
    };
  }
  function ge(e) {
    const t = e.get("layer");
    return typeof t == "number" && Number.isFinite(t) ? t : 0;
  }
  function Q(e = I) {
    return [...m.keys()].filter((t) => {
      const o = m.get(t);
      return o instanceof u.Map && (o.get("slide") || "first") === e;
    }).sort((t, o) => ge(m.get(t)) - ge(m.get(o)) || t.localeCompare(o));
  }
  function jt(e) {
    const t = (o) => {
      const n = e.get(o);
      return typeof n == "number" && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 50;
    };
    return { fit: e.get("imageFit") === "cover" ? "cover" : "contain", x: t("cropX"), y: t("cropY") };
  }
  function Te(e, t) {
    const o = Number(e.get("cropImageWidth")), n = Number(e.get("cropImageHeight"));
    if (o > 0 && n > 0) return { width: o, height: n };
    const r = t?.naturalWidth > 0 ? t.naturalWidth / t.naturalHeight : Number(e.get("imageRatio")) || gt(e), i = Math.max(e.get("width"), e.get("height") * r);
    return { width: i, height: i / r };
  }
  function ot(e) {
    if (e.get("kind") !== "image" || e.get("imageFit") !== "cover") return;
    const t = M.get([...m.keys()].find((n) => m.get(n) === e))?.content.querySelector("img"), o = Te(e, t);
    e.set("cropImageWidth", o.width), e.set("cropImageHeight", o.height);
  }
  function nt(e, t, o = !1) {
    const n = jt(t);
    if (e.style.objectFit = "contain", e.style.objectPosition = n.x + "% " + n.y + "%", n.fit === "cover") {
      const r = Te(t, e);
      e.style.position = "absolute", e.style.width = o ? r.width / 12.8 + "cqw" : 100 * r.width / t.get("width") + "%", e.style.height = o ? r.height / 12.8 + "cqw" : 100 * r.height / t.get("height") + "%", e.style.left = o ? (t.get("width") - r.width) * n.x / 1280 + "cqw" : (t.get("width") - r.width) * n.x / t.get("width") + "%", e.style.top = o ? (t.get("height") - r.height) * n.y / 1280 + "cqw" : (t.get("height") - r.height) * n.y / t.get("height") + "%";
    } else
      e.style.position = "static", e.style.width = e.style.height = "100%", e.style.left = e.style.top = "";
  }
  function rt(e) {
    const t = e.get("shapeDefinition");
    if (t && typeof t == "object") {
      if (!j.has(t))
        try {
          j.set(t, xt(t));
        } catch (o) {
          console.error("Invalid saved shape definition:", o), z("A saved shape definition is invalid; showing a fallback shape.", "error"), j.set(t, _);
        }
      return j.get(t);
    }
    return O.get(e.get("shapeType")) || _;
  }
  function At(e) {
    const { fillColour: t, borderColour: o, ...n } = e.defaults;
    return { kind: "shape", shapeType: e.id, shapeDefinition: structuredClone(e), ...n };
  }
  function it(e, t) {
    const o = "http://www.w3.org/2000/svg", n = Math.max(1, Number(t.get("width")) || 1), r = Math.max(1, Number(t.get("height")) || 1), i = Me(t), c = rt(t), l = i.border ? Math.min(i.width, n, r) : 0, [b, h, w, E] = c.viewBox;
    e.setAttribute("viewBox", "0 0 " + n + " " + r), e.setAttribute("preserveAspectRatio", "none");
    const A = document.createElementNS(o, "g");
    A.setAttribute("transform", "translate(" + l / 2 + " " + l / 2 + ") scale(" + Math.max(1e-3, n - l) / w + " " + Math.max(1e-3, r - l) / E + ") translate(" + -b + " " + -h + ")");
    for (const $ of c.elements) {
      const se = document.createElementNS(o, $.tag);
      for (const [F, fe] of Object.entries($.attributes)) se.setAttribute(F, String(fe));
      se.setAttribute("fill", i.fill ? i.fillColour : "none"), se.setAttribute("stroke", i.border ? i.borderColour : "none"), se.setAttribute("vector-effect", "non-scaling-stroke"), se.style.strokeWidth = 100 * l / n + "cqw", se.setAttribute("stroke-linecap", "round"), se.setAttribute("stroke-linejoin", "round"), A.append(se);
    }
    e.replaceChildren(A);
  }
  function at(e) {
    const t = M.get(e);
    if (!t) return;
    const { node: o, box: n } = t;
    if (o.style.left = `${100 * Number(n.get("x") || 0) / C}%`, o.style.top = `${100 * Number(n.get("y") || 0) / D}%`, o.style.width = `${100 * Number(n.get("width") || 0) / C}%`, o.style.height = `${100 * Number(n.get("height") || 0) / D}%`, o.style.transform = `rotate(${Number(n.get("rotation") || 0)}deg)`, o.classList.toggle("locked", n.get("locked") === !0), o.title = n.get("locked") === !0 ? "Locked object: select it and click Unlock to move, resize or delete." : "", o.style.zIndex = String(Q().indexOf(e)), n.get("kind") === "shape") it(t.content.querySelector("svg"), n);
    else if (!t.editor) {
      const r = t.content.querySelector("img"), i = Oe(n.get("source"));
      r.getAttribute("src") !== i && (r.src = i), r.alt = typeof n.get("alt") == "string" ? n.get("alt") : "", nt(r, n, !0);
    }
    if (t.editor) {
      const r = ye(n);
      o.style.setProperty("--slide-font-size", r.size / 12.8 + "cqw"), o.style.fontFamily = De[r.family], o.style.color = r.colour, o.style.textAlign = r.align;
      const i = Me(n);
      t.content.style.backgroundColor = i.fill ? i.fillColour : "transparent", t.content.style.border = i.border ? i.width / 12.8 + "cqw solid " + i.borderColour : "none";
    }
  }
  function Fe() {
    const e = Z.get(I), t = typeof e == "string" ? e : "";
    a("speaker-notes").value !== t && (a("speaker-notes").value = t);
  }
  a("speaker-notes").addEventListener("input", (e) => {
    k || Z.set(I, e.target.value);
  });
  function Pe(e) {
    const t = oe.get(e);
    return typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t : Se().background;
  }
  a("slide-background").addEventListener("change", (e) => {
    if (k) return;
    const t = e.target.value;
    /^#[0-9a-f]{6}$/i.test(t) && oe.set(I, t);
  });
  function ee() {
    return Y.size ? [...Y.keys()].sort((e, t) => Y.get(e) - Y.get(t) || e.localeCompare(t)) : ["first"];
  }
  function zt() {
    const e = a("object-list"), t = Q().reverse();
    for (const [o, n] of R)
      t.includes(o) || (n.remove(), R.delete(o));
    t.forEach((o, n) => {
      const r = m.get(o), i = r.get("kind") === "image", c = r.get("kind") === "shape", l = i ? r.get("alt") : M.get(o)?.editor?.getText(), b = (typeof l == "string" ? l : "").replace(/\s+/g, " ").trim().slice(0, 60), h = c ? "Shape: " + rt(r).label : (i ? "Image: " : "Text: ") + (b || (i ? "Untitled image" : "Empty text box"));
      let w = R.get(o);
      w || (w = document.createElement("button"), w.className = "btn-small", w.dataset.objectId = o, w.addEventListener("click", (E) => {
        k || (X(), J(o, E.shiftKey, !1, !0), y.tabIndex = -1, y.focus({ preventScroll: !0 }));
      }), R.set(o, w)), w.textContent = h + (r.get("groupId") ? " (Grouped)" : "") + (r.get("locked") === !0 ? " (Locked)" : ""), w.title = "Select " + h + ". Shift-click to add or remove from selection.", w.setAttribute("aria-pressed", String(f.has(o))), e.children[n] !== w && e.insertBefore(w, e.children[n] || null);
    });
  }
  function st() {
    for (const e of y.querySelectorAll(".slide-drop-before, .slide-drop-after, .slide-dragging")) e.classList.remove("slide-drop-before", "slide-drop-after", "slide-dragging");
  }
  function lt() {
    st(), be = null, tt = null;
  }
  const me = y.querySelector(".rail");
  me.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-slide-id]");
    if (!t || k || ee().length < 2 || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    X(), be = t.dataset.slideId, e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", "CList slide"), t.classList.add("slide-dragging");
  }), me.addEventListener("dragover", (e) => {
    if (!be || k) return;
    e.preventDefault(), e.dataTransfer.dropEffect = "move", st();
    const t = [...a("slide-list").querySelectorAll(":scope > [data-slide-id]")], o = t.find((i) => {
      const c = i.getBoundingClientRect();
      return e.clientY < c.top + c.height / 2;
    });
    tt = o?.dataset.slideId || null, (o || t.at(-1))?.classList.add(o ? "slide-drop-before" : "slide-drop-after"), t.find((i) => i.dataset.slideId === be)?.classList.add("slide-dragging");
    const r = me.getBoundingClientRect();
    e.clientY < r.top + 35 ? me.scrollTop -= 18 : e.clientY > r.bottom - 35 && (me.scrollTop += 18);
  }), me.addEventListener("dragleave", (e) => {
    me.contains(e.relatedTarget) || st();
  }), me.addEventListener("dragend", lt), me.addEventListener("drop", (e) => {
    if (!be || k) return;
    e.preventDefault();
    const t = be, o = tt;
    lt();
    const n = ee();
    if (!n.includes(t) || t === o || o && !n.includes(o)) return;
    const r = n.filter((i) => i !== t);
    r.splice(o ? r.indexOf(o) : r.length, 0, t), !r.every((i, c) => i === n[c]) && (I = t, x = null, f.clear(), L?.stopCapturing(), v.transact(() => r.forEach((i, c) => Y.set(i, c))), L?.stopCapturing(), z("Slide moved to position " + (r.indexOf(t) + 1)));
  });
  function Le() {
    be && lt(), bt(), zt();
    const e = ee(), t = a("slide-list");
    V.remove(), t.replaceChildren(), e.forEach((n, r) => {
      const i = document.createElement("button");
      i.className = "clist-action-btn", i.title = "Select slide " + (r + 1) + ". Drag to reorder.", i.dataset.slideId = n, i.draggable = e.length > 1 && !k, i.setAttribute("aria-pressed", String(n === I));
      const c = document.createElement("div");
      c.className = "slide-thumb" + (n === I ? " selected" : "");
      const l = document.createElement("div");
      l.className = "mini-slide", l.style.backgroundColor = Pe(n), m.forEach((h, w) => {
        if (!(h instanceof u.Map) || (h.get("slide") || "first") !== n) return;
        const E = document.createElement("div");
        if (E.className = "mini-object", E.style.zIndex = String(Q(n).indexOf(w)), E.style.transform = `rotate(${Number(h.get("rotation")) || 0}deg)`, E.style.left = 100 * h.get("x") / C + "%", E.style.top = 100 * h.get("y") / D + "%", E.style.width = 100 * h.get("width") / C + "%", E.style.height = 100 * h.get("height") / D + "%", h.get("kind") === "shape") {
          const A = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          it(A, h), E.append(A);
        } else if (h.get("kind") === "image") {
          const A = document.createElement("img");
          A.src = Oe(h.get("source")), A.alt = "", A.draggable = !1, nt(A, h), E.append(A);
        } else {
          const A = ye(h);
          E.style.color = A.colour, E.style.fontFamily = De[A.family], E.style.background = "transparent", E.textContent = v.getXmlFragment("slide-text-" + w).toString().replace(/<[^>]*>/g, " ");
        }
        l.append(E);
      });
      const b = document.createElement("span");
      b.textContent = String(r + 1), c.append(l, b), i.append(c), i.addEventListener("click", () => {
        X(), x = null, f.clear(), I = n, W();
      }), t.append(i), n === I && t.append(V);
    });
    const o = e.indexOf(I);
    a("slide-label").textContent = "Slide " + (o + 1) + " of " + e.length, a("slide-up").disabled = o <= 0, a("slide-down").disabled = o >= e.length - 1, a("delete-slide").disabled = e.length <= 1, a("presentation-position").textContent = o + 1 + " / " + e.length, a("previous-slide").disabled = o <= 0, a("next-slide").disabled = o >= e.length - 1;
  }
  function W() {
    go();
    const e = ee();
    e.includes(I) || (X(), x = null, f.clear(), I = e[0]), Fe(), H.style.backgroundColor = Pe(I), a("slide-background").value = Pe(I);
    for (const [r, i] of M)
      (!m.has(r) || (m.get(r).get("slide") || "first") !== I) && (i.editor?.destroy(), i.node.remove(), M.delete(r), f.delete(r), x === r && (x = [...f].at(-1) || null));
    m.forEach((r, i) => {
      !(r instanceof u.Map) || (r.get("slide") || "first") !== I || (M.has(i) ? (M.get(i).box = r, at(i)) : fo(i, r));
    });
    const t = [...M.values()].filter((r) => r.box.get("kind") === "image").length, o = [...M.values()].filter((r) => r.box.get("kind") === "shape").length, n = M.size - t - o;
    a("count").textContent = `${n} text box${n === 1 ? "" : "es"}, ${t} image${t === 1 ? "" : "s"}, ${o} shape${o === 1 ? "" : "s"}`, J(x, !1, !0), Le();
  }
  function ct(e) {
    if (!M.has(e)) return [];
    const t = m.get(e)?.get("groupId");
    return typeof t == "string" && t ? Q().filter((o) => m.get(o).get("groupId") === t) : [e];
  }
  function Nt(e = !1) {
    if (k || ce() || !f.size || !e && f.size < 2) return;
    X();
    const t = "group-" + crypto.randomUUID();
    L?.stopCapturing(), v.transact(() => {
      for (const o of f)
        e ? m.get(o).delete("groupId") : m.get(o).set("groupId", t);
    }), L?.stopCapturing(), z(e ? "Selected objects ungrouped." : "Selected objects grouped.");
  }
  a("group-objects").addEventListener("click", () => Nt()), a("ungroup-objects").addEventListener("click", () => Nt(!0));
  function dt(e, t) {
    const o = { ...e };
    return typeof o.groupId == "string" && o.groupId && (t.has(o.groupId) || t.set(o.groupId, "group-" + crypto.randomUUID()), o.groupId = t.get(o.groupId)), o;
  }
  function mo(e = !1) {
    if (k) return;
    const t = [...f].sort().map((c) => c + ":" + (m.get(c)?.get("kind") || "text")).join("|");
    if (!e && t === St) return;
    St = t;
    const o = m.get(x), n = f.size > 1 ? "arrange" : o ? o.get("kind") === "image" ? "images" : o.get("kind") === "shape" ? "appearance" : "text" : "slide", r = y.querySelector(".inspector"), i = r.querySelector('[data-panel="' + n + '"]');
    for (const c of r.querySelectorAll(":scope > .control-section")) c.open = c === i;
    i && (r.scrollTop += i.getBoundingClientRect().top - r.getBoundingClientRect().top - r.clientTop);
  }
  function J(e, t = !1, o = !1, n = !1) {
    for (const F of f) M.has(F) || f.delete(F);
    if (t && e && M.has(e)) {
      const F = ct(e), fe = F.every((Je) => f.has(Je));
      for (const Je of F)
        fe ? f.delete(Je) : f.add(Je);
    } else if (!o) {
      f.clear();
      for (const F of ct(e)) f.add(F);
    }
    if (o) for (const F of [...f]) for (const fe of ct(F)) f.add(fe);
    x = f.has(e) ? e : [...f].at(-1) || null;
    for (const [F, fe] of M) fe.node.classList.toggle("selected", f.has(F));
    const r = f.size > 1, i = ce();
    y.classList.toggle("multi-selection", r);
    const c = [...f].map((F) => m.get(F)?.get("groupId")), l = c.length > 1 && !!c[0] && c.every((F) => F === c[0]);
    a("group-objects").disabled = i || !r || l, a("ungroup-objects").disabled = i || !c.some(Boolean), a("lock-objects").disabled = !f.size || [...f].every((F) => m.get(F)?.get("locked") === !0), a("unlock-objects").disabled = !i, a("distribute-horizontal").disabled = a("distribute-vertical").disabled = i || f.size < 3;
    for (const F of ["left", "center", "right", "top", "middle", "bottom"]) a("align-" + F).disabled = i || !r;
    const b = x ? m.get(x) : null;
    a("selection-details").textContent = r ? f.size + " objects selected. Drag a Move handle or use arrow keys to move together." : b ? `${x}
Position: ${Math.round(b.get("x"))}, ${Math.round(b.get("y"))}
Size: ${Math.round(b.get("width"))} × ${Math.round(b.get("height"))}` : "Select an object";
    for (const F of ["x", "y", "width", "height"]) {
      const fe = a("object-" + F);
      fe.disabled = i || !b || r, fe.value = b ? String(Math.round(Number(b.get(F)) || 0)) : "";
    }
    a("keep-aspect-ratio").disabled = i || r || b?.get("kind") !== "image", a("keep-aspect-ratio").checked = b?.get("kind") === "image" && b.get("keepAspectRatio") !== !1;
    const h = b ? jt(b) : { fit: "contain", x: 50, y: 50 }, w = i || r || b?.get("kind") !== "image";
    a("image-description").disabled = w;
    const E = !r && b?.get("kind") === "image" && typeof b.get("alt") == "string" ? b.get("alt") : "";
    a("image-description").value !== E && (a("image-description").value = E), a("replace-image").disabled = w, a("image-fit").disabled = w, a("image-fit").value = h.fit, a("crop-x").disabled = a("crop-y").disabled = w || h.fit !== "cover", a("crop-x").value = String(h.x), a("crop-y").value = String(h.y), a("object-rotation").disabled = i || !b || r, a("object-rotation").value = b ? String(Number(b.get("rotation")) || 0) : "", a("cut-objects").disabled = !f.size || i, a("copy-objects").disabled = !f.size, Gt(), a("paste-objects").disabled = !G?.items.length, a("duplicate").disabled = !x || r, a("delete").disabled = i || !x;
    const A = Q(), $ = A.indexOf(x);
    a("bring-forward").disabled = i || r || $ < 0 || $ === A.length - 1, a("send-backward").disabled = i || r || $ <= 0, a("bold").disabled = r || !M.get(x)?.editor, a("italic").disabled = r || !M.get(x)?.editor, a("edit-link").disabled = r || !M.get(x)?.editor, a("remove-link").disabled = r || !M.get(x)?.editor, Ie && x !== Ie && je(), a("bullet-list").disabled = r || !M.get(x)?.editor, a("ordered-list").disabled = r || !M.get(x)?.editor;
    for (const F of ["font-family", "font-size", "text-colour", "text-align"]) a(F).disabled = r || !M.get(x)?.editor;
    const se = b && !r && (!!M.get(x)?.editor || b.get("kind") === "shape");
    for (const F of ["fill-enabled", "fill-colour", "border-enabled", "border-colour", "border-width"]) a(F).disabled = !se;
    if (se) {
      const F = Me(b);
      a("fill-enabled").checked = F.fill, a("fill-colour").value = F.fillColour, a("fill-colour").disabled = !F.fill, a("border-enabled").checked = F.border, a("border-colour").value = F.borderColour, a("border-width").value = String(F.width), a("border-colour").disabled = a("border-width").disabled = !F.border;
    }
    if (b && !r && M.get(x)?.editor) {
      const F = ye(b);
      a("font-family").value = F.family, a("font-size").value = String(Math.round(F.size)), a("text-colour").value = F.colour, a("text-align").value = F.align;
    }
    zt(), mo(n), et?.schedule();
  }
  function It(e, t, o) {
    if (k || e.button !== 0) return;
    if (e.preventDefault(), e.stopPropagation(), L?.stopCapturing(), L && (L.captureTimeout = 1 / 0), J(t, !1, o === "move" && f.has(t), !0), ce()) {
      X(), z("Unlock selected objects before moving or resizing.", "error");
      return;
    }
    M.get(t)?.node.focus({ preventScroll: !0 });
    const n = m.get(t);
    if (!n) return;
    o === "resize" && ot(n);
    const r = C / H.getBoundingClientRect().width, i = [...f].map((l) => ({ id: l, ...m.get(l).toJSON() })), c = He(i);
    de = {
      members: i,
      id: t,
      action: o,
      startX: e.clientX,
      startY: e.clientY,
      scale: r,
      original: o === "move" ? c : {
        x: n.get("x"),
        y: n.get("y"),
        width: n.get("width"),
        height: n.get("height")
      }
    }, de.target = e.currentTarget, de.pointerId = e.pointerId, e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.addEventListener("pointermove", Pt), e.currentTarget.addEventListener("pointerup", X, { once: !0 }), e.currentTarget.addEventListener("pointercancel", X, { once: !0 });
  }
  function He(e) {
    const t = Math.min(...e.map((n) => n.x)), o = Math.min(...e.map((n) => n.y));
    return { x: t, y: o, width: Math.max(...e.map((n) => n.x + n.width)) - t, height: Math.max(...e.map((n) => n.y + n.height)) - o };
  }
  function ce() {
    return [...f].some((e) => m.get(e)?.get("locked") === !0);
  }
  function Dt(e) {
    k || !f.size || (X(), v.transact(() => {
      for (const t of f) m.get(t)?.set("locked", e);
    }), z(e ? "Selected objects locked." : "Selected objects unlocked."));
  }
  a("lock-objects").addEventListener("click", () => Dt(!0)), a("unlock-objects").addEventListener("click", () => Dt(!1));
  function qe(e) {
    const t = (Number(e.rotation) || 0) * Math.PI / 180, o = Math.abs(e.width * Math.cos(t)) + Math.abs(e.height * Math.sin(t)), n = Math.abs(e.width * Math.sin(t)) + Math.abs(e.height * Math.cos(t));
    return { x: e.x + (e.width - o) / 2, y: e.y + (e.height - n) / 2, width: o, height: n };
  }
  function ho(e) {
    if (k || ce() || f.size < 2) return;
    X();
    const t = [...f].map((n) => ({ id: n, ...m.get(n).toJSON() })), o = He(t.map(qe));
    L?.stopCapturing(), v.transact(() => {
      for (const n of t) {
        const r = m.get(n.id), i = qe(n);
        let c = 0, l = 0;
        e === "left" && (c = o.x - i.x), e === "center" && (c = o.x + o.width / 2 - i.x - i.width / 2), e === "right" && (c = o.x + o.width - i.x - i.width), e === "top" && (l = o.y - i.y), e === "middle" && (l = o.y + o.height / 2 - i.y - i.height / 2), e === "bottom" && (l = o.y + o.height - i.y - i.height), ["left", "center", "right"].includes(e) ? r.set("x", n.x + c) : r.set("y", n.y + l);
      }
    }, "geometry"), L?.stopCapturing();
  }
  for (const e of ["left", "center", "right", "top", "middle", "bottom"])
    a("align-" + e).addEventListener("click", () => ho(e));
  function Tt(e) {
    if (k || ce() || f.size < 3) return;
    X();
    const t = e ? "y" : "x", o = e ? "height" : "width", n = [...f].map((w) => {
      const E = m.get(w).toJSON();
      return { id: w, box: E, bounds: qe(E) };
    }).sort((w, E) => w.bounds[t] - E.bounds[t] || w.id.localeCompare(E.id)), r = n[0], i = n[n.length - 1], c = r.bounds[t], l = i.bounds[t] + i.bounds[o], b = n.reduce((w, E) => w + E.bounds[o], 0), h = (l - c - b) / (n.length - 1);
    if (h < -1e-6) {
      const E = "Not enough room " + (e ? "vertically" : "horizontally") + ": the objects need " + Math.ceil(b) + " px, but their outer edges span only " + Math.floor(l - c) + " px. Move the outermost objects farther apart or make the objects smaller.";
      a("distribution-status").textContent = E, z(E, "error");
      return;
    }
    L?.stopCapturing(), v.transact(() => {
      let w = c + r.bounds[o] + Math.max(0, h);
      for (let E = 1; E < n.length - 1; E++) {
        const A = n[E];
        m.get(A.id).set(t, A.box[t] + w - A.bounds[t]), w += A.bounds[o] + Math.max(0, h);
      }
    }, "geometry"), L?.stopCapturing(), a("distribution-status").textContent = "Distributed " + n.length + " objects " + (e ? "vertically" : "horizontally") + " with " + Math.round(Math.max(0, h)) + " px gaps.";
  }
  a("distribute-horizontal").addEventListener("click", () => Tt(!1)), a("distribute-vertical").addEventListener("click", () => Tt(!0));
  function ut() {
    if (k) return;
    if (ce()) {
      z("Unlock selected objects before deleting.", "error");
      return;
    }
    const e = [...f];
    v.transact(() => e.forEach((t) => m.delete(t)));
  }
  function Ft(e, t, o, n, r) {
    let i = { position: e, guide: null }, c = n + 1e-6;
    for (const l of o)
      for (const b of [0, t / 2, t]) {
        const h = l - b, w = Math.abs(h - e);
        h >= 0 && h <= r - t && w < c && (c = w, i = { position: h, guide: l });
      }
    return i;
  }
  function bo(e, t, o, n, r, i) {
    const c = [0, C / 2, C], l = [0, D / 2, D];
    for (const b of Q()) {
      if (b === e || f.has(b)) continue;
      const h = m.get(b), w = Number(h.get("x")), E = Number(h.get("y")), A = Number(h.get("width")), $ = Number(h.get("height"));
      [w, E, A, $].every(Number.isFinite) && (c.push(w, w + A / 2, w + A), l.push(E, E + $ / 2, E + $));
    }
    return { x: Ft(t, n, c, i, C), y: Ft(o, r, l, i, D) };
  }
  function Pt(e) {
    if (!de) return;
    if (ce()) {
      X(), z("Movement stopped because an object was locked.", "error");
      return;
    }
    const { id: t, action: o, startX: n, startY: r, scale: i, original: c } = de, l = m.get(t);
    if (!l) return;
    const b = (e.clientX - n) * i, h = (e.clientY - r) * i;
    v.transact(() => {
      if (o === "move") {
        let w = Math.max(0, Math.min(C - c.width, c.x + b)), E = Math.max(0, Math.min(D - c.height, c.y + h));
        if (B.hidden = te.hidden = !0, !e.altKey) {
          const A = bo(t, w, E, c.width, c.height, 6 * i);
          w = A.x.position, E = A.y.position, A.x.guide !== null && (B.hidden = !1, B.style.left = 100 * A.x.guide / C + "%"), A.y.guide !== null && (te.hidden = !1, te.style.top = 100 * A.y.guide / D + "%");
        }
        for (const A of de.members) {
          const $ = m.get(A.id);
          $ && ($.set("x", Math.round(A.x + w - c.x)), $.set("y", Math.round(A.y + E - c.y)));
        }
      } else if (l.get("kind") === "image" && l.get("keepAspectRatio") !== !1) {
        const w = gt(l), E = Math.abs(b / c.width) >= Math.abs(h / c.height) ? c.width + b : (c.height + h) * w, A = l.get("imageFit") === "cover" ? Te(l) : { width: C, height: D }, $ = Yt(E, w, Math.min(C - c.x, A.width), Math.min(D - c.y, A.height));
        l.set("width", $.width), l.set("height", $.height);
      } else {
        const w = M.get(t)?.editor ? 100 : 1, E = M.get(t)?.editor ? 55 : 1, A = l.get("imageFit") === "cover" ? Te(l) : { width: C, height: D };
        l.set("width", Math.max(w, Math.min(C - c.x, A.width, c.width + b))), l.set("height", Math.max(E, Math.min(D - c.y, A.height, c.height + h)));
      }
    }, "geometry");
  }
  function X(e) {
    Be?.cancel(), B.hidden = te.hidden = !0;
    const t = de?.target || e?.currentTarget;
    t?.removeEventListener("pointermove", Pt), t?.removeEventListener("pointerup", X), t?.removeEventListener("pointercancel", X), de && t?.hasPointerCapture(de.pointerId) && t.releasePointerCapture(de.pointerId), de = null, L && (L.captureTimeout = 500, L.stopCapturing());
  }
  m.observeDeep(W), Y.observe(W), ne.observe(W), oe.observe(W), ie.observe(Re), Z.observe(Fe), v.on("update", Le), a("add-slide").addEventListener("click", () => {
    if (!k) {
      X();
      try {
        if (U.has(a("slide-layout").value)) {
          wo(U.get(a("slide-layout").value));
          return;
        }
        const e = ee(), t = "slide-" + crypto.randomUUID(), o = K.get(a("slide-layout").value) || K.values().next().value, n = o.objects.map((i) => ({ ...i, id: pe() })), r = /* @__PURE__ */ new Map();
        I = t, x = null, f.clear(), L?.stopCapturing(), v.transact(() => {
          Y.size || Y.set("first", 0), Y.set(t, Math.max(...e.map((i) => Y.get(i) || 0)) + 1), o.background !== void 0 && oe.set(t, o.background), o.notes !== void 0 && Z.set(t, o.notes);
          for (const i of n) {
            const { id: c, text: l, shapeId: b, group: h, ...w } = i, A = { ...i.kind === "shape" ? At(O.get(b)) : {}, rotation: 0, ...w, slide: t, layer: Math.max(-1, ...Q().map(($) => ge(m.get($)))) + 1 };
            h && (r.has(h) || r.set(h, "group-" + crypto.randomUUID()), A.groupId = r.get(h)), i.kind === "image" && (A.aspectRatio = i.width / i.height), m.set(c, new u.Map(Object.entries(A)));
          }
        });
        for (const i of n) {
          if (i.kind !== "text") continue;
          const c = i.text.split(`
`).map((l) => ({ type: "paragraph", content: l ? [{ type: "text", text: l }] : [] }));
          M.get(i.id).editor.commands.setContent({ type: "doc", content: c });
        }
        L?.stopCapturing(), W();
      } catch (e) {
        console.error("Slides layout failed:", e), z("Could not create slide: " + e.message, "error");
      }
    }
  }), a("duplicate-slide").addEventListener("click", () => {
    if (!k) {
      X();
      try {
        const e = I, t = ee(), o = "slide-" + crypto.randomUUID(), n = /* @__PURE__ */ new Map(), r = Q(e).map((i) => {
          const c = new u.Map(Object.entries(dt(m.get(i).toJSON(), n)));
          c.set("slide", o);
          const l = pe(), b = v.getXmlFragment("slide-text-" + i).toArray().map((w) => w.clone()), h = v.getXmlFragment("slide-text-" + l);
          return L?.addToScope(h), { id: l, box: c, fragment: h, text: b };
        });
        t.splice(t.indexOf(e) + 1, 0, o), I = o, x = null, f.clear(), v.transact(() => {
          t.forEach((i, c) => Y.set(i, c)), oe.has(e) && oe.set(o, oe.get(e)), typeof Z.get(e) == "string" && Z.set(o, Z.get(e));
          for (const i of r)
            m.set(i.id, i.box), i.text.length && i.fragment.insert(0, i.text);
        }), W(), z("Slide duplicated");
      } catch (e) {
        console.error("Slides duplication failed:", e), z("Could not duplicate slide: " + e.message, "error");
      }
    }
  });
  function Ot(e) {
    const t = ee(), o = t.indexOf(I);
    t[o + e] && ([t[o], t[o + e]] = [t[o + e], t[o]], v.transact(() => t.forEach((r, i) => Y.set(r, i))));
  }
  a("slide-up").addEventListener("click", () => Ot(-1)), a("slide-down").addEventListener("click", () => Ot(1)), a("delete-slide").addEventListener("click", () => {
    if (ee().length <= 1 || k) return;
    const e = I, t = () => yo(e);
    if (typeof window.buildDialogModal == "function") {
      const o = document.createElement("p");
      o.textContent = "Are you sure you want to delete slide " + (ee().indexOf(e) + 1) + "? Its objects and speaker notes will be removed.", window.buildDialogModal("Delete slide", o, [
        { label: "Cancel", secondary: !0, onClick: (n) => n() },
        { label: "Delete slide", onClick: (n) => {
          n(), t();
        } }
      ]);
    } else window.confirm("Are you sure you want to delete this slide?") && t();
  });
  function yo(e) {
    const t = ee();
    t.length <= 1 || !t.includes(e) || (X(), I = t[Math.max(0, t.indexOf(e) - 1)], x = null, f.clear(), v.transact(() => {
      m.forEach((o, n) => {
        (o.get("slide") || "first") === e && m.delete(n);
      }), Y.delete(e), oe.delete(e), Z.delete(e);
    }), W());
  }
  a("save-layout").disabled = typeof p.onSaveLayout != "function", a("save-layout").addEventListener("click", () => p.onSaveLayout?.());
  function Oe(e) {
    return typeof e == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(e) ? e : "";
  }
  async function Rt(e) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(e.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
    const t = await new Promise((n, r) => {
      const i = new FileReader();
      i.onload = () => n(i.result), i.onerror = () => r(i.error || new Error("Could not read the image.")), i.onabort = () => r(new Error("Image reading was cancelled.")), i.readAsDataURL(e);
    });
    if (!Oe(t)) throw new Error("Unsupported image data.");
    const o = new Image();
    return o.src = t, await o.decode(), { source: t, image: o };
  }
  a("image-description").addEventListener("input", (e) => {
    const t = m.get(x);
    k || f.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || t.set("alt", e.target.value.slice(0, 2e3));
  }), a("replace-image").addEventListener("click", () => {
    const e = m.get(x);
    k || f.size !== 1 || e?.get("kind") !== "image" || e.get("locked") === !0 || (_e = { document: v, id: x }, a("replace-image-file").click());
  }), a("replace-image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0], o = _e;
    if (_e = null, !(!t || !o))
      try {
        const { source: n, image: r } = await Rt(t), i = m.get(o.id);
        if (v !== o.document || i?.get("kind") !== "image") throw new Error("The original image is no longer available.");
        if (k || i.get("locked") === !0) throw new Error("Return to editing and unlock the image before replacing it.");
        L?.stopCapturing(), v.transact(() => {
          if (i.set("source", n), i.set("imageRatio", r.naturalWidth / r.naturalHeight), i.set("aspectRatio", i.get("width") / i.get("height")), i.delete("cropImageWidth"), i.delete("cropImageHeight"), i.get("imageFit") === "cover") {
            const c = Math.max(i.get("width"), i.get("height") * r.naturalWidth / r.naturalHeight);
            i.set("cropImageWidth", c), i.set("cropImageHeight", c * r.naturalHeight / r.naturalWidth);
          }
        }), L?.stopCapturing(), z("Image replaced.");
      } catch (n) {
        console.error("Slides image replacement failed:", n), z("Could not replace image: " + n.message, "error");
      } finally {
        e.target.value = "";
      }
  }), a("add-image").addEventListener("click", () => a("image-file").click()), a("image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0];
    if (!t) return;
    const o = v, n = I;
    try {
      const { source: r, image: i } = await Rt(t);
      if (v !== o || !ee().includes(n)) throw new Error("The destination slide is no longer open.");
      if (k) throw new Error("Return to editing before adding an image.");
      I = n;
      const c = Math.min(1, 800 / i.naturalWidth, 500 / i.naturalHeight), l = Math.max(1, Math.round(i.naturalWidth * c)), b = Math.max(1, Math.round(i.naturalHeight * c)), h = pe();
      Ce(h, (C - l) / 2, (D - b) / 2, l, b, r, t.name), J(h), z("Image added");
    } catch (r) {
      console.error("Slides image could not load:", r), z("Image could not load: " + r.message, "error");
    } finally {
      e.target.value = "";
    }
  });
  function pt() {
    if (!(k || !f.size))
      try {
        const e = new u.Doc(), t = Q().filter((n) => f.has(n)).map((n, r) => {
          const i = v.getXmlFragment("slide-text-" + n).toArray().map((c) => c.clone());
          return i.length && e.getXmlFragment("text-" + r).insert(0, i), { data: m.get(n).toJSON(), index: r };
        }), o = new Set(t.flatMap((n) => n.data.referenceUrls || []));
        for (const n of $e()) o.has(n.url) && e.getMap("clist_refs").set(n.url, JSON.stringify(n));
        return G?.document.destroy(), G = { document: e, items: t, sourceDocument: v, sourceSlide: I, pastes: 0, token: crypto.randomUUID() }, a("paste-objects").disabled = !1, z("Copied " + t.length + " object" + (t.length === 1 ? "." : "s.")), !0;
      } catch (e) {
        return console.error("Slides object copy failed:", e), z("Could not copy objects: " + e.message, "error"), !1;
      }
  }
  function Ut() {
    if (!(k || !G?.items.length)) {
      X();
      try {
        const e = He(G.items.map((l) => l.data)), t = G.cut && G.pastes === 0 ? 0 : G.sourceDocument === v && G.sourceSlide === I ? 28 * (G.pastes + 1) : 28 * G.pastes, o = Math.max(-e.x, Math.min(C - e.x - e.width, t)), n = Math.max(-e.y, Math.min(D - e.y - e.height, t)), r = Math.max(-1, ...Q().map((l) => ge(m.get(l)))), i = /* @__PURE__ */ new Map(), c = G.items.map((l, b) => {
          const h = pe(), w = new u.Map(Object.entries({ ...dt(l.data, i), slide: I, x: l.data.x + o, y: l.data.y + n, layer: r + b + 1 })), E = v.getXmlFragment("slide-text-" + h);
          L?.addToScope(E);
          const A = G.document.getXmlFragment("text-" + l.index).toArray().map(($) => $.clone());
          return { id: h, box: w, fragment: E, text: A };
        });
        L?.stopCapturing(), v.transact(() => {
          G.document.getMap("clist_refs").forEach((l) => {
            try {
              Xe([JSON.parse(l)]);
            } catch {
            }
          });
          for (const l of c)
            m.set(l.id, l.box), l.text.length && l.fragment.insert(0, l.text);
        }), L?.stopCapturing(), G.pastes++, f.clear();
        for (const l of c) f.add(l.id);
        x = c[c.length - 1].id, J(x, !1, !0), y.tabIndex = -1, y.focus({ preventScroll: !0 }), z("Pasted " + c.length + " object" + (c.length === 1 ? "." : "s."));
      } catch (e) {
        console.error("Slides object paste failed:", e), z("Could not paste objects: " + e.message, "error");
      }
    }
  }
  function Bt(e = null) {
    if (!(k || !f.size)) {
      if (ce()) {
        z("Unlock selected objects before cutting.", "error");
        return;
      }
      if (pt())
        try {
          e && Ht(e), G.cut = !0;
          const t = f.size;
          L?.stopCapturing(), ut(), L?.stopCapturing(), y.tabIndex = -1, y.focus({ preventScroll: !0 }), z("Cut " + t + " object" + (t === 1 ? "." : "s."));
        } catch (t) {
          console.error("Slides object cut failed:", t), z("Could not cut objects: " + t.message, "error");
        }
    }
  }
  a("cut-objects").addEventListener("click", () => Bt()), a("copy-objects").addEventListener("click", pt), a("paste-objects").addEventListener("click", Ut);
  function ft(e) {
    return e.isContentEditable || !!e.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function Ht(e) {
    e.clipboardData.setData("application/x-clist-slide-objects", G.token), e.clipboardData.setData("text/plain", G.items.map((t) => G.document.getXmlFragment("text-" + t.index).toString().replace(/<[^>]*>/g, " ") || t.data.alt || "Slide object").join(`
`)), e.preventDefault(), e.stopImmediatePropagation();
  }
  y.addEventListener("copy", (e) => {
    if (!(k || ft(e.target) || !f.size || !e.clipboardData) && pt())
      try {
        Ht(e);
      } catch (t) {
        console.error("Slides clipboard write failed:", t), z("Could not write objects to clipboard: " + t.message, "error");
      }
  }, !0);
  function qt(e) {
    if (k || !f.size || !e.clipboardData || !y.getClientRects().length) return;
    const t = e.target === document.body || e.target === document.documentElement || e.target === document;
    !y.contains(e.target) && !(t && y.contains(document.activeElement)) || ft(e.target) || document.activeElement?.closest?.("input, textarea, select") || (e.preventDefault(), e.stopImmediatePropagation(), Bt(e));
  }
  document.addEventListener("cut", qt, !0);
  function Wt(e) {
    if (k || !e.clipboardData || !y.getClientRects().length) return;
    const t = y.contains(e.target), o = e.target === document.body || e.target === document.documentElement || e.target === document;
    if (!t && !(Ct && o) || !t && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]') || e.target.closest?.("input, textarea, select")) return;
    const n = e.target.closest?.(".slide-object");
    if (ft(e.target) && n && f.has(n.dataset.id) && le === n.dataset.id) return;
    const i = e.clipboardData.getData("application/x-clist-slide-objects");
    if (i && i === G?.token) {
      e.preventDefault(), e.stopImmediatePropagation(), Ut();
      return;
    }
    const c = e.clipboardData.getData("text/plain");
    if (c) {
      e.preventDefault(), e.stopImmediatePropagation();
      try {
        X(), L?.stopCapturing();
        const l = pe(), b = c.replace(/\r\n?/g, `
`).split(`
`).map(($) => ({
          type: "paragraph",
          content: $ ? [{ type: "text", text: $ }] : []
        })), h = b.reduce(($, se) => $ + Math.max(1, Math.ceil((se.content[0]?.text.length || 0) / 45)), 0), w = 690, E = Math.min(500, Math.max(100, h * 42)), A = Ze?.slide === I ? Ze : { x: 160, y: 160 };
        Ce(l, Math.max(0, Math.min(C - w, A.x)), Math.max(0, Math.min(D - E, A.y)), w, E), M.get(l).editor.commands.setContent({ type: "doc", content: b }), L?.stopCapturing(), J(l), M.get(l).editor.commands.focus("end"), z("Pasted text into a new text box.");
      } catch (l) {
        console.error("Slides text paste failed:", l), z("Could not paste text: " + l.message, "error");
      }
    }
  }
  document.addEventListener("paste", Wt, !0);
  function $t(e) {
    const t = H.getBoundingClientRect();
    t.width <= 0 || t.height <= 0 || e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom || (Ze = { slide: I, x: Math.round((e.clientX - t.left) * C / t.width), y: Math.round((e.clientY - t.top) * D / t.height) });
  }
  y.addEventListener("pointermove", $t), et = zo(y, H, {
    views: () => [...M.values()],
    selected: () => [...f].map((e) => M.get(e)).filter(Boolean),
    presenting: () => k,
    size: (e) => ye(e).size,
    apply: (e) => {
      e.length && (L?.stopCapturing(), v.transact(() => {
        for (const { box: t, size: o } of e) t.set("fontSize", o);
      }), L?.stopCapturing());
    }
  }), Be = No(y, H, {
    selected: () => [...f],
    slideId: () => I,
    objects: () => Q().map((e) => ({ id: e, ...qe(m.get(e).toJSON()) })),
    select: (e) => {
      f.clear();
      for (const t of e) M.has(t) && f.add(t);
      J(e.at(-1) || null, !1, !0);
    }
  }), y.addEventListener("pointerdown", (e) => {
    const t = e.target;
    e.button !== 0 || k || !t.closest?.(".canvas-space") || t.closest(".slide-object, input, textarea, select, button, a") || (e.preventDefault(), Ct = !0, $t(e), X(), t === H && Be.begin(e), e.shiftKey || J(null), le = null, y.contains(document.activeElement) && document.activeElement.blur?.(), window.getSelection()?.removeAllRanges(), y.tabIndex = -1, y.focus({ preventScroll: !0 }));
  }, !0);
  function vo(e) {
    if (k) return;
    const t = O.get(e);
    if (!t) {
      z("This shape is not available in the catalog.", "error");
      return;
    }
    const o = pe(), { width: n, height: r } = t, i = new u.Map(Object.entries({ ...At(t), slide: I, x: Math.min(160, C - n), y: Math.min(180, D - r), width: n, height: r, rotation: 0, layer: Math.max(-1, ...Q().map((c) => ge(m.get(c)))) + 1 }));
    m.set(o, i), J(o), M.get(o).node.focus({ preventScroll: !0 });
  }
  function pe() {
    return `box-${crypto.randomUUID()}`;
  }
  a("add-text").addEventListener("click", () => {
    const e = pe();
    Ce(e, 160, 220, 430, 130), J(e), M.get(e)?.editor.commands.focus();
  }), a("duplicate").addEventListener("click", () => {
    if (k || !x) return;
    const e = x, t = m.get(e), o = pe(), n = new u.Map(Object.entries({ ...t.toJSON(), locked: !1, x: Math.min(C - t.get("width"), t.get("x") + 28), y: Math.min(D - t.get("height"), t.get("y") + 28), layer: Math.max(...Q().map((c) => ge(m.get(c)))) + 1 }));
    n.delete("groupId");
    const r = v.getXmlFragment("slide-text-" + o);
    L?.addToScope(r);
    const i = v.getXmlFragment("slide-text-" + e).toArray().map((c) => c.clone());
    v.transact(() => {
      m.set(o, n), i.length && r.insert(0, i);
    }), J(o);
  }), a("delete").addEventListener("click", ut), a("bold").addEventListener("click", () => {
    x && M.get(x)?.editor?.chain().focus().toggleBold().run();
  }), a("italic").addEventListener("click", () => {
    x && M.get(x)?.editor?.chain().focus().toggleItalic().run();
  }), a("bullet-list").addEventListener("click", () => {
    !k && x && M.get(x)?.editor?.chain().focus().toggleBulletList().run();
  }), a("ordered-list").addEventListener("click", () => {
    !k && x && M.get(x)?.editor?.chain().focus().toggleOrderedList().run();
  });
  function Xt(e) {
    try {
      const t = new URL(e);
      return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
    } catch {
      return !1;
    }
  }
  function je() {
    a("link-controls").hidden = !0, Ie = null;
  }
  a("edit-link").addEventListener("click", () => {
    const e = M.get(x)?.editor;
    if (!(k || !e)) {
      if (e.state.selection.empty && !e.isActive("link")) {
        z("Select the text to link first.", "error");
        return;
      }
      Ie = x, a("link-url").value = e.getAttributes("link").href || "", a("link-controls").hidden = !1, a("link-url").focus();
    }
  }), a("cancel-link").addEventListener("click", je), a("apply-link").addEventListener("click", () => {
    const e = M.get(Ie)?.editor;
    if (k || !e) {
      je();
      return;
    }
    const t = a("link-url").value.trim();
    if (!Xt(t)) {
      z("Enter an http, https, mailto, or tel URL.", "error");
      return;
    }
    try {
      L?.stopCapturing(), e.chain().focus().extendMarkRange("link").setLink({ href: t }).run(), L?.stopCapturing(), je();
    } catch (o) {
      console.error("Slides link failed:", o), z("Could not apply link: " + o.message, "error");
    }
  }), a("remove-link").addEventListener("click", () => {
    const e = M.get(x)?.editor;
    if (!(k || !e))
      try {
        e.chain().focus().extendMarkRange("link").unsetLink().run(), je();
      } catch (t) {
        console.error("Slides unlink failed:", t), z("Could not remove link: " + t.message, "error");
      }
  }), y.addEventListener("click", (e) => {
    const t = e.target.closest?.(".text-content a");
    if (!k || !t) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const o = t.getAttribute("href") || "";
    Xt(o) ? window.open(o, "_blank", "noopener,noreferrer") : (console.error("Slides blocked unsupported link:", o), a("presentation-status").textContent = "This link has an unsupported URL.");
  }, !0);
  function Kt(e) {
    if (k || ce() || !x) return;
    const t = Q(), o = t.indexOf(x);
    o < 0 || !t[o + e] || ([t[o], t[o + e]] = [t[o + e], t[o]], v.transact(() => t.forEach((n, r) => m.get(n).set("layer", r)), "layer"));
  }
  a("bring-forward").addEventListener("click", () => Kt(1)), a("send-backward").addEventListener("click", () => Kt(-1));
  function Vt(e, t) {
    const o = m.get(x);
    k || f.size !== 1 || o?.get("kind") !== "image" || o.get("locked") === !0 || v.transact(() => {
      e === "imageFit" && t === "cover" && o.get("imageFit") !== "cover" ? (o.delete("cropImageWidth"), o.delete("cropImageHeight"), o.set(e, t), ot(o)) : o.set(e, t);
    });
  }
  a("image-fit").addEventListener("change", (e) => {
    ["contain", "cover"].includes(e.target.value) && Vt("imageFit", e.target.value);
  });
  for (const [e, t] of [["crop-x", "cropX"], ["crop-y", "cropY"]])
    a(e).addEventListener("input", (o) => {
      const n = Number(o.target.value);
      Number.isFinite(n) && n >= 0 && n <= 100 && Vt(t, n);
    });
  function gt(e) {
    const t = Number(e.get("aspectRatio"));
    return Number.isFinite(t) && t > 0 ? t : Number(e.get("width")) / Number(e.get("height")) || 1;
  }
  function Yt(e, t, o, n) {
    const r = Math.min(o, n * t), i = Math.max(Math.min(r, Math.max(1, t)), Math.min(r, e));
    return { width: i, height: i / t };
  }
  a("keep-aspect-ratio").addEventListener("change", (e) => {
    const t = m.get(x);
    k || f.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || v.transact(() => {
      e.target.checked && t.set("aspectRatio", t.get("width") / t.get("height")), t.set("keepAspectRatio", e.target.checked);
    });
  });
  for (const e of ["x", "y", "width", "height"])
    a("object-" + e).addEventListener("change", (t) => {
      const o = m.get(x);
      if (k || o?.get("locked") === !0 || !o) return;
      const n = Number(t.target.value), r = e === "x" ? C - 1 : e === "y" ? D - 1 : e === "width" ? C : D, i = e === "width" || e === "height" ? 1 : 0;
      if (t.target.value.trim() === "" || !Number.isInteger(n) || n < i || n > r) {
        z(e + " must be a whole number between " + i + " and " + r + ".", "error"), J(x);
        return;
      }
      v.transact(() => {
        ["width", "height"].includes(e) && ot(o);
        const c = o.get("imageFit") === "cover" ? Te(o) : { width: C, height: D };
        if (o.get("kind") === "image" && o.get("keepAspectRatio") !== !1 && ["width", "height"].includes(e)) {
          const b = gt(o), h = Yt(e === "width" ? n : n * b, b, Math.min(C, c.width), Math.min(D, c.height));
          o.set("width", h.width), o.set("height", h.height), o.set("x", Math.min(o.get("x"), C - h.width)), o.set("y", Math.min(o.get("y"), D - h.height));
          return;
        }
        const l = e === "width" ? Math.min(n, c.width) : e === "height" ? Math.min(n, c.height) : n;
        o.set(e, l), e === "width" && o.set("x", Math.min(Number(o.get("x")) || 0, C - l)), e === "height" && o.set("y", Math.min(Number(o.get("y")) || 0, D - l)), e === "x" && o.set("x", Math.min(n, C - Number(o.get("width")))), e === "y" && o.set("y", Math.min(n, D - Number(o.get("height"))));
      }, "geometry");
    });
  a("object-rotation").addEventListener("change", (e) => {
    const t = m.get(x);
    if (k || t?.get("locked") === !0 || !t) return;
    const o = Number(e.target.value);
    if (e.target.value.trim() === "" || !Number.isFinite(o) || o < -180 || o > 180) {
      z("Rotation must be between -180 and 180 degrees.", "error"), J(x);
      return;
    }
    t.set("rotation", o);
  });
  function We(e) {
    return e instanceof u.Map && e.get("kind") !== "image";
  }
  function Gt() {
    a("copy-format").disabled = k || f.size !== 1 || !We(m.get(x));
    const e = [...f].map((t) => m.get(t));
    a("paste-format").disabled = k || !ke || !e.length || ce() || !e.some(We);
  }
  a("copy-format").addEventListener("click", () => {
    const e = m.get(x);
    if (k || f.size !== 1 || !We(e)) return;
    const t = Me(e), o = ye(e);
    ke = {
      appearance: { fillEnabled: t.fill, fillColour: t.fillColour, borderEnabled: t.border, borderColour: t.borderColour, borderWidth: t.width },
      text: e.get("kind") === "shape" ? null : { fontFamily: o.family, fontSize: o.size, textColour: o.colour, textAlign: o.align }
    }, Gt(), z("Formatting copied. Select targets, then use Apply formatting.");
  }), a("paste-format").addEventListener("click", () => {
    if (k || !ke || ce()) return;
    const e = [...f].map((t) => m.get(t)).filter(We);
    e.length && (L?.stopCapturing(), v.transact(() => {
      for (const t of e) {
        const o = { ...ke.appearance, ...t.get("kind") === "shape" ? {} : ke.text || {} };
        for (const [n, r] of Object.entries(o)) t.set(n, r);
      }
    }), L?.stopCapturing(), z("Formatting applied to " + e.length + " object" + (e.length === 1 ? "." : "s.")));
  });
  function ve(e, t) {
    const n = m.get(x)?.get("kind") === "shape" && ["fillEnabled", "fillColour", "borderEnabled", "borderColour", "borderWidth"].includes(e);
    k || f.size !== 1 || !M.get(x)?.editor && !n || m.get(x).set(e, t);
  }
  for (const [e, t] of [["fill-enabled", "fillEnabled"], ["border-enabled", "borderEnabled"]])
    a(e).addEventListener("change", (o) => ve(t, o.target.checked));
  for (const [e, t] of [["fill-colour", "fillColour"], ["border-colour", "borderColour"]])
    a(e).addEventListener("change", (o) => {
      /^#[0-9a-f]{6}$/i.test(o.target.value) && ve(t, o.target.value);
    });
  a("border-width").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isInteger(t) || t < 1 || t > 20) {
      z("Border width must be a whole number between 1 and 20 pixels.", "error"), J(x);
      return;
    }
    ve("borderWidth", t);
  }), a("font-family").addEventListener("change", (e) => {
    Object.prototype.hasOwnProperty.call(De, e.target.value) && ve("fontFamily", e.target.value);
  }), a("font-size").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t) || t < 8 || t > 200) {
      z("Font size must be between 8 and 200 pixels.", "error"), J(x);
      return;
    }
    ve("fontSize", t);
  }), a("text-colour").addEventListener("input", (e) => {
    /^#[0-9a-f]{6}$/i.test(e.target.value) && ve("textColour", e.target.value);
  }), a("text-align").addEventListener("change", (e) => {
    ["left", "center", "right", "justify"].includes(e.target.value) && ve("textAlign", e.target.value);
  });
  function Ae() {
    const e = U.has(a("slide-layout").value), t = U.get(a("slide-layout").value), o = typeof p.onRenameSavedLayout == "function" && typeof p.onDeleteSavedLayout == "function";
    a("saved-layout-hint").textContent = Ee ? "Layout dialog is open." : U.size ? e ? o ? "Selected saved layout: " + t.label : "Layout management is available inside CList." : "Select an entry under Saved layouts to rename or delete it." : "Use CList’s Save menu to save the current slide as a layout.", a("rename-layout").disabled = Ee || !e || typeof p.onRenameSavedLayout != "function", a("delete-layout").disabled = Ee || !e || typeof p.onDeleteSavedLayout != "function";
  }
  function Jt(e) {
    const t = "user:" + e;
    U.delete(t);
    const o = a("slide-layout").querySelector("optgroup[data-saved-layouts]");
    (o && [...o.children].find((r) => r.value === t))?.remove(), o && !o.children.length && o.remove(), a("slide-layout").value || (a("slide-layout").value = K.keys().next().value), Ae();
  }
  async function _t(e) {
    const t = U.get(a("slide-layout").value), o = e ? p.onDeleteSavedLayout : p.onRenameSavedLayout;
    if (!(k || Ee || !t || typeof o != "function")) {
      Ee = !0, Ae();
      try {
        const n = await o({ ...t });
        e && n === !0 ? Jt(t.id) : !e && n && Qt(n);
      } catch (n) {
        console.error("Saved layout management failed:", n), z("Could not " + (e ? "delete" : "rename") + " layout: " + n.message, "error");
      } finally {
        Ee = !1, Ae();
      }
    }
  }
  a("slide-layout").addEventListener("change", Ae), a("rename-layout").addEventListener("click", () => _t(!1).catch((e) => {
    console.error("Layout rename failed:", e), z(e.message, "error");
  })), a("delete-layout").addEventListener("click", () => _t(!0).catch((e) => {
    console.error("Layout deletion failed:", e), z(e.message, "error");
  }));
  function xo(e) {
    if (typeof e != "string" || !e.trim() || e.trim().length > 120) throw new Error("Enter a layout name of 1–120 characters.");
    const t = new u.Doc();
    try {
      t.getMap("slide-pages").set("first", 0), t.getMap("slide-backgrounds").set("first", Pe(I)), typeof Z.get(I) == "string" && t.getMap("slide-notes").set("first", Z.get(I));
      for (const i of Q()) {
        const c = m.get(i), l = ye(c), b = Me(c), h = { ...c.toJSON(), slide: "first", fontFamily: l.family, fontSize: l.size, textColour: l.colour, fillColour: b.fillColour, borderColour: b.borderColour };
        h.kind === "shape" && (h.shapeDefinition = structuredClone(rt(m.get(i)))), t.getMap("slide-objects").set(i, new u.Map(Object.entries(h)));
        const w = v.getXmlFragment("slide-text-" + i).toArray().map((E) => E.clone());
        w.length && t.getXmlFragment("slide-text-" + i).insert(0, w);
      }
      const o = new Set(Q().flatMap((i) => m.get(i).get("referenceUrls") || []));
      for (const i of $e()) o.has(i.url) && t.getMap("clist_refs").set(i.url, JSON.stringify(i));
      const n = u.encodeStateAsUpdate(t);
      let r = "";
      for (const i of n) r += String.fromCharCode(i);
      return { format: "clist-slide-layout-v1", id: "saved-" + crypto.randomUUID(), label: e.trim(), update: btoa(r) };
    } finally {
      t.destroy();
    }
  }
  function Zt(e) {
    if (!e || e.format !== "clist-slide-layout-v1" || typeof e.id != "string" || !/^saved-[a-z0-9-]+$/.test(e.id) || typeof e.label != "string" || !e.label.trim() || e.label.length > 120 || typeof e.update != "string") throw new Error("Invalid saved slide layout.");
    const t = new u.Doc();
    try {
      u.applyUpdate(t, Uint8Array.from(atob(e.update), (n) => n.charCodeAt(0)));
      const o = t.getMap("slide-pages");
      if (o.size !== 1 || !o.has("first")) throw new Error("A saved layout must contain one slide.");
      return t.getMap("slide-objects").forEach((n) => {
        if (!(n instanceof u.Map) || (n.get("slide") || "first") !== "first" || !["x", "y", "width", "height"].every((r) => typeof n.get(r) == "number" && Number.isFinite(n.get(r))) || n.get("width") <= 0 || n.get("height") <= 0) throw new Error("Invalid object in saved slide layout.");
        n.get("kind") === "shape" && n.get("shapeDefinition") && xt(n.get("shapeDefinition"));
      }), t;
    } catch (o) {
      throw t.destroy(), o;
    }
  }
  function Qt(e, { select: t = !1 } = {}) {
    Zt(e).destroy();
    const n = { format: e.format, id: e.id, label: e.label.trim(), update: e.update };
    U.set("user:" + n.id, n);
    let r = a("slide-layout").querySelector("optgroup[data-saved-layouts]");
    r || (r = document.createElement("optgroup"), r.label = "Saved layouts", r.dataset.savedLayouts = "", a("slide-layout").append(r));
    let i = [...r.children].find((c) => c.value === "user:" + n.id);
    return i || (i = document.createElement("option"), r.append(i)), i.value = "user:" + n.id, i.textContent = n.label, t && (a("slide-layout").value = i.value), Ae(), n;
  }
  function wo(e) {
    const t = Zt(e);
    try {
      const o = t.getMap("slide-objects"), n = /* @__PURE__ */ new Map(), r = [...o.entries()].sort(([l, b], [h, w]) => ge(b) - ge(w) || l.localeCompare(h)).map(([l, b]) => {
        const h = pe(), w = dt(b.toJSON(), n), E = v.getXmlFragment("slide-text-" + h);
        return L?.addToScope(E), { id: h, data: w, fragment: E, text: t.getXmlFragment("slide-text-" + l).toArray().map((A) => A.clone()) };
      }), i = ee(), c = "slide-" + crypto.randomUUID();
      I = c, x = null, f.clear(), L?.stopCapturing(), v.transact(() => {
        Y.size || Y.set("first", 0), Y.set(c, Math.max(...i.map((l) => Y.get(l) || 0)) + 1), oe.set(c, t.getMap("slide-backgrounds").get("first") || "#ffffff"), Z.set(c, t.getMap("slide-notes").get("first") || ""), t.getMap("clist_refs").forEach((l) => {
          try {
            Xe([JSON.parse(l)]);
          } catch {
          }
        });
        for (const l of r)
          m.set(l.id, new u.Map(Object.entries({ ...l.data, slide: c }))), l.text.length && l.fragment.insert(0, l.text);
      }), L?.stopCapturing(), W();
    } finally {
      t.destroy();
    }
  }
  function $e() {
    const e = [];
    return ie.forEach((t) => {
      try {
        const o = vt(JSON.parse(t));
        o && e.push(o);
      } catch {
      }
    }), e;
  }
  function Re() {
    p.onReferencesChange?.($e());
  }
  function Xe(e) {
    for (const t of e || []) {
      const o = vt(t);
      o && !ie.has(o.url) && ie.set(o.url, JSON.stringify(o));
    }
  }
  function ko(e, t = []) {
    if (k) throw new Error("Return to editing before importing content.");
    const o = [...new Map(t.map(vt).filter(Boolean).map((i) => [i.url, i])).values()], n = Ao(e, o);
    X();
    const r = pe();
    return L?.stopCapturing(), v.transact(() => {
      Ce(r, 100, 120, 1e3, 460), m.get(r).set("referenceUrls", o.map((i) => i.url)), Xe(o);
    }), M.get(r).editor.commands.setContent(n), L?.stopCapturing(), J(r), y.tabIndex = -1, y.focus({ preventScroll: !0 }), z("Content imported into a new text box" + (o.length ? " with source references." : ".")), r;
  }
  function Eo() {
    ne.has("theme") || v.transact(() => ne.set("theme", structuredClone(Se())), "init");
    const e = u.encodeStateAsUpdate(v);
    let t = "";
    for (let o = 0; o < e.length; o++) t += String.fromCharCode(e[o]);
    return { format: "clist-slides-yjs-v1", document: a("doc-name").value, update: btoa(t) };
  }
  function Co(e) {
    if (ae) throw new Error("Disconnect from Hocuspocus before replacing the document");
    if (!e || e.format !== "clist-slides-yjs-v1" || typeof e.update != "string")
      throw new Error("Unsupported document format");
    const t = atob(e.update), o = Uint8Array.from(t, (r) => r.charCodeAt(0)), n = new u.Doc();
    try {
      u.applyUpdate(n, o);
    } catch (r) {
      throw n.destroy(), r;
    }
    m.unobserveDeep(W), Y.unobserve(W), ne.unobserve(W), oe.unobserve(W), ie.unobserve(Re), Z.unobserve(Fe), v.off("update", Le);
    for (const r of M.values())
      r.editor?.destroy(), r.node.remove();
    M.clear(), x = null, f.clear(), le = null, X(), oo(), v.destroy(), v = n, m = v.getMap("slide-objects"), Y = v.getMap("slide-pages"), oe = v.getMap("slide-backgrounds"), Z = v.getMap("slide-notes"), ie = v.getMap("clist_refs"), ne = v.getMap("slide-design"), I = ee()[0], m.observeDeep(W), Y.observe(W), ne.observe(W), oe.observe(W), ie.observe(Re), Z.observe(Fe), v.on("update", Le), we = !0, e.document && (a("doc-name").value = e.document), W(), to(), Re();
  }
  function ze() {
    he++;
    const e = ae;
    ae = null, re = !1, e?.destroy(), z("Local only"), a("connect").textContent = "Connect";
  }
  async function mt() {
    ze();
    const e = he;
    try {
      const t = a("server-url").value.trim();
      let o = a("doc-name").value.trim();
      if (!/^wss?:\/\//i.test(t) || !o) throw new Error("Enter a WebSocket URL and document name");
      if (p.resolveDocumentName && (o = await p.resolveDocumentName(o)), e !== he) return;
      a("doc-name").value = o;
      const n = typeof p.parameters == "function" ? p.parameters() : p.parameters;
      ae = new N({
        url: t,
        name: o,
        document: v,
        token: p.token || a("token").value || void 0,
        parameters: n || {},
        onStatus: ({ status: r }) => {
          e === he && z(r === "connected" ? "Synchronizing..." : r);
        },
        onSynced: ({ state: r }) => {
          e !== he || r === !1 || (re = !0, p.seed !== !1 && Lt(), z("Synced", "connected"));
        },
        onAuthenticationFailed: ({ reason: r } = {}) => {
          if (e !== he) return;
          const i = typeof r == "string" && r.trim() ? r.trim() : "The server did not provide a reason.";
          console.error("Slides collaboration authentication failed:", i), ze(), z(`Authentication failed: ${i}`, "error");
        },
        onDisconnect: () => {
          e === he && (re = !1, z("Disconnected", "error"));
        }
      }), a("connect").textContent = "Disconnect", z("Connecting...");
    } catch (t) {
      if (e !== he) return;
      console.error("Slides connection failed:", t), ze(), z(t.message, "error");
    }
  }
  function Ne(e) {
    console.error("Slides connection failed:", e), z(e.message, "error");
  }
  a("connect").addEventListener("click", () => {
    ae ? ze() : mt().catch(Ne);
  });
  function Ke() {
    a("undo").disabled = k || !L?.undoStack.length, a("redo").disabled = k || !L?.redoStack.length;
  }
  function eo(e) {
    e.local && e.origin !== "init" && !Ue && L.trackedOrigins.add(e.origin);
  }
  function to() {
    L = new u.UndoManager([...v.share.values()], {
      trackedOrigins: /* @__PURE__ */ new Set([null, "geometry", "layer"]),
      captureTransaction: (e) => e.local && e.origin !== "init" && !Ue
    }), v.on("beforeTransaction", eo);
    for (const e of ["stack-item-added", "stack-item-popped", "stack-cleared", "stack-item-updated"]) L.on(e, Ke);
    Ke();
  }
  function oo() {
    v.off("beforeTransaction", eo), L?.destroy(), L = null;
  }
  function ht(e = !1) {
    if (!(k || !L)) {
      X(), L.stopCapturing();
      try {
        e ? L.redo() : L.undo(), W(), Ke();
      } catch (t) {
        console.error("Slides history failed:", t), z("Could not " + (e ? "redo" : "undo") + ": " + t.message, "error");
      }
    }
  }
  function So(e) {
    if (k || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !x) return;
    const t = e.target;
    if (t.isContentEditable || !!t.closest?.('[contenteditable="true"]')) {
      e.key === "Escape" && (e.preventDefault(), e.stopImmediatePropagation(), M.get(x)?.node.focus({ preventScroll: !0 }), le = null);
      return;
    }
    if (t.closest?.("input, textarea, select, button")) return;
    if (ce() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault(), e.stopImmediatePropagation(), z("Unlock selected objects before moving or deleting.", "error");
      return;
    }
    const n = M.get(x);
    if (!n) return;
    if (e.key === "Enter" && n.editor && f.size === 1) {
      e.preventDefault(), n.editor.commands.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(), e.stopImmediatePropagation(), L?.stopCapturing(), ut(), L?.stopCapturing(), y.tabIndex = -1, y.focus({ preventScroll: !0 });
      return;
    }
    const r = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!r) return;
    e.preventDefault(), e.stopImmediatePropagation(), e.repeat || L?.stopCapturing();
    const i = e.shiftKey ? 10 : 1, c = [...f].map((w) => ({ id: w, ...m.get(w).toJSON() })), l = He(c), b = Math.max(-l.x, Math.min(C - l.x - l.width, r[0] * i)), h = Math.max(-l.y, Math.min(D - l.y - l.height, r[1] * i));
    v.transact(() => {
      for (const w of c) {
        const E = m.get(w.id);
        E.set("x", w.x + b), E.set("y", w.y + h);
      }
    }, "geometry");
  }
  function Mo(e) {
    if (So(e), k || !(e.ctrlKey || e.metaKey) || e.altKey || !y.contains(e.target)) return;
    const t = e.key.toLowerCase();
    t !== "z" && t !== "y" || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && e.target !== a("speaker-notes") || (e.preventDefault(), e.stopImmediatePropagation(), ht(t === "y" || e.shiftKey));
  }
  function Ve() {
    L?.stopCapturing();
  }
  a("undo").addEventListener("click", () => ht()), a("redo").addEventListener("click", () => ht(!0)), y.addEventListener("click", Ve, !0), y.addEventListener("click", Ve), y.addEventListener("change", Ve, !0), y.addEventListener("change", Ve), y.addEventListener("keydown", Mo, !0);
  function Lo(e, t) {
    const o = t.createElement("div");
    o.className = "slide presenter-slide", o.style.backgroundColor = Pe(e), o.setAttribute("aria-label", "Slide preview");
    for (const n of Q(e)) {
      const r = m.get(n), i = t.createElement("div"), c = t.createElement("div");
      if (i.className = r.get("kind") === "shape" ? "slide-object shape-object" : "slide-object", i.style.left = 100 * r.get("x") / C + "%", i.style.top = 100 * r.get("y") / D + "%", i.style.width = 100 * r.get("width") / C + "%", i.style.height = 100 * r.get("height") / D + "%", i.style.transform = "rotate(" + (Number(r.get("rotation")) || 0) + "deg)", i.style.zIndex = String(Q(e).indexOf(n)), r.get("kind") === "image") {
        c.className = "image-content";
        const l = t.createElement("img");
        l.src = Oe(r.get("source")), l.alt = typeof r.get("alt") == "string" ? r.get("alt") : "", nt(l, r, !0), c.append(l);
      } else if (r.get("kind") === "shape") {
        c.className = "shape-content";
        const l = t.createElementNS("http://www.w3.org/2000/svg", "svg");
        it(l, r), c.append(l);
      } else {
        c.className = "text-content";
        const l = ye(r), b = Me(r), h = t.createElement("div");
        i.style.setProperty("--slide-font-size", l.size / 12.8 + "cqw"), i.style.fontFamily = De[l.family], i.style.color = l.colour, i.style.textAlign = l.align, c.style.backgroundColor = b.fill ? b.fillColour : "transparent", c.style.border = b.border ? b.width / 12.8 + "cqw solid " + b.borderColour : "none", h.className = "tiptap", h.append(Fo(v.getXmlFragment("slide-text-" + n), t)), c.append(h);
      }
      i.append(c), o.append(i);
    }
    return o;
  }
  function bt() {
    if (!ue) return;
    if (ue.closed) {
      ue = null;
      return;
    }
    const e = ee(), t = e.indexOf(I);
    ue.update({ id: I, nextId: e[t + 1], index: t, total: e.length, notes: typeof Z.get(I) == "string" ? Z.get(I) : "", presenting: k });
  }
  function no() {
    try {
      if (ue && !ue.closed) {
        bt(), ue.focus();
        return;
      }
      ue = Po({
        renderSlide: Lo,
        navigate: Ye,
        jump: (e) => {
          const t = ee();
          I = e === "first" ? t[0] : t[t.length - 1], x = null, f.clear(), W();
        },
        present: ro,
        end: Ge
      }), bt();
    } catch (e) {
      console.error("Presenter view could not open:", e), z("Presenter view could not open: " + e.message, "error"), k && (a("presentation-status").textContent = e.message);
    }
  }
  a("presenter-view").addEventListener("click", no), a("presentation-presenter-view").addEventListener("click", no);
  function Ye(e) {
    const t = ee(), o = t[t.indexOf(I) + e];
    o && (I = o, x = null, f.clear(), W());
  }
  function yt(e) {
    k = e, je(), Ke(), X(), J(null), y.classList.toggle("presenting", e), Mt.update(), a("presentation-controls").hidden = !e;
    for (const t of M.values()) t.editor?.setEditable(!e);
    e ? (Qe = document.activeElement, y.tabIndex = -1, y.focus()) : (Qe?.focus?.(), Qe = null), Le();
  }
  async function ro() {
    yt(!0), a("presentation-status").textContent = "";
    try {
      y.requestFullscreen && await y.requestFullscreen();
    } catch (e) {
      console.error("Slides fullscreen failed:", e), a("presentation-status").textContent = "Full screen unavailable. Presenting in this window.";
    }
  }
  async function Ge() {
    yt(!1);
    try {
      document.fullscreenElement === y && await document.exitFullscreen();
    } catch (e) {
      console.error("Slides fullscreen exit failed:", e), z("Could not leave full screen. Press Escape.", "error");
    }
  }
  function io(e) {
    if (!(!k || e.altKey || e.ctrlKey || e.metaKey)) {
      if (e.key === "Escape")
        e.preventDefault(), Ge().catch(Ne);
      else if (["ArrowRight", "ArrowDown", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", " "].includes(e.key)) {
        if (e.key === " " && e.target?.tagName === "BUTTON") return;
        if (e.preventDefault(), e.key === "Home" || e.key === "End") {
          const t = ee();
          I = e.key === "Home" ? t[0] : t[t.length - 1], W();
        } else Ye(["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 1);
      }
    }
  }
  function ao() {
    k && document.fullscreenElement !== y && yt(!1);
  }
  return a("present").addEventListener("click", () => ro().catch(Ne)), a("exit-presentation").addEventListener("click", () => Ge().catch(Ne)), a("previous-slide").addEventListener("click", () => Ye(-1)), a("next-slide").addEventListener("click", () => Ye(1)), document.addEventListener("keydown", io), document.addEventListener("fullscreenchange", ao), p.url ? mt().catch(Ne) : p.seed !== !1 && Lt(), W(), to(), Ae(), {
    snapshot: Eo,
    loadSnapshot: Co,
    importContent: ko,
    getReferences: $e,
    addReferences: Xe,
    connect: mt,
    disconnect: ze,
    createSavedLayout: xo,
    registerSavedLayout: Qt,
    removeSavedLayout: Jt,
    get document() {
      return v;
    },
    get connected() {
      return re;
    },
    destroy() {
      et.destroy(), Be.destroy(), Mt.destroy(), ue?.close(), ue = null, document.removeEventListener("cut", qt, !0), document.removeEventListener("paste", Wt, !0), document.removeEventListener("keydown", io), document.removeEventListener("fullscreenchange", ao), k && Ge().catch(Ne), ze(), X(), m.unobserveDeep(W), Y.unobserve(W), ne.unobserve(W), oe.unobserve(W), ie.unobserve(Re), Z.unobserve(Fe), v.off("update", Le);
      for (const e of M.values()) e.editor?.destroy();
      M.clear(), oo(), G?.document.destroy(), G = null, ke = null, v.destroy(), y.remove();
    }
  };
}
export {
  Xo as createSlideEditor,
  $o as loadSlideCatalogs
};
