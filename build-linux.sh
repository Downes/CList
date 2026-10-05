#!/usr/bin/env bash
# build-linux.sh — Build the CList desktop launcher for Linux
# Requires: pip install pyinstaller
# Run from the project root directory.

set -e

python3 -m PyInstaller \
    --onefile \
    --name "clist" \
    --add-data "index.html:." \
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
    launcher.py

echo "Build complete. Executable: dist/clist"
