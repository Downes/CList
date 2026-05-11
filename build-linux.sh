#!/usr/bin/env bash
# build-linux.sh — Build the CList desktop launcher for Linux
# Requires: pip install pyinstaller
# Run from the project root directory.

set -e

pyinstaller \
    --onefile \
    --name "clist" \
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
    launcher.py

echo "Build complete. Executable: dist/clist"
