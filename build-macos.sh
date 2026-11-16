#!/usr/bin/env bash
# build-macos.sh — Build the CList desktop launcher for macOS
# Requires: pip install pyinstaller
# Run from the project root directory.
#
# Pass --with-localrss to produce a "CList + LocalRSS" build that bundles a
# local LocalRSS backend (localrss_bundled/) alongside CList. That variant
# installs requirements-localrss.txt automatically and checks the finished executable.

set -e

NAME="CList"
EXTRA_ARGS=()

for arg in "$@"; do
    if [ "$arg" = "--with-localrss" ]; then
        python3 -m pip install -r "$(dirname "$0")/requirements-localrss.txt"
        python3 "$(dirname "$0")/localrss_bundle.py"
        NAME="CList-LocalRSS"
        EXTRA_ARGS+=(
            --add-data "localrss_bundled:localrss_bundled"
            --collect-all flask
            --collect-all aiohttp
            --collect-all feedparser
            --collect-all clist_server_admin
            --collect-all clist_kvstore_auth
        )
    fi
done

# ── Download mkcert for macOS (bundled for first-run TLS setup) ───────────────
TOOLS_DIR="$(dirname "$0")/tools"
MKCERT_BIN="$TOOLS_DIR/mkcert-darwin"

if [ ! -f "$MKCERT_BIN" ]; then
    echo "Downloading mkcert for macOS..."
    mkdir -p "$TOOLS_DIR"
    VER="v1.4.4"
    ARCH="$(uname -m)"
    if [ "$ARCH" = "arm64" ]; then
        MKCERT_URL="https://github.com/FiloSottile/mkcert/releases/download/$VER/mkcert-$VER-darwin-arm64"
    else
        MKCERT_URL="https://github.com/FiloSottile/mkcert/releases/download/$VER/mkcert-$VER-darwin-amd64"
    fi
    curl -fsSL "$MKCERT_URL" -o "$MKCERT_BIN"
    chmod +x "$MKCERT_BIN"
    echo "mkcert-darwin ($VER) downloaded to tools/"
else
    echo "mkcert-darwin already present, skipping download."
fi

python3 -m PyInstaller \
    --onefile \
    --noconsole \
    --name "$NAME" \
    --add-data "index.html:." \
    --add-data "defaults.js:." \
    --add-data "about.html:." \
    --add-data "privacy.html:." \
    --add-data "callback.html:." \
    --add-data "redirect.html:." \
    --add-data "chat.html:." \
    --add-data "chat-popup.html:." \
    --add-data "desktop.html:." \
    --add-data "desktop-how-it-works.html:." \
    --add-data "js:js" \
    --add-data "css:css" \
    --add-data "assets:assets" \
    --add-data "images:images" \
    --add-data "tools/mkcert-darwin:tools" \
    "${EXTRA_ARGS[@]}" \
    launcher.py

if [ "$NAME" = "clist-localrss" ] || [ "$NAME" = "CList-LocalRSS" ]; then
    "dist/$NAME" --check-localrss
fi

echo "Build complete. Executable: dist/$NAME"
