function Jo(n, l, c, i, p = 0) {
  const g = l && Number.isFinite(l.x) && Number.isFinite(l.y), u = g ? l.x - n.x : p, b = g ? l.y - n.y : p;
  return {
    x: Math.max(-n.x, Math.min(c - n.x - n.width, u)),
    y: Math.max(-n.y, Math.min(i - n.y - n.height, b))
  };
}
function go(n, l, c, i) {
  return !c || !n.contains(c) || c.isContentEditable || c.closest?.('input, textarea, select, [contenteditable="true"]') ? !1 : n.contains(l) || l === i || l === i.body || l === i.documentElement;
}
const Ht = [["background", "Background"], ["textColour", "Text"], ["fillColour", "Fill"], ["borderColour", "Border"]];
function Yo(n, l, c, i) {
  const p = String(l || "").trim();
  if (!p || p.length > 120) throw new Error("Enter a theme name of 1–120 characters.");
  for (const [g] of Ht) if (!/^#[0-9a-f]{6}$/i.test(c[g] || "")) throw new Error("Choose a valid colour for each swatch.");
  return { ...n, id: i, label: p, ...Object.fromEntries(Ht.map(([g]) => [g, c[g]])) };
}
function _o(n) {
  const { root: l } = n, c = l.ownerDocument, i = (w, S, h) => {
    const k = c.createElement(w);
    return S !== void 0 && (k.textContent = S), h && (k.className = h), k;
  }, p = l.querySelector('[data-control="theme"]'), g = l.querySelector('[data-panel="themes"]'), u = i("div", void 0, "slide-menu-options slide-theme-controls"), b = i("button", "Themes", "btn-small");
  b.title = "Choose and customise presentation themes", b.dataset.control = "open-themes", u.append(b, p), g?.remove(), l.querySelectorAll(".slide-menu-bar")[1].append(u);
  let E = !1, f = null, y = 0;
  function A() {
    if (!(E || !n.current()))
      try {
        let me = function() {
          a.replaceChildren();
          for (const le of n.themes()) {
            const be = i("option", le.label);
            be.value = le.id, a.append(be);
          }
          a.value = n.theme().id;
        }, Ce = function() {
          R.replaceChildren();
          for (const [le, be] of Ht) {
            const ze = i("span");
            ze.style.backgroundColor = q[le].value, ze.title = be, R.append(ze);
          }
        }, Ie = function() {
          re = n.theme(), O = JSON.stringify(re);
          for (const [le] of Ht) q[le].value = re[le];
          me(), Ce();
        };
        f?.close();
        const w = ++y, S = n.capture(), h = i("div", void 0, "clist-slides slide-insert-picker slide-theme-picker"), k = i("h2", "Themes"), L = i("label", "Presentation theme"), a = i("select"), R = i("div", void 0, "theme-preview");
        a.dataset.control = "modal-theme", L.append(a);
        const F = i("p");
        F.setAttribute("role", "status"), F.dataset.control = "theme-feedback";
        const P = i("button", "Save current slide as a new design", "btn-small");
        P.disabled = !n.canSaveLayout(), P.title = "Save the current slide as a new slide design", P.dataset.control = "save-slide-design";
        const v = i("h3", "Save a new colour theme"), ne = i("label", "Theme name"), _ = i("input");
        _.type = "text", _.maxLength = 120, _.dataset.control = "theme-name", ne.append(_);
        const M = i("div", void 0, "slide-theme-colours"), q = {};
        for (const [le, be] of Ht) {
          const ze = i("label", be), Fe = i("input");
          Fe.type = "color", Fe.dataset.themeColour = le, ze.append(Fe), M.append(ze), q[le] = Fe;
        }
        const Z = i("div", void 0, "slide-picker-actions"), U = i("button", "Save as new theme", "btn-small"), ee = i("button", "Close", "btn-small btn-secondary");
        U.title = "Save and apply a new colour theme in this presentation", U.dataset.control = "save-theme", ee.title = "Close Themes", Z.append(ee);
        const K = i("div", void 0, "slide-theme-columns"), te = i("section"), Y = i("section");
        te.dataset.control = "colour-themes", Y.dataset.control = "slide-designs";
        const pe = i("ul");
        pe.dataset.control = "slide-design-list";
        for (const le of n.designs()) {
          const be = i("li", le.label);
          pe.append(be);
        }
        te.append(i("h3", "Colour Themes"), L, R, v, ne, M, U), Y.append(i("h3", "Slide designs"), pe, i("p", "Slide designs can be selected when creating a new slide."), P), K.append(te, Y), h.append(k, K, F, Z);
        let re = n.theme(), O = JSON.stringify(re);
        Ie();
        const X = n.openModal(h);
        f = X;
        const Qe = () => !E && w === y && S() && X.current(), Ve = (le) => {
          console.error("Slides themes:", le), X.current() && (F.textContent = le.message || String(le));
        }, Ke = () => {
          if (!Qe()) throw new Error("The presentation changed. Close and reopen Themes.");
          if (JSON.stringify(n.theme()) !== O) throw new Error("The theme changed elsewhere. Close and reopen Themes before saving.");
        };
        for (const le of Object.values(q)) le.addEventListener("input", () => {
          Qe() && Ce();
        });
        a.addEventListener("change", () => {
          try {
            Ke(), n.apply(a.value), Ie(), F.textContent = "Theme applied.";
          } catch (le) {
            Ve(le);
          }
        }), U.addEventListener("click", () => {
          try {
            Ke(), n.save(Yo(re, _.value, Object.fromEntries(Object.entries(q).map(([le, be]) => [le, be.value])), "custom-" + crypto.randomUUID())), Ie(), _.value = "", F.textContent = "Theme saved in this presentation.";
          } catch (le) {
            Ve(le);
          }
        }), P.addEventListener("click", () => {
          try {
            Ke(), X.close(), n.saveLayout();
          } catch (le) {
            Ve(le);
          }
        }), ee.addEventListener("click", () => {
          w === y && (y++, X.close());
        });
      } catch (w) {
        console.error("Slides themes:", w), n.error(w);
      }
  }
  return b.addEventListener("click", A), { destroy() {
    E = !0, y++, f?.close(), u.remove();
  } };
}
function Zo(n, l, c, i) {
  return c === "crop" ? { imageFit: "cover", cropImageWidth: i.width, cropImageHeight: i.height } : {
    imageFit: "cover",
    cropImageWidth: i.width * l.width / n.width,
    cropImageHeight: i.height * l.height / n.height,
    aspectRatio: l.width / l.height
  };
}
function Qo(n, l, c) {
  const i = n.ownerDocument, p = i.createElement("div");
  p.className = "slide-menu-options", p.dataset.control = "image-handle-mode", p.hidden = !0, p.setAttribute("role", "group"), p.setAttribute("aria-label", "Image handle behavior");
  let g = "resize", u = !1;
  const b = ["resize", "crop"].map((f) => {
    const y = i.createElement("button");
    return y.className = "btn-small", y.textContent = f === "resize" ? "Resize" : "Crop", y.dataset.imageHandleMode = f, y.title = f === "resize" ? "Handles resize the image" : "Handles crop the image", y.addEventListener("click", () => {
      u || p.hidden || !l() || (g = f, E(), c());
    }), p.append(y), y;
  });
  function E() {
    n.dataset.imageHandleMode = g, b.forEach((f) => {
      const y = f.dataset.imageHandleMode === g;
      f.setAttribute("aria-pressed", String(y)), f.className = y ? "btn-small" : "btn-small btn-secondary";
    });
  }
  return n.querySelectorAll(".slide-menu-bar")[1].append(p), E(), {
    get mode() {
      return g;
    },
    update(f, y) {
      p.hidden = !f, b.forEach((A) => A.disabled = !y);
    },
    destroy() {
      u = !0, p.remove();
    }
  };
}
function ei(n, l, c, i, p = 0, g = {}) {
  const u = p * Math.PI / 180, b = Math.cos(u), E = Math.sin(u), f = c * b + i * E, y = -c * E + i * b, A = l === "left" || l === "right", w = l === "left" || l === "top", S = A ? "width" : "height", h = A ? f : y, k = A ? g.minWidth ?? 1 : g.minHeight ?? 1, L = A ? g.maxWidth ?? 1 / 0 : g.maxHeight ?? 1 / 0, a = Math.max(k, Math.min(L, n[S] + (w ? -h : h))), R = (a - n[S]) * (w ? -1 : 1) / 2, F = A ? R * b : -R * E, P = A ? R * E : R * b, v = A ? a : n.width, ne = A ? n.height : a;
  return {
    x: n.x + (n.width - v) / 2 + F,
    y: n.y + (n.height - ne) / 2 + P,
    width: v,
    height: ne
  };
}
function mo(n, l) {
  return ((Math.round((Number(n) || 0) + l) + 180) % 360 + 360) % 360 - 180;
}
const ti = `
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
      <aside class="inspector" aria-label="Slide controls" tabindex="0"><details class="control-section" data-panel="themes"><summary>Themes</summary><div class="control-section-body"><label>Presentation theme<select data-control="theme" title="Theme defaults for the whole presentation"></select></label><div data-control="theme-preview" class="theme-preview" aria-hidden="true"></div><p class="helper">Applies to every slide. Individual font, colour and background choices are preserved.</p></div></details><details class="control-section" data-panel="layouts"><summary>Layouts</summary><div class="control-section-body"><label class="slide-layout-label">New slide layout<select data-control="slide-layout" title="Layout for the next slide"></select></label><div class="saved-layout-actions"><button class="btn-small" data-control="rename-layout" title="Rename selected saved layout">Rename layout</button><button class="btn-small btn-secondary" data-control="delete-layout" title="Delete selected saved layout">Delete layout</button></div><p data-control="saved-layout-hint" class="helper" role="status"></p><button class="btn-small" data-control="save-layout" title="Save the current slide design as a layout">Save design as layout</button></div></details><details class="control-section" data-panel="text"><summary>Text</summary><div class="control-section-body"><button class="btn-small" data-control="fit-text" title="Reduce the selected text boxes’ font size until their text fits">Fit text</button><p class="helper" data-control="text-overflow-status" role="status" aria-live="polite"></p><div class="text-format-controls"><label>Font family<select data-control="font-family" title="Font family for the selected text box"><option value="system">System default</option><option value="arial">Arial</option><option value="verdana">Verdana</option><option value="georgia">Georgia</option><option value="times">Times New Roman</option><option value="courier">Courier New</option></select></label><label>Font size (px)<input data-control="font-size" type="number" min="8" max="200" step="1" value="33" title="Font size for the selected text box" /></label><label>Text colour<input data-control="text-colour" type="color" value="#202b3d" title="Text colour for the selected text box" /></label><label>Alignment<select data-control="text-align" title="Alignment for the selected text box"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option></select></label></div></div></details><details class="control-section" data-panel="appearance"><summary>Fill and border</summary><div class="control-section-body"><div class="text-format-controls"><label><input data-control="fill-enabled" type="checkbox" title="Enable text box fill" /> Fill</label><label>Fill colour<input data-control="fill-colour" type="color" value="#ffffff" title="Text box fill colour" /></label><label><input data-control="border-enabled" type="checkbox" title="Enable text box border" /> Border</label><label>Border colour<input data-control="border-colour" type="color" value="#202b3d" title="Text box border colour" /></label><label>Border width (px)<input data-control="border-width" type="number" min="1" max="20" step="1" value="2" title="Text box border width" /></label></div></div></details><details class="control-section" data-panel="images"><summary>Image</summary><div class="control-section-body"><label><input data-control="keep-aspect-ratio" type="checkbox" title="Keep image proportions when resizing" checked /> Keep aspect ratio (images)</label><label>Image description (alt text)<textarea data-control="image-description" rows="3" maxlength="2000" title="Description of the selected image" aria-describedby="slide-image-description-help"></textarea></label><p class="helper" id="slide-image-description-help">Describe the image for someone who cannot see it. Leave blank for a decorative image.</p><div class="image-crop-controls"><button class="btn-small" data-control="crop-image" title="Crop the image directly on the slide">Crop image</button><button class="btn-small" data-control="replace-image" title="Replace selected image while preserving its frame and position">Replace image</button><input data-control="replace-image-file" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden /><label>Image mode<select data-control="image-fit" title="Show the whole image or crop to fill the frame"><option value="contain">Fit (whole image)</option><option value="cover">Fill (crop)</option></select></label><p class="helper">Choose Crop image or double-click an image, adjust the rectangle, then choose Done.</p></div></div></details><details class="control-section" data-panel="arrange"><summary>Arrange</summary><div class="control-section-body"><div class="object-group-controls"><button class="btn-small" data-control="group-objects" title="Group selected objects so they select and move together">Group</button><button class="btn-small" data-control="ungroup-objects" title="Ungroup selected objects">Ungroup</button></div><div class="object-lock-controls"><button class="btn-small" data-control="lock-objects" title="Lock selected objects against movement, resizing and deletion">Lock</button><button class="btn-small" data-control="unlock-objects" title="Unlock selected objects">Unlock</button></div><div class="object-alignment"><p>Align selected objects</p><button class="btn-small" data-control="align-left" title="Align selected objects: left">Left</button><button class="btn-small" data-control="align-center" title="Align selected objects: centre">Centre</button><button class="btn-small" data-control="align-right" title="Align selected objects: right">Right</button><button class="btn-small" data-control="align-top" title="Align selected objects: top">Top</button><button class="btn-small" data-control="align-middle" title="Align selected objects: middle">Middle</button><button class="btn-small" data-control="align-bottom" title="Align selected objects: bottom">Bottom</button></div><div class="object-distribution"><p>Equal spacing (select 3 or more)</p><button class="btn-small" data-control="distribute-horizontal" title="Equal horizontal gaps; keep outermost objects in place">Distribute horizontally</button><button class="btn-small" data-control="distribute-vertical" title="Equal vertical gaps; keep outermost objects in place">Distribute vertically</button><p data-control="distribution-status" class="helper" role="status" aria-live="polite"></p></div></div></details><details class="control-section" data-panel="slide"><summary>Slide</summary><div class="control-section-body"><label>Background colour<input data-control="slide-background" type="color" value="#ffffff" title="Background colour for the current slide" /></label></div></details><details class="control-section" data-panel="collaboration"><summary>Collaboration</summary><div class="control-section-body"><label>Hocuspocus WebSocket URL<input data-control="server-url" placeholder="ws://localhost:1234" autocomplete="off" /></label><label>Document name<input data-control="doc-name" autocomplete="off" /></label><label>Auth token (optional)<input data-control="token" type="password" autocomplete="off" /></label><button class="btn-small" data-control="connect">Connect</button><p class="helper">Open this page in two tabs with the same URL and document name to test live collaboration.</p></div></details></aside>
    </section>
<footer hidden class="slide-editor-info" aria-label="Slide information"><div class="canvas-top"><span data-control="slide-label">Slide 1</span><span class="hint">Drag empty slide space to select. Shift adds. Alt bypasses snapping.</span></div></footer>
<div class="presentation-controls" data-control="presentation-controls" hidden><button class="btn-small" data-control="previous-slide" title="Previous slide">Previous</button><span data-control="presentation-position" aria-live="polite"></span><button class="btn-small" data-control="next-slide" title="Next slide">Next</button><button class="btn-small" data-control="presentation-presenter-view" title="Open presenter view">Presenter view</button><button class="btn-small btn-secondary" data-control="exit-presentation" title="Return to editing">Exit presentation</button><span data-control="presentation-status" role="status"></span></div>`;
function ni(n, l, c) {
  const i = n.ownerDocument || n, p = c.schedule || setTimeout, g = c.unschedule || clearTimeout;
  let u = null;
  const b = () => {
    u && g(u.timer), u = null, i.removeEventListener("pointermove", E, !0), i.removeEventListener("pointerup", f, !0), i.removeEventListener("pointercancel", f, !0), i.removeEventListener("pointerdown", b, !0), i.removeEventListener("visibilitychange", b), n.ownerDocument?.defaultView?.removeEventListener("blur", b);
  }, E = (A) => {
    u && A.pointerId === u.pointerId && Math.hypot(A.clientX - u.clientX, A.clientY - u.clientY) > 5 && b();
  }, f = (A) => {
    A.pointerId === u?.pointerId && b();
  }, y = (A) => {
    if (b(), !(!c.current() || A.button !== 0 || A.isPrimary === !1 || A.target === l)) {
      if (c.text() && A.target.closest?.(".text-content")) {
        c.select(!1);
        const w = {
          button: 0,
          pointerId: A.pointerId,
          clientX: A.clientX,
          clientY: A.clientY,
          currentTarget: n,
          preventDefault() {
          },
          stopPropagation() {
          }
        };
        u = { ...w, timer: p(() => {
          b(), !(!c.current() || !n.isConnected) && c.move(w);
        }, 450) }, i.addEventListener("pointermove", E, !0), i.addEventListener("pointerup", f, !0), i.addEventListener("pointercancel", f, !0), i.addEventListener("pointerdown", b, !0), i.addEventListener("visibilitychange", b), n.ownerDocument?.defaultView?.addEventListener("blur", b);
        return;
      }
      if (A.shiftKey) {
        A.preventDefault(), A.stopPropagation(), c.select(!0), c.focus();
        return;
      }
      c.move(A);
    }
  };
  return n.addEventListener("pointerdown", y), () => {
    b(), n.removeEventListener("pointerdown", y);
  };
}
const zt = 0.02, ut = (n, l, c) => Math.max(l, Math.min(c, Number(n) || 0));
function Ut(n = {}) {
  n ||= {};
  const l = ut(n.width ?? 1, zt, 1), c = ut(n.height ?? 1, zt, 1);
  return { x: ut(n.x, 0, 1 - l), y: ut(n.y, 0, 1 - c), width: l, height: c };
}
function bo(n, l, c, i) {
  if (n = Ut(n), l === "move") return { ...n, x: ut(n.x + c, 0, 1 - n.width), y: ut(n.y + i, 0, 1 - n.height) };
  let p = n.x, g = n.y, u = p + n.width, b = g + n.height;
  return l.includes("w") && (p = ut(p + c, 0, u - zt)), l.includes("e") && (u = ut(u + c, p + zt, 1)), l.includes("n") && (g = ut(g + i, 0, b - zt)), l.includes("s") && (b = ut(b + i, g + zt, 1)), { x: p, y: g, width: u - p, height: b - g };
}
function jn(n, l, c) {
  return n = Ut(n), {
    width: l * n.width,
    height: c * n.height,
    imageFit: "cover",
    cropImageWidth: l,
    cropImageHeight: c,
    cropX: n.width < 1 ? 100 * n.x / (1 - n.width) : 50,
    cropY: n.height < 1 ? 100 * n.y / (1 - n.height) : 50,
    aspectRatio: l * n.width / (c * n.height)
  };
}
function oi(n, l) {
  if (n.get("imageFit") !== "cover") return Ut();
  const c = Number(n.get("cropImageWidth")) || Math.max(n.get("width"), n.get("height") * l), i = Number(n.get("cropImageHeight")) || c / l, p = Math.min(1, n.get("width") / c), g = Math.min(1, n.get("height") / i);
  return Ut({ width: p, height: g, x: (1 - p) * (Number.isFinite(Number(n.get("cropX"))) ? Number(n.get("cropX")) : 50) / 100, y: (1 - g) * (Number.isFinite(Number(n.get("cropY"))) ? Number(n.get("cropY")) : 50) / 100 });
}
function Co({ container: n, source: l, ratio: c, initial: i, current: p = () => !0, onDone: g, onCancel: u, actionsContainer: b = n }) {
  const E = n.ownerDocument;
  let f = Ut(i), y = null, A = !1;
  const w = E.createElement("div");
  w.className = "slide-crop-stage", w.style.aspectRatio = String(c);
  const S = E.createElement("img");
  S.src = l, S.alt = "Image to crop", S.draggable = !1;
  const h = E.createElement("div");
  h.className = "slide-crop-rectangle", h.tabIndex = 0, h.dataset.control = "crop-rectangle", h.setAttribute("role", "group"), h.setAttribute("aria-label", "Crop area. Arrow keys move; Shift plus arrows resizes.");
  for (const P of ["nw", "ne", "sw", "se"]) {
    const v = E.createElement("span");
    v.className = "slide-crop-handle " + P, v.dataset.corner = P, v.setAttribute("aria-hidden", "true"), h.append(v);
  }
  const k = E.createElement("div");
  k.className = "slide-picker-actions";
  const L = E.createElement("button"), a = E.createElement("button");
  L.className = "btn-small", L.textContent = "Done", L.title = "Apply the selected crop", L.dataset.control = "crop-done", a.className = "btn-small btn-secondary", a.textContent = "Cancel crop", a.title = "Cancel cropping", a.dataset.control = "crop-cancel", k.append(L, a), w.append(S, h), n.append(w), b.append(k);
  const R = () => {
    h.style.left = f.x * 100 + "%", h.style.top = f.y * 100 + "%", h.style.width = f.width * 100 + "%", h.style.height = f.height * 100 + "%";
  }, F = () => {
    y && h.hasPointerCapture?.(y.id) && h.releasePointerCapture(y.id), y = null;
  };
  return h.addEventListener("pointerdown", (P) => {
    if (A || !p() || P.isPrimary === !1 || P.button !== 0 || y) return;
    const v = w.getBoundingClientRect();
    !v.width || !v.height || (P.preventDefault(), P.stopPropagation(), y = { id: P.pointerId, x: P.clientX, y: P.clientY, rect: { ...f }, handle: P.target.dataset.corner || "move", bounds: v }, h.setPointerCapture?.(P.pointerId), h.focus({ preventScroll: !0 }));
  }), h.addEventListener("pointermove", (P) => {
    if (!(!y || P.pointerId !== y.id)) {
      if (!p()) {
        F();
        return;
      }
      P.preventDefault(), P.stopPropagation(), f = bo(y.rect, y.handle, (P.clientX - y.x) / y.bounds.width, (P.clientY - y.y) / y.bounds.height), R();
    }
  }), h.addEventListener("pointerup", F), h.addEventListener("pointercancel", () => {
    y && (f = y.rect, R()), F();
  }), h.addEventListener("keydown", (P) => {
    A || !p() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(P.key) || (P.preventDefault(), P.stopPropagation(), f = bo(f, P.shiftKey ? "se" : "move", P.key === "ArrowLeft" ? -0.01 : P.key === "ArrowRight" ? 0.01 : 0, P.key === "ArrowUp" ? -0.01 : P.key === "ArrowDown" ? 0.01 : 0), R());
  }), L.addEventListener("click", () => {
    A || (F(), p() ? g({ ...f }) : u());
  }), a.addEventListener("click", () => {
    A || (F(), u());
  }), R(), { get rect() {
    return { ...f };
  }, destroy() {
    A = !0, F(), w.remove(), k.remove();
  } };
}
function ii(n) {
  const l = n.root.ownerDocument;
  let c = 0, i = !1, p = null;
  const g = (f, y, A) => {
    const w = l.createElement(f);
    return y !== void 0 && (w.textContent = y), A && (w.className = A), w;
  };
  function u(f) {
    if (i) throw new Error("This slide editor is closed.");
    const y = ++c, A = n.capture();
    if (!A()) throw new Error("The destination slide is no longer active.");
    p?.close();
    const w = g("div", void 0, "clist-slides slide-insert-picker"), S = g("h2", f), h = g("div"), k = g("p"), L = g("div", void 0, "slide-picker-actions");
    k.setAttribute("role", "status"), k.dataset.control = "picker-feedback";
    const a = g("button", "Cancel", "btn-small btn-secondary");
    a.title = "Cancel insertion", w.append(S, h, k, L), L.append(a);
    const R = n.openModal(w);
    p = R;
    const F = () => !i && c === y && A() && R.current();
    return a.addEventListener("click", () => {
      c === y && (c++, R.close());
    }), { body: w, content: h, actions: L, current: F, error: (v) => {
      n.log(v), F() && (k.textContent = v.message || String(v));
    }, close: R.close };
  }
  function b() {
    const f = u("Choose a shape"), y = g("div", void 0, "slide-shape-grid");
    f.content.append(y);
    for (const A of n.shapes) {
      const w = g("div", void 0, "slide-shape-tile"), S = l.createElementNS("http://www.w3.org/2000/svg", "svg");
      S.setAttribute("viewBox", A.viewBox.join(" ")), S.setAttribute("aria-hidden", "true"), S.setAttribute("fill", "none"), S.setAttribute("stroke", "currentColor"), S.setAttribute("stroke-width", String(Math.max(A.viewBox[2], A.viewBox[3]) / 45));
      for (const k of A.elements) {
        const L = l.createElementNS("http://www.w3.org/2000/svg", k.tag);
        for (const [a, R] of Object.entries(k.attributes)) L.setAttribute(a, String(R));
        L.setAttribute("fill", "none"), S.append(L);
      }
      const h = g("button", void 0, "clist-action-btn btn-small slide-shape-choice");
      h.title = "Insert " + A.label, h.setAttribute("aria-label", A.label), h.dataset.shape = A.id, h.append(S), h.addEventListener("click", () => {
        if (f.current())
          try {
            n.insertShape(A.id), f.close();
          } catch (k) {
            f.error(k);
          }
      }), w.append(h), y.append(w);
    }
    return f.body;
  }
  function E() {
    const f = u("Insert image"), y = g("div", void 0, "slide-picker-actions"), A = g("button", "Choose image file", "btn-small"), w = g("button", "Image libraries", "btn-small btn-secondary");
    A.title = "Choose a PNG, JPEG, GIF or WebP image", w.disabled = !0, w.title = "Image libraries are not available yet";
    const S = g("input");
    S.type = "file", S.accept = "image/png,image/jpeg,image/gif,image/webp", S.hidden = !0, S.dataset.control = "picker-file";
    const h = g("p", "Image library connections can be added here in the future.");
    y.append(A, w, S), f.content.append(y, h);
    const k = g("div", void 0, "slide-image-preview"), L = g("div", void 0, "slide-image-fields");
    k.hidden = L.hidden = !0;
    const a = g("label", "Description (alt text)"), R = g("input");
    R.type = "text", R.maxLength = 2e3, R.dataset.control = "picker-alt", a.append(R), L.append(a);
    const F = g("button", "Insert image", "btn-small"), P = g("button", "Adjust crop", "btn-small");
    F.title = "Insert this image", F.disabled = !0, F.dataset.control = "picker-insert", P.title = "Adjust the crop rectangle", P.hidden = !0, P.dataset.control = "picker-adjust-crop", f.actions.insertBefore(F, f.actions.firstElementChild), f.actions.insertBefore(P, F), f.content.append(k, L);
    let v = null, ne = 0, _ = !1, M = null, q = null;
    function Z() {
      const K = Math.min(1, 800 / v.image.naturalWidth, 500 / v.image.naturalHeight);
      return { width: v.image.naturalWidth * K, height: v.image.naturalHeight * K };
    }
    function U(K) {
      M?.destroy(), M = null, q = K, k.textContent = "";
      const te = Z(), Y = jn(K, te.width, te.height), pe = g("div", void 0, "slide-cropped-preview"), re = g("img");
      pe.style.aspectRatio = Y.width + "/" + Y.height, pe.style.width = "min(100%, " + Math.min(640, 340 * Y.width / Y.height) + "px)", re.src = v.source, re.alt = "Cropped image preview", re.style.width = 100 / K.width + "%", re.style.height = 100 / K.height + "%", re.style.left = -100 * K.x / K.width + "%", re.style.top = -100 * K.y / K.height + "%", pe.append(re), k.append(pe), F.disabled = !1, P.hidden = !1;
    }
    function ee() {
      !f.current() || !v || _ || (M?.destroy(), k.textContent = "", F.disabled = !0, P.hidden = !0, k.style.width = "min(100%, " + Math.min(640, 340 * v.image.naturalWidth / v.image.naturalHeight) + "px)", M = Co({
        container: k,
        source: v.source,
        ratio: v.image.naturalWidth / v.image.naturalHeight,
        initial: q,
        current: f.current,
        onDone: U,
        onCancel: () => U(q || { x: 0, y: 0, width: 1, height: 1 })
      }));
    }
    return P.addEventListener("click", ee), A.addEventListener("click", () => {
      f.current() && !_ && S.click();
    }), S.addEventListener("change", async () => {
      if (!f.current() || _ || !S.files?.[0]) return;
      const K = ++ne, te = S.files[0];
      v = null, q = null, M?.destroy(), M = null, F.disabled = !0, P.hidden = !0, k.hidden = L.hidden = !0;
      try {
        const Y = await n.readImage(te);
        if (!f.current() || K !== ne) return;
        v = Y, R.value = te.name, k.hidden = L.hidden = !1, ee();
      } catch (Y) {
        K === ne && f.error(Y);
      } finally {
        K === ne && (S.value = "");
      }
    }), F.addEventListener("click", () => {
      if (!(!f.current() || !v || !q || M || _)) {
        _ = !0, F.disabled = !0;
        try {
          const K = Z(), te = jn(q, K.width, K.height);
          n.insertImage({ ...v, ...te, alt: R.value.slice(0, 2e3) }), f.close();
        } catch (K) {
          f.error(K), _ = !1, F.disabled = !1;
        }
      }
    }), f.body;
  }
  return { shape: b, image: E, destroy() {
    i = !0, c++, p?.close(), p = null;
  } };
}
function ri(n, l = () => !0, c = null) {
  const i = n.ownerDocument, p = n.querySelector(".toolbar"), g = n.querySelector(".tools"), u = i.createElement("div");
  u.className = "slide-menu-bar tools", g.className = "slide-menu-bar tools", u.setAttribute("aria-label", "Slide menu"), g.setAttribute("aria-label", "Slide menu options"), p.insertBefore(u, g);
  let b = !1, E = "new";
  const f = i.createElement("div");
  f.className = "slide-menu-options", f.dataset.menuGroup = "insert";
  const y = i.createElement("button");
  y.className = "btn-small", y.textContent = "Insert", y.title = "Insert options", y.dataset.menu = "insert";
  const A = i.createElement("div");
  A.className = "slide-menu-options", A.dataset.menuGroup = "new";
  for (const _ of ["add-slide", "duplicate-slide"]) {
    const M = n.querySelector('[data-control="' + _ + '"]');
    M && (_ === "add-slide" && (M.textContent = "Blank Slide", M.title = "Blank Slide"), A.append(M));
  }
  const w = i.createElement("button");
  w.className = "btn-small", w.textContent = "New Slide", w.title = "New Slide options", w.dataset.menu = "new";
  const S = (_) => b || !l() || !["new", "insert"].includes(_) ? !1 : (E = _, A.hidden = _ !== "new", f.hidden = _ !== "insert", w.setAttribute("aria-pressed", String(_ === "new")), y.setAttribute("aria-pressed", String(_ === "insert")), n.dataset.slideMenu = _, !0);
  w.addEventListener("click", () => S("new")), u.append(w);
  for (const _ of [...g.children]) u.append(_);
  g.append(A, f), y.addEventListener("click", () => S("insert")), u.insertBefore(y, w.nextSibling);
  const h = i.createElement("button");
  h.className = "btn-small", h.textContent = "Shape", h.title = "Choose a shape", h.dataset.control = "choose-shape", f.append(h);
  for (const [_, M] of [["add-image", "Image"], ["add-text", "Text"]]) {
    const q = n.querySelector('[data-control="' + _ + '"]');
    q && (q.className = "btn-small", q.textContent = M, f.append(q));
  }
  const k = n.querySelector('[data-control="shape-tools"]');
  k && (k.hidden = !0, f.append(k)), h.addEventListener("click", () => {
    !b && l() && E === "insert" && c?.();
  });
  const L = i.createElement("button");
  L.className = "btn-small", L.textContent = "Slide Design", L.title = "Choose a design for the next slide", L.dataset.control = "choose-template";
  const a = n.querySelector('[data-control="slide-layout"]'), R = a?.parentNode;
  A.append(L), a && (a.hidden = !0, A.append(a), R?.classList.contains("slide-layout-label") && R.remove()), L.addEventListener("click", () => {
    !b && l() && a && (a.hidden = !a.hidden, a.hidden || (a.selectedIndex = -1, a.focus()));
  });
  const F = () => {
    b || !l() || E !== "new" || a.hidden || !a.value || (n.querySelector('[data-control="add-slide"]')?.click(), a.hidden = !0);
  };
  a?.addEventListener("change", F), n.querySelector(".slide-create-actions")?.remove();
  const P = n.querySelector(".canvas-zoom");
  P && u.append(P);
  const v = [...u.children].filter((_) => _.classList.contains("rule")).at(-1);
  if (v) {
    const _ = i.createElement("div");
    _.className = "slide-menu-right";
    let M = v.nextElementSibling;
    for (; M; ) {
      const q = M.nextElementSibling;
      _.append(M), M = q;
    }
    u.append(_);
  }
  const ne = n.querySelector('[data-control="connection-status"]');
  return ne && n.querySelector(".slide-editor-info")?.append(ne), S("new"), { choose: S, get active() {
    return E;
  }, destroy() {
    b = !0, a?.removeEventListener("change", F);
  } };
}
const yo = [
  ["slide", "View slide only"],
  ["notes", "Slide + notes"],
  ["outline", "Outline"],
  ["sorter", "Slide sorter"]
];
function ai({ root: n, getSlides: l, selectSlide: c, canChange: i = () => !0 }) {
  const p = n.ownerDocument;
  let g = "slide", u = !1;
  const b = p.createElement("label"), E = p.createElement("select");
  b.className = "slide-view-picker", E.dataset.control = "slide-view", E.title = "Choose slide editor view", E.setAttribute("aria-label", "Slide editor view");
  for (const [a, R] of yo) {
    const F = p.createElement("option");
    F.value = a, F.textContent = R, E.append(F);
  }
  b.append(E);
  const f = n.querySelector(".tools");
  f.insertBefore(b, f.firstElementChild || null);
  const y = p.createElement("section");
  y.className = "slide-outline", y.setAttribute("aria-label", "Presentation outline"), n.querySelector(".workspace").append(y);
  const A = n.querySelector('[data-control="slide-list"]'), w = /* @__PURE__ */ new Map();
  function S() {
    if (u || g !== "outline") return;
    const a = l(), R = new Set(a.map((P) => P.id));
    for (const [P, v] of w) R.has(P) || (v.section.remove(), w.delete(P));
    let F = y.firstElementChild;
    a.forEach((P, v) => {
      let ne = w.get(P.id);
      if (!ne) {
        const M = p.createElement("section"), q = p.createElement("button"), Z = p.createElement("div");
        q.className = "btn-small", q.title = "Select this slide", Z.className = "slide-outline-text", q.addEventListener("click", () => {
          !u && i() && c(P.id);
        }), M.append(q, Z), ne = { section: M, button: q, text: Z }, w.set(P.id, ne);
      }
      ne.button.textContent = "Slide " + (v + 1), ne.button.setAttribute("aria-current", String(P.active));
      const _ = P.text || "(No text on this slide)";
      ne.text.textContent !== _ && (ne.text.textContent = _), F === ne.section ? F = F.nextElementSibling : y.insertBefore(ne.section, F);
    });
  }
  function h(a) {
    return u || !i() || !yo.some(([R]) => R === a) ? (E.value = g, !1) : (g = a, n.dataset.slideView = g, E.value = g, A.title = g === "sorter" ? "Drag to reorder. Double-click a slide or press Enter to edit it." : "Slides", S(), !0);
  }
  const k = () => h(E.value), L = (a) => {
    if (g !== "sorter" || !i() || a.type === "keydown" && a.key !== "Enter") return;
    const R = a.target.closest("[data-slide-id]");
    !R || !A.contains(R) || (a.preventDefault(), a.stopPropagation(), c(R.dataset.slideId), h("slide"), E.focus());
  };
  return E.addEventListener("change", k), A.addEventListener("dblclick", L), A.addEventListener("keydown", L, !0), h(g), {
    refresh: S,
    setMode: h,
    get mode() {
      return g;
    },
    focus(a) {
      w.get(a)?.button.focus({ preventScroll: !0 });
    },
    destroy() {
      u = !0, E.removeEventListener("change", k), A.removeEventListener("dblclick", L), A.removeEventListener("keydown", L, !0), b.remove(), y.remove(), w.clear(), delete n.dataset.slideView;
    }
  };
}
function si(n, l, c, i = !1) {
  return n.findIndex((p) => i ? c < p.top || c <= p.bottom && l < p.left + p.width / 2 : c < p.top + p.height / 2);
}
function So(n) {
  try {
    const l = new URL(n);
    return ["http:", "https:"].includes(l.protocol) ? l.href : "";
  } catch {
    return "";
  }
}
function Mn(n) {
  if (!n || typeof n.url != "string") return null;
  const l = So(n.url);
  return l ? { ...JSON.parse(JSON.stringify(n)), url: l } : null;
}
function li(n, l) {
  if (!n || !["text/html", "text/plain"].includes(n.type) || typeof n.value != "string") throw new Error("Import HTML or plain text into Slides.");
  const c = document.createElement("div");
  if (n.type === "text/html") {
    const i = new DOMParser().parseFromString(n.value, "text/html");
    i.querySelectorAll("script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons").forEach((p) => p.remove());
    for (const p of i.querySelectorAll("img")) p.replaceWith(i.createTextNode(p.alt || ""));
    for (const p of i.body.querySelectorAll("*")) {
      for (const g of [...p.attributes]) g.name !== "href" && p.removeAttribute(g.name);
      if (p.hasAttribute("href")) {
        const g = So(p.getAttribute("href"));
        g ? p.setAttribute("href", g) : p.removeAttribute("href");
      }
    }
    c.innerHTML = i.body.innerHTML;
  } else
    for (const i of n.value.split(/\r?\n/)) {
      const p = document.createElement("p");
      p.textContent = i, c.append(p);
    }
  for (const i of l) {
    const p = document.createElement("p"), g = document.createElement("a");
    g.href = i.url, g.textContent = i.title || i.url, p.append(document.createTextNode("Source: "), g), c.append(p);
  }
  if (!c.textContent.trim()) throw new Error("There is no readable text to import.");
  return c.innerHTML;
}
function ci(n, l, c) {
  let i = null, p = !1;
  const g = /* @__PURE__ */ new WeakMap(), u = n.querySelector('[data-control="fit-text"]'), b = n.querySelector('[data-control="text-overflow-status"]');
  function E(h) {
    const k = h.content.querySelector(".tiptap");
    return !!k && k.clientHeight > 0 && (k.scrollHeight > k.clientHeight + 1 || k.scrollWidth > k.clientWidth + 1);
  }
  function f() {
    if (i = null, p) return;
    let h = 0;
    const k = c.selected();
    for (const R of c.views()) {
      if (!R.editor) continue;
      const F = E(R);
      k.includes(R) && (h += Number(F));
      let P = g.get(R.node);
      !P && F && (P = document.createElement("span"), P.className = "text-overflow-badge", P.textContent = "Text overflow", P.title = "Text does not fit in this box. Use Fit text or enlarge the box.", R.node.append(P), g.set(R.node, P)), P && P.hidden === F && (P.hidden = !F);
    }
    const L = c.presenting() || !k.length || k.some((R) => R.box.get("locked") === !0) || !k.some((R) => R.editor);
    u.disabled !== L && (u.disabled = L);
    const a = h ? h + " selected text box" + (h === 1 ? " overflows." : "es overflow.") + " Use Fit text or enlarge the box." : k.some((R) => R.editor) ? "Selected text fits." : "Select a text box to check its fit.";
    b.textContent !== a && (b.textContent = a);
  }
  function y() {
    !p && i === null && (i = requestAnimationFrame(f));
  }
  function A() {
    const h = c.selected();
    if (c.presenting() || h.some((L) => L.box.get("locked") === !0)) return;
    const k = [];
    for (const L of h) {
      if (!L.editor || !E(L)) continue;
      const a = L.node.style.getPropertyValue("--slide-font-size"), R = c.size(L.box);
      let F = 8;
      try {
        let P = 8, v = Math.floor(R);
        for (; P <= v; ) {
          const ne = Math.floor((P + v) / 2);
          L.node.style.setProperty("--slide-font-size", ne / 12.8 + "cqw"), E(L) ? v = ne - 1 : (F = ne, P = ne + 1);
        }
      } finally {
        L.node.style.setProperty("--slide-font-size", a);
      }
      F < R && k.push({ box: L.box, size: F });
    }
    c.apply(k), f();
  }
  u.addEventListener("click", A);
  const w = new MutationObserver(y);
  w.observe(l, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["style", "class"] });
  const S = new ResizeObserver(y);
  return S.observe(l), document.fonts?.addEventListener("loadingdone", y), y(), { schedule: y, destroy() {
    p = !0, i !== null && cancelAnimationFrame(i), w.disconnect(), S.disconnect(), document.fonts?.removeEventListener("loadingdone", y), u.removeEventListener("click", A);
  } };
}
function di(n, l, c) {
  const i = document.createElement("div");
  i.className = "selection-marquee", i.hidden = !0, i.setAttribute("aria-hidden", "true"), l.append(i);
  let p = null;
  function g(w) {
    const S = l.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (w.clientX - S.left) * 1280 / S.width)), y: Math.max(0, Math.min(720, (w.clientY - S.top) * 720 / S.height)) };
  }
  function u() {
    const w = p;
    p = null, i.hidden = !0, w && l.hasPointerCapture(w.pointer) && l.releasePointerCapture(w.pointer);
  }
  function b() {
    if (!p) return;
    const w = p.original;
    u(), c.select(w);
  }
  function E(w) {
    w.button !== 0 || w.isPrimary === !1 || (b(), p = { start: g(w), clientX: w.clientX, clientY: w.clientY, pointer: w.pointerId, original: c.selected(), additive: w.shiftKey, slide: c.slideId(), moved: !1 }, l.setPointerCapture(w.pointerId));
  }
  function f(w) {
    if (!p || w.pointerId !== p.pointer) return;
    if (c.slideId() !== p.slide) {
      b();
      return;
    }
    if (!p.moved && Math.hypot(w.clientX - p.clientX, w.clientY - p.clientY) < 4) return;
    p.moved = !0, w.preventDefault();
    const S = g(w), h = Math.min(p.start.x, S.x), k = Math.min(p.start.y, S.y), L = Math.abs(S.x - p.start.x), a = Math.abs(S.y - p.start.y);
    Object.assign(i.style, { left: h / 12.8 + "%", top: k / 7.2 + "%", width: L / 12.8 + "%", height: a / 7.2 + "%" }), i.hidden = !1;
    const R = new Set(p.additive ? p.original : []);
    for (const F of c.objects())
      F.x < h + L && F.x + F.width > h && F.y < k + a && F.y + F.height > k && R.add(F.id);
    c.select([...R]);
  }
  function y(w) {
    !p || w.pointerId !== p.pointer || (f(w), u());
  }
  function A(w) {
    p && w.key === "Escape" && (w.preventDefault(), w.stopPropagation(), b());
  }
  return l.addEventListener("pointermove", f), l.addEventListener("pointerup", y), l.addEventListener("pointercancel", b), l.addEventListener("lostpointercapture", b), n.addEventListener("keydown", A, !0), { begin: E, cancel: b, destroy() {
    u(), l.removeEventListener("pointermove", f), l.removeEventListener("pointerup", y), l.removeEventListener("pointercancel", b), l.removeEventListener("lostpointercapture", b), n.removeEventListener("keydown", A, !0), i.remove();
  } };
}
function ui(n, l) {
  const c = (w) => n.querySelector('[data-control="' + w + '"]'), i = c("canvas-viewport"), p = c("slide"), g = c("canvas-zoom"), u = [25, 50, 75, 100, 125, 150, 200];
  let b = "fit", E = 100;
  function f() {
    if (l() || !i.clientWidth || !i.clientHeight) return;
    const w = Math.max(1, i.clientWidth - 48), S = Math.max(1, i.clientHeight - 48);
    b === "fit" && (E = Math.min(100, w / 1280 * 100, S / 720 * 100));
    const h = 1280 * E / 100, k = 720 * E / 100;
    p.style.setProperty("--canvas-slide-width", h + "px"), i.style.setProperty("--canvas-stage-width", h + 48 + "px"), i.style.setProperty("--canvas-stage-height", k + 48 + "px"), g.options[0].textContent = "Fit (" + Math.round(E) + "%)", g.value = b, c("zoom-out").disabled = E <= 25, c("zoom-in").disabled = E >= 200;
  }
  function y(w) {
    b = w, b !== "fit" && (E = Number(b)), f(), b === "fit" && (i.scrollLeft = 0, i.scrollTop = 0);
  }
  g.addEventListener("change", () => y(g.value)), c("zoom-fit").addEventListener("click", () => y("fit")), c("zoom-in").addEventListener("click", () => y(String(u.find((w) => w > E + 0.1) || 200))), c("zoom-out").addEventListener("click", () => y(String([...u].reverse().find((w) => w < E - 0.1) || 25)));
  const A = new ResizeObserver(f);
  return A.observe(i), f(), { update: f, destroy() {
    A.disconnect();
  } };
}
const pi = {
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
function fi() {
  const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return n.setAttribute("viewBox", "0 0 24 24"), n.setAttribute("aria-hidden", "true"), n.setAttribute("focusable", "false"), n.setAttribute("fill", "none"), n.setAttribute("stroke", "currentColor"), n.setAttribute("stroke-width", "1.8"), n.setAttribute("stroke-linecap", "round"), n.setAttribute("stroke-linejoin", "round"), n;
}
function wo(n, l = null) {
  const c = fi();
  if (l) {
    c.setAttribute("viewBox", l.viewBox.join(" ")), c.setAttribute("stroke-width", String(Math.max(l.viewBox[2], l.viewBox[3]) / 12));
    for (const i of l.elements) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", i.tag);
      for (const [g, u] of Object.entries(i.attributes)) p.setAttribute(g, String(u));
      c.append(p);
    }
  } else
    c.innerHTML = pi[n.dataset.control] || '<circle cx="12" cy="12" r="8"/>';
  n.className = "clist-action-btn btn-small", n.type = "button", n.setAttribute("aria-label", n.title), n.replaceChildren(c);
}
function xo(n, l) {
  const c = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" }, i = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u" };
  function p(u) {
    if (typeof u.toDelta == "function") {
      const y = l.createDocumentFragment();
      for (const A of u.toDelta()) {
        if (typeof A.insert != "string") continue;
        let w = l.createTextNode(A.insert);
        for (const [S, h] of Object.entries(A.attributes || {})) {
          let k;
          i[S] ? k = l.createElement(i[S]) : S === "link" && typeof h?.href == "string" && /^(https?:|mailto:|tel:)/i.test(h.href) && (k = l.createElement("a"), k.href = h.href, k.target = "_blank", k.rel = "noopener noreferrer"), k && (k.append(w), w = k);
        }
        y.append(w);
      }
      return y;
    }
    const b = u.getAttributes?.() || {}, E = u.nodeName === "heading" ? "h" + Math.max(1, Math.min(6, Number(b.level) || 1)) : c[u.nodeName] || "div", f = l.createElement(E);
    u.nodeName === "orderedList" && Number.isInteger(b.start) && (f.start = b.start);
    for (const y of u.toArray?.() || []) f.append(p(y));
    return f;
  }
  const g = l.createDocumentFragment();
  for (const u of n.toArray()) g.append(p(u));
  return g;
}
function hi({ renderSlide: n, navigate: l, jump: c, present: i, end: p }) {
  const g = window.open("", "_blank", "popup,width=1200,height=850");
  if (!g) throw new Error("Allow pop-up windows for CList to open Presenter view.");
  const u = g.document;
  u.title = "CList Slides — Presenter view", u.documentElement.lang = "en";
  for (const Y of document.querySelectorAll('link[rel="stylesheet"], style')) u.head.append(Y.cloneNode(!0));
  u.body.className = "clist-presenter-page";
  const b = u.createElement("main");
  b.className = "clist-slides presenter-console", u.body.replaceChildren(b);
  const E = u.createElement("header");
  E.className = "presenter-header";
  const f = u.createElement("h1");
  f.textContent = "Presenter view";
  const y = u.createElement("span"), A = u.createElement("span"), w = u.createElement("p");
  y.dataset.control = "presenter-position", A.dataset.control = "presenter-timer", A.setAttribute("aria-label", "Elapsed presentation time"), w.setAttribute("role", "status"), E.append(f, y, A);
  function S(Y) {
    console.error("Presenter view failed:", Y), w.textContent = Y.message;
  }
  function h(Y, pe, re) {
    const O = u.createElement("button");
    return O.className = "btn-small", O.textContent = Y, O.title = Y, O.dataset.control = pe, O.addEventListener("click", () => {
      try {
        Promise.resolve(re()).catch(S);
      } catch (me) {
        S(me);
      }
    }), E.append(O), O;
  }
  const k = h("Previous", "presenter-previous", () => l(-1)), L = h("Next", "presenter-next", () => l(1)), a = h("Present", "presenter-start", i), R = h("End presentation", "presenter-end", p);
  let F = 0, P = null;
  function v() {
    const Y = Math.floor((F + (P === null ? 0 : Date.now() - P)) / 1e3);
    A.textContent = "Elapsed " + String(Math.floor(Y / 60)).padStart(2, "0") + ":" + String(Y % 60).padStart(2, "0");
  }
  h("Reset timer", "presenter-reset-timer", () => {
    F = 0, P !== null && (P = Date.now()), v();
  });
  const ne = u.createElement("div");
  ne.className = "presenter-grid";
  function _(Y, pe) {
    const re = u.createElement("section"), O = u.createElement("h2"), me = u.createElement("div");
    return O.textContent = Y, me.dataset.control = pe, re.append(O, me), ne.append(re), me;
  }
  const M = _("Current slide", "presenter-current"), q = _("Next slide", "presenter-upcoming"), Z = u.createElement("h2"), U = u.createElement("div"), ee = u.createElement("p");
  Z.textContent = "Speaker notes", U.className = "presenter-notes", U.dataset.control = "presenter-notes", ee.className = "helper", ee.textContent = "Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.", b.append(E, ee, w, ne, Z, U), g.addEventListener("keydown", (Y) => {
    if (!(Y.ctrlKey || Y.altKey || Y.metaKey || Y.isComposing || Y.key === " " && Y.target?.tagName === "BUTTON" || !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", "Escape"].includes(Y.key))) {
      Y.preventDefault();
      try {
        Y.key === "Escape" ? Promise.resolve(p()).catch(S) : Y.key === "Home" || Y.key === "End" ? c(Y.key === "Home" ? "first" : "last") : l(["ArrowLeft", "ArrowUp", "PageUp"].includes(Y.key) ? -1 : 1);
      } catch (re) {
        S(re);
      }
    }
  });
  const K = window.setInterval(() => {
    g.closed ? window.clearInterval(K) : v();
  }, 250);
  function te() {
    window.clearInterval(K), g.closed || g.close(), window.removeEventListener("beforeunload", te);
  }
  return g.addEventListener("unload", () => {
    window.clearInterval(K), window.removeEventListener("beforeunload", te);
  }), window.addEventListener("beforeunload", te), v(), {
    get closed() {
      return g.closed;
    },
    focus() {
      g.focus();
    },
    close: te,
    update({ id: Y, nextId: pe, index: re, total: O, notes: me, presenting: Ce }) {
      if (!g.closed) {
        if (y.textContent = "Slide " + (re + 1) + " of " + O, U.textContent = me || "No speaker notes for this slide.", M.replaceChildren(n(Y, u)), pe) q.replaceChildren(n(pe, u));
        else {
          const Ie = u.createElement("p");
          Ie.textContent = "End of presentation", q.replaceChildren(Ie);
        }
        k.disabled = re === 0, L.disabled = re === O - 1, a.disabled = Ce, R.disabled = !Ce, Ce && P === null ? P = Date.now() : !Ce && P !== null && (F += Date.now() - P, P = null), v();
      }
    }
  };
}
async function gi({ slideIds: n, renderSlide: l, title: c = "CList presentation" }) {
  const i = window.open("", "_blank");
  if (!i) throw new Error("Allow pop-up windows for CList to export slides as PDF.");
  const p = i.document;
  p.title = c, p.documentElement.lang = "en";
  const g = p.createElement("header");
  g.className = "slide-print-controls";
  const u = p.createElement("p");
  u.setAttribute("role", "status"), u.textContent = "Preparing slides…";
  const b = p.createElement("button");
  b.className = "btn", b.textContent = "Print / Save as PDF", b.title = "Open the print dialog to save this presentation as a PDF", b.disabled = !0, g.append(u, b);
  const E = p.createElement("main");
  E.className = "clist-slides slide-print-deck", p.body.replaceChildren(g, E);
  function f(y) {
    console.error("Slides PDF export failed:", y), u.className = "error-message", u.textContent = "Could not prepare PDF export: " + y.message;
  }
  b.addEventListener("click", () => {
    try {
      i.focus(), i.print();
    } catch (y) {
      f(y);
    }
  });
  try {
    const y = [];
    for (const w of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const S = w.cloneNode(!0);
      w.tagName === "LINK" && (S.href = w.href, y.push(new Promise((h, k) => {
        S.addEventListener("load", h, { once: !0 }), S.addEventListener("error", () => k(new Error("A presentation stylesheet could not load.")), { once: !0 });
      }))), p.head.append(S);
    }
    const A = p.createElement("style");
    A.textContent = `
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
    `, p.head.append(A);
    for (const w of n) {
      const S = p.createElement("section");
      S.className = "slide-print-page", S.append(l(w, p)), E.append(S);
    }
    if (await Promise.all(y), await p.fonts.ready, await Promise.all([...E.querySelectorAll("img")].map((w) => w.decode())), i.closed) return;
    u.textContent = "Choose Save as PDF in the print dialog. Use all pages, no margins, no headers or footers, and enable background graphics. Each slide is one landscape page; speaker notes are excluded.", b.disabled = !1;
  } catch (y) {
    throw f(y), y;
  }
}
let Bt;
function Mo() {
  return window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : (Bt || (Bt = new Promise((n, l) => {
    const c = document.createElement("script"), i = "../../../js/vendor/pptxgen.bundle.js";
    c.src = new URL(i, import.meta.url).href, c.onload = () => {
      window.PptxGenJS ? n(window.PptxGenJS) : (Bt = null, c.remove(), l(new Error("The PowerPoint export library did not initialize.")));
    }, c.onerror = () => {
      Bt = null, c.remove(), l(new Error("The PowerPoint export library could not load. Please retry."));
    }, document.head.append(c);
  })), Bt);
}
const St = (n) => n / 96, pt = (n) => n * 0.75, cn = (n) => n.replace("#", ""), mi = { system: "Arial", arial: "Arial", verdana: "Verdana", georgia: "Georgia", times: "Times New Roman", courier: "Courier New" };
function bi(n, l) {
  const c = [];
  function i(u, b = {}) {
    if (u.nodeType === 3) {
      u.textContent && c.push({ text: u.textContent, options: { ...b } });
      return;
    }
    const E = u.nodeName.toLowerCase(), f = { ...b };
    if (["strong", "b"].includes(E) && (f.bold = !0), ["em", "i"].includes(E) && (f.italic = !0), E === "u" && (f.underline = { style: "sng" }), ["s", "strike"].includes(E) && (f.strike = "sngStrike"), ["code", "pre"].includes(E) && (f.fontFace = "Courier New"), E === "a" && /^(https?:|mailto:|tel:)/i.test(u.getAttribute("href") || "") && (f.hyperlink = { url: u.getAttribute("href") }, f.color = "2365BF", f.underline = { style: "sng" }), E === "br") {
      c.push({ text: "", options: { ...f, breakLine: !0 } });
      return;
    }
    for (const y of u.childNodes) i(y, f);
  }
  function p(u, b = null) {
    const E = u.nodeName.toLowerCase();
    if (E === "ul" || E === "ol") {
      let f = Number(u.getAttribute("start")) || 1;
      for (const y of u.children) p(y, { ordered: E === "ol", index: f++, level: (b?.level ?? -1) + 1 });
      return;
    }
    if (E === "li" || E === "blockquote" || E === "div")
      for (const f of u.childNodes)
        f.nodeType === 3 ? f.textContent.trim() && g(f, b) : p(f, b);
    else g(u, b);
  }
  function g(u, b) {
    const E = c.length, f = {};
    /^H[1-6]$/.test(u.nodeName) && (f.bold = !0), i(u, f), c.length === E && c.push({ text: "​", options: {} });
    for (const y of c.slice(E))
      y.options.paraSpaceAfter = b ? pt(l * 0.2) : 6, b && (y.options.bullet = b.ordered ? { type: "number", startAt: b.index, indent: pt(l * 1.5) } : { indent: pt(l * 1.5) }, y.options.indentLevel = Math.min(8, b.level), y.options.hanging = pt(l * 0.3));
    c[c.length - 1].options.breakLine = !0;
  }
  for (const u of n.childNodes) p(u);
  return c.length && delete c[c.length - 1].options.breakLine, c;
}
function Ao(n) {
  return {
    fill: n.fill ? { color: cn(n.fillColour) } : { color: "FFFFFF", transparency: 100 },
    line: n.border ? { color: cn(n.borderColour), width: pt(n.width) } : { color: "FFFFFF", transparency: 100 }
  };
}
function yi(n, l, c, i) {
  const p = l.definition;
  if (p.elements.length !== 1) return !1;
  const { tag: g, attributes: u } = p.elements[0], [b, E, f, y] = p.viewBox, A = g === "rect" && !u.rx && !u.ry && (u.x || 0) === b && (u.y || 0) === E && u.width === f && u.height === y, w = g === "ellipse" && u.cx === b + f / 2 && u.cy === E + y / 2 && u.rx === f / 2 && u.ry === y / 2 || g === "circle" && f === y && u.cx === b + f / 2 && u.cy === E + y / 2 && u.r === f / 2, S = g === "line" && u.x1 === b && u.y1 === E && u.x2 === b + f && u.y2 === E + y;
  if (!A && !w && !S) return !1;
  const h = l.style.border ? Math.min(l.style.width, l.width, l.height) : 0, k = St(h / 2), L = Ao({ ...l.style, width: h });
  return S && (L.fill.transparency = 100), n.addShape(A ? i.ShapeType.rect : w ? i.ShapeType.ellipse : i.ShapeType.line, {
    ...c,
    x: c.x + k,
    y: c.y + k,
    w: Math.max(1e-3, c.w - k * 2),
    h: Math.max(1e-3, c.h - k * 2),
    ...L
  }), !0;
}
async function wi(n) {
  const l = new Image();
  l.src = n.source, await l.decode();
  const c = document.createElement("canvas"), i = Math.min(2, 4096 / Math.max(n.width, n.height));
  c.width = Math.max(1, Math.round(n.width * i)), c.height = Math.max(1, Math.round(n.height * i));
  const p = c.getContext("2d");
  if (!p) throw new Error("The browser could not prepare a presentation image.");
  p.scale(c.width / n.width, c.height / n.height);
  let g, u;
  if (n.crop?.fit === "cover")
    g = n.crop.width || Math.max(n.width, n.height * l.naturalWidth / l.naturalHeight), u = n.crop.height || g * l.naturalHeight / l.naturalWidth;
  else {
    const b = Math.min(n.width / l.naturalWidth, n.height / l.naturalHeight);
    g = l.naturalWidth * b, u = l.naturalHeight * b;
  }
  return p.drawImage(l, (n.width - g) * (n.crop?.x ?? 50) / 100, (n.height - u) * (n.crop?.y ?? 50) / 100, g, u), c.toDataURL("image/png");
}
async function xi(n, l) {
  const c = await Mo(), i = new c();
  i.defineLayout({ name: "CLIST", width: St(1280), height: St(720) }), i.layout = "CLIST", i.title = n.title, i.subject = "CList presentation", i.author = "", i.company = "", i.lang = "en-CA";
  const p = /* @__PURE__ */ new Set();
  for (const g of n.slides) {
    const u = i.addSlide();
    u.background = { color: cn(g.background) }, g.notes && u.addNotes(g.notes);
    for (const b of g.objects) {
      const E = { x: St(b.x), y: St(b.y), w: St(b.width), h: St(b.height), rotate: ((b.rotation || 0) % 360 + 360) % 360, objectName: b.id };
      if (b.kind === "text") {
        const f = b.format;
        u.addText(b.runs.length ? b.runs : "", {
          ...E,
          ...Ao(b.style),
          fontFace: mi[f.family],
          fontSize: pt(f.size),
          color: cn(f.colour),
          align: f.align,
          valign: "top",
          margin: [pt(5), pt(8), pt(5), pt(8)],
          breakLine: !1,
          lineSpacingMultiple: 1.2,
          paraSpaceAfter: 6,
          wrap: !0,
          fit: "none"
        });
      } else b.kind === "shape" && yi(u, b, E, i) || (b.kind === "shape" && p.add("Custom SVG shapes were exported as images."), u.addImage({ ...E, data: await wi(b), altText: b.alt || b.definition?.label || "" }));
    }
  }
  return { pptx: i, warnings: [...p] };
}
async function vi(n) {
  const { pptx: l, warnings: c } = await xi(n), i = (n.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".pptx";
  return await l.writeFile({ fileName: i, compression: !0 }), c;
}
const vo = "http://schemas.openxmlformats.org/presentationml/2006/main", An = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", Q = (n, l) => [...n?.children || []].find((c) => c.localName === l), ft = (n, l) => [...n?.getElementsByTagNameNS("*", l) || []], ue = (n, l) => ft(n, l)[0], he = (n, l, c = 0) => n?.hasAttribute(l) ? Number(n.getAttribute(l)) : c, Ct = (n) => n === "1" || n === "true", yt = (n) => ue(n, "ph"), ki = (n, l, c) => ({ x: c[0] * n + c[2] * l + c[4], y: c[1] * n + c[3] * l + c[5] }), Ln = (n, l) => [n[0] * l[0] + n[2] * l[1], n[1] * l[0] + n[3] * l[1], n[0] * l[2] + n[2] * l[3], n[1] * l[2] + n[3] * l[3], n[0] * l[4] + n[2] * l[5] + n[4], n[1] * l[4] + n[3] * l[5] + n[5]], Nn = [1, 0, 0, 1, 0, 0], $e = (n) => n / 9525;
function an(n, l) {
  if (!l || /[\\?#]/.test(l) || /^[a-z]+:/i.test(l)) throw new Error("The presentation contains an invalid internal relationship.");
  const c = l.startsWith("/") ? [] : n.split("/").slice(0, -1);
  for (const i of decodeURIComponent(l).split("/"))
    if (!(!i || i === "."))
      if (i === "..") {
        if (!c.length) throw new Error("A presentation relationship leaves the package.");
        c.pop();
      } else c.push(i);
  return c.join("/");
}
async function Ei(n, l = "Imported presentation.pptx") {
  if (!(n instanceof ArrayBuffer || n instanceof Uint8Array) || n.byteLength > 100 * 1024 * 1024) throw new Error("Choose a .pptx file smaller than 100 MB.");
  await Mo();
  const c = await window.JSZip.loadAsync(n), i = Object.values(c.files);
  if (i.length > 1e4 || i.reduce((Z, U) => Z + (U._data?.uncompressedSize || 0), 0) > 300 * 1024 * 1024) throw new Error("This presentation is too large to import in the browser.");
  const p = /* @__PURE__ */ new Map(), g = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Map(), b = /* @__PURE__ */ new Set();
  let E = 0;
  const f = (Z) => b.add((E ? "Slide " + E + ": " : "") + Z);
  async function y(Z, U = !1) {
    if (p.has(Z)) return p.get(Z);
    const ee = c.file(Z);
    if (!ee) {
      if (U) throw new Error("The presentation is missing " + Z + ".");
      return null;
    }
    if (ee._data?.uncompressedSize > 20 * 1024 * 1024) throw new Error("A presentation XML part is too large: " + Z);
    const K = await ee.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(K)) throw new Error("XML document declarations are not supported in PowerPoint imports.");
    const te = new DOMParser().parseFromString(K, "application/xml");
    if (te.getElementsByTagName("parsererror").length) throw new Error("The presentation contains invalid XML: " + Z);
    return p.set(Z, te), te;
  }
  async function A(Z) {
    if (g.has(Z)) return g.get(Z);
    const U = Z.split("/"), ee = U.pop(), K = await y([...U, "_rels", ee + ".rels"].join("/")), te = new Map(ft(K, "Relationship").map((Y) => [Y.getAttribute("Id"), {
      type: Y.getAttribute("Type").split("/").pop(),
      external: Y.getAttribute("TargetMode") === "External",
      target: Y.getAttribute("Target")
    }]));
    return g.set(Z, te), te;
  }
  async function w(Z, U) {
    const ee = [...(await A(Z)).values()].find((te) => te.type === U && !te.external), K = ee && an(Z, ee.target);
    return K ? { path: K, doc: await y(K, !0) } : null;
  }
  const h = [...(await A("")).values()].find((Z) => Z.type === "officeDocument" && !Z.external), k = h ? an("", h.target) : "ppt/presentation.xml", L = await y(k, !0);
  if (L.documentElement.namespaceURI !== vo) throw new Error("This PowerPoint XML format is not supported. Save it as a standard .pptx file first.");
  const a = ue(L, "sldSz"), R = $e(he(a, "cx")), F = $e(he(a, "cy"));
  if (!(R > 0 && F > 0)) throw new Error("The presentation has invalid slide dimensions.");
  const P = Math.min(1280 / R, 720 / F), v = (1280 - R * P) / 2, ne = (720 - F * P) / 2;
  Math.abs(R / F - 16 / 9) > 0.01 && f("Slides were fitted and centred on CList’s 16:9 canvas.");
  const _ = [...Q(L.documentElement, "sldIdLst")?.children || []];
  if (!_.length || _.length > 500) throw new Error("Import supports presentations containing 1–500 slides.");
  ue(L, "custShowLst") && f("Custom slide shows were not imported.");
  const M = [], q = await A(k);
  for (const Z of _) {
    let me = function(N, W = "#000000") {
      if (!N) return W;
      const C = N.localName === "srgbClr" || N.localName === "schemeClr" || N.localName === "sysClr" ? N : [...N.children || []].find((G) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(G.localName));
      if (!C)
        return f("An unsupported colour was replaced."), W;
      let T = C.localName === "schemeClr" ? re[O[C.getAttribute("val")] || C.getAttribute("val")] : C.localName === "sysClr" ? C.getAttribute("lastClr") : C.getAttribute("val");
      if (!/^[a-f0-9]{6}$/i.test(T || ""))
        return f("An unsupported colour was replaced."), W;
      let $ = [0, 2, 4].map((G) => parseInt(T.slice(G, G + 2), 16));
      for (const G of C.children) {
        const oe = he(G, "val") / 1e5;
        G.localName === "tint" ? $ = $.map((ye) => ye + (255 - ye) * oe) : ["shade", "lumMod"].includes(G.localName) ? $ = $.map((ye) => ye * oe) : G.localName === "lumOff" ? $ = $.map((ye) => ye + 255 * oe) : G.localName === "alpha" && oe !== 1 && oe !== 0 ? f("Transparency was simplified; image transparency is preserved.") : ["alpha"].includes(G.localName) || f("Some theme colour adjustments were simplified.");
      }
      return "#" + $.map((G) => Math.round(Math.max(0, Math.min(255, G))).toString(16).padStart(2, "0")).join("");
    }, Ce = function(N, W) {
      const C = yt(N);
      if (!C || !W) return null;
      const T = ft(W, "sp").filter(($) => yt($));
      return T.find(($) => (yt($).getAttribute("idx") || "0") === (C.getAttribute("idx") || "0")) || T.find(($) => (yt($).getAttribute("type") || "obj") === (C.getAttribute("type") || "obj"));
    }, Ie = function(N) {
      const W = Ce(N, te?.doc);
      return [N, W, Ce(W || N, Y?.doc)].filter(Boolean);
    }, X = function(N) {
      const W = N.map((ae) => Q(ae, "spPr")).filter(Boolean), C = W.map((ae) => [...ae.children].find((Ee) => ["solidFill", "noFill", "gradFill", "pattFill", "blipFill", "grpFill"].includes(Ee.localName))).find(Boolean);
      C && !["solidFill", "noFill"].includes(C.localName) && f("A non-solid shape fill was simplified.");
      const T = N.map((ae) => ue(Q(ae, "style"), "fillRef")).find(Boolean), $ = W.map((ae) => Q(ae, "ln")).find(Boolean), G = N.map((ae) => ue(Q(ae, "style"), "lnRef")).find(Boolean), oe = me(C?.localName === "solidFill" ? C : T, "#51b158"), ye = me(Q($, "solidFill") || G, "#000000"), Ne = $e(he($, "w", 12700)) * P;
      return Q($, "prstDash")?.getAttribute("val") && Q($, "prstDash").getAttribute("val") !== "solid" && f("Dashed shape borders were imported as solid lines."), (Q($, "headEnd")?.getAttribute("type") !== void 0 && Q($, "headEnd").getAttribute("type") !== "none" || Q($, "tailEnd")?.getAttribute("type") !== void 0 && Q($, "tailEnd").getAttribute("type") !== "none") && f("Line arrowheads were not imported."), {
        fillEnabled: C ? C.localName !== "noFill" && !ft(C, "alpha").some((ae) => he(ae, "val") === 0) : !!T && he(T, "idx") !== 0,
        fillColour: oe,
        borderEnabled: $ ? !Q($, "noFill") && !ft($, "alpha").some((ae) => he(ae, "val") === 0) : !!G && he(G, "idx") !== 0,
        borderColour: ye,
        borderWidth: Math.max(1, Math.min(20, Ne))
      };
    }, Qe = function(N, W, C = [N]) {
      const T = C.map((z) => Q(Q(z, "spPr"), "xfrm")).find(Boolean);
      if (!T)
        return f("An object without a usable position was skipped."), null;
      const $ = Q(T, "off"), G = Q(T, "ext"), oe = $e(he($, "x")), ye = $e(he($, "y")), Ne = $e(he(G, "cx")), ae = $e(he(G, "cy"));
      if (![oe, ye, Ne, ae].every(Number.isFinite) || Ne < 0 || ae < 0) throw new Error("Slide " + E + " contains an invalid object position.");
      const Ee = he(T, "rot") / 6e4 * Math.PI / 180, de = [Math.cos(Ee), Math.sin(Ee), -Math.sin(Ee), Math.cos(Ee), 0, 0], ge = Ln(W, de), Me = ki(oe + Ne / 2, ye + ae / 2, W), D = Math.max(1, Ne * Math.hypot(ge[0], ge[1]) * P), se = Math.max(1, ae * Math.hypot(ge[2], ge[3]) * P);
      return Math.abs(ge[0] * ge[2] + ge[1] * ge[3]) > 1e-3 && f("A rotated object in a stretched group was approximated."), {
        x: Me.x * P + v - D / 2,
        y: Me.y * P + ne - se / 2,
        width: D,
        height: se,
        rotation: Math.atan2(ge[1], ge[0]) * 180 / Math.PI,
        flipH: Ct(T.getAttribute("flipH")) !== W[0] * W[3] - W[1] * W[2] < 0,
        flipV: Ct(T.getAttribute("flipV"))
      };
    }, Ke = function(N, W, C, T) {
      const $ = Q(N, "txBody");
      if (!$) return null;
      const G = yt(N)?.getAttribute("type") || "body", oe = ue(Y?.doc, "txStyles"), ye = Q(oe, ["title", "ctrTitle"].includes(G) ? "titleStyle" : ["body", "obj"].includes(G) ? "bodyStyle" : "otherStyle"), Ne = (se) => ue(ue(pe?.doc, se === "major" ? "majorFont" : "minorFont"), "latin")?.getAttribute("typeface") || "Arial";
      let ae = null;
      const Ee = { arial: "arial", "arial narrow": "arial", calibri: "system", aptos: "system", "aptos display": "system", "times new roman": "times", verdana: "verdana", georgia: "georgia", "courier new": "courier" }, de = [], ge = Q($, "bodyPr");
      ge?.getAttribute("vert") && ge.getAttribute("vert") !== "horz" && f("Vertical text was imported horizontally."), ge?.getAttribute("anchor") && ge.getAttribute("anchor") !== "t" && f("Vertically aligned text was moved to the top of its text box."), (C.flipH || C.flipV) && f("Mirrored text was imported without mirroring."), ["lIns", "rIns", "tIns", "bIns"].some((se, z) => ge?.hasAttribute(se) && Math.abs($e(he(ge, se)) * P - (z < 2 ? 8 : 5)) > 1) && f("Text box padding was replaced with CList’s standard padding.");
      for (const se of [...$.children].filter((z) => z.localName === "p")) {
        const z = Q(se, "pPr"), Ae = Math.max(0, Math.min(8, he(z, "lvl"))), Se = W.map((Pe) => Q(ue(Pe, "lstStyle"), "lvl" + (Ae + 1) + "pPr")).filter(Boolean), Ge = [Q(z, "defRPr"), ...Se.map((Pe) => Q(Pe, "defRPr")), Q(Q(ye, "lvl" + (Ae + 1) + "pPr"), "defRPr")].filter(Boolean), it = [z, ...Se, Q(ye, "lvl" + (Ae + 1) + "pPr")].filter(Boolean), ht = it.map((Pe) => Pe.getAttribute("algn")).find(Boolean) || "l", rt = { l: "left", ctr: "center", r: "right", just: "justify" }[ht] || "left";
        ["l", "ctr", "r", "just"].includes(ht) || f("An unsupported paragraph alignment was replaced with left alignment."), z && (he(z, "marL") || he(z, "marR") || he(z, "indent") || Q(z, "tabLst") || Q(z, "spcBef") || Q(z, "lnSpc") || Q(z, "spcAft")) && f("Paragraph spacing, indents or tab stops were replaced with CList’s standard text layout.");
        const at = [];
        for (const Pe of se.children) {
          if (Pe.localName === "br") {
            at.push({ type: "hardBreak" });
            continue;
          }
          if (!["r", "fld"].includes(Pe.localName)) continue;
          Pe.localName === "fld" && f("Dynamic text fields were converted to plain text.");
          const st = Q(Pe, "t")?.textContent || "";
          if (!st) continue;
          const Ye = [Q(Pe, "rPr"), ...Ge].filter(Boolean), Be = (Xe, xt) => Ye.find((lt) => lt.hasAttribute(Xe))?.getAttribute(Xe) ?? xt;
          let Ue = Ye.map((Xe) => Q(Xe, "latin")?.getAttribute("typeface")).find(Boolean) || "+mn-lt";
          /^\+mj/.test(Ue) && (Ue = Ne("major")), /^\+mn/.test(Ue) && (Ue = Ne("minor"));
          const J = Ee[Ue.toLowerCase()] || "arial";
          (!Ee[Ue.toLowerCase()] || J === "system") && f("Font “" + Ue + "” was replaced with a CList font.");
          const qe = Number(Be("sz", 2400)) / 100 / 0.75 * P;
          if (!Number.isFinite(qe) || qe <= 0) throw new Error("Slide " + E + " has an invalid text size.");
          const gt = { fontSize: Math.max(8, Math.min(200, qe)), fontFamily: J, textColour: me(Ye.map((Xe) => Q(Xe, "solidFill")).find(Boolean), "#000000"), textAlign: rt };
          ae ? JSON.stringify(ae) !== JSON.stringify(gt) && f("Mixed font sizes, fonts, colours or alignment within a text box were simplified to its first text style.") : ae = gt, (qe < 8 || qe > 200) && f("A text size was adjusted to CList’s 8–200 pixel range.");
          const We = [];
          Ct(Be("b", "0")) && We.push({ type: "bold" }), Ct(Be("i", "0")) && We.push({ type: "italic" }), Be("u", "none") !== "none" && We.push({ type: "underline" }), Be("strike", "noStrike") !== "noStrike" && We.push({ type: "strike" }), Number(Be("baseline", 0)) && f("Superscript or subscript text was imported on the baseline.");
          const Tt = Ye.map((Xe) => Q(Xe, "hlinkClick")).find(Boolean);
          if (Tt) {
            const Xe = T.get(Tt.getAttributeNS(An, "id"));
            Xe?.external && /^(https?:|mailto:|tel:)/i.test(Xe.target) ? We.push({ type: "link", attrs: { href: Xe.target } }) : f("An internal or unsupported hyperlink was removed.");
          }
          at.push({ type: "text", text: st, marks: We });
        }
        const Je = it.map((Pe) => [...Pe.children].find((st) => ["buNone", "buChar", "buAutoNum", "buBlip"].includes(st.localName))).find(Boolean);
        Je?.localName === "buBlip" && f("Picture bullets were replaced with standard bullets."), Je?.localName === "buAutoNum" && Je.getAttribute("type") !== "arabicPeriod" && f("A numbering style was replaced with decimal numbering."), de.push({ type: "paragraph", content: at, list: Je && Je.localName !== "buNone" ? { type: Je.localName === "buAutoNum" ? "orderedList" : "bulletList", level: Ae, start: he(Je, "startAt", 1) } : null });
      }
      const Me = [], D = [];
      for (const se of de) {
        const { list: z, ...Ae } = se;
        if (!z) {
          D.length = 0, Me.push(Ae);
          continue;
        }
        const Se = Math.min(z.level, D.length);
        if (D.length = Math.min(D.length, Se + 1), !D[Se] || D[Se].type !== z.type) {
          const Ge = { type: z.type, ...z.type === "orderedList" ? { attrs: { start: z.start } } : {}, content: [] };
          Se && D[Se - 1]?.content.length ? D[Se - 1].content.at(-1).content.push(Ge) : Me.push(Ge), D[Se] = Ge;
        }
        D[Se].content.push({ type: "listItem", content: [Ae] });
      }
      return { kind: "text", ...ae || { fontSize: 32, fontFamily: "arial", textColour: "#000000", textAlign: "left" }, text: Me };
    }, le = function(N, W) {
      const C = W.map((oe) => Q(oe, "spPr")).find((oe) => Q(oe, "prstGeom") || Q(oe, "custGeom")) || Q(N, "spPr"), T = Q(C, "prstGeom"), $ = T?.getAttribute("prst") || (N.localName === "cxnSp" ? "line" : "rect");
      if (Q(C, "custGeom"))
        return f("A custom vector shape was skipped."), null;
      ue(T, "gd") && f("Custom adjustments to a preset shape were simplified.");
      const G = {
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
      return G[$] ? { id: "pptx-" + $.toLowerCase(), label: $, width: 100, height: 100, defaults: {}, viewBox: [0, 0, 1e3, 1e3], elements: [G[$]] } : (f("Unsupported shape “" + $ + "” was skipped; any text was retained."), null);
    };
    E++;
    const U = q.get(Z.getAttributeNS(An, "id"));
    if (!U || U.external || U.type !== "slide") throw new Error("Slide " + E + " has no valid slide relationship.");
    const ee = an(k, U.target), K = await y(ee, !0), te = await w(ee, "slideLayout"), Y = te && await w(te.path, "slideMaster"), pe = Y && await w(Y.path, "theme"), re = { dk1: "000000", lt1: "FFFFFF", dk2: "1F497D", lt2: "EEECE1", accent1: "4F81BD", accent2: "C0504D", hlink: "0000FF", folHlink: "800080" };
    for (const N of ue(pe?.doc, "clrScheme")?.children || []) re[N.localName] = N.firstElementChild?.getAttribute("lastClr") || N.firstElementChild?.getAttribute("val") || re[N.localName];
    const O = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    for (const N of [ue(Y?.doc, "clrMap"), ue(te?.doc, "overrideClrMapping"), ue(K, "overrideClrMapping")]) for (const W of N?.attributes || []) O[W.name] = W.value;
    async function Ve(N, W, C) {
      const T = Q(N, "blip"), $ = (await A(W)).get(T?.getAttributeNS(An, "embed"));
      if (!$ || $.external || $.type !== "image")
        return f("A linked or missing picture was skipped; no external images were fetched."), null;
      const G = an(W, $.target), oe = G.split(".").pop().toLowerCase(), ye = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[oe];
      if (!ye)
        return f("A picture in unsupported format ." + oe + " was skipped."), null;
      if (!u.has(G)) {
        const se = c.file(G);
        if (!se) throw new Error("A presentation picture is missing: " + G);
        u.set(G, "data:" + ye + ";base64," + await se.async("base64"));
      }
      let Ne = u.get(G);
      const ae = new Image();
      await new Promise((se, z) => {
        ae.onload = se, ae.onerror = () => z(new Error("Slide " + E + " contains an image the browser could not read.")), ae.src = Ne;
      });
      const Ee = Q(N, "srcRect"), de = he(Ee, "l") / 1e5, ge = he(Ee, "t") / 1e5, Me = he(Ee, "r") / 1e5, D = he(Ee, "b") / 1e5;
      if (de + Me >= 1 || ge + D >= 1 || ![de, ge, Me, D].every(Number.isFinite)) throw new Error("Slide " + E + " contains invalid image cropping.");
      if (de || ge || Me || D || C.flipH || C.flipV || Math.abs(ae.naturalWidth / ae.naturalHeight - C.width / C.height) > 1e-3) {
        const se = document.createElement("canvas"), z = Math.min(2, 4096 / Math.max(C.width, C.height));
        se.width = Math.max(1, Math.round(C.width * z)), se.height = Math.max(1, Math.round(C.height * z));
        const Ae = se.getContext("2d");
        if (!Ae) throw new Error("The browser could not prepare an imported image.");
        Ae.translate(C.flipH ? se.width : 0, C.flipV ? se.height : 0), Ae.scale(C.flipH ? -1 : 1, C.flipV ? -1 : 1), Ae.drawImage(ae, de * ae.naturalWidth, ge * ae.naturalHeight, (1 - de - Me) * ae.naturalWidth, (1 - ge - D) * ae.naturalHeight, 0, 0, se.width, se.height), Ne = se.toDataURL("image/png");
      }
      return T?.children.length && f("Picture effects and SVG-specific extensions were not imported; the embedded raster picture was used."), (Q(N, "tile") || [...ue(N, "fillRect")?.attributes || []].some((se) => Number(se.value))) && f("Picture tiling or fill offsets were simplified."), { kind: "image", source: Ne, alt: "", imageFit: "contain", imageRatio: C.width / C.height, keepAspectRatio: !0, aspectRatio: C.width / C.height };
    }
    const be = { background: "#ffffff", notes: "", objects: [] };
    async function ze(N, W, C = Nn, T = !1) {
      if (!N) return;
      const $ = await A(W);
      for (const G of N?.children || []) {
        if (["nvGrpSpPr", "grpSpPr", "extLst"].includes(G.localName)) continue;
        if (G.namespaceURI !== vo) {
          f("An extension object was skipped.");
          continue;
        }
        if (G.localName === "grpSp") {
          const D = Q(Q(G, "grpSpPr"), "xfrm"), se = Q(D, "off"), z = Q(D, "ext"), Ae = Q(D, "chOff"), Se = Q(D, "chExt"), Ge = he(z, "cx") / he(Se, "cx"), it = he(z, "cy") / he(Se, "cy");
          if (!Number.isFinite(Ge) || !Number.isFinite(it)) {
            f("A group with invalid dimensions was skipped.");
            continue;
          }
          const ht = $e(he(se, "x")), rt = $e(he(se, "y")), at = $e(he(z, "cx")), Je = $e(he(z, "cy")), Pe = ht + at / 2, st = rt + Je / 2, Ye = he(D, "rot") / 6e4 * Math.PI / 180, Be = Math.cos(Ye), Ue = Math.sin(Ye), J = Ct(D.getAttribute("flipH")) ? -1 : 1, qe = Ct(D.getAttribute("flipV")) ? -1 : 1, gt = Ln([Be * J, Ue * J, -Ue * qe, Be * qe, Pe, st], [Ge, 0, 0, it, ht - Pe - $e(he(Ae, "x")) * Ge, rt - st - $e(he(Ae, "y")) * it]);
          f("Grouped objects were imported as individual editable objects."), await ze(G, W, Ln(C, gt), T);
          continue;
        }
        if (!["sp", "pic", "cxnSp"].includes(G.localName)) {
          f((G.localName === "graphicFrame" ? "A chart, table or SmartArt object" : "Unsupported object “" + G.localName + "”") + " was skipped.");
          continue;
        }
        if (G.localName === "cxnSp" && (ue(G, "stCxn") || ue(G, "endCxn")) && f("An attached connector was imported as an ordinary line."), T && yt(G)) {
          ["ftr", "hdr", "dt", "sldNum"].includes(yt(G).getAttribute("type")) && ft(G, "t").some((D) => D.textContent.trim()) && f("Template footer, header, date or slide-number placeholders were not imported.");
          continue;
        }
        if (Ct(ue(G, "cNvPr")?.getAttribute("hidden"))) {
          f("A hidden object was skipped.");
          continue;
        }
        const oe = T ? [G] : Ie(G), ye = Qe(G, C, oe);
        if (!ye) continue;
        const { flipH: Ne, flipV: ae, ...Ee } = ye, de = X(oe);
        if ((ue(G, "effectLst")?.children.length || ue(G, "effectDag") || ue(G, "scene3d") || ue(G, "sp3d")) && f("Shadows, 3D or other visual effects were not imported."), G.localName === "pic") {
          const D = await Ve(Q(G, "blipFill"), W, ye);
          if (D) {
            D.alt = ue(G, "cNvPr")?.getAttribute("descr") || ue(G, "cNvPr")?.getAttribute("name") || "";
            const se = ue(Q(G, "spPr"), "prstGeom")?.getAttribute("prst");
            se && se !== "rect" && f("A picture shape mask was replaced with a rectangular image."), be.objects.push({ ...Ee, ...D });
          }
          continue;
        }
        const ge = Ke(G, oe, ye, $), Me = le(G, oe);
        if (Me && (de.fillEnabled || de.borderEnabled)) {
          if ((Ne || ae) && !["rect", "ellipse", "roundRect"].includes(Me.label)) {
            const [D] = Me.elements;
            D.tag === "line" ? (Ne && ([D.attributes.x1, D.attributes.x2] = [D.attributes.x2, D.attributes.x1]), ae && ([D.attributes.y1, D.attributes.y2] = [D.attributes.y2, D.attributes.y1])) : D.tag === "polygon" && (D.attributes.points = D.attributes.points.split(" ").map((se) => {
              const [z, Ae] = se.split(",").map(Number);
              return (Ne ? 1e3 - z : z) + "," + (ae ? 1e3 - Ae : Ae);
            }).join(" "));
          }
          be.objects.push({ ...Ee, ...de, kind: "shape", shapeDefinition: Me, shapeType: Me.id });
        }
        ge && be.objects.push({ ...Ee, ...ge, fillEnabled: !1, borderEnabled: !1 });
      }
    }
    const Fe = [ue(K, "bg"), ue(te?.doc, "bg"), ue(Y?.doc, "bg")].find(Boolean);
    if (Fe) {
      const N = Q(Fe, "bgPr"), W = Q(N, "solidFill") || Q(Fe, "bgRef");
      if (W) be.background = me(W, "#ffffff");
      else if (Q(N, "blipFill")) {
        const C = ue(K, "bg") ? ee : ue(te?.doc, "bg") ? te.path : Y.path, T = { x: v, y: ne, width: R * P, height: F * P }, $ = await Ve(Q(N, "blipFill"), C, T);
        $ && be.objects.push({ ...T, ...$ });
      } else Q(N, "noFill") || f("An unsupported slide background was replaced with white.");
    }
    K.documentElement.getAttribute("showMasterSp") !== "0" && te?.doc.documentElement.getAttribute("showMasterSp") !== "0" && await ze(ue(Y?.doc, "spTree"), Y?.path, Nn, !0), await ze(ue(te?.doc, "spTree"), te?.path, Nn, !0), await ze(ue(K, "spTree"), ee);
    const ot = await w(ee, "notesSlide");
    ot && (be.notes = ft(ot.doc, "sp").filter((N) => !["sldImg", "sldNum", "hdr", "ftr", "dt"].includes(yt(N)?.getAttribute("type"))).map((N) => ft(Q(N, "txBody"), "p").map((W) => ft(W, "t").map((C) => C.textContent).join("")).join(`
`)).filter(Boolean).join(`
`)), ot && (ue(ot.doc, "pic") || ue(ot.doc, "graphicFrame")) && f("Images or other non-text content in speaker notes were not imported."), (ue(K, "timing") || ue(K, "transition")) && f("Animations and slide transitions were not imported."), K.documentElement.getAttribute("show") === "0" && f("This hidden slide was imported as a visible slide.");
    const wt = await A(ee);
    for (const N of wt.values()) ["chart", "diagramData", "oleObject", "audio", "video", "media", "comments", "comment"].includes(N.type) && f("Charts, SmartArt, embedded files, media or comments are not supported.");
    if (be.objects.length > 5e3 || M.reduce((N, W) => N + W.objects.length, 0) + be.objects.length > 2e4) throw new Error("This presentation contains too many objects to import in the browser.");
    M.push(be);
  }
  return { title: l.replace(/\.pptx$/i, ""), slides: M, warnings: [...b] };
}
function Ci({ getDocument: n, encode: l, getName: c, onError: i = () => {
}, createWorker: p = () => new Worker(new URL(
  /* @vite-ignore */
  "" + new URL("assets/recovery-worker-Dt1l0aQJ.js", import.meta.url).href,
  import.meta.url
), { type: "module" }) }) {
  let g = null, u = null, b = 0, E = !1;
  const f = /* @__PURE__ */ new Map();
  function y(S) {
    const h = !f.size && !E;
    g?.terminate(), g = null, u = null;
    for (const k of f.values()) k.reject(S);
    f.clear(), h && i(S);
  }
  function A(S) {
    if (!(!g || u !== n()) && S instanceof Uint8Array)
      try {
        g.postMessage({ type: "update", update: S });
      } catch (h) {
        y(h);
      }
  }
  function w() {
    return new Promise((S, h) => {
      try {
        if (E) throw new Error("The recovery snapshot worker is closed.");
        g || (g = p(), g.onmessage = ({ data: a }) => {
          if (a.error) {
            y(new Error(a.error));
            return;
          }
          const R = f.get(a.id);
          R && (f.delete(a.id), R.resolve(a.content));
        }, g.onerror = () => y(new Error("The background recovery worker could not run. Reload CList and use Save to protect your presentation.")), g.onmessageerror = () => y(new Error("The background recovery snapshot could not be read.")));
        const k = n();
        u !== k && (g.postMessage({ type: "reset", update: l(k) }), u = k);
        const L = ++b;
        f.set(L, { resolve: S, reject: h }), g.postMessage({ type: "snapshot", id: L, name: c() });
      } catch (k) {
        y(k), h(k);
      }
    });
  }
  return { changed: A, snapshot: w, destroy() {
    E = !0, y(new Error("The slide editor closed before recovery finished."));
  } };
}
function Si(n, l, c) {
  const i = [...n], p = new Set(l), g = c < 0 ? i.map((u, b) => b) : i.map((u, b) => b).reverse();
  for (const u of g) {
    const b = u + c;
    b >= 0 && b < i.length && p.has(i[u]) && !p.has(i[b]) && ([i[u], i[b]] = [i[b], i[u]]);
  }
  return i;
}
function Mi(n, l, c) {
  const i = new Set(l);
  if (c && (!n.includes(c) || i.has(c))) return [...n];
  const p = n.filter((u) => i.has(u)), g = n.filter((u) => !i.has(u));
  return g.splice(c ? g.indexOf(c) : g.length, 0, ...p), g;
}
function Ai(n, l, c, { matchCase: i = !1, wholeWord: p = !1 } = {}) {
  if (!c) return [];
  const g = c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), u = new RegExp(p ? "(?<![\\p{L}\\p{N}_])" + g + "(?![\\p{L}\\p{N}_])" : g, i ? "gu" : "giu"), b = [];
  for (const [E, f] of l.entries()) {
    let y = function(w, S) {
      if (w instanceof n.XmlText) {
        const k = w.toDelta().map((L) => typeof L.insert == "string" ? L.insert : "￼").join("");
        u.lastIndex = 0;
        for (const L of k.matchAll(u)) b.push({
          entry: f,
          order: E,
          text: w,
          start: L.index,
          length: L[0].length,
          from: S + L.index,
          to: S + L.index + L[0].length,
          snippet: k.slice(Math.max(0, L.index - 25), L.index + L[0].length + 40).replace(/\s+/g, " ")
        });
        return w.length;
      }
      if (["hardBreak", "horizontalRule"].includes(w.nodeName)) return 1;
      let h = 1;
      for (const k of w.toArray()) h += y(k, S + h);
      return h + 1;
    }, A = 0;
    for (const w of f.fragment.toArray()) A += y(w, A);
  }
  return b;
}
function ko(n, l) {
  const c = /* @__PURE__ */ new Map();
  for (const i of n)
    c.has(i.text) || c.set(i.text, []), c.get(i.text).push(i);
  for (const [i, p] of c)
    for (const g of p.sort((u, b) => b.start - u.start)) {
      let u = 0, b = {};
      for (const E of i.toDelta()) {
        const f = typeof E.insert == "string" ? E.insert.length : 1;
        if (g.start < u + f) {
          b = E.attributes || {};
          break;
        }
        u += f;
      }
      i.delete(g.start, g.length), l && i.insert(g.start, l, b);
    }
}
function Li({ root: n, Y: l, getDocument: c, getEntries: i, jump: p, transact: g, canEdit: u, selectedText: b, report: E, onError: f }) {
  const y = n.ownerDocument, A = n.querySelector(".slide-menu-right") || n.querySelector(".tools"), w = n.querySelectorAll(".slide-menu-bar")[1] || n.querySelector(".tools"), S = y.createElement("button");
  S.className = "clist-action-btn btn-small", S.type = "button", S.dataset.control = "open-find", S.title = "Find and replace across slides (Ctrl/Cmd+F)", S.setAttribute("aria-label", S.title);
  const h = y.createElement("span");
  h.className = "material-icons md-18 md-light", h.textContent = "search", S.append(h), A.append(S);
  const k = y.createElement("div");
  k.className = "slide-search-panel", k.dataset.panel = "find", k.setAttribute("role", "search"), k.setAttribute("aria-label", "Find and replace slide text"), k.hidden = !0, k.open = !1;
  const L = y.createElement("div");
  L.className = "slide-search-content", k.append(L), w.append(k);
  function a(N) {
    k.open = N, k.hidden = !N, w.dataset.searchOpen = String(N), S.setAttribute("aria-expanded", String(N)), N || (clearTimeout(te), te = null);
  }
  function R(N, W, C) {
    const T = y.createElement("label"), $ = y.createElement("input");
    return $.type = W, $.dataset.control = C, $.setAttribute("aria-label", N), W !== "checkbox" ? ($.maxLength = 512, $.autocomplete = "off", $.placeholder = N, T.append($)) : T.append(y.createTextNode(N), $), L.append(T), $;
  }
  const F = R("Find in slide text", "search", "find-query"), P = R("Replace with", "text", "find-replacement"), v = R("Match case", "checkbox", "find-case"), ne = R("Whole words", "checkbox", "find-word"), _ = y.createElement("div");
  _.className = "slide-search-actions", L.append(_);
  const M = y.createElement("p");
  M.className = "helper slide-search-feedback", M.setAttribute("role", "status"), L.append(M);
  const q = y.createElement("div");
  q.className = "object-list", q.dataset.control = "find-results", q.setAttribute("aria-label", "Matching slide text"), L.append(q);
  const Z = y.createElement("p");
  Z.className = "helper", Z.hidden = !0, Z.textContent = "Searches text boxes on all slides. Locked boxes can be found but are not replaced. Enter/F3 finds next; Shift+F3 finds previous.", L.append(Z);
  let U = [], ee = -1, K = null, te = null, Y = !1;
  function pe(N) {
    return () => {
      if (!Y)
        try {
          N();
        } catch (W) {
          f(W);
        }
    };
  }
  function re(N, W, C) {
    const T = y.createElement("button");
    return T.type = "button", T.className = "btn btn-small", T.textContent = N, T.title = N, T.dataset.control = W, T.addEventListener("click", pe(C)), _.append(T), T;
  }
  function O(N) {
    K = N ? l.createRelativePositionFromTypeIndex(N.text, N.start) : null;
  }
  function me() {
    M.textContent = F.value ? U.length ? (ee >= 0 ? ee + 1 + " of " : "") + U.length + " matches" + (ee >= 0 ? " · Slide " + U[ee].entry.slideNumber : "") : "No matches." : "Enter text to search.", Ke.disabled = le.disabled = !U.length || !u(), be.disabled = ee < 0 || !U[ee] || U[ee].entry.locked || !u(), ze.disabled = !U.some((N) => !N.entry.locked) || !u(), q.replaceChildren(), q.hidden = !U.length;
    for (const [N, W] of U.slice(0, 100).entries()) {
      const C = y.createElement("button");
      C.type = "button", C.className = "btn btn-small", C.textContent = "Slide " + W.entry.slideNumber + (W.entry.locked ? " (locked)" : "") + ": " + W.snippet, C.title = C.textContent, C.setAttribute("aria-pressed", String(N === ee)), C.addEventListener("click", pe(() => {
        Ce();
        const T = U.findIndex(($) => $.text === W.text && $.start === W.start);
        T >= 0 && Ie(T);
      })), q.append(C);
    }
    U.length > 100 && (M.textContent += ". First 100 results shown; Next/Previous visit all matches.");
  }
  function Ce(N = !1) {
    clearTimeout(te), te = null;
    const W = !N && K ? l.createAbsolutePositionFromRelativePosition(K, c()) : null;
    U = Ai(l, i(), F.value, { matchCase: v.checked, wholeWord: ne.checked }), ee = W ? U.findIndex((C) => C.text === W.type && C.start === W.index) : -1, ee < 0 && (K = null), me();
  }
  function Ie(N) {
    !u() || !U.length || (ee = (N + U.length) % U.length, O(U[ee]), p(U[ee]), a(!0), me());
  }
  function X(N) {
    Ce(), Ie(ee < 0 ? N > 0 ? 0 : U.length - 1 : ee + N);
  }
  function Qe() {
    if (Ce(), !u() || ee < 0 || U[ee].entry.locked) return;
    const N = U[ee], W = N.from + P.value.length;
    g([N], () => ko([N], P.value)), Ce(!0);
    const C = U.findIndex((T) => T.order > N.order || T.order === N.order && T.from >= W);
    U.length && Ie(C < 0 ? 0 : C), E("Replaced one match.");
  }
  function Ve() {
    if (Ce(), !u()) return;
    const N = U.filter((C) => !C.entry.locked), W = U.length - N.length;
    N.length && (g(N, () => ko(N, P.value)), Ce(!0), E("Replaced " + N.length + " matches." + (W ? " Skipped " + W + " matches in locked text boxes." : "")));
  }
  const Ke = re("Previous", "find-previous", () => X(-1)), le = re("Next", "find-next", () => X(1)), be = re("Replace", "find-replace", Qe), ze = re("Replace all", "find-replace-all", Ve);
  function Fe(N = !1) {
    if (!u()) return;
    const W = b();
    W && W.length <= 512 && !W.includes(`
`) && (F.value = W), a(!0), Ce(!0), k.scrollIntoView({ block: "nearest" }), (N ? P : F).focus(), (N ? P : F).select();
  }
  re("Done", "find-done", () => {
    a(!1), S.focus();
  }).classList.add("btn-secondary"), S.addEventListener("click", pe(() => Fe())), F.addEventListener("input", pe(() => {
    K = null, clearTimeout(te), te = setTimeout(pe(() => Ce(!0)), 150);
  }));
  for (const N of [v, ne]) N.addEventListener("change", pe(() => Ce(!0)));
  function wt(N) {
    (N.ctrlKey || N.metaKey) && !N.altKey && ["f", "h"].includes(N.key.toLowerCase()) && u() ? (N.preventDefault(), N.stopImmediatePropagation(), pe(() => Fe(N.key.toLowerCase() === "h"))()) : N.key === "F3" && k.open && F.value && u() ? (N.preventDefault(), N.stopImmediatePropagation(), pe(() => X(N.shiftKey ? -1 : 1))()) : k.contains(N.target) && (N.key === "Escape" ? (N.preventDefault(), N.stopImmediatePropagation(), a(!1), S.focus()) : N.key === "Enter" && [F, P].includes(N.target) && (N.preventDefault(), N.stopImmediatePropagation(), pe(() => N.target === F ? X(N.shiftKey ? -1 : 1) : Qe())()));
  }
  return n.addEventListener("keydown", wt, !0), a(!1), me(), {
    isOpen: () => k.open,
    changed() {
      !Y && k.open && F.value && (clearTimeout(te), te = setTimeout(pe(() => Ce()), 150));
    },
    presenting(N) {
      S.disabled = N, N && a(!1);
    },
    destroy() {
      Y = !0, a(!1), clearTimeout(te), n.removeEventListener("keydown", wt, !0), k.remove(), S.remove();
    }
  };
}
const Ni = `
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
function ji() {
  const n = [...document.querySelectorAll(".stage > .slide")], l = document.querySelector('[data-action="previous"]'), c = document.querySelector('[data-action="next"]'), i = document.querySelector('[data-action="fullscreen"]'), p = document.querySelector("output"), g = document.querySelector(".viewer-status");
  let u = 0, b;
  function E(y) {
    u = Math.max(0, Math.min(n.length - 1, y)), n.forEach((A, w) => {
      A.hidden = w !== u;
    }), l.disabled = u === 0, c.disabled = u === n.length - 1, p.textContent = u + 1 + " / " + n.length, ["http:", "https:", "file:"].includes(location.protocol) && history.replaceState(null, "", location.href.split("#")[0] + "#slide-" + (u + 1));
  }
  function f() {
    const y = location.hash.match(/^#slide-(\d+)$/);
    return y ? Number(y[1]) - 1 : 0;
  }
  l.addEventListener("click", () => E(u - 1)), c.addEventListener("click", () => E(u + 1)), i.disabled = !document.documentElement.requestFullscreen, i.addEventListener("click", async () => {
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    } catch (y) {
      console.error("Fullscreen failed:", y), g.textContent = "Full screen is unavailable. You can continue viewing in this window.", clearTimeout(b), b = setTimeout(() => {
        g.textContent = "";
      }, 3e3);
    }
  }), document.addEventListener("fullscreenchange", () => {
    i.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  }), window.addEventListener("hashchange", () => E(f())), document.addEventListener("keydown", (y) => {
    y.ctrlKey || y.metaKey || y.altKey || y.isComposing || y.target.closest?.('input,textarea,[contenteditable="true"]') || y.key === " " && y.target.closest?.("button") || ["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(y.key) && (y.preventDefault(), y.key === "Home" ? E(0) : y.key === "End" ? E(n.length - 1) : E(u + (["ArrowRight", "ArrowDown", "PageDown", " "].includes(y.key) ? 1 : -1)));
  }), document.body.classList.add("interactive"), document.querySelector(".controls").hidden = !1, E(f());
}
async function Lo({ slideIds: n, renderSlide: l, title: c = "CList presentation" }) {
  if (!n.length) throw new Error("There are no slides to export.");
  const i = document.implementation.createHTMLDocument(c);
  i.documentElement.lang = "en";
  const p = i.createElement("meta");
  p.setAttribute("charset", "utf-8"), i.head.prepend(p);
  const g = i.createElement("meta");
  g.name = "viewport", g.content = "width=device-width, initial-scale=1", i.head.append(g);
  const u = i.createElement("style");
  u.textContent = Ni, i.head.append(u);
  const b = i.createElement("main");
  b.className = "stage", b.setAttribute("aria-label", c), i.body.append(b);
  for (const [w, S] of n.entries()) {
    const h = l(S, i);
    h.id = "slide-" + (w + 1), h.setAttribute("role", "group"), h.setAttribute("aria-label", "Slide " + (w + 1) + " of " + n.length), b.append(h);
  }
  const E = i.createElement("nav");
  E.className = "controls", E.hidden = !0, E.setAttribute("aria-label", "Slide navigation");
  for (const [w, S] of [["Previous", "previous"], ["Next", "next"], ["Full screen", "fullscreen"]]) {
    const h = i.createElement("button");
    h.type = "button", h.className = "btn", h.textContent = w, h.title = w, h.dataset.action = S, E.append(h);
  }
  const f = i.createElement("output");
  f.setAttribute("aria-live", "polite"), E.insertBefore(f, E.children[1]), i.body.append(E);
  const y = i.createElement("p");
  y.className = "viewer-status", y.setAttribute("role", "status"), i.body.append(y);
  const A = i.createElement("script");
  return A.textContent = "(" + ji.toString() + ")();", i.body.append(A), await Promise.all([...b.querySelectorAll("img")].map((w) => new Promise((S, h) => {
    const k = w.getAttribute("src") || "";
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(k)) {
      h(new Error("A slide image is missing or is not embedded."));
      return;
    }
    const L = new Image();
    L.onload = S, L.onerror = () => h(new Error("A slide image could not be read.")), L.src = k;
  }))), `<!doctype html>
` + i.documentElement.outerHTML;
}
async function Ii(n) {
  const l = await Lo(n), c = (n.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".html", i = URL.createObjectURL(new Blob([l], { type: "text/html;charset=utf-8" })), p = document.createElement("a");
  p.href = i, p.download = c, document.body.append(p);
  try {
    p.click();
  } finally {
    p.remove(), setTimeout(() => URL.revokeObjectURL(i), 6e4);
  }
}
async function Pi({ slideIds: n, renderSlide: l }) {
  const c = document.implementation.createHTMLDocument(""), i = n.map((A) => l(A, c)), p = c.createElement("div"), g = /* @__PURE__ */ new Set(["p", "strong", "em", "s", "u", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "br"]);
  function u(A) {
    if (A.nodeType === 3) return c.createTextNode(A.textContent);
    const w = A.nodeName.toLowerCase();
    let S;
    /^h[1-6]$/.test(w) ? S = c.createElement("h3") : w === "a" && /^(https?:|mailto:|tel:)/i.test(A.getAttribute("href") || "") ? (S = c.createElement("a"), S.setAttribute("href", A.getAttribute("href"))) : g.has(w) ? S = c.createElement(w) : S = c.createDocumentFragment(), w === "ol" && /^\d+$/.test(A.getAttribute("start") || "") && S.setAttribute("start", A.getAttribute("start"));
    for (const h of A.childNodes) S.append(u(h));
    return S;
  }
  async function b(A) {
    return await new Promise((w, S) => {
      const h = new Image();
      h.onload = () => w(h), h.onerror = () => S(new Error("A slide image could not be read.")), h.src = A;
    });
  }
  function E(A, w) {
    const S = document.createElement("canvas"), h = Math.min(2, 4096 / Math.max(A, w));
    S.width = Math.max(1, Math.round(A * h)), S.height = Math.max(1, Math.round(w * h));
    const k = S.getContext("2d");
    if (!k) throw new Error("The browser could not prepare a slide image.");
    return k.scale(S.width / A, S.height / w), { element: S, context: k };
  }
  function f(A, w, S, h) {
    const k = c.createElement("p"), L = c.createElement("img"), a = Math.min(1, 720 / S);
    L.width = Math.max(1, Math.round(S * a)), L.height = Math.max(1, Math.round(h * a)), L.style.maxWidth = "100%", L.style.height = "auto", L.src = A, L.alt = w, k.append(L), p.append(k);
  }
  async function y(A) {
    const w = A.cloneNode(!0);
    w.style.width = "1280px", w.style.height = "720px";
    for (const F of w.children) {
      const P = parseFloat(F.style.width) * 12.8;
      for (const v of [F, ...F.querySelectorAll("[style]")]) {
        const ne = v.closest(".shape-content") ? P / 100 : 12.8;
        v.setAttribute("style", v.getAttribute("style").replace(/([\d.]+)cqw/g, (_, M) => Number(M) * ne + "px"));
      }
    }
    const S = c.createElement("div"), h = c.createElement("style");
    h.textContent = `
      * {box-sizing:border-box;} .slide {position:relative;overflow:hidden;font-family:Arial,sans-serif;color:#202b3d;}
      .slide-object {position:absolute;} .text-content {width:100%;height:100%;overflow:hidden;padding:5px 8px;}
      .tiptap {font-size:var(--slide-font-size,33.28px);line-height:1.2;}
      p {margin:0 0 8px;} h1 {font-size:1em;} h2 {font-size:24px;} h3 {font-size:20px;}
      ul,ol {margin:0 0 .3em;padding-left:1.5em;} li p {margin-bottom:.2em;}
      .image-content {width:100%;height:100%;overflow:hidden;}
      .image-content img {display:block;width:100%;height:100%;object-fit:contain;}
      .shape-content,.shape-content svg {display:block;width:100%;height:100%;}
    `, S.append(h, w);
    const k = new XMLSerializer().serializeToString(S), L = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">' + k + "</foreignObject></svg>"), a = await b(L), R = E(1280, 720);
    return R.context.drawImage(a, 0, 0, 1280, 720), R.element.toDataURL("image/png");
  }
  for (const [A, w] of i.entries()) {
    const S = c.createElement("h2");
    S.textContent = "Slide " + (A + 1), p.append(S);
    const h = [...w.children].sort((L, a) => parseFloat(L.style.top) - parseFloat(a.style.top) || parseFloat(L.style.left) - parseFloat(a.style.left)), k = !!w.querySelector("svg");
    if (k) {
      const L = h.map((a) => a.querySelector(".tiptap")?.textContent.trim()).filter(Boolean);
      f(await y(w), "Slide " + (A + 1) + " diagram" + (L.length ? ": " + L.join("; ") : ""), 1280, 720);
    }
    for (const L of h) {
      const a = L.querySelector(".text-content .tiptap");
      if (a) {
        for (const M of a.childNodes) p.append(u(M));
        continue;
      }
      if (k) continue;
      let R, F;
      const P = L.querySelector("img"), v = L.querySelector("svg");
      let ne = parseFloat(L.style.width) * 12.8, _ = parseFloat(L.style.height) * 7.2;
      if (P) {
        if (R = P.getAttribute("src") || "", F = P.alt, !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(R)) throw new Error("A slide image is missing or is not embedded.");
        const M = await b(R);
        if (P.style.position === "absolute") {
          const q = E(ne, _);
          q.context.drawImage(M, parseFloat(P.style.left) * 12.8, parseFloat(P.style.top) * 12.8, parseFloat(P.style.width) * 12.8, parseFloat(P.style.height) * 12.8), R = q.element.toDataURL("image/png");
        } else {
          const q = Math.min(ne / M.width, _ / M.height);
          ne = M.width * q, _ = M.height * q;
        }
      } else if (v) {
        const M = v.cloneNode(!0);
        M.setAttribute("width", ne), M.setAttribute("height", _);
        for (const U of M.querySelectorAll("[vector-effect]")) {
          const ee = parseFloat(U.style.strokeWidth) * ne / 100;
          U.style.removeProperty("stroke-width"), U.setAttribute("stroke-width", Number.isFinite(ee) ? ee : 0);
        }
        const q = await b("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(M))), Z = E(ne, _);
        Z.context.drawImage(q, 0, 0, ne, _), R = Z.element.toDataURL("image/png"), F = "Diagram on slide " + (A + 1);
      } else continue;
      f(R, F || "Image on slide " + (A + 1), ne, _);
    }
    A < i.length - 1 && p.append(c.createElement("hr"));
  }
  return p.innerHTML;
}
const Di = [{ id: "rectangle", label: "Rectangle", width: 320, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } }] }, { id: "circle", label: "Circle", width: 220, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } }] }, { id: "line", label: "Line", width: 360, height: 4, defaults: { fillEnabled: !1, borderEnabled: !0, borderColour: "#202b3d", borderWidth: 4 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } }] }], zi = {
  shapes: Di
}, Ti = [{ id: "blank", label: "Blank", objects: [] }, { id: "title", label: "Title", objects: [{ kind: "text", x: 100, y: 260, width: 1080, height: 140, text: "Presentation title", fontSize: 64, textAlign: "center" }] }, { id: "title-body", label: "Title and body", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 1080, height: 400, text: "Add your content here.", fontSize: 32, textAlign: "left" }] }, { id: "two-columns", label: "Two columns", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 500, height: 400, text: "Left column", fontSize: 32, textAlign: "left" }, { kind: "text", x: 680, y: 220, width: 500, height: 400, text: "Right column", fontSize: 32, textAlign: "left" }] }], Fi = {
  layouts: Ti
}, Ri = [{ id: "classic", label: "Classic", fontFamily: "system", fontSize: 33.28, textColour: "#202b3d", background: "#ffffff", fillColour: "#51b158", borderColour: "#202b3d" }, { id: "midnight", label: "Midnight", fontFamily: "arial", fontSize: 33.28, textColour: "#f1f5f9", background: "#142033", fillColour: "#397ab8", borderColour: "#a6caed" }, { id: "paper", label: "Paper", fontFamily: "georgia", fontSize: 33.28, textColour: "#392f28", background: "#fff8e8", fillColour: "#dbb571", borderColour: "#76573a" }, { id: "ocean", label: "Ocean", fontFamily: "verdana", fontSize: 33.28, textColour: "#13354b", background: "#edf8fc", fillColour: "#56b6bd", borderColour: "#216479" }], Oi = {
  themes: Ri
}, Eo = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"]
}, Pn = (n) => typeof n == "string" && /^#[0-9a-f]{6}$/i.test(n), Mt = (n) => typeof n == "number" && Number.isFinite(n);
function fe(n, l) {
  if (!n) throw new Error("Slide catalog: " + l);
}
function Dn(n) {
  fe(n && typeof n.id == "string" && /^[a-z][a-z0-9-]{0,79}$/.test(n.id), "invalid entry ID"), fe(typeof n.label == "string" && n.label.trim().length > 0 && n.label.length <= 120, n.id + " needs a label");
}
function No(n, l) {
  const c = {};
  for (const i of ["fillEnabled", "borderEnabled", "keepAspectRatio", "locked"])
    n[i] !== void 0 && (fe(typeof n[i] == "boolean", l + ": invalid " + i), c[i] = n[i]);
  for (const i of ["fillColour", "borderColour", "textColour"])
    n[i] !== void 0 && (fe(Pn(n[i]), l + ": invalid " + i), c[i] = n[i]);
  for (const [i, p, g] of [["fontSize", 8, 200], ["borderWidth", 1, 20], ["rotation", -180, 180], ["cropX", 0, 100], ["cropY", 0, 100]])
    n[i] !== void 0 && (fe(Mt(n[i]) && n[i] >= p && n[i] <= g, l + ": invalid " + i), c[i] = n[i]);
  for (const [i, p] of [["textAlign", ["left", "center", "right", "justify"]], ["fontFamily", ["system", "arial", "verdana", "georgia", "times", "courier"]], ["imageFit", ["contain", "cover"]]])
    n[i] !== void 0 && (fe(p.includes(n[i]), l + ": invalid " + i), c[i] = n[i]);
  return c;
}
function sn(n) {
  Dn(n), fe(Mt(n.width) && n.width > 0 && n.width <= 1280 && Mt(n.height) && n.height > 0 && n.height <= 720, n.id + ": invalid default dimensions"), fe(Array.isArray(n.viewBox) && n.viewBox.length === 4 && n.viewBox.every(Mt) && n.viewBox[2] > 0 && n.viewBox[3] > 0, n.id + ": invalid SVG viewBox"), fe(Array.isArray(n.elements) && n.elements.length > 0 && n.elements.length <= 64, n.id + ": needs 1–64 SVG elements");
  const l = n.elements.map((c) => {
    fe(c && Object.hasOwn(Eo, c.tag), n.id + ": unsupported SVG element"), fe(c.attributes && typeof c.attributes == "object", n.id + ": missing SVG attributes");
    const i = {};
    for (const [p, g] of Object.entries(c.attributes))
      fe(Eo[c.tag].includes(p), n.id + ": unsupported SVG attribute " + p), p === "d" ? fe(typeof g == "string" && g.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(g), n.id + ": invalid path") : p === "points" ? fe(typeof g == "string" && g.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(g), n.id + ": invalid points") : fe(Mt(g), n.id + ": invalid SVG coordinate"), i[p] = g;
    return { tag: c.tag, attributes: i };
  });
  return { id: n.id, label: n.label, width: n.width, height: n.height, defaults: No(n.defaults || {}, n.id), viewBox: [...n.viewBox], elements: l };
}
function Bi(n, l) {
  Dn(n), fe(Array.isArray(n.objects) && n.objects.length <= 100, n.id + ": invalid objects array"), n.background !== void 0 && fe(Pn(n.background), n.id + ": invalid background"), n.notes !== void 0 && fe(typeof n.notes == "string", n.id + ": invalid notes");
  const c = n.objects.map((i) => {
    fe(i && ["text", "shape", "image"].includes(i.kind), n.id + ": unsupported object kind"), fe(["x", "y", "width", "height"].every((g) => Mt(i[g])) && i.x >= 0 && i.y >= 0 && i.width > 0 && i.height > 0 && i.x + i.width <= 1280 && i.y + i.height <= 720, n.id + ": object is outside the slide");
    const p = { kind: i.kind, x: i.x, y: i.y, width: i.width, height: i.height, ...No(i, n.id) };
    return i.kind === "text" && (fe(typeof i.text == "string", n.id + ": text object needs text"), p.text = i.text), i.kind === "shape" && (fe(l.has(i.shapeId), n.id + ": unknown shape " + i.shapeId), p.shapeId = i.shapeId), i.kind === "image" && (fe(typeof i.source == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(i.source), n.id + ": image needs embedded image data"), p.source = i.source, p.alt = typeof i.alt == "string" ? i.alt : ""), i.group !== void 0 && (fe(typeof i.group == "string" && i.group.length <= 80, n.id + ": invalid group"), p.group = i.group), p;
  });
  return { id: n.id, label: n.label, objects: c, ...n.background !== void 0 ? { background: n.background } : {}, ...n.notes !== void 0 ? { notes: n.notes } : {} };
}
function ln(n) {
  Dn(n), fe(["system", "arial", "verdana", "georgia", "times", "courier"].includes(n.fontFamily), n.id + ": invalid theme font"), fe(Mt(n.fontSize) && n.fontSize >= 8 && n.fontSize <= 200, n.id + ": invalid theme font size");
  const l = { id: n.id, label: n.label, fontFamily: n.fontFamily, fontSize: n.fontSize };
  for (const c of ["textColour", "background", "fillColour", "borderColour"])
    fe(Pn(n[c]), n.id + ": invalid theme " + c), l[c] = n[c];
  return l;
}
function In(n = {}) {
  const l = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), p = n.shapes === void 0 ? zi.shapes : n.shapes, g = n.layouts === void 0 ? Fi.layouts : n.layouts;
  fe(Array.isArray(p) && p.length > 0, "shapes must be a nonempty array"), fe(Array.isArray(g) && g.length > 0, "layouts must be a nonempty array");
  for (const b of p) {
    const E = sn(b);
    fe(!l.has(b.id), "duplicate shape ID " + b.id), l.set(b.id, E);
  }
  for (const b of g) {
    const E = Bi(b, l);
    fe(!c.has(b.id), "duplicate layout ID " + b.id), c.set(b.id, E);
  }
  const u = n.themes === void 0 ? Oi.themes : n.themes;
  fe(Array.isArray(u) && u.length > 0, "themes must be a nonempty array");
  for (const b of u) {
    const E = ln(b);
    fe(!i.has(b.id), "duplicate theme ID " + b.id), i.set(b.id, E);
  }
  return { shapes: l, layouts: c, themes: i };
}
async function Hi(n) {
  const l = await Promise.all(["shapes", "layouts", "themes"].map(async (i) => {
    const p = await fetch(new URL(i + ".json", n), { cache: "no-cache" });
    if (!p.ok) throw new Error("Could not load slide " + i + " catalog (HTTP " + p.status + ").");
    const g = await p.json();
    return fe(g && g.version === 1, "unsupported " + i + " catalog version"), fe(Array.isArray(g[i]), i + " catalog needs a " + i + " array"), g[i];
  })), c = { shapes: l[0], layouts: l[1], themes: l[2] };
  return In(c), c;
}
function Ui(n, l = {}) {
  if (!(n instanceof HTMLElement)) throw new TypeError("A container element is required");
  const { Y: c, Editor: i, StarterKit: p, Collaboration: g, HocuspocusProvider: u, Link: b } = l.dependencies, { shapes: E, layouts: f, themes: y } = In(l.catalogs), A = In().shapes.values().next().value, w = /* @__PURE__ */ new WeakMap(), S = /* @__PURE__ */ new Map(), h = document.createElement("div");
  h.className = "clist-slides app", h.innerHTML = ti, n.append(h);
  const k = 1280, L = 720, a = (e) => h.querySelector(`[data-control="${e}"]`);
  for (const e of h.querySelectorAll(".tools button")) wo(e);
  for (const e of E.values()) {
    const t = document.createElement("button");
    t.className = "btn-small", t.dataset.control = "add-" + e.id, t.title = "Add " + e.label, wo(t, e), t.addEventListener("click", () => Yn(e.id)), a("shape-tools").append(t);
  }
  for (const e of f.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, a("slide-layout").append(t);
  }
  const R = a("slide"), F = document.createElement("div"), P = document.createElement("div");
  F.className = "alignment-guide vertical", P.className = "alignment-guide horizontal", F.hidden = P.hidden = !0, R.append(F, P);
  let v = new c.Doc(), ne = null, _ = null, M = v.getMap("slide-objects"), q = v.getMap("slide-pages"), Z = v.getMap("slide-backgrounds"), U = v.getMap("slide-notes"), ee = v.getMap("clist_refs"), K = v.getMap("slide-design"), te = null, Y = null, pe = null, re = null, O = "first", me = /* @__PURE__ */ new Set(["first"]), Ce = "first", Ie = "first";
  const X = /* @__PURE__ */ new Map(), Qe = /* @__PURE__ */ new Map(), Ve = /* @__PURE__ */ new Map(), Ke = /* @__PURE__ */ new Map(), le = /* @__PURE__ */ new Map(), be = /* @__PURE__ */ new Set();
  let ze = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), ot = !0, wt = "", N = null, W = !1;
  const C = /* @__PURE__ */ new Set();
  let T = null, $ = null, G = !1, oe = null, ye = 0, Ne = null, ae = !1, Ee = null, de = null, ge = null, Me = null, D = null, se = !1, z = !1, Ae = null, Se = null, Ge = null, it = null, ht = null, rt = !1, at = null, Je = !1;
  const Pe = Ci({
    getDocument: () => v,
    encode: c.encodeStateAsUpdate,
    getName: () => a("doc-name").value,
    onError: (e) => {
      console.error("Background recovery failed:", e), J("Background recovery failed: " + e.message, "error");
    }
  }), st = ui(h, () => z);
  let Ye = null, Be = [], Ue = null;
  a("server-url").value = l.url || "", a("doc-name").value = l.documentName || "clist-slide-demo";
  function J(e, t = "") {
    a("connection-status").textContent = e, a("connection-status").className = `status ${t}`;
  }
  function qe(e) {
    Pe.changed(e), at?.changed(), l.onChange?.();
  }
  function gt(e) {
    l.onStatus ? l.onStatus(e) : J(e);
  }
  function We(e, t, o, r, s, d = null, x = "") {
    const m = new c.Map();
    m.set("x", t), m.set("y", o), m.set("width", r), m.set("height", s), m.set("rotation", 0), m.set("slide", O), m.set("layer", Math.max(-1, ...De().map((j) => _e(M.get(j)))) + 1), d && (m.set("kind", "image"), m.set("source", d), m.set("alt", x), m.set("imageRatio", r / s), m.set("aspectRatio", r / s), m.set("keepAspectRatio", !0)), M.set(e, m);
  }
  function Tt() {
    M.size || G || (G = !0, v.transact(() => {
      M.size || (K.has("theme") || K.set("theme", structuredClone(lt())), We("title", 105, 98, 820, 135), We("body", 108, 296, 690, 240));
    }, "init"), X.get("title")?.editor.commands.setContent("<h1>Collaborative slides</h1>"), X.get("body")?.editor.commands.setContent("<p>Click here to edit together.</p><p>Click and drag over text to select it. Hold on text or drag a box border to move it, or resize it from the lower-right corner.</p>"));
  }
  function Xe(e, t) {
    const o = document.createElement("div");
    o.className = t.get("kind") === "shape" ? "slide-object shape-object" : t.get("kind") === "image" ? "slide-object image-object" : "slide-object", o.dataset.id = e, o.tabIndex = 0, o.setAttribute("aria-label", t.get("kind") === "shape" ? "Shape object. Arrow keys move; Delete removes." : t.get("kind") === "image" ? "Image object. Arrow keys move; Delete removes." : "Text object. Arrow keys move; Enter edits.");
    const r = document.createElement("div");
    r.className = t.get("kind") === "shape" ? "shape-content" : t.get("kind") === "image" ? "image-content" : "text-content";
    const s = document.createElement("div");
    s.className = "resize-handle", o.append(r, s);
    for (const m of ["left", "right", "top", "bottom"]) {
      const j = document.createElement("div");
      j.className = "object-resize-edge object-resize-" + m, j.dataset.resizeEdge = m, j.title = "Resize " + m + " edge", j.addEventListener("pointerdown", (B) => Jt(B, e, "edge-" + m)), o.append(j);
    }
    {
      const m = t.get("kind") === "image" ? "image" : t.get("kind") === "shape" ? "shape" : "text box", j = document.createElement("div");
      j.className = "rotation-handle", j.title = "Rotate " + m + ": drag right clockwise, left counterclockwise", j.setAttribute("role", "slider"), j.setAttribute("aria-label", "Rotate " + m), j.setAttribute("aria-valuemin", "-180"), j.setAttribute("aria-valuemax", "180"), j.tabIndex = 0, j.addEventListener("pointerdown", (B) => Jt(B, e, "rotate")), j.addEventListener("keydown", (B) => {
        ["ArrowLeft", "ArrowRight"].includes(B.key) && (B.preventDefault(), B.stopPropagation(), !(z || t.get("locked") === !0) && t.set("rotation", mo(t.get("rotation"), B.key === "ArrowRight" ? 1 : -1)));
      }), o.append(j);
    }
    R.append(o);
    let d = null;
    if (t.get("kind") === "shape")
      r.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    else if (t.get("kind") === "image") {
      const m = document.createElement("img");
      m.src = kt(t.get("source")), m.alt = typeof t.get("alt") == "string" ? t.get("alt") : "", m.draggable = !1, m.addEventListener("load", () => {
        X.has(e) && fn(e);
      }), r.append(m);
    } else {
      const m = v.getXmlFragment(`slide-text-${e}`);
      D?.addToScope(m), se = !0;
      try {
        d = new i({
          element: r,
          editable: !z,
          extensions: [
            p.configure({ undoRedo: !1, history: !1, link: !1 }),
            b.configure({ openOnClick: !1, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
            g.configure({ document: v, field: `slide-text-${e}` })
          ],
          editorProps: {
            attributes: { "aria-label": `Edit text in ${e}` }
          },
          onFocus: () => {
            $ = e, Le(e, !1, C.has(e));
          },
          onBlur: () => {
            $ === e && ($ = null), D?.stopCapturing();
          }
        });
      } finally {
        se = !1;
      }
    }
    const x = ni(o, s, {
      current: () => !z && X.get(e)?.node === o,
      text: () => !!d,
      select: (m) => Le(e, m, !1, !0),
      focus: () => {
        h.tabIndex = -1, h.focus({ preventScroll: !0 });
      },
      move: (m) => Jt(m, e, "move")
    });
    o.addEventListener("dblclick", (m) => {
      t.get("kind") === "image" && !m.target.closest(".rotation-handle") && (m.preventDefault(), m.stopPropagation(), Le(e), Qn());
    }), o.addEventListener("focus", () => {
      Le(e, !1, C.has(e));
      const m = document.getSelection();
      m?.anchorNode && h.contains(m.anchorNode) && m.removeAllRanges();
    }), s.addEventListener("pointerdown", (m) => Jt(m, e, "resize")), X.set(e, { node: o, editor: d, box: t, content: r, disposePointer: x }), fn(e), T === e && o.classList.add("selected");
  }
  const xt = {
    system: "system-ui, sans-serif",
    arial: "Arial, Helvetica, sans-serif",
    verdana: "Verdana, Geneva, sans-serif",
    georgia: "Georgia, serif",
    times: '"Times New Roman", Times, serif',
    courier: '"Courier New", Courier, monospace'
  };
  function lt() {
    const e = K.get("theme");
    if (e)
      try {
        return ln(e);
      } catch {
      }
    return y.values().next().value;
  }
  function dn() {
    const e = new Map(y);
    for (const [o, r] of K.entries())
      if (o.startsWith("saved-theme:"))
        try {
          const s = ln(r);
          e.set(s.id, s);
        } catch (s) {
          console.error("Invalid saved theme:", s), J("A saved theme could not be read. Other themes are still available.", "error");
        }
    const t = lt();
    return e.set(t.id, t), e;
  }
  function zn(e) {
    const t = dn().get(e);
    !t || z || (D?.stopCapturing(), K.set("theme", structuredClone(t)), D?.stopCapturing(), J("Theme applied: " + t.label));
  }
  a("theme").addEventListener("change", (e) => zn(e.target.value));
  function jo() {
    const e = lt(), t = a("theme");
    t.replaceChildren();
    for (const r of dn().values()) {
      const s = document.createElement("option");
      s.value = r.id, s.textContent = r.label, t.append(s);
    }
    t.value = e.id;
    const o = a("theme-preview");
    if (o) {
      o.replaceChildren();
      for (const r of [e.background, e.textColour, e.fillColour, e.borderColour]) {
        const s = document.createElement("span");
        s.style.backgroundColor = r, o.append(s);
      }
    }
  }
  function vt(e) {
    const t = lt(), o = (s, d) => /^#[0-9a-f]{6}$/i.test(e.get(s) || "") ? e.get(s) : d, r = Number(e.get("borderWidth"));
    return {
      fill: e.get("fillEnabled") === !0,
      fillColour: o("fillColour", e.get("kind") === "shape" ? t.fillColour : t.background),
      border: e.get("borderEnabled") === !0,
      borderColour: o("borderColour", t.borderColour),
      width: Number.isFinite(r) && r >= 1 && r <= 20 ? r : 2
    };
  }
  function mt(e) {
    const t = lt(), o = Number(e.get("fontSize")), r = e.get("textColour"), s = e.get("textAlign");
    return {
      size: Number.isFinite(o) && o >= 8 && o <= 200 ? o : t.fontSize,
      colour: typeof r == "string" && /^#[0-9a-f]{6}$/i.test(r) ? r : t.textColour,
      align: ["left", "center", "right", "justify"].includes(s) ? s : "left",
      family: Object.prototype.hasOwnProperty.call(xt, e.get("fontFamily")) ? e.get("fontFamily") : t.fontFamily
    };
  }
  function _e(e) {
    const t = e.get("layer");
    return typeof t == "number" && Number.isFinite(t) ? t : 0;
  }
  function De(e = O) {
    return [...M.keys()].filter((t) => {
      const o = M.get(t);
      return o instanceof c.Map && (o.get("slide") || "first") === e;
    }).sort((t, o) => _e(M.get(t)) - _e(M.get(o)) || t.localeCompare(o));
  }
  function un(e) {
    const t = (o) => {
      const r = e.get(o);
      return typeof r == "number" && Number.isFinite(r) ? Math.max(0, Math.min(100, r)) : 50;
    };
    return { fit: e.get("imageFit") === "cover" ? "cover" : "contain", x: t("cropX"), y: t("cropY") };
  }
  function qt(e, t) {
    const o = Number(e.get("cropImageWidth")), r = Number(e.get("cropImageHeight"));
    if (o > 0 && r > 0) return { width: o, height: r };
    const s = t?.naturalWidth > 0 ? t.naturalWidth / t.naturalHeight : Number(e.get("imageRatio")) || eo(e), d = Math.max(e.get("width"), e.get("height") * s);
    return { width: d, height: d / s };
  }
  function Tn(e) {
    if (e.get("kind") !== "image" || e.get("imageFit") !== "cover") return;
    const t = X.get([...M.keys()].find((r) => M.get(r) === e))?.content.querySelector("img"), o = qt(e, t);
    e.set("cropImageWidth", o.width), e.set("cropImageHeight", o.height);
  }
  function pn(e, t, o = !1) {
    const r = un(t);
    if (e.style.objectFit = "contain", e.style.objectPosition = r.x + "% " + r.y + "%", r.fit === "cover") {
      e.style.objectFit = "fill";
      const s = qt(t, e);
      e.style.position = "absolute", e.style.width = o ? s.width / 12.8 + "cqw" : 100 * s.width / t.get("width") + "%", e.style.height = o ? s.height / 12.8 + "cqw" : 100 * s.height / t.get("height") + "%", e.style.left = o ? (t.get("width") - s.width) * r.x / 1280 + "cqw" : (t.get("width") - s.width) * r.x / t.get("width") + "%", e.style.top = o ? (t.get("height") - s.height) * r.y / 1280 + "cqw" : (t.get("height") - s.height) * r.y / t.get("height") + "%";
    } else
      e.style.position = "static", e.style.width = e.style.height = "100%", e.style.left = e.style.top = "";
  }
  function Wt(e) {
    const t = e.get("shapeDefinition");
    if (t && typeof t == "object") {
      if (!w.has(t))
        try {
          w.set(t, sn(t));
        } catch (o) {
          console.error("Invalid saved shape definition:", o), J("A saved shape definition is invalid; showing a fallback shape.", "error"), w.set(t, A);
        }
      return w.get(t);
    }
    return E.get(e.get("shapeType")) || A;
  }
  function Fn(e) {
    const { fillColour: t, borderColour: o, ...r } = e.defaults;
    return { kind: "shape", shapeType: e.id, shapeDefinition: structuredClone(e), ...r };
  }
  function Xt(e, t) {
    const o = "http://www.w3.org/2000/svg", r = Math.max(1, Number(t.get("width")) || 1), s = Math.max(1, Number(t.get("height")) || 1), d = vt(t), x = Wt(t), m = d.border ? Math.min(d.width, r, s) : 0, [j, B, I, H] = x.viewBox;
    e.setAttribute("viewBox", "0 0 " + r + " " + s), e.setAttribute("preserveAspectRatio", "none");
    const V = document.createElementNS(o, "g");
    V.setAttribute("transform", "translate(" + m / 2 + " " + m / 2 + ") scale(" + Math.max(1e-3, r - m) / I + " " + Math.max(1e-3, s - m) / H + ") translate(" + -j + " " + -B + ")");
    for (const ce of x.elements) {
      const ke = document.createElementNS(o, ce.tag);
      for (const [ie, Re] of Object.entries(ce.attributes)) ke.setAttribute(ie, String(Re));
      ke.setAttribute("fill", d.fill ? d.fillColour : "none"), ke.setAttribute("stroke", d.border ? d.borderColour : "none"), ke.setAttribute("vector-effect", "non-scaling-stroke"), ke.style.strokeWidth = 100 * m / r + "cqw", ke.setAttribute("stroke-linecap", "round"), ke.setAttribute("stroke-linejoin", "round"), V.append(ke);
    }
    e.replaceChildren(V);
  }
  function fn(e) {
    const t = X.get(e);
    if (!t) return;
    const { node: o, box: r } = t;
    if (o.style.left = `${100 * Number(r.get("x") || 0) / k}%`, o.style.top = `${100 * Number(r.get("y") || 0) / L}%`, o.style.width = `${100 * Number(r.get("width") || 0) / k}%`, o.style.height = `${100 * Number(r.get("height") || 0) / L}%`, o.style.transform = `rotate(${Number(r.get("rotation") || 0)}deg)`, o.querySelector(".rotation-handle")?.setAttribute("aria-valuenow", String(Number(r.get("rotation")) || 0)), o.classList.toggle("locked", r.get("locked") === !0), o.title = r.get("locked") === !0 ? "Locked object: select it and click Unlock to move, resize or delete." : "", o.style.zIndex = String(De().indexOf(e)), r.get("kind") === "shape") Xt(t.content.querySelector("svg"), r);
    else if (!t.editor) {
      const s = t.content.querySelector("img"), d = kt(r.get("source"));
      s.getAttribute("src") !== d && (s.src = d), s.alt = typeof r.get("alt") == "string" ? r.get("alt") : "", pn(s, r, !0);
    }
    if (t.editor) {
      const s = mt(r);
      o.style.setProperty("--slide-font-size", s.size / 12.8 + "cqw"), o.style.fontFamily = xt[s.family], o.style.color = s.colour, o.style.textAlign = s.align;
      const d = vt(r);
      t.content.style.backgroundColor = d.fill ? d.fillColour : "transparent", t.content.style.border = d.border ? d.width / 12.8 + "cqw solid " + d.borderColour : "none";
    }
  }
  function Ft() {
    const e = U.get(O), t = typeof e == "string" ? e : "";
    a("speaker-notes").value !== t && (a("speaker-notes").value = t);
  }
  a("speaker-notes").addEventListener("input", (e) => {
    z || U.set(O, e.target.value);
  });
  function At(e) {
    const t = Z.get(e);
    return typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t : lt().background;
  }
  a("slide-background").addEventListener("change", (e) => {
    if (z) return;
    const t = e.target.value;
    /^#[0-9a-f]{6}$/i.test(t) && Z.set(O, t);
  });
  function ve() {
    return q.size ? [...q.keys()].sort((e, t) => q.get(e) - q.get(t) || e.localeCompare(t)) : ["first"];
  }
  function hn(e) {
    const t = Ke.get(e), o = M.get(e);
    if (t !== void 0 && (be.add(t), le.get(t)?.delete(e), le.get(t)?.size || le.delete(t), Ke.delete(e)), o instanceof c.Map) {
      const r = o.get("slide") || "first";
      Ke.set(e, r), ze.set(o, e), le.has(r) || le.set(r, /* @__PURE__ */ new Set()), le.get(r).add(e), be.add(r);
    }
  }
  function Io() {
    Ke.clear(), le.clear(), be.clear(), ze = /* @__PURE__ */ new WeakMap(), Fe = /* @__PURE__ */ new WeakMap(), M.forEach((e, t) => hn(t)), ot = !0;
  }
  function $t(e) {
    for (const t of e.changed.get(M) || []) t !== null && hn(t);
    for (const [t, o] of e.changed)
      if (t === K) ot = !0;
      else if (t === Z) for (const r of o) be.add(r);
      else if (ze.has(t)) hn(ze.get(t));
      else {
        let r = t;
        for (; r.parent; ) r = r.parent;
        if (!(r instanceof c.XmlFragment)) continue;
        if (!Fe.has(r))
          for (const [d, x] of v.share) d.startsWith("slide-text-") && Fe.set(x, d.slice(11));
        const s = Ke.get(Fe.get(r));
        s !== void 0 && be.add(s);
      }
  }
  function Vt(e = ve()) {
    e.includes(O) || (O = e[0]), Ce !== O ? (me = /* @__PURE__ */ new Set([O]), Ie = O) : (me = new Set(e.filter((t) => me.has(t))), me.size || me.add(O)), Ce = O, e.includes(Ie) || (Ie = O);
  }
  function Kt() {
    return Vt(), ve().filter((e) => me.has(e));
  }
  function bt(e, t = e[0], o = t) {
    me = new Set(e), O = t, Ce = t, Ie = o, T = null, C.clear();
  }
  function Lt() {
    if (te?.mode === "outline") {
      te.focus(O);
      return;
    }
    a("slide-list").querySelector(`[data-slide-id="${O}"]`)?.focus({ preventScroll: !0 });
  }
  function Gt(e, t = {}) {
    const o = ve();
    if (!(z || !o.includes(e))) {
      if (xe(), Vt(o), t.shiftKey) {
        const r = o.indexOf(Ie), s = o.indexOf(e), d = o.slice(Math.min(r, s), Math.max(r, s) + 1);
        bt(t.ctrlKey || t.metaKey ? [...me, ...d] : d, e, Ie);
      } else if (t.ctrlKey || t.metaKey) {
        const r = new Set(me);
        r.has(e) && r.size > 1 ? r.delete(e) : r.add(e), bt([...r], r.has(e) ? e : r.has(O) ? O : [...r][0], e);
      } else bt([e], e);
      we(), Lt();
    }
  }
  function Rn() {
    const e = a("object-list");
    if (!e) return;
    const t = De().reverse();
    for (const [o, r] of Qe)
      t.includes(o) || (r.remove(), Qe.delete(o));
    t.forEach((o, r) => {
      const s = M.get(o), d = s.get("kind") === "image", x = s.get("kind") === "shape", m = d ? s.get("alt") : X.get(o)?.editor?.getText(), j = (typeof m == "string" ? m : "").replace(/\s+/g, " ").trim().slice(0, 60), B = x ? "Shape: " + Wt(s).label : (d ? "Image: " : "Text: ") + (j || (d ? "Untitled image" : "Empty text box"));
      let I = Qe.get(o);
      I || (I = document.createElement("button"), I.className = "btn-small", I.dataset.objectId = o, I.addEventListener("click", (H) => {
        z || (xe(), Le(o, H.shiftKey, !1, !0), h.tabIndex = -1, h.focus({ preventScroll: !0 }));
      }), Qe.set(o, I)), I.textContent = B + (s.get("groupId") ? " (Grouped)" : "") + (s.get("locked") === !0 ? " (Locked)" : ""), I.title = "Select " + B + ". Shift-click to add or remove from selection.", I.setAttribute("aria-pressed", String(C.has(o))), e.children[r] !== I && e.insertBefore(I, e.children[r] || null);
    });
  }
  function gn() {
    for (const e of h.querySelectorAll(".slide-drop-before, .slide-drop-after, .slide-dragging")) e.classList.remove("slide-drop-before", "slide-drop-after", "slide-dragging");
  }
  function mn() {
    gn(), Ye = null, Be = [], Ue = null;
  }
  const ct = h.querySelector(".rail");
  ct.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-slide-id]");
    if (!t || z || ve().length < 2 || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    xe();
    const o = t.dataset.slideId;
    Vt(), me.has(o) || bt([o]), Ye = o, Be = Kt(), e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", "CList slide");
    for (const r of a("slide-list").querySelectorAll("[data-slide-id]")) Be.includes(r.dataset.slideId) && r.classList.add("slide-dragging");
  }), ct.addEventListener("dragover", (e) => {
    if (!Ye || z) return;
    e.preventDefault(), e.dataTransfer.dropEffect = "move", gn();
    const t = [...a("slide-list").querySelectorAll(":scope > [data-slide-id]")], o = t[si(t.map((d) => d.getBoundingClientRect()), e.clientX, e.clientY, te?.mode === "sorter")];
    Ue = o?.dataset.slideId || null, (o || t.at(-1))?.classList.add(o ? "slide-drop-before" : "slide-drop-after");
    for (const d of t) Be.includes(d.dataset.slideId) && d.classList.add("slide-dragging");
    const s = ct.getBoundingClientRect();
    e.clientY < s.top + 35 ? ct.scrollTop -= 18 : e.clientY > s.bottom - 35 && (ct.scrollTop += 18);
  }), ct.addEventListener("dragleave", (e) => {
    ct.contains(e.relatedTarget) || gn();
  }), ct.addEventListener("dragend", () => {
    mn(), we();
  }), ct.addEventListener("drop", (e) => {
    if (!Ye || z) return;
    e.preventDefault();
    const t = [...Be], o = Ue;
    mn();
    const r = ve(), s = Mi(r, t, o);
    s.every((d, x) => d === r[x]) || (T = null, C.clear(), D?.stopCapturing(), v.transact(() => s.forEach((d, x) => q.set(d, x))), D?.stopCapturing(), Lt(), gt(t.length === 1 ? "Slide moved to position " + (s.indexOf(t[0]) + 1) : t.length + " slides moved"));
  }), ct.addEventListener("keydown", (e) => {
    if (z || e.isComposing) return;
    const t = ve(), o = t.indexOf(O);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")
      e.preventDefault(), e.stopPropagation(), bt(t, O, Ie), we(), Lt();
    else if (e.key === "Escape")
      e.preventDefault(), e.stopPropagation(), Gt(O);
    else if (e.key === "Delete" || e.key === "Backspace")
      e.preventDefault(), e.stopPropagation(), a("delete-slide").disabled || a("delete-slide").click();
    else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(), e.stopPropagation();
      const r = e.key === "ArrowUp" ? -1 : 1;
      e.altKey ? To(r) : t[o + r] && Gt(t[o + r], e);
    }
  });
  function Nt() {
    Cn(), Rn();
    const e = ve(), t = JSON.stringify(e);
    Ye && t !== wt && mn(), wt = t, Vt(e);
    const o = a("slide-list"), r = new Set(e);
    for (const [m, j] of Ve) r.has(m) || (j.button.remove(), Ve.delete(m), be.delete(m));
    let s = o.firstElementChild;
    e.forEach((m, j) => {
      let B = Ve.get(m);
      if (!B) {
        const nt = document.createElement("button"), Oe = document.createElement("div"), dt = document.createElement("div"), Te = document.createElement("span");
        nt.className = "clist-action-btn btn-small", nt.dataset.slideId = m, dt.className = "mini-slide", Te.className = "slide-number", Oe.append(Te, dt), nt.append(Oe), nt.addEventListener("click", (je) => Gt(m, je)), B = { button: nt, thumb: Oe, preview: dt, label: Te }, Ve.set(m, B), be.add(m);
      }
      const { button: I, thumb: H, preview: V, label: ce } = B, ke = "Slide " + (j + 1) + ". Ctrl/Cmd-click to toggle; Shift-click for a range. Drag to move selected slides.";
      I.title !== ke && (I.title = ke);
      const ie = e.length > 1 && !z;
      I.draggable !== ie && (I.draggable = ie);
      const Re = String(me.has(m));
      I.getAttribute("aria-pressed") !== Re && I.setAttribute("aria-pressed", Re), m === O ? I.hasAttribute("aria-current") || I.setAttribute("aria-current", "true") : I.hasAttribute("aria-current") && I.removeAttribute("aria-current");
      const He = "slide-thumb" + (me.has(m) ? " selected" : "") + (m === O ? " active-slide" : "");
      H.className !== He && (H.className = He), (ot || be.has(m)) && (V.style.backgroundColor = At(m), V.replaceChildren(), [...le.get(m) || []].sort((Oe, dt) => _e(M.get(Oe)) - _e(M.get(dt)) || Oe.localeCompare(dt)).forEach((Oe, dt) => {
        const Te = M.get(Oe), je = document.createElement("div");
        if (je.className = "mini-object", je.style.zIndex = String(dt), je.style.transform = `rotate(${Number(Te.get("rotation")) || 0}deg)`, je.style.left = 100 * Te.get("x") / k + "%", je.style.top = 100 * Te.get("y") / L + "%", je.style.width = 100 * Te.get("width") / k + "%", je.style.height = 100 * Te.get("height") / L + "%", Te.get("kind") === "shape") {
          const Ze = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          Xt(Ze, Te), je.append(Ze);
        } else if (Te.get("kind") === "image") {
          const Ze = document.createElement("img");
          Ze.src = kt(Te.get("source")), Ze.alt = "", Ze.draggable = !1, pn(Ze, Te), je.append(Ze);
        } else {
          const Ze = mt(Te);
          je.style.color = Ze.colour, je.style.fontFamily = xt[Ze.family], je.style.background = "transparent", je.textContent = v.getXmlFragment("slide-text-" + Oe).toString().replace(/<[^>]*>/g, " ");
        }
        V.append(je);
      })), ce.textContent !== String(j + 1) && (ce.textContent = String(j + 1)), s === I ? s = s.nextElementSibling : o.insertBefore(I, s);
    }), be.clear(), ot = !1;
    const d = e.indexOf(O), x = me.size;
    a("slide-label").textContent = "Slide " + (d + 1) + " of " + e.length + (x > 1 ? " · " + x + " selected" : ""), a("duplicate-slide").disabled = z, a("duplicate-slide").title = x > 1 ? "Duplicate " + x + " selected slides" : "Duplicate the selected slide", a("delete-slide").disabled = z || x >= e.length, a("delete-slide").title = x >= e.length ? "At least one slide must remain" : x > 1 ? "Delete " + x + " selected slides" : "Delete selected slide", a("presentation-position").textContent = d + 1 + " / " + e.length, a("previous-slide").disabled = d <= 0, a("next-slide").disabled = d >= e.length - 1, te?.refresh();
  }
  function we() {
    jo();
    const e = ve();
    e.includes(O) || (xe(), T = null, C.clear(), O = e[0]), Ft(), R.style.backgroundColor = At(O), a("slide-background").value = At(O);
    for (const [t, o] of X)
      (!M.has(t) || (M.get(t).get("slide") || "first") !== O) && (o.disposePointer?.(), o.editor?.destroy(), o.node.remove(), X.delete(t), C.delete(t), T === t && (T = [...C].at(-1) || null));
    M.forEach((t, o) => {
      !(t instanceof c.Map) || (t.get("slide") || "first") !== O || (X.has(o) ? (X.get(o).box = t, fn(o)) : Xe(o, t));
    }), Le(T, !1, !0), Nt();
  }
  function bn(e) {
    if (!X.has(e)) return [];
    const t = M.get(e)?.get("groupId");
    return typeof t == "string" && t ? De().filter((o) => M.get(o).get("groupId") === t) : [e];
  }
  function On(e = !1) {
    if (z || et() || !C.size || !e && C.size < 2) return;
    xe();
    const t = "group-" + crypto.randomUUID();
    D?.stopCapturing(), v.transact(() => {
      for (const o of C)
        e ? M.get(o).delete("groupId") : M.get(o).set("groupId", t);
    }), D?.stopCapturing(), J(e ? "Selected objects ungrouped." : "Selected objects grouped.");
  }
  a("group-objects").addEventListener("click", () => On()), a("ungroup-objects").addEventListener("click", () => On(!0));
  function yn(e, t) {
    const o = { ...e };
    return typeof o.groupId == "string" && o.groupId && (t.has(o.groupId) || t.set(o.groupId, "group-" + crypto.randomUUID()), o.groupId = t.get(o.groupId)), o;
  }
  function Po(e = !1) {
    if (Je || z) return;
    const t = [...C].sort().map((x) => x + ":" + (M.get(x)?.get("kind") || "text")).join("|");
    if (!e && t === ht) return;
    ht = t;
    const o = M.get(T), r = C.size > 1 ? "arrange" : o ? o.get("kind") === "image" ? "images" : o.get("kind") === "shape" ? "appearance" : "text" : "slide", s = h.querySelector(".inspector"), d = s.querySelector('[data-panel="' + r + '"]');
    for (const x of s.querySelectorAll(":scope > .control-section")) x.open = x === d;
    d && (s.scrollTop += d.getBoundingClientRect().top - s.getBoundingClientRect().top - s.clientTop);
  }
  function Le(e, t = !1, o = !1, r = !1) {
    for (const ie of C) X.has(ie) || C.delete(ie);
    if (t && e && X.has(e)) {
      const ie = bn(e), Re = ie.every((He) => C.has(He));
      for (const He of ie)
        Re ? C.delete(He) : C.add(He);
    } else if (!o) {
      C.clear();
      for (const ie of bn(e)) C.add(ie);
    }
    if (o) for (const ie of [...C]) for (const Re of bn(ie)) C.add(Re);
    T = C.has(e) ? e : [...C].at(-1) || null;
    for (const [ie, Re] of X) Re.node.classList.toggle("selected", C.has(ie));
    re && !re.current() && re.destroy();
    const s = C.size > 1, d = et();
    h.classList.toggle("multi-selection", s);
    const x = [...C].map((ie) => M.get(ie)?.get("groupId")), m = x.length > 1 && !!x[0] && x.every((ie) => ie === x[0]);
    a("group-objects").disabled = d || !s || m, a("ungroup-objects").disabled = d || !x.some(Boolean), a("lock-objects").disabled = !C.size || [...C].every((ie) => M.get(ie)?.get("locked") === !0), a("unlock-objects").disabled = !d, a("distribute-horizontal").disabled = a("distribute-vertical").disabled = d || C.size < 3;
    for (const ie of ["left", "center", "right", "top", "middle", "bottom"]) a("align-" + ie).disabled = d || !s;
    const j = T ? M.get(T) : null;
    _?.update(j?.get("kind") === "image" && !s, !d && !z), a("selection-details") && (a("selection-details").textContent = s ? C.size + " objects selected. Drag an object or use arrow keys to move together." : j ? `${T}
Position: ${Math.round(j.get("x"))}, ${Math.round(j.get("y"))}
Size: ${Math.round(j.get("width"))} × ${Math.round(j.get("height"))}` : "Select an object"), a("keep-aspect-ratio").disabled = d || s || j?.get("kind") !== "image", a("keep-aspect-ratio").checked = j?.get("kind") === "image" && j.get("keepAspectRatio") !== !1;
    const B = j ? un(j) : { fit: "contain" }, I = d || s || j?.get("kind") !== "image";
    a("image-description").disabled = I;
    const H = !s && j?.get("kind") === "image" && typeof j.get("alt") == "string" ? j.get("alt") : "";
    a("image-description").value !== H && (a("image-description").value = H), a("replace-image").disabled = I, a("crop-image").disabled = I, a("image-fit").disabled = I, a("image-fit").value = B.fit, a("cut-objects").disabled = !C.size || d, a("copy-objects").disabled = !C.size, to(), a("paste-objects").disabled = !de?.items.length, a("duplicate").disabled = !T || s, a("delete").disabled = d || !T;
    const V = De(), ce = V.indexOf(T);
    a("bring-forward").disabled = d || s || ce < 0 || ce === V.length - 1, a("send-backward").disabled = d || s || ce <= 0, a("bold").disabled = s || !X.get(T)?.editor, a("italic").disabled = s || !X.get(T)?.editor, a("edit-link").disabled = s || !X.get(T)?.editor, a("remove-link").disabled = s || !X.get(T)?.editor, Me && T !== Me && jt(), a("bullet-list").disabled = s || !X.get(T)?.editor, a("ordered-list").disabled = s || !X.get(T)?.editor;
    for (const ie of ["font-family", "font-size", "text-colour", "text-align"]) a(ie).disabled = s || !X.get(T)?.editor;
    const ke = j && !s && (!!X.get(T)?.editor || j.get("kind") === "shape");
    for (const ie of ["fill-enabled", "fill-colour", "border-enabled", "border-colour", "border-width"]) a(ie).disabled = !ke;
    if (ke) {
      const ie = vt(j);
      a("fill-enabled").checked = ie.fill, a("fill-colour").value = ie.fillColour, a("fill-colour").disabled = !ie.fill, a("border-enabled").checked = ie.border, a("border-colour").value = ie.borderColour, a("border-width").value = String(ie.width), a("border-colour").disabled = a("border-width").disabled = !ie.border;
    }
    if (j && !s && X.get(T)?.editor) {
      const ie = mt(j);
      a("font-family").value = ie.family, a("font-size").value = String(Math.round(ie.size)), a("text-colour").value = ie.colour, a("text-align").value = ie.align;
    }
    Rn(), Po(r), Ge?.schedule();
  }
  function Jt(e, t, o) {
    if (z || e.button !== 0) return;
    if (e.preventDefault(), e.stopPropagation(), D?.stopCapturing(), D && (D.captureTimeout = 1 / 0), Le(t, !1, o === "move" && C.has(t), !0), et()) {
      xe(), J("Unlock selected objects before moving or resizing.", "error");
      return;
    }
    X.get(t)?.node.focus({ preventScroll: !0 });
    const r = M.get(t);
    if (!r) return;
    (o === "resize" || o.startsWith("edge-")) && Tn(r);
    const s = k / R.getBoundingClientRect().width, d = [...C].map((m) => ({ id: m, ...M.get(m).toJSON() })), x = Yt(d);
    oe = {
      imageMode: _?.mode || "resize",
      imageCrop: qt(r),
      rotation: Number(r.get("rotation")) || 0,
      members: d,
      id: t,
      action: o,
      startX: e.clientX,
      startY: e.clientY,
      scale: s,
      original: o === "move" ? x : {
        x: r.get("x"),
        y: r.get("y"),
        width: r.get("width"),
        height: r.get("height")
      }
    }, oe.target = e.currentTarget, oe.pointerId = e.pointerId, e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.addEventListener("pointermove", qn), e.currentTarget.addEventListener("pointerup", xe, { once: !0 }), e.currentTarget.addEventListener("pointercancel", xe, { once: !0 });
  }
  function Yt(e) {
    const t = Math.min(...e.map((r) => r.x)), o = Math.min(...e.map((r) => r.y));
    return { x: t, y: o, width: Math.max(...e.map((r) => r.x + r.width)) - t, height: Math.max(...e.map((r) => r.y + r.height)) - o };
  }
  function et() {
    return [...C].some((e) => M.get(e)?.get("locked") === !0);
  }
  function Bn(e) {
    z || !C.size || (xe(), v.transact(() => {
      for (const t of C) M.get(t)?.set("locked", e);
    }), J(e ? "Selected objects locked." : "Selected objects unlocked."));
  }
  a("lock-objects").addEventListener("click", () => Bn(!0)), a("unlock-objects").addEventListener("click", () => Bn(!1));
  function _t(e) {
    const t = (Number(e.rotation) || 0) * Math.PI / 180, o = Math.abs(e.width * Math.cos(t)) + Math.abs(e.height * Math.sin(t)), r = Math.abs(e.width * Math.sin(t)) + Math.abs(e.height * Math.cos(t));
    return { x: e.x + (e.width - o) / 2, y: e.y + (e.height - r) / 2, width: o, height: r };
  }
  function Do(e) {
    if (z || et() || C.size < 2) return;
    xe();
    const t = [...C].map((r) => ({ id: r, ...M.get(r).toJSON() })), o = Yt(t.map(_t));
    D?.stopCapturing(), v.transact(() => {
      for (const r of t) {
        const s = M.get(r.id), d = _t(r);
        let x = 0, m = 0;
        e === "left" && (x = o.x - d.x), e === "center" && (x = o.x + o.width / 2 - d.x - d.width / 2), e === "right" && (x = o.x + o.width - d.x - d.width), e === "top" && (m = o.y - d.y), e === "middle" && (m = o.y + o.height / 2 - d.y - d.height / 2), e === "bottom" && (m = o.y + o.height - d.y - d.height), ["left", "center", "right"].includes(e) ? s.set("x", r.x + x) : s.set("y", r.y + m);
      }
    }, "geometry"), D?.stopCapturing();
  }
  for (const e of ["left", "center", "right", "top", "middle", "bottom"])
    a("align-" + e).addEventListener("click", () => Do(e));
  function Hn(e) {
    if (z || et() || C.size < 3) return;
    xe();
    const t = e ? "y" : "x", o = e ? "height" : "width", r = [...C].map((I) => {
      const H = M.get(I).toJSON();
      return { id: I, box: H, bounds: _t(H) };
    }).sort((I, H) => I.bounds[t] - H.bounds[t] || I.id.localeCompare(H.id)), s = r[0], d = r[r.length - 1], x = s.bounds[t], m = d.bounds[t] + d.bounds[o], j = r.reduce((I, H) => I + H.bounds[o], 0), B = (m - x - j) / (r.length - 1);
    if (B < -1e-6) {
      const H = "Not enough room " + (e ? "vertically" : "horizontally") + ": the objects need " + Math.ceil(j) + " px, but their outer edges span only " + Math.floor(m - x) + " px. Move the outermost objects farther apart or make the objects smaller.";
      a("distribution-status").textContent = H, J(H, "error");
      return;
    }
    D?.stopCapturing(), v.transact(() => {
      let I = x + s.bounds[o] + Math.max(0, B);
      for (let H = 1; H < r.length - 1; H++) {
        const V = r[H];
        M.get(V.id).set(t, V.box[t] + I - V.bounds[t]), I += V.bounds[o] + Math.max(0, B);
      }
    }, "geometry"), D?.stopCapturing(), a("distribution-status").textContent = "Distributed " + r.length + " objects " + (e ? "vertically" : "horizontally") + " with " + Math.round(Math.max(0, B)) + " px gaps.";
  }
  a("distribute-horizontal").addEventListener("click", () => Hn(!1)), a("distribute-vertical").addEventListener("click", () => Hn(!0));
  function wn() {
    if (z) return;
    if (et()) {
      J("Unlock selected objects before deleting.", "error");
      return;
    }
    const e = [...C];
    v.transact(() => e.forEach((t) => M.delete(t)));
  }
  function Un(e, t, o, r, s) {
    let d = { position: e, guide: null }, x = r + 1e-6;
    for (const m of o)
      for (const j of [0, t / 2, t]) {
        const B = m - j, I = Math.abs(B - e);
        B >= 0 && B <= s - t && I < x && (x = I, d = { position: B, guide: m });
      }
    return d;
  }
  function zo(e, t, o, r, s, d) {
    const x = [0, k / 2, k], m = [0, L / 2, L];
    for (const j of De()) {
      if (j === e || C.has(j)) continue;
      const B = M.get(j), I = Number(B.get("x")), H = Number(B.get("y")), V = Number(B.get("width")), ce = Number(B.get("height"));
      [I, H, V, ce].every(Number.isFinite) && (x.push(I, I + V / 2, I + V), m.push(H, H + ce / 2, H + ce));
    }
    return { x: Un(t, r, x, d, k), y: Un(o, s, m, d, L) };
  }
  function qn(e) {
    if (!oe) return;
    if (et()) {
      xe(), J("Movement stopped because an object was locked.", "error");
      return;
    }
    const { id: t, action: o, startX: r, startY: s, scale: d, original: x } = oe, m = M.get(t);
    if (!m) return;
    const j = (e.clientX - r) * d, B = (e.clientY - s) * d;
    v.transact(() => {
      if (o.startsWith("edge-")) {
        const I = m.get("kind") === "image" && oe.imageMode === "crop" ? oe.imageCrop : { width: k, height: L }, H = ei(x, o.slice(5), j, B, oe.rotation, {
          minWidth: X.get(t)?.editor ? 100 : 1,
          minHeight: X.get(t)?.editor ? 55 : 1,
          maxWidth: Math.max(x.width, I.width),
          maxHeight: Math.max(x.height, I.height)
        });
        for (const [V, ce] of Object.entries(H)) m.set(V, ce);
      } else if (o === "rotate")
        m.set("rotation", mo(oe.rotation, e.clientX - r));
      else if (o === "move") {
        let I = Math.max(0, Math.min(k - x.width, x.x + j)), H = Math.max(0, Math.min(L - x.height, x.y + B));
        if (F.hidden = P.hidden = !0, !e.altKey) {
          const V = zo(t, I, H, x.width, x.height, 6 * d);
          I = V.x.position, H = V.y.position, V.x.guide !== null && (F.hidden = !1, F.style.left = 100 * V.x.guide / k + "%"), V.y.guide !== null && (P.hidden = !1, P.style.top = 100 * V.y.guide / L + "%");
        }
        for (const V of oe.members) {
          const ce = M.get(V.id);
          ce && (ce.set("x", Math.round(V.x + I - x.x)), ce.set("y", Math.round(V.y + H - x.y)));
        }
      } else if (m.get("kind") === "image" && (oe.imageMode === "resize" || m.get("keepAspectRatio") !== !1)) {
        const I = oe.imageMode === "resize" ? x.width / x.height : eo(m), H = Math.abs(j / x.width) >= Math.abs(B / x.height) ? x.width + j : (x.height + B) * I, V = m.get("kind") === "image" && oe.imageMode === "crop" ? oe.imageCrop : { width: k, height: L }, ce = Bo(H, I, Math.min(k - x.x, V.width), Math.min(L - x.y, V.height));
        m.set("width", ce.width), m.set("height", ce.height);
      } else {
        const I = X.get(t)?.editor ? 100 : 1, H = X.get(t)?.editor ? 55 : 1, V = m.get("kind") === "image" && oe.imageMode === "crop" ? oe.imageCrop : { width: k, height: L };
        m.set("width", Math.max(I, Math.min(k - x.x, V.width, x.width + j))), m.set("height", Math.max(H, Math.min(L - x.y, V.height, x.height + B)));
      }
      if (m.get("kind") === "image" && (o === "resize" || o.startsWith("edge-"))) {
        const I = { width: m.get("width"), height: m.get("height") };
        for (const [H, V] of Object.entries(Zo(x, I, oe.imageMode, oe.imageCrop))) m.set(H, V);
      }
    }, "geometry");
  }
  function xe(e) {
    it?.cancel(), F.hidden = P.hidden = !0;
    const t = oe?.target || e?.currentTarget;
    t?.removeEventListener("pointermove", qn), t?.removeEventListener("pointerup", xe), t?.removeEventListener("pointercancel", xe), oe && t?.hasPointerCapture(oe.pointerId) && t.releasePointerCapture(oe.pointerId), oe = null, D && (D.captureTimeout = 500, D.stopCapturing());
  }
  v.on("beforeObserverCalls", $t), M.observeDeep(we), q.observe(we), K.observe(we), Z.observe(we), ee.observe(Rt), U.observe(Ft), v.on("update", Nt), v.on("update", qe), a("add-slide").addEventListener("click", () => {
    if (!z) {
      xe();
      try {
        if (S.has(a("slide-layout").value)) {
          Uo(S.get(a("slide-layout").value));
          return;
        }
        const e = ve(), t = "slide-" + crypto.randomUUID(), o = f.get(a("slide-layout").value) || f.values().next().value, r = o.objects.map((d) => ({ ...d, id: tt() })), s = /* @__PURE__ */ new Map();
        O = t, T = null, C.clear(), D?.stopCapturing(), v.transact(() => {
          q.size || q.set("first", 0), q.set(t, Math.max(...e.map((d) => q.get(d) || 0)) + 1), o.background !== void 0 && Z.set(t, o.background), o.notes !== void 0 && U.set(t, o.notes);
          for (const d of r) {
            const { id: x, text: m, shapeId: j, group: B, ...I } = d, V = { ...d.kind === "shape" ? Fn(E.get(j)) : {}, rotation: 0, ...I, slide: t, layer: Math.max(-1, ...De().map((ce) => _e(M.get(ce)))) + 1 };
            B && (s.has(B) || s.set(B, "group-" + crypto.randomUUID()), V.groupId = s.get(B)), d.kind === "image" && (V.aspectRatio = d.width / d.height), M.set(x, new c.Map(Object.entries(V)));
          }
        });
        for (const d of r) {
          if (d.kind !== "text") continue;
          const x = d.text.split(`
`).map((m) => ({ type: "paragraph", content: m ? [{ type: "text", text: m }] : [] }));
          X.get(d.id).editor.commands.setContent({ type: "doc", content: x });
        }
        D?.stopCapturing(), we();
      } catch (e) {
        console.error("Slides layout failed:", e), J("Could not create slide: " + e.message, "error");
      }
    }
  }), a("duplicate-slide").addEventListener("click", () => {
    if (!z) {
      xe();
      try {
        const e = Kt(), t = ve(), o = e.map((s) => {
          const d = "slide-" + crypto.randomUUID(), x = /* @__PURE__ */ new Map(), m = De(s).map((j) => {
            const B = new c.Map(Object.entries(yn(M.get(j).toJSON(), x)));
            B.set("slide", d);
            const I = tt(), H = v.getXmlFragment("slide-text-" + I), V = v.getXmlFragment("slide-text-" + j).toArray().map((ce) => ce.clone());
            return D?.addToScope(H), { id: I, box: B, fragment: H, text: V };
          });
          return { source: s, id: d, copies: m };
        }), r = o.map((s) => s.id);
        t.splice(t.indexOf(e.at(-1)) + 1, 0, ...r), bt(r), D?.stopCapturing(), v.transact(() => {
          t.forEach((s, d) => q.set(s, d));
          for (const s of o) {
            Z.has(s.source) && Z.set(s.id, Z.get(s.source)), typeof U.get(s.source) == "string" && U.set(s.id, U.get(s.source));
            for (const d of s.copies)
              M.set(d.id, d.box), d.text.length && d.fragment.insert(0, d.text);
          }
        }), D?.stopCapturing(), we(), gt(o.length === 1 ? "Slide duplicated" : o.length + " slides duplicated"), Lt();
      } catch (e) {
        console.error("Slides duplication failed:", e), J("Could not duplicate slide: " + e.message, "error");
      }
    }
  });
  function To(e) {
    if (z) return;
    xe();
    const t = ve(), o = Si(t, Kt(), e);
    o.every((r, s) => r === t[s]) || (D?.stopCapturing(), v.transact(() => o.forEach((r, s) => q.set(r, s))), D?.stopCapturing(), Lt());
  }
  a("delete-slide").addEventListener("click", () => {
    const e = Kt(), t = ve();
    if (e.length >= t.length || z) return;
    const o = () => Fo(e);
    if (typeof window.buildDialogModal == "function") {
      const r = document.createElement("p");
      r.textContent = e.length === 1 ? "Delete slide " + (t.indexOf(e[0]) + 1) + "? Its objects and speaker notes will be removed." : "Delete " + e.length + " selected slides? Their objects and speaker notes will be removed.", window.buildDialogModal(e.length === 1 ? "Delete slide" : "Delete slides", r, [
        { label: "Cancel", secondary: !0, onClick: (s) => s() },
        { label: e.length === 1 ? "Delete slide" : "Delete slides", onClick: (s) => {
          s(), o();
        } }
      ]);
    } else {
      const r = document.createElement("dialog"), s = document.createElement("p");
      s.textContent = "Delete " + e.length + " selected slide(s)?", r.append(s);
      for (const [d, x, m] of [["Cancel", !0, () => {
      }], ["Delete slides", !1, o]]) {
        const j = document.createElement("button");
        j.className = x ? "btn-small btn-secondary" : "btn-small", j.textContent = d, j.addEventListener("click", () => {
          r.close(), r.remove(), m();
        }), r.append(j);
      }
      r.addEventListener("cancel", () => r.remove(), { once: !0 }), document.body.append(r), r.showModal();
    }
  });
  function Fo(e) {
    const t = ve(), o = new Set(t.filter((x) => e.includes(x)));
    if (z || !o.size || o.size >= t.length) return;
    xe();
    const r = t.filter((x) => !o.has(x)), s = r[Math.min(t.indexOf(O), r.length - 1)], d = [...M].filter(([, x]) => o.has(x.get("slide") || "first") && (!x.get("kind") || x.get("kind") === "text")).map(([x]) => v.getXmlFragment("slide-text-" + x));
    for (const x of d) D?.addToScope(x);
    bt([s]), D?.stopCapturing(), v.transact(() => {
      M.forEach((x, m) => {
        o.has(x.get("slide") || "first") && M.delete(m);
      });
      for (const x of d) x.length && x.delete(0, x.length);
      q.size || t.forEach((x, m) => q.set(x, m));
      for (const x of o)
        q.delete(x), Z.delete(x), U.delete(x);
    }), D?.stopCapturing(), we(), Lt();
  }
  a("save-layout").disabled = typeof l.onSaveLayout != "function", a("save-layout").addEventListener("click", () => l.onSaveLayout?.());
  function kt(e) {
    return typeof e == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(e) ? e : "";
  }
  async function xn(e) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(e.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
    const t = await new Promise((r, s) => {
      const d = new FileReader();
      d.onload = () => r(d.result), d.onerror = () => s(d.error || new Error("Could not read the image.")), d.onabort = () => s(new Error("Image reading was cancelled.")), d.readAsDataURL(e);
    });
    if (!kt(t)) throw new Error("Unsupported image data.");
    const o = new Image();
    return o.src = t, await o.decode(), { source: t, image: o };
  }
  a("image-description").addEventListener("input", (e) => {
    const t = M.get(T);
    z || C.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || t.set("alt", e.target.value.slice(0, 2e3));
  }), a("replace-image").addEventListener("click", () => {
    const e = M.get(T);
    z || C.size !== 1 || e?.get("kind") !== "image" || e.get("locked") === !0 || (Ne = { document: v, id: T }, a("replace-image-file").click());
  }), a("replace-image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0], o = Ne;
    if (Ne = null, !(!t || !o))
      try {
        const { source: r, image: s } = await xn(t), d = M.get(o.id);
        if (v !== o.document || d?.get("kind") !== "image") throw new Error("The original image is no longer available.");
        if (z || d.get("locked") === !0) throw new Error("Return to editing and unlock the image before replacing it.");
        D?.stopCapturing(), v.transact(() => {
          if (d.set("source", r), d.set("imageRatio", s.naturalWidth / s.naturalHeight), d.set("aspectRatio", d.get("width") / d.get("height")), d.delete("cropImageWidth"), d.delete("cropImageHeight"), d.get("imageFit") === "cover") {
            const x = Math.max(d.get("width"), d.get("height") * s.naturalWidth / s.naturalHeight);
            d.set("cropImageWidth", x), d.set("cropImageHeight", x * s.naturalHeight / s.naturalWidth);
          }
        }), D?.stopCapturing(), J("Image replaced.");
      } catch (r) {
        console.error("Slides image replacement failed:", r), J("Could not replace image: " + r.message, "error");
      } finally {
        e.target.value = "";
      }
  }), a("add-image").addEventListener("click", () => {
    try {
      pe.image();
    } catch (e) {
      J("Could not open image picker: " + e.message, "error");
    }
  }), a("image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0];
    if (!t) return;
    const o = v, r = O;
    try {
      const { source: s, image: d } = await xn(t);
      if (v !== o || !ve().includes(r)) throw new Error("The destination slide is no longer open.");
      if (z) throw new Error("Return to editing before adding an image.");
      O = r;
      const x = Math.min(1, 800 / d.naturalWidth, 500 / d.naturalHeight), m = Math.max(1, Math.round(d.naturalWidth * x)), j = Math.max(1, Math.round(d.naturalHeight * x)), B = tt();
      We(B, (k - m) / 2, (L - j) / 2, m, j, s, t.name), Le(B), J("Image added");
    } catch (s) {
      console.error("Slides image could not load:", s), J("Image could not load: " + s.message, "error");
    } finally {
      e.target.value = "";
    }
  });
  function vn() {
    if (!(z || !C.size))
      try {
        const e = new c.Doc(), t = De().filter((r) => C.has(r)).map((r, s) => {
          const d = v.getXmlFragment("slide-text-" + r).toArray().map((x) => x.clone());
          return d.length && e.getXmlFragment("text-" + s).insert(0, d), { data: M.get(r).toJSON(), index: s };
        }), o = new Set(t.flatMap((r) => r.data.referenceUrls || []));
        for (const r of Qt()) o.has(r.url) && e.getMap("clist_refs").set(r.url, JSON.stringify(r));
        return de?.document.destroy(), de = { document: e, items: t, sourceDocument: v, sourceSlide: O, pastes: 0, token: crypto.randomUUID() }, a("paste-objects").disabled = !1, J("Copied " + t.length + " object" + (t.length === 1 ? "." : "s.")), !0;
      } catch (e) {
        return console.error("Slides object copy failed:", e), J("Could not copy objects: " + e.message, "error"), !1;
      }
  }
  function Wn() {
    if (!(z || !de?.items.length)) {
      xe();
      try {
        const e = Yt(de.items.map((j) => j.data)), t = de.cut && de.pastes === 0 ? 0 : de.sourceDocument === v && de.sourceSlide === O ? 28 * (de.pastes + 1) : 28 * de.pastes, o = Ee?.document === v && Ee.slide === O ? Ee : null, { x: r, y: s } = Jo(e, o, k, L, t), d = Math.max(-1, ...De().map((j) => _e(M.get(j)))), x = /* @__PURE__ */ new Map(), m = de.items.map((j, B) => {
          const I = tt(), H = new c.Map(Object.entries({ ...yn(j.data, x), slide: O, x: j.data.x + r, y: j.data.y + s, layer: d + B + 1 })), V = v.getXmlFragment("slide-text-" + I);
          D?.addToScope(V);
          const ce = de.document.getXmlFragment("text-" + j.index).toArray().map((ke) => ke.clone());
          return { id: I, box: H, fragment: V, text: ce };
        });
        D?.stopCapturing(), v.transact(() => {
          de.document.getMap("clist_refs").forEach((j) => {
            try {
              en([JSON.parse(j)]);
            } catch {
            }
          });
          for (const j of m)
            M.set(j.id, j.box), j.text.length && j.fragment.insert(0, j.text);
        }), D?.stopCapturing(), de.pastes++, C.clear();
        for (const j of m) C.add(j.id);
        T = m[m.length - 1].id, Le(T, !1, !0), h.tabIndex = -1, h.focus({ preventScroll: !0 }), J("Pasted " + m.length + " object" + (m.length === 1 ? "." : "s."));
      } catch (e) {
        console.error("Slides object paste failed:", e), J("Could not paste objects: " + e.message, "error");
      }
    }
  }
  function Xn(e = null) {
    if (!(z || !C.size)) {
      if (et()) {
        J("Unlock selected objects before cutting.", "error");
        return;
      }
      if (vn())
        try {
          e && $n(e), de.cut = !0;
          const t = C.size;
          D?.stopCapturing(), wn(), D?.stopCapturing(), h.tabIndex = -1, h.focus({ preventScroll: !0 }), J("Cut " + t + " object" + (t === 1 ? "." : "s."));
        } catch (t) {
          console.error("Slides object cut failed:", t), J("Could not cut objects: " + t.message, "error");
        }
    }
  }
  a("cut-objects").addEventListener("click", () => Xn()), a("copy-objects").addEventListener("click", vn), a("paste-objects").addEventListener("click", Wn);
  function Ro(e) {
    return e.isContentEditable || !!e.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function $n(e) {
    e.clipboardData.setData("application/x-clist-slide-objects", de.token), e.clipboardData.setData("text/plain", de.items.map((t) => de.document.getXmlFragment("text-" + t.index).toString().replace(/<[^>]*>/g, " ") || t.data.alt || "Slide object").join(`
`)), e.preventDefault(), e.stopImmediatePropagation();
  }
  function Vn(e) {
    if (!(z || !C.size || !e.clipboardData || !h.getClientRects().length) && go(h, e.target, document.activeElement, document) && vn())
      try {
        $n(e);
      } catch (t) {
        console.error("Slides clipboard write failed:", t), J("Could not write objects to clipboard: " + t.message, "error");
      }
  }
  document.addEventListener("copy", Vn, !0);
  function Kn(e) {
    z || !C.size || !e.clipboardData || !h.getClientRects().length || go(h, e.target, document.activeElement, document) && (e.preventDefault(), e.stopImmediatePropagation(), Xn(e));
  }
  document.addEventListener("cut", Kn, !0);
  function Gn(e) {
    if (z || !e.clipboardData || !h.getClientRects().length) return;
    const t = h.contains(e.target), o = e.target === document.body || e.target === document.documentElement || e.target === document;
    if (!t && !(o && (h.contains(document.activeElement) || ae)) || !t && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]') || e.target.closest?.("input, textarea, select")) return;
    const r = e.target.closest?.(".slide-object");
    if (Ro(e.target) && r && C.has(r.dataset.id) && $ === r.dataset.id) return;
    const d = e.clipboardData.getData("application/x-clist-slide-objects");
    if (d && d === de?.token) {
      e.preventDefault(), e.stopImmediatePropagation(), Wn();
      return;
    }
    const x = e.clipboardData.getData("text/plain");
    if (x) {
      e.preventDefault(), e.stopImmediatePropagation();
      try {
        xe(), D?.stopCapturing();
        const m = tt(), j = x.replace(/\r\n?/g, `
`).split(`
`).map((ce) => ({
          type: "paragraph",
          content: ce ? [{ type: "text", text: ce }] : []
        })), B = j.reduce((ce, ke) => ce + Math.max(1, Math.ceil((ke.content[0]?.text.length || 0) / 45)), 0), I = 690, H = Math.min(500, Math.max(100, B * 42)), V = Ee?.document === v && Ee.slide === O ? Ee : { x: 160, y: 160 };
        We(m, Math.max(0, Math.min(k - I, V.x)), Math.max(0, Math.min(L - H, V.y)), I, H), X.get(m).editor.commands.setContent({ type: "doc", content: j }), D?.stopCapturing(), Le(m), X.get(m).editor.commands.focus("end"), J("Pasted text into a new text box.");
      } catch (m) {
        console.error("Slides text paste failed:", m), J("Could not paste text: " + m.message, "error");
      }
    }
  }
  document.addEventListener("paste", Gn, !0);
  function Jn(e) {
    const t = R.getBoundingClientRect();
    t.width <= 0 || t.height <= 0 || e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom || (Ee = { document: v, slide: O, x: Math.round((e.clientX - t.left) * k / t.width), y: Math.round((e.clientY - t.top) * L / t.height) });
  }
  h.addEventListener("pointermove", Jn), Ge = ci(h, R, {
    views: () => [...X.values()],
    selected: () => [...C].map((e) => X.get(e)).filter(Boolean),
    presenting: () => z,
    size: (e) => mt(e).size,
    apply: (e) => {
      e.length && (D?.stopCapturing(), v.transact(() => {
        for (const { box: t, size: o } of e) t.set("fontSize", o);
      }), D?.stopCapturing());
    }
  }), it = di(h, R, {
    selected: () => [...C],
    slideId: () => O,
    objects: () => De().map((e) => ({ id: e, ..._t(M.get(e).toJSON()) })),
    select: (e) => {
      C.clear();
      for (const t of e) X.has(t) && C.add(t);
      Le(e.at(-1) || null, !1, !0);
    }
  }), h.addEventListener("pointerdown", (e) => {
    const t = e.target;
    e.button !== 0 || z || !t.closest?.(".canvas-space") || t.closest(".slide-crop-stage, .slide-object, input, textarea, select, button, a") || (e.preventDefault(), ae = !0, Jn(e), xe(), t === R && it.begin(e), e.shiftKey || Le(null), $ = null, h.contains(document.activeElement) && document.activeElement.blur?.(), window.getSelection()?.removeAllRanges(), h.tabIndex = -1, h.focus({ preventScroll: !0 }));
  }, !0);
  function Yn(e) {
    if (z) return;
    const t = E.get(e);
    if (!t) {
      J("This shape is not available in the catalog.", "error");
      return;
    }
    const o = tt(), { width: r, height: s } = t, d = new c.Map(Object.entries({ ...Fn(t), slide: O, x: Math.min(160, k - r), y: Math.min(180, L - s), width: r, height: s, rotation: 0, layer: Math.max(-1, ...De().map((x) => _e(M.get(x)))) + 1 }));
    M.set(o, d), Le(o), X.get(o).node.focus({ preventScroll: !0 });
  }
  function tt() {
    return `box-${crypto.randomUUID()}`;
  }
  a("add-text").addEventListener("click", () => {
    const e = tt();
    We(e, 160, 220, 430, 130), Le(e), X.get(e)?.editor.commands.focus();
  }), a("duplicate").addEventListener("click", () => {
    if (z || !T) return;
    const e = T, t = M.get(e), o = tt(), r = new c.Map(Object.entries({ ...t.toJSON(), locked: !1, x: Math.min(k - t.get("width"), t.get("x") + 28), y: Math.min(L - t.get("height"), t.get("y") + 28), layer: Math.max(...De().map((x) => _e(M.get(x)))) + 1 }));
    r.delete("groupId");
    const s = v.getXmlFragment("slide-text-" + o);
    D?.addToScope(s);
    const d = v.getXmlFragment("slide-text-" + e).toArray().map((x) => x.clone());
    v.transact(() => {
      M.set(o, r), d.length && s.insert(0, d);
    }), Le(o);
  }), a("delete").addEventListener("click", wn), a("bold").addEventListener("click", () => {
    T && X.get(T)?.editor?.chain().focus().toggleBold().run();
  }), a("italic").addEventListener("click", () => {
    T && X.get(T)?.editor?.chain().focus().toggleItalic().run();
  }), a("bullet-list").addEventListener("click", () => {
    !z && T && X.get(T)?.editor?.chain().focus().toggleBulletList().run();
  }), a("ordered-list").addEventListener("click", () => {
    !z && T && X.get(T)?.editor?.chain().focus().toggleOrderedList().run();
  });
  function _n(e) {
    try {
      const t = new URL(e);
      return ["http:", "https:", "mailto:", "tel:"].includes(t.protocol);
    } catch {
      return !1;
    }
  }
  function jt() {
    a("link-controls").hidden = !0, Me = null;
  }
  a("edit-link").addEventListener("click", () => {
    const e = X.get(T)?.editor;
    if (!(z || !e)) {
      if (e.state.selection.empty && !e.isActive("link")) {
        J("Select the text to link first.", "error");
        return;
      }
      Me = T, a("link-url").value = e.getAttributes("link").href || "", a("link-controls").hidden = !1, a("link-url").focus();
    }
  }), a("cancel-link").addEventListener("click", jt), a("apply-link").addEventListener("click", () => {
    const e = X.get(Me)?.editor;
    if (z || !e) {
      jt();
      return;
    }
    const t = a("link-url").value.trim();
    if (!_n(t)) {
      J("Enter an http, https, mailto, or tel URL.", "error");
      return;
    }
    try {
      D?.stopCapturing(), e.chain().focus().extendMarkRange("link").setLink({ href: t }).run(), D?.stopCapturing(), jt();
    } catch (o) {
      console.error("Slides link failed:", o), J("Could not apply link: " + o.message, "error");
    }
  }), a("remove-link").addEventListener("click", () => {
    const e = X.get(T)?.editor;
    if (!(z || !e))
      try {
        e.chain().focus().extendMarkRange("link").unsetLink().run(), jt();
      } catch (t) {
        console.error("Slides unlink failed:", t), J("Could not remove link: " + t.message, "error");
      }
  }), h.addEventListener("click", (e) => {
    const t = e.target.closest?.(".text-content a");
    if (!z || !t) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const o = t.getAttribute("href") || "";
    _n(o) ? window.open(o, "_blank", "noopener,noreferrer") : (console.error("Slides blocked unsupported link:", o), a("presentation-status").textContent = "This link has an unsupported URL.");
  }, !0);
  function Zn(e) {
    if (z || et() || !T) return;
    const t = De(), o = t.indexOf(T);
    o < 0 || !t[o + e] || ([t[o], t[o + e]] = [t[o + e], t[o]], v.transact(() => t.forEach((r, s) => M.get(r).set("layer", s)), "layer"));
  }
  a("bring-forward").addEventListener("click", () => Zn(1)), a("send-backward").addEventListener("click", () => Zn(-1));
  function Oo(e, t) {
    const o = M.get(T);
    z || C.size !== 1 || o?.get("kind") !== "image" || o.get("locked") === !0 || v.transact(() => {
      t === "cover" && o.get("imageFit") !== "cover" ? (o.delete("cropImageWidth"), o.delete("cropImageHeight"), o.set(e, t), Tn(o)) : o.set(e, t);
    });
  }
  a("image-fit").addEventListener("change", (e) => {
    ["contain", "cover"].includes(e.target.value) && Oo("imageFit", e.target.value);
  });
  function Qn() {
    const e = T, t = M.get(e), o = X.get(e);
    if (z || C.size !== 1 || t?.get("kind") !== "image" || t.get("locked") || !o) return;
    re?.destroy(), xe();
    const r = kt(t.get("source"));
    if (!r) return;
    const s = v, d = O, x = l.captureSession?.(), m = JSON.stringify(t.toJSON()), j = Number(t.get("imageRatio")) || t.get("width") / t.get("height"), B = oi(t, j), I = Math.min(k, L * j, t.get("width") / B.width), H = I / j, V = Math.max(0, Math.min(k - I, t.get("x") - I * B.x)), ce = Math.max(0, Math.min(L - H, t.get("y") - H * B.y)), ke = document.createElement("div");
    ke.className = "slide-direct-crop", ke.style.left = 100 * V / k + "%", ke.style.top = 100 * ce / L + "%", ke.style.width = 100 * I / k + "%", ke.addEventListener("pointerdown", (Oe) => Oe.stopPropagation()), R.append(ke), o.content.style.visibility = "hidden", h.classList.add("cropping-image");
    const ie = () => h.isConnected && !z && v === s && O === d && T === e && C.size === 1 && M.get(e) === t && JSON.stringify(t.toJSON()) === m && (!l.sessionCurrent || l.sessionCurrent(x));
    let Re = null, He = !1;
    const nt = () => {
      He || (He = !0, Re?.destroy(), ke.remove(), o.content.style.visibility = "", h.classList.remove("cropping-image"), re = null);
    };
    re = { current: ie, destroy: nt }, Re = Co({ container: ke, actionsContainer: h.querySelectorAll(".slide-menu-bar")[1], source: r, ratio: j, initial: B, current: ie, onCancel: nt, onDone: (Oe) => {
      if (!ie()) {
        nt();
        return;
      }
      const dt = ["x", "y", "width", "height"].every((je) => Math.abs(Oe[je] - B[je]) < 1e-8);
      if (nt(), dt) return;
      const Te = jn(Oe, I, H);
      D?.stopCapturing(), v.transact(() => {
        for (const [je, Ze] of Object.entries(Te)) t.set(je, Ze);
        t.set("x", V + I * Oe.x), t.set("y", ce + H * Oe.y);
      }), D?.stopCapturing(), Le(e), J("Image cropped.");
    } });
  }
  a("crop-image").addEventListener("click", Qn);
  function eo(e) {
    const t = Number(e.get("aspectRatio"));
    return Number.isFinite(t) && t > 0 ? t : Number(e.get("width")) / Number(e.get("height")) || 1;
  }
  function Bo(e, t, o, r) {
    const s = Math.min(o, r * t), d = Math.max(Math.min(s, Math.max(1, t)), Math.min(s, e));
    return { width: d, height: d / t };
  }
  a("keep-aspect-ratio").addEventListener("change", (e) => {
    const t = M.get(T);
    z || C.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || v.transact(() => {
      e.target.checked && t.set("aspectRatio", t.get("width") / t.get("height")), t.set("keepAspectRatio", e.target.checked);
    });
  });
  function Zt(e) {
    return e instanceof c.Map && e.get("kind") !== "image";
  }
  function to() {
    a("copy-format").disabled = z || C.size !== 1 || !Zt(M.get(T));
    const e = [...C].map((t) => M.get(t));
    a("paste-format").disabled = z || !ge || !e.length || et() || !e.some(Zt);
  }
  a("copy-format").addEventListener("click", () => {
    const e = M.get(T);
    if (z || C.size !== 1 || !Zt(e)) return;
    const t = vt(e), o = mt(e);
    ge = {
      appearance: { fillEnabled: t.fill, fillColour: t.fillColour, borderEnabled: t.border, borderColour: t.borderColour, borderWidth: t.width },
      text: e.get("kind") === "shape" ? null : { fontFamily: o.family, fontSize: o.size, textColour: o.colour, textAlign: o.align }
    }, to(), J("Formatting copied. Select targets, then use Apply formatting.");
  }), a("paste-format").addEventListener("click", () => {
    if (z || !ge || et()) return;
    const e = [...C].map((t) => M.get(t)).filter(Zt);
    e.length && (D?.stopCapturing(), v.transact(() => {
      for (const t of e) {
        const o = { ...ge.appearance, ...t.get("kind") === "shape" ? {} : ge.text || {} };
        for (const [r, s] of Object.entries(o)) t.set(r, s);
      }
    }), D?.stopCapturing(), J("Formatting applied to " + e.length + " object" + (e.length === 1 ? "." : "s.")));
  });
  function Et(e, t) {
    const r = M.get(T)?.get("kind") === "shape" && ["fillEnabled", "fillColour", "borderEnabled", "borderColour", "borderWidth"].includes(e);
    z || C.size !== 1 || !X.get(T)?.editor && !r || M.get(T).set(e, t);
  }
  for (const [e, t] of [["fill-enabled", "fillEnabled"], ["border-enabled", "borderEnabled"]])
    a(e).addEventListener("change", (o) => Et(t, o.target.checked));
  for (const [e, t] of [["fill-colour", "fillColour"], ["border-colour", "borderColour"]])
    a(e).addEventListener("change", (o) => {
      /^#[0-9a-f]{6}$/i.test(o.target.value) && Et(t, o.target.value);
    });
  a("border-width").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isInteger(t) || t < 1 || t > 20) {
      J("Border width must be a whole number between 1 and 20 pixels.", "error"), Le(T);
      return;
    }
    Et("borderWidth", t);
  }), a("font-family").addEventListener("change", (e) => {
    Object.prototype.hasOwnProperty.call(xt, e.target.value) && Et("fontFamily", e.target.value);
  }), a("font-size").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t) || t < 8 || t > 200) {
      J("Font size must be between 8 and 200 pixels.", "error"), Le(T);
      return;
    }
    Et("fontSize", t);
  }), a("text-colour").addEventListener("input", (e) => {
    /^#[0-9a-f]{6}$/i.test(e.target.value) && Et("textColour", e.target.value);
  }), a("text-align").addEventListener("change", (e) => {
    ["left", "center", "right", "justify"].includes(e.target.value) && Et("textAlign", e.target.value);
  });
  function It() {
    const e = S.has(a("slide-layout").value), t = S.get(a("slide-layout").value), o = typeof l.onRenameSavedLayout == "function" && typeof l.onDeleteSavedLayout == "function";
    a("saved-layout-hint").textContent = rt ? "Layout dialog is open." : S.size ? e ? o ? "Selected saved layout: " + t.label : "Layout management is available inside CList." : "Select an entry under Saved layouts to rename or delete it." : "Use CList’s Save menu to save the current slide as a layout.", a("rename-layout").disabled = rt || !e || typeof l.onRenameSavedLayout != "function", a("delete-layout").disabled = rt || !e || typeof l.onDeleteSavedLayout != "function";
  }
  function no(e) {
    const t = "user:" + e;
    S.delete(t);
    const o = a("slide-layout").querySelector("optgroup[data-saved-layouts]");
    (o && [...o.children].find((s) => s.value === t))?.remove(), o && !o.children.length && o.remove(), a("slide-layout").value || (a("slide-layout").value = f.keys().next().value), It();
  }
  async function oo(e) {
    const t = S.get(a("slide-layout").value), o = e ? l.onDeleteSavedLayout : l.onRenameSavedLayout;
    if (!(z || rt || !t || typeof o != "function")) {
      rt = !0, It();
      try {
        const r = await o({ ...t });
        e && r === !0 ? no(t.id) : !e && r && ro(r);
      } catch (r) {
        console.error("Saved layout management failed:", r), J("Could not " + (e ? "delete" : "rename") + " layout: " + r.message, "error");
      } finally {
        rt = !1, It();
      }
    }
  }
  a("slide-layout").addEventListener("change", It), a("rename-layout").addEventListener("click", () => oo(!1).catch((e) => {
    console.error("Layout rename failed:", e), J(e.message, "error");
  })), a("delete-layout").addEventListener("click", () => oo(!0).catch((e) => {
    console.error("Layout deletion failed:", e), J(e.message, "error");
  }));
  function Ho(e) {
    if (typeof e != "string" || !e.trim() || e.trim().length > 120) throw new Error("Enter a layout name of 1–120 characters.");
    const t = new c.Doc();
    try {
      t.getMap("slide-pages").set("first", 0), t.getMap("slide-backgrounds").set("first", At(O)), typeof U.get(O) == "string" && t.getMap("slide-notes").set("first", U.get(O));
      for (const d of De()) {
        const x = M.get(d), m = mt(x), j = vt(x), B = { ...x.toJSON(), slide: "first", fontFamily: m.family, fontSize: m.size, textColour: m.colour, fillColour: j.fillColour, borderColour: j.borderColour };
        B.kind === "shape" && (B.shapeDefinition = structuredClone(Wt(M.get(d)))), t.getMap("slide-objects").set(d, new c.Map(Object.entries(B)));
        const I = v.getXmlFragment("slide-text-" + d).toArray().map((H) => H.clone());
        I.length && t.getXmlFragment("slide-text-" + d).insert(0, I);
      }
      const o = new Set(De().flatMap((d) => M.get(d).get("referenceUrls") || []));
      for (const d of Qt()) o.has(d.url) && t.getMap("clist_refs").set(d.url, JSON.stringify(d));
      const r = c.encodeStateAsUpdate(t);
      let s = "";
      for (const d of r) s += String.fromCharCode(d);
      return { format: "clist-slide-layout-v1", id: "saved-" + crypto.randomUUID(), label: e.trim(), update: btoa(s) };
    } finally {
      t.destroy();
    }
  }
  function io(e) {
    if (!e || e.format !== "clist-slide-layout-v1" || typeof e.id != "string" || !/^saved-[a-z0-9-]+$/.test(e.id) || typeof e.label != "string" || !e.label.trim() || e.label.length > 120 || typeof e.update != "string") throw new Error("Invalid saved slide layout.");
    const t = new c.Doc();
    try {
      c.applyUpdate(t, Uint8Array.from(atob(e.update), (r) => r.charCodeAt(0)));
      const o = t.getMap("slide-pages");
      if (o.size !== 1 || !o.has("first")) throw new Error("A saved layout must contain one slide.");
      return t.getMap("slide-objects").forEach((r) => {
        if (!(r instanceof c.Map) || (r.get("slide") || "first") !== "first" || !["x", "y", "width", "height"].every((s) => typeof r.get(s) == "number" && Number.isFinite(r.get(s))) || r.get("width") <= 0 || r.get("height") <= 0) throw new Error("Invalid object in saved slide layout.");
        r.get("kind") === "shape" && r.get("shapeDefinition") && sn(r.get("shapeDefinition"));
      }), t;
    } catch (o) {
      throw t.destroy(), o;
    }
  }
  function ro(e, { select: t = !1 } = {}) {
    io(e).destroy();
    const r = { format: e.format, id: e.id, label: e.label.trim(), update: e.update };
    S.set("user:" + r.id, r);
    let s = a("slide-layout").querySelector("optgroup[data-saved-layouts]");
    s || (s = document.createElement("optgroup"), s.label = "Saved layouts", s.dataset.savedLayouts = "", a("slide-layout").append(s));
    let d = [...s.children].find((x) => x.value === "user:" + r.id);
    return d || (d = document.createElement("option"), s.append(d)), d.value = "user:" + r.id, d.textContent = r.label, t && (a("slide-layout").value = d.value), It(), r;
  }
  function Uo(e) {
    const t = io(e);
    try {
      const o = t.getMap("slide-objects"), r = /* @__PURE__ */ new Map(), s = [...o.entries()].sort(([m, j], [B, I]) => _e(j) - _e(I) || m.localeCompare(B)).map(([m, j]) => {
        const B = tt(), I = yn(j.toJSON(), r), H = v.getXmlFragment("slide-text-" + B);
        return D?.addToScope(H), { id: B, data: I, fragment: H, text: t.getXmlFragment("slide-text-" + m).toArray().map((V) => V.clone()) };
      }), d = ve(), x = "slide-" + crypto.randomUUID();
      O = x, T = null, C.clear(), D?.stopCapturing(), v.transact(() => {
        q.size || q.set("first", 0), q.set(x, Math.max(...d.map((m) => q.get(m) || 0)) + 1), Z.set(x, t.getMap("slide-backgrounds").get("first") || "#ffffff"), U.set(x, t.getMap("slide-notes").get("first") || ""), t.getMap("clist_refs").forEach((m) => {
          try {
            en([JSON.parse(m)]);
          } catch {
          }
        });
        for (const m of s)
          M.set(m.id, new c.Map(Object.entries({ ...m.data, slide: x }))), m.text.length && m.fragment.insert(0, m.text);
      }), D?.stopCapturing(), we();
    } finally {
      t.destroy();
    }
  }
  function Qt() {
    const e = [];
    return ee.forEach((t) => {
      try {
        const o = Mn(JSON.parse(t));
        o && e.push(o);
      } catch {
      }
    }), e;
  }
  function Rt() {
    l.onReferencesChange?.(Qt());
  }
  function en(e) {
    for (const t of e || []) {
      const o = Mn(t);
      o && !ee.has(o.url) && ee.set(o.url, JSON.stringify(o));
    }
  }
  function qo(e, t = []) {
    if (z) throw new Error("Return to editing before importing content.");
    const o = [...new Map(t.map(Mn).filter(Boolean).map((d) => [d.url, d])).values()], r = li(e, o);
    xe();
    const s = tt();
    return D?.stopCapturing(), v.transact(() => {
      We(s, 100, 120, 1e3, 460), M.get(s).set("referenceUrls", o.map((d) => d.url)), en(o);
    }), X.get(s).editor.commands.setContent(r), D?.stopCapturing(), Le(s), h.tabIndex = -1, h.focus({ preventScroll: !0 }), J("Content imported into a new text box" + (o.length ? " with source references." : ".")), s;
  }
  function Wo() {
    K.has("theme") || v.transact(() => K.set("theme", structuredClone(lt())), "init");
    const e = c.encodeStateAsUpdate(v), t = [];
    for (let o = 0; o < e.length; o += 32768) t.push(String.fromCharCode(...e.subarray(o, o + 32768)));
    return { format: "clist-slides-yjs-v1", document: a("doc-name").value, update: btoa(t.join("")) };
  }
  async function Xo(e, t) {
    if (N) throw new Error("Disconnect from collaboration before importing a PowerPoint file.");
    if (z) throw new Error("Return to editing before importing a PowerPoint file.");
    const o = await Ei(e, t);
    if (N || z) throw new Error("Return to local editing before completing the import.");
    const r = new c.Doc();
    function s(d) {
      const x = new c.XmlElement(d.type);
      for (const [I, H] of Object.entries(d.attrs || {})) x.setAttribute(I, H);
      const m = [];
      let j = [];
      const B = () => {
        if (j.length) {
          const I = new c.XmlText();
          I.applyDelta(j), m.push(I), j = [];
        }
      };
      for (const I of d.content || [])
        if (I.type === "text") {
          const H = Object.fromEntries((I.marks || []).map((V) => [V.type, V.attrs || {}]));
          j.push({ insert: I.text, attributes: H });
        } else
          B(), m.push(s(I));
      return B(), m.length && x.insert(0, m), x;
    }
    try {
      const d = ve(), x = r.getMap("pages"), m = r.getMap("objects"), j = Math.max(...d.map((I) => q.get(I) || 0)) + 1;
      for (const [I, H] of o.slides.entries()) {
        const V = "slide-" + crypto.randomUUID();
        x.set(V, { order: j + I, background: H.background, notes: H.notes }), H.objects.forEach((ce, ke) => {
          const ie = tt(), { text: Re, ...He } = ce;
          He.shapeDefinition && (He.shapeDefinition = sn(He.shapeDefinition)), m.set(ie, { ...He, slide: V, layer: ke }), Re && r.getXmlFragment("slide-text-" + ie).insert(0, Re.map(s));
        });
      }
      const B = [...m].map(([I, H]) => {
        const V = H.kind === "text" ? v.getXmlFragment("slide-text-" + I) : null;
        return V && D?.addToScope(V), { id: I, box: new c.Map(Object.entries(H)), fragment: V, text: V ? r.getXmlFragment("slide-text-" + I).toArray().map((ce) => ce.clone()) : [] };
      });
      return xe(), D?.stopCapturing(), O = x.keys().next().value, T = null, C.clear(), v.transact(() => {
        q.size || q.set("first", 0);
        for (const [I, H] of x)
          q.set(I, H.order), Z.set(I, H.background), H.notes && U.set(I, H.notes);
        for (const I of B)
          M.set(I.id, I.box), I.fragment && I.text.length && I.fragment.insert(0, I.text);
      }), D?.stopCapturing(), we(), J(o.slides.length + " PowerPoint slides imported. Use Undo to remove the import."), { count: o.slides.length, warnings: o.warnings };
    } finally {
      r.destroy();
    }
  }
  function $o(e) {
    if (N) throw new Error("Disconnect from Hocuspocus before replacing the document");
    if (!e || e.format !== "clist-slides-yjs-v1" || typeof e.update != "string")
      throw new Error("Unsupported document format");
    const t = atob(e.update), o = Uint8Array.from(t, (s) => s.charCodeAt(0)), r = new c.Doc();
    try {
      c.applyUpdate(r, o);
    } catch (s) {
      throw r.destroy(), s;
    }
    v.off("beforeObserverCalls", $t), M.unobserveDeep(we), q.unobserve(we), K.unobserve(we), Z.unobserve(we), ee.unobserve(Rt), U.unobserve(Ft), v.off("update", Nt), v.off("update", qe);
    for (const s of X.values())
      s.disposePointer?.(), s.editor?.destroy(), s.node.remove();
    X.clear(), T = null, C.clear(), $ = null, Ee = null, xe(), lo(), v.destroy(), v = r, M = v.getMap("slide-objects"), q = v.getMap("slide-pages"), Z = v.getMap("slide-backgrounds"), U = v.getMap("slide-notes"), ee = v.getMap("clist_refs"), K = v.getMap("slide-design"), O = ve()[0], Io(), v.on("beforeObserverCalls", $t), M.observeDeep(we), q.observe(we), K.observe(we), Z.observe(we), ee.observe(Rt), U.observe(Ft), v.on("update", Nt), v.on("update", qe), G = !0, e.document && (a("doc-name").value = e.document), we(), so(), Rt(), qe();
  }
  function Pt() {
    ye++;
    const e = N;
    N = null, W = !1, e?.destroy(), J("Local only"), a("connect").textContent = "Connect";
  }
  async function kn() {
    Pt();
    const e = ye;
    try {
      const t = a("server-url").value.trim();
      let o = a("doc-name").value.trim();
      if (!/^wss?:\/\//i.test(t) || !o) throw new Error("Enter a WebSocket URL and document name");
      if (l.resolveDocumentName && (o = await l.resolveDocumentName(o)), e !== ye) return;
      a("doc-name").value = o;
      const r = typeof l.parameters == "function" ? l.parameters() : l.parameters;
      N = new u({
        url: t,
        name: o,
        document: v,
        token: l.token || a("token").value || void 0,
        parameters: r || {},
        onStatus: ({ status: s }) => {
          e === ye && J(s === "connected" ? "Synchronizing..." : s);
        },
        onSynced: ({ state: s }) => {
          e !== ye || s === !1 || (W = !0, l.seed !== !1 && Tt(), J("Synced", "connected"));
        },
        onAuthenticationFailed: ({ reason: s } = {}) => {
          if (e !== ye) return;
          const d = typeof s == "string" && s.trim() ? s.trim() : "The server did not provide a reason.";
          console.error("Slides collaboration authentication failed:", d), Pt(), J(`Authentication failed: ${d}`, "error");
        },
        onDisconnect: () => {
          e === ye && (W = !1, J("Disconnected", "error"));
        }
      }), a("connect").textContent = "Disconnect", J("Connecting...");
    } catch (t) {
      if (e !== ye) return;
      console.error("Slides connection failed:", t), Pt(), J(t.message, "error");
    }
  }
  function Dt(e) {
    console.error("Slides connection failed:", e), J(e.message, "error");
  }
  a("connect").addEventListener("click", () => {
    N ? Pt() : kn().catch(Dt);
  });
  function tn() {
    a("undo").disabled = z || !D?.undoStack.length, a("redo").disabled = z || !D?.redoStack.length;
  }
  function ao(e) {
    e.local && e.origin !== "init" && !se && D.trackedOrigins.add(e.origin);
  }
  function so() {
    D = new c.UndoManager([...v.share.values()], {
      trackedOrigins: /* @__PURE__ */ new Set([null, "geometry", "layer"]),
      captureTransaction: (e) => e.local && e.origin !== "init" && !se
    }), v.on("beforeTransaction", ao);
    for (const e of ["stack-item-added", "stack-item-popped", "stack-cleared", "stack-item-updated"]) D.on(e, tn);
    tn();
  }
  function lo() {
    v.off("beforeTransaction", ao), D?.destroy(), D = null;
  }
  function En(e = !1) {
    if (!(z || !D)) {
      xe(), D.stopCapturing();
      try {
        e ? D.redo() : D.undo(), we(), tn();
      } catch (t) {
        console.error("Slides history failed:", t), J("Could not " + (e ? "redo" : "undo") + ": " + t.message, "error");
      }
    }
  }
  function Vo(e) {
    if (z || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !T) return;
    const t = e.target;
    if (t.isContentEditable || !!t.closest?.('[contenteditable="true"]')) {
      e.key === "Escape" && (e.preventDefault(), e.stopImmediatePropagation(), X.get(T)?.node.focus({ preventScroll: !0 }), $ = null);
      return;
    }
    if (t.closest?.("input, textarea, select, button")) return;
    if (et() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault(), e.stopImmediatePropagation(), J("Unlock selected objects before moving or deleting.", "error");
      return;
    }
    const r = X.get(T);
    if (!r) return;
    if (e.key === "Enter" && r.editor && C.size === 1) {
      e.preventDefault(), r.editor.commands.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(), e.stopImmediatePropagation(), D?.stopCapturing(), wn(), D?.stopCapturing(), h.tabIndex = -1, h.focus({ preventScroll: !0 });
      return;
    }
    const s = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!s) return;
    e.preventDefault(), e.stopImmediatePropagation(), e.repeat || D?.stopCapturing();
    const d = e.shiftKey ? 10 : 1, x = [...C].map((I) => ({ id: I, ...M.get(I).toJSON() })), m = Yt(x), j = Math.max(-m.x, Math.min(k - m.x - m.width, s[0] * d)), B = Math.max(-m.y, Math.min(L - m.y - m.height, s[1] * d));
    v.transact(() => {
      for (const I of x) {
        const H = M.get(I.id);
        H.set("x", I.x + j), H.set("y", I.y + B);
      }
    }, "geometry");
  }
  function Ko(e) {
    if (e.target.closest?.(".slide-crop-stage, .rotation-handle") || (Vo(e), z || !(e.ctrlKey || e.metaKey) || e.altKey || !h.contains(e.target))) return;
    const t = e.key.toLowerCase();
    t !== "z" && t !== "y" || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && e.target !== a("speaker-notes") || (e.preventDefault(), e.stopImmediatePropagation(), En(t === "y" || e.shiftKey));
  }
  function nn() {
    D?.stopCapturing();
  }
  a("undo").addEventListener("click", () => En()), a("redo").addEventListener("click", () => En(!0)), h.addEventListener("click", nn, !0), h.addEventListener("click", nn), h.addEventListener("change", nn, !0), h.addEventListener("change", nn), h.addEventListener("keydown", Ko, !0);
  function Ot(e, t) {
    const o = t.createElement("div");
    o.className = "slide presenter-slide", o.style.backgroundColor = At(e), o.setAttribute("aria-label", "Slide preview");
    for (const r of De(e)) {
      const s = M.get(r), d = t.createElement("div"), x = t.createElement("div");
      if (d.className = s.get("kind") === "shape" ? "slide-object shape-object" : s.get("kind") === "image" ? "slide-object image-object" : "slide-object", d.style.left = 100 * s.get("x") / k + "%", d.style.top = 100 * s.get("y") / L + "%", d.style.width = 100 * s.get("width") / k + "%", d.style.height = 100 * s.get("height") / L + "%", d.style.transform = "rotate(" + (Number(s.get("rotation")) || 0) + "deg)", d.style.zIndex = String(De(e).indexOf(r)), s.get("kind") === "image") {
        x.className = "image-content";
        const m = t.createElement("img");
        m.src = kt(s.get("source")), m.alt = typeof s.get("alt") == "string" ? s.get("alt") : "", pn(m, s, !0), x.append(m);
      } else if (s.get("kind") === "shape") {
        x.className = "shape-content";
        const m = t.createElementNS("http://www.w3.org/2000/svg", "svg");
        Xt(m, s), x.append(m);
      } else {
        x.className = "text-content";
        const m = mt(s), j = vt(s), B = t.createElement("div");
        d.style.setProperty("--slide-font-size", m.size / 12.8 + "cqw"), d.style.fontFamily = xt[m.family], d.style.color = m.colour, d.style.textAlign = m.align, x.style.backgroundColor = j.fill ? j.fillColour : "transparent", x.style.border = j.border ? j.width / 12.8 + "cqw solid " + j.borderColour : "none", B.className = "tiptap", B.append(xo(v.getXmlFragment("slide-text-" + r), t)), x.append(B);
      }
      d.append(x), o.append(d);
    }
    return o;
  }
  function Go() {
    return {
      title: l.presentationTitle?.() || a("doc-name").value || "CList presentation",
      slides: ve().map((e) => ({
        background: At(e),
        notes: typeof U.get(e) == "string" ? U.get(e) : "",
        objects: De(e).map((t) => {
          const o = M.get(t), r = o.get("kind") || "text", s = {
            id: t,
            kind: r,
            x: Number(o.get("x")) || 0,
            y: Number(o.get("y")) || 0,
            width: Number(o.get("width")),
            height: Number(o.get("height")),
            rotation: Number(o.get("rotation")) || 0,
            style: vt(o)
          };
          if (!(s.width > 0 && s.height > 0)) throw new Error("An object has invalid dimensions: " + t);
          if (r === "text")
            s.format = mt(o), s.runs = bi(xo(v.getXmlFragment("slide-text-" + t), document), s.format.size);
          else if (r === "image") {
            if (s.source = kt(o.get("source")), !s.source) throw new Error("An image has no valid source: " + t);
            s.alt = typeof o.get("alt") == "string" ? o.get("alt") : "";
            const d = un(o);
            s.crop = { ...d }, d.fit === "cover" && Object.assign(s.crop, qt(o));
          } else if (r === "shape") {
            s.definition = structuredClone(Wt(o));
            const d = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Xt(d, o), d.setAttribute("width", s.width), d.setAttribute("height", s.height);
            for (const x of d.querySelectorAll("[vector-effect]")) x.style.strokeWidth = (s.style.border ? Math.min(s.style.width, s.width, s.height) : 0) + "px";
            s.source = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(d));
          } else throw new Error("Unsupported slide object: " + r);
          return s;
        })
      }))
    };
  }
  function Cn() {
    if (!Se) return;
    if (Se.closed) {
      Se = null;
      return;
    }
    const e = ve(), t = e.indexOf(O);
    Se.update({ id: O, nextId: e[t + 1], index: t, total: e.length, notes: typeof U.get(O) == "string" ? U.get(O) : "", presenting: z });
  }
  function co() {
    try {
      if (Se && !Se.closed) {
        Cn(), Se.focus();
        return;
      }
      Se = hi({
        renderSlide: Ot,
        navigate: on,
        jump: (e) => {
          const t = ve();
          O = e === "first" ? t[0] : t[t.length - 1], T = null, C.clear(), we();
        },
        present: uo,
        end: rn
      }), Cn();
    } catch (e) {
      console.error("Presenter view could not open:", e), J("Presenter view could not open: " + e.message, "error"), z && (a("presentation-status").textContent = e.message);
    }
  }
  a("presenter-view").addEventListener("click", co), a("presentation-presenter-view").addEventListener("click", co);
  function on(e) {
    const t = ve(), o = t[t.indexOf(O) + e];
    o && (O = o, T = null, C.clear(), we());
  }
  function Sn(e) {
    at?.presenting(e), z = e, jt(), tn(), xe(), Le(null), h.classList.toggle("presenting", e), st.update(), a("presentation-controls").hidden = !e;
    for (const t of X.values()) t.editor?.setEditable(!e);
    e ? (Ae = document.activeElement, h.tabIndex = -1, h.focus()) : (Ae?.focus?.(), Ae = null), Nt();
  }
  async function uo() {
    Sn(!0), a("presentation-status").textContent = "";
    try {
      h.requestFullscreen && await h.requestFullscreen();
    } catch (e) {
      console.error("Slides fullscreen failed:", e), a("presentation-status").textContent = "Full screen unavailable. Presenting in this window.";
    }
  }
  async function rn() {
    Sn(!1);
    try {
      document.fullscreenElement === h && await document.exitFullscreen();
    } catch (e) {
      console.error("Slides fullscreen exit failed:", e), J("Could not leave full screen. Press Escape.", "error");
    }
  }
  function po(e) {
    if (!(!z || e.altKey || e.ctrlKey || e.metaKey)) {
      if (e.key === "Escape")
        e.preventDefault(), rn().catch(Dt);
      else if (["ArrowRight", "ArrowDown", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", " "].includes(e.key)) {
        if (e.key === " " && e.target?.tagName === "BUTTON") return;
        if (e.preventDefault(), e.key === "Home" || e.key === "End") {
          const t = ve();
          O = e.key === "Home" ? t[0] : t[t.length - 1], we();
        } else on(["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 1);
      }
    }
  }
  function fo() {
    z && document.fullscreenElement !== h && Sn(!1);
  }
  a("present").addEventListener("click", () => uo().catch(Dt)), a("exit-presentation").addEventListener("click", () => rn().catch(Dt)), a("previous-slide").addEventListener("click", () => on(-1)), a("next-slide").addEventListener("click", () => on(1)), document.addEventListener("keydown", po), document.addEventListener("fullscreenchange", fo);
  function ho(e) {
    return typeof e.toDelta == "function" ? e.toDelta().map((t) => typeof t.insert == "string" ? t.insert : "").join("") : typeof e.toArray == "function" ? e.toArray().map(ho).join(e.nodeName === "paragraph" ? "" : `
`) : "";
  }
  return pe = ii({
    root: h,
    shapes: [...E.values()],
    readImage: xn,
    openModal: (e) => {
      if (!l.openInsertModal) throw new Error("This host does not provide the insertion modal.");
      return l.openInsertModal(e);
    },
    capture() {
      const e = v, t = O, o = l.captureSession?.();
      return () => h.isConnected && !z && v === e && O === t && ve().includes(t) && (!l.sessionCurrent || l.sessionCurrent(o));
    },
    insertShape: Yn,
    insertImage(e) {
      xe();
      const t = tt();
      D?.stopCapturing(), v.transact(() => {
        We(t, (k - e.width) / 2, (L - e.height) / 2, e.width, e.height, e.source, e.alt);
        const o = M.get(t);
        o.set("imageRatio", e.image.naturalWidth / e.image.naturalHeight);
        for (const r of ["imageFit", "cropX", "cropY", "cropImageWidth", "cropImageHeight", "aspectRatio"]) o.set(r, e[r]);
      }), D?.stopCapturing(), Le(t), J("Image added");
    },
    log: (e) => console.error("Slides insertion failed:", e)
  }), Y = ri(h, () => !z, () => {
    try {
      pe.shape();
    } catch (e) {
      J("Could not open shape picker: " + e.message, "error");
    }
  }), _ = Qo(h, () => !z, () => xe()), ne = _o({
    root: h,
    current: () => !z && h.isConnected,
    capture() {
      const e = v, t = O, o = l.captureSession?.();
      return () => h.isConnected && !z && v === e && O === t && (!l.sessionCurrent || l.sessionCurrent(o));
    },
    theme: lt,
    themes: () => [...dn().values()],
    apply: zn,
    designs: () => [...f.values(), ...S.values()].map((e) => ({ label: e.label })),
    save(e) {
      const t = ln(e);
      D?.stopCapturing(), v.transact(() => {
        K.set("saved-theme:" + t.id, structuredClone(t)), K.set("theme", structuredClone(t));
      }, "theme"), D?.stopCapturing();
    },
    canSaveLayout: () => typeof l.onSaveLayout == "function",
    saveLayout: () => a("save-layout").click(),
    openModal: (e) => {
      if (!l.openInsertModal) throw new Error("This host does not provide the Themes dialog.");
      return l.openInsertModal(e);
    },
    error: (e) => J("Could not open Themes: " + e.message, "error")
  }), te = ai({
    root: h,
    canChange: () => !z,
    selectSlide: Gt,
    getSlides: () => ve().map((e) => ({
      id: e,
      active: e === O,
      text: De(e).filter((t) => !["image", "shape"].includes(M.get(t)?.get("kind"))).map((t) => ho(v.getXmlFragment("slide-text-" + t))).filter(Boolean).join(`

`)
    }))
  }), l.url ? kn().catch(Dt) : l.seed !== !1 && Tt(), we(), so(), It(), at = Li({
    root: h,
    Y: c,
    getDocument: () => v,
    canEdit: () => !z,
    getEntries: () => ve().flatMap((e, t) => [...le.get(e) || []].sort((o, r) => _e(M.get(o)) - _e(M.get(r)) || o.localeCompare(r)).filter((o) => !M.get(o).get("kind") || M.get(o).get("kind") === "text").map((o) => ({ id: o, slideId: e, slideNumber: t + 1, locked: M.get(o).get("locked") === !0, fragment: v.getXmlFragment("slide-text-" + o) }))),
    selectedText: () => {
      const e = X.get(T)?.editor;
      return e ? e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, `
`) : "";
    },
    jump: (e) => {
      Je = !0;
      try {
        xe(), bt([e.entry.slideId]), we(), Le(e.entry.id);
        const t = X.get(e.entry.id);
        t?.editor && (t.editor.commands.setTextSelection({ from: e.from, to: e.to }), t.editor.view.focus()), t?.node.scrollIntoView({ block: "nearest", inline: "nearest" });
      } finally {
        Je = !1;
      }
    },
    transact: (e, t) => {
      if (!z) {
        for (const o of new Set(e.map((r) => r.entry.fragment))) D?.addToScope(o);
        D?.stopCapturing(), v.transact(t), D?.stopCapturing();
      }
    },
    report: gt,
    onError: (e) => {
      console.error("Slides find/replace failed:", e), typeof window.showErrorModal == "function" ? window.showErrorModal(e.message, { title: "Find and replace failed" }) : J("Find and replace failed: " + e.message, "error");
    }
  }), {
    getArticleHtml: () => Pi({ slideIds: ve(), renderSlide: Ot }),
    getHtml: () => Lo({ slideIds: ve(), renderSlide: Ot, title: l.presentationTitle?.() || a("doc-name").value || "CList presentation" }),
    exportHtml: () => Ii({ slideIds: ve(), renderSlide: Ot, title: l.presentationTitle?.() || a("doc-name").value || "CList presentation" }),
    snapshotRecovery: Pe.snapshot,
    importPowerPoint: Xo,
    exportPowerPoint: () => vi(Go()),
    exportPdf: () => gi({ slideIds: ve(), renderSlide: Ot, title: l.presentationTitle?.() || a("doc-name").value || "CList presentation" }),
    snapshot: Wo,
    loadSnapshot: $o,
    importContent: qo,
    getReferences: Qt,
    addReferences: en,
    connect: kn,
    disconnect: Pt,
    createSavedLayout: Ho,
    registerSavedLayout: ro,
    removeSavedLayout: no,
    setView: (e) => te.setMode(e),
    get viewMode() {
      return te.mode;
    },
    get document() {
      return v;
    },
    get connected() {
      return W;
    },
    destroy() {
      re?.destroy(), pe?.destroy(), ne?.destroy(), _?.destroy(), Y?.destroy(), te?.destroy(), at?.destroy(), Pe.destroy(), Ge.destroy(), it.destroy(), st.destroy(), Se?.close(), Se = null, document.removeEventListener("copy", Vn, !0), document.removeEventListener("cut", Kn, !0), document.removeEventListener("paste", Gn, !0), document.removeEventListener("keydown", po), document.removeEventListener("fullscreenchange", fo), z && rn().catch(Dt), Pt(), xe(), v.off("beforeObserverCalls", $t), M.unobserveDeep(we), q.unobserve(we), K.unobserve(we), Z.unobserve(we), ee.unobserve(Rt), U.unobserve(Ft), v.off("update", Nt), v.off("update", qe);
      for (const e of X.values())
        e.disposePointer?.(), e.editor?.destroy();
      X.clear(), lo(), de?.document.destroy(), de = null, ge = null, v.destroy(), h.remove();
    }
  };
}
export {
  Ui as createSlideEditor,
  Hi as loadSlideCatalogs
};
