const zo = `
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
function co(r) {
  try {
    const d = new URL(r);
    return ["http:", "https:"].includes(d.protocol) ? d.href : "";
  } catch {
    return "";
  }
}
function wn(r) {
  if (!r || typeof r.url != "string") return null;
  const d = co(r.url);
  return d ? { ...JSON.parse(JSON.stringify(r)), url: d } : null;
}
function Fo(r, d) {
  if (!r || !["text/html", "text/plain"].includes(r.type) || typeof r.value != "string") throw new Error("Import HTML or plain text into Slides.");
  const c = document.createElement("div");
  if (r.type === "text/html") {
    const l = new DOMParser().parseFromString(r.value, "text/html");
    l.querySelectorAll("script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons").forEach((h) => h.remove());
    for (const h of l.querySelectorAll("img")) h.replaceWith(l.createTextNode(h.alt || ""));
    for (const h of l.body.querySelectorAll("*")) {
      for (const x of [...h.attributes]) x.name !== "href" && h.removeAttribute(x.name);
      if (h.hasAttribute("href")) {
        const x = co(h.getAttribute("href"));
        x ? h.setAttribute("href", x) : h.removeAttribute("href");
      }
    }
    c.innerHTML = l.body.innerHTML;
  } else
    for (const l of r.value.split(/\r?\n/)) {
      const h = document.createElement("p");
      h.textContent = l, c.append(h);
    }
  for (const l of d) {
    const h = document.createElement("p"), x = document.createElement("a");
    x.href = l.url, x.textContent = l.title || l.url, h.append(document.createTextNode("Source: "), x), c.append(h);
  }
  if (!c.textContent.trim()) throw new Error("There is no readable text to import.");
  return c.innerHTML;
}
function Po(r, d, c) {
  let l = null, h = !1;
  const x = /* @__PURE__ */ new WeakMap(), f = r.querySelector('[data-control="fit-text"]'), y = r.querySelector('[data-control="text-overflow-status"]');
  function C(g) {
    const M = g.content.querySelector(".tiptap");
    return !!M && M.clientHeight > 0 && (M.scrollHeight > M.clientHeight + 1 || M.scrollWidth > M.clientWidth + 1);
  }
  function b() {
    if (l = null, h) return;
    let g = 0;
    const M = c.selected();
    for (const J of c.views()) {
      if (!J.editor) continue;
      const _ = C(J);
      M.includes(J) && (g += Number(_));
      let V = x.get(J.node);
      !V && _ && (V = document.createElement("span"), V.className = "text-overflow-badge", V.textContent = "Text overflow", V.title = "Text does not fit in this box. Use Fit text or enlarge the box.", J.node.append(V), x.set(J.node, V)), V && V.hidden === _ && (V.hidden = !_);
    }
    const A = c.presenting() || !M.length || M.some((J) => J.box.get("locked") === !0) || !M.some((J) => J.editor);
    f.disabled !== A && (f.disabled = A);
    const s = g ? g + " selected text box" + (g === 1 ? " overflows." : "es overflow.") + " Use Fit text or enlarge the box." : M.some((J) => J.editor) ? "Selected text fits." : "Select a text box to check its fit.";
    y.textContent !== s && (y.textContent = s);
  }
  function N() {
    !h && l === null && (l = requestAnimationFrame(b));
  }
  function B() {
    const g = c.selected();
    if (c.presenting() || g.some((A) => A.box.get("locked") === !0)) return;
    const M = [];
    for (const A of g) {
      if (!A.editor || !C(A)) continue;
      const s = A.node.style.getPropertyValue("--slide-font-size"), J = c.size(A.box);
      let _ = 8;
      try {
        let V = 8, me = Math.floor(J);
        for (; V <= me; ) {
          const k = Math.floor((V + me) / 2);
          A.node.style.setProperty("--slide-font-size", k / 12.8 + "cqw"), C(A) ? me = k - 1 : (_ = k, V = k + 1);
        }
      } finally {
        A.node.style.setProperty("--slide-font-size", s);
      }
      _ < J && M.push({ box: A.box, size: _ });
    }
    c.apply(M), b();
  }
  f.addEventListener("click", B);
  const w = new MutationObserver(N);
  w.observe(d, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["style", "class"] });
  const j = new ResizeObserver(N);
  return j.observe(d), document.fonts?.addEventListener("loadingdone", N), N(), { schedule: N, destroy() {
    h = !0, l !== null && cancelAnimationFrame(l), w.disconnect(), j.disconnect(), document.fonts?.removeEventListener("loadingdone", N), f.removeEventListener("click", B);
  } };
}
function Do(r, d, c) {
  const l = document.createElement("div");
  l.className = "selection-marquee", l.hidden = !0, l.setAttribute("aria-hidden", "true"), d.append(l);
  let h = null;
  function x(w) {
    const j = d.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (w.clientX - j.left) * 1280 / j.width)), y: Math.max(0, Math.min(720, (w.clientY - j.top) * 720 / j.height)) };
  }
  function f() {
    const w = h;
    h = null, l.hidden = !0, w && d.hasPointerCapture(w.pointer) && d.releasePointerCapture(w.pointer);
  }
  function y() {
    if (!h) return;
    const w = h.original;
    f(), c.select(w);
  }
  function C(w) {
    w.button !== 0 || w.isPrimary === !1 || (y(), h = { start: x(w), clientX: w.clientX, clientY: w.clientY, pointer: w.pointerId, original: c.selected(), additive: w.shiftKey, slide: c.slideId(), moved: !1 }, d.setPointerCapture(w.pointerId));
  }
  function b(w) {
    if (!h || w.pointerId !== h.pointer) return;
    if (c.slideId() !== h.slide) {
      y();
      return;
    }
    if (!h.moved && Math.hypot(w.clientX - h.clientX, w.clientY - h.clientY) < 4) return;
    h.moved = !0, w.preventDefault();
    const j = x(w), g = Math.min(h.start.x, j.x), M = Math.min(h.start.y, j.y), A = Math.abs(j.x - h.start.x), s = Math.abs(j.y - h.start.y);
    Object.assign(l.style, { left: g / 12.8 + "%", top: M / 7.2 + "%", width: A / 12.8 + "%", height: s / 7.2 + "%" }), l.hidden = !1;
    const J = new Set(h.additive ? h.original : []);
    for (const _ of c.objects())
      _.x < g + A && _.x + _.width > g && _.y < M + s && _.y + _.height > M && J.add(_.id);
    c.select([...J]);
  }
  function N(w) {
    !h || w.pointerId !== h.pointer || (b(w), f());
  }
  function B(w) {
    h && w.key === "Escape" && (w.preventDefault(), w.stopPropagation(), y());
  }
  return d.addEventListener("pointermove", b), d.addEventListener("pointerup", N), d.addEventListener("pointercancel", y), d.addEventListener("lostpointercapture", y), r.addEventListener("keydown", B, !0), { begin: C, cancel: y, destroy() {
    f(), d.removeEventListener("pointermove", b), d.removeEventListener("pointerup", N), d.removeEventListener("pointercancel", y), d.removeEventListener("lostpointercapture", y), r.removeEventListener("keydown", B, !0), l.remove();
  } };
}
function Io(r, d) {
  const c = (w) => r.querySelector('[data-control="' + w + '"]'), l = c("canvas-viewport"), h = c("slide"), x = c("canvas-zoom"), f = [25, 50, 75, 100, 125, 150, 200];
  let y = "fit", C = 100;
  function b() {
    if (d() || !l.clientWidth || !l.clientHeight) return;
    const w = Math.max(1, l.clientWidth - 48), j = Math.max(1, l.clientHeight - 48);
    y === "fit" && (C = Math.min(100, w / 1280 * 100, j / 720 * 100));
    const g = 1280 * C / 100, M = 720 * C / 100;
    h.style.setProperty("--canvas-slide-width", g + "px"), l.style.setProperty("--canvas-stage-width", g + 48 + "px"), l.style.setProperty("--canvas-stage-height", M + 48 + "px"), x.options[0].textContent = "Fit (" + Math.round(C) + "%)", x.value = y, c("zoom-out").disabled = C <= 25, c("zoom-in").disabled = C >= 200;
  }
  function N(w) {
    y = w, y !== "fit" && (C = Number(y)), b(), y === "fit" && (l.scrollLeft = 0, l.scrollTop = 0);
  }
  x.addEventListener("change", () => N(x.value)), c("zoom-fit").addEventListener("click", () => N("fit")), c("zoom-in").addEventListener("click", () => N(String(f.find((w) => w > C + 0.1) || 200))), c("zoom-out").addEventListener("click", () => N(String([...f].reverse().find((w) => w < C - 0.1) || 25)));
  const B = new ResizeObserver(b);
  return B.observe(l), b(), { update: b, destroy() {
    B.disconnect();
  } };
}
const To = {
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
function Ro() {
  const r = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return r.setAttribute("viewBox", "0 0 24 24"), r.setAttribute("aria-hidden", "true"), r.setAttribute("focusable", "false"), r.setAttribute("fill", "none"), r.setAttribute("stroke", "currentColor"), r.setAttribute("stroke-width", "1.8"), r.setAttribute("stroke-linecap", "round"), r.setAttribute("stroke-linejoin", "round"), r;
}
function io(r, d = null) {
  const c = Ro();
  if (d) {
    c.setAttribute("viewBox", d.viewBox.join(" ")), c.setAttribute("stroke-width", String(Math.max(d.viewBox[2], d.viewBox[3]) / 12));
    for (const l of d.elements) {
      const h = document.createElementNS("http://www.w3.org/2000/svg", l.tag);
      for (const [x, f] of Object.entries(l.attributes)) h.setAttribute(x, String(f));
      c.append(h);
    }
  } else
    c.innerHTML = To[r.dataset.control] || '<circle cx="12" cy="12" r="8"/>';
  r.className = "clist-action-btn", r.type = "button", r.setAttribute("aria-label", r.title), r.replaceChildren(c);
}
function ro(r, d) {
  const c = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" }, l = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u" };
  function h(f) {
    if (typeof f.toDelta == "function") {
      const N = d.createDocumentFragment();
      for (const B of f.toDelta()) {
        if (typeof B.insert != "string") continue;
        let w = d.createTextNode(B.insert);
        for (const [j, g] of Object.entries(B.attributes || {})) {
          let M;
          l[j] ? M = d.createElement(l[j]) : j === "link" && typeof g?.href == "string" && /^(https?:|mailto:|tel:)/i.test(g.href) && (M = d.createElement("a"), M.href = g.href, M.target = "_blank", M.rel = "noopener noreferrer"), M && (M.append(w), w = M);
        }
        N.append(w);
      }
      return N;
    }
    const y = f.getAttributes?.() || {}, C = f.nodeName === "heading" ? "h" + Math.max(1, Math.min(6, Number(y.level) || 1)) : c[f.nodeName] || "div", b = d.createElement(C);
    f.nodeName === "orderedList" && Number.isInteger(y.start) && (b.start = y.start);
    for (const N of f.toArray?.() || []) b.append(h(N));
    return b;
  }
  const x = d.createDocumentFragment();
  for (const f of r.toArray()) x.append(h(f));
  return x;
}
function Oo({ renderSlide: r, navigate: d, jump: c, present: l, end: h }) {
  const x = window.open("", "_blank", "popup,width=1200,height=850");
  if (!x) throw new Error("Allow pop-up windows for CList to open Presenter view.");
  const f = x.document;
  f.title = "CList Slides — Presenter view", f.documentElement.lang = "en";
  for (const X of document.querySelectorAll('link[rel="stylesheet"], style')) f.head.append(X.cloneNode(!0));
  f.body.className = "clist-presenter-page";
  const y = f.createElement("main");
  y.className = "clist-slides presenter-console", f.body.replaceChildren(y);
  const C = f.createElement("header");
  C.className = "presenter-header";
  const b = f.createElement("h1");
  b.textContent = "Presenter view";
  const N = f.createElement("span"), B = f.createElement("span"), w = f.createElement("p");
  N.dataset.control = "presenter-position", B.dataset.control = "presenter-timer", B.setAttribute("aria-label", "Elapsed presentation time"), w.setAttribute("role", "status"), C.append(b, N, B);
  function j(X) {
    console.error("Presenter view failed:", X), w.textContent = X.message;
  }
  function g(X, Ee, O) {
    const ve = f.createElement("button");
    return ve.className = "btn-small", ve.textContent = X, ve.title = X, ve.dataset.control = Ee, ve.addEventListener("click", () => {
      try {
        Promise.resolve(O()).catch(j);
      } catch (ge) {
        j(ge);
      }
    }), C.append(ve), ve;
  }
  const M = g("Previous", "presenter-previous", () => d(-1)), A = g("Next", "presenter-next", () => d(1)), s = g("Present", "presenter-start", l), J = g("End presentation", "presenter-end", h);
  let _ = 0, V = null;
  function me() {
    const X = Math.floor((_ + (V === null ? 0 : Date.now() - V)) / 1e3);
    B.textContent = "Elapsed " + String(Math.floor(X / 60)).padStart(2, "0") + ":" + String(X % 60).padStart(2, "0");
  }
  g("Reset timer", "presenter-reset-timer", () => {
    _ = 0, V !== null && (V = Date.now()), me();
  });
  const k = f.createElement("div");
  k.className = "presenter-grid";
  function v(X, Ee) {
    const O = f.createElement("section"), ve = f.createElement("h2"), ge = f.createElement("div");
    return ve.textContent = X, ge.dataset.control = Ee, O.append(ve, ge), k.append(O), ge;
  }
  const G = v("Current slide", "presenter-current"), pe = v("Next slide", "presenter-upcoming"), R = f.createElement("h2"), Z = f.createElement("div"), oe = f.createElement("p");
  R.textContent = "Speaker notes", Z.className = "presenter-notes", Z.dataset.control = "presenter-notes", oe.className = "helper", oe.textContent = "Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.", y.append(C, oe, w, k, R, Z), x.addEventListener("keydown", (X) => {
    if (!(X.ctrlKey || X.altKey || X.metaKey || X.isComposing || X.key === " " && X.target?.tagName === "BUTTON" || !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", "Escape"].includes(X.key))) {
      X.preventDefault();
      try {
        X.key === "Escape" ? Promise.resolve(h()).catch(j) : X.key === "Home" || X.key === "End" ? c(X.key === "Home" ? "first" : "last") : d(["ArrowLeft", "ArrowUp", "PageUp"].includes(X.key) ? -1 : 1);
      } catch (O) {
        j(O);
      }
    }
  });
  const F = window.setInterval(() => {
    x.closed ? window.clearInterval(F) : me();
  }, 250);
  function ne() {
    window.clearInterval(F), x.closed || x.close(), window.removeEventListener("beforeunload", ne);
  }
  return x.addEventListener("unload", () => {
    window.clearInterval(F), window.removeEventListener("beforeunload", ne);
  }), window.addEventListener("beforeunload", ne), me(), {
    get closed() {
      return x.closed;
    },
    focus() {
      x.focus();
    },
    close: ne,
    update({ id: X, nextId: Ee, index: O, total: ve, notes: ge, presenting: Pe }) {
      if (!x.closed) {
        if (N.textContent = "Slide " + (O + 1) + " of " + ve, Z.textContent = ge || "No speaker notes for this slide.", G.replaceChildren(r(X, f)), Ee) pe.replaceChildren(r(Ee, f));
        else {
          const Ne = f.createElement("p");
          Ne.textContent = "End of presentation", pe.replaceChildren(Ne);
        }
        M.disabled = O === 0, A.disabled = O === ve - 1, s.disabled = Pe, J.disabled = !Pe, Pe && V === null ? V = Date.now() : !Pe && V !== null && (_ += Date.now() - V, V = null), me();
      }
    }
  };
}
async function Bo({ slideIds: r, renderSlide: d, title: c = "CList presentation" }) {
  const l = window.open("", "_blank");
  if (!l) throw new Error("Allow pop-up windows for CList to export slides as PDF.");
  const h = l.document;
  h.title = c, h.documentElement.lang = "en";
  const x = h.createElement("header");
  x.className = "slide-print-controls";
  const f = h.createElement("p");
  f.setAttribute("role", "status"), f.textContent = "Preparing slides…";
  const y = h.createElement("button");
  y.className = "btn", y.textContent = "Print / Save as PDF", y.title = "Open the print dialog to save this presentation as a PDF", y.disabled = !0, x.append(f, y);
  const C = h.createElement("main");
  C.className = "clist-slides slide-print-deck", h.body.replaceChildren(x, C);
  function b(N) {
    console.error("Slides PDF export failed:", N), f.className = "error-message", f.textContent = "Could not prepare PDF export: " + N.message;
  }
  y.addEventListener("click", () => {
    try {
      l.focus(), l.print();
    } catch (N) {
      b(N);
    }
  });
  try {
    const N = [];
    for (const w of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const j = w.cloneNode(!0);
      w.tagName === "LINK" && (j.href = w.href, N.push(new Promise((g, M) => {
        j.addEventListener("load", g, { once: !0 }), j.addEventListener("error", () => M(new Error("A presentation stylesheet could not load.")), { once: !0 });
      }))), h.head.append(j);
    }
    const B = h.createElement("style");
    B.textContent = `
      @page { size: 1280px 720px; margin: 0; }
      html, body { display: block; width: auto; height: auto; min-height: 100%; overflow: visible; margin: 0; padding: 0; }
      body { background: #eee; }
      .slide-print-controls { padding: 12px; font: 14px system-ui, sans-serif; }
      .slide-print-deck { padding: 0; background: transparent; }
      .slide-print-page { width: min(1280px, 100%); aspect-ratio: 16 / 9; margin: 16px auto; overflow: hidden; }
      .slide-print-deck .slide { width: 100%; height: 100%; max-width: none; box-shadow: none; container-type: inline-size; }
      .slide-print-deck .slide-object { border: 0; min-height: 0; }
      .slide-print-deck .text-content .tiptap { font-size: var(--slide-font-size, 2.6cqw); }
      @media print {
        html, body { width: 1280px; background: transparent; }
        .slide-print-controls { display: none; }
        .slide-print-deck, .slide-print-deck * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .slide-print-page { width: 1280px; height: 720px; margin: 0; break-inside: avoid; break-after: page; }
        .slide-print-page:last-child { break-after: auto; }
      }
    `, h.head.append(B);
    for (const w of r) {
      const j = h.createElement("section");
      j.className = "slide-print-page", j.append(d(w, h)), C.append(j);
    }
    if (await Promise.all(N), await h.fonts.ready, await Promise.all([...C.querySelectorAll("img")].map((w) => w.decode())), l.closed) return;
    f.textContent = "Choose Save as PDF in the print dialog. Use all pages, no margins, no headers or footers, and enable background graphics. Each slide is one landscape page; speaker notes are excluded.", y.disabled = !1;
  } catch (N) {
    throw b(N), N;
  }
}
let Dt;
function uo() {
  return window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : (Dt || (Dt = new Promise((r, d) => {
    const c = document.createElement("script"), l = "../../../js/vendor/pptxgen.bundle.js";
    c.src = new URL(l, import.meta.url).href, c.onload = () => {
      window.PptxGenJS ? r(window.PptxGenJS) : (Dt = null, c.remove(), d(new Error("The PowerPoint export library did not initialize.")));
    }, c.onerror = () => {
      Dt = null, c.remove(), d(new Error("The PowerPoint export library could not load. Please retry."));
    }, document.head.append(c);
  })), Dt);
}
const yt = (r) => r / 96, it = (r) => r * 0.75, _t = (r) => r.replace("#", ""), Uo = { system: "Arial", arial: "Arial", verdana: "Verdana", georgia: "Georgia", times: "Times New Roman", courier: "Courier New" };
function Ho(r, d) {
  const c = [];
  function l(f, y = {}) {
    if (f.nodeType === 3) {
      f.textContent && c.push({ text: f.textContent, options: { ...y } });
      return;
    }
    const C = f.nodeName.toLowerCase(), b = { ...y };
    if (["strong", "b"].includes(C) && (b.bold = !0), ["em", "i"].includes(C) && (b.italic = !0), C === "u" && (b.underline = { style: "sng" }), ["s", "strike"].includes(C) && (b.strike = "sngStrike"), ["code", "pre"].includes(C) && (b.fontFace = "Courier New"), C === "a" && /^(https?:|mailto:|tel:)/i.test(f.getAttribute("href") || "") && (b.hyperlink = { url: f.getAttribute("href") }, b.color = "2365BF", b.underline = { style: "sng" }), C === "br") {
      c.push({ text: "", options: { ...b, breakLine: !0 } });
      return;
    }
    for (const N of f.childNodes) l(N, b);
  }
  function h(f, y = null) {
    const C = f.nodeName.toLowerCase();
    if (C === "ul" || C === "ol") {
      let b = Number(f.getAttribute("start")) || 1;
      for (const N of f.children) h(N, { ordered: C === "ol", index: b++, level: (y?.level ?? -1) + 1 });
      return;
    }
    if (C === "li" || C === "blockquote" || C === "div")
      for (const b of f.childNodes)
        b.nodeType === 3 ? b.textContent.trim() && x(b, y) : h(b, y);
    else x(f, y);
  }
  function x(f, y) {
    const C = c.length, b = {};
    /^H[1-6]$/.test(f.nodeName) && (b.bold = !0), l(f, b), c.length === C && c.push({ text: "​", options: {} });
    for (const N of c.slice(C))
      N.options.paraSpaceAfter = y ? it(d * 0.2) : 6, y && (N.options.bullet = y.ordered ? { type: "number", startAt: y.index, indent: it(d * 1.5) } : { indent: it(d * 1.5) }, N.options.indentLevel = Math.min(8, y.level), N.options.hanging = it(d * 0.3));
    c[c.length - 1].options.breakLine = !0;
  }
  for (const f of r.childNodes) h(f);
  return c.length && delete c[c.length - 1].options.breakLine, c;
}
function po(r) {
  return {
    fill: r.fill ? { color: _t(r.fillColour) } : { color: "FFFFFF", transparency: 100 },
    line: r.border ? { color: _t(r.borderColour), width: it(r.width) } : { color: "FFFFFF", transparency: 100 }
  };
}
function qo(r, d, c, l) {
  const h = d.definition;
  if (h.elements.length !== 1) return !1;
  const { tag: x, attributes: f } = h.elements[0], [y, C, b, N] = h.viewBox, B = x === "rect" && !f.rx && !f.ry && (f.x || 0) === y && (f.y || 0) === C && f.width === b && f.height === N, w = x === "ellipse" && f.cx === y + b / 2 && f.cy === C + N / 2 && f.rx === b / 2 && f.ry === N / 2 || x === "circle" && b === N && f.cx === y + b / 2 && f.cy === C + N / 2 && f.r === b / 2, j = x === "line" && f.x1 === y && f.y1 === C && f.x2 === y + b && f.y2 === C + N;
  if (!B && !w && !j) return !1;
  const g = d.style.border ? Math.min(d.style.width, d.width, d.height) : 0, M = yt(g / 2), A = po({ ...d.style, width: g });
  return j && (A.fill.transparency = 100), r.addShape(B ? l.ShapeType.rect : w ? l.ShapeType.ellipse : l.ShapeType.line, {
    ...c,
    x: c.x + M,
    y: c.y + M,
    w: Math.max(1e-3, c.w - M * 2),
    h: Math.max(1e-3, c.h - M * 2),
    ...A
  }), !0;
}
async function Wo(r) {
  const d = new Image();
  d.src = r.source, await d.decode();
  const c = document.createElement("canvas"), l = Math.min(2, 4096 / Math.max(r.width, r.height));
  c.width = Math.max(1, Math.round(r.width * l)), c.height = Math.max(1, Math.round(r.height * l));
  const h = c.getContext("2d");
  if (!h) throw new Error("The browser could not prepare a presentation image.");
  h.scale(c.width / r.width, c.height / r.height);
  let x, f;
  if (r.crop?.fit === "cover")
    x = r.crop.width || Math.max(r.width, r.height * d.naturalWidth / d.naturalHeight), f = r.crop.height || x * d.naturalHeight / d.naturalWidth;
  else {
    const y = Math.min(r.width / d.naturalWidth, r.height / d.naturalHeight);
    x = d.naturalWidth * y, f = d.naturalHeight * y;
  }
  return h.drawImage(d, (r.width - x) * (r.crop?.x ?? 50) / 100, (r.height - f) * (r.crop?.y ?? 50) / 100, x, f), c.toDataURL("image/png");
}
async function $o(r, d) {
  const c = await uo(), l = new c();
  l.defineLayout({ name: "CLIST", width: yt(1280), height: yt(720) }), l.layout = "CLIST", l.title = r.title, l.subject = "CList presentation", l.author = "", l.company = "", l.lang = "en-CA";
  const h = /* @__PURE__ */ new Set();
  for (const x of r.slides) {
    const f = l.addSlide();
    f.background = { color: _t(x.background) }, x.notes && f.addNotes(x.notes);
    for (const y of x.objects) {
      const C = { x: yt(y.x), y: yt(y.y), w: yt(y.width), h: yt(y.height), rotate: ((y.rotation || 0) % 360 + 360) % 360, objectName: y.id };
      if (y.kind === "text") {
        const b = y.format;
        f.addText(y.runs.length ? y.runs : "", {
          ...C,
          ...po(y.style),
          fontFace: Uo[b.family],
          fontSize: it(b.size),
          color: _t(b.colour),
          align: b.align,
          valign: "top",
          margin: [it(5), it(8), it(5), it(8)],
          breakLine: !1,
          lineSpacingMultiple: 1.2,
          paraSpaceAfter: 6,
          wrap: !0,
          fit: "none"
        });
      } else y.kind === "shape" && qo(f, y, C, l) || (y.kind === "shape" && h.add("Custom SVG shapes were exported as images."), f.addImage({ ...C, data: await Wo(y), altText: y.alt || y.definition?.label || "" }));
    }
  }
  return { pptx: l, warnings: [...h] };
}
async function Xo(r) {
  const { pptx: d, warnings: c } = await $o(r), l = (r.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".pptx";
  return await d.writeFile({ fileName: l, compression: !0 }), c;
}
const ao = "http://schemas.openxmlformats.org/presentationml/2006/main", xn = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", $ = (r, d) => [...r?.children || []].find((c) => c.localName === d), st = (r, d) => [...r?.getElementsByTagNameNS("*", d) || []], ae = (r, d) => st(r, d)[0], ue = (r, d, c = 0) => r?.hasAttribute(d) ? Number(r.getAttribute(d)) : c, bt = (r) => r === "1" || r === "true", gt = (r) => ae(r, "ph"), Ko = (r, d, c) => ({ x: c[0] * r + c[2] * d + c[4], y: c[1] * r + c[3] * d + c[5] }), vn = (r, d) => [r[0] * d[0] + r[2] * d[1], r[1] * d[0] + r[3] * d[1], r[0] * d[2] + r[2] * d[3], r[1] * d[2] + r[3] * d[3], r[0] * d[4] + r[2] * d[5] + r[4], r[1] * d[4] + r[3] * d[5] + r[5]], kn = [1, 0, 0, 1, 0, 0], He = (r) => r / 9525;
function Jt(r, d) {
  if (!d || /[\\?#]/.test(d) || /^[a-z]+:/i.test(d)) throw new Error("The presentation contains an invalid internal relationship.");
  const c = d.startsWith("/") ? [] : r.split("/").slice(0, -1);
  for (const l of decodeURIComponent(d).split("/"))
    if (!(!l || l === "."))
      if (l === "..") {
        if (!c.length) throw new Error("A presentation relationship leaves the package.");
        c.pop();
      } else c.push(l);
  return c.join("/");
}
async function Vo(r, d = "Imported presentation.pptx") {
  if (!(r instanceof ArrayBuffer || r instanceof Uint8Array) || r.byteLength > 100 * 1024 * 1024) throw new Error("Choose a .pptx file smaller than 100 MB.");
  await uo();
  const c = await window.JSZip.loadAsync(r), l = Object.values(c.files);
  if (l.length > 1e4 || l.reduce((R, Z) => R + (Z._data?.uncompressedSize || 0), 0) > 300 * 1024 * 1024) throw new Error("This presentation is too large to import in the browser.");
  const h = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Set();
  let C = 0;
  const b = (R) => y.add((C ? "Slide " + C + ": " : "") + R);
  async function N(R, Z = !1) {
    if (h.has(R)) return h.get(R);
    const oe = c.file(R);
    if (!oe) {
      if (Z) throw new Error("The presentation is missing " + R + ".");
      return null;
    }
    if (oe._data?.uncompressedSize > 20 * 1024 * 1024) throw new Error("A presentation XML part is too large: " + R);
    const F = await oe.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(F)) throw new Error("XML document declarations are not supported in PowerPoint imports.");
    const ne = new DOMParser().parseFromString(F, "application/xml");
    if (ne.getElementsByTagName("parsererror").length) throw new Error("The presentation contains invalid XML: " + R);
    return h.set(R, ne), ne;
  }
  async function B(R) {
    if (x.has(R)) return x.get(R);
    const Z = R.split("/"), oe = Z.pop(), F = await N([...Z, "_rels", oe + ".rels"].join("/")), ne = new Map(st(F, "Relationship").map((X) => [X.getAttribute("Id"), {
      type: X.getAttribute("Type").split("/").pop(),
      external: X.getAttribute("TargetMode") === "External",
      target: X.getAttribute("Target")
    }]));
    return x.set(R, ne), ne;
  }
  async function w(R, Z) {
    const oe = [...(await B(R)).values()].find((ne) => ne.type === Z && !ne.external), F = oe && Jt(R, oe.target);
    return F ? { path: F, doc: await N(F, !0) } : null;
  }
  const g = [...(await B("")).values()].find((R) => R.type === "officeDocument" && !R.external), M = g ? Jt("", g.target) : "ppt/presentation.xml", A = await N(M, !0);
  if (A.documentElement.namespaceURI !== ao) throw new Error("This PowerPoint XML format is not supported. Save it as a standard .pptx file first.");
  const s = ae(A, "sldSz"), J = He(ue(s, "cx")), _ = He(ue(s, "cy"));
  if (!(J > 0 && _ > 0)) throw new Error("The presentation has invalid slide dimensions.");
  const V = Math.min(1280 / J, 720 / _), me = (1280 - J * V) / 2, k = (720 - _ * V) / 2;
  Math.abs(J / _ - 16 / 9) > 0.01 && b("Slides were fitted and centred on CList’s 16:9 canvas.");
  const v = [...$(A.documentElement, "sldIdLst")?.children || []];
  if (!v.length || v.length > 500) throw new Error("Import supports presentations containing 1–500 slides.");
  ae(A, "custShowLst") && b("Custom slide shows were not imported.");
  const G = [], pe = await B(M);
  for (const R of v) {
    let ge = function(I, q = "#000000") {
      if (!I) return q;
      const U = I.localName === "srgbClr" || I.localName === "schemeClr" || I.localName === "sysClr" ? I : [...I.children || []].find((W) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(W.localName));
      if (!U)
        return b("An unsupported colour was replaced."), q;
      let ce = U.localName === "schemeClr" ? O[ve[U.getAttribute("val")] || U.getAttribute("val")] : U.localName === "sysClr" ? U.getAttribute("lastClr") : U.getAttribute("val");
      if (!/^[a-f0-9]{6}$/i.test(ce || ""))
        return b("An unsupported colour was replaced."), q;
      let Y = [0, 2, 4].map((W) => parseInt(ce.slice(W, W + 2), 16));
      for (const W of U.children) {
        const ee = ue(W, "val") / 1e5;
        W.localName === "tint" ? Y = Y.map((be) => be + (255 - be) * ee) : ["shade", "lumMod"].includes(W.localName) ? Y = Y.map((be) => be * ee) : W.localName === "lumOff" ? Y = Y.map((be) => be + 255 * ee) : W.localName === "alpha" && ee !== 1 && ee !== 0 ? b("Transparency was simplified; image transparency is preserved.") : ["alpha"].includes(W.localName) || b("Some theme colour adjustments were simplified.");
      }
      return "#" + Y.map((W) => Math.round(Math.max(0, Math.min(255, W))).toString(16).padStart(2, "0")).join("");
    }, Pe = function(I, q) {
      const U = gt(I);
      if (!U || !q) return null;
      const ce = st(q, "sp").filter((Y) => gt(Y));
      return ce.find((Y) => (gt(Y).getAttribute("idx") || "0") === (U.getAttribute("idx") || "0")) || ce.find((Y) => (gt(Y).getAttribute("type") || "obj") === (U.getAttribute("type") || "obj"));
    }, Ne = function(I) {
      const q = Pe(I, ne?.doc);
      return [I, q, Pe(q || I, X?.doc)].filter(Boolean);
    }, Oe = function(I) {
      const q = I.map((E) => $(E, "spPr")).filter(Boolean), U = q.map((E) => [...E.children].find((Ce) => ["solidFill", "noFill", "gradFill", "pattFill", "blipFill", "grpFill"].includes(Ce.localName))).find(Boolean);
      U && !["solidFill", "noFill"].includes(U.localName) && b("A non-solid shape fill was simplified.");
      const ce = I.map((E) => ae($(E, "style"), "fillRef")).find(Boolean), Y = q.map((E) => $(E, "ln")).find(Boolean), W = I.map((E) => ae($(E, "style"), "lnRef")).find(Boolean), ee = ge(U?.localName === "solidFill" ? U : ce, "#51b158"), be = ge($(Y, "solidFill") || W, "#000000"), Se = He(ue(Y, "w", 12700)) * V;
      return $(Y, "prstDash")?.getAttribute("val") && $(Y, "prstDash").getAttribute("val") !== "solid" && b("Dashed shape borders were imported as solid lines."), ($(Y, "headEnd")?.getAttribute("type") !== void 0 && $(Y, "headEnd").getAttribute("type") !== "none" || $(Y, "tailEnd")?.getAttribute("type") !== void 0 && $(Y, "tailEnd").getAttribute("type") !== "none") && b("Line arrowheads were not imported."), {
        fillEnabled: U ? U.localName !== "noFill" && !st(U, "alpha").some((E) => ue(E, "val") === 0) : !!ce && ue(ce, "idx") !== 0,
        fillColour: ee,
        borderEnabled: Y ? !$(Y, "noFill") && !st(Y, "alpha").some((E) => ue(E, "val") === 0) : !!W && ue(W, "idx") !== 0,
        borderColour: be,
        borderWidth: Math.max(1, Math.min(20, Se))
      };
    }, lt = function(I, q, U = [I]) {
      const ce = U.map((re) => $($(re, "spPr"), "xfrm")).find(Boolean);
      if (!ce)
        return b("An object without a usable position was skipped."), null;
      const Y = $(ce, "off"), W = $(ce, "ext"), ee = He(ue(Y, "x")), be = He(ue(Y, "y")), Se = He(ue(W, "cx")), E = He(ue(W, "cy"));
      if (![ee, be, Se, E].every(Number.isFinite) || Se < 0 || E < 0) throw new Error("Slide " + C + " contains an invalid object position.");
      const Ce = ue(ce, "rot") / 6e4 * Math.PI / 180, z = [Math.cos(Ce), Math.sin(Ce), -Math.sin(Ce), Math.cos(Ce), 0, 0], he = vn(q, z), ye = Ko(ee + Se / 2, be + E / 2, q), Q = Math.max(1, Se * Math.hypot(he[0], he[1]) * V), ie = Math.max(1, E * Math.hypot(he[2], he[3]) * V);
      return Math.abs(he[0] * he[2] + he[1] * he[3]) > 1e-3 && b("A rotated object in a stretched group was approximated."), {
        x: ye.x * V + me - Q / 2,
        y: ye.y * V + k - ie / 2,
        width: Q,
        height: ie,
        rotation: Math.atan2(he[1], he[0]) * 180 / Math.PI,
        flipH: bt(ce.getAttribute("flipH")) !== q[0] * q[3] - q[1] * q[2] < 0,
        flipV: bt(ce.getAttribute("flipV"))
      };
    }, ct = function(I, q, U, ce) {
      const Y = $(I, "txBody");
      if (!Y) return null;
      const W = gt(I)?.getAttribute("type") || "body", ee = ae(X?.doc, "txStyles"), be = $(ee, ["title", "ctrTitle"].includes(W) ? "titleStyle" : ["body", "obj"].includes(W) ? "bodyStyle" : "otherStyle"), Se = (ie) => ae(ae(Ee?.doc, ie === "major" ? "majorFont" : "minorFont"), "latin")?.getAttribute("typeface") || "Arial";
      let E = null;
      const Ce = { arial: "arial", "arial narrow": "arial", calibri: "system", aptos: "system", "aptos display": "system", "times new roman": "times", verdana: "verdana", georgia: "georgia", "courier new": "courier" }, z = [], he = $(Y, "bodyPr");
      he?.getAttribute("vert") && he.getAttribute("vert") !== "horz" && b("Vertical text was imported horizontally."), he?.getAttribute("anchor") && he.getAttribute("anchor") !== "t" && b("Vertically aligned text was moved to the top of its text box."), (U.flipH || U.flipV) && b("Mirrored text was imported without mirroring."), ["lIns", "rIns", "tIns", "bIns"].some((ie, re) => he?.hasAttribute(ie) && Math.abs(He(ue(he, ie)) * V - (re < 2 ? 8 : 5)) > 1) && b("Text box padding was replaced with CList’s standard padding.");
      for (const ie of [...Y.children].filter((re) => re.localName === "p")) {
        const re = $(ie, "pPr"), ke = Math.max(0, Math.min(8, ue(re, "lvl"))), ze = q.map((H) => $(ae(H, "lstStyle"), "lvl" + (ke + 1) + "pPr")).filter(Boolean), qe = [$(re, "defRPr"), ...ze.map((H) => $(H, "defRPr")), $($(be, "lvl" + (ke + 1) + "pPr"), "defRPr")].filter(Boolean), et = [re, ...ze, $(be, "lvl" + (ke + 1) + "pPr")].filter(Boolean), dt = et.map((H) => H.getAttribute("algn")).find(Boolean) || "l", tt = { l: "left", ctr: "center", r: "right", just: "justify" }[dt] || "left";
        ["l", "ctr", "r", "just"].includes(dt) || b("An unsupported paragraph alignment was replaced with left alignment."), re && (ue(re, "marL") || ue(re, "marR") || ue(re, "indent") || $(re, "tabLst") || $(re, "spcBef") || $(re, "lnSpc") || $(re, "spcAft")) && b("Paragraph spacing, indents or tab stops were replaced with CList’s standard text layout.");
        const Je = [];
        for (const H of ie.children) {
          if (H.localName === "br") {
            Je.push({ type: "hardBreak" });
            continue;
          }
          if (!["r", "fld"].includes(H.localName)) continue;
          H.localName === "fld" && b("Dynamic text fields were converted to plain text.");
          const $e = $(H, "t")?.textContent || "";
          if (!$e) continue;
          const Ye = [$(H, "rPr"), ...qe].filter(Boolean), De = (Ae, Re) => Ye.find((Le) => Le.hasAttribute(Ae))?.getAttribute(Ae) ?? Re;
          let Xe = Ye.map((Ae) => $(Ae, "latin")?.getAttribute("typeface")).find(Boolean) || "+mn-lt";
          /^\+mj/.test(Xe) && (Xe = Se("major")), /^\+mn/.test(Xe) && (Xe = Se("minor"));
          const ht = Ce[Xe.toLowerCase()] || "arial";
          (!Ce[Xe.toLowerCase()] || ht === "system") && b("Font “" + Xe + "” was replaced with a CList font.");
          const Be = Number(De("sz", 2400)) / 100 / 0.75 * V;
          if (!Number.isFinite(Be) || Be <= 0) throw new Error("Slide " + C + " has an invalid text size.");
          const _e = { fontSize: Math.max(8, Math.min(200, Be)), fontFamily: ht, textColour: ge(Ye.map((Ae) => $(Ae, "solidFill")).find(Boolean), "#000000"), textAlign: tt };
          E ? JSON.stringify(E) !== JSON.stringify(_e) && b("Mixed font sizes, fonts, colours or alignment within a text box were simplified to its first text style.") : E = _e, (Be < 8 || Be > 200) && b("A text size was adjusted to CList’s 8–200 pixel range.");
          const ut = [];
          bt(De("b", "0")) && ut.push({ type: "bold" }), bt(De("i", "0")) && ut.push({ type: "italic" }), De("u", "none") !== "none" && ut.push({ type: "underline" }), De("strike", "noStrike") !== "noStrike" && ut.push({ type: "strike" }), Number(De("baseline", 0)) && b("Superscript or subscript text was imported on the baseline.");
          const nt = Ye.map((Ae) => $(Ae, "hlinkClick")).find(Boolean);
          if (nt) {
            const Ae = ce.get(nt.getAttributeNS(xn, "id"));
            Ae?.external && /^(https?:|mailto:|tel:)/i.test(Ae.target) ? ut.push({ type: "link", attrs: { href: Ae.target } }) : b("An internal or unsupported hyperlink was removed.");
          }
          Je.push({ type: "text", text: $e, marks: ut });
        }
        const We = et.map((H) => [...H.children].find(($e) => ["buNone", "buChar", "buAutoNum", "buBlip"].includes($e.localName))).find(Boolean);
        We?.localName === "buBlip" && b("Picture bullets were replaced with standard bullets."), We?.localName === "buAutoNum" && We.getAttribute("type") !== "arabicPeriod" && b("A numbering style was replaced with decimal numbering."), z.push({ type: "paragraph", content: Je, list: We && We.localName !== "buNone" ? { type: We.localName === "buAutoNum" ? "orderedList" : "bulletList", level: ke, start: ue(We, "startAt", 1) } : null });
      }
      const ye = [], Q = [];
      for (const ie of z) {
        const { list: re, ...ke } = ie;
        if (!re) {
          Q.length = 0, ye.push(ke);
          continue;
        }
        const ze = Math.min(re.level, Q.length);
        if (Q.length = Math.min(Q.length, ze + 1), !Q[ze] || Q[ze].type !== re.type) {
          const qe = { type: re.type, ...re.type === "orderedList" ? { attrs: { start: re.start } } : {}, content: [] };
          ze && Q[ze - 1]?.content.length ? Q[ze - 1].content.at(-1).content.push(qe) : ye.push(qe), Q[ze] = qe;
        }
        Q[ze].content.push({ type: "listItem", content: [ke] });
      }
      return { kind: "text", ...E || { fontSize: 32, fontFamily: "arial", textColour: "#000000", textAlign: "left" }, text: ye };
    }, xt = function(I, q) {
      const U = q.map((ee) => $(ee, "spPr")).find((ee) => $(ee, "prstGeom") || $(ee, "custGeom")) || $(I, "spPr"), ce = $(U, "prstGeom"), Y = ce?.getAttribute("prst") || (I.localName === "cxnSp" ? "line" : "rect");
      if ($(U, "custGeom"))
        return b("A custom vector shape was skipped."), null;
      ae(ce, "gd") && b("Custom adjustments to a preset shape were simplified.");
      const W = {
        rect: { tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } },
        ellipse: { tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } },
        roundRect: { tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3, rx: 160, ry: 160 } },
        line: { tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } },
        triangle: { tag: "polygon", attributes: { points: "500,0 1000,1000 0,1000" } },
        rtTriangle: { tag: "polygon", attributes: { points: "0,0 1000,1000 0,1000" } },
        diamond: { tag: "polygon", attributes: { points: "500,0 1000,500 500,1000 0,500" } },
        parallelogram: { tag: "polygon", attributes: { points: "250,0 1000,0 750,1000 0,1000" } },
        hexagon: { tag: "polygon", attributes: { points: "250,0 750,0 1000,500 750,1000 250,1000 0,500" } }
      };
      return W[Y] ? { id: "pptx-" + Y.toLowerCase(), label: Y, width: 100, height: 100, defaults: {}, viewBox: [0, 0, 1e3, 1e3], elements: [W[Y]] } : (b("Unsupported shape “" + Y + "” was skipped; any text was retained."), null);
    };
    C++;
    const Z = pe.get(R.getAttributeNS(xn, "id"));
    if (!Z || Z.external || Z.type !== "slide") throw new Error("Slide " + C + " has no valid slide relationship.");
    const oe = Jt(M, Z.target), F = await N(oe, !0), ne = await w(oe, "slideLayout"), X = ne && await w(ne.path, "slideMaster"), Ee = X && await w(X.path, "theme"), O = { dk1: "000000", lt1: "FFFFFF", dk2: "1F497D", lt2: "EEECE1", accent1: "4F81BD", accent2: "C0504D", hlink: "0000FF", folHlink: "800080" };
    for (const I of ae(Ee?.doc, "clrScheme")?.children || []) O[I.localName] = I.firstElementChild?.getAttribute("lastClr") || I.firstElementChild?.getAttribute("val") || O[I.localName];
    const ve = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    for (const I of [ae(X?.doc, "clrMap"), ae(ne?.doc, "overrideClrMapping"), ae(F, "overrideClrMapping")]) for (const q of I?.attributes || []) ve[q.name] = q.value;
    async function rt(I, q, U) {
      const ce = $(I, "blip"), Y = (await B(q)).get(ce?.getAttributeNS(xn, "embed"));
      if (!Y || Y.external || Y.type !== "image")
        return b("A linked or missing picture was skipped; no external images were fetched."), null;
      const W = Jt(q, Y.target), ee = W.split(".").pop().toLowerCase(), be = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[ee];
      if (!be)
        return b("A picture in unsupported format ." + ee + " was skipped."), null;
      if (!f.has(W)) {
        const ie = c.file(W);
        if (!ie) throw new Error("A presentation picture is missing: " + W);
        f.set(W, "data:" + be + ";base64," + await ie.async("base64"));
      }
      let Se = f.get(W);
      const E = new Image();
      await new Promise((ie, re) => {
        E.onload = ie, E.onerror = () => re(new Error("Slide " + C + " contains an image the browser could not read.")), E.src = Se;
      });
      const Ce = $(I, "srcRect"), z = ue(Ce, "l") / 1e5, he = ue(Ce, "t") / 1e5, ye = ue(Ce, "r") / 1e5, Q = ue(Ce, "b") / 1e5;
      if (z + ye >= 1 || he + Q >= 1 || ![z, he, ye, Q].every(Number.isFinite)) throw new Error("Slide " + C + " contains invalid image cropping.");
      if (z || he || ye || Q || U.flipH || U.flipV || Math.abs(E.naturalWidth / E.naturalHeight - U.width / U.height) > 1e-3) {
        const ie = document.createElement("canvas"), re = Math.min(2, 4096 / Math.max(U.width, U.height));
        ie.width = Math.max(1, Math.round(U.width * re)), ie.height = Math.max(1, Math.round(U.height * re));
        const ke = ie.getContext("2d");
        if (!ke) throw new Error("The browser could not prepare an imported image.");
        ke.translate(U.flipH ? ie.width : 0, U.flipV ? ie.height : 0), ke.scale(U.flipH ? -1 : 1, U.flipV ? -1 : 1), ke.drawImage(E, z * E.naturalWidth, he * E.naturalHeight, (1 - z - ye) * E.naturalWidth, (1 - he - Q) * E.naturalHeight, 0, 0, ie.width, ie.height), Se = ie.toDataURL("image/png");
      }
      return ce?.children.length && b("Picture effects and SVG-specific extensions were not imported; the embedded raster picture was used."), ($(I, "tile") || [...ae(I, "fillRect")?.attributes || []].some((ie) => Number(ie.value))) && b("Picture tiling or fill offsets were simplified."), { kind: "image", source: Se, alt: "", imageFit: "contain", imageRatio: U.width / U.height, keepAspectRatio: !0, aspectRatio: U.width / U.height };
    }
    const je = { background: "#ffffff", notes: "", objects: [] };
    async function Ke(I, q, U = kn, ce = !1) {
      if (!I) return;
      const Y = await B(q);
      for (const W of I?.children || []) {
        if (["nvGrpSpPr", "grpSpPr", "extLst"].includes(W.localName)) continue;
        if (W.namespaceURI !== ao) {
          b("An extension object was skipped.");
          continue;
        }
        if (W.localName === "grpSp") {
          const Q = $($(W, "grpSpPr"), "xfrm"), ie = $(Q, "off"), re = $(Q, "ext"), ke = $(Q, "chOff"), ze = $(Q, "chExt"), qe = ue(re, "cx") / ue(ze, "cx"), et = ue(re, "cy") / ue(ze, "cy");
          if (!Number.isFinite(qe) || !Number.isFinite(et)) {
            b("A group with invalid dimensions was skipped.");
            continue;
          }
          const dt = He(ue(ie, "x")), tt = He(ue(ie, "y")), Je = He(ue(re, "cx")), We = He(ue(re, "cy")), H = dt + Je / 2, $e = tt + We / 2, Ye = ue(Q, "rot") / 6e4 * Math.PI / 180, De = Math.cos(Ye), Xe = Math.sin(Ye), ht = bt(Q.getAttribute("flipH")) ? -1 : 1, Be = bt(Q.getAttribute("flipV")) ? -1 : 1, _e = vn([De * ht, Xe * ht, -Xe * Be, De * Be, H, $e], [qe, 0, 0, et, dt - H - He(ue(ke, "x")) * qe, tt - $e - He(ue(ke, "y")) * et]);
          b("Grouped objects were imported as individual editable objects."), await Ke(W, q, vn(U, _e), ce);
          continue;
        }
        if (!["sp", "pic", "cxnSp"].includes(W.localName)) {
          b((W.localName === "graphicFrame" ? "A chart, table or SmartArt object" : "Unsupported object “" + W.localName + "”") + " was skipped.");
          continue;
        }
        if (W.localName === "cxnSp" && (ae(W, "stCxn") || ae(W, "endCxn")) && b("An attached connector was imported as an ordinary line."), ce && gt(W)) {
          ["ftr", "hdr", "dt", "sldNum"].includes(gt(W).getAttribute("type")) && st(W, "t").some((Q) => Q.textContent.trim()) && b("Template footer, header, date or slide-number placeholders were not imported.");
          continue;
        }
        if (bt(ae(W, "cNvPr")?.getAttribute("hidden"))) {
          b("A hidden object was skipped.");
          continue;
        }
        const ee = ce ? [W] : Ne(W), be = lt(W, U, ee);
        if (!be) continue;
        const { flipH: Se, flipV: E, ...Ce } = be, z = Oe(ee);
        if ((ae(W, "effectLst")?.children.length || ae(W, "effectDag") || ae(W, "scene3d") || ae(W, "sp3d")) && b("Shadows, 3D or other visual effects were not imported."), W.localName === "pic") {
          const Q = await rt($(W, "blipFill"), q, be);
          if (Q) {
            Q.alt = ae(W, "cNvPr")?.getAttribute("descr") || ae(W, "cNvPr")?.getAttribute("name") || "";
            const ie = ae($(W, "spPr"), "prstGeom")?.getAttribute("prst");
            ie && ie !== "rect" && b("A picture shape mask was replaced with a rectangular image."), je.objects.push({ ...Ce, ...Q });
          }
          continue;
        }
        const he = ct(W, ee, be, Y), ye = xt(W, ee);
        if (ye && (z.fillEnabled || z.borderEnabled)) {
          if ((Se || E) && !["rect", "ellipse", "roundRect"].includes(ye.label)) {
            const [Q] = ye.elements;
            Q.tag === "line" ? (Se && ([Q.attributes.x1, Q.attributes.x2] = [Q.attributes.x2, Q.attributes.x1]), E && ([Q.attributes.y1, Q.attributes.y2] = [Q.attributes.y2, Q.attributes.y1])) : Q.tag === "polygon" && (Q.attributes.points = Q.attributes.points.split(" ").map((ie) => {
              const [re, ke] = ie.split(",").map(Number);
              return (Se ? 1e3 - re : re) + "," + (E ? 1e3 - ke : ke);
            }).join(" "));
          }
          je.objects.push({ ...Ce, ...z, kind: "shape", shapeDefinition: ye, shapeType: ye.id });
        }
        he && je.objects.push({ ...Ce, ...he, fillEnabled: !1, borderEnabled: !1 });
      }
    }
    const P = [ae(F, "bg"), ae(ne?.doc, "bg"), ae(X?.doc, "bg")].find(Boolean);
    if (P) {
      const I = $(P, "bgPr"), q = $(I, "solidFill") || $(P, "bgRef");
      if (q) je.background = ge(q, "#ffffff");
      else if ($(I, "blipFill")) {
        const U = ae(F, "bg") ? oe : ae(ne?.doc, "bg") ? ne.path : X.path, ce = { x: me, y: k, width: J * V, height: _ * V }, Y = await rt($(I, "blipFill"), U, ce);
        Y && je.objects.push({ ...ce, ...Y });
      } else $(I, "noFill") || b("An unsupported slide background was replaced with white.");
    }
    F.documentElement.getAttribute("showMasterSp") !== "0" && ne?.doc.documentElement.getAttribute("showMasterSp") !== "0" && await Ke(ae(X?.doc, "spTree"), X?.path, kn, !0), await Ke(ae(ne?.doc, "spTree"), ne?.path, kn, !0), await Ke(ae(F, "spTree"), oe);
    const m = await w(oe, "notesSlide");
    m && (je.notes = st(m.doc, "sp").filter((I) => !["sldImg", "sldNum", "hdr", "ftr", "dt"].includes(gt(I)?.getAttribute("type"))).map((I) => st($(I, "txBody"), "p").map((q) => st(q, "t").map((U) => U.textContent).join("")).join(`
`)).filter(Boolean).join(`
`)), m && (ae(m.doc, "pic") || ae(m.doc, "graphicFrame")) && b("Images or other non-text content in speaker notes were not imported."), (ae(F, "timing") || ae(F, "transition")) && b("Animations and slide transitions were not imported."), F.documentElement.getAttribute("show") === "0" && b("This hidden slide was imported as a visible slide.");
    const se = await B(oe);
    for (const I of se.values()) ["chart", "diagramData", "oleObject", "audio", "video", "media", "comments", "comment"].includes(I.type) && b("Charts, SmartArt, embedded files, media or comments are not supported.");
    if (je.objects.length > 5e3 || G.reduce((I, q) => I + q.objects.length, 0) + je.objects.length > 2e4) throw new Error("This presentation contains too many objects to import in the browser.");
    G.push(je);
  }
  return { title: d.replace(/\.pptx$/i, ""), slides: G, warnings: [...y] };
}
function Go({ getDocument: r, encode: d, getName: c, onError: l = () => {
}, createWorker: h = () => new Worker(new URL(
  /* @vite-ignore */
  "" + new URL("assets/recovery-worker-Dt1l0aQJ.js", import.meta.url).href,
  import.meta.url
), { type: "module" }) }) {
  let x = null, f = null, y = 0, C = !1;
  const b = /* @__PURE__ */ new Map();
  function N(j) {
    const g = !b.size && !C;
    x?.terminate(), x = null, f = null;
    for (const M of b.values()) M.reject(j);
    b.clear(), g && l(j);
  }
  function B(j) {
    if (!(!x || f !== r()) && j instanceof Uint8Array)
      try {
        x.postMessage({ type: "update", update: j });
      } catch (g) {
        N(g);
      }
  }
  function w() {
    return new Promise((j, g) => {
      try {
        if (C) throw new Error("The recovery snapshot worker is closed.");
        x || (x = h(), x.onmessage = ({ data: s }) => {
          if (s.error) {
            N(new Error(s.error));
            return;
          }
          const J = b.get(s.id);
          J && (b.delete(s.id), J.resolve(s.content));
        }, x.onerror = () => N(new Error("The background recovery worker could not run. Reload CList and use Save to protect your presentation.")), x.onmessageerror = () => N(new Error("The background recovery snapshot could not be read.")));
        const M = r();
        f !== M && (x.postMessage({ type: "reset", update: d(M) }), f = M);
        const A = ++y;
        b.set(A, { resolve: j, reject: g }), x.postMessage({ type: "snapshot", id: A, name: c() });
      } catch (M) {
        N(M), g(M);
      }
    });
  }
  return { changed: B, snapshot: w, destroy() {
    C = !0, N(new Error("The slide editor closed before recovery finished."));
  } };
}
function En(r, d, c) {
  const l = [...r], h = new Set(d), x = c < 0 ? l.map((f, y) => y) : l.map((f, y) => y).reverse();
  for (const f of x) {
    const y = f + c;
    y >= 0 && y < l.length && h.has(l[f]) && !h.has(l[y]) && ([l[f], l[y]] = [l[y], l[f]]);
  }
  return l;
}
function Jo(r, d, c) {
  const l = new Set(d);
  if (c && (!r.includes(c) || l.has(c))) return [...r];
  const h = r.filter((f) => l.has(f)), x = r.filter((f) => !l.has(f));
  return x.splice(c ? x.indexOf(c) : x.length, 0, ...h), x;
}
function Yo(r, d, c, { matchCase: l = !1, wholeWord: h = !1 } = {}) {
  if (!c) return [];
  const x = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), f = new RegExp(h ? "(?<![\\p{L}\\p{N}_])" + x + "(?![\\p{L}\\p{N}_])" : x, l ? "gu" : "giu"), y = [];
  for (const [C, b] of d.entries()) {
    let N = function(w, j) {
      if (w instanceof r.XmlText) {
        const M = w.toDelta().map((A) => typeof A.insert == "string" ? A.insert : "￼").join("");
        f.lastIndex = 0;
        for (const A of M.matchAll(f)) y.push({
          entry: b,
          order: C,
          text: w,
          start: A.index,
          length: A[0].length,
          from: j + A.index,
          to: j + A.index + A[0].length,
          snippet: M.slice(Math.max(0, A.index - 25), A.index + A[0].length + 40).replace(/\s+/g, " ")
        });
        return w.length;
      }
      if (["hardBreak", "horizontalRule"].includes(w.nodeName)) return 1;
      let g = 1;
      for (const M of w.toArray()) g += N(M, j + g);
      return g + 1;
    }, B = 0;
    for (const w of b.fragment.toArray()) B += N(w, B);
  }
  return y;
}
function so(r, d) {
  const c = /* @__PURE__ */ new Map();
  for (const l of r)
    c.has(l.text) || c.set(l.text, []), c.get(l.text).push(l);
  for (const [l, h] of c)
    for (const x of h.sort((f, y) => y.start - f.start)) {
      let f = 0, y = {};
      for (const C of l.toDelta()) {
        const b = typeof C.insert == "string" ? C.insert.length : 1;
        if (x.start < f + b) {
          y = C.attributes || {};
          break;
        }
        f += b;
      }
      l.delete(x.start, x.length), d && l.insert(x.start, d, y);
    }
}
function _o({ root: r, Y: d, getDocument: c, getEntries: l, jump: h, transact: x, canEdit: f, selectedText: y, report: C, onError: b }) {
  const N = r.querySelector(".inspector"), B = r.querySelector(".tools"), w = document.createElement("button");
  w.className = "clist-action-btn", w.type = "button", w.dataset.control = "open-find", w.title = "Find and replace across slides (Ctrl/Cmd+F)", w.setAttribute("aria-label", w.title);
  const j = document.createElement("span");
  j.className = "material-icons md-18 md-light", j.textContent = "search", w.append(j), B.append(w);
  const g = document.createElement("details");
  g.className = "control-section", g.dataset.panel = "find";
  const M = document.createElement("summary");
  M.textContent = "Find and replace";
  const A = document.createElement("div");
  A.className = "control-section-body", g.append(M, A), N.prepend(g);
  function s(m, se, I) {
    const q = document.createElement("label"), U = document.createElement("input");
    return U.type = se, U.dataset.control = I, U.title = m, se !== "checkbox" && (U.maxLength = 512, U.autocomplete = "off"), q.append(document.createTextNode(m), U), A.append(q), U;
  }
  const J = s("Find in slide text", "search", "find-query"), _ = s("Replace with", "text", "find-replacement"), V = s("Match case", "checkbox", "find-case"), me = s("Whole words", "checkbox", "find-word"), k = document.createElement("div");
  k.className = "object-alignment", A.append(k);
  const v = document.createElement("p");
  v.className = "helper", v.setAttribute("role", "status"), A.append(v);
  const G = document.createElement("div");
  G.className = "object-list", G.dataset.control = "find-results", G.setAttribute("aria-label", "Matching slide text"), A.append(G);
  const pe = document.createElement("p");
  pe.className = "helper", pe.textContent = "Searches text boxes on all slides. Locked boxes can be found but are not replaced. Enter/F3 finds next; Shift+F3 finds previous.", A.append(pe);
  let R = [], Z = -1, oe = null, F = null, ne = !1;
  function X(m) {
    return () => {
      try {
        m();
      } catch (se) {
        b(se);
      }
    };
  }
  function Ee(m, se, I) {
    const q = document.createElement("button");
    return q.type = "button", q.className = "btn btn-small", q.textContent = m, q.title = m, q.dataset.control = se, q.addEventListener("click", X(I)), k.append(q), q;
  }
  function O(m) {
    oe = m ? d.createRelativePositionFromTypeIndex(m.text, m.start) : null;
  }
  function ve() {
    v.textContent = J.value ? R.length ? (Z >= 0 ? Z + 1 + " of " : "") + R.length + " matches" + (Z >= 0 ? " · Slide " + R[Z].entry.slideNumber : "") : "No matches." : "Enter text to search.", rt.disabled = ct.disabled = !R.length || !f(), xt.disabled = Z < 0 || !R[Z] || R[Z].entry.locked || !f(), je.disabled = !R.some((m) => !m.entry.locked) || !f(), G.replaceChildren();
    for (const [m, se] of R.slice(0, 100).entries()) {
      const I = document.createElement("button");
      I.type = "button", I.className = "btn btn-small", I.textContent = "Slide " + se.entry.slideNumber + (se.entry.locked ? " (locked)" : "") + ": " + se.snippet, I.title = I.textContent, I.setAttribute("aria-pressed", String(m === Z)), I.addEventListener("click", X(() => {
        ge();
        const q = R.findIndex((U) => U.text === se.text && U.start === se.start);
        q >= 0 && Pe(q);
      })), G.append(I);
    }
    R.length > 100 && (v.textContent += ". First 100 results shown; Next/Previous visit all matches.");
  }
  function ge(m = !1) {
    clearTimeout(F), F = null;
    const se = !m && oe ? d.createAbsolutePositionFromRelativePosition(oe, c()) : null;
    R = Yo(d, l(), J.value, { matchCase: V.checked, wholeWord: me.checked }), Z = se ? R.findIndex((I) => I.text === se.type && I.start === se.index) : -1, Z < 0 && (oe = null), ve();
  }
  function Pe(m) {
    !f() || !R.length || (Z = (m + R.length) % R.length, O(R[Z]), h(R[Z]), g.open = !0, ve());
  }
  function Ne(m) {
    ge(), Pe(Z < 0 ? m > 0 ? 0 : R.length - 1 : Z + m);
  }
  function Oe() {
    if (ge(), !f() || Z < 0 || R[Z].entry.locked) return;
    const m = R[Z], se = m.from + _.value.length;
    x([m], () => so([m], _.value)), ge(!0);
    const I = R.findIndex((q) => q.order > m.order || q.order === m.order && q.from >= se);
    R.length && Pe(I < 0 ? 0 : I), C("Replaced one match.");
  }
  function lt() {
    if (ge(), !f()) return;
    const m = R.filter((I) => !I.entry.locked), se = R.length - m.length;
    m.length && (x(m, () => so(m, _.value)), ge(!0), C("Replaced " + m.length + " matches." + (se ? " Skipped " + se + " matches in locked text boxes." : "")));
  }
  const rt = Ee("Previous", "find-previous", () => Ne(-1)), ct = Ee("Next", "find-next", () => Ne(1)), xt = Ee("Replace", "find-replace", Oe), je = Ee("Replace all", "find-replace-all", lt);
  function Ke(m = !1) {
    if (!f()) return;
    for (const I of N.querySelectorAll(":scope > .control-section")) I.open = I === g;
    const se = y();
    se && se.length <= 512 && !se.includes(`
`) && (J.value = se), g.open = !0, ge(!0), g.scrollIntoView({ block: "nearest" }), (m ? _ : J).focus(), (m ? _ : J).select();
  }
  w.addEventListener("click", X(() => Ke())), g.addEventListener("toggle", X(() => {
    g.open && ge();
  })), J.addEventListener("input", X(() => {
    oe = null, clearTimeout(F), F = setTimeout(X(() => ge(!0)), 150);
  }));
  for (const m of [V, me]) m.addEventListener("change", X(() => ge(!0)));
  function P(m) {
    (m.ctrlKey || m.metaKey) && !m.altKey && ["f", "h"].includes(m.key.toLowerCase()) && f() ? (m.preventDefault(), m.stopImmediatePropagation(), X(() => Ke(m.key.toLowerCase() === "h"))()) : m.key === "F3" && g.open && J.value && f() ? (m.preventDefault(), m.stopImmediatePropagation(), X(() => Ne(m.shiftKey ? -1 : 1))()) : g.contains(m.target) && (m.key === "Escape" ? (m.preventDefault(), m.stopImmediatePropagation(), g.open = !1, w.focus()) : m.key === "Enter" && [J, _].includes(m.target) && (m.preventDefault(), m.stopImmediatePropagation(), X(() => m.target === J ? Ne(m.shiftKey ? -1 : 1) : Oe())()));
  }
  return r.addEventListener("keydown", P, !0), ve(), {
    isOpen: () => g.open,
    changed() {
      !ne && g.open && J.value && (clearTimeout(F), F = setTimeout(X(() => ge()), 150));
    },
    presenting(m) {
      w.disabled = m, m && (g.open = !1);
    },
    destroy() {
      ne = !0, clearTimeout(F), r.removeEventListener("keydown", P, !0), g.remove(), w.remove();
    }
  };
}
const Zo = `
:root { --highlight-color:#2e7d32; --highlight-hover:#1b5e20; --highlight-text-color:#fff; font-family:system-ui,sans-serif; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#151b23; color:#fff; }
.stage { display:grid; justify-items:center; gap:16px; padding:16px; }
.slide { position:relative; width:min(100%,1280px); aspect-ratio:16/9; overflow:hidden; container-type:inline-size; color:#202b3d; background:#fff; font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
.slide[hidden] { display:none; }
.slide-object { position:absolute; border:0; min-height:0; overflow:visible; }
.text-content { height:100%; width:100%; overflow:hidden; padding:5px 8px; }
.text-content .tiptap { height:100%; line-height:1.2; font-size:var(--slide-font-size,2.6cqw); color:inherit; text-align:inherit; }
.text-content p { margin:0 0 8px; font:inherit; color:inherit; }
.text-content h1 { font-size:1em; } .text-content h2 { font-size:1.5rem; } .text-content h3 { font-size:1.25rem; } .text-content h4 { font-size:1.125rem; }
.text-content h1,.text-content h2,.text-content h3,.text-content h4 { font-weight:650; line-height:1.2; }
.text-content ul,.text-content ol { margin:0 0 .3em; padding:0 0 0 1.5em; font:inherit; color:inherit; list-style-position:outside; }
.text-content ul { list-style-type:disc; } .text-content ol { list-style-type:decimal; }
.text-content li { display:list-item; margin:0; padding:0; font:inherit; color:inherit; }
.text-content li::marker { font-size:1em; color:inherit; } .text-content li>p { margin:0 0 .2em; }
.text-content a { color:#2365bf; text-decoration:underline; }
.image-content { width:100%; height:100%; overflow:hidden; }
.image-content img { width:100%; height:100%; object-fit:contain; display:block; }
.shape-content,.shape-content svg { display:block; width:100%; height:100%; }
.shape-content { container-type:inline-size; }
.controls { position:fixed; inset:auto 0 0; min-height:64px; display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:8px; padding:8px; background:#151b23; z-index:1; font-size:14px; }
.controls[hidden] { display:none; }
button { font:inherit; cursor:pointer; border:0; }
.btn { display:inline-block; background:var(--highlight-color); color:var(--highlight-text-color); padding:6px 10px; border-radius:4px; }
.btn:hover { background:var(--highlight-hover); } .btn:disabled { opacity:.45; cursor:default; }
.btn:focus-visible,a:focus-visible { outline:2px solid #fff; outline-offset:2px; }
.interactive .stage { position:fixed; inset:0 0 64px; display:flex; align-items:center; justify-content:center; padding:0; }
.interactive .slide { flex:none; width:min(100vw,calc((100dvh - 64px)*16/9)); }
.viewer-status { position:fixed; bottom:68px; left:8px; right:8px; text-align:center; background:#151b23; }
@media print {
  @page { size:1280px 720px; margin:0; }
  html,body { width:1280px; height:auto; overflow:visible; background:#fff; }
  .stage,.interactive .stage { position:static; display:block; padding:0; }
  .slide,.interactive .slide,.slide[hidden] { display:block!important; width:1280px; height:720px; margin:0; break-inside:avoid; break-after:page; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .slide:last-child { break-after:auto; }
  .controls,.viewer-status { display:none!important; }
}
`;
function Qo() {
  const r = [...document.querySelectorAll(".stage > .slide")], d = document.querySelector('[data-action="previous"]'), c = document.querySelector('[data-action="next"]'), l = document.querySelector('[data-action="fullscreen"]'), h = document.querySelector("output"), x = document.querySelector(".viewer-status");
  let f = 0, y;
  function C(N) {
    f = Math.max(0, Math.min(r.length - 1, N)), r.forEach((B, w) => {
      B.hidden = w !== f;
    }), d.disabled = f === 0, c.disabled = f === r.length - 1, h.textContent = f + 1 + " / " + r.length, ["http:", "https:", "file:"].includes(location.protocol) && history.replaceState(null, "", location.href.split("#")[0] + "#slide-" + (f + 1));
  }
  function b() {
    const N = location.hash.match(/^#slide-(\d+)$/);
    return N ? Number(N[1]) - 1 : 0;
  }
  d.addEventListener("click", () => C(f - 1)), c.addEventListener("click", () => C(f + 1)), l.disabled = !document.documentElement.requestFullscreen, l.addEventListener("click", async () => {
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    } catch (N) {
      console.error("Fullscreen failed:", N), x.textContent = "Full screen is unavailable. You can continue viewing in this window.", clearTimeout(y), y = setTimeout(() => {
        x.textContent = "";
      }, 3e3);
    }
  }), document.addEventListener("fullscreenchange", () => {
    l.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  }), window.addEventListener("hashchange", () => C(b())), document.addEventListener("keydown", (N) => {
    N.ctrlKey || N.metaKey || N.altKey || N.isComposing || N.target.closest?.('input,textarea,[contenteditable="true"]') || N.key === " " && N.target.closest?.("button") || ["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(N.key) && (N.preventDefault(), N.key === "Home" ? C(0) : N.key === "End" ? C(r.length - 1) : C(f + (["ArrowRight", "ArrowDown", "PageDown", " "].includes(N.key) ? 1 : -1)));
  }), document.body.classList.add("interactive"), document.querySelector(".controls").hidden = !1, C(b());
}
async function fo({ slideIds: r, renderSlide: d, title: c = "CList presentation" }) {
  if (!r.length) throw new Error("There are no slides to export.");
  const l = document.implementation.createHTMLDocument(c);
  l.documentElement.lang = "en";
  const h = l.createElement("meta");
  h.setAttribute("charset", "utf-8"), l.head.prepend(h);
  const x = l.createElement("meta");
  x.name = "viewport", x.content = "width=device-width, initial-scale=1", l.head.append(x);
  const f = l.createElement("style");
  f.textContent = Zo, l.head.append(f);
  const y = l.createElement("main");
  y.className = "stage", y.setAttribute("aria-label", c), l.body.append(y);
  for (const [w, j] of r.entries()) {
    const g = d(j, l);
    g.id = "slide-" + (w + 1), g.setAttribute("role", "group"), g.setAttribute("aria-label", "Slide " + (w + 1) + " of " + r.length), y.append(g);
  }
  const C = l.createElement("nav");
  C.className = "controls", C.hidden = !0, C.setAttribute("aria-label", "Slide navigation");
  for (const [w, j] of [["Previous", "previous"], ["Next", "next"], ["Full screen", "fullscreen"]]) {
    const g = l.createElement("button");
    g.type = "button", g.className = "btn", g.textContent = w, g.title = w, g.dataset.action = j, C.append(g);
  }
  const b = l.createElement("output");
  b.setAttribute("aria-live", "polite"), C.insertBefore(b, C.children[1]), l.body.append(C);
  const N = l.createElement("p");
  N.className = "viewer-status", N.setAttribute("role", "status"), l.body.append(N);
  const B = l.createElement("script");
  return B.textContent = "(" + Qo.toString() + ")();", l.body.append(B), await Promise.all([...y.querySelectorAll("img")].map((w) => new Promise((j, g) => {
    const M = w.getAttribute("src") || "";
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(M)) {
      g(new Error("A slide image is missing or is not embedded."));
      return;
    }
    const A = new Image();
    A.onload = j, A.onerror = () => g(new Error("A slide image could not be read.")), A.src = M;
  }))), `<!doctype html>
` + l.documentElement.outerHTML;
}
async function ei(r) {
  const d = await fo(r), c = (r.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".html", l = URL.createObjectURL(new Blob([d], { type: "text/html;charset=utf-8" })), h = document.createElement("a");
  h.href = l, h.download = c, document.body.append(h);
  try {
    h.click();
  } finally {
    h.remove(), setTimeout(() => URL.revokeObjectURL(l), 6e4);
  }
}
async function ti({ slideIds: r, renderSlide: d }) {
  const c = document.implementation.createHTMLDocument(""), l = r.map((B) => d(B, c)), h = c.createElement("div"), x = /* @__PURE__ */ new Set(["p", "strong", "em", "s", "u", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "br"]);
  function f(B) {
    if (B.nodeType === 3) return c.createTextNode(B.textContent);
    const w = B.nodeName.toLowerCase();
    let j;
    /^h[1-6]$/.test(w) ? j = c.createElement("h3") : w === "a" && /^(https?:|mailto:|tel:)/i.test(B.getAttribute("href") || "") ? (j = c.createElement("a"), j.setAttribute("href", B.getAttribute("href"))) : x.has(w) ? j = c.createElement(w) : j = c.createDocumentFragment(), w === "ol" && /^\d+$/.test(B.getAttribute("start") || "") && j.setAttribute("start", B.getAttribute("start"));
    for (const g of B.childNodes) j.append(f(g));
    return j;
  }
  async function y(B) {
    return await new Promise((w, j) => {
      const g = new Image();
      g.onload = () => w(g), g.onerror = () => j(new Error("A slide image could not be read.")), g.src = B;
    });
  }
  function C(B, w) {
    const j = document.createElement("canvas"), g = Math.min(2, 4096 / Math.max(B, w));
    j.width = Math.max(1, Math.round(B * g)), j.height = Math.max(1, Math.round(w * g));
    const M = j.getContext("2d");
    if (!M) throw new Error("The browser could not prepare a slide image.");
    return M.scale(j.width / B, j.height / w), { element: j, context: M };
  }
  function b(B, w, j, g) {
    const M = c.createElement("p"), A = c.createElement("img"), s = Math.min(1, 720 / j);
    A.width = Math.max(1, Math.round(j * s)), A.height = Math.max(1, Math.round(g * s)), A.style.maxWidth = "100%", A.style.height = "auto", A.src = B, A.alt = w, M.append(A), h.append(M);
  }
  async function N(B) {
    const w = B.cloneNode(!0);
    w.style.width = "1280px", w.style.height = "720px";
    for (const _ of w.children) {
      const V = parseFloat(_.style.width) * 12.8;
      for (const me of [_, ..._.querySelectorAll("[style]")]) {
        const k = me.closest(".shape-content") ? V / 100 : 12.8;
        me.setAttribute("style", me.getAttribute("style").replace(/([\d.]+)cqw/g, (v, G) => Number(G) * k + "px"));
      }
    }
    const j = c.createElement("div"), g = c.createElement("style");
    g.textContent = `
      * {box-sizing:border-box;} .slide {position:relative;overflow:hidden;font-family:Arial,sans-serif;color:#202b3d;}
      .slide-object {position:absolute;} .text-content {width:100%;height:100%;overflow:hidden;padding:5px 8px;}
      .tiptap {font-size:var(--slide-font-size,33.28px);line-height:1.2;}
      p {margin:0 0 8px;} h1 {font-size:1em;} h2 {font-size:24px;} h3 {font-size:20px;}
      ul,ol {margin:0 0 .3em;padding-left:1.5em;} li p {margin-bottom:.2em;}
      .image-content {width:100%;height:100%;overflow:hidden;}
      .image-content img {display:block;width:100%;height:100%;object-fit:contain;}
      .shape-content,.shape-content svg {display:block;width:100%;height:100%;}
    `, j.append(g, w);
    const M = new XMLSerializer().serializeToString(j), A = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">' + M + "</foreignObject></svg>"), s = await y(A), J = C(1280, 720);
    return J.context.drawImage(s, 0, 0, 1280, 720), J.element.toDataURL("image/png");
  }
  for (const [B, w] of l.entries()) {
    const j = c.createElement("h2");
    j.textContent = "Slide " + (B + 1), h.append(j);
    const g = [...w.children].sort((A, s) => parseFloat(A.style.top) - parseFloat(s.style.top) || parseFloat(A.style.left) - parseFloat(s.style.left)), M = !!w.querySelector("svg");
    if (M) {
      const A = g.map((s) => s.querySelector(".tiptap")?.textContent.trim()).filter(Boolean);
      b(await N(w), "Slide " + (B + 1) + " diagram" + (A.length ? ": " + A.join("; ") : ""), 1280, 720);
    }
    for (const A of g) {
      const s = A.querySelector(".text-content .tiptap");
      if (s) {
        for (const G of s.childNodes) h.append(f(G));
        continue;
      }
      if (M) continue;
      let J, _;
      const V = A.querySelector("img"), me = A.querySelector("svg");
      let k = parseFloat(A.style.width) * 12.8, v = parseFloat(A.style.height) * 7.2;
      if (V) {
        if (J = V.getAttribute("src") || "", _ = V.alt, !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(J)) throw new Error("A slide image is missing or is not embedded.");
        const G = await y(J);
        if (V.style.position === "absolute") {
          const pe = C(k, v);
          pe.context.drawImage(G, parseFloat(V.style.left) * 12.8, parseFloat(V.style.top) * 12.8, parseFloat(V.style.width) * 12.8, parseFloat(V.style.height) * 12.8), J = pe.element.toDataURL("image/png");
        } else {
          const pe = Math.min(k / G.width, v / G.height);
          k = G.width * pe, v = G.height * pe;
        }
      } else if (me) {
        const G = me.cloneNode(!0);
        G.setAttribute("width", k), G.setAttribute("height", v);
        for (const Z of G.querySelectorAll("[vector-effect]")) {
          const oe = parseFloat(Z.style.strokeWidth) * k / 100;
          Z.style.removeProperty("stroke-width"), Z.setAttribute("stroke-width", Number.isFinite(oe) ? oe : 0);
        }
        const pe = await y("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(G))), R = C(k, v);
        R.context.drawImage(pe, 0, 0, k, v), J = R.element.toDataURL("image/png"), _ = "Diagram on slide " + (B + 1);
      } else continue;
      b(J, _ || "Image on slide " + (B + 1), k, v);
    }
    B < l.length - 1 && h.append(c.createElement("hr"));
  }
  return h.innerHTML;
}
const ni = [{ id: "rectangle", label: "Rectangle", width: 320, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } }] }, { id: "circle", label: "Circle", width: 220, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } }] }, { id: "line", label: "Line", width: 360, height: 4, defaults: { fillEnabled: !1, borderEnabled: !0, borderColour: "#202b3d", borderWidth: 4 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } }] }], oi = {
  shapes: ni
}, ii = [{ id: "blank", label: "Blank", objects: [] }, { id: "title", label: "Title", objects: [{ kind: "text", x: 100, y: 260, width: 1080, height: 140, text: "Presentation title", fontSize: 64, textAlign: "center" }] }, { id: "title-body", label: "Title and body", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 1080, height: 400, text: "Add your content here.", fontSize: 32, textAlign: "left" }] }, { id: "two-columns", label: "Two columns", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 500, height: 400, text: "Left column", fontSize: 32, textAlign: "left" }, { kind: "text", x: 680, y: 220, width: 500, height: 400, text: "Right column", fontSize: 32, textAlign: "left" }] }], ri = {
  layouts: ii
}, ai = [{ id: "classic", label: "Classic", fontFamily: "system", fontSize: 33.28, textColour: "#202b3d", background: "#ffffff", fillColour: "#51b158", borderColour: "#202b3d" }, { id: "midnight", label: "Midnight", fontFamily: "arial", fontSize: 33.28, textColour: "#f1f5f9", background: "#142033", fillColour: "#397ab8", borderColour: "#a6caed" }, { id: "paper", label: "Paper", fontFamily: "georgia", fontSize: 33.28, textColour: "#392f28", background: "#fff8e8", fillColour: "#dbb571", borderColour: "#76573a" }, { id: "ocean", label: "Ocean", fontFamily: "verdana", fontSize: 33.28, textColour: "#13354b", background: "#edf8fc", fillColour: "#56b6bd", borderColour: "#216479" }], si = {
  themes: ai
}, lo = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"]
}, Cn = (r) => typeof r == "string" && /^#[0-9a-f]{6}$/i.test(r), wt = (r) => typeof r == "number" && Number.isFinite(r);
function de(r, d) {
  if (!r) throw new Error("Slide catalog: " + d);
}
function Mn(r) {
  de(r && typeof r.id == "string" && /^[a-z][a-z0-9-]{0,79}$/.test(r.id), "invalid entry ID"), de(typeof r.label == "string" && r.label.trim().length > 0 && r.label.length <= 120, r.id + " needs a label");
}
function go(r, d) {
  const c = {};
  for (const l of ["fillEnabled", "borderEnabled", "keepAspectRatio", "locked"])
    r[l] !== void 0 && (de(typeof r[l] == "boolean", d + ": invalid " + l), c[l] = r[l]);
  for (const l of ["fillColour", "borderColour", "textColour"])
    r[l] !== void 0 && (de(Cn(r[l]), d + ": invalid " + l), c[l] = r[l]);
  for (const [l, h, x] of [["fontSize", 8, 200], ["borderWidth", 1, 20], ["rotation", -180, 180], ["cropX", 0, 100], ["cropY", 0, 100]])
    r[l] !== void 0 && (de(wt(r[l]) && r[l] >= h && r[l] <= x, d + ": invalid " + l), c[l] = r[l]);
  for (const [l, h] of [["textAlign", ["left", "center", "right", "justify"]], ["fontFamily", ["system", "arial", "verdana", "georgia", "times", "courier"]], ["imageFit", ["contain", "cover"]]])
    r[l] !== void 0 && (de(h.includes(r[l]), d + ": invalid " + l), c[l] = r[l]);
  return c;
}
function Yt(r) {
  Mn(r), de(wt(r.width) && r.width > 0 && r.width <= 1280 && wt(r.height) && r.height > 0 && r.height <= 720, r.id + ": invalid default dimensions"), de(Array.isArray(r.viewBox) && r.viewBox.length === 4 && r.viewBox.every(wt) && r.viewBox[2] > 0 && r.viewBox[3] > 0, r.id + ": invalid SVG viewBox"), de(Array.isArray(r.elements) && r.elements.length > 0 && r.elements.length <= 64, r.id + ": needs 1–64 SVG elements");
  const d = r.elements.map((c) => {
    de(c && Object.hasOwn(lo, c.tag), r.id + ": unsupported SVG element"), de(c.attributes && typeof c.attributes == "object", r.id + ": missing SVG attributes");
    const l = {};
    for (const [h, x] of Object.entries(c.attributes))
      de(lo[c.tag].includes(h), r.id + ": unsupported SVG attribute " + h), h === "d" ? de(typeof x == "string" && x.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(x), r.id + ": invalid path") : h === "points" ? de(typeof x == "string" && x.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(x), r.id + ": invalid points") : de(wt(x), r.id + ": invalid SVG coordinate"), l[h] = x;
    return { tag: c.tag, attributes: l };
  });
  return { id: r.id, label: r.label, width: r.width, height: r.height, defaults: go(r.defaults || {}, r.id), viewBox: [...r.viewBox], elements: d };
}
function li(r, d) {
  Mn(r), de(Array.isArray(r.objects) && r.objects.length <= 100, r.id + ": invalid objects array"), r.background !== void 0 && de(Cn(r.background), r.id + ": invalid background"), r.notes !== void 0 && de(typeof r.notes == "string", r.id + ": invalid notes");
  const c = r.objects.map((l) => {
    de(l && ["text", "shape", "image"].includes(l.kind), r.id + ": unsupported object kind"), de(["x", "y", "width", "height"].every((x) => wt(l[x])) && l.x >= 0 && l.y >= 0 && l.width > 0 && l.height > 0 && l.x + l.width <= 1280 && l.y + l.height <= 720, r.id + ": object is outside the slide");
    const h = { kind: l.kind, x: l.x, y: l.y, width: l.width, height: l.height, ...go(l, r.id) };
    return l.kind === "text" && (de(typeof l.text == "string", r.id + ": text object needs text"), h.text = l.text), l.kind === "shape" && (de(d.has(l.shapeId), r.id + ": unknown shape " + l.shapeId), h.shapeId = l.shapeId), l.kind === "image" && (de(typeof l.source == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(l.source), r.id + ": image needs embedded image data"), h.source = l.source, h.alt = typeof l.alt == "string" ? l.alt : ""), l.group !== void 0 && (de(typeof l.group == "string" && l.group.length <= 80, r.id + ": invalid group"), h.group = l.group), h;
  });
  return { id: r.id, label: r.label, objects: c, ...r.background !== void 0 ? { background: r.background } : {}, ...r.notes !== void 0 ? { notes: r.notes } : {} };
}
function ho(r) {
  Mn(r), de(["system", "arial", "verdana", "georgia", "times", "courier"].includes(r.fontFamily), r.id + ": invalid theme font"), de(wt(r.fontSize) && r.fontSize >= 8 && r.fontSize <= 200, r.id + ": invalid theme font size");
  const d = { id: r.id, label: r.label, fontFamily: r.fontFamily, fontSize: r.fontSize };
  for (const c of ["textColour", "background", "fillColour", "borderColour"])
    de(Cn(r[c]), r.id + ": invalid theme " + c), d[c] = r[c];
  return d;
}
function Sn(r = {}) {
  const d = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), h = r.shapes === void 0 ? oi.shapes : r.shapes, x = r.layouts === void 0 ? ri.layouts : r.layouts;
  de(Array.isArray(h) && h.length > 0, "shapes must be a nonempty array"), de(Array.isArray(x) && x.length > 0, "layouts must be a nonempty array");
  for (const y of h) {
    const C = Yt(y);
    de(!d.has(y.id), "duplicate shape ID " + y.id), d.set(y.id, C);
  }
  for (const y of x) {
    const C = li(y, d);
    de(!c.has(y.id), "duplicate layout ID " + y.id), c.set(y.id, C);
  }
  const f = r.themes === void 0 ? si.themes : r.themes;
  de(Array.isArray(f) && f.length > 0, "themes must be a nonempty array");
  for (const y of f) {
    const C = ho(y);
    de(!l.has(y.id), "duplicate theme ID " + y.id), l.set(y.id, C);
  }
  return { shapes: d, layouts: c, themes: l };
}
async function ci(r) {
  const d = await Promise.all(["shapes", "layouts", "themes"].map(async (l) => {
    const h = await fetch(new URL(l + ".json", r), { cache: "no-cache" });
    if (!h.ok) throw new Error("Could not load slide " + l + " catalog (HTTP " + h.status + ").");
    const x = await h.json();
    return de(x && x.version === 1, "unsupported " + l + " catalog version"), de(Array.isArray(x[l]), l + " catalog needs a " + l + " array"), x[l];
  })), c = { shapes: d[0], layouts: d[1], themes: d[2] };
  return Sn(c), c;
}
function di(r, d = {}) {
  if (!(r instanceof HTMLElement)) throw new TypeError("A container element is required");
  const { Y: c, Editor: l, StarterKit: h, Collaboration: x, HocuspocusProvider: f, Link: y } = d.dependencies, { shapes: C, layouts: b, themes: N } = Sn(d.catalogs), B = Sn().shapes.values().next().value, w = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new Map(), g = document.createElement("div");
  g.className = "clist-slides app", g.innerHTML = zo, r.append(g);
  const M = 1280, A = 720, s = (e) => g.querySelector(`[data-control="${e}"]`), J = s("slide-order-actions");
  for (const e of g.querySelectorAll(".tools button")) io(e);
  for (const e of C.values()) {
    const t = document.createElement("button");
    t.className = "btn-small", t.dataset.control = "add-" + e.id, t.title = "Add " + e.label, io(t, e), t.addEventListener("click", () => vo(e.id)), s("shape-tools").append(t);
  }
  for (const e of b.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, s("slide-layout").append(t);
  }
  const _ = s("slide"), V = document.createElement("div"), me = document.createElement("div");
  V.className = "alignment-guide vertical", me.className = "alignment-guide horizontal", V.hidden = me.hidden = !0, _.append(V, me);
  let k = new c.Doc(), v = k.getMap("slide-objects"), G = k.getMap("slide-pages"), pe = k.getMap("slide-backgrounds"), R = k.getMap("slide-notes"), Z = k.getMap("clist_refs"), oe = k.getMap("slide-design"), F = "first", ne = /* @__PURE__ */ new Set(["first"]), X = "first", Ee = "first";
  const O = /* @__PURE__ */ new Map(), ve = /* @__PURE__ */ new Map(), ge = /* @__PURE__ */ new Map(), Pe = /* @__PURE__ */ new Map(), Ne = /* @__PURE__ */ new Map(), Oe = /* @__PURE__ */ new Set();
  let lt = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap(), ct = !0, xt = "", je = null, Ke = !1;
  const P = /* @__PURE__ */ new Set();
  let m = null, se = null, I = !1, q = null, U = 0, ce = null, Y = !1, W = null, ee = null, be = null, Se = null, E = null, Ce = !1, z = !1, he = null, ye = null, Q = null, ie = null, re = null, ke = !1, ze = null, qe = !1;
  const et = Go({
    getDocument: () => k,
    encode: c.encodeStateAsUpdate,
    getName: () => s("doc-name").value,
    onError: (e) => {
      console.error("Background recovery failed:", e), H("Background recovery failed: " + e.message, "error");
    }
  }), dt = Io(g, () => z);
  let tt = null, Je = [], We = null;
  s("server-url").value = d.url || "", s("doc-name").value = d.documentName || "clist-slide-demo";
  function H(e, t = "") {
    s("connection-status").textContent = e, s("connection-status").className = `status ${t}`;
  }
  function $e(e) {
    et.changed(e), ze?.changed(), d.onChange?.();
  }
  function Ye(e) {
    d.onStatus ? d.onStatus(e) : H(e);
  }
  function De(e, t, n, o, i, a = null, p = "") {
    const u = new c.Map();
    u.set("x", t), u.set("y", n), u.set("width", o), u.set("height", i), u.set("rotation", 0), u.set("slide", F), u.set("layer", Math.max(-1, ...Le().map((S) => Re(v.get(S)))) + 1), a && (u.set("kind", "image"), u.set("source", a), u.set("alt", p), u.set("imageRatio", o / i), u.set("aspectRatio", o / i), u.set("keepAspectRatio", !0)), v.set(e, u);
  }
  function Xe() {
    v.size || I || (I = !0, k.transact(() => {
      v.size || (oe.has("theme") || oe.set("theme", structuredClone(_e())), De("title", 105, 98, 820, 135), De("body", 108, 296, 690, 240));
    }, "init"), O.get("title")?.editor.commands.setContent("<h1>Collaborative slides</h1>"), O.get("body")?.editor.commands.setContent("<p>Click here to edit together.</p><p>Drag the blue handle to move this box, or resize it from the lower-right corner.</p>"));
  }
  function ht(e, t) {
    const n = document.createElement("div");
    n.className = t.get("kind") === "shape" ? "slide-object shape-object" : "slide-object", n.dataset.id = e, n.tabIndex = 0, n.setAttribute("aria-label", t.get("kind") === "shape" ? "Shape object. Arrow keys move; Delete removes." : t.get("kind") === "image" ? "Image object. Arrow keys move; Delete removes." : "Text object. Arrow keys move; Enter edits.");
    const o = document.createElement("div");
    o.className = "object-grip", o.textContent = "Move";
    const i = document.createElement("div");
    i.className = t.get("kind") === "shape" ? "shape-content" : t.get("kind") === "image" ? "image-content" : "text-content";
    const a = document.createElement("div");
    a.className = "resize-handle", n.append(o, i, a), _.append(n);
    let p = null;
    if (t.get("kind") === "shape")
      i.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    else if (t.get("kind") === "image") {
      const u = document.createElement("img");
      u.src = Ct(t.get("source")), u.alt = typeof t.get("alt") == "string" ? t.get("alt") : "", u.draggable = !1, u.addEventListener("load", () => {
        O.has(e) && tn(e);
      }), i.append(u);
    } else {
      const u = k.getXmlFragment(`slide-text-${e}`);
      E?.addToScope(u), Ce = !0;
      try {
        p = new l({
          element: i,
          editable: !z,
          extensions: [
            h.configure({ undoRedo: !1, history: !1, link: !1 }),
            y.configure({ openOnClick: !1, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
            x.configure({ document: k, field: `slide-text-${e}` })
          ],
          editorProps: {
            attributes: { "aria-label": `Edit text in ${e}` }
          },
          onFocus: () => {
            se = e, Me(e, !1, P.has(e));
          },
          onBlur: () => {
            se === e && (se = null), E?.stopCapturing();
          }
        });
      } finally {
        Ce = !1;
      }
    }
    n.addEventListener("pointerdown", (u) => {
      if (!z) {
        if (u.shiftKey && u.target !== a && u.target !== o) {
          u.preventDefault(), u.stopPropagation(), Me(e, !0, !1, !0), g.tabIndex = -1, g.focus({ preventScroll: !0 });
          return;
        }
        u.target !== a && u.target !== o && Me(e, !1, !1, !0), p || n.focus({ preventScroll: !0 });
      }
    }), n.addEventListener("focus", () => Me(e, !1, P.has(e))), o.addEventListener("pointerdown", (u) => jn(u, e, "move")), a.addEventListener("pointerdown", (u) => jn(u, e, "resize")), O.set(e, { node: n, editor: p, box: t, content: i }), tn(e), m === e && n.classList.add("selected");
  }
  const Be = {
    system: "system-ui, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    georgia: "Georgia, serif",
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace'
  };
  function _e() {
    const e = oe.get("theme");
    if (e)
      try {
        return ho(e);
      } catch {
      }
    return N.values().next().value;
  }
  for (const e of N.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, s("theme").append(t);
  }
  s("theme").addEventListener("change", (e) => {
    const t = N.get(e.target.value);
    !t || z || (E?.stopCapturing(), oe.set("theme", structuredClone(t)), E?.stopCapturing(), H("Theme applied: " + t.label));
  });
  function ut() {
    const e = _e();
    let t = s("theme").querySelector("[data-document-theme]");
    N.has(e.id) ? t?.remove() : (t || (t = document.createElement("option"), t.dataset.documentTheme = "", s("theme").append(t)), t.value = e.id, t.textContent = e.label + " (saved in presentation)"), s("theme").value = e.id;
    const n = s("theme-preview");
    n.replaceChildren();
    for (const o of [e.background, e.textColour, e.fillColour, e.borderColour]) {
      const i = document.createElement("span");
      i.style.backgroundColor = o, n.append(i);
    }
  }
  function nt(e) {
    const t = _e(), n = (i, a) => /^#[0-9a-f]{6}$/i.test(e.get(i) || "") ? e.get(i) : a, o = Number(e.get("borderWidth"));
    return {
      fill: e.get("fillEnabled") === !0,
      fillColour: n("fillColour", e.get("kind") === "shape" ? t.fillColour : t.background),
      border: e.get("borderEnabled") === !0,
      borderColour: n("borderColour", t.borderColour),
      width: Number.isFinite(o) && o >= 1 && o <= 20 ? o : 2
    };
  }
  function Ae(e) {
    const t = _e(), n = Number(e.get("fontSize")), o = e.get("textColour"), i = e.get("textAlign");
    return {
      size: Number.isFinite(n) && n >= 8 && n <= 200 ? n : t.fontSize,
      colour: typeof o == "string" && /^#[0-9a-f]{6}$/i.test(o) ? o : t.textColour,
      align: ["left", "center", "right", "justify"].includes(i) ? i : "left",
      family: Object.prototype.hasOwnProperty.call(Be, e.get("fontFamily")) ? e.get("fontFamily") : t.fontFamily
    };
  }
  function Re(e) {
    const t = e.get("layer");
    return typeof t == "number" && Number.isFinite(t) ? t : 0;
  }
  function Le(e = F) {
    return [...v.keys()].filter((t) => {
      const n = v.get(t);
      return n instanceof c.Map && (n.get("slide") || "first") === e;
    }).sort((t, n) => Re(v.get(t)) - Re(v.get(n)) || t.localeCompare(n));
  }
  function Zt(e) {
    const t = (n) => {
      const o = e.get(n);
      return typeof o == "number" && Number.isFinite(o) ? Math.max(0, Math.min(100, o)) : 50;
    };
    return { fit: e.get("imageFit") === "cover" ? "cover" : "contain", x: t("cropX"), y: t("cropY") };
  }
  function vt(e, t) {
    const n = Number(e.get("cropImageWidth")), o = Number(e.get("cropImageHeight"));
    if (n > 0 && o > 0) return { width: n, height: o };
    const i = t?.naturalWidth > 0 ? t.naturalWidth / t.naturalHeight : Number(e.get("imageRatio")) || fn(e), a = Math.max(e.get("width"), e.get("height") * i);
    return { width: a, height: a / i };
  }
  function Qt(e) {
    if (e.get("kind") !== "image" || e.get("imageFit") !== "cover") return;
    const t = O.get([...v.keys()].find((o) => v.get(o) === e))?.content.querySelector("img"), n = vt(e, t);
    e.set("cropImageWidth", n.width), e.set("cropImageHeight", n.height);
  }
  function en(e, t, n = !1) {
    const o = Zt(t);
    if (e.style.objectFit = "contain", e.style.objectPosition = o.x + "% " + o.y + "%", o.fit === "cover") {
      const i = vt(t, e);
      e.style.position = "absolute", e.style.width = n ? i.width / 12.8 + "cqw" : 100 * i.width / t.get("width") + "%", e.style.height = n ? i.height / 12.8 + "cqw" : 100 * i.height / t.get("height") + "%", e.style.left = n ? (t.get("width") - i.width) * o.x / 1280 + "cqw" : (t.get("width") - i.width) * o.x / t.get("width") + "%", e.style.top = n ? (t.get("height") - i.height) * o.y / 1280 + "cqw" : (t.get("height") - i.height) * o.y / t.get("height") + "%";
    } else
      e.style.position = "static", e.style.width = e.style.height = "100%", e.style.left = e.style.top = "";
  }
  function It(e) {
    const t = e.get("shapeDefinition");
    if (t && typeof t == "object") {
      if (!w.has(t))
        try {
          w.set(t, Yt(t));
        } catch (n) {
          console.error("Invalid saved shape definition:", n), H("A saved shape definition is invalid; showing a fallback shape.", "error"), w.set(t, B);
        }
      return w.get(t);
    }
    return C.get(e.get("shapeType")) || B;
  }
  function An(e) {
    const { fillColour: t, borderColour: n, ...o } = e.defaults;
    return { kind: "shape", shapeType: e.id, shapeDefinition: structuredClone(e), ...o };
  }
  function Tt(e, t) {
    const n = "http://www.w3.org/2000/svg", o = Math.max(1, Number(t.get("width")) || 1), i = Math.max(1, Number(t.get("height")) || 1), a = nt(t), p = It(t), u = a.border ? Math.min(a.width, o, i) : 0, [S, T, L, D] = p.viewBox;
    e.setAttribute("viewBox", "0 0 " + o + " " + i), e.setAttribute("preserveAspectRatio", "none");
    const K = document.createElementNS(n, "g");
    K.setAttribute("transform", "translate(" + u / 2 + " " + u / 2 + ") scale(" + Math.max(1e-3, o - u) / L + " " + Math.max(1e-3, i - u) / D + ") translate(" + -S + " " + -T + ")");
    for (const le of p.elements) {
      const Fe = document.createElementNS(n, le.tag);
      for (const [te, Ie] of Object.entries(le.attributes)) Fe.setAttribute(te, String(Ie));
      Fe.setAttribute("fill", a.fill ? a.fillColour : "none"), Fe.setAttribute("stroke", a.border ? a.borderColour : "none"), Fe.setAttribute("vector-effect", "non-scaling-stroke"), Fe.style.strokeWidth = 100 * u / o + "cqw", Fe.setAttribute("stroke-linecap", "round"), Fe.setAttribute("stroke-linejoin", "round"), K.append(Fe);
    }
    e.replaceChildren(K);
  }
  function tn(e) {
    const t = O.get(e);
    if (!t) return;
    const { node: n, box: o } = t;
    if (n.style.left = `${100 * Number(o.get("x") || 0) / M}%`, n.style.top = `${100 * Number(o.get("y") || 0) / A}%`, n.style.width = `${100 * Number(o.get("width") || 0) / M}%`, n.style.height = `${100 * Number(o.get("height") || 0) / A}%`, n.style.transform = `rotate(${Number(o.get("rotation") || 0)}deg)`, n.classList.toggle("locked", o.get("locked") === !0), n.title = o.get("locked") === !0 ? "Locked object: select it and click Unlock to move, resize or delete." : "", n.style.zIndex = String(Le().indexOf(e)), o.get("kind") === "shape") Tt(t.content.querySelector("svg"), o);
    else if (!t.editor) {
      const i = t.content.querySelector("img"), a = Ct(o.get("source"));
      i.getAttribute("src") !== a && (i.src = a), i.alt = typeof o.get("alt") == "string" ? o.get("alt") : "", en(i, o, !0);
    }
    if (t.editor) {
      const i = Ae(o);
      n.style.setProperty("--slide-font-size", i.size / 12.8 + "cqw"), n.style.fontFamily = Be[i.family], n.style.color = i.colour, n.style.textAlign = i.align;
      const a = nt(o);
      t.content.style.backgroundColor = a.fill ? a.fillColour : "transparent", t.content.style.border = a.border ? a.width / 12.8 + "cqw solid " + a.borderColour : "none";
    }
  }
  function zt() {
    const e = R.get(F), t = typeof e == "string" ? e : "";
    s("speaker-notes").value !== t && (s("speaker-notes").value = t);
  }
  s("speaker-notes").addEventListener("input", (e) => {
    z || R.set(F, e.target.value);
  });
  function kt(e) {
    const t = pe.get(e);
    return typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t : _e().background;
  }
  s("slide-background").addEventListener("change", (e) => {
    if (z) return;
    const t = e.target.value;
    /^#[0-9a-f]{6}$/i.test(t) && pe.set(F, t);
  });
  function xe() {
    return G.size ? [...G.keys()].sort((e, t) => G.get(e) - G.get(t) || e.localeCompare(t)) : ["first"];
  }
  function nn(e) {
    const t = Pe.get(e), n = v.get(e);
    if (t !== void 0 && (Oe.add(t), Ne.get(t)?.delete(e), Ne.get(t)?.size || Ne.delete(t), Pe.delete(e)), n instanceof c.Map) {
      const o = n.get("slide") || "first";
      Pe.set(e, o), lt.set(n, e), Ne.has(o) || Ne.set(o, /* @__PURE__ */ new Set()), Ne.get(o).add(e), Oe.add(o);
    }
  }
  function mo() {
    Pe.clear(), Ne.clear(), Oe.clear(), lt = /* @__PURE__ */ new WeakMap(), rt = /* @__PURE__ */ new WeakMap(), v.forEach((e, t) => nn(t)), ct = !0;
  }
  function Rt(e) {
    for (const t of e.changed.get(v) || []) t !== null && nn(t);
    for (const [t, n] of e.changed)
      if (t === oe) ct = !0;
      else if (t === pe) for (const o of n) Oe.add(o);
      else if (lt.has(t)) nn(lt.get(t));
      else {
        let o = t;
        for (; o.parent; ) o = o.parent;
        if (!(o instanceof c.XmlFragment)) continue;
        if (!rt.has(o))
          for (const [a, p] of k.share) a.startsWith("slide-text-") && rt.set(p, a.slice(11));
        const i = Pe.get(rt.get(o));
        i !== void 0 && Oe.add(i);
      }
  }
  function Ot(e = xe()) {
    e.includes(F) || (F = e[0]), X !== F ? (ne = /* @__PURE__ */ new Set([F]), Ee = F) : (ne = new Set(e.filter((t) => ne.has(t))), ne.size || ne.add(F)), X = F, e.includes(Ee) || (Ee = F);
  }
  function Bt() {
    return Ot(), xe().filter((e) => ne.has(e));
  }
  function pt(e, t = e[0], n = t) {
    ne = new Set(e), F = t, X = t, Ee = n, m = null, P.clear();
  }
  function Et() {
    s("slide-list").querySelector(`[data-slide-id="${F}"]`)?.focus({ preventScroll: !0 });
  }
  function on(e, t = {}) {
    const n = xe();
    if (!(z || !n.includes(e))) {
      if (we(), Ot(n), t.shiftKey) {
        const o = n.indexOf(Ee), i = n.indexOf(e), a = n.slice(Math.min(o, i), Math.max(o, i) + 1);
        pt(t.ctrlKey || t.metaKey ? [...ne, ...a] : a, e, Ee);
      } else if (t.ctrlKey || t.metaKey) {
        const o = new Set(ne);
        o.has(e) && o.size > 1 ? o.delete(e) : o.add(e), pt([...o], o.has(e) ? e : o.has(F) ? F : [...o][0], e);
      } else pt([e], e);
      fe(), Et();
    }
  }
  function Ln() {
    const e = s("object-list"), t = Le().reverse();
    for (const [n, o] of ve)
      t.includes(n) || (o.remove(), ve.delete(n));
    t.forEach((n, o) => {
      const i = v.get(n), a = i.get("kind") === "image", p = i.get("kind") === "shape", u = a ? i.get("alt") : O.get(n)?.editor?.getText(), S = (typeof u == "string" ? u : "").replace(/\s+/g, " ").trim().slice(0, 60), T = p ? "Shape: " + It(i).label : (a ? "Image: " : "Text: ") + (S || (a ? "Untitled image" : "Empty text box"));
      let L = ve.get(n);
      L || (L = document.createElement("button"), L.className = "btn-small", L.dataset.objectId = n, L.addEventListener("click", (D) => {
        z || (we(), Me(n, D.shiftKey, !1, !0), g.tabIndex = -1, g.focus({ preventScroll: !0 }));
      }), ve.set(n, L)), L.textContent = T + (i.get("groupId") ? " (Grouped)" : "") + (i.get("locked") === !0 ? " (Locked)" : ""), L.title = "Select " + T + ". Shift-click to add or remove from selection.", L.setAttribute("aria-pressed", String(P.has(n))), e.children[o] !== L && e.insertBefore(L, e.children[o] || null);
    });
  }
  function rn() {
    for (const e of g.querySelectorAll(".slide-drop-before, .slide-drop-after, .slide-dragging")) e.classList.remove("slide-drop-before", "slide-drop-after", "slide-dragging");
  }
  function an() {
    rn(), tt = null, Je = [], We = null;
  }
  const ot = g.querySelector(".rail");
  ot.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-slide-id]");
    if (!t || z || xe().length < 2 || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    we();
    const n = t.dataset.slideId;
    Ot(), ne.has(n) || pt([n]), tt = n, Je = Bt(), e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", "CList slide");
    for (const o of s("slide-list").querySelectorAll("[data-slide-id]")) Je.includes(o.dataset.slideId) && o.classList.add("slide-dragging");
  }), ot.addEventListener("dragover", (e) => {
    if (!tt || z) return;
    e.preventDefault(), e.dataTransfer.dropEffect = "move", rn();
    const t = [...s("slide-list").querySelectorAll(":scope > [data-slide-id]")], n = t.find((a) => {
      const p = a.getBoundingClientRect();
      return e.clientY < p.top + p.height / 2;
    });
    We = n?.dataset.slideId || null, (n || t.at(-1))?.classList.add(n ? "slide-drop-before" : "slide-drop-after");
    for (const a of t) Je.includes(a.dataset.slideId) && a.classList.add("slide-dragging");
    const i = ot.getBoundingClientRect();
    e.clientY < i.top + 35 ? ot.scrollTop -= 18 : e.clientY > i.bottom - 35 && (ot.scrollTop += 18);
  }), ot.addEventListener("dragleave", (e) => {
    ot.contains(e.relatedTarget) || rn();
  }), ot.addEventListener("dragend", () => {
    an(), fe();
  }), ot.addEventListener("drop", (e) => {
    if (!tt || z) return;
    e.preventDefault();
    const t = [...Je], n = We;
    an();
    const o = xe(), i = Jo(o, t, n);
    i.every((a, p) => a === o[p]) || (m = null, P.clear(), E?.stopCapturing(), k.transact(() => i.forEach((a, p) => G.set(a, p))), E?.stopCapturing(), Et(), Ye(t.length === 1 ? "Slide moved to position " + (i.indexOf(t[0]) + 1) : t.length + " slides moved"));
  }), ot.addEventListener("keydown", (e) => {
    if (z || e.isComposing) return;
    const t = xe(), n = t.indexOf(F);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")
      e.preventDefault(), e.stopPropagation(), pt(t, F, Ee), fe(), Et();
    else if (e.key === "Escape")
      e.preventDefault(), e.stopPropagation(), on(F);
    else if (e.key === "Delete" || e.key === "Backspace")
      e.preventDefault(), e.stopPropagation(), s("delete-slide").disabled || s("delete-slide").click();
    else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(), e.stopPropagation();
      const o = e.key === "ArrowUp" ? -1 : 1;
      e.altKey ? dn(o) : t[n + o] && on(t[n + o], e);
    }
  });
  function St() {
    mn(), Ln();
    const e = xe(), t = JSON.stringify(e);
    tt && t !== xt && an(), xt = t, Ot(e);
    const n = s("slide-list"), o = new Set(e);
    for (const [S, T] of ge) o.has(S) || (T.button.remove(), ge.delete(S), Oe.delete(S));
    let i = n.firstElementChild;
    e.forEach((S, T) => {
      let L = ge.get(S);
      if (!L) {
        const jt = document.createElement("button"), at = document.createElement("div"), ft = document.createElement("div"), Ue = document.createElement("span");
        jt.className = "clist-action-btn", jt.dataset.slideId = S, ft.className = "mini-slide", at.append(ft, Ue), jt.append(at), jt.addEventListener("click", (Te) => on(S, Te)), L = { button: jt, thumb: at, preview: ft, label: Ue }, ge.set(S, L), Oe.add(S);
      }
      const { button: D, thumb: K, preview: le, label: Fe } = L, te = "Slide " + (T + 1) + ". Ctrl/Cmd-click to toggle; Shift-click for a range. Drag to move selected slides.";
      D.title !== te && (D.title = te);
      const Ie = e.length > 1 && !z;
      D.draggable !== Ie && (D.draggable = Ie);
      const Ge = String(ne.has(S));
      D.getAttribute("aria-pressed") !== Ge && D.setAttribute("aria-pressed", Ge), S === F ? D.hasAttribute("aria-current") || D.setAttribute("aria-current", "true") : D.hasAttribute("aria-current") && D.removeAttribute("aria-current");
      const yn = "slide-thumb" + (ne.has(S) ? " selected" : "") + (S === F ? " active-slide" : "");
      K.className !== yn && (K.className = yn), (ct || Oe.has(S)) && (le.style.backgroundColor = kt(S), le.replaceChildren(), [...Ne.get(S) || []].sort((at, ft) => Re(v.get(at)) - Re(v.get(ft)) || at.localeCompare(ft)).forEach((at, ft) => {
        const Ue = v.get(at), Te = document.createElement("div");
        if (Te.className = "mini-object", Te.style.zIndex = String(ft), Te.style.transform = `rotate(${Number(Ue.get("rotation")) || 0}deg)`, Te.style.left = 100 * Ue.get("x") / M + "%", Te.style.top = 100 * Ue.get("y") / A + "%", Te.style.width = 100 * Ue.get("width") / M + "%", Te.style.height = 100 * Ue.get("height") / A + "%", Ue.get("kind") === "shape") {
          const Qe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          Tt(Qe, Ue), Te.append(Qe);
        } else if (Ue.get("kind") === "image") {
          const Qe = document.createElement("img");
          Qe.src = Ct(Ue.get("source")), Qe.alt = "", Qe.draggable = !1, en(Qe, Ue), Te.append(Qe);
        } else {
          const Qe = Ae(Ue);
          Te.style.color = Qe.colour, Te.style.fontFamily = Be[Qe.family], Te.style.background = "transparent", Te.textContent = k.getXmlFragment("slide-text-" + at).toString().replace(/<[^>]*>/g, " ");
        }
        le.append(Te);
      })), Fe.textContent !== String(T + 1) && (Fe.textContent = String(T + 1)), i === J && (i = i.nextElementSibling), i === D ? i = i.nextElementSibling : n.insertBefore(D, i);
    });
    const a = ge.get(F)?.button;
    a && a.nextElementSibling !== J && n.insertBefore(J, a.nextElementSibling), Oe.clear(), ct = !1;
    const p = e.indexOf(F), u = ne.size;
    s("slide-label").textContent = "Slide " + (p + 1) + " of " + e.length + (u > 1 ? " · " + u + " selected" : ""), s("slide-up").disabled = z || En(e, ne, -1).every((S, T) => S === e[T]), s("slide-down").disabled = z || En(e, ne, 1).every((S, T) => S === e[T]), s("duplicate-slide").disabled = z, s("duplicate-slide").title = u > 1 ? "Duplicate " + u + " selected slides" : "Duplicate the selected slide", s("slide-up").title = s("slide-up").ariaLabel = "Move selected slides earlier", s("slide-down").title = s("slide-down").ariaLabel = "Move selected slides later", s("delete-slide").disabled = z || u >= e.length, s("delete-slide").title = u >= e.length ? "At least one slide must remain" : u > 1 ? "Delete " + u + " selected slides" : "Delete selected slide", s("presentation-position").textContent = p + 1 + " / " + e.length, s("previous-slide").disabled = p <= 0, s("next-slide").disabled = p >= e.length - 1;
  }
  function fe() {
    ut();
    const e = xe();
    e.includes(F) || (we(), m = null, P.clear(), F = e[0]), zt(), _.style.backgroundColor = kt(F), s("slide-background").value = kt(F);
    for (const [i, a] of O)
      (!v.has(i) || (v.get(i).get("slide") || "first") !== F) && (a.editor?.destroy(), a.node.remove(), O.delete(i), P.delete(i), m === i && (m = [...P].at(-1) || null));
    v.forEach((i, a) => {
      !(i instanceof c.Map) || (i.get("slide") || "first") !== F || (O.has(a) ? (O.get(a).box = i, tn(a)) : ht(a, i));
    });
    const t = [...O.values()].filter((i) => i.box.get("kind") === "image").length, n = [...O.values()].filter((i) => i.box.get("kind") === "shape").length, o = O.size - t - n;
    s("count").textContent = `${o} text box${o === 1 ? "" : "es"}, ${t} image${t === 1 ? "" : "s"}, ${n} shape${n === 1 ? "" : "s"}`, Me(m, !1, !0), St();
  }
  function sn(e) {
    if (!O.has(e)) return [];
    const t = v.get(e)?.get("groupId");
    return typeof t == "string" && t ? Le().filter((n) => v.get(n).get("groupId") === t) : [e];
  }
  function Nn(e = !1) {
    if (z || Ve() || !P.size || !e && P.size < 2) return;
    we();
    const t = "group-" + crypto.randomUUID();
    E?.stopCapturing(), k.transact(() => {
      for (const n of P)
        e ? v.get(n).delete("groupId") : v.get(n).set("groupId", t);
    }), E?.stopCapturing(), H(e ? "Selected objects ungrouped." : "Selected objects grouped.");
  }
  s("group-objects").addEventListener("click", () => Nn()), s("ungroup-objects").addEventListener("click", () => Nn(!0));
  function ln(e, t) {
    const n = { ...e };
    return typeof n.groupId == "string" && n.groupId && (t.has(n.groupId) || t.set(n.groupId, "group-" + crypto.randomUUID()), n.groupId = t.get(n.groupId)), n;
  }
  function bo(e = !1) {
    if (qe || z) return;
    const t = [...P].sort().map((p) => p + ":" + (v.get(p)?.get("kind") || "text")).join("|");
    if (!e && t === re) return;
    re = t;
    const n = v.get(m), o = P.size > 1 ? "arrange" : n ? n.get("kind") === "image" ? "images" : n.get("kind") === "shape" ? "appearance" : "text" : "slide", i = g.querySelector(".inspector"), a = i.querySelector('[data-panel="' + o + '"]');
    for (const p of i.querySelectorAll(":scope > .control-section")) p.open = p === a;
    a && (i.scrollTop += a.getBoundingClientRect().top - i.getBoundingClientRect().top - i.clientTop);
  }
  function Me(e, t = !1, n = !1, o = !1) {
    for (const te of P) O.has(te) || P.delete(te);
    if (t && e && O.has(e)) {
      const te = sn(e), Ie = te.every((Ge) => P.has(Ge));
      for (const Ge of te)
        Ie ? P.delete(Ge) : P.add(Ge);
    } else if (!n) {
      P.clear();
      for (const te of sn(e)) P.add(te);
    }
    if (n) for (const te of [...P]) for (const Ie of sn(te)) P.add(Ie);
    m = P.has(e) ? e : [...P].at(-1) || null;
    for (const [te, Ie] of O) Ie.node.classList.toggle("selected", P.has(te));
    const i = P.size > 1, a = Ve();
    g.classList.toggle("multi-selection", i);
    const p = [...P].map((te) => v.get(te)?.get("groupId")), u = p.length > 1 && !!p[0] && p.every((te) => te === p[0]);
    s("group-objects").disabled = a || !i || u, s("ungroup-objects").disabled = a || !p.some(Boolean), s("lock-objects").disabled = !P.size || [...P].every((te) => v.get(te)?.get("locked") === !0), s("unlock-objects").disabled = !a, s("distribute-horizontal").disabled = s("distribute-vertical").disabled = a || P.size < 3;
    for (const te of ["left", "center", "right", "top", "middle", "bottom"]) s("align-" + te).disabled = a || !i;
    const S = m ? v.get(m) : null;
    s("selection-details").textContent = i ? P.size + " objects selected. Drag a Move handle or use arrow keys to move together." : S ? `${m}
Position: ${Math.round(S.get("x"))}, ${Math.round(S.get("y"))}
Size: ${Math.round(S.get("width"))} × ${Math.round(S.get("height"))}` : "Select an object";
    for (const te of ["x", "y", "width", "height"]) {
      const Ie = s("object-" + te);
      Ie.disabled = a || !S || i, Ie.value = S ? String(Math.round(Number(S.get(te)) || 0)) : "";
    }
    s("keep-aspect-ratio").disabled = a || i || S?.get("kind") !== "image", s("keep-aspect-ratio").checked = S?.get("kind") === "image" && S.get("keepAspectRatio") !== !1;
    const T = S ? Zt(S) : { fit: "contain", x: 50, y: 50 }, L = a || i || S?.get("kind") !== "image";
    s("image-description").disabled = L;
    const D = !i && S?.get("kind") === "image" && typeof S.get("alt") == "string" ? S.get("alt") : "";
    s("image-description").value !== D && (s("image-description").value = D), s("replace-image").disabled = L, s("image-fit").disabled = L, s("image-fit").value = T.fit, s("crop-x").disabled = s("crop-y").disabled = L || T.fit !== "cover", s("crop-x").value = String(T.x), s("crop-y").value = String(T.y), s("object-rotation").disabled = a || !S || i, s("object-rotation").value = S ? String(Number(S.get("rotation")) || 0) : "", s("cut-objects").disabled = !P.size || a, s("copy-objects").disabled = !P.size, Kn(), s("paste-objects").disabled = !ee?.items.length, s("duplicate").disabled = !m || i, s("delete").disabled = a || !m;
    const K = Le(), le = K.indexOf(m);
    s("bring-forward").disabled = a || i || le < 0 || le === K.length - 1, s("send-backward").disabled = a || i || le <= 0, s("bold").disabled = i || !O.get(m)?.editor, s("italic").disabled = i || !O.get(m)?.editor, s("edit-link").disabled = i || !O.get(m)?.editor, s("remove-link").disabled = i || !O.get(m)?.editor, Se && m !== Se && Mt(), s("bullet-list").disabled = i || !O.get(m)?.editor, s("ordered-list").disabled = i || !O.get(m)?.editor;
    for (const te of ["font-family", "font-size", "text-colour", "text-align"]) s(te).disabled = i || !O.get(m)?.editor;
    const Fe = S && !i && (!!O.get(m)?.editor || S.get("kind") === "shape");
    for (const te of ["fill-enabled", "fill-colour", "border-enabled", "border-colour", "border-width"]) s(te).disabled = !Fe;
    if (Fe) {
      const te = nt(S);
      s("fill-enabled").checked = te.fill, s("fill-colour").value = te.fillColour, s("fill-colour").disabled = !te.fill, s("border-enabled").checked = te.border, s("border-colour").value = te.borderColour, s("border-width").value = String(te.width), s("border-colour").disabled = s("border-width").disabled = !te.border;
    }
    if (S && !i && O.get(m)?.editor) {
      const te = Ae(S);
      s("font-family").value = te.family, s("font-size").value = String(Math.round(te.size)), s("text-colour").value = te.colour, s("text-align").value = te.align;
    }
    Ln(), bo(o), Q?.schedule();
  }
  function jn(e, t, n) {
    if (z || e.button !== 0) return;
    if (e.preventDefault(), e.stopPropagation(), E?.stopCapturing(), E && (E.captureTimeout = 1 / 0), Me(t, !1, n === "move" && P.has(t), !0), Ve()) {
      we(), H("Unlock selected objects before moving or resizing.", "error");
      return;
    }
    O.get(t)?.node.focus({ preventScroll: !0 });
    const o = v.get(t);
    if (!o) return;
    n === "resize" && Qt(o);
    const i = M / _.getBoundingClientRect().width, a = [...P].map((u) => ({ id: u, ...v.get(u).toJSON() })), p = Ut(a);
    q = {
      members: a,
      id: t,
      action: n,
      startX: e.clientX,
      startY: e.clientY,
      scale: i,
      original: n === "move" ? p : {
        x: o.get("x"),
        y: o.get("y"),
        width: o.get("width"),
        height: o.get("height")
      }
    }, q.target = e.currentTarget, q.pointerId = e.pointerId, e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.addEventListener("pointermove", Dn), e.currentTarget.addEventListener("pointerup", we, { once: !0 }), e.currentTarget.addEventListener("pointercancel", we, { once: !0 });
  }
  function Ut(e) {
    const t = Math.min(...e.map((o) => o.x)), n = Math.min(...e.map((o) => o.y));
    return { x: t, y: n, width: Math.max(...e.map((o) => o.x + o.width)) - t, height: Math.max(...e.map((o) => o.y + o.height)) - n };
  }
  function Ve() {
    return [...P].some((e) => v.get(e)?.get("locked") === !0);
  }
  function zn(e) {
    z || !P.size || (we(), k.transact(() => {
      for (const t of P) v.get(t)?.set("locked", e);
    }), H(e ? "Selected objects locked." : "Selected objects unlocked."));
  }
  s("lock-objects").addEventListener("click", () => zn(!0)), s("unlock-objects").addEventListener("click", () => zn(!1));
  function Ht(e) {
    const t = (Number(e.rotation) || 0) * Math.PI / 180, n = Math.abs(e.width * Math.cos(t)) + Math.abs(e.height * Math.sin(t)), o = Math.abs(e.width * Math.sin(t)) + Math.abs(e.height * Math.cos(t));
    return { x: e.x + (e.width - n) / 2, y: e.y + (e.height - o) / 2, width: n, height: o };
  }
  function yo(e) {
    if (z || Ve() || P.size < 2) return;
    we();
    const t = [...P].map((o) => ({ id: o, ...v.get(o).toJSON() })), n = Ut(t.map(Ht));
    E?.stopCapturing(), k.transact(() => {
      for (const o of t) {
        const i = v.get(o.id), a = Ht(o);
        let p = 0, u = 0;
        e === "left" && (p = n.x - a.x), e === "center" && (p = n.x + n.width / 2 - a.x - a.width / 2), e === "right" && (p = n.x + n.width - a.x - a.width), e === "top" && (u = n.y - a.y), e === "middle" && (u = n.y + n.height / 2 - a.y - a.height / 2), e === "bottom" && (u = n.y + n.height - a.y - a.height), ["left", "center", "right"].includes(e) ? i.set("x", o.x + p) : i.set("y", o.y + u);
      }
    }, "geometry"), E?.stopCapturing();
  }
  for (const e of ["left", "center", "right", "top", "middle", "bottom"])
    s("align-" + e).addEventListener("click", () => yo(e));
  function Fn(e) {
    if (z || Ve() || P.size < 3) return;
    we();
    const t = e ? "y" : "x", n = e ? "height" : "width", o = [...P].map((L) => {
      const D = v.get(L).toJSON();
      return { id: L, box: D, bounds: Ht(D) };
    }).sort((L, D) => L.bounds[t] - D.bounds[t] || L.id.localeCompare(D.id)), i = o[0], a = o[o.length - 1], p = i.bounds[t], u = a.bounds[t] + a.bounds[n], S = o.reduce((L, D) => L + D.bounds[n], 0), T = (u - p - S) / (o.length - 1);
    if (T < -1e-6) {
      const D = "Not enough room " + (e ? "vertically" : "horizontally") + ": the objects need " + Math.ceil(S) + " px, but their outer edges span only " + Math.floor(u - p) + " px. Move the outermost objects farther apart or make the objects smaller.";
      s("distribution-status").textContent = D, H(D, "error");
      return;
    }
    E?.stopCapturing(), k.transact(() => {
      let L = p + i.bounds[n] + Math.max(0, T);
      for (let D = 1; D < o.length - 1; D++) {
        const K = o[D];
        v.get(K.id).set(t, K.box[t] + L - K.bounds[t]), L += K.bounds[n] + Math.max(0, T);
      }
    }, "geometry"), E?.stopCapturing(), s("distribution-status").textContent = "Distributed " + o.length + " objects " + (e ? "vertically" : "horizontally") + " with " + Math.round(Math.max(0, T)) + " px gaps.";
  }
  s("distribute-horizontal").addEventListener("click", () => Fn(!1)), s("distribute-vertical").addEventListener("click", () => Fn(!0));
  function cn() {
    if (z) return;
    if (Ve()) {
      H("Unlock selected objects before deleting.", "error");
      return;
    }
    const e = [...P];
    k.transact(() => e.forEach((t) => v.delete(t)));
  }
  function Pn(e, t, n, o, i) {
    let a = { position: e, guide: null }, p = o + 1e-6;
    for (const u of n)
      for (const S of [0, t / 2, t]) {
        const T = u - S, L = Math.abs(T - e);
        T >= 0 && T <= i - t && L < p && (p = L, a = { position: T, guide: u });
      }
    return a;
  }
  function wo(e, t, n, o, i, a) {
    const p = [0, M / 2, M], u = [0, A / 2, A];
    for (const S of Le()) {
      if (S === e || P.has(S)) continue;
      const T = v.get(S), L = Number(T.get("x")), D = Number(T.get("y")), K = Number(T.get("width")), le = Number(T.get("height"));
      [L, D, K, le].every(Number.isFinite) && (p.push(L, L + K / 2, L + K), u.push(D, D + le / 2, D + le));
    }
    return { x: Pn(t, o, p, a, M), y: Pn(n, i, u, a, A) };
  }
  function Dn(e) {
    if (!q) return;
    if (Ve()) {
      we(), H("Movement stopped because an object was locked.", "error");
      return;
    }
    const { id: t, action: n, startX: o, startY: i, scale: a, original: p } = q, u = v.get(t);
    if (!u) return;
    const S = (e.clientX - o) * a, T = (e.clientY - i) * a;
    k.transact(() => {
      if (n === "move") {
        let L = Math.max(0, Math.min(M - p.width, p.x + S)), D = Math.max(0, Math.min(A - p.height, p.y + T));
        if (V.hidden = me.hidden = !0, !e.altKey) {
          const K = wo(t, L, D, p.width, p.height, 6 * a);
          L = K.x.position, D = K.y.position, K.x.guide !== null && (V.hidden = !1, V.style.left = 100 * K.x.guide / M + "%"), K.y.guide !== null && (me.hidden = !1, me.style.top = 100 * K.y.guide / A + "%");
        }
        for (const K of q.members) {
          const le = v.get(K.id);
          le && (le.set("x", Math.round(K.x + L - p.x)), le.set("y", Math.round(K.y + D - p.y)));
        }
      } else if (u.get("kind") === "image" && u.get("keepAspectRatio") !== !1) {
        const L = fn(u), D = Math.abs(S / p.width) >= Math.abs(T / p.height) ? p.width + S : (p.height + T) * L, K = u.get("imageFit") === "cover" ? vt(u) : { width: M, height: A }, le = Xn(D, L, Math.min(M - p.x, K.width), Math.min(A - p.y, K.height));
        u.set("width", le.width), u.set("height", le.height);
      } else {
        const L = O.get(t)?.editor ? 100 : 1, D = O.get(t)?.editor ? 55 : 1, K = u.get("imageFit") === "cover" ? vt(u) : { width: M, height: A };
        u.set("width", Math.max(L, Math.min(M - p.x, K.width, p.width + S))), u.set("height", Math.max(D, Math.min(A - p.y, K.height, p.height + T)));
      }
    }, "geometry");
  }
  function we(e) {
    ie?.cancel(), V.hidden = me.hidden = !0;
    const t = q?.target || e?.currentTarget;
    t?.removeEventListener("pointermove", Dn), t?.removeEventListener("pointerup", we), t?.removeEventListener("pointercancel", we), q && t?.hasPointerCapture(q.pointerId) && t.releasePointerCapture(q.pointerId), q = null, E && (E.captureTimeout = 500, E.stopCapturing());
  }
  k.on("beforeObserverCalls", Rt), v.observeDeep(fe), G.observe(fe), oe.observe(fe), pe.observe(fe), Z.observe(Ft), R.observe(zt), k.on("update", St), k.on("update", $e), s("add-slide").addEventListener("click", () => {
    if (!z) {
      we();
      try {
        if (j.has(s("slide-layout").value)) {
          Eo(j.get(s("slide-layout").value));
          return;
        }
        const e = xe(), t = "slide-" + crypto.randomUUID(), n = b.get(s("slide-layout").value) || b.values().next().value, o = n.objects.map((a) => ({ ...a, id: Ze() })), i = /* @__PURE__ */ new Map();
        F = t, m = null, P.clear(), E?.stopCapturing(), k.transact(() => {
          G.size || G.set("first", 0), G.set(t, Math.max(...e.map((a) => G.get(a) || 0)) + 1), n.background !== void 0 && pe.set(t, n.background), n.notes !== void 0 && R.set(t, n.notes);
          for (const a of o) {
            const { id: p, text: u, shapeId: S, group: T, ...L } = a, K = { ...a.kind === "shape" ? An(C.get(S)) : {}, rotation: 0, ...L, slide: t, layer: Math.max(-1, ...Le().map((le) => Re(v.get(le)))) + 1 };
            T && (i.has(T) || i.set(T, "group-" + crypto.randomUUID()), K.groupId = i.get(T)), a.kind === "image" && (K.aspectRatio = a.width / a.height), v.set(p, new c.Map(Object.entries(K)));
          }
        });
        for (const a of o) {
          if (a.kind !== "text") continue;
          const p = a.text.split(`
`).map((u) => ({ type: "paragraph", content: u ? [{ type: "text", text: u }] : [] }));
          O.get(a.id).editor.commands.setContent({ type: "doc", content: p });
        }
        E?.stopCapturing(), fe();
      } catch (e) {
        console.error("Slides layout failed:", e), H("Could not create slide: " + e.message, "error");
      }
    }
  }), s("duplicate-slide").addEventListener("click", () => {
    if (!z) {
      we();
      try {
        const e = Bt(), t = xe(), n = e.map((i) => {
          const a = "slide-" + crypto.randomUUID(), p = /* @__PURE__ */ new Map(), u = Le(i).map((S) => {
            const T = new c.Map(Object.entries(ln(v.get(S).toJSON(), p)));
            T.set("slide", a);
            const L = Ze(), D = k.getXmlFragment("slide-text-" + L), K = k.getXmlFragment("slide-text-" + S).toArray().map((le) => le.clone());
            return E?.addToScope(D), { id: L, box: T, fragment: D, text: K };
          });
          return { source: i, id: a, copies: u };
        }), o = n.map((i) => i.id);
        t.splice(t.indexOf(e.at(-1)) + 1, 0, ...o), pt(o), E?.stopCapturing(), k.transact(() => {
          t.forEach((i, a) => G.set(i, a));
          for (const i of n) {
            pe.has(i.source) && pe.set(i.id, pe.get(i.source)), typeof R.get(i.source) == "string" && R.set(i.id, R.get(i.source));
            for (const a of i.copies)
              v.set(a.id, a.box), a.text.length && a.fragment.insert(0, a.text);
          }
        }), E?.stopCapturing(), fe(), Ye(n.length === 1 ? "Slide duplicated" : n.length + " slides duplicated"), Et();
      } catch (e) {
        console.error("Slides duplication failed:", e), H("Could not duplicate slide: " + e.message, "error");
      }
    }
  });
  function dn(e) {
    if (z) return;
    we();
    const t = xe(), n = En(t, Bt(), e);
    n.every((o, i) => o === t[i]) || (E?.stopCapturing(), k.transact(() => n.forEach((o, i) => G.set(o, i))), E?.stopCapturing(), Et());
  }
  s("slide-up").addEventListener("click", () => dn(-1)), s("slide-down").addEventListener("click", () => dn(1)), s("delete-slide").addEventListener("click", () => {
    const e = Bt(), t = xe();
    if (e.length >= t.length || z) return;
    const n = () => xo(e);
    if (typeof window.buildDialogModal == "function") {
      const o = document.createElement("p");
      o.textContent = e.length === 1 ? "Delete slide " + (t.indexOf(e[0]) + 1) + "? Its objects and speaker notes will be removed." : "Delete " + e.length + " selected slides? Their objects and speaker notes will be removed.", window.buildDialogModal(e.length === 1 ? "Delete slide" : "Delete slides", o, [
        { label: "Cancel", secondary: !0, onClick: (i) => i() },
        { label: e.length === 1 ? "Delete slide" : "Delete slides", onClick: (i) => {
          i(), n();
        } }
      ]);
    } else {
      const o = document.createElement("dialog"), i = document.createElement("p");
      i.textContent = "Delete " + e.length + " selected slide(s)?", o.append(i);
      for (const [a, p, u] of [["Cancel", !0, () => {
      }], ["Delete slides", !1, n]]) {
        const S = document.createElement("button");
        S.className = p ? "btn btn-secondary" : "btn", S.textContent = a, S.addEventListener("click", () => {
          o.close(), o.remove(), u();
        }), o.append(S);
      }
      o.addEventListener("cancel", () => o.remove(), { once: !0 }), document.body.append(o), o.showModal();
    }
  });
  function xo(e) {
    const t = xe(), n = new Set(t.filter((p) => e.includes(p)));
    if (z || !n.size || n.size >= t.length) return;
    we();
    const o = t.filter((p) => !n.has(p)), i = o[Math.min(t.indexOf(F), o.length - 1)], a = [...v].filter(([, p]) => n.has(p.get("slide") || "first") && (!p.get("kind") || p.get("kind") === "text")).map(([p]) => k.getXmlFragment("slide-text-" + p));
    for (const p of a) E?.addToScope(p);
    pt([i]), E?.stopCapturing(), k.transact(() => {
      v.forEach((p, u) => {
        n.has(p.get("slide") || "first") && v.delete(u);
      });
      for (const p of a) p.length && p.delete(0, p.length);
      G.size || t.forEach((p, u) => G.set(p, u));
      for (const p of n)
        G.delete(p), pe.delete(p), R.delete(p);
    }), E?.stopCapturing(), fe(), Et();
  }
  s("save-layout").disabled = typeof d.onSaveLayout != "function", s("save-layout").addEventListener("click", () => d.onSaveLayout?.());
  function Ct(e) {
    return typeof e == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(e) ? e : "";
  }
  async function In(e) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(e.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
    const t = await new Promise((o, i) => {
      const a = new FileReader();
      a.onload = () => o(a.result), a.onerror = () => i(a.error || new Error("Could not read the image.")), a.onabort = () => i(new Error("Image reading was cancelled.")), a.readAsDataURL(e);
    });
    if (!Ct(t)) throw new Error("Unsupported image data.");
    const n = new Image();
    return n.src = t, await n.decode(), { source: t, image: n };
  }
  s("image-description").addEventListener("input", (e) => {
    const t = v.get(m);
    z || P.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || t.set("alt", e.target.value.slice(0, 2e3));
  }), s("replace-image").addEventListener("click", () => {
    const e = v.get(m);
    z || P.size !== 1 || e?.get("kind") !== "image" || e.get("locked") === !0 || (ce = { document: k, id: m }, s("replace-image-file").click());
  }), s("replace-image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0], n = ce;
    if (ce = null, !(!t || !n))
      try {
        const { source: o, image: i } = await In(t), a = v.get(n.id);
        if (k !== n.document || a?.get("kind") !== "image") throw new Error("The original image is no longer available.");
        if (z || a.get("locked") === !0) throw new Error("Return to editing and unlock the image before replacing it.");
        E?.stopCapturing(), k.transact(() => {
          if (a.set("source", o), a.set("imageRatio", i.naturalWidth / i.naturalHeight), a.set("aspectRatio", a.get("width") / a.get("height")), a.delete("cropImageWidth"), a.delete("cropImageHeight"), a.get("imageFit") === "cover") {
            const p = Math.max(a.get("width"), a.get("height") * i.naturalWidth / i.naturalHeight);
            a.set("cropImageWidth", p), a.set("cropImageHeight", p * i.naturalHeight / i.naturalWidth);
          }
        }), E?.stopCapturing(), H("Image replaced.");
      } catch (o) {
        console.error("Slides image replacement failed:", o), H("Could not replace image: " + o.message, "error");
      } finally {
        e.target.value = "";
      }
  }), s("add-image").addEventListener("click", () => s("image-file").click()), s("image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0];
    if (!t) return;
    const n = k, o = F;
    try {
      const { source: i, image: a } = await In(t);
      if (k !== n || !xe().includes(o)) throw new Error("The destination slide is no longer open.");
      if (z) throw new Error("Return to editing before adding an image.");
      F = o;
      const p = Math.min(1, 800 / a.naturalWidth, 500 / a.naturalHeight), u = Math.max(1, Math.round(a.naturalWidth * p)), S = Math.max(1, Math.round(a.naturalHeight * p)), T = Ze();
      De(T, (M - u) / 2, (A - S) / 2, u, S, i, t.name), Me(T), H("Image added");
    } catch (i) {
      console.error("Slides image could not load:", i), H("Image could not load: " + i.message, "error");
    } finally {
      e.target.value = "";
    }
  });
  function un() {
    if (!(z || !P.size))
      try {
        const e = new c.Doc(), t = Le().filter((o) => P.has(o)).map((o, i) => {
          const a = k.getXmlFragment("slide-text-" + o).toArray().map((p) => p.clone());
          return a.length && e.getXmlFragment("text-" + i).insert(0, a), { data: v.get(o).toJSON(), index: i };
        }), n = new Set(t.flatMap((o) => o.data.referenceUrls || []));
        for (const o of Wt()) n.has(o.url) && e.getMap("clist_refs").set(o.url, JSON.stringify(o));
        return ee?.document.destroy(), ee = { document: e, items: t, sourceDocument: k, sourceSlide: F, pastes: 0, token: crypto.randomUUID() }, s("paste-objects").disabled = !1, H("Copied " + t.length + " object" + (t.length === 1 ? "." : "s.")), !0;
      } catch (e) {
        return console.error("Slides object copy failed:", e), H("Could not copy objects: " + e.message, "error"), !1;
      }
  }
  function Tn() {
    if (!(z || !ee?.items.length)) {
      we();
      try {
        const e = Ut(ee.items.map((u) => u.data)), t = ee.cut && ee.pastes === 0 ? 0 : ee.sourceDocument === k && ee.sourceSlide === F ? 28 * (ee.pastes + 1) : 28 * ee.pastes, n = Math.max(-e.x, Math.min(M - e.x - e.width, t)), o = Math.max(-e.y, Math.min(A - e.y - e.height, t)), i = Math.max(-1, ...Le().map((u) => Re(v.get(u)))), a = /* @__PURE__ */ new Map(), p = ee.items.map((u, S) => {
          const T = Ze(), L = new c.Map(Object.entries({ ...ln(u.data, a), slide: F, x: u.data.x + n, y: u.data.y + o, layer: i + S + 1 })), D = k.getXmlFragment("slide-text-" + T);
          E?.addToScope(D);
          const K = ee.document.getXmlFragment("text-" + u.index).toArray().map((le) => le.clone());
          return { id: T, box: L, fragment: D, text: K };
        });
        E?.stopCapturing(), k.transact(() => {
          ee.document.getMap("clist_refs").forEach((u) => {
            try {
              $t([JSON.parse(u)]);
            } catch {
            }
          });
          for (const u of p)
            v.set(u.id, u.box), u.text.length && u.fragment.insert(0, u.text);
        }), E?.stopCapturing(), ee.pastes++, P.clear();
        for (const u of p) P.add(u.id);
        m = p[p.length - 1].id, Me(m, !1, !0), g.tabIndex = -1, g.focus({ preventScroll: !0 }), H("Pasted " + p.length + " object" + (p.length === 1 ? "." : "s."));
      } catch (e) {
        console.error("Slides object paste failed:", e), H("Could not paste objects: " + e.message, "error");
      }
    }
  }
  function Rn(e = null) {
    if (!(z || !P.size)) {
      if (Ve()) {
        H("Unlock selected objects before cutting.", "error");
        return;
      }
      if (un())
        try {
          e && On(e), ee.cut = !0;
          const t = P.size;
          E?.stopCapturing(), cn(), E?.stopCapturing(), g.tabIndex = -1, g.focus({ preventScroll: !0 }), H("Cut " + t + " object" + (t === 1 ? "." : "s."));
        } catch (t) {
          console.error("Slides object cut failed:", t), H("Could not cut objects: " + t.message, "error");
        }
    }
  }
  s("cut-objects").addEventListener("click", () => Rn()), s("copy-objects").addEventListener("click", un), s("paste-objects").addEventListener("click", Tn);
  function pn(e) {
    return e.isContentEditable || !!e.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function On(e) {
    e.clipboardData.setData("application/x-clist-slide-objects", ee.token), e.clipboardData.setData("text/plain", ee.items.map((t) => ee.document.getXmlFragment("text-" + t.index).toString().replace(/<[^>]*>/g, " ") || t.data.alt || "Slide object").join(`
`)), e.preventDefault(), e.stopImmediatePropagation();
  }
  g.addEventListener("copy", (e) => {
    if (!(z || pn(e.target) || !P.size || !e.clipboardData) && un())
      try {
        On(e);
      } catch (t) {
        console.error("Slides clipboard write failed:", t), H("Could not write objects to clipboard: " + t.message, "error");
      }
  }, !0);
  function Bn(e) {
    if (z || !P.size || !e.clipboardData || !g.getClientRects().length) return;
    const t = e.target === document.body || e.target === document.documentElement || e.target === document;
    !g.contains(e.target) && !(t && g.contains(document.activeElement)) || pn(e.target) || document.activeElement?.closest?.("input, textarea, select") || (e.preventDefault(), e.stopImmediatePropagation(), Rn(e));
  }
  document.addEventListener("cut", Bn, !0);
  function Un(e) {
    if (z || !e.clipboardData || !g.getClientRects().length) return;
    const t = g.contains(e.target), n = e.target === document.body || e.target === document.documentElement || e.target === document;
    if (!t && !(Y && n) || !t && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]') || e.target.closest?.("input, textarea, select")) return;
    const o = e.target.closest?.(".slide-object");
    if (pn(e.target) && o && P.has(o.dataset.id) && se === o.dataset.id) return;
    const a = e.clipboardData.getData("application/x-clist-slide-objects");
    if (a && a === ee?.token) {
      e.preventDefault(), e.stopImmediatePropagation(), Tn();
      return;
    }
    const p = e.clipboardData.getData("text/plain");
    if (p) {
      e.preventDefault(), e.stopImmediatePropagation();
      try {
        we(), E?.stopCapturing();
        const u = Ze(), S = p.replace(/\r\n?/g, `
`).split(`
`).map((le) => ({
          type: "paragraph",
          content: le ? [{ type: "text", text: le }] : []
        })), T = S.reduce((le, Fe) => le + Math.max(1, Math.ceil((Fe.content[0]?.text.length || 0) / 45)), 0), L = 690, D = Math.min(500, Math.max(100, T * 42)), K = W?.slide === F ? W : { x: 160, y: 160 };
        De(u, Math.max(0, Math.min(M - L, K.x)), Math.max(0, Math.min(A - D, K.y)), L, D), O.get(u).editor.commands.setContent({ type: "doc", content: S }), E?.stopCapturing(), Me(u), O.get(u).editor.commands.focus("end"), H("Pasted text into a new text box.");
      } catch (u) {
        console.error("Slides text paste failed:", u), H("Could not paste text: " + u.message, "error");
      }
    }
  }
  document.addEventListener("paste", Un, !0);
  function Hn(e) {
    const t = _.getBoundingClientRect();
    t.width <= 0 || t.height <= 0 || e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom || (W = { slide: F, x: Math.round((e.clientX - t.left) * M / t.width), y: Math.round((e.clientY - t.top) * A / t.height) });
  }
  g.addEventListener("pointermove", Hn), Q = Po(g, _, {
    views: () => [...O.values()],
    selected: () => [...P].map((e) => O.get(e)).filter(Boolean),
    presenting: () => z,
    size: (e) => Ae(e).size,
    apply: (e) => {
      e.length && (E?.stopCapturing(), k.transact(() => {
        for (const { box: t, size: n } of e) t.set("fontSize", n);
      }), E?.stopCapturing());
    }
  }), ie = Do(g, _, {
    selected: () => [...P],
    slideId: () => F,
    objects: () => Le().map((e) => ({ id: e, ...Ht(v.get(e).toJSON()) })),
    select: (e) => {
      P.clear();
      for (const t of e) O.has(t) && P.add(t);
      Me(e.at(-1) || null, !1, !0);
    }
  }), g.addEventListener("pointerdown", (e) => {
    const t = e.target;
    e.button !== 0 || z || !t.closest?.(".canvas-space") || t.closest(".slide-object, input, textarea, select, button, a") || (e.preventDefault(), Y = !0, Hn(e), we(), t === _ && ie.begin(e), e.shiftKey || Me(null), se = null, g.contains(document.activeElement) && document.activeElement.blur?.(), window.getSelection()?.removeAllRanges(), g.tabIndex = -1, g.focus({ preventScroll: !0 }));
  }, !0);
  function vo(e) {
    if (z) return;
    const t = C.get(e);
    if (!t) {
      H("This shape is not available in the catalog.", "error");
      return;
    }
    const n = Ze(), { width: o, height: i } = t, a = new c.Map(Object.entries({ ...An(t), slide: F, x: Math.min(160, M - o), y: Math.min(180, A - i), width: o, height: i, rotation: 0, layer: Math.max(-1, ...Le().map((p) => Re(v.get(p)))) + 1 }));
    v.set(n, a), Me(n), O.get(n).node.focus({ preventScroll: !0 });
  }
  function Ze() {
    return `box-${crypto.randomUUID()}`;
  }
  s("add-text").addEventListener("click", () => {
    const e = Ze();
    De(e, 160, 220, 430, 130), Me(e), O.get(e)?.editor.commands.focus();
  }), s("duplicate").addEventListener("click", () => {
    if (z || !m) return;
    const e = m, t = v.get(e), n = Ze(), o = new c.Map(Object.entries({ ...t.toJSON(), locked: !1, x: Math.min(M - t.get("width"), t.get("x") + 28), y: Math.min(A - t.get("height"), t.get("y") + 28), layer: Math.max(...Le().map((p) => Re(v.get(p)))) + 1 }));
    o.delete("groupId");
    const i = k.getXmlFragment("slide-text-" + n);
    E?.addToScope(i);
    const a = k.getXmlFragment("slide-text-" + e).toArray().map((p) => p.clone());
    k.transact(() => {
      v.set(n, o), a.length && i.insert(0, a);
    }), Me(n);
  }), s("delete").addEventListener("click", cn), s("bold").addEventListener("click", () => {
    m && O.get(m)?.editor?.chain().focus().toggleBold().run();
  }), s("italic").addEventListener("click", () => {
    m && O.get(m)?.editor?.chain().focus().toggleItalic().run();
  }), s("bullet-list").addEventListener("click", () => {
    !z && m && O.get(m)?.editor?.chain().focus().toggleBulletList().run();
  }), s("ordered-list").addEventListener("click", () => {
    !z && m && O.get(m)?.editor?.chain().focus().toggleOrderedList().run();
  });
  function qn(e) {
    try {
      const t = new URL(e);
      return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
    } catch {
      return !1;
    }
  }
  function Mt() {
    s("link-controls").hidden = !0, Se = null;
  }
  s("edit-link").addEventListener("click", () => {
    const e = O.get(m)?.editor;
    if (!(z || !e)) {
      if (e.state.selection.empty && !e.isActive("link")) {
        H("Select the text to link first.", "error");
        return;
      }
      Se = m, s("link-url").value = e.getAttributes("link").href || "", s("link-controls").hidden = !1, s("link-url").focus();
    }
  }), s("cancel-link").addEventListener("click", Mt), s("apply-link").addEventListener("click", () => {
    const e = O.get(Se)?.editor;
    if (z || !e) {
      Mt();
      return;
    }
    const t = s("link-url").value.trim();
    if (!qn(t)) {
      H("Enter an http, https, mailto, or tel URL.", "error");
      return;
    }
    try {
      E?.stopCapturing(), e.chain().focus().extendMarkRange("link").setLink({ href: t }).run(), E?.stopCapturing(), Mt();
    } catch (n) {
      console.error("Slides link failed:", n), H("Could not apply link: " + n.message, "error");
    }
  }), s("remove-link").addEventListener("click", () => {
    const e = O.get(m)?.editor;
    if (!(z || !e))
      try {
        e.chain().focus().extendMarkRange("link").unsetLink().run(), Mt();
      } catch (t) {
        console.error("Slides unlink failed:", t), H("Could not remove link: " + t.message, "error");
      }
  }), g.addEventListener("click", (e) => {
    const t = e.target.closest?.(".text-content a");
    if (!z || !t) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const n = t.getAttribute("href") || "";
    qn(n) ? window.open(n, "_blank", "noopener,noreferrer") : (console.error("Slides blocked unsupported link:", n), s("presentation-status").textContent = "This link has an unsupported URL.");
  }, !0);
  function Wn(e) {
    if (z || Ve() || !m) return;
    const t = Le(), n = t.indexOf(m);
    n < 0 || !t[n + e] || ([t[n], t[n + e]] = [t[n + e], t[n]], k.transact(() => t.forEach((o, i) => v.get(o).set("layer", i)), "layer"));
  }
  s("bring-forward").addEventListener("click", () => Wn(1)), s("send-backward").addEventListener("click", () => Wn(-1));
  function $n(e, t) {
    const n = v.get(m);
    z || P.size !== 1 || n?.get("kind") !== "image" || n.get("locked") === !0 || k.transact(() => {
      e === "imageFit" && t === "cover" && n.get("imageFit") !== "cover" ? (n.delete("cropImageWidth"), n.delete("cropImageHeight"), n.set(e, t), Qt(n)) : n.set(e, t);
    });
  }
  s("image-fit").addEventListener("change", (e) => {
    ["contain", "cover"].includes(e.target.value) && $n("imageFit", e.target.value);
  });
  for (const [e, t] of [["crop-x", "cropX"], ["crop-y", "cropY"]])
    s(e).addEventListener("input", (n) => {
      const o = Number(n.target.value);
      Number.isFinite(o) && o >= 0 && o <= 100 && $n(t, o);
    });
  function fn(e) {
    const t = Number(e.get("aspectRatio"));
    return Number.isFinite(t) && t > 0 ? t : Number(e.get("width")) / Number(e.get("height")) || 1;
  }
  function Xn(e, t, n, o) {
    const i = Math.min(n, o * t), a = Math.max(Math.min(i, Math.max(1, t)), Math.min(i, e));
    return { width: a, height: a / t };
  }
  s("keep-aspect-ratio").addEventListener("change", (e) => {
    const t = v.get(m);
    z || P.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || k.transact(() => {
      e.target.checked && t.set("aspectRatio", t.get("width") / t.get("height")), t.set("keepAspectRatio", e.target.checked);
    });
  });
  for (const e of ["x", "y", "width", "height"])
    s("object-" + e).addEventListener("change", (t) => {
      const n = v.get(m);
      if (z || n?.get("locked") === !0 || !n) return;
      const o = Number(t.target.value), i = e === "x" ? M - 1 : e === "y" ? A - 1 : e === "width" ? M : A, a = e === "width" || e === "height" ? 1 : 0;
      if (t.target.value.trim() === "" || !Number.isInteger(o) || o < a || o > i) {
        H(e + " must be a whole number between " + a + " and " + i + ".", "error"), Me(m);
        return;
      }
      k.transact(() => {
        ["width", "height"].includes(e) && Qt(n);
        const p = n.get("imageFit") === "cover" ? vt(n) : { width: M, height: A };
        if (n.get("kind") === "image" && n.get("keepAspectRatio") !== !1 && ["width", "height"].includes(e)) {
          const S = fn(n), T = Xn(e === "width" ? o : o * S, S, Math.min(M, p.width), Math.min(A, p.height));
          n.set("width", T.width), n.set("height", T.height), n.set("x", Math.min(n.get("x"), M - T.width)), n.set("y", Math.min(n.get("y"), A - T.height));
          return;
        }
        const u = e === "width" ? Math.min(o, p.width) : e === "height" ? Math.min(o, p.height) : o;
        n.set(e, u), e === "width" && n.set("x", Math.min(Number(n.get("x")) || 0, M - u)), e === "height" && n.set("y", Math.min(Number(n.get("y")) || 0, A - u)), e === "x" && n.set("x", Math.min(o, M - Number(n.get("width")))), e === "y" && n.set("y", Math.min(o, A - Number(n.get("height"))));
      }, "geometry");
    });
  s("object-rotation").addEventListener("change", (e) => {
    const t = v.get(m);
    if (z || t?.get("locked") === !0 || !t) return;
    const n = Number(e.target.value);
    if (e.target.value.trim() === "" || !Number.isFinite(n) || n < -180 || n > 180) {
      H("Rotation must be between -180 and 180 degrees.", "error"), Me(m);
      return;
    }
    t.set("rotation", n);
  });
  function qt(e) {
    return e instanceof c.Map && e.get("kind") !== "image";
  }
  function Kn() {
    s("copy-format").disabled = z || P.size !== 1 || !qt(v.get(m));
    const e = [...P].map((t) => v.get(t));
    s("paste-format").disabled = z || !be || !e.length || Ve() || !e.some(qt);
  }
  s("copy-format").addEventListener("click", () => {
    const e = v.get(m);
    if (z || P.size !== 1 || !qt(e)) return;
    const t = nt(e), n = Ae(e);
    be = {
      appearance: { fillEnabled: t.fill, fillColour: t.fillColour, borderEnabled: t.border, borderColour: t.borderColour, borderWidth: t.width },
      text: e.get("kind") === "shape" ? null : { fontFamily: n.family, fontSize: n.size, textColour: n.colour, textAlign: n.align }
    }, Kn(), H("Formatting copied. Select targets, then use Apply formatting.");
  }), s("paste-format").addEventListener("click", () => {
    if (z || !be || Ve()) return;
    const e = [...P].map((t) => v.get(t)).filter(qt);
    e.length && (E?.stopCapturing(), k.transact(() => {
      for (const t of e) {
        const n = { ...be.appearance, ...t.get("kind") === "shape" ? {} : be.text || {} };
        for (const [o, i] of Object.entries(n)) t.set(o, i);
      }
    }), E?.stopCapturing(), H("Formatting applied to " + e.length + " object" + (e.length === 1 ? "." : "s.")));
  });
  function mt(e, t) {
    const o = v.get(m)?.get("kind") === "shape" && ["fillEnabled", "fillColour", "borderEnabled", "borderColour", "borderWidth"].includes(e);
    z || P.size !== 1 || !O.get(m)?.editor && !o || v.get(m).set(e, t);
  }
  for (const [e, t] of [["fill-enabled", "fillEnabled"], ["border-enabled", "borderEnabled"]])
    s(e).addEventListener("change", (n) => mt(t, n.target.checked));
  for (const [e, t] of [["fill-colour", "fillColour"], ["border-colour", "borderColour"]])
    s(e).addEventListener("change", (n) => {
      /^#[0-9a-f]{6}$/i.test(n.target.value) && mt(t, n.target.value);
    });
  s("border-width").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isInteger(t) || t < 1 || t > 20) {
      H("Border width must be a whole number between 1 and 20 pixels.", "error"), Me(m);
      return;
    }
    mt("borderWidth", t);
  }), s("font-family").addEventListener("change", (e) => {
    Object.prototype.hasOwnProperty.call(Be, e.target.value) && mt("fontFamily", e.target.value);
  }), s("font-size").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t) || t < 8 || t > 200) {
      H("Font size must be between 8 and 200 pixels.", "error"), Me(m);
      return;
    }
    mt("fontSize", t);
  }), s("text-colour").addEventListener("input", (e) => {
    /^#[0-9a-f]{6}$/i.test(e.target.value) && mt("textColour", e.target.value);
  }), s("text-align").addEventListener("change", (e) => {
    ["left", "center", "right", "justify"].includes(e.target.value) && mt("textAlign", e.target.value);
  });
  function At() {
    const e = j.has(s("slide-layout").value), t = j.get(s("slide-layout").value), n = typeof d.onRenameSavedLayout == "function" && typeof d.onDeleteSavedLayout == "function";
    s("saved-layout-hint").textContent = ke ? "Layout dialog is open." : j.size ? e ? n ? "Selected saved layout: " + t.label : "Layout management is available inside CList." : "Select an entry under Saved layouts to rename or delete it." : "Use CList’s Save menu to save the current slide as a layout.", s("rename-layout").disabled = ke || !e || typeof d.onRenameSavedLayout != "function", s("delete-layout").disabled = ke || !e || typeof d.onDeleteSavedLayout != "function";
  }
  function Vn(e) {
    const t = "user:" + e;
    j.delete(t);
    const n = s("slide-layout").querySelector("optgroup[data-saved-layouts]");
    (n && [...n.children].find((i) => i.value === t))?.remove(), n && !n.children.length && n.remove(), s("slide-layout").value || (s("slide-layout").value = b.keys().next().value), At();
  }
  async function Gn(e) {
    const t = j.get(s("slide-layout").value), n = e ? d.onDeleteSavedLayout : d.onRenameSavedLayout;
    if (!(z || ke || !t || typeof n != "function")) {
      ke = !0, At();
      try {
        const o = await n({ ...t });
        e && o === !0 ? Vn(t.id) : !e && o && Yn(o);
      } catch (o) {
        console.error("Saved layout management failed:", o), H("Could not " + (e ? "delete" : "rename") + " layout: " + o.message, "error");
      } finally {
        ke = !1, At();
      }
    }
  }
  s("slide-layout").addEventListener("change", At), s("rename-layout").addEventListener("click", () => Gn(!1).catch((e) => {
    console.error("Layout rename failed:", e), H(e.message, "error");
  })), s("delete-layout").addEventListener("click", () => Gn(!0).catch((e) => {
    console.error("Layout deletion failed:", e), H(e.message, "error");
  }));
  function ko(e) {
    if (typeof e != "string" || !e.trim() || e.trim().length > 120) throw new Error("Enter a layout name of 1–120 characters.");
    const t = new c.Doc();
    try {
      t.getMap("slide-pages").set("first", 0), t.getMap("slide-backgrounds").set("first", kt(F)), typeof R.get(F) == "string" && t.getMap("slide-notes").set("first", R.get(F));
      for (const a of Le()) {
        const p = v.get(a), u = Ae(p), S = nt(p), T = { ...p.toJSON(), slide: "first", fontFamily: u.family, fontSize: u.size, textColour: u.colour, fillColour: S.fillColour, borderColour: S.borderColour };
        T.kind === "shape" && (T.shapeDefinition = structuredClone(It(v.get(a)))), t.getMap("slide-objects").set(a, new c.Map(Object.entries(T)));
        const L = k.getXmlFragment("slide-text-" + a).toArray().map((D) => D.clone());
        L.length && t.getXmlFragment("slide-text-" + a).insert(0, L);
      }
      const n = new Set(Le().flatMap((a) => v.get(a).get("referenceUrls") || []));
      for (const a of Wt()) n.has(a.url) && t.getMap("clist_refs").set(a.url, JSON.stringify(a));
      const o = c.encodeStateAsUpdate(t);
      let i = "";
      for (const a of o) i += String.fromCharCode(a);
      return { format: "clist-slide-layout-v1", id: "saved-" + crypto.randomUUID(), label: e.trim(), update: btoa(i) };
    } finally {
      t.destroy();
    }
  }
  function Jn(e) {
    if (!e || e.format !== "clist-slide-layout-v1" || typeof e.id != "string" || !/^saved-[a-z0-9-]+$/.test(e.id) || typeof e.label != "string" || !e.label.trim() || e.label.length > 120 || typeof e.update != "string") throw new Error("Invalid saved slide layout.");
    const t = new c.Doc();
    try {
      c.applyUpdate(t, Uint8Array.from(atob(e.update), (o) => o.charCodeAt(0)));
      const n = t.getMap("slide-pages");
      if (n.size !== 1 || !n.has("first")) throw new Error("A saved layout must contain one slide.");
      return t.getMap("slide-objects").forEach((o) => {
        if (!(o instanceof c.Map) || (o.get("slide") || "first") !== "first" || !["x", "y", "width", "height"].every((i) => typeof o.get(i) == "number" && Number.isFinite(o.get(i))) || o.get("width") <= 0 || o.get("height") <= 0) throw new Error("Invalid object in saved slide layout.");
        o.get("kind") === "shape" && o.get("shapeDefinition") && Yt(o.get("shapeDefinition"));
      }), t;
    } catch (n) {
      throw t.destroy(), n;
    }
  }
  function Yn(e, { select: t = !1 } = {}) {
    Jn(e).destroy();
    const o = { format: e.format, id: e.id, label: e.label.trim(), update: e.update };
    j.set("user:" + o.id, o);
    let i = s("slide-layout").querySelector("optgroup[data-saved-layouts]");
    i || (i = document.createElement("optgroup"), i.label = "Saved layouts", i.dataset.savedLayouts = "", s("slide-layout").append(i));
    let a = [...i.children].find((p) => p.value === "user:" + o.id);
    return a || (a = document.createElement("option"), i.append(a)), a.value = "user:" + o.id, a.textContent = o.label, t && (s("slide-layout").value = a.value), At(), o;
  }
  function Eo(e) {
    const t = Jn(e);
    try {
      const n = t.getMap("slide-objects"), o = /* @__PURE__ */ new Map(), i = [...n.entries()].sort(([u, S], [T, L]) => Re(S) - Re(L) || u.localeCompare(T)).map(([u, S]) => {
        const T = Ze(), L = ln(S.toJSON(), o), D = k.getXmlFragment("slide-text-" + T);
        return E?.addToScope(D), { id: T, data: L, fragment: D, text: t.getXmlFragment("slide-text-" + u).toArray().map((K) => K.clone()) };
      }), a = xe(), p = "slide-" + crypto.randomUUID();
      F = p, m = null, P.clear(), E?.stopCapturing(), k.transact(() => {
        G.size || G.set("first", 0), G.set(p, Math.max(...a.map((u) => G.get(u) || 0)) + 1), pe.set(p, t.getMap("slide-backgrounds").get("first") || "#ffffff"), R.set(p, t.getMap("slide-notes").get("first") || ""), t.getMap("clist_refs").forEach((u) => {
          try {
            $t([JSON.parse(u)]);
          } catch {
          }
        });
        for (const u of i)
          v.set(u.id, new c.Map(Object.entries({ ...u.data, slide: p }))), u.text.length && u.fragment.insert(0, u.text);
      }), E?.stopCapturing(), fe();
    } finally {
      t.destroy();
    }
  }
  function Wt() {
    const e = [];
    return Z.forEach((t) => {
      try {
        const n = wn(JSON.parse(t));
        n && e.push(n);
      } catch {
      }
    }), e;
  }
  function Ft() {
    d.onReferencesChange?.(Wt());
  }
  function $t(e) {
    for (const t of e || []) {
      const n = wn(t);
      n && !Z.has(n.url) && Z.set(n.url, JSON.stringify(n));
    }
  }
  function So(e, t = []) {
    if (z) throw new Error("Return to editing before importing content.");
    const n = [...new Map(t.map(wn).filter(Boolean).map((a) => [a.url, a])).values()], o = Fo(e, n);
    we();
    const i = Ze();
    return E?.stopCapturing(), k.transact(() => {
      De(i, 100, 120, 1e3, 460), v.get(i).set("referenceUrls", n.map((a) => a.url)), $t(n);
    }), O.get(i).editor.commands.setContent(o), E?.stopCapturing(), Me(i), g.tabIndex = -1, g.focus({ preventScroll: !0 }), H("Content imported into a new text box" + (n.length ? " with source references." : ".")), i;
  }
  function Co() {
    oe.has("theme") || k.transact(() => oe.set("theme", structuredClone(_e())), "init");
    const e = c.encodeStateAsUpdate(k), t = [];
    for (let n = 0; n < e.length; n += 32768) t.push(String.fromCharCode(...e.subarray(n, n + 32768)));
    return { format: "clist-slides-yjs-v1", document: s("doc-name").value, update: btoa(t.join("")) };
  }
  async function Mo(e, t) {
    if (je) throw new Error("Disconnect from collaboration before importing a PowerPoint file.");
    if (z) throw new Error("Return to editing before importing a PowerPoint file.");
    const n = await Vo(e, t);
    if (je || z) throw new Error("Return to local editing before completing the import.");
    const o = new c.Doc();
    function i(a) {
      const p = new c.XmlElement(a.type);
      for (const [L, D] of Object.entries(a.attrs || {})) p.setAttribute(L, D);
      const u = [];
      let S = [];
      const T = () => {
        if (S.length) {
          const L = new c.XmlText();
          L.applyDelta(S), u.push(L), S = [];
        }
      };
      for (const L of a.content || [])
        if (L.type === "text") {
          const D = Object.fromEntries((L.marks || []).map((K) => [K.type, K.attrs || {}]));
          S.push({ insert: L.text, attributes: D });
        } else
          T(), u.push(i(L));
      return T(), u.length && p.insert(0, u), p;
    }
    try {
      const a = xe(), p = o.getMap("pages"), u = o.getMap("objects"), S = Math.max(...a.map((L) => G.get(L) || 0)) + 1;
      for (const [L, D] of n.slides.entries()) {
        const K = "slide-" + crypto.randomUUID();
        p.set(K, { order: S + L, background: D.background, notes: D.notes }), D.objects.forEach((le, Fe) => {
          const te = Ze(), { text: Ie, ...Ge } = le;
          Ge.shapeDefinition && (Ge.shapeDefinition = Yt(Ge.shapeDefinition)), u.set(te, { ...Ge, slide: K, layer: Fe }), Ie && o.getXmlFragment("slide-text-" + te).insert(0, Ie.map(i));
        });
      }
      const T = [...u].map(([L, D]) => {
        const K = D.kind === "text" ? k.getXmlFragment("slide-text-" + L) : null;
        return K && E?.addToScope(K), { id: L, box: new c.Map(Object.entries(D)), fragment: K, text: K ? o.getXmlFragment("slide-text-" + L).toArray().map((le) => le.clone()) : [] };
      });
      return we(), E?.stopCapturing(), F = p.keys().next().value, m = null, P.clear(), k.transact(() => {
        G.size || G.set("first", 0);
        for (const [L, D] of p)
          G.set(L, D.order), pe.set(L, D.background), D.notes && R.set(L, D.notes);
        for (const L of T)
          v.set(L.id, L.box), L.fragment && L.text.length && L.fragment.insert(0, L.text);
      }), E?.stopCapturing(), fe(), H(n.slides.length + " PowerPoint slides imported. Use Undo to remove the import."), { count: n.slides.length, warnings: n.warnings };
    } finally {
      o.destroy();
    }
  }
  function Ao(e) {
    if (je) throw new Error("Disconnect from Hocuspocus before replacing the document");
    if (!e || e.format !== "clist-slides-yjs-v1" || typeof e.update != "string")
      throw new Error("Unsupported document format");
    const t = atob(e.update), n = Uint8Array.from(t, (i) => i.charCodeAt(0)), o = new c.Doc();
    try {
      c.applyUpdate(o, n);
    } catch (i) {
      throw o.destroy(), i;
    }
    k.off("beforeObserverCalls", Rt), v.unobserveDeep(fe), G.unobserve(fe), oe.unobserve(fe), pe.unobserve(fe), Z.unobserve(Ft), R.unobserve(zt), k.off("update", St), k.off("update", $e);
    for (const i of O.values())
      i.editor?.destroy(), i.node.remove();
    O.clear(), m = null, P.clear(), se = null, we(), Qn(), k.destroy(), k = o, v = k.getMap("slide-objects"), G = k.getMap("slide-pages"), pe = k.getMap("slide-backgrounds"), R = k.getMap("slide-notes"), Z = k.getMap("clist_refs"), oe = k.getMap("slide-design"), F = xe()[0], mo(), k.on("beforeObserverCalls", Rt), v.observeDeep(fe), G.observe(fe), oe.observe(fe), pe.observe(fe), Z.observe(Ft), R.observe(zt), k.on("update", St), k.on("update", $e), I = !0, e.document && (s("doc-name").value = e.document), fe(), Zn(), Ft(), $e();
  }
  function Lt() {
    U++;
    const e = je;
    je = null, Ke = !1, e?.destroy(), H("Local only"), s("connect").textContent = "Connect";
  }
  async function gn() {
    Lt();
    const e = U;
    try {
      const t = s("server-url").value.trim();
      let n = s("doc-name").value.trim();
      if (!/^wss?:\/\//i.test(t) || !n) throw new Error("Enter a WebSocket URL and document name");
      if (d.resolveDocumentName && (n = await d.resolveDocumentName(n)), e !== U) return;
      s("doc-name").value = n;
      const o = typeof d.parameters == "function" ? d.parameters() : d.parameters;
      je = new f({
        url: t,
        name: n,
        document: k,
        token: d.token || s("token").value || void 0,
        parameters: o || {},
        onStatus: ({ status: i }) => {
          e === U && H(i === "connected" ? "Synchronizing..." : i);
        },
        onSynced: ({ state: i }) => {
          e !== U || i === !1 || (Ke = !0, d.seed !== !1 && Xe(), H("Synced", "connected"));
        },
        onAuthenticationFailed: ({ reason: i } = {}) => {
          if (e !== U) return;
          const a = typeof i == "string" && i.trim() ? i.trim() : "The server did not provide a reason.";
          console.error("Slides collaboration authentication failed:", a), Lt(), H(`Authentication failed: ${a}`, "error");
        },
        onDisconnect: () => {
          e === U && (Ke = !1, H("Disconnected", "error"));
        }
      }), s("connect").textContent = "Disconnect", H("Connecting...");
    } catch (t) {
      if (e !== U) return;
      console.error("Slides connection failed:", t), Lt(), H(t.message, "error");
    }
  }
  function Nt(e) {
    console.error("Slides connection failed:", e), H(e.message, "error");
  }
  s("connect").addEventListener("click", () => {
    je ? Lt() : gn().catch(Nt);
  });
  function Xt() {
    s("undo").disabled = z || !E?.undoStack.length, s("redo").disabled = z || !E?.redoStack.length;
  }
  function _n(e) {
    e.local && e.origin !== "init" && !Ce && E.trackedOrigins.add(e.origin);
  }
  function Zn() {
    E = new c.UndoManager([...k.share.values()], {
      trackedOrigins: /* @__PURE__ */ new Set([null, "geometry", "layer"]),
      captureTransaction: (e) => e.local && e.origin !== "init" && !Ce
    }), k.on("beforeTransaction", _n);
    for (const e of ["stack-item-added", "stack-item-popped", "stack-cleared", "stack-item-updated"]) E.on(e, Xt);
    Xt();
  }
  function Qn() {
    k.off("beforeTransaction", _n), E?.destroy(), E = null;
  }
  function hn(e = !1) {
    if (!(z || !E)) {
      we(), E.stopCapturing();
      try {
        e ? E.redo() : E.undo(), fe(), Xt();
      } catch (t) {
        console.error("Slides history failed:", t), H("Could not " + (e ? "redo" : "undo") + ": " + t.message, "error");
      }
    }
  }
  function Lo(e) {
    if (z || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !m) return;
    const t = e.target;
    if (t.isContentEditable || !!t.closest?.('[contenteditable="true"]')) {
      e.key === "Escape" && (e.preventDefault(), e.stopImmediatePropagation(), O.get(m)?.node.focus({ preventScroll: !0 }), se = null);
      return;
    }
    if (t.closest?.("input, textarea, select, button")) return;
    if (Ve() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault(), e.stopImmediatePropagation(), H("Unlock selected objects before moving or deleting.", "error");
      return;
    }
    const o = O.get(m);
    if (!o) return;
    if (e.key === "Enter" && o.editor && P.size === 1) {
      e.preventDefault(), o.editor.commands.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(), e.stopImmediatePropagation(), E?.stopCapturing(), cn(), E?.stopCapturing(), g.tabIndex = -1, g.focus({ preventScroll: !0 });
      return;
    }
    const i = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!i) return;
    e.preventDefault(), e.stopImmediatePropagation(), e.repeat || E?.stopCapturing();
    const a = e.shiftKey ? 10 : 1, p = [...P].map((L) => ({ id: L, ...v.get(L).toJSON() })), u = Ut(p), S = Math.max(-u.x, Math.min(M - u.x - u.width, i[0] * a)), T = Math.max(-u.y, Math.min(A - u.y - u.height, i[1] * a));
    k.transact(() => {
      for (const L of p) {
        const D = v.get(L.id);
        D.set("x", L.x + S), D.set("y", L.y + T);
      }
    }, "geometry");
  }
  function No(e) {
    if (Lo(e), z || !(e.ctrlKey || e.metaKey) || e.altKey || !g.contains(e.target)) return;
    const t = e.key.toLowerCase();
    t !== "z" && t !== "y" || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && e.target !== s("speaker-notes") || (e.preventDefault(), e.stopImmediatePropagation(), hn(t === "y" || e.shiftKey));
  }
  function Kt() {
    E?.stopCapturing();
  }
  s("undo").addEventListener("click", () => hn()), s("redo").addEventListener("click", () => hn(!0)), g.addEventListener("click", Kt, !0), g.addEventListener("click", Kt), g.addEventListener("change", Kt, !0), g.addEventListener("change", Kt), g.addEventListener("keydown", No, !0);
  function Pt(e, t) {
    const n = t.createElement("div");
    n.className = "slide presenter-slide", n.style.backgroundColor = kt(e), n.setAttribute("aria-label", "Slide preview");
    for (const o of Le(e)) {
      const i = v.get(o), a = t.createElement("div"), p = t.createElement("div");
      if (a.className = i.get("kind") === "shape" ? "slide-object shape-object" : "slide-object", a.style.left = 100 * i.get("x") / M + "%", a.style.top = 100 * i.get("y") / A + "%", a.style.width = 100 * i.get("width") / M + "%", a.style.height = 100 * i.get("height") / A + "%", a.style.transform = "rotate(" + (Number(i.get("rotation")) || 0) + "deg)", a.style.zIndex = String(Le(e).indexOf(o)), i.get("kind") === "image") {
        p.className = "image-content";
        const u = t.createElement("img");
        u.src = Ct(i.get("source")), u.alt = typeof i.get("alt") == "string" ? i.get("alt") : "", en(u, i, !0), p.append(u);
      } else if (i.get("kind") === "shape") {
        p.className = "shape-content";
        const u = t.createElementNS("http://www.w3.org/2000/svg", "svg");
        Tt(u, i), p.append(u);
      } else {
        p.className = "text-content";
        const u = Ae(i), S = nt(i), T = t.createElement("div");
        a.style.setProperty("--slide-font-size", u.size / 12.8 + "cqw"), a.style.fontFamily = Be[u.family], a.style.color = u.colour, a.style.textAlign = u.align, p.style.backgroundColor = S.fill ? S.fillColour : "transparent", p.style.border = S.border ? S.width / 12.8 + "cqw solid " + S.borderColour : "none", T.className = "tiptap", T.append(ro(k.getXmlFragment("slide-text-" + o), t)), p.append(T);
      }
      a.append(p), n.append(a);
    }
    return n;
  }
  function jo() {
    return {
      title: d.presentationTitle?.() || s("doc-name").value || "CList presentation",
      slides: xe().map((e) => ({
        background: kt(e),
        notes: typeof R.get(e) == "string" ? R.get(e) : "",
        objects: Le(e).map((t) => {
          const n = v.get(t), o = n.get("kind") || "text", i = {
            id: t,
            kind: o,
            x: Number(n.get("x")) || 0,
            y: Number(n.get("y")) || 0,
            width: Number(n.get("width")),
            height: Number(n.get("height")),
            rotation: Number(n.get("rotation")) || 0,
            style: nt(n)
          };
          if (!(i.width > 0 && i.height > 0)) throw new Error("An object has invalid dimensions: " + t);
          if (o === "text")
            i.format = Ae(n), i.runs = Ho(ro(k.getXmlFragment("slide-text-" + t), document), i.format.size);
          else if (o === "image") {
            if (i.source = Ct(n.get("source")), !i.source) throw new Error("An image has no valid source: " + t);
            i.alt = typeof n.get("alt") == "string" ? n.get("alt") : "";
            const a = Zt(n);
            i.crop = { ...a }, a.fit === "cover" && Object.assign(i.crop, vt(n));
          } else if (o === "shape") {
            i.definition = structuredClone(It(n));
            const a = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Tt(a, n), a.setAttribute("width", i.width), a.setAttribute("height", i.height);
            for (const p of a.querySelectorAll("[vector-effect]")) p.style.strokeWidth = (i.style.border ? Math.min(i.style.width, i.width, i.height) : 0) + "px";
            i.source = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(a));
          } else throw new Error("Unsupported slide object: " + o);
          return i;
        })
      }))
    };
  }
  function mn() {
    if (!ye) return;
    if (ye.closed) {
      ye = null;
      return;
    }
    const e = xe(), t = e.indexOf(F);
    ye.update({ id: F, nextId: e[t + 1], index: t, total: e.length, notes: typeof R.get(F) == "string" ? R.get(F) : "", presenting: z });
  }
  function eo() {
    try {
      if (ye && !ye.closed) {
        mn(), ye.focus();
        return;
      }
      ye = Oo({
        renderSlide: Pt,
        navigate: Vt,
        jump: (e) => {
          const t = xe();
          F = e === "first" ? t[0] : t[t.length - 1], m = null, P.clear(), fe();
        },
        present: to,
        end: Gt
      }), mn();
    } catch (e) {
      console.error("Presenter view could not open:", e), H("Presenter view could not open: " + e.message, "error"), z && (s("presentation-status").textContent = e.message);
    }
  }
  s("presenter-view").addEventListener("click", eo), s("presentation-presenter-view").addEventListener("click", eo);
  function Vt(e) {
    const t = xe(), n = t[t.indexOf(F) + e];
    n && (F = n, m = null, P.clear(), fe());
  }
  function bn(e) {
    ze?.presenting(e), z = e, Mt(), Xt(), we(), Me(null), g.classList.toggle("presenting", e), dt.update(), s("presentation-controls").hidden = !e;
    for (const t of O.values()) t.editor?.setEditable(!e);
    e ? (he = document.activeElement, g.tabIndex = -1, g.focus()) : (he?.focus?.(), he = null), St();
  }
  async function to() {
    bn(!0), s("presentation-status").textContent = "";
    try {
      g.requestFullscreen && await g.requestFullscreen();
    } catch (e) {
      console.error("Slides fullscreen failed:", e), s("presentation-status").textContent = "Full screen unavailable. Presenting in this window.";
    }
  }
  async function Gt() {
    bn(!1);
    try {
      document.fullscreenElement === g && await document.exitFullscreen();
    } catch (e) {
      console.error("Slides fullscreen exit failed:", e), H("Could not leave full screen. Press Escape.", "error");
    }
  }
  function no(e) {
    if (!(!z || e.altKey || e.ctrlKey || e.metaKey)) {
      if (e.key === "Escape")
        e.preventDefault(), Gt().catch(Nt);
      else if (["ArrowRight", "ArrowDown", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", " "].includes(e.key)) {
        if (e.key === " " && e.target?.tagName === "BUTTON") return;
        if (e.preventDefault(), e.key === "Home" || e.key === "End") {
          const t = xe();
          F = e.key === "Home" ? t[0] : t[t.length - 1], fe();
        } else Vt(["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 1);
      }
    }
  }
  function oo() {
    z && document.fullscreenElement !== g && bn(!1);
  }
  return s("present").addEventListener("click", () => to().catch(Nt)), s("exit-presentation").addEventListener("click", () => Gt().catch(Nt)), s("previous-slide").addEventListener("click", () => Vt(-1)), s("next-slide").addEventListener("click", () => Vt(1)), document.addEventListener("keydown", no), document.addEventListener("fullscreenchange", oo), d.url ? gn().catch(Nt) : d.seed !== !1 && Xe(), fe(), Zn(), At(), ze = _o({
    root: g,
    Y: c,
    getDocument: () => k,
    canEdit: () => !z,
    getEntries: () => xe().flatMap((e, t) => [...Ne.get(e) || []].sort((n, o) => Re(v.get(n)) - Re(v.get(o)) || n.localeCompare(o)).filter((n) => !v.get(n).get("kind") || v.get(n).get("kind") === "text").map((n) => ({ id: n, slideId: e, slideNumber: t + 1, locked: v.get(n).get("locked") === !0, fragment: k.getXmlFragment("slide-text-" + n) }))),
    selectedText: () => {
      const e = O.get(m)?.editor;
      return e ? e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, `
`) : "";
    },
    jump: (e) => {
      qe = !0;
      try {
        we(), pt([e.entry.slideId]), fe(), Me(e.entry.id);
        const t = O.get(e.entry.id);
        t?.editor && (t.editor.commands.setTextSelection({ from: e.from, to: e.to }), t.editor.view.focus()), t?.node.scrollIntoView({ block: "nearest", inline: "nearest" });
      } finally {
        qe = !1;
      }
    },
    transact: (e, t) => {
      if (!z) {
        for (const n of new Set(e.map((o) => o.entry.fragment))) E?.addToScope(n);
        E?.stopCapturing(), k.transact(t), E?.stopCapturing();
      }
    },
    report: Ye,
    onError: (e) => {
      console.error("Slides find/replace failed:", e), typeof window.showErrorModal == "function" ? window.showErrorModal(e.message, { title: "Find and replace failed" }) : H("Find and replace failed: " + e.message, "error");
    }
  }), {
    getArticleHtml: () => ti({ slideIds: xe(), renderSlide: Pt }),
    getHtml: () => fo({ slideIds: xe(), renderSlide: Pt, title: d.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    exportHtml: () => ei({ slideIds: xe(), renderSlide: Pt, title: d.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    snapshotRecovery: et.snapshot,
    importPowerPoint: Mo,
    exportPowerPoint: () => Xo(jo()),
    exportPdf: () => Bo({ slideIds: xe(), renderSlide: Pt, title: d.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    snapshot: Co,
    loadSnapshot: Ao,
    importContent: So,
    getReferences: Wt,
    addReferences: $t,
    connect: gn,
    disconnect: Lt,
    createSavedLayout: ko,
    registerSavedLayout: Yn,
    removeSavedLayout: Vn,
    get document() {
      return k;
    },
    get connected() {
      return Ke;
    },
    destroy() {
      ze?.destroy(), et.destroy(), Q.destroy(), ie.destroy(), dt.destroy(), ye?.close(), ye = null, document.removeEventListener("cut", Bn, !0), document.removeEventListener("paste", Un, !0), document.removeEventListener("keydown", no), document.removeEventListener("fullscreenchange", oo), z && Gt().catch(Nt), Lt(), we(), k.off("beforeObserverCalls", Rt), v.unobserveDeep(fe), G.unobserve(fe), oe.unobserve(fe), pe.unobserve(fe), Z.unobserve(Ft), R.unobserve(zt), k.off("update", St), k.off("update", $e);
      for (const e of O.values()) e.editor?.destroy();
      O.clear(), Qn(), ee?.document.destroy(), ee = null, be = null, k.destroy(), g.remove();
    }
  };
}
export {
  di as createSlideEditor,
  ci as loadSlideCatalogs
};
