function sr(n, i) {
  const l = n.ownerDocument, r = n.querySelector(".slide-menu-bar"), d = n.querySelectorAll(".slide-menu-bar")[1], m = n.querySelector('[data-panel="slide"]'), p = n.querySelector('[data-control="slide-background"]'), y = l.createElement("div");
  y.className = "slide-slide-format", y.dataset.control = "slide-format", y.hidden = !0, y.setAttribute("aria-label", "Slide formatting");
  const x = l.createElement("label");
  x.append(l.createTextNode("Slide colour"), p), y.append(x), m.remove(), d.append(y);
  const h = l.createElement("button");
  h.className = "btn-small btn-secondary", h.textContent = "Use theme colour", h.title = "Remove the custom slide colour and use the theme background", h.dataset.control = "reset-slide-colour", y.append(h);
  const g = l.createElement("button");
  g.className = "btn-small", g.textContent = "Format Slide", g.title = "Format the current slide", g.dataset.control = "format-slide", r.insertBefore(g, n.querySelector(".slide-menu-right"));
  let S = !1, b = !1, v = !1;
  function f() {
    g.hidden = !b, g.setAttribute("aria-pressed", String(S)), y.hidden = !S, d.dataset.slideFormatOpen = String(S);
  }
  g.addEventListener("click", () => {
    !v && b && (S = !S, f());
  }), h.addEventListener("click", () => {
    !v && b && S && i();
  });
  const E = [...r.querySelectorAll("[data-menu]")], A = () => {
    !v && S && (S = !1, f());
  };
  for (const s of E) s.addEventListener("click", A);
  return f(), { update(s) {
    v || (b = s, b || (S = !1), f());
  }, destroy() {
    v = !0;
    for (const s of E) s.removeEventListener("click", A);
    y.remove(), g.remove(), delete d.dataset.slideFormatOpen;
  } };
}
function lr(n) {
  const i = n.ownerDocument, l = n.querySelectorAll(".slide-menu-bar")[1], r = n.querySelector(".slide-menu-bar"), d = i.createElement("div");
  d.className = "slide-object-format", d.dataset.control = "object-format", d.hidden = !0;
  const m = n.querySelector('[data-panel="appearance"]'), p = n.querySelector('[data-panel="arrange"]'), y = m.querySelector(".control-section-body"), x = p.querySelector(".control-section-body");
  y.classList.add("slide-object-colours"), x.classList.add("slide-arrange-controls"), x.setAttribute("aria-label", "Arrange selected objects");
  const h = i.createElement("span");
  h.textContent = "Arrange", x.insertBefore(h, x.firstChild);
  const g = n.querySelector('[data-panel="images"]'), S = g?.querySelector(".control-section-body");
  if (S) {
    S.classList.add("slide-image-properties");
    const F = S.querySelector("textarea");
    F && (F.rows = 1), d.append(S), g.remove();
  }
  d.append(y, x), m.remove(), p.remove(), l.append(d);
  const b = i.createElement("button");
  b.className = "btn-small", b.textContent = "Arrange", b.title = "Arrange selected objects", b.dataset.control = "arrange-objects", r.insertBefore(b, n.querySelector(".slide-menu-right"));
  let v = [], f = null, E = !1, A = !1;
  function s() {
    const F = !!f;
    b.hidden = !v.length, b.setAttribute("aria-pressed", String(F));
    const T = v.length === 1 && v[0]?.get?.("kind") === "image";
    S && (S.hidden = !T || F), d.hidden = !v.length || !E && !F && !T, y.hidden = !E || F, x.hidden = !F, l.dataset.objectSelected = String(!!v.length), l.dataset.arrangeOpen = String(F);
  }
  return b.addEventListener("click", () => {
    A || !v.length || (f = v[0], s());
  }), s(), { update(F, T) {
    A || (v = F, E = T, f && !v.includes(f) && (f = null), s());
  }, destroy() {
    A = !0, d.remove(), b.remove(), delete l.dataset.objectSelected, delete l.dataset.arrangeOpen;
  } };
}
function zo(n) {
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(n).protocol);
  } catch {
    return !1;
  }
}
function cr(n) {
  const i = String(n.href || "").trim(), l = String(n.text || ""), r = String(n.title || "").trim(), d = String(n.alt || "").trim();
  if (!zo(i)) throw new Error("Enter an http, https, mailto, or tel URL.");
  if (!l.trim()) throw new Error("Enter the link text.");
  if (r.length > 500) throw new Error("Keep the link title under 500 characters.");
  if (d.length > 500) throw new Error("Keep link alt text under 500 characters.");
  return { href: i, text: l, title: r, alt: d, newTab: !!n.newTab };
}
function dr(n) {
  const i = n.root.ownerDocument;
  let l = null, r = null, d = 0, m = !1;
  function p(x = !1) {
    const h = r;
    d++, l?.close(), l = null, r = null, n.closed(), x && h?.current() && h.restore();
  }
  function y() {
    if (!m)
      try {
        p(), r = n.capture();
        const x = r, h = ++d, g = i.createElement("form");
        g.className = "clist-slides slide-insert-picker slide-link-picker", g.dataset.control = "link-dialog";
        const S = i.createElement("h3");
        S.textContent = "Add or edit link", g.append(S);
        const b = {};
        for (const [_, q, ee] of [["href", "url", "Link URL"], ["text", "text", "Link text"], ["title", "text", "Link title (optional)"], ["alt", "text", "Link alt text (optional)"]]) {
          const se = i.createElement("label"), oe = i.createElement("input");
          oe.type = q, oe.placeholder = ee, oe.setAttribute("aria-label", ee), oe.dataset.linkField = _, oe.value = x.values[_] || "", (_ === "title" || _ === "alt") && (oe.maxLength = 500), se.append(oe), g.append(se), b[_] = oe;
        }
        const v = i.createElement("label"), f = i.createElement("input");
        f.type = "checkbox", f.checked = x.values.newTab, f.dataset.linkField = "newTab", v.append(f, i.createTextNode("Open in new tab")), g.append(v);
        const E = i.createElement("p");
        E.setAttribute("role", "status"), E.dataset.control = "link-feedback", g.append(E);
        const A = i.createElement("div");
        A.className = "slide-picker-actions";
        const s = i.createElement("button");
        s.type = "submit", s.className = "btn-small", s.textContent = "Apply link", s.title = "Apply link", s.dataset.control = "submit-link";
        const F = i.createElement("button");
        F.type = "button", F.className = "btn-small btn-secondary", F.textContent = "Cancel", F.title = "Cancel link editing", F.dataset.control = "cancel-link-dialog", A.append(s, F), g.append(A);
        const T = n.openModal(g);
        l = T;
        let z = !1;
        const C = () => !m && h === d && T.current() && x.current();
        g.addEventListener("submit", (_) => {
          if (_.preventDefault(), !z)
            try {
              if (!C()) throw new Error("The selected text changed. Cancel and reopen Add link.");
              const q = cr({ href: b.href.value, text: b.text.value, title: b.title.value, alt: b.alt.value, newTab: f.checked });
              z = !0, x.apply(q), p(), x.focus();
            } catch (q) {
              console.error("Slides link:", q), T.current() && (E.textContent = q.message || String(q));
            } finally {
              z = !1;
            }
        }), F.addEventListener("click", () => {
          h === d && p(!0);
        }), g.addEventListener("keydown", (_) => {
          _.key === "Escape" && (_.preventDefault(), _.stopPropagation(), h === d && p(!0));
        }), b.href.focus();
      } catch (x) {
        console.error("Slides link:", x), p(), n.error(x);
      }
  }
  return { open: y, close: p, destroy() {
    m = !0, p();
  } };
}
const Mt = { system: "system-ui, sans-serif", arial: "Arial, Helvetica, sans-serif", verdana: "Verdana, Geneva, sans-serif", georgia: "Georgia, serif", times: '"Times New Roman", Times, serif', courier: '"Courier New", Courier, monospace' };
function Rn(n = {}) {
  const i = {};
  Object.hasOwn(Mt, n.fontFamily) && (i.fontFamily = n.fontFamily), n.fontSize != null && Number.isFinite(Number(n.fontSize)) && Number(n.fontSize) >= 8 && Number(n.fontSize) <= 200 && (i.fontSize = Number(n.fontSize));
  for (const l of ["textColour", "highlightColour"]) /^#[0-9a-f]{6}$/i.test(n[l] || "") && (i[l] = n[l]);
  return i;
}
function To(n) {
  const i = Rn(n), l = { "data-slide-text-style": "" }, r = [];
  i.fontFamily && (l["data-font-family"] = i.fontFamily, r.push("font-family:" + Mt[i.fontFamily])), i.fontSize && (l["data-font-size"] = String(i.fontSize), r.push("font-size:" + i.fontSize + "px", "--slide-text-size:" + i.fontSize));
  for (const [d, m, p] of [["textColour", "text-colour", "color"], ["highlightColour", "highlight-colour", "background-color"]])
    i[d] && (l["data-" + m] = i[d], r.push(p + ":" + i[d]));
  return r.length && (l.style = r.join(";")), l;
}
function ur(n) {
  return n.create({
    name: "slideTextStyle",
    addAttributes() {
      return Object.fromEntries([["fontFamily", "font-family"], ["fontSize", "font-size"], ["textColour", "text-colour"], ["highlightColour", "highlight-colour"]].map(([i, l]) => [i, {
        default: null,
        parseHTML: (r) => Rn({ [i]: r.getAttribute("data-" + l) })[i] ?? null
      }]));
    },
    parseHTML() {
      return [{ tag: "span[data-slide-text-style]" }];
    },
    renderHTML({ mark: i }) {
      return ["span", To(i.attrs), 0];
    }
  });
}
function pr(n, i) {
  const l = n.ownerDocument, r = n.querySelectorAll(".slide-menu-bar")[1], d = l.createElement("div");
  d.className = "slide-text-format", d.dataset.control = "text-format", d.hidden = !0, d.setAttribute("role", "group"), d.setAttribute("aria-label", "Selected text formatting");
  let m = !1;
  const p = {};
  for (const S of ["font-family", "font-size", "text-colour"]) {
    const b = n.querySelector('[data-control="' + S + '"]'), v = b.parentNode;
    d.append(b), v.remove(), p[S] = b;
  }
  p["font-family"].setAttribute("aria-label", "Font"), p["font-size"].setAttribute("aria-label", "Font size"), p["font-size"].step = "0.5", p["text-colour"].setAttribute("aria-label", "Text colour");
  for (const [S, b, v] of [[-1, "keyboard_arrow_down", "Decrease font size"], [1, "keyboard_arrow_up", "Increase font size"]]) {
    const f = l.createElement("button");
    f.className = "clist-action-btn btn-small", f.title = v, f.setAttribute("aria-label", v), f.dataset.control = S < 0 ? "font-smaller" : "font-larger";
    const E = l.createElement("span");
    E.className = "material-icons md-18 md-light", E.textContent = b, f.append(E), f.addEventListener("click", () => {
      !m && !d.hidden && !f.disabled && i("fontSize", Math.max(8, Math.min(200, Number(p["font-size"].value) + S)));
    }), d.insertBefore(f, p["text-colour"]), p[f.dataset.control] = f;
  }
  const y = l.createElement("input");
  y.type = "color", y.value = "#ffff00", y.dataset.control = "highlight-colour", y.title = "Highlighting colour", y.setAttribute("aria-label", "Highlighting colour"), y.addEventListener("input", () => {
    !m && !d.hidden && !y.disabled && i("highlightColour", y.value);
  }), d.append(y), p["highlight-colour"] = y;
  const x = l.createElement("button");
  x.className = "btn-small btn-secondary", x.textContent = "No highlight", x.title = "Remove highlighting", x.dataset.control = "clear-highlight", x.addEventListener("click", () => {
    !m && !d.hidden && !x.disabled && i("highlightColour", null);
  }), d.append(x), p["clear-highlight"] = x;
  for (const S of ["bold", "italic", "edit-link", "remove-link", "ordered-list", "bullet-list"]) {
    const b = n.querySelector('[data-control="' + S + '"]');
    d.append(b), p[S] = b;
  }
  const h = n.querySelector('[data-control="fit-text"]');
  h && (h.textContent = "Fit", h.title = "Grow or shrink text to fill the box", d.append(h), p["fit-text"] = h);
  const g = n.querySelector('[data-control="text-overflow-status"]');
  return g && (g.hidden = !0, d.append(g)), r.insertBefore(d, n.querySelector('[data-control="object-format"]')), { update(S, b, v) {
    if (!m) {
      d.hidden = !S, r.dataset.textFormatOpen = String(S);
      for (const f of Object.values(p)) f.disabled = !v;
      S && (p["font-family"].value = b.family, p["font-size"].value = String(Math.round(b.size * 2) / 2), p["text-colour"].value = b.colour, y.value = b.highlight || "#ffff00");
    }
  }, destroy() {
    m = !0, d.remove(), delete r.dataset.textFormatOpen;
  } };
}
function fr(n, i, l, r, d = 0) {
  const m = i && Number.isFinite(i.x) && Number.isFinite(i.y), p = m ? i.x - n.x : d, y = m ? i.y - n.y : d;
  return {
    x: Math.max(-n.x, Math.min(l - n.x - n.width, p)),
    y: Math.max(-n.y, Math.min(r - n.y - n.height, y))
  };
}
function ko(n, i, l, r) {
  return !l || !n.contains(l) || l.isContentEditable || l.closest?.('input, textarea, select, [contenteditable="true"]') ? !1 : n.contains(i) || i === r || i === r.body || i === r.documentElement;
}
const $t = [["background", "Background"], ["textColour", "Text"], ["fillColour", "Fill"], ["borderColour", "Border"]];
function hr(n, i, l, r) {
  const d = String(i || "").trim();
  if (!d || d.length > 120) throw new Error("Enter a theme name of 1–120 characters.");
  for (const [m] of $t) if (!/^#[0-9a-f]{6}$/i.test(l[m] || "")) throw new Error("Choose a valid colour for each swatch.");
  return { ...n, id: r, label: d, ...Object.fromEntries($t.map(([m]) => [m, l[m]])) };
}
function mr(n) {
  const { root: i } = n, l = i.ownerDocument, r = (b, v, f) => {
    const E = l.createElement(b);
    return v !== void 0 && (E.textContent = v), f && (E.className = f), E;
  }, d = i.querySelector('[data-control="theme"]'), m = i.querySelector('[data-panel="themes"]'), p = r("div", void 0, "slide-menu-options slide-theme-controls"), y = r("button", "Themes", "btn-small");
  y.title = "Choose and customise presentation themes", y.dataset.control = "open-themes", p.append(y, d), m?.remove(), i.querySelectorAll(".slide-menu-bar")[1].append(p);
  let x = !1, h = null, g = 0;
  function S() {
    if (!(x || !n.current()))
      try {
        let Ne = function() {
          s.replaceChildren();
          for (const ge of n.themes()) {
            const Ee = r("option", ge.label);
            Ee.value = ge.id, s.append(Ee);
          }
          s.value = n.theme().id;
        }, ke = function() {
          F.replaceChildren();
          for (const [ge, Ee] of $t) {
            const Be = r("span");
            Be.style.backgroundColor = se[ge].value, Be.title = Ee, F.append(Be);
          }
        }, H = function() {
          ue = n.theme(), Le = JSON.stringify(ue);
          for (const [ge] of $t) se[ge].value = ue[ge];
          Ne(), ke();
        };
        h?.close();
        const b = ++g, v = n.capture(), f = r("div", void 0, "clist-slides slide-insert-picker slide-theme-picker"), E = r("h2", "Themes"), A = r("label", "Presentation theme"), s = r("select"), F = r("div", void 0, "theme-preview");
        s.dataset.control = "modal-theme", A.append(s);
        const T = r("p");
        T.setAttribute("role", "status"), T.dataset.control = "theme-feedback";
        const z = r("button", "Save current slide as a new design", "btn-small");
        z.disabled = !n.canSaveLayout(), z.title = "Save the current slide as a new slide design", z.dataset.control = "save-slide-design";
        const C = r("h3", "Save a new colour theme"), _ = r("label", "Theme name"), q = r("input");
        q.type = "text", q.maxLength = 120, q.dataset.control = "theme-name", _.append(q);
        const ee = r("div", void 0, "slide-theme-colours"), se = {};
        for (const [ge, Ee] of $t) {
          const Be = r("label", Ee), Te = r("input");
          Te.type = "color", Te.dataset.themeColour = ge, Be.append(Te), ee.append(Be), se[ge] = Te;
        }
        const oe = r("div", void 0, "slide-picker-actions"), L = r("button", "Save as new theme", "btn-small"), U = r("button", "Close", "btn-small btn-secondary");
        L.title = "Save and apply a new colour theme in this presentation", L.dataset.control = "save-theme", U.title = "Close Themes", oe.append(U);
        const G = r("div", void 0, "slide-theme-columns"), J = r("section"), K = r("section");
        J.dataset.control = "colour-themes", K.dataset.control = "slide-designs";
        const le = r("ul");
        le.dataset.control = "slide-design-list";
        for (const ge of n.designs()) {
          const Ee = r("li", ge.label);
          le.append(Ee);
        }
        J.append(r("h3", "Colour Themes"), A, F, C, _, ee, L), K.append(r("h3", "Slide designs"), le, r("p", "Slide designs can be selected when creating a new slide."), z), G.append(J, K), f.append(E, G, T, oe);
        let ue = n.theme(), Le = JSON.stringify(ue);
        H();
        const Ce = n.openModal(f);
        h = Ce;
        const ot = () => !x && b === g && v() && Ce.current(), We = (ge) => {
          console.error("Slides themes:", ge), Ce.current() && (T.textContent = ge.message || String(ge));
        }, Z = () => {
          if (!ot()) throw new Error("The presentation changed. Close and reopen Themes.");
          if (JSON.stringify(n.theme()) !== Le) throw new Error("The theme changed elsewhere. Close and reopen Themes before saving.");
        };
        for (const ge of Object.values(se)) ge.addEventListener("input", () => {
          ot() && ke();
        });
        s.addEventListener("change", () => {
          try {
            Z(), n.apply(s.value), H(), T.textContent = "Theme applied.";
          } catch (ge) {
            We(ge);
          }
        }), L.addEventListener("click", () => {
          try {
            Z(), n.save(hr(ue, q.value, Object.fromEntries(Object.entries(se).map(([ge, Ee]) => [ge, Ee.value])), "custom-" + crypto.randomUUID())), H(), q.value = "", T.textContent = "Theme saved in this presentation.";
          } catch (ge) {
            We(ge);
          }
        }), z.addEventListener("click", () => {
          try {
            Z(), Ce.close(), n.saveLayout();
          } catch (ge) {
            We(ge);
          }
        }), U.addEventListener("click", () => {
          b === g && (g++, Ce.close());
        });
      } catch (b) {
        console.error("Slides themes:", b), n.error(b);
      }
  }
  return y.addEventListener("click", S), { destroy() {
    x = !0, g++, h?.close(), p.remove();
  } };
}
function gr(n, i, l, r) {
  return l === "crop" ? { imageFit: "cover", cropImageWidth: r.width, cropImageHeight: r.height } : {
    imageFit: "cover",
    cropImageWidth: r.width * i.width / n.width,
    cropImageHeight: r.height * i.height / n.height,
    aspectRatio: i.width / i.height
  };
}
function br(n, i, l) {
  const r = n.ownerDocument, d = r.createElement("div");
  d.className = "slide-menu-options", d.dataset.control = "image-handle-mode", d.hidden = !0, d.setAttribute("role", "group"), d.setAttribute("aria-label", "Image handle behavior");
  let m = "resize", p = !1;
  const y = ["resize", "crop"].map((h) => {
    const g = r.createElement("button");
    return g.className = "btn-small", g.textContent = h === "resize" ? "Resize" : "Crop", g.dataset.imageHandleMode = h, g.title = h === "resize" ? "Handles resize the image" : "Handles crop the image", g.addEventListener("click", () => {
      p || d.hidden || !i() || (m = h, x(), l());
    }), d.append(g), g;
  });
  function x() {
    n.dataset.imageHandleMode = m, y.forEach((h) => {
      const g = h.dataset.imageHandleMode === m;
      h.setAttribute("aria-pressed", String(g)), h.className = g ? "btn-small" : "btn-small btn-secondary";
    });
  }
  return n.querySelectorAll(".slide-menu-bar")[1].append(d), x(), {
    get mode() {
      return m;
    },
    update(h, g) {
      d.hidden = !h, y.forEach((S) => S.disabled = !g);
    },
    destroy() {
      p = !0, d.remove();
    }
  };
}
function yr(n, i, l, r, d = 0, m = {}) {
  const p = d * Math.PI / 180, y = Math.cos(p), x = Math.sin(p), h = l * y + r * x, g = -l * x + r * y, S = i === "left" || i === "right", b = i === "left" || i === "top", v = S ? "width" : "height", f = S ? h : g, E = S ? m.minWidth ?? 1 : m.minHeight ?? 1, A = S ? m.maxWidth ?? 1 / 0 : m.maxHeight ?? 1 / 0, s = Math.max(E, Math.min(A, n[v] + (b ? -f : f))), F = (s - n[v]) * (b ? -1 : 1) / 2, T = S ? F * y : -F * x, z = S ? F * x : F * y, C = S ? s : n.width, _ = S ? n.height : s;
  return {
    x: n.x + (n.width - C) / 2 + T,
    y: n.y + (n.height - _) / 2 + z,
    width: C,
    height: _
  };
}
function So(n, i) {
  return ((Math.round((Number(n) || 0) + i) + 180) % 360 + 360) % 360 - 180;
}
const wr = `
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
function xr(n, i, l) {
  const r = n.ownerDocument || n, d = l.schedule || setTimeout, m = l.unschedule || clearTimeout;
  let p = null;
  const y = () => {
    p && m(p.timer), p = null, r.removeEventListener("pointermove", x, !0), r.removeEventListener("pointerup", h, !0), r.removeEventListener("pointercancel", h, !0), r.removeEventListener("pointerdown", y, !0), r.removeEventListener("visibilitychange", y), n.ownerDocument?.defaultView?.removeEventListener("blur", y);
  }, x = (S) => {
    p && S.pointerId === p.pointerId && Math.hypot(S.clientX - p.clientX, S.clientY - p.clientY) > 5 && y();
  }, h = (S) => {
    S.pointerId === p?.pointerId && y();
  }, g = (S) => {
    if (y(), !(!l.current() || S.button !== 0 || S.isPrimary === !1 || S.target === i)) {
      if (l.text() && S.target.closest?.(".text-content")) {
        l.select(!1);
        const b = {
          button: 0,
          pointerId: S.pointerId,
          clientX: S.clientX,
          clientY: S.clientY,
          currentTarget: n,
          preventDefault() {
          },
          stopPropagation() {
          }
        };
        p = { ...b, timer: d(() => {
          y(), !(!l.current() || !n.isConnected) && l.move(b);
        }, 450) }, r.addEventListener("pointermove", x, !0), r.addEventListener("pointerup", h, !0), r.addEventListener("pointercancel", h, !0), r.addEventListener("pointerdown", y, !0), r.addEventListener("visibilitychange", y), n.ownerDocument?.defaultView?.addEventListener("blur", y);
        return;
      }
      if (S.shiftKey) {
        S.preventDefault(), S.stopPropagation(), l.select(!0), l.focus();
        return;
      }
      l.move(S);
    }
  };
  return n.addEventListener("pointerdown", g), () => {
    y(), n.removeEventListener("pointerdown", g);
  };
}
const Rt = 0.02, ut = (n, i, l) => Math.max(i, Math.min(l, Number(n) || 0));
function Vt(n = {}) {
  n ||= {};
  const i = ut(n.width ?? 1, Rt, 1), l = ut(n.height ?? 1, Rt, 1);
  return { x: ut(n.x, 0, 1 - i), y: ut(n.y, 0, 1 - l), width: i, height: l };
}
function Eo(n, i, l, r) {
  if (n = Vt(n), i === "move") return { ...n, x: ut(n.x + l, 0, 1 - n.width), y: ut(n.y + r, 0, 1 - n.height) };
  let d = n.x, m = n.y, p = d + n.width, y = m + n.height;
  return i.includes("w") && (d = ut(d + l, 0, p - Rt)), i.includes("e") && (p = ut(p + l, d + Rt, 1)), i.includes("n") && (m = ut(m + r, 0, y - Rt)), i.includes("s") && (y = ut(y + r, m + Rt, 1)), { x: d, y: m, width: p - d, height: y - m };
}
function Pn(n, i, l) {
  return n = Vt(n), {
    width: i * n.width,
    height: l * n.height,
    imageFit: "cover",
    cropImageWidth: i,
    cropImageHeight: l,
    cropX: n.width < 1 ? 100 * n.x / (1 - n.width) : 50,
    cropY: n.height < 1 ? 100 * n.y / (1 - n.height) : 50,
    aspectRatio: i * n.width / (l * n.height)
  };
}
function vr(n, i) {
  if (n.get("imageFit") !== "cover") return Vt();
  const l = Number(n.get("cropImageWidth")) || Math.max(n.get("width"), n.get("height") * i), r = Number(n.get("cropImageHeight")) || l / i, d = Math.min(1, n.get("width") / l), m = Math.min(1, n.get("height") / r);
  return Vt({ width: d, height: m, x: (1 - d) * (Number.isFinite(Number(n.get("cropX"))) ? Number(n.get("cropX")) : 50) / 100, y: (1 - m) * (Number.isFinite(Number(n.get("cropY"))) ? Number(n.get("cropY")) : 50) / 100 });
}
function Io({ container: n, source: i, ratio: l, initial: r, current: d = () => !0, onDone: m, onCancel: p, actionsContainer: y = n }) {
  const x = n.ownerDocument;
  let h = Vt(r), g = null, S = !1;
  const b = x.createElement("div");
  b.className = "slide-crop-stage", b.style.aspectRatio = String(l);
  const v = x.createElement("img");
  v.src = i, v.alt = "Image to crop", v.draggable = !1;
  const f = x.createElement("div");
  f.className = "slide-crop-rectangle", f.tabIndex = 0, f.dataset.control = "crop-rectangle", f.setAttribute("role", "group"), f.setAttribute("aria-label", "Crop area. Arrow keys move; Shift plus arrows resizes.");
  for (const z of ["nw", "ne", "sw", "se"]) {
    const C = x.createElement("span");
    C.className = "slide-crop-handle " + z, C.dataset.corner = z, C.setAttribute("aria-hidden", "true"), f.append(C);
  }
  const E = x.createElement("div");
  E.className = "slide-picker-actions";
  const A = x.createElement("button"), s = x.createElement("button");
  A.className = "btn-small", A.textContent = "Done", A.title = "Apply the selected crop", A.dataset.control = "crop-done", s.className = "btn-small btn-secondary", s.textContent = "Cancel crop", s.title = "Cancel cropping", s.dataset.control = "crop-cancel", E.append(A, s), b.append(v, f), n.append(b), y.append(E);
  const F = () => {
    f.style.left = h.x * 100 + "%", f.style.top = h.y * 100 + "%", f.style.width = h.width * 100 + "%", f.style.height = h.height * 100 + "%";
  }, T = () => {
    g && f.hasPointerCapture?.(g.id) && f.releasePointerCapture(g.id), g = null;
  };
  return f.addEventListener("pointerdown", (z) => {
    if (S || !d() || z.isPrimary === !1 || z.button !== 0 || g) return;
    const C = b.getBoundingClientRect();
    !C.width || !C.height || (z.preventDefault(), z.stopPropagation(), g = { id: z.pointerId, x: z.clientX, y: z.clientY, rect: { ...h }, handle: z.target.dataset.corner || "move", bounds: C }, f.setPointerCapture?.(z.pointerId), f.focus({ preventScroll: !0 }));
  }), f.addEventListener("pointermove", (z) => {
    if (!(!g || z.pointerId !== g.id)) {
      if (!d()) {
        T();
        return;
      }
      z.preventDefault(), z.stopPropagation(), h = Eo(g.rect, g.handle, (z.clientX - g.x) / g.bounds.width, (z.clientY - g.y) / g.bounds.height), F();
    }
  }), f.addEventListener("pointerup", T), f.addEventListener("pointercancel", () => {
    g && (h = g.rect, F()), T();
  }), f.addEventListener("keydown", (z) => {
    S || !d() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(z.key) || (z.preventDefault(), z.stopPropagation(), h = Eo(h, z.shiftKey ? "se" : "move", z.key === "ArrowLeft" ? -0.01 : z.key === "ArrowRight" ? 0.01 : 0, z.key === "ArrowUp" ? -0.01 : z.key === "ArrowDown" ? 0.01 : 0), F());
  }), A.addEventListener("click", () => {
    S || (T(), d() ? m({ ...h }) : p());
  }), s.addEventListener("click", () => {
    S || (T(), p());
  }), F(), { get rect() {
    return { ...h };
  }, destroy() {
    S = !0, T(), b.remove(), E.remove();
  } };
}
function kr(n) {
  const i = n.root.ownerDocument;
  let l = 0, r = !1, d = null;
  const m = (h, g, S) => {
    const b = i.createElement(h);
    return g !== void 0 && (b.textContent = g), S && (b.className = S), b;
  };
  function p(h) {
    if (r) throw new Error("This slide editor is closed.");
    const g = ++l, S = n.capture();
    if (!S()) throw new Error("The destination slide is no longer active.");
    d?.close();
    const b = m("div", void 0, "clist-slides slide-insert-picker"), v = m("h2", h), f = m("div"), E = m("p"), A = m("div", void 0, "slide-picker-actions");
    E.setAttribute("role", "status"), E.dataset.control = "picker-feedback";
    const s = m("button", "Cancel", "btn-small btn-secondary");
    s.title = "Cancel insertion", b.append(v, f, E, A), A.append(s);
    const F = n.openModal(b);
    d = F;
    const T = () => !r && l === g && S() && F.current();
    return s.addEventListener("click", () => {
      l === g && (l++, F.close());
    }), { body: b, content: f, actions: A, current: T, error: (C) => {
      n.log(C), T() && (E.textContent = C.message || String(C));
    }, close: F.close };
  }
  function y() {
    const h = p("Choose a shape"), g = m("div", void 0, "slide-shape-grid");
    h.content.append(g);
    for (const S of n.shapes) {
      const b = m("div", void 0, "slide-shape-tile"), v = i.createElementNS("http://www.w3.org/2000/svg", "svg");
      v.setAttribute("viewBox", S.viewBox.join(" ")), v.setAttribute("aria-hidden", "true"), v.setAttribute("fill", "none"), v.setAttribute("stroke", "currentColor"), v.setAttribute("stroke-width", String(Math.max(S.viewBox[2], S.viewBox[3]) / 45));
      for (const E of S.elements) {
        const A = i.createElementNS("http://www.w3.org/2000/svg", E.tag);
        for (const [s, F] of Object.entries(E.attributes)) A.setAttribute(s, String(F));
        A.setAttribute("fill", "none"), v.append(A);
      }
      const f = m("button", void 0, "clist-action-btn btn-small slide-shape-choice");
      f.title = "Insert " + S.label, f.setAttribute("aria-label", S.label), f.dataset.shape = S.id, f.append(v), f.addEventListener("click", () => {
        if (h.current())
          try {
            n.insertShape(S.id), h.close();
          } catch (E) {
            h.error(E);
          }
      }), b.append(f), g.append(b);
    }
    return h.body;
  }
  function x() {
    const h = p("Insert image"), g = m("div", void 0, "slide-picker-actions"), S = m("button", "Choose image file", "btn-small"), b = m("button", "Image libraries", "btn-small btn-secondary");
    S.title = "Choose a PNG, JPEG, GIF or WebP image", b.disabled = !0, b.title = "Image libraries are not available yet";
    const v = m("input");
    v.type = "file", v.accept = "image/png,image/jpeg,image/gif,image/webp", v.hidden = !0, v.dataset.control = "picker-file";
    const f = m("p", "Image library connections can be added here in the future.");
    g.append(S, b, v), h.content.append(g, f);
    const E = m("div", void 0, "slide-image-preview"), A = m("div", void 0, "slide-image-fields");
    E.hidden = A.hidden = !0;
    const s = m("label", "Description (alt text)"), F = m("input");
    F.type = "text", F.maxLength = 2e3, F.dataset.control = "picker-alt", s.append(F), A.append(s);
    const T = m("button", "Insert image", "btn-small"), z = m("button", "Adjust crop", "btn-small");
    T.title = "Insert this image", T.disabled = !0, T.dataset.control = "picker-insert", z.title = "Adjust the crop rectangle", z.hidden = !0, z.dataset.control = "picker-adjust-crop", h.actions.insertBefore(T, h.actions.firstElementChild), h.actions.insertBefore(z, T), h.content.append(E, A);
    let C = null, _ = 0, q = !1, ee = null, se = null;
    function oe() {
      const G = Math.min(1, 800 / C.image.naturalWidth, 500 / C.image.naturalHeight);
      return { width: C.image.naturalWidth * G, height: C.image.naturalHeight * G };
    }
    function L(G) {
      ee?.destroy(), ee = null, se = G, E.textContent = "";
      const J = oe(), K = Pn(G, J.width, J.height), le = m("div", void 0, "slide-cropped-preview"), ue = m("img");
      le.style.aspectRatio = K.width + "/" + K.height, le.style.width = "min(100%, " + Math.min(640, 340 * K.width / K.height) + "px)", ue.src = C.source, ue.alt = "Cropped image preview", ue.style.width = 100 / G.width + "%", ue.style.height = 100 / G.height + "%", ue.style.left = -100 * G.x / G.width + "%", ue.style.top = -100 * G.y / G.height + "%", le.append(ue), E.append(le), T.disabled = !1, z.hidden = !1;
    }
    function U() {
      !h.current() || !C || q || (ee?.destroy(), E.textContent = "", T.disabled = !0, z.hidden = !0, E.style.width = "min(100%, " + Math.min(640, 340 * C.image.naturalWidth / C.image.naturalHeight) + "px)", ee = Io({
        container: E,
        source: C.source,
        ratio: C.image.naturalWidth / C.image.naturalHeight,
        initial: se,
        current: h.current,
        onDone: L,
        onCancel: () => L(se || { x: 0, y: 0, width: 1, height: 1 })
      }));
    }
    return z.addEventListener("click", U), S.addEventListener("click", () => {
      h.current() && !q && v.click();
    }), v.addEventListener("change", async () => {
      if (!h.current() || q || !v.files?.[0]) return;
      const G = ++_, J = v.files[0];
      C = null, se = null, ee?.destroy(), ee = null, T.disabled = !0, z.hidden = !0, E.hidden = A.hidden = !0;
      try {
        const K = await n.readImage(J);
        if (!h.current() || G !== _) return;
        C = K, F.value = J.name, E.hidden = A.hidden = !1, U();
      } catch (K) {
        G === _ && h.error(K);
      } finally {
        G === _ && (v.value = "");
      }
    }), T.addEventListener("click", () => {
      if (!(!h.current() || !C || !se || ee || q)) {
        q = !0, T.disabled = !0;
        try {
          const G = oe(), J = Pn(se, G.width, G.height);
          n.insertImage({ ...C, ...J, alt: F.value.slice(0, 2e3) }), h.close();
        } catch (G) {
          h.error(G), q = !1, T.disabled = !1;
        }
      }
    }), h.body;
  }
  return { shape: y, image: x, destroy() {
    r = !0, l++, d?.close(), d = null;
  } };
}
function Sr(n, i = () => !0, l = null) {
  const r = n.ownerDocument, d = n.querySelector(".toolbar"), m = n.querySelector(".tools"), p = r.createElement("div");
  p.className = "slide-menu-bar tools", m.className = "slide-menu-bar tools", p.setAttribute("aria-label", "Slide menu"), m.setAttribute("aria-label", "Slide menu options"), d.insertBefore(p, m);
  let y = !1, x = "new";
  const h = r.createElement("div");
  h.className = "slide-menu-options", h.dataset.menuGroup = "insert";
  const g = r.createElement("button");
  g.className = "btn-small", g.textContent = "Insert", g.title = "Insert options", g.dataset.menu = "insert";
  const S = r.createElement("div");
  S.className = "slide-menu-options", S.dataset.menuGroup = "new";
  for (const q of ["add-slide", "duplicate-slide"]) {
    const ee = n.querySelector('[data-control="' + q + '"]');
    ee && (q === "add-slide" && (ee.textContent = "Blank Slide", ee.title = "Blank Slide"), S.append(ee));
  }
  const b = r.createElement("button");
  b.className = "btn-small", b.textContent = "New Slide", b.title = "New Slide options", b.dataset.menu = "new";
  const v = (q) => y || !i() || !["new", "insert"].includes(q) ? !1 : (x = q, S.hidden = q !== "new", h.hidden = q !== "insert", b.setAttribute("aria-pressed", String(q === "new")), g.setAttribute("aria-pressed", String(q === "insert")), n.dataset.slideMenu = q, !0);
  b.addEventListener("click", () => v("new")), p.append(b);
  for (const q of [...m.children]) p.append(q);
  m.append(S, h), g.addEventListener("click", () => v("insert")), p.insertBefore(g, b.nextSibling);
  const f = r.createElement("button");
  f.className = "btn-small", f.textContent = "Shape", f.title = "Choose a shape", f.dataset.control = "choose-shape", h.append(f);
  for (const [q, ee] of [["add-image", "Image"], ["add-text", "Text"]]) {
    const se = n.querySelector('[data-control="' + q + '"]');
    se && (se.className = "btn-small", se.textContent = ee, h.append(se));
  }
  const E = n.querySelector('[data-control="shape-tools"]');
  E && (E.hidden = !0, h.append(E)), f.addEventListener("click", () => {
    !y && i() && x === "insert" && l?.();
  });
  const A = r.createElement("button");
  A.className = "btn-small", A.textContent = "Slide Design", A.title = "Choose a design for the next slide", A.dataset.control = "choose-template";
  const s = n.querySelector('[data-control="slide-layout"]'), F = s?.parentNode;
  S.append(A), s && (s.hidden = !0, S.append(s), F?.classList.contains("slide-layout-label") && F.remove()), A.addEventListener("click", () => {
    !y && i() && s && (s.hidden = !s.hidden, s.hidden || (s.selectedIndex = -1, s.focus()));
  });
  const T = () => {
    y || !i() || x !== "new" || s.hidden || !s.value || (n.querySelector('[data-control="add-slide"]')?.click(), s.hidden = !0);
  };
  s?.addEventListener("change", T), n.querySelector(".slide-create-actions")?.remove();
  const z = n.querySelector(".canvas-zoom");
  z && p.append(z);
  const C = [...p.children].filter((q) => q.classList.contains("rule")).at(-1);
  if (C) {
    const q = r.createElement("div");
    q.className = "slide-menu-right";
    let ee = C.nextElementSibling;
    for (; ee; ) {
      const se = ee.nextElementSibling;
      q.append(ee), ee = se;
    }
    p.append(q);
  }
  const _ = n.querySelector('[data-control="connection-status"]');
  return _ && n.querySelector(".slide-editor-info")?.append(_), v("new"), { choose: v, get active() {
    return x;
  }, destroy() {
    y = !0, s?.removeEventListener("change", T);
  } };
}
const Co = [
  ["slide", "View slide only"],
  ["notes", "Slide + notes"],
  ["outline", "Outline"],
  ["sorter", "Slide sorter"]
];
function Er({ root: n, getSlides: i, selectSlide: l, canChange: r = () => !0 }) {
  const d = n.ownerDocument;
  let m = "slide", p = !1;
  const y = d.createElement("label"), x = d.createElement("select");
  y.className = "slide-view-picker", x.dataset.control = "slide-view", x.title = "Choose slide editor view", x.setAttribute("aria-label", "Slide editor view");
  for (const [s, F] of Co) {
    const T = d.createElement("option");
    T.value = s, T.textContent = F, x.append(T);
  }
  y.append(x);
  const h = n.querySelector(".tools");
  h.insertBefore(y, h.firstElementChild || null);
  const g = d.createElement("section");
  g.className = "slide-outline", g.setAttribute("aria-label", "Presentation outline"), n.querySelector(".workspace").append(g);
  const S = n.querySelector('[data-control="slide-list"]'), b = /* @__PURE__ */ new Map();
  function v() {
    if (p || m !== "outline") return;
    const s = i(), F = new Set(s.map((z) => z.id));
    for (const [z, C] of b) F.has(z) || (C.section.remove(), b.delete(z));
    let T = g.firstElementChild;
    s.forEach((z, C) => {
      let _ = b.get(z.id);
      if (!_) {
        const ee = d.createElement("section"), se = d.createElement("button"), oe = d.createElement("div");
        se.className = "btn-small", se.title = "Select this slide", oe.className = "slide-outline-text", se.addEventListener("click", () => {
          !p && r() && l(z.id);
        }), ee.append(se, oe), _ = { section: ee, button: se, text: oe }, b.set(z.id, _);
      }
      _.button.textContent = "Slide " + (C + 1), _.button.setAttribute("aria-current", String(z.active));
      const q = z.text || "(No text on this slide)";
      _.text.textContent !== q && (_.text.textContent = q), T === _.section ? T = T.nextElementSibling : g.insertBefore(_.section, T);
    });
  }
  function f(s) {
    return p || !r() || !Co.some(([F]) => F === s) ? (x.value = m, !1) : (m = s, n.dataset.slideView = m, x.value = m, S.title = m === "sorter" ? "Drag to reorder. Double-click a slide or press Enter to edit it." : "Slides", v(), !0);
  }
  const E = () => f(x.value), A = (s) => {
    if (m !== "sorter" || !r() || s.type === "keydown" && s.key !== "Enter") return;
    const F = s.target.closest("[data-slide-id]");
    !F || !S.contains(F) || (s.preventDefault(), s.stopPropagation(), l(F.dataset.slideId), f("slide"), x.focus());
  };
  return x.addEventListener("change", E), S.addEventListener("dblclick", A), S.addEventListener("keydown", A, !0), f(m), {
    refresh: v,
    setMode: f,
    get mode() {
      return m;
    },
    focus(s) {
      b.get(s)?.button.focus({ preventScroll: !0 });
    },
    destroy() {
      p = !0, x.removeEventListener("change", E), S.removeEventListener("dblclick", A), S.removeEventListener("keydown", A, !0), y.remove(), g.remove(), b.clear(), delete n.dataset.slideView;
    }
  };
}
function Cr(n, i, l, r = !1) {
  return n.findIndex((d) => r ? l < d.top || l <= d.bottom && i < d.left + d.width / 2 : l < d.top + d.height / 2);
}
function Fo(n) {
  try {
    const i = new URL(n);
    return ["http:", "https:"].includes(i.protocol) ? i.href : "";
  } catch {
    return "";
  }
}
function zn(n) {
  if (!n || typeof n.url != "string") return null;
  const i = Fo(n.url);
  return i ? { ...JSON.parse(JSON.stringify(n)), url: i } : null;
}
function Ar(n, i) {
  if (!n || !["text/html", "text/plain"].includes(n.type) || typeof n.value != "string") throw new Error("Import HTML or plain text into Slides.");
  const l = document.createElement("div");
  if (n.type === "text/html") {
    const r = new DOMParser().parseFromString(n.value, "text/html");
    r.querySelectorAll("script, style, iframe, object, embed, template, form, button, input, select, textarea, .clist-actions, .status-actions, .material-icons").forEach((d) => d.remove());
    for (const d of r.querySelectorAll("img")) d.replaceWith(r.createTextNode(d.alt || ""));
    for (const d of r.body.querySelectorAll("*")) {
      for (const m of [...d.attributes]) m.name !== "href" && d.removeAttribute(m.name);
      if (d.hasAttribute("href")) {
        const m = Fo(d.getAttribute("href"));
        m ? d.setAttribute("href", m) : d.removeAttribute("href");
      }
    }
    l.innerHTML = r.body.innerHTML;
  } else
    for (const r of n.value.split(/\r?\n/)) {
      const d = document.createElement("p");
      d.textContent = r, l.append(d);
    }
  for (const r of i) {
    const d = document.createElement("p"), m = document.createElement("a");
    m.href = r.url, m.textContent = r.title || r.url, d.append(document.createTextNode("Source: "), m), l.append(d);
  }
  if (!l.textContent.trim()) throw new Error("There is no readable text to import.");
  return l.innerHTML;
}
function Lr(n, i = 8, l = 200) {
  let r = Math.ceil(i * 2), d = Math.floor(l * 2), m = r;
  for (; r <= d; ) {
    const p = Math.floor((r + d) / 2);
    n(p / 2) ? (m = p, r = p + 1) : d = p - 1;
  }
  return m / 2;
}
const Po = (n, i) => Math.max(8, Math.min(200, Math.round(n * i * 2) / 2));
function Mr(n, i, l) {
  let r = null, d = !1;
  const m = /* @__PURE__ */ new WeakMap(), p = n.querySelector('[data-control="fit-text"]'), y = n.querySelector('[data-control="text-overflow-status"]');
  function x(E) {
    const A = E.content.querySelector(".tiptap");
    return !!A && A.clientHeight > 0 && (A.scrollHeight > A.clientHeight + 1 || A.scrollWidth > A.clientWidth + 1);
  }
  function h() {
    if (r = null, d) return;
    let E = 0;
    const A = l.selected();
    for (const T of l.views()) {
      if (!T.editor) continue;
      const z = x(T);
      A.includes(T) && (E += Number(z));
      let C = m.get(T.node);
      !C && z && (C = document.createElement("span"), C.className = "text-overflow-badge", C.textContent = "Text overflow", C.title = "Text does not fit in this box. Use Fit text or enlarge the box.", T.node.append(C), m.set(T.node, C)), C && C.hidden === z && (C.hidden = !z);
    }
    const s = l.presenting() || !A.length || A.some((T) => T.box.get("locked") === !0) || !A.some((T) => T.editor);
    p.disabled !== s && (p.disabled = s);
    const F = E ? E + " selected text box" + (E === 1 ? " overflows." : "es overflow.") + " Use Fit text or enlarge the box." : A.some((T) => T.editor) ? "Selected text fits." : "Select a text box to check its fit.";
    y.textContent !== F && (y.textContent = F);
  }
  function g() {
    !d && r === null && (r = requestAnimationFrame(h));
  }
  function S() {
    const E = l.selected();
    if (l.presenting() || E.some((s) => s.box.get("locked") === !0)) return;
    const A = [];
    for (const s of E) {
      if (!s.editor || !s.editor.getText().trim()) continue;
      const F = s.node.style.getPropertyValue("--slide-font-size"), T = l.size(s.box), z = i.getBoundingClientRect().width / 1280;
      if (z <= 0) continue;
      const C = [...s.content.querySelectorAll("[data-slide-text-style][data-font-size]")].map((q) => ({ node: q, style: q.style.cssText, size: Number(q.getAttribute("data-font-size")) }));
      let _ = T;
      try {
        _ = Lr((q) => {
          s.node.style.setProperty("--slide-font-size", q * z + "px");
          for (const ee of C) ee.node.style.setProperty("font-size", Po(ee.size, q / T) * z + "px", "important");
          return !x(s);
        });
      } finally {
        s.node.style.setProperty("--slide-font-size", F);
        for (const q of C) q.node.style.cssText = q.style;
      }
      _ !== T && A.push({ box: s.box, view: s, size: _, scale: _ / T });
    }
    l.apply(A), h();
  }
  const b = () => {
    try {
      S();
    } catch (E) {
      console.error("Slides Fit:", E), l.error?.(E);
    }
  };
  p.addEventListener("click", b);
  const v = new MutationObserver(g);
  v.observe(i, { childList: !0, subtree: !0, characterData: !0, attributes: !0, attributeFilter: ["style", "class"] });
  const f = new ResizeObserver(g);
  return f.observe(i), document.fonts?.addEventListener("loadingdone", g), g(), { schedule: g, destroy() {
    d = !0, r !== null && cancelAnimationFrame(r), v.disconnect(), f.disconnect(), document.fonts?.removeEventListener("loadingdone", g), p.removeEventListener("click", b);
  } };
}
function Nr(n, i, l) {
  const r = document.createElement("div");
  r.className = "selection-marquee", r.hidden = !0, r.setAttribute("aria-hidden", "true"), i.append(r);
  let d = null;
  function m(b) {
    const v = i.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1280, (b.clientX - v.left) * 1280 / v.width)), y: Math.max(0, Math.min(720, (b.clientY - v.top) * 720 / v.height)) };
  }
  function p() {
    const b = d;
    d = null, r.hidden = !0, b && i.hasPointerCapture(b.pointer) && i.releasePointerCapture(b.pointer);
  }
  function y() {
    if (!d) return;
    const b = d.original;
    p(), l.select(b);
  }
  function x(b) {
    b.button !== 0 || b.isPrimary === !1 || (y(), d = { start: m(b), clientX: b.clientX, clientY: b.clientY, pointer: b.pointerId, original: l.selected(), additive: b.shiftKey, slide: l.slideId(), moved: !1 }, i.setPointerCapture(b.pointerId));
  }
  function h(b) {
    if (!d || b.pointerId !== d.pointer) return;
    if (l.slideId() !== d.slide) {
      y();
      return;
    }
    if (!d.moved && Math.hypot(b.clientX - d.clientX, b.clientY - d.clientY) < 4) return;
    d.moved = !0, b.preventDefault();
    const v = m(b), f = Math.min(d.start.x, v.x), E = Math.min(d.start.y, v.y), A = Math.abs(v.x - d.start.x), s = Math.abs(v.y - d.start.y);
    Object.assign(r.style, { left: f / 12.8 + "%", top: E / 7.2 + "%", width: A / 12.8 + "%", height: s / 7.2 + "%" }), r.hidden = !1;
    const F = new Set(d.additive ? d.original : []);
    for (const T of l.objects())
      T.x < f + A && T.x + T.width > f && T.y < E + s && T.y + T.height > E && F.add(T.id);
    l.select([...F]);
  }
  function g(b) {
    !d || b.pointerId !== d.pointer || (h(b), p());
  }
  function S(b) {
    d && b.key === "Escape" && (b.preventDefault(), b.stopPropagation(), y());
  }
  return i.addEventListener("pointermove", h), i.addEventListener("pointerup", g), i.addEventListener("pointercancel", y), i.addEventListener("lostpointercapture", y), n.addEventListener("keydown", S, !0), { begin: x, cancel: y, destroy() {
    p(), i.removeEventListener("pointermove", h), i.removeEventListener("pointerup", g), i.removeEventListener("pointercancel", y), i.removeEventListener("lostpointercapture", y), n.removeEventListener("keydown", S, !0), r.remove();
  } };
}
function jr(n, i) {
  const l = (b) => n.querySelector('[data-control="' + b + '"]'), r = l("canvas-viewport"), d = l("slide"), m = l("canvas-zoom"), p = [25, 50, 75, 100, 125, 150, 200];
  let y = "fit", x = 100;
  function h() {
    if (i() || !r.clientWidth || !r.clientHeight) return;
    const b = Math.max(1, r.clientWidth - 48), v = Math.max(1, r.clientHeight - 48);
    y === "fit" && (x = Math.min(100, b / 1280 * 100, v / 720 * 100));
    const f = 1280 * x / 100, E = 720 * x / 100;
    d.style.setProperty("--canvas-slide-width", f + "px"), d.style.setProperty("--slide-text-unit", f / 1280 + "px"), r.style.setProperty("--canvas-stage-width", f + 48 + "px"), r.style.setProperty("--canvas-stage-height", E + 48 + "px"), m.options[0].textContent = "Fit (" + Math.round(x) + "%)", m.value = y, l("zoom-out").disabled = x <= 25, l("zoom-in").disabled = x >= 200;
  }
  function g(b) {
    y = b, y !== "fit" && (x = Number(y)), h(), y === "fit" && (r.scrollLeft = 0, r.scrollTop = 0);
  }
  m.addEventListener("change", () => g(m.value)), l("zoom-fit").addEventListener("click", () => g("fit")), l("zoom-in").addEventListener("click", () => g(String(p.find((b) => b > x + 0.1) || 200))), l("zoom-out").addEventListener("click", () => g(String([...p].reverse().find((b) => b < x - 0.1) || 25)));
  const S = new ResizeObserver((b) => {
    b.some((f) => f.target === r) && h();
    const v = d.getBoundingClientRect().width;
    v > 0 && d.style.setProperty("--slide-text-unit", v / 1280 + "px");
  });
  return S.observe(r), S.observe(d), h(), { update: h, destroy() {
    S.disconnect();
  } };
}
const zr = {
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
function Tr() {
  const n = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return n.setAttribute("viewBox", "0 0 24 24"), n.setAttribute("aria-hidden", "true"), n.setAttribute("focusable", "false"), n.setAttribute("fill", "none"), n.setAttribute("stroke", "currentColor"), n.setAttribute("stroke-width", "1.8"), n.setAttribute("stroke-linecap", "round"), n.setAttribute("stroke-linejoin", "round"), n;
}
function Ao(n, i = null) {
  const l = Tr();
  if (i) {
    l.setAttribute("viewBox", i.viewBox.join(" ")), l.setAttribute("stroke-width", String(Math.max(i.viewBox[2], i.viewBox[3]) / 12));
    for (const r of i.elements) {
      const d = document.createElementNS("http://www.w3.org/2000/svg", r.tag);
      for (const [m, p] of Object.entries(r.attributes)) d.setAttribute(m, String(p));
      l.append(d);
    }
  } else
    l.innerHTML = zr[n.dataset.control] || '<circle cx="12" cy="12" r="8"/>';
  n.className = "clist-action-btn btn-small", n.type = "button", n.setAttribute("aria-label", n.title), n.replaceChildren(l);
}
function Lo(n, i) {
  const l = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" }, r = { bold: "strong", italic: "em", strike: "s", code: "code", underline: "u" };
  function d(p) {
    if (typeof p.toDelta == "function") {
      const g = i.createDocumentFragment();
      for (const S of p.toDelta()) {
        if (typeof S.insert != "string") continue;
        let b = i.createTextNode(S.insert);
        for (const [v, f] of Object.entries(S.attributes || {})) {
          let E;
          if (r[v] ? E = i.createElement(r[v]) : v === "link" && typeof f?.href == "string" && /^(https?:|mailto:|tel:)/i.test(f.href) && (E = i.createElement("a"), E.href = f.href, E.target = f.target === "_self" ? "_self" : "_blank", typeof f.title == "string" && (E.title = f.title.slice(0, 500)), typeof f.ariaLabel == "string" && f.ariaLabel && E.setAttribute("aria-label", f.ariaLabel.slice(0, 500)), E.rel = "noopener noreferrer"), v === "slideTextStyle") {
            E = i.createElement("span");
            for (const [A, s] of Object.entries(To(f))) E.setAttribute(A, s);
          }
          E && (E.append(b), b = E);
        }
        g.append(b);
      }
      return g;
    }
    const y = p.getAttributes?.() || {}, x = p.nodeName === "heading" ? "h" + Math.max(1, Math.min(6, Number(y.level) || 1)) : l[p.nodeName] || "div", h = i.createElement(x);
    p.nodeName === "orderedList" && Number.isInteger(y.start) && (h.start = y.start);
    for (const g of p.toArray?.() || []) h.append(d(g));
    return h;
  }
  const m = i.createDocumentFragment();
  for (const p of n.toArray()) m.append(d(p));
  return m;
}
function Ir({ renderSlide: n, navigate: i, jump: l, present: r, end: d }) {
  const m = window.open("", "_blank", "popup,width=1200,height=850");
  if (!m) throw new Error("Allow pop-up windows for CList to open Presenter view.");
  const p = m.document;
  p.title = "CList Slides — Presenter view", p.documentElement.lang = "en";
  for (const K of document.querySelectorAll('link[rel="stylesheet"], style')) p.head.append(K.cloneNode(!0));
  p.body.className = "clist-presenter-page";
  const y = p.createElement("main");
  y.className = "clist-slides presenter-console", p.body.replaceChildren(y);
  const x = p.createElement("header");
  x.className = "presenter-header";
  const h = p.createElement("h1");
  h.textContent = "Presenter view";
  const g = p.createElement("span"), S = p.createElement("span"), b = p.createElement("p");
  g.dataset.control = "presenter-position", S.dataset.control = "presenter-timer", S.setAttribute("aria-label", "Elapsed presentation time"), b.setAttribute("role", "status"), x.append(h, g, S);
  function v(K) {
    console.error("Presenter view failed:", K), b.textContent = K.message;
  }
  function f(K, le, ue) {
    const Le = p.createElement("button");
    return Le.className = "btn-small", Le.textContent = K, Le.title = K, Le.dataset.control = le, Le.addEventListener("click", () => {
      try {
        Promise.resolve(ue()).catch(v);
      } catch (Ne) {
        v(Ne);
      }
    }), x.append(Le), Le;
  }
  const E = f("Previous", "presenter-previous", () => i(-1)), A = f("Next", "presenter-next", () => i(1)), s = f("Present", "presenter-start", r), F = f("End presentation", "presenter-end", d);
  let T = 0, z = null;
  function C() {
    const K = Math.floor((T + (z === null ? 0 : Date.now() - z)) / 1e3);
    S.textContent = "Elapsed " + String(Math.floor(K / 60)).padStart(2, "0") + ":" + String(K % 60).padStart(2, "0");
  }
  f("Reset timer", "presenter-reset-timer", () => {
    T = 0, z !== null && (z = Date.now()), C();
  });
  const _ = p.createElement("div");
  _.className = "presenter-grid";
  function q(K, le) {
    const ue = p.createElement("section"), Le = p.createElement("h2"), Ne = p.createElement("div");
    return Le.textContent = K, Ne.dataset.control = le, ue.append(Le, Ne), _.append(ue), Ne;
  }
  const ee = q("Current slide", "presenter-current"), se = q("Next slide", "presenter-upcoming"), oe = p.createElement("h2"), L = p.createElement("div"), U = p.createElement("p");
  oe.textContent = "Speaker notes", L.className = "presenter-notes", L.dataset.control = "presenter-notes", U.className = "helper", U.textContent = "Keep this window on your screen. Present shows only the slides in the main window. Arrow keys navigate; Escape ends the presentation.", y.append(x, U, b, _, oe, L), m.addEventListener("keydown", (K) => {
    if (!(K.ctrlKey || K.altKey || K.metaKey || K.isComposing || K.key === " " && K.target?.tagName === "BUTTON" || !["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", "Escape"].includes(K.key))) {
      K.preventDefault();
      try {
        K.key === "Escape" ? Promise.resolve(d()).catch(v) : K.key === "Home" || K.key === "End" ? l(K.key === "Home" ? "first" : "last") : i(["ArrowLeft", "ArrowUp", "PageUp"].includes(K.key) ? -1 : 1);
      } catch (ue) {
        v(ue);
      }
    }
  });
  const G = window.setInterval(() => {
    m.closed ? window.clearInterval(G) : C();
  }, 250);
  function J() {
    window.clearInterval(G), m.closed || m.close(), window.removeEventListener("beforeunload", J);
  }
  return m.addEventListener("unload", () => {
    window.clearInterval(G), window.removeEventListener("beforeunload", J);
  }), window.addEventListener("beforeunload", J), C(), {
    get closed() {
      return m.closed;
    },
    focus() {
      m.focus();
    },
    close: J,
    update({ id: K, nextId: le, index: ue, total: Le, notes: Ne, presenting: ke }) {
      if (!m.closed) {
        if (g.textContent = "Slide " + (ue + 1) + " of " + Le, L.textContent = Ne || "No speaker notes for this slide.", ee.replaceChildren(n(K, p)), le) se.replaceChildren(n(le, p));
        else {
          const H = p.createElement("p");
          H.textContent = "End of presentation", se.replaceChildren(H);
        }
        E.disabled = ue === 0, A.disabled = ue === Le - 1, s.disabled = ke, F.disabled = !ke, ke && z === null ? z = Date.now() : !ke && z !== null && (T += Date.now() - z, z = null), C();
      }
    }
  };
}
async function Fr({ slideIds: n, renderSlide: i, title: l = "CList presentation" }) {
  const r = window.open("", "_blank");
  if (!r) throw new Error("Allow pop-up windows for CList to export slides as PDF.");
  const d = r.document;
  d.title = l, d.documentElement.lang = "en";
  const m = d.createElement("header");
  m.className = "slide-print-controls";
  const p = d.createElement("p");
  p.setAttribute("role", "status"), p.textContent = "Preparing slides…";
  const y = d.createElement("button");
  y.className = "btn", y.textContent = "Print / Save as PDF", y.title = "Open the print dialog to save this presentation as a PDF", y.disabled = !0, m.append(p, y);
  const x = d.createElement("main");
  x.className = "clist-slides slide-print-deck", d.body.replaceChildren(m, x);
  function h(g) {
    console.error("Slides PDF export failed:", g), p.className = "error-message", p.textContent = "Could not prepare PDF export: " + g.message;
  }
  y.addEventListener("click", () => {
    try {
      r.focus(), r.print();
    } catch (g) {
      h(g);
    }
  });
  try {
    const g = [];
    for (const b of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const v = b.cloneNode(!0);
      b.tagName === "LINK" && (v.href = b.href, g.push(new Promise((f, E) => {
        v.addEventListener("load", f, { once: !0 }), v.addEventListener("error", () => E(new Error("A presentation stylesheet could not load.")), { once: !0 });
      }))), d.head.append(v);
    }
    const S = d.createElement("style");
    S.textContent = `
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
    `, d.head.append(S);
    for (const b of n) {
      const v = d.createElement("section");
      v.className = "slide-print-page", v.append(i(b, d)), x.append(v);
    }
    if (await Promise.all(g), await d.fonts.ready, await Promise.all([...x.querySelectorAll("img")].map((b) => b.decode())), r.closed) return;
    p.textContent = "Choose Save as PDF in the print dialog. Use all pages, no margins, no headers or footers, and enable background graphics. Each slide is one landscape page; speaker notes are excluded.", y.disabled = !1;
  } catch (g) {
    throw h(g), g;
  }
}
let Xt;
function Do() {
  return window.PptxGenJS ? Promise.resolve(window.PptxGenJS) : (Xt || (Xt = new Promise((n, i) => {
    const l = document.createElement("script"), r = "../../../js/vendor/pptxgen.bundle.js";
    l.src = new URL(r, import.meta.url).href, l.onload = () => {
      window.PptxGenJS ? n(window.PptxGenJS) : (Xt = null, l.remove(), i(new Error("The PowerPoint export library did not initialize.")));
    }, l.onerror = () => {
      Xt = null, l.remove(), i(new Error("The PowerPoint export library could not load. Please retry."));
    }, document.head.append(l);
  })), Xt);
}
const Lt = (n) => n / 96, at = (n) => n * 0.75, Ot = (n) => n.replace("#", ""), Ro = { system: "Arial", arial: "Arial", verdana: "Verdana", georgia: "Georgia", times: "Times New Roman", courier: "Courier New" };
function Pr(n, i) {
  const l = [];
  function r(p, y = {}) {
    if (p.nodeType === 3) {
      p.textContent && l.push({ text: p.textContent, options: { ...y } });
      return;
    }
    const x = p.nodeName.toLowerCase(), h = { ...y };
    if (["strong", "b"].includes(x) && (h.bold = !0), ["em", "i"].includes(x) && (h.italic = !0), x === "u" && (h.underline = { style: "sng" }), ["s", "strike"].includes(x) && (h.strike = "sngStrike"), ["code", "pre"].includes(x) && (h.fontFace = "Courier New"), x === "a" && /^(https?:|mailto:|tel:)/i.test(p.getAttribute("href") || "") && (h.hyperlink = { url: p.getAttribute("href") }, h.color = "2365BF", h.underline = { style: "sng" }), p.hasAttribute?.("data-slide-text-style")) {
      const g = Rn({ fontFamily: p.getAttribute("data-font-family"), fontSize: p.getAttribute("data-font-size"), textColour: p.getAttribute("data-text-colour"), highlightColour: p.getAttribute("data-highlight-colour") });
      g.fontFamily && (h.fontFace = Ro[g.fontFamily]), g.fontSize && (h.fontSize = at(g.fontSize)), g.textColour && (h.color = Ot(g.textColour)), g.highlightColour && (h.highlight = Ot(g.highlightColour));
    }
    if (x === "br") {
      l.push({ text: "", options: { ...h, breakLine: !0 } });
      return;
    }
    for (const g of p.childNodes) r(g, h);
  }
  function d(p, y = null) {
    const x = p.nodeName.toLowerCase();
    if (x === "ul" || x === "ol") {
      let h = Number(p.getAttribute("start")) || 1;
      for (const g of p.children) d(g, { ordered: x === "ol", index: h++, level: (y?.level ?? -1) + 1 });
      return;
    }
    if (x === "li" || x === "blockquote" || x === "div")
      for (const h of p.childNodes)
        h.nodeType === 3 ? h.textContent.trim() && m(h, y) : d(h, y);
    else m(p, y);
  }
  function m(p, y) {
    const x = l.length, h = {};
    /^H[1-6]$/.test(p.nodeName) && (h.bold = !0), r(p, h), l.length === x && l.push({ text: "​", options: {} });
    for (const g of l.slice(x))
      g.options.paraSpaceAfter = y ? at(i * 0.2) : 6, y && (g.options.bullet = y.ordered ? { type: "number", startAt: y.index, indent: at(i * 1.5) } : { indent: at(i * 1.5) }, g.options.indentLevel = Math.min(8, y.level), g.options.hanging = at(i * 0.3));
    l[l.length - 1].options.breakLine = !0;
  }
  for (const p of n.childNodes) d(p);
  return l.length && delete l[l.length - 1].options.breakLine, l;
}
function Oo(n) {
  return {
    fill: n.fill ? { color: Ot(n.fillColour) } : { color: "FFFFFF", transparency: 100 },
    line: n.border ? { color: Ot(n.borderColour), width: at(n.width) } : { color: "FFFFFF", transparency: 100 }
  };
}
function Dr(n, i, l, r) {
  const d = i.definition;
  if (d.elements.length !== 1) return !1;
  const { tag: m, attributes: p } = d.elements[0], [y, x, h, g] = d.viewBox, S = m === "rect" && !p.rx && !p.ry && (p.x || 0) === y && (p.y || 0) === x && p.width === h && p.height === g, b = m === "ellipse" && p.cx === y + h / 2 && p.cy === x + g / 2 && p.rx === h / 2 && p.ry === g / 2 || m === "circle" && h === g && p.cx === y + h / 2 && p.cy === x + g / 2 && p.r === h / 2, v = m === "line" && p.x1 === y && p.y1 === x && p.x2 === y + h && p.y2 === x + g;
  if (!S && !b && !v) return !1;
  const f = i.style.border ? Math.min(i.style.width, i.width, i.height) : 0, E = Lt(f / 2), A = Oo({ ...i.style, width: f });
  return v && (A.fill.transparency = 100), n.addShape(S ? r.ShapeType.rect : b ? r.ShapeType.ellipse : r.ShapeType.line, {
    ...l,
    x: l.x + E,
    y: l.y + E,
    w: Math.max(1e-3, l.w - E * 2),
    h: Math.max(1e-3, l.h - E * 2),
    ...A
  }), !0;
}
async function Rr(n) {
  const i = new Image();
  i.src = n.source, await i.decode();
  const l = document.createElement("canvas"), r = Math.min(2, 4096 / Math.max(n.width, n.height));
  l.width = Math.max(1, Math.round(n.width * r)), l.height = Math.max(1, Math.round(n.height * r));
  const d = l.getContext("2d");
  if (!d) throw new Error("The browser could not prepare a presentation image.");
  d.scale(l.width / n.width, l.height / n.height);
  let m, p;
  if (n.crop?.fit === "cover")
    m = n.crop.width || Math.max(n.width, n.height * i.naturalWidth / i.naturalHeight), p = n.crop.height || m * i.naturalHeight / i.naturalWidth;
  else {
    const y = Math.min(n.width / i.naturalWidth, n.height / i.naturalHeight);
    m = i.naturalWidth * y, p = i.naturalHeight * y;
  }
  return d.drawImage(i, (n.width - m) * (n.crop?.x ?? 50) / 100, (n.height - p) * (n.crop?.y ?? 50) / 100, m, p), l.toDataURL("image/png");
}
async function Or(n, i) {
  const l = await Do(), r = new l();
  r.defineLayout({ name: "CLIST", width: Lt(1280), height: Lt(720) }), r.layout = "CLIST", r.title = n.title, r.subject = "CList presentation", r.author = "", r.company = "", r.lang = "en-CA";
  const d = /* @__PURE__ */ new Set();
  for (const m of n.slides) {
    const p = r.addSlide();
    p.background = { color: Ot(m.background) }, m.notes && p.addNotes(m.notes);
    for (const y of m.objects) {
      const x = { x: Lt(y.x), y: Lt(y.y), w: Lt(y.width), h: Lt(y.height), rotate: ((y.rotation || 0) % 360 + 360) % 360, objectName: y.id };
      if (y.kind === "text") {
        const h = y.format;
        p.addText(y.runs.length ? y.runs : "", {
          ...x,
          ...Oo(y.style),
          fontFace: Ro[h.family],
          fontSize: at(h.size),
          color: Ot(h.colour),
          align: h.align,
          valign: "top",
          margin: [at(5), at(8), at(5), at(8)],
          breakLine: !1,
          lineSpacingMultiple: 1.2,
          paraSpaceAfter: 6,
          wrap: !0,
          fit: "none"
        });
      } else y.kind === "shape" && Dr(p, y, x, r) || (y.kind === "shape" && d.add("Custom SVG shapes were exported as images."), p.addImage({ ...x, data: await Rr(y), altText: y.alt || y.definition?.label || "" }));
    }
  }
  return { pptx: r, warnings: [...d] };
}
async function Br(n) {
  const { pptx: i, warnings: l } = await Or(n), r = (n.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".pptx";
  return await i.writeFile({ fileName: r, compression: !0 }), l;
}
const Mo = "http://schemas.openxmlformats.org/presentationml/2006/main", Tn = "http://schemas.openxmlformats.org/officeDocument/2006/relationships", ne = (n, i) => [...n?.children || []].find((l) => l.localName === i), mt = (n, i) => [...n?.getElementsByTagNameNS("*", i) || []], me = (n, i) => mt(n, i)[0], ye = (n, i, l = 0) => n?.hasAttribute(i) ? Number(n.getAttribute(i)) : l, At = (n) => n === "1" || n === "true", vt = (n) => me(n, "ph"), qr = (n, i, l) => ({ x: l[0] * n + l[2] * i + l[4], y: l[1] * n + l[3] * i + l[5] }), In = (n, i) => [n[0] * i[0] + n[2] * i[1], n[1] * i[0] + n[3] * i[1], n[0] * i[2] + n[2] * i[3], n[1] * i[2] + n[3] * i[3], n[0] * i[4] + n[2] * i[5] + n[4], n[1] * i[4] + n[3] * i[5] + n[5]], Fn = [1, 0, 0, 1, 0, 0], Ye = (n) => n / 9525;
function pn(n, i) {
  if (!i || /[\\?#]/.test(i) || /^[a-z]+:/i.test(i)) throw new Error("The presentation contains an invalid internal relationship.");
  const l = i.startsWith("/") ? [] : n.split("/").slice(0, -1);
  for (const r of decodeURIComponent(i).split("/"))
    if (!(!r || r === "."))
      if (r === "..") {
        if (!l.length) throw new Error("A presentation relationship leaves the package.");
        l.pop();
      } else l.push(r);
  return l.join("/");
}
async function Hr(n, i = "Imported presentation.pptx") {
  if (!(n instanceof ArrayBuffer || n instanceof Uint8Array) || n.byteLength > 100 * 1024 * 1024) throw new Error("Choose a .pptx file smaller than 100 MB.");
  await Do();
  const l = await window.JSZip.loadAsync(n), r = Object.values(l.files);
  if (r.length > 1e4 || r.reduce((oe, L) => oe + (L._data?.uncompressedSize || 0), 0) > 300 * 1024 * 1024) throw new Error("This presentation is too large to import in the browser.");
  const d = /* @__PURE__ */ new Map(), m = /* @__PURE__ */ new Map(), p = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Set();
  let x = 0;
  const h = (oe) => y.add((x ? "Slide " + x + ": " : "") + oe);
  async function g(oe, L = !1) {
    if (d.has(oe)) return d.get(oe);
    const U = l.file(oe);
    if (!U) {
      if (L) throw new Error("The presentation is missing " + oe + ".");
      return null;
    }
    if (U._data?.uncompressedSize > 20 * 1024 * 1024) throw new Error("A presentation XML part is too large: " + oe);
    const G = await U.async("string");
    if (/<!DOCTYPE|<!ENTITY/i.test(G)) throw new Error("XML document declarations are not supported in PowerPoint imports.");
    const J = new DOMParser().parseFromString(G, "application/xml");
    if (J.getElementsByTagName("parsererror").length) throw new Error("The presentation contains invalid XML: " + oe);
    return d.set(oe, J), J;
  }
  async function S(oe) {
    if (m.has(oe)) return m.get(oe);
    const L = oe.split("/"), U = L.pop(), G = await g([...L, "_rels", U + ".rels"].join("/")), J = new Map(mt(G, "Relationship").map((K) => [K.getAttribute("Id"), {
      type: K.getAttribute("Type").split("/").pop(),
      external: K.getAttribute("TargetMode") === "External",
      target: K.getAttribute("Target")
    }]));
    return m.set(oe, J), J;
  }
  async function b(oe, L) {
    const U = [...(await S(oe)).values()].find((J) => J.type === L && !J.external), G = U && pn(oe, U.target);
    return G ? { path: G, doc: await g(G, !0) } : null;
  }
  const f = [...(await S("")).values()].find((oe) => oe.type === "officeDocument" && !oe.external), E = f ? pn("", f.target) : "ppt/presentation.xml", A = await g(E, !0);
  if (A.documentElement.namespaceURI !== Mo) throw new Error("This PowerPoint XML format is not supported. Save it as a standard .pptx file first.");
  const s = me(A, "sldSz"), F = Ye(ye(s, "cx")), T = Ye(ye(s, "cy"));
  if (!(F > 0 && T > 0)) throw new Error("The presentation has invalid slide dimensions.");
  const z = Math.min(1280 / F, 720 / T), C = (1280 - F * z) / 2, _ = (720 - T * z) / 2;
  Math.abs(F / T - 16 / 9) > 0.01 && h("Slides were fitted and centred on CList’s 16:9 canvas.");
  const q = [...ne(A.documentElement, "sldIdLst")?.children || []];
  if (!q.length || q.length > 500) throw new Error("Import supports presentations containing 1–500 slides.");
  me(A, "custShowLst") && h("Custom slide shows were not imported.");
  const ee = [], se = await S(E);
  for (const oe of q) {
    let Ne = function(j, V = "#000000") {
      if (!j) return V;
      const W = j.localName === "srgbClr" || j.localName === "schemeClr" || j.localName === "sysClr" ? j : [...j.children || []].find((Y) => ["srgbClr", "schemeClr", "sysClr", "prstClr"].includes(Y.localName));
      if (!W)
        return h("An unsupported colour was replaced."), V;
      let te = W.localName === "schemeClr" ? ue[Le[W.getAttribute("val")] || W.getAttribute("val")] : W.localName === "sysClr" ? W.getAttribute("lastClr") : W.getAttribute("val");
      if (!/^[a-f0-9]{6}$/i.test(te || ""))
        return h("An unsupported colour was replaced."), V;
      let Q = [0, 2, 4].map((Y) => parseInt(te.slice(Y, Y + 2), 16));
      for (const Y of W.children) {
        const I = ye(Y, "val") / 1e5;
        Y.localName === "tint" ? Q = Q.map((B) => B + (255 - B) * I) : ["shade", "lumMod"].includes(Y.localName) ? Q = Q.map((B) => B * I) : Y.localName === "lumOff" ? Q = Q.map((B) => B + 255 * I) : Y.localName === "alpha" && I !== 1 && I !== 0 ? h("Transparency was simplified; image transparency is preserved.") : ["alpha"].includes(Y.localName) || h("Some theme colour adjustments were simplified.");
      }
      return "#" + Q.map((Y) => Math.round(Math.max(0, Math.min(255, Y))).toString(16).padStart(2, "0")).join("");
    }, ke = function(j, V) {
      const W = vt(j);
      if (!W || !V) return null;
      const te = mt(V, "sp").filter((Q) => vt(Q));
      return te.find((Q) => (vt(Q).getAttribute("idx") || "0") === (W.getAttribute("idx") || "0")) || te.find((Q) => (vt(Q).getAttribute("type") || "obj") === (W.getAttribute("type") || "obj"));
    }, H = function(j) {
      const V = ke(j, J?.doc);
      return [j, V, ke(V || j, K?.doc)].filter(Boolean);
    }, Ce = function(j) {
      const V = j.map((pe) => ne(pe, "spPr")).filter(Boolean), W = V.map((pe) => [...pe.children].find((fe) => ["solidFill", "noFill", "gradFill", "pattFill", "blipFill", "grpFill"].includes(fe.localName))).find(Boolean);
      W && !["solidFill", "noFill"].includes(W.localName) && h("A non-solid shape fill was simplified.");
      const te = j.map((pe) => me(ne(pe, "style"), "fillRef")).find(Boolean), Q = V.map((pe) => ne(pe, "ln")).find(Boolean), Y = j.map((pe) => me(ne(pe, "style"), "lnRef")).find(Boolean), I = Ne(W?.localName === "solidFill" ? W : te, "#51b158"), B = Ne(ne(Q, "solidFill") || Y, "#000000"), Ae = Ye(ye(Q, "w", 12700)) * z;
      return ne(Q, "prstDash")?.getAttribute("val") && ne(Q, "prstDash").getAttribute("val") !== "solid" && h("Dashed shape borders were imported as solid lines."), (ne(Q, "headEnd")?.getAttribute("type") !== void 0 && ne(Q, "headEnd").getAttribute("type") !== "none" || ne(Q, "tailEnd")?.getAttribute("type") !== void 0 && ne(Q, "tailEnd").getAttribute("type") !== "none") && h("Line arrowheads were not imported."), {
        fillEnabled: W ? W.localName !== "noFill" && !mt(W, "alpha").some((pe) => ye(pe, "val") === 0) : !!te && ye(te, "idx") !== 0,
        fillColour: I,
        borderEnabled: Q ? !ne(Q, "noFill") && !mt(Q, "alpha").some((pe) => ye(pe, "val") === 0) : !!Y && ye(Y, "idx") !== 0,
        borderColour: B,
        borderWidth: Math.max(1, Math.min(20, Ae))
      };
    }, ot = function(j, V, W = [j]) {
      const te = W.map((de) => ne(ne(de, "spPr"), "xfrm")).find(Boolean);
      if (!te)
        return h("An object without a usable position was skipped."), null;
      const Q = ne(te, "off"), Y = ne(te, "ext"), I = Ye(ye(Q, "x")), B = Ye(ye(Q, "y")), Ae = Ye(ye(Y, "cx")), pe = Ye(ye(Y, "cy"));
      if (![I, B, Ae, pe].every(Number.isFinite) || Ae < 0 || pe < 0) throw new Error("Slide " + x + " contains an invalid object position.");
      const fe = ye(te, "rot") / 6e4 * Math.PI / 180, je = [Math.cos(fe), Math.sin(fe), -Math.sin(fe), Math.cos(fe), 0, 0], ve = In(V, je), Pe = qr(I + Ae / 2, B + pe / 2, V), ie = Math.max(1, Ae * Math.hypot(ve[0], ve[1]) * z), re = Math.max(1, pe * Math.hypot(ve[2], ve[3]) * z);
      return Math.abs(ve[0] * ve[2] + ve[1] * ve[3]) > 1e-3 && h("A rotated object in a stretched group was approximated."), {
        x: Pe.x * z + C - ie / 2,
        y: Pe.y * z + _ - re / 2,
        width: ie,
        height: re,
        rotation: Math.atan2(ve[1], ve[0]) * 180 / Math.PI,
        flipH: At(te.getAttribute("flipH")) !== V[0] * V[3] - V[1] * V[2] < 0,
        flipV: At(te.getAttribute("flipV"))
      };
    }, Z = function(j, V, W, te) {
      const Q = ne(j, "txBody");
      if (!Q) return null;
      const Y = vt(j)?.getAttribute("type") || "body", I = me(K?.doc, "txStyles"), B = ne(I, ["title", "ctrTitle"].includes(Y) ? "titleStyle" : ["body", "obj"].includes(Y) ? "bodyStyle" : "otherStyle"), Ae = (re) => me(me(le?.doc, re === "major" ? "majorFont" : "minorFont"), "latin")?.getAttribute("typeface") || "Arial";
      let pe = null;
      const fe = { arial: "arial", "arial narrow": "arial", calibri: "system", aptos: "system", "aptos display": "system", "times new roman": "times", verdana: "verdana", georgia: "georgia", "courier new": "courier" }, je = [], ve = ne(Q, "bodyPr");
      ve?.getAttribute("vert") && ve.getAttribute("vert") !== "horz" && h("Vertical text was imported horizontally."), ve?.getAttribute("anchor") && ve.getAttribute("anchor") !== "t" && h("Vertically aligned text was moved to the top of its text box."), (W.flipH || W.flipV) && h("Mirrored text was imported without mirroring."), ["lIns", "rIns", "tIns", "bIns"].some((re, de) => ve?.hasAttribute(re) && Math.abs(Ye(ye(ve, re)) * z - (de < 2 ? 8 : 5)) > 1) && h("Text box padding was replaced with CList’s standard padding.");
      for (const re of [...Q.children].filter((de) => de.localName === "p")) {
        const de = ne(re, "pPr"), Me = Math.max(0, Math.min(8, ye(de, "lvl"))), qe = V.map((Ie) => ne(me(Ie, "lstStyle"), "lvl" + (Me + 1) + "pPr")).filter(Boolean), D = [ne(de, "defRPr"), ...qe.map((Ie) => ne(Ie, "defRPr")), ne(ne(B, "lvl" + (Me + 1) + "pPr"), "defRPr")].filter(Boolean), rt = [de, ...qe, ne(B, "lvl" + (Me + 1) + "pPr")].filter(Boolean), R = rt.map((Ie) => Ie.getAttribute("algn")).find(Boolean) || "l", gt = { l: "left", ctr: "center", r: "right", just: "justify" }[R] || "left";
        ["l", "ctr", "r", "just"].includes(R) || h("An unsupported paragraph alignment was replaced with left alignment."), de && (ye(de, "marL") || ye(de, "marR") || ye(de, "indent") || ne(de, "tabLst") || ne(de, "spcBef") || ne(de, "lnSpc") || ne(de, "spcAft")) && h("Paragraph spacing, indents or tab stops were replaced with CList’s standard text layout.");
        const $e = [];
        for (const Ie of re.children) {
          if (Ie.localName === "br") {
            $e.push({ type: "hardBreak" });
            continue;
          }
          if (!["r", "fld"].includes(Ie.localName)) continue;
          Ie.localName === "fld" && h("Dynamic text fields were converted to plain text.");
          const st = ne(Ie, "t")?.textContent || "";
          if (!st) continue;
          const Ke = [ne(Ie, "rPr"), ...D].filter(Boolean), Ge = (X, kt) => Ke.find((Bt) => Bt.hasAttribute(X))?.getAttribute(X) ?? kt;
          let Je = Ke.map((X) => ne(X, "latin")?.getAttribute("typeface")).find(Boolean) || "+mn-lt";
          /^\+mj/.test(Je) && (Je = Ae("major")), /^\+mn/.test(Je) && (Je = Ae("minor"));
          const ft = fe[Je.toLowerCase()] || "arial";
          (!fe[Je.toLowerCase()] || ft === "system") && h("Font “" + Je + "” was replaced with a CList font.");
          const it = Number(Ge("sz", 2400)) / 100 / 0.75 * z;
          if (!Number.isFinite(it) || it <= 0) throw new Error("Slide " + x + " has an invalid text size.");
          const lt = { fontSize: Math.max(8, Math.min(200, it)), fontFamily: ft, textColour: Ne(Ke.map((X) => ne(X, "solidFill")).find(Boolean), "#000000"), textAlign: gt };
          pe ? JSON.stringify(pe) !== JSON.stringify(lt) && h("Mixed font sizes, fonts, colours or alignment within a text box were simplified to its first text style.") : pe = lt, (it < 8 || it > 200) && h("A text size was adjusted to CList’s 8–200 pixel range.");
          const et = [];
          At(Ge("b", "0")) && et.push({ type: "bold" }), At(Ge("i", "0")) && et.push({ type: "italic" }), Ge("u", "none") !== "none" && et.push({ type: "underline" }), Ge("strike", "noStrike") !== "noStrike" && et.push({ type: "strike" }), Number(Ge("baseline", 0)) && h("Superscript or subscript text was imported on the baseline.");
          const jt = Ke.map((X) => ne(X, "hlinkClick")).find(Boolean);
          if (jt) {
            const X = te.get(jt.getAttributeNS(Tn, "id"));
            X?.external && /^(https?:|mailto:|tel:)/i.test(X.target) ? et.push({ type: "link", attrs: { href: X.target } }) : h("An internal or unsupported hyperlink was removed.");
          }
          $e.push({ type: "text", text: st, marks: et });
        }
        const _e = rt.map((Ie) => [...Ie.children].find((st) => ["buNone", "buChar", "buAutoNum", "buBlip"].includes(st.localName))).find(Boolean);
        _e?.localName === "buBlip" && h("Picture bullets were replaced with standard bullets."), _e?.localName === "buAutoNum" && _e.getAttribute("type") !== "arabicPeriod" && h("A numbering style was replaced with decimal numbering."), je.push({ type: "paragraph", content: $e, list: _e && _e.localName !== "buNone" ? { type: _e.localName === "buAutoNum" ? "orderedList" : "bulletList", level: Me, start: ye(_e, "startAt", 1) } : null });
      }
      const Pe = [], ie = [];
      for (const re of je) {
        const { list: de, ...Me } = re;
        if (!de) {
          ie.length = 0, Pe.push(Me);
          continue;
        }
        const qe = Math.min(de.level, ie.length);
        if (ie.length = Math.min(ie.length, qe + 1), !ie[qe] || ie[qe].type !== de.type) {
          const D = { type: de.type, ...de.type === "orderedList" ? { attrs: { start: de.start } } : {}, content: [] };
          qe && ie[qe - 1]?.content.length ? ie[qe - 1].content.at(-1).content.push(D) : Pe.push(D), ie[qe] = D;
        }
        ie[qe].content.push({ type: "listItem", content: [Me] });
      }
      return { kind: "text", ...pe || { fontSize: 32, fontFamily: "arial", textColour: "#000000", textAlign: "left" }, text: Pe };
    }, ge = function(j, V) {
      const W = V.map((I) => ne(I, "spPr")).find((I) => ne(I, "prstGeom") || ne(I, "custGeom")) || ne(j, "spPr"), te = ne(W, "prstGeom"), Q = te?.getAttribute("prst") || (j.localName === "cxnSp" ? "line" : "rect");
      if (ne(W, "custGeom"))
        return h("A custom vector shape was skipped."), null;
      me(te, "gd") && h("Custom adjustments to a preset shape were simplified.");
      const Y = {
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
      return Y[Q] ? { id: "pptx-" + Q.toLowerCase(), label: Q, width: 100, height: 100, defaults: {}, viewBox: [0, 0, 1e3, 1e3], elements: [Y[Q]] } : (h("Unsupported shape “" + Q + "” was skipped; any text was retained."), null);
    };
    x++;
    const L = se.get(oe.getAttributeNS(Tn, "id"));
    if (!L || L.external || L.type !== "slide") throw new Error("Slide " + x + " has no valid slide relationship.");
    const U = pn(E, L.target), G = await g(U, !0), J = await b(U, "slideLayout"), K = J && await b(J.path, "slideMaster"), le = K && await b(K.path, "theme"), ue = { dk1: "000000", lt1: "FFFFFF", dk2: "1F497D", lt2: "EEECE1", accent1: "4F81BD", accent2: "C0504D", hlink: "0000FF", folHlink: "800080" };
    for (const j of me(le?.doc, "clrScheme")?.children || []) ue[j.localName] = j.firstElementChild?.getAttribute("lastClr") || j.firstElementChild?.getAttribute("val") || ue[j.localName];
    const Le = { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" };
    for (const j of [me(K?.doc, "clrMap"), me(J?.doc, "overrideClrMapping"), me(G, "overrideClrMapping")]) for (const V of j?.attributes || []) Le[V.name] = V.value;
    async function We(j, V, W) {
      const te = ne(j, "blip"), Q = (await S(V)).get(te?.getAttributeNS(Tn, "embed"));
      if (!Q || Q.external || Q.type !== "image")
        return h("A linked or missing picture was skipped; no external images were fetched."), null;
      const Y = pn(V, Q.target), I = Y.split(".").pop().toLowerCase(), B = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" }[I];
      if (!B)
        return h("A picture in unsupported format ." + I + " was skipped."), null;
      if (!p.has(Y)) {
        const re = l.file(Y);
        if (!re) throw new Error("A presentation picture is missing: " + Y);
        p.set(Y, "data:" + B + ";base64," + await re.async("base64"));
      }
      let Ae = p.get(Y);
      const pe = new Image();
      await new Promise((re, de) => {
        pe.onload = re, pe.onerror = () => de(new Error("Slide " + x + " contains an image the browser could not read.")), pe.src = Ae;
      });
      const fe = ne(j, "srcRect"), je = ye(fe, "l") / 1e5, ve = ye(fe, "t") / 1e5, Pe = ye(fe, "r") / 1e5, ie = ye(fe, "b") / 1e5;
      if (je + Pe >= 1 || ve + ie >= 1 || ![je, ve, Pe, ie].every(Number.isFinite)) throw new Error("Slide " + x + " contains invalid image cropping.");
      if (je || ve || Pe || ie || W.flipH || W.flipV || Math.abs(pe.naturalWidth / pe.naturalHeight - W.width / W.height) > 1e-3) {
        const re = document.createElement("canvas"), de = Math.min(2, 4096 / Math.max(W.width, W.height));
        re.width = Math.max(1, Math.round(W.width * de)), re.height = Math.max(1, Math.round(W.height * de));
        const Me = re.getContext("2d");
        if (!Me) throw new Error("The browser could not prepare an imported image.");
        Me.translate(W.flipH ? re.width : 0, W.flipV ? re.height : 0), Me.scale(W.flipH ? -1 : 1, W.flipV ? -1 : 1), Me.drawImage(pe, je * pe.naturalWidth, ve * pe.naturalHeight, (1 - je - Pe) * pe.naturalWidth, (1 - ve - ie) * pe.naturalHeight, 0, 0, re.width, re.height), Ae = re.toDataURL("image/png");
      }
      return te?.children.length && h("Picture effects and SVG-specific extensions were not imported; the embedded raster picture was used."), (ne(j, "tile") || [...me(j, "fillRect")?.attributes || []].some((re) => Number(re.value))) && h("Picture tiling or fill offsets were simplified."), { kind: "image", source: Ae, alt: "", imageFit: "contain", imageRatio: W.width / W.height, keepAspectRatio: !0, aspectRatio: W.width / W.height };
    }
    const Ee = { background: "#ffffff", notes: "", objects: [] };
    async function Be(j, V, W = Fn, te = !1) {
      if (!j) return;
      const Q = await S(V);
      for (const Y of j?.children || []) {
        if (["nvGrpSpPr", "grpSpPr", "extLst"].includes(Y.localName)) continue;
        if (Y.namespaceURI !== Mo) {
          h("An extension object was skipped.");
          continue;
        }
        if (Y.localName === "grpSp") {
          const ie = ne(ne(Y, "grpSpPr"), "xfrm"), re = ne(ie, "off"), de = ne(ie, "ext"), Me = ne(ie, "chOff"), qe = ne(ie, "chExt"), D = ye(de, "cx") / ye(qe, "cx"), rt = ye(de, "cy") / ye(qe, "cy");
          if (!Number.isFinite(D) || !Number.isFinite(rt)) {
            h("A group with invalid dimensions was skipped.");
            continue;
          }
          const R = Ye(ye(re, "x")), gt = Ye(ye(re, "y")), $e = Ye(ye(de, "cx")), _e = Ye(ye(de, "cy")), Ie = R + $e / 2, st = gt + _e / 2, Ke = ye(ie, "rot") / 6e4 * Math.PI / 180, Ge = Math.cos(Ke), Je = Math.sin(Ke), ft = At(ie.getAttribute("flipH")) ? -1 : 1, it = At(ie.getAttribute("flipV")) ? -1 : 1, lt = In([Ge * ft, Je * ft, -Je * it, Ge * it, Ie, st], [D, 0, 0, rt, R - Ie - Ye(ye(Me, "x")) * D, gt - st - Ye(ye(Me, "y")) * rt]);
          h("Grouped objects were imported as individual editable objects."), await Be(Y, V, In(W, lt), te);
          continue;
        }
        if (!["sp", "pic", "cxnSp"].includes(Y.localName)) {
          h((Y.localName === "graphicFrame" ? "A chart, table or SmartArt object" : "Unsupported object “" + Y.localName + "”") + " was skipped.");
          continue;
        }
        if (Y.localName === "cxnSp" && (me(Y, "stCxn") || me(Y, "endCxn")) && h("An attached connector was imported as an ordinary line."), te && vt(Y)) {
          ["ftr", "hdr", "dt", "sldNum"].includes(vt(Y).getAttribute("type")) && mt(Y, "t").some((ie) => ie.textContent.trim()) && h("Template footer, header, date or slide-number placeholders were not imported.");
          continue;
        }
        if (At(me(Y, "cNvPr")?.getAttribute("hidden"))) {
          h("A hidden object was skipped.");
          continue;
        }
        const I = te ? [Y] : H(Y), B = ot(Y, W, I);
        if (!B) continue;
        const { flipH: Ae, flipV: pe, ...fe } = B, je = Ce(I);
        if ((me(Y, "effectLst")?.children.length || me(Y, "effectDag") || me(Y, "scene3d") || me(Y, "sp3d")) && h("Shadows, 3D or other visual effects were not imported."), Y.localName === "pic") {
          const ie = await We(ne(Y, "blipFill"), V, B);
          if (ie) {
            ie.alt = me(Y, "cNvPr")?.getAttribute("descr") || me(Y, "cNvPr")?.getAttribute("name") || "";
            const re = me(ne(Y, "spPr"), "prstGeom")?.getAttribute("prst");
            re && re !== "rect" && h("A picture shape mask was replaced with a rectangular image."), Ee.objects.push({ ...fe, ...ie });
          }
          continue;
        }
        const ve = Z(Y, I, B, Q), Pe = ge(Y, I);
        if (Pe && (je.fillEnabled || je.borderEnabled)) {
          if ((Ae || pe) && !["rect", "ellipse", "roundRect"].includes(Pe.label)) {
            const [ie] = Pe.elements;
            ie.tag === "line" ? (Ae && ([ie.attributes.x1, ie.attributes.x2] = [ie.attributes.x2, ie.attributes.x1]), pe && ([ie.attributes.y1, ie.attributes.y2] = [ie.attributes.y2, ie.attributes.y1])) : ie.tag === "polygon" && (ie.attributes.points = ie.attributes.points.split(" ").map((re) => {
              const [de, Me] = re.split(",").map(Number);
              return (Ae ? 1e3 - de : de) + "," + (pe ? 1e3 - Me : Me);
            }).join(" "));
          }
          Ee.objects.push({ ...fe, ...je, kind: "shape", shapeDefinition: Pe, shapeType: Pe.id });
        }
        ve && Ee.objects.push({ ...fe, ...ve, fillEnabled: !1, borderEnabled: !1 });
      }
    }
    const Te = [me(G, "bg"), me(J?.doc, "bg"), me(K?.doc, "bg")].find(Boolean);
    if (Te) {
      const j = ne(Te, "bgPr"), V = ne(j, "solidFill") || ne(Te, "bgRef");
      if (V) Ee.background = Ne(V, "#ffffff");
      else if (ne(j, "blipFill")) {
        const W = me(G, "bg") ? U : me(J?.doc, "bg") ? J.path : K.path, te = { x: C, y: _, width: F * z, height: T * z }, Q = await We(ne(j, "blipFill"), W, te);
        Q && Ee.objects.push({ ...te, ...Q });
      } else ne(j, "noFill") || h("An unsupported slide background was replaced with white.");
    }
    G.documentElement.getAttribute("showMasterSp") !== "0" && J?.doc.documentElement.getAttribute("showMasterSp") !== "0" && await Be(me(K?.doc, "spTree"), K?.path, Fn, !0), await Be(me(J?.doc, "spTree"), J?.path, Fn, !0), await Be(me(G, "spTree"), U);
    const Xe = await b(U, "notesSlide");
    Xe && (Ee.notes = mt(Xe.doc, "sp").filter((j) => !["sldImg", "sldNum", "hdr", "ftr", "dt"].includes(vt(j)?.getAttribute("type"))).map((j) => mt(ne(j, "txBody"), "p").map((V) => mt(V, "t").map((W) => W.textContent).join("")).join(`
`)).filter(Boolean).join(`
`)), Xe && (me(Xe.doc, "pic") || me(Xe.doc, "graphicFrame")) && h("Images or other non-text content in speaker notes were not imported."), (me(G, "timing") || me(G, "transition")) && h("Animations and slide transitions were not imported."), G.documentElement.getAttribute("show") === "0" && h("This hidden slide was imported as a visible slide.");
    const pt = await S(U);
    for (const j of pt.values()) ["chart", "diagramData", "oleObject", "audio", "video", "media", "comments", "comment"].includes(j.type) && h("Charts, SmartArt, embedded files, media or comments are not supported.");
    if (Ee.objects.length > 5e3 || ee.reduce((j, V) => j + V.objects.length, 0) + Ee.objects.length > 2e4) throw new Error("This presentation contains too many objects to import in the browser.");
    ee.push(Ee);
  }
  return { title: i.replace(/\.pptx$/i, ""), slides: ee, warnings: [...y] };
}
function Ur({ getDocument: n, encode: i, getName: l, onError: r = () => {
}, createWorker: d = () => new Worker(new URL(
  /* @vite-ignore */
  "" + new URL("assets/recovery-worker-Dt1l0aQJ.js", import.meta.url).href,
  import.meta.url
), { type: "module" }) }) {
  let m = null, p = null, y = 0, x = !1;
  const h = /* @__PURE__ */ new Map();
  function g(v) {
    const f = !h.size && !x;
    m?.terminate(), m = null, p = null;
    for (const E of h.values()) E.reject(v);
    h.clear(), f && r(v);
  }
  function S(v) {
    if (!(!m || p !== n()) && v instanceof Uint8Array)
      try {
        m.postMessage({ type: "update", update: v });
      } catch (f) {
        g(f);
      }
  }
  function b() {
    return new Promise((v, f) => {
      try {
        if (x) throw new Error("The recovery snapshot worker is closed.");
        m || (m = d(), m.onmessage = ({ data: s }) => {
          if (s.error) {
            g(new Error(s.error));
            return;
          }
          const F = h.get(s.id);
          F && (h.delete(s.id), F.resolve(s.content));
        }, m.onerror = () => g(new Error("The background recovery worker could not run. Reload CList and use Save to protect your presentation.")), m.onmessageerror = () => g(new Error("The background recovery snapshot could not be read.")));
        const E = n();
        p !== E && (m.postMessage({ type: "reset", update: i(E) }), p = E);
        const A = ++y;
        h.set(A, { resolve: v, reject: f }), m.postMessage({ type: "snapshot", id: A, name: l() });
      } catch (E) {
        g(E), f(E);
      }
    });
  }
  return { changed: S, snapshot: b, destroy() {
    x = !0, g(new Error("The slide editor closed before recovery finished."));
  } };
}
function Wr(n, i, l) {
  const r = [...n], d = new Set(i), m = l < 0 ? r.map((p, y) => y) : r.map((p, y) => y).reverse();
  for (const p of m) {
    const y = p + l;
    y >= 0 && y < r.length && d.has(r[p]) && !d.has(r[y]) && ([r[p], r[y]] = [r[y], r[p]]);
  }
  return r;
}
function Xr(n, i, l) {
  const r = new Set(i);
  if (l && (!n.includes(l) || r.has(l))) return [...n];
  const d = n.filter((p) => r.has(p)), m = n.filter((p) => !r.has(p));
  return m.splice(l ? m.indexOf(l) : m.length, 0, ...d), m;
}
function $r(n, i, l, { matchCase: r = !1, wholeWord: d = !1 } = {}) {
  if (!l) return [];
  const m = l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), p = new RegExp(d ? "(?<![\\p{L}\\p{N}_])" + m + "(?![\\p{L}\\p{N}_])" : m, r ? "gu" : "giu"), y = [];
  for (const [x, h] of i.entries()) {
    let g = function(b, v) {
      if (b instanceof n.XmlText) {
        const E = b.toDelta().map((A) => typeof A.insert == "string" ? A.insert : "￼").join("");
        p.lastIndex = 0;
        for (const A of E.matchAll(p)) y.push({
          entry: h,
          order: x,
          text: b,
          start: A.index,
          length: A[0].length,
          from: v + A.index,
          to: v + A.index + A[0].length,
          snippet: E.slice(Math.max(0, A.index - 25), A.index + A[0].length + 40).replace(/\s+/g, " ")
        });
        return b.length;
      }
      if (["hardBreak", "horizontalRule"].includes(b.nodeName)) return 1;
      let f = 1;
      for (const E of b.toArray()) f += g(E, v + f);
      return f + 1;
    }, S = 0;
    for (const b of h.fragment.toArray()) S += g(b, S);
  }
  return y;
}
function No(n, i) {
  const l = /* @__PURE__ */ new Map();
  for (const r of n)
    l.has(r.text) || l.set(r.text, []), l.get(r.text).push(r);
  for (const [r, d] of l)
    for (const m of d.sort((p, y) => y.start - p.start)) {
      let p = 0, y = {};
      for (const x of r.toDelta()) {
        const h = typeof x.insert == "string" ? x.insert.length : 1;
        if (m.start < p + h) {
          y = x.attributes || {};
          break;
        }
        p += h;
      }
      r.delete(m.start, m.length), i && r.insert(m.start, i, y);
    }
}
function Vr({ root: n, Y: i, getDocument: l, getEntries: r, jump: d, transact: m, canEdit: p, selectedText: y, report: x, onError: h }) {
  const g = n.ownerDocument, S = n.querySelector(".slide-menu-right") || n.querySelector(".tools"), b = n.querySelectorAll(".slide-menu-bar")[1] || n.querySelector(".tools"), v = g.createElement("button");
  v.className = "clist-action-btn btn-small", v.type = "button", v.dataset.control = "open-find", v.title = "Find and replace across slides (Ctrl/Cmd+F)", v.setAttribute("aria-label", v.title);
  const f = g.createElement("span");
  f.className = "material-icons md-18 md-light", f.textContent = "search", v.append(f), S.append(v);
  const E = g.createElement("div");
  E.className = "slide-search-panel", E.dataset.panel = "find", E.setAttribute("role", "search"), E.setAttribute("aria-label", "Find and replace slide text"), E.hidden = !0, E.open = !1;
  const A = g.createElement("div");
  A.className = "slide-search-content", E.append(A), b.append(E);
  function s(j) {
    E.open = j, E.hidden = !j, b.dataset.searchOpen = String(j), v.setAttribute("aria-expanded", String(j)), j || (clearTimeout(J), J = null);
  }
  function F(j, V, W) {
    const te = g.createElement("label"), Q = g.createElement("input");
    return Q.type = V, Q.dataset.control = W, Q.setAttribute("aria-label", j), V !== "checkbox" ? (Q.maxLength = 512, Q.autocomplete = "off", Q.placeholder = j, te.append(Q)) : te.append(g.createTextNode(j), Q), A.append(te), Q;
  }
  const T = F("Find in slide text", "search", "find-query"), z = F("Replace with", "text", "find-replacement"), C = F("Match case", "checkbox", "find-case"), _ = F("Whole words", "checkbox", "find-word"), q = g.createElement("div");
  q.className = "slide-search-actions", A.append(q);
  const ee = g.createElement("p");
  ee.className = "helper slide-search-feedback", ee.setAttribute("role", "status"), A.append(ee);
  const se = g.createElement("div");
  se.className = "object-list", se.dataset.control = "find-results", se.setAttribute("aria-label", "Matching slide text"), A.append(se);
  const oe = g.createElement("p");
  oe.className = "helper", oe.hidden = !0, oe.textContent = "Searches text boxes on all slides. Locked boxes can be found but are not replaced. Enter/F3 finds next; Shift+F3 finds previous.", A.append(oe);
  let L = [], U = -1, G = null, J = null, K = !1;
  function le(j) {
    return () => {
      if (!K)
        try {
          j();
        } catch (V) {
          h(V);
        }
    };
  }
  function ue(j, V, W) {
    const te = g.createElement("button");
    return te.type = "button", te.className = "btn btn-small", te.textContent = j, te.title = j, te.dataset.control = V, te.addEventListener("click", le(W)), q.append(te), te;
  }
  function Le(j) {
    G = j ? i.createRelativePositionFromTypeIndex(j.text, j.start) : null;
  }
  function Ne() {
    ee.textContent = T.value ? L.length ? (U >= 0 ? U + 1 + " of " : "") + L.length + " matches" + (U >= 0 ? " · Slide " + L[U].entry.slideNumber : "") : "No matches." : "Enter text to search.", Z.disabled = ge.disabled = !L.length || !p(), Ee.disabled = U < 0 || !L[U] || L[U].entry.locked || !p(), Be.disabled = !L.some((j) => !j.entry.locked) || !p(), se.replaceChildren(), se.hidden = !L.length;
    for (const [j, V] of L.slice(0, 100).entries()) {
      const W = g.createElement("button");
      W.type = "button", W.className = "btn btn-small", W.textContent = "Slide " + V.entry.slideNumber + (V.entry.locked ? " (locked)" : "") + ": " + V.snippet, W.title = W.textContent, W.setAttribute("aria-pressed", String(j === U)), W.addEventListener("click", le(() => {
        ke();
        const te = L.findIndex((Q) => Q.text === V.text && Q.start === V.start);
        te >= 0 && H(te);
      })), se.append(W);
    }
    L.length > 100 && (ee.textContent += ". First 100 results shown; Next/Previous visit all matches.");
  }
  function ke(j = !1) {
    clearTimeout(J), J = null;
    const V = !j && G ? i.createAbsolutePositionFromRelativePosition(G, l()) : null;
    L = $r(i, r(), T.value, { matchCase: C.checked, wholeWord: _.checked }), U = V ? L.findIndex((W) => W.text === V.type && W.start === V.index) : -1, U < 0 && (G = null), Ne();
  }
  function H(j) {
    !p() || !L.length || (U = (j + L.length) % L.length, Le(L[U]), d(L[U]), s(!0), Ne());
  }
  function Ce(j) {
    ke(), H(U < 0 ? j > 0 ? 0 : L.length - 1 : U + j);
  }
  function ot() {
    if (ke(), !p() || U < 0 || L[U].entry.locked) return;
    const j = L[U], V = j.from + z.value.length;
    m([j], () => No([j], z.value)), ke(!0);
    const W = L.findIndex((te) => te.order > j.order || te.order === j.order && te.from >= V);
    L.length && H(W < 0 ? 0 : W), x("Replaced one match.");
  }
  function We() {
    if (ke(), !p()) return;
    const j = L.filter((W) => !W.entry.locked), V = L.length - j.length;
    j.length && (m(j, () => No(j, z.value)), ke(!0), x("Replaced " + j.length + " matches." + (V ? " Skipped " + V + " matches in locked text boxes." : "")));
  }
  const Z = ue("Previous", "find-previous", () => Ce(-1)), ge = ue("Next", "find-next", () => Ce(1)), Ee = ue("Replace", "find-replace", ot), Be = ue("Replace all", "find-replace-all", We);
  function Te(j = !1) {
    if (!p()) return;
    const V = y();
    V && V.length <= 512 && !V.includes(`
`) && (T.value = V), s(!0), ke(!0), E.scrollIntoView({ block: "nearest" }), (j ? z : T).focus(), (j ? z : T).select();
  }
  ue("Done", "find-done", () => {
    s(!1), v.focus();
  }).classList.add("btn-secondary"), v.addEventListener("click", le(() => Te())), T.addEventListener("input", le(() => {
    G = null, clearTimeout(J), J = setTimeout(le(() => ke(!0)), 150);
  }));
  for (const j of [C, _]) j.addEventListener("change", le(() => ke(!0)));
  function pt(j) {
    (j.ctrlKey || j.metaKey) && !j.altKey && ["f", "h"].includes(j.key.toLowerCase()) && p() ? (j.preventDefault(), j.stopImmediatePropagation(), le(() => Te(j.key.toLowerCase() === "h"))()) : j.key === "F3" && E.open && T.value && p() ? (j.preventDefault(), j.stopImmediatePropagation(), le(() => Ce(j.shiftKey ? -1 : 1))()) : E.contains(j.target) && (j.key === "Escape" ? (j.preventDefault(), j.stopImmediatePropagation(), s(!1), v.focus()) : j.key === "Enter" && [T, z].includes(j.target) && (j.preventDefault(), j.stopImmediatePropagation(), le(() => j.target === T ? Ce(j.shiftKey ? -1 : 1) : ot())()));
  }
  return n.addEventListener("keydown", pt, !0), s(!1), Ne(), {
    isOpen: () => E.open,
    changed() {
      !K && E.open && T.value && (clearTimeout(J), J = setTimeout(le(() => ke()), 150));
    },
    presenting(j) {
      v.disabled = j, j && s(!1);
    },
    destroy() {
      K = !0, s(!1), clearTimeout(J), n.removeEventListener("keydown", pt, !0), E.remove(), v.remove();
    }
  };
}
const Kr = `
:root { --highlight-color:#2e7d32; --highlight-hover:#1b5e20; --highlight-text-color:#fff; font-family:system-ui,sans-serif; }
* { box-sizing:border-box; margin:0; padding:0; }
body { background:#151b23; color:#fff; }
.stage { display:grid; justify-items:center; gap:16px; padding:16px; }
.slide { position:relative; width:min(100%,1280px); aspect-ratio:16/9; overflow:hidden; container-type:inline-size; color:#202b3d; background:#fff; font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
.slide[hidden] { display:none; }
.slide [data-font-size][data-slide-text-style] { font-size:calc(var(--slide-text-size)*var(--slide-text-unit,.078125cqw)) !important; }
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
function Gr() {
  const n = [...document.querySelectorAll(".stage > .slide")], i = document.querySelector('[data-action="previous"]'), l = document.querySelector('[data-action="next"]'), r = document.querySelector('[data-action="fullscreen"]'), d = document.querySelector("output"), m = document.querySelector(".viewer-status");
  let p = 0, y;
  function x(g) {
    p = Math.max(0, Math.min(n.length - 1, g)), n.forEach((S, b) => {
      S.hidden = b !== p;
    }), i.disabled = p === 0, l.disabled = p === n.length - 1, d.textContent = p + 1 + " / " + n.length, ["http:", "https:", "file:"].includes(location.protocol) && history.replaceState(null, "", location.href.split("#")[0] + "#slide-" + (p + 1));
  }
  function h() {
    const g = location.hash.match(/^#slide-(\d+)$/);
    return g ? Number(g[1]) - 1 : 0;
  }
  i.addEventListener("click", () => x(p - 1)), l.addEventListener("click", () => x(p + 1)), r.disabled = !document.documentElement.requestFullscreen, r.addEventListener("click", async () => {
    try {
      document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen();
    } catch (g) {
      console.error("Fullscreen failed:", g), m.textContent = "Full screen is unavailable. You can continue viewing in this window.", clearTimeout(y), y = setTimeout(() => {
        m.textContent = "";
      }, 3e3);
    }
  }), document.addEventListener("fullscreenchange", () => {
    r.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  }), window.addEventListener("hashchange", () => x(h())), document.addEventListener("keydown", (g) => {
    g.ctrlKey || g.metaKey || g.altKey || g.isComposing || g.target.closest?.('input,textarea,[contenteditable="true"]') || g.key === " " && g.target.closest?.("button") || ["ArrowRight", "ArrowDown", "PageDown", " ", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End"].includes(g.key) && (g.preventDefault(), g.key === "Home" ? x(0) : g.key === "End" ? x(n.length - 1) : x(p + (["ArrowRight", "ArrowDown", "PageDown", " "].includes(g.key) ? 1 : -1)));
  }), document.body.classList.add("interactive"), document.querySelector(".controls").hidden = !1, x(h());
}
async function Bo({ slideIds: n, renderSlide: i, title: l = "CList presentation" }) {
  if (!n.length) throw new Error("There are no slides to export.");
  const r = document.implementation.createHTMLDocument(l);
  r.documentElement.lang = "en";
  const d = r.createElement("meta");
  d.setAttribute("charset", "utf-8"), r.head.prepend(d);
  const m = r.createElement("meta");
  m.name = "viewport", m.content = "width=device-width, initial-scale=1", r.head.append(m);
  const p = r.createElement("style");
  p.textContent = Kr, r.head.append(p);
  const y = r.createElement("main");
  y.className = "stage", y.setAttribute("aria-label", l), r.body.append(y);
  for (const [b, v] of n.entries()) {
    const f = i(v, r);
    f.id = "slide-" + (b + 1), f.setAttribute("role", "group"), f.setAttribute("aria-label", "Slide " + (b + 1) + " of " + n.length), y.append(f);
  }
  const x = r.createElement("nav");
  x.className = "controls", x.hidden = !0, x.setAttribute("aria-label", "Slide navigation");
  for (const [b, v] of [["Previous", "previous"], ["Next", "next"], ["Full screen", "fullscreen"]]) {
    const f = r.createElement("button");
    f.type = "button", f.className = "btn", f.textContent = b, f.title = b, f.dataset.action = v, x.append(f);
  }
  const h = r.createElement("output");
  h.setAttribute("aria-live", "polite"), x.insertBefore(h, x.children[1]), r.body.append(x);
  const g = r.createElement("p");
  g.className = "viewer-status", g.setAttribute("role", "status"), r.body.append(g);
  const S = r.createElement("script");
  return S.textContent = "(" + Gr.toString() + ")();", r.body.append(S), await Promise.all([...y.querySelectorAll("img")].map((b) => new Promise((v, f) => {
    const E = b.getAttribute("src") || "";
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(E)) {
      f(new Error("A slide image is missing or is not embedded."));
      return;
    }
    const A = new Image();
    A.onload = v, A.onerror = () => f(new Error("A slide image could not be read.")), A.src = E;
  }))), `<!doctype html>
` + r.documentElement.outerHTML;
}
async function Jr(n) {
  const i = await Bo(n), l = (n.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/, "").slice(0, 120) || "CList presentation") + ".html", r = URL.createObjectURL(new Blob([i], { type: "text/html;charset=utf-8" })), d = document.createElement("a");
  d.href = r, d.download = l, document.body.append(d);
  try {
    d.click();
  } finally {
    d.remove(), setTimeout(() => URL.revokeObjectURL(r), 6e4);
  }
}
async function Yr({ slideIds: n, renderSlide: i }) {
  const l = document.implementation.createHTMLDocument(""), r = n.map((S) => i(S, l)), d = l.createElement("div"), m = /* @__PURE__ */ new Set(["p", "strong", "em", "s", "u", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "br"]);
  function p(S) {
    if (S.nodeType === 3) return l.createTextNode(S.textContent);
    const b = S.nodeName.toLowerCase();
    let v;
    /^h[1-6]$/.test(b) ? v = l.createElement("h3") : b === "a" && /^(https?:|mailto:|tel:)/i.test(S.getAttribute("href") || "") ? (v = l.createElement("a"), v.setAttribute("href", S.getAttribute("href"))) : m.has(b) ? v = l.createElement(b) : v = l.createDocumentFragment(), b === "ol" && /^\d+$/.test(S.getAttribute("start") || "") && v.setAttribute("start", S.getAttribute("start"));
    for (const f of S.childNodes) v.append(p(f));
    return v;
  }
  async function y(S) {
    return await new Promise((b, v) => {
      const f = new Image();
      f.onload = () => b(f), f.onerror = () => v(new Error("A slide image could not be read.")), f.src = S;
    });
  }
  function x(S, b) {
    const v = document.createElement("canvas"), f = Math.min(2, 4096 / Math.max(S, b));
    v.width = Math.max(1, Math.round(S * f)), v.height = Math.max(1, Math.round(b * f));
    const E = v.getContext("2d");
    if (!E) throw new Error("The browser could not prepare a slide image.");
    return E.scale(v.width / S, v.height / b), { element: v, context: E };
  }
  function h(S, b, v, f) {
    const E = l.createElement("p"), A = l.createElement("img"), s = Math.min(1, 720 / v);
    A.width = Math.max(1, Math.round(v * s)), A.height = Math.max(1, Math.round(f * s)), A.style.maxWidth = "100%", A.style.height = "auto", A.src = S, A.alt = b, E.append(A), d.append(E);
  }
  async function g(S) {
    const b = S.cloneNode(!0);
    b.style.width = "1280px", b.style.height = "720px";
    for (const T of b.children) {
      const z = parseFloat(T.style.width) * 12.8;
      for (const C of [T, ...T.querySelectorAll("[style]")]) {
        const _ = C.closest(".shape-content") ? z / 100 : 12.8;
        C.setAttribute("style", C.getAttribute("style").replace(/([\d.]+)cqw/g, (q, ee) => Number(ee) * _ + "px"));
      }
    }
    const v = l.createElement("div"), f = l.createElement("style");
    f.textContent = `
      * {box-sizing:border-box;} .slide {position:relative;overflow:hidden;font-family:Arial,sans-serif;color:#202b3d;}
      .slide-object {position:absolute;} .text-content {width:100%;height:100%;overflow:hidden;padding:5px 8px;}
      .tiptap {font-size:var(--slide-font-size,33.28px);line-height:1.2;}
      p {margin:0 0 8px;} h1 {font-size:1em;} h2 {font-size:24px;} h3 {font-size:20px;}
      ul,ol {margin:0 0 .3em;padding-left:1.5em;} li p {margin-bottom:.2em;}
      .image-content {width:100%;height:100%;overflow:hidden;}
      .image-content img {display:block;width:100%;height:100%;object-fit:contain;}
      .shape-content,.shape-content svg {display:block;width:100%;height:100%;}
    `, v.append(f, b);
    const E = new XMLSerializer().serializeToString(v), A = "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><foreignObject width="1280" height="720">' + E + "</foreignObject></svg>"), s = await y(A), F = x(1280, 720);
    return F.context.drawImage(s, 0, 0, 1280, 720), F.element.toDataURL("image/png");
  }
  for (const [S, b] of r.entries()) {
    const v = l.createElement("h2");
    v.textContent = "Slide " + (S + 1), d.append(v);
    const f = [...b.children].sort((A, s) => parseFloat(A.style.top) - parseFloat(s.style.top) || parseFloat(A.style.left) - parseFloat(s.style.left)), E = !!b.querySelector("svg");
    if (E) {
      const A = f.map((s) => s.querySelector(".tiptap")?.textContent.trim()).filter(Boolean);
      h(await g(b), "Slide " + (S + 1) + " diagram" + (A.length ? ": " + A.join("; ") : ""), 1280, 720);
    }
    for (const A of f) {
      const s = A.querySelector(".text-content .tiptap");
      if (s) {
        for (const ee of s.childNodes) d.append(p(ee));
        continue;
      }
      if (E) continue;
      let F, T;
      const z = A.querySelector("img"), C = A.querySelector("svg");
      let _ = parseFloat(A.style.width) * 12.8, q = parseFloat(A.style.height) * 7.2;
      if (z) {
        if (F = z.getAttribute("src") || "", T = z.alt, !/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(F)) throw new Error("A slide image is missing or is not embedded.");
        const ee = await y(F);
        if (z.style.position === "absolute") {
          const se = x(_, q);
          se.context.drawImage(ee, parseFloat(z.style.left) * 12.8, parseFloat(z.style.top) * 12.8, parseFloat(z.style.width) * 12.8, parseFloat(z.style.height) * 12.8), F = se.element.toDataURL("image/png");
        } else {
          const se = Math.min(_ / ee.width, q / ee.height);
          _ = ee.width * se, q = ee.height * se;
        }
      } else if (C) {
        const ee = C.cloneNode(!0);
        ee.setAttribute("width", _), ee.setAttribute("height", q);
        for (const L of ee.querySelectorAll("[vector-effect]")) {
          const U = parseFloat(L.style.strokeWidth) * _ / 100;
          L.style.removeProperty("stroke-width"), L.setAttribute("stroke-width", Number.isFinite(U) ? U : 0);
        }
        const se = await y("data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(ee))), oe = x(_, q);
        oe.context.drawImage(se, 0, 0, _, q), F = oe.element.toDataURL("image/png"), T = "Diagram on slide " + (S + 1);
      } else continue;
      h(F, T || "Image on slide " + (S + 1), _, q);
    }
    S < r.length - 1 && d.append(l.createElement("hr"));
  }
  return d.innerHTML;
}
const _r = [{ id: "rectangle", label: "Rectangle", width: 320, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "rect", attributes: { x: 0, y: 0, width: 1e3, height: 1e3 } }] }, { id: "circle", label: "Circle", width: 220, height: 220, defaults: { fillEnabled: !0, fillColour: "#51b158", borderEnabled: !0, borderColour: "#202b3d", borderWidth: 2 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "ellipse", attributes: { cx: 500, cy: 500, rx: 500, ry: 500 } }] }, { id: "line", label: "Line", width: 360, height: 4, defaults: { fillEnabled: !1, borderEnabled: !0, borderColour: "#202b3d", borderWidth: 4 }, viewBox: [0, 0, 1e3, 1e3], elements: [{ tag: "line", attributes: { x1: 0, y1: 0, x2: 1e3, y2: 1e3 } }] }], Zr = {
  shapes: _r
}, Qr = [{ id: "blank", label: "Blank", objects: [] }, { id: "title", label: "Title", objects: [{ kind: "text", x: 100, y: 260, width: 1080, height: 140, text: "Presentation title", fontSize: 64, textAlign: "center" }] }, { id: "title-body", label: "Title and body", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 1080, height: 400, text: "Add your content here.", fontSize: 32, textAlign: "left" }] }, { id: "two-columns", label: "Two columns", objects: [{ kind: "text", x: 100, y: 70, width: 1080, height: 110, text: "Slide title", fontSize: 52, textAlign: "left" }, { kind: "text", x: 100, y: 220, width: 500, height: 400, text: "Left column", fontSize: 32, textAlign: "left" }, { kind: "text", x: 680, y: 220, width: 500, height: 400, text: "Right column", fontSize: 32, textAlign: "left" }] }], ei = {
  layouts: Qr
}, ti = [{ id: "classic", label: "Classic", fontFamily: "system", fontSize: 33.28, textColour: "#202b3d", background: "#ffffff", fillColour: "#51b158", borderColour: "#202b3d" }, { id: "midnight", label: "Midnight", fontFamily: "arial", fontSize: 33.28, textColour: "#f1f5f9", background: "#142033", fillColour: "#397ab8", borderColour: "#a6caed" }, { id: "paper", label: "Paper", fontFamily: "georgia", fontSize: 33.28, textColour: "#392f28", background: "#fff8e8", fillColour: "#dbb571", borderColour: "#76573a" }, { id: "ocean", label: "Ocean", fontFamily: "verdana", fontSize: 33.28, textColour: "#13354b", background: "#edf8fc", fillColour: "#56b6bd", borderColour: "#216479" }], ni = {
  themes: ti
}, jo = {
  rect: ["x", "y", "width", "height", "rx", "ry"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"],
  path: ["d"]
}, On = (n) => typeof n == "string" && /^#[0-9a-f]{6}$/i.test(n), Nt = (n) => typeof n == "number" && Number.isFinite(n);
function be(n, i) {
  if (!n) throw new Error("Slide catalog: " + i);
}
function Bn(n) {
  be(n && typeof n.id == "string" && /^[a-z][a-z0-9-]{0,79}$/.test(n.id), "invalid entry ID"), be(typeof n.label == "string" && n.label.trim().length > 0 && n.label.length <= 120, n.id + " needs a label");
}
function qo(n, i) {
  const l = {};
  for (const r of ["fillEnabled", "borderEnabled", "keepAspectRatio", "locked"])
    n[r] !== void 0 && (be(typeof n[r] == "boolean", i + ": invalid " + r), l[r] = n[r]);
  for (const r of ["fillColour", "borderColour", "textColour"])
    n[r] !== void 0 && (be(On(n[r]), i + ": invalid " + r), l[r] = n[r]);
  for (const [r, d, m] of [["fontSize", 8, 200], ["borderWidth", 1, 20], ["rotation", -180, 180], ["cropX", 0, 100], ["cropY", 0, 100]])
    n[r] !== void 0 && (be(Nt(n[r]) && n[r] >= d && n[r] <= m, i + ": invalid " + r), l[r] = n[r]);
  for (const [r, d] of [["textAlign", ["left", "center", "right", "justify"]], ["fontFamily", ["system", "arial", "verdana", "georgia", "times", "courier"]], ["imageFit", ["contain", "cover"]]])
    n[r] !== void 0 && (be(d.includes(n[r]), i + ": invalid " + r), l[r] = n[r]);
  return l;
}
function fn(n) {
  Bn(n), be(Nt(n.width) && n.width > 0 && n.width <= 1280 && Nt(n.height) && n.height > 0 && n.height <= 720, n.id + ": invalid default dimensions"), be(Array.isArray(n.viewBox) && n.viewBox.length === 4 && n.viewBox.every(Nt) && n.viewBox[2] > 0 && n.viewBox[3] > 0, n.id + ": invalid SVG viewBox"), be(Array.isArray(n.elements) && n.elements.length > 0 && n.elements.length <= 64, n.id + ": needs 1–64 SVG elements");
  const i = n.elements.map((l) => {
    be(l && Object.hasOwn(jo, l.tag), n.id + ": unsupported SVG element"), be(l.attributes && typeof l.attributes == "object", n.id + ": missing SVG attributes");
    const r = {};
    for (const [d, m] of Object.entries(l.attributes))
      be(jo[l.tag].includes(d), n.id + ": unsupported SVG attribute " + d), d === "d" ? be(typeof m == "string" && m.length <= 65536 && /^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(m), n.id + ": invalid path") : d === "points" ? be(typeof m == "string" && m.length <= 65536 && /^[0-9eE+.,\s-]+$/.test(m), n.id + ": invalid points") : be(Nt(m), n.id + ": invalid SVG coordinate"), r[d] = m;
    return { tag: l.tag, attributes: r };
  });
  return { id: n.id, label: n.label, width: n.width, height: n.height, defaults: qo(n.defaults || {}, n.id), viewBox: [...n.viewBox], elements: i };
}
function oi(n, i) {
  Bn(n), be(Array.isArray(n.objects) && n.objects.length <= 100, n.id + ": invalid objects array"), n.background !== void 0 && be(On(n.background), n.id + ": invalid background"), n.notes !== void 0 && be(typeof n.notes == "string", n.id + ": invalid notes");
  const l = n.objects.map((r) => {
    be(r && ["text", "shape", "image"].includes(r.kind), n.id + ": unsupported object kind"), be(["x", "y", "width", "height"].every((m) => Nt(r[m])) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1280 && r.y + r.height <= 720, n.id + ": object is outside the slide");
    const d = { kind: r.kind, x: r.x, y: r.y, width: r.width, height: r.height, ...qo(r, n.id) };
    return r.kind === "text" && (be(typeof r.text == "string", n.id + ": text object needs text"), d.text = r.text), r.kind === "shape" && (be(i.has(r.shapeId), n.id + ": unknown shape " + r.shapeId), d.shapeId = r.shapeId), r.kind === "image" && (be(typeof r.source == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(r.source), n.id + ": image needs embedded image data"), d.source = r.source, d.alt = typeof r.alt == "string" ? r.alt : ""), r.group !== void 0 && (be(typeof r.group == "string" && r.group.length <= 80, n.id + ": invalid group"), d.group = r.group), d;
  });
  return { id: n.id, label: n.label, objects: l, ...n.background !== void 0 ? { background: n.background } : {}, ...n.notes !== void 0 ? { notes: n.notes } : {} };
}
function hn(n) {
  Bn(n), be(["system", "arial", "verdana", "georgia", "times", "courier"].includes(n.fontFamily), n.id + ": invalid theme font"), be(Nt(n.fontSize) && n.fontSize >= 8 && n.fontSize <= 200, n.id + ": invalid theme font size");
  const i = { id: n.id, label: n.label, fontFamily: n.fontFamily, fontSize: n.fontSize };
  for (const l of ["textColour", "background", "fillColour", "borderColour"])
    be(On(n[l]), n.id + ": invalid theme " + l), i[l] = n[l];
  return i;
}
function Dn(n = {}) {
  const i = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), d = n.shapes === void 0 ? Zr.shapes : n.shapes, m = n.layouts === void 0 ? ei.layouts : n.layouts;
  be(Array.isArray(d) && d.length > 0, "shapes must be a nonempty array"), be(Array.isArray(m) && m.length > 0, "layouts must be a nonempty array");
  for (const y of d) {
    const x = fn(y);
    be(!i.has(y.id), "duplicate shape ID " + y.id), i.set(y.id, x);
  }
  for (const y of m) {
    const x = oi(y, i);
    be(!l.has(y.id), "duplicate layout ID " + y.id), l.set(y.id, x);
  }
  const p = n.themes === void 0 ? ni.themes : n.themes;
  be(Array.isArray(p) && p.length > 0, "themes must be a nonempty array");
  for (const y of p) {
    const x = hn(y);
    be(!r.has(y.id), "duplicate theme ID " + y.id), r.set(y.id, x);
  }
  return { shapes: i, layouts: l, themes: r };
}
async function ri(n) {
  const i = await Promise.all(["shapes", "layouts", "themes"].map(async (r) => {
    const d = await fetch(new URL(r + ".json", n), { cache: "no-cache" });
    if (!d.ok) throw new Error("Could not load slide " + r + " catalog (HTTP " + d.status + ").");
    const m = await d.json();
    return be(m && m.version === 1, "unsupported " + r + " catalog version"), be(Array.isArray(m[r]), r + " catalog needs a " + r + " array"), m[r];
  })), l = { shapes: i[0], layouts: i[1], themes: i[2] };
  return Dn(l), l;
}
function ii(n, i = {}) {
  if (!(n instanceof HTMLElement)) throw new TypeError("A container element is required");
  const { Y: l, Editor: r, StarterKit: d, Collaboration: m, HocuspocusProvider: p, Link: y } = i.dependencies, { shapes: x, layouts: h, themes: g } = Dn(i.catalogs), S = Dn().shapes.values().next().value, b = /* @__PURE__ */ new WeakMap(), v = /* @__PURE__ */ new Map(), f = document.createElement("div");
  f.className = "clist-slides app", f.innerHTML = wr, n.append(f);
  const E = 1280, A = 720, s = (e) => f.querySelector(`[data-control="${e}"]`);
  for (const e of f.querySelectorAll(".tools button")) Ao(e);
  for (const e of x.values()) {
    const t = document.createElement("button");
    t.className = "btn-small", t.dataset.control = "add-" + e.id, t.title = "Add " + e.label, Ao(t, e), t.addEventListener("click", () => oo(e.id)), s("shape-tools").append(t);
  }
  for (const e of h.values()) {
    const t = document.createElement("option");
    t.value = e.id, t.textContent = e.label, s("slide-layout").append(t);
  }
  const F = s("slide"), T = document.createElement("div"), z = document.createElement("div");
  T.className = "alignment-guide vertical", z.className = "alignment-guide horizontal", T.hidden = z.hidden = !0, F.append(T, z);
  let C = new l.Doc(), _ = null, q = null, ee = null, se = null, oe = null, L = C.getMap("slide-objects"), U = C.getMap("slide-pages"), G = C.getMap("slide-backgrounds"), J = C.getMap("slide-notes"), K = C.getMap("clist_refs"), le = C.getMap("slide-design"), ue = null, Le = null, Ne = null, ke = null, H = "first", Ce = /* @__PURE__ */ new Set(["first"]), ot = "first", We = "first";
  const Z = /* @__PURE__ */ new Map(), ge = /* @__PURE__ */ new Map(), Ee = /* @__PURE__ */ new Map(), Be = /* @__PURE__ */ new Map(), Te = /* @__PURE__ */ new Map(), Xe = /* @__PURE__ */ new Set();
  let pt = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), V = !0, W = "", te = null, Q = null, Y = !1;
  const I = /* @__PURE__ */ new Set();
  let B = null, Ae = null, pe = !1, fe = null, je = 0, ve = null, Pe = !1, ie = null, re = null, de = null, Me = null, qe = null, D = null, rt = !1, R = !1, gt = null, $e = null, _e = null, Ie = null, st = null, Ke = !1, Ge = null, Je = !1;
  const ft = Ur({
    getDocument: () => C,
    encode: l.encodeStateAsUpdate,
    getName: () => s("doc-name").value,
    onError: (e) => {
      console.error("Background recovery failed:", e), X("Background recovery failed: " + e.message, "error");
    }
  }), it = jr(f, () => R);
  let lt = null, et = [], jt = null;
  s("server-url").value = i.url || "", s("doc-name").value = i.documentName || "clist-slide-demo";
  function X(e, t = "") {
    s("connection-status").textContent = e, s("connection-status").className = `status ${t}`;
  }
  function kt(e) {
    ft.changed(e), Ge?.changed(), i.onChange?.();
  }
  function Bt(e) {
    i.onStatus ? i.onStatus(e) : X(e);
  }
  function St(e, t, o, a, c, u = null, k = "") {
    const w = new l.Map();
    w.set("x", t), w.set("y", o), w.set("width", a), w.set("height", c), w.set("rotation", 0), w.set("slide", H), w.set("layer", Math.max(-1, ...De().map((M) => Ze(L.get(M)))) + 1), u && (w.set("kind", "image"), w.set("source", u), w.set("alt", k), w.set("imageRatio", a / c), w.set("aspectRatio", a / c), w.set("keepAspectRatio", !0)), L.set(e, w);
  }
  function qn() {
    L.size || pe || (pe = !0, C.transact(() => {
      L.size || (le.has("theme") || le.set("theme", structuredClone(bt())), St("title", 105, 98, 820, 135), St("body", 108, 296, 690, 240));
    }, "init"), Z.get("title")?.editor.commands.setContent("<h1>Collaborative slides</h1>"), Z.get("body")?.editor.commands.setContent("<p>Click here to edit together.</p><p>Click and drag over text to select it. Hold on text or drag a box border to move it, or resize it from the lower-right corner.</p>"));
  }
  function Ho(e, t) {
    const o = document.createElement("div");
    o.className = t.get("kind") === "shape" ? "slide-object shape-object" : t.get("kind") === "image" ? "slide-object image-object" : "slide-object", o.dataset.id = e, o.tabIndex = 0, o.setAttribute("aria-label", t.get("kind") === "shape" ? "Shape object. Arrow keys move; Delete removes." : t.get("kind") === "image" ? "Image object. Arrow keys move; Delete removes." : "Text object. Arrow keys move; Enter edits.");
    const a = document.createElement("div");
    a.className = t.get("kind") === "shape" ? "shape-content" : t.get("kind") === "image" ? "image-content" : "text-content";
    const c = document.createElement("div");
    c.className = "resize-handle", o.append(a, c);
    for (const w of ["left", "right", "top", "bottom"]) {
      const M = document.createElement("div");
      M.className = "object-resize-edge object-resize-" + w, M.dataset.resizeEdge = w, M.title = "Resize " + w + " edge", M.addEventListener("pointerdown", (P) => en(P, e, "edge-" + w)), o.append(M);
    }
    {
      const w = t.get("kind") === "image" ? "image" : t.get("kind") === "shape" ? "shape" : "text box", M = document.createElement("div");
      M.className = "rotation-handle", M.title = "Rotate " + w + ": drag right clockwise, left counterclockwise", M.setAttribute("role", "slider"), M.setAttribute("aria-label", "Rotate " + w), M.setAttribute("aria-valuemin", "-180"), M.setAttribute("aria-valuemax", "180"), M.tabIndex = 0, M.addEventListener("pointerdown", (P) => en(P, e, "rotate")), M.addEventListener("keydown", (P) => {
        ["ArrowLeft", "ArrowRight"].includes(P.key) && (P.preventDefault(), P.stopPropagation(), !(R || t.get("locked") === !0) && t.set("rotation", So(t.get("rotation"), P.key === "ArrowRight" ? 1 : -1)));
      }), o.append(M);
    }
    F.append(o);
    let u = null;
    if (t.get("kind") === "shape")
      a.append(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
    else if (t.get("kind") === "image") {
      const w = document.createElement("img");
      w.src = Ct(t.get("source")), w.alt = typeof t.get("alt") == "string" ? t.get("alt") : "", w.draggable = !1, w.addEventListener("load", () => {
        Z.has(e) && yn(e);
      }), a.append(w);
    } else {
      const w = C.getXmlFragment(`slide-text-${e}`);
      D?.addToScope(w), rt = !0;
      try {
        u = new r({
          element: a,
          editable: !R,
          extensions: [
            d.configure({ undoRedo: !1, history: !1, link: !1 }),
            ur(y.constructor),
            y.extend({ addAttributes() {
              return { ...this.parent?.(), title: { default: null, parseHTML: (M) => M.getAttribute("title") }, ariaLabel: { default: null, parseHTML: (M) => M.getAttribute("aria-label"), renderHTML: (M) => M.ariaLabel ? { "aria-label": M.ariaLabel } : {} } };
            } }).configure({ openOnClick: !1, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
            m.configure({ document: C, field: `slide-text-${e}` })
          ],
          editorProps: {
            attributes: { "aria-label": `Edit text in ${e}` }
          },
          onFocus: () => {
            Ae = e, ze(e, !1, I.has(e));
          },
          onSelectionUpdate: () => {
            Z.get(e)?.editor === u && wt();
          },
          onUpdate: () => {
            Z.get(e)?.editor === u && wt();
          },
          onBlur: () => {
            Ae === e && (Ae = null), D?.stopCapturing();
          }
        });
      } finally {
        rt = !1;
      }
    }
    const k = xr(o, c, {
      current: () => !R && Z.get(e)?.node === o,
      text: () => !!u,
      select: (w) => ze(e, w, !1, !0),
      focus: () => {
        f.tabIndex = -1, f.focus({ preventScroll: !0 });
      },
      move: (w) => en(w, e, "move")
    });
    o.addEventListener("dblclick", (w) => {
      t.get("kind") === "image" && !w.target.closest(".rotation-handle") && (w.preventDefault(), w.stopPropagation(), ze(e), ao());
    }), o.addEventListener("focus", () => {
      ze(e, !1, I.has(e)), u && !u.state.selection.empty && u.commands.setTextSelection(u.state.selection.from);
      const w = document.getSelection();
      w?.anchorNode && f.contains(w.anchorNode) && w.removeAllRanges();
    }), c.addEventListener("pointerdown", (w) => en(w, e, "resize")), Z.set(e, { node: o, editor: u, box: t, content: a, disposePointer: k }), yn(e), B === e && o.classList.add("selected");
  }
  function bt() {
    const e = le.get("theme");
    if (e)
      try {
        return hn(e);
      } catch {
      }
    return g.values().next().value;
  }
  function mn() {
    const e = new Map(g);
    for (const [o, a] of le.entries())
      if (o.startsWith("saved-theme:"))
        try {
          const c = hn(a);
          e.set(c.id, c);
        } catch (c) {
          console.error("Invalid saved theme:", c), X("A saved theme could not be read. Other themes are still available.", "error");
        }
    const t = bt();
    return e.set(t.id, t), e;
  }
  function Hn(e) {
    const t = mn().get(e);
    !t || R || (D?.stopCapturing(), le.set("theme", structuredClone(t)), D?.stopCapturing(), X("Theme applied: " + t.label));
  }
  s("theme").addEventListener("change", (e) => Hn(e.target.value));
  function Uo() {
    const e = bt(), t = s("theme");
    t.replaceChildren();
    for (const a of mn().values()) {
      const c = document.createElement("option");
      c.value = a.id, c.textContent = a.label, t.append(c);
    }
    t.value = e.id;
    const o = s("theme-preview");
    if (o) {
      o.replaceChildren();
      for (const a of [e.background, e.textColour, e.fillColour, e.borderColour]) {
        const c = document.createElement("span");
        c.style.backgroundColor = a, o.append(c);
      }
    }
  }
  function Et(e) {
    const t = bt(), o = (c, u) => /^#[0-9a-f]{6}$/i.test(e.get(c) || "") ? e.get(c) : u, a = Number(e.get("borderWidth"));
    return {
      fill: e.get("fillEnabled") === !0,
      fillColour: o("fillColour", e.get("kind") === "shape" ? t.fillColour : t.background),
      border: e.get("borderEnabled") === !0,
      borderColour: o("borderColour", t.borderColour),
      width: Number.isFinite(a) && a >= 1 && a <= 20 ? a : 2
    };
  }
  function ht(e) {
    const t = bt(), o = Number(e.get("fontSize")), a = e.get("textColour"), c = e.get("textAlign");
    return {
      size: Number.isFinite(o) && o >= 8 && o <= 200 ? o : t.fontSize,
      colour: typeof a == "string" && /^#[0-9a-f]{6}$/i.test(a) ? a : t.textColour,
      align: ["left", "center", "right", "justify"].includes(c) ? c : "left",
      family: Object.prototype.hasOwnProperty.call(Mt, e.get("fontFamily")) ? e.get("fontFamily") : t.fontFamily
    };
  }
  function Ze(e) {
    const t = e.get("layer");
    return typeof t == "number" && Number.isFinite(t) ? t : 0;
  }
  function De(e = H) {
    return [...L.keys()].filter((t) => {
      const o = L.get(t);
      return o instanceof l.Map && (o.get("slide") || "first") === e;
    }).sort((t, o) => Ze(L.get(t)) - Ze(L.get(o)) || t.localeCompare(o));
  }
  function gn(e) {
    const t = (o) => {
      const a = e.get(o);
      return typeof a == "number" && Number.isFinite(a) ? Math.max(0, Math.min(100, a)) : 50;
    };
    return { fit: e.get("imageFit") === "cover" ? "cover" : "contain", x: t("cropX"), y: t("cropY") };
  }
  function Kt(e, t) {
    const o = Number(e.get("cropImageWidth")), a = Number(e.get("cropImageHeight"));
    if (o > 0 && a > 0) return { width: o, height: a };
    const c = t?.naturalWidth > 0 ? t.naturalWidth / t.naturalHeight : Number(e.get("imageRatio")) || so(e), u = Math.max(e.get("width"), e.get("height") * c);
    return { width: u, height: u / c };
  }
  function Un(e) {
    if (e.get("kind") !== "image" || e.get("imageFit") !== "cover") return;
    const t = Z.get([...L.keys()].find((a) => L.get(a) === e))?.content.querySelector("img"), o = Kt(e, t);
    e.set("cropImageWidth", o.width), e.set("cropImageHeight", o.height);
  }
  function bn(e, t, o = !1) {
    const a = gn(t);
    if (e.style.objectFit = "contain", e.style.objectPosition = a.x + "% " + a.y + "%", a.fit === "cover") {
      e.style.objectFit = "fill";
      const c = Kt(t, e);
      e.style.position = "absolute", e.style.width = o ? c.width / 12.8 + "cqw" : 100 * c.width / t.get("width") + "%", e.style.height = o ? c.height / 12.8 + "cqw" : 100 * c.height / t.get("height") + "%", e.style.left = o ? (t.get("width") - c.width) * a.x / 1280 + "cqw" : (t.get("width") - c.width) * a.x / t.get("width") + "%", e.style.top = o ? (t.get("height") - c.height) * a.y / 1280 + "cqw" : (t.get("height") - c.height) * a.y / t.get("height") + "%";
    } else
      e.style.position = "static", e.style.width = e.style.height = "100%", e.style.left = e.style.top = "";
  }
  function Gt(e) {
    const t = e.get("shapeDefinition");
    if (t && typeof t == "object") {
      if (!b.has(t))
        try {
          b.set(t, fn(t));
        } catch (o) {
          console.error("Invalid saved shape definition:", o), X("A saved shape definition is invalid; showing a fallback shape.", "error"), b.set(t, S);
        }
      return b.get(t);
    }
    return x.get(e.get("shapeType")) || S;
  }
  function Wn(e) {
    const { fillColour: t, borderColour: o, ...a } = e.defaults;
    return { kind: "shape", shapeType: e.id, shapeDefinition: structuredClone(e), ...a };
  }
  function Jt(e, t) {
    const o = "http://www.w3.org/2000/svg", a = Math.max(1, Number(t.get("width")) || 1), c = Math.max(1, Number(t.get("height")) || 1), u = Et(t), k = Gt(t), w = u.border ? Math.min(u.width, a, c) : 0, [M, P, N, O] = k.viewBox;
    e.setAttribute("viewBox", "0 0 " + a + " " + c), e.setAttribute("preserveAspectRatio", "none");
    const $ = document.createElementNS(o, "g");
    $.setAttribute("transform", "translate(" + w / 2 + " " + w / 2 + ") scale(" + Math.max(1e-3, a - w) / N + " " + Math.max(1e-3, c - w) / O + ") translate(" + -M + " " + -P + ")");
    for (const ce of k.elements) {
      const he = document.createElementNS(o, ce.tag);
      for (const [ae, Re] of Object.entries(ce.attributes)) he.setAttribute(ae, String(Re));
      he.setAttribute("fill", u.fill ? u.fillColour : "none"), he.setAttribute("stroke", u.border ? u.borderColour : "none"), he.setAttribute("vector-effect", "non-scaling-stroke"), he.style.strokeWidth = 100 * w / a + "cqw", he.setAttribute("stroke-linecap", "round"), he.setAttribute("stroke-linejoin", "round"), $.append(he);
    }
    e.replaceChildren($);
  }
  function yn(e) {
    const t = Z.get(e);
    if (!t) return;
    const { node: o, box: a } = t;
    if (o.style.left = `${100 * Number(a.get("x") || 0) / E}%`, o.style.top = `${100 * Number(a.get("y") || 0) / A}%`, o.style.width = `${100 * Number(a.get("width") || 0) / E}%`, o.style.height = `${100 * Number(a.get("height") || 0) / A}%`, o.style.transform = `rotate(${Number(a.get("rotation") || 0)}deg)`, o.querySelector(".rotation-handle")?.setAttribute("aria-valuenow", String(Number(a.get("rotation")) || 0)), o.classList.toggle("locked", a.get("locked") === !0), o.title = a.get("locked") === !0 ? "Locked object: select it and click Unlock to move, resize or delete." : "", o.style.zIndex = String(De().indexOf(e)), a.get("kind") === "shape") Jt(t.content.querySelector("svg"), a);
    else if (!t.editor) {
      const c = t.content.querySelector("img"), u = Ct(a.get("source"));
      c.getAttribute("src") !== u && (c.src = u), c.alt = typeof a.get("alt") == "string" ? a.get("alt") : "", bn(c, a, !0);
    }
    if (t.editor) {
      const c = ht(a);
      o.style.setProperty("--slide-font-size", c.size / 12.8 + "cqw"), o.style.fontFamily = Mt[c.family], o.style.color = c.colour, o.style.textAlign = c.align;
      const u = Et(a);
      t.content.style.backgroundColor = u.fill ? u.fillColour : "transparent", t.content.style.border = u.border ? u.width / 12.8 + "cqw solid " + u.borderColour : "none";
    }
  }
  function qt() {
    const e = J.get(H), t = typeof e == "string" ? e : "";
    s("speaker-notes").value !== t && (s("speaker-notes").value = t);
  }
  s("speaker-notes").addEventListener("input", (e) => {
    R || J.set(H, e.target.value);
  });
  function zt(e) {
    const t = G.get(e);
    return typeof t == "string" && /^#[0-9a-f]{6}$/i.test(t) ? t : bt().background;
  }
  s("slide-background").addEventListener("change", (e) => {
    if (R) return;
    const t = e.target.value;
    /^#[0-9a-f]{6}$/i.test(t) && G.set(H, t);
  });
  function Se() {
    return U.size ? [...U.keys()].sort((e, t) => U.get(e) - U.get(t) || e.localeCompare(t)) : ["first"];
  }
  function wn(e) {
    const t = Be.get(e), o = L.get(e);
    if (t !== void 0 && (Xe.add(t), Te.get(t)?.delete(e), Te.get(t)?.size || Te.delete(t), Be.delete(e)), o instanceof l.Map) {
      const a = o.get("slide") || "first";
      Be.set(e, a), pt.set(o, e), Te.has(a) || Te.set(a, /* @__PURE__ */ new Set()), Te.get(a).add(e), Xe.add(a);
    }
  }
  function Wo() {
    Be.clear(), Te.clear(), Xe.clear(), pt = /* @__PURE__ */ new WeakMap(), j = /* @__PURE__ */ new WeakMap(), L.forEach((e, t) => wn(t)), V = !0;
  }
  function Yt(e) {
    for (const t of e.changed.get(L) || []) t !== null && wn(t);
    for (const [t, o] of e.changed)
      if (t === le) V = !0;
      else if (t === G) for (const a of o) Xe.add(a);
      else if (pt.has(t)) wn(pt.get(t));
      else {
        let a = t;
        for (; a.parent; ) a = a.parent;
        if (!(a instanceof l.XmlFragment)) continue;
        if (!j.has(a))
          for (const [u, k] of C.share) u.startsWith("slide-text-") && j.set(k, u.slice(11));
        const c = Be.get(j.get(a));
        c !== void 0 && Xe.add(c);
      }
  }
  function _t(e = Se()) {
    e.includes(H) || (H = e[0]), ot !== H ? (Ce = /* @__PURE__ */ new Set([H]), We = H) : (Ce = new Set(e.filter((t) => Ce.has(t))), Ce.size || Ce.add(H)), ot = H, e.includes(We) || (We = H);
  }
  function Zt() {
    return _t(), Se().filter((e) => Ce.has(e));
  }
  function yt(e, t = e[0], o = t) {
    Ce = new Set(e), H = t, ot = t, We = o, B = null, I.clear();
  }
  function Tt() {
    if (ue?.mode === "outline") {
      ue.focus(H);
      return;
    }
    s("slide-list").querySelector(`[data-slide-id="${H}"]`)?.focus({ preventScroll: !0 });
  }
  function Qt(e, t = {}) {
    const o = Se();
    if (!(R || !o.includes(e))) {
      if (xe(), _t(o), t.shiftKey) {
        const a = o.indexOf(We), c = o.indexOf(e), u = o.slice(Math.min(a, c), Math.max(a, c) + 1);
        yt(t.ctrlKey || t.metaKey ? [...Ce, ...u] : u, e, We);
      } else if (t.ctrlKey || t.metaKey) {
        const a = new Set(Ce);
        a.has(e) && a.size > 1 ? a.delete(e) : a.add(e), yt([...a], a.has(e) ? e : a.has(H) ? H : [...a][0], e);
      } else yt([e], e);
      we(), Tt();
    }
  }
  function Xn() {
    const e = s("object-list");
    if (!e) return;
    const t = De().reverse();
    for (const [o, a] of ge)
      t.includes(o) || (a.remove(), ge.delete(o));
    t.forEach((o, a) => {
      const c = L.get(o), u = c.get("kind") === "image", k = c.get("kind") === "shape", w = u ? c.get("alt") : Z.get(o)?.editor?.getText(), M = (typeof w == "string" ? w : "").replace(/\s+/g, " ").trim().slice(0, 60), P = k ? "Shape: " + Gt(c).label : (u ? "Image: " : "Text: ") + (M || (u ? "Untitled image" : "Empty text box"));
      let N = ge.get(o);
      N || (N = document.createElement("button"), N.className = "btn-small", N.dataset.objectId = o, N.addEventListener("click", (O) => {
        R || (xe(), ze(o, O.shiftKey, !1, !0), f.tabIndex = -1, f.focus({ preventScroll: !0 }));
      }), ge.set(o, N)), N.textContent = P + (c.get("groupId") ? " (Grouped)" : "") + (c.get("locked") === !0 ? " (Locked)" : ""), N.title = "Select " + P + ". Shift-click to add or remove from selection.", N.setAttribute("aria-pressed", String(I.has(o))), e.children[a] !== N && e.insertBefore(N, e.children[a] || null);
    });
  }
  function xn() {
    for (const e of f.querySelectorAll(".slide-drop-before, .slide-drop-after, .slide-dragging")) e.classList.remove("slide-drop-before", "slide-drop-after", "slide-dragging");
  }
  function vn() {
    xn(), lt = null, et = [], jt = null;
  }
  const ct = f.querySelector(".rail");
  ct.addEventListener("dragstart", (e) => {
    const t = e.target.closest("[data-slide-id]");
    if (!t || R || Se().length < 2 || !e.dataTransfer) {
      e.preventDefault();
      return;
    }
    xe();
    const o = t.dataset.slideId;
    _t(), Ce.has(o) || yt([o]), lt = o, et = Zt(), e.dataTransfer.effectAllowed = "move", e.dataTransfer.setData("text/plain", "CList slide");
    for (const a of s("slide-list").querySelectorAll("[data-slide-id]")) et.includes(a.dataset.slideId) && a.classList.add("slide-dragging");
  }), ct.addEventListener("dragover", (e) => {
    if (!lt || R) return;
    e.preventDefault(), e.dataTransfer.dropEffect = "move", xn();
    const t = [...s("slide-list").querySelectorAll(":scope > [data-slide-id]")], o = t[Cr(t.map((u) => u.getBoundingClientRect()), e.clientX, e.clientY, ue?.mode === "sorter")];
    jt = o?.dataset.slideId || null, (o || t.at(-1))?.classList.add(o ? "slide-drop-before" : "slide-drop-after");
    for (const u of t) et.includes(u.dataset.slideId) && u.classList.add("slide-dragging");
    const c = ct.getBoundingClientRect();
    e.clientY < c.top + 35 ? ct.scrollTop -= 18 : e.clientY > c.bottom - 35 && (ct.scrollTop += 18);
  }), ct.addEventListener("dragleave", (e) => {
    ct.contains(e.relatedTarget) || xn();
  }), ct.addEventListener("dragend", () => {
    vn(), we();
  }), ct.addEventListener("drop", (e) => {
    if (!lt || R) return;
    e.preventDefault();
    const t = [...et], o = jt;
    vn();
    const a = Se(), c = Xr(a, t, o);
    c.every((u, k) => u === a[k]) || (B = null, I.clear(), D?.stopCapturing(), C.transact(() => c.forEach((u, k) => U.set(u, k))), D?.stopCapturing(), Tt(), Bt(t.length === 1 ? "Slide moved to position " + (c.indexOf(t[0]) + 1) : t.length + " slides moved"));
  }), ct.addEventListener("keydown", (e) => {
    if (R || e.isComposing) return;
    const t = Se(), o = t.indexOf(H);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a")
      e.preventDefault(), e.stopPropagation(), yt(t, H, We), we(), Tt();
    else if (e.key === "Escape")
      e.preventDefault(), e.stopPropagation(), Qt(H);
    else if (e.key === "Delete" || e.key === "Backspace")
      e.preventDefault(), e.stopPropagation(), s("delete-slide").disabled || s("delete-slide").click();
    else if (["ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault(), e.stopPropagation();
      const a = e.key === "ArrowUp" ? -1 : 1;
      e.altKey ? Ko(a) : t[o + a] && Qt(t[o + a], e);
    }
  });
  function It() {
    Nn(), Xn();
    const e = Se(), t = JSON.stringify(e);
    lt && t !== W && vn(), W = t, _t(e);
    const o = s("slide-list"), a = new Set(e);
    for (const [w, M] of Ee) a.has(w) || (M.button.remove(), Ee.delete(w), Xe.delete(w));
    let c = o.firstElementChild;
    e.forEach((w, M) => {
      let P = Ee.get(w);
      if (!P) {
        const Ve = document.createElement("button"), Oe = document.createElement("div"), dt = document.createElement("div"), Ue = document.createElement("span");
        Ve.className = "clist-action-btn btn-small", Ve.dataset.slideId = w, dt.className = "mini-slide", Ue.className = "slide-number", Oe.append(Ue, dt), Ve.append(Oe), Ve.addEventListener("click", (Fe) => Qt(w, Fe)), P = { button: Ve, thumb: Oe, preview: dt, label: Ue }, Ee.set(w, P), Xe.add(w);
      }
      const { button: N, thumb: O, preview: $, label: ce } = P, he = "Slide " + (M + 1) + ". Ctrl/Cmd-click to toggle; Shift-click for a range. Drag to move selected slides.";
      N.title !== he && (N.title = he);
      const ae = e.length > 1 && !R;
      N.draggable !== ae && (N.draggable = ae);
      const Re = String(Ce.has(w));
      N.getAttribute("aria-pressed") !== Re && N.setAttribute("aria-pressed", Re), w === H ? N.hasAttribute("aria-current") || N.setAttribute("aria-current", "true") : N.hasAttribute("aria-current") && N.removeAttribute("aria-current");
      const He = "slide-thumb" + (Ce.has(w) ? " selected" : "") + (w === H ? " active-slide" : "");
      O.className !== He && (O.className = He), (V || Xe.has(w)) && ($.style.backgroundColor = zt(w), $.replaceChildren(), [...Te.get(w) || []].sort((Oe, dt) => Ze(L.get(Oe)) - Ze(L.get(dt)) || Oe.localeCompare(dt)).forEach((Oe, dt) => {
        const Ue = L.get(Oe), Fe = document.createElement("div");
        if (Fe.className = "mini-object", Fe.style.zIndex = String(dt), Fe.style.transform = `rotate(${Number(Ue.get("rotation")) || 0}deg)`, Fe.style.left = 100 * Ue.get("x") / E + "%", Fe.style.top = 100 * Ue.get("y") / A + "%", Fe.style.width = 100 * Ue.get("width") / E + "%", Fe.style.height = 100 * Ue.get("height") / A + "%", Ue.get("kind") === "shape") {
          const Qe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          Jt(Qe, Ue), Fe.append(Qe);
        } else if (Ue.get("kind") === "image") {
          const Qe = document.createElement("img");
          Qe.src = Ct(Ue.get("source")), Qe.alt = "", Qe.draggable = !1, bn(Qe, Ue), Fe.append(Qe);
        } else {
          const Qe = ht(Ue);
          Fe.style.color = Qe.colour, Fe.style.fontFamily = Mt[Qe.family], Fe.style.background = "transparent", Fe.textContent = C.getXmlFragment("slide-text-" + Oe).toString().replace(/<[^>]*>/g, " ");
        }
        $.append(Fe);
      })), ce.textContent !== String(M + 1) && (ce.textContent = String(M + 1)), c === N ? c = c.nextElementSibling : o.insertBefore(N, c);
    }), Xe.clear(), V = !1;
    const u = e.indexOf(H), k = Ce.size;
    s("slide-label").textContent = "Slide " + (u + 1) + " of " + e.length + (k > 1 ? " · " + k + " selected" : ""), s("duplicate-slide").disabled = R, s("duplicate-slide").title = k > 1 ? "Duplicate " + k + " selected slides" : "Duplicate the selected slide", s("delete-slide").disabled = R || k >= e.length, s("delete-slide").title = k >= e.length ? "At least one slide must remain" : k > 1 ? "Delete " + k + " selected slides" : "Delete selected slide", s("presentation-position").textContent = u + 1 + " / " + e.length, s("previous-slide").disabled = u <= 0, s("next-slide").disabled = u >= e.length - 1, ue?.refresh();
  }
  function we() {
    Uo();
    const e = Se();
    e.includes(H) || (xe(), B = null, I.clear(), H = e[0]), qt(), F.style.backgroundColor = zt(H), s("slide-background").value = zt(H);
    for (const [t, o] of Z)
      (!L.has(t) || (L.get(t).get("slide") || "first") !== H) && (o.disposePointer?.(), o.editor?.destroy(), o.node.remove(), Z.delete(t), I.delete(t), B === t && (B = [...I].at(-1) || null));
    L.forEach((t, o) => {
      !(t instanceof l.Map) || (t.get("slide") || "first") !== H || (Z.has(o) ? (Z.get(o).box = t, yn(o)) : Ho(o, t));
    }), ze(B, !1, !0), It();
  }
  function kn(e) {
    if (!Z.has(e)) return [];
    const t = L.get(e)?.get("groupId");
    return typeof t == "string" && t ? De().filter((o) => L.get(o).get("groupId") === t) : [e];
  }
  function $n(e = !1) {
    if (R || tt() || !I.size || !e && I.size < 2) return;
    xe();
    const t = "group-" + crypto.randomUUID();
    D?.stopCapturing(), C.transact(() => {
      for (const o of I)
        e ? L.get(o).delete("groupId") : L.get(o).set("groupId", t);
    }), D?.stopCapturing(), X(e ? "Selected objects ungrouped." : "Selected objects grouped.");
  }
  s("group-objects").addEventListener("click", () => $n()), s("ungroup-objects").addEventListener("click", () => $n(!0));
  function Sn(e, t) {
    const o = { ...e };
    return typeof o.groupId == "string" && o.groupId && (t.has(o.groupId) || t.set(o.groupId, "group-" + crypto.randomUUID()), o.groupId = t.get(o.groupId)), o;
  }
  function Xo(e = !1) {
    if (Je || R) return;
    const t = [...I].sort().map((k) => k + ":" + (L.get(k)?.get("kind") || "text")).join("|");
    if (!e && t === st) return;
    st = t;
    const o = L.get(B), a = I.size > 1 ? "arrange" : o ? o.get("kind") === "image" ? "images" : o.get("kind") === "shape" ? "appearance" : "text" : "slide", c = f.querySelector(".inspector"), u = c.querySelector('[data-panel="' + a + '"]');
    for (const k of c.querySelectorAll(":scope > .control-section")) k.open = k === u;
    u && (c.scrollTop += u.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientTop);
  }
  function ze(e, t = !1, o = !1, a = !1) {
    for (const ae of I) Z.has(ae) || I.delete(ae);
    if (t && e && Z.has(e)) {
      const ae = kn(e), Re = ae.every((He) => I.has(He));
      for (const He of ae)
        Re ? I.delete(He) : I.add(He);
    } else if (!o) {
      I.clear();
      for (const ae of kn(e)) I.add(ae);
    }
    if (o) for (const ae of [...I]) for (const Re of kn(ae)) I.add(Re);
    B = I.has(e) ? e : [...I].at(-1) || null;
    for (const [ae, Re] of Z) Re.node.classList.toggle("selected", I.has(ae));
    ke && !ke.current() && ke.destroy();
    const c = I.size > 1, u = tt();
    f.classList.toggle("multi-selection", c);
    const k = [...I].map((ae) => L.get(ae)?.get("groupId")), w = k.length > 1 && !!k[0] && k.every((ae) => ae === k[0]);
    s("group-objects").disabled = u || !c || w, s("ungroup-objects").disabled = u || !k.some(Boolean), s("lock-objects").disabled = !I.size || [...I].every((ae) => L.get(ae)?.get("locked") === !0), s("unlock-objects").disabled = !u, s("distribute-horizontal").disabled = s("distribute-vertical").disabled = u || I.size < 3;
    for (const ae of ["left", "center", "right", "top", "middle", "bottom"]) s("align-" + ae).disabled = u || !c;
    const M = B ? L.get(B) : null;
    oe?.update(M?.get("kind") === "image" && !c, !u && !R), s("selection-details") && (s("selection-details").textContent = c ? I.size + " objects selected. Drag an object or use arrow keys to move together." : M ? `${B}
Position: ${Math.round(M.get("x"))}, ${Math.round(M.get("y"))}
Size: ${Math.round(M.get("width"))} × ${Math.round(M.get("height"))}` : "Select an object"), s("keep-aspect-ratio").disabled = u || c || M?.get("kind") !== "image", s("keep-aspect-ratio").checked = M?.get("kind") === "image" && M.get("keepAspectRatio") !== !1;
    const P = M ? gn(M) : { fit: "contain" }, N = u || c || M?.get("kind") !== "image";
    s("image-description").disabled = N;
    const O = !c && M?.get("kind") === "image" && typeof M.get("alt") == "string" ? M.get("alt") : "";
    s("image-description").value !== O && (s("image-description").value = O), s("replace-image").disabled = N, s("crop-image").disabled = N, s("image-fit").disabled = N, s("image-fit").value = P.fit, s("cut-objects").disabled = !I.size || u, s("copy-objects").disabled = !I.size, lo(), s("paste-objects").disabled = !re?.items.length, s("duplicate").disabled = !B || c, s("delete").disabled = u || !B;
    const $ = De(), ce = $.indexOf(B);
    s("bring-forward").disabled = u || c || ce < 0 || ce === $.length - 1, s("send-backward").disabled = u || c || ce <= 0, s("bold").disabled = c || !Z.get(B)?.editor, s("italic").disabled = c || !Z.get(B)?.editor, s("edit-link").disabled = c || !Z.get(B)?.editor, s("remove-link").disabled = c || !Z.get(B)?.editor, Me && B !== Me && ro(), s("bullet-list").disabled = c || !Z.get(B)?.editor, s("ordered-list").disabled = c || !Z.get(B)?.editor;
    for (const ae of ["font-family", "font-size", "text-colour", "text-align"]) s(ae) && (s(ae).disabled = c || !Z.get(B)?.editor);
    const he = M && !c && (!!Z.get(B)?.editor || M.get("kind") === "shape");
    for (const ae of ["fill-enabled", "fill-colour", "border-enabled", "border-colour", "border-width"]) s(ae).disabled = !he;
    if (he) {
      const ae = Et(M);
      s("fill-enabled").checked = ae.fill, s("fill-colour").value = ae.fillColour, s("fill-colour").disabled = !ae.fill, s("border-enabled").checked = ae.border, s("border-colour").value = ae.borderColour, s("border-width").value = String(ae.width), s("border-colour").disabled = s("border-width").disabled = !ae.border;
    }
    if (M && !c && Z.get(B)?.editor) {
      const ae = ht(M);
      s("font-family").value = ae.family, s("font-size").value = String(Math.round(ae.size)), s("text-colour").value = ae.colour, s("text-align") && (s("text-align").value = ae.align);
    }
    Xn(), Xo(a), _e?.schedule(), wt();
  }
  function wt() {
    const e = I.size === 1 ? Z.get(B) : null;
    _?.update(I.size === 0 && !R), q?.update(R ? [] : [...I].map((u) => L.get(u)).filter(Boolean), !!e && e.box.get("kind") !== "image");
    const t = e?.editor, o = !!t && !t.isDestroyed && !R, a = e ? ht(e.box) : {}, c = o ? t.getAttributes("slideTextStyle") : {};
    ee?.update(o, { family: c.fontFamily || a.family, size: c.fontSize || a.size, colour: c.textColour || a.colour, highlight: c.highlightColour }, !!t && t.isEditable && e.box.get("locked") !== !0);
  }
  function en(e, t, o) {
    if (R || e.button !== 0) return;
    if (e.preventDefault(), e.stopPropagation(), D?.stopCapturing(), D && (D.captureTimeout = 1 / 0), ze(t, !1, o === "move" && I.has(t), !0), tt()) {
      xe(), X("Unlock selected objects before moving or resizing.", "error");
      return;
    }
    Z.get(t)?.node.focus({ preventScroll: !0 });
    const a = L.get(t);
    if (!a) return;
    (o === "resize" || o.startsWith("edge-")) && Un(a);
    const c = E / F.getBoundingClientRect().width, u = [...I].map((w) => ({ id: w, ...L.get(w).toJSON() })), k = tn(u);
    fe = {
      imageMode: oe?.mode || "resize",
      imageCrop: Kt(a),
      rotation: Number(a.get("rotation")) || 0,
      members: u,
      id: t,
      action: o,
      startX: e.clientX,
      startY: e.clientY,
      scale: c,
      original: o === "move" ? k : {
        x: a.get("x"),
        y: a.get("y"),
        width: a.get("width"),
        height: a.get("height")
      }
    }, fe.target = e.currentTarget, fe.pointerId = e.pointerId, e.currentTarget.setPointerCapture(e.pointerId), e.currentTarget.addEventListener("pointermove", Jn), e.currentTarget.addEventListener("pointerup", xe, { once: !0 }), e.currentTarget.addEventListener("pointercancel", xe, { once: !0 });
  }
  function tn(e) {
    const t = Math.min(...e.map((a) => a.x)), o = Math.min(...e.map((a) => a.y));
    return { x: t, y: o, width: Math.max(...e.map((a) => a.x + a.width)) - t, height: Math.max(...e.map((a) => a.y + a.height)) - o };
  }
  function tt() {
    return [...I].some((e) => L.get(e)?.get("locked") === !0);
  }
  function Vn(e) {
    R || !I.size || (xe(), C.transact(() => {
      for (const t of I) L.get(t)?.set("locked", e);
    }), X(e ? "Selected objects locked." : "Selected objects unlocked."));
  }
  s("lock-objects").addEventListener("click", () => Vn(!0)), s("unlock-objects").addEventListener("click", () => Vn(!1));
  function nn(e) {
    const t = (Number(e.rotation) || 0) * Math.PI / 180, o = Math.abs(e.width * Math.cos(t)) + Math.abs(e.height * Math.sin(t)), a = Math.abs(e.width * Math.sin(t)) + Math.abs(e.height * Math.cos(t));
    return { x: e.x + (e.width - o) / 2, y: e.y + (e.height - a) / 2, width: o, height: a };
  }
  function $o(e) {
    if (R || tt() || I.size < 2) return;
    xe();
    const t = [...I].map((a) => ({ id: a, ...L.get(a).toJSON() })), o = tn(t.map(nn));
    D?.stopCapturing(), C.transact(() => {
      for (const a of t) {
        const c = L.get(a.id), u = nn(a);
        let k = 0, w = 0;
        e === "left" && (k = o.x - u.x), e === "center" && (k = o.x + o.width / 2 - u.x - u.width / 2), e === "right" && (k = o.x + o.width - u.x - u.width), e === "top" && (w = o.y - u.y), e === "middle" && (w = o.y + o.height / 2 - u.y - u.height / 2), e === "bottom" && (w = o.y + o.height - u.y - u.height), ["left", "center", "right"].includes(e) ? c.set("x", a.x + k) : c.set("y", a.y + w);
      }
    }, "geometry"), D?.stopCapturing();
  }
  for (const e of ["left", "center", "right", "top", "middle", "bottom"])
    s("align-" + e).addEventListener("click", () => $o(e));
  function Kn(e) {
    if (R || tt() || I.size < 3) return;
    xe();
    const t = e ? "y" : "x", o = e ? "height" : "width", a = [...I].map((N) => {
      const O = L.get(N).toJSON();
      return { id: N, box: O, bounds: nn(O) };
    }).sort((N, O) => N.bounds[t] - O.bounds[t] || N.id.localeCompare(O.id)), c = a[0], u = a[a.length - 1], k = c.bounds[t], w = u.bounds[t] + u.bounds[o], M = a.reduce((N, O) => N + O.bounds[o], 0), P = (w - k - M) / (a.length - 1);
    if (P < -1e-6) {
      const O = "Not enough room " + (e ? "vertically" : "horizontally") + ": the objects need " + Math.ceil(M) + " px, but their outer edges span only " + Math.floor(w - k) + " px. Move the outermost objects farther apart or make the objects smaller.";
      s("distribution-status").textContent = O, X(O, "error");
      return;
    }
    D?.stopCapturing(), C.transact(() => {
      let N = k + c.bounds[o] + Math.max(0, P);
      for (let O = 1; O < a.length - 1; O++) {
        const $ = a[O];
        L.get($.id).set(t, $.box[t] + N - $.bounds[t]), N += $.bounds[o] + Math.max(0, P);
      }
    }, "geometry"), D?.stopCapturing(), s("distribution-status").textContent = "Distributed " + a.length + " objects " + (e ? "vertically" : "horizontally") + " with " + Math.round(Math.max(0, P)) + " px gaps.";
  }
  s("distribute-horizontal").addEventListener("click", () => Kn(!1)), s("distribute-vertical").addEventListener("click", () => Kn(!0));
  function En() {
    if (R) return;
    if (tt()) {
      X("Unlock selected objects before deleting.", "error");
      return;
    }
    const e = [...I];
    C.transact(() => e.forEach((t) => L.delete(t)));
  }
  function Gn(e, t, o, a, c) {
    let u = { position: e, guide: null }, k = a + 1e-6;
    for (const w of o)
      for (const M of [0, t / 2, t]) {
        const P = w - M, N = Math.abs(P - e);
        P >= 0 && P <= c - t && N < k && (k = N, u = { position: P, guide: w });
      }
    return u;
  }
  function Vo(e, t, o, a, c, u) {
    const k = [0, E / 2, E], w = [0, A / 2, A];
    for (const M of De()) {
      if (M === e || I.has(M)) continue;
      const P = L.get(M), N = Number(P.get("x")), O = Number(P.get("y")), $ = Number(P.get("width")), ce = Number(P.get("height"));
      [N, O, $, ce].every(Number.isFinite) && (k.push(N, N + $ / 2, N + $), w.push(O, O + ce / 2, O + ce));
    }
    return { x: Gn(t, a, k, u, E), y: Gn(o, c, w, u, A) };
  }
  function Jn(e) {
    if (!fe) return;
    if (tt()) {
      xe(), X("Movement stopped because an object was locked.", "error");
      return;
    }
    const { id: t, action: o, startX: a, startY: c, scale: u, original: k } = fe, w = L.get(t);
    if (!w) return;
    const M = (e.clientX - a) * u, P = (e.clientY - c) * u;
    C.transact(() => {
      if (o.startsWith("edge-")) {
        const N = w.get("kind") === "image" && fe.imageMode === "crop" ? fe.imageCrop : { width: E, height: A }, O = yr(k, o.slice(5), M, P, fe.rotation, {
          minWidth: Z.get(t)?.editor ? 100 : 1,
          minHeight: Z.get(t)?.editor ? 55 : 1,
          maxWidth: Math.max(k.width, N.width),
          maxHeight: Math.max(k.height, N.height)
        });
        for (const [$, ce] of Object.entries(O)) w.set($, ce);
      } else if (o === "rotate")
        w.set("rotation", So(fe.rotation, e.clientX - a));
      else if (o === "move") {
        let N = Math.max(0, Math.min(E - k.width, k.x + M)), O = Math.max(0, Math.min(A - k.height, k.y + P));
        if (T.hidden = z.hidden = !0, !e.altKey) {
          const $ = Vo(t, N, O, k.width, k.height, 6 * u);
          N = $.x.position, O = $.y.position, $.x.guide !== null && (T.hidden = !1, T.style.left = 100 * $.x.guide / E + "%"), $.y.guide !== null && (z.hidden = !1, z.style.top = 100 * $.y.guide / A + "%");
        }
        for (const $ of fe.members) {
          const ce = L.get($.id);
          ce && (ce.set("x", Math.round($.x + N - k.x)), ce.set("y", Math.round($.y + O - k.y)));
        }
      } else if (w.get("kind") === "image" && (fe.imageMode === "resize" || w.get("keepAspectRatio") !== !1)) {
        const N = fe.imageMode === "resize" ? k.width / k.height : so(w), O = Math.abs(M / k.width) >= Math.abs(P / k.height) ? k.width + M : (k.height + P) * N, $ = w.get("kind") === "image" && fe.imageMode === "crop" ? fe.imageCrop : { width: E, height: A }, ce = _o(O, N, Math.min(E - k.x, $.width), Math.min(A - k.y, $.height));
        w.set("width", ce.width), w.set("height", ce.height);
      } else {
        const N = Z.get(t)?.editor ? 100 : 1, O = Z.get(t)?.editor ? 55 : 1, $ = w.get("kind") === "image" && fe.imageMode === "crop" ? fe.imageCrop : { width: E, height: A };
        w.set("width", Math.max(N, Math.min(E - k.x, $.width, k.width + M))), w.set("height", Math.max(O, Math.min(A - k.y, $.height, k.height + P)));
      }
      if (w.get("kind") === "image" && (o === "resize" || o.startsWith("edge-"))) {
        const N = { width: w.get("width"), height: w.get("height") };
        for (const [O, $] of Object.entries(gr(k, N, fe.imageMode, fe.imageCrop))) w.set(O, $);
      }
    }, "geometry");
  }
  function xe(e) {
    Ie?.cancel(), T.hidden = z.hidden = !0;
    const t = fe?.target || e?.currentTarget;
    t?.removeEventListener("pointermove", Jn), t?.removeEventListener("pointerup", xe), t?.removeEventListener("pointercancel", xe), fe && t?.hasPointerCapture(fe.pointerId) && t.releasePointerCapture(fe.pointerId), fe = null, D && (D.captureTimeout = 500, D.stopCapturing());
  }
  C.on("beforeObserverCalls", Yt), L.observeDeep(we), U.observe(we), le.observe(we), G.observe(we), K.observe(Ut), J.observe(qt), C.on("update", It), C.on("update", kt), s("add-slide").addEventListener("click", () => {
    if (!R) {
      xe();
      try {
        if (v.has(s("slide-layout").value)) {
          Qo(v.get(s("slide-layout").value));
          return;
        }
        const e = Se(), t = "slide-" + crypto.randomUUID(), o = h.get(s("slide-layout").value) || h.values().next().value, a = o.objects.map((u) => ({ ...u, id: nt() })), c = /* @__PURE__ */ new Map();
        H = t, B = null, I.clear(), D?.stopCapturing(), C.transact(() => {
          U.size || U.set("first", 0), U.set(t, Math.max(...e.map((u) => U.get(u) || 0)) + 1), o.background !== void 0 && G.set(t, o.background), o.notes !== void 0 && J.set(t, o.notes);
          for (const u of a) {
            const { id: k, text: w, shapeId: M, group: P, ...N } = u, $ = { ...u.kind === "shape" ? Wn(x.get(M)) : {}, rotation: 0, ...N, slide: t, layer: Math.max(-1, ...De().map((ce) => Ze(L.get(ce)))) + 1 };
            P && (c.has(P) || c.set(P, "group-" + crypto.randomUUID()), $.groupId = c.get(P)), u.kind === "image" && ($.aspectRatio = u.width / u.height), L.set(k, new l.Map(Object.entries($)));
          }
        });
        for (const u of a) {
          if (u.kind !== "text") continue;
          const k = u.text.split(`
`).map((w) => ({ type: "paragraph", content: w ? [{ type: "text", text: w }] : [] }));
          Z.get(u.id).editor.commands.setContent({ type: "doc", content: k });
        }
        D?.stopCapturing(), we();
      } catch (e) {
        console.error("Slides layout failed:", e), X("Could not create slide: " + e.message, "error");
      }
    }
  }), s("duplicate-slide").addEventListener("click", () => {
    if (!R) {
      xe();
      try {
        const e = Zt(), t = Se(), o = e.map((c) => {
          const u = "slide-" + crypto.randomUUID(), k = /* @__PURE__ */ new Map(), w = De(c).map((M) => {
            const P = new l.Map(Object.entries(Sn(L.get(M).toJSON(), k)));
            P.set("slide", u);
            const N = nt(), O = C.getXmlFragment("slide-text-" + N), $ = C.getXmlFragment("slide-text-" + M).toArray().map((ce) => ce.clone());
            return D?.addToScope(O), { id: N, box: P, fragment: O, text: $ };
          });
          return { source: c, id: u, copies: w };
        }), a = o.map((c) => c.id);
        t.splice(t.indexOf(e.at(-1)) + 1, 0, ...a), yt(a), D?.stopCapturing(), C.transact(() => {
          t.forEach((c, u) => U.set(c, u));
          for (const c of o) {
            G.has(c.source) && G.set(c.id, G.get(c.source)), typeof J.get(c.source) == "string" && J.set(c.id, J.get(c.source));
            for (const u of c.copies)
              L.set(u.id, u.box), u.text.length && u.fragment.insert(0, u.text);
          }
        }), D?.stopCapturing(), we(), Bt(o.length === 1 ? "Slide duplicated" : o.length + " slides duplicated"), Tt();
      } catch (e) {
        console.error("Slides duplication failed:", e), X("Could not duplicate slide: " + e.message, "error");
      }
    }
  });
  function Ko(e) {
    if (R) return;
    xe();
    const t = Se(), o = Wr(t, Zt(), e);
    o.every((a, c) => a === t[c]) || (D?.stopCapturing(), C.transact(() => o.forEach((a, c) => U.set(a, c))), D?.stopCapturing(), Tt());
  }
  s("delete-slide").addEventListener("click", () => {
    const e = Zt(), t = Se();
    if (e.length >= t.length || R) return;
    const o = () => Go(e);
    if (typeof window.buildDialogModal == "function") {
      const a = document.createElement("p");
      a.textContent = e.length === 1 ? "Delete slide " + (t.indexOf(e[0]) + 1) + "? Its objects and speaker notes will be removed." : "Delete " + e.length + " selected slides? Their objects and speaker notes will be removed.", window.buildDialogModal(e.length === 1 ? "Delete slide" : "Delete slides", a, [
        { label: "Cancel", secondary: !0, onClick: (c) => c() },
        { label: e.length === 1 ? "Delete slide" : "Delete slides", onClick: (c) => {
          c(), o();
        } }
      ]);
    } else {
      const a = document.createElement("dialog"), c = document.createElement("p");
      c.textContent = "Delete " + e.length + " selected slide(s)?", a.append(c);
      for (const [u, k, w] of [["Cancel", !0, () => {
      }], ["Delete slides", !1, o]]) {
        const M = document.createElement("button");
        M.className = k ? "btn-small btn-secondary" : "btn-small", M.textContent = u, M.addEventListener("click", () => {
          a.close(), a.remove(), w();
        }), a.append(M);
      }
      a.addEventListener("cancel", () => a.remove(), { once: !0 }), document.body.append(a), a.showModal();
    }
  });
  function Go(e) {
    const t = Se(), o = new Set(t.filter((k) => e.includes(k)));
    if (R || !o.size || o.size >= t.length) return;
    xe();
    const a = t.filter((k) => !o.has(k)), c = a[Math.min(t.indexOf(H), a.length - 1)], u = [...L].filter(([, k]) => o.has(k.get("slide") || "first") && (!k.get("kind") || k.get("kind") === "text")).map(([k]) => C.getXmlFragment("slide-text-" + k));
    for (const k of u) D?.addToScope(k);
    yt([c]), D?.stopCapturing(), C.transact(() => {
      L.forEach((k, w) => {
        o.has(k.get("slide") || "first") && L.delete(w);
      });
      for (const k of u) k.length && k.delete(0, k.length);
      U.size || t.forEach((k, w) => U.set(k, w));
      for (const k of o)
        U.delete(k), G.delete(k), J.delete(k);
    }), D?.stopCapturing(), we(), Tt();
  }
  s("save-layout").disabled = typeof i.onSaveLayout != "function", s("save-layout").addEventListener("click", () => i.onSaveLayout?.());
  function Ct(e) {
    return typeof e == "string" && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(e) ? e : "";
  }
  async function Cn(e) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(e.type)) throw new Error("Choose a PNG, JPEG, GIF, or WebP image.");
    const t = await new Promise((a, c) => {
      const u = new FileReader();
      u.onload = () => a(u.result), u.onerror = () => c(u.error || new Error("Could not read the image.")), u.onabort = () => c(new Error("Image reading was cancelled.")), u.readAsDataURL(e);
    });
    if (!Ct(t)) throw new Error("Unsupported image data.");
    const o = new Image();
    return o.src = t, await o.decode(), { source: t, image: o };
  }
  s("image-description").addEventListener("input", (e) => {
    const t = L.get(B);
    R || I.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || t.set("alt", e.target.value.slice(0, 2e3));
  }), s("replace-image").addEventListener("click", () => {
    const e = L.get(B);
    R || I.size !== 1 || e?.get("kind") !== "image" || e.get("locked") === !0 || (ve = { document: C, id: B }, s("replace-image-file").click());
  }), s("replace-image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0], o = ve;
    if (ve = null, !(!t || !o))
      try {
        const { source: a, image: c } = await Cn(t), u = L.get(o.id);
        if (C !== o.document || u?.get("kind") !== "image") throw new Error("The original image is no longer available.");
        if (R || u.get("locked") === !0) throw new Error("Return to editing and unlock the image before replacing it.");
        D?.stopCapturing(), C.transact(() => {
          if (u.set("source", a), u.set("imageRatio", c.naturalWidth / c.naturalHeight), u.set("aspectRatio", u.get("width") / u.get("height")), u.delete("cropImageWidth"), u.delete("cropImageHeight"), u.get("imageFit") === "cover") {
            const k = Math.max(u.get("width"), u.get("height") * c.naturalWidth / c.naturalHeight);
            u.set("cropImageWidth", k), u.set("cropImageHeight", k * c.naturalHeight / c.naturalWidth);
          }
        }), D?.stopCapturing(), X("Image replaced.");
      } catch (a) {
        console.error("Slides image replacement failed:", a), X("Could not replace image: " + a.message, "error");
      } finally {
        e.target.value = "";
      }
  }), s("add-image").addEventListener("click", () => {
    try {
      Ne.image();
    } catch (e) {
      X("Could not open image picker: " + e.message, "error");
    }
  }), s("image-file").addEventListener("change", async (e) => {
    const t = e.target.files[0];
    if (!t) return;
    const o = C, a = H;
    try {
      const { source: c, image: u } = await Cn(t);
      if (C !== o || !Se().includes(a)) throw new Error("The destination slide is no longer open.");
      if (R) throw new Error("Return to editing before adding an image.");
      H = a;
      const k = Math.min(1, 800 / u.naturalWidth, 500 / u.naturalHeight), w = Math.max(1, Math.round(u.naturalWidth * k)), M = Math.max(1, Math.round(u.naturalHeight * k)), P = nt();
      St(P, (E - w) / 2, (A - M) / 2, w, M, c, t.name), ze(P), X("Image added");
    } catch (c) {
      console.error("Slides image could not load:", c), X("Image could not load: " + c.message, "error");
    } finally {
      e.target.value = "";
    }
  });
  function An() {
    if (!(R || !I.size))
      try {
        const e = new l.Doc(), t = De().filter((a) => I.has(a)).map((a, c) => {
          const u = C.getXmlFragment("slide-text-" + a).toArray().map((k) => k.clone());
          return u.length && e.getXmlFragment("text-" + c).insert(0, u), { data: L.get(a).toJSON(), index: c };
        }), o = new Set(t.flatMap((a) => a.data.referenceUrls || []));
        for (const a of an()) o.has(a.url) && e.getMap("clist_refs").set(a.url, JSON.stringify(a));
        return re?.document.destroy(), re = { document: e, items: t, sourceDocument: C, sourceSlide: H, pastes: 0, token: crypto.randomUUID() }, s("paste-objects").disabled = !1, X("Copied " + t.length + " object" + (t.length === 1 ? "." : "s.")), !0;
      } catch (e) {
        return console.error("Slides object copy failed:", e), X("Could not copy objects: " + e.message, "error"), !1;
      }
  }
  function Yn() {
    if (!(R || !re?.items.length)) {
      xe();
      try {
        const e = tn(re.items.map((M) => M.data)), t = re.cut && re.pastes === 0 ? 0 : re.sourceDocument === C && re.sourceSlide === H ? 28 * (re.pastes + 1) : 28 * re.pastes, o = ie?.document === C && ie.slide === H ? ie : null, { x: a, y: c } = fr(e, o, E, A, t), u = Math.max(-1, ...De().map((M) => Ze(L.get(M)))), k = /* @__PURE__ */ new Map(), w = re.items.map((M, P) => {
          const N = nt(), O = new l.Map(Object.entries({ ...Sn(M.data, k), slide: H, x: M.data.x + a, y: M.data.y + c, layer: u + P + 1 })), $ = C.getXmlFragment("slide-text-" + N);
          D?.addToScope($);
          const ce = re.document.getXmlFragment("text-" + M.index).toArray().map((he) => he.clone());
          return { id: N, box: O, fragment: $, text: ce };
        });
        D?.stopCapturing(), C.transact(() => {
          re.document.getMap("clist_refs").forEach((M) => {
            try {
              sn([JSON.parse(M)]);
            } catch {
            }
          });
          for (const M of w)
            L.set(M.id, M.box), M.text.length && M.fragment.insert(0, M.text);
        }), D?.stopCapturing(), re.pastes++, I.clear();
        for (const M of w) I.add(M.id);
        B = w[w.length - 1].id, ze(B, !1, !0), f.tabIndex = -1, f.focus({ preventScroll: !0 }), X("Pasted " + w.length + " object" + (w.length === 1 ? "." : "s."));
      } catch (e) {
        console.error("Slides object paste failed:", e), X("Could not paste objects: " + e.message, "error");
      }
    }
  }
  function _n(e = null) {
    if (!(R || !I.size)) {
      if (tt()) {
        X("Unlock selected objects before cutting.", "error");
        return;
      }
      if (An())
        try {
          e && Zn(e), re.cut = !0;
          const t = I.size;
          D?.stopCapturing(), En(), D?.stopCapturing(), f.tabIndex = -1, f.focus({ preventScroll: !0 }), X("Cut " + t + " object" + (t === 1 ? "." : "s."));
        } catch (t) {
          console.error("Slides object cut failed:", t), X("Could not cut objects: " + t.message, "error");
        }
    }
  }
  s("cut-objects").addEventListener("click", () => _n()), s("copy-objects").addEventListener("click", An), s("paste-objects").addEventListener("click", Yn);
  function Jo(e) {
    return e.isContentEditable || !!e.closest?.('input, textarea, select, [contenteditable="true"]');
  }
  function Zn(e) {
    e.clipboardData.setData("application/x-clist-slide-objects", re.token), e.clipboardData.setData("text/plain", re.items.map((t) => re.document.getXmlFragment("text-" + t.index).toString().replace(/<[^>]*>/g, " ") || t.data.alt || "Slide object").join(`
`)), e.preventDefault(), e.stopImmediatePropagation();
  }
  function Qn(e) {
    if (!(R || !I.size || !e.clipboardData || !f.getClientRects().length) && ko(f, e.target, document.activeElement, document) && An())
      try {
        Zn(e);
      } catch (t) {
        console.error("Slides clipboard write failed:", t), X("Could not write objects to clipboard: " + t.message, "error");
      }
  }
  document.addEventListener("copy", Qn, !0);
  function eo(e) {
    R || !I.size || !e.clipboardData || !f.getClientRects().length || ko(f, e.target, document.activeElement, document) && (e.preventDefault(), e.stopImmediatePropagation(), _n(e));
  }
  document.addEventListener("cut", eo, !0);
  function to(e) {
    if (R || !e.clipboardData || !f.getClientRects().length) return;
    const t = f.contains(e.target), o = e.target === document.body || e.target === document.documentElement || e.target === document;
    if (!t && !(o && (f.contains(document.activeElement) || Pe)) || !t && document.activeElement?.closest?.('input, textarea, select, [contenteditable="true"]') || e.target.closest?.("input, textarea, select")) return;
    const a = e.target.closest?.(".slide-object");
    if (Jo(e.target) && a && I.has(a.dataset.id) && Ae === a.dataset.id) return;
    const u = e.clipboardData.getData("application/x-clist-slide-objects");
    if (u && u === re?.token) {
      e.preventDefault(), e.stopImmediatePropagation(), Yn();
      return;
    }
    const k = e.clipboardData.getData("text/plain");
    if (k) {
      e.preventDefault(), e.stopImmediatePropagation();
      try {
        xe(), D?.stopCapturing();
        const w = nt(), M = k.replace(/\r\n?/g, `
`).split(`
`).map((ce) => ({
          type: "paragraph",
          content: ce ? [{ type: "text", text: ce }] : []
        })), P = M.reduce((ce, he) => ce + Math.max(1, Math.ceil((he.content[0]?.text.length || 0) / 45)), 0), N = 690, O = Math.min(500, Math.max(100, P * 42)), $ = ie?.document === C && ie.slide === H ? ie : { x: 160, y: 160 };
        St(w, Math.max(0, Math.min(E - N, $.x)), Math.max(0, Math.min(A - O, $.y)), N, O), Z.get(w).editor.commands.setContent({ type: "doc", content: M }), D?.stopCapturing(), ze(w), Z.get(w).editor.commands.focus("end"), X("Pasted text into a new text box.");
      } catch (w) {
        console.error("Slides text paste failed:", w), X("Could not paste text: " + w.message, "error");
      }
    }
  }
  document.addEventListener("paste", to, !0);
  function no(e) {
    const t = F.getBoundingClientRect();
    t.width <= 0 || t.height <= 0 || e.clientX < t.left || e.clientX > t.right || e.clientY < t.top || e.clientY > t.bottom || (ie = { document: C, slide: H, x: Math.round((e.clientX - t.left) * E / t.width), y: Math.round((e.clientY - t.top) * A / t.height) });
  }
  f.addEventListener("pointermove", no), _e = Mr(f, F, {
    views: () => [...Z.values()],
    selected: () => [...I].map((e) => Z.get(e)).filter(Boolean),
    presenting: () => R,
    size: (e) => ht(e).size,
    error: (e) => X("Could not fit text: " + e.message, "error"),
    apply: (e) => {
      e.length && (D?.stopCapturing(), C.transact(() => {
        for (const { box: t, view: o, size: a, scale: c } of e) {
          t.set("fontSize", a);
          const u = o.editor, k = u.schema.marks.slideTextStyle, w = u.state.tr;
          u.state.doc.descendants((M, P) => {
            if (!M.isText) return;
            const N = M.marks.find((O) => O.type === k);
            N?.attrs.fontSize && w.addMark(P, P + M.nodeSize, k.create({ ...N.attrs, fontSize: Po(N.attrs.fontSize, c) }));
          }), w.docChanged && u.view.dispatch(w);
        }
      }), D?.stopCapturing(), wt());
    }
  }), Ie = Nr(f, F, {
    selected: () => [...I],
    slideId: () => H,
    objects: () => De().map((e) => ({ id: e, ...nn(L.get(e).toJSON()) })),
    select: (e) => {
      I.clear();
      for (const t of e) Z.has(t) && I.add(t);
      ze(e.at(-1) || null, !1, !0);
    }
  }), f.addEventListener("pointerdown", (e) => {
    const t = e.target;
    e.button !== 0 || R || !t.closest?.(".canvas-space") || t.closest(".slide-crop-stage, .slide-object, input, textarea, select, button, a") || (e.preventDefault(), Pe = !0, no(e), xe(), t === F && Ie.begin(e), e.shiftKey || ze(null), Ae = null, f.contains(document.activeElement) && document.activeElement.blur?.(), window.getSelection()?.removeAllRanges(), f.tabIndex = -1, f.focus({ preventScroll: !0 }));
  }, !0);
  function oo(e) {
    if (R) return;
    const t = x.get(e);
    if (!t) {
      X("This shape is not available in the catalog.", "error");
      return;
    }
    const o = nt(), { width: a, height: c } = t, u = new l.Map(Object.entries({ ...Wn(t), slide: H, x: Math.min(160, E - a), y: Math.min(180, A - c), width: a, height: c, rotation: 0, layer: Math.max(-1, ...De().map((k) => Ze(L.get(k)))) + 1 }));
    L.set(o, u), ze(o), Z.get(o).node.focus({ preventScroll: !0 });
  }
  function nt() {
    return `box-${crypto.randomUUID()}`;
  }
  s("add-text").addEventListener("click", () => {
    const e = nt();
    St(e, 160, 220, 430, 130), ze(e), Z.get(e)?.editor.commands.focus();
  }), s("duplicate").addEventListener("click", () => {
    if (R || !B) return;
    const e = B, t = L.get(e), o = nt(), a = new l.Map(Object.entries({ ...t.toJSON(), locked: !1, x: Math.min(E - t.get("width"), t.get("x") + 28), y: Math.min(A - t.get("height"), t.get("y") + 28), layer: Math.max(...De().map((k) => Ze(L.get(k)))) + 1 }));
    a.delete("groupId");
    const c = C.getXmlFragment("slide-text-" + o);
    D?.addToScope(c);
    const u = C.getXmlFragment("slide-text-" + e).toArray().map((k) => k.clone());
    C.transact(() => {
      L.set(o, a), u.length && c.insert(0, u);
    }), ze(o);
  }), s("delete").addEventListener("click", En);
  function Ht(e) {
    const t = Z.get(B), o = t?.editor;
    if (R || !o || I.size !== 1 || t.box.get("locked") === !0) return;
    const a = o.state.selection.empty;
    try {
      D?.stopCapturing(), e(a ? o.chain().selectAll() : o.chain()).run(), a && o.commands.setTextSelection(o.state.selection.from), D?.stopCapturing(), on(o), wt();
    } catch (c) {
      console.error("Slides text formatting:", c), X("Could not format selected text: " + c.message, "error");
    }
  }
  function on(e) {
    if (e.isDestroyed) return;
    const { from: t, to: o } = e.state.selection;
    e.commands.setTextSelection({ from: t, to: o }), e.view.focus();
  }
  s("bold").addEventListener("click", () => Ht((e) => e.toggleBold())), s("italic").addEventListener("click", () => Ht((e) => e.toggleItalic())), s("bullet-list").addEventListener("click", () => Ht((e) => e.toggleBulletList())), s("ordered-list").addEventListener("click", () => Ht((e) => e.toggleOrderedList()));
  function ro() {
    qe?.close(), Me = null;
  }
  s("edit-link").addEventListener("click", () => qe?.open()), s("remove-link").addEventListener("click", () => Ht((e) => e.unsetLink())), f.addEventListener("click", (e) => {
    const t = e.target.closest?.(".text-content a");
    if (!R || !t) return;
    e.preventDefault(), e.stopImmediatePropagation();
    const o = t.getAttribute("href") || "";
    zo(o) ? window.open(o, "_blank", "noopener,noreferrer") : (console.error("Slides blocked unsupported link:", o), s("presentation-status").textContent = "This link has an unsupported URL.");
  }, !0);
  function io(e) {
    if (R || tt() || !B) return;
    const t = De(), o = t.indexOf(B);
    o < 0 || !t[o + e] || ([t[o], t[o + e]] = [t[o + e], t[o]], C.transact(() => t.forEach((a, c) => L.get(a).set("layer", c)), "layer"));
  }
  s("bring-forward").addEventListener("click", () => io(1)), s("send-backward").addEventListener("click", () => io(-1));
  function Yo(e, t) {
    const o = L.get(B);
    R || I.size !== 1 || o?.get("kind") !== "image" || o.get("locked") === !0 || C.transact(() => {
      t === "cover" && o.get("imageFit") !== "cover" ? (o.delete("cropImageWidth"), o.delete("cropImageHeight"), o.set(e, t), Un(o)) : o.set(e, t);
    });
  }
  s("image-fit").addEventListener("change", (e) => {
    ["contain", "cover"].includes(e.target.value) && Yo("imageFit", e.target.value);
  });
  function ao() {
    const e = B, t = L.get(e), o = Z.get(e);
    if (R || I.size !== 1 || t?.get("kind") !== "image" || t.get("locked") || !o) return;
    ke?.destroy(), xe();
    const a = Ct(t.get("source"));
    if (!a) return;
    const c = C, u = H, k = i.captureSession?.(), w = JSON.stringify(t.toJSON()), M = Number(t.get("imageRatio")) || t.get("width") / t.get("height"), P = vr(t, M), N = Math.min(E, A * M, t.get("width") / P.width), O = N / M, $ = Math.max(0, Math.min(E - N, t.get("x") - N * P.x)), ce = Math.max(0, Math.min(A - O, t.get("y") - O * P.y)), he = document.createElement("div");
    he.className = "slide-direct-crop", he.style.left = 100 * $ / E + "%", he.style.top = 100 * ce / A + "%", he.style.width = 100 * N / E + "%", he.addEventListener("pointerdown", (Oe) => Oe.stopPropagation()), F.append(he), o.content.style.visibility = "hidden", f.classList.add("cropping-image");
    const ae = () => f.isConnected && !R && C === c && H === u && B === e && I.size === 1 && L.get(e) === t && JSON.stringify(t.toJSON()) === w && (!i.sessionCurrent || i.sessionCurrent(k));
    let Re = null, He = !1;
    const Ve = () => {
      He || (He = !0, Re?.destroy(), he.remove(), o.content.style.visibility = "", f.classList.remove("cropping-image"), ke = null);
    };
    ke = { current: ae, destroy: Ve }, Re = Io({ container: he, actionsContainer: f.querySelectorAll(".slide-menu-bar")[1], source: a, ratio: M, initial: P, current: ae, onCancel: Ve, onDone: (Oe) => {
      if (!ae()) {
        Ve();
        return;
      }
      const dt = ["x", "y", "width", "height"].every((Fe) => Math.abs(Oe[Fe] - P[Fe]) < 1e-8);
      if (Ve(), dt) return;
      const Ue = Pn(Oe, N, O);
      D?.stopCapturing(), C.transact(() => {
        for (const [Fe, Qe] of Object.entries(Ue)) t.set(Fe, Qe);
        t.set("x", $ + N * Oe.x), t.set("y", ce + O * Oe.y);
      }), D?.stopCapturing(), ze(e), X("Image cropped.");
    } });
  }
  s("crop-image").addEventListener("click", ao);
  function so(e) {
    const t = Number(e.get("aspectRatio"));
    return Number.isFinite(t) && t > 0 ? t : Number(e.get("width")) / Number(e.get("height")) || 1;
  }
  function _o(e, t, o, a) {
    const c = Math.min(o, a * t), u = Math.max(Math.min(c, Math.max(1, t)), Math.min(c, e));
    return { width: u, height: u / t };
  }
  s("keep-aspect-ratio").addEventListener("change", (e) => {
    const t = L.get(B);
    R || I.size !== 1 || t?.get("kind") !== "image" || t.get("locked") === !0 || C.transact(() => {
      e.target.checked && t.set("aspectRatio", t.get("width") / t.get("height")), t.set("keepAspectRatio", e.target.checked);
    });
  });
  function rn(e) {
    return e instanceof l.Map && e.get("kind") !== "image";
  }
  function lo() {
    s("copy-format").disabled = R || I.size !== 1 || !rn(L.get(B));
    const e = [...I].map((t) => L.get(t));
    s("paste-format").disabled = R || !de || !e.length || tt() || !e.some(rn);
  }
  s("copy-format").addEventListener("click", () => {
    const e = L.get(B);
    if (R || I.size !== 1 || !rn(e)) return;
    const t = Et(e), o = ht(e);
    de = {
      appearance: { fillEnabled: t.fill, fillColour: t.fillColour, borderEnabled: t.border, borderColour: t.borderColour, borderWidth: t.width },
      text: e.get("kind") === "shape" ? null : { fontFamily: o.family, fontSize: o.size, textColour: o.colour, textAlign: o.align }
    }, lo(), X("Formatting copied. Select targets, then use Apply formatting.");
  }), s("paste-format").addEventListener("click", () => {
    if (R || !de || tt()) return;
    const e = [...I].map((t) => L.get(t)).filter(rn);
    e.length && (D?.stopCapturing(), C.transact(() => {
      for (const t of e) {
        const o = { ...de.appearance, ...t.get("kind") === "shape" ? {} : de.text || {} };
        for (const [a, c] of Object.entries(o)) t.set(a, c);
      }
    }), D?.stopCapturing(), X("Formatting applied to " + e.length + " object" + (e.length === 1 ? "." : "s.")));
  });
  function xt(e, t) {
    const o = L.get(B), a = o?.get("kind") === "shape" && ["fillEnabled", "fillColour", "borderEnabled", "borderColour", "borderWidth"].includes(e);
    if (R || I.size !== 1 || !Z.get(B)?.editor && !a || o.get("locked") === !0) return;
    const c = Z.get(B)?.editor;
    if (c && ["fontFamily", "fontSize", "textColour", "highlightColour"].includes(e)) {
      const u = c.state.selection.empty;
      D?.stopCapturing();
      try {
        (u ? c.chain().selectAll() : c.chain()).setMark("slideTextStyle", { [e]: t }).run(), u && (e !== "highlightColour" && o.set(e, t), c.commands.setTextSelection(c.state.selection.from)), on(c);
      } catch (k) {
        console.error("Slides text formatting:", k), X("Could not format selected text: " + k.message, "error");
      }
      D?.stopCapturing(), wt();
      return;
    }
    L.get(B).set(e, t);
  }
  for (const [e, t] of [["fill-enabled", "fillEnabled"], ["border-enabled", "borderEnabled"]])
    s(e).addEventListener("change", (o) => xt(t, o.target.checked));
  for (const [e, t] of [["fill-colour", "fillColour"], ["border-colour", "borderColour"]])
    s(e).addEventListener("change", (o) => {
      /^#[0-9a-f]{6}$/i.test(o.target.value) && xt(t, o.target.value);
    });
  s("border-width").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isInteger(t) || t < 1 || t > 20) {
      X("Border width must be a whole number between 1 and 20 pixels.", "error"), ze(B);
      return;
    }
    xt("borderWidth", t);
  }), s("font-family").addEventListener("change", (e) => {
    Object.prototype.hasOwnProperty.call(Mt, e.target.value) && xt("fontFamily", e.target.value);
  }), s("font-size").addEventListener("change", (e) => {
    const t = Number(e.target.value);
    if (!Number.isFinite(t) || t < 8 || t > 200) {
      X("Font size must be between 8 and 200 pixels.", "error"), ze(B);
      return;
    }
    xt("fontSize", t);
  }), s("text-colour").addEventListener("input", (e) => {
    /^#[0-9a-f]{6}$/i.test(e.target.value) && xt("textColour", e.target.value);
  }), s("text-align")?.addEventListener("change", (e) => {
    ["left", "center", "right", "justify"].includes(e.target.value) && xt("textAlign", e.target.value);
  });
  function Ft() {
    if (!s("saved-layout-hint")) return;
    const e = v.has(s("slide-layout").value), t = v.get(s("slide-layout").value), o = typeof i.onRenameSavedLayout == "function" && typeof i.onDeleteSavedLayout == "function";
    s("saved-layout-hint").textContent = Ke ? "Layout dialog is open." : v.size ? e ? o ? "Selected saved layout: " + t.label : "Layout management is available inside CList." : "Select an entry under Saved layouts to rename or delete it." : "Use CList’s Save menu to save the current slide as a layout.", s("rename-layout").disabled = Ke || !e || typeof i.onRenameSavedLayout != "function", s("delete-layout").disabled = Ke || !e || typeof i.onDeleteSavedLayout != "function";
  }
  function co(e) {
    const t = "user:" + e;
    v.delete(t);
    const o = s("slide-layout").querySelector("optgroup[data-saved-layouts]");
    (o && [...o.children].find((c) => c.value === t))?.remove(), o && !o.children.length && o.remove(), s("slide-layout").value || (s("slide-layout").value = h.keys().next().value), Ft();
  }
  async function uo(e) {
    const t = v.get(s("slide-layout").value), o = e ? i.onDeleteSavedLayout : i.onRenameSavedLayout;
    if (!(R || Ke || !t || typeof o != "function")) {
      Ke = !0, Ft();
      try {
        const a = await o({ ...t });
        e && a === !0 ? co(t.id) : !e && a && fo(a);
      } catch (a) {
        console.error("Saved layout management failed:", a), X("Could not " + (e ? "delete" : "rename") + " layout: " + a.message, "error");
      } finally {
        Ke = !1, Ft();
      }
    }
  }
  s("slide-layout").addEventListener("change", Ft), s("rename-layout").addEventListener("click", () => uo(!1).catch((e) => {
    console.error("Layout rename failed:", e), X(e.message, "error");
  })), s("delete-layout").addEventListener("click", () => uo(!0).catch((e) => {
    console.error("Layout deletion failed:", e), X(e.message, "error");
  }));
  function Zo(e) {
    if (typeof e != "string" || !e.trim() || e.trim().length > 120) throw new Error("Enter a layout name of 1–120 characters.");
    const t = new l.Doc();
    try {
      t.getMap("slide-pages").set("first", 0), t.getMap("slide-backgrounds").set("first", zt(H)), typeof J.get(H) == "string" && t.getMap("slide-notes").set("first", J.get(H));
      for (const u of De()) {
        const k = L.get(u), w = ht(k), M = Et(k), P = { ...k.toJSON(), slide: "first", fontFamily: w.family, fontSize: w.size, textColour: w.colour, fillColour: M.fillColour, borderColour: M.borderColour };
        P.kind === "shape" && (P.shapeDefinition = structuredClone(Gt(L.get(u)))), t.getMap("slide-objects").set(u, new l.Map(Object.entries(P)));
        const N = C.getXmlFragment("slide-text-" + u).toArray().map((O) => O.clone());
        N.length && t.getXmlFragment("slide-text-" + u).insert(0, N);
      }
      const o = new Set(De().flatMap((u) => L.get(u).get("referenceUrls") || []));
      for (const u of an()) o.has(u.url) && t.getMap("clist_refs").set(u.url, JSON.stringify(u));
      const a = l.encodeStateAsUpdate(t);
      let c = "";
      for (const u of a) c += String.fromCharCode(u);
      return { format: "clist-slide-layout-v1", id: "saved-" + crypto.randomUUID(), label: e.trim(), update: btoa(c) };
    } finally {
      t.destroy();
    }
  }
  function po(e) {
    if (!e || e.format !== "clist-slide-layout-v1" || typeof e.id != "string" || !/^saved-[a-z0-9-]+$/.test(e.id) || typeof e.label != "string" || !e.label.trim() || e.label.length > 120 || typeof e.update != "string") throw new Error("Invalid saved slide layout.");
    const t = new l.Doc();
    try {
      l.applyUpdate(t, Uint8Array.from(atob(e.update), (a) => a.charCodeAt(0)));
      const o = t.getMap("slide-pages");
      if (o.size !== 1 || !o.has("first")) throw new Error("A saved layout must contain one slide.");
      return t.getMap("slide-objects").forEach((a) => {
        if (!(a instanceof l.Map) || (a.get("slide") || "first") !== "first" || !["x", "y", "width", "height"].every((c) => typeof a.get(c) == "number" && Number.isFinite(a.get(c))) || a.get("width") <= 0 || a.get("height") <= 0) throw new Error("Invalid object in saved slide layout.");
        a.get("kind") === "shape" && a.get("shapeDefinition") && fn(a.get("shapeDefinition"));
      }), t;
    } catch (o) {
      throw t.destroy(), o;
    }
  }
  function fo(e, { select: t = !1 } = {}) {
    po(e).destroy();
    const a = { format: e.format, id: e.id, label: e.label.trim(), update: e.update };
    v.set("user:" + a.id, a);
    let c = s("slide-layout").querySelector("optgroup[data-saved-layouts]");
    c || (c = document.createElement("optgroup"), c.label = "Saved layouts", c.dataset.savedLayouts = "", s("slide-layout").append(c));
    let u = [...c.children].find((k) => k.value === "user:" + a.id);
    return u || (u = document.createElement("option"), c.append(u)), u.value = "user:" + a.id, u.textContent = a.label, t && (s("slide-layout").value = u.value), Ft(), a;
  }
  function Qo(e) {
    const t = po(e);
    try {
      const o = t.getMap("slide-objects"), a = /* @__PURE__ */ new Map(), c = [...o.entries()].sort(([w, M], [P, N]) => Ze(M) - Ze(N) || w.localeCompare(P)).map(([w, M]) => {
        const P = nt(), N = Sn(M.toJSON(), a), O = C.getXmlFragment("slide-text-" + P);
        return D?.addToScope(O), { id: P, data: N, fragment: O, text: t.getXmlFragment("slide-text-" + w).toArray().map(($) => $.clone()) };
      }), u = Se(), k = "slide-" + crypto.randomUUID();
      H = k, B = null, I.clear(), D?.stopCapturing(), C.transact(() => {
        U.size || U.set("first", 0), U.set(k, Math.max(...u.map((w) => U.get(w) || 0)) + 1), G.set(k, t.getMap("slide-backgrounds").get("first") || "#ffffff"), J.set(k, t.getMap("slide-notes").get("first") || ""), t.getMap("clist_refs").forEach((w) => {
          try {
            sn([JSON.parse(w)]);
          } catch {
          }
        });
        for (const w of c)
          L.set(w.id, new l.Map(Object.entries({ ...w.data, slide: k }))), w.text.length && w.fragment.insert(0, w.text);
      }), D?.stopCapturing(), we();
    } finally {
      t.destroy();
    }
  }
  function an() {
    const e = [];
    return K.forEach((t) => {
      try {
        const o = zn(JSON.parse(t));
        o && e.push(o);
      } catch {
      }
    }), e;
  }
  function Ut() {
    i.onReferencesChange?.(an());
  }
  function sn(e) {
    for (const t of e || []) {
      const o = zn(t);
      o && !K.has(o.url) && K.set(o.url, JSON.stringify(o));
    }
  }
  function er(e, t = []) {
    if (R) throw new Error("Return to editing before importing content.");
    const o = [...new Map(t.map(zn).filter(Boolean).map((u) => [u.url, u])).values()], a = Ar(e, o);
    xe();
    const c = nt();
    return D?.stopCapturing(), C.transact(() => {
      St(c, 100, 120, 1e3, 460), L.get(c).set("referenceUrls", o.map((u) => u.url)), sn(o);
    }), Z.get(c).editor.commands.setContent(a), D?.stopCapturing(), ze(c), f.tabIndex = -1, f.focus({ preventScroll: !0 }), X("Content imported into a new text box" + (o.length ? " with source references." : ".")), c;
  }
  function tr() {
    le.has("theme") || C.transact(() => le.set("theme", structuredClone(bt())), "init");
    const e = l.encodeStateAsUpdate(C), t = [];
    for (let o = 0; o < e.length; o += 32768) t.push(String.fromCharCode(...e.subarray(o, o + 32768)));
    return { format: "clist-slides-yjs-v1", document: s("doc-name").value, update: btoa(t.join("")) };
  }
  async function nr(e, t) {
    if (te) throw new Error("Disconnect from collaboration before importing a PowerPoint file.");
    if (R) throw new Error("Return to editing before importing a PowerPoint file.");
    const o = await Hr(e, t);
    if (te || R) throw new Error("Return to local editing before completing the import.");
    const a = new l.Doc();
    function c(u) {
      const k = new l.XmlElement(u.type);
      for (const [N, O] of Object.entries(u.attrs || {})) k.setAttribute(N, O);
      const w = [];
      let M = [];
      const P = () => {
        if (M.length) {
          const N = new l.XmlText();
          N.applyDelta(M), w.push(N), M = [];
        }
      };
      for (const N of u.content || [])
        if (N.type === "text") {
          const O = Object.fromEntries((N.marks || []).map(($) => [$.type, $.attrs || {}]));
          M.push({ insert: N.text, attributes: O });
        } else
          P(), w.push(c(N));
      return P(), w.length && k.insert(0, w), k;
    }
    try {
      const u = Se(), k = a.getMap("pages"), w = a.getMap("objects"), M = Math.max(...u.map((N) => U.get(N) || 0)) + 1;
      for (const [N, O] of o.slides.entries()) {
        const $ = "slide-" + crypto.randomUUID();
        k.set($, { order: M + N, background: O.background, notes: O.notes }), O.objects.forEach((ce, he) => {
          const ae = nt(), { text: Re, ...He } = ce;
          He.shapeDefinition && (He.shapeDefinition = fn(He.shapeDefinition)), w.set(ae, { ...He, slide: $, layer: he }), Re && a.getXmlFragment("slide-text-" + ae).insert(0, Re.map(c));
        });
      }
      const P = [...w].map(([N, O]) => {
        const $ = O.kind === "text" ? C.getXmlFragment("slide-text-" + N) : null;
        return $ && D?.addToScope($), { id: N, box: new l.Map(Object.entries(O)), fragment: $, text: $ ? a.getXmlFragment("slide-text-" + N).toArray().map((ce) => ce.clone()) : [] };
      });
      return xe(), D?.stopCapturing(), H = k.keys().next().value, B = null, I.clear(), C.transact(() => {
        U.size || U.set("first", 0);
        for (const [N, O] of k)
          U.set(N, O.order), G.set(N, O.background), O.notes && J.set(N, O.notes);
        for (const N of P)
          L.set(N.id, N.box), N.fragment && N.text.length && N.fragment.insert(0, N.text);
      }), D?.stopCapturing(), we(), X(o.slides.length + " PowerPoint slides imported. Use Undo to remove the import."), { count: o.slides.length, warnings: o.warnings };
    } finally {
      a.destroy();
    }
  }
  function or(e) {
    if (te) throw new Error("Disconnect from Hocuspocus before replacing the document");
    if (!e || e.format !== "clist-slides-yjs-v1" || typeof e.update != "string")
      throw new Error("Unsupported document format");
    const t = atob(e.update), o = Uint8Array.from(t, (c) => c.charCodeAt(0)), a = new l.Doc();
    try {
      l.applyUpdate(a, o);
    } catch (c) {
      throw a.destroy(), c;
    }
    C.off("beforeObserverCalls", Yt), L.unobserveDeep(we), U.unobserve(we), le.unobserve(we), G.unobserve(we), K.unobserve(Ut), J.unobserve(qt), C.off("update", It), C.off("update", kt);
    for (const c of Z.values())
      c.disposePointer?.(), c.editor?.destroy(), c.node.remove();
    Z.clear(), B = null, I.clear(), Ae = null, ie = null, xe(), go(), C.destroy(), C = a, L = C.getMap("slide-objects"), U = C.getMap("slide-pages"), G = C.getMap("slide-backgrounds"), J = C.getMap("slide-notes"), K = C.getMap("clist_refs"), le = C.getMap("slide-design"), H = Se()[0], Wo(), C.on("beforeObserverCalls", Yt), L.observeDeep(we), U.observe(we), le.observe(we), G.observe(we), K.observe(Ut), J.observe(qt), C.on("update", It), C.on("update", kt), pe = !0, e.document && (s("doc-name").value = e.document), we(), mo(), Ut(), kt();
  }
  function Pt() {
    je++;
    const e = te;
    te = null, Y = !1, Q = null, e?.destroy(), X("Local only"), s("connect").textContent = "Connect";
  }
  async function Ln() {
    Pt();
    const e = je, t = i.captureSession?.();
    try {
      const o = s("server-url").value.trim();
      let a = s("doc-name").value.trim();
      if (!/^wss?:\/\//i.test(o) || !a) throw new Error("Enter a WebSocket URL and document name");
      if (i.resolveDocumentName && (a = await i.resolveDocumentName(a)), e !== je) return;
      s("doc-name").value = a;
      const c = typeof i.parameters == "function" ? i.parameters() : i.parameters;
      te = new p({
        url: o,
        name: a,
        document: C,
        token: i.token || s("token").value || void 0,
        parameters: c || {},
        onStatus: ({ status: u }) => {
          e === je && X(u === "connected" ? "Synchronizing..." : u);
        },
        onSynced: ({ state: u }) => {
          e !== je || u === !1 || (Y = !0, i.seed !== !1 && qn(), X("Synced", "connected"));
        },
        onAuthenticationFailed: ({ reason: u } = {}) => {
          if (e !== je) return;
          const k = typeof u == "string" && u.trim() ? u.trim() : "The server did not provide a reason.";
          console.error("Slides collaboration authentication failed:", k), Pt(), X(`Authentication failed: ${k}`, "error");
        },
        onDisconnect: () => {
          e === je && (Y = !1, X("Disconnected", "error"));
        }
      }), Q = { docId: a, server: o, owner: te, document: C, session: t }, s("connect").textContent = "Disconnect", X("Connecting...");
    } catch (o) {
      if (e !== je) return;
      console.error("Slides connection failed:", o), Pt(), X(o.message, "error");
    }
  }
  function Dt(e) {
    console.error("Slides connection failed:", e), X(e.message, "error");
  }
  s("connect").addEventListener("click", () => {
    te ? Pt() : Ln().catch(Dt);
  });
  function ln() {
    s("undo").disabled = R || !D?.undoStack.length, s("redo").disabled = R || !D?.redoStack.length;
  }
  function ho(e) {
    e.local && e.origin !== "init" && !rt && D.trackedOrigins.add(e.origin);
  }
  function mo() {
    D = new l.UndoManager([...C.share.values()], {
      trackedOrigins: /* @__PURE__ */ new Set([null, "geometry", "layer"]),
      captureTransaction: (e) => e.local && e.origin !== "init" && !rt
    }), C.on("beforeTransaction", ho);
    for (const e of ["stack-item-added", "stack-item-popped", "stack-cleared", "stack-item-updated"]) D.on(e, ln);
    ln();
  }
  function go() {
    C.off("beforeTransaction", ho), D?.destroy(), D = null;
  }
  function Mn(e = !1) {
    if (!(R || !D)) {
      xe(), D.stopCapturing();
      try {
        e ? D.redo() : D.undo(), we(), ln();
      } catch (t) {
        console.error("Slides history failed:", t), X("Could not " + (e ? "redo" : "undo") + ": " + t.message, "error");
      }
    }
  }
  function rr(e) {
    if (R || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || !B) return;
    const t = e.target;
    if (t.isContentEditable || !!t.closest?.('[contenteditable="true"]')) {
      e.key === "Escape" && (e.preventDefault(), e.stopImmediatePropagation(), Z.get(B)?.node.focus({ preventScroll: !0 }), Ae = null);
      return;
    }
    if (t.closest?.("input, textarea, select, button")) return;
    if (tt() && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Delete", "Backspace"].includes(e.key)) {
      e.preventDefault(), e.stopImmediatePropagation(), X("Unlock selected objects before moving or deleting.", "error");
      return;
    }
    const a = Z.get(B);
    if (!a) return;
    if (e.key === "Enter" && a.editor && I.size === 1) {
      e.preventDefault(), a.editor.commands.focus();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault(), e.stopImmediatePropagation(), D?.stopCapturing(), En(), D?.stopCapturing(), f.tabIndex = -1, f.focus({ preventScroll: !0 });
      return;
    }
    const c = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!c) return;
    e.preventDefault(), e.stopImmediatePropagation(), e.repeat || D?.stopCapturing();
    const u = e.shiftKey ? 10 : 1, k = [...I].map((N) => ({ id: N, ...L.get(N).toJSON() })), w = tn(k), M = Math.max(-w.x, Math.min(E - w.x - w.width, c[0] * u)), P = Math.max(-w.y, Math.min(A - w.y - w.height, c[1] * u));
    C.transact(() => {
      for (const N of k) {
        const O = L.get(N.id);
        O.set("x", N.x + M), O.set("y", N.y + P);
      }
    }, "geometry");
  }
  function ir(e) {
    if (e.target.closest?.(".slide-crop-stage, .rotation-handle") || (rr(e), R || !(e.ctrlKey || e.metaKey) || e.altKey || !f.contains(e.target))) return;
    const t = e.key.toLowerCase();
    t !== "z" && t !== "y" || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) && e.target !== s("speaker-notes") || (e.preventDefault(), e.stopImmediatePropagation(), Mn(t === "y" || e.shiftKey));
  }
  function cn() {
    D?.stopCapturing();
  }
  s("undo").addEventListener("click", () => Mn()), s("redo").addEventListener("click", () => Mn(!0)), f.addEventListener("click", cn, !0), f.addEventListener("click", cn), f.addEventListener("change", cn, !0), f.addEventListener("change", cn), f.addEventListener("keydown", ir, !0);
  function Wt(e, t) {
    const o = t.createElement("div");
    o.className = "slide presenter-slide", o.style.backgroundColor = zt(e), o.setAttribute("aria-label", "Slide preview");
    for (const a of De(e)) {
      const c = L.get(a), u = t.createElement("div"), k = t.createElement("div");
      if (u.className = c.get("kind") === "shape" ? "slide-object shape-object" : c.get("kind") === "image" ? "slide-object image-object" : "slide-object", u.style.left = 100 * c.get("x") / E + "%", u.style.top = 100 * c.get("y") / A + "%", u.style.width = 100 * c.get("width") / E + "%", u.style.height = 100 * c.get("height") / A + "%", u.style.transform = "rotate(" + (Number(c.get("rotation")) || 0) + "deg)", u.style.zIndex = String(De(e).indexOf(a)), c.get("kind") === "image") {
        k.className = "image-content";
        const w = t.createElement("img");
        w.src = Ct(c.get("source")), w.alt = typeof c.get("alt") == "string" ? c.get("alt") : "", bn(w, c, !0), k.append(w);
      } else if (c.get("kind") === "shape") {
        k.className = "shape-content";
        const w = t.createElementNS("http://www.w3.org/2000/svg", "svg");
        Jt(w, c), k.append(w);
      } else {
        k.className = "text-content";
        const w = ht(c), M = Et(c), P = t.createElement("div");
        u.style.setProperty("--slide-font-size", w.size / 12.8 + "cqw"), u.style.fontFamily = Mt[w.family], u.style.color = w.colour, u.style.textAlign = w.align, k.style.backgroundColor = M.fill ? M.fillColour : "transparent", k.style.border = M.border ? M.width / 12.8 + "cqw solid " + M.borderColour : "none", P.className = "tiptap", P.append(Lo(C.getXmlFragment("slide-text-" + a), t)), k.append(P);
      }
      u.append(k), o.append(u);
    }
    return o;
  }
  function ar() {
    return {
      title: i.presentationTitle?.() || s("doc-name").value || "CList presentation",
      slides: Se().map((e) => ({
        background: zt(e),
        notes: typeof J.get(e) == "string" ? J.get(e) : "",
        objects: De(e).map((t) => {
          const o = L.get(t), a = o.get("kind") || "text", c = {
            id: t,
            kind: a,
            x: Number(o.get("x")) || 0,
            y: Number(o.get("y")) || 0,
            width: Number(o.get("width")),
            height: Number(o.get("height")),
            rotation: Number(o.get("rotation")) || 0,
            style: Et(o)
          };
          if (!(c.width > 0 && c.height > 0)) throw new Error("An object has invalid dimensions: " + t);
          if (a === "text")
            c.format = ht(o), c.runs = Pr(Lo(C.getXmlFragment("slide-text-" + t), document), c.format.size);
          else if (a === "image") {
            if (c.source = Ct(o.get("source")), !c.source) throw new Error("An image has no valid source: " + t);
            c.alt = typeof o.get("alt") == "string" ? o.get("alt") : "";
            const u = gn(o);
            c.crop = { ...u }, u.fit === "cover" && Object.assign(c.crop, Kt(o));
          } else if (a === "shape") {
            c.definition = structuredClone(Gt(o));
            const u = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            Jt(u, o), u.setAttribute("width", c.width), u.setAttribute("height", c.height);
            for (const k of u.querySelectorAll("[vector-effect]")) k.style.strokeWidth = (c.style.border ? Math.min(c.style.width, c.width, c.height) : 0) + "px";
            c.source = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(u));
          } else throw new Error("Unsupported slide object: " + a);
          return c;
        })
      }))
    };
  }
  function Nn() {
    if (!$e) return;
    if ($e.closed) {
      $e = null;
      return;
    }
    const e = Se(), t = e.indexOf(H);
    $e.update({ id: H, nextId: e[t + 1], index: t, total: e.length, notes: typeof J.get(H) == "string" ? J.get(H) : "", presenting: R });
  }
  function bo() {
    try {
      if ($e && !$e.closed) {
        Nn(), $e.focus();
        return;
      }
      $e = Ir({
        renderSlide: Wt,
        navigate: dn,
        jump: (e) => {
          const t = Se();
          H = e === "first" ? t[0] : t[t.length - 1], B = null, I.clear(), we();
        },
        present: yo,
        end: un
      }), Nn();
    } catch (e) {
      console.error("Presenter view could not open:", e), X("Presenter view could not open: " + e.message, "error"), R && (s("presentation-status").textContent = e.message);
    }
  }
  s("presenter-view").addEventListener("click", bo), s("presentation-presenter-view").addEventListener("click", bo);
  function dn(e) {
    const t = Se(), o = t[t.indexOf(H) + e];
    o && (H = o, B = null, I.clear(), we());
  }
  function jn(e) {
    Ge?.presenting(e), R = e, ro(), ln(), xe(), ze(null), f.classList.toggle("presenting", e), it.update(), s("presentation-controls").hidden = !e;
    for (const t of Z.values()) t.editor?.setEditable(!e);
    e ? (gt = document.activeElement, f.tabIndex = -1, f.focus()) : (gt?.focus?.(), gt = null), It();
  }
  async function yo() {
    jn(!0), s("presentation-status").textContent = "";
    try {
      f.requestFullscreen && await f.requestFullscreen();
    } catch (e) {
      console.error("Slides fullscreen failed:", e), s("presentation-status").textContent = "Full screen unavailable. Presenting in this window.";
    }
  }
  async function un() {
    jn(!1);
    try {
      document.fullscreenElement === f && await document.exitFullscreen();
    } catch (e) {
      console.error("Slides fullscreen exit failed:", e), X("Could not leave full screen. Press Escape.", "error");
    }
  }
  function wo(e) {
    if (!(!R || e.altKey || e.ctrlKey || e.metaKey)) {
      if (e.key === "Escape")
        e.preventDefault(), un().catch(Dt);
      else if (["ArrowRight", "ArrowDown", "PageDown", "ArrowLeft", "ArrowUp", "PageUp", "Home", "End", " "].includes(e.key)) {
        if (e.key === " " && e.target?.tagName === "BUTTON") return;
        if (e.preventDefault(), e.key === "Home" || e.key === "End") {
          const t = Se();
          H = e.key === "Home" ? t[0] : t[t.length - 1], we();
        } else dn(["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? -1 : 1);
      }
    }
  }
  function xo() {
    R && document.fullscreenElement !== f && jn(!1);
  }
  s("present").addEventListener("click", () => yo().catch(Dt)), s("exit-presentation").addEventListener("click", () => un().catch(Dt)), s("previous-slide").addEventListener("click", () => dn(-1)), s("next-slide").addEventListener("click", () => dn(1)), document.addEventListener("keydown", wo), document.addEventListener("fullscreenchange", xo);
  function vo(e) {
    return typeof e.toDelta == "function" ? e.toDelta().map((t) => typeof t.insert == "string" ? t.insert : "").join("") : typeof e.toArray == "function" ? e.toArray().map(vo).join(e.nodeName === "paragraph" ? "" : `
`) : "";
  }
  return Ne = kr({
    root: f,
    shapes: [...x.values()],
    readImage: Cn,
    openModal: (e) => {
      if (!i.openInsertModal) throw new Error("This host does not provide the insertion modal.");
      return i.openInsertModal(e);
    },
    capture() {
      const e = C, t = H, o = i.captureSession?.();
      return () => f.isConnected && !R && C === e && H === t && Se().includes(t) && (!i.sessionCurrent || i.sessionCurrent(o));
    },
    insertShape: oo,
    insertImage(e) {
      xe();
      const t = nt();
      D?.stopCapturing(), C.transact(() => {
        St(t, (E - e.width) / 2, (A - e.height) / 2, e.width, e.height, e.source, e.alt);
        const o = L.get(t);
        o.set("imageRatio", e.image.naturalWidth / e.image.naturalHeight);
        for (const a of ["imageFit", "cropX", "cropY", "cropImageWidth", "cropImageHeight", "aspectRatio"]) o.set(a, e[a]);
      }), D?.stopCapturing(), ze(t), X("Image added");
    },
    log: (e) => console.error("Slides insertion failed:", e)
  }), Le = Sr(f, () => !R, () => {
    try {
      Ne.shape();
    } catch (e) {
      X("Could not open shape picker: " + e.message, "error");
    }
  }), oe = br(f, () => !R, () => xe()), q = lr(f), ee = pr(f, (e, t) => {
    try {
      xt(e, t);
    } catch (o) {
      console.error("Slides text formatting:", o), X("Could not format text: " + o.message, "error");
    }
  }), se = mr({
    root: f,
    current: () => !R && f.isConnected,
    capture() {
      const e = C, t = H, o = i.captureSession?.();
      return () => f.isConnected && !R && C === e && H === t && (!i.sessionCurrent || i.sessionCurrent(o));
    },
    theme: bt,
    themes: () => [...mn().values()],
    apply: Hn,
    designs: () => [...h.values(), ...v.values()].map((e) => ({ label: e.label })),
    save(e) {
      const t = hn(e);
      D?.stopCapturing(), C.transact(() => {
        le.set("saved-theme:" + t.id, structuredClone(t)), le.set("theme", structuredClone(t));
      }, "theme"), D?.stopCapturing();
    },
    canSaveLayout: () => typeof i.onSaveLayout == "function",
    saveLayout: () => i.onSaveLayout?.(),
    openModal: (e) => {
      if (!i.openInsertModal) throw new Error("This host does not provide the Themes dialog.");
      return i.openInsertModal(e);
    },
    error: (e) => X("Could not open Themes: " + e.message, "error")
  }), _ = sr(f, () => {
    try {
      if (R) return;
      D?.stopCapturing(), G.delete(H), D?.stopCapturing();
    } catch (e) {
      console.error("Slides colour:", e), X("Could not reset slide colour: " + e.message, "error");
    }
  }), f.querySelector('[data-panel="layouts"]')?.remove(), f.querySelector('[data-panel="text"]')?.remove(), qe = dr({
    root: f,
    openModal: (e) => {
      if (!i.openInsertModal) throw new Error("This host does not provide the link dialog.");
      return i.openInsertModal(e, { wide: !1 });
    },
    closed: () => {
      Me = null;
    },
    error: (e) => X("Could not edit link: " + e.message, "error"),
    capture() {
      const e = B, t = Z.get(e), o = t?.editor, a = C, c = H, u = i.captureSession?.();
      if (R || !o || t.box.get("locked") === !0) throw new Error("Select editable text to link.");
      const k = o.state.selection.empty, w = o.state.selection.from;
      k && o.commands.selectAll();
      const { from: M, to: P } = o.state.selection;
      if (M === P) throw new Error("Select the text to link first.");
      const N = o.state.doc, O = N.textBetween(M, P, `
`), $ = o.getAttributes("link"), ce = () => !R && C === a && H === c && B === e && Z.get(e)?.editor === o && !o.isDestroyed && t.box.get("locked") !== !0 && (!i.sessionCurrent || i.sessionCurrent(u));
      return Me = e, {
        values: { href: $.href || "", text: O, title: $.title || "", alt: $.ariaLabel || "", newTab: $.target !== "_self" },
        current: () => ce() && o.state.doc.eq(N),
        restore() {
          ce() && (o.commands.setTextSelection(k ? w : { from: M, to: P }), on(o), wt());
        },
        focus() {
          ce() && (k && o.commands.setTextSelection(o.state.selection.from), on(o), wt());
        },
        apply(he) {
          if (!ce() || !o.state.doc.eq(N)) throw new Error("The original text changed.");
          D?.stopCapturing();
          let ae = o.chain().setTextSelection({ from: M, to: P }), Re = P;
          if (he.text !== O) {
            let He = [];
            N.nodesBetween(M, P, (Ve) => {
              Ve.isText && !He.length && (He = Ve.marks.filter((Oe) => Oe.type.name !== "link").map((Oe) => Oe.toJSON()));
            }), ae = ae.insertContentAt({ from: M, to: P }, { type: "text", text: he.text, marks: He }), Re = M + he.text.length;
          }
          ae.setTextSelection({ from: M, to: Re }).setLink({ href: he.href, title: he.title || null, ariaLabel: he.alt || null, target: he.newTab ? "_blank" : "_self", rel: "noopener noreferrer" }).setTextSelection({ from: M, to: Re }).run(), D?.stopCapturing();
        }
      };
    }
  }), ue = Er({
    root: f,
    canChange: () => !R,
    selectSlide: Qt,
    getSlides: () => Se().map((e) => ({
      id: e,
      active: e === H,
      text: De(e).filter((t) => !["image", "shape"].includes(L.get(t)?.get("kind"))).map((t) => vo(C.getXmlFragment("slide-text-" + t))).filter(Boolean).join(`

`)
    }))
  }), i.url ? Ln().catch(Dt) : i.seed !== !1 && qn(), we(), mo(), Ft(), Ge = Vr({
    root: f,
    Y: l,
    getDocument: () => C,
    canEdit: () => !R,
    getEntries: () => Se().flatMap((e, t) => [...Te.get(e) || []].sort((o, a) => Ze(L.get(o)) - Ze(L.get(a)) || o.localeCompare(a)).filter((o) => !L.get(o).get("kind") || L.get(o).get("kind") === "text").map((o) => ({ id: o, slideId: e, slideNumber: t + 1, locked: L.get(o).get("locked") === !0, fragment: C.getXmlFragment("slide-text-" + o) }))),
    selectedText: () => {
      const e = Z.get(B)?.editor;
      return e ? e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, `
`) : "";
    },
    jump: (e) => {
      Je = !0;
      try {
        xe(), yt([e.entry.slideId]), we(), ze(e.entry.id);
        const t = Z.get(e.entry.id);
        t?.editor && (t.editor.commands.setTextSelection({ from: e.from, to: e.to }), t.editor.view.focus()), t?.node.scrollIntoView({ block: "nearest", inline: "nearest" });
      } finally {
        Je = !1;
      }
    },
    transact: (e, t) => {
      if (!R) {
        for (const o of new Set(e.map((a) => a.entry.fragment))) D?.addToScope(o);
        D?.stopCapturing(), C.transact(t), D?.stopCapturing();
      }
    },
    report: Bt,
    onError: (e) => {
      console.error("Slides find/replace failed:", e), typeof window.showErrorModal == "function" ? window.showErrorModal(e.message, { title: "Find and replace failed" }) : X("Find and replace failed: " + e.message, "error");
    }
  }), {
    getArticleHtml: () => Yr({ slideIds: Se(), renderSlide: Wt }),
    getHtml: () => Bo({ slideIds: Se(), renderSlide: Wt, title: i.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    exportHtml: () => Jr({ slideIds: Se(), renderSlide: Wt, title: i.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    snapshotRecovery: ft.snapshot,
    importPowerPoint: nr,
    exportPowerPoint: () => Br(ar()),
    exportPdf: () => Fr({ slideIds: Se(), renderSlide: Wt, title: i.presentationTitle?.() || s("doc-name").value || "CList presentation" }),
    snapshot: tr,
    loadSnapshot: or,
    importContent: er,
    getReferences: an,
    addReferences: sn,
    connect: Ln,
    disconnect: Pt,
    createSavedLayout: Zo,
    registerSavedLayout: fo,
    removeSavedLayout: co,
    setView: (e) => ue.setMode(e),
    get viewMode() {
      return ue.mode;
    },
    get document() {
      return C;
    },
    getSharing() {
      const e = Q;
      return !e || te !== e.owner || i.sessionCurrent && !i.sessionCurrent(e.session) ? null : { docId: e.docId, server: e.server, title: e.docId, current: () => te === e.owner && C === e.document && (!i.sessionCurrent || i.sessionCurrent(e.session)) };
    },
    get connected() {
      return Y;
    },
    destroy() {
      ke?.destroy(), Ne?.destroy(), qe?.destroy(), _?.destroy(), q?.destroy(), ee?.destroy(), se?.destroy(), oe?.destroy(), Le?.destroy(), ue?.destroy(), Ge?.destroy(), ft.destroy(), _e.destroy(), Ie.destroy(), it.destroy(), $e?.close(), $e = null, document.removeEventListener("copy", Qn, !0), document.removeEventListener("cut", eo, !0), document.removeEventListener("paste", to, !0), document.removeEventListener("keydown", wo), document.removeEventListener("fullscreenchange", xo), R && un().catch(Dt), Pt(), xe(), C.off("beforeObserverCalls", Yt), L.unobserveDeep(we), U.unobserve(we), le.unobserve(we), G.unobserve(we), K.unobserve(Ut), J.unobserve(qt), C.off("update", It), C.off("update", kt);
      for (const e of Z.values())
        e.disposePointer?.(), e.editor?.destroy();
      Z.clear(), go(), re?.document.destroy(), re = null, de = null, C.destroy(), f.remove();
    }
  };
}
export {
  ii as createSlideEditor,
  ri as loadSlideCatalogs
};
