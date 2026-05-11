#!/usr/bin/env bash
# build-linux.sh — Build the CList desktop launcher for Linux
# Requires: pip install pyinstaller
#           mkcert (see https://github.com/FiloSottile/mkcert#linux)
#           nss-tools if using Firefox: apt install libnss3-tools
# Run from the project root directory.

set -e

# --- mkcert ---
if ! command -v mkcert &>/dev/null; then
    echo "Error: mkcert not found." >&2
    echo "Install via: sudo apt install mkcert  (or download from github.com/FiloSottile/mkcert)" >&2
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
    --name "clist" \
    --add-data "index.html:." \
    --add-data "callback.html:." \
    --add-data "redirect.html:." \
    --add-data "about.html:." \
    --add-data "js:js" \
    --add-data "css:css" \
    --add-data "assets:assets" \
    --add-data "certs:certs" \
    launcher.py

echo "Build complete. Executable: dist/clist"
