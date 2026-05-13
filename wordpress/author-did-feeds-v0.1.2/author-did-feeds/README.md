# Author DID in Feeds

Plugin URL: https://clist.mooc.ca/wordpress/README.html

Author DID in Feeds is a small WordPress plugin that adds a DID field to WordPress user profiles and exposes author DIDs in RSS2 and Atom feeds.

The plugin is intended for author discovery only. It does not replace RSS or Atom author fields, and it does not sign feed entries.

## What the plugin does

- Adds a **DID** field to each WordPress user profile.
- Adds optional feed-level DID settings under **Settings → Reading**.
- Adds author DID links to RSS2 feed items.
- Adds author DID links to Atom feed entries.
- Uses `rel="author"` links rather than overloading RSS `<author>`, because RSS `<author>` is email-oriented.

## Example RSS2 output

For an RSS2 item, the plugin can output:

```xml
<atom:link rel="author" href="did:web:www.downes.ca" title="Stephen Downes" />
```

## Example Atom output

For an Atom entry, the plugin can output:

```xml
<link rel="author" href="did:web:www.downes.ca" title="Stephen Downes" />
```

## Install through WordPress admin

Use the ZIP file for this plugin.

1. Log in to your WordPress dashboard.

2. Go to **Plugins → Add New Plugin**.

3. Click **Upload Plugin**.

4. Choose the plugin ZIP file.

   Do **not** unzip it first.

5. Click **Install Now**.

6. Click **Activate Plugin**.

If you already have an older version of this plugin installed, WordPress may ask whether you want to replace the existing plugin with the uploaded version. Choose the option to replace/update the existing plugin.

## Add your DID to your user profile

After activation:

1. Go to **Users → Profile**.

2. Find the new **DID** field.

3. Enter your DID, for example:

```text
did:web:downes.ca
```

or:

```text
did:web:www.downes.ca
```

4. Click **Update Profile**.

Your RSS and Atom feeds should now include your DID on posts you authored.

## Add a feed-level author DID

The plugin can also add a DID for the feed as a whole.

1. Go to **Settings → Reading**.

2. Find the **Author DID in Feeds** section.

3. Enter a value in **Feed author DID**.

4. Optionally enter a value in **Feed author name**.

5. Click **Save Changes**.

This feed-level setting is separate from the DID field on individual user profiles. Use the user profile DID for post authors. Use the feed-level DID only when you want the feed itself to advertise an author DID.

## Check that it is working

After adding your DID, open your RSS feed in a browser or feed validator and search the page source for:

```text
rel="author"
```

You should see an author link with your DID, for example:

```xml
<atom:link rel="author" href="did:web:www.downes.ca" title="Stephen Downes" />
```

For Atom feeds, the element is unprefixed:

```xml
<link rel="author" href="did:web:www.downes.ca" title="Stephen Downes" />
```

## WordPress.com note

If your site is hosted on WordPress.com, plugin upload availability depends on your plan and account permissions. If you do not see **Upload Plugin**, then your account may not permit custom plugin uploads, or you may not have administrator access.

## Safety note

Version 0.1.2 keeps the profile DID field simple and avoids hooking directly into user-meta saving. The DID is sanitized before feed output, but profile saving is left to WordPress' normal user-contact-method handling.

## Version history

### 0.1.2

- Changed the plugin URL to `https://clist.mooc.ca/wordpress/README.html`.
- Expanded this README with full WordPress installation and configuration instructions.

### 0.1.1

- Removed the user-meta sanitizer hook used in 0.1.0, which could cause a critical error during user profile updates on some WordPress installations.
- Kept DID sanitization before feed output.

### 0.1.0

- Initial version.
