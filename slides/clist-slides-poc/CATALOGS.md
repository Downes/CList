# Shape, layout and theme catalogs

CList loads these static files when mounting the slide editor:

- `catalogs/shapes.json`
- `catalogs/layouts.json`
- `catalogs/themes.json`

Edit the JSON and reload CList. No changes to the editor or JavaScript rebuild
are needed to add catalog entries. The standalone development demo reads the
same files. Its production build copies them to `dist/catalogs/`.

Each file has `version: 1` and an array named `shapes`, `layouts` or `themes`.
IDs must be unique within their catalog, start with a lowercase letter, and
contain only lowercase letters, numbers, and hyphens (maximum 80 characters).
Labels are plain text, up to 120 characters. Array order determines menu order.
The first layout is selected initially; keep Blank first for the current default.

## Shapes

Add this entry to the `shapes` array for a triangle:

```json
{
  "id": "triangle",
  "label": "Triangle",
  "width": 260,
  "height": 220,
  "defaults": {
    "fillEnabled": true,
    "fillColour": "#51b158",
    "borderEnabled": true,
    "borderColour": "#202b3d",
    "borderWidth": 2
  },
  "viewBox": [0, 0, 1000, 1000],
  "elements": [
    { "tag": "polygon", "attributes": { "points": "500,0 1000,1000 0,1000" } }
  ]
}
```

`width` and `height` are the default frame size in slide pixels (1280 × 720).
`viewBox` defines the coordinates used by the SVG elements. Geometry scales to
fit the frame; stroke thickness follows the slide scale. All elements share the
object's fill and border controls. Multiple elements can form a compound shape.

Supported geometry:

| SVG tag | Attributes |
| --- | --- |
| rect | x, y, width, height, rx, ry |
| circle | cx, cy, r |
| ellipse | cx, cy, rx, ry |
| line | x1, y1, x2, y2 |
| polygon / polyline | points |
| path | d |

For example, a path element can use:

```json
{ "tag": "path", "attributes": { "d": "M 0 0 L 1000 500 L 0 1000 Z" } }
```

Geometry attributes are numbers; `points` and `d` are strings. The catalog
accepts a limited set of SVG geometry, not arbitrary SVG markup, scripts,
embedded HTML, external resources, or event handlers. There is no expression
language or executable code in a definition.

Existing rectangle, circle, and line IDs remain supported. New shapes carry
their validated definition in the presentation's Yjs snapshot. They continue
to render after the original catalog entry changes or is removed, including
in another editor instance. Changing a catalog entry affects newly added shapes.
Older snapshots without embedded definitions resolve their shape IDs from the
currently loaded catalog.

## Layouts

A layout is a list of initial objects, optionally with a background and notes.
It creates a new slide and leaves existing slides intact. This example uses the
triangle entry above:

```json
{
  "id": "triangle-quote",
  "label": "Triangle and quote",
  "background": "#ffffff",
  "notes": "Explain the quotation.",
  "objects": [
    {
      "kind": "shape",
      "shapeId": "triangle",
      "x": 80, "y": 180, "width": 260, "height": 220,
      "fillColour": "#51b158",
      "group": "quote-panel"
    },
    {
      "kind": "text",
      "x": 400, "y": 180, "width": 780, "height": 300,
      "text": "Add your quotation here.",
      "fontSize": 40,
      "fontFamily": "georgia",
      "textAlign": "left",
      "textColour": "#202b3d",
      "group": "quote-panel"
    }
  ]
}
```

Every object needs `kind`, `x`, `y`, `width`, and `height`. Frames must fit
within the slide. Supported kinds:

- `text`: requires plain `text`; newlines create paragraphs.
- `shape`: requires `shapeId` referring to the shape catalog.
- `image`: requires `source` containing a PNG/JPEG/GIF/WebP data URL; optional `alt`.

Optional shared styles include `rotation`, `fillEnabled`, `fillColour`,
`borderEnabled`, `borderColour`, `borderWidth`, and `locked`.
Text styles: `fontSize`, `fontFamily`, `textAlign`, and `textColour`.
Image options: `keepAspectRatio`, `imageFit` (contain/cover), `cropX`, and `cropY`.
Colours use six-digit hexadecimal values. Fonts use the existing selector IDs:
system, arial, verdana, georgia, times, courier.

Objects sharing a nonempty `group` name are grouped. Each new slide receives
fresh group IDs, so repeated use of a layout does not join independent slides.

A layout is expanded into ordinary editable objects. Save/Load, Undo/Redo,
copy/paste, grouping, locking, and slide duplication use the existing paths.
Saved presentations do not depend on their original layout catalog entry.

## Validation and embedding

Malformed catalogs, duplicate IDs, unknown shape references, invalid colours,
and objects outside slide bounds are rejected with a visible initialization
error. Fix the JSON and reload. Unsupported catalog versions are rejected.

Hosts can supply arrays directly:

```js
createSlideEditor(container, {
  dependencies,
  catalogs: { shapes: shapeDefinitions, layouts: layoutDefinitions, themes: themeDefinitions }
})
```

`loadSlideCatalogs(baseUrl)`, exported from `dist-embed/editor.js`, fetches and
validates all three JSON files. Direct embedding without `options.catalogs` uses
bundled fallback definitions; rebuild to update that fallback. Normal CList
mounting loads the external files and does not need that rebuild.

## Save a slide as a personal layout

In CList, choose **Save → Save slide as layout**, enter a name, and save.
The entry appears under **Saved layouts** in the New slide layout picker.
Choose it and click Add slide to make an independent editable copy.

Personal layouts use CList's local PageStore and are restored when Slides opens.
They preserve the current slide's rich text, images/crops, embedded shape
geometry, styling, relative layers, groups, locks, background, and notes.
They are separate from the shared JSON catalogs and from presentation snapshots.
Their record MIME type is `application/vnd.clist.slide-layout+json`; the package
format is `clist-slide-layout-v1`. Only the current slide is captured.

Select a personal entry in the layout picker to enable **Rename layout** and
**Delete layout**. These actions update the local saved record. Built-in catalog
entries remain managed through their JSON files; existing slides are independent
of later renames or deletions.

## Presentation themes

The right-hand **Themes** section applies deck-wide defaults from `themes.json`.
Bundled choices are Classic, Midnight, Paper and Ocean. A theme entry has:

```json
{
  "id": "example",
  "label": "Example",
  "fontFamily": "arial",
  "fontSize": 33.28,
  "textColour": "#202b3d",
  "background": "#ffffff",
  "fillColour": "#51b158",
  "borderColour": "#202b3d"
}
```

All fields are required. Colours use six-digit hexadecimal notation. Font families
are `system`, `arial`, `verdana`, `georgia`, `times` or `courier`; font size is
8–200 slide pixels. The first entry supplies the default theme.

Themes affect inherited text fonts/sizes/colours, slide backgrounds, shape fills
and borders. Explicit object properties, layout font sizes and backgrounds, and
rich-text formatting remain unchanged. Newly created shapes inherit theme fill
and border colours; their other catalog defaults still apply. Older objects with
stored colours retain those colours. Duplicating an inherited slide background
keeps it inherited.

The complete selected definition is stored in the shared Yjs `slide-design` map,
so themes support undo/redo, collaboration and CList Save/Post/Load without
requiring the same catalog on another host. Invalid theme definitions are rejected.
Saved personal layouts capture effective fonts and colours to preserve their design
when inserted into a presentation with another theme.
