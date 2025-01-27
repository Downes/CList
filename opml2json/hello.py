from flask import Flask, request, jsonify
import feedparser
import listparser 
import requests  # Import requests for fetching OPML files from URLs
from datetime import datetime
from flask_cors import CORS
import time  # Import time module for caching timestamps
import xml.etree.ElementTree as ET

app = Flask(__name__)
CORS(app)  # Enable CORS if needed for frontend interaction

# Global cache for RSS feeds
feed_cache = {}



@app.route('/upload_opml', methods=['POST'])
def upload_opml():
    """Handle OPML file upload or URL, fetch RSS feeds, and return paginated JSON."""
    file = request.files.get('file')
    url = request.form.get('url')
    cursor = request.form.get('cursor', default=None, type=str)  # Get as string, then convert
    limit = int(request.form.get('limit', default=20))  # Default limit to 20 items

    if cursor:
        cursor = float(cursor)  # Convert cursor to a float timestamp

    if not file and not url:
        return jsonify({"error": "No file or URL provided"}), 400

    try:

        if file:
            # Process uploaded file
            content = file.read().decode('utf-8')

        elif url:
            # Fetch the OPML file from the provided URL
            response = requests.get(url)
            if response.status_code != 200:
                return jsonify({"error": f"Failed to fetch OPML from URL: {response.status_code}"}), 400
            content = response.content.decode('utf-8')

        result = listparser.parse(content)            
        rss_urls = parse_opml_from_content(result)   # RSS URLs
        root = ET.fromstring(content)
        title = root.find('./head/title').text       # OPML Title

        if not rss_urls:
            return jsonify({"error": "No RSS URLs found in the OPML file"}), 400

        items = fetch_rss_items(rss_urls)
        # Sort items by publication date, newest first
        items = sorted(
            [item for item in items if item["published_datetime"] is not None],
            key=lambda x: x["published_datetime"],
            reverse=True
        )

        # Apply cursor-based pagination
        if cursor:
            items = [item for item in items if item["published_datetime"].timestamp() < cursor]

        # Limit the number of items returned
        paginated_items = items[:limit]

        # Prepare next cursor (if more items are available)
        next_cursor = None
        if len(items) > limit:
            next_cursor = items[limit]["published_datetime"].timestamp()

        # Remove datetime object before returning JSON
        for item in paginated_items:
            del item["published_datetime"]

        return jsonify({"items": paginated_items, "next_cursor": next_cursor, "title": title})
    except Exception as e:
        return jsonify({"error": str(e)}), 500




def parse_opml_from_content(result):
    """Parse OPML content from a string and return a list of RSS URLs."""

    # Check for parsing errors
    if result.bozo:
        raise ValueError(f"Error parsing OPML: {result.bozo_exception}")

    # Extract RSS URLs from the feeds list
    rss_urls = [feed.url for feed in result.feeds if feed.url]
    return rss_urls

def fetch_rss_items(rss_urls):
    """Fetch and aggregate items from a list of RSS URLs, with caching."""
    items = []
    for url in rss_urls:
        current_time = time.time()
        cache_entry = feed_cache.get(url)

        if cache_entry:
            timestamp, cached_feed = cache_entry
            # Check if the cached feed is less than 1 hour old (3600 seconds)
            if current_time - timestamp < 3600:
                # Use cached feed
                feed = cached_feed
            else:
                # Fetch new feed and update cache
                feed = feedparser.parse(url)
                feed_cache[url] = (current_time, feed)
        else:
            # Fetch feed and add to cache
            feed = feedparser.parse(url)
            feed_cache[url] = (current_time, feed)

        # Process feed entries
        for entry in feed.entries:
            item = {
                "title": entry.get("title"),
                "link": entry.get("link"),
                "guid": entry.get("guid"),
                "published": entry.get("published"),
                "summary": entry.get("summary", ""),
                "source": feed.feed.get("title", url),
                "author": entry.get("author", "Unattributed"),  # Default to "Unknown"
                "full_content": 'None'  # Default to None
            }

            # Check for full content in 'content' or 'description'
            if "content" in entry and entry.content:
                item["full_content"] = entry.content[0].value  # Content is usually a list
            elif "description" in entry:
                item["full_content"] = entry.get("description")

            # Convert published date to datetime for sorting
            if "published_parsed" in entry and entry.published_parsed:
                item["published_datetime"] = datetime(*entry.published_parsed[:6])
            else:
                item["published_datetime"] = None

            # Get audio files in enclosures, append as a list
            if "enclosures" in entry:
                audio_files = []
                for enclosure in entry.enclosures:
                    # Check if the enclosure is an audio file
                    if "type" in enclosure and enclosure["type"].startswith("audio/"):
                        audio_files.append(enclosure["href"])
                if audio_files:
                    item["audio"] = audio_files

            items.append(item)
    return items

@app.route('/')
def home():
    """Display a simple home page with an upload form."""
    return """
    <h1>Welcome to the OPML2JSON Service</h1>
    <p>Please upload an OPML file, provide a URL, or specify a cursor for pagination.</p>
    <form action="/upload_opml" method="post" enctype="multipart/form-data">
        <label for="file">Choose an OPML file:</label>
        <input type="file" id="file" name="file" accept=".opml">
        <br><br>
        <label for="url">Or provide a URL to an OPML file:</label>
        <input type="url" id="url" name="url" placeholder="https://example.com/feeds.opml">
        <br><br>
        <label for="cursor">Cursor (Timestamp for Pagination):</label>
        <input type="text" id="cursor" name="cursor" placeholder="1698790400.0">
        <br><br>
        <label for="limit">Limit (Number of Results):</label>
        <input type="number" id="limit" name="limit" value="20" min="1">
        <br><br>
        <button type="submit">Submit</button>
    </form>
    """

if __name__ == '__main__':
    app.run(debug=True)


