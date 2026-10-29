Here's a checklist to exercise the fix:

1. Dropbox — HTML file

Open the write pane, switch to TinyMCE, load/open some saved page so a "Loaded: …" indicator and some references are showing.
Switch away to another editor (e.g. plain text), then use Dropbox to pull in an .html file.
Expect: editor switches back to TinyMCE with the new file's content, but the "Loaded: …" indicator is gone and the references panel is empty/hidden — not showing the stale page from step 1.

2. Dropbox — plain text/markdown file

Same setup, but this time have a page loaded in the plain-text editor with its own "Loaded" state and references.
Pull in a .md or .txt file via Dropbox.
Expect: same result — fresh content, no stale indicator/references.
3. Dropbox — OPML/RSS file (regression check)

Confirm loading an .opml/.rss file via Dropbox still routes to loadCollectionText() and behaves as before (untouched code path).
4. Collections — "Load from URL" with an HTML page

Have TinyMCE showing a loaded page + references.
Use Collections' "Load from URL" with a URL that resolves to format === 'html'.
Expect: content loads, indicator/references cleared.
5. Collections — "Load from URL" with a plain-text URL

Same check for the else (plain-text) branch.
6. Collections — "Load from URL" with RSS/OPML/JSON (regression check)

Confirm this branch still works as before — it already had setLoadedPage(null), unchanged by this fix.
If anything shows a stale indicator/references where it shouldn't, or clears something it shouldn't, let me know which scenario and I'll dig in.