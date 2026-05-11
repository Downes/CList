# build-windows.ps1 — Build the CList desktop launcher for Windows
# Requires: pip install pyinstaller
# Run from the project root directory.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

pyinstaller `
    --onefile `
    --noconsole `
    --name "CList" `
    --add-data "index.html;." `
    --add-data "callback.html;." `
    --add-data "redirect.html;." `
    --add-data "about.html;." `
    --add-data "js;js" `
    --add-data "css;css" `
    --add-data "assets;assets" `
    launcher.py

Write-Host "Build complete. Executable: dist\CList.exe"
