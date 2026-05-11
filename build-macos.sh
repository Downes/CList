#!/usr/bin/env bash
# build-macos.sh — Build the CList desktop launcher for macOS
# Requires: pip install pyinstaller
# Run from the project root directory.

set -e

# ── Download mkcert for macOS (bundled for first-run TLS setup) ───────────────
TOOLS_DIR="$(dirname "$0")/tools"
MKCERT_BIN="$TOOLS_DIR/mkcert-darwin"

if [ ! -f "$MKCERT_BIN" ]; then
    echo "Downloading mkcert for macOS..."
    mkdir -p "$TOOLS_DIR"
    VER="$(curl -fsSL https://api.github.com/repos/FiloSottile/mkcert/releases/latest | grep '"tag_name"' | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')"
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

pyinstaller \
    --onefile \
    --noconsole \
    --name "CList" \
    --add-data "index.html:." \
    --add-data "about.html:." \
    --add-data "callback.html:." \
    --add-data "redirect.html:." \
    --add-data "flasker.html:." \
    --add-data "me.html:." \
    --add-data "chat.html:." \
    --add-data "js:js" \
    --add-data "css:css" \
    --add-data "assets:assets" \
    --add-data "tools/mkcert-darwin:tools" \
    launcher.py

echo "Build complete. Executable: dist/CList"
