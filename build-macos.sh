#!/usr/bin/env bash
# build-macos.sh — Build the CList desktop launcher for macOS
# Requires: pip install pyinstaller
#           brew install mkcert
# Run from the project root directory.

set -e

# --- mkcert ---
if ! command -v mkcert &>/dev/null; then
    echo "Error: mkcert not found. Install it with: brew install mkcert" >&2
    exit 1
fi

CERT_DIR="certs"
CERT_FILE="$CERT_DIR/127.0.0.1.pem"
KEY_FILE="$CERT_DIR/127.0.0.1-key.pem"

if [ ! -f "$CERT_FILE" ]; then
    mkdir -p "$CERT_DIR"
    echo "Installing mkcert CA (may prompt for your password)..."
    mkcert -install
    echo "Generating TLS certificate for 127.0.0.1..."
    mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" 127.0.0.1
    echo "Certificate written to $CERT_DIR/"
else
    echo "TLS certificate already exists in $CERT_DIR/ — skipping generation."
fi

# --- PyInstaller ---
pyinstaller \
    --onefile \
    --noconsole \
    --name "CList" \
    --add-data "index.html:." \
    --add-data "callback.html:." \
    --add-data "redirect.html:." \
    --add-data "about.html:." \
    --add-data "js:js" \
    --add-data "css:css" \
    --add-data "assets:assets" \
    --add-data "certs:certs" \
    launcher.py

echo "Build complete. Executable: dist/CList"
