const Uo = `
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
        <button data-control="copy-format" title="Copy formatting from the selected text box or shape" class="btn-small">Copy formatting</button><button data-control="paste-format" title="Apply copied formatting to selected text boxes or shapes" class="btn-small">Apply formatting</button><span class="rule"></span>
        <button class="btn-small" data-control="bold" title="Bold selected text"><b>B</b></button>
        <button class="btn-small" data-control="italic" title="Italic selected text"><i>I</i></button>
        <button class="btn-small" data-control="edit-link" title="Add or edit a link on selected text">Link</button><button class="btn-small" data-control="remove-link" title="Remove link from selected text">Remove link</button>
        <button class="btn-small" data-control="bullet-list" title="Toggle bullet list">Bullets</button>
        <button class="btn-small" data-control="ordered-list" title="Toggle numbered list">Numbered list</button>
        <span class="rule"></span>
        <button class="btn-small" data-control="presenter-view" title="Open presenter view with previews, notes and timer">Presenter view</button><button class="btn-small" data-control="present" title="Present slides full screen">Present</button>
      </div>
<div class="canvas-zoom" role="group" aria-label="Canvas zoom"><button class="btn-small btn-secondary" data-control="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><select data-control="canvas-zoom" title="Canvas zoom" aria-label="Canvas zoom"><option value="fit">Fit</option><option value="25">25%</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option><option value="125">125%</option><option value="150">150%</option><option value="200">200%</option></select><button class="btn-small btn-secondary" data-control="zoom-in" title="Zoom in" aria-label="Zoom in">+</button><button class="btn-small btn-secondary" data-control="zoom-fit" title="Fit the whole slide in the canvas">Fit slide</button></div>
      <span data-control="connection-status" class="status">Local only</span>
    </header>
    <div class="link-controls" data-control="link-controls" hidden><label>Link URL <input data-control="link-url" type="url" placeholder="https://example.com" title="Link destination" /></label><button class="btn-small" data-control="apply-link" title="Apply link to selected text">Apply link</button><button class="btn-small btn-secondary" data-control="cancel-link" title="Cancel editing link">Cancel</button></div>
    <section class="workspace">
      <aside class="rail"><div class="slide-create-actions"><button class="btn-small" data-control="add-slide" title="Add a slide">Add slide</button><button class="btn-small" data-control="duplicate-slide" title="Duplicate the current slide">Duplicate</button></div><div data-control="slide-list" class="slide-list" aria-label="Slides"></div><div class="slide-actions"><button class="btn-small btn-secondary" data-control="delete-slide" title="Delete selected slide">Delete</button></div></aside>
      <div class="canvas-space">

        <div class="canvas-viewport" data-control="canvas-viewport" tabindex="0" aria-label="Scrollable slide canvas"><div class="canvas-stage"><div data-control="slide" class="slide" aria-label="Editable 16:9 slide"></div></div></div>
        <label class="speaker-notes">Speaker notes<textarea data-control="speaker-notes" rows="4" title="Speaker notes for the current slide" placeholder="Notes for this slide"></textarea></label>
      </div>
      <aside class="inspector" aria-label="Slide controls" tabindex="0"><details class="control-section" data-panel="themes"><summary>Themes</summary><div class="control-section-body"><label>Presentation theme<select data-control="theme" title="Theme defaults for the whole presentation"></select></label><div data-control="theme-preview" class="theme-preview" aria-hidden="true"></div><p class="helper">Applies to every slide. Individual font, colour and background choices are preserved.</p></div></details><details class="control-section" data-panel="layouts"><summary>Layouts</summary><div class="control-section-body"><label class="slide-layout-label">New slide layout<select data-control="slide-layout" title="Layout for the next slide"></select></label><div class="saved-layout-actions"><button class="btn-small" data-control="rename-layout" title="Rename selected saved layout">Rename layout</button><button class="btn-small btn-secondary" data-control="delete-layout" title="Delete selected saved layout">Delete layout</button></div><p data-control="saved-layout-hint" class="helper" role="status"></p><button class="btn-small" data-control="save-layout" title="Save the current slide design as a layout">Save design as layout</button></div></details><details class="control-section" data-panel="objects" open><summary>Objects</summary><div class="control-section-body"><p class="helper">Objects (front to back). Shift-click to select several.</p><div data-control="object-list" class="object-list" role="group" aria-label="Objects on current slide"></div><div data-control="selection-details" class="selection-details">Select an object</div></div></details><details class="control-section" data-panel="geometry"><summary>Position and size</summary><div class="control-section-body"><div class="geometry-controls"><label>Rotation (degrees)<input data-control="object-rotation" type="number" min="-180" max="180" step="1" value="0" title="Object rotation in degrees" /></label><label>X (px)<input data-control="object-x" type="number" min="0" max="1279" step="1" title="Object horizontal position" /></label><label>Y (px)<input data-control="object-y" type="number" min="0" max="719" step="1" title="Object vertical position" /></label><label>Width (px)<input data-control="object-width" type="number" min="1" max="1280" step="1" title="Object width" /></label><label>Height (px)<input data-control="object-height" type="number" min="1" max="720" step="1" title="Object height" /></label></div></div></details><details class="control-section" data-panel="text"><summary>Text</summary><div class="control-section-body"><button class="btn-small" data-control="fit-text" title="Reduce the selected text boxes’ font size until their text fits">Fit text</button><p class="helper" data-control="text-overflow-status" role="status" aria-live="polite"></p><div class="text-format-controls"><label>Font family<select data-control="font-family" title="Font family for the selected text box"><option value="system">System default</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="georgia">Georgia</option><option value="times">Times New Roman</option><option value="courier">Courier New</option></select></label><label>Font size (px)<input data-control="font-size" type="number" min="8" max="200" step="1" value="33" title="Font size for the selected text box" /></label><label>Text colour<input data-control="text-colour" type="color" value="#202b3d" title="Text colour for the selected text box" /></label><label>Alignment<select data-control="text-align" title="Alignment for the selected text box"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option></select></label></div></div></details><details class="control-section" data-panel="appearance"><summary>Fill and border</summary><div class="control-section-body"><div class="text-format-controls"><label><input data-control="fill-enabled" type="checkbox" title="Enable text box fill" /> Fill</label><label>Fill colour<input data-control="fill-colour" type="color" value="#ffffff" title="Text box fill colour" /></label><label><input data-control="border-enabled" type="checkbox" title="Enable text box border" /> Border</label><label>Border colour<input data-control="border-colour" type="color" value="#202b3d" title="Text box border colour" /></label><label>Border width (px)<input data-control="border-width" type="number" min="1" max="20" step="1" value="2" title="Text box border width" /></label></div></div></details><details class="control-section" data-panel="images"><summary>Image</summary><div class="control-section-body"><label><input data-control="keep-aspect-ratio" type="checkbox" title="Keep image proportions when resizing" checked /> Keep aspect ratio (images)</label><label>Image description (alt text)<textarea data-control="image-description" rows="3" maxlength="2000" title="Description of the selected image" aria-describedby="slide-image-description-help"></textarea></label><p class="helper" id="slide-image-description-help">Describe the image for someone who cannot see it. Leave blank for a decorative image.</p><div class="image-crop-controls"><button class="btn-small" data-control="crop-image" title="Crop the image directly on the slide">Crop image</button><button class="btn-small" data-control="replace-image" title="Replace selected image while preserving its frame and position">Replace image</button><input data-control="replace-image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden /><label>Image mode<select data-control="image-fit" title="Show the whole image or crop to fill the frame"><option value="contain">Fit (whole image)</option><option value="cover">Fill (crop)</option></select></label><p class="helper">Choose Crop image or double-click an image, adjust the rectangle, then choose Done.</p></div></div></details><details class="control-section" data-panel="arrange"><summary>Arrange</summary><div class="control-section-body"><div class="object-group-controls"><button class="btn-small" data-control="group-objects" title="Group selected objects so they select and move together">Group</button><button class="btn-small" data-control="ungroup-objects" title="Ungroup selected objects">Ungroup</button></div><div class="object-lock-controls"><button class="btn-small" data-control="lock-objects" title="Lock selected objects against movement, resizing and deletion">Lock</button><button class="btn-small" data-control="unlock-objects" title="Unlock selected objects">Unlock</button></div><div class="object-alignment"><p>Align selected objects</p><button class="btn-small" data-control="align-left" title="Align selected objects: left">Left</button><button class="btn-small" data-control="align-center" title="Align selected objects: centre">Centre</button><button class="btn-small" data-control="align-right" title="Align selected objects: right">Right</button><button class="btn-small" data-control="align-top" title="Align selected objects: top">Top</button><button class="btn-small" data-control="align-middle" title="Align selected objects: middle">Middle</button><button class="btn-small" data-control="align-bottom" title="Align selected objects: bottom">Bottom</button></div><div class="object-distribution"><p>Equal spacing (select 3 or more)</p><button class="btn-small" data-control="distribute-horizontal" title="Equal horizontal gaps; keep outermost objects in place">Distribute horizontally</button><button class="btn-small" data-control="distribute-vertical" title="Equal vertical gaps; keep outermost objects in place">Distribute vertically</button><p data-control="distribution-status" class="helper" role="status" aria-live="polite"></p></div></div></details><details class="control-section" data-panel="slide"><summary>Slide</summary><div class="control-section-body"><label>Background colour<input data-control="slide-background" type="color" value="#ffffff" title="Background colour for the current slide" /></label></div></details><details class="control-section" data-panel="collaboration"><summary>Collaboration</summary><div class="control-section-body"><label>Hocuspocus WebSocket URL<input data-control="server-url" placeholder="ws://localhost:1234" autocomplete="off" /></label><label>Document name<input data-control="doc-name" autocomplete="off" /></label><label>Auth token (optional)<input data-control="token" type="password" autocomplete="off" /></label><button class="btn-small" data-control="connect">Connect</button><p class="helper">Open this page in two tabs with the same URL and document name to test live collaboration.</p></div></details></aside>
    </section>
<footer hidden class="slide-editor-info" aria-label="Slide information"><div class="canvas-top"><span data-control="slide-label">Slide 1</span><span class="hint">Drag empty slide space to select. Shift adds. Alt bypasses snapping.</span></div></footer>
<div class="presentation-controls" data-control="presentation-controls" hidden><button class="btn-small" data-control="previous-slide" title="Previous slide">Previous</button><span data-control="presentation-position" aria-live="polite"></span><button class="btn-small" data-control="next-slide" title="Next slide">Next</button><button class="btn-small" data-control="presentation-presenter-view" title="Open presenter view">Presenter view</button><button class="btn-small btn-secondary" data-control="exit-presentation" title="Return to editing">Exit presentation</button><span data-control="presentation-status" role="status"></span></div>`;
const it = (o, d, c) => Math.max(d, Math.min(c, Number(o) || 0));
function Ot(o = {}) {
  o ||= {};
  const d = it(o.width ?? 1, 0.02, 1), c = it(o.height ?? 1, 0.02, 1);
  return { x: it(o.x, 0, 1 - d), y: it(o.y, 0, 1 - c), width: d, height: c };
}
function co(o, d, c, s) {
  if (o = Ot(o), d === "move") return { ...o, x: it(o.x + c, 0, 1 - o.width), y: it(o.y + s, 0, 1 - o.height) };
  let g = o.x, m = o.y, f = g + o.width, v = m + o.height;
  return d.includes("w") && (g = it(g + c, 0, f - 0.02)), d.includes("e") && (f = it(f + c, g + 0.02, 1)), d.includes("n") && (m = it(m + s, 0, v - 0.02)), d.includes("s") && (v = it(v + s, m + 0.02, 1)), { x: g, y: m, width: f - g, height: v - m };
}
function An(o, d, c) {
  return o = Ot(o), {
    width: d * o.width,
    height: c * o.height,
    imageFit: "cover",
    cropImageWidth: d,
    cropImageHeight: c,
    cropX: o.width < 1 ? 100 * o.x / (1 - o.width) : 50,
    cropY: o.height < 1 ? 100 * o.y / (1 - o.height) : 50,
    aspectRatio: d * o.width / (c * o.height)
  };
}
function qo(o, d) {
  if (o.get("imageFit") !== "cover") return Ot();
  const c = Number(o.get("cropImageWidth")) || Math.max(o.get("width"), o.get("height") * d), s = Number(o.get("cropImageHeight")) || c / d, g = Math.min(1, o.get("width") / c), m = Math.min(1, o.get("height") / s);
  return Ot({ width: g, height: m, x: (1 - g) * (Number.isFinite(Number(o.get("cropX"))) ? Number(o.get("cropX")) : 50) / 100, y: (1 - m) * (Number.isFinite(Number(o.get("cropY"))) ? Number(o.get("cropY")) : 50) / 100 });
}
function bo({ container: o, source: d, ratio: c, initial: s, current: g = () => !0, onDone: m, onCancel: f, actionsContainer: v = o }) {
  const M = o.ownerDocument;
  let h = Ot(s), E = null, I = !1;
  const y = M.createElement("div");
  y.className = "slide-crop-stage", y.style.aspectRatio = String(c);
  const L = M.createElement("img");
  L.src = d, L.alt = "Image to crop", L.draggable = !1;
  const u = M.createElement("div");
  u.className = "slide-crop-rectangle", u.tabIndex = 0, u.dataset.control = "crop-rectangle", u.setAttribute("role", "group"), u.setAttribute("aria-label", "Crop area. Arrow keys move; Shift plus arrows resizes.");
  for (const P of ["nw", "ne", "sw", "se"]) {
    const k = M.createElement("span");
    k.className = "slide-crop-handle " + P, k.dataset.corner = P, k.setAttribute("aria-hidden", "true"), u.append(k);
  }
  const S = M.createElement("div");
  S.className = "slide-picker-actions";
  const C = M.createElement("button"), r = M.createElement("button");
  C.className = "btn-small", C.textContent = "Done", C.title = "Apply the selected crop", C.dataset.control = "crop-done", r.className = "btn-small btn-secondary", r.textContent = "Cancel crop", r.title = "Cancel cropping", r.dataset.control = "crop-cancel", S.append(C, r), y.append(L, u), o.append(y), v.append(S);
  const F = () => {
    u.style.left = h.x * 100 + "%", u.style.top = h.y * 100 + "%", u.style.width = h.width * 100 + "%", u.style.height = h.height * 100 + "%";
  }, T = () => {
    E && u.hasPointerCapture?.(E.id) && u.releasePointerCapture(E.id), E = null;
  };
  return u.addEventListener("pointerdown", (P) => {
    if (I || !g() || P.isPrimary === !1 || P.button !== 0 || E) return;
    const k = y.getBoundingClientRect();
    !k.width || !k.height || (P.preventDefault(), P.stopPropagation(), E = { id: P.pointerId, x: P.clientX, y: P.clientY, rect: { ...h }, handle: P.target.dataset.corner || "move", bounds: k }, u.setPointerCapture?.(P.pointerId), u.focus({ preventScroll: !0 }));
  }), u.addEventListener("pointermove", (P) => {
    if (!(!E || P.pointerId !== E.id)) {
      if (!g()) {
        T();
        return;
      }
      P.preventDefault(), P.stopPropagation(), h = co(E.rect, E.handle, (P.clientX - E.x) / E.bounds.width, (P.clientY - E.y) / E.bounds.height), F();
    }
  }), u.addEventListener("pointerup", T), u.addEventListener("pointercancel", () => {
    E && (h = E.rect, F()), T();
  }), u.addEventListener("keydown", (P) => {
    I || !g() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(P.key) || (P.preventDefault(), P.stopPropagation(), h = co(h, P.shiftKey ? "se" : "move", P.key === "ArrowLeft" ? -0.01 : P.key === "ArrowRight" ? 0.01 : 0, P.key === "ArrowUp" ? -0.01 : P.key === "ArrowDown" ? 0.01 : 0), F());
  }), C.addEventListener("click", () => {
    I || (T(), g() ? m({ ...h }) : f());
  }), r.addEventListener("click", () => {
    I || (T(), f());
  }), F(), { get rect() {
    return { ...h };
  }, destroy() {
    I = !0, T(), y.remove(), S.remove();
  } };
}
function Ho(o) {
  const d = o.root.ownerDocument;
  let c = 0, s = !1, g = null;
  const m = (h, E, I) => {
    const y = d.createElement(h);
    return E !== void 0 && (y.textContent = E), I && (y.className = I), y;
  };
  function f(h) {
    if (s) throw new Error("This slide editor is closed.");
    const E = ++c, I = o.capture();
    if (!I()) throw new Error("The destination slide is no longer active.");
    g?.close();
    const y = m("div", void 0, "clist-slides slide-insert-picker"), L = m("h2", h), u = m("div"), S = m("p"), C = m("div", void 0, "slide-picker-actions");
    S.setAttribute("role", "status"), S.dataset.control = "picker-feedback";
    const r = m("button", "Cancel", "btn-small btn-secondary");
    r.title = "Cancel insertion", y.append(L, u, S, C), C.append(r);
    const F = o.openModal(y);
    g = F;
    const T = () => !s && c === E && I() && F.current();
    return r.addEventListener("click", () => {
      c === E && (c++, F.close());
    }), { body: y, content: u, actions: C, current: T, error: (k) => {
      o.log(k), T() && (S.textContent = k.message || String(k));
    }, close: F.close };
  }
  function v() {
    const h = f("Choose a shape"), E = m("div", void 0, "slide-shape-grid");
    h.content.append(E);
    for (const I of o.shapes) {
      const y = m("div", void 0, "slide-shape-tile"), L = d.createElementNS("http://www.w3.org/2000/svg", "svg");
      L.setAttribute("viewBox", I.viewBox.join(" ")), L.setAttribute("aria-hidden", "true"), L.setAttribute("fill", "none"), L.setAttribute("stroke", "currentColor"), L.setAttribute("stroke-width", String(Math.max(I.viewBox[2], I.viewBox[3]) / 45));
      for (const S of I.elements) {
        const C = d.createElementNS("http://www.w3.org/2000/svg", S.tag);
        for (const [r, F] of Object.entries(S.attributes)) C.setAttribute(r, String(F));
        C.setAttribute("fill", "none"), L.append(C);
      }
      const u = m("button", void 0, "clist-action-btn btn-small slide-shape-choice");
      u.title = "Insert " + I.label, u.setAttribute("aria-label", I.label), u.dataset.shape = I.id, u.append(L), u.addEventListener("click", () => {
        if (h.current())
          try {
            o.insertShape(I.id), h.close();
          } catch (S) {
            h.error(S);
          }
      }), y.append(u), E.append(y);
    }
    return h.body;
  }
  function M() {
    const h = f("Insert image"), E = m("div", void 0, "slide-picker-actions"), I = m("button", "Choose image file", "btn-small"), y = m("button", "Image libraries", "btn-small btn-secondary");
    I.title = "Choose a PNG, JPEG, GIF or WebP image", y.disabled = !0, y.title = "Image libraries are not available yet";
    const L = m("input");
    L.type = "file", L.accept = "image/png,image/jpeg,image/gif,image/webp", L.hidden = !0, L.dataset.control = "picker-file";
    const u = m("p", "Image library connections can be added here in the future.");
    E.append(I, y, L), h.content.append(E, u);
    const S = m("div", void 0, "slide-image-preview"), C = m("div", void 0, "slide-image-fields");
    S.hidden = C.hidden = !0;
    const r = m("label", "Description (alt text)"), F = m("input");
    F.type = "text", F.maxLength = 2e3, F.dataset.control = "picker-alt", r.append(F), C.append(r);
    const T = m("button", "Insert image", "btn-small"), P = m("button", "Adjust crop", "btn-small");
    T.title = "Insert this image", T.disabled = !0, T.dataset.control = "picker-insert", P.title = "Adjust the crop rectangle", P.hidden = !0, P.dataset.control = "picker-adjust-crop", h.actions.insertBefore(T, h.actions.firstElementChild), h.actions.insertBefore(P, T), h.content.append(S, C);
    let k = null, x = 0, K = !1, Z = null, ne = null;
    function W() {
      const ee = Math.min(1, 800 / k.image.naturalWidth, 500 / k.image.naturalHeight);
      return { width: k.image.naturalWidth * ee, height: k.image.naturalHeight * ee };
    }
    function Q(ee) {
      Z?.destroy(), Z = null, ne = ee, S.textContent = "";
      const ie = W(), q = An(ee, ie.width, ie.height), R = m("div", void 0, "slide-cropped-preview"), se = m("img");
      R.style.aspectRatio = q.width + "/" + q.height, R.style.width = "min(100%, " + Math.min(640, 340 * q.width / q.height) + "px)", se.src = k.source, se.alt = "Cropped image preview", se.style.width = 100 / ee.width + "%", se.style.height = 100 / ee.height + "%", se.style.left = -100 * ee.x / ee.width + "%", se.style.top = -100 * ee.y / ee.height + "%", R.append(se), S.append(R), T.disabled = !1, P.hidden = !1;
    }
    function re() {
      !h.current() || !k || K || (Z?.destroy(), S.textContent = "", T.disabled = !0, P.hidden = !0, S.style.width = "min(100%, " + Math.min(640, 340 * k.image.naturalWidth / k.image.naturalHeight) + "px)", Z = bo({
        container: S,
        source: k.source,
        ratio: k.image.naturalWidth / k.image.naturalHeight,
        initial: ne,
        current: h.current,
        onDone: Q,
        onCancel: () => Q(ne || { x: 0, y: 0, width: 1, height: 1 })
      }));
    }
    return P.addEventListener("click", re), I.addEventListener("click", () => {
      h.current() && !K && L.click();
    }), L.addEventListener("change", async () => {
      if (!h.current() || K || !L.files?.[0]) return;
      const ee = ++x, ie = L.files[0];
      k = null, ne = null, Z?.destroy(), Z = null, T.disabled = !0, P.hidden = !0, S.hidden = C.hidden = !0;
      try {
        const q = await o.readImage(ie);
        if (!h.current() || ee !== x) return;
        k = q, F.value = ie.name, S.hidden = C.hidden = !1, re();
      } catch (q) {
        ee === x && h.error(q);
      } finally {
        ee === x && (L.value = "");
      }
    }), T.addEventListener("click", () => {
      if (!(!h.current() || !k || !ne || Z || K)) {
        K = !0, T.disabled = !0;
        try {
          const ee = W(), ie = An(ne, ee.width, ee.height);
          o.insertImage({ ...k, ...ie, alt: F.value.slice(0, 2e3) }), h.close();
        } catch (ee) {
          h.error(ee), K = !1, T.disabled = !1;
        }
      }
    }), h.body;
  }
  return { shape: v, image: M, destroy() {
    s = !0, c++, g?.close(), g = null;
  } };
}
function Wo(o, d = () => !0, c = null) {
  const s = o.ownerDocument, g = o.querySelector(".toolbar"), m = o.querySelector(".tools"), f = s.createElement("div");
  f.className = "slide-menu-bar tools", m.className = "slide-menu-bar tools", f.setAttribute("aria-label", "Slide menu"), m.setAttribute("aria-label", "Slide menu options"), g.insertBefore(f, m);
  let v = !1, M = "new";
  const h = s.createElement("div");
  h.className = "slide-menu-options", h.dataset.menuGroup = "insert";
  const E = s.createElement("button");
  E.className = "btn-small", E.textContent = "Insert", E.title = "Insert options", E.dataset.menu = "insert";
  const I = s.createElement("div");
  I.className = "slide-menu-options", I.dataset.menuGroup = "new";
  for (const x of ["add-slide", "duplicate-slide"]) {
    const K = o.querySelector('[data-control="' + x + '"]');
    K && I.append(K);
  }
  const y = s.createElement("button");
  y.className = "btn-small", y.textContent = "New Slide", y.title = "New Slide options", y.dataset.menu = "new";
  const L = (x) => v || !d() || !["new", "insert"].includes(x) ? !1 : (M = x, I.hidden = x !== "new", h.hidden = x !== "insert", y.setAttribute("aria-pressed", String(x === "new")), E.setAttribute("aria-pressed", String(x === "insert")), o.dataset.slideMenu = x, !0);
  y.addEventListener("click", () => L("new")), f.append(y);
  for (const x of [...m.children]) f.append(x);
  m.append(I, h), E.addEventListener("click", () => L("insert")), f.insertBefore(E, y.nextSibling);
  const u = s.createElement("button");
  u.className = "btn-small", u.textContent = "Shape", u.title = "Choose a shape", u.dataset.control = "choose-shape", h.append(u);
  for (const [x, K] of [["add-image", "Image"], ["add-text", "Text"]]) {
    const Z = o.querySelector('[data-control="' + x + '"]');
    Z && (Z.className = "btn-small", Z.textContent = K, h.append(Z));
  }
  const S = o.querySelector('[data-control="shape-tools"]');
  S && (S.hidden = !0, h.append(S)), u.addEventListener("click", () => {
    !v && d() && M === "insert" && c?.();
  });
  const C = s.createElement("button");
  C.className = "btn-small", C.textContent = "Template", C.title = "Choose the layout for the next slide", C.dataset.control = "choose-template";
  const r = o.querySelector('[data-control="slide-layout"]'), F = r?.parentNode;
  I.append(C), r && (r.hidden = !0, I.append(r), F?.classList.contains("slide-layout-label") && F.remove()), C.addEventListener("click", () => {
    !v && d() && r && (r.hidden = !r.hidden, r.hidden || (r.selectedIndex = -1, r.focus()));
  });
  const T = () => {
    v || !d() || M !== "new" || r.hidden || !r.value || (o.querySelector('[data-control="add-slide"]')?.click(), r.hidden = !0);
  };
  r?.addEventListener("change", T), o.querySelector(".slide-create-actions")?.remove();
  const P = o.querySelector(".canvas-zoom");
  P && f.append(P);
  const k = o.querySelector('[data-control="connection-status"]');
  return k && o.querySelector(".slide-editor-info")?.append(k), L("new"), { choose: L, get active() {
    return M;
  }, destroy() {
    v = !0, r?.removeEventListener("change", T);
  } };
}
const uo = [
  ["slide", "View slide only"],
  ["notes", "Slide + notes"],
  ["outline", "Outline"],
  ["sorter", "Slide sorter"]
];
function Xo({ root: o, getSlides: d, selectSlide: c, canChange: s = () => !0 }) {
  const g = o.ownerDocument;
  let m = "slide", f = !1;
  const v = g.createElement("label"), M = g.createElement("select");
  v.className = "slide-view-picker", M.dataset.control = "slide-view", M.title = "Choose slide editor view", M.setAttribute("aria-label", "Slide editor view");
  for (const [r, F] of uo) {
    const T = g.createElement("option");
    T.value = r, T.textContent = F, M.append(T);
  }
  v.append(M);
  const h = o.querySelector(".tools");
  h.insertBefore(v, h.firstElementChild || null);
  const E = g.createElement("section");
  E.className = "slide-outline", E.setAttribute("aria-label", "Presentation outline"), o.querySelector(".workspace").append(E);
  const I = o.querySelector('[data-control="slide-list"]'), y = /* @__PURE__ */ new Map();
  function L() {
    if (f || m !== "outline") return;
    const r = d(), F = new Set(r.map((P) => P.id));
    for (const [P, k] of y) F.has(P) || (k.section.remove(), y.delete(P));
    let T = E.firstElementChild;
    r.forEach((P, k) => {
      let x = y.get(P.id);
      if (!x) {
        const Z = g.createElement("section"), ne = g.createElement("button"), W = g.createElement("div");
        ne.className = "btn-small", ne.title = "Select this slide", W.className = "slide-outline-text", ne.addEventListener("click", () => {
          !f && s() && c(P.id);
        }), Z.append(ne, W), x = { section: Z, button: ne, text: W }, y.set(P.id, x);
      }
      x.button.textContent = "Slide " + (k + 1), x.button.setAttribute("aria-current", String(P.active));
      const K = P.text || "(No text on this slide)";
      x.text.textContent !== K && (x.text.textContent = K), T === x.section ? T = T.nextElementSibling : E.insertBefore(x.section, T);
    });
  }
  function u(r) {
    return f || !s() || !uo.some(([F]) => F === r) ? (M.value = m, !1) : (m = r, o.dataset.slideView = m, M.value = m, I.title = m === "sorter" ? "Drag to reorder. Double-click a slide or press Enter to edit it." : "Slides", L(), !0);
  }
  const S = () => u(M.value), C = (r) => {
    if (m !== "sorter" || !s() || r.type === "keydown" && r.key !== "Enter") return;
    const F = r.target.closest("[data-slide-id]");
    !F || !I.contains(F) || (r.preventDefault(), r.stopPropagation(), c(F.dataset.slideId), u("slide"), M.focus());
  };
  return M.addEventListener("change", S), I.addEventListener("dblclick", C), I.addEventListener("keydown", C, !0), u(m), {
    refresh: L,
    setMode: u,
    get mode() {
      return m;
    },
    focus(r) {
      y.get(r)?.button.focus({ preventScroll: !0 });
    },
    destroy() {
      f = !0, M.removeEventListener("change", S), I.removeEventListener("dblclick", C), I.removeEventListener("keydown", C, !0), v.remove(), E.remove(), y.clear(), delete o.dataset.slideView;
    }
  };
}
function $o(o, d, c, s = !1) {
  return o.findIndex((g) => s ? c < g.top || c <= g.bottom && d < g.left + g.width / 2 : c < g.top + g.height / 2);
}
function yo(o) {
  try {
    const d = new URL(o);
    return ["http:", "https:"].includes(d.protocol) ? d.href : "";
  } catch {
    return "";
  }
}
function En(o) {
  if (!o || typeof o.url != "string") return null;
  const d = yo(o.url);
  return d ? { ...JSON.parse(JSON.stringify(o)), url: d } : null;
}
function Vo(o, d) {
  if (!o || !["text/html", "text/plain"].includes(o.type) || typeof o.value != "string") throw new Error("Import HTML or plain text into Slides.");
  const c = document.createElement("div");
  if (o.type === "text/html") {
    const s = new DOMParser().parseFromString(o.value, "text/html");
    s.querySelectorAll("script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons").forEach((g) => g.remove());
    for (const g of s.querySelectorAll("img")) g.replaceWith(s.createTextNode(g.alt || ""));
    for (const g of s.body.querySelectorAll("*")) {
      for (const m of [...g.attributes]) m.name !== "href" && g.removeAttribute(m.name);
      if (g.hasAttribute("href")) {
        const m = yo(g.getAttribute("href"));
        m ? g.setAttribute("href", m) : g.removeAttribute("href");
      }
    }
    c.innerHTML = s.body.innerHTML;
  } else
    for (const s of o.value.split(/\r?\n/)) {
      const g = document.createElement("p");
      g.textContent = s, c.append(g);
    }
  for (const s of d) {
    const g = document.createElement("p"), m = document.createElement("a");
    m.href = s.url, m.textContent = s.title || s.url, g.append(document.createTextNode("Source: "), m), c.append(g);
  }
  if (!c.textContent.trim()) throw new Error("There is no readable text to import.");
  return c.innerHTML;
}
function Ko(o, d, c) {
  let s = null, g = !1;
  const m = /* @__PURE__ */ new WeakMap(), f = o.querySelector('[data-control="fit-text"]'), v = o.querySelector('[data-control="text-overflow-status"]');
  function M(u) {
    const S = u.content.querySelector(".tiptap");
    return !!S && S.clientHeight > 0 && (S.scrollHeight > S.clientHeight + 1 || S.scrollWidth > S.clientWidth + 1);
  }
  function h() {
    if (s = null, g) return;
    let u = 0;
    const S = c.selected();
    for (const F of c.views()) {
      if (!F.editor) continue;
      const T = M(F);
      S.includes(F) && (u += Number(T));
      let P = m.get(F.node);
      !P && T && (P = document.createElement("span"), P.className = "text-overflow-badge", P.textContent = "Text overflow", P.title = "Text does not fit in this box. Use Fit text or enlarge the box.", F.node.append(P), m.set(F.node, P)), P && P.hidden === T && (P.hidden = !T);
    }
    const C = c.presenting() || !S.length || S.some((F) => F.box.get("locked") === !0) || !S.some((F) => F.editor);
    f.disabled !== C && (f.disabled = C);
    const r = u ? u + " selected text box" + (u === 1 ? " overflows." : "es overflow.") + " Use Fit text or enlarge the box." : S.some((F) => F.editor) ? "Selected text fits." : "Select a text box to check its fit.";
    v.textContent !== r && (v.textContent = r);
  }
  function E() {
    !g && s === null && (s = requestAnimationFrame(h));
  }
  function I() {
    const u = c.selected();
    if (c.presenting() || u.some((C) => C.box.get("locked") === !0)) return;
    const S = [];
    for (const C of u) {
      if (!C.editor || !M(C)) continue;
      const r = C.node.style.getPropertyValue("--slide-font-size"), F = c.size(C.box);
      let T = 8;
      try {
        let P = 8, k = Math.floor(F);
        for (; P <= k; ) {
          const x = Math.floor((P + k) / 2);
          C.node.style.setProperty("--slide-font-size", x / 12.8 + "cqw"), M(C) ? k = x - 1 : (T = x, P = x + 1);
        }
      } finally {
        C.node.style.setProperty("--slide-font-size", r);
      }
      T < F && S.push({ box: C.box, size: T });
    }
    c.apply(S), h();
  }
  f.addEventListener("click", I);
  const y = new MutationObserver(E);
  y.observe(d, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["style", "class"] });
  const L = new ResizeObserver(E);
  return L.observe(d), document.fonts?.addEventListener("loadingdone", E), E(), { schedule: E, destroy() {
    g = !0, s !== null && cancelAnimationFrame(s), y.disconnect(), L.disconnect(), document.fonts?.removeEventListener("loadingdone", E), f.removeEventListener("click", I);
  } };
}
function Go(o, d, c) {
  const s = document.createElement("div");
  s.className = "selection-marquee", s.hidden = !0, s.setAttribute("aria-hidden", "true"), d.append(s);
  let g = null;
  function m(y) {
    const L = d.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (y.clientX - L.left) * 1280 / L.width)), y: Math.max(0, Math.min(720, (y.clientY - L.top) * 720 / L.height)) };
  }
  function f() {
    const y = g;
    g = null, s.hidden = !0, y && d.hasPointerCapture(y.pointer) && d.releasePointerCapture(y.pointer);
  }
  function v() {
    if (!g) return;
    const y = g.original;
    f(), c.select(y);
  }
  function M(y) {
    y.button !== 0 || y.isPrimary === !1 || (v(), g = { start: m(y), clientX: y.clientX, clientY: y.clientY, pointer: y.pointerId, original: c.selected(), additive: y.shiftKey, slide: c.slideId(), moved: !1 }, d.setPointerCapture(y.pointerId));
  }
  function h(y) {
    if (!g || y.pointerId !== g.pointer) return;
    if (c.slideId() !== g.slide) {
      v();
      return;
    }
    if (!g.moved && Math.hypot(y.clientX - g.clientX, y.clientY - g.clientY) < 4) return;
    g.moved = !0, y.preventDefault();
    const L = m(y), u = Math.min(g.start.x, L.x), S = Math.min(g.start.y, L.y), C = Math.abs(L.x - g.start.x), r = Math.abs(L.y - g.start.y);
    Object.assign(s.style, { left: u / 12.8 + "%", top: S / 7.2 + "%", width: C / 12.8 + "%", height: r / 7.2 + "%" }), s.hidden = !1;
    const F = new Set(g.additive ? g.original : []);
    for (const T of c.objects())
      T.x < u + C && T.x + T.width > u && T.y < S + r && T.y + T.height > S && F.add(T.id);
    c.select([...F]);
  }
  function E(y) {
    !g || y.pointerId !== g.pointer || (h(y), f());
  }
  function I(y) {
    g && y.key === "Escape" && (y.preventDefault(), y.stopPropagation(), v());
  }
  return d.addEventListener("pointermove", h), d.addEventListener("pointerup", E), d.addEventListener("pointercancel", v), d.addEventListener("lostpointercapture", v), o.addEventListener("keydown", I, !0), { begin: M, cancel: v, destroy() {
    f(), d.removeEventListener("pointermove", h), d.removeEventListener("pointerup", E), d.removeEventListener("pointercancel", v), d.removeEventListener("lostpointercapture", v), o.removeEventListener("keydown", I, !0), s.remove();
  } };
}
function Jo(o, d) {
  const c = (y) => o.querySelector('[data-control="' + y + '"]'), s = c("canvas-viewport"), g = c("slide"), m = c("canvas-zoom"), f = [25, 50, 75, 100, 125, 150, 200];
  let v = "fit", M = 100;
  function h() {
    if (d() || !s.clientWidth || !s.clientHeight) return;
    const y = Math.max(1, s.clientWidth - 48), L = Math.max(1, s.clientHeight - 48);
    v === "fit" && (M = Math.min(100, y / 1280 * 100, L / 720 * 100));
    const u = 1280 * M / 100, S = 720 * M / 100;
    g.style.setProperty("--canvas-slide-width", u + "px"), s.style.setProperty("--canvas-stage-width", u + 48 + "px"), s.style.setProperty("--canvas-stage-height", S + 48 + "px"), m.options[0].textContent = "Fit (" + Math.round(M) + "%)", m.value = v, c("zoom-out").disabled = M <= 25, c("zoom-in").disabled = M >= 200;
  }
  function E(y) {
    v = y, v !== "fit" && (M = Number(v)), h(), v === "fit" && (s.scrollLeft = 0, s.scrollTop = 0);
  }
  m.addEventListener("change", () => E(m.value)), c("zoom-fit").addEventListener("click", () => E("fit")), c("zoom-in").addEventListener("click", () => E(String(f.find((y) => y > M + 0.1) || 200))), c("zoom-out").addEventListener("click", () => E(String([...f].reverse().find((y) => y < M - 0.1) || 25)));
  const I = new ResizeObserver(h);
  return I.observe(s), h(), { update: h, destroy() {
    I.disconnect();
  } };
}
const Yo = {
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
function _o() {
  const o = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return o.setAttribute("viewBox", "0 0 24 24"), o.setAttribute("aria-hidden", "true"), o.setAttribute("focusable", "false"), o.setAttribute("fill", "none"), o.setAttribute("stroke", "currentColor"), o.setAttribute("stroke-width", "1.8"), o.setAttribute("stroke-linecap", "round"), o.setAttribute("stroke-linejoin", "round"), o;
}
function po(o, d = null) {
  const c = _o();
  if (d) {
    c.setAttribute("viewBox", d.viewBox.join(" ")), c.setAttribute("stroke-width", String(Math.max(d.viewBox[2], d.viewBox[3]) / 12));
    for (const s of d.elements) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", s.tag);
      for (const [m, f] of Object.entries(s.attributes)) g.setAttribute(m, String(f));
      c.append(g);
    }
  } else
    c.innerHTML = Yo[o.dataset.control] || '<circle cx="12" cy="12" r="8"/>';
  o.className = "clist-action-btn btn-small", o.type = "button", o.setAttribute("aria-label", o.title), o.replaceChildren(c);
}
function fo(o, d) {
  const c = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" }, s = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u" };
  function g(f) {
    if (typeof f.toDelta == "function") {
      const E = d.createDocumentFragment();
      for (const I of f.toDelta()) {
        if (typeof I.insert != "string") continue;
        let y = d.createTextNode(I.insert);
        for (const [L, u] of Object.entries(I.attributes || {})) {
          let S;
          s[L] ? S = d.createElement(s[L]) : L === "link" && typeof u?.href == "string" && /^(https?:|mailto:|tel:)/i.test(u.href) && (S = d.createElement("a"), S.href = u.href, S.target = "_blank", S.rel = "noopener noreferrer"), S && (S.append(y), y = S);
        }
        E.append(y);
      }
      return E;
    }
    const v = f.getAttributes?.() || {}, M = f.nodeName === "heading" ? "h" + Math.max(1, Math.min(6, Number(v.level) || 1)) : c[f.nodeName] || "div", h = d.createElement(M);
    f.nodeName === "orderedList" && Number.isInteger(v.start) && (h.start = v.start);
    for (const E of f.toArray?.() || []) h.append(g(E));
    return h;
  }
  const m = d.createDocumentFragment();
  for (const f of o.toArray()) m.append(g(f));
  return m;
}
function Zo({ renderSlide: o, navigate: d, jump: c, present: s, end: g }) {
  const m = window.open("", "_blank", "popup,width=1200,height=850");
  if (!m) throw new Error("Allow pop-up windows for CList to open Presenter view.");
  const f = m.document;
  f.title = "CList Slides — Presenter view", f.documentElement.lang = "en";
  for (const q of document.querySelectorAll('link[rel="stylesheet"], style')) f.head.append(q.cloneNode(!0));
  f.body.className = "clist-presenter-page";
  const v = f.createElement("main");
  v.className = "clist-slides presenter-console", f.body.replaceChildren(v);
  const M = f.createElement("header");
  M.className = "presenter-header";
  const h = f.createElement("h1");
  h.textContent = "Presenter view";
  const E = f.createElement("span"), I = f.createElement("span"), y = f.createElement("p");
  E.dataset.control = "presenter-position", I.dataset.control = "presenter-timer", I.setAttribute("aria-label", "Elapsed presentation time"), y.setAttribute("role", "status"), M.append(h, E, I);
  function L(q) {
    console.error("Presenter view failed:", q), y.textContent = q.message;
  }
  function u(q, R, se) {
    const Ee = f.createElement("button");
    return Ee.className = "btn-small", Ee.textContent = q, Ee.title = q, Ee.dataset.control = R, Ee.addEventListener("click", () => {
      try {
        Promise.resolve(se()).catch(L);
      } catch (ge) {
        L(ge);
      }
    }), M.append(Ee), Ee;
  }
  const S = u("Previous", "presenter-previous", () => d(-1)), C = u("Next", "presenter-next", () => d(1)), r = u("Present", "presenter-start", s), F = u("End presentation", "presenter-end", g);
  let T = 0, P = null;
  function k() {
    const q = Math.floor((T + (P === null ? 0 : Date.now() - P)) / 1e3);
    I.textContent = "Elapsed " + String(Math.floor(q / 60)).padStart(2, "0") + ":" + String(q % 60).padStart(2, "0");
  }
  u("Reset timer", "presenter-reset-timer", () => {
    T = 0, P !== null && (P = Date.now()), k();
  });
  const x = f.createElement("div");
  x.className = "presenter-grid";
  function K(q, R) {
    const se = f.createElement("section"), Ee = f.createElement("h2"), ge = f.createElement("div");
    return Ee.textContent = q, ge.dataset.control = R, se.append(Ee, ge), x.append(se), ge;
  }
  const Z = K("Current slide", "presenter-current"), ne = K("Next slide", "presenter-upcoming"), W = f.createElement("h2"), Q = f.createElement("div"), re = f.createElement("p");
  W.textContent = "Speaker notes", Q.className = "presenter-notes", Q.dataset.control = "presenter-notes", re.className = "helper", re.textContent = "Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.", v.append(M, re, y, x, W, Q), m.addEventListener("keydown", (q) => {
    if (!(q.ctrlKey || q.altKey || q.metaKey || q.isComposing || q.key === " " && q.target?.tagName === "BUTTON" || !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", "Escape"].includes(q.key))) {
      q.preventDefault();
      try {
        q.key === "Escape" ? Promise.resolve(g()).catch(L) : q.key === "Home" || q.key === "End" ? c(q.key === "Home" ? "first" : "last") : d(["ArrowLeft", "ArrowUp", "PageUp"].includes(q.key) ? -1 : 1);
      } catch (se) {
        L(se);
      }
    }
  });
  const ee = window.setInterval(() => {
    m.closed ? window.clearInterval(ee) : k();
  }, 250);
  function ie() {
    window.clearInterval(ee), m.closed || m.close(), window.removeEventListener("beforeunload", ie);
  }
  return m.addEventListener("unload", () => {
    window.clearInterval(ee), window.removeEventListener("beforeunload", ie);
  }), window.addEventListener("beforeunload", ie), k(), {
    get closed() {
      return m.closed;
    },
    focus() {
      m.focus();
    },
    close: ie,
    update({ id: q, nextId: R, index: se, total: Ee, notes: ge, presenting: V }) {
      if (!m.closed) {
        if (E.textContent = "Slide " + (se + 1) + " of " + Ee, Q.textContent = ge || "No speaker notes for this slide.", Z.replaceChildren(o(q, f)), R) ne.replaceChildren(o(R, f));
        else {
          const Ue = f.createElement("p");
          Ue.textContent = "End of presentation", ne.replaceChildren(Ue);
        }
        S.disabled = se === 0, C.disabled = se === Ee - 1, r.disabled = V, F.disabled = !V, V && P === null ? P = Date.now() : !V && P !== null && (T += Date.now() - P, P = null), k();
      }
    }
  };
}
async function Qo({ slideIds: o, renderSlide: d, title: c = "CList presentation" }) {
  const s = window.open("", "_blank");
  if (!s) throw new Error("Allow pop-up windows for CList to export slides as PDF.");
  const g = s.document;
  g.title = c, g.documentElement.lang = "en";
  const m = g.createElement("header");
  m.className = "slide-print-controls";
  const f = g.createElement("p");
  f.setAttribute("role", "status"), f.textContent = "Preparing slides…";
  const v = g.createElement("button");
  v.className = "btn", v.textContent = "Print / Save as PDF", v.title = "Open the print dialog to save this presentation as a PDF", v.disabled = !0, m.append(f, v);
  const M = g.createElement("main");
  M.className = "clist-slides slide-print-deck", g.body.replaceChildren(m, M);
  function h(E) {
    console.error("Slides PDF export failed:", E), f.className = "error-message", f.textContent = "Could not prepare PDF export: " + E.message;
  }
  v.addEventListener("click", () => {
    try {
      s.focus(), s.print();
    } catch (E) {
      h(E);
    }
  });
  try {
    const E = [];
    for (const y of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const L = y.cloneNode(!0);
      y.tagName === "LINK" && (L.href = y.href, E.push(new Promise((u, S) => {
        L.addEventListener("load", u, { once: !0 }), L.addEventListener("error", () => S(new Error("A presentation stylesheet could not load.")), { once: !0 });
      }))), g.head.append(L);
    }
    const I = g.createElement("style");
    I.textContent = `
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
    `, g.head.append(I);
    for (const y of o) {
      const L = g.createElement("section");
      L.className = "slide-print-page", L.append(d(y, g)), M.append(L);
    }
    if (await Promise.all(E), await g.fonts.ready, await Promise.all([...M.querySelectorAll("img")].map((y) => y.decode())), s.closed) return;
    f.textContent = "Choose Save as PDF in the print dialog. Use all pages, no margins, no headers or footers, and enable background graphics. Each slide is one landscape page; speaker notes are excluded.", v.disabled = !1;
  } catch (E) {
    throw h(E), E;
  }
}
let Rt;
function wo() {
  return window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : (Rt || (Rt = new Promise((o, d) => {
    const c = document.createElement("script"), s = "../../../js/vendor/pptxgen.bundle.js";
    c.src = new URL(s, import.meta.url).href, c.onload = () => {
      window.PptxGenJS ? o(window.PptxGenJS) : (Rt = null, c.remove(), d(new Error("The PowerPoint export library did not initialize.")));
    }, c.onerror = () => {
      Rt = null, c.remove(), d(new Error("The PowerPoint export library could not load. Please retry."));
    }, document.head.append(c);
  })), Rt);
}
const St = (o) => o / 96, rt = (o) => o * 0.75, nn = (o) => o.replace("#", ""), ei = { system: "Arial", arial: "Arial", verdana: "Verdana", georgia: "Georgia", times: "Times New Roman", courier: "Courier New" };
function ti(o, d) {
  const c = [];
  function s(f, v = {}) {
    if (f.nodeType === 3) {
      f.textContent && c.push({ text: f.textContent, options: { ...v } });
      return;
    }
    const M = f.nodeName.toLowerCase(), h = { ...v };
    if (["strong", "b"].includes(M) && (h.bold = !0), ["em", "i"].includes(M) && (h.italic = !0), M === "u" && (h.underline = { style: "sng" }), ["s", "strike"].includes(M) && (h.strike = "sngStrike"), ["code", "pre"].includes(M) && (h.fontFace = "Courier New"), M === "a" && /^(https?:|mailto:|tel:)/i.test(f.getAttribute("href") || "") && (h.hyperlink = { url: f.getAttribute("href") }, h.color = "2365BF", h.underline = { style: "sng" }), M === "br") {
      c.push({ text: "", options: { ...h, breakLine: !0 } });
      return;
    }
    for (const E of f.childNodes) s(E, h);
  }
  function g(f, v = null) {
    const M = f.nodeName.toLowerCase();
    if (M === "ul" || M === "ol") {
      let h = Number(f.getAttribute("start")) || 1;
      for (const E of f.children) g(E, { ordered: M === "ol", index: h++, level: (v?.level ?? -1) + 1 });
      return;
    }
    if (M === "li" || M === "blockquote" || M === "div")
      for (const h of f.childNodes)
        h.nodeType === 3 ? h.textContent.trim() && m(h, v) : g(h, v);
    else m(f, v);
  }
  function m(f, v) {
    const M = c.length, h = {};
    /^H[1-6]$/.test(f.nodeName) && (h.bold = !0), s(f, h), c.length === M && c.push({ text: "​", options: {} });
    for (const E of c.slice(M))
      E.options.paraSpaceAfter = v ? rt(d * 0.2) : 6, v && (E.options.bullet = v.ordered ? { type: "number", startAt: v.index, indent: rt(d * 1.5) } : { indent: rt(d * 1.5) }, E.options.indentLevel = Math.min(8, v.level), E.options.hanging = rt(d * 0.3));
    c[c.length - 1].options.breakLine = !0;
  }
  for (const f of o.childNodes) g(f);
  return c.length && delete c[c.length - 1].options.breakLine, c;
}
function xo(o) {
  return {
    fill: o.fill ? { color: nn(o.fillColour) } : { color: "FFFFFF", transparency: 100 },
    line: o.border ? { color: nn(o.borderColour), width: rt(o.width) } : { color: "FFFFFF", transparency: 100 }
  };
}
function ni(o, d, c, s) {
  const g = d.definition;
  if (g.elements.length !== 1) return !1;
  const { tag: m, attributes: f } = g.elements[0], [v, M, h, E] = g.viewBox, I = m === "rect" && !f.rx && !f.ry && (f.x || 0) === v && (f.y || 0) === M && f.width === h && f.height === E, y = m === "ellipse" && f.cx === v + h / 2 && f.cy === M + E / 2 && f.rx === h / 2 && f.ry === E / 2 || m === "circle" && h === E && f.cx === v + h / 2 && f.cy === M + E / 2 && f.r === h / 2, L = m === "line" && f.x1 === v && f.y1 === M && f.x2 === v + h && f.y2 === M + E;
  if (!I && !y && !L) return !1;
  const u = d.style.border ? Math.min(d.style.width, d.width, d.height) : 0, S = St(u / 2), C = xo({ ...d.style, width: u });
  return L && (C.fill.transparency = 100), o.addShape(I ? s.ShapeType.rect : y ? s.ShapeType.ellipse : s.ShapeType.line, {
    ...c,
    x: c.x + S,
    y: c.y + S,
    w: Math.max(1e-3, c.w - S * 2),
    h: Math.max(1e-3, c.h - S * 2),
    ...C
  }), !0;
}
async function oi(o) {
  const d = new Image();
  d.src = o.source, await d.decode();
  const c = document.createElement("canvas"), s = Math.min(2, 4096 / Math.max(o.width, o.height));
  c.width = Math.max(1, Math.round(o.width * s)), c.height = Math.max(1, Math.round(o.height * s));
  const g = c.getContext("2d");
  if (!g) throw new Error("The browser could not prepare a presentation image.");
  g.scale(c.width / o.width, c.height / o.height);
  let m, f;
  if (o.crop?.fit === "cover")
    m = o.crop.width || Math.max(o.width, o.height * d.naturalWidth / d.naturalHeight), f = o.crop.height || m * d.naturalHeight / d.naturalWidth;
  else {
    const v = Math.min(o.width / d.naturalWidth, o.height / d.naturalHeight);
    m = d.naturalWidth * v, f = d.naturalHeight * v;
  }
  return g.drawImage(d, (o.width - m) * (o.crop?.x ?? 50) / 100, (o.height - f) * (o.crop?.y ?? 50) / 100, m, f), c.toDataURL("image/png");
}
async function ii(o, d) {
  const c = await wo(), s = new c();
  s.defineLayout({ name: "CLIST", width: St(1280), height: St(720) }), s.layout = "CLIST", s.title = o.title, s.subject = "CList presentation", s.author = "", s.company = "", s.lang = "en-CA";
  const g = /* @__PURE__ */ new Set();
  for (const m of o.slides) {
    const f = s.addSlide();
    f.background = { color: nn(m.background) }, m.notes && f.addNotes(m.notes);
    for (const v of m.objects) {
      const M = { x: St(v.x), y: St(v.y), w: St(v.width), h: St(v.height), rotate: ((v.rotation || 0) % 360 + 360) % 360, objectName: v.id };
      if (v.kind === "text") {
        const h = v.format;
        f.addText(v.runs.length ? v.runs : "", {
          ...M,
          ...xo(v.style),
          fontFace: ei[h.family],
          fontSize: rt(h.size),
          color: nn(h.colour),
          align: h.align,
          valign: "top",
          margin: [rt(5), rt(8), rt(5), rt(8)],
          breakLine: !1,
          lineSpacingMultiple: 1.2,
          paraSpaceAfter: 6,
          wrap: !0,
          fit: "none"
        });
      } else v.kind === "shape" && ni(f, v, M, s) || (v.kind === "shape" && g.add("Custom SVG shapes were exported as images."), f.addImage({ ...M, data: await oi(v), altText: v.alt || v.definition?.label || "" }));
    }
  }
  return { pptx: s, warnings: [...g] };
}
async function ri(o) {
  const { pptx: d, warnings: c } = await ii(o), s = (o.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".pptx";
  return await d.writeFile({ fileName: s, compression: !0 }), c;
}
const go = "http://schemas.openxmlformats.org/presentationml/2006/main", Sn = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", _ = (o, d) => [...o?.children || []].find((c) => c.localName === d), pt = (o, d) => [...o?.getElementsByTagNameNS("*", d) || []], ce = (o, d) => pt(o, d)[0], pe = (o, d, c = 0) => o?.hasAttribute(d) ? Number(o.getAttribute(d)) : c, Et = (o) => o === "1" || o === "true", wt = (o) => ce(o, "ph"), ai = (o, d, c) => ({ x: c[0] * o + c[2] * d + c[4], y: c[1] * o + c[3] * d + c[5] }), Cn = (o, d) => [o[0] * d[0] + o[2] * d[1], o[1] * d[0] + o[3] * d[1], o[0] * d[2] + o[2] * d[3], o[1] * d[2] + o[3] * d[3], o[0] * d[4] + o[2] * d[5] + o[4], o[1] * d[4] + o[3] * d[5] + o[5]], Mn = [1, 0, 0, 1, 0, 0], He = (o) => o / 9525;
function en(o, d) {
  if (!d || /[\\?#]/.test(d) || /^[a-z]+:/i.test(d)) throw new Error("The presentation contains an invalid internal relationship.");
  const c = d.startsWith("/") ? [] : o.split("/").slice(0, -1);
  for (const s of decodeURIComponent(d).split("/"))
    if (!(!s || s === "."))
      if (s === "..") {
        if (!c.length) throw new Error("A presentation relationship leaves the package.");
        c.pop();
      } else c.push(s);
  return c.join("/");
}
async function si(o, d = "Imported presentation.pptx") {
  if (!(o instanceof ArrayBuffer || o instanceof Uint8Array) || o.byteLength > 100 * 1024 * 1024) throw new Error("Choose a .pptx file smaller than 100 MB.");
  await wo();
  const c = await window.JSZip.loadAsync(o), s = Object.values(c.files);
  if (s.length > 1e4 || s.reduce((W, Q) => W + (Q._data?.uncompressedSize || 0), 0) > 300 * 1024 * 1024) throw new Error("This presentation is too large to import in the browser.");
  const g = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), f = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Set();
  let M = 0;
  const h = (W) => v.add((M ? "Slide " + M + ": " : "") + W);
  async function E(W, Q = !1) {
    if (g.has(W)) return g.get(W);
    const re = c.file(W);
    if (!re) {
      if (Q) throw new Error("The presentation is missing " + W + ".");
      return null;
    }
    if (re._data?.uncompressedSize > 20 * 1024 * 1024) throw new Error("A presentation XML part is too large: " + W);
    const ee = await re.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(ee)) throw new Error("XML document declarations are not supported in PowerPoint imports.");
    const ie = new DOMParser().parseFromString(ee, "application/xml");
    if (ie.getElementsByTagName("parsererror").length) throw new Error("The presentation contains invalid XML: " + W);
    return g.set(W, ie), ie;
  }
  async function I(W) {
    if (m.has(W)) return m.get(W);
    const Q = W.split("/"), re = Q.pop(), ee = await E([...Q, "_rels", re + ".rels"].join("/")), ie = new Map(pt(ee, "Relationship").map((q) => [q.getAttribute("Id"), {
      type: q.getAttribute("Type").split("/").pop(),
      external: q.getAttribute("TargetMode") === "External",
      target: q.getAttribute("Target")
    }]));
    return m.set(W, ie), ie;
  }
  async function y(W, Q) {
    const re = [...(await I(W)).values()].find((ie) => ie.type === Q && !ie.external), ee = re && en(W, re.target);
    return ee ? { path: ee, doc: await E(ee, !0) } : null;
  }
  const u = [...(await I("")).values()].find((W) => W.type === "officeDocument" && !W.external), S = u ? en("", u.target) : "ppt/presentation.xml", C = await E(S, !0);
  if (C.documentElement.namespaceURI !== go) throw new Error("This PowerPoint XML format is not supported. Save it as a standard .pptx file first.");
  const r = ce(C, "sldSz"), F = He(pe(r, "cx")), T = He(pe(r, "cy"));
  if (!(F > 0 && T > 0)) throw new Error("The presentation has invalid slide dimensions.");
  const P = Math.min(1280 / F, 720 / T), k = (1280 - F * P) / 2, x = (720 - T * P) / 2;
  Math.abs(F / T - 16 / 9) > 0.01 && h("Slides were fitted and centred on CList’s 16:9 canvas.");
  const K = [..._(C.documentElement, "sldIdLst")?.children || []];
  if (!K.length || K.length > 500) throw new Error("Import supports presentations containing 1–500 slides.");
  ce(C, "custShowLst") && h("Custom slide shows were not imported.");
  const Z = [], ne = await I(S);
  for (const W of K) {
    let ge = function(w, A = "#000000") {
      if (!w) return A;
      const X = w.localName === "srgbClr" || w.localName === "schemeClr" || w.localName === "sysClr" ? w : [...w.children || []].find((H) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(H.localName));
      if (!X)
        return h("An unsupported colour was replaced."), A;
      let de = X.localName === "schemeClr" ? se[Ee[X.getAttribute("val")] || X.getAttribute("val")] : X.localName === "sysClr" ? X.getAttribute("lastClr") : X.getAttribute("val");
      if (!/^[a-f0-9]{6}$/i.test(de || ""))
        return h("An unsupported colour was replaced."), A;
      let Y = [0, 2, 4].map((H) => parseInt(de.slice(H, H + 2), 16));
      for (const H of X.children) {
        const be = pe(H, "val") / 1e5;
        H.localName === "tint" ? Y = Y.map((xe) => xe + (255 - xe) * be) : ["shade", "lumMod"].includes(H.localName) ? Y = Y.map((xe) => xe * be) : H.localName === "lumOff" ? Y = Y.map((xe) => xe + 255 * be) : H.localName === "alpha" && be !== 1 && be !== 0 ? h("Transparency was simplified; image transparency is preserved.") : ["alpha"].includes(H.localName) || h("Some theme colour adjustments were simplified.");
      }
      return "#" + Y.map((H) => Math.round(Math.max(0, Math.min(255, H))).toString(16).padStart(2, "0")).join("");
    }, V = function(w, A) {
      const X = wt(w);
      if (!X || !A) return null;
      const de = pt(A, "sp").filter((Y) => wt(Y));
      return de.find((Y) => (wt(Y).getAttribute("idx") || "0") === (X.getAttribute("idx") || "0")) || de.find((Y) => (wt(Y).getAttribute("type") || "obj") === (X.getAttribute("type") || "obj"));
    }, Ue = function(w) {
      const A = V(w, ie?.doc);
      return [w, A, V(A || w, q?.doc)].filter(Boolean);
    }, at = function(w) {
      const A = w.map((J) => _(J, "spPr")).filter(Boolean), X = A.map((J) => [...J.children].find((ve) => ["solidFill", "noFill", "gradFill", "pattFill", "blipFill", "grpFill"].includes(ve.localName))).find(Boolean);
      X && !["solidFill", "noFill"].includes(X.localName) && h("A non-solid shape fill was simplified.");
      const de = w.map((J) => ce(_(J, "style"), "fillRef")).find(Boolean), Y = A.map((J) => _(J, "ln")).find(Boolean), H = w.map((J) => ce(_(J, "style"), "lnRef")).find(Boolean), be = ge(X?.localName === "solidFill" ? X : de, "#51b158"), xe = ge(_(Y, "solidFill") || H, "#000000"), Ae = He(pe(Y, "w", 12700)) * P;
      return _(Y, "prstDash")?.getAttribute("val") && _(Y, "prstDash").getAttribute("val") !== "solid" && h("Dashed shape borders were imported as solid lines."), (_(Y, "headEnd")?.getAttribute("type") !== void 0 && _(Y, "headEnd").getAttribute("type") !== "none" || _(Y, "tailEnd")?.getAttribute("type") !== void 0 && _(Y, "tailEnd").getAttribute("type") !== "none") && h("Line arrowheads were not imported."), {
        fillEnabled: X ? X.localName !== "noFill" && !pt(X, "alpha").some((J) => pe(J, "val") === 0) : !!de && pe(de, "idx") !== 0,
        fillColour: be,
        borderEnabled: Y ? !_(Y, "noFill") && !pt(Y, "alpha").some((J) => pe(J, "val") === 0) : !!H && pe(H, "idx") !== 0,
        borderColour: xe,
        borderWidth: Math.max(1, Math.min(20, Ae))
      };
    }, st = function(w, A, X = [w]) {
      const de = X.map((oe) => _(_(oe, "spPr"), "xfrm")).find(Boolean);
      if (!de)
        return h("An object without a usable position was skipped."), null;
      const Y = _(de, "off"), H = _(de, "ext"), be = He(pe(Y, "x")), xe = He(pe(Y, "y")), Ae = He(pe(H, "cx")), J = He(pe(H, "cy"));
      if (![be, xe, Ae, J].every(Number.isFinite) || Ae < 0 || J < 0) throw new Error("Slide " + M + " contains an invalid object position.");
      const ve = pe(de, "rot") / 6e4 * Math.PI / 180, Ne = [Math.cos(ve), Math.sin(ve), -Math.sin(ve), Math.cos(ve), 0, 0], D = Cn(A, Ne), Se = ai(be + Ae / 2, xe + J / 2, A), N = Math.max(1, Ae * Math.hypot(D[0], D[1]) * P), ae = Math.max(1, J * Math.hypot(D[2], D[3]) * P);
      return Math.abs(D[0] * D[2] + D[1] * D[3]) > 1e-3 && h("A rotated object in a stretched group was approximated."), {
        x: Se.x * P + k - N / 2,
        y: Se.y * P + x - ae / 2,
        width: N,
        height: ae,
        rotation: Math.atan2(D[1], D[0]) * 180 / Math.PI,
        flipH: Et(de.getAttribute("flipH")) !== A[0] * A[3] - A[1] * A[2] < 0,
        flipV: Et(de.getAttribute("flipV"))
      };
    }, We = function(w, A, X, de) {
      const Y = _(w, "txBody");
      if (!Y) return null;
      const H = wt(w)?.getAttribute("type") || "body", be = ce(q?.doc, "txStyles"), xe = _(be, ["title", "ctrTitle"].includes(H) ? "titleStyle" : ["body", "obj"].includes(H) ? "bodyStyle" : "otherStyle"), Ae = (ae) => ce(ce(R?.doc, ae === "major" ? "majorFont" : "minorFont"), "latin")?.getAttribute("typeface") || "Arial";
      let J = null;
      const ve = { arial: "arial", "arial narrow": "arial", calibri: "system", aptos: "system", "aptos display": "system", "times new roman": "times", verdana: "verdana", georgia: "georgia", "courier new": "courier" }, Ne = [], D = _(Y, "bodyPr");
      D?.getAttribute("vert") && D.getAttribute("vert") !== "horz" && h("Vertical text was imported horizontally."), D?.getAttribute("anchor") && D.getAttribute("anchor") !== "t" && h("Vertically aligned text was moved to the top of its text box."), (X.flipH || X.flipV) && h("Mirrored text was imported without mirroring."), ["lIns", "rIns", "tIns", "bIns"].some((ae, oe) => D?.hasAttribute(ae) && Math.abs(He(pe(D, ae)) * P - (oe < 2 ? 8 : 5)) > 1) && h("Text box padding was replaced with CList’s standard padding.");
      for (const ae of [...Y.children].filter((oe) => oe.localName === "p")) {
        const oe = _(ae, "pPr"), Ce = Math.max(0, Math.min(8, pe(oe, "lvl"))), Ie = A.map((Me) => _(ce(Me, "lstStyle"), "lvl" + (Ce + 1) + "pPr")).filter(Boolean), Je = [_(oe, "defRPr"), ...Ie.map((Me) => _(Me, "defRPr")), _(_(xe, "lvl" + (Ce + 1) + "pPr"), "defRPr")].filter(Boolean), Xe = [oe, ...Ie, _(xe, "lvl" + (Ce + 1) + "pPr")].filter(Boolean), tt = Xe.map((Me) => Me.getAttribute("algn")).find(Boolean) || "l", gt = { l: "left", ctr: "center", r: "right", just: "justify" }[tt] || "left";
        ["l", "ctr", "r", "just"].includes(tt) || h("An unsupported paragraph alignment was replaced with left alignment."), oe && (pe(oe, "marL") || pe(oe, "marR") || pe(oe, "indent") || _(oe, "tabLst") || _(oe, "spcBef") || _(oe, "lnSpc") || _(oe, "spcAft")) && h("Paragraph spacing, indents or tab stops were replaced with CList’s standard text layout.");
        const ct = [];
        for (const Me of ae.children) {
          if (Me.localName === "br") {
            ct.push({ type: "hardBreak" });
            continue;
          }
          if (!["r", "fld"].includes(Me.localName)) continue;
          Me.localName === "fld" && h("Dynamic text fields were converted to plain text.");
          const $e = _(Me, "t")?.textContent || "";
          if (!$e) continue;
          const et = [_(Me, "rPr"), ...Je].filter(Boolean), $ = (Pe, on) => et.find((ut) => ut.hasAttribute(Pe))?.getAttribute(Pe) ?? on;
          let Te = et.map((Pe) => _(Pe, "latin")?.getAttribute("typeface")).find(Boolean) || "+mn-lt";
          /^\+mj/.test(Te) && (Te = Ae("major")), /^\+mn/.test(Te) && (Te = Ae("minor"));
          const dt = ve[Te.toLowerCase()] || "arial";
          (!ve[Te.toLowerCase()] || dt === "system") && h("Font “" + Te + "” was replaced with a CList font.");
          const Re = Number($("sz", 2400)) / 100 / 0.75 * P;
          if (!Number.isFinite(Re) || Re <= 0) throw new Error("Slide " + M + " has an invalid text size.");
          const xt = { fontSize: Math.max(8, Math.min(200, Re)), fontFamily: dt, textColour: ge(et.map((Pe) => _(Pe, "solidFill")).find(Boolean), "#000000"), textAlign: gt };
          J ? JSON.stringify(J) !== JSON.stringify(xt) && h("Mixed font sizes, fonts, colours or alignment within a text box were simplified to its first text style.") : J = xt, (Re < 8 || Re > 200) && h("A text size was adjusted to CList’s 8–200 pixel range.");
          const ht = [];
          Et($("b", "0")) && ht.push({ type: "bold" }), Et($("i", "0")) && ht.push({ type: "italic" }), $("u", "none") !== "none" && ht.push({ type: "underline" }), $("strike", "noStrike") !== "noStrike" && ht.push({ type: "strike" }), Number($("baseline", 0)) && h("Superscript or subscript text was imported on the baseline.");
          const mt = et.map((Pe) => _(Pe, "hlinkClick")).find(Boolean);
          if (mt) {
            const Pe = de.get(mt.getAttributeNS(Sn, "id"));
            Pe?.external && /^(https?:|mailto:|tel:)/i.test(Pe.target) ? ht.push({ type: "link", attrs: { href: Pe.target } }) : h("An internal or unsupported hyperlink was removed.");
          }
          ct.push({ type: "text", text: $e, marks: ht });
        }
        const Ye = Xe.map((Me) => [...Me.children].find(($e) => ["buNone", "buChar", "buAutoNum", "buBlip"].includes($e.localName))).find(Boolean);
        Ye?.localName === "buBlip" && h("Picture bullets were replaced with standard bullets."), Ye?.localName === "buAutoNum" && Ye.getAttribute("type") !== "arabicPeriod" && h("A numbering style was replaced with decimal numbering."), Ne.push({ type: "paragraph", content: ct, list: Ye && Ye.localName !== "buNone" ? { type: Ye.localName === "buAutoNum" ? "orderedList" : "bulletList", level: Ce, start: pe(Ye, "startAt", 1) } : null });
      }
      const Se = [], N = [];
      for (const ae of Ne) {
        const { list: oe, ...Ce } = ae;
        if (!oe) {
          N.length = 0, Se.push(Ce);
          continue;
        }
        const Ie = Math.min(oe.level, N.length);
        if (N.length = Math.min(N.length, Ie + 1), !N[Ie] || N[Ie].type !== oe.type) {
          const Je = { type: oe.type, ...oe.type === "orderedList" ? { attrs: { start: oe.start } } : {}, content: [] };
          Ie && N[Ie - 1]?.content.length ? N[Ie - 1].content.at(-1).content.push(Je) : Se.push(Je), N[Ie] = Je;
        }
        N[Ie].content.push({ type: "listItem", content: [Ce] });
      }
      return { kind: "text", ...J || { fontSize: 32, fontFamily: "arial", textColour: "#000000", textAlign: "left" }, text: Se };
    }, ft = function(w, A) {
      const X = A.map((be) => _(be, "spPr")).find((be) => _(be, "prstGeom") || _(be, "custGeom")) || _(w, "spPr"), de = _(X, "prstGeom"), Y = de?.getAttribute("prst") || (w.localName === "cxnSp" ? "line" : "rect");
      if (_(X, "custGeom"))
        return h("A custom vector shape was skipped."), null;
      ce(de, "gd") && h("Custom adjustments to a preset shape were simplified.");
      const H = {
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
      return H[Y] ? { id: "pptx-" + Y.toLowerCase(), label: Y, width: 100, height: 100, defaults: {}, viewBox: [0, 0, 1e3, 1e3], elements: [H[Y]] } : (h("Unsupported shape “" + Y + "” was skipped; any text was retained."), null);
    };
    M++;
    const Q = ne.get(W.getAttributeNS(Sn, "id"));
    if (!Q || Q.external || Q.type !== "slide") throw new Error("Slide " + M + " has no valid slide relationship.");
    const re = en(S, Q.target), ee = await E(re, !0), ie = await y(re, "slideLayout"), q = ie && await y(ie.path, "slideMaster"), R = q && await y(q.path, "theme"), se = { dk1: "000000", lt1: "FFFFFF", dk2: "1F497D", lt2: "EEECE1", accent1: "4F81BD", accent2: "C0504D", hlink: "0000FF", folHlink: "800080" };
    for (const w of ce(R?.doc, "clrScheme")?.children || []) se[w.localName] = w.firstElementChild?.getAttribute("lastClr") || w.firstElementChild?.getAttribute("val") || se[w.localName];
    const Ee = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    for (const w of [ce(q?.doc, "clrMap"), ce(ie?.doc, "overrideClrMapping"), ce(ee, "overrideClrMapping")]) for (const A of w?.attributes || []) Ee[A.name] = A.value;
    async function qe(w, A, X) {
      const de = _(w, "blip"), Y = (await I(A)).get(de?.getAttributeNS(Sn, "embed"));
      if (!Y || Y.external || Y.type !== "image")
        return h("A linked or missing picture was skipped; no external images were fetched."), null;
      const H = en(A, Y.target), be = H.split(".").pop().toLowerCase(), xe = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[be];
      if (!xe)
        return h("A picture in unsupported format ." + be + " was skipped."), null;
      if (!f.has(H)) {
        const ae = c.file(H);
        if (!ae) throw new Error("A presentation picture is missing: " + H);
        f.set(H, "data:" + xe + ";base64," + await ae.async("base64"));
      }
      let Ae = f.get(H);
      const J = new Image();
      await new Promise((ae, oe) => {
        J.onload = ae, J.onerror = () => oe(new Error("Slide " + M + " contains an image the browser could not read.")), J.src = Ae;
      });
      const ve = _(w, "srcRect"), Ne = pe(ve, "l") / 1e5, D = pe(ve, "t") / 1e5, Se = pe(ve, "r") / 1e5, N = pe(ve, "b") / 1e5;
      if (Ne + Se >= 1 || D + N >= 1 || ![Ne, D, Se, N].every(Number.isFinite)) throw new Error("Slide " + M + " contains invalid image cropping.");
      if (Ne || D || Se || N || X.flipH || X.flipV || Math.abs(J.naturalWidth / J.naturalHeight - X.width / X.height) > 1e-3) {
        const ae = document.createElement("canvas"), oe = Math.min(2, 4096 / Math.max(X.width, X.height));
        ae.width = Math.max(1, Math.round(X.width * oe)), ae.height = Math.max(1, Math.round(X.height * oe));
        const Ce = ae.getContext("2d");
        if (!Ce) throw new Error("The browser could not prepare an imported image.");
        Ce.translate(X.flipH ? ae.width : 0, X.flipV ? ae.height : 0), Ce.scale(X.flipH ? -1 : 1, X.flipV ? -1 : 1), Ce.drawImage(J, Ne * J.naturalWidth, D * J.naturalHeight, (1 - Ne - Se) * J.naturalWidth, (1 - D - N) * J.naturalHeight, 0, 0, ae.width, ae.height), Ae = ae.toDataURL("image/png");
      }
      return de?.children.length && h("Picture effects and SVG-specific extensions were not imported; the embedded raster picture was used."), (_(w, "tile") || [...ce(w, "fillRect")?.attributes || []].some((ae) => Number(ae.value))) && h("Picture tiling or fill offsets were simplified."), { kind: "image", source: Ae, alt: "", imageFit: "contain", imageRatio: X.width / X.height, keepAspectRatio: !0, aspectRatio: X.width / X.height };
    }
    const Fe = { background: "#ffffff", notes: "", objects: [] };
    async function Ge(w, A, X = Mn, de = !1) {
      if (!w) return;
      const Y = await I(A);
      for (const H of w?.children || []) {
        if (["nvGrpSpPr", "grpSpPr", "extLst"].includes(H.localName)) continue;
        if (H.namespaceURI !== go) {
          h("An extension object was skipped.");
          continue;
        }
        if (H.localName === "grpSp") {
          const N = _(_(H, "grpSpPr"), "xfrm"), ae = _(N, "off"), oe = _(N, "ext"), Ce = _(N, "chOff"), Ie = _(N, "chExt"), Je = pe(oe, "cx") / pe(Ie, "cx"), Xe = pe(oe, "cy") / pe(Ie, "cy");
          if (!Number.isFinite(Je) || !Number.isFinite(Xe)) {
            h("A group with invalid dimensions was skipped.");
            continue;
          }
          const tt = He(pe(ae, "x")), gt = He(pe(ae, "y")), ct = He(pe(oe, "cx")), Ye = He(pe(oe, "cy")), Me = tt + ct / 2, $e = gt + Ye / 2, et = pe(N, "rot") / 6e4 * Math.PI / 180, $ = Math.cos(et), Te = Math.sin(et), dt = Et(N.getAttribute("flipH")) ? -1 : 1, Re = Et(N.getAttribute("flipV")) ? -1 : 1, xt = Cn([$ * dt, Te * dt, -Te * Re, $ * Re, Me, $e], [Je, 0, 0, Xe, tt - Me - He(pe(Ce, "x")) * Je, gt - $e - He(pe(Ce, "y")) * Xe]);
          h("Grouped objects were imported as individual editable objects."), await Ge(H, A, Cn(X, xt), de);
          continue;
        }
        if (!["sp", "pic", "cxnSp"].includes(H.localName)) {
          h((H.localName === "graphicFrame" ? "A chart, table or SmartArt object" : "Unsupported object “" + H.localName + "”") + " was skipped.");
          continue;
        }
        if (H.localName === "cxnSp" && (ce(H, "stCxn") || ce(H, "endCxn")) && h("An attached connector was imported as an ordinary line."), de && wt(H)) {
          ["ftr", "hdr", "dt", "sldNum"].includes(wt(H).getAttribute("type")) && pt(H, "t").some((N) => N.textContent.trim()) && h("Template footer, header, date or slide-number placeholders were not imported.");
          continue;
        }
        if (Et(ce(H, "cNvPr")?.getAttribute("hidden"))) {
          h("A hidden object was skipped.");
          continue;
        }
        const be = de ? [H] : Ue(H), xe = st(H, X, be);
        if (!xe) continue;
        const { flipH: Ae, flipV: J, ...ve } = xe, Ne = at(be);
        if ((ce(H, "effectLst")?.children.length || ce(H, "effectDag") || ce(H, "scene3d") || ce(H, "sp3d")) && h("Shadows, 3D or other visual effects were not imported."), H.localName === "pic") {
          const N = await qe(_(H, "blipFill"), A, xe);
          if (N) {
            N.alt = ce(H, "cNvPr")?.getAttribute("descr") || ce(H, "cNvPr")?.getAttribute("name") || "";
            const ae = ce(_(H, "spPr"), "prstGeom")?.getAttribute("prst");
            ae && ae !== "rect" && h("A picture shape mask was replaced with a rectangular image."), Fe.objects.push({ ...ve, ...N });
          }
          continue;
        }
        const D = We(H, be, xe, Y), Se = ft(H, be);
        if (Se && (Ne.fillEnabled || Ne.borderEnabled)) {
          if ((Ae || J) && !["rect", "ellipse", "roundRect"].includes(Se.label)) {
            const [N] = Se.elements;
            N.tag === "line" ? (Ae && ([N.attributes.x1, N.attributes.x2] = [N.attributes.x2, N.attributes.x1]), J && ([N.attributes.y1, N.attributes.y2] = [N.attributes.y2, N.attributes.y1])) : N.tag === "polygon" && (N.attributes.points = N.attributes.points.split(" ").map((ae) => {
              const [oe, Ce] = ae.split(",").map(Number);
              return (Ae ? 1e3 - oe : oe) + "," + (J ? 1e3 - Ce : Ce);
            }).join(" "));
          }
          Fe.objects.push({ ...ve, ...Ne, kind: "shape", shapeDefinition: Se, shapeType: Se.id });
        }
        D && Fe.objects.push({ ...ve, ...D, fillEnabled: !1, borderEnabled: !1 });
      }
    }
    const lt = [ce(ee, "bg"), ce(ie?.doc, "bg"), ce(q?.doc, "bg")].find(Boolean);
    if (lt) {
      const w = _(lt, "bgPr"), A = _(w, "solidFill") || _(lt, "bgRef");
      if (A) Fe.background = ge(A, "#ffffff");
      else if (_(w, "blipFill")) {
        const X = ce(ee, "bg") ? re : ce(ie?.doc, "bg") ? ie.path : q.path, de = { x: k, y: x, width: F * P, height: T * P }, Y = await qe(_(w, "blipFill"), X, de);
        Y && Fe.objects.push({ ...de, ...Y });
      } else _(w, "noFill") || h("An unsupported slide background was replaced with white.");
    }
    ee.documentElement.getAttribute("showMasterSp") !== "0" && ie?.doc.documentElement.getAttribute("showMasterSp") !== "0" && await Ge(ce(q?.doc, "spTree"), q?.path, Mn, !0), await Ge(ce(ie?.doc, "spTree"), ie?.path, Mn, !0), await Ge(ce(ee, "spTree"), re);
    const O = await y(re, "notesSlide");
    O && (Fe.notes = pt(O.doc, "sp").filter((w) => !["sldImg", "sldNum", "hdr", "ftr", "dt"].includes(wt(w)?.getAttribute("type"))).map((w) => pt(_(w, "txBody"), "p").map((A) => pt(A, "t").map((X) => X.textContent).join("")).join(`
`)).filter(Boolean).join(`
`)), O && (ce(O.doc, "pic") || ce(O.doc, "graphicFrame")) && h("Images or other non-text content in speaker notes were not imported."), (ce(ee, "timing") || ce(ee, "transition")) && h("Animations and slide transitions were not imported."), ee.documentElement.getAttribute("show") === "0" && h("This hidden slide was imported as a visible slide.");
    const fe = await I(re);
    for (const w of fe.values()) ["chart", "diagramData", "oleObject", "audio", "video", "media", "comments", "comment"].includes(w.type) && h("Charts, SmartArt, embedded files, media or comments are not supported.");
    if (Fe.objects.length > 5e3 || Z.reduce((w, A) => w + A.objects.length, 0) + Fe.objects.length > 2e4) throw new Error("This presentation contains too many objects to import in the browser.");
    Z.push(Fe);
  }
  return { title: d.replace(/\.pptx$/i, ""), slides: Z, warnings: [...v] };
}
function li({ getDocument: o, encode: d, getName: c, onError: s = () => {
}, createWorker: g = () => new Worker(new URL(
  /* @vite-ignore */
  "" + new URL("assets/recovery-worker-Dt1l0aQJ.js", import.meta.url).href,
  import.meta.url
), { type: "module" }) }) {
  let m = null, f = null, v = 0, M = !1;
  const h = /* @__PURE__ */ new Map();
  function E(L) {
    const u = !h.size && !M;
    m?.terminate(), m = null, f = null;
    for (const S of h.values()) S.reject(L);
    h.clear(), u && s(L);
  }
  function I(L) {
    if (!(!m || f !== o()) && L instanceof Uint8Array)
      try {
        m.postMessage({ type: "update", update: L });
      } catch (u) {
        E(u);
      }
  }
  function y() {
    return new Promise((L, u) => {
      try {
        if (M) throw new Error("The recovery snapshot worker is closed.");
        m || (m = g(), m.onmessage = ({ data: r }) => {
          if (r.error) {
            E(new Error(r.error));
            return;
          }
          const F = h.get(r.id);
          F && (h.delete(r.id), F.resolve(r.content));
        }, m.onerror = () => E(new Error("The background recovery worker could not run. Reload CList and use Save to protect your presentation.")), m.onmessageerror = () => E(new Error("The background recovery snapshot could not be read.")));
        const S = o();
        f !== S && (m.postMessage({ type: "reset", update: d(S) }), f = S);
        const C = ++v;
        h.set(C, { resolve: L, reject: u }), m.postMessage({ type: "snapshot", id: C, name: c() });
      } catch (S) {
        E(S), u(S);
      }
    });
  }
  return { changed: I, snapshot: y, destroy() {
    M = !0, E(new Error("The slide editor closed before recovery finished."));
  } };
}
function ci(o, d, c) {
  const s = [...o], g = new Set(d), m = c < 0 ? s.map((f, v) => v) : s.map((f, v) => v).reverse();
  for (const f of m) {
    const v = f + c;
    v >= 0 && v < s.length && g.has(s[f]) && !g.has(s[v]) && ([s[f], s[v]] = [s[v], s[f]]);
  }
  return s;
}
function di(o, d, c) {
  const s = new Set(d);
  if (c && (!o.includes(c) || s.has(c))) return [...o];
  const g = o.filter((f) => s.has(f)), m = o.filter((f) => !s.has(f));
  return m.splice(c ? m.indexOf(c) : m.length, 0, ...g), m;
}
function ui(o, d, c, { matchCase: s = !1, wholeWord: g = !1 } = {}) {
  if (!c) return [];
  const m = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), f = new RegExp(g ? "(?<![\\p{L}\\p{N}_])" + m + "(?![\\p{L}\\p{N}_])" : m, s ? "gu" : "giu"), v = [];
  for (const [M, h] of d.entries()) {
    let E = function(y, L) {
      if (y instanceof o.XmlText) {
        const S = y.toDelta().map((C) => typeof C.insert == "string" ? C.insert : "￼").join("");
        f.lastIndex = 0;
        for (const C of S.matchAll(f)) v.push({
          entry: h,
          order: M,
          text: y,
          start: C.index,
          length: C[0].length,
          from: L + C.index,
          to: L + C.index + C[0].length,
          snippet: S.slice(Math.max(0, C.index - 25), C.index + C[0].length + 40).replace(/\s+/g, " ")
        });
        return y.length;
      }
      if (["hardBreak", "horizontalRule"].includes(y.nodeName)) return 1;
      let u = 1;
      for (const S of y.toArray()) u += E(S, L + u);
      return u + 1;
    }, I = 0;
    for (const y of h.fragment.toArray()) I += E(y, I);
  }
  return v;
}
function ho(o, d) {
  const c = /* @__PURE__ */ new Map();
  for (const s of o)
    c.has(s.text) || c.set(s.text, []), c.get(s.text).push(s);
  for (const [s, g] of c)
    for (const m of g.sort((f, v) => v.start - f.start)) {
      let f = 0, v = {};
      for (const M of s.toDelta()) {
        const h = typeof M.insert == "string" ? M.insert.length : 1;
        if (m.start < f + h) {
          v = M.attributes || {};
          break;
        }
        f += h;
      }
      s.delete(m.start, m.length), d && s.insert(m.start, d, v);
    }
}
function pi({ root: o, Y: d, getDocument: c, getEntries: s, jump: g, transact: m, canEdit: f, selectedText: v, report: M, onError: h }) {
  const E = o.querySelector(".inspector"), I = o.querySelector(".tools"), y = document.createElement("button");
  y.className = "clist-action-btn btn-small", y.type = "button", y.dataset.control = "open-find", y.title = "Find and replace across slides (Ctrl/Cmd+F)", y.setAttribute("aria-label", y.title);
  const L = document.createElement("span");
  L.className = "material-icons md-18 md-light", L.textContent = "search", y.append(L), I.append(y);
  const u = document.createElement("details");
  u.className = "control-section", u.dataset.panel = "find";
  const S = document.createElement("summary");
  S.textContent = "Find and replace";
  const C = document.createElement("div");
  C.className = "control-section-body", u.append(S, C), E.prepend(u);
  function r(O, fe, w) {
    const A = document.createElement("label"), X = document.createElement("input");
    return X.type = fe, X.dataset.control = w, X.title = O, fe !== "checkbox" && (X.maxLength = 512, X.autocomplete = "off"), A.append(document.createTextNode(O), X), C.append(A), X;
  }
  const F = r("Find in slide text", "search", "find-query"), T = r("Replace with", "text", "find-replacement"), P = r("Match case", "checkbox", "find-case"), k = r("Whole words", "checkbox", "find-word"), x = document.createElement("div");
  x.className = "object-alignment", C.append(x);
  const K = document.createElement("p");
  K.className = "helper", K.setAttribute("role", "status"), C.append(K);
  const Z = document.createElement("div");
  Z.className = "object-list", Z.dataset.control = "find-results", Z.setAttribute("aria-label", "Matching slide text"), C.append(Z);
  const ne = document.createElement("p");
  ne.className = "helper", ne.textContent = "Searches text boxes on all slides. Locked boxes can be found but are not replaced. Enter/F3 finds next; Shift+F3 finds previous.", C.append(ne);
  let W = [], Q = -1, re = null, ee = null, ie = !1;
  function q(O) {
    return () => {
      try {
        O();
      } catch (fe) {
        h(fe);
      }
    };
  }
  function R(O, fe, w) {
    const A = document.createElement("button");
    return A.type = "button", A.className = "btn btn-small", A.textContent = O, A.title = O, A.dataset.control = fe, A.addEventListener("click", q(w)), x.append(A), A;
  }
  function se(O) {
    re = O ? d.createRelativePositionFromTypeIndex(O.text, O.start) : null;
  }
  function Ee() {
    K.textContent = F.value ? W.length ? (Q >= 0 ? Q + 1 + " of " : "") + W.length + " matches" + (Q >= 0 ? " · Slide " + W[Q].entry.slideNumber : "") : "No matches." : "Enter text to search.", qe.disabled = We.disabled = !W.length || !f(), ft.disabled = Q < 0 || !W[Q] || W[Q].entry.locked || !f(), Fe.disabled = !W.some((O) => !O.entry.locked) || !f(), Z.replaceChildren();
    for (const [O, fe] of W.slice(0, 100).entries()) {
      const w = document.createElement("button");
      w.type = "button", w.className = "btn btn-small", w.textContent = "Slide " + fe.entry.slideNumber + (fe.entry.locked ? " (locked)" : "") + ": " + fe.snippet, w.title = w.textContent, w.setAttribute("aria-pressed", String(O === Q)), w.addEventListener("click", q(() => {
        ge();
        const A = W.findIndex((X) => X.text === fe.text && X.start === fe.start);
        A >= 0 && V(A);
      })), Z.append(w);
    }
    W.length > 100 && (K.textContent += ". First 100 results shown; Next/Previous visit all matches.");
  }
  function ge(O = !1) {
    clearTimeout(ee), ee = null;
    const fe = !O && re ? d.createAbsolutePositionFromRelativePosition(re, c()) : null;
    W = ui(d, s(), F.value, { matchCase: P.checked, wholeWord: k.checked }), Q = fe ? W.findIndex((w) => w.text === fe.type && w.start === fe.index) : -1, Q < 0 && (re = null), Ee();
  }
  function V(O) {
    !f() || !W.length || (Q = (O + W.length) % W.length, se(W[Q]), g(W[Q]), u.open = !0, Ee());
  }
  function Ue(O) {
    ge(), V(Q < 0 ? O > 0 ? 0 : W.length - 1 : Q + O);
  }
  function at() {
    if (ge(), !f() || Q < 0 || W[Q].entry.locked) return;
    const O = W[Q], fe = O.from + T.value.length;
    m([O], () => ho([O], T.value)), ge(!0);
    const w = W.findIndex((A) => A.order > O.order || A.order === O.order && A.from >= fe);
    W.length && V(w < 0 ? 0 : w), M("Replaced one match.");
  }
  function st() {
    if (ge(), !f()) return;
    const O = W.filter((w) => !w.entry.locked), fe = W.length - O.length;
    O.length && (m(O, () => ho(O, T.value)), ge(!0), M("Replaced " + O.length + " matches." + (fe ? " Skipped " + fe + " matches in locked text boxes." : "")));
  }
  const qe = R("Previous", "find-previous", () => Ue(-1)), We = R("Next", "find-next", () => Ue(1)), ft = R("Replace", "find-replace", at), Fe = R("Replace all", "find-replace-all", st);
  function Ge(O = !1) {
    if (!f()) return;
    for (const w of E.querySelectorAll(":scope > .control-section")) w.open = w === u;
    const fe = v();
    fe && fe.length <= 512 && !fe.includes(`
`) && (F.value = fe), u.open = !0, ge(!0), u.scrollIntoView({ block: "nearest" }), (O ? T : F).focus(), (O ? T : F).select();
  }
  y.addEventListener("click", q(() => Ge())), u.addEventListener("toggle", q(() => {
    u.open && ge();
  })), F.addEventListener("input", q(() => {
    re = null, clearTimeout(ee), ee = setTimeout(q(() => ge(!0)), 150);
  }));
  for (const O of [P, k]) O.addEventListener("change", q(() => ge(!0)));
  function lt(O) {
    (O.ctrlKey || O.metaKey) && !O.altKey && ["f", "h"].includes(O.key.toLowerCase()) && f() ? (O.preventDefault(), O.stopImmediatePropagation(), q(() => Ge(O.key.toLowerCase() === "h"))()) : O.key === "F3" && u.open && F.value && f() ? (O.preventDefault(), O.stopImmediatePropagation(), q(() => Ue(O.shiftKey ? -1 : 1))()) : u.contains(O.target) && (O.key === "Escape" ? (O.preventDefault(), O.stopImmediatePropagation(), u.open = !1, y.focus()) : O.key === "Enter" && [F, T].includes(O.target) && (O.preventDefault(), O.stopImmediatePropagation(), q(() => O.target === F ? Ue(O.shiftKey ? -1 : 1) : at())()));
  }
  return o.addEventListener("keydown", lt, !0), Ee(), {
    isOpen: () => u.open,
    changed() {
      !ie && u.open && F.value && (clearTimeout(ee), ee = setTimeout(q(() => ge()), 150));
    },
    presenting(O) {
      y.disabled = O, O && (u.open = !1);
    },
    destroy() {
      ie = !0, clearTimeout(ee), o.removeEventListener("keydown", lt, !0), u.remove(), y.remove();
    }
  };
}
const fi = `
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
function gi() {
  const o = [...document.querySelectorAll(".stage > .slide")], d = document.querySelector('[data-action="previous"]'), c = document.querySelector('[data-action="next"]'), s = document.querySelector('[data-action="fullscreen"]'), g = document.querySelector("output"), m = document.querySelector(".viewer-status");
  let f = 0, v;
  function M(E) {
    f = Math.max(0, Math.min(o.length - 1, E)), o.forEach((I, y) => {
      I.hidden = y !== f;
    }), d.disabled = f === 0, c.disabled = f === o.length - 1, g.textContent = f + 1 + " / " + o.length, ["http:", "https:", "file:"].includes(location.protocol) && history.replaceState(null, "", location.href.split("#")[0] + "#slide-" + (f + 1));
  }
  function h() {
    const E = location.hash.match(/^#slide-(\d+)$/);
    return E ? Number(E[1]) - 1 : 0;
  }
  d.addEventListener("click", () => M(f - 1)), c.addEventListener("click", () => M(f + 1)), s.disabled = !document.documentElement.requestFullscreen, s.addEventListener("click", async () => {
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    } catch (E) {
      console.error("Fullscreen failed:", E), m.textContent = "Full screen is unavailable. You can continue viewing in this window.", clearTimeout(v), v = setTimeout(() => {
        m.textContent = "";
      }, 3e3);
    }
  }), document.addEventListener("fullscreenchange", () => {
    s.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  }), window.addEventListener("hashchange", () => M(h())), document.addEventListener("keydown", (E) => {
    E.ctrlKey || E.metaKey || E.altKey || E.isComposing || E.target.closest?.('input,textarea,[contenteditable="true"]') || E.key === " " && E.target.closest?.("button") || ["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(E.key) && (E.preventDefault(), E.key === "Home" ? M(0) : E.key === "End" ? M(o.length - 1) : M(f + (["ArrowRight", "ArrowDown", "PageDown", " "].includes(E.key) ? 1 : -1)));
  }), document.body.classList.add("interactive"), document.querySelector(".controls").hidden = !1, M(h());
}
async function vo({ slideIds: o, renderSlide: d, title: c = "CList presentation" }) {
  if (!o.length) throw new Error("There are no slides to export.");
  const s = document.implementation.createHTMLDocument(c);
  s.documentElement.lang = "en";
  const g = s.createElement("meta");
  g.setAttribute("charset", "utf-8"), s.head.prepend(g);
  const m = s.createElement("meta");
  m.name = "viewport", m.content = "width=device-width, initial-scale=1", s.head.append(m);
  const f = s.createElement("style");
  f.textContent = fi, s.head.append(f);
  const v = s.createElement("main");
  v.className = "stage", v.setAttribute("aria-label", c), s.body.append(v);
  for (const [y, L] of o.entries()) {
    const u = d(L, s);
    u.id = "slide-" + (y + 1), u.setAttribute("role", "group"), u.setAttribute("aria-label", "Slide " + (y + 1) + " of " + o.length), v.append(u);
  }
  const M = s.createElement("nav");
  M.className = "controls", M.hidden = !0, M.setAttribute("aria-label", "Slide navigation");
  for (const [y, L] of [["Previous", "previous"], ["Next", "next"], ["Full screen", "fullscreen"]]) {
    const u = s.createElement("button");
    u.type = "button", u.className = "btn", u.textContent = y, u.title = y, u.dataset.action = L, M.append(u);
  }
  const h = s.createElement("output");
  h.setAttribute("aria-live", "polite"), M.insertBefore(h, M.children[1]), s.body.append(M);
  const E = s.createElement("p");
  E.className = "viewer-status", E.setAttribute("role", "status"), s.body.append(E);
  const I = s.createElement("script");
  return I.textContent = "(" + gi.toString() + ")();", s.body.append(I), await Promise.all([...v.querySelectorAll("img")].map((y) => new Promise((L, u) => {
    const S = y.getAttribute("src") || "";
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(S)) {
      u(new Error("A slide image is missing or is not embedded."));
      return;
    }
    const C = new Image();
    C.onload = L, C.onerror = () => u(new Error("A slide image could not be read.")), C.src = S;
  }))), `<!doctype html>
` + s.documentElement.outerHTML;
}
async function hi(o) {
  const d = await vo(o), c = (o.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".html", s = URL.createObjectURL(new Blob([d], { type: "text/html;charset=utf-8" })), g = document.createElement("a");
  g.href = s, g.download = c, document.body.append(g);
  try {
    g.click();
  } finally {
    g.remove(), setTimeout(() => URL.revokeObjectURL(s), 6e4);
  }
}
async function mi({ slideIds: o, renderSlide: d }) {
  const c = document.implementation.createHTMLDocument(""), s = o.map((I) => d(I, c)), g = c.createElement("div"), m = /* @__PURE__ */ new Set(["p", "strong", "em", "s", "u", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "br"]);
  function f(I) {
    if (I.nodeType === 3) return c.createTextNode(I.textContent);
    const y = I.nodeName.toLowerCase();
    let L;
    /^h[1-6]$/.test(y) ? L = c.createElement("h3") : y === "a" && /^(https?:|mailto:|tel:)/i.test(I.getAttribute("href") || "") ? (L = c.createElement("a"), L.setAttribute("href", I.getAttribute("href"))) : m.has(y) ? L = c.createElement(y) : L = c.createDocumentFragment(), y === "ol" && /^\d+$/.test(I.getAttribute("start") || "") && L.setAttribute("start", I.getAttribute("start"));
    for (const u of I.childNodes) L.append(f(u));
    return L;
  }
  async function v(I) {
    return await new Promise((y, L) => {
      const u = new Image();
      u.onload = () => y(u), u.onerror = () => L(new Error("A slide image could not be read.")), u.src = I;
    });
  }
  function M(I, y) {
    const L = document.createElement("canvas"), u = Math.min(2, 4096 / Math.max(I, y));
    L.width = Math.max(1, Math.round(I * u)), L.height = Math.max(1, Math.round(y * u));
    const S = L.getContext("2d");
    if (!S) throw new Error("The browser could not prepare a slide image.");
    return S.scale(L.width / I, L.height / y), { element: L, context: S };
  }
  function h(I, y, L, u) {
    const S = c.createElement("p"), C = c.createElement("img"), r = Math.min(1, 720 / L);
    C.width = Math.max(1, Math.round(L * r)), C.height = Math.max(1, Math.round(u * r)), C.style.maxWidth = "100%", C.style.height = "auto", C.src = I, C.alt = y, S.append(C), g.append(S);
  }
  async function E(I) {
    const y = I.cloneNode(!0);
    y.style.width = "1280px", y.style.height = "720px";
    for (const T of y.children) {
      const P = parseFloat(T.style.width) * 12.8;
      for (const k of [T, ...T.querySelectorAll("[style]")]) {
        const x = k.closest(".shape-content") ? P / 100 : 12.8;
        k.setAttribute("style", k.getAttribute("style").replace(/([\d.]+)cqw/g, (K, Z) => Number(Z) * x + "px"));
      }
    }
    const L = c.createElement("div"), u = c.createElement("style");
    u.textContent = `
      * {box-sizing:border-box;} .slide {position:relative;overflow:hidden;font-family:Arial,sans-serif;color:#202b3d;}
      .slide-object {position:absolute;} .text-content {width:100%;height:100%;overflow:hidden;padding:5px 8px;}
      .tiptap {font-size:var(--slide-font-size,33.28px);line-height:1.2;}
      p {margin:0 0 8px;} h1 {font-size:1em;} h2 {font-size:24px;} h3 {font-size:20px;}
      ul,ol {margin:0 0 .3em;padding-left:1.5em;} li p {margin-bottom:.2em;}
      .image-content {width:100%;height:100%;overflow:hidden;}
      .image-content img {display:block;width:100%;height:100%;object-fit:contain;}
      .shape-content,.shape-content svg {display:block;width:100%;height:100%;}
    `, L.append(u, y);
    const S = new XMLSerializer().serializeToString(L), C = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">' + S + "</foreignObject></svg>"), r = await v(C), F = M(1280, 720);
    return F.context.drawImage(r, 0, 0, 1280, 720), F.element.toDataURL("image/png");
  }
  for (const [I, y] of s.entries()) {
    const L = c.createElement("h2");
    L.textContent = "Slide " + (I + 1), g.append(L);
    const u = [...y.children].sort((C, r) => parseFloat(C.style.top) - parseFloat(r.style.top) || parseFloat(C.style.left) - parseFloat(r.style.left)), S = !!y.querySelector("svg");
    if (S) {
      const C = u.map((r) => r.querySelector(".tiptap")?.textContent.trim()).filter(Boolean);
      h(await E(y), "Slide " + (I + 1) + " diagram" + (C.length ? ": " + C.join("; ") : ""), 1280, 720);
    }
    for (const C of u) {
      const r = C.querySelector(".text-content .tiptap");
      if (r) {
        for (const Z of r.childNodes) g.append(f(Z));
        continue;
      }
      if (S) continue;
      let F, T;
      const P = C.querySelector("img"), k = C.querySelector("svg");
      let x = parseFloat(C.style.width) * 12.8, K = parseFloat(C.style.height) * 7.2;
      if (P) {
        if (F = P.getAttribute("src") || "", T = P.alt, !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(F)) throw new Error("A slide image is missing or is not embedded.");
        const Z = await v(F);
        if (P.style.position === "absolute") {
          const ne = M(x, K);
          ne.context.drawImage(Z, parseFloat(P.style.left) * 12.8, parseFloat(P.style.top) * 12.8, parseFloat(P.style.width) * 12.8, parseFloat(P.style.height) * 12.8), F = ne.element.toDataURL("image/png");
        } else {
          const ne = Math.min(x / Z.width, K / Z.height);
          x = Z.width * ne, K = Z.height * ne;
        }
      } else if (k) {
        const Z = k.cloneNode(!0);
        Z.setAttribute("width", x), Z.setAttribute("height", K);
        for (const Q of Z.querySelectorAll("[vector-effect]")) {
          const re = parseFloat(Q.style.strokeWidth) * x / 100;
          Q.style.removeProperty("stroke-width"), Q.setAttribute("stroke-width", Number.isFinite(re) ? re : 0);
        }
        const ne = await v("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(Z))), W = M(x, K);
        W.context.drawImage(ne, 0, 0, x, K), F = W.element.toDataURL("image/png"), T = "Diagram on slide " + (I + 1);
      } else continue;
      h(F, T || "Image on slide " + (I + 1), x, K);
    }
    I < s.length - 1 && g.append(c.createElement("hr"));
  }
  return g.innerHTML;
}
const bi = [{ id: "rectangle", label: "Rectangle", width: 320, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } }] }, { id: "circle", label: "Circle", width: 220, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } }] }, { id: "line", label: "Line", width: 360, height: 4, defaults: { fillEnabled: !1, borderEnabled: !0, borderColour: "#202b3d", borderWidth: 4 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } }] }], yi = {
  shapes: bi
}, wi = [{ id: "blank", label: "Blank", objects: [] }, { id: "title", label: "Title", objects: [{ kind: "text", x: 100, y: 260, width: 1080, height: 140, text: "Presentation title", fontSize: 64, textAlign: "center" }] }, { id: "title-body", label: "Title and body", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 1080, height: 400, text: "Add your content here.", fontSize: 32, textAlign: "left" }] }, { id: "two-columns", label: "Two columns", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 500, height: 400, text: "Left column", fontSize: 32, textAlign: "left" }, { kind: "text", x: 680, y: 220, width: 500, height: 400, text: "Right column", fontSize: 32, textAlign: "left" }] }], xi = {
  layouts: wi
}, vi = [{ id: "classic", label: "Classic", fontFamily: "system", fontSize: 33.28, textColour: "#202b3d", background: "#ffffff", fillColour: "#51b158", borderColour: "#202b3d" }, { id: "midnight", label: "Midnight", fontFamily: "arial", fontSize: 33.28, textColour: "#f1f5f9", background: "#142033", fillColour: "#397ab8", borderColour: "#a6caed" }, { id: "paper", label: "Paper", fontFamily: "georgia", fontSize: 33.28, textColour: "#392f28", background: "#fff8e8", fillColour: "#dbb571", borderColour: "#76573a" }, { id: "ocean", label: "Ocean", fontFamily: "verdana", fontSize: 33.28, textColour: "#13354b", background: "#edf8fc", fillColour: "#56b6bd", borderColour: "#216479" }], ki = {
  themes: vi
}, mo = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"]
}, Nn = (o) => typeof o == "string" && /^#[0-9a-f]{6}$/i.test(o), Ct = (o) => typeof o == "number" && Number.isFinite(o);
function ue(o, d) {
  if (!o) throw new Error("Slide catalog: " + d);
}
function jn(o) {
  ue(o && typeof o.id == "string" && /^[a-z][a-z0-9-]{0,79}$/.test(o.id), "invalid entry ID"), ue(typeof o.label == "string" && o.label.trim().length > 0 && o.label.length <= 120, o.id + " needs a label");
}
function ko(o, d) {
  const c = {};
  for (const s of ["fillEnabled", "borderEnabled", "keepAspectRatio", "locked"])
    o[s] !== void 0 && (ue(typeof o[s] == "boolean", d + ": invalid " + s), c[s] = o[s]);
  for (const s of ["fillColour", "borderColour", "textColour"])
    o[s] !== void 0 && (ue(Nn(o[s]), d + ": invalid " + s), c[s] = o[s]);
  for (const [s, g, m] of [["fontSize", 8, 200], ["borderWidth", 1, 20], ["rotation", -180, 180], ["cropX", 0, 100], ["cropY", 0, 100]])
    o[s] !== void 0 && (ue(Ct(o[s]) && o[s] >= g && o[s] <= m, d + ": invalid " + s), c[s] = o[s]);
  for (const [s, g] of [["textAlign", ["left", "center", "right", "justify"]], ["fontFamily", ["system", "arial", "verdana", "georgia", "times", "courier"]], ["imageFit", ["contain", "cover"]]])
    o[s] !== void 0 && (ue(g.includes(o[s]), d + ": invalid " + s), c[s] = o[s]);
  return c;
}
function tn(o) {
  jn(o), ue(Ct(o.width) && o.width > 0 && o.width <= 1280 && Ct(o.height) && o.height > 0 && o.height <= 720, o.id + ": invalid default dimensions"), ue(Array.isArray(o.viewBox) && o.viewBox.length === 4 && o.viewBox.every(Ct) && o.viewBox[2] > 0 && o.viewBox[3] > 0, o.id + ": invalid SVG viewBox"), ue(Array.isArray(o.elements) && o.elements.length > 0 && o.elements.length <= 64, o.id + ": needs 1–64 SVG elements");
  const d = o.elements.map((c) => {
    ue(c && Object.hasOwn(mo, c.tag), o.id + ": unsupported SVG element"), ue(c.attributes && typeof c.attributes == "object", o.id + ": missing SVG attributes");
    const s = {};
    for (const [g, m] of Object.entries(c.attributes))
      ue(mo[c.tag].includes(g), o.id + ": unsupported SVG attribute " + g), g === "d" ? ue(typeof m == "string" && m.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(m), o.id + ": invalid path") : g === "points" ? ue(typeof m == "string" && m.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(m), o.id + ": invalid points") : ue(Ct(m), o.id + ": invalid SVG coordinate"), s[g] = m;
    return { tag: c.tag, attributes: s };
  });
  return { id: o.id, label: o.label, width: o.width, height: o.height, defaults: ko(o.defaults || {}, o.id), viewBox: [...o.viewBox], elements: d };
}
function Ei(o, d) {
  jn(o), ue(Array.isArray(o.objects) && o.objects.length <= 100, o.id + ": invalid objects array"), o.background !== void 0 && ue(Nn(o.background), o.id + ": invalid background"), o.notes !== void 0 && ue(typeof o.notes == "string", o.id + ": invalid notes");
  const c = o.objects.map((s) => {
    ue(s && ["text", "shape", "image"].includes(s.kind), o.id + ": unsupported object kind"), ue(["x", "y", "width", "height"].every((m) => Ct(s[m])) && s.x >= 0 && s.y >= 0 && s.width > 0 && s.height > 0 && s.x + s.width <= 1280 && s.y + s.height <= 720, o.id + ": object is outside the slide");
    const g = { kind: s.kind, x: s.x, y: s.y, width: s.width, height: s.height, ...ko(s, o.id) };
    return s.kind === "text" && (ue(typeof s.text == "string", o.id + ": text object needs text"), g.text = s.text), s.kind === "shape" && (ue(d.has(s.shapeId), o.id + ": unknown shape " + s.shapeId), g.shapeId = s.shapeId), s.kind === "image" && (ue(typeof s.source == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(s.source), o.id + ": image needs embedded image data"), g.source = s.source, g.alt = typeof s.alt == "string" ? s.alt : ""), s.group !== void 0 && (ue(typeof s.group == "string" && s.group.length <= 80, o.id + ": invalid group"), g.group = s.group), g;
  });
  return { id: o.id, label: o.label, objects: c, ...o.background !== void 0 ? { background: o.background } : {}, ...o.notes !== void 0 ? { notes: o.notes } : {} };
}
function Eo(o) {
  jn(o), ue(["system", "arial", "verdana", "georgia", "times", "courier"].includes(o.fontFamily), o.id + ": invalid theme font"), ue(Ct(o.fontSize) && o.fontSize >= 8 && o.fontSize <= 200, o.id + ": invalid theme font size");
  const d = { id: o.id, label: o.label, fontFamily: o.fontFamily, fontSize: o.fontSize };
  for (const c of ["textColour", "background", "fillColour", "borderColour"])
    ue(Nn(o[c]), o.id + ": invalid theme " + c), d[c] = o[c];
  return d;
}
function Ln(o = {}) {
  const d = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), g = o.shapes === void 0 ? yi.shapes : o.shapes, m = o.layouts === void 0 ? xi.layouts : o.layouts;
  ue(Array.isArray(g) && g.length > 0, "shapes must be a nonempty array"), ue(Array.isArray(m) && m.length > 0, "layouts must be a nonempty array");
  for (const v of g) {
    const M = tn(v);
    ue(!d.has(v.id), "duplicate shape ID " + v.id), d.set(v.id, M);
  }
  for (const v of m) {
    const M = Ei(v, d);
    ue(!c.has(v.id), "duplicate layout ID " + v.id), c.set(v.id, M);
  }
  const f = o.themes === void 0 ? ki.themes : o.themes;
  ue(Array.isArray(f) && f.length > 0, "themes must be a nonempty array");
  for (const v of f) {
    const M = Eo(v);
    ue(!s.has(v.id), "duplicate theme ID " + v.id), s.set(v.id, M);
  }
  return { shapes: d, layouts: c, themes: s };
}
async function Si(o) {
  const d = await Promise.all(["shapes", "layouts", "themes"].map(async (s) => {
    const g = await fetch(new URL(s + ".json", o), { cache: "no-cache" });
    if (!g.ok) throw new Error("Could not load slide " + s + " catalog (HTTP " + g.status + ").");
    const m = await g.json();
    return ue(m && m.version === 1, "unsupported " + s + " catalog version"), ue(Array.isArray(m[s]), s + " catalog needs a " + s + " array"), m[s];
  })), c = { shapes: d[0], layouts: d[1], themes: d[2] };
  return Ln(c), c;
}
function Ci(o, d = {}) {
  if (!(o instanceof HTMLElement)) throw new TypeError("A container element is required");
  const { Y: c, Editor: s, StarterKit: g, Collaboration: m, HocuspocusProvider: f, Link: v } = d.dependencies, { shapes: M, layouts: h, themes: E } = Ln(d.catalogs), I = Ln().shapes.values().next().value, y = /* @__PURE__ */ new WeakMap(), L = /* @__PURE__ */ new Map(), u = document.createElement("div");
  u.className = "clist-slides app", u.innerHTML = Uo, o.append(u);
  const S = 1280, C = 720, r = (e) => u.querySelector(`[data-control="${e}"]`);
  for (const e of u.querySelectorAll(".tools button")) po(e);
  for (const e of M.values()) {
    const t = document.createElement("button");
    t.className = "btn-small", t.dataset.control = "add-" + e.id, t.title = "Add " + e.label, po(t, e), t.addEventListener("click", () => $n(e.id)), r("shape-tools").append(t);
  }
  for (const e of h.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, r("slide-layout").append(t);
  }
  const F = r("slide"), T = document.createElement("div"), P = document.createElement("div");
  T.className = "alignment-guide vertical", P.className = "alignment-guide horizontal", T.hidden = P.hidden = !0, F.append(T, P);
  let k = new c.Doc(), x = k.getMap("slide-objects"), K = k.getMap("slide-pages"), Z = k.getMap("slide-backgrounds"), ne = k.getMap("slide-notes"), W = k.getMap("clist_refs"), Q = k.getMap("slide-design"), re = null, ee = null, ie = null, q = null, R = "first", se = /* @__PURE__ */ new Set(["first"]), Ee = "first", ge = "first";
  const V = /* @__PURE__ */ new Map(), Ue = /* @__PURE__ */ new Map(), at = /* @__PURE__ */ new Map(), st = /* @__PURE__ */ new Map(), qe = /* @__PURE__ */ new Map(), We = /* @__PURE__ */ new Set();
  let ft = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), Ge = !0, lt = "", O = null, fe = !1;
  const w = /* @__PURE__ */ new Set();
  let A = null, X = null, de = !1, Y = null, H = 0, be = null, xe = !1, Ae = null, J = null, ve = null, Ne = null, D = null, Se = !1, N = !1, ae = null, oe = null, Ce = null, Ie = null, Je = null, Xe = !1, tt = null, gt = !1;
  const ct = li({
    getDocument: () => k,
    encode: c.encodeStateAsUpdate,
    getName: () => r("doc-name").value,
    onError: (e) => {
      console.error("Background recovery failed:", e), $("Background recovery failed: " + e.message, "error");
    }
  }), Ye = Jo(u, () => N);
  let Me = null, $e = [], et = null;
  r("server-url").value = d.url || "", r("doc-name").value = d.documentName || "clist-slide-demo";
  function $(e, t = "") {
    r("connection-status").textContent = e, r("connection-status").className = `status ${t}`;
  }
  function Te(e) {
    ct.changed(e), tt?.changed(), d.onChange?.();
  }
  function dt(e) {
    d.onStatus ? d.onStatus(e) : $(e);
  }
  function Re(e, t, n, i, a, l = null, b = "") {
    const p = new c.Map();
    p.set("x", t), p.set("y", n), p.set("width", i), p.set("height", a), p.set("rotation", 0), p.set("slide", R), p.set("layer", Math.max(-1, ...je().map((z) => Ve(x.get(z)))) + 1), l && (p.set("kind", "image"), p.set("source", l), p.set("alt", b), p.set("imageRatio", i / a), p.set("aspectRatio", i / a), p.set("keepAspectRatio", !0)), x.set(e, p);
  }
  function xt() {
    x.size || de || (de = !0, k.transact(() => {
      x.size || (Q.has("theme") || Q.set("theme", structuredClone(Pe())), Re("title", 105, 98, 820, 135), Re("body", 108, 296, 690, 240));
    }, "init"), V.get("title")?.editor.commands.setContent("<h1>Collaborative slides</h1>"), V.get("body")?.editor.commands.setContent("<p>Click here to edit together.</p><p>Drag the blue handle to move this box, or resize it from the lower-right corner.</p>"));
  }
  function ht(e, t) {
    const n = document.createElement("div");
    n.className = t.get("kind") === "shape" ? "slide-object shape-object" : t.get("kind") === "image" ? "slide-object image-object" : "slide-object", n.dataset.id = e, n.tabIndex = 0, n.setAttribute("aria-label", t.get("kind") === "shape" ? "Shape object. Arrow keys move; Delete removes." : t.get("kind") === "image" ? "Image object. Arrow keys move; Delete removes." : "Text object. Arrow keys move; Enter edits.");
    const i = document.createElement("div");
    i.className = "object-grip", i.textContent = "Move";
    const a = document.createElement("div");
    a.className = t.get("kind") === "shape" ? "shape-content" : t.get("kind") === "image" ? "image-content" : "text-content";
    const l = document.createElement("div");
    l.className = "resize-handle", n.append(i, a, l), F.append(n);
    let b = null;
    if (t.get("kind") === "shape")
      a.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    else if (t.get("kind") === "image") {
      const p = document.createElement("img");
      p.src = vt(t.get("source")), p.alt = typeof t.get("alt") == "string" ? t.get("alt") : "", p.draggable = !1, p.addEventListener("load", () => {
        V.has(e) && ln(e);
      }), a.append(p);
    } else {
      const p = k.getXmlFragment(`slide-text-${e}`);
      D?.addToScope(p), Se = !0;
      try {
        b = new s({
          element: a,
          editable: !N,
          extensions: [
            g.configure({ undoRedo: !1, history: !1, link: !1 }),
            v.configure({ openOnClick: !1, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
            m.configure({ document: k, field: `slide-text-${e}` })
          ],
          editorProps: {
            attributes: { "aria-label": `Edit text in ${e}` }
          },
          onFocus: () => {
            X = e, ke(e, !1, w.has(e));
          },
          onBlur: () => {
            X === e && (X = null), D?.stopCapturing();
          }
        });
      } finally {
        Se = !1;
      }
    }
    n.addEventListener("pointerdown", (p) => {
      if (!N) {
        if (p.shiftKey && p.target !== l && p.target !== i) {
          p.preventDefault(), p.stopPropagation(), ke(e, !0, !1, !0), u.tabIndex = -1, u.focus({ preventScroll: !0 });
          return;
        }
        p.target !== l && p.target !== i && ke(e, !1, !1, !0), b || n.focus({ preventScroll: !0 });
      }
    }), n.addEventListener("dblclick", (p) => {
      t.get("kind") === "image" && (p.preventDefault(), p.stopPropagation(), ke(e), Gn());
    }), n.addEventListener("focus", () => ke(e, !1, w.has(e))), i.addEventListener("pointerdown", (p) => zn(p, e, "move")), l.addEventListener("pointerdown", (p) => zn(p, e, "resize")), V.set(e, { node: n, editor: b, box: t, content: a }), ln(e), A === e && n.classList.add("selected");
  }
  const mt = {
    system: "system-ui, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    georgia: "Georgia, serif",
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace'
  };
  function Pe() {
    const e = Q.get("theme");
    if (e)
      try {
        return Eo(e);
      } catch {
      }
    return E.values().next().value;
  }
  for (const e of E.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, r("theme").append(t);
  }
  r("theme").addEventListener("change", (e) => {
    const t = E.get(e.target.value);
    !t || N || (D?.stopCapturing(), Q.set("theme", structuredClone(t)), D?.stopCapturing(), $("Theme applied: " + t.label));
  });
  function on() {
    const e = Pe();
    let t = r("theme").querySelector("[data-document-theme]");
    E.has(e.id) ? t?.remove() : (t || (t = document.createElement("option"), t.dataset.documentTheme = "", r("theme").append(t)), t.value = e.id, t.textContent = e.label + " (saved in presentation)"), r("theme").value = e.id;
    const n = r("theme-preview");
    n.replaceChildren();
    for (const i of [e.background, e.textColour, e.fillColour, e.borderColour]) {
      const a = document.createElement("span");
      a.style.backgroundColor = i, n.append(a);
    }
  }
  function ut(e) {
    const t = Pe(), n = (a, l) => /^#[0-9a-f]{6}$/i.test(e.get(a) || "") ? e.get(a) : l, i = Number(e.get("borderWidth"));
    return {
      fill: e.get("fillEnabled") === !0,
      fillColour: n("fillColour", e.get("kind") === "shape" ? t.fillColour : t.background),
      border: e.get("borderEnabled") === !0,
      borderColour: n("borderColour", t.borderColour),
      width: Number.isFinite(i) && i >= 1 && i <= 20 ? i : 2
    };
  }
  function bt(e) {
    const t = Pe(), n = Number(e.get("fontSize")), i = e.get("textColour"), a = e.get("textAlign");
    return {
      size: Number.isFinite(n) && n >= 8 && n <= 200 ? n : t.fontSize,
      colour: typeof i == "string" && /^#[0-9a-f]{6}$/i.test(i) ? i : t.textColour,
      align: ["left", "center", "right", "justify"].includes(a) ? a : "left",
      family: Object.prototype.hasOwnProperty.call(mt, e.get("fontFamily")) ? e.get("fontFamily") : t.fontFamily
    };
  }
  function Ve(e) {
    const t = e.get("layer");
    return typeof t == "number" && Number.isFinite(t) ? t : 0;
  }
  function je(e = R) {
    return [...x.keys()].filter((t) => {
      const n = x.get(t);
      return n instanceof c.Map && (n.get("slide") || "first") === e;
    }).sort((t, n) => Ve(x.get(t)) - Ve(x.get(n)) || t.localeCompare(n));
  }
  function rn(e) {
    const t = (n) => {
      const i = e.get(n);
      return typeof i == "number" && Number.isFinite(i) ? Math.max(0, Math.min(100, i)) : 50;
    };
    return { fit: e.get("imageFit") === "cover" ? "cover" : "contain", x: t("cropX"), y: t("cropY") };
  }
  function Mt(e, t) {
    const n = Number(e.get("cropImageWidth")), i = Number(e.get("cropImageHeight"));
    if (n > 0 && i > 0) return { width: n, height: i };
    const a = t?.naturalWidth > 0 ? t.naturalWidth / t.naturalHeight : Number(e.get("imageRatio")) || yn(e), l = Math.max(e.get("width"), e.get("height") * a);
    return { width: l, height: l / a };
  }
  function an(e) {
    if (e.get("kind") !== "image" || e.get("imageFit") !== "cover") return;
    const t = V.get([...x.keys()].find((i) => x.get(i) === e))?.content.querySelector("img"), n = Mt(e, t);
    e.set("cropImageWidth", n.width), e.set("cropImageHeight", n.height);
  }
  function sn(e, t, n = !1) {
    const i = rn(t);
    if (e.style.objectFit = "contain", e.style.objectPosition = i.x + "% " + i.y + "%", i.fit === "cover") {
      const a = Mt(t, e);
      e.style.position = "absolute", e.style.width = n ? a.width / 12.8 + "cqw" : 100 * a.width / t.get("width") + "%", e.style.height = n ? a.height / 12.8 + "cqw" : 100 * a.height / t.get("height") + "%", e.style.left = n ? (t.get("width") - a.width) * i.x / 1280 + "cqw" : (t.get("width") - a.width) * i.x / t.get("width") + "%", e.style.top = n ? (t.get("height") - a.height) * i.y / 1280 + "cqw" : (t.get("height") - a.height) * i.y / t.get("height") + "%";
    } else
      e.style.position = "static", e.style.width = e.style.height = "100%", e.style.left = e.style.top = "";
  }
  function Bt(e) {
    const t = e.get("shapeDefinition");
    if (t && typeof t == "object") {
      if (!y.has(t))
        try {
          y.set(t, tn(t));
        } catch (n) {
          console.error("Invalid saved shape definition:", n), $("A saved shape definition is invalid; showing a fallback shape.", "error"), y.set(t, I);
        }
      return y.get(t);
    }
    return M.get(e.get("shapeType")) || I;
  }
  function In(e) {
    const { fillColour: t, borderColour: n, ...i } = e.defaults;
    return { kind: "shape", shapeType: e.id, shapeDefinition: structuredClone(e), ...i };
  }
  function Ut(e, t) {
    const n = "http://www.w3.org/2000/svg", i = Math.max(1, Number(t.get("width")) || 1), a = Math.max(1, Number(t.get("height")) || 1), l = ut(t), b = Bt(t), p = l.border ? Math.min(l.width, i, a) : 0, [z, B, j, U] = b.viewBox;
    e.setAttribute("viewBox", "0 0 " + i + " " + a), e.setAttribute("preserveAspectRatio", "none");
    const G = document.createElementNS(n, "g");
    G.setAttribute("transform", "translate(" + p / 2 + " " + p / 2 + ") scale(" + Math.max(1e-3, i - p) / j + " " + Math.max(1e-3, a - p) / U + ") translate(" + -z + " " + -B + ")");
    for (const le of b.elements) {
      const we = document.createElementNS(n, le.tag);
      for (const [te, De] of Object.entries(le.attributes)) we.setAttribute(te, String(De));
      we.setAttribute("fill", l.fill ? l.fillColour : "none"), we.setAttribute("stroke", l.border ? l.borderColour : "none"), we.setAttribute("vector-effect", "non-scaling-stroke"), we.style.strokeWidth = 100 * p / i + "cqw", we.setAttribute("stroke-linecap", "round"), we.setAttribute("stroke-linejoin", "round"), G.append(we);
    }
    e.replaceChildren(G);
  }
  function ln(e) {
    const t = V.get(e);
    if (!t) return;
    const { node: n, box: i } = t;
    if (n.style.left = `${100 * Number(i.get("x") || 0) / S}%`, n.style.top = `${100 * Number(i.get("y") || 0) / C}%`, n.style.width = `${100 * Number(i.get("width") || 0) / S}%`, n.style.height = `${100 * Number(i.get("height") || 0) / C}%`, n.style.transform = `rotate(${Number(i.get("rotation") || 0)}deg)`, n.classList.toggle("locked", i.get("locked") === !0), n.title = i.get("locked") === !0 ? "Locked object: select it and click Unlock to move, resize or delete." : "", n.style.zIndex = String(je().indexOf(e)), i.get("kind") === "shape") Ut(t.content.querySelector("svg"), i);
    else if (!t.editor) {
      const a = t.content.querySelector("img"), l = vt(i.get("source"));
      a.getAttribute("src") !== l && (a.src = l), a.alt = typeof i.get("alt") == "string" ? i.get("alt") : "", sn(a, i, !0);
    }
    if (t.editor) {
      const a = bt(i);
      n.style.setProperty("--slide-font-size", a.size / 12.8 + "cqw"), n.style.fontFamily = mt[a.family], n.style.color = a.colour, n.style.textAlign = a.align;
      const l = ut(i);
      t.content.style.backgroundColor = l.fill ? l.fillColour : "transparent", t.content.style.border = l.border ? l.width / 12.8 + "cqw solid " + l.borderColour : "none";
    }
  }
  function zt() {
    const e = ne.get(R), t = typeof e == "string" ? e : "";
    r("speaker-notes").value !== t && (r("speaker-notes").value = t);
  }
  r("speaker-notes").addEventListener("input", (e) => {
    N || ne.set(R, e.target.value);
  });
  function At(e) {
    const t = Z.get(e);
    return typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t : Pe().background;
  }
  r("slide-background").addEventListener("change", (e) => {
    if (N) return;
    const t = e.target.value;
    /^#[0-9a-f]{6}$/i.test(t) && Z.set(R, t);
  });
  function ye() {
    return K.size ? [...K.keys()].sort((e, t) => K.get(e) - K.get(t) || e.localeCompare(t)) : ["first"];
  }
  function cn(e) {
    const t = st.get(e), n = x.get(e);
    if (t !== void 0 && (We.add(t), qe.get(t)?.delete(e), qe.get(t)?.size || qe.delete(t), st.delete(e)), n instanceof c.Map) {
      const i = n.get("slide") || "first";
      st.set(e, i), ft.set(n, e), qe.has(i) || qe.set(i, /* @__PURE__ */ new Set()), qe.get(i).add(e), We.add(i);
    }
  }
  function So() {
    st.clear(), qe.clear(), We.clear(), ft = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), x.forEach((e, t) => cn(t)), Ge = !0;
  }
  function qt(e) {
    for (const t of e.changed.get(x) || []) t !== null && cn(t);
    for (const [t, n] of e.changed)
      if (t === Q) Ge = !0;
      else if (t === Z) for (const i of n) We.add(i);
      else if (ft.has(t)) cn(ft.get(t));
      else {
        let i = t;
        for (; i.parent; ) i = i.parent;
        if (!(i instanceof c.XmlFragment)) continue;
        if (!Fe.has(i))
          for (const [l, b] of k.share) l.startsWith("slide-text-") && Fe.set(b, l.slice(11));
        const a = st.get(Fe.get(i));
        a !== void 0 && We.add(a);
      }
  }
  function Ht(e = ye()) {
    e.includes(R) || (R = e[0]), Ee !== R ? (se = /* @__PURE__ */ new Set([R]), ge = R) : (se = new Set(e.filter((t) => se.has(t))), se.size || se.add(R)), Ee = R, e.includes(ge) || (ge = R);
  }
  function Wt() {
    return Ht(), ye().filter((e) => se.has(e));
  }
  function yt(e, t = e[0], n = t) {
    se = new Set(e), R = t, Ee = t, ge = n, A = null, w.clear();
  }
  function Lt() {
    if (re?.mode === "outline") {
      re.focus(R);
      return;
    }
    r("slide-list").querySelector(`[data-slide-id="${R}"]`)?.focus({ preventScroll: !0 });
  }
  function Xt(e, t = {}) {
    const n = ye();
    if (!(N || !n.includes(e))) {
      if (me(), Ht(n), t.shiftKey) {
        const i = n.indexOf(ge), a = n.indexOf(e), l = n.slice(Math.min(i, a), Math.max(i, a) + 1);
        yt(t.ctrlKey || t.metaKey ? [...se, ...l] : l, e, ge);
      } else if (t.ctrlKey || t.metaKey) {
        const i = new Set(se);
        i.has(e) && i.size > 1 ? i.delete(e) : i.add(e), yt([...i], i.has(e) ? e : i.has(R) ? R : [...i][0], e);
      } else yt([e], e);
      he(), Lt();
    }
  }
  function Pn() {
    const e = r("object-list"), t = je().reverse();
    for (const [n, i] of Ue)
      t.includes(n) || (i.remove(), Ue.delete(n));
    t.forEach((n, i) => {
      const a = x.get(n), l = a.get("kind") === "image", b = a.get("kind") === "shape", p = l ? a.get("alt") : V.get(n)?.editor?.getText(), z = (typeof p == "string" ? p : "").replace(/\s+/g, " ").trim().slice(0, 60), B = b ? "Shape: " + Bt(a).label : (l ? "Image: " : "Text: ") + (z || (l ? "Untitled image" : "Empty text box"));
      let j = Ue.get(n);
      j || (j = document.createElement("button"), j.className = "btn-small", j.dataset.objectId = n, j.addEventListener("click", (U) => {
        N || (me(), ke(n, U.shiftKey, !1, !0), u.tabIndex = -1, u.focus({ preventScroll: !0 }));
      }), Ue.set(n, j)), j.textContent = B + (a.get("groupId") ? " (Grouped)" : "") + (a.get("locked") === !0 ? " (Locked)" : ""), j.title = "Select " + B + ". Shift-click to add or remove from selection.", j.setAttribute("aria-pressed", String(w.has(n))), e.children[i] !== j && e.insertBefore(j, e.children[i] || null);
    });
  }
  function dn() {
    for (const e of u.querySelectorAll(".slide-drop-before, .slide-drop-after, .slide-dragging")) e.classList.remove("slide-drop-before", "slide-drop-after", "slide-dragging");
  }
  function un() {
    dn(), Me = null, $e = [], et = null;
  }
  const nt = u.querySelector(".rail");
  nt.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-slide-id]");
    if (!t || N || ye().length < 2 || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    me();
    const n = t.dataset.slideId;
    Ht(), se.has(n) || yt([n]), Me = n, $e = Wt(), e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", "CList slide");
    for (const i of r("slide-list").querySelectorAll("[data-slide-id]")) $e.includes(i.dataset.slideId) && i.classList.add("slide-dragging");
  }), nt.addEventListener("dragover", (e) => {
    if (!Me || N) return;
    e.preventDefault(), e.dataTransfer.dropEffect = "move", dn();
    const t = [...r("slide-list").querySelectorAll(":scope > [data-slide-id]")], n = t[$o(t.map((l) => l.getBoundingClientRect()), e.clientX, e.clientY, re?.mode === "sorter")];
    et = n?.dataset.slideId || null, (n || t.at(-1))?.classList.add(n ? "slide-drop-before" : "slide-drop-after");
    for (const l of t) $e.includes(l.dataset.slideId) && l.classList.add("slide-dragging");
    const a = nt.getBoundingClientRect();
    e.clientY < a.top + 35 ? nt.scrollTop -= 18 : e.clientY > a.bottom - 35 && (nt.scrollTop += 18);
  }), nt.addEventListener("dragleave", (e) => {
    nt.contains(e.relatedTarget) || dn();
  }), nt.addEventListener("dragend", () => {
    un(), he();
  }), nt.addEventListener("drop", (e) => {
    if (!Me || N) return;
    e.preventDefault();
    const t = [...$e], n = et;
    un();
    const i = ye(), a = di(i, t, n);
    a.every((l, b) => l === i[b]) || (A = null, w.clear(), D?.stopCapturing(), k.transact(() => a.forEach((l, b) => K.set(l, b))), D?.stopCapturing(), Lt(), dt(t.length === 1 ? "Slide moved to position " + (a.indexOf(t[0]) + 1) : t.length + " slides moved"));
  }), nt.addEventListener("keydown", (e) => {
    if (N || e.isComposing) return;
    const t = ye(), n = t.indexOf(R);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")
      e.preventDefault(), e.stopPropagation(), yt(t, R, ge), he(), Lt();
    else if (e.key === "Escape")
      e.preventDefault(), e.stopPropagation(), Xt(R);
    else if (e.key === "Delete" || e.key === "Backspace")
      e.preventDefault(), e.stopPropagation(), r("delete-slide").disabled || r("delete-slide").click();
    else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(), e.stopPropagation();
      const i = e.key === "ArrowUp" ? -1 : 1;
      e.altKey ? Lo(i) : t[n + i] && Xt(t[n + i], e);
    }
  });
  function Nt() {
    vn(), Pn();
    const e = ye(), t = JSON.stringify(e);
    Me && t !== lt && un(), lt = t, Ht(e);
    const n = r("slide-list"), i = new Set(e);
    for (const [p, z] of at) i.has(p) || (z.button.remove(), at.delete(p), We.delete(p));
    let a = n.firstElementChild;
    e.forEach((p, z) => {
      let B = at.get(p);
      if (!B) {
        const Qe = document.createElement("button"), Oe = document.createElement("div"), ot = document.createElement("div"), ze = document.createElement("span");
        Qe.className = "clist-action-btn btn-small", Qe.dataset.slideId = p, ot.className = "mini-slide", ze.className = "slide-number", Oe.append(ze, ot), Qe.append(Oe), Qe.addEventListener("click", (Le) => Xt(p, Le)), B = { button: Qe, thumb: Oe, preview: ot, label: ze }, at.set(p, B), We.add(p);
      }
      const { button: j, thumb: U, preview: G, label: le } = B, we = "Slide " + (z + 1) + ". Ctrl/Cmd-click to toggle; Shift-click for a range. Drag to move selected slides.";
      j.title !== we && (j.title = we);
      const te = e.length > 1 && !N;
      j.draggable !== te && (j.draggable = te);
      const De = String(se.has(p));
      j.getAttribute("aria-pressed") !== De && j.setAttribute("aria-pressed", De), p === R ? j.hasAttribute("aria-current") || j.setAttribute("aria-current", "true") : j.hasAttribute("aria-current") && j.removeAttribute("aria-current");
      const Be = "slide-thumb" + (se.has(p) ? " selected" : "") + (p === R ? " active-slide" : "");
      U.className !== Be && (U.className = Be), (Ge || We.has(p)) && (G.style.backgroundColor = At(p), G.replaceChildren(), [...qe.get(p) || []].sort((Oe, ot) => Ve(x.get(Oe)) - Ve(x.get(ot)) || Oe.localeCompare(ot)).forEach((Oe, ot) => {
        const ze = x.get(Oe), Le = document.createElement("div");
        if (Le.className = "mini-object", Le.style.zIndex = String(ot), Le.style.transform = `rotate(${Number(ze.get("rotation")) || 0}deg)`, Le.style.left = 100 * ze.get("x") / S + "%", Le.style.top = 100 * ze.get("y") / C + "%", Le.style.width = 100 * ze.get("width") / S + "%", Le.style.height = 100 * ze.get("height") / C + "%", ze.get("kind") === "shape") {
          const Ke = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          Ut(Ke, ze), Le.append(Ke);
        } else if (ze.get("kind") === "image") {
          const Ke = document.createElement("img");
          Ke.src = vt(ze.get("source")), Ke.alt = "", Ke.draggable = !1, sn(Ke, ze), Le.append(Ke);
        } else {
          const Ke = bt(ze);
          Le.style.color = Ke.colour, Le.style.fontFamily = mt[Ke.family], Le.style.background = "transparent", Le.textContent = k.getXmlFragment("slide-text-" + Oe).toString().replace(/<[^>]*>/g, " ");
        }
        G.append(Le);
      })), le.textContent !== String(z + 1) && (le.textContent = String(z + 1)), a === j ? a = a.nextElementSibling : n.insertBefore(j, a);
    }), We.clear(), Ge = !1;
    const l = e.indexOf(R), b = se.size;
    r("slide-label").textContent = "Slide " + (l + 1) + " of " + e.length + (b > 1 ? " · " + b + " selected" : ""), r("duplicate-slide").disabled = N, r("duplicate-slide").title = b > 1 ? "Duplicate " + b + " selected slides" : "Duplicate the selected slide", r("delete-slide").disabled = N || b >= e.length, r("delete-slide").title = b >= e.length ? "At least one slide must remain" : b > 1 ? "Delete " + b + " selected slides" : "Delete selected slide", r("presentation-position").textContent = l + 1 + " / " + e.length, r("previous-slide").disabled = l <= 0, r("next-slide").disabled = l >= e.length - 1, re?.refresh();
  }
  function he() {
    on();
    const e = ye();
    e.includes(R) || (me(), A = null, w.clear(), R = e[0]), zt(), F.style.backgroundColor = At(R), r("slide-background").value = At(R);
    for (const [t, n] of V)
      (!x.has(t) || (x.get(t).get("slide") || "first") !== R) && (n.editor?.destroy(), n.node.remove(), V.delete(t), w.delete(t), A === t && (A = [...w].at(-1) || null));
    x.forEach((t, n) => {
      !(t instanceof c.Map) || (t.get("slide") || "first") !== R || (V.has(n) ? (V.get(n).box = t, ln(n)) : ht(n, t));
    }), ke(A, !1, !0), Nt();
  }
  function pn(e) {
    if (!V.has(e)) return [];
    const t = x.get(e)?.get("groupId");
    return typeof t == "string" && t ? je().filter((n) => x.get(n).get("groupId") === t) : [e];
  }
  function Dn(e = !1) {
    if (N || _e() || !w.size || !e && w.size < 2) return;
    me();
    const t = "group-" + crypto.randomUUID();
    D?.stopCapturing(), k.transact(() => {
      for (const n of w)
        e ? x.get(n).delete("groupId") : x.get(n).set("groupId", t);
    }), D?.stopCapturing(), $(e ? "Selected objects ungrouped." : "Selected objects grouped.");
  }
  r("group-objects").addEventListener("click", () => Dn()), r("ungroup-objects").addEventListener("click", () => Dn(!0));
  function fn(e, t) {
    const n = { ...e };
    return typeof n.groupId == "string" && n.groupId && (t.has(n.groupId) || t.set(n.groupId, "group-" + crypto.randomUUID()), n.groupId = t.get(n.groupId)), n;
  }
  function Co(e = !1) {
    if (gt || N) return;
    const t = [...w].sort().map((b) => b + ":" + (x.get(b)?.get("kind") || "text")).join("|");
    if (!e && t === Je) return;
    Je = t;
    const n = x.get(A), i = w.size > 1 ? "arrange" : n ? n.get("kind") === "image" ? "images" : n.get("kind") === "shape" ? "appearance" : "text" : "slide", a = u.querySelector(".inspector"), l = a.querySelector('[data-panel="' + i + '"]');
    for (const b of a.querySelectorAll(":scope > .control-section")) b.open = b === l;
    l && (a.scrollTop += l.getBoundingClientRect().top - a.getBoundingClientRect().top - a.clientTop);
  }
  function ke(e, t = !1, n = !1, i = !1) {
    for (const te of w) V.has(te) || w.delete(te);
    if (t && e && V.has(e)) {
      const te = pn(e), De = te.every((Be) => w.has(Be));
      for (const Be of te)
        De ? w.delete(Be) : w.add(Be);
    } else if (!n) {
      w.clear();
      for (const te of pn(e)) w.add(te);
    }
    if (n) for (const te of [...w]) for (const De of pn(te)) w.add(De);
    A = w.has(e) ? e : [...w].at(-1) || null;
    for (const [te, De] of V) De.node.classList.toggle("selected", w.has(te));
    q && !q.current() && q.destroy();
    const a = w.size > 1, l = _e();
    u.classList.toggle("multi-selection", a);
    const b = [...w].map((te) => x.get(te)?.get("groupId")), p = b.length > 1 && !!b[0] && b.every((te) => te === b[0]);
    r("group-objects").disabled = l || !a || p, r("ungroup-objects").disabled = l || !b.some(Boolean), r("lock-objects").disabled = !w.size || [...w].every((te) => x.get(te)?.get("locked") === !0), r("unlock-objects").disabled = !l, r("distribute-horizontal").disabled = r("distribute-vertical").disabled = l || w.size < 3;
    for (const te of ["left", "center", "right", "top", "middle", "bottom"]) r("align-" + te).disabled = l || !a;
    const z = A ? x.get(A) : null;
    r("selection-details").textContent = a ? w.size + " objects selected. Drag a Move handle or use arrow keys to move together." : z ? `${A}
Position: ${Math.round(z.get("x"))}, ${Math.round(z.get("y"))}
Size: ${Math.round(z.get("width"))} × ${Math.round(z.get("height"))}` : "Select an object";
    for (const te of ["x", "y", "width", "height"]) {
      const De = r("object-" + te);
      De.disabled = l || !z || a, De.value = z ? String(Math.round(Number(z.get(te)) || 0)) : "";
    }
    r("keep-aspect-ratio").disabled = l || a || z?.get("kind") !== "image", r("keep-aspect-ratio").checked = z?.get("kind") === "image" && z.get("keepAspectRatio") !== !1;
    const B = z ? rn(z) : { fit: "contain" }, j = l || a || z?.get("kind") !== "image";
    r("image-description").disabled = j;
    const U = !a && z?.get("kind") === "image" && typeof z.get("alt") == "string" ? z.get("alt") : "";
    r("image-description").value !== U && (r("image-description").value = U), r("replace-image").disabled = j, r("crop-image").disabled = j, r("image-fit").disabled = j, r("image-fit").value = B.fit, r("object-rotation").disabled = l || !z || a, r("object-rotation").value = z ? String(Number(z.get("rotation")) || 0) : "", r("cut-objects").disabled = !w.size || l, r("copy-objects").disabled = !w.size, Yn(), r("paste-objects").disabled = !J?.items.length, r("duplicate").disabled = !A || a, r("delete").disabled = l || !A;
    const G = je(), le = G.indexOf(A);
    r("bring-forward").disabled = l || a || le < 0 || le === G.length - 1, r("send-backward").disabled = l || a || le <= 0, r("bold").disabled = a || !V.get(A)?.editor, r("italic").disabled = a || !V.get(A)?.editor, r("edit-link").disabled = a || !V.get(A)?.editor, r("remove-link").disabled = a || !V.get(A)?.editor, Ne && A !== Ne && jt(), r("bullet-list").disabled = a || !V.get(A)?.editor, r("ordered-list").disabled = a || !V.get(A)?.editor;
    for (const te of ["font-family", "font-size", "text-colour", "text-align"]) r(te).disabled = a || !V.get(A)?.editor;
    const we = z && !a && (!!V.get(A)?.editor || z.get("kind") === "shape");
    for (const te of ["fill-enabled", "fill-colour", "border-enabled", "border-colour", "border-width"]) r(te).disabled = !we;
    if (we) {
      const te = ut(z);
      r("fill-enabled").checked = te.fill, r("fill-colour").value = te.fillColour, r("fill-colour").disabled = !te.fill, r("border-enabled").checked = te.border, r("border-colour").value = te.borderColour, r("border-width").value = String(te.width), r("border-colour").disabled = r("border-width").disabled = !te.border;
    }
    if (z && !a && V.get(A)?.editor) {
      const te = bt(z);
      r("font-family").value = te.family, r("font-size").value = String(Math.round(te.size)), r("text-colour").value = te.colour, r("text-align").value = te.align;
    }
    Pn(), Co(i), Ce?.schedule();
  }
  function zn(e, t, n) {
    if (N || e.button !== 0) return;
    if (e.preventDefault(), e.stopPropagation(), D?.stopCapturing(), D && (D.captureTimeout = 1 / 0), ke(t, !1, n === "move" && w.has(t), !0), _e()) {
      me(), $("Unlock selected objects before moving or resizing.", "error");
      return;
    }
    V.get(t)?.node.focus({ preventScroll: !0 });
    const i = x.get(t);
    if (!i) return;
    n === "resize" && an(i);
    const a = S / F.getBoundingClientRect().width, l = [...w].map((p) => ({ id: p, ...x.get(p).toJSON() })), b = $t(l);
    Y = {
      members: l,
      id: t,
      action: n,
      startX: e.clientX,
      startY: e.clientY,
      scale: a,
      original: n === "move" ? b : {
        x: i.get("x"),
        y: i.get("y"),
        width: i.get("width"),
        height: i.get("height")
      }
    }, Y.target = e.currentTarget, Y.pointerId = e.pointerId, e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.addEventListener("pointermove", On), e.currentTarget.addEventListener("pointerup", me, { once: !0 }), e.currentTarget.addEventListener("pointercancel", me, { once: !0 });
  }
  function $t(e) {
    const t = Math.min(...e.map((i) => i.x)), n = Math.min(...e.map((i) => i.y));
    return { x: t, y: n, width: Math.max(...e.map((i) => i.x + i.width)) - t, height: Math.max(...e.map((i) => i.y + i.height)) - n };
  }
  function _e() {
    return [...w].some((e) => x.get(e)?.get("locked") === !0);
  }
  function Fn(e) {
    N || !w.size || (me(), k.transact(() => {
      for (const t of w) x.get(t)?.set("locked", e);
    }), $(e ? "Selected objects locked." : "Selected objects unlocked."));
  }
  r("lock-objects").addEventListener("click", () => Fn(!0)), r("unlock-objects").addEventListener("click", () => Fn(!1));
  function Vt(e) {
    const t = (Number(e.rotation) || 0) * Math.PI / 180, n = Math.abs(e.width * Math.cos(t)) + Math.abs(e.height * Math.sin(t)), i = Math.abs(e.width * Math.sin(t)) + Math.abs(e.height * Math.cos(t));
    return { x: e.x + (e.width - n) / 2, y: e.y + (e.height - i) / 2, width: n, height: i };
  }
  function Mo(e) {
    if (N || _e() || w.size < 2) return;
    me();
    const t = [...w].map((i) => ({ id: i, ...x.get(i).toJSON() })), n = $t(t.map(Vt));
    D?.stopCapturing(), k.transact(() => {
      for (const i of t) {
        const a = x.get(i.id), l = Vt(i);
        let b = 0, p = 0;
        e === "left" && (b = n.x - l.x), e === "center" && (b = n.x + n.width / 2 - l.x - l.width / 2), e === "right" && (b = n.x + n.width - l.x - l.width), e === "top" && (p = n.y - l.y), e === "middle" && (p = n.y + n.height / 2 - l.y - l.height / 2), e === "bottom" && (p = n.y + n.height - l.y - l.height), ["left", "center", "right"].includes(e) ? a.set("x", i.x + b) : a.set("y", i.y + p);
      }
    }, "geometry"), D?.stopCapturing();
  }
  for (const e of ["left", "center", "right", "top", "middle", "bottom"])
    r("align-" + e).addEventListener("click", () => Mo(e));
  function Tn(e) {
    if (N || _e() || w.size < 3) return;
    me();
    const t = e ? "y" : "x", n = e ? "height" : "width", i = [...w].map((j) => {
      const U = x.get(j).toJSON();
      return { id: j, box: U, bounds: Vt(U) };
    }).sort((j, U) => j.bounds[t] - U.bounds[t] || j.id.localeCompare(U.id)), a = i[0], l = i[i.length - 1], b = a.bounds[t], p = l.bounds[t] + l.bounds[n], z = i.reduce((j, U) => j + U.bounds[n], 0), B = (p - b - z) / (i.length - 1);
    if (B < -1e-6) {
      const U = "Not enough room " + (e ? "vertically" : "horizontally") + ": the objects need " + Math.ceil(z) + " px, but their outer edges span only " + Math.floor(p - b) + " px. Move the outermost objects farther apart or make the objects smaller.";
      r("distribution-status").textContent = U, $(U, "error");
      return;
    }
    D?.stopCapturing(), k.transact(() => {
      let j = b + a.bounds[n] + Math.max(0, B);
      for (let U = 1; U < i.length - 1; U++) {
        const G = i[U];
        x.get(G.id).set(t, G.box[t] + j - G.bounds[t]), j += G.bounds[n] + Math.max(0, B);
      }
    }, "geometry"), D?.stopCapturing(), r("distribution-status").textContent = "Distributed " + i.length + " objects " + (e ? "vertically" : "horizontally") + " with " + Math.round(Math.max(0, B)) + " px gaps.";
  }
  r("distribute-horizontal").addEventListener("click", () => Tn(!1)), r("distribute-vertical").addEventListener("click", () => Tn(!0));
  function gn() {
    if (N) return;
    if (_e()) {
      $("Unlock selected objects before deleting.", "error");
      return;
    }
    const e = [...w];
    k.transact(() => e.forEach((t) => x.delete(t)));
  }
  function Rn(e, t, n, i, a) {
    let l = { position: e, guide: null }, b = i + 1e-6;
    for (const p of n)
      for (const z of [0, t / 2, t]) {
        const B = p - z, j = Math.abs(B - e);
        B >= 0 && B <= a - t && j < b && (b = j, l = { position: B, guide: p });
      }
    return l;
  }
  function Ao(e, t, n, i, a, l) {
    const b = [0, S / 2, S], p = [0, C / 2, C];
    for (const z of je()) {
      if (z === e || w.has(z)) continue;
      const B = x.get(z), j = Number(B.get("x")), U = Number(B.get("y")), G = Number(B.get("width")), le = Number(B.get("height"));
      [j, U, G, le].every(Number.isFinite) && (b.push(j, j + G / 2, j + G), p.push(U, U + le / 2, U + le));
    }
    return { x: Rn(t, i, b, l, S), y: Rn(n, a, p, l, C) };
  }
  function On(e) {
    if (!Y) return;
    if (_e()) {
      me(), $("Movement stopped because an object was locked.", "error");
      return;
    }
    const { id: t, action: n, startX: i, startY: a, scale: l, original: b } = Y, p = x.get(t);
    if (!p) return;
    const z = (e.clientX - i) * l, B = (e.clientY - a) * l;
    k.transact(() => {
      if (n === "move") {
        let j = Math.max(0, Math.min(S - b.width, b.x + z)), U = Math.max(0, Math.min(C - b.height, b.y + B));
        if (T.hidden = P.hidden = !0, !e.altKey) {
          const G = Ao(t, j, U, b.width, b.height, 6 * l);
          j = G.x.position, U = G.y.position, G.x.guide !== null && (T.hidden = !1, T.style.left = 100 * G.x.guide / S + "%"), G.y.guide !== null && (P.hidden = !1, P.style.top = 100 * G.y.guide / C + "%");
        }
        for (const G of Y.members) {
          const le = x.get(G.id);
          le && (le.set("x", Math.round(G.x + j - b.x)), le.set("y", Math.round(G.y + U - b.y)));
        }
      } else if (p.get("kind") === "image" && p.get("keepAspectRatio") !== !1) {
        const j = yn(p), U = Math.abs(z / b.width) >= Math.abs(B / b.height) ? b.width + z : (b.height + B) * j, G = p.get("imageFit") === "cover" ? Mt(p) : { width: S, height: C }, le = Jn(U, j, Math.min(S - b.x, G.width), Math.min(C - b.y, G.height));
        p.set("width", le.width), p.set("height", le.height);
      } else {
        const j = V.get(t)?.editor ? 100 : 1, U = V.get(t)?.editor ? 55 : 1, G = p.get("imageFit") === "cover" ? Mt(p) : { width: S, height: C };
        p.set("width", Math.max(j, Math.min(S - b.x, G.width, b.width + z))), p.set("height", Math.max(U, Math.min(C - b.y, G.height, b.height + B)));
      }
    }, "geometry");
  }
  function me(e) {
    Ie?.cancel(), T.hidden = P.hidden = !0;
    const t = Y?.target || e?.currentTarget;
    t?.removeEventListener("pointermove", On), t?.removeEventListener("pointerup", me), t?.removeEventListener("pointercancel", me), Y && t?.hasPointerCapture(Y.pointerId) && t.releasePointerCapture(Y.pointerId), Y = null, D && (D.captureTimeout = 500, D.stopCapturing());
  }
  k.on("beforeObserverCalls", qt), x.observeDeep(he), K.observe(he), Q.observe(he), Z.observe(he), W.observe(Ft), ne.observe(zt), k.on("update", Nt), k.on("update", Te), r("add-slide").addEventListener("click", () => {
    if (!N) {
      me();
      try {
        if (L.has(r("slide-layout").value)) {
          Po(L.get(r("slide-layout").value));
          return;
        }
        const e = ye(), t = "slide-" + crypto.randomUUID(), n = h.get(r("slide-layout").value) || h.values().next().value, i = n.objects.map((l) => ({ ...l, id: Ze() })), a = /* @__PURE__ */ new Map();
        R = t, A = null, w.clear(), D?.stopCapturing(), k.transact(() => {
          K.size || K.set("first", 0), K.set(t, Math.max(...e.map((l) => K.get(l) || 0)) + 1), n.background !== void 0 && Z.set(t, n.background), n.notes !== void 0 && ne.set(t, n.notes);
          for (const l of i) {
            const { id: b, text: p, shapeId: z, group: B, ...j } = l, G = { ...l.kind === "shape" ? In(M.get(z)) : {}, rotation: 0, ...j, slide: t, layer: Math.max(-1, ...je().map((le) => Ve(x.get(le)))) + 1 };
            B && (a.has(B) || a.set(B, "group-" + crypto.randomUUID()), G.groupId = a.get(B)), l.kind === "image" && (G.aspectRatio = l.width / l.height), x.set(b, new c.Map(Object.entries(G)));
          }
        });
        for (const l of i) {
          if (l.kind !== "text") continue;
          const b = l.text.split(`
`).map((p) => ({ type: "paragraph", content: p ? [{ type: "text", text: p }] : [] }));
          V.get(l.id).editor.commands.setContent({ type: "doc", content: b });
        }
        D?.stopCapturing(), he();
      } catch (e) {
        console.error("Slides layout failed:", e), $("Could not create slide: " + e.message, "error");
      }
    }
  }), r("duplicate-slide").addEventListener("click", () => {
    if (!N) {
      me();
      try {
        const e = Wt(), t = ye(), n = e.map((a) => {
          const l = "slide-" + crypto.randomUUID(), b = /* @__PURE__ */ new Map(), p = je(a).map((z) => {
            const B = new c.Map(Object.entries(fn(x.get(z).toJSON(), b)));
            B.set("slide", l);
            const j = Ze(), U = k.getXmlFragment("slide-text-" + j), G = k.getXmlFragment("slide-text-" + z).toArray().map((le) => le.clone());
            return D?.addToScope(U), { id: j, box: B, fragment: U, text: G };
          });
          return { source: a, id: l, copies: p };
        }), i = n.map((a) => a.id);
        t.splice(t.indexOf(e.at(-1)) + 1, 0, ...i), yt(i), D?.stopCapturing(), k.transact(() => {
          t.forEach((a, l) => K.set(a, l));
          for (const a of n) {
            Z.has(a.source) && Z.set(a.id, Z.get(a.source)), typeof ne.get(a.source) == "string" && ne.set(a.id, ne.get(a.source));
            for (const l of a.copies)
              x.set(l.id, l.box), l.text.length && l.fragment.insert(0, l.text);
          }
        }), D?.stopCapturing(), he(), dt(n.length === 1 ? "Slide duplicated" : n.length + " slides duplicated"), Lt();
      } catch (e) {
        console.error("Slides duplication failed:", e), $("Could not duplicate slide: " + e.message, "error");
      }
    }
  });
  function Lo(e) {
    if (N) return;
    me();
    const t = ye(), n = ci(t, Wt(), e);
    n.every((i, a) => i === t[a]) || (D?.stopCapturing(), k.transact(() => n.forEach((i, a) => K.set(i, a))), D?.stopCapturing(), Lt());
  }
  r("delete-slide").addEventListener("click", () => {
    const e = Wt(), t = ye();
    if (e.length >= t.length || N) return;
    const n = () => No(e);
    if (typeof window.buildDialogModal == "function") {
      const i = document.createElement("p");
      i.textContent = e.length === 1 ? "Delete slide " + (t.indexOf(e[0]) + 1) + "? Its objects and speaker notes will be removed." : "Delete " + e.length + " selected slides? Their objects and speaker notes will be removed.", window.buildDialogModal(e.length === 1 ? "Delete slide" : "Delete slides", i, [
        { label: "Cancel", secondary: !0, onClick: (a) => a() },
        { label: e.length === 1 ? "Delete slide" : "Delete slides", onClick: (a) => {
          a(), n();
        } }
      ]);
    } else {
      const i = document.createElement("dialog"), a = document.createElement("p");
      a.textContent = "Delete " + e.length + " selected slide(s)?", i.append(a);
      for (const [l, b, p] of [["Cancel", !0, () => {
      }], ["Delete slides", !1, n]]) {
        const z = document.createElement("button");
        z.className = b ? "btn-small btn-secondary" : "btn-small", z.textContent = l, z.addEventListener("click", () => {
          i.close(), i.remove(), p();
        }), i.append(z);
      }
      i.addEventListener("cancel", () => i.remove(), { once: !0 }), document.body.append(i), i.showModal();
    }
  });
  function No(e) {
    const t = ye(), n = new Set(t.filter((b) => e.includes(b)));
    if (N || !n.size || n.size >= t.length) return;
    me();
    const i = t.filter((b) => !n.has(b)), a = i[Math.min(t.indexOf(R), i.length - 1)], l = [...x].filter(([, b]) => n.has(b.get("slide") || "first") && (!b.get("kind") || b.get("kind") === "text")).map(([b]) => k.getXmlFragment("slide-text-" + b));
    for (const b of l) D?.addToScope(b);
    yt([a]), D?.stopCapturing(), k.transact(() => {
      x.forEach((b, p) => {
        n.has(b.get("slide") || "first") && x.delete(p);
      });
      for (const b of l) b.length && b.delete(0, b.length);
      K.size || t.forEach((b, p) => K.set(b, p));
      for (const b of n)
        K.delete(b), Z.delete(b), ne.delete(b);
    }), D?.stopCapturing(), he(), Lt();
  }
  r("save-layout").disabled = typeof d.onSaveLayout != "function", r("save-layout").addEventListener("click", () => d.onSaveLayout?.());
  function vt(e) {
    return typeof e == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(e) ? e : "";
  }
  async function hn(e) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(e.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
    const t = await new Promise((i, a) => {
      const l = new FileReader();
      l.onload = () => i(l.result), l.onerror = () => a(l.error || new Error("Could not read the image.")), l.onabort = () => a(new Error("Image reading was cancelled.")), l.readAsDataURL(e);
    });
    if (!vt(t)) throw new Error("Unsupported image data.");
    const n = new Image();
    return n.src = t, await n.decode(), { source: t, image: n };
  }
  r("image-description").addEventListener("input", (e) => {
    const t = x.get(A);
    N || w.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || t.set("alt", e.target.value.slice(0, 2e3));
  }), r("replace-image").addEventListener("click", () => {
    const e = x.get(A);
    N || w.size !== 1 || e?.get("kind") !== "image" || e.get("locked") === !0 || (be = { document: k, id: A }, r("replace-image-file").click());
  }), r("replace-image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0], n = be;
    if (be = null, !(!t || !n))
      try {
        const { source: i, image: a } = await hn(t), l = x.get(n.id);
        if (k !== n.document || l?.get("kind") !== "image") throw new Error("The original image is no longer available.");
        if (N || l.get("locked") === !0) throw new Error("Return to editing and unlock the image before replacing it.");
        D?.stopCapturing(), k.transact(() => {
          if (l.set("source", i), l.set("imageRatio", a.naturalWidth / a.naturalHeight), l.set("aspectRatio", l.get("width") / l.get("height")), l.delete("cropImageWidth"), l.delete("cropImageHeight"), l.get("imageFit") === "cover") {
            const b = Math.max(l.get("width"), l.get("height") * a.naturalWidth / a.naturalHeight);
            l.set("cropImageWidth", b), l.set("cropImageHeight", b * a.naturalHeight / a.naturalWidth);
          }
        }), D?.stopCapturing(), $("Image replaced.");
      } catch (i) {
        console.error("Slides image replacement failed:", i), $("Could not replace image: " + i.message, "error");
      } finally {
        e.target.value = "";
      }
  }), r("add-image").addEventListener("click", () => {
    try {
      ie.image();
    } catch (e) {
      $("Could not open image picker: " + e.message, "error");
    }
  }), r("image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0];
    if (!t) return;
    const n = k, i = R;
    try {
      const { source: a, image: l } = await hn(t);
      if (k !== n || !ye().includes(i)) throw new Error("The destination slide is no longer open.");
      if (N) throw new Error("Return to editing before adding an image.");
      R = i;
      const b = Math.min(1, 800 / l.naturalWidth, 500 / l.naturalHeight), p = Math.max(1, Math.round(l.naturalWidth * b)), z = Math.max(1, Math.round(l.naturalHeight * b)), B = Ze();
      Re(B, (S - p) / 2, (C - z) / 2, p, z, a, t.name), ke(B), $("Image added");
    } catch (a) {
      console.error("Slides image could not load:", a), $("Image could not load: " + a.message, "error");
    } finally {
      e.target.value = "";
    }
  });
  function mn() {
    if (!(N || !w.size))
      try {
        const e = new c.Doc(), t = je().filter((i) => w.has(i)).map((i, a) => {
          const l = k.getXmlFragment("slide-text-" + i).toArray().map((b) => b.clone());
          return l.length && e.getXmlFragment("text-" + a).insert(0, l), { data: x.get(i).toJSON(), index: a };
        }), n = new Set(t.flatMap((i) => i.data.referenceUrls || []));
        for (const i of Gt()) n.has(i.url) && e.getMap("clist_refs").set(i.url, JSON.stringify(i));
        return J?.document.destroy(), J = { document: e, items: t, sourceDocument: k, sourceSlide: R, pastes: 0, token: crypto.randomUUID() }, r("paste-objects").disabled = !1, $("Copied " + t.length + " object" + (t.length === 1 ? "." : "s.")), !0;
      } catch (e) {
        return console.error("Slides object copy failed:", e), $("Could not copy objects: " + e.message, "error"), !1;
      }
  }
  function Bn() {
    if (!(N || !J?.items.length)) {
      me();
      try {
        const e = $t(J.items.map((p) => p.data)), t = J.cut && J.pastes === 0 ? 0 : J.sourceDocument === k && J.sourceSlide === R ? 28 * (J.pastes + 1) : 28 * J.pastes, n = Math.max(-e.x, Math.min(S - e.x - e.width, t)), i = Math.max(-e.y, Math.min(C - e.y - e.height, t)), a = Math.max(-1, ...je().map((p) => Ve(x.get(p)))), l = /* @__PURE__ */ new Map(), b = J.items.map((p, z) => {
          const B = Ze(), j = new c.Map(Object.entries({ ...fn(p.data, l), slide: R, x: p.data.x + n, y: p.data.y + i, layer: a + z + 1 })), U = k.getXmlFragment("slide-text-" + B);
          D?.addToScope(U);
          const G = J.document.getXmlFragment("text-" + p.index).toArray().map((le) => le.clone());
          return { id: B, box: j, fragment: U, text: G };
        });
        D?.stopCapturing(), k.transact(() => {
          J.document.getMap("clist_refs").forEach((p) => {
            try {
              Jt([JSON.parse(p)]);
            } catch {
            }
          });
          for (const p of b)
            x.set(p.id, p.box), p.text.length && p.fragment.insert(0, p.text);
        }), D?.stopCapturing(), J.pastes++, w.clear();
        for (const p of b) w.add(p.id);
        A = b[b.length - 1].id, ke(A, !1, !0), u.tabIndex = -1, u.focus({ preventScroll: !0 }), $("Pasted " + b.length + " object" + (b.length === 1 ? "." : "s."));
      } catch (e) {
        console.error("Slides object paste failed:", e), $("Could not paste objects: " + e.message, "error");
      }
    }
  }
  function Un(e = null) {
    if (!(N || !w.size)) {
      if (_e()) {
        $("Unlock selected objects before cutting.", "error");
        return;
      }
      if (mn())
        try {
          e && qn(e), J.cut = !0;
          const t = w.size;
          D?.stopCapturing(), gn(), D?.stopCapturing(), u.tabIndex = -1, u.focus({ preventScroll: !0 }), $("Cut " + t + " object" + (t === 1 ? "." : "s."));
        } catch (t) {
          console.error("Slides object cut failed:", t), $("Could not cut objects: " + t.message, "error");
        }
    }
  }
  r("cut-objects").addEventListener("click", () => Un()), r("copy-objects").addEventListener("click", mn), r("paste-objects").addEventListener("click", Bn);
  function bn(e) {
    return e.isContentEditable || !!e.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function qn(e) {
    e.clipboardData.setData("application/x-clist-slide-objects", J.token), e.clipboardData.setData("text/plain", J.items.map((t) => J.document.getXmlFragment("text-" + t.index).toString().replace(/<[^>]*>/g, " ") || t.data.alt || "Slide object").join(`
`)), e.preventDefault(), e.stopImmediatePropagation();
  }
  u.addEventListener("copy", (e) => {
    if (!(N || bn(e.target) || !w.size || !e.clipboardData) && mn())
      try {
        qn(e);
      } catch (t) {
        console.error("Slides clipboard write failed:", t), $("Could not write objects to clipboard: " + t.message, "error");
      }
  }, !0);
  function Hn(e) {
    if (N || !w.size || !e.clipboardData || !u.getClientRects().length) return;
    const t = e.target === document.body || e.target === document.documentElement || e.target === document;
    !u.contains(e.target) && !(t && u.contains(document.activeElement)) || bn(e.target) || document.activeElement?.closest?.("input, textarea, select") || (e.preventDefault(), e.stopImmediatePropagation(), Un(e));
  }
  document.addEventListener("cut", Hn, !0);
  function Wn(e) {
    if (N || !e.clipboardData || !u.getClientRects().length) return;
    const t = u.contains(e.target), n = e.target === document.body || e.target === document.documentElement || e.target === document;
    if (!t && !(xe && n) || !t && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]') || e.target.closest?.("input, textarea, select")) return;
    const i = e.target.closest?.(".slide-object");
    if (bn(e.target) && i && w.has(i.dataset.id) && X === i.dataset.id) return;
    const l = e.clipboardData.getData("application/x-clist-slide-objects");
    if (l && l === J?.token) {
      e.preventDefault(), e.stopImmediatePropagation(), Bn();
      return;
    }
    const b = e.clipboardData.getData("text/plain");
    if (b) {
      e.preventDefault(), e.stopImmediatePropagation();
      try {
        me(), D?.stopCapturing();
        const p = Ze(), z = b.replace(/\r\n?/g, `
`).split(`
`).map((le) => ({
          type: "paragraph",
          content: le ? [{ type: "text", text: le }] : []
        })), B = z.reduce((le, we) => le + Math.max(1, Math.ceil((we.content[0]?.text.length || 0) / 45)), 0), j = 690, U = Math.min(500, Math.max(100, B * 42)), G = Ae?.slide === R ? Ae : { x: 160, y: 160 };
        Re(p, Math.max(0, Math.min(S - j, G.x)), Math.max(0, Math.min(C - U, G.y)), j, U), V.get(p).editor.commands.setContent({ type: "doc", content: z }), D?.stopCapturing(), ke(p), V.get(p).editor.commands.focus("end"), $("Pasted text into a new text box.");
      } catch (p) {
        console.error("Slides text paste failed:", p), $("Could not paste text: " + p.message, "error");
      }
    }
  }
  document.addEventListener("paste", Wn, !0);
  function Xn(e) {
    const t = F.getBoundingClientRect();
    t.width <= 0 || t.height <= 0 || e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom || (Ae = { slide: R, x: Math.round((e.clientX - t.left) * S / t.width), y: Math.round((e.clientY - t.top) * C / t.height) });
  }
  u.addEventListener("pointermove", Xn), Ce = Ko(u, F, {
    views: () => [...V.values()],
    selected: () => [...w].map((e) => V.get(e)).filter(Boolean),
    presenting: () => N,
    size: (e) => bt(e).size,
    apply: (e) => {
      e.length && (D?.stopCapturing(), k.transact(() => {
        for (const { box: t, size: n } of e) t.set("fontSize", n);
      }), D?.stopCapturing());
    }
  }), Ie = Go(u, F, {
    selected: () => [...w],
    slideId: () => R,
    objects: () => je().map((e) => ({ id: e, ...Vt(x.get(e).toJSON()) })),
    select: (e) => {
      w.clear();
      for (const t of e) V.has(t) && w.add(t);
      ke(e.at(-1) || null, !1, !0);
    }
  }), u.addEventListener("pointerdown", (e) => {
    const t = e.target;
    e.button !== 0 || N || !t.closest?.(".canvas-space") || t.closest(".slide-object, input, textarea, select, button, a") || (e.preventDefault(), xe = !0, Xn(e), me(), t === F && Ie.begin(e), e.shiftKey || ke(null), X = null, u.contains(document.activeElement) && document.activeElement.blur?.(), window.getSelection()?.removeAllRanges(), u.tabIndex = -1, u.focus({ preventScroll: !0 }));
  }, !0);
  function $n(e) {
    if (N) return;
    const t = M.get(e);
    if (!t) {
      $("This shape is not available in the catalog.", "error");
      return;
    }
    const n = Ze(), { width: i, height: a } = t, l = new c.Map(Object.entries({ ...In(t), slide: R, x: Math.min(160, S - i), y: Math.min(180, C - a), width: i, height: a, rotation: 0, layer: Math.max(-1, ...je().map((b) => Ve(x.get(b)))) + 1 }));
    x.set(n, l), ke(n), V.get(n).node.focus({ preventScroll: !0 });
  }
  function Ze() {
    return `box-${crypto.randomUUID()}`;
  }
  r("add-text").addEventListener("click", () => {
    const e = Ze();
    Re(e, 160, 220, 430, 130), ke(e), V.get(e)?.editor.commands.focus();
  }), r("duplicate").addEventListener("click", () => {
    if (N || !A) return;
    const e = A, t = x.get(e), n = Ze(), i = new c.Map(Object.entries({ ...t.toJSON(), locked: !1, x: Math.min(S - t.get("width"), t.get("x") + 28), y: Math.min(C - t.get("height"), t.get("y") + 28), layer: Math.max(...je().map((b) => Ve(x.get(b)))) + 1 }));
    i.delete("groupId");
    const a = k.getXmlFragment("slide-text-" + n);
    D?.addToScope(a);
    const l = k.getXmlFragment("slide-text-" + e).toArray().map((b) => b.clone());
    k.transact(() => {
      x.set(n, i), l.length && a.insert(0, l);
    }), ke(n);
  }), r("delete").addEventListener("click", gn), r("bold").addEventListener("click", () => {
    A && V.get(A)?.editor?.chain().focus().toggleBold().run();
  }), r("italic").addEventListener("click", () => {
    A && V.get(A)?.editor?.chain().focus().toggleItalic().run();
  }), r("bullet-list").addEventListener("click", () => {
    !N && A && V.get(A)?.editor?.chain().focus().toggleBulletList().run();
  }), r("ordered-list").addEventListener("click", () => {
    !N && A && V.get(A)?.editor?.chain().focus().toggleOrderedList().run();
  });
  function Vn(e) {
    try {
      const t = new URL(e);
      return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
    } catch {
      return !1;
    }
  }
  function jt() {
    r("link-controls").hidden = !0, Ne = null;
  }
  r("edit-link").addEventListener("click", () => {
    const e = V.get(A)?.editor;
    if (!(N || !e)) {
      if (e.state.selection.empty && !e.isActive("link")) {
        $("Select the text to link first.", "error");
        return;
      }
      Ne = A, r("link-url").value = e.getAttributes("link").href || "", r("link-controls").hidden = !1, r("link-url").focus();
    }
  }), r("cancel-link").addEventListener("click", jt), r("apply-link").addEventListener("click", () => {
    const e = V.get(Ne)?.editor;
    if (N || !e) {
      jt();
      return;
    }
    const t = r("link-url").value.trim();
    if (!Vn(t)) {
      $("Enter an http, https, mailto, or tel URL.", "error");
      return;
    }
    try {
      D?.stopCapturing(), e.chain().focus().extendMarkRange("link").setLink({ href: t }).run(), D?.stopCapturing(), jt();
    } catch (n) {
      console.error("Slides link failed:", n), $("Could not apply link: " + n.message, "error");
    }
  }), r("remove-link").addEventListener("click", () => {
    const e = V.get(A)?.editor;
    if (!(N || !e))
      try {
        e.chain().focus().extendMarkRange("link").unsetLink().run(), jt();
      } catch (t) {
        console.error("Slides unlink failed:", t), $("Could not remove link: " + t.message, "error");
      }
  }), u.addEventListener("click", (e) => {
    const t = e.target.closest?.(".text-content a");
    if (!N || !t) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const n = t.getAttribute("href") || "";
    Vn(n) ? window.open(n, "_blank", "noopener,noreferrer") : (console.error("Slides blocked unsupported link:", n), r("presentation-status").textContent = "This link has an unsupported URL.");
  }, !0);
  function Kn(e) {
    if (N || _e() || !A) return;
    const t = je(), n = t.indexOf(A);
    n < 0 || !t[n + e] || ([t[n], t[n + e]] = [t[n + e], t[n]], k.transact(() => t.forEach((i, a) => x.get(i).set("layer", a)), "layer"));
  }
  r("bring-forward").addEventListener("click", () => Kn(1)), r("send-backward").addEventListener("click", () => Kn(-1));
  function jo(e, t) {
    const n = x.get(A);
    N || w.size !== 1 || n?.get("kind") !== "image" || n.get("locked") === !0 || k.transact(() => {
      t === "cover" && n.get("imageFit") !== "cover" ? (n.delete("cropImageWidth"), n.delete("cropImageHeight"), n.set(e, t), an(n)) : n.set(e, t);
    });
  }
  r("image-fit").addEventListener("change", (e) => {
    ["contain", "cover"].includes(e.target.value) && jo("imageFit", e.target.value);
  });
  function Gn() {
    const e = A, t = x.get(e), n = V.get(e);
    if (N || w.size !== 1 || t?.get("kind") !== "image" || t.get("locked") || !n) return;
    q?.destroy(), me();
    const i = vt(t.get("source"));
    if (!i) return;
    const a = k, l = R, b = d.captureSession?.(), p = JSON.stringify(t.toJSON()), z = Number(t.get("imageRatio")) || t.get("width") / t.get("height"), B = qo(t, z), j = Math.min(S, C * z, t.get("width") / B.width), U = j / z, G = Math.max(0, Math.min(S - j, t.get("x") - j * B.x)), le = Math.max(0, Math.min(C - U, t.get("y") - U * B.y)), we = document.createElement("div");
    we.className = "slide-direct-crop", we.style.left = 100 * G / S + "%", we.style.top = 100 * le / C + "%", we.style.width = 100 * j / S + "%", we.addEventListener("pointerdown", (Oe) => Oe.stopPropagation()), F.append(we), n.content.style.visibility = "hidden", u.classList.add("cropping-image");
    const te = () => u.isConnected && !N && k === a && R === l && A === e && w.size === 1 && x.get(e) === t && JSON.stringify(t.toJSON()) === p && (!d.sessionCurrent || d.sessionCurrent(b));
    let De = null, Be = !1;
    const Qe = () => {
      Be || (Be = !0, De?.destroy(), we.remove(), n.content.style.visibility = "", u.classList.remove("cropping-image"), q = null);
    };
    q = { current: te, destroy: Qe }, De = bo({ container: we, actionsContainer: u.querySelectorAll(".slide-menu-bar")[1], source: i, ratio: z, initial: B, current: te, onCancel: Qe, onDone: (Oe) => {
      if (!te()) {
        Qe();
        return;
      }
      const ot = ["x", "y", "width", "height"].every((Le) => Math.abs(Oe[Le] - B[Le]) < 1e-8);
      if (Qe(), ot) return;
      const ze = An(Oe, j, U);
      D?.stopCapturing(), k.transact(() => {
        for (const [Le, Ke] of Object.entries(ze)) t.set(Le, Ke);
        t.set("x", G + j * Oe.x), t.set("y", le + U * Oe.y);
      }), D?.stopCapturing(), ke(e), $("Image cropped.");
    } });
  }
  r("crop-image").addEventListener("click", Gn);
  function yn(e) {
    const t = Number(e.get("aspectRatio"));
    return Number.isFinite(t) && t > 0 ? t : Number(e.get("width")) / Number(e.get("height")) || 1;
  }
  function Jn(e, t, n, i) {
    const a = Math.min(n, i * t), l = Math.max(Math.min(a, Math.max(1, t)), Math.min(a, e));
    return { width: l, height: l / t };
  }
  r("keep-aspect-ratio").addEventListener("change", (e) => {
    const t = x.get(A);
    N || w.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || k.transact(() => {
      e.target.checked && t.set("aspectRatio", t.get("width") / t.get("height")), t.set("keepAspectRatio", e.target.checked);
    });
  });
  for (const e of ["x", "y", "width", "height"])
    r("object-" + e).addEventListener("change", (t) => {
      const n = x.get(A);
      if (N || n?.get("locked") === !0 || !n) return;
      const i = Number(t.target.value), a = e === "x" ? S - 1 : e === "y" ? C - 1 : e === "width" ? S : C, l = e === "width" || e === "height" ? 1 : 0;
      if (t.target.value.trim() === "" || !Number.isInteger(i) || i < l || i > a) {
        $(e + " must be a whole number between " + l + " and " + a + ".", "error"), ke(A);
        return;
      }
      k.transact(() => {
        ["width", "height"].includes(e) && an(n);
        const b = n.get("imageFit") === "cover" ? Mt(n) : { width: S, height: C };
        if (n.get("kind") === "image" && n.get("keepAspectRatio") !== !1 && ["width", "height"].includes(e)) {
          const z = yn(n), B = Jn(e === "width" ? i : i * z, z, Math.min(S, b.width), Math.min(C, b.height));
          n.set("width", B.width), n.set("height", B.height), n.set("x", Math.min(n.get("x"), S - B.width)), n.set("y", Math.min(n.get("y"), C - B.height));
          return;
        }
        const p = e === "width" ? Math.min(i, b.width) : e === "height" ? Math.min(i, b.height) : i;
        n.set(e, p), e === "width" && n.set("x", Math.min(Number(n.get("x")) || 0, S - p)), e === "height" && n.set("y", Math.min(Number(n.get("y")) || 0, C - p)), e === "x" && n.set("x", Math.min(i, S - Number(n.get("width")))), e === "y" && n.set("y", Math.min(i, C - Number(n.get("height"))));
      }, "geometry");
    });
  r("object-rotation").addEventListener("change", (e) => {
    const t = x.get(A);
    if (N || t?.get("locked") === !0 || !t) return;
    const n = Number(e.target.value);
    if (e.target.value.trim() === "" || !Number.isFinite(n) || n < -180 || n > 180) {
      $("Rotation must be between -180 and 180 degrees.", "error"), ke(A);
      return;
    }
    t.set("rotation", n);
  });
  function Kt(e) {
    return e instanceof c.Map && e.get("kind") !== "image";
  }
  function Yn() {
    r("copy-format").disabled = N || w.size !== 1 || !Kt(x.get(A));
    const e = [...w].map((t) => x.get(t));
    r("paste-format").disabled = N || !ve || !e.length || _e() || !e.some(Kt);
  }
  r("copy-format").addEventListener("click", () => {
    const e = x.get(A);
    if (N || w.size !== 1 || !Kt(e)) return;
    const t = ut(e), n = bt(e);
    ve = {
      appearance: { fillEnabled: t.fill, fillColour: t.fillColour, borderEnabled: t.border, borderColour: t.borderColour, borderWidth: t.width },
      text: e.get("kind") === "shape" ? null : { fontFamily: n.family, fontSize: n.size, textColour: n.colour, textAlign: n.align }
    }, Yn(), $("Formatting copied. Select targets, then use Apply formatting.");
  }), r("paste-format").addEventListener("click", () => {
    if (N || !ve || _e()) return;
    const e = [...w].map((t) => x.get(t)).filter(Kt);
    e.length && (D?.stopCapturing(), k.transact(() => {
      for (const t of e) {
        const n = { ...ve.appearance, ...t.get("kind") === "shape" ? {} : ve.text || {} };
        for (const [i, a] of Object.entries(n)) t.set(i, a);
      }
    }), D?.stopCapturing(), $("Formatting applied to " + e.length + " object" + (e.length === 1 ? "." : "s.")));
  });
  function kt(e, t) {
    const i = x.get(A)?.get("kind") === "shape" && ["fillEnabled", "fillColour", "borderEnabled", "borderColour", "borderWidth"].includes(e);
    N || w.size !== 1 || !V.get(A)?.editor && !i || x.get(A).set(e, t);
  }
  for (const [e, t] of [["fill-enabled", "fillEnabled"], ["border-enabled", "borderEnabled"]])
    r(e).addEventListener("change", (n) => kt(t, n.target.checked));
  for (const [e, t] of [["fill-colour", "fillColour"], ["border-colour", "borderColour"]])
    r(e).addEventListener("change", (n) => {
      /^#[0-9a-f]{6}$/i.test(n.target.value) && kt(t, n.target.value);
    });
  r("border-width").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isInteger(t) || t < 1 || t > 20) {
      $("Border width must be a whole number between 1 and 20 pixels.", "error"), ke(A);
      return;
    }
    kt("borderWidth", t);
  }), r("font-family").addEventListener("change", (e) => {
    Object.prototype.hasOwnProperty.call(mt, e.target.value) && kt("fontFamily", e.target.value);
  }), r("font-size").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t) || t < 8 || t > 200) {
      $("Font size must be between 8 and 200 pixels.", "error"), ke(A);
      return;
    }
    kt("fontSize", t);
  }), r("text-colour").addEventListener("input", (e) => {
    /^#[0-9a-f]{6}$/i.test(e.target.value) && kt("textColour", e.target.value);
  }), r("text-align").addEventListener("change", (e) => {
    ["left", "center", "right", "justify"].includes(e.target.value) && kt("textAlign", e.target.value);
  });
  function It() {
    const e = L.has(r("slide-layout").value), t = L.get(r("slide-layout").value), n = typeof d.onRenameSavedLayout == "function" && typeof d.onDeleteSavedLayout == "function";
    r("saved-layout-hint").textContent = Xe ? "Layout dialog is open." : L.size ? e ? n ? "Selected saved layout: " + t.label : "Layout management is available inside CList." : "Select an entry under Saved layouts to rename or delete it." : "Use CList’s Save menu to save the current slide as a layout.", r("rename-layout").disabled = Xe || !e || typeof d.onRenameSavedLayout != "function", r("delete-layout").disabled = Xe || !e || typeof d.onDeleteSavedLayout != "function";
  }
  function _n(e) {
    const t = "user:" + e;
    L.delete(t);
    const n = r("slide-layout").querySelector("optgroup[data-saved-layouts]");
    (n && [...n.children].find((a) => a.value === t))?.remove(), n && !n.children.length && n.remove(), r("slide-layout").value || (r("slide-layout").value = h.keys().next().value), It();
  }
  async function Zn(e) {
    const t = L.get(r("slide-layout").value), n = e ? d.onDeleteSavedLayout : d.onRenameSavedLayout;
    if (!(N || Xe || !t || typeof n != "function")) {
      Xe = !0, It();
      try {
        const i = await n({ ...t });
        e && i === !0 ? _n(t.id) : !e && i && eo(i);
      } catch (i) {
        console.error("Saved layout management failed:", i), $("Could not " + (e ? "delete" : "rename") + " layout: " + i.message, "error");
      } finally {
        Xe = !1, It();
      }
    }
  }
  r("slide-layout").addEventListener("change", It), r("rename-layout").addEventListener("click", () => Zn(!1).catch((e) => {
    console.error("Layout rename failed:", e), $(e.message, "error");
  })), r("delete-layout").addEventListener("click", () => Zn(!0).catch((e) => {
    console.error("Layout deletion failed:", e), $(e.message, "error");
  }));
  function Io(e) {
    if (typeof e != "string" || !e.trim() || e.trim().length > 120) throw new Error("Enter a layout name of 1–120 characters.");
    const t = new c.Doc();
    try {
      t.getMap("slide-pages").set("first", 0), t.getMap("slide-backgrounds").set("first", At(R)), typeof ne.get(R) == "string" && t.getMap("slide-notes").set("first", ne.get(R));
      for (const l of je()) {
        const b = x.get(l), p = bt(b), z = ut(b), B = { ...b.toJSON(), slide: "first", fontFamily: p.family, fontSize: p.size, textColour: p.colour, fillColour: z.fillColour, borderColour: z.borderColour };
        B.kind === "shape" && (B.shapeDefinition = structuredClone(Bt(x.get(l)))), t.getMap("slide-objects").set(l, new c.Map(Object.entries(B)));
        const j = k.getXmlFragment("slide-text-" + l).toArray().map((U) => U.clone());
        j.length && t.getXmlFragment("slide-text-" + l).insert(0, j);
      }
      const n = new Set(je().flatMap((l) => x.get(l).get("referenceUrls") || []));
      for (const l of Gt()) n.has(l.url) && t.getMap("clist_refs").set(l.url, JSON.stringify(l));
      const i = c.encodeStateAsUpdate(t);
      let a = "";
      for (const l of i) a += String.fromCharCode(l);
      return { format: "clist-slide-layout-v1", id: "saved-" + crypto.randomUUID(), label: e.trim(), update: btoa(a) };
    } finally {
      t.destroy();
    }
  }
  function Qn(e) {
    if (!e || e.format !== "clist-slide-layout-v1" || typeof e.id != "string" || !/^saved-[a-z0-9-]+$/.test(e.id) || typeof e.label != "string" || !e.label.trim() || e.label.length > 120 || typeof e.update != "string") throw new Error("Invalid saved slide layout.");
    const t = new c.Doc();
    try {
      c.applyUpdate(t, Uint8Array.from(atob(e.update), (i) => i.charCodeAt(0)));
      const n = t.getMap("slide-pages");
      if (n.size !== 1 || !n.has("first")) throw new Error("A saved layout must contain one slide.");
      return t.getMap("slide-objects").forEach((i) => {
        if (!(i instanceof c.Map) || (i.get("slide") || "first") !== "first" || !["x", "y", "width", "height"].every((a) => typeof i.get(a) == "number" && Number.isFinite(i.get(a))) || i.get("width") <= 0 || i.get("height") <= 0) throw new Error("Invalid object in saved slide layout.");
        i.get("kind") === "shape" && i.get("shapeDefinition") && tn(i.get("shapeDefinition"));
      }), t;
    } catch (n) {
      throw t.destroy(), n;
    }
  }
  function eo(e, { select: t = !1 } = {}) {
    Qn(e).destroy();
    const i = { format: e.format, id: e.id, label: e.label.trim(), update: e.update };
    L.set("user:" + i.id, i);
    let a = r("slide-layout").querySelector("optgroup[data-saved-layouts]");
    a || (a = document.createElement("optgroup"), a.label = "Saved layouts", a.dataset.savedLayouts = "", r("slide-layout").append(a));
    let l = [...a.children].find((b) => b.value === "user:" + i.id);
    return l || (l = document.createElement("option"), a.append(l)), l.value = "user:" + i.id, l.textContent = i.label, t && (r("slide-layout").value = l.value), It(), i;
  }
  function Po(e) {
    const t = Qn(e);
    try {
      const n = t.getMap("slide-objects"), i = /* @__PURE__ */ new Map(), a = [...n.entries()].sort(([p, z], [B, j]) => Ve(z) - Ve(j) || p.localeCompare(B)).map(([p, z]) => {
        const B = Ze(), j = fn(z.toJSON(), i), U = k.getXmlFragment("slide-text-" + B);
        return D?.addToScope(U), { id: B, data: j, fragment: U, text: t.getXmlFragment("slide-text-" + p).toArray().map((G) => G.clone()) };
      }), l = ye(), b = "slide-" + crypto.randomUUID();
      R = b, A = null, w.clear(), D?.stopCapturing(), k.transact(() => {
        K.size || K.set("first", 0), K.set(b, Math.max(...l.map((p) => K.get(p) || 0)) + 1), Z.set(b, t.getMap("slide-backgrounds").get("first") || "#ffffff"), ne.set(b, t.getMap("slide-notes").get("first") || ""), t.getMap("clist_refs").forEach((p) => {
          try {
            Jt([JSON.parse(p)]);
          } catch {
          }
        });
        for (const p of a)
          x.set(p.id, new c.Map(Object.entries({ ...p.data, slide: b }))), p.text.length && p.fragment.insert(0, p.text);
      }), D?.stopCapturing(), he();
    } finally {
      t.destroy();
    }
  }
  function Gt() {
    const e = [];
    return W.forEach((t) => {
      try {
        const n = En(JSON.parse(t));
        n && e.push(n);
      } catch {
      }
    }), e;
  }
  function Ft() {
    d.onReferencesChange?.(Gt());
  }
  function Jt(e) {
    for (const t of e || []) {
      const n = En(t);
      n && !W.has(n.url) && W.set(n.url, JSON.stringify(n));
    }
  }
  function Do(e, t = []) {
    if (N) throw new Error("Return to editing before importing content.");
    const n = [...new Map(t.map(En).filter(Boolean).map((l) => [l.url, l])).values()], i = Vo(e, n);
    me();
    const a = Ze();
    return D?.stopCapturing(), k.transact(() => {
      Re(a, 100, 120, 1e3, 460), x.get(a).set("referenceUrls", n.map((l) => l.url)), Jt(n);
    }), V.get(a).editor.commands.setContent(i), D?.stopCapturing(), ke(a), u.tabIndex = -1, u.focus({ preventScroll: !0 }), $("Content imported into a new text box" + (n.length ? " with source references." : ".")), a;
  }
  function zo() {
    Q.has("theme") || k.transact(() => Q.set("theme", structuredClone(Pe())), "init");
    const e = c.encodeStateAsUpdate(k), t = [];
    for (let n = 0; n < e.length; n += 32768) t.push(String.fromCharCode(...e.subarray(n, n + 32768)));
    return { format: "clist-slides-yjs-v1", document: r("doc-name").value, update: btoa(t.join("")) };
  }
  async function Fo(e, t) {
    if (O) throw new Error("Disconnect from collaboration before importing a PowerPoint file.");
    if (N) throw new Error("Return to editing before importing a PowerPoint file.");
    const n = await si(e, t);
    if (O || N) throw new Error("Return to local editing before completing the import.");
    const i = new c.Doc();
    function a(l) {
      const b = new c.XmlElement(l.type);
      for (const [j, U] of Object.entries(l.attrs || {})) b.setAttribute(j, U);
      const p = [];
      let z = [];
      const B = () => {
        if (z.length) {
          const j = new c.XmlText();
          j.applyDelta(z), p.push(j), z = [];
        }
      };
      for (const j of l.content || [])
        if (j.type === "text") {
          const U = Object.fromEntries((j.marks || []).map((G) => [G.type, G.attrs || {}]));
          z.push({ insert: j.text, attributes: U });
        } else
          B(), p.push(a(j));
      return B(), p.length && b.insert(0, p), b;
    }
    try {
      const l = ye(), b = i.getMap("pages"), p = i.getMap("objects"), z = Math.max(...l.map((j) => K.get(j) || 0)) + 1;
      for (const [j, U] of n.slides.entries()) {
        const G = "slide-" + crypto.randomUUID();
        b.set(G, { order: z + j, background: U.background, notes: U.notes }), U.objects.forEach((le, we) => {
          const te = Ze(), { text: De, ...Be } = le;
          Be.shapeDefinition && (Be.shapeDefinition = tn(Be.shapeDefinition)), p.set(te, { ...Be, slide: G, layer: we }), De && i.getXmlFragment("slide-text-" + te).insert(0, De.map(a));
        });
      }
      const B = [...p].map(([j, U]) => {
        const G = U.kind === "text" ? k.getXmlFragment("slide-text-" + j) : null;
        return G && D?.addToScope(G), { id: j, box: new c.Map(Object.entries(U)), fragment: G, text: G ? i.getXmlFragment("slide-text-" + j).toArray().map((le) => le.clone()) : [] };
      });
      return me(), D?.stopCapturing(), R = b.keys().next().value, A = null, w.clear(), k.transact(() => {
        K.size || K.set("first", 0);
        for (const [j, U] of b)
          K.set(j, U.order), Z.set(j, U.background), U.notes && ne.set(j, U.notes);
        for (const j of B)
          x.set(j.id, j.box), j.fragment && j.text.length && j.fragment.insert(0, j.text);
      }), D?.stopCapturing(), he(), $(n.slides.length + " PowerPoint slides imported. Use Undo to remove the import."), { count: n.slides.length, warnings: n.warnings };
    } finally {
      i.destroy();
    }
  }
  function To(e) {
    if (O) throw new Error("Disconnect from Hocuspocus before replacing the document");
    if (!e || e.format !== "clist-slides-yjs-v1" || typeof e.update != "string")
      throw new Error("Unsupported document format");
    const t = atob(e.update), n = Uint8Array.from(t, (a) => a.charCodeAt(0)), i = new c.Doc();
    try {
      c.applyUpdate(i, n);
    } catch (a) {
      throw i.destroy(), a;
    }
    k.off("beforeObserverCalls", qt), x.unobserveDeep(he), K.unobserve(he), Q.unobserve(he), Z.unobserve(he), W.unobserve(Ft), ne.unobserve(zt), k.off("update", Nt), k.off("update", Te);
    for (const a of V.values())
      a.editor?.destroy(), a.node.remove();
    V.clear(), A = null, w.clear(), X = null, me(), oo(), k.destroy(), k = i, x = k.getMap("slide-objects"), K = k.getMap("slide-pages"), Z = k.getMap("slide-backgrounds"), ne = k.getMap("slide-notes"), W = k.getMap("clist_refs"), Q = k.getMap("slide-design"), R = ye()[0], So(), k.on("beforeObserverCalls", qt), x.observeDeep(he), K.observe(he), Q.observe(he), Z.observe(he), W.observe(Ft), ne.observe(zt), k.on("update", Nt), k.on("update", Te), de = !0, e.document && (r("doc-name").value = e.document), he(), no(), Ft(), Te();
  }
  function Pt() {
    H++;
    const e = O;
    O = null, fe = !1, e?.destroy(), $("Local only"), r("connect").textContent = "Connect";
  }
  async function wn() {
    Pt();
    const e = H;
    try {
      const t = r("server-url").value.trim();
      let n = r("doc-name").value.trim();
      if (!/^wss?:\/\//i.test(t) || !n) throw new Error("Enter a WebSocket URL and document name");
      if (d.resolveDocumentName && (n = await d.resolveDocumentName(n)), e !== H) return;
      r("doc-name").value = n;
      const i = typeof d.parameters == "function" ? d.parameters() : d.parameters;
      O = new f({
        url: t,
        name: n,
        document: k,
        token: d.token || r("token").value || void 0,
        parameters: i || {},
        onStatus: ({ status: a }) => {
          e === H && $(a === "connected" ? "Synchronizing..." : a);
        },
        onSynced: ({ state: a }) => {
          e !== H || a === !1 || (fe = !0, d.seed !== !1 && xt(), $("Synced", "connected"));
        },
        onAuthenticationFailed: ({ reason: a } = {}) => {
          if (e !== H) return;
          const l = typeof a == "string" && a.trim() ? a.trim() : "The server did not provide a reason.";
          console.error("Slides collaboration authentication failed:", l), Pt(), $(`Authentication failed: ${l}`, "error");
        },
        onDisconnect: () => {
          e === H && (fe = !1, $("Disconnected", "error"));
        }
      }), r("connect").textContent = "Disconnect", $("Connecting...");
    } catch (t) {
      if (e !== H) return;
      console.error("Slides connection failed:", t), Pt(), $(t.message, "error");
    }
  }
  function Dt(e) {
    console.error("Slides connection failed:", e), $(e.message, "error");
  }
  r("connect").addEventListener("click", () => {
    O ? Pt() : wn().catch(Dt);
  });
  function Yt() {
    r("undo").disabled = N || !D?.undoStack.length, r("redo").disabled = N || !D?.redoStack.length;
  }
  function to(e) {
    e.local && e.origin !== "init" && !Se && D.trackedOrigins.add(e.origin);
  }
  function no() {
    D = new c.UndoManager([...k.share.values()], {
      trackedOrigins: /* @__PURE__ */ new Set([null, "geometry", "layer"]),
      captureTransaction: (e) => e.local && e.origin !== "init" && !Se
    }), k.on("beforeTransaction", to);
    for (const e of ["stack-item-added", "stack-item-popped", "stack-cleared", "stack-item-updated"]) D.on(e, Yt);
    Yt();
  }
  function oo() {
    k.off("beforeTransaction", to), D?.destroy(), D = null;
  }
  function xn(e = !1) {
    if (!(N || !D)) {
      me(), D.stopCapturing();
      try {
        e ? D.redo() : D.undo(), he(), Yt();
      } catch (t) {
        console.error("Slides history failed:", t), $("Could not " + (e ? "redo" : "undo") + ": " + t.message, "error");
      }
    }
  }
  function Ro(e) {
    if (N || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !A) return;
    const t = e.target;
    if (t.isContentEditable || !!t.closest?.('[contenteditable="true"]')) {
      e.key === "Escape" && (e.preventDefault(), e.stopImmediatePropagation(), V.get(A)?.node.focus({ preventScroll: !0 }), X = null);
      return;
    }
    if (t.closest?.("input, textarea, select, button")) return;
    if (_e() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault(), e.stopImmediatePropagation(), $("Unlock selected objects before moving or deleting.", "error");
      return;
    }
    const i = V.get(A);
    if (!i) return;
    if (e.key === "Enter" && i.editor && w.size === 1) {
      e.preventDefault(), i.editor.commands.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(), e.stopImmediatePropagation(), D?.stopCapturing(), gn(), D?.stopCapturing(), u.tabIndex = -1, u.focus({ preventScroll: !0 });
      return;
    }
    const a = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!a) return;
    e.preventDefault(), e.stopImmediatePropagation(), e.repeat || D?.stopCapturing();
    const l = e.shiftKey ? 10 : 1, b = [...w].map((j) => ({ id: j, ...x.get(j).toJSON() })), p = $t(b), z = Math.max(-p.x, Math.min(S - p.x - p.width, a[0] * l)), B = Math.max(-p.y, Math.min(C - p.y - p.height, a[1] * l));
    k.transact(() => {
      for (const j of b) {
        const U = x.get(j.id);
        U.set("x", j.x + z), U.set("y", j.y + B);
      }
    }, "geometry");
  }
  function Oo(e) {
    if (e.target.closest?.(".slide-crop-stage") || (Ro(e), N || !(e.ctrlKey || e.metaKey) || e.altKey || !u.contains(e.target))) return;
    const t = e.key.toLowerCase();
    t !== "z" && t !== "y" || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && e.target !== r("speaker-notes") || (e.preventDefault(), e.stopImmediatePropagation(), xn(t === "y" || e.shiftKey));
  }
  function _t() {
    D?.stopCapturing();
  }
  r("undo").addEventListener("click", () => xn()), r("redo").addEventListener("click", () => xn(!0)), u.addEventListener("click", _t, !0), u.addEventListener("click", _t), u.addEventListener("change", _t, !0), u.addEventListener("change", _t), u.addEventListener("keydown", Oo, !0);
  function Tt(e, t) {
    const n = t.createElement("div");
    n.className = "slide presenter-slide", n.style.backgroundColor = At(e), n.setAttribute("aria-label", "Slide preview");
    for (const i of je(e)) {
      const a = x.get(i), l = t.createElement("div"), b = t.createElement("div");
      if (l.className = a.get("kind") === "shape" ? "slide-object shape-object" : a.get("kind") === "image" ? "slide-object image-object" : "slide-object", l.style.left = 100 * a.get("x") / S + "%", l.style.top = 100 * a.get("y") / C + "%", l.style.width = 100 * a.get("width") / S + "%", l.style.height = 100 * a.get("height") / C + "%", l.style.transform = "rotate(" + (Number(a.get("rotation")) || 0) + "deg)", l.style.zIndex = String(je(e).indexOf(i)), a.get("kind") === "image") {
        b.className = "image-content";
        const p = t.createElement("img");
        p.src = vt(a.get("source")), p.alt = typeof a.get("alt") == "string" ? a.get("alt") : "", sn(p, a, !0), b.append(p);
      } else if (a.get("kind") === "shape") {
        b.className = "shape-content";
        const p = t.createElementNS("http://www.w3.org/2000/svg", "svg");
        Ut(p, a), b.append(p);
      } else {
        b.className = "text-content";
        const p = bt(a), z = ut(a), B = t.createElement("div");
        l.style.setProperty("--slide-font-size", p.size / 12.8 + "cqw"), l.style.fontFamily = mt[p.family], l.style.color = p.colour, l.style.textAlign = p.align, b.style.backgroundColor = z.fill ? z.fillColour : "transparent", b.style.border = z.border ? z.width / 12.8 + "cqw solid " + z.borderColour : "none", B.className = "tiptap", B.append(fo(k.getXmlFragment("slide-text-" + i), t)), b.append(B);
      }
      l.append(b), n.append(l);
    }
    return n;
  }
  function Bo() {
    return {
      title: d.presentationTitle?.() || r("doc-name").value || "CList presentation",
      slides: ye().map((e) => ({
        background: At(e),
        notes: typeof ne.get(e) == "string" ? ne.get(e) : "",
        objects: je(e).map((t) => {
          const n = x.get(t), i = n.get("kind") || "text", a = {
            id: t,
            kind: i,
            x: Number(n.get("x")) || 0,
            y: Number(n.get("y")) || 0,
            width: Number(n.get("width")),
            height: Number(n.get("height")),
            rotation: Number(n.get("rotation")) || 0,
            style: ut(n)
          };
          if (!(a.width > 0 && a.height > 0)) throw new Error("An object has invalid dimensions: " + t);
          if (i === "text")
            a.format = bt(n), a.runs = ti(fo(k.getXmlFragment("slide-text-" + t), document), a.format.size);
          else if (i === "image") {
            if (a.source = vt(n.get("source")), !a.source) throw new Error("An image has no valid source: " + t);
            a.alt = typeof n.get("alt") == "string" ? n.get("alt") : "";
            const l = rn(n);
            a.crop = { ...l }, l.fit === "cover" && Object.assign(a.crop, Mt(n));
          } else if (i === "shape") {
            a.definition = structuredClone(Bt(n));
            const l = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Ut(l, n), l.setAttribute("width", a.width), l.setAttribute("height", a.height);
            for (const b of l.querySelectorAll("[vector-effect]")) b.style.strokeWidth = (a.style.border ? Math.min(a.style.width, a.width, a.height) : 0) + "px";
            a.source = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(l));
          } else throw new Error("Unsupported slide object: " + i);
          return a;
        })
      }))
    };
  }
  function vn() {
    if (!oe) return;
    if (oe.closed) {
      oe = null;
      return;
    }
    const e = ye(), t = e.indexOf(R);
    oe.update({ id: R, nextId: e[t + 1], index: t, total: e.length, notes: typeof ne.get(R) == "string" ? ne.get(R) : "", presenting: N });
  }
  function io() {
    try {
      if (oe && !oe.closed) {
        vn(), oe.focus();
        return;
      }
      oe = Zo({
        renderSlide: Tt,
        navigate: Zt,
        jump: (e) => {
          const t = ye();
          R = e === "first" ? t[0] : t[t.length - 1], A = null, w.clear(), he();
        },
        present: ro,
        end: Qt
      }), vn();
    } catch (e) {
      console.error("Presenter view could not open:", e), $("Presenter view could not open: " + e.message, "error"), N && (r("presentation-status").textContent = e.message);
    }
  }
  r("presenter-view").addEventListener("click", io), r("presentation-presenter-view").addEventListener("click", io);
  function Zt(e) {
    const t = ye(), n = t[t.indexOf(R) + e];
    n && (R = n, A = null, w.clear(), he());
  }
  function kn(e) {
    tt?.presenting(e), N = e, jt(), Yt(), me(), ke(null), u.classList.toggle("presenting", e), Ye.update(), r("presentation-controls").hidden = !e;
    for (const t of V.values()) t.editor?.setEditable(!e);
    e ? (ae = document.activeElement, u.tabIndex = -1, u.focus()) : (ae?.focus?.(), ae = null), Nt();
  }
  async function ro() {
    kn(!0), r("presentation-status").textContent = "";
    try {
      u.requestFullscreen && await u.requestFullscreen();
    } catch (e) {
      console.error("Slides fullscreen failed:", e), r("presentation-status").textContent = "Full screen unavailable. Presenting in this window.";
    }
  }
  async function Qt() {
    kn(!1);
    try {
      document.fullscreenElement === u && await document.exitFullscreen();
    } catch (e) {
      console.error("Slides fullscreen exit failed:", e), $("Could not leave full screen. Press Escape.", "error");
    }
  }
  function ao(e) {
    if (!(!N || e.altKey || e.ctrlKey || e.metaKey)) {
      if (e.key === "Escape")
        e.preventDefault(), Qt().catch(Dt);
      else if (["ArrowRight", "ArrowDown", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", " "].includes(e.key)) {
        if (e.key === " " && e.target?.tagName === "BUTTON") return;
        if (e.preventDefault(), e.key === "Home" || e.key === "End") {
          const t = ye();
          R = e.key === "Home" ? t[0] : t[t.length - 1], he();
        } else Zt(["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 1);
      }
    }
  }
  function so() {
    N && document.fullscreenElement !== u && kn(!1);
  }
  r("present").addEventListener("click", () => ro().catch(Dt)), r("exit-presentation").addEventListener("click", () => Qt().catch(Dt)), r("previous-slide").addEventListener("click", () => Zt(-1)), r("next-slide").addEventListener("click", () => Zt(1)), document.addEventListener("keydown", ao), document.addEventListener("fullscreenchange", so);
  function lo(e) {
    return typeof e.toDelta == "function" ? e.toDelta().map((t) => typeof t.insert == "string" ? t.insert : "").join("") : typeof e.toArray == "function" ? e.toArray().map(lo).join(e.nodeName === "paragraph" ? "" : `
`) : "";
  }
  return ie = Ho({
    root: u,
    shapes: [...M.values()],
    readImage: hn,
    openModal: (e) => {
      if (!d.openInsertModal) throw new Error("This host does not provide the insertion modal.");
      return d.openInsertModal(e);
    },
    capture() {
      const e = k, t = R, n = d.captureSession?.();
      return () => u.isConnected && !N && k === e && R === t && ye().includes(t) && (!d.sessionCurrent || d.sessionCurrent(n));
    },
    insertShape: $n,
    insertImage(e) {
      me();
      const t = Ze();
      D?.stopCapturing(), k.transact(() => {
        Re(t, (S - e.width) / 2, (C - e.height) / 2, e.width, e.height, e.source, e.alt);
        const n = x.get(t);
        n.set("imageRatio", e.image.naturalWidth / e.image.naturalHeight);
        for (const i of ["imageFit", "cropX", "cropY", "cropImageWidth", "cropImageHeight", "aspectRatio"]) n.set(i, e[i]);
      }), D?.stopCapturing(), ke(t), $("Image added");
    },
    log: (e) => console.error("Slides insertion failed:", e)
  }), ee = Wo(u, () => !N, () => {
    try {
      ie.shape();
    } catch (e) {
      $("Could not open shape picker: " + e.message, "error");
    }
  }), re = Xo({
    root: u,
    canChange: () => !N,
    selectSlide: Xt,
    getSlides: () => ye().map((e) => ({
      id: e,
      active: e === R,
      text: je(e).filter((t) => !["image", "shape"].includes(x.get(t)?.get("kind"))).map((t) => lo(k.getXmlFragment("slide-text-" + t))).filter(Boolean).join(`

`)
    }))
  }), d.url ? wn().catch(Dt) : d.seed !== !1 && xt(), he(), no(), It(), tt = pi({
    root: u,
    Y: c,
    getDocument: () => k,
    canEdit: () => !N,
    getEntries: () => ye().flatMap((e, t) => [...qe.get(e) || []].sort((n, i) => Ve(x.get(n)) - Ve(x.get(i)) || n.localeCompare(i)).filter((n) => !x.get(n).get("kind") || x.get(n).get("kind") === "text").map((n) => ({ id: n, slideId: e, slideNumber: t + 1, locked: x.get(n).get("locked") === !0, fragment: k.getXmlFragment("slide-text-" + n) }))),
    selectedText: () => {
      const e = V.get(A)?.editor;
      return e ? e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, `
`) : "";
    },
    jump: (e) => {
      gt = !0;
      try {
        me(), yt([e.entry.slideId]), he(), ke(e.entry.id);
        const t = V.get(e.entry.id);
        t?.editor && (t.editor.commands.setTextSelection({ from: e.from, to: e.to }), t.editor.view.focus()), t?.node.scrollIntoView({ block: "nearest", inline: "nearest" });
      } finally {
        gt = !1;
      }
    },
    transact: (e, t) => {
      if (!N) {
        for (const n of new Set(e.map((i) => i.entry.fragment))) D?.addToScope(n);
        D?.stopCapturing(), k.transact(t), D?.stopCapturing();
      }
    },
    report: dt,
    onError: (e) => {
      console.error("Slides find/replace failed:", e), typeof window.showErrorModal == "function" ? window.showErrorModal(e.message, { title: "Find and replace failed" }) : $("Find and replace failed: " + e.message, "error");
    }
  }), {
    getArticleHtml: () => mi({ slideIds: ye(), renderSlide: Tt }),
    getHtml: () => vo({ slideIds: ye(), renderSlide: Tt, title: d.presentationTitle?.() || r("doc-name").value || "CList presentation" }),
    exportHtml: () => hi({ slideIds: ye(), renderSlide: Tt, title: d.presentationTitle?.() || r("doc-name").value || "CList presentation" }),
    snapshotRecovery: ct.snapshot,
    importPowerPoint: Fo,
    exportPowerPoint: () => ri(Bo()),
    exportPdf: () => Qo({ slideIds: ye(), renderSlide: Tt, title: d.presentationTitle?.() || r("doc-name").value || "CList presentation" }),
    snapshot: zo,
    loadSnapshot: To,
    importContent: Do,
    getReferences: Gt,
    addReferences: Jt,
    connect: wn,
    disconnect: Pt,
    createSavedLayout: Io,
    registerSavedLayout: eo,
    removeSavedLayout: _n,
    setView: (e) => re.setMode(e),
    get viewMode() {
      return re.mode;
    },
    get document() {
      return k;
    },
    get connected() {
      return fe;
    },
    destroy() {
      q?.destroy(), ie?.destroy(), ee?.destroy(), re?.destroy(), tt?.destroy(), ct.destroy(), Ce.destroy(), Ie.destroy(), Ye.destroy(), oe?.close(), oe = null, document.removeEventListener("cut", Hn, !0), document.removeEventListener("paste", Wn, !0), document.removeEventListener("keydown", ao), document.removeEventListener("fullscreenchange", so), N && Qt().catch(Dt), Pt(), me(), k.off("beforeObserverCalls", qt), x.unobserveDeep(he), K.unobserve(he), Q.unobserve(he), Z.unobserve(he), W.unobserve(Ft), ne.unobserve(zt), k.off("update", Nt), k.off("update", Te);
      for (const e of V.values()) e.editor?.destroy();
      V.clear(), oo(), J?.document.destroy(), J = null, ve = null, k.destroy(), u.remove();
    }
  };
}
export {
  Ci as createSlideEditor,
  Si as loadSlideCatalogs
};
