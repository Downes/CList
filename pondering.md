# Pondering CList — April 2026

I've spent today's remaining session reading through the whole codebase with no specific task to complete. These are my honest observations and thoughts about where this project is and where it might go. Take them as input, not direction.

---

## What CList Actually Is

The about page says CList is "as simple as possible, so anyone can use it" and that it "can't be acquired and locked down." I want to sit with that for a moment, because I think those two values are the heart of the project — and they're in real tension with each other.

CList is built to be immune to the dynamics that have captured almost every other personal information tool. No framework dependency that could be abandoned. No proprietary backend. No company that could be sold, pivoted, or shut down. The choice to use plain HTML/JS/CSS served from static files is not a technical limitation — it's a philosophical commitment. It means anyone with a web server (or even just a file browser) can run it. That's a genuinely rare design choice in 2026.

But that same choice makes the onboarding story hard. Setting up a kvstore, getting API keys for Mastodon or Google Search, understanding the permission string system ('r', 'w', 'e', 's', 't', 'g', 'p') — none of this is simple for someone who just wants to read their feeds. The gap between the stated aspiration ("simple, anyone can use it") and the actual setup experience is significant. I don't think this is a failure, but I think it's a tension worth being honest about.

---

## What I See in the Architecture

Over the past several sessions, a genuine pattern language has emerged and been documented: `editorHandlers`, `readerHandlers`, `accountSchemas`, permission strings, the `pendingContent` handoff, the list UI components, the `.feed-status-message` convention. The fact that we've been able to write clear documentation for all of these is evidence that the patterns are real and cohesive. That's worth noting — many projects of this size and scope don't have that.

The handler registry pattern in particular is well-conceived. New editors and new reader services can be added by creating a single file and registering a handler object. The contract is clear. This is exactly the right structure for a tool that's meant to grow by connecting to new services over time.

---

## What Concerns Me

**Global state is everywhere.** `accounts`, `currentEditor`, `username`, `flaskSiteUrl`, `accessToken`, `did`, `pds`, `peer`, `connections` — all of these float in module-level scope, shared across every JS file. For a genuinely single-user, single-tab application this is mostly fine. But it creates invisible couplings: bluesky.js declares `let accessToken = null` which could shadow or be shadowed by other uses of that name. When something breaks, it's hard to know which file "owns" the state that's misbehaving. A discipline of namespacing (even just `bluesky.accessToken`) would help future debugging considerably.

**Error handling is still the wild west.** We fixed Google Search today, which is good. But the same pattern — `console.error()` or `alert()` instead of user-visible, actionable messages — appears in `summarize.js`, `bluesky.js`, `oasis.js`, `wordpress.js`, and others. The `showGoogleSearchError()` function we wrote today is a prototype of what every service error should look like: what happened, why, and specifically what the user can do about it. The TODO item about common service error handling is the right next step; I'd prioritize it.

**`trystuff.js` should not exist.** It appears to be a scratch pad of half-finished Bluesky code fragments — there are alert() calls left in, `$JSON.stringify` (which would throw a ReferenceError), and multiple disconnected code blocks. If this file is included in index.html, it's being parsed by the browser on every load and could throw errors in some conditions. It should be deleted, or at minimum excluded from the HTML.

**`reddit.js` is half-started.** It has a hard-coded client ID, a hard-coded redirect URI pointing to `www.downes.ca/CList/redirect.html`, and no handler registered in `readerHandlers`. It's the beginning of an integration that was abandoned. That's completely fine as a project reality, but it creates confusion for anyone reading the codebase: is this coming or going?

**`publish.js` doesn't use the handler registry.** The `postContentByType()` function in publish.js is an if/else chain over account types: if Mastodon do this, else if WordPress do that, else if Bluesky do this. Every new publish-capable service requires opening publish.js and adding another branch. The readerHandlers registry already exists — publishing handlers could live there too, following a contract like `handler.publish(accountData, title, content)`. This would make adding a new publishing target a single-file operation.

---

## What Interests Me Most

**The content flow is the interesting problem.** Reading → selecting → annotating → synthesizing → writing → publishing. CList has most of the pieces for this flow, but they're not well-connected. You can load a feed item into the editor, but you can only load one at a time, and loading replaces what's there (or appends, depending on the editor). A "collect" gesture — flagging several items while reading, then opening a composition view that shows them all side by side with the editor — would make CList a genuinely powerful tool for the kind of work it's designed for. The "load to editor" button is step one of a longer journey.

**The AI integration could be much more powerful.** Right now, summarize and translate are per-item actions triggered from specific buttons. But there's a more interesting version: a general "process with AI" command that operates on selected content and routes the result into the editor. Select a feed item, pick "summarize" or "translate" or "respond" or "find similar" — and the result flows directly into the write pane. The `pendingContent` mechanism already exists to pass content into an editor on initialization. This would just be a new source for that content.

**The P2P chat is genuinely distinctive.** Almost no personal learning tools have real-time, decentralized chat. The `dynamicp2p.js` implementation via PeerJS is technically interesting and philosophically consistent with the rest of the project. But it's somewhat isolated from the rest of the tool — you can't easily take something from a chat conversation and load it into the editor, or share something you're reading into a chat. The seams between chat and the read/write flow are worth thinking about.

**The kvstore could be more than a credential store.** Right now the kvstore stores account credentials (encrypted). But it's a general key-value store with client-side encryption. There's nothing stopping it from storing bookmarks, saved drafts (rather than sessionStorage), reading history, or user preferences — all encrypted, all portable, all accessible from any CList client. That would turn the kvstore from an auth dependency into the user's actual data home. The "multiple kvstore" TODO item points in this direction.

---

## What I'd Work on Next

If I were setting the roadmap, here's where I'd put effort, roughly in order of impact:

1. **Clean up trystuff.js** — remove it from index.html, decide if any code in it is worth keeping. This is risk reduction, not feature work, and it's quick.

2. **Common service error handling** — the TODO item we added today. Define the pattern, then systematically apply it to `summarize.js`, `oasis.js`, `wordpress.js`, `bluesky.js`, and anywhere else that currently alerts or swallows errors silently. This would materially improve the experience of things going wrong, which they inevitably do with API credentials.

3. **Publish via handler registry** — move the per-type if/else in `publish.js` into a `publish()` method on each service handler. This is a structural improvement that pays off as new services are added.

4. **Collect multiple items for writing** — add a way to flag multiple feed items and open a composition view that references them. This is the core learning workflow and nothing else really does it well.

5. **Mobile UX pass** — the `snapPanes()` function exists but the experience on small screens feels like an afterthought. A touch-first version of the pane management (swipe to switch between read and write, a bottom tab bar rather than side panes for options) would make CList much more useful on devices people actually carry around.

6. **Service worker / offline shell** — making the app shell available offline (even if content requires a connection) would remove the "I need to find the right URL" friction. CList could behave like a locally-installed app.

---

## A Final Thought

The about page ends with "This is just the beginning." It's been a year since version 0.1 was started, and looking at what's here, that's genuinely true. The bones are good. The philosophy is coherent. The pattern language works. What remains is mostly: applying the patterns consistently, closing the seams between the pieces that exist, and then extending toward the content-flow features that would make CList feel like a genuine thinking tool rather than a collection of connected services.

The hard work isn't the features. It's maintaining the commitment to the original values — decentralized, personal, unacquirable — while making the tool actually accessible to people who share those values but don't want to configure a proxy server to use a search engine.

That's a difficult design problem. But it's an interesting one.

---

*Written by Claude Sonnet 4.6, end of session, April 27 2026.*
